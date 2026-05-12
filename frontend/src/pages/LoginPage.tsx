import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { getBaseLanguage } from '../utils/i18nLocale';
import { getErrorMessage } from '../utils/getErrorMessage';
import { isLikelyEmailDeliveryFailure } from '../utils/isLikelyEmailDeliveryFailure';
import { useInputLanguage } from '../hooks/useInputLanguage';
import { usePageTitle } from '../hooks/usePageTitle';
import { BarChart3, Boxes, Building2, CheckCircle2, PlayCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { AuthShell } from '../components/auth/AuthShell';
import { AppHeader } from '../components/common/AppHeader';

const logoIconUrl = '/logo-icon.svg';

const brandName = {
  en: 'FUSIKU',
  zh: '福西库',
  ur: 'فوسیکو',
  ar: 'فوسيکو',
} as const;

const LOGIN_OTP_RESEND_COOLDOWN_SEC = 90;

type ChallengeKind = 'device' | 'email';

function formatOtpCountdownMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const inputLang = useInputLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  /** Primary password vs secondary email-OTP request (when not in challenge flow). */
  const [authMethod, setAuthMethod] = useState<'password' | 'otp'>('password');
  const [loading, setLoading] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [challengeKind, setChallengeKind] = useState<ChallengeKind | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const [resendInFlight, setResendInFlight] = useState(false);

  const { loginWithPassword, verifyDeviceLogin, resendDeviceOtp, requestOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();

  const canSendOtp = useMemo(() => Boolean(email) && !loading, [email, loading]);
  const canPasswordLogin = useMemo(
    () => Boolean(email && password) && !loading,
    [email, password, loading]
  );
  const canVerifyOtp = useMemo(() => Boolean(challengeId && otpCode.replace(/\s/g, '').length === 6) && !loading, [challengeId, otpCode, loading]);

  useEffect(() => {
    if (!challengeId) {
      setResendSecondsLeft(0);
      return;
    }
    const id = window.setInterval(() => {
      setResendSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [challengeId]);

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

  const resetChallenge = () => {
    setChallengeId(null);
    setChallengeKind(null);
    setOtpCode('');
    setResendSecondsLeft(0);
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const out = await loginWithPassword(email, password, rememberDevice);
      if (out.requiresDeviceVerification) {
        setChallengeId(out.challengeId);
        setChallengeKind('device');
        setOtpCode('');
        setResendSecondsLeft(LOGIN_OTP_RESEND_COOLDOWN_SEC);
        toast.success(
          t('login.deviceVerificationSent', { defaultValue: 'Enter the verification code we sent you.' })
        );
        return;
      }
      toast.success(t('login.welcomeBack'));
      navigate(out.isNewUser ? '/setup' : '/');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, t('login.loginFailed', { defaultValue: 'Sign-in failed.' })));
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const out = await requestOtp(email);
      setChallengeId(out.challengeId);
      setChallengeKind('email');
      setOtpCode('');
      setResendSecondsLeft(LOGIN_OTP_RESEND_COOLDOWN_SEC);
      toast.success(t('login.stepUpCodeSent', { defaultValue: 'Enter the verification code we sent you.' }));
    } catch (err: unknown) {
      if (isLikelyEmailDeliveryFailure(err)) {
        console.warn('[LoginPage] OTP email delivery failed (UI suppressed)', err);
        return;
      }
      toast.error(getErrorMessage(err, t('login.deviceOtpWrong', { defaultValue: 'Could not send verification code.' })));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!challengeId || resendSecondsLeft > 0 || loading || resendInFlight) return;
    setResendInFlight(true);
    try {
      if (challengeKind === 'device') {
        await resendDeviceOtp(challengeId);
      } else {
        if (!email) return;
        const out = await requestOtp(email);
        setChallengeId(out.challengeId);
        setChallengeKind('email');
      }
      setOtpCode('');
      setResendSecondsLeft(LOGIN_OTP_RESEND_COOLDOWN_SEC);
      toast.success(t('login.newCodeSent', { defaultValue: 'We sent a new verification code.' }));
    } catch (err: unknown) {
      if (isLikelyEmailDeliveryFailure(err)) {
        console.warn('[LoginPage] OTP resend delivery failed (UI suppressed)', err);
        return;
      }
      toast.error(getErrorMessage(err, t('login.resendCodeFailed', { defaultValue: 'Could not resend code.' })));
    } finally {
      setResendInFlight(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeId || !challengeKind) return;
    const digits = otpCode.replace(/\s/g, '');
    if (digits.length !== 6) {
      toast.error(t('login.deviceOtpInvalid', { defaultValue: 'Enter the 6-digit code.' }));
      return;
    }
    setLoading(true);
    try {
      const out =
        challengeKind === 'device'
          ? await verifyDeviceLogin(challengeId, digits)
          : await verifyOtp(challengeId, digits);
      toast.success(t('login.welcomeBack'));
      navigate(out.isNewUser ? '/setup' : '/');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, t('login.deviceOtpWrong', { defaultValue: 'Could not verify code.' })));
    } finally {
      setLoading(false);
    }
  };

  usePageTitle('login.title');

  return (
    <AuthShell overflow="auto">
      <AppHeader />

      <div className={`min-h-screen w-full flex items-center justify-center overflow-x-hidden overflow-y-auto ${isRTL ? 'direction-rtl' : ''}`}>
        <div className={`w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center px-6 lg:px-10 py-10`}>
          {/* LEFT */}
          <section className="flex flex-col justify-center lg:-ml-6">
            {/* Logo + brand (marked 2) */}
            <div className="flex flex-col items-start gap-4 mb-10 lg:ml-14">
              <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center">
                <img src={logoIconUrl} alt="" className="w-7 h-7 fusiku-brand-mark" />
              </div>
              <div className="flex flex-col gap-2">
                <div className="text-4xl font-bold tracking-tight">{resolvedBrandName}</div>
                <div className="text-lg text-white/85">{t('brand.slogan')}</div>
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
                  className="rounded-2xl p-6 bg-white/15 border border-white/22 min-h-[128px]"
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-11 h-11 rounded-lg ${tone} flex items-center justify-center shadow-lg shadow-black/10`}>
                      <Icon size={19} aria-hidden className="text-white" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="text-[15px] font-semibold leading-5">{title}</div>
                      <div className="text-xs text-white/78">{desc}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom info box */}
            <div className="mt-8 rounded-2xl p-5 text-sm text-white/82 bg-white/15 border border-white/22">
              <div className="flex items-start gap-3">
                <ShieldCheck size={18} aria-hidden className="mt-0.5 text-white/72" />
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
                className="inline-flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-3 text-sm font-semibold text-white/88 ring-1 ring-white/22 transition hover:bg-white/18"
              >
                <PlayCircle size={18} aria-hidden className="text-fuchsia-200" />
                {t('login.watchTutorial', { defaultValue: 'Watch tutorial' })}
              </Link>
            </div>
          </section>

          {/* RIGHT */}
          <section className="flex items-center justify-center lg:justify-center">
            <div className="w-full max-w-[380px] p-8 rounded-2xl bg-white/15 border border-white/22 shadow-xl">
              <div className="flex flex-col">
                <div className="flex flex-col gap-2">
                  {!challengeId ? (
                    <>
                      <div className="text-2xl font-semibold mb-2">{t('login.welcomeBack', { defaultValue: 'Welcome back' })} 👋</div>
                      <div className="text-sm text-white/82 mb-6">
                        {authMethod === 'password'
                          ? t('login.subtitlePassword', { defaultValue: 'Sign in with your email and password.' })
                          : t('login.subtitleOtp', { defaultValue: 'Sign in with a one-time code sent to your email.' })}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-semibold mb-2">
                        {t('login.verifyDeviceTitle', { defaultValue: 'Verify' })}
                      </div>
                      <div className="text-sm text-white/82 mb-6">
                        {challengeKind === 'device'
                          ? t('login.verifyDeviceSubtitle', {
                              defaultValue: 'Enter the code we emailed you to finish signing in.',
                            })
                          : t('login.verifyEmailOtpSubtitle', {
                              defaultValue: 'Enter the 6-digit code we sent to your email.',
                            })}
                      </div>
                    </>
                  )}
                </div>

                {!challengeId ? (
                  <div className="rounded-xl px-4 py-3 mb-4 bg-white/15 border border-white/22 text-sm flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Building2 size={18} aria-hidden className="text-white/80" />
                      <div className="text-sm text-white/80">
                        {t('login.companyIdAuto', { defaultValue: 'Company is selected automatically for this device.' })}
                      </div>
                    </div>
                    <CheckCircle2 size={18} aria-hidden className="text-emerald-300" />
                  </div>
                ) : null}

                {challengeId ? (
                  <form id="otp-verify" onSubmit={handleVerifyOtp}>
                    <div className="flex flex-col gap-4">
                      <label className="flex flex-col">
                        <span className="text-xs text-white/78 mb-1">
                          {t('login.deviceOtpLabel', { defaultValue: '6-digit code' })}
                        </span>
                        <input
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          aria-label={t('login.deviceOtpLabel', { defaultValue: '6-digit code' })}
                          className="w-full px-4 py-3 rounded-xl bg-white/15 border border-white/22 text-sm text-white outline-none tracking-[0.35em]"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          disabled={loading}
                          placeholder=""
                          lang={inputLang}
                        />
                      </label>

                      <div
                        className="flex flex-col items-center justify-center gap-1 min-h-[2.5rem] -mt-1"
                        aria-live="polite"
                      >
                        {resendSecondsLeft > 0 ? (
                          <p className="text-xs text-white/76 text-center tabular-nums tracking-wide">
                            {t('login.resendCodeIn', {
                              defaultValue: 'Resend code in {{time}}',
                              time: formatOtpCountdownMmSs(resendSecondsLeft),
                            })}
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={handleResendOtp}
                            disabled={loading || resendInFlight}
                            className="rounded-xl px-4 py-2 text-sm font-semibold text-white/92 bg-white/12 border border-white/18 hover:bg-white/16 disabled:opacity-45 disabled:pointer-events-none transition"
                          >
                            {resendInFlight
                              ? t('login.resendingCode', { defaultValue: 'Sending…' })
                              : t('login.resendCode', { defaultValue: 'Resend code' })}
                          </button>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={!canVerifyOtp}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {loading ? t('login.signingIn') : t('login.verifyDevice', { defaultValue: 'Verify' })}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          resetChallenge();
                          setAuthMethod(challengeKind === 'device' ? 'password' : 'otp');
                        }}
                        disabled={loading}
                        className="w-full py-2 rounded-xl bg-white/15 border border-white/22 text-xs font-semibold text-white/90 disabled:opacity-50"
                      >
                        {t('login.backToPassword', { defaultValue: 'Back' })}
                      </button>
                    </div>
                  </form>
                ) : authMethod === 'password' ? (
                  <form id="login-password" onSubmit={handlePasswordLogin}>
                    <div className="flex flex-col gap-4">
                      <label className="flex flex-col">
                        <span className="text-xs text-white/78 mb-1">{t('login.email', { defaultValue: 'Email address' })}</span>
                        <input
                          type="email"
                          aria-label={t('login.email', { defaultValue: 'Email address' })}
                          className="w-full px-4 py-3 rounded-xl bg-white/15 border border-white/22 text-sm text-white outline-none"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          autoComplete="email"
                          disabled={loading}
                          placeholder=""
                          lang={inputLang}
                        />
                      </label>
                      <label className="flex flex-col">
                        <span className="text-xs text-white/78 mb-1">{t('login.password', { defaultValue: 'Password' })}</span>
                        <input
                          type="password"
                          aria-label={t('login.password', { defaultValue: 'Password' })}
                          className="w-full px-4 py-3 rounded-xl bg-white/15 border border-white/22 text-sm text-white outline-none"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete="current-password"
                          disabled={loading}
                          placeholder=""
                          lang={inputLang}
                        />
                      </label>
                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rememberDevice}
                          onChange={(e) => setRememberDevice(e.target.checked)}
                          className="mt-0.5 rounded border-white/30 bg-white/10"
                          disabled={loading}
                        />
                        <span className="text-xs text-white/78 leading-snug">
                          {t('login.rememberDevice', {
                            defaultValue: 'Remember this device (fewer verification prompts on trusted browsers).',
                          })}
                        </span>
                      </label>
                      <button
                        type="submit"
                        disabled={!canPasswordLogin}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {loading ? t('login.signingIn') : t('login.signInPassword', { defaultValue: 'Sign in' })}
                      </button>
                      <div className="flex flex-col gap-2 text-center">
                        <Link
                          to="/forgot-password"
                          className="text-xs font-semibold text-white/85 hover:text-white"
                        >
                          {t('login.forgotPasswordLink', { defaultValue: 'Forgot password?' })}
                        </Link>
                        <button
                          type="button"
                          onClick={() => setAuthMethod('otp')}
                          className="text-xs font-semibold text-white/78 hover:text-white"
                        >
                          {t('login.useEmailCodeInstead', { defaultValue: 'Use email code instead' })}
                        </button>
                      </div>

                      <div className="flex items-center gap-3 my-2 text-xs text-white/72">
                        <div className="h-px flex-1 bg-white/20" />
                        <div>{t('login.orContinue', { defaultValue: 'or continue with' })}</div>
                        <div className="h-px flex-1 bg-white/20" />
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          className="flex-1 py-2 rounded-xl bg-white/15 border border-white/22 text-xs text-white/88 inline-flex items-center justify-center gap-2"
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
                          className="flex-1 py-2 rounded-xl bg-white/15 border border-white/22 text-xs text-white/88 inline-flex items-center justify-center gap-2"
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
                          className="flex-1 py-2 rounded-xl bg-white/15 border border-white/22 text-xs text-white/88 inline-flex items-center justify-center gap-2"
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

                      <div className="text-xs text-white/72 text-center mt-2">
                        {t('login.noAccount', { defaultValue: 'New company?' })}{' '}
                        <Link to="/signup" className="font-semibold text-white/90 hover:text-white">
                          {t('login.createCompany', { defaultValue: 'Create your workspace' })}
                        </Link>
                      </div>
                    </div>
                  </form>
                ) : (
                  <form id="otp-request" onSubmit={handleSendOtp}>
                    <div className="flex flex-col gap-4">
                      <label className="flex flex-col">
                        <span className="text-xs text-white/78 mb-1">{t('login.email', { defaultValue: 'Email address' })}</span>
                        <input
                          type="email"
                          aria-label={t('login.email', { defaultValue: 'Email address' })}
                          className="w-full px-4 py-3 rounded-xl bg-white/15 border border-white/22 text-sm text-white outline-none"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          autoComplete="email"
                          disabled={loading}
                          placeholder=""
                          lang={inputLang}
                        />
                      </label>

                      <button
                        type="submit"
                        disabled={!canSendOtp}
                        className="w-full py-3 mt-2 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {loading ? t('login.signingIn') : t('login.sendOtpCode', { defaultValue: 'Email me a code' })}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthMethod('password')}
                        className="w-full py-2 rounded-xl bg-white/15 border border-white/22 text-xs font-semibold text-white/90"
                      >
                        {t('login.usePasswordInstead', { defaultValue: 'Use password instead' })}
                      </button>

                      <div className="text-xs text-white/72 text-center mt-4">
                        {t('login.noAccount', { defaultValue: 'New company?' })}{' '}
                        <Link to="/signup" className="font-semibold text-white/90 hover:text-white">
                          {t('login.createCompany', { defaultValue: 'Create your workspace' })}
                        </Link>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </AuthShell>
  );
}
