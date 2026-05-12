import { createHash, randomInt } from 'crypto';
import { getRedisClient } from '../infrastructure/redis/client';
import { logger } from '../utils/logger';

export type SignupOtpPayload = {
  companyName: string;
  email: string;
  password: string;
  businessType?: string;
  /** Persisted on user after signup when provided. */
  phone?: string;
};

export type SignupOtpChallengeRecord = {
  otpHash: string;
  attempts: number;
  payload: SignupOtpPayload;
  phone?: string;
  /** Same OTP was also sent to phone (SMS/WhatsApp). */
  alsoSentPhone?: boolean;
  /** Channel used for optional phone delivery. */
  phoneOtpChannel?: 'SMS' | 'WHATSAPP';
  lastSentAt: number;
};

const KEY_PREFIX = 'signup:otp:';
const OTP_TTL_SECONDS = Number(process.env.SIGNUP_OTP_TTL_SECONDS || 300);
const RESEND_COOLDOWN_MS = Number(process.env.SIGNUP_OTP_RESEND_COOLDOWN_MS || 30_000);

const memory = new Map<string, { record: SignupOtpChallengeRecord; expiresAtMs: number }>();

function memorySweep() {
  const now = Date.now();
  for (const [k, v] of memory) {
    if (v.expiresAtMs <= now) memory.delete(k);
  }
}

function otpPepper(): string {
  return String(process.env.SIGNUP_OTP_PEPPER || process.env.JWT_SECRET || 'fusiku-signup-otp-dev-pepper').trim();
}

export function hashOtp(challengeId: string, code: string): string {
  return createHash('sha256').update(`${challengeId}:${code}:${otpPepper()}`, 'utf8').digest('hex');
}

export function generateSixDigitOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function signupOtpTtlSeconds(): number {
  return Math.max(60, Math.min(900, OTP_TTL_SECONDS));
}

export function signupResendCooldownMs(): number {
  return Math.max(5_000, Math.min(120_000, RESEND_COOLDOWN_MS));
}

export async function saveChallenge(
  id: string,
  record: SignupOtpChallengeRecord,
  opts?: { preserveTtl?: boolean }
): Promise<void> {
  const ttlDefault = signupOtpTtlSeconds();
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
      logger.warn({ err, id }, '[signup-otp] redis SET failed; falling back to memory');
    }
  }
  memorySweep();
  const existing = memory.get(id);
  const expiresAtMs =
    opts?.preserveTtl && existing ? existing.expiresAtMs : Date.now() + ttlDefault * 1000;
  memory.set(id, { record, expiresAtMs });
}

export async function loadChallenge(id: string): Promise<SignupOtpChallengeRecord | null> {
  const c = getRedisClient();
  if (c) {
    try {
      const raw = await c.get(`${KEY_PREFIX}${id}`);
      if (raw) return JSON.parse(raw) as SignupOtpChallengeRecord;
      return null;
    } catch (err) {
      logger.warn({ err, id }, '[signup-otp] redis GET failed; trying memory');
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

export async function deleteChallenge(id: string): Promise<void> {
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
