/**
 * Fusiku - Job Processors
 * Export processors for lowStockCheck, emailNotification, repairReminder, marketPriceUpdate
 */

import { logger } from '../utils/logger';
import type { JobName, JobPayload } from './queue';
import { runWithTenantContext } from '../utils/tenantContext';

export async function processJob(name: JobName, data?: JobPayload): Promise<void> {
  switch (name) {
    case 'lowStockCheck':
      const { stockAlertService } = await import('../services/stockAlert.service');
      await stockAlertService.checkAndCreateAlerts();
      break;
    case 'emailNotification':
      logger.info({ data }, 'Email notification job (stub)');
      break;
    case 'repairReminder':
      logger.info({ data }, 'Repair reminder job (stub)');
      break;
    case 'marketPriceUpdate':
      logger.info({ data }, 'Market price update job (stub)');
      break;
    case 'priceOptimization':
      logger.info('Price optimization agent (runs on-demand via API)');
      break;
    case 'inventoryRiskCheck': {
      const { inventoryRiskAgent } = await import('../ai/inventoryRisk.agent');
      await inventoryRiskAgent.analyze();
      break;
    }
    case 'profitAnalysis': {
      const { profitAnalysisAgent } = await import('../ai/profitAnalysis.agent');
      await profitAnalysisAgent.analyze();
      break;
    }
    case 'aiAlertGeneration': {
      const { aiAlertAgent } = await import('../ai/aiAlert.agent');
      const { prismaPlatform } = await import('../utils/prismaPlatform');
      const companies = await prismaPlatform.company.findMany({ select: { id: true } });
      for (const c of companies) {
        await runWithTenantContext(
          { userId: 'job_ai_alerts', companyId: c.id, isSystemAdmin: false },
          () => aiAlertAgent.generateAlerts({ companyId: c.id })
        );
      }
      break;
    }
    case 'databaseBackup': {
      const { runDatabaseBackup } = await import('../services/backup.service');
      await runDatabaseBackup();
      break;
    }
    default:
      logger.warn({ name }, 'Unknown job type');
  }
}

export { addJob, processJobs, getQueueLength, useRedis } from './queue';
export type { JobName, JobPayload } from './queue';
