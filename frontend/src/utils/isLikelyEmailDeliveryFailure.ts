import { getErrorMessage } from './getErrorMessage';

/**
 * Transport-layer failures (SMTP / Gmail / Resend, etc.) that should not surface
 * scary technical copy during OTP or signup flows.
 */
export function isLikelyEmailDeliveryFailure(err: unknown): boolean {
  const m = getErrorMessage(err, '').toLowerCase();
  if (!m) return false;

  const needles = [
    '535',
    'smtp',
    'gmail',
    'eauthentication',
    'authentication unsuccessful',
    'authentication failed',
    'invalid login',
    'nodemailer',
    'transaction failed',
    'could not be sent',
    'smtp transporter',
    'resend api',
    'failed to send email',
    'email verification code',
    'signup email otp requires smtp',
    'badcredentials',
    'connection closed',
  ];

  return needles.some((n) => m.includes(n));
}
