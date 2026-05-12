import { z } from 'zod';

export const pricingRuleIdParamSchema = z.object({
  id: z.string().min(1),
});

const moneyPositive = z.coerce.number().finite().min(0);
const percentBand = z.coerce.number().finite().min(0).max(1000);

export const pricingRuleListQuerySchema = z.object({
  active: z.coerce.boolean().optional(),
  take: z.coerce.number().int().min(1).max(200).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

export const pricingRuleCreateBodySchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    minPrice: moneyPositive,
    maxPrice: moneyPositive,
    profitPercent: percentBand,
    active: z.boolean().optional(),
  })
  .refine((v) => v.maxPrice >= v.minPrice, {
    message: 'maxPrice must be >= minPrice',
    path: ['maxPrice'],
  });

export const pricingRuleUpdateBodySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    minPrice: moneyPositive.optional(),
    maxPrice: moneyPositive.optional(),
    profitPercent: percentBand.optional(),
    active: z.boolean().optional(),
  })
  .refine(
    (v) => {
      if (v.minPrice == null || v.maxPrice == null) return true;
      return v.maxPrice >= v.minPrice;
    },
    { message: 'maxPrice must be >= minPrice', path: ['maxPrice'] }
  );
