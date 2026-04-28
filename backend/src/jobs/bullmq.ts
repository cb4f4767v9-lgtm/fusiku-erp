import { Queue, Worker, type JobsOptions } from 'bullmq';
import { getRedisClient } from '../infrastructure/redis/client';
import { logger } from '../utils/logger';
import type { JobName, JobPayload } from './queue';

const QUEUE_NAME = 'fusiku:bullmq:jobs';

let q: Queue | null | undefined;
let w: Worker | null | undefined;

let lastWarnAtMs = 0;
function warnBullOnce(message: string, extra?: Record<string, unknown>) {
  const t = Date.now();
  if (t - lastWarnAtMs < 5_000) return;
  lastWarnAtMs = t;
  logger.warn(extra || {}, message);
}

function getRedisConnectionOrNull() {
  const c = getRedisClient();
  if (!c) {
    warnBullOnce('[jobs] BullMQ unavailable: Redis is not configured/reachable (soft-fail)');
    return null;
  }
  return c;
}

export function getBullQueue(): Queue | null {
  if (q) return q;
  const connection = getRedisConnectionOrNull();
  if (!connection) return null;
  q = new Queue(QUEUE_NAME, { connection });
  return q;
}

export async function bullAddJob(name: JobName, data?: JobPayload): Promise<string> {
  const queue = getBullQueue();
  if (!queue) {
    // queue.ts should fall back before calling; keep safe.
    throw new Error('BullMQ unavailable (Redis not configured/reachable)');
  }
  const opts: JobsOptions = {
    attempts: Math.max(1, Math.min(5, Number(process.env.JOB_ATTEMPTS || 3))),
    backoff: { type: 'exponential', delay: 500 },
    removeOnComplete: 5000,
    removeOnFail: 5000,
  };
  const job = await queue.add(name, data || {}, opts);
  logger.info({ jobId: job.id, name }, '[jobs] queued (BullMQ)');
  return String(job.id);
}

export function startBullWorker(processor: (name: JobName, data?: JobPayload) => Promise<void>) {
  if (w) return w;
  const connection = getRedisConnectionOrNull();
  if (!connection) {
    // Soft-fail in API process. Worker-entry can choose to exit if required.
    warnBullOnce('[jobs] BullMQ worker not started: Redis unavailable (soft-fail)');
    return null;
  }
  w = new Worker(
    QUEUE_NAME,
    async (job) => {
      const name = String(job.name) as JobName;
      const data = (job.data || {}) as JobPayload;
      await processor(name, data);
    },
    { connection }
  );
  w.on('completed', (job) => logger.debug({ jobId: job.id }, '[jobs] completed'));
  w.on('failed', (job, err) => logger.warn({ jobId: job?.id, err }, '[jobs] failed'));
  logger.info('[jobs] BullMQ worker started');
  return w;
}

export async function bullQueueLength(): Promise<number> {
  const queue = getBullQueue();
  if (!queue) return 0;
  // waiting + delayed + active gives a rough “work outstanding” measure
  const counts = await queue.getJobCounts('waiting', 'delayed', 'active');
  return (counts.waiting || 0) + (counts.delayed || 0) + (counts.active || 0);
}

