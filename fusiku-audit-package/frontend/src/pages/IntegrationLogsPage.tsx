import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { integrationLogsApi } from '../services/api';
import { PageLayout, PageHeader, TableWrapper, LoadingSkeleton } from '../components/design-system';
import { formatDateTimeForUi } from '../utils/formatting';

export function IntegrationLogsPage() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    integrationLogsApi.list({ limit: 100 }).then((r) => setLogs(r.data)).catch(() => setLogs([])).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <PageLayout className="page">
        <PageHeader title={t('integrationLogs.title')} subtitle={t('integrationLogs.subtitle')} />
        <LoadingSkeleton rows={8} cols={4} />
      </PageLayout>
    );
  }

  return (
    <PageLayout className="page">
      <PageHeader title={t('integrationLogs.title')} subtitle={t('integrationLogs.subtitle')} />
      <TableWrapper>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('integrationLogs.timestamp')}</th>
              <th>{t('integrationLogs.type')}</th>
              <th>{t('integrationLogs.status')}</th>
              <th>{t('integrationLogs.details')}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{formatDateTimeForUi(log.timestamp)}</td>
                <td><span className="badge">{log.integrationType}</span></td>
                <td>
                  <span className={`status-badge ${log.responseStatus >= 200 && log.responseStatus < 300 ? 'status-ok' : 'status-error'}`}>
                    {log.responseStatus ?? '-'}
                  </span>
                </td>
                <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {log.errorMessage || (log.requestPayload ? JSON.stringify(log.requestPayload).slice(0, 80) + '...' : '-')}
                </td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={4}>{t('integrationLogs.noLogs')}</td></tr>}
          </tbody>
        </table>
      </TableWrapper>
    </PageLayout>
  );
}
