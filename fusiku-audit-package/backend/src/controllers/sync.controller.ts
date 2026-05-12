import type { Request, Response } from 'express';
import { syncQueueService } from '../sync/syncQueue.service';
import { cloudPushBatch, cloudHealth } from '../integrations/cloud/cloudAdapter';

export async function syncStatus(_req: Request, res: Response) {
  const pending = syncQueueService.list().filter((i) => !i.synced);
  const cloudOk = await cloudHealth();
  res.json({
    online: cloudOk,
    pendingCount: pending.length,
    cloudConfigured: Boolean(process.env.CLOUD_API_BASE_URL),
  });
}

const OPS = new Set(['create', 'update', 'delete']);

export function syncEnqueue(req: Request, res: Response) {
  const { entity, op, payload } = req.body || {};
  if (!entity || !op) {
    return res.status(400).json({ error: 'entity and op required' });
  }
  if (!OPS.has(String(op))) {
    return res.status(400).json({ error: 'invalid op' });
  }
  const item = syncQueueService.enqueue(String(entity), op as 'create' | 'update' | 'delete', payload || {});
  res.status(201).json(item);
}

export async function syncFlush(_req: Request, res: Response) {
  const pending = syncQueueService.list().filter((i) => !i.synced);
  if (pending.length === 0) {
    return res.json({ pushed: 0, ok: true });
  }
  const result = await cloudPushBatch({ items: pending });
  if (result.ok) {
    syncQueueService.markSynced(pending.map((p) => p.id));
    return res.json({ pushed: pending.length, ok: true });
  }
  return res.status(502).json({ ok: false, pushed: 0, message: 'Cloud push failed' });
}

/** Inbound batch from cloud / peer (extend with signature verification). */
export function syncReceive(req: Request, res: Response) {
  const items = (req.body as { items?: unknown })?.items;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items array required' });
  }
  return res.status(202).json({ accepted: items.length, ok: true });
}
