import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getBaseLanguage } from '../utils/i18nLocale';

/**
 * Returns the base UI language (en/zh/ar/ur) for applying `lang` attributes on inputs.
 * This helps mobile/IME keyboards pick the right language direction/shaping.
 */
export function useInputLanguage(): string {
  const { i18n } = useTranslation();
  return useMemo(() => getBaseLanguage(i18n.resolvedLanguage || i18n.language), [i18n.language, i18n.resolvedLanguage]);
}

