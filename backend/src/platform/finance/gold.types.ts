/**
 * Gold as a financial asset (parallel to cash balances).
 * Units: gram (global), tola (common in South Asia — 1 tola ≈ 11.66 g; store conversion in app layer when implemented).
 */
export type GoldUnit = 'gram' | 'tola';

export type GoldPriceSource = 'manual' | 'live';

/** Snapshot for “spot” display and ledger valuation */
export interface GoldPriceSnapshot {
  companyId: string;
  /** Price per unit in a given settlement currency (e.g. USD per gram) */
  unit: GoldUnit;
  pricePerUnit: number;
  settlementCurrency: string;
  source: GoldPriceSource;
  asOf: string;
}

export type GoldMovementKind =
  | 'deposit_to_customer'
  | 'withdraw_from_customer'
  | 'convert_to_cash'
  | 'convert_from_cash'
  | 'adjustment';

export interface GoldPosition {
  customerId: string;
  grams: number;
  /** Optional: parallel display in tola without losing canonical gram storage */
  displayUnit?: GoldUnit;
}

/** Physical / book gold movement — types only (no Prisma model yet). */
export type GoldTransactionType = 'buy' | 'sell' | 'deposit' | 'withdraw';

/**
 * Single gold line for audit / ledger (settlement in USD for cross-asset reporting).
 * DB persistence deferred — use for APIs and `gold.transaction` domain events.
 */
export interface GoldTransaction {
  type: GoldTransactionType;
  grams: number;
  pricePerGram: number;
  totalUsd: number;
  companyId?: string;
  referenceId?: string;
  occurredAt?: string;
}
