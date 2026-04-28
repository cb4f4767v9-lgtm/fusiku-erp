import { Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prismaPlatform as prisma } from '../utils/prismaPlatform';
import {
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
  type TokenPayload,
} from '../utils/jwt';
import { getTenantContext, isPlatformAdminRole } from '../utils/tenantContext';
import { activityLogService } from './activityLog.service';
import { auditLogService } from './auditLog.service';
import { emailService } from './email.service';
import { assertPublicSignupPasswordStrength, assertValidSetupPassword, isBcryptHash, isValidEmailStrict } from '../utils/validation';
import { assertRegisterEndpointAllowed } from '../utils/saasRegisterGate';
import { resolvePermissionCodesForRole } from './permissionResolve.service';
import { normalizeCurrencyCode, normalizeUiLanguage, textDirectionForLanguage } from '../utils/supportedLocale';

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

  const branchRoleRaw = (user as any).branchRole;
  const branchRole =
    branchRoleRaw === 'SUPER_ADMIN' || branchRoleRaw === 'BRANCH_ADMIN' || branchRoleRaw === 'BRANCH_USER'
      ? (branchRoleRaw as TokenPayload['branchRole'])
      : undefined;

  const branchIdNorm =
    user.branchId && String(user.branchId).trim() ? String(user.branchId).trim() : null;

  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    roleId: user.roleId,
    roleName: user.role.name,
    branchId: branchIdNorm,
    branchRole,
    isSystemAdmin: !!isSystemAdmin,
    // Always emit explicit claims so clients and logs never rely on "missing key" vs null.
    companyId: isSystemAdmin ? (companyId ?? null) : (companyId as string),
  };

  return payload;
}

async function sessionUserFromDbUser(user: AuthUserForToken) {
  const payload = buildAuthTokenPayload(user);
  const permissions = await resolvePermissionCodesForRole(user.roleId);
  const language = normalizeUiLanguage((user as { language?: string | null }).language);
  const currency = normalizeCurrencyCode((user as { currency?: string | null }).currency);
  const branchDefaultLanguage = normalizeUiLanguage(
    (user.branch as { defaultLanguage?: string | null } | null | undefined)?.defaultLanguage
  );
  const branchDefaultCurrency = normalizeCurrencyCode(user.branch?.currency ?? undefined);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role.name,
    branchRole: payload.branchRole,
    companyId: resolveCompanyIdForToken(user) ?? user.companyId ?? undefined,
    branchId: user.branchId,
    branch: user.branch?.name,
    permissions,
    language,
    direction: textDirectionForLanguage(language),
    currency,
    branchDefaultLanguage,
    branchDefaultCurrency,
  };
}

export const authService = {
  async login(
    email: string,
    password: string,
    companyIdRaw: string | null | undefined,
    clientPrefs?: { language?: string; currency?: string }
  ) {
    const raw = String(email || '').trim();
    const normalized = raw.toLowerCase();
    if (!isValidEmailStrict(normalized)) throw new Error('Invalid credentials');

    const companyIdInput = String(companyIdRaw || '').trim();
    let companyId = companyIdInput;

    if (!companyId) {
      // Try to auto-resolve tenant by email when possible (premium UX: no Company ID field).
      const matches = await prisma.user.findMany({
        where: {
          isActive: true,
          OR: [{ email: normalized }, { email: raw }],
        },
        select: { companyId: true },
        take: 3,
      });

      const uniqueCompanyIds = Array.from(
        new Set(matches.map((m) => String(m.companyId || '').trim()).filter(Boolean))
      );

      if (uniqueCompanyIds.length === 1) {
        companyId = uniqueCompanyIds[0] as string;
      } else {
        const err: any = new Error('companyId is required');
        err.statusCode = 400;
        throw err;
      }
    }

    const user = await prisma.user.findFirst({
      where: {
        isActive: true,
        companyId,
        OR: [{ email: normalized }, { email: raw }],
      },
      include: authUserForTokenInclude,
    });

    if (!user) throw new Error('Invalid credentials');

    if (!user.password || !isBcryptHash(user.password)) {
      const err: any = new Error(
        'Account configuration error: password is not stored securely. Contact your administrator.'
      );
      err.statusCode = 403;
      throw err;
    }

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) throw new Error('Invalid credentials');

    if (clientPrefs?.language || clientPrefs?.currency) {
      const patch: Prisma.UserUpdateInput = {};
      if (clientPrefs.language) patch.language = normalizeUiLanguage(clientPrefs.language);
      if (clientPrefs.currency) patch.currency = normalizeCurrencyCode(clientPrefs.currency);
      await prisma.user.update({
        where: { id: user.id },
        data: patch,
      });
      const reloaded = await prisma.user.findFirst({
        where: { id: user.id },
        include: authUserForTokenInclude,
      });
      if (reloaded) Object.assign(user, reloaded);
    }

    await activityLogService.log({ userId: user.id, action: 'user_login', entityType: 'User', entityId: user.id });
    await auditLogService.log({
      userId: user.id,
      action: 'user_login',
      entity: 'User',
      entityId: user.id,
      branchId: user.branchId,
      metadata: { companyId: resolveCompanyIdForToken(user) ?? null },
    });

    if (!user.companyId && !user.branch?.companyId && !user.company?.id) {
      throw new Error('USER HAS NO COMPANY RELATION IN DATABASE');
    }

    const payload = buildAuthTokenPayload(user);
    const token = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const sessionUser = await sessionUserFromDbUser(user);
    return {
      token,
      refreshToken,
      user: sessionUser,
    };
  },

  async refresh(refreshToken: string) {
    const payload = verifyRefreshToken(refreshToken);
    if (!payload?.userId) throw new Error('Invalid or expired token');
    if (!payload.isSystemAdmin && !payload.companyId) throw new Error('Invalid or expired token');

    const tenantOrClause =
      payload.companyId && !payload.isSystemAdmin
        ? {
            OR: [
              { companyId: payload.companyId },
              { branch: { companyId: payload.companyId } },
              { company: { id: payload.companyId } },
            ],
          }
        : {};

    const user = await prisma.user.findFirst({
      where: {
        id: payload.userId,
        isActive: true,
        ...tenantOrClause,
      },
      include: authUserForTokenInclude,
    });
    if (!user) throw new Error('User not found or inactive');

    if (!resolveCompanyIdForToken(user) && !isPlatformAdminRole(user.role.name)) {
      throw new Error('Account is missing tenant assignment (companyId). Contact your administrator.');
    }

    const newPayload = buildAuthTokenPayload(user);
    if (!payload.isSystemAdmin && payload.companyId && newPayload.companyId && payload.companyId !== newPayload.companyId) {
      throw new Error('Invalid or expired token');
    }
    if (!!payload.isSystemAdmin !== !!newPayload.isSystemAdmin) {
      throw new Error('Invalid or expired token');
    }
    const out = {
      token: generateToken(newPayload),
      refreshToken: generateRefreshToken(newPayload),
    };
    await activityLogService.log({
      userId: user.id,
      action: 'token_refresh',
      entityType: 'User',
      entityId: user.id,
    });
    await auditLogService.log({
      userId: user.id,
      action: 'token_refresh',
      entity: 'User',
      entityId: user.id,
      branchId: user.branchId,
      metadata: { companyId: resolveCompanyIdForToken(user) ?? null },
    });
    const sessionUser = await sessionUserFromDbUser(user);
    return { ...out, user: sessionUser };
  },

  async me(userId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, isActive: true },
      include: authUserForTokenInclude,
    });
    if (!user) throw new Error('Unauthorized');
    return sessionUserFromDbUser(user);
  },

  async logout(userId: string) {
    const ctx = getTenantContext();
    await activityLogService.log({
      userId,
      action: 'user_logout',
      entityType: 'User',
      entityId: userId,
    });
    await auditLogService.log({
      userId,
      action: 'user_logout',
      entity: 'User',
      entityId: userId,
      branchId: ctx?.branchId,
      metadata: { companyId: ctx?.companyId ?? null },
    });
    return { ok: true };
  },

  /**
   * Issue JWT session after trusted provisioning (public SaaS signup).
   * Response shape matches `login` for frontend compatibility.
   */
  async issueAuthSessionForUserId(
    userId: string,
    companyId: string,
    activityAction: 'user_login' | 'tenant_signup' = 'tenant_signup'
  ) {
    const user = await prisma.user.findFirst({
      where: { id: userId, companyId },
      include: authUserForTokenInclude,
    });
    if (!user || !user.isActive) {
      const err = new Error('User not found') as Error & { statusCode?: number };
      err.statusCode = 404;
      throw err;
    }

    if (!user.password || !isBcryptHash(user.password)) {
      const err = new Error('Account configuration error. Contact your administrator.') as Error & {
        statusCode?: number;
      };
      err.statusCode = 403;
      throw err;
    }

    if (!user.companyId && !user.branch?.companyId && !user.company?.id) {
      const err = new Error('USER HAS NO COMPANY RELATION IN DATABASE') as Error & { statusCode?: number };
      err.statusCode = 500;
      throw err;
    }

    await activityLogService.log({
      userId: user.id,
      action: activityAction,
      entityType: 'User',
      entityId: user.id,
    });

    const payload = buildAuthTokenPayload(user);
    const token = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const sessionUser = await sessionUserFromDbUser(user);
    return {
      token,
      refreshToken,
      user: {
        id: sessionUser.id,
        email: sessionUser.email,
        name: sessionUser.name,
        role: sessionUser.role,
        companyId: sessionUser.companyId,
        branchId: sessionUser.branchId,
        branch: sessionUser.branch,
        language: sessionUser.language,
        direction: sessionUser.direction,
        currency: sessionUser.currency,
        branchDefaultLanguage: sessionUser.branchDefaultLanguage,
        branchDefaultCurrency: sessionUser.branchDefaultCurrency,
      },
    };
  },

  async updatePreferences(
    userId: string,
    body: { language?: string; currency?: string }
  ) {
    const data: Prisma.UserUpdateInput = {};
    if (body.language !== undefined) data.language = normalizeUiLanguage(body.language);
    if (body.currency !== undefined) data.currency = normalizeCurrencyCode(body.currency);
    if (!Object.keys(data).length) throw new Error('No preferences to update');

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      include: authUserForTokenInclude,
    });
    return sessionUserFromDbUser(updated as AuthUserForToken);
  },

  async register(
    data: { email: string; password: string; name: string; roleId: string; companyId: string; branchId?: string },
    opts?: { internalRegisterToken?: string }
  ) {
    assertRegisterEndpointAllowed(opts?.internalRegisterToken);

    const emailNorm = String(data.email || '').trim().toLowerCase();
    if (!isValidEmailStrict(emailNorm)) throw new Error('Invalid email format');
    if (!data.password || typeof data.password !== 'string') throw new Error('Password is required');

    assertPublicSignupPasswordStrength(data.password);

    const companyId = String(data.companyId || '').trim();
    if (!companyId) throw new Error('companyId is required');

    const company = await prisma.company.findFirst({
      where: { id: companyId, isActive: true },
    });
    if (!company) throw new Error('Invalid or inactive company');

    const role = await prisma.role.findFirst({ where: { id: data.roleId } });
    if (role && isPlatformAdminRole(role.name)) {
      throw new Error('Cannot assign platform role through self-registration');
    }

    if (data.branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: data.branchId, companyId },
      });
      if (!branch) throw new Error('Invalid branch for this company');
    }

    const exists = await prisma.user.findFirst({ where: { email: emailNorm, companyId } });
    if (exists) throw new Error('Email already registered');

    const hashed = bcrypt.hashSync(data.password, 10);
    if (!isBcryptHash(hashed)) throw new Error('Password hashing failed');
    const user = await prisma.user.create({
      data: { ...data, email: emailNorm, companyId, password: hashed },
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

  async forgotPassword(email: string, companyIdRaw: string, baseUrl?: string) {
    const raw = String(email || '').trim();
    const normalized = raw.toLowerCase();
    if (!isValidEmailStrict(normalized)) return;
    const companyId = String(companyIdRaw || '').trim();
    if (!companyId) return;
    const user = await prisma.user.findFirst({
      where: { isActive: true, companyId, OR: [{ email: normalized }, { email: raw }] },
    });
    if (!user) return; // Don't reveal if email exists

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordReset.deleteMany({ where: { userId: user.id } });
    await prisma.passwordReset.create({ data: { userId: user.id, token, expiresAt } });

    const url = baseUrl || process.env.FRONTEND_URL || 'http://localhost:3001';
    const resetLink = `${url.replace(/\/$/, '')}/reset-password?token=${token}`;
    await emailService.sendPasswordReset(user.email, resetLink, user.name);
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const ctx = getTenantContext();
    if (!ctx || ctx.userId !== userId) throw new Error('Unauthorized');

    const user = await prisma.user.findFirst({
      where: { id: userId, isActive: true },
      include: authUserForTokenInclude,
    });
    if (!user) throw new Error('User not found');

    const userCompany = resolveCompanyIdForToken(user);
    if (isPlatformAdminRole(user.role.name) && !userCompany) {
      /* self-only, already enforced by ctx.userId */
    } else {
      if (!userCompany) throw new Error('Forbidden');
      if (!ctx.companyId || ctx.companyId !== userCompany) throw new Error('Forbidden');
    }

    if (!user.password || !isBcryptHash(user.password)) {
      throw new Error('Account configuration error. Contact your administrator.');
    }

    const valid = bcrypt.compareSync(currentPassword, user.password);
    if (!valid) throw new Error('Current password is incorrect');

    const hashed = bcrypt.hashSync(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });
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
