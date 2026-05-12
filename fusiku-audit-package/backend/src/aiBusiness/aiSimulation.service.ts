import { aiContextEngine } from './aiContextEngine';
import { TtlCache } from '../utils/ttlCache';

export type PriceSimulationRequest = {
  companyId: string;
  branchId?: string | null;
  priceIncreasePct: number; // can be negative
};

export type PriceSimulationResponse = {
  trace: { basedOn: string[] };
  input: { branchId: string | null; priceIncreasePct: number };
  baseline: { revenue: number; profit: number; marginPct: number | null; currency: string };
  simulated: { revenue: number; profit: number; marginPct: number | null; currency: string };
  impact: { profitDelta: number; profitDeltaPct: number | null; marginDeltaPct: number | null };
  recommendation: string;
};

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pct1(x: number) {
  return Math.round(x * 10) / 10;
}

/**
 * Simple "what-if" simulator:
 * - Uses 30-day revenue/profit from AiContextSnapshot trends.
 * - Assumes COGS fixed in short-run; price change scales revenue only.
 * - Profit impact = revenue_delta (elasticity ignored; enterprise users can refine later).
 */
export const aiSimulationService = {
  async simulatePriceChange(req: PriceSimulationRequest): Promise<PriceSimulationResponse> {
    const companyId = String(req.companyId);
    const branchId = req.branchId ? String(req.branchId).trim() : null;
    const priceIncreasePct = Math.max(-50, Math.min(50, safeNum(req.priceIncreasePct)));

    const cache = (aiSimulationService as any)._cache as TtlCache<string, PriceSimulationResponse> | undefined;
    const cacheKey = `${companyId}::${branchId ?? 'all'}::${pct1(priceIncreasePct)}`;
    const cached = cache?.get(cacheKey);
    if (cached) return cached;

    const ctx = await aiContextEngine.build({ companyId, branchId, days: 30 });
    const revenue = (ctx.trends?.salesDaily || []).reduce((s, x) => s + safeNum(x.value), 0);
    const profit = (ctx.trends?.profitDaily || []).reduce((s, x) => s + safeNum(x.value), 0);
    const currency = String(ctx.salesToday.currency || 'USD');

    const marginPct = revenue > 0 ? (profit / revenue) * 100 : null;

    const factor = 1 + priceIncreasePct / 100;
    const simulatedRevenue = revenue * factor;
    const cogs = Math.max(0, revenue - profit);
    const simulatedProfit = simulatedRevenue - cogs;
    const simulatedMarginPct = simulatedRevenue > 0 ? (simulatedProfit / simulatedRevenue) * 100 : null;

    const profitDelta = simulatedProfit - profit;
    const profitDeltaPct = profit !== 0 ? (profitDelta / Math.abs(profit)) * 100 : null;
    const marginDeltaPct = simulatedMarginPct != null && marginPct != null ? simulatedMarginPct - marginPct : null;

    let recommendation = 'No recommendation.';
    if (priceIncreasePct > 0) {
      recommendation =
        simulatedProfit > profit
          ? `A +${pct1(priceIncreasePct)}% price increase increases 30-day profit by ${currency} ${simulatedProfit - profit > 0 ? profitDelta.toFixed(0) : '0'}. Consider testing on top-selling models first.`
          : `A +${pct1(priceIncreasePct)}% price increase does not improve profit under current assumptions. Test selectively or pair with cost control.`;
    } else if (priceIncreasePct < 0) {
      recommendation =
        simulatedProfit > profit
          ? `A ${pct1(priceIncreasePct)}% discount improves profit under current assumptions (likely inventory clearance). Apply to dead stock first.`
          : `A ${pct1(priceIncreasePct)}% discount reduces profit under current assumptions. Only use for dead stock clearance or targeted campaigns.`;
    }

    const out: PriceSimulationResponse = {
      trace: { basedOn: ['Sale', 'SaleItem', 'Expense', 'CompanySettings', 'Branch'] },
      input: { branchId, priceIncreasePct: pct1(priceIncreasePct) },
      baseline: { revenue, profit, marginPct: marginPct != null ? pct1(marginPct) : null, currency },
      simulated: {
        revenue: simulatedRevenue,
        profit: simulatedProfit,
        marginPct: simulatedMarginPct != null ? pct1(simulatedMarginPct) : null,
        currency,
      },
      impact: {
        profitDelta,
        profitDeltaPct: profitDeltaPct != null ? pct1(profitDeltaPct) : null,
        marginDeltaPct: marginDeltaPct != null ? pct1(marginDeltaPct) : null,
      },
      recommendation,
    };
    if (!cache) {
      (aiSimulationService as any)._cache = new TtlCache<string, PriceSimulationResponse>({ ttlMs: 5 * 60 * 1000, maxItems: 500 });
    }
    ((aiSimulationService as any)._cache as TtlCache<string, PriceSimulationResponse>).set(cacheKey, out);
    return out;
  },
};

