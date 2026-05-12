import { z } from 'zod';

/** Canonical payload stored on `PartCatalogSuggestion` and validated again on apply (admin-only). */
export const partCatalogSuggestionPayloadSchema = z.object({
  device: z.object({
    name: z.string().min(1).max(200),
    phoneModelId: z.string().cuid().optional(),
  }),
  /** Root bucket: major assemblies | camera stack | consumables. */
  taxonomyBand: z.enum(['MAJOR_PARTS', 'CAMERA', 'SMALL_PARTS']),
  /** Root category label, e.g. "Major parts", "Camera components", "Small parts". */
  categoryName: z.string().min(1).max(120),
  /** Leaf bucket under category, e.g. "Display", "Lens", "Screws". */
  subcategoryName: z.string().min(1).max(120),
  part: z.object({
    sku: z.string().min(1).max(120),
    name: z.string().min(1).max(240),
    qualityGrade: z.enum(['ORIGINAL', 'OEM', 'COPY']),
    description: z.string().max(4000).optional(),
    oemPartNumber: z.string().max(120).optional(),
    compatiblePhoneVariantIds: z.array(z.string().cuid()).optional(),
    compatiblePhoneModelIds: z.array(z.string().cuid()).optional(),
  }),
});

export type PartCatalogSuggestionPayload = z.infer<typeof partCatalogSuggestionPayloadSchema>;

export function normalizeCatalogSku(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, ' ');
}
