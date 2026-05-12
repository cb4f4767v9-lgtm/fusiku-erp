export type Money = {
  currency: string;
  amount: number;
};

export type TrendPoint = {
  date: string; // ISO date (yyyy-mm-dd)
  value: number;
};

export type AiContextSnapshot = {
  generatedAt: string;
  scope: {
    companyId: string;
    branchId: string | null;
    branchName: string | null;
  };

  dataQuality: {
    hasLegacyCost: boolean;
    hasMissingFx: boolean;
    warnings: string[];
  };

  // Current summary
  salesToday: { count: number; total: number; profit: number; currency: string };
  profitMonth: Money;
  expensesMonth: Money;
  inventorySummary: {
    availableCount: number;
    lowStockModels: Array<{ brand: string; model: string; count: number }>;
  };
  topSellingItems: Array<{ brand: string; model: string; count: number }>;

  // Trends
  trends: {
    salesDaily: TrendPoint[];
    profitDaily: TrendPoint[];
    expensesDaily: TrendPoint[];
    inventoryAvailableDaily: TrendPoint[];
  };

  // Multi-branch comparison
  branchStats: Array<{
    branchId: string;
    branchName: string;
    salesCount: number;
    salesTotal: number;
    profit: number;
    currency: string;
  }>;
  branchComparison: {
    weakestToday: { branchId: string; branchName: string; profit: number; salesTotal: number; currency: string } | null;
    weakestMonth: { branchId: string; branchName: string; netProfit: number; revenue: number; expenses: number; currency: string } | null;
    month: Array<{ branchId: string; branchName: string; revenue: number; expenses: number; netProfit: number; currency: string }>;
  };

  // FX impact
  currencyImpact: {
    baseCurrency: string;
    movers: Array<{ code: string; currentRate: number; lastRate: number | null; changePct: number | null }>;
  };
};

export type InsightSeverity = 'info' | 'warning' | 'success';

/** Normalized machine-consumable AI recommendation (used by clients & integrations). */
export type AIActionableOutput = {
  action: string;
  target: string;
  value: number;
  priority: 'low' | 'medium' | 'high';
};

export type SmartInsight = {
  code: 'low_profit_warning' | 'high_expense_alert' | 'slow_moving_inventory' | 'best_selling_products';
  severity: InsightSeverity;
  title: string;
  problem: string;
  recommendation: string;
  message: string; // compatibility: problem + recommendation
  actions?: Array<{ label: string; type: 'adjust_price_pct' | 'reduce_cost' | 'review_expenses' | 'transfer_stock' | 'discount_pct'; value?: number }>;
  data?: unknown;
};

export type Forecast = {
  horizon: 'next_month';
  currency: string;
  nextMonthSales: number;
  expectedProfit: number;
  requiredStock: Array<{ brand: string; model: string; suggestedUnits: number; reason: string }>;
  confidence: number; // 0..1
};

export type PricingRecommendation = {
  brand: string;
  model: string;
  storage?: string | null;
  condition?: string | null;
  costUsd: number | null;
  marketPrice: number | null;
  fxNote?: string;
  suggestedSellingPrice: number;
  suggestedMarginPct: number;
  confidence: number; // 0..1
  rationale: string[];
};

export type AiBusinessEngineResponse = {
  context: AiContextSnapshot;
  confidence: number; // 0..1 overall confidence
  trace?: {
    basedOn: string[];
  };
  dataHealth?: {
    score: number; // 0..100
    factors: {
      legacyCost: boolean;
      missingFx: boolean;
    };
  };
  insights: SmartInsight[];
  forecast: Forecast;
  pricing: PricingRecommendation[];
  alerts: any[];
  anomalies?: Array<{
    type: 'profit_drop' | 'expense_spike' | 'sales_spike';
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'success';
    priority?: 'critical' | 'high' | 'medium' | 'low';
    detectedAt: string;
    metrics?: Record<string, number | string | null>;
  }>;
  risk?: {
    riskLevel: 'low' | 'medium' | 'high';
    scores: { profitMarginPct: number | null; expenseRatioPct: number | null; fxVolatilityPct: number | null };
    rationale: string[];
  };
  branchStrategy?: {
    transferRecommendations: Array<{
      fromBranchId: string;
      fromBranchName: string;
      toBranchId: string;
      toBranchName: string;
      brand: string;
      model: string;
      reason: string;
      suggestedUnits: number;
    }>;
    investInBranch: { branchId: string; branchName: string; reason: string } | null;
    weakestBranchPlan: { branchId: string; branchName: string; plan: string[] } | null;
  };
  inventoryRisk?: {
    slowMoving: any[];
    deadStock30: any[];
    deadStock60: any[];
    recommendations: any[];
  };
  ownerInsights?: {
    shouldInvestMore: boolean;
    shouldReduceExpenses: boolean;
    mostProfitableBranch: { branchId: string; branchName: string; profit: number; currency: string } | null;
    narrative: string;
    actions: Array<{ label: string; type: 'review_expenses' | 'transfer_stock' | 'discount_pct'; value?: number }>;
  };
  /** Actionable items derived from insights, alerts, and owner actions */
  actionables?: AIActionableOutput[];
};

