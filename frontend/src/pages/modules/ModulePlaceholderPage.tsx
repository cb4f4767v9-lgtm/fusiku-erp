import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { PageLayout, PageHeader } from '../../components/design-system';
import { usePageTitle } from '../../hooks/usePageTitle';

const ROUTE_META: Record<string, { titleKey: string; subtitleKey: string }> = {
  '/institute/courses': {
    titleKey: 'institute.coursesTitle',
    subtitleKey: 'institute.coursesSubtitle',
  },
  '/institute/batches': {
    titleKey: 'institute.batchesTitle',
    subtitleKey: 'institute.batchesSubtitle',
  },
  '/institute/attendance': {
    titleKey: 'institute.attendanceTitle',
    subtitleKey: 'institute.attendanceSubtitle',
  },
  '/parts-catalog': {
    titleKey: 'parts.catalogTitle',
    subtitleKey: 'parts.catalogSubtitle',
  },
  '/sourcing': {
    titleKey: 'sourcing.requestsTitle',
    subtitleKey: 'sourcing.requestsSubtitle',
  },
};

export default function ModulePlaceholderPage() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const key = useMemo(() => pathname.replace(/\/+$/, '') || '/', [pathname]);
  const meta = ROUTE_META[key] ?? {
    titleKey: 'modules.placeholder.title',
    subtitleKey: 'modules.placeholder.subtitle',
  };

  usePageTitle(meta.titleKey);

  return (
    <PageLayout className="page">
      <PageHeader
        title={t(meta.titleKey, { defaultValue: 'Module' })}
        subtitle={t(meta.subtitleKey, {
          defaultValue: 'Schema and navigation are wired; CRUD APIs will land in the next iteration.',
        })}
      />
      <div className="card" style={{ maxWidth: 720 }}>
        <p className="muted">
          {t('modules.placeholder.body', {
            defaultValue:
              'This screen is a stable shell for the new vertical. Database tables and permissions are in place — hook up forms and lists without renaming routes.',
          })}
        </p>
      </div>
    </PageLayout>
  );
}
