import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { customersApi, locationsApi, uploadApi } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, QrCode, X, User, MapPin, MessageCircle, Wallet } from 'lucide-react';
import { CountrySearchSelect } from '../components/CountrySearchSelect';
import { locationCache } from '../utils/locationCache';
import { getErrorMessage } from '../utils/getErrorMessage';
import { PageLayout } from '../components/design-system';
import { getBackendOrigin } from '../config/appConfig';

const CONTACT_TYPES = ['Mobile', 'Landline', 'WhatsApp', 'WeChat', 'Facebook'] as const;
const QR_ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp';
const QR_MAX_SIZE = 2 * 1024 * 1024;

type CustomerContact = { id?: string; contactType: string; value: string; qrCodeUrl?: string };

function contactTypeKey(ct: string) {
  return String(ct || '').trim().toLowerCase().replace(/\s+/g, '');
}

function normalizeContactType(input: string): (typeof CONTACT_TYPES)[number] {
  const v = String(input || '').trim().toLowerCase();
  if (v === 'mobile') return 'Mobile';
  if (v === 'landline') return 'Landline';
  if (v === 'phone') return 'Mobile';
  if (v === 'whatsapp') return 'WhatsApp';
  if (v === 'wechat') return 'WeChat';
  if (v === 'facebook') return 'Facebook';
  if (v === 'whats app') return 'WhatsApp';
  if (v === 'we chat') return 'WeChat';
  if (v === 'fb') return 'Facebook';
  return 'Mobile';
}

export function CustomerFormPage() {
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
    phone: '',
    country: '',
    province: '',
    city: '',
    address: '',
    advanceReceived: 0,
    creditBalance: 0,
    blockedAmount: 0,
    status: 'available' as 'available' | 'blocked',
    contacts: [] as CustomerContact[]
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
      customersApi.getById(id).then((r) => {
        const c = r.data;
        const opening = Number(c.openingBalance) || 0;
        const balType = String(c.balanceType || 'debit');
        const status = (c.moneyStatus === 'blocked' ? 'blocked' : 'available') as 'available' | 'blocked';
        setForm({
          name: c.name,
          email: c.email || '',
          phone: c.phone || '',
          country: c.country || '',
          province: c.province || '',
          city: c.city || '',
          address: c.address || '',
          advanceReceived: status === 'available' && balType !== 'credit' ? opening : 0,
          creditBalance: status === 'available' && balType === 'credit' ? opening : 0,
          blockedAmount: status === 'blocked' ? opening : 0,
          status,
          contacts: (c.contacts || []).map((x: any) => ({ id: x.id, contactType: normalizeContactType(x.contactType), value: x.value, qrCodeUrl: x.qrCodeUrl || '' }))
        });
      }).catch(() => navigate('/customers'));
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

  const addContact = () => setForm((f) => ({ ...f, contacts: [...f.contacts, { contactType: 'Mobile', value: '', qrCodeUrl: '' }] }));
  const removeContact = (idx: number) => setForm((f) => ({ ...f, contacts: f.contacts.filter((_, i) => i !== idx) }));
  const updateContact = (idx: number, field: keyof CustomerContact, value: string) =>
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
      const base = getBackendOrigin() || window.location.origin;
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
      toast.error(t('customers.nameRequired'));
      return;
    }
    setLoading(true);
    try {
      const status = form.status;
      const blockedAmount = Number(form.blockedAmount) || 0;
      const creditBalance = Number(form.creditBalance) || 0;
      const advanceReceived = Number(form.advanceReceived) || 0;
      const openingBalance =
        status === 'blocked'
          ? blockedAmount
          : creditBalance > 0
            ? creditBalance
            : advanceReceived;
      const balanceType = status === 'blocked' ? 'debit' : (creditBalance > 0 ? 'credit' : 'debit');

      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        country: form.country || undefined,
        province: form.province || undefined,
        city: form.city || undefined,
        address: form.address.trim() || undefined,
        openingBalance: Number(openingBalance) || 0,
        balanceType,
        moneyStatus: status,
        contacts: form.contacts
          .filter((c) => c.value.trim())
          .map((c) => ({ contactType: normalizeContactType(c.contactType), value: c.value.trim(), qrCodeUrl: c.qrCodeUrl || undefined }))
      };
      if (isEdit) {
        await customersApi.update(id!, payload);
        toast.success(t('customers.customerUpdated'));
      } else {
        await customersApi.create(payload);
        toast.success(t('customers.customerAdded'));
      }
      navigate('/customers');
    } catch (err: any) {
      toast.error(getErrorMessage(err, t('common.failed')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout className="page erp-form-page erp-form-compact">
      <div className="erp-form-header">
        <div />
        <div className="erp-form-actions">
          <button type="button" className="btn btn-secondary btn-erp" onClick={() => navigate('/customers')}>{t('common.cancel')}</button>
          <button type="submit" form="customer-form" className="btn btn-primary btn-erp" disabled={loading}>{t('common.save')}</button>
        </div>
      </div>

      <form id="customer-form" onSubmit={handleSubmit} className="erp-form-sections">
        <section className="erp-section erp-section-compact mb-6">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><User size={16} /> {t('erp.basicInformation')}</h3>
          <div className="erp-field-grid erp-field-grid-compact">
            <div className="erp-field-row">
              <label>{t('customers.name')} *</label>
              <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="erp-input-compact" />
            </div>
            <div className="erp-field-row">
              <label>{t('common.email')}</label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="erp-input-compact" />
            </div>
            <div className="erp-field-row">
              <label>{t('common.phone')}</label>
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="erp-input-compact" />
            </div>
          </div>
        </section>

        <section className="erp-section erp-section-compact mb-6">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><MapPin size={16} /> {t('erp.address')}</h3>
          <div className="erp-field-grid erp-field-grid-compact">
            <div className="erp-field-row">
              <label htmlFor="customer-country-select">{t('suppliers.country')}</label>
              <CountrySearchSelect
                id="customer-country-select"
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
              <select value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value, city: '' }))} className="erp-input-compact">
                <option value="">{t('common.selectPlaceholder')}</option>
                {provinces.map((p) => (
                  <option key={p.isoCode} value={p.isoCode}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="erp-field-row">
              <label>{t('suppliers.city')}</label>
              <select value={form.city} disabled={!form.province} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="erp-input-compact">
                <option value="">{t('common.selectPlaceholder')}</option>
                {cities.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="erp-field-row">
              <label>{t('suppliers.street')}</label>
              <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="erp-input-compact" />
            </div>
          </div>
        </section>

        <section className="erp-section erp-section-compact mb-6">
          <div className="erp-section-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}><MessageCircle size={16} /> {t('erp.contacts')}</h3>
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
                        <option key={ct} value={ct}>
                          {t(`contactTypes.${contactTypeKey(ct)}`, ct)}
                        </option>
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
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Wallet size={16} /> {t('erp.financial')}</h3>
          <div className="erp-field-grid erp-field-grid-compact">
            <div className="erp-field-row">
              <label>{t('erp.advance_received')}</label>
              <input type="number" step="0.01" min={0} value={form.advanceReceived} onChange={(e) => setForm((f) => ({ ...f, advanceReceived: Number(e.target.value) || 0 }))} className="erp-input-compact" />
            </div>
            <div className="erp-field-row">
              <label>{t('erp.credit_balance')}</label>
              <input type="number" step="0.01" min={0} value={form.creditBalance} onChange={(e) => setForm((f) => ({ ...f, creditBalance: Number(e.target.value) || 0 }))} className="erp-input-compact" />
            </div>
            <div className="erp-field-row">
              <label>{t('erp.blocked_amount')}</label>
              <input type="number" step="0.01" min={0} value={form.blockedAmount} onChange={(e) => setForm((f) => ({ ...f, blockedAmount: Number(e.target.value) || 0 }))} className="erp-input-compact" />
            </div>
            <div className="erp-field-row">
              <label>{t('common.status')}</label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'available' | 'blocked' }))} className="erp-input-compact">
                <option value="available">{t('common.active')}</option>
                <option value="blocked">{t('common.blocked')}</option>
              </select>
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
    </PageLayout>
  );
}
