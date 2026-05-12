export type SyncOperation = 'create' | 'update' | 'delete';

export interface SyncQueueItem {
  id: string;
  entity: string;
  op: SyncOperation;
  payload: Record<string, unknown>;
  clientUpdatedAt: string;
  synced: boolean;
  conflict?: string;
}

export interface CloudPushResult {
  ok: boolean;
  serverVersion?: string;
  conflict?: boolean;
}
