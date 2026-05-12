import { prisma } from '../utils/prisma';
import type { AiContextSnapshot, TrendPoint } from './aiBusiness.types';

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d = new Date()) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function sumTrend(rows: Array<{ date: string; value: number }>, dayList: string[]): TrendPoint[] {
  const byDate = new Map(rows.map((r) => [r.date, safeNum(r.value)]));
  return dayList.map((date) => ({ date, value: byDate.get(date) ?? 0 }));
}

export const aiContextEngine = {
  async build(params: { companyId: string; branchId?: string | null; days?: number }): Promise<AiContextSnapshot> {
    const companyId = String(params.companyId);
    const branchId = params.branchId ? String(params.branchId).trim() : null;
    const days = Math.max(7, Math.min(90, Number(params.days ?? 30)));

    const now = new Date();
    const dayStart = startOfDay(now);
    const monthStart = startOfMonth(now);
    const trendStart = startOfDay(addDays(now, -(days - 1)));

    const branch =
      branchId != null
        ? await prisma.branch.findFirst({
          where: { id: branchId, companyId },
          select: { id: true, name: true },
        })
        : null;
    const branchName = branch?.name ?? null;

    const saleWhereToday: any = { companyId, createdAt: { gte: dayStart }, status: 'completed' };
    const saleWhereMonth: any = { companyId, createdAt: { gte: monthStart }, status: 'completed' };
    const expWhereMonth: any = { companyId, expenseDate: { gte: monthStart } };
    const invWhereAvail: any = { companyId, status: 'available' };
    if (branchId) {
      saleWhereToday.branchId = branchId;
      saleWhereMonth.branchId = branchId;
      expWhereMonth.branchId = branchId;
      invWhereAvail.branchId = branchId;
    }

    const [salesTodayAgg, salesMonthAgg, expensesMonthAgg, inventoryAvail, branches, currencies, settings] = await Promise.all([
      prisma.sale.aggregate({
        where: saleWhereToday,
        _count: { id: true },
        _sum: { totalAmountUsd: true, profitUsd: true, totalAmount: true, profit: true },
      }),
      prisma.sale.aggregate({
        where: saleWhereMonth,
        _sum: { profitUsd: true, profit: true },
      }),
      prisma.expense.aggregate({
        where: expWhereMonth,
        _sum: { amountUsd: true, amount: true },
      }),
      prisma.inventory.findMany({
        where: invWhereAvail,
        select: { brand: true, model: true, createdAt: true },
      }),
      prisma.branch.findMany({
        where: { companyId, isActive: true },
        select: { id: true, name: true },
      }),
      prisma.currency.findMany({
        where: { companyId },
        select: { code: true, finalRate: true, previousRate: true },
      }),
      (prisma.companySettings as any).findUnique({
        where: { companyId },
        select: { baseCurrency: true, currency: true } as any,
      }) as any,
    ]);

    const baseCurrency = String((settings as any)?.baseCurrency || (settings as any)?.currency || 'USD')
      .trim()
      .toUpperCase();
    const rateByCode = new Map<string, number>((currencies as any[]).map((c) => [String(c.code || '').toUpperCase(), safeNum(c.finalRate)]));
    const baseRate = baseCurrency === 'USD' ? 1 : safeNum(rateByCode.get(baseCurrency));
    const toBase = (usd: number) => (baseRate > 0 ? usd * baseRate : usd);

    const salesTodayUsdTotal = safeNum(salesTodayAgg._sum.totalAmountUsd) || safeNum(salesTodayAgg._sum.totalAmount);
    const salesTodayUsdProfit = safeNum(salesTodayAgg._sum.profitUsd) || safeNum(salesTodayAgg._sum.profit);
    const salesToday = {
      count: Number(salesTodayAgg._count.id || 0),
      total: toBase(salesTodayUsdTotal),
      profit: toBase(salesTodayUsdProfit),
      currency: baseCurrency,
    };

    const profitMonth = {
      currency: baseCurrency,
      amount: toBase(safeNum(salesMonthAgg._sum.profitUsd) || safeNum(salesMonthAgg._sum.profit)),
    };

    const expensesMonth = {
      currency: baseCurrency,
      amount: toBase(safeNum(expensesMonthAgg._sum.amountUsd) || safeNum(expensesMonthAgg._sum.amount)),
    };

    // Data quality awareness
    const [legacyCostCount, missingFxSaleCount, missingFxExpenseCount] = await Promise.all([
      prisma.inventory.count({
        where: { companyId, status: 'available', costUsd: null, ...(branchId ? { branchId } : {}) } as any,
      }),
      prisma.sale.count({
        where: {
          companyId,
          status: 'completed',
          createdAt: { gte: trendStart },
          currency: { not: 'USD' } as any,
          exchangeRateAtTransaction: null,
          ...(branchId ? { branchId } : {}),
        } as any,
      }),
      prisma.expense.count({
        where: {
          companyId,
          expenseDate: { gte: trendStart },
          currency: { not: 'USD' } as any,
          exchangeRateAtTransaction: null,
          ...(branchId ? { branchId } : {}),
        } as any,
      }),
    ]);

    const hasLegacyCost = legacyCostCount > 0;
    const hasMissingFx = missingFxSaleCount + missingFxExpenseCount > 0;
    const dqWarnings: string[] = [];
    if (hasLegacyCost) dqWarnings.push(`Legacy cost: ${legacyCostCount} available inventory items missing costUsd.`);
    if (hasMissingFx)
      dqWarnings.push(`Missing FX: ${missingFxSaleCount + missingFxExpenseCount} non-USD transactions missing exchangeRateAtTransaction.`);

    // Top selling items today (brand+model) from SaleItems
    const saleItemsToday = await prisma.saleItem.findMany({
      where: {
        sale: {
          companyId,
          createdAt: { gte: dayStart },
          status: 'completed',
          ...(branchId ? { branchId } : {}),
        },
      } as any,
      select: { inventory: { select: { brand: true, model: true } } },
      take: 2000,
    });
    const soldByModel = new Map<string, { brand: string; model: string; count: number }>();
    for (const si of saleItemsToday) {
      const brand = String(si.inventory?.brand || '').trim();
      const model = String(si.inventory?.model || '').trim();
      if (!brand || !model) continue;
      const key = `${brand}||${model}`;
      const cur = soldByModel.get(key) || { brand, model, count: 0 };
      cur.count += 1;
      soldByModel.set(key, cur);
    }
    const topSellingItems = [...soldByModel.values()].sort((a, b) => b.count - a.count).slice(0, 5);

    // Low stock models (<=2 units available)
    const availByModel = new Map<string, { brand: string; model: string; count: number }>();
    for (const it of inventoryAvail) {
      const brand = String(it.brand || '').trim();
      const model = String(it.model || '').trim();
      if (!brand || !model) continue;
      const key = `${brand}||${model}`;
      const cur = availByModel.get(key) || { brand, model, count: 0 };
      cur.count += 1;
      availByModel.set(key, cur);
    }
    const lowStockModels = [...availByModel.values()]
      .filter((x) => x.count <= 2)
      .sort((a, b) => a.count - b.count)
      .slice(0, 8);

    // Branch performance today
    const branchAgg = await prisma.sale.groupBy({
      by: ['branchId'],
      where: { companyId, createdAt: { gte: dayStart }, status: 'completed' } as any,
      _count: { id: true },
      _sum: { totalAmountUsd: true, profitUsd: true, totalAmount: true, profit: true },
    });
    const branchNameById = new Map(branches.map((b) => [b.id, b.name]));
    const branchStats = branchAgg
      .map((b) => ({
        branchId: b.branchId,
        branchName: branchNameById.get(b.branchId) || b.branchId,
        salesCount: Number(b._count.id || 0),
        salesTotal: toBase(safeNum(b._sum.totalAmountUsd) || safeNum(b._sum.totalAmount)),
        profit: toBase(safeNum(b._sum.profitUsd) || safeNum(b._sum.profit)),
        currency: baseCurrency,
      }))
      .sort((a, b) => b.salesTotal - a.salesTotal)
      .slice(0, 10);
    const weakestToday = (() => {
      const rows = [...branchStats].sort((a, b) => a.profit - b.profit);
      return rows.length ? rows[0] : null;
    })();

    // Month-to-date branch comparison (net profit = profit - expenses)
    const [salesMonthByBranch, expMonthByBranch] = await Promise.all([
      prisma.sale.groupBy({
        by: ['branchId'],
        where: { companyId, createdAt: { gte: monthStart }, status: 'completed' } as any,
        _sum: { totalAmountUsd: true, profitUsd: true, totalAmount: true, profit: true },
      }),
      prisma.expense.groupBy({
        by: ['branchId'],
        where: { companyId, expenseDate: { gte: monthStart } } as any,
        _sum: { amountUsd: true, amount: true },
      }),
    ]);
    const revenueByBranch = new Map<string, number>();
    const profitByBranch = new Map<string, number>();
    for (const s of salesMonthByBranch as any[]) {
      const bid = String(s.branchId || '');
      if (!bid) continue;
      revenueByBranch.set(bid, toBase(safeNum(s._sum.totalAmountUsd) || safeNum(s._sum.totalAmount)));
      profitByBranch.set(bid, toBase(safeNum(s._sum.profitUsd) || safeNum(s._sum.profit)));
    }
    const expenseByBranch = new Map<string, number>();
    for (const e of expMonthByBranch as any[]) {
      const bid = String(e.branchId || '');
      if (!bid) continue;
      expenseByBranch.set(bid, toBase(safeNum(e._sum.amountUsd) || safeNum(e._sum.amount)));
    }
    const monthRows = branches.map((b) => {
      const revenue = revenueByBranch.get(b.id) ?? 0;
      const profit = profitByBranch.get(b.id) ?? 0;
      const expenses = expenseByBranch.get(b.id) ?? 0;
      return {
        branchId: b.id,
        branchName: b.name || b.id,
        revenue,
        expenses,
        netProfit: profit - expenses,
        currency: baseCurrency,
      };
    });
    const weakestMonth = (() => {
      const rows = [...monthRows].sort((a, b) => a.netProfit - b.netProfit);
      return rows.length
        ? {
          branchId: rows[0].branchId,
          branchName: rows[0].branchName,
          netProfit: rows[0].netProfit,
          revenue: rows[0].revenue,
          expenses: rows[0].expenses,
          currency: baseCurrency,
        }
        : null;
    })();

    // Currency movers
    const movers = currencies
      .map((c) => {
        const code = String((c as any).code || '').toUpperCase();
        const currentRate = safeNum((c as any).finalRate);
        const lastRate = (c as any).previousRate != null ? safeNum((c as any).previousRate) : null;
        const changePct = lastRate && lastRate > 0 ? ((currentRate - lastRate) / lastRate) * 100 : null;
        return { code, currentRate, lastRate, changePct };
      })
      .filter((m) => m.code && m.currentRate > 0)
      .sort((a, b) => Math.abs(b.changePct || 0) - Math.abs(a.changePct || 0))
      .slice(0, 6);

    // Trends (simple daily buckets)
    const dayList: string[] = [];
    for (let i = 0; i < days; i++) dayList.push(toIsoDate(addDays(trendStart, i)));

    const [salesTrendRows, profitTrendRows, expenseTrendRows] = await Promise.all([
      prisma.sale
        .findMany({
          where: {
            companyId,
            status: 'completed',
            createdAt: { gte: trendStart },
            ...(branchId ? { branchId } : {}),
          } as any,
          select: { createdAt: true, totalAmountUsd: true, totalAmount: true },
          take: 100000,
        })
        .then((rows) => {
          const acc = new Map<string, number>();
          for (const r of rows) {
            const key = toIsoDate(new Date(r.createdAt));
            const v = safeNum((r as any).totalAmountUsd) || safeNum((r as any).totalAmount);
            acc.set(key, (acc.get(key) || 0) + toBase(v));
          }
          return [...acc.entries()].map(([date, value]) => ({ date, value }));
        }),
      prisma.sale
        .findMany({
          where: {
            companyId,
            status: 'completed',
            createdAt: { gte: trendStart },
            ...(branchId ? { branchId } : {}),
          } as any,
          select: { createdAt: true, profitUsd: true, profit: true },
          take: 100000,
        })
        .then((rows) => {
          const acc = new Map<string, number>();
          for (const r of rows) {
            const key = toIsoDate(new Date(r.createdAt));
            const v = safeNum((r as any).profitUsd) || safeNum((r as any).profit);
            acc.set(key, (acc.get(key) || 0) + toBase(v));
          }
          return [...acc.entries()].map(([date, value]) => ({ date, value }));
        }),
      prisma.expense
        .findMany({
          where: {
            companyId,
            expenseDate: { gte: trendStart },
            ...(branchId ? { branchId } : {}),
          } as any,
          select: { expenseDate: true, amountUsd: true, amount: true },
          take: 100000,
        })
        .then((rows) => {
          const acc = new Map<string, number>();
          for (const r of rows) {
            const key = toIsoDate(new Date((r as any).expenseDate));
            const v = safeNum((r as any).amountUsd) || safeNum((r as any).amount);
            acc.set(key, (acc.get(key) || 0) + toBase(v));
          }
          return [...acc.entries()].map(([date, value]) => ({ date, value }));
        }),
    ]);

    // Inventory available "trend": approximate by counting items created on a day and still available now.
    const inventoryAvailByDay = new Map<string, number>();
    for (const inv of inventoryAvail) {
      const k = toIsoDate(new Date((inv as any).createdAt));
      if (k < dayList[0]) continue;
      inventoryAvailByDay.set(k, (inventoryAvailByDay.get(k) || 0) + 1);
    }
    let running = 0;
    const invTrendRows = dayList.map((date) => {
      running += inventoryAvailByDay.get(date) || 0;
      return { date, value: running };
    });

    const context: AiContextSnapshot = {
      generatedAt: now.toISOString(),
      scope: { companyId, branchId, branchName },
      dataQuality: {
        hasLegacyCost,
        hasMissingFx,
        warnings: dqWarnings,
      },
      salesToday,
      profitMonth,
      expensesMonth,
      inventorySummary: {
        availableCount: inventoryAvail.length,
        lowStockModels,
      },
      topSellingItems,
      trends: {
        salesDaily: sumTrend(salesTrendRows, dayList),
        profitDaily: sumTrend(profitTrendRows, dayList),
        expensesDaily: sumTrend(expenseTrendRows, dayList),
        inventoryAvailableDaily: invTrendRows,
      },
      branchStats,
      branchComparison: {
        weakestToday: weakestToday
          ? {
            branchId: weakestToday.branchId,
            branchName: weakestToday.branchName,
            profit: weakestToday.profit,
            salesTotal: weakestToday.salesTotal,
            currency: weakestToday.currency,
          }
          : null,
        weakestMonth,
        month: monthRows,
      },
      currencyImpact: { baseCurrency, movers },
    };

    return context;
  },
};

