import type { PrismaClient } from '@prisma/client';
import { logger } from './logger';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Connect to PostgreSQL with exponential backoff (startup / transient network issues).
 * Pool size is controlled via DATABASE_URL, e.g. ?connection_limit=10&pool_timeout=20
 */
export async function connectPrismaWithRetry(
  client: PrismaClient,
  opts?: { maxRetries?: number; baseDelayMs?: number }
): Promise<void> {
  const maxRetries = opts?.maxRetries ?? parseInt(process.env.DB_CONNECT_MAX_RETRIES || '5', 10);
  const baseDelayMs = opts?.baseDelayMs ?? parseInt(process.env.DB_CONNECT_RETRY_MS || '1000', 10);

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await client.$connect();
      if (attempt > 0) {
        logger.info({ attempt }, '[db] Connected after retry');
      }
      return;
    } catch (err) {
      lastErr = err;
      if (attempt === maxRetries) break;
      const delayMs = baseDelayMs * Math.pow(2, attempt);
      logger.warn(
        { err, attempt: attempt + 1, attemptsRemaining: maxRetries - attempt, delayMs },
        '[db] Connection failed, retrying'
      );
      await sleep(delayMs);
    }
  }
  throw lastErr;
}
