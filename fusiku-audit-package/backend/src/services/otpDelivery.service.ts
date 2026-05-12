import { Resend } from 'resend';
import { logger } from '../utils/logger';
import { isChinaMode } from '../utils/chinaMode';
import { deliverOtpToPhone } from './signupOtpDelivery.service';

function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

function resendApiKey(): string {
  return String(process.env.RESEND_API_KEY || '').trim();
}

function allowConsoleOtpFallback(): boolean {
  if (!isProd()) return true;
  return String(process.env.OTP_CONSOLE_FALLBACK || '').trim() === '1';
}

export const otpDeliveryService = {
  async sendEmailOtp(email: string, code: string) {
    const to = String(email || '').trim().toLowerCase();
    if (!to || !code) throw new Error('Email and code are required');

    if (isChinaMode()) {
      logger.info('[otp-email] (CHINA_MODE) skipping send; code for %s: %s', to, code);
      console.log('[otp-email] CHINA_MODE — OTP for %s: %s', to, code);
      return { channel: 'console' as const };
    }

    const key = resendApiKey();
    if (!key) {
      // Temporary safety: if RESEND_API_KEY is missing, do not break the flow.
      // Fallback to console OTP (same idea as CHINA_MODE) so QA/dev can continue.
      logger.info('[otp-email] (console fallback: missing RESEND_API_KEY) code for %s: %s', to, code);
      console.log('[OTP]', to, code);
      return { channel: 'console' as const };
    }

    const resend = new Resend(key);
    await resend.emails.send({
      from: String(process.env.RESEND_FROM || 'Fusiku <no-reply@fusiku.com>'),
      to,
      subject: 'Your verification code',
      text: `Your OTP is ${code}\n\nIf you did not request this, ignore this message.`,
      html: `<p>Your OTP is <strong>${code}</strong></p><p>If you did not request this, ignore this message.</p>`,
    });
    return { channel: 'resend' as const };
  },

  async sendWhatsAppOtp(phone: string, code: string) {
    const raw = String(phone || '').trim();
    if (!raw || !code) throw new Error('Phone and code are required');

    // Accept requested env names as aliases for existing Twilio config.
    if (!process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_SID) {
      process.env.TWILIO_ACCOUNT_SID = String(process.env.TWILIO_SID);
    }
    if (!process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_TOKEN) {
      process.env.TWILIO_AUTH_TOKEN = String(process.env.TWILIO_TOKEN);
    }

    try {
      await deliverOtpToPhone({ phone: raw, code, channel: 'WHATSAPP' });
      return { channel: 'twilio' as const };
    } catch (err) {
      if (!allowConsoleOtpFallback()) throw err;
      logger.info('[otp-whatsapp] (console fallback) code for %s: %s', raw, code);
      return { channel: 'console' as const };
    }
  },
};

