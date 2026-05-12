import { z } from 'zod';

export const otpRequestBodySchema = z.object({
  contact: z.string().trim().min(3).max(254),
  method: z.enum(['email', 'whatsapp']).default('email'),
  companyId: z.string().trim().min(1).max(64).optional(),
});

export const otpVerifyBodySchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().trim().regex(/^\d{6}$/),
});

