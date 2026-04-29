import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import { Activity, Database, Cpu, HardDrive, Zap, RefreshCw } from 'lucide-react';
import { PageLayout, PageHeader, LoadingSkeleton } from '../components/design-system';
import { formatDateTimeForUi } from '../utils/formatting';

export function MonitoringPage() {
  const { t } = useTranslation();
  const [health, setHealth] = useState<any>(null);
  const [version, setVersion] = useState<any>(null);
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([
      api.get('/system/health').then((r) => setHealth(r.data)).catch(() => setHealth(null)),
      api.get('/system/version').then((r) => setVersion(r.data)).catch(() => setVersion(null)),
      api.get('/system/info').then((r) => setSystemInfo(r.data)).catch(() => setSystemInfo(null)),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <PageLayout className="page">
        <PageHeader title={t('monitoring.title')} />
        <LoadingSkeleton variant="dashboard" />
      </PageLayout>
    );
  }

  return (
    <PageLayout className="page">
      <PageHeader
        title={t('monitoring.title')}
        actions={
          <button type="button" className="btn btn-secondary" onClick={load}>
            <RefreshCw size={18} /> {t('monitoring.refresh')}
          </button>
        }
      />

      <div className="monitoring-grid">
        <div className="monitoring-card">
          <Activity size={24} />
          <h3>{t('monitoring.serverUptime')}</h3>
          <p className="monitoring-value">{health?.uptime != null ? `${Math.floor(health.uptime / 60)} min` : '—'}</p>
        </div>
        <div className="monitoring-card">
          <Database size={24} />
          <h3>{t('monitoring.database')}</h3>
          <p className={`monitoring-value ${health?.database === 'connected' ? 'status-ok' : 'status-error'}`}>
            {health?.database || '—'}
          </p>
        </div>
        <div className="monitoring-card">
          <HardDrive size={24} />
          <h3>{t('monitoring.memoryRss')}</h3>
          <p className="monitoring-value">{health?.memory?.rss != null ? `${health.memory.rss} MB` : '—'}</p>
          <p className="monitoring-detail">Heap: {health?.memory?.heapUsed ?? '—'} / {health?.memory?.heapTotal ?? '—'} MB</p>
        </div>
        <div className="monitoring-card">
          <Cpu size={24} />
          <h3>{t('monitoring.cpuUsage')}</h3>
          <p className="monitoring-value">User: {health?.cpu?.user ?? '—'} ms</p>
          <p className="monitoring-detail">System: {health?.cpu?.system ?? '—'} ms</p>
        </div>
        <div className="monitoring-card">
          <Zap size={24} />
          <h3>{t('monitoring.apiResponseTime')}</h3>
          <p className="monitoring-value">{health?.api?.avgResponseTimeMs ?? '—'} ms avg</p>
          <p className="monitoring-detail">Requests: {health?.api?.requests ?? 0} | Errors: {health?.api?.errors ?? 0}</p>
        </div>
      </div>

      <div className="monitoring-section">
        <h2>{t('monitoring.systemInformation')}</h2>
        <div className="monitoring-version">
          <p><strong>ERP Version:</strong> {systemInfo?.erpVersion ?? version?.version ?? '—'}</p>
          <p><strong>Database Version:</strong> {systemInfo?.databaseVersion ?? '—'}</p>
          <p><strong>Environment:</strong> {systemInfo?.environment ?? version?.environment ?? '—'}</p>
          <p><strong>Server Uptime:</strong> {systemInfo?.uptime != null ? `${Math.floor(systemInfo.uptime / 60)} min` : '—'}</p>
          <p><strong>Installed Modules:</strong> {systemInfo?.modules?.join(', ') ?? '—'}</p>
        </div>
      </div>

      <div className="monitoring-section">
        <h2>{t('monitoring.versionInfo')}</h2>
        <div className="monitoring-version">
          <p><strong>Version:</strong> {version?.version ?? '—'}</p>
          <p><strong>Environment:</strong> {version?.environment ?? '—'}</p>
          <p><strong>Build:</strong> {version?.buildDate ?? '—'}</p>
        </div>
      </div>

      <div className="monitoring-section">
        <h2>{t('monitoring.healthStatus')}</h2>
        <p className={`status-badge ${health?.status === 'healthy' ? 'status-ok' : 'status-warn'}`}>
          {health?.status ?? 'unknown'}
        </p>
        <p className="monitoring-timestamp">
          Last check: {health?.timestamp ? formatDateTimeForUi(health.timestamp) : '—'}
        </p>
      </div>
    </PageLayout>
  );
}
