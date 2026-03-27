import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, ShoppingCart, AlertTriangle, TrendingUp, Wrench, DollarSign, RefreshCw } from 'lucide-react';

export function AIBusinessIntelligencePage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    fetch('/api/analytics/summary', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then((res) => (res.ok ? res.json() : { totalSales: 0, monthlyProfit: 0, topModel: null, lowStock: 0, repairsInProgress: 0 }))
      .then((data) => setStats(data))
      .catch(() => {
        console.error('Analytics failed');
        setStats({ totalSales: 0, monthlyProfit: 0, topModel: null, lowStock: 0, repairsInProgress: 0 });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <div className="page-loading">{t('ai.loading')}</div>;
  if (!stats) return <div className="page-loading">{t('ai.loadFailed')}</div>;

  const cards = [
    { labelKey: 'ai.totalSales', value: `$${(stats.totalSales ?? 0).toLocaleString()}`, icon: ShoppingCart, color: '#4ea1ff' },
    { labelKey: 'ai.monthlyProfit', value: `$${(stats.monthlyProfit ?? 0).toLocaleString()}`, icon: DollarSign, color: '#22c55e' },
    { labelKey: 'ai.topModel', value: stats.topModel ? stats.topModel : t('common.noData'), icon: TrendingUp, color: '#a78bfa' },
    { labelKey: 'ai.lowStock', value: stats.lowStock ?? 0, icon: AlertTriangle, color: '#f59e0b' },
    { labelKey: 'ai.repairs', value: stats.repairsInProgress ?? 0, icon: Wrench, color: '#94a3b8' }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title"><Sparkles size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} /> {t('ai.title')}</h1>
        <button className="btn btn-secondary" onClick={load}><RefreshCw size={18} /> {t('common.refresh')}</button>
      </div>

      <div className="dashboard-kpi-grid">
        {cards.map(({ labelKey, value, icon: Icon, color }) => (
          <div key={labelKey} className="stat-card" style={{ '--card-accent': color } as React.CSSProperties}>
            <Icon size={24} style={{ color }} />
            <div>
              <span className="stat-value">{value}</span>
              <span className="stat-label">{t(labelKey)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
