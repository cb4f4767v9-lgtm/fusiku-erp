import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { branchesApi, usersApi, locationsApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { Plus, X, Trash2 } from 'lucide-react';
import {
  ensureAutoUpdateDefault,
  getAutoUpdateEnabled,
  setAutoUpdateEnabled
} from '../utils/autoUpdateSettings';

export function SettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
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
    phones: [] as string[]
  });

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
    branchesApi.getAll().then((r) => setBranches(r.data)).catch(() => setBranches([]));
    usersApi.getAll().then((r) => setUsers(r.data)).catch(() => setUsers([]));
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
    setBranchForm({ name: '', adminName: '', country: '', province: '', city: '', address: '', phones: [] });
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
      phones
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
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('common.failed'));
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t('settings.title')}</h1>
      </div>
      <div className="settings-sections">
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
    </div>
  );
}
