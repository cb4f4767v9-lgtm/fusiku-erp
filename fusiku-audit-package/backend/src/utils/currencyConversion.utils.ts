import { LEDGER_BASE_CURRENCY } from '../constants/ledgerCurrency';

/**
 * Rates map: units of `code` per 1 USD (same convention as `Currency.finalRate` in this codebase).
 */
export type RatesPerUsd = Record<string, number>;

function safeRate(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * Convert `amount` expressed in `fromCurrency` into `toCurrency` using USD as pivot.
 */
export function convertAmountBetweenCurrencies(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  ratesPerUsd: RatesPerUsd
): number {
  const a = Number(amount);
  if (!Number.isFinite(a)) return 0;
  const from = String(fromCurrency || '').trim().toUpperCase() || LEDGER_BASE_CURRENCY;
  const to = String(toCurrency || '').trim().toUpperCase() || LEDGER_BASE_CURRENCY;
  if (from === to) return a;

  const rFrom = from === LEDGER_BASE_CURRENCY ? 1 : safeRate(ratesPerUsd[from]);
  const rTo = to === LEDGER_BASE_CURRENCY ? 1 : safeRate(ratesPerUsd[to]);
  if (from !== LEDGER_BASE_CURRENCY && !rFrom) return a;
  if (to !== LEDGER_BASE_CURRENCY && !rTo) return a;

  const amountUsd = from === LEDGER_BASE_CURRENCY ? a : a / rFrom;
  return to === LEDGER_BASE_CURRENCY ? amountUsd : amountUsd * rTo;
}

export type MonetarySnapshot = {
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  convertedCurrency: string;
  rateFromTo: number;
};

/**
 * Snapshot helper for APIs / audit: returns parallel original + converted figures.
 * `rateFromTo` is the multiplier such that `convertedAmount ≈ originalAmount * rateFromTo` (within float error).
 */
export function snapshotConversion(
  originalAmount: number,
  originalCurrency: string,
  targetCurrency: string,
  ratesPerUsd: RatesPerUsd
): MonetarySnapshot {
  const converted = convertAmountBetweenCurrencies(
    originalAmount,
    originalCurrency,
    targetCurrency,
    ratesPerUsd
  );
  const orig = Number(originalAmount);
  const rateFromTo = Number.isFinite(orig) && orig !== 0 ? converted / orig : 0;
  return {
    originalAmount: orig,
    originalCurrency: String(originalCurrency || '').toUpperCase() || LEDGER_BASE_CURRENCY,
    convertedAmount: converted,
    convertedCurrency: String(targetCurrency || '').toUpperCase() || LEDGER_BASE_CURRENCY,
    rateFromTo,
  };
}
