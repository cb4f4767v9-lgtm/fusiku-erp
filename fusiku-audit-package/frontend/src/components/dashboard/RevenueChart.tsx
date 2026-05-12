import { Bar } from 'react-chartjs-2';

export function RevenueChart(props: {
  t: (key: string, opts?: any) => string;
  months: number;
  hasData: boolean;
  chartData: any;
  chartOptions: any;
}) {
  const { t, months, hasData, chartData, chartOptions } = props;
  return (
    <section
      className="section card chart-container dashboard-chart-card"
      aria-label={t('dashboard.revenueByMonth', { count: months })}
    >
      <div className="dashboard-chart-card__head">
        <h3
          className="dashboard-chart-card__title ds-has-tooltip"
          tabIndex={0}
          data-tooltip={t('dashboard.revenueChartTooltip', {
            defaultValue:
              'Revenue is grouped by month (not a rolling 30 days) and converted to your selected display currency.',
          })}
        >
          {t('dashboard.revenueByMonth', { count: months })}
        </h3>
        <p className="dashboard-chart-card__subtitle muted">{t('dashboard.revenueChartSubtitle')}</p>
      </div>
      <div className="dashboard-chart dashboard-chart--primary">
        {hasData ? (
          <Bar data={chartData} options={chartOptions} />
        ) : (
          <div className="dashboard-empty-state premium" role="status">
            <p className="dashboard-empty-state__text">
              {t('dashboard.emptyRevenueChart', { defaultValue: 'No revenue yet — let’s create your first sale 🚀' })}
            </p>
            <span className="dashboard-empty-state__hint">
              {t('dashboard.emptyRevenueChartHint', { defaultValue: 'Add purchases or create a sale to unlock insights.' })}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

