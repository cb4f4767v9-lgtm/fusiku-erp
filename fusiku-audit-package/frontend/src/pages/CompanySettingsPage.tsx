import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { companyApi } from '../services/api';
import toast from 'react-hot-toast';
import { useBranding } from '../contexts/BrandingContext';
import { getErrorMessage } from '../utils/getErrorMessage';
import { PageLayout, PageHeader, LoadingSkeleton } from '../components/design-system';

export function CompanySettingsPage() {
  const { t } = useTranslation();
  const { profile } = useBranding();
  const canHidePoweredBy = Boolean(profile?.saas?.features?.removeBranding);
  const [settings, setSettings] = useState<any>(null);
  const [form, setForm] = useState({
    baseCurrency: 'USD',
    timezone: 'UTC',
    taxRate: 0,
    invoicePrefix: 'INV',
    spreadBps: 0,
    hidePoweredByBranding: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await companyApi.getSettings();
        if (cancelled) return;
        setSettings(r.data);
        const base = r.data?.baseCurrency || r.data?.currency || 'USD';
        setForm({
          baseCurrency: base,
          timezone: r.data?.timezone || 'UTC',
          taxRate: Number(r.data?.taxRate || 0),
          invoicePrefix: r.data?.invoicePrefix || 'INV',
          spreadBps: Math.floor(Number((r.data as { spreadBps?: number })?.spreadBps)) || 0,
          hidePoweredByBranding: Boolean((r.data as { hidePoweredByBranding?: boolean })?.hidePoweredByBranding)
        });
      } catch (error) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn('Settings API failed', error);
        }
        if (!cancelled) setSettings(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      // Keep legacy `currency` in sync server-side (server also normalizes).
      await companyApi.updateSettings({ ...form, currency: form.baseCurrency });
      window.dispatchEvent(new Event('fusiku-branding-refresh'));
      toast.success(t('company.settingsSaved'));
    } catch (err: any) {
      toast.error(getErrorMessage(err, t('common.failed')));
    }
  };

  if (loading) {
    return (
      <PageLayout className="page">
        <PageHeader title={t('company.title')} />
        <LoadingSkeleton variant="dashboard" />
      </PageLayout>
    );
  }

  return (
    <PageLayout className="page">
      <PageHeader title={t('company.title')} />
      <form onSubmit={handleSubmit} className="modal-form" style={{ maxWidth: 400 }}>
        <label>
          {t('company.baseCurrency')}
          <select
            value={form.baseCurrency}
            onChange={(e) => setForm((f) => ({ ...f, baseCurrency: e.target.value }))}
          >
            <option value="USD">USD</option>
            <option value="PKR">PKR</option>
            <option value="AED">AED</option>
            <option value="CNY">CNY</option>
          </select>
        </label>
        <label>
          {t('company.timezone')}
          <select value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}>
            <option value="UTC">UTC</option>
            <option value="America/New_York">Eastern</option>
            <option value="Europe/London">London</option>
            <option value="Africa/Lagos">Lagos</option>
          </select>
        </label>
        <label>
          {t('company.taxRate')}
          <input
            type="number"
            step="0.01"
            value={form.taxRate}
            onChange={(e) => setForm((f) => ({ ...f, taxRate: parseFloat(e.target.value) || 0 }))}
          />
        </label>
        <label>
          {t('company.invoicePrefix')}
          <input
            value={form.invoicePrefix}
            onChange={(e) => setForm((f) => ({ ...f, invoicePrefix: e.target.value }))}
          />
        </label>
        <label>
          {t('company.spreadBps')}
          <input
            type="number"
            min={0}
            max={50000}
            step={1}
            value={form.spreadBps}
            onChange={(e) => setForm((f) => ({ ...f, spreadBps: Math.floor(Number(e.target.value)) || 0 }))}
          />
          <span style={{ display: 'block', fontSize: '0.85rem', marginTop: 4, opacity: 0.75 }}>
            {t('company.spreadBpsHint')}
          </span>
        </label>
        {canHidePoweredBy ? (
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <input
              type="checkbox"
              checked={form.hidePoweredByBranding}
              onChange={(e) => setForm((f) => ({ ...f, hidePoweredByBranding: e.target.checked }))}
            />
            <span>{t('company.hidePoweredBy')}</span>
          </label>
        ) : null}
        {canHidePoweredBy ? (
          <p style={{ fontSize: '0.85rem', opacity: 0.75, marginTop: 4 }}>{t('company.hidePoweredByHelp')}</p>
        ) : null}
        <button type="submit" className="btn btn-primary">{t('company.saveSettings')}</button>
      </form>
    </PageLayout>
  );
}
