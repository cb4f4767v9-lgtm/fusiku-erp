import { prisma } from '../utils/prisma';
import { LEDGER_BASE_CURRENCY } from '../constants/ledgerCurrency';

function norm(code: unknown) {
  return String(code || '')
    .trim()
    .toUpperCase();
}

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Rates map convention (existing codebase): units of `code` per 1 USD.
 * Derive cross rate:
 * 1 FROM = (1 / rFrom) USD = (rTo / rFrom) TO
 */
export function crossRateFromUsdPivot(ratesPerUsd: Record<string, number>, from: string, to: string): number {
  const f = norm(from) || LEDGER_BASE_CURRENCY;
  const t = norm(to) || LEDGER_BASE_CURRENCY;
  if (f === t) return 1;
  const rFrom = f === LEDGER_BASE_CURRENCY ? 1 : safeNum(ratesPerUsd[f]);
  const rTo = t === LEDGER_BASE_CURRENCY ? 1 : safeNum(ratesPerUsd[t]);
  if (!rFrom || !rTo) return 0;
  return rTo / rFrom;
}

export const exchangeRateHistoryService = {
  /**
   * Record a snapshot for a selected currency set. Defaults to recording all pairwise rates
   * for the provided codes (O(n^2)), which is acceptable for <= ~20 codes.
   */
  async recordSnapshot(companyId: string, args: { ratesPerUsd: Record<string, number>; codes: string[]; date?: Date; source?: string }) {
    const date = args.date || new Date();
    const source = String(args.source || 'derived');
    const codes = Array.from(new Set((args.codes || []).map(norm).filter(Boolean)));

    const rows: Array<{ companyId: string; fromCurrency: string; toCurrency: string; rate: number; date: Date; source: string }> = [];
    for (const from of codes) {
      for (const to of codes) {
        if (from === to) continue;
        const rate = crossRateFromUsdPivot(args.ratesPerUsd, from, to);
        if (!(rate > 0)) continue;
        rows.push({ companyId, fromCurrency: from, toCurrency: to, rate, date, source });
      }
    }

    if (!rows.length) return { ok: true, inserted: 0 };

    // CreateMany is fast; history is append-only.
    await (prisma as any).exchangeRateHistory.createMany({ data: rows });
    return { ok: true, inserted: rows.length };
  },

  async list(companyId: string, args?: { fromCurrency?: string; toCurrency?: string; limit?: number }) {
    const fromCurrency = args?.fromCurrency ? norm(args.fromCurrency) : undefined;
    const toCurrency = args?.toCurrency ? norm(args.toCurrency) : undefined;
    const take = Math.max(1, Math.min(2000, Math.floor(Number(args?.limit || 200))));

    const where: any = { companyId };
    if (fromCurrency) where.fromCurrency = fromCurrency;
    if (toCurrency) where.toCurrency = toCurrency;

    return (prisma as any).exchangeRateHistory.findMany({
      where,
      orderBy: { date: 'desc' },
      take,
    });
  },
};

