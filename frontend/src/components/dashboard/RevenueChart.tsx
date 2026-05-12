import { Link } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { EmptyState } from '../design-system';

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
        <h3 className="dashboard-chart-card__title">
          {t('dashboard.revenueByMonth', { count: months })}
        </h3>
        <p className="dashboard-chart-card__subtitle muted">{t('dashboard.revenueChartSubtitle')}</p>
      </div>
      <div className="dashboard-chart dashboard-chart--primary">
        {hasData ? (
          <Bar data={chartData} options={chartOptions} />
        ) : (
          <EmptyState
            icon={<BarChart3 />}
            title={t('dashboard.emptyRevenueChart')}
            description={t('dashboard.emptyRevenueChartHint')}
            action={
              <Link to="/pos" className="btn btn-primary">
                {t('dashboard.createFirstRecord')}
              </Link>
            }
          />
        )}
      </div>
    </section>
  );
}
