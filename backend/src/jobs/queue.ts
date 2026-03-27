/**
 * Fusiku - Queue Abstraction
 * Uses Redis when REDIS_URL exists, otherwise in-memory fallback
 */

import { redisUrl } from '../config';
import { logger } from '../utils/logger';

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
const PROCESSING_KEY = 'fusiku:jobs:processing';

// In-memory fallback
const memoryQueue: Array<{ id: string; name: JobName; data?: JobPayload; createdAt: string }> = [];

function generateId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// --- Redis implementation ---
async function addJobRedis(name: JobName, data?: JobPayload): Promise<string> {
  const Redis = (await import('ioredis')).default;
  const client = new Redis(redisUrl!);
  try {
    const id = generateId();
    const payload = JSON.stringify({ id, name, data: data || {}, createdAt: new Date().toISOString() });
    await client.rpush(QUEUE_KEY, payload);
    logger.info({ jobId: id, name }, 'Job queued (Redis)');
    return id;
  } finally {
    await client.quit();
  }
}

async function processJobsRedis(
  processor: (name: JobName, data?: JobPayload) => Promise<void>
): Promise<number> {
  const Redis = (await import('ioredis')).default;
  const client = new Redis(redisUrl!);
  try {
    const raw = await client.lpop(QUEUE_KEY);
    if (!raw) return 0;
    const job = JSON.parse(raw) as { id: string; name: JobName; data?: JobPayload };
    try {
      await processor(job.name, job.data);
    } catch (e: unknown) {
      logger.error({ jobId: job.id, error: (e as Error).message }, 'Job failed');
    }
    return 1;
  } finally {
    await client.quit();
  }
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
  if (redisUrl) {
    return addJobRedis(name, data);
  }
  return addJobMemory(name, data);
}

export async function processJobs(
  processor: (name: JobName, data?: JobPayload) => Promise<void>
): Promise<number> {
  if (redisUrl) {
    return processJobsRedis(processor);
  }
  return processJobsMemory(processor);
}

export async function getQueueLength(): Promise<number> {
  if (redisUrl) {
    const Redis = (await import('ioredis')).default;
    const client = new Redis(redisUrl!);
    try {
      return await client.llen(QUEUE_KEY);
    } finally {
      await client.quit();
    }
  }
  return memoryQueue.length;
}

export const useRedis = !!redisUrl;
