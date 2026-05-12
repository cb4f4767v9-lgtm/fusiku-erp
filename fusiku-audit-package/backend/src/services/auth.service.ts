import { Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prismaPlatform as prisma } from '../utils/prismaPlatform';
import {
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
  type TokenPayload,
} from '../utils/jwt';
import { getTenantContext, isPlatformAdminRole } from '../utils/tenantContext';
import { activityLogService } from './activityLog.service';
import { auditLogService } from './auditLog.service';
import { emailService, isSmtpConfigured } from './email.service';
import { assertPublicSignupPasswordStrength, assertValidSetupPassword, isBcryptHash, isValidEmailStrict } from '../utils/validation';
import { assertRegisterEndpointAllowed } from '../utils/saasRegisterGate';
import { resolvePermissionCodesForRole } from './permissionResolve.service';
import { normalizeCurrencyCode, normalizeUiLanguage, textDirectionForLanguage } from '../utils/supportedLocale';
import {
  deleteLoginDeviceChallenge,
  generateLoginDeviceOtp,
  hashLoginDeviceOtp,
  loadLoginDeviceChallenge,
  type LoginStepUpOtpChannel,
  loginDeviceResendCooldownMs,
  saveLoginDeviceChallenge,
} from './loginDeviceOtpChallenge.store';
import { allowLoginDeviceOtpConsoleFallback, deliverLoginStepUpOtp } from './loginDeviceOtpDelivery.service';
import {
  twilioSmsFromConfigured,
  twilioWhatsAppFromConfigured,
} from './signupOtpDelivery.service';
import {
  ipBaselineChanged,
  locationBaselineChanged,
} from '../utils/clientRequestMeta';

/** Include shape for login / refresh — branch carries nested company for resolution. */
export const authUserForTokenInclude = {
  role: true,
  branch: { include: { company: true } },
  company: { include: { setupProfile: true } },
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
  const companyBusinessType =
    user.company?.businessType ?? user.branch?.company?.businessType ?? undefined;
  const companyBusinessTypesRaw = (user.company as any)?.setupProfile?.businessTypes ?? null;
  const companyBusinessTypes =
    Array.isArray(companyBusinessTypesRaw) && companyBusinessTypesRaw.length
      ? companyBusinessTypesRaw.map((s: any) => String(s || '').trim()).filter(Boolean)
      : undefined;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role.name,
    branchRole: payload.branchRole,
    companyId: resolveCompanyIdForToken(user) ?? user.companyId ?? undefined,
    companyBusinessType,
    companyBusinessTypes,
    branchId: user.branchId,
    branch: user.branch?.name,
    permissions,
    language,
    direction: textDirectionForLanguage(language),
    currency,
    branchDefaultLanguage,
    branchDefaultCurrency,
    twoFactorEnabled: Boolean((user as { twoFactorEnabled?: boolean }).twoFactorEnabled),
    otpChannel: normalizeSessionOtpChannel((user as { otpChannel?: string | null }).otpChannel),
  };
}

function normalizeSessionOtpChannel(raw: string | null | undefined): string {
  const u = String(raw || 'EMAIL').toUpperCase();
  if (u === 'SMS' || u === 'WHATSAPP' || u === 'EMAIL') return u.toLowerCase();
  return 'email';
}

function listAvailableStepUpChannels(user: Pick<AuthUserForToken, 'email' | 'phone'>): LoginStepUpOtpChannel[] {
  const out: LoginStepUpOtpChannel[] = [];
  const emailOk = isSmtpConfigured() || allowLoginDeviceOtpConsoleFallback();
  if (emailOk) out.push('EMAIL');
  const ph = String(user.phone || '').trim();
  if (ph && twilioSmsFromConfigured()) out.push('SMS');
  if (ph && twilioWhatsAppFromConfigured()) out.push('WHATSAPP');
  if (!out.length) out.push('EMAIL');
  return out;
}

function pickStepUpChannel(
  available: LoginStepUpOtpChannel[],
  dbChannel: string | null | undefined,
  requestRaw?: string
): LoginStepUpOtpChannel {
  const norm = (s: string) => String(s || '').toUpperCase();
  const req = norm(requestRaw || '');
  if (req === 'SMS' || req === 'WHATSAPP' || req === 'EMAIL') {
    if (available.includes(req as LoginStepUpOtpChannel)) return req as LoginStepUpOtpChannel;
  }
  const pref = norm(dbChannel || '');
  if (pref === 'SMS' || pref === 'WHATSAPP' || pref === 'EMAIL') {
    if (available.includes(pref as LoginStepUpOtpChannel)) return pref as LoginStepUpOtpChannel;
  }
  return available[0]!;
}

const LOGIN_DEVICE_OTP_MAX_ATTEMPTS = Math.max(3, Math.min(10, Number(process.env.LOGIN_DEVICE_OTP_MAX_ATTEMPTS || 5)));

async function finalizeSuccessfulLogin(user: AuthUserForToken) {
  await activityLogService.log({ userId: user.id, action: 'user_login', entityType: 'User', entityId: user.id });
  await auditLogService.log({
    userId: user.id,
    action: 'user_login',
    entity: 'User',
    entityId: user.id,
    branchId: user.branchId,
    metadata: { companyId: resolveCompanyIdForToken(user) ?? null },
  });

  // OTP/login must never hard-fail on missing/inactive company:
  // - if user.companyId is null → create a default tenant and link it
  // - if company exists but inactive → activate it
  // - if company missing → create a default tenant and link it
  //
  // Keep this logic local to auth session issuance to avoid breaking the rest of the auth flow.
  let effectiveUser = user;
  console.log('USER:', effectiveUser);
  console.log('USER COMPANY:', (effectiveUser as any)?.companyId);

  const defaultCompanyData = {
    name: 'My Company',
    businessType: 'mobile_shop',
    isActive: true,
  } as const;

  const resolveCompanyIdLoose = (u: AuthUserForToken) =>
    String(u.companyId || u.branch?.companyId || (u.company as any)?.id || '').trim() || null;

  let companyId = resolveCompanyIdLoose(effectiveUser);
  if (!companyId) {
    const company = await prisma.company.create({ data: defaultCompanyData as any });
    await prisma.user.update({ where: { id: effectiveUser.id }, data: { companyId: company.id } });
    companyId = company.id;
    const reloaded = await prisma.user.findFirst({
      where: { id: effectiveUser.id, isActive: true },
      include: authUserForTokenInclude,
    });
    if (reloaded) effectiveUser = reloaded as AuthUserForToken;
  }

  let company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    company = await prisma.company.create({ data: defaultCompanyData as any });
    await prisma.user.update({ where: { id: effectiveUser.id }, data: { companyId: company.id } });
    companyId = company.id;
    const reloaded = await prisma.user.findFirst({
      where: { id: effectiveUser.id, isActive: true },
      include: authUserForTokenInclude,
    });
    if (reloaded) effectiveUser = reloaded as AuthUserForToken;
  } else if (company.isActive === false) {
    company = await prisma.company.update({ where: { id: company.id }, data: { isActive: true } });
  }

  if (String(effectiveUser.companyId || '').trim() !== companyId) {
    await prisma.user.update({ where: { id: effectiveUser.id }, data: { companyId } });
    const reloaded = await prisma.user.findFirst({
      where: { id: effectiveUser.id, isActive: true },
      include: authUserForTokenInclude,
    });
    if (reloaded) effectiveUser = reloaded as AuthUserForToken;
  }

  const payload = buildAuthTokenPayload(effectiveUser);
  const token = generateToken(payload);
  const refreshToken = generateRefreshToken(payload);
  const sessionUser = await sessionUserFromDbUser(effectiveUser);
  return {
    token,
    refreshToken,
    user: sessionUser,
    company: company
      ? {
          id: company.id,
          name: company.name,
          businessType: (company as any).businessType ?? null,
          isActive: company.isActive,
        }
      : null,
  };
}

export type LoginResult =
  | {
      requiresDeviceVerification: true;
      challengeId: string;
      availableChannels: string[];
      defaultChannel: string;
    }
  | {
      token: string;
      refreshToken: string;
      user: Awaited<ReturnType<typeof sessionUserFromDbUser>>;
      company?: { id: string; name: string; businessType?: string | null; isActive?: boolean } | null;
    };

export const authService = {
  async login(
    email: string,
    password: string,
    companyIdRaw: string | null | undefined,
    clientPrefs?: { language?: string; currency?: string },
    deviceCtx?: { deviceId: string; ip: string; location: string; userAgent: string },
    stepUpChannelRaw?: string
  ): Promise<LoginResult> {
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

    const deviceId = deviceCtx?.deviceId?.trim();
    if (!deviceId) {
      return finalizeSuccessfulLogin(user);
    }

    const ip = String(deviceCtx!.ip || '').slice(0, 128);
    const location = String(deviceCtx!.location || '').slice(0, 512);
    const ua = String(deviceCtx!.userAgent || '').slice(0, 8000);

    const trusted = await prisma.trustedDevice.findUnique({
      where: { userId_deviceId: { userId: user.id, deviceId } },
    });

    const twoFa = Boolean((user as { twoFactorEnabled?: boolean }).twoFactorEnabled);
    let needsStepUp = false;
    if (!trusted) needsStepUp = true;
    else if (twoFa) needsStepUp = true;
    else if (ipBaselineChanged(trusted.lastIp, ip)) needsStepUp = true;
    else if (locationBaselineChanged(trusted.lastLocation, location)) needsStepUp = true;

    if (needsStepUp) {
      const challengeId = crypto.randomUUID();
      const code = generateLoginDeviceOtp();
      const otpHash = hashLoginDeviceOtp(challengeId, code);
      const available = listAvailableStepUpChannels(user);
      const otpChannel = pickStepUpChannel(
        available,
        (user as { otpChannel?: string | null }).otpChannel,
        stepUpChannelRaw
      );

      await saveLoginDeviceChallenge(challengeId, {
        otpHash,
        attempts: 0,
        userId: user.id,
        deviceId,
        userAgent: ua,
        ip,
        location,
        otpChannel,
        language: clientPrefs?.language,
        currency: clientPrefs?.currency,
        lastSentAt: Date.now(),
      });

      await deliverLoginStepUpOtp({
        channel: otpChannel,
        email: String(user.email || '').trim(),
        phone: user.phone,
        code,
      });

      return {
        requiresDeviceVerification: true,
        challengeId,
        availableChannels: available.map((c) => c.toLowerCase()),
        defaultChannel: otpChannel.toLowerCase(),
      };
    }

    await prisma.trustedDevice.update({
      where: { userId_deviceId: { userId: user.id, deviceId } },
      data: {
        userAgent: ua || null,
        lastIp: ip || null,
        lastLocation: location || null,
      },
    });

    return finalizeSuccessfulLogin(user);
  },

  async verifyLoginDevice(challengeIdRaw: string, codeRaw: string): Promise<Exclude<LoginResult, { requiresDeviceVerification: true }>> {
    const challengeId = String(challengeIdRaw || '').trim();
    const normalized = String(codeRaw || '').replace(/\s/g, '');
    if (!challengeId || !/^\d{6}$/.test(normalized)) throw new Error('Invalid verification code');

    const rec = await loadLoginDeviceChallenge(challengeId);
    if (!rec) throw new Error('Verification expired. Sign in again.');

    if (rec.attempts >= LOGIN_DEVICE_OTP_MAX_ATTEMPTS) {
      await deleteLoginDeviceChallenge(challengeId);
      throw new Error('Too many attempts. Sign in again.');
    }

    const expect = hashLoginDeviceOtp(challengeId, normalized);
    if (rec.otpHash !== expect) {
      rec.attempts += 1;
      await saveLoginDeviceChallenge(challengeId, rec, { preserveTtl: true });
      throw new Error('Invalid verification code');
    }

    await deleteLoginDeviceChallenge(challengeId);

    const user = await prisma.user.findFirst({
      where: { id: rec.userId, isActive: true },
      include: authUserForTokenInclude,
    });
    if (!user) throw new Error('Invalid verification code');

    await prisma.trustedDevice.upsert({
      where: { userId_deviceId: { userId: user.id, deviceId: rec.deviceId } },
      create: {
        userId: user.id,
        deviceId: rec.deviceId,
        userAgent: rec.userAgent || null,
        lastIp: rec.ip || null,
        lastLocation: rec.location || null,
      },
      update: {
        userAgent: rec.userAgent || null,
        lastIp: rec.ip || null,
        lastLocation: rec.location || null,
      },
    });

    return finalizeSuccessfulLogin(user);
  },

  async resendLoginDeviceOtp(challengeIdRaw: string, channelRaw?: string): Promise<{ ok: true }> {
    const challengeId = String(challengeIdRaw || '').trim();
    if (!challengeId) throw new Error('Invalid challenge');

    const rec = await loadLoginDeviceChallenge(challengeId);
    if (!rec) throw new Error('Verification expired. Sign in again.');

    const user = await prisma.user.findFirst({
      where: { id: rec.userId, isActive: true },
    });
    if (!user?.email) throw new Error('Verification expired. Sign in again.');

    const now = Date.now();
    if (now - rec.lastSentAt < loginDeviceResendCooldownMs()) {
      const err: any = new Error('Please wait before requesting another code.');
      err.statusCode = 429;
      throw err;
    }

    const otpPref = (user as { otpChannel?: string | null }).otpChannel;
    const available = listAvailableStepUpChannels(user as Pick<AuthUserForToken, 'email' | 'phone'>);
    const otpChannel = pickStepUpChannel(available, otpPref, channelRaw ?? rec.otpChannel);

    const code = generateLoginDeviceOtp();
    rec.otpHash = hashLoginDeviceOtp(challengeId, code);
    rec.lastSentAt = now;
    rec.otpChannel = otpChannel;
    await saveLoginDeviceChallenge(challengeId, rec, { preserveTtl: true });

    await deliverLoginStepUpOtp({
      channel: otpChannel,
      email: String(user.email || '').trim(),
      phone: user.phone,
      code,
    });

    return { ok: true };
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
    // Prefer strict lookup, but fall back to id-only so we can self-heal missing tenant linkage.
    const user =
      (await prisma.user.findFirst({
        where: { id: userId, companyId },
        include: authUserForTokenInclude,
      })) ||
      (await prisma.user.findFirst({
        where: { id: userId },
        include: authUserForTokenInclude,
      }));
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

    console.log('USER:', user);
    console.log('USER COMPANY:', (user as any)?.companyId);

    await activityLogService.log({
      userId: user.id,
      action: activityAction,
      entityType: 'User',
      entityId: user.id,
    });

    // Reuse the same self-healing + response shape as regular login.
    const out = await finalizeSuccessfulLogin(user as AuthUserForToken);
    return out;
  },

  async updatePreferences(
    userId: string,
    body: { language?: string; currency?: string; twoFactorEnabled?: boolean; otpChannel?: string }
  ) {
    const data: Prisma.UserUpdateInput = {};
    if (body.language !== undefined) data.language = normalizeUiLanguage(body.language);
    if (body.currency !== undefined) data.currency = normalizeCurrencyCode(body.currency);
    if (body.twoFactorEnabled !== undefined)
      (data as Record<string, unknown>).twoFactorEnabled = Boolean(body.twoFactorEnabled);
    if (body.otpChannel !== undefined) {
      const ch = String(body.otpChannel || '').toUpperCase();
      if (ch !== 'EMAIL' && ch !== 'SMS' && ch !== 'WHATSAPP') throw new Error('Invalid otpChannel');
      const u = await prisma.user.findFirst({
        where: { id: userId, isActive: true },
        select: { phone: true },
      });
      if ((ch === 'SMS' || ch === 'WHATSAPP') && !String(u?.phone || '').trim()) {
        throw new Error('Add and verify a phone number before using SMS or WhatsApp OTP');
      }
      (data as Record<string, unknown>).otpChannel = ch;
    }
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
