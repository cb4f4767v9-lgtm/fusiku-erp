import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { reportsApi, downloadPdf } from '../services/api';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { PageLayout, PageHeader, ErrorState, TableWrapper } from '../components/design-system';
import { TableSkeleton } from '../components/PageStates';
import { formatDateForUi } from '../utils/formatting';

export function ReportsPage() {
  const { t } = useTranslation();
  const { formatMoney, convert, selectedCurrency, ledgerBaseCurrency } = useCurrency();
  const [sales, setSales] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const money = (n: number) =>
    formatMoney(convert(Number(n || 0), ledgerBaseCurrency, selectedCurrency), selectedCurrency);

  const loadReports = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    Promise.all([reportsApi.getSalesReport(), reportsApi.getInventoryReport()])
      .then(([salesRes, invRes]) => {
        const s = salesRes.data;
        const inv = invRes.data;
        setSales(Array.isArray(s) ? s : s?.sales ?? []);
        setInventory(inv ?? null);
        setLoadError(false);
      })
      .catch((err) => {
        if (import.meta.env.DEV) console.warn('reports load failed', err);
        setSales([]);
        setInventory(null);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleExportSales = (format: 'csv' | 'excel') => {
    reportsApi
      .exportSales({ format })
      .then((r) => {
        const blob = new Blob([r.data], {
          type: format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv',
        });
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
    reportsApi
      .exportInventory({ format })
      .then((r) => {
        const blob = new Blob([r.data], {
          type: format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv',
        });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `inventory-export.${format === 'excel' ? 'xlsx' : 'csv'}`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success(t('reports.exportDownloaded'));
      })
      .catch(() => toast.error(t('reports.exportFailed')));
  };

  return (
    <PageLayout className="page">
      <PageHeader
        title={t('reports.title')}
        subtitle={t('reports.subtitle')}
        actions={
          <div className="erp-header-actions">
            <button type="button" className="btn btn-secondary" onClick={() => handleExportSales('csv')}>
              <Download size={16} /> {t('reports.exportSalesCsv')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => handleExportSales('excel')}>
              <Download size={16} /> {t('reports.exportSalesExcel')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => handleExportInventory('csv')}>
              <Download size={16} /> {t('reports.exportInventoryCsv')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => handleExportInventory('excel')}>
              <Download size={16} /> {t('reports.exportInventoryExcel')}
            </button>
          </div>
        }
      />

      {loadError ? (
        <ErrorState
          className="reports-page-error"
          message={t('reports.loadFailed')}
          onRetry={loadReports}
        />
      ) : null}

      {loading && !loadError ? (
        <TableSkeleton rows={8} cols={5} />
      ) : loadError ? null : (
        <div className="reports-grid">
          <div className="report-section">
            <h2>{t('reports.salesReport')}</h2>
            <TableWrapper>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('reports.date')}</th>
                    <th>{t('reports.branch')}</th>
                    <th className="num">{t('reports.amount')}</th>
                    <th className="num">{t('reports.profit')}</th>
                    <th>{t('reports.pdf')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s) => (
                    <tr key={s.id}>
                      <td>{formatDateForUi(s.createdAt)}</td>
                      <td>{s.branch?.name}</td>
                      <td className="num">{money(Number(s.totalAmount))}</td>
                      <td className="num">{money(Number(s.profit))}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() =>
                            downloadPdf('sale', s.id).catch(() => toast.error(t('common.pdfFailed')))
                          }
                        >
                          <Download size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {sales.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="data-table-empty-cell">
                        {t('reports.noSales')}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </TableWrapper>
          </div>
          <div className="report-section">
            <h2>{t('reports.inventoryByBrandModel')}</h2>
            <TableWrapper>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('reports.brand')}</th>
                    <th>{t('reports.model')}</th>
                    <th>{t('reports.status')}</th>
                    <th className="num">{t('reports.count')}</th>
                    <th className="num">{t('reports.totalValue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(inventory?.data || []).map((i: any, idx: number) => (
                    <tr key={idx}>
                      <td>{i.brand}</td>
                      <td>{i.model}</td>
                      <td>{i.status}</td>
                      <td className="num">{i._count?.id ?? 0}</td>
                      <td className="num">{money(Number(i._sum?.sellingPrice ?? 0))}</td>
                    </tr>
                  ))}
                  {(inventory?.data || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="data-table-empty-cell">
                        {t('reports.noData')}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </TableWrapper>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
