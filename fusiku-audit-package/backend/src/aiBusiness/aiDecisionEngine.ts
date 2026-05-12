import type { AiContextSnapshot } from './aiBusiness.types';
import { prisma } from '../utils/prisma';
import { aiAlertAgent } from '../ai/aiAlert.agent';

type Severity = 'info' | 'warning' | 'success';

export type AiAnomalyType = 'profit_drop' | 'expense_spike' | 'sales_spike';

export type AiAnomalyAlert = {
  type: AiAnomalyType;
  title: string;
  message: string;
  severity: Severity;
  priority: 'critical' | 'high' | 'medium' | 'low';
  detectedAt: string;
  metrics?: Record<string, number | string | null>;
};

export type RiskLevel = 'low' | 'medium' | 'high';

export type AiRiskAssessment = {
  riskLevel: RiskLevel;
  scores: {
    profitMarginPct: number | null;
    expenseRatioPct: number | null;
    fxVolatilityPct: number | null;
  };
  rationale: string[];
};

export type AiBranchTransferRecommendation = {
  fromBranchId: string;
  fromBranchName: string;
  toBranchId: string;
  toBranchName: string;
  brand: string;
  model: string;
  reason: string;
  suggestedUnits: number;
};

export type AiBranchStrategy = {
  transferRecommendations: AiBranchTransferRecommendation[];
  investInBranch: { branchId: string; branchName: string; reason: string } | null;
  weakestBranchPlan: { branchId: string; branchName: string; plan: string[] } | null;
};

export type AiInventoryAgingItem = {
  inventoryId: string;
  imei: string;
  brand: string;
  model: string;
  storage: string;
  branchId: string;
  branchName: string;
  daysInStock: number;
  suggestedAction: 'monitor' | 'discount' | 'transfer';
  suggestedDiscountPct?: number;
};

export type AiInventoryRiskAnalysis = {
  slowMoving: AiInventoryAgingItem[];
  deadStock30: AiInventoryAgingItem[];
  deadStock60: AiInventoryAgingItem[];
  recommendations: Array<{
    type: 'discount_strategy' | 'transfer_to_demand_branch';
    message: string;
    actions?: Array<{ label: string; type: 'discount_pct' | 'transfer_stock'; value?: number }>;
  }>;
};

export type AiOwnerInsights = {
  shouldInvestMore: boolean;
  shouldReduceExpenses: boolean;
  mostProfitableBranch: { branchId: string; branchName: string; profit: number; currency: string } | null;
  narrative: string;
  actions: Array<{ label: string; type: 'review_expenses' | 'transfer_stock' | 'discount_pct'; value?: number }>;
};

function clamp01(x: number) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function avg(nums: number[]) {
  const xs = nums.filter((n) => Number.isFinite(n));
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}

function pct(n: number) {
  return Math.round(n * 10) / 10;
}

function nowIso() {
  return new Date().toISOString();
}

async function maybeCreateAbnormalActivityAlert(companyId: string, alerts: AiAnomalyAlert[]) {
  if (!alerts.length) return;
  const title = 'Abnormal activity detected';
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.aIAlert.findFirst({
    where: { companyId, title, createdAt: { gte: since } } as any,
    select: { id: true },
  });
  if (recent) return;
  await aiAlertAgent.createAlert(
    companyId,
    'anomaly',
    title,
    alerts.map((a) => `- ${a.title}: ${a.message}`).join('\n'),
    'warning',
    { anomalies: alerts }
  );
}

function detectAnomalies(ctx: AiContextSnapshot): AiAnomalyAlert[] {
  const out: AiAnomalyAlert[] = [];
  const profits = (ctx.trends?.profitDaily || []).map((p) => Number(p.value || 0));
  const sales = (ctx.trends?.salesDaily || []).map((p) => Number(p.value || 0));
  const expenses = (ctx.trends?.expensesDaily || []).map((p) => Number(p.value || 0));
  if (profits.length < 8 || sales.length < 8 || expenses.length < 8) return out;

  const lastProfit = profits[profits.length - 1];
  const prevProfitAvg = avg(profits.slice(-8, -1));
  const profitDropPct = prevProfitAvg > 0 ? ((prevProfitAvg - lastProfit) / prevProfitAvg) * 100 : 0;
  if (prevProfitAvg > 0 && profitDropPct >= 35 && lastProfit < prevProfitAvg) {
    out.push({
      type: 'profit_drop',
      title: 'Sudden profit drop',
      message: `Profit dropped ${pct(profitDropPct)}% vs last 7-day average.`,
      severity: profitDropPct >= 55 ? 'warning' : 'info',
      priority: profitDropPct >= 65 ? 'critical' : profitDropPct >= 50 ? 'high' : 'medium',
      detectedAt: nowIso(),
      metrics: { profitToday: lastProfit, profitAvg7: prevProfitAvg, dropPct: profitDropPct },
    });
  }

  const lastExp = expenses[expenses.length - 1];
  const prevExpAvg = avg(expenses.slice(-8, -1));
  const expSpikePct = prevExpAvg > 0 ? ((lastExp - prevExpAvg) / prevExpAvg) * 100 : 0;
  if (prevExpAvg > 0 && expSpikePct >= 60) {
    out.push({
      type: 'expense_spike',
      title: 'Unusual expenses',
      message: `Expenses spiked ${pct(expSpikePct)}% vs last 7-day average.`,
      severity: expSpikePct >= 120 ? 'warning' : 'info',
      priority: expSpikePct >= 150 ? 'critical' : expSpikePct >= 100 ? 'high' : 'medium',
      detectedAt: nowIso(),
      metrics: { expensesToday: lastExp, expensesAvg7: prevExpAvg, spikePct: expSpikePct },
    });
  }

  const lastSales = sales[sales.length - 1];
  const prevSalesAvg = avg(sales.slice(-8, -1));
  const salesSpikePct = prevSalesAvg > 0 ? ((lastSales - prevSalesAvg) / prevSalesAvg) * 100 : 0;
  if (prevSalesAvg > 0 && salesSpikePct >= 70) {
    out.push({
      type: 'sales_spike',
      title: 'Abnormal sales spike',
      message: `Sales spiked ${pct(salesSpikePct)}% vs last 7-day average.`,
      severity: salesSpikePct >= 140 ? 'warning' : 'info',
      priority: salesSpikePct >= 180 ? 'high' : 'medium',
      detectedAt: nowIso(),
      metrics: { salesToday: lastSales, salesAvg7: prevSalesAvg, spikePct: salesSpikePct },
    });
  }

  return out;
}

function assessRisk(ctx: AiContextSnapshot): AiRiskAssessment {
  const revenue30 = sum((ctx.trends?.salesDaily || []).map((x) => Number(x.value || 0)));
  const profit30 = sum((ctx.trends?.profitDaily || []).map((x) => Number(x.value || 0)));
  const expenses30 = sum((ctx.trends?.expensesDaily || []).map((x) => Number(x.value || 0)));

  const profitMarginPct = revenue30 > 0 ? (profit30 / revenue30) * 100 : null;
  const expenseRatioPct = revenue30 > 0 ? (expenses30 / revenue30) * 100 : null;
  const fxVolatilityPct = (() => {
    const ms = ctx.currencyImpact?.movers || [];
    const maxAbs = ms.reduce((m, x) => Math.max(m, Math.abs(Number(x.changePct ?? 0))), 0);
    return maxAbs || null;
  })();

  const rationale: string[] = [];
  if (profitMarginPct != null) rationale.push(`30-day margin: ${pct(profitMarginPct)}%`);
  if (expenseRatioPct != null) rationale.push(`30-day expense ratio: ${pct(expenseRatioPct)}%`);
  if (fxVolatilityPct != null) rationale.push(`FX volatility (max mover): ${pct(fxVolatilityPct)}%`);

  const marginRisk = profitMarginPct == null ? 0.5 : profitMarginPct < 6 ? 1 : profitMarginPct < 12 ? 0.6 : 0.25;
  const expenseRisk = expenseRatioPct == null ? 0.5 : expenseRatioPct > 40 ? 1 : expenseRatioPct > 25 ? 0.6 : 0.25;
  const fxRisk = fxVolatilityPct == null ? 0.3 : fxVolatilityPct > 4 ? 1 : fxVolatilityPct > 2 ? 0.6 : 0.25;

  const composite = clamp01(0.45 * marginRisk + 0.35 * expenseRisk + 0.2 * fxRisk);
  const riskLevel: RiskLevel = composite >= 0.75 ? 'high' : composite >= 0.5 ? 'medium' : 'low';

  return {
    riskLevel,
    scores: {
      profitMarginPct: profitMarginPct != null ? pct(profitMarginPct) : null,
      expenseRatioPct: expenseRatioPct != null ? pct(expenseRatioPct) : null,
      fxVolatilityPct: fxVolatilityPct != null ? pct(fxVolatilityPct) : null,
    },
    rationale,
  };
}

async function buildBranchStrategy(params: { companyId: string; branchId?: string | null; days: number }, ctx: AiContextSnapshot): Promise<AiBranchStrategy> {
  const companyId = params.companyId;
  const days = Math.max(7, Math.min(90, Number(params.days || 30)));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [branches, invAvail, saleItems] = await Promise.all([
    prisma.branch.findMany({ where: { companyId, isActive: true }, select: { id: true, name: true } }),
    prisma.inventory.findMany({
      where: { companyId, status: 'available' },
      select: { branchId: true, brand: true, model: true },
      take: 200000,
    }),
    prisma.saleItem.findMany({
      where: { sale: { companyId, status: 'completed', createdAt: { gte: since } } } as any,
      select: { sale: { select: { branchId: true } }, inventory: { select: { brand: true, model: true } } } as any,
      take: 200000,
    }),
  ]);

  const branchNameById = new Map(branches.map((b) => [b.id, b.name || b.id]));

  const availByBranchModel = new Map<string, number>();
  for (const i of invAvail as any[]) {
    const bid = String(i.branchId || '');
    const brand = String(i.brand || '').trim();
    const model = String(i.model || '').trim();
    if (!bid || !brand || !model) continue;
    const key = `${bid}||${brand}||${model}`;
    availByBranchModel.set(key, (availByBranchModel.get(key) || 0) + 1);
  }

  const demandByBranchModel = new Map<string, number>();
  for (const si of saleItems as any[]) {
    const bid = String(si.sale?.branchId || '');
    const brand = String(si.inventory?.brand || '').trim();
    const model = String(si.inventory?.model || '').trim();
    if (!bid || !brand || !model) continue;
    const key = `${bid}||${brand}||${model}`;
    demandByBranchModel.set(key, (demandByBranchModel.get(key) || 0) + 1);
  }

  // Pick top 12 demanded models (company-wide) as candidates
  const demandCompany = new Map<string, number>();
  for (const [k, v] of demandByBranchModel.entries()) {
    const [, brand, model] = k.split('||');
    const key = `${brand}||${model}`;
    demandCompany.set(key, (demandCompany.get(key) || 0) + v);
  }
  const candidates = [...demandCompany.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

  const transferRecommendations: AiBranchTransferRecommendation[] = [];
  for (const [bmKey] of candidates) {
    const [brand, model] = bmKey.split('||');
    const perBranch = branches.map((b) => {
      const key = `${b.id}||${brand}||${model}`;
      return {
        branchId: b.id,
        branchName: branchNameById.get(b.id) || b.id,
        avail: availByBranchModel.get(key) || 0,
        demand: demandByBranchModel.get(key) || 0,
      };
    });
    const to = [...perBranch].sort((a, b) => (b.demand - b.avail) - (a.demand - a.avail))[0];
    const from = [...perBranch].sort((a, b) => (b.avail - b.demand) - (a.avail - a.demand))[0];
    if (!to || !from) continue;
    const shortage = Math.max(0, to.demand - to.avail);
    const surplus = Math.max(0, from.avail - from.demand);
    if (shortage >= 3 && surplus >= 3 && from.branchId !== to.branchId) {
      const suggestedUnits = Math.min(5, Math.max(2, Math.min(shortage, surplus)));
      transferRecommendations.push({
        fromBranchId: from.branchId,
        fromBranchName: from.branchName,
        toBranchId: to.branchId,
        toBranchName: to.branchName,
        brand,
        model,
        reason: `High demand in ${to.branchName} with low stock; surplus in ${from.branchName}.`,
        suggestedUnits,
      });
    }
  }

  const investInBranch = (() => {
    const rows = [...(ctx.branchComparison?.month || [])].sort((a, b) => b.netProfit - a.netProfit);
    const best = rows[0];
    if (!best) return null;
    return {
      branchId: best.branchId,
      branchName: best.branchName,
      reason: `Highest month-to-date net profit: ${best.currency} ${best.netProfit.toFixed(0)}.`,
    };
  })();

  const weakestBranchPlan = (() => {
    const w = ctx.branchComparison?.weakestMonth;
    if (!w) return null;
    const plan: string[] = [];
    plan.push('Audit top 10 expense entries and cut non-essential spend by 10–15% for 2 weeks.');
    plan.push('Focus selling fast-moving models; request transfers from surplus branches for top-demand items.');
    plan.push('Tighten discounts: require manager approval for margins below target.');
    plan.push('Run a 7-day clearance promo on dead stock (30–60+ days) to free cash.');
    return { branchId: w.branchId, branchName: w.branchName, plan };
  })();

  return {
    transferRecommendations: transferRecommendations.slice(0, 6),
    investInBranch,
    weakestBranchPlan,
  };
}

async function buildInventoryRisk(params: { companyId: string; branchId?: string | null }, ctx: AiContextSnapshot): Promise<AiInventoryRiskAnalysis> {
  const companyId = params.companyId;
  const branchId = params.branchId ?? null;

  const inventory = await prisma.inventory.findMany({
    where: { companyId, status: 'available', ...(branchId ? { branchId } : {}) } as any,
    select: { id: true, imei: true, brand: true, model: true, storage: true, createdAt: true, branchId: true, branch: { select: { name: true } } },
    take: 200000,
  });

  const now = Date.now();
  const items: AiInventoryAgingItem[] = (inventory as any[]).map((inv) => {
    const days = Math.floor((now - new Date(inv.createdAt).getTime()) / (24 * 60 * 60 * 1000));
    let suggestedAction: 'monitor' | 'discount' | 'transfer' = 'monitor';
    let suggestedDiscountPct: number | undefined = undefined;
    if (days >= 60) {
      suggestedAction = 'discount';
      suggestedDiscountPct = 12;
    } else if (days >= 30) {
      suggestedAction = 'discount';
      suggestedDiscountPct = 7;
    }
    return {
      inventoryId: inv.id,
      imei: inv.imei,
      brand: inv.brand,
      model: inv.model,
      storage: inv.storage,
      branchId: inv.branchId,
      branchName: inv.branch?.name || inv.branchId,
      daysInStock: days,
      suggestedAction,
      ...(suggestedDiscountPct != null ? { suggestedDiscountPct } : {}),
    };
  });

  const slowMoving = items.filter((x) => x.daysInStock >= 21).sort((a, b) => b.daysInStock - a.daysInStock).slice(0, 20);
  const deadStock30 = items.filter((x) => x.daysInStock >= 30).sort((a, b) => b.daysInStock - a.daysInStock).slice(0, 20);
  const deadStock60 = items.filter((x) => x.daysInStock >= 60).sort((a, b) => b.daysInStock - a.daysInStock).slice(0, 20);

  const recommendations: AiInventoryRiskAnalysis['recommendations'] = [];
  if (deadStock60.length) {
    recommendations.push({
      type: 'discount_strategy',
      message: `You have ${deadStock60.length} dead inventory items (60+ days). Consider a clearance discount and/or inter-branch transfers.`,
      actions: [
        { label: 'Apply 12% clearance discount', type: 'discount_pct', value: 12 },
        { label: 'Review transfer opportunities', type: 'transfer_stock' },
      ],
    });
  } else if (deadStock30.length) {
    recommendations.push({
      type: 'discount_strategy',
      message: `You have ${deadStock30.length} slow inventory items (30+ days). Start a light discount to accelerate cash conversion.`,
      actions: [{ label: 'Apply 7% promo discount', type: 'discount_pct', value: 7 }],
    });
  }

  if (ctx.branchComparison?.weakestMonth) {
    recommendations.push({
      type: 'transfer_to_demand_branch',
      message: `Transfer dead stock away from low-demand branches and replenish top-demand branches to stabilize profits.`,
      actions: [{ label: 'Review transfers', type: 'transfer_stock' }],
    });
  }

  return { slowMoving, deadStock30, deadStock60, recommendations };
}

function buildOwnerInsights(ctx: AiContextSnapshot, risk: AiRiskAssessment, anomalies: AiAnomalyAlert[], branchStrategy: AiBranchStrategy, inventoryRisk: AiInventoryRiskAnalysis): AiOwnerInsights {
  const mostProfitableBranch = (() => {
    const rows = [...(ctx.branchStats || [])].sort((a, b) => b.profit - a.profit);
    const top = rows[0];
    return top ? { branchId: top.branchId, branchName: top.branchName, profit: top.profit, currency: top.currency } : null;
  })();

  const shouldReduceExpenses = (risk.scores.expenseRatioPct ?? 0) >= 25 || anomalies.some((a) => a.type === 'expense_spike');
  const shouldInvestMore = risk.riskLevel === 'low' && (risk.scores.profitMarginPct ?? 0) >= 12 && !anomalies.some((a) => a.type === 'profit_drop');

  const actions: AiOwnerInsights['actions'] = [];
  if (shouldReduceExpenses) actions.push({ label: 'Review expenses now', type: 'review_expenses' });
  if (branchStrategy.transferRecommendations.length) actions.push({ label: 'Create stock transfer', type: 'transfer_stock' });
  if (inventoryRisk.deadStock60.length) actions.push({ label: 'Apply clearance discount', type: 'discount_pct', value: 12 });

  const narrativeParts: string[] = [];
  narrativeParts.push(`Overall risk level is ${risk.riskLevel.toUpperCase()} based on margin, expense ratio, and FX volatility.`);
  if (mostProfitableBranch) narrativeParts.push(`Most profitable branch today: ${mostProfitableBranch.branchName} (${mostProfitableBranch.currency} ${mostProfitableBranch.profit.toFixed(0)}).`);
  if (shouldInvestMore && branchStrategy.investInBranch) narrativeParts.push(`Investment bias: scale ${branchStrategy.investInBranch.branchName} (best net profit MTD).`);
  if (shouldReduceExpenses) narrativeParts.push('Expense control recommended: reduce non-essential spend and tighten discount approvals.');
  if (anomalies.length) narrativeParts.push('Abnormal activity detected: investigate the anomaly list (profit/expense/sales deviations).');

  return {
    shouldInvestMore,
    shouldReduceExpenses,
    mostProfitableBranch,
    narrative: narrativeParts.join(' '),
    actions,
  };
}

export const aiDecisionEngine = {
  async build(params: { companyId: string; branchId?: string | null; days?: number }, ctx: AiContextSnapshot) {
    const anomalies = detectAnomalies(ctx);
    const risk = assessRisk(ctx);
    const branchStrategy = await buildBranchStrategy({ companyId: params.companyId, branchId: params.branchId, days: params.days ?? 30 }, ctx);
    const inventoryRisk = await buildInventoryRisk({ companyId: params.companyId, branchId: params.branchId }, ctx);
    const ownerInsights = buildOwnerInsights(ctx, risk, anomalies, branchStrategy, inventoryRisk);

    await maybeCreateAbnormalActivityAlert(params.companyId, anomalies);

    return { anomalies, risk, branchStrategy, inventoryRisk, ownerInsights };
  },
};

