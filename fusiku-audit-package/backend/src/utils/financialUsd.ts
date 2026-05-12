import { LEDGER_BASE_CURRENCY } from '../constants/ledgerCurrency';
import { REQUIRED_CURRENCY_CODES } from '../services/currency.service';
import { roundMoney } from './money';

/** Shapes used for USD normalization (align with Prisma once client is regenerated). */
export type SaleUsdRow = {
  totalAmount: number;
  totalAmountUsd?: number | null;
  profit: number;
  profitUsd?: number | null;
  currency?: string | null;
  exchangeRateAtTransaction?: number | null;
};

export type ExpenseUsdRow = {
  amount: number;
  amountUsd?: number | null;
  currency?: string | null;
  exchangeRateAtTransaction?: number | null;
};

export type ExpenseBranchUsdRow = ExpenseUsdRow & { branchId: string | null };

export type PurchaseUsdRow = {
  totalAmount: number;
  totalAmountUsd?: number | null;
  cargoCost: number;
  cargoCostUsd?: number | null;
  currency?: string | null;
  exchangeRateAtTransaction?: number | null;
};

const SUPPORTED = new Set<string>(REQUIRED_CURRENCY_CODES);

/** ISO-like code; empty → USD (backward compatible). */
export function normalizeCurrencyCode(c?: string | null): string {
  const s = String(c ?? '').trim().toUpperCase();
  return s || LEDGER_BASE_CURRENCY;
}

/** Ledger USD amounts: 2 decimal places. */
export function roundUsd(n: number): number {
  return roundMoney(Number(n), 2);
}

/** Reject unsupported codes (after normalize). USD always allowed. */
export function assertSupportedCurrencyCode(code: string): void {
  const c = normalizeCurrencyCode(code);
  if (c === LEDGER_BASE_CURRENCY) return;
  if (!SUPPORTED.has(c)) {
    throw new Error(`Unsupported currency code: ${c}. Allowed: ${[...REQUIRED_CURRENCY_CODES].join(', ')}.`);
  }
}

/** Normalize + validate for new transactions (POST bodies). */
export function normalizeAndValidateCurrencyForLedger(raw?: string | null): string {
  const c = normalizeCurrencyCode(raw);
  assertSupportedCurrencyCode(c);
  return c;
}

/**
 * `rates[code]` = units of that currency per 1 USD (Currency.finalRate).
 * USD → 1. Throws if non-USD and rate is missing or non-positive.
 */
export function resolveTransactionFxRate(currency: string | null | undefined, rates: Record<string, number>): number {
  const code = normalizeCurrencyCode(currency);
  assertSupportedCurrencyCode(code);
  if (code === LEDGER_BASE_CURRENCY) return 1;
  const r = rates[code];
  if (r === undefined || r === null || !Number.isFinite(Number(r)) || Number(r) <= 0) {
    throw new Error(
      `FX rate missing or invalid for ${code}. Configure company currency rates before posting in this currency.`
    );
  }
  return Number(r);
}

/**
 * Convert using **current** company rates. Strict: throws when non-USD and rate invalid.
 * Result is rounded to 2 decimals USD.
 */
export function amountToUsdStrict(amount: number, currency: string | null | undefined, rates: Record<string, number>): number {
  const a = Number(amount);
  if (!Number.isFinite(a)) return 0;
  const fx = resolveTransactionFxRate(currency, rates);
  return roundUsd(roundMoney(a / fx, 8));
}

/**
 * Convert using a **stored** transaction rate (audit replay). Same convention as `resolveTransactionFxRate` output.
 */
export function amountToUsdWithStoredRate(
  amount: number,
  currency: string | null | undefined,
  exchangeRateAtTransaction: number | null | undefined
): number {
  const a = Number(amount);
  if (!Number.isFinite(a)) return 0;
  const code = normalizeCurrencyCode(currency);
  if (code === LEDGER_BASE_CURRENCY) return roundUsd(a);
  const fx = Number(exchangeRateAtTransaction);
  if (!Number.isFinite(fx) || fx <= 0) {
    throw new Error('Stored exchangeRateAtTransaction is missing or invalid for non-USD row.');
  }
  return roundUsd(a / fx);
}

/** Shown on report rows when cost basis is not fully auditable (missing `costUsd` and/or explicit legacy flag). */
export const LEGACY_COST_WARNING = '⚠ legacy cost used' as const;

export type InventoryLedgerCostResult = {
  /** USD amount used for COGS math (stored `costUsd` when present, else numeric fallback from `purchasePrice`). */
  value: number;
  /** True when `costUsd` is absent or `isLegacyCost` is set on the inventory row. */
  isLegacy: boolean;
};

/**
 * Ledger COGS basis in USD. When `costUsd` is missing, `value` falls back to `purchasePrice` but `isLegacy` is true
 * — callers must surface {@link LEGACY_COST_WARNING} in reports (do not treat silently as USD).
 */
export function inventoryLedgerCostUsd(inv: {
  costUsd?: number | null;
  purchasePrice: number;
  isLegacyCost?: boolean | null;
}): InventoryLedgerCostResult {
  const c = inv.costUsd;
  if (c != null && Number.isFinite(Number(c))) {
    return { value: roundUsd(Number(c)), isLegacy: Boolean(inv.isLegacyCost) };
  }
  return { value: roundUsd(Number(inv.purchasePrice)), isLegacy: true };
}

export function inventoryLegacyCostDisplayNote(inv: {
  costUsd?: number | null;
  purchasePrice: number;
  isLegacyCost?: boolean | null;
}): string | null {
  return inventoryLedgerCostUsd(inv).isLegacy ? LEGACY_COST_WARNING : null;
}

function ensureKnownCurrencyForRead(code: string): void {
  if (code === LEDGER_BASE_CURRENCY) return;
  if (!SUPPORTED.has(code)) {
    throw new Error(`Unsupported currency code in record: ${code}`);
  }
}

/** Thrown when a row cannot be converted to USD without guessing (reports must not silently use current FX). */
export class UnreliableFinancialDataError extends Error {
  readonly code = 'UNRELIABLE_FINANCIAL_DATA' as const;
  constructor(message: string) {
    super(message);
    this.name = 'UnreliableFinancialDataError';
  }
}

/**
 * Convert locked USD ledger amount to transaction currency using **units of that currency per 1 USD**
 * (same convention as `resolveTransactionFxRate`).
 */
export function usdToTransactionCurrencyStrict(
  usdAmount: number,
  transactionCurrency: string | null | undefined,
  unitsPerUsd: number
): number {
  const code = normalizeCurrencyCode(transactionCurrency);
  const u = roundUsd(Number(usdAmount));
  if (!Number.isFinite(u)) return 0;
  if (code === LEDGER_BASE_CURRENCY) return u;
  const r = Number(unitsPerUsd);
  if (!Number.isFinite(r) || r <= 0) {
    throw new Error('Invalid FX rate for USD→transaction currency conversion.');
  }
  return roundMoney(u * r, 6);
}

/** Reports / P&L: stored USD → stored rate → USD native only. No current-rate fallback. */
export function effectiveSaleTotalUsd(row: SaleUsdRow, _rates: Record<string, number>): number {
  const stored = row.totalAmountUsd;
  if (stored != null && Number.isFinite(Number(stored))) return roundUsd(Number(stored));
  const code = normalizeCurrencyCode(row.currency);
  if (code === LEDGER_BASE_CURRENCY) return roundUsd(Number(row.totalAmount));
  const tx = row.exchangeRateAtTransaction;
  if (tx != null && Number.isFinite(Number(tx)) && Number(tx) > 0) {
    return amountToUsdWithStoredRate(Number(row.totalAmount), row.currency, tx);
  }
  throw new UnreliableFinancialDataError(
    `Sale is missing auditable USD normalization (totalAmountUsd or exchangeRateAtTransaction) for currency ${code}.`
  );
}

/** Dashboard / legacy: same as `effectiveSaleTotalUsd` but falls back to current company rates when needed. */
export function effectiveSaleTotalUsdLegacy(row: SaleUsdRow, rates: Record<string, number>): number {
  const stored = row.totalAmountUsd;
  if (stored != null && Number.isFinite(Number(stored))) return roundUsd(Number(stored));
  const tx = row.exchangeRateAtTransaction;
  if (tx != null && Number.isFinite(Number(tx)) && Number(tx) > 0) {
    return amountToUsdWithStoredRate(Number(row.totalAmount), row.currency, tx);
  }
  const code = normalizeCurrencyCode(row.currency);
  ensureKnownCurrencyForRead(code);
  return amountToUsdStrict(Number(row.totalAmount), row.currency, rates);
}

export function effectiveSaleProfitUsd(row: SaleUsdRow, _rates: Record<string, number>): number {
  const stored = row.profitUsd;
  if (stored != null && Number.isFinite(Number(stored))) return roundUsd(Number(stored));
  const code = normalizeCurrencyCode(row.currency);
  if (code === LEDGER_BASE_CURRENCY) return roundUsd(Number(row.profit));
  const tx = row.exchangeRateAtTransaction;
  if (tx != null && Number.isFinite(Number(tx)) && Number(tx) > 0) {
    return amountToUsdWithStoredRate(Number(row.profit), row.currency, tx);
  }
  throw new UnreliableFinancialDataError(
    `Sale is missing auditable USD normalization (profitUsd or exchangeRateAtTransaction) for currency ${code}.`
  );
}

export function effectiveSaleProfitUsdLegacy(row: SaleUsdRow, rates: Record<string, number>): number {
  const stored = row.profitUsd;
  if (stored != null && Number.isFinite(Number(stored))) return roundUsd(Number(stored));
  const tx = row.exchangeRateAtTransaction;
  if (tx != null && Number.isFinite(Number(tx)) && Number(tx) > 0) {
    return amountToUsdWithStoredRate(Number(row.profit), row.currency, tx);
  }
  const code = normalizeCurrencyCode(row.currency);
  ensureKnownCurrencyForRead(code);
  return amountToUsdStrict(Number(row.profit), row.currency, rates);
}

export function effectiveExpenseUsd(row: ExpenseUsdRow, _rates: Record<string, number>): number {
  const stored = row.amountUsd;
  if (stored != null && Number.isFinite(Number(stored))) return roundUsd(Number(stored));
  const code = normalizeCurrencyCode(row.currency);
  if (code === LEDGER_BASE_CURRENCY) return roundUsd(Number(row.amount));
  const tx = row.exchangeRateAtTransaction;
  if (tx != null && Number.isFinite(Number(tx)) && Number(tx) > 0) {
    return amountToUsdWithStoredRate(Number(row.amount), row.currency, tx);
  }
  throw new UnreliableFinancialDataError(
    `Expense is missing auditable USD normalization (amountUsd or exchangeRateAtTransaction) for currency ${code}.`
  );
}

export function effectiveExpenseUsdLegacy(row: ExpenseUsdRow, rates: Record<string, number>): number {
  const stored = row.amountUsd;
  if (stored != null && Number.isFinite(Number(stored))) return roundUsd(Number(stored));
  const tx = row.exchangeRateAtTransaction;
  if (tx != null && Number.isFinite(Number(tx)) && Number(tx) > 0) {
    return amountToUsdWithStoredRate(Number(row.amount), row.currency, tx);
  }
  const code = normalizeCurrencyCode(row.currency);
  ensureKnownCurrencyForRead(code);
  return amountToUsdStrict(Number(row.amount), row.currency, rates);
}

export function effectivePurchaseTotalUsd(row: PurchaseUsdRow, _rates: Record<string, number>): number {
  const stored = row.totalAmountUsd;
  if (stored != null && Number.isFinite(Number(stored))) return roundUsd(Number(stored));
  const code = normalizeCurrencyCode(row.currency);
  if (code === LEDGER_BASE_CURRENCY) return roundUsd(Number(row.totalAmount));
  const tx = row.exchangeRateAtTransaction;
  if (tx != null && Number.isFinite(Number(tx)) && Number(tx) > 0) {
    return amountToUsdWithStoredRate(Number(row.totalAmount), row.currency, tx);
  }
  throw new UnreliableFinancialDataError(
    `Purchase is missing auditable USD normalization (totalAmountUsd or exchangeRateAtTransaction) for currency ${code}.`
  );
}

export function effectivePurchaseTotalUsdLegacy(row: PurchaseUsdRow, rates: Record<string, number>): number {
  const stored = row.totalAmountUsd;
  if (stored != null && Number.isFinite(Number(stored))) return roundUsd(Number(stored));
  const tx = row.exchangeRateAtTransaction;
  if (tx != null && Number.isFinite(Number(tx)) && Number(tx) > 0) {
    return amountToUsdWithStoredRate(Number(row.totalAmount), row.currency, tx);
  }
  const code = normalizeCurrencyCode(row.currency);
  ensureKnownCurrencyForRead(code);
  return amountToUsdStrict(Number(row.totalAmount), row.currency, rates);
}

export function effectivePurchaseCargoUsd(row: PurchaseUsdRow, _rates: Record<string, number>): number {
  const stored = row.cargoCostUsd;
  if (stored != null && Number.isFinite(Number(stored))) return roundUsd(Number(stored));
  const code = normalizeCurrencyCode(row.currency);
  if (code === LEDGER_BASE_CURRENCY) return roundUsd(Number(row.cargoCost));
  const tx = row.exchangeRateAtTransaction;
  if (tx != null && Number.isFinite(Number(tx)) && Number(tx) > 0) {
    return amountToUsdWithStoredRate(Number(row.cargoCost), row.currency, tx);
  }
  throw new UnreliableFinancialDataError(
    `Purchase cargo is missing auditable USD normalization (cargoCostUsd or exchangeRateAtTransaction) for currency ${code}.`
  );
}

export function effectivePurchaseCargoUsdLegacy(row: PurchaseUsdRow, rates: Record<string, number>): number {
  const stored = row.cargoCostUsd;
  if (stored != null && Number.isFinite(Number(stored))) return roundUsd(Number(stored));
  const tx = row.exchangeRateAtTransaction;
  if (tx != null && Number.isFinite(Number(tx)) && Number(tx) > 0) {
    return amountToUsdWithStoredRate(Number(row.cargoCost), row.currency, tx);
  }
  const code = normalizeCurrencyCode(row.currency);
  ensureKnownCurrencyForRead(code);
  return amountToUsdStrict(Number(row.cargoCost), row.currency, rates);
}
