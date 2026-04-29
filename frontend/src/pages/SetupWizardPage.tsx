import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { AuthShell } from '../components/auth/AuthShell';
import { AppHeader } from '../components/common/AppHeader';
import { COUNTRIES } from '../constants/countries';
import { setupApi } from '../services/api';
import { getErrorMessage } from '../utils/getErrorMessage';
import { useAuth } from '../hooks/useAuth';

type BusinessType =
  | 'Mobile Shop'
  | 'Phone Parts'
  | 'Accessories'
  | 'Repair Center'
  | 'Tools Business'
  | 'Institute'
  | 'Other';

type Platform = 'Android' | 'iOS' | 'Both';

type Requirement = 'Accounting Only' | 'Inventory + POS' | 'Full ERP';

function GlassCard({
  selected,
  title,
  onClick,
}: {
  selected?: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl p-4 border backdrop-blur-2xl transition ${
        selected
          ? 'bg-white/20 border-white/40 ring-2 ring-cyan-300/40'
          : 'bg-white/10 border-white/20 hover:bg-white/15'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white/90">{title}</div>
        {selected ? (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/20 ring-1 ring-emerald-300/40">
            <Check size={14} className="text-emerald-200" />
          </span>
        ) : (
          <span className="inline-flex h-6 w-6 rounded-full bg-white/5 ring-1 ring-white/10" />
        )}
      </div>
    </button>
  );
}

function CountryMultiSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [removing, setRemoving] = useState<Record<string, boolean>>({});
  const [scrollTop, setScrollTop] = useState(0);

  const quick = useMemo(
    () => [
      { code: 'CN', name: 'China' },
      { code: 'AE', name: 'United Arab Emirates' },
      { code: 'PK', name: 'Pakistan' },
      { code: 'US', name: 'United States' },
      { code: 'GB', name: 'United Kingdom' },
      { code: 'OTHER', name: 'Other' },
    ],
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }, [query]);

  const toggle = (code: string) => {
    const key = String(code).trim().toUpperCase();
    if (!key) return;
    if (value.includes(key)) onChange(value.filter((v) => v !== key));
    else onChange([...value, key]);
  };

  const remove = (code: string) => {
    const key = String(code).trim().toUpperCase();
    if (!key) return;
    setRemoving((r) => ({ ...r, [key]: true }));
    window.setTimeout(() => {
      onChange(value.filter((v) => v !== key));
      setRemoving((r) => {
        const next = { ...r };
        delete next[key];
        return next;
      });
    }, 160);
  };

  const selectedLabels = useMemo(() => {
    const map = new Map(COUNTRIES.map((c) => [c.code, c.name]));
    return value.map((v) => (v === 'OTHER' ? 'Other' : map.get(v) || v));
  }, [value]);

  const highlighted = (text: string) => {
    const q = query.trim();
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return text;
    const before = text.slice(0, idx);
    const hit = text.slice(idx, idx + q.length);
    const after = text.slice(idx + q.length);
    return (
      <span>
        {before}
        <span className="text-cyan-200">{hit}</span>
        {after}
      </span>
    );
  };

  // Lightweight virtualization (fixed row height) to keep the dropdown snappy with large lists.
  const ROW_H = 40;
  const VIEW_H = 288; // matches max-h-72
  const overscan = 8;
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - overscan);
  const visibleCount = Math.ceil(VIEW_H / ROW_H) + overscan * 2;
  const end = Math.min(filtered.length, start + visibleCount);
  const slice = filtered.slice(start, end);
  const padTop = start * ROW_H;
  const padBottom = (filtered.length - end) * ROW_H;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white/10 border border-white/20 ring-1 ring-white/10 shadow-lg shadow-black/10 backdrop-blur-2xl text-sm text-white/90 transition hover:bg-white/15 hover:border-white/30"
      >
        <div className="flex flex-wrap gap-2">
          {value.length === 0 ? (
            <span className="text-white/50">{t('setup.sourcingPlaceholder', { defaultValue: 'Select sourcing countries...' })}</span>
          ) : (
            selectedLabels.map((label, idx) => {
              const code = value[idx];
              return (
                <span
                  key={code}
                  className={`inline-flex items-center gap-2 rounded-lg bg-white/10 px-2.5 py-1 text-xs text-white/85 ring-1 ring-white/15 shadow-sm shadow-black/10 transition-all hover:bg-white/15 hover:ring-white/25 ${
                    removing[code] ? 'opacity-0 scale-[0.98]' : 'opacity-100 scale-100'
                  }`}
                >
                  {label}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      remove(code);
                    }}
                    className="text-white/60 hover:text-white"
                    aria-label={`Remove ${label}`}
                  >
                    <X size={14} />
                  </button>
                </span>
              );
            })
          )}
        </div>
        <ChevronDown size={18} className={`text-white/60 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      <div className="mt-2 text-xs text-white/60">
        {t('setup.selectedCount', { defaultValue: `Selected: ${value.length} countries` }).replace(
          'Selected: 0 countries',
          `Selected: ${value.length} countries`
        )}
      </div>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-full rounded-2xl bg-[#0b1025]/85 border border-white/15 backdrop-blur-2xl shadow-2xl shadow-black/40 overflow-hidden">
          <div className="p-3 border-b border-white/10">
            <div className="flex items-center gap-2 rounded-xl bg-white/10 border border-white/15 px-3 py-2">
              <Search size={16} className="text-white/60" />
              <input
                className="w-full bg-transparent outline-none text-sm text-white placeholder:text-white/40"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('common.search', { defaultValue: 'Search...' })}
              />
            </div>
          </div>

          <div className="p-3 border-b border-white/10">
            <div className="text-xs text-white/60 mb-2">{t('setup.quickPick', { defaultValue: 'Quick picks' })}</div>
            <div className="flex flex-wrap gap-2">
              {quick.map((c) => {
                const selected = value.includes(c.code);
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => toggle(c.code)}
                    className={`rounded-xl px-3 py-2 text-xs ring-1 transition ${
                      selected
                        ? 'bg-white/20 ring-white/30 text-white'
                        : 'bg-white/10 ring-white/15 text-white/80 hover:bg-white/15'
                    }`}
                  >
                    {selected ? '✓ ' : ''}
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className="max-h-72 overflow-auto p-2"
            onScroll={(e) => setScrollTop((e.currentTarget as HTMLDivElement).scrollTop)}
          >
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-sm text-white/60">
                {t('setup.noCountryFound', { defaultValue: 'No country found' })}
              </div>
            ) : (
              <div>
                <div style={{ height: padTop }} />
                {slice.map((c) => {
                  const selected = value.includes(c.code);
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => toggle(c.code)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-sm transition ${
                        selected ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10'
                      }`}
                      style={{ height: ROW_H }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-white/45 w-8">{highlighted(c.code)}</span>
                        <span>{highlighted(c.name) as any}</span>
                      </div>
                      {selected ? <Check size={16} className="text-emerald-200" /> : null}
                    </button>
                  );
                })}
                <div style={{ height: padBottom }} />
              </div>
            )}
          </div>

          <div className="p-2 border-t border-white/10 flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-2 rounded-xl text-xs bg-white/10 hover:bg-white/15 ring-1 ring-white/15 text-white/80"
            >
              {t('common.done', { defaultValue: 'Done' })}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function SetupWizardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [step, setStep] = useState(1);

  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [businessTypeOther, setBusinessTypeOther] = useState('');
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [sourcingCountries, setSourcingCountries] = useState<string[]>([]);
  const [sourcingOther, setSourcingOther] = useState('');
  const [requirements, setRequirements] = useState<Requirement | null>(null);
  const [saving, setSaving] = useState(false);

  const showOther = sourcingCountries.includes('OTHER');
  const showBusinessOther = businessType === 'Other';

  const canContinue = useMemo(() => {
    if (step === 1) {
      if (!businessType) return false;
      if (businessType === 'Other') return Boolean(businessTypeOther.trim());
      return true;
    }
    if (step === 2) return Boolean(platform);
    if (step === 3) {
      if (sourcingCountries.length === 0) return false;
      if (showOther) return Boolean(sourcingOther.trim());
      return true;
    }
    if (step === 4) return Boolean(requirements);
    return false;
  }, [step, businessType, businessTypeOther, platform, sourcingCountries, showOther, sourcingOther, requirements]);

  const onFinish = async () => {
    if (!token) {
      toast.error(t('common.pleaseLogin', { defaultValue: 'Please sign in first.' }));
      navigate('/login');
      return;
    }
    if (!businessType || !platform || !requirements) return;
    if (sourcingCountries.length === 0) return;
    if (businessType === 'Other' && !businessTypeOther.trim()) return;
    if (showOther && !sourcingOther.trim()) return;

    setSaving(true);
    try {
      await setupApi.saveProfile({
        businessType: businessType === 'Other' ? businessTypeOther.trim() : businessType,
        platform,
        sourcingCountries,
        sourcingOther: showOther ? sourcingOther.trim() : null,
        requirements,
      });
      toast.success(t('setup.saved', { defaultValue: 'Setup saved' }));
      navigate('/pricing', { replace: true, state: { requirements } });
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, t('setup.saveFailed', { defaultValue: 'Failed to save setup' })));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthShell overflow="auto">
      <AppHeader />
      <div className="min-h-screen w-full flex items-center justify-center overflow-x-hidden overflow-y-auto">
        <div className="w-full max-w-4xl px-6 py-10">
          <div className="mx-auto max-w-[720px] rounded-2xl bg-white/10 border border-white/20 backdrop-blur-2xl shadow-2xl p-8">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="text-lg font-semibold text-white/90">
                {t('setup.title', { defaultValue: 'Setup Wizard' })}
              </div>
              <div className="text-sm text-white/60">
                {t('setup.stepOf', { defaultValue: `Step ${step} of 4` }).replace('Step 1 of 4', `Step ${step} of 4`)}
              </div>
            </div>

            <div className="mb-8">
              <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 transition-all"
                  style={{ width: `${(step / 4) * 100}%` }}
                />
              </div>
            </div>

            {/* Step 1 */}
            {step === 1 ? (
              <div className="space-y-4">
                <div className="text-sm text-white/70">{t('setup.businessType', { defaultValue: 'Business type' })}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(
                    [
                      'Mobile Shop',
                      'Phone Parts',
                      'Accessories',
                      'Repair Center',
                      'Tools Business',
                      'Institute',
                      'Other',
                    ] as BusinessType[]
                  ).map((v) => (
                    <GlassCard key={v} title={v} selected={businessType === v} onClick={() => setBusinessType(v)} />
                  ))}
                </div>
                {showBusinessOther ? (
                  <div>
                    <label className="flex flex-col">
                      <span className="text-xs text-white/70 mb-1">
                        {t('setup.businessTypeOther', { defaultValue: 'Other business type' })}
                      </span>
                      <input
                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/40 outline-none"
                        value={businessTypeOther}
                        onChange={(e) => setBusinessTypeOther(e.target.value)}
                        placeholder={t('setup.businessTypeOtherPlaceholder', { defaultValue: 'Enter your business type' })}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Step 2 */}
            {step === 2 ? (
              <div className="space-y-4">
                <div className="text-sm text-white/70">{t('setup.platform', { defaultValue: 'Platform' })}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(['Android', 'iOS', 'Both'] as Platform[]).map((v) => (
                    <GlassCard key={v} title={v} selected={platform === v} onClick={() => setPlatform(v)} />
                  ))}
                </div>
              </div>
            ) : null}

            {/* Step 3 */}
            {step === 3 ? (
              <div className="space-y-4">
                <div className="text-sm text-white/70">{t('setup.sourcing', { defaultValue: 'Sourcing' })}</div>
                <CountryMultiSelect value={sourcingCountries} onChange={setSourcingCountries} />
                {showOther ? (
                  <div>
                    <label className="flex flex-col">
                      <span className="text-xs text-white/70 mb-1">
                        {t('setup.sourcingOther', { defaultValue: 'Other sourcing location' })}
                      </span>
                      <input
                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-white/40 outline-none"
                        value={sourcingOther}
                        onChange={(e) => setSourcingOther(e.target.value)}
                        placeholder={t('setup.sourcingOtherPlaceholder', { defaultValue: 'Enter custom sourcing location' })}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Step 4 */}
            {step === 4 ? (
              <div className="space-y-4">
                <div className="text-sm text-white/70">{t('setup.requirements', { defaultValue: 'Requirements' })}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(['Accounting Only', 'Inventory + POS', 'Full ERP'] as Requirement[]).map((v) => (
                    <GlassCard key={v} title={v} selected={requirements === v} onClick={() => setRequirements(v)} />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-10 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                disabled={step === 1 || saving}
                className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-sm text-white/80 disabled:opacity-50"
              >
                {t('common.back', { defaultValue: 'Back' })}
              </button>

              {step < 4 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.min(4, s + 1))}
                  disabled={!canContinue || saving}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t('common.continue', { defaultValue: 'Continue' })}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onFinish}
                  disabled={!canContinue || saving}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving
                    ? t('common.saving', { defaultValue: 'Saving...' })
                    : t('setup.finishChoosePlan', { defaultValue: 'Finish setup & choose plan' })}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}

