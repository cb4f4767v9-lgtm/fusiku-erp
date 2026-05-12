import { Link } from 'react-router-dom';
import { Boxes, DollarSign, BarChart3 } from 'lucide-react';

export function SmartActions(props: { t: (key: string, opts?: any) => string }) {
  const { t } = props;
  return (
    <section className="section card dashboard-smart-actions" aria-label={t('dashboard.smartActions', { defaultValue: 'Smart actions' })}>
      <div className="dashboard-smart-actions__head">
        <h3 className="dashboard-smart-actions__title">
          {t('dashboard.smartActions', { defaultValue: 'Smart actions' })}
        </h3>
        <p className="dashboard-smart-actions__subtitle muted">
          {t('dashboard.smartActionsHint', { defaultValue: 'Quick shortcuts to keep your business moving.' })}
        </p>
      </div>

      <div className="dashboard-smart-actions__grid">
        <Link to="/inventory?new=1" className="dashboard-action-btn">
          <span className="dashboard-action-btn__icon" aria-hidden>
            <Boxes size={18} />
          </span>
          <span className="dashboard-action-btn__label">
            {t('dashboard.addProduct', { defaultValue: 'Add Product' })}
          </span>
        </Link>

        <Link to="/pos" className="dashboard-action-btn dashboard-action-btn--primary">
          <span className="dashboard-action-btn__icon" aria-hidden>
            <DollarSign size={18} />
          </span>
          <span className="dashboard-action-btn__label">
            {t('dashboard.createSale', { defaultValue: 'Create Sale' })}
          </span>
        </Link>

        <Link to="/reports" className="dashboard-action-btn">
          <span className="dashboard-action-btn__icon" aria-hidden>
            <BarChart3 size={18} />
          </span>
          <span className="dashboard-action-btn__label">
            {t('dashboard.viewReports', { defaultValue: 'View Reports' })}
          </span>
        </Link>
      </div>
    </section>
  );
}

