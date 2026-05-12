import { z } from 'zod';

export const quotationIdParamSchema = z.object({
  id: z.string().min(1),
});

export const quotationListQuerySchema = z.object({
  q: z.string().trim().optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const itemBase = z.object({
  /** Optional inventory FK; either inventoryId or (description + costPrice) must be present. */
  inventoryId: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).max(255).optional(),
  /** Override cost price; required when no inventoryId is supplied. */
  costPrice: z.coerce.number().finite().min(0).optional(),
  quantity: z.coerce.number().int().min(1).max(10_000).optional(),
});

export const quotationGenerateBodySchema = z.object({
  customerName: z.string().trim().max(255).optional(),
  customerPhone: z.string().trim().max(64).optional(),
  notes: z.string().trim().max(2000).optional(),
  items: z
    .array(
      itemBase.refine(
        (it) => Boolean(it.inventoryId) || (it.description && it.costPrice != null),
        { message: 'Each item needs inventoryId, or description + costPrice', path: ['inventoryId'] }
      )
    )
    .min(1, 'At least one item is required'),
});

export type QuotationGenerateBody = z.infer<typeof quotationGenerateBodySchema>;
