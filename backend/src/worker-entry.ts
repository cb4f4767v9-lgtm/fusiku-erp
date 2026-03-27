/**
 * Fusiku - Standalone Worker Entry
 * Run: npx tsx src/worker-entry.ts
 * Processes jobs from the queue (Redis or in-memory)
 */

import { startWorker } from './jobs/worker';
import { startScheduler } from './jobs/scheduler';
import { logger } from './utils/logger';

logger.info('Starting standalone worker...');
startWorker();
startScheduler();
