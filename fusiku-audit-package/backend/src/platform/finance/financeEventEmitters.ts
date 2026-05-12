import { getDomainEventBus } from '../events/eventBus';
import { CURRENCY_UPDATED_BULK_CODE, type DomainEventName, type DomainEventPayload } from '../events/domainEvents';
import type { GoldTransaction } from './gold.types';

function emit<N extends DomainEventName>(name: N, payload: DomainEventPayload<N>): void {
  try {
    getDomainEventBus().emit(name, payload);
  } catch {
    // never block business paths on bus failures
  }
}

export type CurrencyDeskSnapshot = { mid: number; buy: number; sell: number };

/** After a single currency row or policy change. */
export function emitCurrencyUpdated(
  companyId: string,
  currencyCode: string,
  snapshot?: CurrencyDeskSnapshot
): void {
  emit('currency.updated', {
    companyId,
    currencyCode,
    ...(snapshot ? { mid: snapshot.mid, buy: snapshot.buy, sell: snapshot.sell } : {})
  });
}

/** After bulk rate apply (e.g. `applyUsdBaseRates`). */
export function emitCurrencyUpdatedBulk(companyId: string): void {
  emit('currency.updated', { companyId, currencyCode: CURRENCY_UPDATED_BULK_CODE });
}

/** Gold book line — call when gold module posts a movement (structure for future callers). */
export function emitGoldTransaction(
  companyId: string,
  tx: Pick<GoldTransaction, 'type' | 'grams' | 'pricePerGram' | 'totalUsd'> & { referenceId?: string }
): void {
  emit('gold.transaction', {
    companyId,
    type: tx.type,
    grams: tx.grams,
    pricePerGram: tx.pricePerGram,
    totalUsd: tx.totalUsd,
    referenceId: tx.referenceId
  });
}
