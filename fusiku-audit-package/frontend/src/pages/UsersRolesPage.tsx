import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { PageLayout, PageHeader } from '../components/design-system';
import { EmptyState } from '../components/PageStates';

export function UsersRolesPage() {
  const { t } = useTranslation();
  return (
    <PageLayout className="page">
      <PageHeader
        title={t('nav.usersRoles') || 'Users & Roles'}
        subtitle={t('usersRoles.subtitle') || 'Manage users, roles, and permissions (RBAC) safely.'}
      />
      <div className="fade-in">
        <EmptyState
          className="card"
          icon={<ShieldCheck />}
          title={t('nav.usersRoles') || 'Users & Roles'}
          description={
            t('usersRoles.emptyDescription') ||
            'Role management is being prepared with premium-grade controls, clear permission visibility, and safer admin workflows.'
          }
          action={
            <Link to="/settings" className="btn btn-primary">
              {t('nav.settings') || 'Settings'}
            </Link>
          }
        />
      </div>
    </PageLayout>
  );
}

