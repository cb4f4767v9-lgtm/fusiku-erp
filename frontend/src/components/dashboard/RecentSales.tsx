import { Link } from 'react-router-dom';
import { ClipboardList, DollarSign } from 'lucide-react';
import { EmptyState } from '../design-system';
import { formatDateForUi } from '../../utils/formatting';

export function RecentSales(props: {
  t: (key: string, opts?: any) => string;
  recentSales: any[];
  money: (amount: any) => string;
}) {
  const { t, recentSales, money } = props;
  return (
    <section className="section card dashboard-activity" aria-label={t('dashboard.recentSales')}>
      <div className="dashboard-section-head">
        <h3 className="dashboard-section-head__title">{t('dashboard.recentSales')}</h3>
        <div className="dashboard-activity__actions">
          <Link to="/reports" className="btn btn-secondary">
            {t('nav.reports')}
          </Link>
        </div>
      </div>
      {recentSales.length ? (
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
              {recentSales.slice(0, 8).map((sale: any, saleIdx: number) => {
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
          title={t('dashboard.noRecentSales')}
          description={t('dashboard.noRecentSalesHint')}
          action={
            <Link to="/pos" className="btn btn-primary">
              <DollarSign size={16} aria-hidden /> {t('dashboard.createFirstSale')}
            </Link>
          }
        />
      )}
    </section>
  );
}

