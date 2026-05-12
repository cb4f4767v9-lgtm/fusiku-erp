import { logger } from '../utils/logger';
import { isChinaMode } from '../utils/chinaMode';
import { emailService, isSmtpConfigured } from './email.service';
import { deliverOtpToPhone } from './signupOtpDelivery.service';
import type { LoginStepUpOtpChannel } from './loginDeviceOtpChallenge.store';

export function allowLoginDeviceOtpConsoleFallback(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return String(process.env.LOGIN_DEVICE_OTP_CONSOLE_FALLBACK || '').trim() === '1';
}

async function deliverLoginStepUpEmail(email: string, code: string): Promise<void> {
  const to = String(email || '').trim().toLowerCase();
  if (!to || !code) throw new Error('Email and code are required');

  if (isChinaMode()) {
    logger.info('[login-step-up] (CHINA_MODE) skipping SMTP; code for %s: %s', to, code);
    console.log('[login-step-up] CHINA_MODE — OTP for %s: %s', to, code);
    return;
  }

  if (!isSmtpConfigured()) {
    if (!allowLoginDeviceOtpConsoleFallback()) {
      throw new Error(
        'Login step-up email OTP is not configured. Set SMTP_* or EMAIL_HOST_* env vars or LOGIN_DEVICE_OTP_CONSOLE_FALLBACK=1 for testing.'
      );
    }
    logger.info('[login-step-up] (console fallback) code for %s: %s', to, code);
    return;
  }

  await emailService.send({
    to,
    subject: '[FUSIKU] Confirm sign-in',
    text: `Your verification code is: ${code}\n\nIf you did not try to sign in, reset your password immediately.`,
    html: `<p>Your verification code is: <strong>${code}</strong></p><p>If you did not try to sign in, reset your password immediately.</p><p>Think Smart. Play Cool.</p>`,
  });
}

/** Login step-up codes (new device / risk / 2FA): Email, SMS, or WhatsApp. */
export async function deliverLoginStepUpOtp(params: {
  channel: LoginStepUpOtpChannel;
  email: string;
  phone?: string | null;
  code: string;
}): Promise<void> {
  if (params.channel === 'EMAIL') {
    await deliverLoginStepUpEmail(params.email, params.code);
    return;
  }
  const phone = String(params.phone || '').trim();
  if (!phone) throw new Error('No phone number on file for SMS/WhatsApp verification');
  await deliverOtpToPhone({ phone, code: params.code, channel: params.channel });
}

/** @deprecated Use deliverLoginStepUpOtp({ channel: EMAIL, ... }) */
export async function deliverLoginDeviceOtp(params: { email: string; code: string }): Promise<void> {
  await deliverLoginStepUpEmail(params.email, params.code);
}
