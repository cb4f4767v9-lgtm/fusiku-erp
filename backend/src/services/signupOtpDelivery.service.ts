import { logger } from '../utils/logger';
import { isChinaMode } from '../utils/chinaMode';
import { emailService, isSmtpConfigured } from './email.service';

function twilioConfigured(): boolean {
  const sid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
  const token = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
  const from =
    String(process.env.TWILIO_MESSAGING_SERVICE_SID || '').trim() ||
    String(process.env.TWILIO_FROM_NUMBER || '').trim() ||
    String(process.env.TWILIO_WHATSAPP_FROM || '').trim();
  return Boolean(sid && token && from);
}

export function isSignupSmsDeliveryAvailable(): boolean {
  return twilioConfigured();
}

export function twilioSmsFromConfigured(): boolean {
  const sid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
  const token = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
  const messagingSid = String(process.env.TWILIO_MESSAGING_SERVICE_SID || '').trim();
  const fromNum = String(process.env.TWILIO_FROM_NUMBER || '').trim();
  return Boolean(sid && token && (messagingSid || fromNum));
}

export function twilioWhatsAppFromConfigured(): boolean {
  const sid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
  const token = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
  const fromWa = String(process.env.TWILIO_WHATSAPP_FROM || '').trim();
  return Boolean(sid && token && fromWa);
}

export type SignupEmailOtpDelivery = { channel: 'smtp' | 'console' };

/** Primary signup path — verifies ownership of the email address. */
export async function deliverSignupEmailOtp(params: { email: string; code: string }): Promise<SignupEmailOtpDelivery> {
  const email = String(params.email || '').trim().toLowerCase();
  const code = params.code;
  if (!email || !code) throw new Error('Email and code are required');

  if (isChinaMode()) {
    logger.info('[signup-email-otp] (CHINA_MODE) skipping SMTP; code for %s: %s', email, code);
    console.log('[signup-email-otp] CHINA_MODE — OTP for %s: %s', email, code);
    return { channel: 'console' };
  }

  if (!isSmtpConfigured()) {
    if (!allowSignupOtpConsoleFallback()) {
      throw new Error(
        'Signup email OTP requires SMTP (or EMAIL_HOST_*) Gmail credentials, or SIGNUP_OTP_CONSOLE_FALLBACK=1 for testing.'
      );
    }
    logger.info('[signup-email-otp] (console fallback) code for %s: %s', email, code);
    console.log('[signup-email-otp] SMTP not configured; console fallback for:', email);
    return { channel: 'console' };
  }

  console.log('[signup-email-otp] Sending verification email to:', email);
  try {
    const info = await emailService.send({
      to: email,
      subject: 'Your verification code',
      text: `Your OTP is ${code}\n\nIf you did not request this, ignore this message.`,
      html: `<p>Your OTP is <strong>${code}</strong></p><p>If you did not request this, ignore this message.</p>`,
    });
    if (info && typeof info === 'object' && 'messageId' in info && info.messageId === 'skipped') {
      console.error('[signup-email-otp] Email skipped (transporter misconfigured)');
      throw new Error('Email could not be sent: SMTP transporter unavailable');
    }
    console.log('[signup-email-otp] Email sent successfully');
    return { channel: 'smtp' };
  } catch (err: unknown) {
    console.error('[signup-email-otp] Email failed:', err);
    throw err;
  }
}

/** Console/log fallback when Twilio is not configured (local dev or explicit opt-in). */
export function allowSignupOtpConsoleFallback(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return String(process.env.SIGNUP_OTP_CONSOLE_FALLBACK || '').trim() === '1';
}

function normalizeE164(raw: string): string {
  const s = String(raw || '').trim().replace(/\s/g, '');
  if (!s) return '';
  const digits = s.replace(/^whatsapp:/i, '');
  return digits.startsWith('+') ? digits : `+${digits.replace(/^\+/, '')}`;
}

/**
 * Twilio SMS or WhatsApp (when TWILIO_WHATSAPP_FROM is set to whatsapp:+...).
 * Without Twilio: logs OTP when console fallback is allowed.
 */
export async function deliverSignupOtp(params: { phone?: string; code: string }): Promise<void> {
  await deliverOtpToPhone({ phone: String(params.phone || '').trim(), code: params.code, channel: 'SMS' });
}

/** SMS or WhatsApp explicitly (login step-up + optional signup copy). */
export async function deliverOtpToPhone(params: {
  phone: string;
  code: string;
  channel: 'SMS' | 'WHATSAPP';
}): Promise<void> {
  const code = params.code;
  const sid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
  const token = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
  const messagingSid = String(process.env.TWILIO_MESSAGING_SERVICE_SID || '').trim();
  const fromNum = String(process.env.TWILIO_FROM_NUMBER || '').trim();
  const fromWa = String(process.env.TWILIO_WHATSAPP_FROM || '').trim();

  if (!sid || !token || (!messagingSid && !fromNum && !fromWa)) {
    if (!allowSignupOtpConsoleFallback()) {
      throw new Error(
        'Phone OTP delivery is not configured. Set Twilio env vars or SIGNUP_OTP_CONSOLE_FALLBACK=1 for testing.'
      );
    }
    logger.info('[phone-otp] (console fallback) verification code: %s', code);
    return;
  }

  const phone = normalizeE164(String(params.phone || '').trim());
  if (!phone || phone.length < 8) {
    throw new Error('Phone number is required for SMS/WhatsApp verification');
  }

  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const body = new URLSearchParams();
  body.set('Body', `Your Fusiku verification code is: ${code}`);

  const wantWa = params.channel === 'WHATSAPP';
  if (wantWa && fromWa) {
    const from = fromWa.startsWith('whatsapp:') ? fromWa : `whatsapp:${fromWa.replace(/^whatsapp:/i, '')}`;
    body.set('From', from);
    body.set('To', `whatsapp:${phone.replace(/^\+/, '')}`);
  } else if (messagingSid) {
    body.set('MessagingServiceSid', messagingSid);
    body.set('To', phone);
  } else if (fromNum) {
    body.set('From', fromNum);
    body.set('To', phone);
  } else if (fromWa) {
    const from = fromWa.startsWith('whatsapp:') ? fromWa : `whatsapp:${fromWa.replace(/^whatsapp:/i, '')}`;
    body.set('From', from);
    body.set('To', `whatsapp:${phone.replace(/^\+/, '')}`);
  } else {
    throw new Error('No Twilio sender configured for SMS/WhatsApp');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.error({ status: res.status, text }, '[phone-otp] Twilio send failed');
    throw new Error('Failed to send verification code');
  }
}
