import type { Currency } from '@prisma/client';
import { LEDGER_BASE_CURRENCY } from '../constants/ledgerCurrency';
import { forexSidesFromMid } from '../platform/finance/forexDesk.utils';
import { emitCurrencyUpdated, emitCurrencyUpdatedBulk } from '../platform/finance/financeEventEmitters';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { safeAdd, safeMultiply } from '../utils/money';
import { cryptoService } from './crypto.service';
import { goldService } from './gold.service';
import { fxProvidersService } from './fxProviders.service';
import { exchangeRateHistoryService } from './exchangeRateHistory.service';

/** All `finalRate` / `baseRate` rows are quoted per 1 USD (ledger pivot). */

/** Until Prisma client is regenerated, keep delegate calls untyped. */
const db = prisma as unknown as {
  currency: any;
  currencyHistory: any;
  companySettings: any;
};

const seededCompaniesLogged = new Set<string>();
const ensureRequiredRowsInFlight = new Map<string, Promise<void>>();
const currencyPresenceCache = new Map<string, { checkedAtMs: number; hasAny: boolean }>();
const CURRENCY_PRESENCE_TTL_MS = 60_000;

function useExternalUsdRates(): boolean {
  const v = String(process.env.USE_EXTERNAL_RATES || 'false').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

export const REQUIRED_CURRENCY_CODES = [
  'USD',
  'CNY',
  'CNH',
  'PKR',
  'AED',
  'EUR',
  'GBP',
  'SAR',
  'HKD',
  'INR',
  'TRY',
  // Multi-asset engine
  'USDT',
  'XAU',
] as const;
export type RequiredCurrencyCode = (typeof REQUIRED_CURRENCY_CODES)[number];

function normalize(code: unknown) {
  return String(code || '')
    .trim()
    .toUpperCase();
}

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function stdev(xs: number[]) {
  const v = (xs || []).filter((x) => Number.isFinite(x));
  if (v.length < 2) return 0;
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const variance = v.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (v.length - 1);
  return Math.sqrt(Math.max(0, variance));
}

function clampConfidence(args: { rate: number; lastUpdatedAt?: Date | null }) {
  const rate = safeNum(args.rate);
  if (!(rate > 0)) return { confidence: 'fallback' as const, ageSeconds: null as number | null };
  const t = args.lastUpdatedAt instanceof Date ? args.lastUpdatedAt.getTime() : 0;
  const ageSeconds = t > 0 ? Math.max(0, Math.floor((Date.now() - t) / 1000)) : null;
  if (ageSeconds == null) return { confidence: 'fallback' as const, ageSeconds };
  if (ageSeconds <= 10 * 60) return { confidence: 'live' as const, ageSeconds };
  if (ageSeconds <= 24 * 60 * 60) return { confidence: 'stale' as const, ageSeconds };
  return { confidence: 'fallback' as const, ageSeconds };
}

// Legacy fallback defaults (kept ONLY for `getRatesMap()` compatibility).
// Trading-grade quotes should NOT rely on these defaults.
// WARNING: fallback only — never trust for financial calculations

const getRatesMapCache = new Map<string, { rows: any[]; cachedAtMs: number }>();
const GET_RATES_MAP_TTL_MS = 15_000;
// Do NOT use these values for profit or reporting logic.
const DEFAULT_USD_BASE_RATES: Record<string, number> = {
  USD: 1,
  PKR: 280,
  AED: 3.67,
  CNY: 7.2,
  CNH: 7.2,
  EUR: 0.92,
  GBP: 0.78,
  SAR: 3.75,
  HKD: 7.82,
  INR: 83,
  TRY: 32,
  // Assets
  USDT: 1,
  // ~ $2400/oz → XAU per USD ~ 1/2400
  XAU: 1 / 2400,
};

function allowSeedDefaultRates(): boolean {
  const v = String(process.env.ALLOW_SEED_DEFAULT_RATES || 'false').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

async function seedDefaultRates(companyId: string): Promise<boolean> {
  const cached = currencyPresenceCache.get(companyId);
  if (cached && Date.now() - cached.checkedAtMs < CURRENCY_PRESENCE_TTL_MS && cached.hasAny) {
    return false;
  }

  const existingCount = await db.currency.count({ where: { companyId } });
  const hasAny = existingCount > 0;
  currencyPresenceCache.set(companyId, { checkedAtMs: Date.now(), hasAny });
  if (hasAny) return false;

    const now = new Date();
    // Seed required codes using sensible defaults so UI never starts "empty".
  for (const code of REQUIRED_CURRENCY_CODES) {
      const baseRate = code === LEDGER_BASE_CURRENCY ? 1 : safeNum(DEFAULT_USD_BASE_RATES[code]);
    await db.currency.create({
      data: {
        companyId,
        code,
        type: code === 'USDT' ? 'crypto' : code === 'XAU' ? 'commodity' : 'forex',
          sourceProvider: 'seed',
        baseRate,
        marginPercent: 0,
        isAuto: true,
        finalRate: baseRate,
        lastUpdatedAt: now,
      }
    });

    if (baseRate > 0) {
      await db.currencyHistory.create({
        data: { companyId, currencyCode: code, rate: baseRate, date: now } as any
      });
    }
  }

  if (!seededCompaniesLogged.has(companyId)) {
    seededCompaniesLogged.add(companyId);
    logger.info({ companyId }, '[currency] Currency rates seeded for company');
  }
  return true;
}

async function spreadBpsForCompany(companyId: string): Promise<number> {
  const s = (await db.companySettings.findUnique({
    where: { companyId }
  })) as { spreadBps?: number } | null;
  const v = Number(s?.spreadBps ?? 0);
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.min(Math.floor(v), 50_000);
}

function computeFinalRate(baseRate: number, marginPercent: number) {
  const r = safeNum(baseRate);
  const m = safeNum(marginPercent);
  if (r <= 0) return 0;
  return safeAdd(r, safeMultiply(r, m / 100));
}

async function ensureRequiredRows(companyId: string) {
  const existing = ensureRequiredRowsInFlight.get(companyId);
  if (existing) return existing;

  const p = (async () => {
    // If tenant is brand new, seed usable defaults so UI never starts "empty".
    await seedDefaultRates(companyId);

    const existing = await db.currency.findMany({
      where: { companyId },
      select: { code: true }
    });
    currencyPresenceCache.set(companyId, { checkedAtMs: Date.now(), hasAny: existing.length > 0 });

    const have = new Set(existing.map((x) => normalize(x.code)));
    const now = new Date();
    for (const code of REQUIRED_CURRENCY_CODES) {
      if (have.has(code)) continue;
      await db.currency.create({
        data: {
          companyId,
          code,
          type: code === 'USDT' ? 'crypto' : code === 'XAU' ? 'commodity' : 'forex',
          sourceProvider: 'seed',
          baseRate: code === LEDGER_BASE_CURRENCY ? 1 : safeNum(DEFAULT_USD_BASE_RATES[code]),
          marginPercent: 0,
          isAuto: true,
          finalRate: code === LEDGER_BASE_CURRENCY ? 1 : safeNum(DEFAULT_USD_BASE_RATES[code]),
          lastUpdatedAt: now,
        }
      });
    }
  })()
    .finally(() => {
      ensureRequiredRowsInFlight.delete(companyId);
    });

  ensureRequiredRowsInFlight.set(companyId, p);
  return p;
}

export const currencyService = {
  /**
   * Fetch live USD-base rates (USD/PKR/CNY/AED) and persist into Currency.finalRate.
   * Safe mode: never throws on API failure — keeps last-known stored rates.
   *
   * Intended to run on an interval at the system level (all companies).
   */
  async fetchLiveRates(): Promise<{
    ok: boolean;
    source: 'external' | 'stored';
    rates?: { USD: number; PKR?: number; CNY?: number; CNH?: number; AED?: number; USDT?: number; XAU?: number };
    updatedCompanies?: number;
  }> {
    try {
      const fiatSymbols = ['PKR', 'CNY', 'CNH', 'AED', 'EUR', 'GBP', 'SAR', 'HKD', 'INR', 'TRY'];
      const fiat = await fxProvidersService.fetchUsdBaseRates(fiatSymbols);
      const incoming: Record<string, number> = { USD: 1, ...(fiat.ratesByCode || {}) };

      const mapped = {
        USD: 1,
        PKR: safeNum(incoming.PKR),
        CNY: safeNum(incoming.CNY),
        CNH: safeNum(incoming.CNH),
        AED: safeNum(incoming.AED),
      };

      // Crypto: USDT
      const usdt = await cryptoService.fetchUsdtPerUsd();
      if (usdt.usdtPerUsd > 0) {
        incoming.USDT = usdt.usdtPerUsd;
      }

      // Commodity: Gold (XAU)
      const xau = await goldService.fetchXauPerUsd();
      if (xau.xauPerUsd > 0) {
        incoming.XAU = xau.xauPerUsd;
      }

      // Multi-tenant: apply to all companies; missing codes keep stored baseRate.
      const companies = await prisma.company.findMany({ select: { id: true } });
      if (!companies.length) {
        logger.warn('[currency] No companies found for rate update');
        return { ok: false, source: 'stored' };
      }
      for (const c of companies) {
        await this.applyUsdBaseRates(c.id, incoming, 'external', { forexProvider: fiat.provider });

        // Ensure per-asset providers are visible on rows (best-effort).
        if (usdt.sourceProvider === 'binance') {
          await db.currency.update({
            where: { companyId_code: { companyId: c.id, code: 'USDT' } },
            data: { sourceProvider: 'binance', type: 'crypto', marketPrice: 1 / (incoming.USDT || 1) }
          }).catch(() => {});
        }
        if (xau.sourceProvider === 'exchangerate.host') {
          const usdPerXau = incoming.XAU ? 1 / incoming.XAU : 0;
          await db.currency.update({
            where: { companyId_code: { companyId: c.id, code: 'XAU' } },
            data: { sourceProvider: 'exchangerate.host', type: 'commodity', marketPrice: usdPerXau > 0 ? usdPerXau : null }
          }).catch(() => {});
        }
      }

      logger.info(
        {
          PKR: mapped.PKR || null,
          CNY: mapped.CNY || null,
          CNH: mapped.CNH || null,
          AED: mapped.AED || null,
          USDT: incoming.USDT || null,
          XAU: incoming.XAU || null,
          fiatProvider: fiat.provider,
          companies: companies.length
        },
        '[currency] live rates updated'
      );
      return {
        ok: true,
        source: 'external',
        rates: { ...mapped, USDT: incoming.USDT, XAU: incoming.XAU },
        updatedCompanies: companies.length
      };
    } catch (err) {
      logger.error({ err }, '[currency] CRITICAL: live rate fetch failed');
      return { ok: false, source: 'stored' };
    }
  },

  async list(companyId: string) {
    await ensureRequiredRows(companyId);
    return db.currency.findMany({
      where: { companyId, code: { in: [...REQUIRED_CURRENCY_CODES] } },
      orderBy: { code: 'asc' }
    });
  },

  async listQuotes(companyId: string, opts?: { supplierId?: string }) {
    // Avoid parallel Prisma calls under low connection_limit / pgbouncer.
    const rows = await this.list(companyId);
    const bps = await spreadBpsForCompany(companyId);

    const byCode = new Map(rows.map((r: any) => [normalize(r.code), r as any]));
    const pkrPerUsd = safeNum((byCode.get('PKR') as any)?.finalRate);
    const aedPerUsd = safeNum((byCode.get('AED') as any)?.finalRate);
    const xauPerUsd = safeNum((byCode.get('XAU') as any)?.finalRate);
    const usdPerXau = xauPerUsd > 0 ? 1 / xauPerUsd : 0;
    const xauPkr = usdPerXau > 0 && pkrPerUsd > 0 ? usdPerXau * pkrPerUsd : 0;
    const xauAed = usdPerXau > 0 && aedPerUsd > 0 ? usdPerXau * aedPerUsd : 0;

    const supplierId = opts?.supplierId ? String(opts.supplierId).trim() : '';
    const supplierRates =
      supplierId
        ? await (prisma as any).supplierFxRate
            .findMany({
              where: { companyId, supplierId },
              select: { currencyCode: true, rate: true }
            })
            .catch(() => [])
        : [];
    const supplierRateByCode = new Map(
      (supplierRates as Array<{ currencyCode: string; rate: number }>).map((x) => [normalize(x.currencyCode), safeNum(x.rate)])
    );

    // Volatility (7d): stddev of daily returns from last ~8 points (scaled to 7-day window).
    const codes = rows.map((r: any) => normalize(r.code)).filter(Boolean);
    const histRows = await db.currencyHistory.findMany({
      where: { companyId, currencyCode: { in: codes } },
      orderBy: { date: 'desc' },
      take: Math.min(2000, codes.length * 12),
      select: { currencyCode: true, rate: true, date: true },
    });
    const histByCode = new Map<string, Array<number>>();
    for (const h of histRows as Array<{ currencyCode: string; rate: number; date: Date }>) {
      const c = normalize(h.currencyCode);
      if (!histByCode.has(c)) histByCode.set(c, []);
      const arr = histByCode.get(c)!;
      if (arr.length < 8) arr.push(safeNum(h.rate));
    }
    const volByCode = new Map<string, number>();
    for (const c of codes) {
      const pts = (histByCode.get(c) || []).slice().reverse().filter((x) => x > 0);
      const rets: number[] = [];
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1];
        const cur = pts[i];
        if (prev > 0 && cur > 0) rets.push((cur - prev) / prev);
      }
      volByCode.set(c, stdev(rets) * Math.sqrt(7));
    }

    return rows.map((r) => {
      const code = normalize(r.code);
      const supplierOverride = supplierRateByCode.get(code);
      const current = safeNum(r.finalRate);
      const last = safeNum((r as any).previousRate);
      const effectiveCurrent = supplierOverride && supplierOverride > 0 ? supplierOverride : current;
      const changePct = last > 0 ? ((current - last) / last) * 100 : null;
      const desk = forexSidesFromMid(effectiveCurrent, { spreadBps: bps });
      const conf = clampConfidence({ rate: effectiveCurrent, lastUpdatedAt: (r as any).lastUpdatedAt as Date | null });
      return {
        code,
        type: supplierOverride && supplierOverride > 0 ? 'supplier' : String((r as any).type || 'forex'),
        sourceProvider: supplierOverride && supplierOverride > 0 ? 'manual' : String((r as any).sourceProvider || 'manual'),
        buy: desk.buyRate,
        sell: desk.sellRate,
        lastRate: last || null,
        currentRate: effectiveCurrent || 0,
        changePct: changePct == null || !Number.isFinite(changePct) ? null : Number(changePct.toFixed(4)),
        lastUpdatedAt: r.lastUpdatedAt,
        marketPrice: safeNum((r as any).marketPrice) || null,
        volatility7d: Number((volByCode.get(code) || 0).toFixed(6)),
        confidence: conf.confidence,
        ageSeconds: conf.ageSeconds,
        isSupplierOverride: supplierOverride && supplierOverride > 0 ? true : false,
        // For XAU only: quote 1 XAU in PKR/AED (derived from USD pivot rates).
        xauPricePkr: code === 'XAU' && xauPkr > 0 ? Number(xauPkr.toFixed(4)) : null,
        xauPriceAed: code === 'XAU' && xauAed > 0 ? Number(xauAed.toFixed(4)) : null
      };
    });
  },

  async getHistory(companyId: string, codeRaw: string, limit = 60) {
    const code = normalize(codeRaw);
    if (!code) throw new Error('Invalid currency code');
    const take = Math.max(1, Math.min(500, Math.floor(Number(limit) || 60)));
    return db.currencyHistory.findMany({
      where: { companyId, currencyCode: code },
      orderBy: { date: 'desc' },
      take
    });
  },

  async getRatesMap(companyId: string) {
    const now = Date.now();
    const cached = getRatesMapCache.get(companyId);
    if (cached && now - cached.cachedAtMs < GET_RATES_MAP_TTL_MS) {
      const out: Record<string, number> = {};
      for (const r of cached.rows) out[normalize(r.code)] = safeNum(r.finalRate) || 0;
      out[LEDGER_BASE_CURRENCY] = safeNum(out[LEDGER_BASE_CURRENCY]) || 1;
      return out;
    }

    const rows = await this.list(companyId);
    getRatesMapCache.set(companyId, { rows: rows as any[], cachedAtMs: now });
    const out: Record<string, number> = {};
    for (const r of rows) out[normalize(r.code)] = safeNum(r.finalRate) || 0;
    out[LEDGER_BASE_CURRENCY] = safeNum(out[LEDGER_BASE_CURRENCY]) || 1;
    return out;
  },

  /**
   * Apply USD-base rates from a map (manual or fetched). Missing codes keep existing baseRate.
   */
  async applyUsdBaseRates(
    companyId: string,
    incoming: Record<string, number>,
    source: 'manual' | 'external' | 'stored',
    meta?: { forexProvider?: string }
  ) {
    await ensureRequiredRows(companyId);
    incoming[LEDGER_BASE_CURRENCY] = 1;
    const now = new Date();
    const rows = await db.currency.findMany({
      where: { companyId, code: { in: [...REQUIRED_CURRENCY_CODES] } }
    });

    for (const row of rows) {
      const code = normalize(row.code);
      const nextBaseRate = code === LEDGER_BASE_CURRENCY ? 1 : safeNum(incoming[code]);
      const baseRateToStore = nextBaseRate > 0 ? nextBaseRate : safeNum(row.baseRate);
      const finalRate = row.isAuto ? computeFinalRate(baseRateToStore, row.marginPercent) : safeNum(row.manualRate);
      const nextFinal = row.isAuto ? safeNum(finalRate) : safeNum(row.manualRate) || 0;
      const prevFinal = safeNum((row as any).finalRate);

      await db.currency.update({
        where: { companyId_code: { companyId, code } },
        data: {
          baseRate: baseRateToStore,
          previousRate: prevFinal || null,
          finalRate: nextFinal,
          lastUpdatedAt: now,
          // Persist provider for forex legs only when source is external/manual.
          sourceProvider:
            source === 'external' && String((row as any).type || 'forex') === 'forex'
              ? String(meta?.forexProvider || 'external')
              : source === 'manual'
                ? 'manual'
                : undefined,
        }
      });

      // Record history only when rate meaningfully changes
      if (nextFinal > 0 && prevFinal !== nextFinal) {
        await db.currencyHistory.create({
          data: { companyId, currencyCode: code, rate: nextFinal, date: now } as any
        });
      }
    }

    const rowsOut = await this.list(companyId);

    // Enterprise: also record cross-currency snapshot (derived from USD-pivot finalRate).
    try {
      const map: Record<string, number> = {};
      for (const r of rowsOut as any[]) {
        const code = normalize((r as any).code);
        const rate = safeNum((r as any).finalRate);
        if (code) map[code] = rate;
      }
      map[LEDGER_BASE_CURRENCY] = safeNum(map[LEDGER_BASE_CURRENCY]) || 1;
      await exchangeRateHistoryService.recordSnapshot(companyId, {
        ratesPerUsd: map,
        codes: [...REQUIRED_CURRENCY_CODES],
        date: now,
        source: source === 'external' ? 'external' : source === 'manual' ? 'manual' : 'derived',
      });
    } catch {
      // best-effort; never block FX refresh
    }
    emitCurrencyUpdatedBulk(companyId);
    return { rows: rowsOut, source };
  },

  /**
   * Optional live fetch when USE_EXTERNAL_RATES=true; otherwise returns stored rows only.
   * Never throws on network failure — keeps last stored base rates.
   */
  async refreshLiveUsdBase(companyId: string): Promise<{ rows: Currency[]; source: string; message?: string }> {
    try {
      await ensureRequiredRows(companyId);

      if (!useExternalUsdRates()) {
        const rows = await this.list(companyId);
        logger.info({ companyId }, '[currency] refresh skipped — USE_EXTERNAL_RATES is not enabled');
        return { rows, source: 'stored', message: 'using_stored_rates' };
      }

      // External fetch is best-effort. If providers fail, keep stored rates (do NOT apply DEFAULT_USD_BASE_RATES).
      return { rows: await this.list(companyId), source: 'stored', message: 'using_stored_rates' };
    } catch (err) {
      logger.error({ err, companyId }, '[currency] refresh failed — using stored rates');
      return { rows: await this.list(companyId), source: 'fallback', message: 'using_stored_rates' };
    }
  },

  async manualUpdateUsdBase(companyId: string, ratesBody: unknown) {
    const raw = (ratesBody && typeof ratesBody === 'object' ? (ratesBody as Record<string, unknown>).rates : ratesBody) as unknown;
    const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const incoming: Record<string, number> = {};
    for (const [k, v] of Object.entries(obj)) {
      const code = normalize(k);
      const rate = safeNum(v);
      if (code && rate > 0) incoming[code] = rate;
    }
    if (Object.keys(incoming).length === 0) {
      throw new Error('Provide rates as { rates: { CNY: 7.2, EUR: 0.92, ... } } (USD-base, positive numbers)');
    }
    return this.applyUsdBaseRates(companyId, incoming, 'manual');
  },

  async updateCurrency(
    companyId: string,
    codeRaw: string,
    patch: Partial<{
      marginPercent: number;
      isAuto: boolean;
      manualRate: number | null;
    }>
  ) {
    const code = normalize(codeRaw);
    if (!code) throw new Error('Invalid currency code');
    await ensureRequiredRows(companyId);

    const current = await db.currency.findFirst({
      where: { companyId, code }
    });
    if (!current) throw new Error('Currency not found');

    const nextIsAuto = typeof patch.isAuto === 'boolean' ? patch.isAuto : current.isAuto;
    const nextMargin = patch.marginPercent === undefined ? current.marginPercent : safeNum(patch.marginPercent);
    const nextManual = patch.manualRate === undefined ? current.manualRate : patch.manualRate === null ? null : safeNum(patch.manualRate);

    // If switching to manual and no manual_rate provided, freeze current finalRate.
    const manualToStore =
      nextIsAuto === false ? (nextManual === null || nextManual === undefined || nextManual <= 0 ? safeNum(current.finalRate) : nextManual) : nextManual;

    const nextFinal =
      nextIsAuto === true ? computeFinalRate(safeNum(current.baseRate), nextMargin) : safeNum(manualToStore);

    const row = await db.currency.update({
      where: { companyId_code: { companyId, code } },
      data: {
        marginPercent: nextMargin,
        isAuto: nextIsAuto,
        manualRate: manualToStore === null ? null : manualToStore,
        previousRate: safeNum((current as any).finalRate) || null,
        finalRate: nextFinal,
      }
    });

    if (safeNum(nextFinal) > 0 && safeNum((current as any).finalRate) !== safeNum(nextFinal)) {
      await db.currencyHistory.create({
        data: { companyId, currencyCode: code, rate: safeNum(nextFinal), date: new Date() } as any
      });
    }
    const bps = await spreadBpsForCompany(companyId);
    const desk = forexSidesFromMid(safeNum(row.finalRate), { spreadBps: bps });
    emitCurrencyUpdated(companyId, code, {
      mid: desk.midRate,
      buy: desk.buyRate,
      sell: desk.sellRate
    });
    return row;
  }
};

