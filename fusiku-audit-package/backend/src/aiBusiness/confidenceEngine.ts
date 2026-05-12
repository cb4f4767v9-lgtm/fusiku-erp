import type { AiContextSnapshot } from './aiBusiness.types';

function clamp01(x: number) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function mean(xs: number[]) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stddev(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, x) => a + (x - m) * (x - m), 0) / (xs.length - 1);
  return Math.sqrt(Math.max(0, v));
}

function trendStabilityScore(series: number[]) {
  // Lower coefficient of variation => more stable => higher score.
  const xs = series.filter((x) => Number.isFinite(x));
  const m = mean(xs);
  if (m <= 0) return 0.35;
  const cv = stddev(xs) / Math.max(1e-6, m);
  // cv 0..1.5 -> map to score 0.9..0.3
  const score = 0.9 - Math.min(1.5, cv) * (0.6 / 1.5);
  return clamp01(score);
}

export type ConfidenceBreakdown = {
  overall: number;
  completeness: number;
  transactionVolume: number;
  trendStability: number;
  warnings: string[];
};

export const confidenceEngine = {
  compute(ctx: AiContextSnapshot): ConfidenceBreakdown {
    const warnings: string[] = [];
    if (ctx.dataQuality.hasLegacyCost) warnings.push('Legacy cost detected (some items missing costUsd).');
    if (ctx.dataQuality.hasMissingFx) warnings.push('Missing FX data detected (some non-USD rows missing exchangeRateAtTransaction).');

    const completeness = clamp01(
      1 -
        (ctx.dataQuality.hasLegacyCost ? 0.18 : 0) -
        (ctx.dataQuality.hasMissingFx ? 0.22 : 0)
    );

    // Transaction volume: use salesToday.count + last 30 days activity proxy from trends.
    const last30Sales = ctx.trends.salesDaily.slice(-30).map((p) => p.value);
    const activeDays = last30Sales.filter((x) => x > 0).length;
    const volumeScore =
      clamp01(
        0.25 +
          Math.min(0.55, activeDays / 30) * 0.55 +
          Math.min(0.2, ctx.salesToday.count / 50) * 0.2
      );

    const stabilitySales = trendStabilityScore(last30Sales);
    const stabilityProfit = trendStabilityScore(ctx.trends.profitDaily.slice(-30).map((p) => p.value));
    const trendStability = clamp01(0.5 * stabilitySales + 0.5 * stabilityProfit);

    // Weighted: completeness 40%, volume 30%, stability 30%
    const overall = clamp01(0.4 * completeness + 0.3 * volumeScore + 0.3 * trendStability);

    return {
      overall,
      completeness,
      transactionVolume: volumeScore,
      trendStability,
      warnings,
    };
  },
};

