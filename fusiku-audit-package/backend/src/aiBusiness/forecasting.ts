import type { AiContextSnapshot, Forecast } from './aiBusiness.types';

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

function movingAvg(xs: number[], k: number) {
  const tail = xs.slice(Math.max(0, xs.length - k));
  if (!tail.length) return 0;
  return sum(tail) / tail.length;
}

function growthRate(xs: number[], shortK: number, longK: number) {
  const short = movingAvg(xs, shortK);
  const long = movingAvg(xs, longK);
  if (long <= 0) return 0;
  return (short - long) / long; // e.g. 0.12 = +12%
}

export const forecastingEngine = {
  forecastNextMonth(ctx: AiContextSnapshot): Forecast {
    const currency = ctx.salesToday.currency || ctx.currencyImpact.baseCurrency || 'USD';

    const salesDaily = ctx.trends.salesDaily.map((p) => p.value);
    const profitDaily = ctx.trends.profitDaily.map((p) => p.value);

    // Improved forecasting: blend moving averages + growth trend.
    const last30Sales = salesDaily.slice(-30);
    const last30Profit = profitDaily.slice(-30);

    const ma7Sales = movingAvg(last30Sales, 7);
    const ma30Sales = movingAvg(last30Sales, 30);
    const salesGrowth = growthRate(last30Sales, 7, 30); // short vs long

    const ma7Profit = movingAvg(last30Profit, 7);
    const ma30Profit = movingAvg(last30Profit, 30);
    const profitGrowth = growthRate(last30Profit, 7, 30);

    // Daily baseline = weighted MA (more weight to recent).
    const baseDailySales = 0.65 * ma7Sales + 0.35 * ma30Sales;
    const baseDailyProfit = 0.65 * ma7Profit + 0.35 * ma30Profit;

    // Apply moderated growth (cap ±25%) to avoid wild swings.
    const gSales = Math.max(-0.25, Math.min(0.25, salesGrowth));
    const gProfit = Math.max(-0.25, Math.min(0.25, profitGrowth));

    const nextMonthSales = Math.max(0, 30 * baseDailySales * (1 + gSales * 0.75));
    const expectedProfit = Math.max(0, 30 * baseDailyProfit * (1 + gProfit * 0.75));

    // Required stock: translate top sellers into suggested units (rule-of-thumb).
    const requiredStock = ctx.topSellingItems.slice(0, 5).map((x) => {
      const suggestedUnits = Math.max(2, Math.round(x.count * 4)); // e.g. 1-day top sellers * 4 weeks
      return {
        brand: x.brand,
        model: x.model,
        suggestedUnits,
        reason: 'Based on today top-selling velocity (rule-of-thumb: ~4 weeks coverage).',
      };
    });

    // Confidence heuristic: more trend history -> higher confidence.
    const historyDays = ctx.trends.salesDaily.length;
    const confidence = Math.max(0.25, Math.min(0.85, historyDays >= 60 ? 0.78 : historyDays >= 30 ? 0.7 : historyDays >= 14 ? 0.55 : 0.4));

    return {
      horizon: 'next_month',
      currency,
      nextMonthSales,
      expectedProfit,
      requiredStock,
      confidence,
    };
  },
};

