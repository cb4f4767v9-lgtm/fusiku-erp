/**
 * Multi-currency trading (forex desk) — complements existing Prisma `Currency` (pivot + margin + manual).
 * Buy/sell spread and pair notation are future columns or derived fields; not persisted here.
 */
export type IsoCurrencyCode = string;

/** e.g. "USD/PKR", "CNY/PKR" — base/quote convention: value is units of quote per 1 base */
export type CurrencyPairCode = `${IsoCurrencyCode}/${IsoCurrencyCode}`;

export type RateSource = 'live' | 'manual' | 'blended';

export interface TradingQuote {
  companyId: string;
  currencyCode: IsoCurrencyCode;
  /** Pivot rate (e.g. per USD) — aligns with existing `Currency.baseRate` / `finalRate` concept */
  midRate: number;
  /** Desk buy side (units of quote per 1 base, same convention as mid until persisted) */
  buyRate?: number;
  /** Desk sell side */
  sellRate?: number;
  /** Absolute spread in same numeric units as rates (sellRate − buyRate when both set) */
  spread?: number;
  marginPercent: number;
  isAuto: boolean;
  manualOverride?: number | null;
  source: RateSource;
  asOf: string;
}

/**
 * Explicit buy / sell / spread alongside mid — structure for trading UI; optional on API until DB columns exist.
 * Populate via {@link forexSidesFromMid} from existing `finalRate` without changing stored behaviour.
 */
export interface ForexMarketSides {
  midRate: number;
  buyRate: number;
  sellRate: number;
  spread: number;
}

/** Snapshot row for historical rate tables (future Prisma or `ExchangeRate` extension) */
export interface RateHistoryPoint {
  currencyCode: IsoCurrencyCode;
  effectiveFrom: string;
  effectiveTo?: string | null;
  rate: number;
  source: RateSource;
}
