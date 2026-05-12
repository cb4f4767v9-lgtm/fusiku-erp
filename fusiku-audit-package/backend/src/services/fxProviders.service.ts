import { logger } from '../utils/logger';

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export type UsdRatesFetchResult = {
  ok: boolean;
  provider: 'exchangerate.host' | 'open.er-api.com' | 'fallback';
  ratesByCode: Record<string, number>; // units per 1 USD
};

async function fetchFromExchangeRateHost(symbols: string[]): Promise<Record<string, number> | null> {
  try {
    const url = `https://api.exchangerate.host/latest?base=USD&symbols=${encodeURIComponent(symbols.join(','))}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { rates?: Record<string, unknown> };
    const rates = data?.rates || {};
    const out: Record<string, number> = { USD: 1 };
    for (const s of symbols) {
      const r = safeNum((rates as any)[s]);
      if (r > 0) out[String(s).toUpperCase()] = r;
    }
    return out;
  } catch (err) {
    logger.warn({ err }, '[fxProviders] exchangerate.host failed');
    return null;
  }
}

async function fetchFromOpenErApi(symbols: string[]): Promise<Record<string, number> | null> {
  try {
    // API returns "rates" keyed by currency code, base USD.
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) return null;
    const data = (await res.json()) as { rates?: Record<string, unknown> };
    const rates = data?.rates || {};
    const out: Record<string, number> = { USD: 1 };
    for (const s of symbols) {
      const r = safeNum((rates as any)[s]);
      if (r > 0) out[String(s).toUpperCase()] = r;
    }
    return out;
  } catch (err) {
    logger.warn({ err }, '[fxProviders] open.er-api.com failed');
    return null;
  }
}

export const fxProvidersService = {
  async fetchUsdBaseRates(symbols: string[]): Promise<UsdRatesFetchResult> {
    const wanted = Array.from(new Set((symbols || []).map((s) => String(s || '').trim().toUpperCase()).filter(Boolean)));
    if (!wanted.includes('USD')) wanted.unshift('USD');
    const symbolsNoUsd = wanted.filter((x) => x !== 'USD');

    // Provider order: primary -> fallback
    const a = await fetchFromExchangeRateHost(symbolsNoUsd);
    if (a) return { ok: true, provider: 'exchangerate.host', ratesByCode: a };

    const b = await fetchFromOpenErApi(symbolsNoUsd);
    if (b) return { ok: true, provider: 'open.er-api.com', ratesByCode: b };

    return { ok: false, provider: 'fallback', ratesByCode: { USD: 1 } };
  },
};

