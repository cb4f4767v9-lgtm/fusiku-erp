import i18n from '../i18n';
import { intlLocaleFromLanguageTag } from './localeFormat';

/** Active UI language tag for Intl (synced with i18next). */
export function getFormatLanguageTag(): string {
  return i18n.resolvedLanguage || i18n.language || 'en';
}

function resolveIntlLocale(locale?: string | null): string {
  return intlLocaleFromLanguageTag(locale || getFormatLanguageTag());
}

/**
 * l10n: format a number using an explicit BCP-47-ish language tag, or the active i18next language.
 * @see formatNumberForUi — same behavior when `locale` is omitted.
 */
export function formatNumber(value: number, locale?: string | null, options?: Intl.NumberFormatOptions): string {
  const intlLocale = resolveIntlLocale(locale);
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat(intlLocale, options).format(n);
}

/**
 * l10n: format a date using `localeFormat` mapping when `locale` is a UI base code (en/zh/ar/ur),
 * or pass a full BCP-47 tag.
 */
export function formatDate(
  date: Date | string | number | null | undefined,
  locale?: string | null,
  options?: Intl.DateTimeFormatOptions
): string {
  if (date == null || date === '') return '';
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const intlLocale = resolveIntlLocale(locale);
  return new Intl.DateTimeFormat(intlLocale, options ?? { dateStyle: 'short' }).format(d);
}

/**
 * l10n: format currency; `locale` optional — defaults to active UI language via `localeFormat.ts`.
 */
export function formatCurrency(
  amount: number,
  currency: string,
  locale?: string | null,
  options?: Intl.NumberFormatOptions
): string {
  const code = String(currency || 'USD')
    .trim()
    .toUpperCase() || 'USD';
  const intlLocale = resolveIntlLocale(locale);
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  try {
    return new Intl.NumberFormat(intlLocale, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'code',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
      ...options,
    }).format(n);
  } catch {
    return `${code} ${formatNumber(n, locale, { maximumFractionDigits: 2 })}`;
  }
}

export function formatNumberForUi(value: number, options?: Intl.NumberFormatOptions): string {
  return formatNumber(value, getFormatLanguageTag(), options);
}

export function formatDateForUi(
  input: Date | string | number | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  return formatDate(input, getFormatLanguageTag(), options);
}

export function formatDateTimeForUi(input: Date | string | number | null | undefined): string {
  return formatDateForUi(input, { dateStyle: 'short', timeStyle: 'short' });
}

export function formatCurrencyForUi(
  amount: number,
  currencyCode: string,
  options?: Intl.NumberFormatOptions
): string {
  return formatCurrency(amount, currencyCode, getFormatLanguageTag(), options);
}
