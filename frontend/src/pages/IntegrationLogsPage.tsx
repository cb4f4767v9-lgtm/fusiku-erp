import { useEffect, useState } from 'react';
import { integrationLogsApi } from '../services/api';

export function IntegrationLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    integrationLogsApi.list({ limit: 100 }).then((r) => setLogs(r.data)).catch(() => setLogs([])).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading">Loading...</div>;

  return (
    <div className="page">
      <h1 className="page-title">Integration Logs</h1>
      <p className="page-subtitle">Track API calls, webhooks, and external integrations.</p>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Type</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.timestamp).toLocaleString()}</td>
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
            {logs.length === 0 && <tr><td colSpan={4}>No integration logs</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
