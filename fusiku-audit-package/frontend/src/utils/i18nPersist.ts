import { getBaseLanguage } from './i18nLocale';

const SUPPORTED = new Set(['en', 'zh', 'ar', 'ur']);

/**
 * Offline / first-paint cache for the UI language tag. After login or `GET /auth/me`,
 * `User.language` from the API is authoritative and is applied in `useAuth` (which
 * also updates this key). Do not treat localStorage alone as the source of truth for
 * authenticated users.
 */

/**
 * Reads `i18nextLng` from localStorage and returns a supported base code, or `undefined`.
 */
export function getPersistedLanguage(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem('i18nextLng');
    const base = getBaseLanguage(raw || undefined);
    if (SUPPORTED.has(base)) return base;
  } catch {
    /* ignore */
  }
  return undefined;
}

export function persistLanguageCode(lang: string): void {
  try {
    const base = getBaseLanguage(lang);
    if (SUPPORTED.has(base)) {
      localStorage.setItem('i18nextLng', base);
    }
  } catch {
    /* ignore */
  }
}
