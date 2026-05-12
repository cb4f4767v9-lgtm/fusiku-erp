/**
 * Domain event names and payloads for event-driven features (AI triggers, alerts, integrations).
 * Emit from services when those features are implemented; nothing emits these yet by default.
 */
/** Sentinel when many currency rows refresh in one operation (listeners should refetch list). */
export const CURRENCY_UPDATED_BULK_CODE = '__bulk__' as const;

export type DomainEventMap = {
  /** POS / sales flow — future: AI pricing, marketing attribution */
  'sale.completed': { saleId: string; companyId: string; branchId?: string };
  /** Stock quantity or location change */
  'inventory.changed': { inventoryId: string; companyId: string; branchId?: string };
  /**
   * Exchange rate or currency row config change.
   * `currencyCode` is ISO code for single-row updates, or {@link CURRENCY_UPDATED_BULK_CODE} after bulk apply.
   */
  'currency.updated': {
    companyId: string;
    currencyCode: string;
    /** Present when a single row desk snapshot is emitted */
    mid?: number;
    buy?: number;
    sell?: number;
  };
  /** Gold book movement (types-only flow until Prisma model ships) */
  'gold.transaction': {
    companyId: string;
    type: 'buy' | 'sell' | 'deposit' | 'withdraw';
    grams: number;
    pricePerGram: number;
    totalUsd: number;
    referenceId?: string;
  };
};

export type DomainEventName = keyof DomainEventMap;

export type DomainEventPayload<N extends DomainEventName> = DomainEventMap[N];
