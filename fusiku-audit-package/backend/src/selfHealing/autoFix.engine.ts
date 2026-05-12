import { logger } from '../utils/logger';
import { redisPing, getRedisClient } from '../infrastructure/redis/client';
import { incidentService } from '../services/incident.service';

export type AutoFixAction = 'redis_reconnect' | 'noop';

/**
 * SAFE auto-fix engine:
 * - no schema changes
 * - no code edits
 * - no destructive operations
 * Actions are small operational nudges (reconnect, retry, degrade mode).
 */
export const autoFixEngine = {
  async runApprovedAction(incidentId: string, action: AutoFixAction) {
    if (action === 'redis_reconnect') {
      const client = getRedisClient();
      if (!client) {
        await incidentService.attachSuggestion(incidentId, 'REDIS_URL not configured; cannot reconnect.');
        return { ok: false, action, message: 'Redis not configured' };
      }
      try {
        // Force a reconnect cycle.
        client.disconnect();
        await client.connect();
        const ok = await redisPing();
        logger.info({ ok }, '[autoFix] redis_reconnect');
        return { ok, action, message: ok ? 'Redis reconnected' : 'Redis reconnect attempted (ping failed)' };
      } catch (err) {
        logger.warn({ err }, '[autoFix] redis_reconnect failed');
        return { ok: false, action, message: 'Redis reconnect failed' };
      }
    }

    logger.info({ action }, '[autoFix] noop');
    return { ok: true, action, message: 'No action' };
  },
};

