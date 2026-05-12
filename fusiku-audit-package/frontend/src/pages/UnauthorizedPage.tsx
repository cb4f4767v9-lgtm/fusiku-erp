import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { PageLayout, PageHeader } from '../components/design-system';
import { canAccessModule } from '../utils/permissions';

export function UnauthorizedPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const hint = useMemo(() => {
    if (!user) return t('common.unauthorized');
    if (!canAccessModule(user, 'admin.any')) return t('common.noAccessFeature');
    return t('common.unauthorized');
  }, [t, user]);

  return (
    <PageLayout className="page">
      <PageHeader title={t('common.unauthorizedTitle', { defaultValue: 'Unauthorized' })} subtitle={hint} />
      <div className="card" style={{ maxWidth: 720 }}>
        <p className="muted">
          {t('common.noAccessFeature', { defaultValue: "You don’t have access to this feature" })}
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <Link to="/" className="btn btn-primary">
            {t('common.goToDashboard', { defaultValue: 'Go to dashboard' })}
          </Link>
          <Link to="/settings" className="btn btn-secondary">
            {t('nav.settings')}
          </Link>
        </div>
      </div>
    </PageLayout>
  );
}

