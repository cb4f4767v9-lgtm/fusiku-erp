/**
 * Canonical ledger / FX pivot for stored monetary amounts and rate tables.
 * Currency rows and `applyUsdBaseRates` use USD as the pivot; API numeric fields
 * are interpreted in this currency for reporting consistency.
 */
export const LEDGER_BASE_CURRENCY = 'USD' as const;
