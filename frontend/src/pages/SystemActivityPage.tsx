import { useEffect, useState } from 'react';
import { activityApi } from '../services/api';

export function SystemActivityPage() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    activityApi.getAll().then((r) => setLogs(r.data)).catch(() => setLogs([]));
  }, []);

  const actionLabel = (a: string) => {
    const map: Record<string, string> = {
      user_login: 'User Login',
      inventory_create: 'Inventory Created',
      inventory_edit: 'Inventory Edited',
      purchase_create: 'Purchase Created',
      sale_completion: 'Sale Completed',
      repair_create: 'Repair Created',
      repair_completion: 'Repair Completed',
      transfer_approval: 'Transfer Approved'
    };
    return map[a] || a;
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">System Activity</h1>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Entity ID</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{new Date(l.timestamp).toLocaleString()}</td>
                <td>{l.user?.name || '-'}</td>
                <td><span className="badge">{actionLabel(l.action)}</span></td>
                <td>{l.entityType}</td>
                <td>{l.entityId || '-'}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={5}>No activity</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
