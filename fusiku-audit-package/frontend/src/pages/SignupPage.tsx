import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { Check, ChevronLeft, Circle, Eye, EyeOff, Upload } from 'lucide-react';

const logoIconUrl = '/logo-icon.svg';

import { signupApi } from '../services/api';
import { getErrorMessage } from '../utils/getErrorMessage';
import { isLikelyEmailDeliveryFailure } from '../utils/isLikelyEmailDeliveryFailure';
import { useInputLanguage } from '../hooks/useInputLanguage';
import { usePageTitle } from '../hooks/usePageTitle';
import { AuthShell } from '../components/auth/AuthShell';
import type { SignupVerifyLocationState } from './SignupVerifyPage';

type SignupFieldErrors = {
  companyName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  form?: string;
};

const PASSWORD_SUBMIT_ERROR =
  'Password must be at least 8 characters and include uppercase, lowercase, number, and special character';

function getSignupPasswordCriteria(raw: string | undefined | null) {
  const password = String(raw ?? '');
  const hasLength = password.length >= 8;
  const hasLower = password.length > 0 && /[a-z]/.test(password);
  const hasUpper = password.length > 0 && /[A-Z]/.test(password);
  const hasNumber = password.length > 0 && /[0-9]/.test(password);
  const hasSpecial = password.length > 0 && /[^A-Za-z0-9]/.test(password);
  const isValid = hasLength && hasLower && hasUpper && hasNumber && hasSpecial;
  return { hasLength, hasLower, hasUpper, hasNumber, hasSpecial, isValid };
}

function getPasswordStrength(raw: string | undefined | null) {
  const password = String(raw ?? '');
  let score = 0;
  if (password.length >= 8) score++;
  if (password && /[a-z]/.test(password)) score++;
  if (password && /[A-Z]/.test(password)) score++;
  if (password && /[0-9]/.test(password)) score++;
  if (password && /[^A-Za-z0-9]/.test(password)) score++;

  let tier: 'weak' | 'medium' | 'strong';
  if (password.length < 8 || score <= 2) tier = 'weak';
  else if (score <= 4) tier = 'medium';
  else tier = 'strong';

  return { score, tier };
}

function guessSignupCountryIso2(): string {
  try {
    const region = new Intl.Locale(navigator.language).region;
    if (region && /^[A-Za-z]{2}$/.test(region)) return region.toLowerCase();
  } catch {
    /* ignore */
  }
  return 'ae';
}

function phoneValueToE164(value: string): string | undefined {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 8) return undefined;
  return `+${digits}`;
}

const PHONE_E164_REGEX = /^\+[1-9]\d{9,14}$/;

const TOTAL_STEPS = 2;

function RequiredAsterisk() {
  return (
    <sup className="ml-0.5 font-semibold text-rose-300" aria-hidden>
      *
    </sup>
  );
}

export default function SignupPage() {
  const { t } = useTranslation();
  const inputLang = useInputLanguage();
  const navigate = useNavigate();

  const [companyName, setCompanyName] = useState('');
  const [companySlogan, setCompanySlogan] = useState('');
  const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<SignupFieldErrors>({});
  const [hpWebsite, setHpWebsite] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  const passwordCriteria = useMemo(() => getSignupPasswordCriteria(password), [password]);
  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);
  const passwordsMatch = useMemo(
    () => Boolean(password && confirmPassword && password === confirmPassword),
    [password, confirmPassword]
  );

  const phoneE164 = useMemo(() => phoneValueToE164(phone), [phone]);

  /** Rules panel: show while password field is focused and requirements not yet met; hide on blur or when valid */
  const showPasswordRules = isPasswordFocused && !passwordCriteria.isValid;

  const showConfirmPasswordHint = confirmPassword.length > 0;

  const canContinueStep1 = useMemo(
    () => Boolean(companyName.trim().length >= 2) && !loading,
    [companyName, loading]
  );

  const canSubmitStep2 = useMemo(
    () =>
      Boolean(email.trim() && password && confirmPassword) &&
      password === confirmPassword &&
      passwordCriteria.isValid &&
      !loading,
    [email, password, confirmPassword, passwordCriteria.isValid, loading]
  );

  usePageTitle('signup.title');

  useEffect(() => {
    if (!companyLogoFile) {
      setLogoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(companyLogoFile);
    setLogoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [companyLogoFile]);

  const validateStep1 = (): boolean => {
    const next: SignupFieldErrors = {};
    if (!companyName.trim()) next.companyName = t('signup.errorRequired');
    else if (companyName.trim().length < 2) {
      next.companyName = t('signup.companyNameTooShort', {
        defaultValue: 'Company name must be at least 2 characters',
      });
    }
    if (Object.keys(next).length) {
      setErrors((prev) => ({ ...prev, ...next }));
      return false;
    }
    setErrors((prev) => {
      const cleared = { ...prev };
      delete cleared.companyName;
      return cleared;
    });
    return true;
  };

  const goToStep2 = () => {
    if (!validateStep1()) return;
    setStep(2);
  };

  const goToStep1 = () => {
    setStep(1);
    setErrors((prev) => {
      const cleared = { ...prev };
      delete cleared.email;
      delete cleared.password;
      delete cleared.confirmPassword;
      return cleared;
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      goToStep2();
      return;
    }

    const next: SignupFieldErrors = {};
    if (!email.trim()) next.email = t('signup.errorRequired');
    // Optional field, but if provided it must be a valid E.164 number (+ and 10–15 digits).
    if (String(phone || '').trim()) {
      if (!phoneE164 || !PHONE_E164_REGEX.test(phoneE164)) {
        next.phone = t('signup.invalidPhone', { defaultValue: 'Invalid phone number format' });
      }
    }
    if (!password) next.password = t('signup.errorRequired');
    if (!confirmPassword) {
      next.confirmPassword = t('signup.errorRequired');
    }
    if (password && confirmPassword && password !== confirmPassword) {
      setErrors(next);
      return;
    }
    if (password && !passwordCriteria.isValid) {
      next.password = t('signup.passwordComplexity', { defaultValue: PASSWORD_SUBMIT_ERROR });
    }
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      const { data } = await signupApi.start({
        companyName: companyName.trim(),
        email: email.trim(),
        password,
        phone: phoneE164,
        website: hpWebsite.trim() || undefined,
      });
      const cid = String((data as { challengeId?: string }).challengeId ?? '').trim();
      if (!cid) {
        setErrors({ form: t('signup.failed') });
        return;
      }

      const phoneDisplay = phoneE164 ?? '';
      const verifyState: SignupVerifyLocationState = {
        challengeId: cid,
        email: email.trim(),
        companyName: companyName.trim(),
        phoneDisplay,
      };
      navigate('/signup/verify', { replace: true, state: verifyState });
    } catch (error) {
      console.error('[SignupPage] start', error);
      if (isLikelyEmailDeliveryFailure(error)) {
        console.warn('[SignupPage] signup email delivery failed (UI suppressed)', error);
        return;
      }
      setErrors({ form: getErrorMessage(error, t('signup.failed')) });
    } finally {
      setLoading(false);
    }
  };

  const phoneInputStyles = useMemo(
    () => ({
      containerStyle: { width: '100%' } as CSSProperties,
      inputStyle: {
        width: '100%',
        height: 48,
        paddingLeft: 52,
        fontSize: 14,
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.2)',
        backgroundColor: 'rgba(255,255,255,0.1)',
        color: '#ffffff',
      } as CSSProperties,
      buttonStyle: {
        borderRadius: '12px 0 0 12px',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRight: 'none',
        backgroundColor: 'rgba(255,255,255,0.08)',
      } as CSSProperties,
      dropdownStyle: {
        borderRadius: 12,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid rgba(255,255,255,0.15)',
      } as CSSProperties,
    }),
    []
  );

  /** Cloud-style fields: soft border, comfortable padding, focus ring */
  const fieldClass =
    'w-full min-h-[48px] rounded-xl border border-white/20 bg-white/[0.07] px-4 py-3 text-sm text-white shadow-inner shadow-black/5 outline-none ring-0 transition placeholder:text-white/40 focus:border-sky-400/50 focus:bg-white/10 focus:ring-2 focus:ring-sky-500/30 disabled:opacity-60';

  /** Matches LoginPage submit: gradient + py-3 + font-semibold + opacity when disabled */
  const primaryCtaClass =
    'min-h-[48px] rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 outline-none transition disabled:pointer-events-none disabled:opacity-60';

  const labelClass = 'text-sm font-medium text-white/90 mb-1.5';

  const secondaryOutlineBtnClass =
    'inline-flex min-h-[48px] w-full items-center justify-center gap-1 rounded-xl border border-white/20 bg-white/10 px-4 py-3.5 text-sm font-semibold text-white/90 outline-none transition hover:bg-white/15 disabled:opacity-50 sm:w-auto';

  const strengthTierUi = useMemo(() => {
    const { tier } = passwordStrength;
    if (tier === 'strong')
      return {
        fillClass: 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.35)]',
        labelClass: 'text-emerald-300',
        label: t('signup.passwordStrengthStrong', { defaultValue: 'Strong' }),
      };
    if (tier === 'medium')
      return {
        fillClass: 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.25)]',
        labelClass: 'text-amber-200',
        label: t('signup.passwordStrengthMedium', { defaultValue: 'Medium' }),
      };
    return {
      fillClass: 'bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.25)]',
      labelClass: 'text-red-300',
      label: t('signup.passwordStrengthWeak', { defaultValue: 'Weak' }),
    };
  }, [passwordStrength, t]);

  const passwordRulesId = 'signup-password-rules';
  const passwordMeterId = 'signup-password-meter';

  return (
    <AuthShell overflow="auto">
      <Link
        to="/login"
        className="absolute z-20 inline-flex items-center opacity-90 transition hover:opacity-100"
        style={{ top: 20, left: 20, padding: 16 }}
        aria-label={t('common.home', { defaultValue: 'Home' })}
      >
        <img src={logoIconUrl} alt="" className="h-9 w-auto max-h-[40px]" />
      </Link>

      <style>{`
        @keyframes signup-wizard-step-in {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes signup-password-rules-in {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .signup-wizard-step {
          animation: signup-wizard-step-in 0.28s ease-out both;
        }
        .signup-password-rules-panel {
          animation: signup-password-rules-in 0.22s ease-out both;
        }
        .signup-phone-wrap .react-tel-input .selected-flag:hover,
        .signup-phone-wrap .react-tel-input .selected-flag:focus {
          background-color: rgba(255,255,255,0.12) !important;
        }
        .signup-phone-wrap .react-tel-input .country-list {
          border-radius: 12px;
          max-height: min(240px, 40vh);
          background-color: rgba(15, 23, 42, 0.98);
          border: 1px solid rgba(255,255,255,0.15);
          color: #f8fafc;
        }
        .signup-phone-wrap .react-tel-input .country-list .country:hover {
          background-color: rgba(255,255,255,0.08);
        }
        .signup-phone-wrap .react-tel-input .country-list .search {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,255,255,0.12);
          color: #f8fafc;
        }
      `}</style>

      <div className="flex min-h-screen w-full flex-col items-center justify-center overflow-x-hidden px-6 py-10 pb-28 pt-[5.5rem]">
        <div className="w-full max-w-[600px] text-left text-white">
          <div className="w-full rounded-2xl border border-white/20 bg-white/[0.08] p-6 shadow-2xl shadow-black/20 backdrop-blur-2xl sm:p-8">
            <h1 className="mb-1 text-2xl font-semibold tracking-tight text-white sm:text-[28px]">
              {t('signup.title', { defaultValue: 'Create Workspace' })}
            </h1>
            <p className="mb-6 text-sm text-white/55">{t('signup.cardSubtitle', { defaultValue: 'Set up your organization and admin account.' })}</p>

            <div className="mb-6 space-y-2">
              <div className="text-sm text-white/70">
                {t('signup.stepProgress', {
                  defaultValue: 'Step {{step}} of {{total}}',
                  step,
                  total: TOTAL_STEPS,
                })}
              </div>
              <div
                className="h-1 overflow-hidden rounded-full bg-white/15"
                role="progressbar"
                aria-valuenow={step}
                aria-valuemin={1}
                aria-valuemax={TOTAL_STEPS}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 transition-[width] duration-300 ease-out"
                  style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
                />
              </div>
            </div>

            {errors.form ? (
              <div
                className="mb-4 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100"
                role="alert"
              >
                {errors.form}
              </div>
            ) : null}

            <form onSubmit={handleFormSubmit} className="flex flex-col gap-[18px]">
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={hpWebsite}
                onChange={(e) => setHpWebsite(e.target.value)}
                className="sr-only"
                aria-hidden
              />

              <div key={step} className="signup-wizard-step flex flex-col gap-[18px] overflow-visible">
                {step === 1 ? (
                  <>
                    <label className="flex flex-col">
                      <span className={labelClass}>
                        {t('signup.companyName', { defaultValue: 'Company name' })}
                        <RequiredAsterisk />
                      </span>
                      <input
                        type="text"
                        className={fieldClass}
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        autoComplete="organization"
                        disabled={loading}
                        required
                        aria-required="true"
                        placeholder={t('signup.companyNamePlaceholder', { defaultValue: 'e.g. Acme Mobile' })}
                        lang={inputLang}
                      />
                      {errors.companyName ? (
                        <span className="mt-1 text-xs text-rose-300">{errors.companyName}</span>
                      ) : null}
                    </label>

                    <div className="flex flex-col">
                      <span className={labelClass}>
                        {t('signup.logoUpload', { defaultValue: 'Logo' })}{' '}
                        <span className="text-white/45">({t('signup.optionalTag', { defaultValue: 'optional' })})</span>
                      </span>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        disabled={loading}
                        onChange={(e) => setCompanyLogoFile(e.target.files?.[0] ?? null)}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => logoInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white/85 transition hover:bg-white/15 disabled:opacity-50"
                        >
                          <Upload size={14} aria-hidden />
                          {t('signup.uploadLogo', { defaultValue: 'Upload logo' })}
                        </button>
                        {companyLogoFile ? (
                          <span className="max-w-[160px] truncate text-[11px] text-white/50" title={companyLogoFile.name}>
                            {companyLogoFile.name}
                          </span>
                        ) : null}
                      </div>
                      {logoPreviewUrl ? (
                        <div className="mt-2 inline-flex max-w-full rounded-xl border border-white/20 bg-white/5 p-2">
                          <img src={logoPreviewUrl} alt="" className="max-h-14 max-w-[160px] rounded-lg object-contain" />
                        </div>
                      ) : null}
                    </div>

                    <label className="flex flex-col">
                      <span className={labelClass}>
                        {t('signup.slogan', { defaultValue: 'Slogan' })}{' '}
                        <span className="text-white/45">({t('signup.optionalTag', { defaultValue: 'optional' })})</span>
                      </span>
                      <input
                        type="text"
                        className={fieldClass}
                        value={companySlogan}
                        onChange={(e) => setCompanySlogan(e.target.value)}
                        disabled={loading}
                        placeholder={t('signup.sloganPlaceholder', { defaultValue: 'Short tagline for receipts' })}
                        lang={inputLang}
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] text-white/45">{t('signup.requiredLegend', { defaultValue: '* Required fields' })}</p>

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-start md:gap-x-8 md:gap-y-5">
                      <div className="flex flex-col gap-5">
                        <label className="flex flex-col">
                          <span className={labelClass}>
                            {t('signup.emailAddress', { defaultValue: 'Email address' })}
                            <RequiredAsterisk />
                          </span>
                          <input
                            type="email"
                            name="signup-email"
                            className={fieldClass}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            disabled={loading}
                            required
                            aria-required="true"
                            placeholder="Enter your email (e.g. name@company.com)"
                            lang={inputLang}
                          />
                          {errors.email ? <span className="mt-1 text-xs text-rose-300">{errors.email}</span> : null}
                        </label>

                        <div className="flex flex-col">
                          <span className={labelClass}>
                            {t('signup.phone', { defaultValue: 'Mobile phone' })}{' '}
                            <span className="text-white/45">({t('signup.optionalTag', { defaultValue: 'optional' })})</span>
                          </span>
                          <div className="signup-phone-wrap">
                            <PhoneInput
                              country={guessSignupCountryIso2()}
                              value={phone}
                              onChange={(val) => setPhone(val)}
                              enableSearch
                              disabled={loading}
                              countryCodeEditable={false}
                              inputProps={{
                                name: 'phone',
                                autoComplete: 'tel',
                              }}
                              {...phoneInputStyles}
                            />
                          </div>
                          {errors.phone ? <span className="mt-1 text-xs text-rose-300">{errors.phone}</span> : null}
                        </div>
                      </div>

                      <div className="flex flex-col gap-5">
                        <label className="flex flex-col">
                          <span className={labelClass}>
                            {t('login.password', { defaultValue: 'Password' })}
                            <RequiredAsterisk />
                          </span>
                          <div className="relative">
                            <input
                              type={showPassword ? 'text' : 'password'}
                              className={`${fieldClass} pr-11 ${
                                password.length === 0
                                  ? ''
                                  : passwordCriteria.isValid
                                    ? 'border-emerald-400/70'
                                    : 'border-red-400/80'
                              }`}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              onFocus={() => setIsPasswordFocused(true)}
                              onBlur={() => setIsPasswordFocused(false)}
                              autoComplete="new-password"
                              disabled={loading}
                              required
                              aria-required="true"
                              placeholder={t('signup.passwordPlaceholder', { defaultValue: 'Choose a secure password' })}
                              lang={inputLang}
                              aria-invalid={password.length > 0 && !passwordCriteria.isValid}
                              aria-describedby={
                                showPasswordRules
                                  ? `${passwordRulesId} ${passwordMeterId}`
                                  : errors.password
                                    ? 'signup-password-field-error'
                                    : undefined
                              }
                            />
                            <button
                              type="button"
                              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white"
                              onClick={() => setShowPassword((v) => !v)}
                              disabled={loading}
                              aria-pressed={showPassword}
                              aria-label={
                                showPassword
                                  ? t('signup.passwordHide', { defaultValue: 'Hide password' })
                                  : t('signup.passwordShow', { defaultValue: 'Show password' })
                              }
                            >
                              {showPassword ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
                            </button>
                          </div>

                          {showPasswordRules ? (
                            <div
                              className="signup-password-rules-panel mt-2 space-y-3 rounded-xl border border-white/10 bg-white/[0.06] p-3 shadow-lg shadow-black/20 backdrop-blur-sm sm:p-4"
                              role="region"
                              aria-label={t('signup.passwordRulesRegion', { defaultValue: 'Password requirements' })}
                            >
                              <div id={passwordMeterId}>
                                <div className="mb-1.5 flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-medium uppercase tracking-wide text-white/45">
                                    {t('signup.passwordStrengthLabel', { defaultValue: 'Password strength' })}
                                  </span>
                                  {password.length > 0 ? (
                                    <span className={`text-xs font-semibold ${strengthTierUi.labelClass}`}>
                                      {strengthTierUi.label}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-white/35">—</span>
                                  )}
                                </div>
                                <div
                                  className="h-2 overflow-hidden rounded-full bg-white/12"
                                  role="progressbar"
                                  aria-valuemin={0}
                                  aria-valuemax={5}
                                  aria-valuenow={passwordStrength.score}
                                  aria-label={t('signup.passwordStrengthLabel', { defaultValue: 'Password strength' })}
                                >
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ease-out ${strengthTierUi.fillClass}`}
                                    style={{
                                      width: `${password.length > 0 ? (passwordStrength.score / 5) * 100 : 0}%`,
                                    }}
                                  />
                                </div>
                              </div>

                              <ul id={passwordRulesId} className="flex flex-col gap-2 text-xs leading-snug text-white/65">
                                {[
                                  {
                                    ok: passwordCriteria.hasLength,
                                    text: t('signup.ruleMinLength', { defaultValue: 'At least 8 characters' }),
                                  },
                                  {
                                    ok: passwordCriteria.hasUpper,
                                    text: t('signup.ruleUppercase', { defaultValue: 'One uppercase letter' }),
                                  },
                                  {
                                    ok: passwordCriteria.hasLower,
                                    text: t('signup.ruleLowercase', { defaultValue: 'One lowercase letter' }),
                                  },
                                  {
                                    ok: passwordCriteria.hasNumber,
                                    text: t('signup.ruleNumber', { defaultValue: 'One number' }),
                                  },
                                  {
                                    ok: passwordCriteria.hasSpecial,
                                    text: t('signup.ruleSymbol', { defaultValue: 'One symbol (!@#$…)' }),
                                  },
                                ].map((rule) => (
                                  <li key={rule.text} className="flex items-start gap-2">
                                    <span className="mt-0.5 flex shrink-0" aria-hidden>
                                      {rule.ok ? (
                                        <Check className="h-4 w-4 text-emerald-400" strokeWidth={2.5} />
                                      ) : (
                                        <Circle className="h-4 w-4 text-white/25" strokeWidth={2} />
                                      )}
                                    </span>
                                    <span className={rule.ok ? 'text-emerald-200/95' : ''}>{rule.text}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}

                          {errors.password ? (
                            <span id="signup-password-field-error" className="mt-1 text-xs text-rose-300">
                              {errors.password}
                            </span>
                          ) : null}
                        </label>

                        <label className="flex flex-col">
                          <span className={labelClass}>
                            {t('signup.confirmPasswordLabel', { defaultValue: 'Confirm password' })}
                            <RequiredAsterisk />
                          </span>
                          <div className="relative">
                            <input
                              type={showConfirmPassword ? 'text' : 'password'}
                              className={`${fieldClass} pr-11 ${
                                confirmPassword.length === 0
                                  ? ''
                                  : passwordsMatch
                                    ? 'border-emerald-400/70'
                                    : 'border-red-400/80'
                              }`}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              autoComplete="new-password"
                              disabled={loading}
                              required
                              aria-required="true"
                              placeholder={t('signup.confirmPasswordPlaceholder', { defaultValue: 'Re-enter your password' })}
                              lang={inputLang}
                              aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
                              aria-describedby={
                                showConfirmPasswordHint ? 'signup-confirm-password-hint' : undefined
                              }
                            />
                            <button
                              type="button"
                              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white"
                              onClick={() => setShowConfirmPassword((v) => !v)}
                              disabled={loading}
                              aria-pressed={showConfirmPassword}
                              aria-label={
                                showConfirmPassword
                                  ? t('signup.passwordHide', { defaultValue: 'Hide password' })
                                  : t('signup.passwordShow', { defaultValue: 'Show password' })
                              }
                            >
                              {showConfirmPassword ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
                            </button>
                          </div>
                          {showConfirmPasswordHint ? (
                            <span
                              id="signup-confirm-password-hint"
                              className={`mt-1.5 flex items-center gap-1.5 text-xs font-medium ${
                                passwordsMatch ? 'text-emerald-400' : 'text-rose-300'
                              }`}
                              role="status"
                              aria-live="polite"
                            >
                              {passwordsMatch ? (
                                <>
                                  <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                                  {t('signup.passwordsMatch', { defaultValue: 'Passwords match' })}
                                </>
                              ) : (
                                <>
                                  <span aria-hidden>❌</span>
                                  {t('signup.passwordMismatch', { defaultValue: 'Passwords do not match' })}
                                </>
                              )}
                            </span>
                          ) : null}
                          {errors.confirmPassword ? (
                            <span className="mt-1 text-xs text-rose-300">{errors.confirmPassword}</span>
                          ) : null}
                        </label>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {step === 1 ? (
                <button type="submit" disabled={!canContinueStep1} className={`mt-4 w-full ${primaryCtaClass}`}>
                  {t('signup.continue', { defaultValue: 'Continue' })}
                </button>
              ) : (
                <div className="mt-4 flex w-full flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between sm:gap-4">
                  <button type="button" disabled={loading} onClick={goToStep1} className={secondaryOutlineBtnClass}>
                    <ChevronLeft size={18} aria-hidden />
                    {t('signup.back', { defaultValue: 'Back' })}
                  </button>
                  <button
                    type="submit"
                    disabled={!canSubmitStep2}
                    className={`${primaryCtaClass} w-full shrink-0 px-6 sm:w-auto`}
                  >
                    {loading
                      ? t('signup.creatingWorkspace', { defaultValue: 'Creating workspace…' })
                      : t('signup.createWorkspaceCta', { defaultValue: 'Create Workspace' })}
                  </button>
                </div>
              )}

              <p className="mt-2 text-center text-xs text-white/60">
                {t('signup.alreadyHaveAccountLead', { defaultValue: 'Already have an account?' })}{' '}
                <Link to="/login" className="font-semibold text-white/90 hover:text-white">
                  {t('login.signin', { defaultValue: 'Sign in' })}
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
