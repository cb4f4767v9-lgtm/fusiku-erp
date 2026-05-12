import { Link } from 'react-router-dom';

export function QuickActions(props: { t: (key: string, opts?: any) => string; show: boolean }) {
  const { t, show } = props;
  if (!show) return null;
  return (
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
  );
}

