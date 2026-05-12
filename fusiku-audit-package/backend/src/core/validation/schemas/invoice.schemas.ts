import { z } from 'zod';

export const invoiceListQuerySchema = z.object({
  branchId: z.string().trim().min(1).optional(),
  status: z.string().optional(),
  q: z.string().optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

export const invoiceIdParamSchema = z.object({
  id: z.string().min(1),
});

export const invoicePaymentBodySchema = z.object({
  amount: z.coerce.number().positive(),
  method: z.string().trim().optional(),
  reference: z.string().trim().optional(),
  paidAt: z.coerce.date().optional(),
});
