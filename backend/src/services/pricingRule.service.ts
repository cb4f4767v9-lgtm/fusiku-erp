import type { PricingRule } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { requireTenantCompanyId } from '../utils/tenantContext';

const round2 = (n: number): number => Math.round(n * 100) / 100;

export type PricingMatch = {
  /** Rule used (null when no rule matched and a fallback was applied). */
  rule: PricingRule | null;
  /** Margin percent actually applied. */
  profitPercent: number;
  /** Computed selling price, rounded to 2dp. */
  sellingPrice: number;
  /** Why this percent was chosen — useful for UI tooltips and audit. */
  source: 'matched' | 'fallback_highest' | 'fallback_zero';
};

/**
 * Pick a pricing rule matching `costPrice` for the current tenant.
 *
 * Match rule: `minPrice <= costPrice <= maxPrice` (active=true).
 * Tie-breakers when multiple rules cover the same point:
 *   1. Narrower band (smaller `maxPrice - minPrice`) wins.
 *   2. Higher `minPrice` wins (more specific upper-band).
 *   3. Most-recent `updatedAt` wins.
 *
 * If no rule matches, fall back to the active rule with the highest `maxPrice`
 * (per the configured "highest band" behaviour). If there are no active rules,
 * use 0% and flag the line via `source = 'fallback_zero'`.
 */
export async function pickPricingRule(costPrice: number): Promise<PricingMatch> {
  const companyId = requireTenantCompanyId();
  const cost = Math.max(0, Number(costPrice || 0));

  // Pull all active rules for this company once. The set is small per tenant
  // (typically <50), so an in-memory tie-break is simpler and faster than
  // multiple DB round-trips.
  const rules = await prisma.pricingRule.findMany({
    where: { companyId, active: true },
    orderBy: [{ minPrice: 'asc' }, { updatedAt: 'desc' }],
  });

  if (rules.length === 0) {
    return { rule: null, profitPercent: 0, sellingPrice: round2(cost), source: 'fallback_zero' };
  }

  const matching = rules.filter((r) => cost >= r.minPrice && cost <= r.maxPrice);

  if (matching.length > 0) {
    matching.sort((a, b) => {
      const widthA = a.maxPrice - a.minPrice;
      const widthB = b.maxPrice - b.minPrice;
      if (widthA !== widthB) return widthA - widthB;
      if (a.minPrice !== b.minPrice) return b.minPrice - a.minPrice;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
    const rule = matching[0];
    const sellingPrice = round2(cost + (cost * rule.profitPercent) / 100);
    return { rule, profitPercent: rule.profitPercent, sellingPrice, source: 'matched' };
  }

  // No band matches — use the active rule with the highest maxPrice.
  const fallback = rules.reduce<PricingRule>((acc, r) => (r.maxPrice > acc.maxPrice ? r : acc), rules[0]);
  const sellingPrice = round2(cost + (cost * fallback.profitPercent) / 100);
  return {
    rule: fallback,
    profitPercent: fallback.profitPercent,
    sellingPrice,
    source: 'fallback_highest',
  };
}

export const pricingRuleService = {
  async list(params?: { active?: boolean; take?: number; skip?: number }) {
    const companyId = requireTenantCompanyId();
    const limit = Math.min(200, Math.max(1, Number(params?.take ?? 100)));
    const skip = Math.max(0, Number(params?.skip ?? 0));

    const where = {
      companyId,
      ...(typeof params?.active === 'boolean' ? { active: params.active } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.pricingRule.findMany({
        where,
        orderBy: [{ minPrice: 'asc' }, { createdAt: 'desc' }],
        take: limit,
        skip,
      }),
      prisma.pricingRule.count({ where }),
    ]);

    return { success: true, data: items, meta: { total, limit, skip } };
  },

  async getById(id: string) {
    const companyId = requireTenantCompanyId();
    return prisma.pricingRule.findFirst({ where: { id, companyId } });
  },

  async create(payload: {
    name: string;
    minPrice: number;
    maxPrice: number;
    profitPercent: number;
    active?: boolean;
  }) {
    const companyId = requireTenantCompanyId();
    return prisma.pricingRule.create({
      data: {
        companyId,
        name: payload.name.trim(),
        minPrice: payload.minPrice,
        maxPrice: payload.maxPrice,
        profitPercent: payload.profitPercent,
        active: payload.active ?? true,
      },
    });
  },

  async update(
    id: string,
    payload: Partial<{ name: string; minPrice: number; maxPrice: number; profitPercent: number; active: boolean }>
  ) {
    const companyId = requireTenantCompanyId();
    const existing = await prisma.pricingRule.findFirst({ where: { id, companyId } });
    if (!existing) {
      const err: any = new Error('Pricing rule not found');
      err.statusCode = 404;
      throw err;
    }
    return prisma.pricingRule.update({
      where: { id },
      data: {
        ...(payload.name != null ? { name: payload.name.trim() } : {}),
        ...(payload.minPrice != null ? { minPrice: payload.minPrice } : {}),
        ...(payload.maxPrice != null ? { maxPrice: payload.maxPrice } : {}),
        ...(payload.profitPercent != null ? { profitPercent: payload.profitPercent } : {}),
        ...(typeof payload.active === 'boolean' ? { active: payload.active } : {}),
      },
    });
  },

  async remove(id: string) {
    const companyId = requireTenantCompanyId();
    const existing = await prisma.pricingRule.findFirst({ where: { id, companyId } });
    if (!existing) {
      const err: any = new Error('Pricing rule not found');
      err.statusCode = 404;
      throw err;
    }
    await prisma.pricingRule.delete({ where: { id } });
    return { success: true };
  },

  /** Public preview endpoint — returns the rule (if any) and computed selling price for a given cost. */
  async preview(costPrice: number) {
    return pickPricingRule(costPrice);
  },
};
