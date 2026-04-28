import { prisma } from '../utils/prisma';
import { priceEstimatorService } from '../ai/priceEstimator.service';
import { currencyService } from './currency.service';
import { getTenantContext, requireTenantCompanyId } from '../utils/tenantContext';
import { logger } from '../utils/logger';
import { redisCacheService } from '../infrastructure/cache/redisCache.service';
import {
  effectiveExpenseUsd,
  amountToUsdWithStoredRate,
  effectivePurchaseTotalUsd,
  effectiveSaleProfitUsd,
  effectiveSaleTotalUsd,
  inventoryLegacyCostDisplayNote,
  UnreliableFinancialDataError,
  type ExpenseUsdRow,
  type ExpenseBranchUsdRow,
  type PurchaseUsdRow,
  type SaleUsdRow
} from '../utils/financialUsd';

export type ReportDataQuality = {
  hasLegacyCost: boolean;
  hasMissingFx: boolean;
};

const emptyDataQuality = (): ReportDataQuality => ({ hasLegacyCost: false, hasMissingFx: false });
const REPORT_QUERY_TIMEOUT_MS = Math.max(250, Math.min(60_000, Number(process.env.REPORT_QUERY_TIMEOUT_MS || 5_000)));
const DASHBOARD_DEBUG_STAGE = Math.max(0, Math.floor(Number(process.env.DASHBOARD_DEBUG_STAGE || 0)));

function errMeta(err: unknown) {
  if (!(err instanceof Error)) return { err };
  return { name: err.name, message: err.message, stack: err.stack };
}

async function withTimeout<T>(
  name: string,
  p: Promise<T>,
  ms: number,
  fallback: T,
  meta?: Record<string, unknown>
): Promise<T> {
  const t0 = Date.now();
  let to: NodeJS.Timeout | undefined;
  const timeoutP = new Promise<T>((resolve) => {
    to = setTimeout(() => {
      logger.warn({ name, ms, elapsedMs: Date.now() - t0, ...meta }, '[reportService] timeout — returning fallback');
      resolve(fallback);
    }, ms);
  });
  try {
    const out = await Promise.race([p, timeoutP]);
    logger.debug({ name, elapsedMs: Date.now() - t0, ...meta }, '[reportService] step ok');
    return out;
  } catch (err) {
    logger.error({ name, elapsedMs: Date.now() - t0, ...meta, ...errMeta(err) }, '[reportService] step failed — returning fallback');
    return fallback;
  } finally {
    if (to) clearTimeout(to);
  }
}

async function runStep<T>(
  name: string,
  fn: () => Promise<T>,
  fallback: T,
  meta?: Record<string, unknown>
): Promise<T> {
  logger.debug({ name, ...meta }, '[reportService] step start');
  return withTimeout(name, fn(), REPORT_QUERY_TIMEOUT_MS, fallback, meta);
}

function emptyDashboard() {
  return {
    totalInventory: 0,
    availableInventory: 0,
    totalSales: 0,
    totalProfit: 0,
    totalPurchases: 0,
    recentSales: [] as any[],
    totalInventoryValue: 0,
    dailySales: 0,
    todayProfit: 0,
    monthlyProfit: 0,
    branchMarginPercent: 0,
    monthlyProfitAfterBranchMargin: 0,
    devicesUnderRepair: 0,
    lowStockAlerts: 0,
    repairsInProgress: 0,
    refurbishingQueue: 0,
    totalDevicesInStock: 0,
    todaySales: 0,
    branchProfitRows: [] as any[],
    companyNetProfitMonth: 0,
    monthlyOperatingExpenses: 0,
    dataQuality: { hasLegacyCost: false, hasMissingFx: false },
    reportingNotice: null as string | null
  };
}

function mergeDataQuality(a: ReportDataQuality, b: Partial<ReportDataQuality>): ReportDataQuality {
  return {
    hasLegacyCost: a.hasLegacyCost || Boolean(b.hasLegacyCost),
    hasMissingFx: a.hasMissingFx || Boolean(b.hasMissingFx)
  };
}

type SaleBranchUsdRow = SaleUsdRow & { branchId: string };
type InvoiceUsdRow = {
  totalAmount: number;
  totalAmountUsd?: number | null;
  profit: number;
  profitUsd?: number | null;
  currency?: string | null;
  exchangeRateAtTransaction?: number | null;
};
type InvoiceBranchUsdRow = InvoiceUsdRow & { branchId: string };

function effectiveInvoiceTotalUsd(row: InvoiceUsdRow, rates: Record<string, number>): number {
  if (row.totalAmountUsd != null && Number.isFinite(Number(row.totalAmountUsd))) return Number(row.totalAmountUsd);
  const currency = String(row.currency || 'USD').trim().toUpperCase();
  const fx = Number(row.exchangeRateAtTransaction);
  if (!Number.isFinite(fx) || fx <= 0) throw new UnreliableFinancialDataError('Missing invoice FX');
  return amountToUsdWithStoredRate(Number(row.totalAmount || 0), currency, fx);
}

function effectiveInvoiceProfitUsd(row: InvoiceUsdRow, rates: Record<string, number>): number {
  if (row.profitUsd != null && Number.isFinite(Number(row.profitUsd))) return Number(row.profitUsd);
  const currency = String(row.currency || 'USD').trim().toUpperCase();
  const fx = Number(row.exchangeRateAtTransaction);
  if (!Number.isFinite(fx) || fx <= 0) throw new UnreliableFinancialDataError('Missing invoice FX');
  return amountToUsdWithStoredRate(Number(row.profit || 0), currency, fx);
}

async function sumSalesUsd(where: Record<string, unknown>, companyId: string) {
  const rates = await currencyService.getRatesMap(companyId);
  const invoiceRows = (await prisma.invoice.findMany({
    where: { ...where, companyId } as any,
    select: {
      totalAmount: true,
      totalAmountUsd: true,
      profit: true,
      profitUsd: true,
      currency: true,
      exchangeRateAtTransaction: true
    } as any
  })) as unknown as InvoiceUsdRow[];
  const legacyRows = (await prisma.sale.findMany({
    where: { ...where, companyId, invoices: { none: {} } } as any,
    select: {
      totalAmount: true,
      totalAmountUsd: true,
      profit: true,
      profitUsd: true,
      currency: true,
      exchangeRateAtTransaction: true
    } as any
  })) as unknown as SaleUsdRow[];
  let totalAmount = 0;
  let profit = 0;
  const quality = emptyDataQuality();
  for (const r of invoiceRows) {
    try {
      totalAmount += effectiveInvoiceTotalUsd(r, rates);
      profit += effectiveInvoiceProfitUsd(r, rates);
    } catch (e) {
      if (e instanceof UnreliableFinancialDataError) quality.hasMissingFx = true;
      else throw e;
    }
  }
  for (const r of legacyRows) {
    try {
      totalAmount += effectiveSaleTotalUsd(r, rates);
      profit += effectiveSaleProfitUsd(r, rates);
    } catch (e) {
      if (e instanceof UnreliableFinancialDataError) quality.hasMissingFx = true;
      else throw e;
    }
  }
  return { totalAmount, profit, quality };
}

async function sumPurchasesUsd(where: Record<string, unknown>, companyId: string) {
  const rates = await currencyService.getRatesMap(companyId);
  const rows = (await prisma.purchase.findMany({
    where: { ...where, companyId } as any,
    select: {
      totalAmount: true,
      totalAmountUsd: true,
      cargoCost: true,
      cargoCostUsd: true,
      currency: true,
      exchangeRateAtTransaction: true
    } as any
  })) as unknown as PurchaseUsdRow[];
  let total = 0;
  const quality = emptyDataQuality();
  for (const r of rows) {
    try {
      total += effectivePurchaseTotalUsd(r, rates);
    } catch (e) {
      if (e instanceof UnreliableFinancialDataError) quality.hasMissingFx = true;
      else throw e;
    }
  }
  return { total, quality };
}

async function sumExpensesUsd(where: Record<string, unknown>, companyId: string) {
  const rates = await currencyService.getRatesMap(companyId);
  const rows = (await prisma.expense.findMany({
    where: { ...where, companyId } as any,
    select: { amount: true, amountUsd: true, currency: true, exchangeRateAtTransaction: true } as any
  })) as unknown as ExpenseUsdRow[];
  let total = 0;
  const quality = emptyDataQuality();
  for (const r of rows) {
    try {
      total += effectiveExpenseUsd(r, rates);
    } catch (e) {
      if (e instanceof UnreliableFinancialDataError) quality.hasMissingFx = true;
      else throw e;
    }
  }
  return { total, quality };
}

/**
 * Per-branch P&L for the calendar month:
 * `monthNetProfit = Σ sale.profitUsd (effective) − Σ expense.amountUsd (effective)` (same window).
 * Effective USD: strict only (stored `*Usd` / stored FX); rows that fail normalization are skipped and flagged in `dataQuality`.
 */
async function buildBranchNetProfitRows(monthStart: Date, monthEnd: Date, companyId: string, scopeBranchId?: string) {
  const branchWhere: Record<string, unknown> = { companyId, isActive: true };
  if (scopeBranchId) branchWhere.id = scopeBranchId;

  const branches = await prisma.branch.findMany({
    where: branchWhere,
    select: { id: true, name: true },
    orderBy: { name: 'asc' }
  });

  const saleWhere: Record<string, unknown> = {
    companyId,
    createdAt: { gte: monthStart, lte: monthEnd }
  };
  if (scopeBranchId) saleWhere.branchId = scopeBranchId;

  const expWhere: Record<string, unknown> = {
    companyId,
    expenseDate: { gte: monthStart, lte: monthEnd }
  };
  if (scopeBranchId) expWhere.branchId = scopeBranchId;

  const rates = await currencyService.getRatesMap(companyId);
  // Avoid parallel Prisma calls (pool exhaustion under low connection_limit).
  const salesRows = (await prisma.invoice.findMany({
    where: saleWhere,
    select: {
      branchId: true,
      totalAmount: true,
      totalAmountUsd: true,
      profit: true,
      profitUsd: true,
      currency: true,
      exchangeRateAtTransaction: true
    } as any
  })) as unknown as InvoiceBranchUsdRow[];

  const expenseRows = (await prisma.expense.findMany({
    where: expWhere,
    select: {
      branchId: true,
      amount: true,
      amountUsd: true,
      currency: true,
      exchangeRateAtTransaction: true
    } as any
  })) as unknown as ExpenseBranchUsdRow[];

  const legacySalesRows = (await prisma.sale.findMany({
    where: { ...saleWhere, invoices: { none: {} } } as any,
    select: {
      branchId: true,
      totalAmount: true,
      totalAmountUsd: true,
      profit: true,
      profitUsd: true,
      currency: true,
      exchangeRateAtTransaction: true
    } as any
  })) as unknown as SaleBranchUsdRow[];

  const dataQuality = emptyDataQuality();
  const profitByBranch = new Map<string, number>();
  const salesByBranch = new Map<string, number>();
  for (const s of salesRows) {
    try {
      profitByBranch.set(s.branchId, (profitByBranch.get(s.branchId) ?? 0) + effectiveInvoiceProfitUsd(s, rates));
      salesByBranch.set(s.branchId, (salesByBranch.get(s.branchId) ?? 0) + effectiveInvoiceTotalUsd(s, rates));
    } catch (e) {
      if (e instanceof UnreliableFinancialDataError) dataQuality.hasMissingFx = true;
      else throw e;
    }
  }
  for (const s of legacySalesRows) {
    try {
      profitByBranch.set(s.branchId, (profitByBranch.get(s.branchId) ?? 0) + effectiveSaleProfitUsd(s, rates));
      salesByBranch.set(s.branchId, (salesByBranch.get(s.branchId) ?? 0) + effectiveSaleTotalUsd(s, rates));
    } catch (e) {
      if (e instanceof UnreliableFinancialDataError) dataQuality.hasMissingFx = true;
      else throw e;
    }
  }
  const expByBranch = new Map<string | null, number>();
  for (const e of expenseRows) {
    try {
      expByBranch.set(e.branchId, (expByBranch.get(e.branchId) ?? 0) + effectiveExpenseUsd(e, rates));
    } catch (err) {
      if (err instanceof UnreliableFinancialDataError) dataQuality.hasMissingFx = true;
      else throw err;
    }
  }

  const rows = branches.map((b) => {
    const gross = profitByBranch.get(b.id) ?? 0;
    const exp = expByBranch.get(b.id) ?? 0;
    return {
      branchId: b.id,
      branchName: b.name,
      monthSales: salesByBranch.get(b.id) ?? 0,
      monthGrossProfit: gross,
      monthExpenses: exp,
      monthNetProfit: gross - exp
    };
  });

  if (!scopeBranchId) {
    const unassigned = expByBranch.get(null) ?? 0;
    if (unassigned > 0) {
      rows.push({
        branchId: '__unassigned__',
        branchName: 'Unassigned expenses',
        monthSales: 0,
        monthGrossProfit: 0,
        monthExpenses: unassigned,
        monthNetProfit: -unassigned
      });
    }
  }

  const companyNetProfitMonth = rows.reduce((s, r) => s + r.monthNetProfit, 0);
  return { branchProfitRows: rows, companyNetProfitMonth, dataQuality };
}

async function getDashboard(branchId?: string, companyIdParam?: string | null) {
  try {
    const ctx = getTenantContext();
    const companyId = (companyIdParam ?? (() => {
      try {
        return requireTenantCompanyId();
      } catch {
        return null;
      }
    })()) as string | null;
    if (!companyId) {
      logger.warn({ branchId }, '[reportService] getDashboard missing companyId — returning empty');
      return emptyDashboard();
    }
    const effectiveBranchId =
      ctx?.branchId && !(ctx?.isSystemAdmin === true || ctx?.branchRole === 'SUPER_ADMIN')
        ? ctx.branchId
        : branchId;

    // Redis cache (short TTL) for heavy dashboard queries.
    // Only cache full dashboards (debug-stage partial returns are intentionally not cached).
    const shouldCache = redisCacheService.enabled() && DASHBOARD_DEBUG_STAGE === 0;
    const cacheKey = shouldCache
      ? `cache:dashboard:v1:company:${companyId}:branch:${effectiveBranchId || 'all'}`
      : null;
    const cacheTags = shouldCache
      ? [
          `dashboard:company:${companyId}`,
          `reports:company:${companyId}`,
          ...(effectiveBranchId
            ? [
                `dashboard:company:${companyId}:branch:${effectiveBranchId}`,
                `reports:company:${companyId}:branch:${effectiveBranchId}`,
              ]
            : []),
        ]
      : [];
    if (shouldCache && cacheKey) {
      const cached = await redisCacheService.getJson<any>(cacheKey);
      if (cached) return cached;
    }

    // STRICT multi-tenant isolation: every query must be explicitly scoped by companyId.
    // Never rely on nested relation filters or conditional injection.
    const scopeWhere: any = effectiveBranchId ? { branchId: effectiveBranchId } : {};
    const tenantWhere: any = { companyId, ...scopeWhere };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    logger.info(
      { companyId, branchId: effectiveBranchId || null, timeoutMs: REPORT_QUERY_TIMEOUT_MS, stage: DASHBOARD_DEBUG_STAGE || null },
      '[reportService] getDashboard start'
    );

    const partial = emptyDashboard();
    let stage = 0;
    const shouldStop = () => DASHBOARD_DEBUG_STAGE > 0 && stage >= DASHBOARD_DEBUG_STAGE;

    // The dashboard intentionally runs many queries; keep them sequential to avoid Prisma pool exhaustion.
    stage++;
    partial.totalInventory = await runStep(
      'dashboard.totalInventory',
      () => prisma.inventory.count({ where: tenantWhere }),
      0,
      { companyId, branchId: effectiveBranchId || null }
    );
    partial.totalDevicesInStock = partial.totalInventory;
    if (shouldStop()) return partial;

    stage++;
    partial.availableInventory = await runStep(
      'dashboard.availableInventory',
      () => prisma.inventory.count({ where: { ...tenantWhere, status: 'available' } }),
      0,
      { companyId, branchId: effectiveBranchId || null }
    );
    if (shouldStop()) return partial;

    stage++;
    const totalsAll = await runStep('dashboard.totalsAll', () => sumSalesUsd(scopeWhere, companyId), { totalAmount: 0, profit: 0, quality: emptyDataQuality() }, { companyId });
    partial.totalSales = Number(totalsAll.totalAmount || 0);
    partial.totalProfit = Number(totalsAll.profit || 0);
    partial.dataQuality = mergeDataQuality(partial.dataQuality, totalsAll.quality || {});
    if (shouldStop()) return partial;

    stage++;
    const totalPurchasesUsd = await runStep('dashboard.totalPurchases', () => sumPurchasesUsd(scopeWhere, companyId), { total: 0, quality: emptyDataQuality() }, { companyId });
    partial.totalPurchases = Number((totalPurchasesUsd as any).total || 0);
    partial.dataQuality = mergeDataQuality(partial.dataQuality, (totalPurchasesUsd as any).quality || {});
    if (shouldStop()) return partial;

    stage++;
    partial.recentSales = await runStep(
      'dashboard.recentSales',
      () =>
        prisma.invoice.findMany({
          where: { ...tenantWhere },
          include: { branch: true },
          orderBy: { createdAt: 'desc' },
          take: 10
        }),
      [],
      { companyId, branchId: effectiveBranchId || null }
    );
    if (shouldStop()) return partial;

    stage++;
    const inventoryValue = await runStep(
      'dashboard.inventoryValue',
      () =>
        prisma.inventory.aggregate({
          where: { ...tenantWhere, status: 'available' },
          _sum: { sellingPrice: true }
        }),
      { _sum: { sellingPrice: 0 } } as any,
      { companyId, branchId: effectiveBranchId || null }
    );
    partial.totalInventoryValue = Number((inventoryValue as any)?._sum?.sellingPrice || 0);
    if (shouldStop()) return partial;

    stage++;
    const totalsToday = await runStep(
      'dashboard.totalsToday',
      () => sumSalesUsd({ ...scopeWhere, createdAt: { gte: today } }, companyId),
      { totalAmount: 0, profit: 0, quality: emptyDataQuality() },
      { companyId }
    );
    partial.dailySales = Number(totalsToday.totalAmount || 0);
    partial.todaySales = partial.dailySales;
    partial.todayProfit = Number(totalsToday.profit || 0);
    partial.dataQuality = mergeDataQuality(partial.dataQuality, totalsToday.quality || {});
    if (shouldStop()) return partial;

    stage++;
    const totalsMonth = await runStep(
      'dashboard.totalsMonth',
      () => sumSalesUsd({ ...scopeWhere, createdAt: { gte: monthStart } }, companyId),
      { totalAmount: 0, profit: 0, quality: emptyDataQuality() },
      { companyId }
    );
    partial.monthlyProfit = Number(totalsMonth.profit || 0);
    partial.monthlyProfitAfterBranchMargin = partial.monthlyProfitAfterBranchMargin; // computed later when margin known
    partial.dataQuality = mergeDataQuality(partial.dataQuality, totalsMonth.quality || {});
    if (shouldStop()) return partial;

    stage++;
    partial.devicesUnderRepair = await runStep(
      'dashboard.devicesUnderRepair',
      () => prisma.inventory.count({ where: { ...tenantWhere, status: 'in_repair' } }),
      0,
      { companyId, branchId: effectiveBranchId || null }
    );
    if (shouldStop()) return partial;

    stage++;
    const lowStockCount = await runStep(
      'dashboard.lowStockGroupBy',
      () =>
        prisma.inventory.groupBy({
          by: ['brand', 'model'],
          where: { ...tenantWhere, status: 'available' },
          _count: { id: true }
        }),
      [],
      { companyId, branchId: effectiveBranchId || null }
    );
    partial.lowStockAlerts = (lowStockCount as any[]).filter((g) => Number(g?._count?.id || 0) < 3).length;
    if (shouldStop()) return partial;

    stage++;
    const legacyCostInventoryCount = await runStep(
      'dashboard.legacyCostInventoryCount',
      () =>
        prisma.inventory.count({
          where: {
            AND: [tenantWhere, { OR: [{ costUsd: null }, { isLegacyCost: true }] } as any]
          } as any
        }),
      0,
      { companyId, branchId: effectiveBranchId || null }
    );
    if (Number(legacyCostInventoryCount || 0) > 0) partial.dataQuality = mergeDataQuality(partial.dataQuality, { hasLegacyCost: true });
    if (shouldStop()) return partial;

    // Enterprise: branch margin/overhead percent (optional) for profit-after-margin reporting.
    stage++;
    const branchMarginPercent = effectiveBranchId
      ? Number(
          (
            await runStep(
              'dashboard.branchMarginPercent',
              () =>
                prisma.branch.findFirst({
                  where: { id: effectiveBranchId, companyId },
                  select: { marginPercent: true }
                }),
              null,
              { companyId, branchId: effectiveBranchId }
            )
          )?.marginPercent || 0
        )
      : 0;
    const clampMargin = (n: number) => (Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);
    const m = clampMargin(branchMarginPercent);
    const profitAfterMarginMonth = totalsMonth.profit - totalsMonth.totalAmount * (m / 100);
    partial.branchMarginPercent = m;
    partial.monthlyProfitAfterBranchMargin = Number.isFinite(profitAfterMarginMonth) ? profitAfterMarginMonth : 0;
    if (shouldStop()) return partial;

    const lowStock = (lowStockCount as any[]).filter((g) => g._count.id < 3).length;
    const repairWhere: any = { companyId, ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}) };
    stage++;
    partial.repairsInProgress = await runStep(
      'dashboard.repairsInProgress',
      () =>
        prisma.repair.count({
          where: { ...repairWhere, status: { in: ['received', 'diagnosing', 'waiting_parts', 'repairing', 'testing'] } }
        }),
      0,
      { companyId, branchId: effectiveBranchId || null }
    );
    if (shouldStop()) return partial;

    stage++;
    partial.refurbishingQueue = await runStep(
      'dashboard.refurbishingQueue',
      () =>
        prisma.refurbishJob.count({
          where: {
            companyId,
            ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
            status: { in: ['pending', 'in_progress'] }
          }
        }),
      0,
      { companyId, branchId: effectiveBranchId || null }
    );
    if (shouldStop()) return partial;

    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    stage++;
    const branchProfitRes = await runStep(
      'dashboard.branchNetProfit',
      () => buildBranchNetProfitRows(monthStart, monthEnd, companyId, effectiveBranchId || undefined),
      { branchProfitRows: [], companyNetProfitMonth: 0, dataQuality: emptyDataQuality() },
      { companyId, branchId: effectiveBranchId || null }
    );
    partial.branchProfitRows = (branchProfitRes as any).branchProfitRows || [];
    partial.companyNetProfitMonth = Number((branchProfitRes as any).companyNetProfitMonth || 0);
    partial.dataQuality = mergeDataQuality(partial.dataQuality, (branchProfitRes as any).dataQuality || {});
    if (shouldStop()) return partial;

    stage++;
    const monthlyOperatingExpensesRes = await runStep(
      'dashboard.monthlyOperatingExpenses',
      () =>
        sumExpensesUsd(
          {
            expenseDate: { gte: monthStart, lte: monthEnd },
            ...(effectiveBranchId ? { branchId: effectiveBranchId } : {})
          },
          companyId
        ),
      { total: 0, quality: emptyDataQuality() },
      { companyId, branchId: effectiveBranchId || null }
    );
    partial.monthlyOperatingExpenses = Number((monthlyOperatingExpensesRes as any).total || 0);
    partial.dataQuality = mergeDataQuality(partial.dataQuality, (monthlyOperatingExpensesRes as any).quality || {});
    if (shouldStop()) return partial;

    partial.reportingNotice = partial.dataQuality.hasMissingFx ? 'Data incomplete for accurate reporting' : null;
    logger.info(
      { companyId, branchId: effectiveBranchId || null, reportingNotice: partial.reportingNotice, dataQuality: partial.dataQuality },
      '[reportService] getDashboard done'
    );
    if (shouldCache && cacheKey) {
      await redisCacheService.setJson(cacheKey, partial, {
        ttlSeconds: redisCacheService.ttls.dashboard(),
        tags: cacheTags,
      });
    }
    return partial;
  } catch (err) {
    logger.error({ ...errMeta(err) }, '[reportService] getDashboard failed — returning safe fallback');
    return emptyDashboard();
  }
}

async function getSalesReport(filters?: {
  branchId?: string;
  companyId?: string | null;
  startDate?: Date;
  endDate?: Date;
  brand?: string;
  model?: string;
}) {
  const ctx = getTenantContext();
  const effectiveBranchId =
    ctx?.branchId && !(ctx?.isSystemAdmin === true || ctx?.branchRole === 'SUPER_ADMIN')
      ? ctx.branchId
      : filters?.branchId;
  const where: any = effectiveBranchId ? { branchId: effectiveBranchId } : {};
  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters?.startDate) where.createdAt.gte = filters.startDate;
    if (filters?.endDate) where.createdAt.lte = filters.endDate;
  }
  const invoices = await prisma.invoice.findMany({
    where,
    include: { branch: true, customer: true, items: { include: { inventory: true } } },
    orderBy: { createdAt: 'desc' }
  });
  let filtered = invoices as any[];
  if (filters?.brand || filters?.model) {
    filtered = invoices.filter((s: any) => {
      const items = s.items || [];
      return items.some(
        (i: any) =>
          (!filters?.brand || (i.inventory?.brand || '').toLowerCase().includes((filters!.brand || '').toLowerCase())) &&
          (!filters?.model || (i.inventory?.model || '').toLowerCase().includes((filters!.model || '').toLowerCase()))
      );
    });
  }

  const dataQuality = emptyDataQuality();
  const enriched = filtered.map((s) => {
    const saleItems = ((s as any).items || []).map((si: any) => {
      const inv = si.inventory;
      const note = inv ? inventoryLegacyCostDisplayNote(inv) : null;
      if (note) dataQuality.hasLegacyCost = true;
      return { ...si, legacyCostNote: note };
    });
    return { ...s, saleItems, items: undefined };
  });

  return { sales: enriched, dataQuality };
}

async function getInventoryReport(branchId?: string, filters?: { brand?: string; model?: string }) {
  const ctx = getTenantContext();
  const effectiveBranchId =
    ctx?.branchId && !(ctx?.isSystemAdmin === true || ctx?.branchRole === 'SUPER_ADMIN')
      ? ctx.branchId
      : branchId;
  const where: any = effectiveBranchId ? { branchId: effectiveBranchId } : {};
  if (filters?.brand) where.brand = { contains: filters.brand };
  if (filters?.model) where.model = { contains: filters.model };
  const rows = await prisma.inventory.findMany({
    where,
    include: { branch: true },
    orderBy: { createdAt: 'desc' }
  });
  const dataQuality = emptyDataQuality();
  const items = rows.map((r: any) => {
    const legacyCostNote = inventoryLegacyCostDisplayNote(r);
    if (legacyCostNote) dataQuality.hasLegacyCost = true;
    return { ...r, legacyCostNote };
  });
  return { items, dataQuality };
}

async function getProfitReport(filters?: {
  branchId?: string;
  companyId?: string | null;
  startDate?: Date;
  endDate?: Date;
  brand?: string;
}) {
  const ctx = getTenantContext();
  const companyId = requireTenantCompanyId();
  const where: any = { companyId };
  const effectiveBranchId =
    ctx?.branchId && !(ctx?.isSystemAdmin === true || ctx?.branchRole === 'SUPER_ADMIN')
      ? ctx.branchId
      : filters?.branchId;
  if (effectiveBranchId) where.branchId = effectiveBranchId;
  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters?.startDate) where.createdAt.gte = filters.startDate;
    if (filters?.endDate) where.createdAt.lte = filters.endDate;
  }
  const rates = await currencyService.getRatesMap(companyId);
  const sales = await prisma.invoice.findMany({
    where,
    include: { items: { include: { inventory: true } } }
  });
  const dataQuality = emptyDataQuality();
  let totalRevenue = 0;
  let totalProfit = 0;
  for (const x of sales) {
    try {
      totalRevenue += effectiveInvoiceTotalUsd(x as any, rates);
      totalProfit += effectiveInvoiceProfitUsd(x as any, rates);
    } catch (e) {
      if (e instanceof UnreliableFinancialDataError) dataQuality.hasMissingFx = true;
      else throw e;
    }
    for (const si of (x as any).items || []) {
      const inv = si.inventory;
      if (inv && inventoryLegacyCostDisplayNote(inv)) dataQuality.hasLegacyCost = true;
    }
  }
  const totalCostOfSales = totalRevenue - totalProfit;

  const expWhere: Record<string, unknown> = { companyId };
  if (filters?.startDate || filters?.endDate) {
    expWhere.expenseDate = {};
    if (filters?.startDate) (expWhere.expenseDate as any).gte = filters.startDate;
    if (filters?.endDate) (expWhere.expenseDate as any).lte = filters.endDate;
  }
  if (effectiveBranchId) expWhere.branchId = effectiveBranchId;

  const totalExpensesRes = await sumExpensesUsd(expWhere, companyId);
  const totalExpenses = totalExpensesRes.total;
  const mergedQuality = mergeDataQuality(dataQuality, totalExpensesRes.quality);
  const netProfitAfterExpenses = totalProfit - totalExpenses;

  return {
    sales,
    totalRevenue,
    totalCostOfSales,
    totalProfit,
    totalExpenses,
    netProfitAfterExpenses,
    dataQuality: mergedQuality
  };
}

async function getExpenseReport(filters?: {
  branchId?: string;
  startDate?: Date;
  endDate?: Date;
  companyId?: string | null;
}) {
  const ctx = getTenantContext();
  const companyId = requireTenantCompanyId();
  const rates = await currencyService.getRatesMap(companyId);
  const where: Record<string, unknown> = { companyId };
  const effectiveBranchId =
    ctx?.branchId && !(ctx?.isSystemAdmin === true || ctx?.branchRole === 'SUPER_ADMIN')
      ? ctx.branchId
      : filters?.branchId;
  if (effectiveBranchId) where.branchId = effectiveBranchId;
  if (filters?.startDate || filters?.endDate) {
    where.expenseDate = {} as Record<string, Date>;
    if (filters.startDate) (where.expenseDate as any).gte = filters.startDate;
    if (filters.endDate) (where.expenseDate as any).lte = filters.endDate;
  }
  const rows = await prisma.expense.findMany({
    where,
    include: { branch: { select: { id: true, name: true } } },
    orderBy: { expenseDate: 'desc' }
  });
  const dataQuality = emptyDataQuality();
  let totalAmount = 0;
  const byCat = new Map<string, number>();
  for (const r of rows) {
    try {
      const u = effectiveExpenseUsd(r as ExpenseUsdRow, rates);
      totalAmount += u;
      byCat.set(r.category, (byCat.get(r.category) ?? 0) + u);
    } catch (e) {
      if (e instanceof UnreliableFinancialDataError) dataQuality.hasMissingFx = true;
      else throw e;
    }
  }
  return {
    items: rows,
    totalAmount,
    byCategory: [...byCat.entries()].map(([category, amount]) => ({ category, amount })),
    dataQuality
  };
}

async function getBranchComparison(filters?: { startDate?: Date; endDate?: Date }) {
  const companyId = requireTenantCompanyId();
  const saleWhere: Record<string, unknown> = { companyId };
  const expWhere: Record<string, unknown> = { companyId };
  if (filters?.startDate || filters?.endDate) {
    saleWhere.createdAt = {} as Record<string, Date>;
    expWhere.expenseDate = {} as Record<string, Date>;
    if (filters.startDate) {
      (saleWhere.createdAt as any).gte = filters.startDate;
      (expWhere.expenseDate as any).gte = filters.startDate;
    }
    if (filters.endDate) {
      (saleWhere.createdAt as any).lte = filters.endDate;
      (expWhere.expenseDate as any).lte = filters.endDate;
    }
  }

  const rates = await currencyService.getRatesMap(companyId);
  // Avoid parallel Prisma calls (pool exhaustion under low connection_limit).
  const branches = (await prisma.branch.findMany({
    where: { companyId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' }
  })) as unknown as Array<{ id: string; name: string | null }>;

  const salesRows = (await prisma.invoice.findMany({
    where: saleWhere,
    select: {
      branchId: true,
      totalAmount: true,
      totalAmountUsd: true,
      profit: true,
      profitUsd: true,
      currency: true,
      exchangeRateAtTransaction: true
    } as any
  })) as unknown as InvoiceBranchUsdRow[];

  const expenseRows = (await prisma.expense.findMany({
    where: expWhere,
    select: {
      branchId: true,
      amount: true,
      amountUsd: true,
      currency: true,
      exchangeRateAtTransaction: true
    } as any
  })) as unknown as ExpenseBranchUsdRow[];

  const dataQuality = emptyDataQuality();
  const salesMap = new Map<string, { revenue: number; grossProfit: number }>();
  for (const s of salesRows) {
    try {
      const cur = salesMap.get(s.branchId) ?? { revenue: 0, grossProfit: 0 };
      cur.revenue += effectiveInvoiceTotalUsd(s, rates);
      cur.grossProfit += effectiveInvoiceProfitUsd(s, rates);
      salesMap.set(s.branchId, cur);
    } catch (e) {
      if (e instanceof UnreliableFinancialDataError) dataQuality.hasMissingFx = true;
      else throw e;
    }
  }
  const expMap = new Map<string, number>();
  for (const e of expenseRows) {
    try {
      expMap.set(e.branchId, (expMap.get(e.branchId) ?? 0) + effectiveExpenseUsd(e, rates));
    } catch (err) {
      if (err instanceof UnreliableFinancialDataError) dataQuality.hasMissingFx = true;
      else throw err;
    }
  }

  const branchRows = branches.map((b) => {
    const sg = salesMap.get(b.id);
    const revenue = sg?.revenue ?? 0;
    const grossProfit = sg?.grossProfit ?? 0;
    const cos = revenue - grossProfit;
    const expenses = expMap.get(b.id) ?? 0;
    return {
      branchId: b.id,
      branchName: b.name,
      revenue,
      costOfSales: cos,
      grossProfit,
      expenses,
      netProfit: grossProfit - expenses
    };
  });
  return { branches: branchRows, dataQuality };
}

async function getTechniciansReport(filters?: { startDate?: Date; endDate?: Date }) {
  const ctx = getTenantContext();
  const where: any = {};
  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {};
    if (filters?.startDate) where.createdAt.gte = filters.startDate;
    if (filters?.endDate) where.createdAt.lte = filters.endDate;
  }
  // Branch users only see their branch technicians workload (via repair.branchId).
  if (ctx?.branchId && !(ctx?.isSystemAdmin === true || ctx?.branchRole === 'SUPER_ADMIN')) {
    where.branchId = ctx.branchId;
  }
  const repairs = await prisma.repair.findMany({
    where,
    include: { technician: true }
  });
  const byTech: Record<string, { count: number; totalCost: number }> = {};
  for (const r of repairs) {
    const name = r.technician?.name || 'Unknown';
    if (!byTech[name]) byTech[name] = { count: 0, totalCost: 0 };
    byTech[name].count++;
    byTech[name].totalCost += Number(r.repairCost || 0);
  }
  return Object.entries(byTech).map(([name, data]) => ({ technician: name, ...data }));
}

async function getInventoryFinancialSummary(branchId?: string) {
  const ctx = getTenantContext();
  const effectiveBranchId =
    ctx?.branchId && !(ctx?.isSystemAdmin === true || ctx?.branchRole === 'SUPER_ADMIN')
      ? ctx.branchId
      : branchId;
  const where: any = effectiveBranchId ? { branchId: effectiveBranchId } : {};
  // Avoid parallel Prisma calls (pool exhaustion under low connection_limit).
  const purchaseSum = await prisma.inventory.aggregate({
    where: { ...where, status: 'available' },
    _sum: { purchasePrice: true }
  });
  const sellingSum = await prisma.inventory.aggregate({
    where: { ...where, status: 'available' },
    _sum: { sellingPrice: true }
  });
  const totalCost = Number(purchaseSum._sum.purchasePrice || 0);
  const totalValue = Number(sellingSum._sum.sellingPrice || 0);
  return { totalCost, totalValue, potentialProfit: totalValue - totalCost };
}

async function getInventoryMarketValue(branchId?: string, companyId?: string | null) {
  const ctx = getTenantContext();
  const cid = companyId ? String(companyId).trim() : '';
  if (!cid) {
    return {
      totalInventoryValue: 0,
      estimatedResaleValue: 0,
      expectedProfit: 0,
      expectedProfitMargin: 0,
    };
  }
  const where: any = { companyId: cid, status: 'available' };
  const effectiveBranchId =
    ctx?.branchId && !(ctx?.isSystemAdmin === true || ctx?.branchRole === 'SUPER_ADMIN')
      ? ctx.branchId
      : branchId;
  if (effectiveBranchId) where.branchId = effectiveBranchId;

  const items = await prisma.inventory.findMany({
    where,
    select: {
      brand: true,
      model: true,
      storage: true,
      condition: true,
      purchasePrice: true,
      sellingPrice: true
    }
  });

  let totalPurchaseValue = 0;
  items.forEach((item) => {
    totalPurchaseValue += Number(item.purchasePrice || 0);
  });

  // Avoid nested parallel calls that can stress DB/LLM providers under load.
  const estimates: Array<{ recommendedPrice: number }> = [];
  for (const item of items) {
    const est = await withTimeout(
      'inventoryMarketValue.estimate',
      priceEstimatorService.estimate({
        brand: item.brand,
        model: item.model,
        storage: item.storage,
        condition: item.condition,
        purchasePrice: Number(item.purchasePrice || 0),
        companyId: cid,
      }) as any,
      REPORT_QUERY_TIMEOUT_MS,
      { recommendedPrice: Number(item.sellingPrice || 0) } as any,
      { companyId: cid, brand: item.brand, model: item.model }
    );
    estimates.push(est as any);
  }

  const estimatedResaleValue = estimates.reduce((sum, e) => sum + e.recommendedPrice, 0);
  const expectedProfit = estimatedResaleValue - totalPurchaseValue;
  const expectedProfitMargin = totalPurchaseValue > 0 ? (expectedProfit / totalPurchaseValue) * 100 : 0;

  return {
    totalInventoryValue: totalPurchaseValue,
    estimatedResaleValue: Math.round(estimatedResaleValue * 100) / 100,
    expectedProfit: Math.round(expectedProfit * 100) / 100,
    expectedProfitMargin: Math.round(expectedProfitMargin * 100) / 100
  };
}

async function getTopSellingModels(branchId?: string, limit = 10) {
  try {
    const ctx = getTenantContext();
    const companyId = requireTenantCompanyId();
    const effectiveBranchId =
      ctx?.branchId && !(ctx?.isSystemAdmin === true || ctx?.branchRole === 'SUPER_ADMIN')
        ? ctx.branchId
        : branchId;
    const invoiceWhere: any = { companyId, ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}) };
    const take = Math.max(1, Math.min(50, Math.floor(Number(limit) || 10)));

    const cacheEnabled = redisCacheService.enabled();
    const cacheKey = cacheEnabled
      ? `cache:reports:top-selling:v1:company:${companyId}:branch:${effectiveBranchId || 'all'}:take:${take}`
      : null;
    const cacheTags = [
      `reports:company:${companyId}`,
      ...(effectiveBranchId ? [`reports:company:${companyId}:branch:${effectiveBranchId}`] : []),
    ];
    if (cacheEnabled && cacheKey) {
      const cached = await redisCacheService.getJson<any[]>(cacheKey);
      if (cached) return cached;
    }

    // 1) Aggregate counts by inventoryId in DB.
    const grouped = (await (prisma as any).invoiceItem.groupBy({
      by: ['inventoryId'],
      where: { invoice: invoiceWhere } as any,
      _count: { inventoryId: true },
      orderBy: { _count: { inventoryId: 'desc' } } as any,
      take
    })) as unknown as Array<{ inventoryId: string | null; _count: { inventoryId: number } }>;

    const ids = grouped.map((g) => g.inventoryId).filter((x): x is string => Boolean(x));
    if (ids.length === 0) return [];

    // 2) Fetch only required inventory fields for those IDs.
    const invRows = await prisma.inventory.findMany({
      where: { companyId, id: { in: ids } } as any,
      select: { id: true, brand: true, model: true }
    });
    const invById = new Map(invRows.map((r) => [r.id, r]));

    const out = grouped
      .map((g) => {
        const inv = g.inventoryId ? invById.get(g.inventoryId) : null;
        return {
          brand: inv?.brand || '',
          model: inv?.model || '',
          count: Number(g._count.inventoryId || 0)
        };
      })
      .filter((x) => x.brand || x.model)
      .slice(0, take);
    if (cacheEnabled && cacheKey) {
      await redisCacheService.setJson(cacheKey, out, {
        ttlSeconds: redisCacheService.ttls.reports(),
        tags: cacheTags,
      });
    }
    return out;
  } catch (err) {
    logger.error({ err }, '[reportService] getTopSellingModels failed — returning empty fallback');
    return [];
  }
}

async function getTopTechnicians(limit = 10) {
  const ctx = getTenantContext();
  const where: any = {};
  if (ctx?.branchId && !(ctx?.isSystemAdmin === true || ctx?.branchRole === 'SUPER_ADMIN')) {
    where.branchId = ctx.branchId;
  }
  const repairs = await prisma.repair.findMany({ where, include: { technician: true } });
  const byTech: Record<string, number> = {};
  for (const r of repairs) {
    const name = r.technician?.name || 'Unknown';
    byTech[name] = (byTech[name] || 0) + 1;
  }
  return Object.entries(byTech)
    .map(([technician, count]) => ({ technician, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

async function getMonthlyRevenue(branchId?: string, months = 12, companyIdParam?: string | null) {
  try {
    const ctx = getTenantContext();
    const companyId = companyIdParam ?? requireTenantCompanyId();
    const rates = await currencyService.getRatesMap(companyId);
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    const where: any = { companyId, createdAt: { gte: start } };
    const effectiveBranchId =
      ctx?.branchId && !(ctx?.isSystemAdmin === true || ctx?.branchRole === 'SUPER_ADMIN')
        ? ctx.branchId
        : branchId;
    if (effectiveBranchId) where.branchId = effectiveBranchId;

    const cacheEnabled = redisCacheService.enabled();
    const safeMonths = Math.max(1, Math.min(36, Math.floor(Number(months) || 12)));
    const cacheKey = cacheEnabled
      ? `cache:reports:monthly-revenue:v1:company:${companyId}:branch:${effectiveBranchId || 'all'}:months:${safeMonths}`
      : null;
    const cacheTags = [
      `reports:company:${companyId}`,
      ...(effectiveBranchId ? [`reports:company:${companyId}:branch:${effectiveBranchId}`] : []),
    ];
    if (cacheEnabled && cacheKey) {
      const cached = await redisCacheService.getJson<any>(cacheKey);
      if (cached) return cached;
    }
    const sales = (await prisma.invoice.findMany({
      where,
      select: {
        createdAt: true,
        totalAmount: true,
        totalAmountUsd: true,
        currency: true,
        exchangeRateAtTransaction: true
      } as any
    })) as unknown as Array<InvoiceUsdRow & { createdAt: Date }>;
    const dataQuality = emptyDataQuality();
    const byMonth: Record<string, number> = {};
    for (const s of sales) {
      const key = `${s.createdAt.getFullYear()}-${String(s.createdAt.getMonth() + 1).padStart(2, '0')}`;
      try {
        byMonth[key] = (byMonth[key] || 0) + effectiveInvoiceTotalUsd(s, rates);
      } catch (e) {
        if (e instanceof UnreliableFinancialDataError) dataQuality.hasMissingFx = true;
        else throw e;
      }
    }
    const out = {
      months: Object.entries(byMonth).map(([month, revenue]) => ({ month, revenue })),
      dataQuality
    };
    if (cacheEnabled && cacheKey) {
      await redisCacheService.setJson(cacheKey, out, {
        ttlSeconds: redisCacheService.ttls.reports(),
        tags: cacheTags,
      });
    }
    return out;
  } catch (err) {
    logger.error({ err }, '[reportService] getMonthlyRevenue failed — returning empty fallback');
    return { months: [], dataQuality: { hasLegacyCost: false, hasMissingFx: false } };
  }
}

async function getInventoryCategoryDistribution(branchId?: string) {
  const ctx = getTenantContext();
  const effectiveBranchId =
    ctx?.branchId && !(ctx?.isSystemAdmin === true || ctx?.branchRole === 'SUPER_ADMIN')
      ? ctx.branchId
      : branchId;
  const where: any = effectiveBranchId ? { branchId: effectiveBranchId } : {};
  const items = await prisma.inventory.findMany({
    where: { ...where, status: 'available' },
    select: { brand: true, model: true }
  });
  const byBrand: Record<string, number> = {};
  for (const i of items) {
    byBrand[i.brand] = (byBrand[i.brand] || 0) + 1;
  }
  return Object.entries(byBrand).map(([brand, count]) => ({ brand, count }));
}

async function getInventoryAging(branchId?: string) {
  const ctx = getTenantContext();
  const effectiveBranchId =
    ctx?.branchId && !(ctx?.isSystemAdmin === true || ctx?.branchRole === 'SUPER_ADMIN')
      ? ctx.branchId
      : branchId;
  const where: any = effectiveBranchId ? { branchId: effectiveBranchId } : {};
  const items = await prisma.inventory.findMany({
    where: { ...where, status: 'available' },
    select: { id: true, imei: true, brand: true, model: true, createdAt: true, sellingPrice: true }
  });
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  return items.map((i) => ({
    ...i,
    ageDays: Math.floor((now - new Date(i.createdAt).getTime()) / dayMs)
  }));
}

export const reportService = {
  getDashboard,
  getSalesReport,
  getInventoryReport,
  getProfitReport,
  getExpenseReport,
  getBranchComparison,
  getTechniciansReport,
  getInventoryFinancialSummary,
  getInventoryMarketValue,
  getTopSellingModels,
  getTopTechnicians,
  getMonthlyRevenue,
  getInventoryCategoryDistribution,
  getInventoryAging
};
