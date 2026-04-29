import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BarChart3, Boxes, Building2, ChevronDown, Eye, EyeOff, PlayCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { AuthShell } from '../components/auth/AuthShell';
import { AppHeader } from '../components/common/AppHeader';

const BUSINESS_TYPES = [
  'Mobile Shop',
  'Phone Parts',
  'Accessories',
  'Repair Center',
  'Tools Business',
  'Institute',
  'Other',
] as const;

const SOURCING_COUNTRIES = [
  'China',
  'United Arab Emirates',
  'Pakistan',
  'United States',
  'United Kingdom',
  'Other',
] as const;

export default function SetupPage() {
  const { t } = useTranslation();

  const [companyName, setCompanyName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [slogan, setSlogan] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [sourcingCountry, setSourcingCountry] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <AuthShell overflow="auto" topControls="app">
      <AppHeader />

      <div className="min-h-screen w-full flex items-center justify-center overflow-x-hidden overflow-y-auto">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center px-6 lg:px-10 py-10">
          {/* LEFT */}
          <section className="flex flex-col justify-center lg:-ml-6">
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
                  <div className="text-2xl font-semibold mb-2">{t('signup.createWorkspace', { defaultValue: 'Create workspace' })}</div>
                  <div className="text-sm text-white/70 mb-6">
                    {t('signup.subtitle', { defaultValue: 'Set up your company and admin account' })}
                  </div>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                  }}
                >
                  <div className="flex flex-col gap-4">
                    <label className="flex flex-col">
                      <span className="text-xs text-white/70 mb-1">{t('signup.companyName', { defaultValue: 'Company name' })}</span>
                      <input
                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/40 outline-none"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder={t('signup.companyNamePlaceholder', { defaultValue: 'Enter your company name' })}
                      />
                    </label>

                    <label className="flex flex-col">
                      <span className="text-xs text-white/70 mb-1">{t('signup.logoUpload', { defaultValue: 'Logo upload' })}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="w-full rounded-xl bg-white/10 border border-white/20 text-sm text-white file:mr-3 file:rounded-lg file:border-0 file:bg-white/15 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white/80 hover:file:bg-white/20"
                        onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                      />
                      {logoFile ? <div className="mt-1 text-xs text-white/50">{logoFile.name}</div> : null}
                    </label>

                    <label className="flex flex-col">
                      <span className="text-xs text-white/70 mb-1">{t('signup.slogan', { defaultValue: 'Slogan' })}</span>
                      <input
                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/40 outline-none"
                        value={slogan}
                        onChange={(e) => setSlogan(e.target.value)}
                        placeholder={t('signup.sloganPlaceholder', { defaultValue: 'Your company slogan' })}
                      />
                    </label>

                    <label className="flex flex-col">
                      <span className="text-xs text-white/70 mb-1">{t('signup.businessType', { defaultValue: 'Business type' })}</span>
                      <div className="relative">
                        <select
                          className="w-full appearance-none px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-sm text-white backdrop-blur-xl outline-none"
                          value={businessType}
                          onChange={(e) => setBusinessType(e.target.value)}
                        >
                          <option value="" className="bg-[#1a1f3a] text-white">
                            {t('common.select', { defaultValue: 'Select...' })}
                          </option>
                          {BUSINESS_TYPES.map((bt) => (
                            <option key={bt} value={bt} className="bg-[#1a1f3a] text-white">
                              {bt}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/60" />
                      </div>
                    </label>

                    <label className="flex flex-col">
                      <span className="text-xs text-white/70 mb-1">{t('signup.sourcingType', { defaultValue: 'Sourcing type' })}</span>
                      <div className="relative">
                        <select
                          className="w-full appearance-none px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-sm text-white backdrop-blur-xl outline-none"
                          value={sourcingCountry}
                          onChange={(e) => setSourcingCountry(e.target.value)}
                        >
                          <option value="" className="bg-[#1a1f3a] text-white">
                            {t('common.select', { defaultValue: 'Select...' })}
                          </option>
                          {SOURCING_COUNTRIES.map((c) => (
                            <option key={c} value={c} className="bg-[#1a1f3a] text-white">
                              {c}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/60" />
                      </div>
                    </label>

                    <label className="flex flex-col">
                      <span className="text-xs text-white/70 mb-1">{t('login.email', { defaultValue: 'Email address' })}</span>
                      <input
                        type="email"
                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/40 outline-none"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        placeholder={t('login.email', { defaultValue: 'Enter your email' })}
                      />
                    </label>

                    <label className="flex flex-col">
                      <span className="text-xs text-white/70 mb-1">{t('login.password', { defaultValue: 'Password' })}</span>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="w-full px-4 py-3 pr-11 rounded-xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/40 outline-none"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete="new-password"
                          placeholder={t('login.password', { defaultValue: 'Enter your password' })}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </label>

                    <label className="flex flex-col">
                      <span className="text-xs text-white/70 mb-1">
                        {t('signup.confirmPassword', { defaultValue: 'Confirm password' })}
                      </span>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          className="w-full px-4 py-3 pr-11 rounded-xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/40 outline-none"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          autoComplete="new-password"
                          placeholder={t('signup.confirmPasswordPlaceholder', { defaultValue: 'Confirm your password' })}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                          aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </label>

                    <button
                      type="submit"
                      className="w-full py-3 mt-4 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 text-sm font-semibold text-white"
                    >
                      {t('signup.createWorkspaceContinue', { defaultValue: 'Create workspace & continue' })}
                    </button>

                    <div className="text-xs text-white/60 text-center mt-4">
                      {t('signup.haveAccount', { defaultValue: 'Already have an account?' })}{' '}
                      <Link to="/login" className="font-semibold text-white/90 hover:text-white">
                        {t('signup.signin', { defaultValue: 'Sign in' })}
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
