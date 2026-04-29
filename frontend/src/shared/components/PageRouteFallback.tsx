import { useTranslation } from 'react-i18next';

/**
 * Shown while lazy-loaded route chunks load (keep lightweight — no heavy chart deps).
 */
export function PageRouteFallback() {
  const { t } = useTranslation();
  return (
    <div className="loading-screen" role="status" aria-busy="true" aria-label={t('common.loading')} />
  );
}
