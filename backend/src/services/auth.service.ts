import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import {
  generateToken,
  generateRefreshToken,
  verifyToken,
  decodeToken,
  type TokenPayload,
} from '../utils/jwt';
import { getTenantContext, isPlatformAdminRole } from '../utils/tenantContext';
import { activityLogService } from './activityLog.service';
import { emailService } from './email.service';
import { assertValidSetupPassword, isBcryptHash, isValidEmailStrict } from '../utils/validation';

/** Include shape for login / refresh — branch carries nested company for resolution. */
export const authUserForTokenInclude = {
  role: true,
  branch: { include: { company: true } },
  company: true,
} satisfies Prisma.UserInclude;

export type AuthUserForToken = Prisma.UserGetPayload<{
  include: typeof authUserForTokenInclude;
}>;

/** Resolve tenant id from user.companyId OR branch.companyId OR company.id (User relation). */
export function resolveCompanyIdForToken(user: AuthUserForToken): string | null {
  if (user.companyId && user.companyId.trim() !== '') return user.companyId;
  if (user.branch?.companyId) return user.branch.companyId;
  if (user.company?.id) return user.company.id;
  return null;
}

export function buildAuthTokenPayload(user: AuthUserForToken): TokenPayload {
  const isSystemAdmin = isPlatformAdminRole(user.role.name);
  const companyId = resolveCompanyIdForToken(user);
  if (!isSystemAdmin && !companyId) {
    throw new Error(
      'Account is missing tenant assignment (companyId). Contact your administrator.'
    );
  }

  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    roleId: user.roleId,
    roleName: user.role.name,
    branchId: user.branchId || undefined,
    isSystemAdmin: !!isSystemAdmin,
  };

  if (companyId) {
    payload.companyId = companyId;
  }

  return payload;
}

export const authService = {
  async login(email: string, password: string) {
    console.log('LOGIN EMAIL:', email);

    const raw = String(email || '').trim();
    const normalized = raw.toLowerCase();
    if (!isValidEmailStrict(normalized)) throw new Error('Invalid credentials');

    const user = await prisma.user.findFirst({
      where: {
        isActive: true,
        OR: [{ email: normalized }, { email: raw }],
      },
      include: authUserForTokenInclude,
    });

    console.log('FOUND USER:', user);

    if (user) {
      console.log('STORED PASSWORD:', user.password);
      console.log('IS BCRYPT:', user.password?.startsWith('$2'));
    }

    if (!user) throw new Error('Invalid credentials');

    if (!user.password || !isBcryptHash(user.password)) {
      const err: any = new Error(
        'Account configuration error: password is not stored securely. Contact your administrator.'
      );
      err.statusCode = 403;
      throw err;
    }

    const valid = bcrypt.compareSync(password, user.password);
    console.log('PASSWORD MATCH:', valid);
    if (!valid) throw new Error('Invalid credentials');

    await activityLogService.log({ userId: user.id, action: 'user_login', entityType: 'User', entityId: user.id });

    if (!user.companyId && !user.branch?.companyId && !user.company?.id) {
      throw new Error('USER HAS NO COMPANY RELATION IN DATABASE');
    }

    const payload = buildAuthTokenPayload(user);
    const token = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name,
        companyId: resolveCompanyIdForToken(user) ?? user.companyId ?? undefined,
        branchId: user.branchId,
        branch: user.branch?.name
      }
    };
  },

  async refresh(tokenOrRefreshToken: string) {
    let payload = null;
    try {
      payload = verifyToken(tokenOrRefreshToken);
    } catch {
      payload = decodeToken(tokenOrRefreshToken);
    }
    if (!payload?.userId) throw new Error('Invalid or expired token');

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: authUserForTokenInclude,
    });
    if (!user || !user.isActive) throw new Error('User not found or inactive');

    const newPayload = buildAuthTokenPayload(user);
    return {
      token: generateToken(newPayload),
      refreshToken: generateRefreshToken(newPayload)
    };
  },

  async register(data: { email: string; password: string; name: string; roleId: string; companyId: string; branchId?: string }) {
    const emailNorm = String(data.email || '').trim().toLowerCase();
    if (!isValidEmailStrict(emailNorm)) throw new Error('Invalid email format');
    if (!data.password || typeof data.password !== 'string') throw new Error('Password is required');

    const exists = await prisma.user.findFirst({ where: { email: emailNorm, companyId: data.companyId } });
    if (exists) throw new Error('Email already registered');

    const hashed = bcrypt.hashSync(data.password, 10);
    if (!isBcryptHash(hashed)) throw new Error('Password hashing failed');
    const user = await prisma.user.create({
      data: { ...data, email: emailNorm, password: hashed },
      include: authUserForTokenInclude,
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
      branchId: user.branchId,
      branch: user.branch?.name
    };
  },

  async forgotPassword(email: string, baseUrl?: string) {
    const raw = String(email || '').trim();
    const normalized = raw.toLowerCase();
    if (!isValidEmailStrict(normalized)) return;
    const user = await prisma.user.findFirst({
      where: { isActive: true, OR: [{ email: normalized }, { email: raw }] },
    });
    if (!user) return; // Don't reveal if email exists

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordReset.deleteMany({ where: { userId: user.id } });
    await prisma.passwordReset.create({ data: { userId: user.id, token, expiresAt } });

    const url = baseUrl || process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${url.replace(/\/$/, '')}/reset-password?token=${token}`;
    await emailService.sendPasswordReset(user.email, resetLink, user.name);
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const ctx = getTenantContext();
    if (!ctx) throw new Error('Unauthorized');
    const isAdmin = ctx.isSystemAdmin;
    if (!isAdmin && !ctx.companyId) throw new Error('Unauthorized');

    const scopedWhere = {
      id: userId,
      isActive: true,
      ...(ctx.companyId ? { companyId: ctx.companyId } : {}),
    };

    const user = await prisma.user.findFirst({
      where: scopedWhere,
    });
    if (!user) throw new Error('User not found');

    if (!user.password || !isBcryptHash(user.password)) {
      throw new Error('Account configuration error. Contact your administrator.');
    }

    const valid = bcrypt.compareSync(currentPassword, user.password);
    if (!valid) throw new Error('Current password is incorrect');

    const hashed = bcrypt.hashSync(newPassword, 10);
    const updated = await prisma.user.updateMany({
      where: ctx.companyId ? { id: userId, companyId: ctx.companyId } : { id: userId },
      data: { password: hashed },
    });
    if (updated.count === 0) throw new Error('User not found');
  },

  async resetPassword(token: string, newPassword: string) {
    const record = await prisma.passwordReset.findFirst({
      where: { token },
      include: { user: true }
    });
    if (!record) throw new Error('Invalid or expired reset link');
    if (record.expiresAt < new Date()) {
      await prisma.passwordReset.delete({ where: { id: record.id } });
      throw new Error('Reset link has expired');
    }

    assertValidSetupPassword(newPassword);
    const hashed = bcrypt.hashSync(newPassword, 10);
    const companyId = record.user.companyId;
    const updated = await prisma.user.updateMany({
      where: { id: record.userId, companyId },
      data: { password: hashed }
    });
    if (updated.count === 0) throw new Error('Unable to update password');
    await prisma.passwordReset.delete({ where: { id: record.id } });
  }
};
