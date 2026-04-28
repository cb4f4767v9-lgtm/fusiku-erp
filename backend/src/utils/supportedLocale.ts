/**
 * Canonical UI / API language codes (aligned with frontend i18n resources).
 */
export const SUPPORTED_UI_LANGUAGES = ['en', 'zh', 'ar', 'ur'] as const;
export type SupportedUiLanguage = (typeof SUPPORTED_UI_LANGUAGES)[number];

const RTL = new Set<SupportedUiLanguage>(['ar', 'ur']);

export function normalizeUiLanguage(raw?: string | null): SupportedUiLanguage {
  const base = String(raw || '')
    .trim()
    .split(/[-_]/)[0]
    ?.toLowerCase();
  if (base && (SUPPORTED_UI_LANGUAGES as readonly string[]).includes(base)) {
    return base as SupportedUiLanguage;
  }
  return 'en';
}

export function textDirectionForLanguage(lang: SupportedUiLanguage): 'ltr' | 'rtl' {
  return RTL.has(lang) ? 'rtl' : 'ltr';
}

/** ISO 4217 normalization (3-letter uppercase). */
export function normalizeCurrencyCode(raw?: string | null): string {
  const c = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  if (c.length === 3) return c;
  return 'USD';
}
