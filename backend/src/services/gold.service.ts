import { logger } from '../utils/logger';

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export const goldService = {
  /**
   * Fetch XAU per 1 USD (Currency convention) from exchangerate.host.
   * Endpoint returns rates as "units of symbol per 1 base".
   */
  async fetchXauPerUsd(): Promise<{ ok: boolean; sourceProvider: 'exchangerate.host' | 'fallback'; xauPerUsd: number }> {
    try {
      const res = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=XAU');
      if (!res.ok) return { ok: false, sourceProvider: 'fallback', xauPerUsd: 0 };
      const data = (await res.json()) as { rates?: Record<string, unknown> };
      const xauPerUsd = safeNum(data?.rates?.XAU);
      if (!xauPerUsd || xauPerUsd <= 0) return { ok: false, sourceProvider: 'fallback', xauPerUsd: 0 };
      return { ok: true, sourceProvider: 'exchangerate.host', xauPerUsd };
    } catch (err) {
      logger.warn({ err }, '[gold] fetch XAU failed');
      return { ok: false, sourceProvider: 'fallback', xauPerUsd: 0 };
    }
  },
};

