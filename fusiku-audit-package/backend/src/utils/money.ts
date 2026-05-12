/**
 * Float-safe money helpers (staging for future Decimal migration).
 * Centralize arithmetic so we can swap implementation later without touching every call site.
 */

const DEFAULT_MONEY_DECIMALS = 2;

/** Round a monetary float to a fixed number of decimal places (banker's rounding not required for staging). */
export function roundMoney(value: number, decimals = DEFAULT_MONEY_DECIMALS): number {
  const x = Number(value);
  if (!Number.isFinite(x)) return 0;
  const p = 10 ** decimals;
  return Math.round(x * p) / p;
}

export function safeAdd(a: number, b: number): number {
  return roundMoney(Number(a) + Number(b), 6);
}

export function safeMultiply(a: number, b: number): number {
  return roundMoney(Number(a) * Number(b), 6);
}

/** Sum monetary floats via `safeAdd` (staging for Decimal migration). */
export function sumMoney(values: Iterable<number>): number {
  let t = 0;
  for (const v of values) {
    t = safeAdd(t, Number(v));
  }
  return roundMoney(t, 6);
}
