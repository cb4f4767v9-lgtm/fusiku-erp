import bcrypt from 'bcrypt';
import crypto, { timingSafeEqual } from 'crypto';
import { prismaPlatform as prisma } from '../utils/prismaPlatform';
import { authService } from './auth.service';
import { isBcryptHash, isValidEmailStrict } from '../utils/validation';
import { getRedisClient } from '../infrastructure/redis/client';
import { logger } from '../utils/logger';
import { otpDeliveryService } from './otpDelivery.service';

type OtpChallengeRecord = {
  otpHash: string;
  attempts: number;
  email: string;
  companyId: string;
  /** Optional phone captured at request time; may be persisted on new user. */
  phone?: string;
  method: 'email' | 'whatsapp';
  lastSentAt: number;
};

const KEY_PREFIX = 'auth:otp:';
const COOLDOWN_PREFIX = 'auth:otp:cooldown:';
const OTP_TTL_SECONDS = Number(process.env.OTP_TTL_SECONDS || 300);
const RESEND_COOLDOWN_MS = Number(process.env.OTP_RESEND_COOLDOWN_MS || 30_000);
const MAX_VERIFY_ATTEMPTS = Math.max(3, Math.min(10, Number(process.env.OTP_MAX_VERIFY_ATTEMPTS || 5)));

const memory = new Map<string, { record: OtpChallengeRecord; expiresAtMs: number }>();

function memorySweep() {
  const now = Date.now();
  for (const [k, v] of memory) {
    if (v.expiresAtMs <= now) memory.delete(k);
  }
}

function otpPepper(): string {
  return String(process.env.OTP_PEPPER || process.env.JWT_SECRET || 'fusiku-auth-otp-dev-pepper').trim();
}

function hashOtp(challengeId: string, code: string): string {
  return crypto.createHash('sha256').update(`${challengeId}:${code}:${otpPepper()}`, 'utf8').digest('hex');
}

function generateSixDigitOtp(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function otpTtlSeconds(): number {
  return Math.max(60, Math.min(900, OTP_TTL_SECONDS));
}

function resendCooldownMs(): number {
  return Math.max(5_000, Math.min(120_000, RESEND_COOLDOWN_MS));
}

function hashesMatch(stored: string, incoming: string): boolean {
  try {
    const a = Buffer.from(stored, 'hex');
    const b = Buffer.from(incoming, 'hex');
    if (a.length !== b.length || a.length === 0) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function saveChallenge(id: string, record: OtpChallengeRecord, opts?: { preserveTtl?: boolean }) {
  const ttlDefault = otpTtlSeconds();
  const payload = JSON.stringify(record);
  const c = getRedisClient();
  if (c) {
    try {
      let ex = ttlDefault;
      if (opts?.preserveTtl) {
        const cur = await c.ttl(`${KEY_PREFIX}${id}`);
        if (typeof cur === 'number' && cur > 0) ex = cur;
      }
      await c.set(`${KEY_PREFIX}${id}`, payload, 'EX', ex);
      return;
    } catch (err) {
      logger.warn({ err, id }, '[auth-otp] redis SET failed; falling back to memory');
    }
  }
  memorySweep();
  const existing = memory.get(id);
  const expiresAtMs =
    opts?.preserveTtl && existing ? existing.expiresAtMs : Date.now() + ttlDefault * 1000;
  memory.set(id, { record, expiresAtMs });
}

async function loadChallenge(id: string): Promise<OtpChallengeRecord | null> {
  const c = getRedisClient();
  if (c) {
    try {
      const raw = await c.get(`${KEY_PREFIX}${id}`);
      if (raw) return JSON.parse(raw) as OtpChallengeRecord;
      return null;
    } catch (err) {
      logger.warn({ err, id }, '[auth-otp] redis GET failed; trying memory');
    }
  }
  memorySweep();
  const m = memory.get(id);
  if (!m || m.expiresAtMs <= Date.now()) {
    memory.delete(id);
    return null;
  }
  return m.record;
}

async function deleteChallenge(id: string): Promise<void> {
  const c = getRedisClient();
  if (c) {
    try {
      await c.del(`${KEY_PREFIX}${id}`);
    } catch {
      /* ignore */
    }
  }
  memory.delete(id);
}

async function enforceCooldownOrThrow(key: string) {
  const ttlSeconds = Math.max(5, Math.ceil(resendCooldownMs() / 1000));
  const c = getRedisClient();
  if (c) {
    try {
      const set = await c.set(key, '1', 'EX', ttlSeconds, 'NX');
      if (set !== 'OK') {
        const err: any = new Error('Please wait before requesting another code.');
        err.statusCode = 429;
        throw err;
      }
      return;
    } catch (err: any) {
      // If redis is available but returns NX miss -> throw above; for any other redis error, fall back to memory.
      if (err?.statusCode === 429) throw err;
      logger.warn({ err, key }, '[auth-otp] redis cooldown failed; falling back to memory');
    }
  }
  const now = Date.now();
  const existing = memory.get(key);
  if (existing && existing.expiresAtMs > now) {
    const err: any = new Error('Please wait before requesting another code.');
    err.statusCode = 429;
    throw err;
  }
  memory.set(key, { record: { otpHash: '', attempts: 0, email: '', companyId: '', method: 'email', lastSentAt: now }, expiresAtMs: now + ttlSeconds * 1000 });
}

async function resolveCompanyIdForEmail(emailNorm: string, companyIdRaw?: string): Promise<string> {
  const companyIdInput = String(companyIdRaw || '').trim();
  if (companyIdInput) return companyIdInput;

  // Match authService.login behavior: allow auto-resolve when email maps to exactly one active tenant.
  const matches = await prisma.user.findMany({
    where: {
      isActive: true,
      email: emailNorm,
    },
    select: { companyId: true },
    take: 3,
  });
  const uniqueCompanyIds = Array.from(
    new Set(matches.map((m) => String(m.companyId || '').trim()).filter(Boolean))
  );
  if (uniqueCompanyIds.length === 1) return uniqueCompanyIds[0] as string;

  const err: any = new Error('companyId is required');
  err.statusCode = 400;
  throw err;
}

function displayNameFromEmail(email: string): string {
  const local = String(email || '').split('@')[0] || 'User';
  const cleaned = local.replace(/[^a-zA-Z0-9._-]/g, ' ').trim();
  if (!cleaned) return 'User';
  return cleaned.slice(0, 80);
}

async function ensureUserForOtpLogin(opts: {
  emailNorm: string;
  rawEmail: string;
  companyId: string;
  phone?: string;
}) {
  const existing = await prisma.user.findFirst({
    where: {
      isActive: true,
      companyId: opts.companyId,
      OR: [{ email: opts.emailNorm }, { email: opts.rawEmail }],
    },
    select: { id: true },
  });
  if (existing?.id) return existing.id;

  const company = await prisma.company.findFirst({
    where: { id: opts.companyId, isActive: true },
    select: { id: true },
  });
  if (!company) {
    const err: any = new Error('Invalid or inactive company');
    err.statusCode = 400;
    throw err;
  }

  // Use the standard seeded role for basic users.
  const staffRole = await prisma.role.findUnique({ where: { name: 'staff' } });
  if (!staffRole) {
    const err: any = new Error('Default role not found. Run database seed first.');
    err.statusCode = 500;
    throw err;
  }

  const randomPassword = crypto.randomBytes(32).toString('hex');
  const hashed = bcrypt.hashSync(randomPassword, 10);
  if (!isBcryptHash(hashed)) {
    const err: any = new Error('Password hashing failed');
    err.statusCode = 500;
    throw err;
  }

  const created = await prisma.user.create({
    data: {
      email: opts.emailNorm,
      password: hashed,
      name: displayNameFromEmail(opts.emailNorm),
      phone: opts.phone && opts.phone.trim().length >= 6 ? opts.phone.trim() : undefined,
      roleId: staffRole.id,
      companyId: opts.companyId,
      isActive: true,
      emailVerifiedAt: new Date(),
    } as any,
    select: { id: true },
  });

  return created.id;
}

export const otpService = {
  async requestOtp(body: { contact: string; method: 'email' | 'whatsapp'; companyId?: string }) {
    const raw = String(body.contact || '').trim();
    const emailNorm = raw.toLowerCase();
    console.log('OTP REQUEST RECEIVED:', emailNorm);
    if (!isValidEmailStrict(emailNorm)) {
      const err: any = new Error('Invalid email format');
      err.statusCode = 400;
      throw err;
    }

    const companyId = await resolveCompanyIdForEmail(emailNorm, body.companyId);

    await enforceCooldownOrThrow(`${COOLDOWN_PREFIX}${companyId}:${emailNorm}`);

    const method = body.method === 'whatsapp' ? 'whatsapp' : 'email';

    const now = Date.now();
    const challengeId = crypto.randomUUID();
    const code = generateSixDigitOtp();
    const otpHash = hashOtp(challengeId, code);

    const contact = raw;
    const otp = code;
    if (process.env.NODE_ENV !== 'production' || process.env.CHINA_MODE === '1') {
      console.log('===== OTP DEBUG =====');
      console.log('CONTACT:', contact);
      console.log('OTP CODE:', otp);
      console.log('=====================');
      console.log('OTP:', otp);
    }

    // Resolve optional phone for WhatsApp delivery from user record.
    let phone: string | undefined;
    if (method === 'whatsapp') {
      const u = await prisma.user.findFirst({
        where: { isActive: true, companyId, email: emailNorm },
        select: { phone: true },
      });
      phone = String(u?.phone || '').trim() || undefined;
      if (!phone) {
        const err: any = new Error('No phone number found for this account. Use email OTP instead.');
        err.statusCode = 400;
        throw err;
      }
    }

    const record: OtpChallengeRecord = {
      otpHash,
      attempts: 0,
      email: emailNorm,
      companyId,
      phone,
      method,
      lastSentAt: now,
    };

    await saveChallenge(challengeId, record);

    // Force dev-mode console OTP when email delivery is disabled or not configured.
    // Must run BEFORE any provider logic and must not block the flow.
    const disableEmailOtp = String(process.env.DISABLE_EMAIL_OTP || '').trim().toLowerCase() === 'true';
    const hasResendKey = Boolean(String(process.env.RESEND_API_KEY || '').trim());
    if (method === 'email' && (!hasResendKey || disableEmailOtp)) {
      console.log('[DEV OTP]', emailNorm, code);
      return {
        success: true,
        challengeId,
        expiresInSeconds: otpTtlSeconds(),
        message: 'OTP generated in dev mode',
      };
    }

    if (method === 'whatsapp') {
      await otpDeliveryService.sendWhatsAppOtp(phone!, code);
    } else {
      await otpDeliveryService.sendEmailOtp(emailNorm, code);
    }

    return {
      success: true,
      challengeId,
      expiresInSeconds: otpTtlSeconds(),
      message: 'Verification code sent.',
    };
  },

  async verifyOtp(body: { challengeId: string; code: string }) {
    const challengeId = String(body.challengeId || '').trim();
    const code = String(body.code || '').replace(/\s/g, '');
    if (!challengeId || !/^\d{6}$/.test(code)) {
      const err: any = new Error('Invalid verification request');
      err.statusCode = 400;
      throw err;
    }

    const rec = await loadChallenge(challengeId);
    if (!rec) {
      const err: any = new Error('Verification expired or invalid. Request a new code.');
      err.statusCode = 400;
      throw err;
    }

    if (rec.attempts >= MAX_VERIFY_ATTEMPTS) {
      await deleteChallenge(challengeId);
      const err: any = new Error('Too many attempts. Request a new code.');
      err.statusCode = 400;
      throw err;
    }

    const expected = hashOtp(challengeId, code);
    if (!hashesMatch(rec.otpHash, expected)) {
      rec.attempts += 1;
      await saveChallenge(challengeId, rec, { preserveTtl: true });
      const left = MAX_VERIFY_ATTEMPTS - rec.attempts;
      const err: any = new Error(
        left > 0
          ? `Incorrect verification code. ${left} attempt${left === 1 ? '' : 's'} remaining.`
          : 'Incorrect verification code.'
      );
      err.statusCode = 400;
      throw err;
    }

    await deleteChallenge(challengeId);

    // Login (or signup) happens here.
    const userId = await ensureUserForOtpLogin({
      emailNorm: rec.email,
      rawEmail: rec.email,
      companyId: rec.companyId,
      phone: rec.phone,
    });

    // Self-heal tenant linkage after OTP (must never throw "Invalid or inactive company").
    let user = await prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: { id: true, companyId: true },
    });
    console.log('USER:', user);
    console.log('USER COMPANY:', user?.companyId);

    const defaultCompanyData = {
      name: 'My Company',
      businessType: 'mobile_shop',
      isActive: true,
    } as const;

    let companyId = String(user?.companyId || '').trim();
    if (!companyId) {
      const company = await prisma.company.create({ data: defaultCompanyData as any });
      await prisma.user.update({ where: { id: userId }, data: { companyId: company.id } });
      companyId = company.id;
      user = await prisma.user.findFirst({ where: { id: userId, isActive: true }, select: { id: true, companyId: true } });
    }

    let company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      company = await prisma.company.create({ data: defaultCompanyData as any });
      await prisma.user.update({ where: { id: userId }, data: { companyId: company.id } });
      companyId = company.id;
    } else if (company.isActive === false) {
      company = await prisma.company.update({ where: { id: companyId }, data: { isActive: true } });
    }

    // Use existing auth session issuer to keep token/user shape consistent.
    const session = await authService.issueAuthSessionForUserId(userId, companyId, 'user_login');
    return {
      success: true,
      token: session.token,
      refreshToken: session.refreshToken,
      user: session.user,
      company: (session as any).company ?? (company ? { id: company.id, name: company.name, businessType: (company as any).businessType ?? null, isActive: company.isActive } : null),
      isNewUser: !String((session.user as any)?.companyId || '').trim(),
    };
  },
};

