import { prisma } from '../utils/prisma';
import { currencyService } from './currency.service';
import { logger } from '../utils/logger';

/**
 * @deprecated Legacy `ExchangeRate` rows are global and not tenant-safe.
 * **Reads** are served from {@link currencyService} (per-company `Currency` desk).
 * `create()` still appends to `ExchangeRate` for backward compatibility with old integrations.
 */
const READ_DEPRECATION =
  '[exchangeRate] Deprecated: ExchangeRate reads are redirected to Currency service (tenant-scoped).';

function normalizeCode(currency: string) {
  return String(currency || '')
    .trim()
    .toUpperCase();
}

export const exchangeRateService = {
  /** @deprecated Use `currencyService.list` / `getRatesMap` — returns mapped `Currency` rows for this company. */
  async getAll(companyId: string) {
    logger.warn({ companyId }, READ_DEPRECATION);
    const rows = await currencyService.list(companyId);
    const now = new Date();
    return rows.map((r: any) => ({
      id: String(r.id || `${r.companyId}:${r.code}`),
      currency: String(r.code || '').toUpperCase(),
      rate: Number(r.finalRate) || 0,
      effectiveFrom: (r.lastUpdatedAt as Date) || now,
      effectiveTo: null as Date | null,
      createdAt: (r.lastUpdatedAt as Date) || now
    }));
  },

  /** @deprecated Use `currencyService.getRatesMap` — returns a synthetic row from the company rate map. */
  async getCurrent(companyId: string, currency: string) {
    logger.warn({ companyId, currency }, READ_DEPRECATION);
    const code = normalizeCode(currency);
    const map = await currencyService.getRatesMap(companyId);
    const rate = code ? Number(map[code] ?? 0) : 0;
    const now = new Date();
    return {
      id: `currency:${companyId}:${code || 'UNKNOWN'}`,
      currency: code || 'USD',
      rate,
      effectiveFrom: now,
      effectiveTo: null as Date | null,
      createdAt: now
    };
  },

  /** Still persists to legacy `ExchangeRate` table (not tenant-scoped). Prefer Currency desk updates. */
  async create(data: { currency: string; rate: number; effectiveFrom: Date; effectiveTo?: Date }) {
    logger.warn({}, '[exchangeRate] create() still writes legacy ExchangeRate — prefer Currency API for tenant data.');
    return prisma.exchangeRate.create({
      data: {
        ...data,
        rate: data.rate
      }
    });
  }
};
