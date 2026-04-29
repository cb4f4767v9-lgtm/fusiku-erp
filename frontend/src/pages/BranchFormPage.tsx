import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { branchesApi, locationsApi, uploadApi } from '../services/api';
import { publicAssetUrl } from '../config/appConfig';
import toast from 'react-hot-toast';
import { CountrySearchSelect } from '../components/CountrySearchSelect';
import { locationCache } from '../utils/locationCache';
import { getErrorMessage } from '../utils/getErrorMessage';
import { PageLayout } from '../components/design-system';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'CNY', 'SAR', 'KWD', 'QAR', 'INR', 'PKR'] as const;

export function BranchFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isEdit = Boolean(id) && location.pathname.endsWith('/edit');

  const [countries, setCountries] = useState<{ isoCode: string; name: string }[]>([]);
  const [provinces, setProvinces] = useState<{ isoCode: string; name: string }[]>([]);
  const [cities, setCities] = useState<{ name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    code: '',
    adminName: '',
    country: '',
    province: '',
    city: '',
    address: '',
    currency: 'USD',
    isActive: true,
    logo: ''
  });

  const loadCountries = useCallback(async () => {
    if (locationCache.countries) {
      setCountries(locationCache.countries);
      return;
    }
    try {
      const { data } = await locationsApi.getCountries();
      const list = Array.isArray(data)
        ? data.map((c: any) => ({ isoCode: c.isoCode || c.code || '', name: c.name || '' })).filter((c: any) => c.isoCode)
        : [];
      locationCache.countries = list;
      setCountries(list);
    } catch {
      setCountries([]);
    }
  }, []);

  useEffect(() => {
    loadCountries();
  }, [loadCountries]);

  useEffect(() => {
    if (!id) return;
    branchesApi
      .getById(id)
      .then((r) => {
        const b = r.data;
        setForm({
          name: b.name || '',
          code: b.code || '',
          adminName: b.adminName || '',
          country: b.country || '',
          province: b.province || '',
          city: b.city || '',
          address: b.address || '',
          currency: b.currency || 'USD',
          isActive: b.isActive !== false,
          logo: b.logo || ''
        });
      })
      .catch(() => {
        toast.error(t('common.failed'));
        navigate('/branches');
      });
  }, [id, navigate, t]);

  useEffect(() => {
    if (!form.country) {
      setProvinces([]);
      return;
    }
    const cacheKey = form.country;
    if (locationCache.provinces[cacheKey]) {
      setProvinces(locationCache.provinces[cacheKey]);
      return;
    }
    locationsApi
      .getProvinces(form.country)
      .then((r) => {
        const list = Array.isArray(r.data)
          ? r.data.map((p: any) => ({ isoCode: p.isoCode || p.code || p.stateCode || '', name: p.name || '' })).filter((p: any) => p.isoCode)
          : [];
        locationCache.provinces[cacheKey] = list;
        setProvinces(list);
      })
      .catch(() => setProvinces([]));
  }, [form.country]);

  useEffect(() => {
    if (!form.country) {
      setCities([]);
      return;
    }
    const cacheKey = form.province ? `${form.country}-${form.province}` : form.country;
    if (locationCache.cities[cacheKey]) {
      setCities(locationCache.cities[cacheKey]);
      return;
    }
    const load = form.province ? locationsApi.getCities(form.country, form.province) : locationsApi.getCities(form.country);
    load
      .then((r) => {
        const list = Array.isArray(r.data)
          ? r.data.map((c: any) => ({ name: c.name || '' })).filter((c: any) => c.name)
          : [];
        locationCache.cities[cacheKey] = list;
        setCities(list);
      })
      .catch(() => setCities([]));
  }, [form.country, form.province]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error(t('settings.branchNameRequired'));
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        adminName: form.adminName.trim() || undefined,
        country: form.country || undefined,
        province: form.province || undefined,
        city: form.city || undefined,
        address: form.address.trim() || undefined,
        currency: form.currency || undefined,
        isActive: form.isActive,
        logo: form.logo || undefined
      };
      if (isEdit) {
        await branchesApi.update(id!, payload);
        toast.success(t('settings.branchUpdated'));
      } else {
        await branchesApi.create(payload);
        toast.success(t('settings.branchAdded'));
      }
      navigate('/branches');
      window.dispatchEvent(new Event('fusiku-branding-refresh'));
    } catch (err: any) {
      toast.error(getErrorMessage(err, t('common.failed')));
    } finally {
      setLoading(false);
    }
  };

  const onBranchLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { data } = await uploadApi.uploadBranding(file);
      const url = (data as any)?.url as string;
      if (url) setForm((f) => ({ ...f, logo: url }));
      toast.success(t('settings.logoUploaded'));
    } catch {
      toast.error(t('common.failed'));
    }
  };

  return (
    <PageLayout className="page erp-form-page erp-form-compact">
      <div className="erp-form-header">
        <div />
        <div className="erp-form-actions">
          <button type="button" className="btn btn-secondary btn-erp" onClick={() => navigate('/branches')}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="branch-form" className="btn btn-primary btn-erp" disabled={loading}>
            {t('common.save')}
          </button>
        </div>
      </div>

      <form id="branch-form" onSubmit={handleSubmit} className="erp-form-sections">
        <section className="erp-section erp-section-compact">
          <h3>{t('erp.basicInformation')}</h3>
          <div className="erp-field-grid erp-field-grid-compact">
            <div className="erp-field-row">
              <label>{t('branches.branchName')} *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="erp-input-compact"
              />
            </div>
            <div className="erp-field-row">
              <label>{t('branches.branchCode')}</label>
              <input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                className="erp-input-compact"
                placeholder={t('branches.branchCodePlaceholder')}
              />
            </div>
            <div className="erp-field-row">
              <label>{t('branches.manager')}</label>
              <input
                value={form.adminName}
                onChange={(e) => setForm((f) => ({ ...f, adminName: e.target.value }))}
                className="erp-input-compact"
              />
            </div>
            <div className="erp-field-row">
              <label>{t('settings.branchLogo')}</label>
              <p className="settings-hint" style={{ margin: '0 0 6px' }}>{t('settings.branchLogoHint')}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {form.logo ? (
                  <img src={publicAssetUrl(form.logo) || ''} alt="" style={{ maxHeight: 44, maxWidth: 120, objectFit: 'contain' }} />
                ) : null}
                <input type="file" accept="image/*" onChange={onBranchLogoFile} className="erp-input-compact" />
              </div>
            </div>
          </div>
        </section>

        <section className="erp-section erp-section-compact">
          <h3>{t('suppliers.address')}</h3>
          <div className="erp-field-grid erp-field-grid-compact">
            <div className="erp-field-row">
              <label htmlFor="branch-country-select">{t('suppliers.country')}</label>
              <CountrySearchSelect
                id="branch-country-select"
                value={form.country}
                onChange={(iso) => setForm((f) => ({ ...f, country: iso, province: '', city: '' }))}
                options={countries}
                placeholder={t('common.search')}
                emptyLabel={t('common.selectPlaceholder')}
                aria-label={t('suppliers.country')}
              />
            </div>
            <div className="erp-field-row">
              <label>{t('suppliers.province')}</label>
              <select
                value={form.province}
                disabled={!form.country}
                onChange={(e) => setForm((f) => ({ ...f, province: e.target.value, city: '' }))}
                className="erp-input-compact"
              >
                <option value="">{t('common.selectPlaceholder')}</option>
                {provinces.map((p) => (
                  <option key={p.isoCode} value={p.isoCode}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="erp-field-row">
              <label>{t('suppliers.city')}</label>
              <select
                value={form.city}
                disabled={!form.province}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className="erp-input-compact"
              >
                <option value="">{t('common.selectPlaceholder')}</option>
                {cities.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="erp-field-row">
              <label>{t('suppliers.street')}</label>
              <input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="erp-input-compact"
              />
            </div>
          </div>
        </section>

        <section className="erp-section erp-section-compact">
          <h3>{t('branches.settingsSection')}</h3>
          <div className="erp-field-grid erp-field-grid-compact">
            <div className="erp-field-row">
              <label>{t('branches.currency')}</label>
              <select
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="erp-input-compact"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="erp-field-row">
              <label>{t('branches.status')}</label>
              <select
                value={form.isActive ? 'active' : 'inactive'}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.value === 'active' }))}
                className="erp-input-compact"
              >
                <option value="active">{t('branches.active')}</option>
                <option value="inactive">{t('branches.inactive')}</option>
              </select>
            </div>
          </div>
        </section>
      </form>
    </PageLayout>
  );
}
