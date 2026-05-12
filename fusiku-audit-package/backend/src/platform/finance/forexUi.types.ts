/**
 * Forex-style pair rows for future UI (no chart data yet — structure only).
 */
import type { CurrencyPairCode, IsoCurrencyCode } from './currencyTrading.types';

export type TrendPlaceholder = {
  /** Future: time series ids or bucket keys for sparkline/chart */
  seriesKey?: string;
};

/** One row in a “rates board” (USD/PKR, CNY/PKR, …) */
export interface CurrencyPairDisplayRow {
  pair: CurrencyPairCode;
  base: IsoCurrencyCode;
  quote: IsoCurrencyCode;
  bid?: number;
  ask?: number;
  mid?: number;
  changePct24h?: number | null;
  updatedAt: string;
  trend?: TrendPlaceholder;
}

/** Ledger-style forex table: one row per ISO code (matches Currency page columns). */
export interface ForexLedgerTableRow {
  currency: IsoCurrencyCode;
  buy: number;
  sell: number;
  spread: number;
  /** Same pivot as `Currency.finalRate` when wired */
  mid?: number;
}
