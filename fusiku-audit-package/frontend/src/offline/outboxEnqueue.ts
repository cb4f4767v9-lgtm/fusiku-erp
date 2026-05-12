import { isElectronLocalDbAvailable } from './desktopBridge';
import type { OutboxKind } from './outboxKinds';

/**
 * When the browser is offline and the desktop bridge exists, queue a write for later sync.
 * @returns true if queued (caller should skip immediate API call).
 */
export async function enqueueIfOfflineDesktop(kind: OutboxKind, payload: unknown): Promise<boolean> {
  if (typeof navigator === 'undefined' || navigator.onLine) return false;
  if (!isElectronLocalDbAvailable()) return false;
  const db = (window as unknown as { electronLocalDb: { outboxEnqueue: (k: string, p: unknown) => Promise<{ id: string }> } })
    .electronLocalDb;
  try {
    await db.outboxEnqueue(kind, payload);
    window.dispatchEvent(new CustomEvent('fusiku-local-outbox-changed'));
    return true;
  } catch {
    return false;
  }
}
