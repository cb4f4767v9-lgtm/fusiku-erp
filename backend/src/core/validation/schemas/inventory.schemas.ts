import { z } from 'zod';

/** Treat "", null, undefined as absent (avoids Zod `.min(1)` failures on empty query params). */
function emptyToUndefined(val: unknown) {
  if (val === undefined || val === null) return undefined;
  const s = String(val).trim();
  return s === '' ? undefined : s;
}

/** Minimal required fields for create; extra Prisma fields pass through after validation. */
export const inventoryCreateBodySchema = z
  .object({
    branchId: z.string().min(1),
    imei: z.string().min(1),
    brand: z.string().min(1),
    model: z.string().min(1),
    purchasePrice: z.coerce.number(),
  })
  .passthrough();

export const inventoryIdParamSchema = z.object({
  id: z.string().min(1),
});

export const inventoryListQuerySchema = z
  .object({
    branchId: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    status: z.preprocess(emptyToUndefined, z.string().optional()),
    search: z.preprocess(emptyToUndefined, z.string().optional()),
    brand: z.preprocess(emptyToUndefined, z.string().optional()),
    model: z.preprocess(emptyToUndefined, z.string().optional()),
    storage: z.preprocess(emptyToUndefined, z.string().optional()),
    color: z.preprocess(emptyToUndefined, z.string().optional()),
    condition: z.preprocess(emptyToUndefined, z.string().optional()),
  })
  .passthrough();
