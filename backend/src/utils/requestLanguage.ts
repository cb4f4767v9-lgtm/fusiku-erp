import type { Request } from 'express';
import { normalizeUiLanguage, type SupportedUiLanguage } from './supportedLocale';

function normalizeBaseLanguage(value: string | undefined | null): string | null {
  const v = String(value || '').trim();
  if (!v) return null;
  // Accept "en-US" / "en_US" / "en"
  const base = v.split(',')[0]?.trim().split(/[-_]/)[0]?.trim().toLowerCase();
  if (!base) return null;
  return base;
}

/** Best-effort language from `x-lang` or `Accept-Language` header. Defaults to "en". */
export function getRequestBaseLanguage(req: Request): SupportedUiLanguage {
  const xLang = normalizeBaseLanguage(req.headers['x-lang'] as string | undefined);
  if (xLang) return normalizeUiLanguage(xLang);

  const acceptLanguage = String(req.headers['accept-language'] || '');
  // "zh,en;q=0.9" → zh
  const headerFirst = acceptLanguage.split(',')[0]?.trim();
  const acceptBase = normalizeBaseLanguage(headerFirst);
  return normalizeUiLanguage(acceptBase || 'en');
}

export function getRequestCurrencyCode(req: Request): string {
  const raw = String(req.headers['x-currency'] || '').trim().toUpperCase();
  if (raw.length === 3 && /^[A-Z]{3}$/.test(raw)) return raw;
  return 'USD';
}

