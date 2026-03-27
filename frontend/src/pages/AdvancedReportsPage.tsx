import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { reportsApi, branchesApi } from '../services/api';

export function AdvancedReportsPage() {
  const { t } = useTranslation();
  const [branches, setBranches] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    branchId: '',
    startDate: '',
    endDate: '',
    reportType: 'sales'
  });
  const [sales, setSales] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [profit, setProfit] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [inventoryAging, setInventoryAging] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    branchesApi.getAll().then((r) => setBranches(r.data)).catch(() => setBranches([]));
  }, []);

  const runReport = async () => {
    setLoading(true);
    const params: any = {};
    if (filters.branchId) params.branchId = filters.branchId;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;

    try {
      const [salesRes, invRes, profitRes, techRes, agingRes] = await Promise.all([
        reportsApi.getSalesReport(params),
        reportsApi.getInventoryReport(params),
        reportsApi.getProfitReport(params),
        reportsApi.getTechniciansReport(params),
        reportsApi.getInventoryAging({ branchId: params.branchId })
      ]);
      setSales(salesRes.data);
      setInventory(invRes.data);
      setProfit(profitRes.data);
      setTechnicians(techRes.data);
      setInventoryAging(agingRes.data);
    } catch {
      setSales([]);
      setInventory([]);
      setProfit([]);
      setTechnicians([]);
      setInventoryAging(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">{t('nav.advancedReports')}</h1>
      <div className="report-filters">
        <select
          value={filters.branchId}
          onChange={(e) => setFilters((f) => ({ ...f, branchId: e.target.value }))}
        >
          <option value="">{t('inventory.allBranches')}</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
        />
        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
        />
        <button className="btn btn-primary" onClick={runReport} disabled={loading}>
          {loading ? t('common.loading') : t('reports.runReport')}
        </button>
      </div>
      <div className="advanced-reports-grid">
        <div className="report-section">
          <h2>{t('reports.salesReport')} ({sales.length})</h2>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr><th>{t('reports.date')}</th><th>{t('reports.amount')}</th><th>{t('reports.profit')}</th></tr>
              </thead>
              <tbody>
                {sales.slice(0, 20).map((s) => (
                  <tr key={s.id}>
                    <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td>${Number(s.totalAmount).toLocaleString()}</td>
                    <td>${Number(s.profit).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="report-section">
          <h2>{t('reports.inventoryByBrandModel')} ({inventory.length})</h2>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr><th>{t('reports.brand')}</th><th>{t('reports.model')}</th><th>{t('reports.status')}</th><th>{t('reports.count')}</th></tr>
              </thead>
              <tbody>
                {inventory.slice(0, 20).map((i: any, idx: number) => (
                  <tr key={idx}>
                    <td>{i.brand}</td>
                    <td>{i.model}</td>
                    <td>{i.status}</td>
                    <td>{i._count?.id ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="report-section">
          <h2>{t('reports.technicianPerformance')}</h2>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr><th>{t('reports.technician')}</th><th>{t('reports.repairs')}</th><th>{t('reports.avgCost')}</th><th>{t('reports.completionPct')}</th><th>{t('reports.revenue')}</th></tr>
              </thead>
              <tbody>
                {technicians.map((t) => (
                  <tr key={t.technicianId}>
                    <td>{t.technicianName}</td>
                    <td>{t.number_of_repairs ?? t.repairCount}</td>
                    <td>${(t.average_repair_cost ?? 0).toFixed(2)}</td>
                    <td>{t.repair_completion_rate ?? 0}%</td>
                    <td>${((t.repairRevenue || 0) + (t.refurbishRevenue || 0)).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {inventoryAging && (
          <div className="report-section">
            <h2>{t('reports.inventoryAging')}</h2>
            <div className="aging-buckets">
              <div className="aging-bucket"><span>0-30 days</span><strong>{inventoryAging.buckets?.['0-30'] ?? 0}</strong></div>
              <div className="aging-bucket"><span>30-90 days</span><strong>{inventoryAging.buckets?.['30-90'] ?? 0}</strong></div>
              <div className="aging-bucket"><span>90-180 days</span><strong>{inventoryAging.buckets?.['90-180'] ?? 0}</strong></div>
              <div className="aging-bucket"><span>180+ days</span><strong>{inventoryAging.buckets?.['180+'] ?? 0}</strong></div>
            </div>
            <p>{t('reports.totalDevices', { count: inventoryAging.total ?? 0 })}</p>
          </div>
        )}
      </div>
    </div>
  );
}
