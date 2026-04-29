import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { BarChart3, Boxes, Building2, Eye, EyeOff, PlayCircle, ShieldCheck, Sparkles } from 'lucide-react';
const logoIconUrl = '/logo-icon.svg';
import { signupApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { getBaseLanguage } from '../utils/i18nLocale';
import { setPostSignupBillingUi } from '../utils/billingUi';
import { getErrorMessage } from '../utils/getErrorMessage';
import { useInputLanguage } from '../hooks/useInputLanguage';
import { usePageTitle } from '../hooks/usePageTitle';
import { rememberCompanyId, persistRefreshToken } from '../utils/authSession';
import { AuthShell } from '../components/auth/AuthShell';
import { AppHeader } from '../components/common/AppHeader';

const brandName = {
  en: 'FUSIKU',
  zh: '福西库',
  ur: 'فوسیکو',
  ar: 'فوسيکو',
} as const;

const WELCOME_SESSION_KEY = 'fusiku_post_signup_welcome';

type SignupFieldErrors = {
  companyName?: string;
  email?: string;
  password?: string;
  form?: string;
};

export default function SignupPage() {
  const { t, i18n } = useTranslation();
  const inputLang = useInputLanguage();
  const [companyName, setCompanyName] = useState('');
  const [companySlogan, setCompanySlogan] = useState('');
  const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<SignupFieldErrors>({});

  const { user, setSession } = useAuth();
  const navigate = useNavigate();

  const canSubmit = useMemo(
    () =>
      Boolean(companyName.trim() && email.trim() && password && confirmPassword) &&
      password === confirmPassword &&
      !loading,
    [companyName, email, password, confirmPassword, loading]
  );

  const resolvedBrandName = useMemo(() => {
    const code = getBaseLanguage(i18n.resolvedLanguage || i18n.language);
    return brandName[code as keyof typeof brandName] ?? brandName.en;
  }, [i18n.language, i18n.resolvedLanguage]);

  const isRTL = useMemo(() => {
    const code = (i18n.language || 'en').split('-')[0].toLowerCase();
    return ['ar', 'ur'].includes(code);
  }, [i18n.language]);

  // Allow creating a new workspace even if a session exists.
  // (Some users land here with a stale session; redirecting to dashboard hides the signup form.)

  usePageTitle('signup.title');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: SignupFieldErrors = {};
    if (!companyName.trim()) next.companyName = t('signup.errorRequired');
    if (!email.trim()) next.email = t('signup.errorRequired');
    if (!password) next.password = t('signup.errorRequired');
    if (password && confirmPassword && password !== confirmPassword) next.password = t('signup.passwordMismatch', { defaultValue: 'Passwords do not match' });
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      const { data } = await signupApi.createTenant({
        companyName: companyName.trim(),
        email: email.trim(),
        password,
      });
      const sessionToken = String(
        (data as { accessToken?: string; token?: string }).accessToken ?? data.token ?? ''
      ).trim();
      const refreshToken = String((data as { refreshToken?: string }).refreshToken ?? '').trim();
      if (!sessionToken) {
        setErrors({ form: t('signup.failed') });
        return;
      }
      if (refreshToken) persistRefreshToken(refreshToken);

      const cid = String((data as { companyId?: string }).companyId ?? (data as { user?: { companyId?: string } })?.user?.companyId ?? '').trim();
      if (cid) rememberCompanyId(cid);
      setSession(sessionToken, data.user);
      setPostSignupBillingUi(companyName.trim());
      sessionStorage.setItem(WELCOME_SESSION_KEY, '1');
      toast.success(t('signup.success'));
      navigate('/setup', { replace: true });
    } catch (err: unknown) {
      setErrors({ form: getErrorMessage(err, t('signup.failed')) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell overflow="auto" topControls="auth">
      <AppHeader />

      <div className={`min-h-screen w-full flex items-center justify-center overflow-x-hidden overflow-y-auto ${isRTL ? 'direction-rtl' : ''}`}>
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center px-6 lg:px-10 py-10">

          {/* LEFT — copy EXACTLY from LoginPage */}
          <section className="flex flex-col justify-center lg:-ml-6">
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
                <div key={title} className="rounded-2xl p-6 bg-white/10 border border-white/20 backdrop-blur-xl min-h-[128px]">
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

          {/* RIGHT SIDE (form) */}
          <section className="flex items-center justify-center lg:justify-center">
            <div className="w-full max-w-md p-8 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-2xl shadow-xl">
              <div className="flex flex-col">
                <div className="flex flex-col gap-2">
                  <div className="text-2xl font-semibold mb-2">{t('signup.title', { defaultValue: 'Create workspace' })}</div>
                  <div className="text-sm text-white/70 mb-6">
                    {t('signup.subtitle', { defaultValue: 'Set up your company and admin account' })}
                  </div>
                </div>

                {errors.form ? (
                  <div className="mb-4 rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-sm text-white/80" role="alert">
                    {errors.form}
                  </div>
                ) : null}

                <form onSubmit={handleSubmit}>
                  <div className="flex flex-col gap-4">
                    <label className="flex flex-col">
                      <span className="text-xs text-white/70 mb-1">{t('signup.companyName', { defaultValue: 'Company name' })}</span>
                      <input
                        type="text"
                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/40 outline-none"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        autoComplete="organization"
                        disabled={loading}
                        placeholder={t('signup.companyNamePlaceholder', { defaultValue: 'e.g. Fusiku Mobile' })}
                        lang={inputLang}
                      />
                    </label>

                    <label className="flex flex-col">
                      <span className="text-xs text-white/70 mb-1">{t('signup.logoUpload', { defaultValue: 'Logo upload' })}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="w-full rounded-xl bg-white/10 border border-white/20 p-2 text-sm text-white/80 file:mr-4 file:rounded-lg file:border-0 file:bg-white/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-white/20"
                        disabled={loading}
                        onChange={(e) => setCompanyLogoFile(e.target.files?.[0] ?? null)}
                      />
                    </label>

                    <label className="flex flex-col">
                      <span className="text-xs text-white/70 mb-1">{t('signup.slogan', { defaultValue: 'Slogan' })}</span>
                      <input
                        type="text"
                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/40 outline-none"
                        value={companySlogan}
                        onChange={(e) => setCompanySlogan(e.target.value)}
                        disabled={loading}
                        placeholder={t('signup.sloganPlaceholder', { defaultValue: 'Your company slogan' })}
                        lang={inputLang}
                      />
                    </label>

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
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="w-full px-4 py-3 pr-12 rounded-xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/40 outline-none"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete="new-password"
                          disabled={loading}
                          placeholder={t('login.password', { defaultValue: 'Enter your password' })}
                          lang={inputLang}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-white/70 hover:text-white"
                          onClick={() => setShowPassword((v) => !v)}
                          disabled={loading}
                          aria-pressed={showPassword}
                          aria-label={showPassword ? t('signup.passwordHide', { defaultValue: 'Hide password' }) : t('signup.passwordShow', { defaultValue: 'Show password' })}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      {errors.password ? (
                        <span className="mt-2 text-xs text-red-200">{errors.password}</span>
                      ) : null}
                    </label>

                    <label className="flex flex-col">
                      <span className="text-xs text-white/70 mb-1">{t('signup.confirmPassword', { defaultValue: 'Confirm password' })}</span>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          className="w-full px-4 py-3 pr-12 rounded-xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/40 outline-none"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          autoComplete="new-password"
                          disabled={loading}
                          placeholder={t('signup.confirmPassword', { defaultValue: 'Confirm your password' })}
                          lang={inputLang}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-white/70 hover:text-white"
                          onClick={() => setShowConfirmPassword((v) => !v)}
                          disabled={loading}
                          aria-pressed={showConfirmPassword}
                          aria-label={showConfirmPassword ? t('signup.passwordHide', { defaultValue: 'Hide password' }) : t('signup.passwordShow', { defaultValue: 'Show password' })}
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </label>

                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className="w-full py-3 mt-4 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {loading ? t('signup.submitting', { defaultValue: 'Creating…' }) : 'Create workspace & continue'}
                    </button>

                    <div className="text-xs text-white/60 text-center mt-4">
                      {t('signup.alreadyHaveAccountLead', { defaultValue: 'Already have an account?' })}{' '}
                      <Link to="/login" className="font-semibold text-white/90 hover:text-white">
                        {t('login.signin', { defaultValue: 'Sign in' })}
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
