/**
 * Normalize BCP 47 tags (e.g. en-US → en) for RTL, document.lang, and locale logic.
 */
export function getBaseLanguage(lng?: string | null): string {
  const raw = (lng || '').trim();
  if (!raw) return 'en';
  return raw.split('-')[0]!.toLowerCase();
}

export const RTL_BASE_LANGUAGES = new Set(['ar', 'ur']);

export function isRtlBaseLanguage(base: string): boolean {
  return RTL_BASE_LANGUAGES.has(base);
}
