/**
 * Prisma alignment (documentation only — no migration in this change).
 *
 * Existing models that already support parts of this roadmap:
 * - `Currency` — company-scoped codes, baseRate, marginPercent, finalRate, isAuto, manualRate.
 * - `ExchangeRate` — historical windows via effectiveFrom / effectiveTo.
 *
 * Future tables (when product is ready) may include, for example:
 * - CustomerLedgerEntry / CustomerCashBalance (per currency) / GoldHolding
 *
 * Import types from this folder in services; do not reference non-existent Prisma delegates until migrated.
 */
export const FINANCE_MODULE_PLACEHOLDER = true;
