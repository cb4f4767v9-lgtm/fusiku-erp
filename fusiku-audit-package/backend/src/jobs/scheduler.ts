/**
 * Fusiku - Job Scheduler
 * Schedules recurring jobs
 */

import { addJob } from './index';
import { logger } from '../utils/logger';

let schedulerInterval: NodeJS.Timeout | null = null;

export function startScheduler() {
  if (schedulerInterval) return;

  let tick = 0;
  schedulerInterval = setInterval(() => {
    addJob('lowStockCheck');
    tick++;
    if (tick % 72 === 0) addJob('priceOptimization'); // every 6h (72 * 5min)
    if (tick % 144 === 0) addJob('inventoryRiskCheck'); // every 12h
    if (tick % 288 === 0) {
      addJob('profitAnalysis');
      addJob('aiAlertGeneration');
      addJob('databaseBackup');
    } // daily (288 * 5min = 24h)
  }, 5 * 60 * 1000);

  logger.info(
    'Job scheduler started (lowStockCheck 5min, priceOpt 6h, risk 12h, profit/alert/backup daily)'
  );
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('Job scheduler stopped');
  }
}
