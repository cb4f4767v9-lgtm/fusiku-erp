/**
 * Fusiku - Standalone Worker Entry
 * Run: npx tsx src/worker-entry.ts
 * Processes jobs from the queue (Redis or in-memory)
 */

import { startWorker } from './jobs/worker';
import { startScheduler } from './jobs/scheduler';
import { logger } from './utils/logger';
import { redisPing } from './infrastructure/redis/client';

logger.info('Starting standalone worker...');

async function bootstrap() {
  // Worker-only dependency: when BullMQ is enabled, Redis must be available for the worker.
  if (String(process.env.USE_BULLMQ || '0') === '1') {
    const ok = await redisPing();
    if (!ok) {
      logger.error('[worker] USE_BULLMQ=1 but Redis is unavailable — exiting (worker requires Redis)');
      process.exit(1);
    }
  }

  startWorker();
  startScheduler();
}

void bootstrap();
