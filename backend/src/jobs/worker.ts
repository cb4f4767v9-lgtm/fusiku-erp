/**
 * Fusiku - Queue Worker
 * Processes jobs from the queue. Can be started separately or from main index.
 */

import { processJobs } from './queue';
import { processJob } from './index';
import { logger } from '../utils/logger';

const POLL_INTERVAL_MS = 5000;
let workerInterval: NodeJS.Timeout | null = null;

export function startWorker(): void {
  if (workerInterval) return;

  workerInterval = setInterval(async () => {
    try {
      const processed = await processJobs(processJob);
      if (processed > 0) {
        logger.debug({ processed }, 'Worker processed jobs');
      }
    } catch (e) {
      logger.error({ error: (e as Error).message }, 'Worker error');
    }
  }, POLL_INTERVAL_MS);

  logger.info('Job worker started');
}

export function stopWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    logger.info('Job worker stopped');
  }
}
