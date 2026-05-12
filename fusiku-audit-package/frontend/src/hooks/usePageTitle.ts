import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Sets the browser tab title using i18n keys.
 * Example: "Inventory · Fusiku"
 */
export function usePageTitle(titleKey: string, options?: Record<string, unknown>) {
  const { t } = useTranslation();

  useEffect(() => {
    const brand = t('brand.name');
    const title = t(titleKey, options);
    document.title = title ? `${title} · ${brand}` : brand;
  }, [t, titleKey, options]);
}

