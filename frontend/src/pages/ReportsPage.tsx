import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { reportsApi, downloadPdf } from '../services/api';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';

export function ReportsPage() {
  const { t } = useTranslation();
  const [sales, setSales] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      reportsApi.getSalesReport(),
      reportsApi.getInventoryReport()
    ])
      .then(([salesRes, invRes]) => {
        setSales(salesRes.data);
        setInventory(invRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleExportSales = (format: 'csv' | 'excel') => {
    reportsApi.exportSales({ format })
      .then((r) => {
        const blob = new Blob([r.data], { type: format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `sales-export.${format === 'excel' ? 'xlsx' : 'csv'}`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success(t('reports.exportDownloaded'));
      })
      .catch(() => toast.error(t('reports.exportFailed')));
  };

  const handleExportInventory = (format: 'csv' | 'excel') => {
    reportsApi.exportInventory({ format })
      .then((r) => {
        const blob = new Blob([r.data], { type: format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `inventory-export.${format === 'excel' ? 'xlsx' : 'csv'}`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success(t('reports.exportDownloaded'));
      })
      .catch(() => toast.error(t('reports.exportFailed')));
  };

  if (loading) return <div className="page-loading">{t('reports.loadingReports')}</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t('reports.title')}</h1>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => handleExportSales('csv')}><Download size={16} /> {t('reports.exportSalesCsv')}</button>
          <button className="btn btn-secondary" onClick={() => handleExportSales('excel')}><Download size={16} /> {t('reports.exportSalesExcel')}</button>
          <button className="btn btn-secondary" onClick={() => handleExportInventory('csv')}><Download size={16} /> {t('reports.exportInventoryCsv')}</button>
          <button className="btn btn-secondary" onClick={() => handleExportInventory('excel')}><Download size={16} /> {t('reports.exportInventoryExcel')}</button>
        </div>
      </div>
      <div className="reports-grid">
        <div className="report-section">
          <h2>{t('reports.salesReport')}</h2>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('reports.date')}</th>
                  <th>{t('reports.branch')}</th>
                  <th>{t('reports.amount')}</th>
                  <th>{t('reports.profit')}</th>
                  <th>{t('reports.pdf')}</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td>{s.branch?.name}</td>
                    <td>${Number(s.totalAmount).toLocaleString()}</td>
                    <td>${Number(s.profit).toLocaleString()}</td>
                    <td>
                      <button className="btn btn-sm btn-secondary" onClick={() => downloadPdf('sale', s.id).catch(() => toast.error('PDF failed'))}>
                        <Download size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {sales.length === 0 && <tr><td colSpan={5}>{t('reports.noSales')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="report-section">
          <h2>{t('reports.inventoryByBrandModel')}</h2>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('reports.brand')}</th>
                  <th>{t('reports.model')}</th>
                  <th>{t('reports.status')}</th>
                  <th>{t('reports.count')}</th>
                  <th>{t('reports.totalValue')}</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((i: any, idx: number) => (
                  <tr key={idx}>
                    <td>{i.brand}</td>
                    <td>{i.model}</td>
                    <td>{i.status}</td>
                    <td>{i._count?.id ?? 0}</td>
                    <td>${Number(i._sum?.sellingPrice ?? 0).toLocaleString()}</td>
                  </tr>
                ))}
                {inventory.length === 0 && <tr><td colSpan={5}>{t('reports.noData')}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
