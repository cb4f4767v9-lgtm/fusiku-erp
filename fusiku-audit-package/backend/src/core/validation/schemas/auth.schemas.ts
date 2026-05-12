import { z } from 'zod';

const uiLanguageEnum = z.enum(['en', 'zh', 'ar', 'ur']);
const otpChannelEnum = z.enum(['EMAIL', 'SMS', 'WHATSAPP']);

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  companyId: z.string().min(1).trim().optional(),
  /** Stable per-browser id (UUID); enables trusted-device checks when sent. */
  deviceId: z.string().uuid().optional(),
  /** Short client label (e.g. trimmed User-Agent) stored with the trusted device record. */
  browserLabel: z.string().trim().max(512).optional(),
  /** Preferred channel when step-up OTP is required (must be available for this user). */
  stepUpChannel: otpChannelEnum.optional(),
  /** Client-reported UI language (synced to `User.language` on successful login). */
  language: uiLanguageEnum.optional(),
  /** ISO 4217 view currency (synced to `User.currency`). */
  currency: z
    .string()
    .trim()
    .min(3)
    .max(3)
    .transform((s) => s.toUpperCase())
    .optional(),
});

export const loginVerifyDeviceBodySchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().trim().regex(/^\d{6}$/),
});

export const loginResendDeviceOtpBodySchema = z.object({
  challengeId: z.string().uuid(),
  channel: otpChannelEnum.optional(),
});

export const authPreferencesBodySchema = z
  .object({
    language: uiLanguageEnum.optional(),
    currency: z
      .string()
      .trim()
      .min(3)
      .max(3)
      .transform((s) => s.toUpperCase())
      .optional(),
    twoFactorEnabled: z.boolean().optional(),
    otpChannel: otpChannelEnum.optional(),
  })
  .refine(
    (v) =>
      v.language !== undefined ||
      v.currency !== undefined ||
      v.twoFactorEnabled !== undefined ||
      v.otpChannel !== undefined,
    {
      message: 'At least one preference field is required',
    }
  );

export const registerBodySchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(1).trim(),
    roleId: z.string().min(1),
    companyId: z.string().min(1).trim(),
    branchId: z.string().min(1).trim().optional(),
  })
  .passthrough();

export const forgotPasswordBodySchema = z.object({
  email: z.string().email(),
  companyId: z.string().min(1).trim(),
  /** Frontend origin or reset page base; not strictly a URL in all deployments */
  baseUrl: z.string().trim().optional(),
});

export const resetPasswordBodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
});

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
