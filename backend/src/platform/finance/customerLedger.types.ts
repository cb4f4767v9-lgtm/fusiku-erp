/**
 * Customer finance ledger — multi-balance: cash per currency + gold weight.
 * Aligns conceptually with `Customer.openingBalance` / `balanceType` but scoped for trading ledger evolution.
 */
import type { IsoCurrencyCode } from './currencyTrading.types';

export type LedgerBucket =
  | { kind: 'cash'; currency: IsoCurrencyCode }
  | { kind: 'gold'; unit: 'gram' };

export type LedgerTransactionDirection = 'credit' | 'debit';

export interface CashBalanceEntry {
  currency: IsoCurrencyCode;
  amount: number;
}

export interface CustomerFinanceBalances {
  customerId: string;
  companyId: string;
  cash: CashBalanceEntry[];
  /** Canonical gold stored in grams */
  goldGrams: number;
  updatedAt: string;
}

export interface LedgerTransactionLine {
  id: string;
  customerId: string;
  companyId: string;
  occurredAt: string;
  direction: LedgerTransactionDirection;
  bucket: LedgerBucket;
  amount: number;
  /** FX or gold↔cash reference for future reconciliation */
  reference?: string;
  memo?: string;
}
