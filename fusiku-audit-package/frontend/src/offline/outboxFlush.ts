import i18n from 'i18next';
import { api } from '../services/api';
import { getErrorMessage } from '../utils/getErrorMessage';
import { isElectronLocalDbAvailable } from './desktopBridge';
import { OUTBOX_KIND } from './outboxKinds';

type PendingRow = {
  id: string;
  kind: string;
  payload: string;
  status: string;
  attempts: number;
};

function classifyAxiosError(err: unknown): 'conflict' | 'retry' | 'fatal' {
  const e = err as { response?: { status?: number; data?: { error?: string } }; message?: string; code?: string };
  const status = e?.response?.status;
  const msg = getErrorMessage(err, '');
  if (status === 401 || status === 403) return 'fatal';
  if (status === 409) return 'conflict';
  if (status === 404) return 'conflict';
  if (status === 400) {
    if (
      /not\s+available|already\s+sold|sold|not\s+found|invalid|duplicate|exists|branch|expired|locked|required/i.test(
        msg
      )
    ) {
      return 'conflict';
    }
    return 'conflict';
  }
  if (!status || status >= 500) return 'retry';
  if (e?.code === 'ECONNABORTED' || e?.code === 'ERR_NETWORK') return 'retry';
  return 'retry';
}

function errMessage(err: unknown): string {
  return getErrorMessage(err, 'Request failed');
}

async function replayRow(row: PendingRow): Promise<void> {
  let payload: unknown;
  try {
    payload = JSON.parse(row.payload || '{}');
  } catch {
    throw new Error('Invalid queued payload JSON');
  }
  const cfg = { headers: { 'x-idempotency-key': row.id } };
  switch (row.kind) {
    case OUTBOX_KIND.POS_SALE:
      await api.post('/pos/sale', payload, cfg);
      return;
    case OUTBOX_KIND.PURCHASE_CREATE:
      await api.post('/purchases', payload, cfg);
      return;
    case OUTBOX_KIND.INVENTORY_CREATE:
      await api.post('/inventory', payload, cfg);
      return;
    case OUTBOX_KIND.EXPENSE_CREATE:
      await api.post('/expenses', payload as Record<string, unknown>, cfg);
      return;
    default:
      throw new Error(`Unknown outbox kind: ${row.kind}`);
  }
}

export type FlushDesktopOutboxResult = {
  synced: number;
  conflicts: number;
  stopped: boolean;
  fatal: boolean;
};

/**
 * FIFO replay of pending desktop outbox rows against the same API as the SPA.
 */
export async function flushDesktopOutbox(): Promise<FlushDesktopOutboxResult> {
  const result: FlushDesktopOutboxResult = { synced: 0, conflicts: 0, stopped: false, fatal: false };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    result.stopped = true;
    return result;
  }
  if (!isElectronLocalDbAvailable()) return result;

  const bridge = (window as unknown as {
    electronLocalDb: {
      outboxListPending: () => Promise<PendingRow[]>;
      outboxMarkSynced: (id: string) => Promise<unknown>;
      outboxMarkConflict: (id: string, detail: string) => Promise<unknown>;
      outboxBumpAttempt: (id: string, msg: string) => Promise<{ attempts?: number }>;
    };
  }).electronLocalDb;

  const rows = await bridge.outboxListPending();
  if (!rows.length) return result;

  for (const row of rows) {
    try {
      await replayRow(row);
      await bridge.outboxMarkSynced(row.id);
      result.synced += 1;
    } catch (err) {
      const kind = classifyAxiosError(err);
      const msg = errMessage(err);
      if (kind === 'fatal') {
        result.stopped = true;
        result.fatal = true;
        break;
      }
      if (kind === 'conflict') {
        await bridge.outboxMarkConflict(row.id, msg);
        result.conflicts += 1;
        try {
          const title = i18n.t('offline.conflictTitle', { defaultValue: 'Sync conflict' });
          const body = i18n.t('offline.conflictDetail', { kind: row.kind, message: msg });
          // eslint-disable-next-line no-console
          console.warn(`[offline] ${title}`, body);
        } catch {
          /* ignore */
        }
        continue;
      }
      await bridge.outboxBumpAttempt(row.id, msg);
      result.stopped = true;
      break;
    }
  }

  window.dispatchEvent(new CustomEvent('fusiku-local-outbox-changed'));
  return result;
}

export async function getDesktopLocalCounts(): Promise<{ pending: number; conflicts: number }> {
  if (!isElectronLocalDbAvailable()) return { pending: 0, conflicts: 0 };
  const bridge = (window as unknown as {
    electronLocalDb: {
      outboxPendingCount: () => Promise<number>;
      outboxConflictCount: () => Promise<number>;
    };
  }).electronLocalDb;
  try {
    const [pending, conflicts] = await Promise.all([bridge.outboxPendingCount(), bridge.outboxConflictCount()]);
    return { pending: Number(pending) || 0, conflicts: Number(conflicts) || 0 };
  } catch {
    return { pending: 0, conflicts: 0 };
  }
}
