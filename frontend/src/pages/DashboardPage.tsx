import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../utils/chartJsRegister';
import { Bar } from 'react-chartjs-2';
import { reportsApi, repairsApi, refurbishApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useCurrency } from '../contexts/CurrencyContext';
import { DollarSign, ClipboardList } from 'lucide-react';
import { useBranding } from '../contexts/BrandingContext';
import { getTrialCalendarDaysRemaining, getTrialUiState } from '../utils/billingUi';
import { getBillingMailtoProHref } from '../config/billingContact';
import { EmptyState, PageLayout, PageHeader, ErrorState } from '../components/design-system';
import { DashboardSkeleton } from '../components/PageStates';
import { persistDesktopCache } from '../offline/desktopCache';
import { formatDateForUi } from '../utils/formatting';

const POST_SIGNUP_WELCOME_KEY = 'fusiku_post_signup_welcome';
/** Matches GET /reports/monthly-revenue monthly buckets (not a rolling 30-day window). */
const REVENUE_CHART_MONTHS = 6;

export function DashboardPage() {
  const { t } = useTranslation();
  useAuth();
  const { companyName } = useBranding();
  const { selectedCurrency, ledgerBaseCurrency, convert, formatMoney } = useCurrency();
  /** `null` = summary not loaded yet or failed; object = loaded (may be empty). */
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  /** True only when GET /reports/dashboard rejects (not empty payload). */
  const [dashboardSummaryFailed, setDashboardSummaryFailed] = useState(false);
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([]);
  const [, setTopModels] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [, setRepairCounts] = useState({ pending: 0, inProgress: 0 });
  const [, setRefurbCounts] = useState({ pending: 0, inProgress: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  const [, setTrialTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTrialTick((n) => n + 1), 30 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(POST_SIGNUP_WELCOME_KEY) === '1') {
        sessionStorage.removeItem(POST_SIGNUP_WELCOME_KEY);
        setShowWelcomeBanner(true);
      }
    } catch {
      /* sessionStorage blocked */
    }
  }, []);

  const dismissWelcome = useCallback(() => setShowWelcomeBanner(false), []);

  const loadDashboard = useCallback(() => {
    setLoading(true);
    setDashboardSummaryFailed(false);

    void (async () => {
      try {
        const results = await Promise.allSettled([
          reportsApi.getDashboard(),
          reportsApi.getMonthlyRevenue({ months: REVENUE_CHART_MONTHS }),
          reportsApi.getTopSellingModels({ limit: 5 }),
          repairsApi.getAll(),
          refurbishApi.getAll(),
        ]);

        const warn = (label: string, reason: unknown) => {
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.warn(`[dashboard] ${label} failed`, reason);
          }
        };

        // [0] GET /reports/dashboard
        const r0 = results[0];
        if (r0.status === 'fulfilled') {
          try {
            const payload = (r0.value?.data ?? {}) as Record<string, unknown>;
            setData(payload);
            void persistDesktopCache('sales', payload);
          } catch (e) {
            warn('dashboard summary (parse)', e);
            setData(null);
            setDashboardSummaryFailed(true);
          }
        } else {
          warn('dashboard summary', r0.reason);
          setData(null);
          setDashboardSummaryFailed(true);
        }

        // [1] GET /reports/monthly-revenue
        const r1 = results[1];
        if (r1.status === 'fulfilled') {
          try {
            const d = r1.value?.data as any;
            setMonthlyRevenue(Array.isArray(d) ? d : d?.months ?? []);
          } catch (e) {
            warn('monthly revenue (parse)', e);
            setMonthlyRevenue([]);
          }
        } else {
          warn('monthly revenue', r1.reason);
          setMonthlyRevenue([]);
        }

        // [2] GET /reports/top-selling-models
        const r2 = results[2];
        if (r2.status === 'fulfilled') {
          try {
            const d = r2.value?.data;
            setTopModels(Array.isArray(d) ? d : []);
          } catch (e) {
            warn('top models (parse)', e);
            setTopModels([]);
          }
        } else {
          warn('top models', r2.reason);
          setTopModels([]);
        }

        // Alerts are intentionally not fetched from the dashboard (avoid heavy POST endpoints).
        setAlerts([]);

        // [3] repairs (counts only — avoid keeping full arrays in memory)
        const r3 = results[3];
        if (r3.status === 'fulfilled') {
          try {
            const d = r3.value?.data;
            if (Array.isArray(d)) {
              let pending = 0;
              let inProgress = 0;
              for (const row of d) {
                const s = (row as any)?.status;
                if (s === 'pending') pending += 1;
                else if (s === 'in_progress') inProgress += 1;
              }
              setRepairCounts({ pending, inProgress });
            } else {
              setRepairCounts({ pending: 0, inProgress: 0 });
            }
          } catch (e) {
            warn('repairs (parse)', e);
            setRepairCounts({ pending: 0, inProgress: 0 });
          }
        } else {
          warn('repairs', r3.reason);
          setRepairCounts({ pending: 0, inProgress: 0 });
        }

        // [4] refurbish (counts only — avoid keeping full arrays in memory)
        const r4 = results[4];
        if (r4.status === 'fulfilled') {
          try {
            const d = r4.value?.data;
            if (Array.isArray(d)) {
              let pending = 0;
              let inProgress = 0;
              let completed = 0;
              for (const row of d) {
                const s = (row as any)?.status;
                if (s === 'pending') pending += 1;
                else if (s === 'in_progress') inProgress += 1;
                else if (s === 'completed') completed += 1;
              }
              setRefurbCounts({ pending, inProgress, completed });
            } else {
              setRefurbCounts({ pending: 0, inProgress: 0, completed: 0 });
            }
          } catch (e) {
            warn('refurbish (parse)', e);
            setRefurbCounts({ pending: 0, inProgress: 0, completed: 0 });
          }
        } else {
          warn('refurbish', r4.reason);
          setRefurbCounts({ pending: 0, inProgress: 0, completed: 0 });
        }
      } catch (e) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn('[dashboard] unexpected load error', e);
        }
        setData(null);
        setDashboardSummaryFailed(true);
        setMonthlyRevenue([]);
        setTopModels([]);
        setAlerts([]);
        setRepairCounts({ pending: 0, inProgress: 0 });
        setRefurbCounts({ pending: 0, inProgress: 0, completed: 0 });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    loadDashboard();
    const onRefresh = () => loadDashboard();
    window.addEventListener('fusiku-dashboard-refresh', onRefresh);
    return () => window.removeEventListener('fusiku-dashboard-refresh', onRefresh);
  }, [loadDashboard]);

  if (loading) {
    return (
      <PageLayout className="page dashboard">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', padding: 24 }}>
          <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} />
          <DashboardSkeleton />
        </div>
      </PageLayout>
    );
  }

  const safeData = (data ?? {}) as Record<string, any>;
  const showLoadFailed = dashboardSummaryFailed;
  const trialState = getTrialUiState();
  const trialDays = getTrialCalendarDaysRemaining();

  const trialCountdownLabel =
    trialDays === null || trialState !== 'active'
      ? null
      : trialDays <= 0
        ? t('billing.trialEndsToday')
        : trialDays === 1
          ? t('billing.trialEndsOneDay')
          : t('billing.trialEndsInDays', { count: trialDays });

  const money = (amount: any) =>
    formatMoney(convert(Number(amount || 0), ledgerBaseCurrency, selectedCurrency), selectedCurrency);

  const lowStockAlertActive = alerts.length > 0 || Number(safeData.lowStockAlerts ?? 0) > 0;
  const monthNetProfitVal = Number(safeData.companyNetProfitMonth ?? 0);
  const negativeProfitAlertActive = monthNetProfitVal < 0;

  const riskTone: 'ok' | 'warn' | 'danger' = negativeProfitAlertActive
    ? 'danger'
    : lowStockAlertActive
      ? 'warn'
      : 'ok';

  /** Business snapshot — lifetime / totals (4). */
  const primaryKpis = [
    { labelKey: 'dashboard.totalSales', value: money(safeData.totalSales ?? 0), tone: 'sales' as const },
    { labelKey: 'dashboard.totalProfit', value: money(safeData.totalProfit ?? 0), tone: 'profit' as const },
    { labelKey: 'dashboard.inventoryUnits', value: safeData.totalDevicesInStock ?? safeData.totalInventory ?? 0, tone: 'inventory' as const },
    { labelKey: 'dashboard.repairsInProgress', value: safeData.repairsInProgress ?? 0, tone: 'neutral' as const },
  ];

  const monthlyRevenueSorted = [...monthlyRevenue].sort((a, b) =>
    String(a.month || a.date || a.label || '').localeCompare(String(b.month || b.date || b.label || ''))
  );

  const chartData = {
    labels: monthlyRevenueSorted.map((r) => r.month || r.date || r.label || ''),
    datasets: [
      {
        label: t('reports.revenue'),
        data: monthlyRevenueSorted.map((r) =>
          convert(Number(r.revenue ?? r.amount ?? r.total ?? 0), ledgerBaseCurrency, selectedCurrency)
        ),
        backgroundColor: 'rgba(37, 99, 235, 0.55)',
        borderColor: '#2563eb',
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#6b7280', maxRotation: 45, minRotation: 0, font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(15, 23, 42, 0.06)' },
        ticks: { color: '#6b7280', font: { size: 11 } },
      },
    },
  };

  const hasAnyMeaningfulData =
    Number(safeData.totalSales ?? 0) > 0 ||
    Number(safeData.totalProfit ?? 0) > 0 ||
    Number(safeData.totalDevicesInStock ?? safeData.totalInventory ?? 0) > 0 ||
    (monthlyRevenueSorted.length ?? 0) > 0 ||
    ((safeData.recentSales || []) as any[]).length > 0;

  const isFirstTime = !hasAnyMeaningfulData;
  const isDemoCompany = String(companyName || '').toLowerCase().includes('demo');

  return (
    <PageLayout className="page dashboard">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>

        {showWelcomeBanner && (
          <div className="dashboard-welcome-banner" role="status">
            <p className="dashboard-welcome-banner__text">{t('dashboard.welcomeFusiku')}</p>
            <button type="button" className="dashboard-welcome-banner__dismiss" onClick={dismissWelcome}>
              {t('common.close')}
            </button>
          </div>
        )}
        {trialState === 'active' && trialCountdownLabel && (
          <div className="dashboard-trial-strip" role="status">
            <div className="dashboard-trial-strip__main">
              <span className="dashboard-trial-strip__dot" aria-hidden />
              <span className="dashboard-trial-strip__label">{t('billing.trialActive')}</span>
            </div>
            <p className="dashboard-trial-strip__countdown">{trialCountdownLabel}</p>
          </div>
        )}
        {trialState === 'expired' && (
          <div className="dashboard-trial-expired" role="alert">
            <h2 className="dashboard-trial-expired__title">{t('billing.trialExpiredTitle')}</h2>
            <p className="dashboard-trial-expired__body">{t('billing.trialExpiredBody')}</p>
            <div className="dashboard-trial-expired__actions">
              <Link to="/settings#billing-plans-section" className="btn btn-primary">
                {t('billing.trialExpiredCta')}
              </Link>
              <a className="btn btn-secondary" href={getBillingMailtoProHref()}>
                {t('billing.contactForPro')}
              </a>
            </div>
          </div>
        )}
        <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} />
        {!showLoadFailed && (safeData.reportingNotice || safeData.dataQuality?.hasLegacyCost) && (
          <div className="card dashboard-financial-notice" role="status">
            {safeData.reportingNotice && <p className="dashboard-financial-notice__line">{safeData.reportingNotice}</p>}
            {safeData.dataQuality?.hasLegacyCost && (
              <p className="dashboard-financial-notice__line muted">
                <span className="dashboard-financial-notice__badge" aria-hidden>
                  !
                </span>{' '}
                Legacy cost in use — some inventory rows lack auditable USD cost.
              </p>
            )}
          </div>
        )}
        {showLoadFailed && (
          <ErrorState
            className="dashboard-load-failed"
            message={t('dashboard.loadFailed')}
            hint={t('dashboard.loadFailedHint')}
            onRetry={loadDashboard}
            retryLabel={t('dashboard.retryLoad')}
          />
        )}

        {!showLoadFailed && (
          <>
            {isDemoCompany ? (
              <div className="dashboard-demo-badge" role="status">
                {t('dashboard.demoCompany', { defaultValue: 'Demo Company' })}
              </div>
            ) : null}

            {isFirstTime ? (
              <section className="section card dashboard-first-time" aria-label={t('dashboard.welcome', { defaultValue: 'Welcome' })}>
                <div className="dashboard-first-time__head">
                  <h2 className="dashboard-first-time__title">
                    {t('dashboard.welcomeTitle', { defaultValue: 'Welcome — you’re ready to run your business' })}
                  </h2>
                  <p className="dashboard-first-time__hint muted">
                    {t('dashboard.welcomeHint', {
                      defaultValue:
                        'Track every phone by IMEI, manage branches, see profit live, and work in multiple currencies — with automatic insights built in.',
                    })}
                  </p>
                </div>
                <div className="dashboard-first-time__actions">
                  <Link to="/inventory?new=1" className="btn btn-primary">
                    {t('dashboard.addProduct', { defaultValue: 'Add product' })}
                  </Link>
                  <Link to="/pos" className="btn btn-secondary">
                    {t('dashboard.createSale', { defaultValue: 'Create sale' })}
                  </Link>
                </div>
              </section>
            ) : null}

            <section className="section card dashboard-hero" aria-label={t('dashboard.ariaExecutiveKpis')}>
              <div className="dashboard-hero__head">
                <div className="dashboard-hero__title-wrap">
                  <p className="dashboard-hero__kicker">{t('dashboard.executive.title')}</p>
                  <h2 className="dashboard-hero__title">{t('dashboard.executive.hint')}</h2>
                </div>
                <div className={`dashboard-risk-badge dashboard-risk-badge--${riskTone}`} role="status">
                  {riskTone === 'danger'
                    ? t('dashboard.riskHigh')
                    : riskTone === 'warn'
                      ? t('dashboard.riskMedium')
                      : t('dashboard.riskLow')}
                </div>
              </div>

              <div
                className="dashboard-hero__kpis"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 16,
                }}
              >
                {primaryKpis.map(({ labelKey, value, tone }) => (
                  <div
                    key={labelKey}
                    className={`card dashboard-mini-kpi dashboard-mini-kpi--${tone} ds-has-tooltip`}
                    tabIndex={0}
                    data-tooltip={t('dashboard.kpiTooltip', {
                      defaultValue:
                        'Totals shown are lifetime values from your reports, converted to your selected display currency where applicable.',
                    })}
                    style={{ padding: 20 }}
                  >
                    <span className="dashboard-mini-kpi__label">{t(labelKey)}</span>
                    <span className="dashboard-mini-kpi__value" style={{ fontSize: 24, fontWeight: 600 }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="section card chart-container dashboard-chart-card" aria-label={t('dashboard.revenueByMonth', { count: REVENUE_CHART_MONTHS })}>
              <div className="dashboard-chart-card__head">
                <h3
                  className="dashboard-chart-card__title ds-has-tooltip"
                  tabIndex={0}
                  data-tooltip={t('dashboard.revenueChartTooltip', {
                    defaultValue:
                      'Revenue is grouped by month (not a rolling 30 days) and converted to your selected display currency.',
                  })}
                >
                  {t('dashboard.revenueByMonth', { count: REVENUE_CHART_MONTHS })}
                </h3>
                <p className="dashboard-chart-card__subtitle muted">{t('dashboard.revenueChartSubtitle')}</p>
              </div>
              <div className="dashboard-chart dashboard-chart--primary">
                {monthlyRevenueSorted.length > 0 ? (
                  <Bar data={chartData} options={chartOptions} />
                ) : (
                  <div className="dashboard-empty-state premium" role="status">
                    <p className="dashboard-empty-state__text">{t('dashboard.emptyRevenueChart')}</p>
                    <span className="dashboard-empty-state__hint">Start by adding purchases or sales</span>
                  </div>
                )}
              </div>
            </section>

            <section className="section card dashboard-activity" aria-label={t('dashboard.recentSales')}>
              <div className="dashboard-section-head">
                <h3 className="dashboard-section-head__title">{t('dashboard.recentSales')}</h3>
                <div className="dashboard-activity__actions">
                  <Link to="/reports" className="btn btn-secondary">
                    {t('nav.reports')}
                  </Link>
                </div>
              </div>
              {(safeData.recentSales || []).length ? (
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
                      {(safeData.recentSales || []).slice(0, 8).map((sale: any, saleIdx: number) => {
                        const raw = sale.createdAt ? new Date(sale.createdAt) : null;
                        const dateLabel = raw && !Number.isNaN(raw.getTime()) ? formatDateForUi(raw) : '—';
                        const rowKey =
                          sale?.id != null && String(sale.id).length > 0 ? String(sale.id) : `recent-sale-${saleIdx}`;
                        return (
                          <tr key={rowKey}>
                            <td>{dateLabel}</td>
                            <td className="num">{money(sale.totalAmount)}</td>
                            <td className="num">{money(sale.profit ?? 0)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={<ClipboardList />}
                  title={t('dashboard.noRecentSales', { defaultValue: 'No sales yet' })}
                  description={t('dashboard.noRecentSalesHint', {
                    defaultValue: 'Create your first sale in POS — it will appear here instantly.',
                  })}
                  action={
                    <Link to="/pos" className="btn btn-primary">
                      <DollarSign size={16} /> {t('nav.pos')}
                    </Link>
                  }
                />
              )}
            </section>
          </>
        )}
      </div>
    </PageLayout>
  );
}
