import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { logsApi } from '../services/api';
import { PageLayout, PageHeader, TableWrapper, LoadingSkeleton } from '../components/design-system';

export function SystemLogsPage() {
  const { t, i18n } = useTranslation();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    logsApi.getAll({ limit: 200 })
      .then((r) => setLogs(r.data))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <PageLayout className="page">
        <PageHeader title={t('logs.title')} subtitle={t('logs.subtitle')} />
        <LoadingSkeleton rows={10} cols={5} />
      </PageLayout>
    );
  }

  return (
    <PageLayout className="page">
      <PageHeader title={t('logs.title')} subtitle={t('logs.subtitle')} />
      <TableWrapper>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('logs.columns.date')}</th>
              <th>{t('logs.columns.user')}</th>
              <th>{t('logs.columns.action')}</th>
              <th>{t('logs.columns.entity')}</th>
              <th>{t('logs.columns.entityId')}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Intl.DateTimeFormat(i18n.language).format(new Date(log.createdAt))}</td>
                <td>{log.user?.name || '—'}</td>
                <td>{log.action}</td>
                <td>{log.entity}</td>
                <td>{log.entityId || '—'}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5}>{t('logs.noLogs')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </TableWrapper>
    </PageLayout>
  );
}
