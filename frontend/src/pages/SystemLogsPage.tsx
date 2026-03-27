import { useEffect, useState } from 'react';
import { logsApi } from '../services/api';

export function SystemLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    logsApi.getAll({ limit: 200 })
      .then((r) => setLogs(r.data))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading">Loading logs...</div>;

  return (
    <div className="page">
      <h1 className="page-title">System Logs</h1>
      <p className="page-subtitle">Audit trail of system activity</p>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Entity ID</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td>{log.user?.name || '—'}</td>
                <td>{log.action}</td>
                <td>{log.entity}</td>
                <td>{log.entityId || '—'}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={5}>No logs</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
