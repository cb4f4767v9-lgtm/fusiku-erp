/**
 * Fusiku - Queue Abstraction
 * Uses Redis when REDIS_URL exists, otherwise in-memory fallback
 */

import { logger } from '../utils/logger';
import { getRedisClient } from '../infrastructure/redis/client';
import { bullAddJob, bullQueueLength } from './bullmq';

export type JobName =
  | 'lowStockCheck'
  | 'emailNotification'
  | 'repairReminder'
  | 'marketPriceUpdate'
  | 'priceOptimization'
  | 'inventoryRiskCheck'
  | 'profitAnalysis'
  | 'aiAlertGeneration'
  | 'databaseBackup';

export interface JobPayload {
  [key: string]: unknown;
}

const QUEUE_KEY = 'fusiku:jobs';
// Reserved for future visibility features (e.g. in-progress tracking).
const PROCESSING_KEY = 'fusiku:jobs:processing';

// In-memory fallback
const memoryQueue: Array<{ id: string; name: JobName; data?: JobPayload; createdAt: string }> = [];

let lastRedisWarnAtMs = 0;
function warnRedisOnce(message: string, extra?: Record<string, unknown>) {
  const t = Date.now();
  // throttle Redis-down warnings to avoid flooding logs
  if (t - lastRedisWarnAtMs < 5_000) return;
  lastRedisWarnAtMs = t;
  logger.warn(extra || {}, message);
}

function generateId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// --- Redis implementation ---
async function addJobRedis(name: JobName, data?: JobPayload): Promise<string> {
  const client = getRedisClient();
  if (!client) throw new Error('REDIS_URL not configured');
  const id = generateId();
  const payload = JSON.stringify({ id, name, data: data || {}, createdAt: new Date().toISOString() });
  await client.rpush(QUEUE_KEY, payload);
  logger.info({ jobId: id, name }, 'Job queued (Redis)');
  return id;
}

async function processJobsRedis(
  processor: (name: JobName, data?: JobPayload) => Promise<void>
): Promise<number> {
  const client = getRedisClient();
  if (!client) return 0;
  const raw = await client.lpop(QUEUE_KEY);
  if (!raw) return 0;
  const job = JSON.parse(raw) as { id: string; name: JobName; data?: JobPayload };
  try {
    await processor(job.name, job.data);
  } catch (e: unknown) {
    logger.error({ jobId: job.id, error: (e as Error).message }, 'Job failed');
  }
  return 1;
}

// --- In-memory implementation ---
function addJobMemory(name: JobName, data?: JobPayload): string {
  const id = generateId();
  memoryQueue.push({
    id,
    name,
    data,
    createdAt: new Date().toISOString(),
  });
  logger.info({ jobId: id, name }, 'Job queued (memory)');
  return id;
}

async function processJobsMemory(
  processor: (name: JobName, data?: JobPayload) => Promise<void>
): Promise<number> {
  const job = memoryQueue.shift();
  if (!job) return 0;
  try {
    await processor(job.name, job.data);
  } catch (e: unknown) {
    logger.error({ jobId: job.id, error: (e as Error).message }, 'Job failed');
  }
  return 1;
}

// --- Public API ---

export async function addJob(name: JobName, data?: JobPayload): Promise<string> {
  const useBull = String(process.env.USE_BULLMQ || '0') === '1';
  if (useBull) {
    // BullMQ is Redis-backed and may be unavailable. Never let it break API requests.
    if (getRedisClient()) {
      try {
        return await bullAddJob(name, data);
      } catch (err) {
        logger.warn({ err, name }, '[jobs] BullMQ enqueue failed — falling back to memory queue');
        return addJobMemory(name, data);
      }
    }
    logger.warn({ name }, '[jobs] USE_BULLMQ=1 but Redis unavailable — falling back to memory queue');
    return addJobMemory(name, data);
  }
  if (getRedisClient()) {
    try {
      return await addJobRedis(name, data);
    } catch (err) {
      warnRedisOnce('[jobs] Redis enqueue failed — falling back to memory queue', { err, name });
      return addJobMemory(name, data);
    }
  }
  return addJobMemory(name, data);
}

export async function processJobs(
  processor: (name: JobName, data?: JobPayload) => Promise<void>
): Promise<number> {
  if (getRedisClient()) {
    try {
      return await processJobsRedis(processor);
    } catch (err) {
      warnRedisOnce('[jobs] Redis dequeue failed — falling back to memory processing', { err });
      return await processJobsMemory(processor);
    }
  }
  return processJobsMemory(processor);
}

export async function getQueueLength(): Promise<number> {
  const useBull = String(process.env.USE_BULLMQ || '0') === '1';
  if (useBull && getRedisClient()) {
    try {
      return await bullQueueLength();
    } catch (err) {
      logger.warn({ err }, '[jobs] BullMQ length check failed — falling back to memory length');
      return memoryQueue.length;
    }
  }
  const client = getRedisClient();
  if (client) {
    try {
      return await client.llen(QUEUE_KEY);
    } catch (err) {
      warnRedisOnce('[jobs] Redis length check failed — falling back to memory length', { err });
      return memoryQueue.length;
    }
  }
  return memoryQueue.length;
}

export function useRedis(): boolean {
  return Boolean(getRedisClient());
}
