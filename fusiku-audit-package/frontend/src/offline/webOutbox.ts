import { OUTBOX_KIND, type OutboxKind } from './outboxKinds';
import { idbDelete, idbGet, idbKeys, idbSet } from './webIdb';

type WebOutboxRow = {
  v: 1;
  id: string;
  kind: OutboxKind;
  url: string;
  method: 'post';
  payload: unknown;
  createdAt: number;
  attempts: number;
  lastError?: string;
};

function rowKey(id: string) {
  return `outbox:${id}`;
}

export async function enqueueWebOutbox(args: {
  id: string;
  kind: OutboxKind;
  url: string;
  payload: unknown;
}): Promise<void> {
  const row: WebOutboxRow = {
    v: 1,
    id: args.id,
    kind: args.kind,
    url: args.url,
    method: 'post',
    payload: args.payload,
    createdAt: Date.now(),
    attempts: 0,
  };
  await idbSet('outbox', rowKey(args.id), row);
  window.dispatchEvent(new CustomEvent('fusiku-web-outbox-changed'));
}

export async function getWebOutboxCounts(): Promise<{ pending: number }> {
  const keys = await idbKeys('outbox').catch(() => []);
  return { pending: keys.filter((k) => k.startsWith('outbox:')).length };
}

export async function flushWebOutbox(post: (url: string, payload: unknown, cfg: any) => Promise<unknown>): Promise<{ synced: number; stopped: boolean }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { synced: 0, stopped: true };
  const keys = (await idbKeys('outbox').catch(() => [])).filter((k) => k.startsWith('outbox:'));
  if (!keys.length) return { synced: 0, stopped: false };

  let synced = 0;
  for (const k of keys) {
    const row = await idbGet<WebOutboxRow>('outbox', k).catch(() => null);
    if (!row) continue;
    try {
      await post(row.url, row.payload, { headers: { 'x-idempotency-key': row.id } });
      await idbDelete('outbox', k);
      synced += 1;
    } catch (e: any) {
      const msg = String(e?.message || 'Request failed');
      await idbSet('outbox', k, { ...row, attempts: (row.attempts || 0) + 1, lastError: msg });
      window.dispatchEvent(new CustomEvent('fusiku-web-outbox-changed'));
      return { synced, stopped: true };
    }
  }
  window.dispatchEvent(new CustomEvent('fusiku-web-outbox-changed'));
  return { synced, stopped: false };
}

export function classifyOutboxKindFromUrl(url: string): OutboxKind | null {
  if (url === '/pos/sale') return OUTBOX_KIND.POS_SALE;
  if (url === '/purchases') return OUTBOX_KIND.PURCHASE_CREATE;
  if (url === '/inventory') return OUTBOX_KIND.INVENTORY_CREATE;
  if (url === '/expenses') return OUTBOX_KIND.EXPENSE_CREATE;
  return null;
}

