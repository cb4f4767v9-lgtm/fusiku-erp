import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { suppliersApi, locationsApi, uploadApi } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, QrCode, X } from 'lucide-react';
import { CountrySearchSelect } from '../components/CountrySearchSelect';
import { locationCache } from '../utils/locationCache';

const CONTACT_TYPES = ['phone', 'whatsapp', 'wechat', 'email', 'other'] as const;
const QR_ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp';
const QR_MAX_SIZE = 2 * 1024 * 1024;

type SupplierContact = { id?: string; contactType: string; value: string; qrCodeUrl?: string };

export function SupplierFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [countries, setCountries] = useState<{ isoCode: string; name: string }[]>([]);
  const [provinces, setProvinces] = useState<{ isoCode: string; name: string }[]>([]);
  const [cities, setCities] = useState<{ name: string }[]>([]);
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    country: '',
    province: '',
    city: '',
    address: '',
    openingBalance: 0,
    balanceType: 'debit' as 'debit' | 'credit',
    paymentMethod: 'cash' as string,
    moneyStatus: 'available' as string,
    availableBalance: 0,
    blockedBalance: 0,
    contacts: [] as SupplierContact[]
  });

  const loadCountries = useCallback(async () => {
    if (locationCache.countries) {
      setCountries(locationCache.countries);
      return;
    }
    try {
      const { data } = await locationsApi.getCountries();
      const list = Array.isArray(data) ? data.map((c: any) => ({ isoCode: c.isoCode || c.code || '', name: c.name || '' })).filter((c: any) => c.isoCode) : [];
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
    if (id) {
      suppliersApi.getById(id).then((r) => {
        const s = r.data;
        setForm({
          name: s.name,
          email: s.email || '',
          country: s.country || '',
          province: s.province || '',
          city: s.city || '',
          address: s.address || '',
          openingBalance: Number(s.openingBalance) || 0,
          balanceType: (s.balanceType || 'debit') as 'debit' | 'credit',
          paymentMethod: s.paymentMethod || 'cash',
          moneyStatus: s.moneyStatus || 'available',
          availableBalance: s.availableBalance != null ? Number(s.availableBalance) : (s.moneyStatus === 'blocked' ? 0 : Number(s.openingBalance) || 0),
          blockedBalance: s.blockedBalance != null ? Number(s.blockedBalance) : (s.moneyStatus === 'blocked' ? Number(s.openingBalance) || 0 : 0),
          contacts: (s.contacts || []).map((c: any) => ({ id: c.id, contactType: c.contactType === 'alipay' ? 'other' : c.contactType, value: c.value, qrCodeUrl: c.qrCodeUrl || '' }))
        });
      }).catch(() => navigate('/suppliers'));
    }
  }, [id, navigate]);

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
    locationsApi.getProvinces(form.country).then((r) => {
      const list = Array.isArray(r.data) ? r.data.map((p: any) => ({ isoCode: p.isoCode || p.code || p.stateCode || '', name: p.name || '' })).filter((p: any) => p.isoCode) : [];
      locationCache.provinces[cacheKey] = list;
      setProvinces(list);
    }).catch(() => setProvinces([]));
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
    load.then((r) => {
      const list = Array.isArray(r.data) ? r.data.map((c: any) => ({ name: c.name || '' })).filter((c: any) => c.name) : [];
      locationCache.cities[cacheKey] = list;
      setCities(list);
    }).catch(() => setCities([]));
  }, [form.country, form.province]);

  const getContactTypeLabel = (type: string) =>
    t(`suppliers.contactType${type === 'other' ? 'Other' : type.charAt(0).toUpperCase() + type.slice(1)}`);

  const addContact = () => setForm((f) => ({ ...f, contacts: [...f.contacts, { contactType: 'phone', value: '', qrCodeUrl: '' }] }));
  const removeContact = (idx: number) => setForm((f) => ({ ...f, contacts: f.contacts.filter((_, i) => i !== idx) }));
  const updateContact = (idx: number, field: keyof SupplierContact, value: string) =>
    setForm((f) => ({ ...f, contacts: f.contacts.map((c, i) => (i === idx ? { ...c, [field]: value } : c)) }));

  const handleQrUpload = async (idx: number, file: File) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error(t('suppliers.qrInvalidFormat'));
      return;
    }
    if (file.size > QR_MAX_SIZE) {
      toast.error(t('suppliers.qrMaxSize'));
      return;
    }
    try {
      const { data } = await uploadApi.uploadQr(file);
      const base = ((import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL || '').replace(/\/api\/?$/, '') || window.location.origin;
      const url = data.url?.startsWith('/') ? base + data.url : data.url || '';
      updateContact(idx, 'qrCodeUrl', url);
      toast.success(t('common.save'));
    } catch {
      toast.error(t('common.failed'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error(t('suppliers.nameRequired'));
      return;
    }
    if (!form.country) {
      toast.error(t('suppliers.countryRequired'));
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        country: form.country,
        province: form.province || undefined,
        city: form.city || undefined,
        address: form.address.trim() || undefined,
        openingBalance: Number(form.openingBalance) || 0,
        balanceType: form.balanceType,
        paymentMethod: form.paymentMethod || undefined,
        moneyStatus: form.moneyStatus || undefined,
        availableBalance: Number(form.availableBalance) || 0,
        blockedBalance: Number(form.blockedBalance) || 0,
        contacts: form.contacts.filter((c) => c.value.trim()).map((c) => ({
          contactType: c.contactType,
          value: c.value.trim(),
          qrCodeUrl: c.qrCodeUrl || undefined
        }))
      };
      if (isEdit) {
        await suppliersApi.update(id!, payload);
        toast.success(t('suppliers.supplierUpdated'));
      } else {
        await suppliersApi.create(payload);
        toast.success(t('suppliers.supplierAdded'));
      }
      navigate('/suppliers');
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('common.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page erp-form-page erp-form-compact">
      <div className="erp-form-header">
        <div />
        <div className="erp-form-actions">
          <button type="button" className="btn btn-secondary btn-erp" onClick={() => navigate('/suppliers')}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="supplier-form" className="btn btn-primary btn-erp" disabled={loading}>
            {t('common.save')}
          </button>
        </div>
      </div>

      <form id="supplier-form" onSubmit={handleSubmit} className="erp-form-sections">
        <section className="erp-section erp-section-compact">
          <h3>{t('erp.basicInformation')}</h3>
          <div className="erp-field-grid erp-field-grid-compact">
            <div className="erp-field-row">
              <label>{t('suppliers.name')} *</label>
              <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="erp-input-compact" />
            </div>
            <div className="erp-field-row">
              <label>{t('suppliers.contactTypeEmail')}</label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="erp-input-compact" />
            </div>
          </div>
        </section>

        <section className="erp-section erp-section-compact">
          <h3>{t('suppliers.address')}</h3>

          <div className="erp-field-grid erp-field-grid-compact">

            <div className="erp-field-row">
              <label htmlFor="supplier-country-select">{t('suppliers.country')} *</label>
              <CountrySearchSelect
                id="supplier-country-select"
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
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    province: e.target.value,
                    city: ''
                  }))
                }
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
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    city: e.target.value
                  }))
                }
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
                type="text"
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    address: e.target.value
                  }))
                }
                className="erp-input-compact"
              />
            </div>

          </div>
        </section>

        <section className="erp-section erp-section-compact">
          <div className="erp-section-header">
            <h3>{t('suppliers.contacts')}</h3>
            <button type="button" className="btn btn-sm btn-erp" onClick={addContact}><Plus size={14} /> {t('suppliers.addContact')}</button>
          </div>
          <table className="erp-table erp-table-compact erp-table-contacts">
            <thead>
              <tr>
                <th>{t('erp.type')}</th>
                <th>{t('suppliers.value')}</th>
                <th>{t('suppliers.uploadQr')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {form.contacts.map((c, idx) => (
                <tr key={idx}>
                  <td>
                    <select value={c.contactType} onChange={(e) => updateContact(idx, 'contactType', e.target.value)} className="erp-input-compact">
                      {CONTACT_TYPES.map((ct) => (
                        <option key={ct} value={ct}>{getContactTypeLabel(ct)}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input value={c.value} onChange={(e) => updateContact(idx, 'value', e.target.value)} placeholder="+86..." className="erp-input-compact" />
                  </td>
                  <td>
                    <div className="erp-qr-cell">
                      <label className="btn btn-sm btn-erp">
                        {c.qrCodeUrl ? <QrCode size={14} /> : t('suppliers.uploadQr')}
                        <input type="file" accept={QR_ACCEPT} hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleQrUpload(idx, f); e.target.value = ''; }} />
                      </label>
                      {c.qrCodeUrl && (
                        <>
                          <img src={c.qrCodeUrl} alt="QR" className="erp-qr-thumb" onClick={() => setQrPreviewUrl(c.qrCodeUrl!)} />
                          <button type="button" className="btn btn-sm btn-erp" onClick={() => setQrPreviewUrl(c.qrCodeUrl!)} title={t('suppliers.qrPreview')}><QrCode size={14} /></button>
                        </>
                      )}
                    </div>
                  </td>
                  <td>
                    <button type="button" className="btn btn-sm btn-danger btn-erp" onClick={() => removeContact(idx)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {form.contacts.length === 0 && (
                <tr><td colSpan={4} className="erp-empty">{t('suppliers.addContact')}</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="erp-section erp-section-compact">
          <h3>{t('suppliers.balanceSection')}</h3>
          <div className="erp-field-grid erp-field-grid-compact">
            <div className="erp-field-row">
              <label>{t('suppliers.availableBalance')}</label>
              <input type="number" step="0.01" min={0} value={form.availableBalance} onChange={(e) => setForm((f) => ({ ...f, availableBalance: Number(e.target.value) || 0 }))} className="erp-input-compact" />
            </div>
            <div className="erp-field-row">
              <label>{t('suppliers.blockedBalance')}</label>
              <input type="number" step="0.01" min={0} value={form.blockedBalance} onChange={(e) => setForm((f) => ({ ...f, blockedBalance: Number(e.target.value) || 0 }))} className="erp-input-compact" />
            </div>
            <div className="erp-field-row erp-field-full">
              <label>{t('suppliers.totalBalance')}</label>
              <span className="erp-balance-total">{(Number(form.availableBalance) + Number(form.blockedBalance)).toLocaleString()}</span>
            </div>
          </div>
        </section>
      </form>

      {qrPreviewUrl && (
        <div className="modal-overlay" onClick={() => setQrPreviewUrl(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('suppliers.qrPreview')}</h3>
              <button onClick={() => setQrPreviewUrl(null)}><X size={20} /></button>
            </div>
            <div style={{ padding: 16, textAlign: 'center' }}>
              <img src={qrPreviewUrl} alt="QR Code" style={{ maxWidth: 200, maxHeight: 200 }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
