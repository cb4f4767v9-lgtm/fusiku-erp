import { getBaseLanguage } from './i18nLocale';

/**
 * BCP-47 locale for Intl (numbers, dates, grouping) from i18next language tag.
 * Use everywhere amounts/rates are shown so they follow the active UI language.
 */
export function intlLocaleFromLanguageTag(lng?: string | null): string {
  const base = getBaseLanguage(lng);
  const primary: Record<string, string> = {
    en: 'en-US',
    zh: 'zh-CN',
    ar: 'ar-SA',
    ur: 'ur-PK',
  };
  return primary[base] || lng || 'en-US';
}

export function formatDecimalForLanguage(
  value: number,
  languageTag: string | undefined,
  options?: Intl.NumberFormatOptions
): string {
  const locale = intlLocaleFromLanguageTag(languageTag);
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 6,
    ...options,
  }).format(n);
}
