import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { plansApi } from '../services/api';
import { PageLayout, PageHeader, LoadingSkeleton } from '../components/design-system';
import { getBillingMailtoProHref } from '../config/billingContact';
import { getErrorMessage } from '../utils/getErrorMessage';

type PlanRow = {
  id: string;
  name: string;
  priceMonthly: number;
  pricingModel: string;
  maxBranches: number;
  maxUsers: number;
  limitsUnlimited: boolean;
  features: Record<string, boolean>;
};

export default function PlansPage() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    plansApi
      .list()
      .then((r) => {
        if (cancelled) return;
        setPlans(Array.isArray(r.data) ? (r.data as PlanRow[]) : []);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setPlans([]);
        setError(getErrorMessage(e, t('plans.loadFailed')));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const featureKeys = ['multiCurrency', 'aiInsights', 'forexTrading', 'removeBranding'] as const;

  return (
    <PageLayout className="page plans-page">
      <PageHeader title={t('plans.title')} subtitle={t('plans.subtitle')} />
      {loading ? <LoadingSkeleton rows={4} cols={6} /> : null}
      {error ? <p className="login-form-banner-error">{error}</p> : null}
      {!loading && !error && plans.length === 0 ? <p>{t('plans.none')}</p> : null}
      {!loading && plans.length > 0 ? (
        <div className="plans-page__table-wrap">
          <table className="data-table plans-compare-table">
            <thead>
              <tr>
                <th>{t('plans.plan')}</th>
                <th className="num">{t('plans.priceMonthly')}</th>
                <th>{t('plans.model')}</th>
                <th className="num">{t('plans.maxBranches')}</th>
                <th className="num">{t('plans.maxUsers')}</th>
                {featureKeys.map((k) => (
                  <th key={k}>{t(`plans.feature.${k}`)}</th>
                ))}
                <th>{t('plans.action')}</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    {p.limitsUnlimited ? <div className="plans-muted">{t('plans.unlimitedCaps')}</div> : null}
                  </td>
                  <td className="num">
                    {p.priceMonthly <= 0 ? t('plans.free') : `$${p.priceMonthly.toFixed(0)}`}
                  </td>
                  <td>{p.pricingModel}</td>
                  <td className="num">{p.limitsUnlimited ? '—' : p.maxBranches}</td>
                  <td className="num">{p.limitsUnlimited ? '—' : p.maxUsers}</td>
                  {featureKeys.map((k) => (
                    <td key={k}>{p.features?.[k] ? '✓' : '—'}</td>
                  ))}
                  <td>
                    <a className="btn btn-primary btn-compact" href={getBillingMailtoProHref()}>
                      {t('plans.upgrade')}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </PageLayout>
  );
}
