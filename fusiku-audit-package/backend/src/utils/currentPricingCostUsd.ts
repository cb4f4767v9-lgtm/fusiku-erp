import { amountToUsdStrict, normalizeCurrencyCode, roundUsd } from './financialUsd';

/**
 * CURRENT pricing policy: mark-to-market COGS in USD using optional `marketPrice` (units of local per 1 USD),
 * else latest desk `rates`, else re-convert `purchaseLocal` with desk rates, else fall back to stored ledger USD.
 * Does not apply FIFO/LIFO ordering — caller supplies row inputs only.
 */
export function currentPricingInventoryCostUsd(args: {
  purchaseLocal: number;
  purchaseCurrency: string | null | undefined;
  originalLocal: number | null | undefined;
  originalCurrency: string | null | undefined;
  storedCostUsd: number | null | undefined;
  rates: Record<string, number>;
  marketUnitsPerUsd: number | null | undefined;
}): number {
  const ccy = normalizeCurrencyCode(args.originalCurrency ?? args.purchaseCurrency ?? 'USD');
  const amt =
    args.originalLocal != null && Number.isFinite(Number(args.originalLocal))
      ? Number(args.originalLocal)
      : Number(args.purchaseLocal);
  const merged = { ...args.rates };
  const mp = args.marketUnitsPerUsd;
  if (ccy !== 'USD' && mp != null && Number(mp) > 0) merged[ccy] = Number(mp);

  try {
    return amountToUsdStrict(amt, ccy, merged);
  } catch {
    try {
      return amountToUsdStrict(Number(args.purchaseLocal), args.purchaseCurrency ?? ccy, args.rates);
    } catch {
      if (args.storedCostUsd != null && Number.isFinite(Number(args.storedCostUsd))) {
        return roundUsd(Number(args.storedCostUsd));
      }
      return roundUsd(Number(args.purchaseLocal));
    }
  }
}
