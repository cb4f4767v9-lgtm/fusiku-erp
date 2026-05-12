import { randomUUID, timingSafeEqual } from 'crypto';
import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { saasSignupService } from '../services/saasSignup.service';
import { isPublicSignupEndpointEnabled } from '../utils/publicSignupGate';
import {
  deleteChallenge,
  generateSixDigitOtp,
  hashOtp,
  loadChallenge,
  saveChallenge,
  signupOtpTtlSeconds,
  signupResendCooldownMs,
  SignupOtpPayload,
} from '../services/signupOtpChallenge.store';
import {
  allowSignupOtpConsoleFallback,
  deliverOtpToPhone,
  deliverSignupEmailOtp,
} from '../services/signupOtpDelivery.service';
import { isSmtpConfigured } from '../services/email.service';
import { isChinaMode } from '../utils/chinaMode';
import { prismaPlatform as prisma } from '../utils/prismaPlatform';
import { setRefreshTokenCookie } from '../utils/authCookies';
import { z } from 'zod';

const MAX_VERIFY_ATTEMPTS = 3;
const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number')
  .optional();

function displayNameFromEmail(email: string): string {
  const local = String(email || '').split('@')[0] || 'Admin';
  const cleaned = local.replace(/[^a-zA-Z0-9._-]/g, ' ').trim();
  if (!cleaned) return 'Admin';
  return cleaned.slice(0, 80);
}

function otpHashesMatch(stored: string, incoming: string): boolean {
  try {
    const a = Buffer.from(stored, 'hex');
    const b = Buffer.from(incoming, 'hex');
    if (a.length !== b.length || a.length === 0) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function provisionAndSession(payload: SignupOtpPayload) {
  const provisioned = await saasSignupService.provisionTenantWithValidation({
    companyName: payload.companyName,
    adminEmail: payload.email,
    adminPassword: payload.password,
    adminName: displayNameFromEmail(payload.email.toLowerCase()),
    adminPhone: payload.phone,
    businessType: payload.businessType,
  });
  const session = await authService.issueAuthSessionForUserId(
    provisioned.userId,
    provisioned.companyId,
    'tenant_signup'
  );
  return {
    companyId: provisioned.companyId,
    accessToken: session.token,
    refreshToken: session.refreshToken,
    user: session.user,
  };
}

export const signupController = {
  /** Step 1–2: validate signup payload, store challenge, send email OTP (+ optional phone). */
  async start(req: Request, res: Response) {
    if (!isPublicSignupEndpointEnabled()) {
      return res.status(403).json({ error: 'Public signup is not enabled on this server' });
    }

    if (req.body && String((req.body as { website?: unknown }).website || '').trim() !== '') {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const emailConfigured = isSmtpConfigured() || allowSignupOtpConsoleFallback() || isChinaMode();
    if (!emailConfigured) {
      return res.status(503).json({
        error:
          'Signup requires email verification: configure SMTP_* or EMAIL_HOST_* (Gmail App Password), or set SIGNUP_OTP_CONSOLE_FALLBACK=1 for testing.',
      });
    }

    try {
      const body = req.body as {
        companyName?: unknown;
        email?: unknown;
        password?: unknown;
        businessType?: unknown;
        phone?: unknown;
        alsoSendPhone?: unknown;
        phoneOtpChannel?: unknown;
      };
      const companyName = String(body.companyName ?? '').trim();
      const email = String(body.email ?? '').trim();
      const password = String(body.password ?? '');
      const phoneRaw = String(body.phone ?? '').trim();
      const phone = phoneRaw ? (phoneSchema.safeParse(phoneRaw).success ? phoneRaw : null) : '';
      if (phoneRaw && !phone) {
        return res.status(400).json({ message: 'Invalid phone number' });
      }
      const businessType =
        body.businessType === undefined || body.businessType === null
          ? undefined
          : String(body.businessType);
      const alsoSendPhone = Boolean(body.alsoSendPhone);
      const phoneOtpChannel: 'SMS' | 'WHATSAPP' =
        String(body.phoneOtpChannel ?? '').toUpperCase() === 'WHATSAPP' ? 'WHATSAPP' : 'SMS';

      if (alsoSendPhone && phone.length < 6) {
        return res.status(400).json({ message: 'Invalid phone number' });
      }

      const payload: SignupOtpPayload = { companyName, email, password, businessType };
      if (phone) payload.phone = phone;

      const challengeId = randomUUID();
      const code = generateSixDigitOtp();
      const otpHash = hashOtp(challengeId, code);
      const record = {
        otpHash,
        attempts: 0,
        payload,
        phone: phone || undefined,
        alsoSentPhone: false as boolean,
        phoneOtpChannel: undefined as 'SMS' | 'WHATSAPP' | undefined,
        lastSentAt: Date.now(),
      };

      await saveChallenge(challengeId, record);

      let emailDelivery: { channel: 'smtp' | 'console' };
      try {
        emailDelivery = await deliverSignupEmailOtp({ email: email.toLowerCase(), code });
      } catch (e: any) {
        if (String(process.env.SIGNUP_OTP_DEBUG_RESPONSE || '').trim() === '1') {
          console.error('[signup/start] SMTP error; returning debug OTP (SIGNUP_OTP_DEBUG_RESPONSE=1)', e);
          return res.status(200).json({
            challengeId,
            expiresInSeconds: signupOtpTtlSeconds(),
            debugOtpCode: code,
            warning: 'Email delivery failed; OTP returned for debugging only. Disable SIGNUP_OTP_DEBUG_RESPONSE in production.',
          });
        }
        await deleteChallenge(challengeId);
        return res.status(400).json({ error: e.message || 'Failed to send email verification code' });
      }

      if (alsoSendPhone && phone) {
        try {
          await deliverOtpToPhone({ phone, code, channel: phoneOtpChannel });
          record.alsoSentPhone = true;
          record.phoneOtpChannel = phoneOtpChannel;
          await saveChallenge(challengeId, record, { preserveTtl: true });
        } catch (e: any) {
          await deleteChallenge(challengeId);
          return res.status(400).json({ error: e.message || 'Failed to send phone verification code' });
        }
      }

      const responseBody: Record<string, unknown> = {
        challengeId,
        expiresInSeconds: signupOtpTtlSeconds(),
        message: 'Verification code sent.',
      };
      if (String(process.env.SIGNUP_OTP_DEBUG_RESPONSE || '').trim() === '1' && emailDelivery.channel === 'console') {
        responseBody.debugOtpCode = code;
        responseBody.warning =
          'SMTP not configured; OTP logged server-side. Set EMAIL_HOST_* / SMTP_* or disable SIGNUP_OTP_DEBUG_RESPONSE.';
      }

      return res.status(200).json(responseBody);
    } catch (e: any) {
      const code = e?.statusCode === 404 ? 404 : 400;
      return res.status(code).json({ error: e.message || 'Signup failed' });
    }
  },

  /** Step 4: verify OTP, provision tenant, issue session. */
  async verify(req: Request, res: Response) {
    if (!isPublicSignupEndpointEnabled()) {
      return res.status(403).json({ error: 'Public signup is not enabled on this server' });
    }

    try {
      const body = req.body as { challengeId?: unknown; code?: unknown };
      const challengeId = String(body.challengeId ?? '').trim();
      const rawCode = String(body.code ?? '').replace(/\D/g, '');
      const code = rawCode.slice(0, 6);

      if (!challengeId || code.length !== 6) {
        return res.status(400).json({ error: 'Invalid verification request' });
      }

      const rec = await loadChallenge(challengeId);
      if (!rec) {
        return res.status(400).json({ error: 'Verification expired or invalid. Start again.' });
      }

      if (rec.attempts >= MAX_VERIFY_ATTEMPTS) {
        await deleteChallenge(challengeId);
        return res.status(400).json({ error: 'Too many attempts. Request a new code.' });
      }

      const expectedHash = hashOtp(challengeId, code);
      if (!otpHashesMatch(rec.otpHash, expectedHash)) {
        rec.attempts += 1;
        await saveChallenge(challengeId, rec, { preserveTtl: true });
        const left = MAX_VERIFY_ATTEMPTS - rec.attempts;
        const hint =
          left > 0
            ? `Incorrect verification code. ${left} attempt${left === 1 ? '' : 's'} remaining.`
            : 'Incorrect verification code.';
        return res.status(400).json({ error: hint });
      }

      await deleteChallenge(challengeId);

      const result = await provisionAndSession(rec.payload);
      await prisma.user.update({
        where: { id: result.user.id },
        data: {
          emailVerifiedAt: new Date(),
          ...(rec.alsoSentPhone && rec.phone ? { phoneVerifiedAt: new Date() } : {}),
        } as object,
      });

      if (result.refreshToken) {
        setRefreshTokenCookie(res, result.refreshToken);
      }
      return res.status(201).json(result);
    } catch (e: any) {
      const code = e?.statusCode === 404 ? 404 : 400;
      return res.status(code).json({ error: e.message || 'Verification failed' });
    }
  },

  /** Resend OTP (cooldown + same attempt budget). */
  async resend(req: Request, res: Response) {
    if (!isPublicSignupEndpointEnabled()) {
      return res.status(403).json({ error: 'Public signup is not enabled on this server' });
    }

    try {
      const challengeId = String((req.body as { challengeId?: unknown }).challengeId ?? '').trim();
      if (!challengeId) {
        return res.status(400).json({ error: 'Missing challenge' });
      }

      const rec = await loadChallenge(challengeId);
      if (!rec) {
        return res.status(400).json({ error: 'Verification expired or invalid. Start again.' });
      }

      const cooldown = signupResendCooldownMs();
      const elapsed = Date.now() - rec.lastSentAt;
      if (elapsed < cooldown) {
        const waitSec = Math.ceil((cooldown - elapsed) / 1000);
        return res.status(429).json({
          error: `Resend available in ${waitSec}s`,
          retryAfterSeconds: waitSec,
        });
      }

      const code = generateSixDigitOtp();
      rec.otpHash = hashOtp(challengeId, code);
      rec.lastSentAt = Date.now();

      await saveChallenge(challengeId, rec, { preserveTtl: true });

      let emailDelivery: { channel: 'smtp' | 'console' };
      try {
        emailDelivery = await deliverSignupEmailOtp({ email: String(rec.payload.email || '').toLowerCase(), code });
        if (rec.alsoSentPhone && rec.phone) {
          await deliverOtpToPhone({
            phone: rec.phone,
            code,
            channel: rec.phoneOtpChannel || 'SMS',
          });
        }
      } catch (e: any) {
        if (String(process.env.SIGNUP_OTP_DEBUG_RESPONSE || '').trim() === '1') {
          console.error('[signup/resend] delivery error; returning debug OTP (SIGNUP_OTP_DEBUG_RESPONSE=1)', e);
          return res.status(200).json({
            message: 'Verification code resent (debug).',
            expiresInSeconds: signupOtpTtlSeconds(),
            debugOtpCode: code,
            warning: 'Email delivery failed; OTP returned for debugging only.',
          });
        }
        return res.status(400).json({ error: e.message || 'Failed to resend code' });
      }

      const resendBody: Record<string, unknown> = {
        message: 'Verification code resent.',
        expiresInSeconds: signupOtpTtlSeconds(),
      };
      if (String(process.env.SIGNUP_OTP_DEBUG_RESPONSE || '').trim() === '1' && emailDelivery.channel === 'console') {
        resendBody.debugOtpCode = code;
        resendBody.warning =
          'SMTP not configured; OTP logged server-side. Set EMAIL_HOST_* / SMTP_* or disable SIGNUP_OTP_DEBUG_RESPONSE.';
      }

      return res.status(200).json(resendBody);
    } catch (e: any) {
      return res.status(400).json({ error: e.message || 'Resend failed' });
    }
  },
};
