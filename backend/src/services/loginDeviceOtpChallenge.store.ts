import { createHash, randomInt } from 'crypto';
import { getRedisClient } from '../infrastructure/redis/client';
import { logger } from '../utils/logger';

export type LoginStepUpOtpChannel = 'EMAIL' | 'SMS' | 'WHATSAPP';

export type LoginDeviceOtpChallengeRecord = {
  otpHash: string;
  attempts: number;
  userId: string;
  deviceId: string;
  userAgent: string;
  ip: string;
  location: string;
  otpChannel: LoginStepUpOtpChannel;
  language?: string;
  currency?: string;
  lastSentAt: number;
};

const KEY_PREFIX = 'login:device:otp:';
const OTP_TTL_SECONDS = Number(process.env.LOGIN_DEVICE_OTP_TTL_SECONDS || 300);
const RESEND_COOLDOWN_MS = Number(process.env.LOGIN_DEVICE_OTP_RESEND_COOLDOWN_MS || 30_000);

const memory = new Map<string, { record: LoginDeviceOtpChallengeRecord; expiresAtMs: number }>();

function memorySweep() {
  const now = Date.now();
  for (const [k, v] of memory) {
    if (v.expiresAtMs <= now) memory.delete(k);
  }
}

function otpPepper(): string {
  return String(
    process.env.LOGIN_DEVICE_OTP_PEPPER || process.env.JWT_SECRET || 'fusiku-login-device-dev-pepper'
  ).trim();
}

export function hashLoginDeviceOtp(challengeId: string, code: string): string {
  return createHash('sha256').update(`${challengeId}:${code}:${otpPepper()}`, 'utf8').digest('hex');
}

export function generateLoginDeviceOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function loginDeviceOtpTtlSeconds(): number {
  return Math.max(60, Math.min(900, OTP_TTL_SECONDS));
}

export function loginDeviceResendCooldownMs(): number {
  return Math.max(5_000, Math.min(120_000, RESEND_COOLDOWN_MS));
}

export async function saveLoginDeviceChallenge(
  id: string,
  record: LoginDeviceOtpChallengeRecord,
  opts?: { preserveTtl?: boolean }
): Promise<void> {
  const ttlDefault = loginDeviceOtpTtlSeconds();
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
      logger.warn({ err, id }, '[login-device-otp] redis SET failed; falling back to memory');
    }
  }
  memorySweep();
  const existing = memory.get(id);
  const expiresAtMs =
    opts?.preserveTtl && existing ? existing.expiresAtMs : Date.now() + ttlDefault * 1000;
  memory.set(id, { record, expiresAtMs });
}

export async function loadLoginDeviceChallenge(id: string): Promise<LoginDeviceOtpChallengeRecord | null> {
  const c = getRedisClient();
  if (c) {
    try {
      const raw = await c.get(`${KEY_PREFIX}${id}`);
      if (raw) {
        const rec = JSON.parse(raw) as LoginDeviceOtpChallengeRecord;
        if (!rec.otpChannel) rec.otpChannel = 'EMAIL';
        return rec;
      }
      return null;
    } catch (err) {
      logger.warn({ err, id }, '[login-device-otp] redis GET failed; trying memory');
    }
  }
  memorySweep();
  const m = memory.get(id);
  if (!m || m.expiresAtMs <= Date.now()) {
    memory.delete(id);
    return null;
  }
  const rec = m.record;
  if (!rec.otpChannel) rec.otpChannel = 'EMAIL';
  return rec;
}

export async function deleteLoginDeviceChallenge(id: string): Promise<void> {
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
