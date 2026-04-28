import { aiContextEngine } from './aiContextEngine';
import { smartInsightsEngine } from './smartInsights';
import { forecastingEngine } from './forecasting';
import { smartPricingEngine } from './smartPricing';
import { aiAlertAgent } from '../ai/aiAlert.agent';
import type { AiBusinessEngineResponse, AiContextSnapshot } from './aiBusiness.types';
import { buildActionablesFromEngineParts } from '../ai/actionableOutput';
import { confidenceEngine } from './confidenceEngine';
import { aiMemory } from './aiMemory';
import { aiDecisionEngine } from './aiDecisionEngine';
import { TtlCache } from '../utils/ttlCache';

const engineCache = new TtlCache<string, AiBusinessEngineResponse>({ ttlMs: 7 * 60 * 1000, maxItems: 500 });

function computeDataHealthScore(ctx: any) {
  const legacyCost = Boolean(ctx?.dataQuality?.hasLegacyCost);
  const missingFx = Boolean(ctx?.dataQuality?.hasMissingFx);
  let score = 100;
  if (legacyCost) score -= 35;
  if (missingFx) score -= 35;
  const warnings = Array.isArray(ctx?.dataQuality?.warnings) ? ctx.dataQuality.warnings.length : 0;
  score -= Math.min(30, warnings * 10);
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, factors: { legacyCost, missingFx } };
}

export const aiBusinessEngineService = {
  async build(params: { companyId: string; branchId?: string | null }): Promise<AiBusinessEngineResponse> {
    const cacheKey = `${params.companyId}::${params.branchId ?? 'all'}`;
    const cached = engineCache.get(cacheKey);
    if (cached) return cached;

    const ctx = await aiContextEngine.build({ companyId: params.companyId, branchId: params.branchId ?? null, days: 30 });
    const insights = smartInsightsEngine.generate(ctx);
    const forecast = forecastingEngine.forecastNextMonth(ctx);
    const pricing = await smartPricingEngine.recommend({ companyId: params.companyId, branchId: params.branchId ?? null, ctx, limit: 10 });
    const alerts = await aiAlertAgent.getAlerts({ companyId: params.companyId, limit: 20 });
    const conf = confidenceEngine.compute(ctx);
    const decision = await aiDecisionEngine.build({ companyId: params.companyId, branchId: params.branchId ?? null, days: 30 }, ctx);

    aiMemory.addInsights(params.companyId, insights);

    const mappedAlerts = (alerts || []).map((a: any) => ({
      ...a,
      priority:
        a?.severity === 'warning'
          ? 'high'
          : a?.type === 'inventory_risk'
            ? 'medium'
            : 'low',
    }));

    const out: AiBusinessEngineResponse = {
      trace: {
        basedOn: [
          'Sale',
          'SaleItem',
          'Inventory',
          'Expense',
          'Branch',
          'Currency',
          'CompanySettings',
          'AIAlert'
        ],
      },
      dataHealth: computeDataHealthScore(ctx),
      context: ctx,
      confidence: conf.overall,
      insights,
      forecast,
      pricing,
      alerts: mappedAlerts,
      anomalies: decision.anomalies,
      risk: decision.risk,
      branchStrategy: decision.branchStrategy,
      inventoryRisk: decision.inventoryRisk,
      ownerInsights: decision.ownerInsights,
      actionables: buildActionablesFromEngineParts({
        insights,
        alerts: mappedAlerts,
        ownerActions: decision.ownerInsights?.actions,
      }),
    };

    engineCache.set(cacheKey, out);
    return out;
  },
};

/** Safe payload when agents or DB calls fail — keeps dashboards and BI pages usable. */
export function emptyBusinessEngineResponse(companyId: string, branchId: string | null): AiBusinessEngineResponse {
  const now = new Date().toISOString();
  const context: AiContextSnapshot = {
    generatedAt: now,
    scope: { companyId, branchId, branchName: null },
    dataQuality: { hasLegacyCost: false, hasMissingFx: false, warnings: [] },
    salesToday: { count: 0, total: 0, profit: 0, currency: 'USD' },
    profitMonth: { currency: 'USD', amount: 0 },
    expensesMonth: { currency: 'USD', amount: 0 },
    inventorySummary: { availableCount: 0, lowStockModels: [] },
    topSellingItems: [],
    trends: { salesDaily: [], profitDaily: [], expensesDaily: [], inventoryAvailableDaily: [] },
    branchStats: [],
    branchComparison: { weakestToday: null, weakestMonth: null, month: [] },
    currencyImpact: { baseCurrency: 'USD', movers: [] },
  };

  return {
    trace: { basedOn: [] },
    dataHealth: { score: 0, factors: { legacyCost: false, missingFx: false } },
    context,
    confidence: 0,
    insights: [],
    forecast: {
      horizon: 'next_month',
      currency: 'USD',
      nextMonthSales: 0,
      expectedProfit: 0,
      requiredStock: [],
      confidence: 0,
    },
    pricing: [],
    alerts: [],
    anomalies: [],
    risk: {
      riskLevel: 'low',
      scores: { profitMarginPct: null, expenseRatioPct: null, fxVolatilityPct: null },
      rationale: [],
    },
    branchStrategy: { transferRecommendations: [], investInBranch: null, weakestBranchPlan: null },
    inventoryRisk: { slowMoving: [], deadStock30: [], deadStock60: [], recommendations: [] },
    ownerInsights: {
      shouldInvestMore: false,
      shouldReduceExpenses: false,
      mostProfitableBranch: null,
      narrative: '',
      actions: [],
    },
    actionables: [],
  };
}

