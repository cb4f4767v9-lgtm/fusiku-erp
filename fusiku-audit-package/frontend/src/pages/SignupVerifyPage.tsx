import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { authApi, signupApi } from '../services/api';
import { useAuth, type AuthUser } from '../hooks/useAuth';
import { setPostSignupBillingUi } from '../utils/billingUi';
import { getErrorMessage } from '../utils/getErrorMessage';
import { isLikelyEmailDeliveryFailure } from '../utils/isLikelyEmailDeliveryFailure';
import { usePageTitle } from '../hooks/usePageTitle';
import { rememberCompanyId } from '../utils/authSession';
import { AuthShell } from '../components/auth/AuthShell';

const logoIconUrl = '/logo-icon.svg';
const WELCOME_SESSION_KEY = 'fusiku_post_signup_welcome';

export type SignupVerifyLocationState = {
  challengeId: string;
  email: string;
  companyName: string;
  phoneDisplay?: string;
  alsoSendPhone?: boolean;
  /** When signup sends OTP to phone, label the channel for the user. */
  phoneOtpChannel?: 'SMS' | 'WHATSAPP';
};

/** Masks local part for display (e.g. name@company.com → n@company.com). */
export function maskEmailForDisplay(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf('@');
  if (at <= 0 || at >= trimmed.length - 1) {
    if (!trimmed) return '';
    return trimmed.length <= 2 ? '***' : `${trimmed[0]}***`;
  }
  const domain = trimmed.slice(at + 1);
  return `${trimmed[0]}@${domain}`;
}

/** E.164-style → +971***567 (shows first 3 national digits + last 3) */
export function maskPhoneForDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return '+***';
  const head = digits.slice(0, 3);
  const tail = digits.slice(-3);
  return `+${head}***${tail}`;
}

export default function SignupVerifyPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { setSession } = useAuth();

  const meta = location.state as SignupVerifyLocationState | null;
  const challengeId = meta?.challengeId?.trim() ?? '';
  const email = meta?.email?.trim() ?? '';
  const companyName = meta?.companyName?.trim() ?? '';

  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [timer, setTimer] = useState(90);
  const [isExpired, setIsExpired] = useState(false);
  const [resendInFlight, setResendInFlight] = useState(false);

  usePageTitle('signup.otpTitle');

  useEffect(() => {
    if (!challengeId || !email) {
      navigate('/signup', { replace: true });
    }
  }, [challengeId, email, navigate]);

  useEffect(() => {
    if (timer <= 0) {
      setIsExpired(true);
      return;
    }
    setIsExpired(false);

    const interval = window.setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [timer]);

  const maskedEmail = useMemo(() => maskEmailForDisplay(email), [email]);

  const phoneMasked = useMemo(() => {
    const raw = meta?.phoneDisplay?.trim() ?? '';
    if (!raw) return '';
    return maskPhoneForDisplay(raw);
  }, [meta?.phoneDisplay]);

  /** Shown when the user entered a phone on signup (masked). Uses SMS/WhatsApp label when OTP is sent via phone. */
  const showPhoneDestination = Boolean(phoneMasked);

  const phoneChannelLabel = useMemo(() => {
    const ch = meta?.phoneOtpChannel;
    if (ch === 'SMS') return t('signup.otpChannelSms', { defaultValue: 'SMS' });
    if (ch === 'WHATSAPP') return t('signup.otpChannelWhatsApp', { defaultValue: 'WhatsApp' });
    return t('signup.otpChannelSmsWhatsApp', { defaultValue: 'SMS/WhatsApp' });
  }, [t, meta?.phoneOtpChannel]);

  const finishSignupSession = async (data: {
    accessToken?: string;
    token?: string;
    refreshToken?: string;
    user?: AuthUser;
    companyId?: string;
  }) => {
    const sessionToken = String(data.accessToken ?? data.token ?? '').trim();
    const refreshToken = String(data.refreshToken ?? '').trim();
    if (!sessionToken) {
      setFormError(t('signup.failed'));
      return;
    }
    const apiUser = data.user;
    if (!apiUser?.id) {
      setFormError(t('signup.failed'));
      return;
    }
    const cid = String(data.companyId ?? apiUser.companyId ?? '').trim();
    if (cid) rememberCompanyId(cid);
    setSession(sessionToken, apiUser, refreshToken || undefined);
    try {
      // Ensure session user has companyId/branchId/verticals/permissions before setup renders.
      const { data: meData } = await authApi.me();
      const me = meData as AuthUser;
      if (me?.id) setSession(sessionToken, me, refreshToken || undefined);
    } catch {
      /* ignore hydration failures (offline) */
    }
    setPostSignupBillingUi(companyName);
    sessionStorage.setItem(WELCOME_SESSION_KEY, '1');
    toast.success(t('signup.success'));
    navigate('/setup', { replace: true });
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeId) return;
    const code = otpCode.replace(/\D/g, '').slice(0, 6);
    if (code.length !== 6) {
      setFormError(t('signup.otpInvalidLength', { defaultValue: 'Enter the 6-digit code' }));
      return;
    }
    setFormError(null);
    setLoading(true);
    try {
      const { data } = await signupApi.verify({ challengeId, code });
      await finishSignupSession(
        data as {
          accessToken?: string;
          token?: string;
          refreshToken?: string;
          user?: AuthUser;
          companyId?: string;
        }
      );
    } catch (error: unknown) {
      console.error('[SignupVerifyPage] verify', error);
      setFormError(getErrorMessage(error, t('signup.otpWrong', { defaultValue: 'Incorrect verification code' })));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!challengeId || !isExpired || loading || resendInFlight) return;
    setFormError(null);
    setResendInFlight(true);
    try {
      await signupApi.resend({ challengeId });
      setTimer(90);
      setIsExpired(false);
      toast.success(t('signup.otpResentToast', { defaultValue: 'Code sent again' }));
    } catch (error: unknown) {
      console.error('[SignupVerifyPage] resend', error);
      const ax = error as { response?: { status?: number; data?: { retryAfterSeconds?: number } } };
      const retry = ax?.response?.data?.retryAfterSeconds;
      if (typeof retry === 'number' && retry > 0) setTimer(retry);
      const status = ax?.response?.status;
      if (status !== 429 && isLikelyEmailDeliveryFailure(error)) {
        console.warn('[SignupVerifyPage] resend delivery failure (UI suppressed)', error);
        return;
      }
      setFormError(getErrorMessage(error, t('signup.otpResendFailed', { defaultValue: 'Could not resend code' })));
    } finally {
      setResendInFlight(false);
    }
  };

  if (!challengeId || !email) {
    return null;
  }

  return (
    <AuthShell overflow="auto">
      <Link
        to="/login"
        className="absolute left-5 top-5 z-20 inline-flex items-center p-1 opacity-90 transition hover:opacity-100"
        aria-label={t('common.home', { defaultValue: 'Home' })}
      >
        <img src={logoIconUrl} alt="" className="h-9 w-auto max-h-[40px]" height={36} width={36} />
      </Link>

      <div className="flex min-h-screen w-full items-center justify-center px-5 py-10 pt-[5.5rem]">
        <div
          className="w-full max-w-[480px] mx-auto px-5 py-16 pb-10 text-left text-slate-900 dark:text-white"
          style={{ paddingTop: '80px', paddingBottom: '40px' }}
        >
          <div className="rounded-xl border border-white/25 bg-white/85 p-8 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-slate-950/75">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {t('signup.otpTitle', { defaultValue: 'Verify your email' })}
            </h1>
            <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-600 dark:text-white/65">
              <div className="space-y-1">
                <p>{t('signup.otpSentSixDigit', { defaultValue: 'We sent a 6-digit code to:' })}</p>
                <p className="break-all font-semibold text-slate-900 dark:text-white">{maskedEmail}</p>
              </div>

              {showPhoneDestination ? (
                <div className="space-y-1">
                  <p>{t('signup.otpSentToPhone', { defaultValue: 'We sent a code to:' })}</p>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {phoneMasked}{' '}
                    <span className="font-medium text-slate-600 dark:text-white/65">({phoneChannelLabel})</span>
                  </p>
                </div>
              ) : null}

              <p className="text-xs leading-snug text-slate-500 dark:text-white/50">
                {t('signup.otpDeliveryNote', {
                  defaultValue: 'Check your inbox or spam folder.',
                })}
              </p>
            </div>

            {formError ? (
              <div
                className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-100"
                role="alert"
              >
                {formError}
              </div>
            ) : null}

            <form onSubmit={handleVerify} className="mt-6 flex flex-col gap-5">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-800 dark:text-white/90">
                  {t('signup.otpCodeLabel', { defaultValue: 'Verification code' })}
                </span>
                <input
                  type="text"
                  name="signup-otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  disabled={loading}
                  placeholder="••••••"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-xl tracking-[0.35em] text-slate-900 outline-none ring-sky-500/30 placeholder:text-slate-300 focus:border-sky-500 focus:ring-2 disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-white/25 dark:focus:border-sky-400"
                  aria-label={t('signup.otpAria', { defaultValue: 'Six-digit verification code' })}
                />

                <div className="otp-resend" aria-live="polite">
                  {!isExpired ? (
                    <span className="otp-resend__disabled">Resend code in {timer}s</span>
                  ) : (
                    <span
                      className="otp-resend__link"
                      role="button"
                      tabIndex={0}
                      onClick={() => void handleResend()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') void handleResend();
                      }}
                    >
                      Resend Code
                    </span>
                  )}
                </div>
              </label>

              <button
                type="submit"
                disabled={loading || otpCode.replace(/\D/g, '').length !== 6}
                className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 py-3.5 text-sm font-semibold text-white shadow-md transition disabled:pointer-events-none disabled:opacity-50"
              >
                {loading
                  ? t('signup.verifying', { defaultValue: 'Verifying...' })
                  : t('signup.verifyCta', { defaultValue: 'Verify & continue' })}
              </button>
            </form>

            <button
              type="button"
              onClick={() => navigate('/signup', { replace: true })}
              className="mt-6 w-full text-center text-xs text-slate-500 transition hover:text-slate-800 dark:text-white/40 dark:hover:text-white/70"
            >
              {t('signup.editDetails', { defaultValue: '← Edit signup details' })}
            </button>

            <p className="mt-8 text-center text-xs text-slate-500 dark:text-white/45">
              {t('signup.alreadyHaveAccountLead', { defaultValue: 'Already have an account?' })}{' '}
              <Link to="/login" className="font-semibold text-sky-700 hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-200">
                {t('login.signin', { defaultValue: 'Sign in' })}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
