import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { reportsApi, branchesApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useCurrency } from '../contexts/CurrencyContext';
import { PageLayout, PageHeader, ErrorState } from '../components/design-system';
import { isSuperAdmin } from '../utils/permissions';
import { formatDateForUi } from '../utils/formatting';

/** API returns `{ ageDays }[]`; older UI expected `{ buckets, total }`. */
function normalizeInventoryAging(data: unknown): { buckets: Record<string, number>; total: number } | null {
  if (data == null) return null;
  if (Array.isArray(data)) {
    const buckets: Record<string, number> = { '0-30': 0, '30-90': 0, '90-180': 0, '180+': 0 };
    for (const raw of data as { ageDays?: number }[]) {
      const a = Number(raw.ageDays ?? 0);
      if (a <= 30) buckets['0-30'] += 1;
      else if (a <= 90) buckets['30-90'] += 1;
      else if (a <= 180) buckets['90-180'] += 1;
      else buckets['180+'] += 1;
    }
    return { buckets, total: data.length };
  }
  if (typeof data === 'object' && data !== null && 'buckets' in data) {
    return data as { buckets: Record<string, number>; total: number };
  }
  return null;
}

export function AdvancedReportsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { formatMoney, convert, selectedCurrency, ledgerBaseCurrency } = useCurrency();
  const [branches, setBranches] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    branchId: '',
    startDate: '',
    endDate: ''
  });
  const [sales, setSales] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any>(null);
  const [profitDetail, setProfitDetail] = useState<any | null>(null);
  const [expenseDetail, setExpenseDetail] = useState<any | null>(null);
  const [branchComparison, setBranchComparison] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [inventoryAging, setInventoryAging] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hasRunReport, setHasRunReport] = useState(false);
  const [reportError, setReportError] = useState(false);

  const fmt = (n: number) =>
    formatMoney(convert(Number(n || 0), ledgerBaseCurrency, selectedCurrency), selectedCurrency);

  const formatSaleDate = (raw: string | undefined) => {
    if (!raw) return '—';
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? '—' : formatDateForUi(d);
  };

  useEffect(() => {
    branchesApi
      .getAll()
      .then((r) => setBranches(r.data))
      .catch((err) => {
        if (import.meta.env.DEV) console.warn('advanced reports branches failed', err);
        setBranches([]);
      });
  }, []);

  const runReport = async () => {
    setLoading(true);
    setReportError(false);
    const params: any = {};
    if (isSuperAdmin(user) && filters.branchId) params.branchId = filters.branchId;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;

    try {
      const [salesRes, invRes, profitRes, expRes, techRes, agingRes] = await Promise.all([
        reportsApi.getSalesReport(params),
        reportsApi.getInventoryReport(params),
        reportsApi.getProfitReport(params),
        reportsApi.getExpenseReportDetail(params),
        reportsApi.getTechniciansReport(params),
        reportsApi.getInventoryAging({ branchId: params.branchId }),
      ]);
      const s = salesRes.data;
      const inv = invRes.data;
      setSales(Array.isArray(s) ? s : s?.sales ?? []);
      setInventory(inv ?? null);
      setProfitDetail(profitRes.data || null);
      setExpenseDetail(expRes.data || null);
      setTechnicians(techRes.data || []);
      setInventoryAging(normalizeInventoryAging(agingRes.data));
      setReportError(false);
    } catch (err) {
      if (import.meta.env.DEV) console.warn('advanced reports main bundle failed', err);
      setSales([]);
      setInventory(null);
      setProfitDetail(null);
      setExpenseDetail(null);
      setTechnicians([]);
      setInventoryAging(null);
      setReportError(true);
    }

    try {
      const bc = await reportsApi.getBranchComparison(params);
      const bcData = bc.data;
      setBranchComparison(Array.isArray(bcData) ? bcData : bcData?.branches ?? []);
    } catch (err) {
      if (import.meta.env.DEV) console.warn('advanced reports branch comparison failed', err);
      setBranchComparison([]);
    } finally {
      setLoading(false);
      setHasRunReport(true);
    }
  };

  return (
    <PageLayout className="page">
      <PageHeader title={t('nav.advancedReports')} subtitle={t('reports.advancedSubtitle')} />
      {!hasRunReport && (
        <p className="advanced-reports-hint muted" role="note">
          {t('reports.runReportHint')}
        </p>
      )}
      {hasRunReport && reportError ? (
        <ErrorState
          className="reports-page-error"
          message={t('reports.loadFailed')}
          onRetry={runReport}
        />
      ) : null}
      <div className="report-filters report-filters--labeled">
        <div className="report-filters__field">
          <label htmlFor="adv-report-branch">{t('reports.branch')}</label>
          <select
            id="adv-report-branch"
            value={filters.branchId}
            disabled={!isSuperAdmin(user)}
            onChange={(e) => setFilters((f) => ({ ...f, branchId: e.target.value }))}
          >
            <option value="">{t('inventory.allBranches')}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="report-filters__field">
          <label htmlFor="adv-report-start">{t('reports.dateFrom')}</label>
          <input
            id="adv-report-start"
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
          />
        </div>
        <div className="report-filters__field">
          <label htmlFor="adv-report-end">{t('reports.dateTo')}</label>
          <input
            id="adv-report-end"
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
          />
        </div>
        <div className="report-filters__actions">
          <button type="button" className="btn btn-primary" onClick={runReport} disabled={loading}>
            {loading ? t('common.loading') : t('reports.runReport')}
          </button>
        </div>
      </div>
      <div className="advanced-reports-grid">
        <div className="report-section">
          <h2>
            {t('reports.salesReport')} ({sales.length})
          </h2>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('reports.date')}</th>
                  <th className="num">{t('reports.amount')}</th>
                  <th className="num">{t('reports.profit')}</th>
                </tr>
              </thead>
              <tbody>
                {sales.slice(0, 20).map((s) => (
                  <tr key={s.id}>
                    <td>{formatSaleDate(s.createdAt)}</td>
                    <td className="num">{fmt(s.totalAmount)}</td>
                    <td className="num">{fmt(s.profit)}</td>
                  </tr>
                ))}
                {hasRunReport && sales.length === 0 && (
                  <tr>
                    <td colSpan={3} className="muted">
                      {t('reports.noSales')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="report-section">
          <h2>{t('reports.profitReport')}</h2>
          {profitDetail ? (
            <table className="data-table report-inline-summary">
              <tbody>
                <tr>
                  <td>{t('reports.revenue')}</td>
                  <td className="report-inline-summary__num">{fmt(profitDetail.totalRevenue)}</td>
                </tr>
                <tr>
                  <td>{t('reports.costOfSales')}</td>
                  <td className="report-inline-summary__num">{fmt(profitDetail.totalCostOfSales)}</td>
                </tr>
                <tr>
                  <td>{t('reports.grossProfit')}</td>
                  <td className="report-inline-summary__num">{fmt(profitDetail.totalProfit)}</td>
                </tr>
                <tr>
                  <td>{t('reports.totalExpenses')}</td>
                  <td className="report-inline-summary__num">{fmt(profitDetail.totalExpenses)}</td>
                </tr>
                <tr className="report-inline-summary__emphasis">
                  <td>{t('reports.netAfterExpenses')}</td>
                  <td className="report-inline-summary__num">{fmt(profitDetail.netProfitAfterExpenses)}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="muted">{t('reports.noData')}</p>
          )}
        </div>

        <div className="report-section">
          <h2>{t('reports.expenseReport')}</h2>
          {expenseDetail?.byCategory?.length ? (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('reports.category')}</th>
                    <th className="num">{t('reports.expenseAmount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseDetail.byCategory.map((c: any) => (
                    <tr key={c.category}>
                      <td>{c.category}</td>
                      <td className="num">{fmt(c.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">{t('reports.noData')}</p>
          )}
          {expenseDetail?.items?.length > 0 && (
            <div className="table-container report-section__follow">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('reports.date')}</th>
                    <th>{t('reports.branch')}</th>
                    <th>{t('reports.category')}</th>
                    <th className="num">{t('reports.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseDetail.items.slice(0, 25).map((row: any) => (
                    <tr key={row.id}>
                      <td>{formatSaleDate(row.expenseDate)}</td>
                      <td>{row.branch?.name ?? '—'}</td>
                      <td>{row.category}</td>
                      <td className="num">{fmt(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {isSuperAdmin(user) && branchComparison.length > 0 && (
          <div className="report-section">
            <h2>{t('reports.branchComparison')}</h2>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('reports.branch')}</th>
                    <th className="num">{t('reports.revenue')}</th>
                    <th className="num">{t('reports.costOfSales')}</th>
                    <th className="num">{t('reports.grossProfit')}</th>
                    <th className="num">{t('reports.totalExpenses')}</th>
                    <th className="num">{t('reports.netAfterExpenses')}</th>
                  </tr>
                </thead>
                <tbody>
                  {branchComparison.map((row) => (
                    <tr key={row.branchId}>
                      <td>{row.branchName}</td>
                      <td className="num">{fmt(row.revenue)}</td>
                      <td className="num">{fmt(row.costOfSales)}</td>
                      <td className="num">{fmt(row.grossProfit)}</td>
                      <td className="num">{fmt(row.expenses)}</td>
                      <td className="num">{fmt(row.netProfit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="report-section">
          <h2>
            {t('reports.inventoryByBrandModel')} ({(inventory?.data || []).length})
          </h2>
          <div className="table-container">
            <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('reports.brand')}</th>
                    <th>{t('reports.model')}</th>
                    <th>{t('reports.status')}</th>
                    <th className="num">{t('reports.count')}</th>
                  </tr>
                </thead>
                <tbody>
                {(inventory?.data || []).slice(0, 20).map((i: any) => (
                  <tr key={`${i.brand}-${i.model}-${i.status}`}>
                    <td>{i.brand}</td>
                    <td>{i.model}</td>
                    <td>{i.status}</td>
                    <td className="num">{i._count?.id ?? '—'}</td>
                  </tr>
                ))}
                {hasRunReport && (inventory?.data || []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      {t('reports.noData')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="report-section">
          <h2>{t('reports.technicianPerformance')}</h2>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('reports.technician')}</th>
                  <th className="num">{t('reports.repairJobs')}</th>
                  <th className="num">{t('reports.avgCost')}</th>
                  <th className="num">{t('reports.completionPct')}</th>
                  <th className="num">{t('reports.revenue')}</th>
                </tr>
              </thead>
              <tbody>
                {technicians.map((tech) => (
                  <tr key={tech.technicianId ?? tech.technician}>
                    <td>{tech.technicianName ?? tech.technician}</td>
                    <td className="num">{tech.number_of_repairs ?? tech.repairCount}</td>
                    <td className="num">{fmt(tech.average_repair_cost ?? 0)}</td>
                    <td className="num">{tech.repair_completion_rate ?? 0}%</td>
                    <td className="num">{fmt((tech.repairRevenue || 0) + (tech.refurbishRevenue || 0))}</td>
                  </tr>
                ))}
                {hasRunReport && technicians.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      {t('reports.noTechnicianData')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {inventoryAging && (
          <div className="report-section">
            <h2>{t('reports.inventoryAging')}</h2>
            <div className="aging-buckets">
              <div className="aging-bucket">
                <span>{t('reports.aging0_30')}</span>
                <strong>{inventoryAging.buckets?.['0-30'] ?? 0}</strong>
              </div>
              <div className="aging-bucket">
                <span>{t('reports.aging30_90')}</span>
                <strong>{inventoryAging.buckets?.['30-90'] ?? 0}</strong>
              </div>
              <div className="aging-bucket">
                <span>{t('reports.aging90_180')}</span>
                <strong>{inventoryAging.buckets?.['90-180'] ?? 0}</strong>
              </div>
              <div className="aging-bucket">
                <span>{t('reports.aging180plus')}</span>
                <strong>{inventoryAging.buckets?.['180+'] ?? 0}</strong>
              </div>
            </div>
            <p>{t('reports.totalDevices', { count: inventoryAging.total ?? 0 })}</p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
