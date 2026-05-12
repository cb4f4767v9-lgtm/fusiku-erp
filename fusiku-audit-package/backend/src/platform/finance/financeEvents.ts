/**
 * Future domain events for finance/trading (emit via `getDomainEventBus()` when implemented).
 * Kept separate from core `domainEvents.ts` to avoid coupling until modules land.
 *
 * **Live bus (today):** `currency.updated` and `gold.transaction` are defined on `DomainEventMap`
 * and emitted from `financeEventEmitters.ts` / `currency.service` where applicable.
 */
export type FinanceEventName =
  | 'finance.quote.updated'
  | 'finance.gold.price.updated'
  | 'finance.ledger.posted'
  | 'finance.gold.moved';

export type FinanceEventPayloadMap = {
  'finance.quote.updated': { companyId: string; currencyCode: string };
  'finance.gold.price.updated': { companyId: string; unit: string };
  'finance.ledger.posted': { companyId: string; customerId: string; transactionId: string };
  'finance.gold.moved': { companyId: string; customerId: string; kind: string };
};
