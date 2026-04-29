export type Brand = {
  code: string;
  name: string;
};

export const BRANDS: Brand[] = [
  { code: 'APPLE', name: 'Apple' },
  { code: 'SAMSUNG', name: 'Samsung' },
  { code: 'XIAOMI', name: 'Xiaomi' },
  { code: 'REDMI', name: 'Redmi' },
  { code: 'REALME', name: 'Realme' },
  { code: 'ONEPLUS', name: 'OnePlus' },
];

/** Canonicalize brand identifiers for UI (select + filters). */
export function normalizeBrandCode(input: unknown): string {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  const hit = BRANDS.find((b) => b.name.toLowerCase() === raw.toLowerCase() || b.code === raw.toUpperCase());
  if (hit) return hit.code;
  // Allow unknowns but standardize formatting.
  return raw.toUpperCase().replace(/\s+/g, '_');
}

export function resolveBrandName(input: unknown): string {
  const code = normalizeBrandCode(input);
  if (!code) return '';
  const hit = BRANDS.find((b) => b.code === code);
  return hit?.name || String(input ?? '').trim() || code;
}
