import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { branchesApi, usersApi, locationsApi, companyApi, uploadApi } from '../services/api';
import { publicAssetUrl } from '../config/appConfig';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { Plus, X, Trash2 } from 'lucide-react';
import { getErrorMessage } from '../utils/getErrorMessage';
import { PageLayout, PageHeader } from '../components/design-system';
import {
  ensureAutoUpdateDefault,
  getAutoUpdateEnabled,
  setAutoUpdateEnabled
} from '../utils/autoUpdateSettings';
import {
  getBillingCompanyName,
  getCurrentBillingPlanId,
  getTrialCalendarDaysRemaining,
  getTrialUiState,
  isTrialActive
} from '../utils/billingUi';
import {
  BILLING_SALES_EMAIL,
  getBillingMailtoProHref,
  getBillingWhatsAppHref
} from '../config/billingContact';

export function SettingsPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const { user } = useAuth();
  const billingCompany = getBillingCompanyName();
  const billingPlan = getCurrentBillingPlanId();
  const billingTrial = isTrialActive();
  const trialState = getTrialUiState();
  const trialDays = getTrialCalendarDaysRemaining();
  const [, setTrialTick] = useState(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [countries, setCountries] = useState<{ isoCode: string; name: string }[]>([]);
  const [provinces, setProvinces] = useState<{ isoCode: string; name: string }[]>([]);
  const [cities, setCities] = useState<{ name: string }[]>([]);
  const [branchForm, setBranchForm] = useState({
    name: '',
    adminName: '',
    country: '',
    province: '',
    city: '',
    address: '',
    phones: [] as string[],
    logo: '' as string
  });

  const [companyForm, setCompanyForm] = useState({
    name: '',
    email: '',
    phone: '',
    logo: '' as string
  });
  const [companySaving, setCompanySaving] = useState(false);

  const [autoUpdate, setAutoUpdate] = useState(() => {
    ensureAutoUpdateDefault();
    return getAutoUpdateEnabled();
  });

  useEffect(() => {
    const onChange = () => setAutoUpdate(getAutoUpdateEnabled());
    window.addEventListener('fusiku-auto-update-changed', onChange);
    return () => window.removeEventListener('fusiku-auto-update-changed', onChange);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTrialTick((n) => n + 1), 30 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (location.hash !== '#billing-plans-section') return;
    const tid = window.setTimeout(() => {
      document.getElementById('billing-plans-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
    return () => window.clearTimeout(tid);
  }, [location.hash]);

  useEffect(() => {
    branchesApi.getAll().then((r) => setBranches(r.data)).catch(() => setBranches([]));
    usersApi.getAll().then((r) => setUsers(r.data)).catch(() => setUsers([]));
    companyApi
      .getProfile()
      .then((r) => {
        const p = r.data;
        if (p) {
          setCompanyForm({
            name: p.name || '',
            email: p.email || '',
            phone: p.phone || '',
            logo: p.logo || ''
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    locationsApi.getCountries().then((r) => setCountries(r.data)).catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    if (branchForm.country) {
      locationsApi.getProvinces(branchForm.country).then((r) => setProvinces(r.data)).catch(() => setProvinces([]));
    } else setProvinces([]);
    setBranchForm((f) => ({ ...f, province: '', city: '' }));
  }, [branchForm.country]);

  useEffect(() => {
    if (branchForm.country && branchForm.province) {
      locationsApi.getCities(branchForm.country, branchForm.province).then((r) => setCities(r.data)).catch(() => setCities([]));
    } else if (branchForm.country) {
      locationsApi.getCities(branchForm.country).then((r) => setCities(r.data)).catch(() => setCities([]));
    } else setCities([]);
    setBranchForm((f) => ({ ...f, city: '' }));
  }, [branchForm.country, branchForm.province]);

  const addPhone = () => setBranchForm((f) => ({ ...f, phones: [...f.phones, ''] }));
  const removePhone = (idx: number) => setBranchForm((f) => ({ ...f, phones: f.phones.filter((_, i) => i !== idx) }));
  const updatePhone = (idx: number, v: string) =>
    setBranchForm((f) => ({ ...f, phones: f.phones.map((p, i) => (i === idx ? v : p)) }));

  const resetBranchForm = () => {
    setBranchForm({ name: '', adminName: '', country: '', province: '', city: '', address: '', phones: [], logo: '' });
    setEditingBranchId(null);
  };

  const openEditBranch = (b: any) => {
    const phones = (b.contacts || []).filter((c: any) => c.contactType === 'phone').map((c: any) => c.value);
    if (phones.length === 0 && b.phone) phones.push(b.phone);
    setBranchForm({
      name: b.name,
      adminName: b.adminName || '',
      country: b.country || '',
      province: b.province || '',
      city: b.city || '',
      address: b.address || '',
      phones,
      logo: b.logo || ''
    });
    setEditingBranchId(b.id);
    setShowBranchForm(true);
  };

  const handleBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchForm.name) {
      toast.error(t('settings.branchNameRequired'));
      return;
    }
    try {
      const phones = branchForm.phones.filter((p) => p.trim()).map((v) => v.trim());
      const payload = {
        name: branchForm.name,
        adminName: branchForm.adminName || undefined,
        phone: phones[0] || undefined,
        country: branchForm.country || undefined,
        province: branchForm.province || undefined,
        city: branchForm.city || undefined,
        address: branchForm.address || undefined,
        logo: branchForm.logo || undefined,
        contacts: phones.map((value) => ({ contactType: 'phone', value }))
      };
      if (editingBranchId) {
        await branchesApi.update(editingBranchId, payload);
        toast.success(t('settings.branchUpdated'));
      } else {
        await branchesApi.create(payload);
        toast.success(t('settings.branchAdded'));
      }
      setShowBranchForm(false);
      resetBranchForm();
      branchesApi.getAll().then((r) => setBranches(r.data)).catch(() => {});
      window.dispatchEvent(new Event('fusiku-branding-refresh'));
    } catch (err: any) {
      toast.error(getErrorMessage(err, t('common.failed')));
    }
  };

  const handleCompanyLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { data } = await uploadApi.uploadBranding(file);
      const url = (data as any)?.url as string;
      if (url) setCompanyForm((f) => ({ ...f, logo: url }));
      toast.success(t('settings.logoUploaded'));
    } catch {
      toast.error(t('common.failed'));
    }
  };

  const handleBranchLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { data } = await uploadApi.uploadBranding(file);
      const url = (data as any)?.url as string;
      if (url) setBranchForm((f) => ({ ...f, logo: url }));
      toast.success(t('settings.logoUploaded'));
    } catch {
      toast.error(t('common.failed'));
    }
  };

  const handleCompanyProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyForm.name.trim()) {
      toast.error(t('settings.branchNameRequired'));
      return;
    }
    setCompanySaving(true);
    try {
      await companyApi.updateProfile({
        name: companyForm.name.trim(),
        email: companyForm.email.trim() || null,
        phone: companyForm.phone.trim() || null,
        logo: companyForm.logo || null
      });
      toast.success(t('settings.companyProfileSaved'));
      window.dispatchEvent(new Event('fusiku-branding-refresh'));
    } catch (err: any) {
      toast.error(getErrorMessage(err, t('common.failed')));
    } finally {
      setCompanySaving(false);
    }
  };

  const trialCountdownText =
    trialState === 'active' && trialDays !== null
      ? trialDays <= 0
        ? t('billing.trialEndsToday')
        : trialDays === 1
          ? t('billing.trialEndsOneDay')
          : t('billing.trialEndsInDays', { count: trialDays })
      : null;

  return (
    <PageLayout className="page">
      <PageHeader title={t('settings.title')} />
      <div className="settings-sections">
        <section className="settings-card billing-account-card">
          <h2>{t('billing.accountSection')}</h2>
          <dl className="billing-account-dl">
            <div>
              <dt>{t('billing.companyName')}</dt>
              <dd>{billingCompany || '—'}</dd>
            </div>
            <div>
              <dt>{t('settings.email')}</dt>
              <dd>{user?.email || '—'}</dd>
            </div>
            <div>
              <dt>{t('billing.plan')}</dt>
              <dd>
                <span className="billing-plan-pill">
                  {billingPlan === 'free' ? t('billing.planFree') : t('billing.planPro')}
                </span>
                {billingTrial && (
                  <span className="billing-trial-pill">{t('billing.trialActive')}</span>
                )}
                {trialState === 'expired' && (
                  <span className="billing-trial-pill billing-trial-pill--ended">{t('billing.trialEnded')}</span>
                )}
              </dd>
            </div>
          </dl>
          {trialCountdownText && (
            <p className="billing-trial-countdown" role="status">
              {trialCountdownText}
            </p>
          )}
          {trialState === 'expired' && (
            <div className="billing-trial-expired-inline" role="alert">
              <p className="billing-trial-expired-inline__title">{t('billing.trialExpiredTitle')}</p>
              <p className="billing-trial-expired-inline__body">{t('billing.trialExpiredBodyShort')}</p>
              <div className="billing-trial-expired-inline__actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowContactModal(true)}>
                  {t('billing.contactForPro')}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => document.getElementById('billing-plans-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >
                  {t('billing.trialSeePlans')}
                </button>
              </div>
            </div>
          )}
          <p className="settings-hint billing-account-hint">{t('billing.accountHint')}</p>
        </section>

        <section className="settings-card billing-plans-card" id="billing-plans-section">
          <h2>{t('billing.plansTitle')}</h2>
          <p className="settings-hint billing-plans-intro">{t('billing.plansIntro')}</p>
          <div className="billing-plan-grid">
            <div className="billing-plan-tile billing-plan-tile--current">
              <div className="billing-plan-tile__head">
                <h3>{t('billing.planFree')}</h3>
                <span className="billing-plan-badge">{t('billing.currentPlan')}</span>
              </div>
              <ul className="billing-plan-features">
                <li>{t('billing.freeFeat1')}</li>
                <li>{t('billing.freeFeat2')}</li>
                <li>{t('billing.freeFeat3')}</li>
              </ul>
            </div>
            <div className="billing-plan-tile billing-plan-tile--pro">
              <div className="billing-plan-tile__head">
                <h3>{t('billing.planPro')}</h3>
                <span className="billing-plan-badge billing-plan-badge--muted">{t('billing.comingSoon')}</span>
              </div>
              <ul className="billing-plan-features">
                <li>{t('billing.proFeat1')}</li>
                <li>{t('billing.proFeat2')}</li>
                <li>{t('billing.proFeat3')}</li>
              </ul>
              <p className="billing-plan-footnote">{t('billing.proFootnote')}</p>
              <div className="billing-pro-actions">
                <button
                  type="button"
                  className="btn btn-primary billing-upgrade-btn billing-upgrade-btn--inline"
                  onClick={() => setShowUpgradeModal(true)}
                >
                  {t('billing.upgradeToPro')}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary billing-upgrade-btn billing-upgrade-btn--inline"
                  onClick={() => setShowContactModal(true)}
                >
                  {t('billing.contactForPro')}
                </button>
              </div>
            </div>
          </div>
          <div className="billing-why-upgrade">
            <h3 className="billing-why-upgrade__title">{t('billing.whyUpgradeTitle')}</h3>
            <ul className="billing-why-upgrade__list">
              <li>{t('billing.whyUpgrade1')}</li>
              <li>{t('billing.whyUpgrade2')}</li>
              <li>{t('billing.whyUpgrade3')}</li>
            </ul>
          </div>
        </section>

        <section className="settings-card">
          <h2>{t('settings.companyBranding')}</h2>
          <p className="settings-hint">{t('settings.companyBrandingHint')}</p>
          <form onSubmit={handleCompanyProfileSave} className="stack-form" style={{ marginTop: 12 }}>
            <label>
              {t('settings.companyNameField')} *
              <input
                required
                value={companyForm.name}
                onChange={(e) => setCompanyForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label>
              {t('settings.companyPhone')}
              <input value={companyForm.phone} onChange={(e) => setCompanyForm((f) => ({ ...f, phone: e.target.value }))} />
            </label>
            <label>
              {t('settings.companyEmailField')}
              <input type="email" value={companyForm.email} onChange={(e) => setCompanyForm((f) => ({ ...f, email: e.target.value }))} />
            </label>
            <label>
              {t('settings.companyLogo')}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {companyForm.logo ? (
                  <img src={publicAssetUrl(companyForm.logo) || ''} alt="" style={{ maxHeight: 48, maxWidth: 120, objectFit: 'contain' }} />
                ) : null}
                <input type="file" accept="image/*" onChange={handleCompanyLogoUpload} />
              </div>
            </label>
            <button type="submit" className="btn btn-primary" disabled={companySaving}>
              {t('settings.saveCompanyProfile')}
            </button>
          </form>
        </section>

        <section className="settings-card">
          <h2>{t('settings.appUpdates')}</h2>
          <label className="settings-toggle-row">
            <input
              type="checkbox"
              checked={autoUpdate}
              onChange={(e) => {
                const next = e.target.checked;
                setAutoUpdate(next);
                setAutoUpdateEnabled(next);
              }}
            />
            <span>{t('settings.autoUpdate')}</span>
          </label>
          <p className="settings-hint">{t('settings.autoUpdateHint')}</p>
        </section>
        <section className="settings-card">
          <h2>{t('settings.profile')}</h2>
          <p><strong>{t('settings.name')}:</strong> {user?.name}</p>
          <p><strong>{t('settings.email')}:</strong> {user?.email}</p>
          <p><strong>{t('settings.role')}:</strong> {user?.role}</p>
          <p><strong>{t('settings.branch')}:</strong> {user?.branch || '—'}</p>
          <p><Link to="/change-password" className="btn btn-sm" style={{ marginTop: 8 }}>{t('settings.changePassword')}</Link></p>
          <p>
            <Link to="/settings/translations" className="btn btn-sm" style={{ marginTop: 8 }}>
              {t('developer.translations', { defaultValue: 'Translations' })}
            </Link>
          </p>
        </section>
        <section className="settings-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2>{t('settings.branches')}</h2>
            <button className="btn btn-primary btn-sm" onClick={() => { resetBranchForm(); setShowBranchForm(true); }}>
              <Plus size={16} /> {t('settings.addBranch')}
            </button>
          </div>
          <ul>
            {branches.map((b) => (
              <li key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span>{b.name} — {b.adminName || '—'} — {b.address || [b.city, b.province].filter(Boolean).join(', ') || '—'}</span>
                <button className="btn btn-sm" onClick={() => openEditBranch(b)}>{t('common.edit')}</button>
              </li>
            ))}
          </ul>
        </section>
        <section className="settings-card">
          <h2>{t('settings.users')}</h2>
          <ul>
            {users.map((u) => (
              <li key={u.id}>{u.name} ({u.email}) — {u.role?.name}</li>
            ))}
          </ul>
        </section>
      </div>

      {showUpgradeModal && (
        <div className="modal-overlay" onClick={() => setShowUpgradeModal(false)}>
          <div className="modal billing-upgrade-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="upgrade-modal-title">
            <div className="modal-header">
              <h2 id="upgrade-modal-title">{t('billing.upgradeModalTitle')}</h2>
              <button type="button" onClick={() => setShowUpgradeModal(false)} aria-label={t('common.close')}>
                <X size={20} />
              </button>
            </div>
            <p className="billing-upgrade-modal__body">{t('billing.upgradeModalBody')}</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-primary" onClick={() => setShowUpgradeModal(false)}>
                {t('billing.upgradeModalClose')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showContactModal && (
        <div className="modal-overlay" onClick={() => setShowContactModal(false)}>
          <div className="modal billing-contact-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="contact-modal-title">
            <div className="modal-header">
              <h2 id="contact-modal-title">{t('billing.contactModalTitle')}</h2>
              <button type="button" onClick={() => setShowContactModal(false)} aria-label={t('common.close')}>
                <X size={20} />
              </button>
            </div>
            <p className="billing-contact-modal__intro">{t('billing.contactModalIntro')}</p>
            <p className="billing-contact-modal__message">
              {t('billing.contactModalMessage', { email: BILLING_SALES_EMAIL })}
            </p>
            <div className="billing-contact-modal__channels">
              <a className="btn btn-primary" href={getBillingMailtoProHref()}>
                {t('billing.contactModalEmailCta')}
              </a>
              {getBillingWhatsAppHref() ? (
                <a
                  className="btn btn-secondary"
                  href={getBillingWhatsAppHref()!}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('billing.contactModalWhatsappCta')}
                </a>
              ) : (
                <p className="settings-hint billing-contact-modal__wa-note">{t('billing.contactModalWhatsappNote')}</p>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowContactModal(false)}>
                {t('billing.contactModalClose')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBranchForm && (
        <div className="modal-overlay" onClick={() => { setShowBranchForm(false); resetBranchForm(); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingBranchId ? t('settings.editBranch') : t('settings.addBranch')}</h2>
              <button onClick={() => { setShowBranchForm(false); resetBranchForm(); }}><X size={20} /></button>
            </div>
            <form onSubmit={handleBranchSubmit} className="modal-form">
              <label>
                {t('settings.branchName')} *
                <input required placeholder={t('settings.branchName')} value={branchForm.name} onChange={(e) => setBranchForm((f) => ({ ...f, name: e.target.value }))} />
              </label>
              <label>
                {t('settings.adminName')}
                <input placeholder={t('settings.adminName')} value={branchForm.adminName} onChange={(e) => setBranchForm((f) => ({ ...f, adminName: e.target.value }))} />
              </label>
              <label>
                {t('settings.branchLogo')}
                <p className="settings-hint" style={{ margin: '4px 0 8px' }}>{t('settings.branchLogoHint')}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {branchForm.logo ? (
                    <img src={publicAssetUrl(branchForm.logo) || ''} alt="" style={{ maxHeight: 40, maxWidth: 100, objectFit: 'contain' }} />
                  ) : null}
                  <input type="file" accept="image/*" onChange={handleBranchLogoUpload} />
                </div>
              </label>
              <div className="form-section">
                <h4>{t('suppliers.address')}</h4>
                <label>
                  {t('suppliers.country')}
                  <select value={branchForm.country} onChange={(e) => setBranchForm((f) => ({ ...f, country: e.target.value }))}>
                    <option value="">{t('common.selectPlaceholder')}</option>
                    {countries.map((c) => <option key={c.isoCode} value={c.isoCode}>{c.name}</option>)}
                  </select>
                </label>
                <label>
                  {t('suppliers.province')}
                  <select value={branchForm.province} onChange={(e) => setBranchForm((f) => ({ ...f, province: e.target.value }))}>
                    <option value="">{t('common.selectPlaceholder')}</option>
                    {provinces.map((p) => <option key={p.isoCode} value={p.isoCode}>{p.name}</option>)}
                  </select>
                </label>
                <label>
                  {t('suppliers.city')}
                  <select value={branchForm.city} onChange={(e) => setBranchForm((f) => ({ ...f, city: e.target.value }))}>
                    <option value="">{t('common.selectPlaceholder')}</option>
                    {cities.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </label>
                <label>
                  {t('suppliers.street')}
                  <input placeholder={t('suppliers.street')} value={branchForm.address} onChange={(e) => setBranchForm((f) => ({ ...f, address: e.target.value }))} />
                </label>
              </div>
              <div className="form-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h4>{t('settings.phones')}</h4>
                  <button type="button" className="btn btn-sm" onClick={addPhone}><Plus size={16} /> {t('settings.addPhone')}</button>
                </div>
                {branchForm.phones.map((p, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input placeholder={t('suppliers.phone')} value={p} onChange={(e) => updatePhone(idx, e.target.value)} style={{ flex: 1 }} />
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => removePhone(idx)}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowBranchForm(false); resetBranchForm(); }}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary">{editingBranchId ? t('common.update') : t('common.add')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
