import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { activityApi } from '../services/api';
import { PageLayout, PageHeader, TableWrapper } from '../components/design-system';

export function SystemActivityPage() {
  const { t, i18n } = useTranslation();
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    activityApi.getAll().then((r) => setLogs(r.data)).catch(() => setLogs([]));
  }, []);

  const actionLabel = (a: string) => {
    const map: Record<string, string> = {
      user_login: 'activity.actions.user_login',
      inventory_create: 'activity.actions.inventory_create',
      inventory_edit: 'activity.actions.inventory_edit',
      purchase_create: 'activity.actions.purchase_create',
      sale_completion: 'activity.actions.sale_completion',
      repair_create: 'activity.actions.repair_create',
      repair_completion: 'activity.actions.repair_completion',
      transfer_approval: 'activity.actions.transfer_approval'
    };
    return t(map[a] || 'activity.actions.unknown', { action: a });
  };

  return (
    <PageLayout className="page">
      <PageHeader title={t('activity.title')} />
      <TableWrapper>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('activity.columns.time')}</th>
              <th>{t('activity.columns.user')}</th>
              <th>{t('activity.columns.action')}</th>
              <th>{t('activity.columns.entity')}</th>
              <th>{t('activity.columns.entityId')}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>
                  {new Intl.DateTimeFormat(i18n.language).format(new Date(l.timestamp))}
                </td>
                <td>{l.user?.name || '-'}</td>
                <td><span className="badge">{actionLabel(l.action)}</span></td>
                <td>{l.entityType}</td>
                <td>{l.entityId || '-'}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5}>{t('activity.noActivity')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </TableWrapper>
    </PageLayout>
  );
}
