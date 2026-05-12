/** Mirrors backend `forexSidesFromMid` — desk buy/sell/spread from mid + optional spreadBps. */

function n(v: number): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function clampSpreadBps(raw: number | undefined): number {
  const b = Math.floor(Number(raw));
  if (!Number.isFinite(b) || b < 0) return 0;
  return Math.min(b, 50_000);
}

export type ForexMarketSides = {
  midRate: number;
  buyRate: number;
  sellRate: number;
  spread: number;
};

export function forexSidesFromMid(mid: number, options?: { spreadBps?: number }): ForexMarketSides {
  const m = n(mid);
  const bps = clampSpreadBps(options?.spreadBps);
  if (m <= 0) return { midRate: 0, buyRate: 0, sellRate: 0, spread: 0 };
  if (bps === 0) return { midRate: m, buyRate: m, sellRate: m, spread: 0 };
  const buy = m * (1 - bps / 10_000);
  const sell = m * (1 + bps / 10_000);
  return { midRate: m, buyRate: buy, sellRate: sell, spread: sell - buy };
}
