import { logger } from '../utils/logger';

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function fetchBinanceSymbolPriceUsdPerBase(symbol: string): Promise<number | null> {
  try {
    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { price?: unknown; symbol?: unknown };
    const price = safeNum(data?.price);
    if (!price || price <= 0) return null;
    return price;
  } catch (err) {
    logger.warn({ err, symbol }, '[crypto] binance fetch failed');
    return null;
  }
}

export const cryptoService = {
  /**
   * Returns units per 1 USD, to match Currency convention.
   * For USDTUSD: API returns USD per 1 USDT -> invert => USDT per 1 USD.
   */
  async fetchUsdtPerUsd(): Promise<{ ok: boolean; sourceProvider: 'binance' | 'fallback'; usdtPerUsd: number }> {
    const candidates = ['USDTUSDT', 'USDTUSD'];
    for (const symbol of candidates) {
      const usdPerUsdt = await fetchBinanceSymbolPriceUsdPerBase(symbol);
      if (!usdPerUsdt) continue;
      const usdtPerUsd = 1 / usdPerUsdt;
      if (!Number.isFinite(usdtPerUsd) || usdtPerUsd <= 0) continue;
      return { ok: true, sourceProvider: 'binance', usdtPerUsd };
    }

    // No synthetic fallback: returning 0 prevents overwriting stored real rates.
    return { ok: false, sourceProvider: 'fallback', usdtPerUsd: 0 };
  },
};

