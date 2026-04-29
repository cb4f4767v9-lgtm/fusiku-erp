import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { AuthShell } from '../components/auth/AuthShell';
import { AppHeader } from '../components/common/AppHeader';
import { billingApi } from '../services/api';
import { getErrorMessage } from '../utils/getErrorMessage';
import { useAuth } from '../hooks/useAuth';

type PlanKey = 'BASIC' | 'PRO' | 'ENTERPRISE';

type PricingPlan = {
  key: PlanKey;
  name: string;
  priceLabel: string;
  highlight?: boolean;
  features: string[];
};

function recommendedFromRequirements(req: string | null | undefined): PlanKey {
  const r = String(req || '').toLowerCase();
  if (r.includes('full')) return 'ENTERPRISE';
  if (r.includes('inventory')) return 'PRO';
  if (r.includes('account')) return 'BASIC';
  return 'PRO';
}

export default function PricingPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [loadingKey, setLoadingKey] = useState<PlanKey | null>(null);

  const setupRequirements = (location.state as any)?.requirements as string | undefined;
  const recommendedKey = useMemo(() => recommendedFromRequirements(setupRequirements), [setupRequirements]);

  const plans: PricingPlan[] = useMemo(
    () => [
      {
        key: 'BASIC',
        name: 'BASIC',
        priceLabel: '$15/month',
        features: ['Accounting only', '1 branch', 'Basic reports'],
      },
      {
        key: 'PRO',
        name: 'PRO',
        priceLabel: '$39/month',
        highlight: true,
        features: ['Inventory + POS', 'IMEI tracking', 'Purchase & sales', 'Up to 3 branches'],
      },
      {
        key: 'ENTERPRISE',
        name: 'ENTERPRISE',
        priceLabel: '$99/month',
        features: ['Full ERP', 'Unlimited branches', 'Repair module', 'Multi-currency', 'AI insights'],
      },
    ],
    []
  );

  const choose = async (planKey: PlanKey) => {
    if (!token) {
      toast.error(t('common.pleaseLogin', { defaultValue: 'Please sign in first.' }));
      navigate('/login');
      return;
    }
    setLoadingKey(planKey);
    try {
      await billingApi.choosePlan({ planKey });
      toast.success(t('pricing.planSelected', { defaultValue: 'Plan selected' }));
      navigate('/', { replace: true });
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, t('pricing.chooseFailed', { defaultValue: 'Failed to choose plan' })));
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <AuthShell overflow="auto" topControls="app">
      <AppHeader />
      <div className="min-h-screen w-full flex items-center justify-center overflow-x-hidden overflow-y-auto">
        <div className="w-full max-w-6xl px-6 lg:px-10 py-12">
          <div className="mx-auto max-w-3xl text-center mb-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-2 text-xs text-white/80 backdrop-blur-2xl">
              <Sparkles size={16} className="text-fuchsia-200" />
              {t('pricing.badge', { defaultValue: 'Choose a plan to continue' })}
            </div>
            <h1 className="mt-5 text-xl font-semibold tracking-tight text-white/95">
              {t('pricing.title', { defaultValue: 'Pricing' })}
            </h1>
            <p className="mt-3 text-sm text-white/70">
              {t('pricing.subtitle', { defaultValue: 'Start a free trial. Upgrade anytime.' })}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {plans.map((p) => {
              const recommended = p.key === recommendedKey;
              const highlighted = Boolean(p.highlight);
              const busy = loadingKey === p.key;
              return (
                <div
                  key={p.key}
                  className={`relative rounded-2xl p-7 bg-white/10 border backdrop-blur-2xl shadow-2xl ${
                    highlighted ? 'border-white/35 ring-2 ring-cyan-300/30' : 'border-white/20'
                  }`}
                >
                  {recommended ? (
                    <div className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 px-3 py-1 text-xs font-semibold text-white shadow-lg">
                      {t('pricing.recommended', { defaultValue: 'Recommended for you' })}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-3">
                    <div className="text-lg font-semibold text-white">{p.name}</div>
                    {highlighted ? (
                      <div className="text-xs text-white/80 rounded-full bg-white/10 border border-white/15 px-3 py-1">
                        {t('pricing.popular', { defaultValue: 'Popular' })}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-baseline gap-2">
                    <div className="text-3xl font-bold text-white">{p.priceLabel.split('/')[0]}</div>
                    <div className="text-sm text-white/60">/{p.priceLabel.split('/')[1]}</div>
                  </div>

                  <ul className="mt-6 space-y-3 text-sm text-white/80">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-3">
                        <CheckCircle2 size={18} className="mt-0.5 text-emerald-300" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => choose(p.key)}
                    disabled={Boolean(loadingKey) && !busy}
                    className={`mt-8 w-full py-3 rounded-xl text-sm font-semibold text-white transition ${
                      highlighted
                        ? 'bg-gradient-to-r from-cyan-400 to-purple-500 hover:opacity-95'
                        : 'bg-white/10 border border-white/20 hover:bg-white/15'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {busy ? t('common.saving', { defaultValue: 'Saving...' }) : t('pricing.choose', { defaultValue: 'Choose Plan' })}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AuthShell>
  );
}

