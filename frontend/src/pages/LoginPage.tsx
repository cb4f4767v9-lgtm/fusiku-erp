import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { MissingCompanyIdError } from '../services/api';
import { getBaseLanguage } from '../utils/i18nLocale';
import { getErrorMessage } from '../utils/getErrorMessage';
import { useInputLanguage } from '../hooks/useInputLanguage';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  CheckCircle2,
  Lock,
  Mail,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { resolveCompanyIdForAuth } from '../utils/authSession';
import { AuthShell } from '../components/auth/AuthShell';
import { AppHeader } from '../components/common/AppHeader';

const logoIconUrl = '/logo-icon.svg';
const brandWordmarkUrl = '/brand/fusiku-brand.svg';
const brandSloganUrl = '/brand/fusiku-slogan.svg';

const brandName = {
  en: 'FUSIKU',
  zh: '福西库',
  ur: 'فوسیکو',
  ar: 'فوسيکو',
} as const;

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const inputLang = useInputLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const canSubmit = useMemo(() => Boolean(email && password) && !loading, [email, password, loading]);

  useEffect(() => {
    try {
      const reason = sessionStorage.getItem('fusiku_session_reason');
      if (reason === 'session_expired') {
        toast.error(t('common.sessionExpired'));
        sessionStorage.removeItem('fusiku_session_reason');
        sessionStorage.removeItem('fusiku_redirect_login');
      }
    } catch {
      /* ignore */
    }
  }, [t]);

  const resolvedBrandName = useMemo(() => {
    const code = getBaseLanguage(i18n.resolvedLanguage || i18n.language);
    return brandName[code as keyof typeof brandName] ?? brandName.en;
  }, [i18n.language, i18n.resolvedLanguage]);

  const isRTL = useMemo(() => {
    const code = (i18n.language || 'en').split('-')[0].toLowerCase();
    return ['ar', 'ur'].includes(code);
  }, [i18n.language]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error(t('login.pleaseFillFields'));
      return;
    }

    setLoading(true);
    try {
      const cid = resolveCompanyIdForAuth() || undefined;
      await login(email, password, { companyId: cid });
      toast.success(t('login.welcomeBack'));
      navigate('/');
    } catch (err: unknown) {
      if (err instanceof MissingCompanyIdError) {
        toast.error(t('login.missingCompanyId'));
        return;
      }
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) toast.error(t('login.accountConfigError'));
      else {
        let msg = getErrorMessage(err, t('login.loginFailed'));
        const lookedLikeInvalidCreds = /invalid credential/i.test(msg);
        const cid = resolveCompanyIdForAuth() || undefined;

        /**
         * Premium UX: when the browser has a stale/wrong tenant id (env or localStorage),
         * backend will return "Invalid credentials" even if the password is correct,
         * because login queries by (email + companyId).
         *
         * Fix: if we used a companyId and got invalid creds, clear the remembered tenant
         * and retry once without companyId (backend will auto-resolve if unique).
         */
        if (lookedLikeInvalidCreds && cid) {
          try {
            localStorage.removeItem('fusiku_last_company_id');
          } catch {
            /* ignore */
          }
          try {
            // Explicitly bypass env/localStorage tenant auto-resolution.
            await login(email, password, { companyId: null });
            toast.success(t('login.welcomeBack'));
            navigate('/');
            return;
          } catch (retryErr: unknown) {
            msg = getErrorMessage(retryErr, msg);
          }
        }

        if (lookedLikeInvalidCreds) msg = `${msg} ${t('login.invalidCredentialsHint')}`;
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  usePageTitle('login.title');

  return (
    <AuthShell overflow="auto" topControls="auth">
      <AppHeader />

      <div className={`min-h-screen w-full flex items-center justify-center overflow-x-hidden overflow-y-auto ${isRTL ? 'direction-rtl' : ''}`}>
        <div className={`w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center px-6 lg:px-10 py-10`}>
          {/* LEFT */}
          <section className="flex flex-col justify-center lg:-ml-6">
            {/* Logo + brand (marked 2) */}
            <div className="flex flex-col items-start gap-4 mb-10 lg:ml-14">
              <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 backdrop-blur-xl flex items-center justify-center">
                <img src={logoIconUrl} alt="" className="w-7 h-7" />
              </div>
              <div className="flex flex-col gap-2">
                <div className="text-4xl font-bold tracking-tight">{resolvedBrandName}</div>
                <div className="text-lg text-white/70">{t('brand.slogan')}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {[
                {
                  icon: Boxes,
                  title: t('login.value1', { defaultValue: 'Track every phone (IMEI)' }),
                  desc: 'Full lifecycle tracking for every device.',
                  tone: 'bg-blue-500',
                },
                {
                  icon: Building2,
                  title: t('login.value2', { defaultValue: 'Manage multiple branches' }),
                  desc: 'Centralized control, local performance.',
                  tone: 'bg-emerald-500',
                },
                {
                  icon: BarChart3,
                  title: t('login.value3', { defaultValue: 'See profit live' }),
                  desc: 'Real‑time analytics that drive growth.',
                  tone: 'bg-violet-500',
                },
                {
                  icon: Sparkles,
                  title: t('login.value4', { defaultValue: 'Get automatic insights' }),
                  desc: 'AI‑powered suggestions for better decisions.',
                  tone: 'bg-amber-500',
                },
              ].map(({ icon: Icon, title, desc, tone }) => (
                <div
                  key={title}
                  className="rounded-2xl p-6 bg-white/10 border border-white/20 backdrop-blur-xl min-h-[128px]"
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-11 h-11 rounded-lg ${tone} flex items-center justify-center shadow-lg shadow-black/10`}>
                      <Icon size={19} aria-hidden className="text-white" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="text-[15px] font-semibold leading-5">{title}</div>
                      <div className="text-xs text-white/60">{desc}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom info box */}
            <div className="mt-8 rounded-2xl p-5 text-sm text-white/70 bg-white/10 border border-white/20 backdrop-blur-xl">
              <div className="flex items-start gap-3">
                <ShieldCheck size={18} aria-hidden className="mt-0.5 text-white/60" />
                <div>
                  {t('login.valueTrust', {
                    defaultValue: 'Clean workflows, export-ready reporting, and professional receipts.',
                  })}
                </div>
              </div>
            </div>

            {/* Video tutorial (bottom-left) */}
            <div className="mt-6">
              <Link
                to="/tutorial"
                className="inline-flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white/80 ring-1 ring-white/20 backdrop-blur-2xl transition hover:-translate-y-0.5 hover:bg-white/15"
              >
                <PlayCircle size={18} aria-hidden className="text-fuchsia-200" />
                {t('login.watchTutorial', { defaultValue: 'Watch tutorial' })}
              </Link>
            </div>
          </section>

          {/* RIGHT */}
          <section className="flex items-center justify-center lg:justify-center">
            <div className="w-full max-w-md p-8 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-2xl shadow-xl">
              <div className="flex flex-col">
                <div className="flex flex-col gap-2">
                  <div className="text-2xl font-semibold mb-2">{t('login.welcomeBack', { defaultValue: 'Welcome back' })} 👋</div>
                  <div className="text-sm text-white/70 mb-6">{t('login.subtitle', { defaultValue: 'Sign in to continue to your account' })}</div>
                </div>

                {/* Company selected row */}
                <div className="rounded-xl px-4 py-3 mb-4 bg-white/10 border border-white/20 text-sm flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Building2 size={18} aria-hidden className="text-white/80" />
                    <div className="text-sm text-white/80">
                      {t('login.companyIdAuto', { defaultValue: 'Company is selected automatically for this device.' })}
                    </div>
                  </div>
                  <CheckCircle2 size={18} aria-hidden className="text-emerald-300" />
                </div>

                <form id="signin" onSubmit={handleSubmit}>
                  <div className="flex flex-col gap-4">
                    <label className="flex flex-col">
                      <span className="text-xs text-white/70 mb-1">{t('login.email', { defaultValue: 'Email address' })}</span>
                      <input
                        type="email"
                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/40 outline-none"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        disabled={loading}
                        placeholder={t('login.email', { defaultValue: 'Enter your email' })}
                        lang={inputLang}
                      />
                    </label>

                    <label className="flex flex-col">
                      <span className="text-xs text-white/70 mb-1">{t('login.password', { defaultValue: 'Password' })}</span>
                      <input
                        type="password"
                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/40 outline-none"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        disabled={loading}
                        placeholder={t('login.password', { defaultValue: 'Enter your password' })}
                        lang={inputLang}
                      />
                    </label>

                    <div className="flex items-center justify-between text-xs mt-2">
                      <label className="flex items-center gap-2 text-white/70">
                        <input type="checkbox" className="h-4 w-4 rounded border-white/20 bg-white/10" />
                        {t('login.rememberMe', { defaultValue: 'Remember me' })}
                      </label>
                      <Link to="/forgot-password" className="font-semibold text-white/80 hover:text-white">
                        {t('login.forgot', { defaultValue: 'Forgot password?' })}
                      </Link>
                    </div>

                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className="w-full py-3 mt-4 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {loading ? t('login.signingIn') : t('login.signin', { defaultValue: 'Sign In' })}
                    </button>

                    <div className="flex items-center gap-3 my-4 text-xs text-white/60">
                      <div className="h-px flex-1 bg-white/20" />
                      <div>{t('login.orContinue', { defaultValue: 'or continue with' })}</div>
                      <div className="h-px flex-1 bg-white/20" />
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="flex-1 py-2 rounded-xl bg-white/10 border border-white/20 text-xs text-white/80 inline-flex items-center justify-center gap-2"
                      >
                        <span aria-hidden className="inline-flex h-4 w-4 items-center justify-center">
                          <svg viewBox="0 0 48 48" className="h-4 w-4">
                            <path fill="#EA4335" d="M24 9.5c3.3 0 6.2 1.1 8.5 3.3l6.2-6.2C34.9 2.6 29.8 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.2 5.6C11.7 13.2 17.3 9.5 24 9.5z"/>
                            <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-2.7-.4-4H24v7.7h12.7c-.3 2-1.8 5-5 7l7.7 6C43.8 35.1 46.1 30.3 46.1 24.5z"/>
                            <path fill="#FBBC05" d="M9.9 28.9a14.6 14.6 0 0 1 0-9.8l-7.2-5.6A24 24 0 0 0 0 24c0 3.9 1 7.6 2.7 10.5l7.2-5.6z"/>
                            <path fill="#34A853" d="M24 48c6.5 0 12-2.1 16-5.8l-7.7-6c-2.1 1.4-4.9 2.4-8.3 2.4-6.7 0-12.3-3.7-14.1-9.1l-7.2 5.6C6.6 42.6 14.6 48 24 48z"/>
                          </svg>
                        </span>
                        <span>Google</span>
                      </button>

                      <button
                        type="button"
                        className="flex-1 py-2 rounded-xl bg-white/10 border border-white/20 text-xs text-white/80 inline-flex items-center justify-center gap-2"
                      >
                        <span aria-hidden className="inline-flex h-4 w-4 items-center justify-center">
                          <svg viewBox="0 0 24 24" className="h-4 w-4">
                            <path fill="#F25022" d="M2 2h9v9H2z"/>
                            <path fill="#7FBA00" d="M13 2h9v9h-9z"/>
                            <path fill="#00A4EF" d="M2 13h9v9H2z"/>
                            <path fill="#FFB900" d="M13 13h9v9h-9z"/>
                          </svg>
                        </span>
                        <span>Microsoft</span>
                      </button>

                      <button
                        type="button"
                        className="flex-1 py-2 rounded-xl bg-white/10 border border-white/20 text-xs text-white/80 inline-flex items-center justify-center gap-2"
                      >
                        <span aria-hidden className="inline-flex h-4 w-4 items-center justify-center">
                          <svg viewBox="0 0 24 24" className="h-4 w-4">
                            <path
                              fill="#ffffff"
                              d="M16.5 13.2c0-2 1.6-2.9 1.7-3-1-1.4-2.6-1.6-3.1-1.6-1.3-.1-2.5.8-3.1.8-.6 0-1.6-.8-2.7-.8-1.4 0-2.6.8-3.3 2-1.4 2.4-.4 5.9 1 7.8.7.9 1.5 2 2.6 2 .9 0 1.3-.6 2.4-.6 1.1 0 1.4.6 2.5.6 1.1 0 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.2s-2.6-1-2.6-3zM14.6 7.3c.6-.8 1-1.9.9-3-1 .1-2.1.7-2.7 1.4-.6.7-1.1 1.8-.9 2.9 1 .1 2.1-.5 2.7-1.3z"
                            />
                          </svg>
                        </span>
                        <span>Apple</span>
                      </button>
                    </div>

                    <div className="text-xs text-white/60 text-center mt-4">
                      {t('login.noAccount', { defaultValue: 'New company?' })}{' '}
                      <Link to="/signup" className="font-semibold text-white/90 hover:text-white">
                        {t('login.createCompany', { defaultValue: 'Create your workspace' })}
                      </Link>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </section>
        </div>
      </div>
    </AuthShell>
  );
}
