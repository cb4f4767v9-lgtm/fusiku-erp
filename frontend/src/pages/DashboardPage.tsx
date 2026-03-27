import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { reportsApi, stockAlertsApi, repairsApi, refurbishApi } from '../services/api';
import {
  Package,
  DollarSign,
  TrendingUp,
  Wrench,
  RefreshCw,
  AlertTriangle,
  Box,
  CheckCircle,
  Truck
} from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export function DashboardPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([]);
  const [topModels, setTopModels] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [repairs, setRepairs] = useState<any[]>([]);
  const [refurbishJobs, setRefurbishJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      reportsApi.getDashboard().then((r) => setData(r.data)).catch(() => setData(null)),
      reportsApi.getMonthlyRevenue({ months: 1 }).then((r) => setMonthlyRevenue(r.data || [])).catch(() => setMonthlyRevenue([])),
      reportsApi.getTopSellingModels({ limit: 5 }).then((r) => setTopModels(r.data || [])).catch(() => setTopModels([])),
      stockAlertsApi.check().then((r) => setAlerts(r.data?.alerts || [])).catch(() => setAlerts([])),
      repairsApi.getAll().then((r) => setRepairs(r.data || [])).catch(() => setRepairs([])),
      refurbishApi.getAll().then((r) => setRefurbishJobs(r.data || [])).catch(() => setRefurbishJobs([]))
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading">{t('dashboard.loading')}</div>;
  if (!data) return <div className="page-loading">{t('dashboard.loadFailed')}</div>;

  const kpiCards = [
    { labelKey: 'dashboard.totalDevicesInStock', value: data.totalDevicesInStock ?? data.totalInventory ?? 0, icon: Package, color: '#4ea1ff' },
    { labelKey: 'dashboard.totalInventoryValue', value: `$${(data.totalInventoryValue || 0).toLocaleString()}`, icon: DollarSign, color: '#a78bfa' },
    { labelKey: 'dashboard.todaySales', value: `$${(data.todaySales ?? data.dailySales ?? 0).toLocaleString()}`, icon: DollarSign, color: '#22c55e' },
    { labelKey: 'dashboard.repairsInProgress', value: data.repairsInProgress ?? repairs.filter((r) => r.status === 'in_progress' || r.status === 'pending').length, icon: Wrench, color: '#f59e0b' },
    { labelKey: 'dashboard.refurbishingQueue', value: data.refurbishingQueue ?? refurbishJobs.filter((j) => j.status === 'pending' || j.status === 'in_progress').length, icon: RefreshCw, color: '#94a3b8' },
    { labelKey: 'dashboard.monthlyProfit', value: `$${(data.monthlyProfit || 0).toLocaleString()}`, icon: TrendingUp, color: '#22c55e' }
  ];

  const underRepair = repairs.filter((r) => r.status === 'in_progress').length;
  const waitingParts = repairs.filter((r) => r.status === 'pending').length + refurbishJobs.filter((j) => j.status === 'pending').length;
  const qualityCheck = refurbishJobs.filter((j) => j.status === 'in_progress').length;
  const readyToSell = refurbishJobs.filter((j) => j.status === 'completed').length;

  const pipelineStages = [
    { labelKey: 'dashboard.underRepair', value: underRepair, icon: Wrench, color: '#f59e0b' },
    { labelKey: 'dashboard.waitingForParts', value: waitingParts, icon: Box, color: '#94a3b8' },
    { labelKey: 'dashboard.qualityCheck', value: qualityCheck, icon: CheckCircle, color: '#4ea1ff' },
    { labelKey: 'dashboard.readyToSell', value: readyToSell, icon: Truck, color: '#22c55e' }
  ];

  const chartData = {
    labels: monthlyRevenue.map((r) => r.month || r.date || r.label || ''),
    datasets: [{
      label: t('dashboard.amount'),
      data: monthlyRevenue.map((r) => r.revenue ?? r.amount ?? r.total ?? 0),
      backgroundColor: 'rgba(78, 161, 255, 0.6)',
      borderColor: '#4ea1ff',
      borderWidth: 1
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      y: { beginAtZero: true }
    }
  };

  return (
    <div className="page dashboard">
      <div className="dashboard-container">
        <div className="page-header dashboard-header">
          <div>
            <h1>{t('dashboard.title')}</h1>
            <p className="page-header-subtitle">{t('dashboard.subtitle')}</p>
          </div>
        </div>

        {/* 1. KPI Cards */}
        <div className="dashboard-kpi-grid">
        {kpiCards.map(({ labelKey, value, icon: Icon, color }) => (
          <div key={labelKey} className="stat-card" style={{ '--card-accent': color } as React.CSSProperties}>
            <Icon size={24} style={{ color }} />
            <div>
              <span className="stat-value">{value}</span>
              <span className="stat-label">{t(labelKey)}</span>
            </div>
          </div>
        ))}
        </div>

        {/* 2. Sales Chart + Inventory Insights */}
        <div className="dashboard-grid-2">
        <div className="card chart-container">
          <h3>{t('dashboard.salesLast30Days')}</h3>
          <div className="dashboard-chart">
            {monthlyRevenue.length > 0 ? (
              <Bar data={chartData} options={chartOptions} />
            ) : (
              <p className="dashboard-empty">{t('common.noData')}</p>
            )}
          </div>
        </div>

        <div className="card">
          <h3>{t('dashboard.inventoryInsights')}</h3>
          <div className="dashboard-insights">
            <div>
              <h4>{t('dashboard.topSellingModels')}</h4>
              <ul className="dashboard-list">
                {topModels.length > 0 ? (
                  topModels.map((m, i) => (
                    <li key={i}>{m.brand} {m.model} — {m.count} {t('dashboard.sold')}</li>
                  ))
                ) : (
                  <li className="muted">{t('common.noData')}</li>
                )}
              </ul>
            </div>
            <div>
              <h4>{t('dashboard.lowStockAlerts')}</h4>
              <ul className="dashboard-list">
                {alerts.length > 0 ? (
                  alerts.slice(0, 5).map((a) => (
                    <li key={a.id} className="alert-item">
                      <AlertTriangle size={14} /> {a.message} ({a.count} {t('dashboard.inStock')})
                    </li>
                  ))
                ) : (
                  <li className="muted">{t('common.noData')}</li>
                )}
              </ul>
            </div>
          </div>
        </div>
        </div>

        {/* 3. Repair Pipeline + Recent Sales */}
        <div className="dashboard-grid-2">
        <div className="card">
          <h3>{t('dashboard.repairPipeline')}</h3>
          <div className="dashboard-pipeline">
            {pipelineStages.map(({ labelKey, value, icon: Icon, color }) => (
              <div key={labelKey} className="pipeline-stage">
                <Icon size={20} style={{ color }} />
                <span className="pipeline-label">{t(labelKey)}</span>
                <span className="pipeline-value">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>{t('dashboard.recentSales')}</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('dashboard.date')}</th>
                  <th>{t('dashboard.amount')}</th>
                  <th>{t('dashboard.profit')}</th>
                </tr>
              </thead>
              <tbody>
                {data.recentSales?.slice(0, 8).map((sale: any) => (
                  <tr key={sale.id}>
                    <td>{new Date(sale.createdAt).toLocaleDateString()}</td>
                    <td>${Number(sale.totalAmount).toLocaleString()}</td>
                    <td>${Number(sale.profit).toLocaleString()}</td>
                  </tr>
                ))}
                {(!data.recentSales || data.recentSales.length === 0) && (
                  <tr><td colSpan={3}>{t('dashboard.noRecentSales')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
