import { Link } from 'react-router-dom';
import { getBillingMailtoProHref } from '../../config/billingContact';

export function TrialBanner(props: {
  showWelcomeBanner: boolean;
  onDismissWelcome: () => void;
  trialState: 'active' | 'expired' | 'none' | string;
  trialCountdownLabel: string | null;
  t: (key: string, opts?: any) => string;
}) {
  const { showWelcomeBanner, onDismissWelcome, trialState, trialCountdownLabel, t } = props;

  return (
    <>
      {showWelcomeBanner && (
        <div className="dashboard-welcome-banner" role="status">
          <p className="dashboard-welcome-banner__text">{t('dashboard.welcomeFusiku')}</p>
          <button type="button" className="dashboard-welcome-banner__dismiss" onClick={onDismissWelcome}>
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
    </>
  );
}

