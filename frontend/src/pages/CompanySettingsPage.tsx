import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { companyApi } from '../services/api';
import toast from 'react-hot-toast';

export function CompanySettingsPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<any>(null);
  const [form, setForm] = useState({ currency: 'USD', timezone: 'UTC', taxRate: 0, invoicePrefix: 'INV' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    companyApi.getSettings()
      .then((r) => {
        setSettings(r.data);
        setForm({
          currency: r.data?.currency || 'USD',
          timezone: r.data?.timezone || 'UTC',
          taxRate: Number(r.data?.taxRate || 0),
          invoicePrefix: r.data?.invoicePrefix || 'INV'
        });
      })
      .catch(() => setSettings(null))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await companyApi.updateSettings(form);
      toast.success(t('company.settingsSaved'));
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('common.failed'));
    }
  };

  if (loading) return <div className="page-loading">{t('common.loading')}</div>;

  return (
    <div className="page">
      <h1 className="page-title">{t('company.title')}</h1>
      <form onSubmit={handleSubmit} className="modal-form" style={{ maxWidth: 400 }}>
        <label>
          {t('company.currency')}
          <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="NGN">NGN</option>
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
        <button type="submit" className="btn btn-primary">{t('company.saveSettings')}</button>
      </form>
    </div>
  );
}
