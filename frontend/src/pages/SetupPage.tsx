import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setupApi } from '../services/api';
import toast from 'react-hot-toast';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { isValidEmailStrict } from '../utils/emailValidation';

export function SetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [needsRepair, setNeedsRepair] = useState(false);
  const [repairReason, setRepairReason] = useState<string | null>(null);
  const [form, setForm] = useState({
    companyName: '',
    adminEmail: '',
    adminPassword: '',
    confirmPassword: '',
    branchName: 'Main Branch',
    currency: 'USD'
  });

  useEffect(() => {
    api.get('/setup/status').then((r) => {
      if (r.data?.setupComplete) {
        navigate('/login', { replace: true });
        return;
      }
      setNeedsRepair(Boolean(r.data?.needsRepair));
      setRepairReason(typeof r.data?.repairReason === 'string' ? r.data.repairReason : null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailNorm = form.adminEmail.trim().toLowerCase();
    if (!isValidEmailStrict(emailNorm)) {
      toast.error(t('setup.invalidEmail'));
      return;
    }
    if (form.adminPassword !== form.confirmPassword) {
      toast.error(t('setup.passwordsDoNotMatch'));
      return;
    }
    if (form.adminPassword.length < 6) {
      toast.error(t('setup.passwordMin6'));
      return;
    }
    setSubmitting(true);
    try {
      await setupApi.complete({
        companyName: form.companyName,
        adminEmail: emailNorm,
        adminPassword: form.adminPassword,
        branchName: form.branchName,
        currency: form.currency
      });
      toast.success(t('setup.setupComplete'));
      navigate('/login', { replace: true });
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('setup.setupFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading-screen">{t('setup.loading')}</div>;

  return (
    <div className="login-page">
      <LanguageSwitcher />
      <div className="login-card setup-card">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "10px" }}>
          <img src="./logo-icon.svg" alt={t('brand.name')} style={{ height: "70px", marginBottom: "4px" }} />
          <div style={{ fontSize: "30px", fontWeight: "700", letterSpacing: "1px" }}>
            {t('brand.name')}
          </div>
          <div style={{ fontSize: "14px", color: "#6b7280" }}>
            {t('brand.slogan')}
          </div>
          <h2 style={{ marginTop: 16, fontSize: 1.1 }}>{t('setup.title')}</h2>
        </div>
        {needsRepair && repairReason && (
          <div
            role="alert"
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 8,
              background: '#fef2f2',
              color: '#991b1b',
              fontSize: 13,
              lineHeight: 1.4,
            }}
          >
            <strong>{t('setup.needsRepairTitle')}</strong>
            <div style={{ marginTop: 6 }}>{repairReason}</div>
          </div>
        )}
        <form onSubmit={handleSubmit} className="login-form setup-form">
          <input
            required
            placeholder={t('setup.companyName')}
            value={form.companyName}
            onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
          />
          <input
            required
            type="email"
            placeholder={t('setup.adminEmail')}
            value={form.adminEmail}
            onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
          />
          <input
            required
            type="password"
            placeholder={t('setup.adminPassword')}
            value={form.adminPassword}
            onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))}
          />
          <input
            required
            type="password"
            placeholder={t('setup.confirmPassword')}
            value={form.confirmPassword}
            onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
          />
          <input
            placeholder={t('setup.defaultBranchName')}
            value={form.branchName}
            onChange={(e) => setForm((f) => ({ ...f, branchName: e.target.value }))}
          />
          <select
            value={form.currency}
            onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
          >
            <option value="USD">USD - US Dollar</option>
            <option value="PKR">PKR - Pakistani Rupee</option>
            <option value="CNY">CNY - Chinese Yuan</option>
            <option value="AED">AED - UAE Dirham</option>
            <option value="EUR">EUR - Euro</option>
            <option value="GBP">GBP - British Pound</option>
            <option value="SAR">SAR - Saudi Riyal</option>
            <option value="TRY">TRY - Turkish Lira</option>
            <option value="JPY">JPY - Japanese Yen</option>
          </select>
          <button type="submit" className="login-btn" disabled={submitting || needsRepair}>
            {submitting ? t('setup.settingUp') : t('setup.completeSetup')}
          </button>
        </form>
      </div>
    </div>
  );
}
