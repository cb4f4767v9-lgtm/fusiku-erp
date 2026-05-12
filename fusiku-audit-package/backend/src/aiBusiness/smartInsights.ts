import type { AiContextSnapshot, SmartInsight } from './aiBusiness.types';

function pct(n: number, d: number) {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return 0;
  return (n / d) * 100;
}

function last<T>(arr: T[]) {
  return arr.length ? arr[arr.length - 1] : undefined;
}

function avgLast(arr: number[], k: number) {
  const xs = arr.slice(Math.max(0, arr.length - k));
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export const smartInsightsEngine = {
  generate(ctx: AiContextSnapshot): SmartInsight[] {
    const out: SmartInsight[] = [];
    const currency = ctx.salesToday.currency || ctx.currencyImpact.baseCurrency || 'USD';

    // Low profit warning (today margin and last 7 days margin trend)
    const todayMarginPct = pct(ctx.salesToday.profit, ctx.salesToday.total);
    const salesDaily = ctx.trends.salesDaily.map((p) => p.value);
    const profitDaily = ctx.trends.profitDaily.map((p) => p.value);
    const last7Sales = avgLast(salesDaily, 7);
    const last7Profit = avgLast(profitDaily, 7);
    const last7Margin = pct(last7Profit, last7Sales);

    if (ctx.salesToday.total > 0 && todayMarginPct < 8) {
      const rec = todayMarginPct < 3
        ? 'Increase selling prices by 5% OR renegotiate supplier costs; also review discounts applied today.'
        : 'Increase price by 2–3% OR reduce supplier costs on low-margin models; review discounting rules.';
      out.push({
        code: 'low_profit_warning',
        severity: todayMarginPct < 3 ? 'warning' : 'info',
        title: 'Low profit warning',
        problem:
          `Today’s profit margin is ${todayMarginPct.toFixed(1)}% (${currency} ${ctx.salesToday.profit.toFixed(0)} profit on ` +
          `${currency} ${ctx.salesToday.total.toFixed(0)} sales). 7-day average margin is ${last7Margin.toFixed(1)}%.`,
        recommendation: rec,
        actions: [
          { label: 'Increase price +5%', type: 'adjust_price_pct', value: 5 },
          { label: 'Reduce supplier cost', type: 'reduce_cost' },
        ],
        message: `Problem: ${todayMarginPct.toFixed(1)}% margin today. Recommendation: ${rec}`,
        data: { todayMarginPct, last7MarginPct: last7Margin },
      });
    }

    // High expense alert (MTD expense vs MTD profit)
    if (ctx.expensesMonth.amount > 0 && ctx.profitMonth.amount > 0) {
      const ratio = ctx.expensesMonth.amount / Math.max(1, ctx.profitMonth.amount);
      if (ratio >= 0.9) {
        const rec = 'Review top expense categories; reduce discretionary spend OR improve margin on best-sellers to restore expense coverage.';
        out.push({
          code: 'high_expense_alert',
          severity: ratio > 1.2 ? 'warning' : 'info',
          title: 'High expense alert',
          problem:
            `Month-to-date expenses are ${currency} ${ctx.expensesMonth.amount.toFixed(0)} vs profit ${currency} ${ctx.profitMonth.amount.toFixed(0)} ` +
            `(${(ratio * 100).toFixed(0)}% of profit).`,
          recommendation: rec,
          actions: [{ label: 'Review expenses', type: 'review_expenses' }],
          message: `Problem: expenses are ${(ratio * 100).toFixed(0)}% of profit. Recommendation: ${rec}`,
          data: { expenseToProfitRatio: ratio },
        });
      }
    } else if (ctx.expensesMonth.amount > 0 && ctx.profitMonth.amount <= 0) {
      const rec = 'Freeze non-essential expenses immediately and prioritize higher-margin sales; review pricing method and cost capture (especially legacy cost).';
      out.push({
        code: 'high_expense_alert',
        severity: 'warning',
        title: 'High expense alert',
        problem:
          `Month-to-date expenses are ${currency} ${ctx.expensesMonth.amount.toFixed(0)} while profit is ${currency} ${ctx.profitMonth.amount.toFixed(0)} (loss).`,
        recommendation: rec,
        actions: [{ label: 'Review expenses', type: 'review_expenses' }],
        message: `Problem: MTD loss. Recommendation: ${rec}`,
      });
    }

    // Slow moving inventory (proxy: older available stock + flat/declining sales trend)
    const invAvailTrend = ctx.trends.inventoryAvailableDaily.map((p) => p.value);
    const invNow = last(invAvailTrend) ?? ctx.inventorySummary.availableCount;
    const inv7 = invAvailTrend.length >= 7 ? invAvailTrend[invAvailTrend.length - 7] : invNow;
    const invGrowth = invNow - inv7;
    const last7SalesTotal = salesDaily.slice(Math.max(0, salesDaily.length - 7)).reduce((a, b) => a + b, 0);

    if (invNow >= 20 && invGrowth > 0 && last7SalesTotal <= avgLast(salesDaily, 14) * 7 * 0.9) {
      const rec = 'Discount slow movers by 3–7% OR transfer stock to stronger branches; prioritize buying only fast-selling models this week.';
      out.push({
        code: 'slow_moving_inventory',
        severity: 'info',
        title: 'Slow-moving inventory',
        problem:
          `Available inventory increased by ${invGrowth} units over the last 7 days while sales are flat/declining.`,
        recommendation: rec,
        actions: [
          { label: 'Discount 5%', type: 'discount_pct', value: 5 },
          { label: 'Transfer stock', type: 'transfer_stock' },
        ],
        message: `Problem: inventory rising with flat sales. Recommendation: ${rec}`,
        data: { inventoryGrowth7d: invGrowth, inventoryNow: invNow, last7SalesTotal },
      });
    }

    // Best selling products
    if (ctx.topSellingItems.length) {
      const rec = 'Increase procurement for these models and keep price discipline; avoid discounting top sellers unless inventory is high.';
      out.push({
        code: 'best_selling_products',
        severity: 'success',
        title: 'Best-selling products',
        problem: `Top sellers today: ${ctx.topSellingItems.map((x) => `${x.brand} ${x.model} (${x.count})`).join(', ')}.`,
        recommendation: rec,
        actions: [{ label: 'Increase price +2%', type: 'adjust_price_pct', value: 2 }],
        message: `Problem: top-selling concentration. Recommendation: ${rec}`,
        data: { topSellingItems: ctx.topSellingItems },
      });
    }

    return out;
  },
};

