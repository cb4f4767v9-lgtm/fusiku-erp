import { prisma } from '../utils/prisma';
import type { AiContextSnapshot, PricingRecommendation } from './aiBusiness.types';

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export const smartPricingEngine = {
  async recommend(params: { companyId: string; branchId?: string | null; ctx: AiContextSnapshot; limit?: number }): Promise<PricingRecommendation[]> {
    const { companyId, branchId, ctx } = params;
    const limit = Math.max(3, Math.min(25, Number(params.limit ?? 10)));

    // Capital cost proxy: active equity investors share (0..1).
    const investors = await prisma.investor.findMany({
      where: { companyId, active: true, type: 'investor' } as any,
      select: { sharePercentage: true },
      take: 200,
    });
    const investorShare = Math.max(
      0,
      Math.min(
        0.6,
        investors.reduce((a, i) => a + (Number(i.sharePercentage || 0) / 100), 0)
      )
    );

    // FX volatility proxy: mean abs % change of currency movers (0..1 scaled).
    const fxVolPct =
      ctx.currencyImpact.movers.length > 0
        ? ctx.currencyImpact.movers
          .map((m) => Math.abs(Number(m.changePct || 0)))
          .reduce((a, b) => a + b, 0) / ctx.currencyImpact.movers.length
        : 0;

    // Focus on available inventory; recommend for oldest first (higher urgency).
    const inv = await prisma.inventory.findMany({
      where: { companyId, status: 'available', ...(branchId ? { branchId } : {}) } as any,
      select: { brand: true, model: true, storage: true, condition: true, costUsd: true, purchasePrice: true, sellingPrice: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    // Optional market price table (global) for anchor.
    const keys = inv.map((i) => ({ brand: i.brand, model: i.model }));
    const market = await prisma.marketPrice.findMany({
      where: { OR: keys.map((k) => ({ brand: k.brand, model: k.model })) } as any,
      select: { brand: true, model: true, averagePrice: true },
      take: limit * 2,
    });
    const marketByKey = new Map(market.map((m) => [`${m.brand}||${m.model}`, safeNum(m.averagePrice)]));

    const fxMover = ctx.currencyImpact.movers[0];
    const fxNote =
      fxMover && fxMover.changePct != null && Math.abs(fxMover.changePct) >= 2
        ? `FX mover: ${fxMover.code} ${fxMover.changePct.toFixed(2)}% (may affect replacement cost).`
        : undefined;

    // Demand (sales velocity) over last 30 days, by model.
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const salesItems = await prisma.saleItem.findMany({
      where: {
        sale: {
          companyId,
          status: 'completed',
          createdAt: { gte: since },
          ...(branchId ? { branchId } : {}),
        },
      } as any,
      select: { inventory: { select: { brand: true, model: true } } },
      take: 5000,
    });
    const soldByKey = new Map<string, number>();
    for (const si of salesItems) {
      const brand = String(si.inventory?.brand || '').trim();
      const model = String(si.inventory?.model || '').trim();
      if (!brand || !model) continue;
      const k = `${brand}||${model}`;
      soldByKey.set(k, (soldByKey.get(k) || 0) + 1);
    }

    return inv.map((i) => {
      const costUsd = i.costUsd != null ? safeNum(i.costUsd) : null;
      const legacyCostUsd = costUsd == null ? safeNum(i.purchasePrice) : costUsd;

      const marketPrice = marketByKey.get(`${i.brand}||${i.model}`) ?? null;
      const anchor = marketPrice != null && marketPrice > 0 ? marketPrice : safeNum(i.sellingPrice) || legacyCostUsd * 1.18;

      // Margin optimization target: adjust target margin based on inventory age proxy.
      const ageDays = Math.floor((Date.now() - new Date(i.createdAt).getTime()) / (24 * 60 * 60 * 1000));
      const demandCount30d = soldByKey.get(`${i.brand}||${i.model}`) || 0;
      const demandScore = Math.min(1, demandCount30d / 15); // 15+ sales/month ~= high demand

      // Base target margin from age, then adjust:
      // - higher demand => can hold margin
      // - higher fx volatility => increase margin buffer
      // - investor share => increase margin requirement to cover capital cost
      const baseMargin = ageDays >= 90 ? 0.08 : ageDays >= 45 ? 0.12 : 0.18;
      const fxBuffer = Math.min(0.06, (fxVolPct / 100) * 0.5); // e.g. 6% avg move => +3% buffer cap 6%
      const capitalBuffer = Math.min(0.08, investorShare * 0.12); // e.g. 30% share => +3.6% buffer
      const demandAdj = demandScore >= 0.7 ? 0.03 : demandScore <= 0.2 ? -0.03 : 0;
      const targetMargin = Math.max(0.06, Math.min(0.28, baseMargin + fxBuffer + capitalBuffer + demandAdj));

      const minFloor = legacyCostUsd * (1 + Math.max(0.05, targetMargin * 0.6));
      const suggested = Math.max(minFloor, anchor * (ageDays >= 90 ? 0.96 : ageDays >= 45 ? 0.99 : 1.01));

      const marginPct = legacyCostUsd > 0 ? ((suggested - legacyCostUsd) / legacyCostUsd) * 100 : 0;

      const rationale: string[] = [];
      if (marketPrice != null) rationale.push(`Anchored to market price: ~$${marketPrice.toFixed(0)}.`);
      else rationale.push('No market price found; anchored to current selling price / cost floor.');
      if (costUsd == null) rationale.push('CostUsd missing; using legacy purchasePrice as USD heuristic.');
      rationale.push(`Demand (30d): ${demandCount30d} sales → demand score ${(demandScore * 100).toFixed(0)}%.`);
      rationale.push(`FX volatility buffer: ~${fxVolPct.toFixed(1)}% avg mover change.`);
      rationale.push(`Capital cost buffer: investor share ${(investorShare * 100).toFixed(0)}%.`);
      rationale.push(`Inventory age: ${ageDays} days → target margin ~${(targetMargin * 100).toFixed(0)}%.`);
      if (fxNote) rationale.push(fxNote);

      const confidence =
        marketPrice != null && costUsd != null ? 0.78 : marketPrice != null || costUsd != null ? 0.62 : 0.5;

      return {
        brand: i.brand,
        model: i.model,
        storage: i.storage,
        condition: i.condition,
        costUsd,
        marketPrice,
        fxNote,
        suggestedSellingPrice: suggested,
        suggestedMarginPct: marginPct,
        confidence: Math.max(0.35, Math.min(0.9, confidence - (ctx.dataQuality.hasLegacyCost ? 0.08 : 0) - (ctx.dataQuality.hasMissingFx ? 0.08 : 0))),
        rationale,
      };
    });
  },
};

