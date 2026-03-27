import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '../services/api';
import toast from 'react-hot-toast';

const MIN_PASSWORD_LENGTH = 8;

export function ChangePasswordPage() {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error(t('changePassword.pleaseFillFields'));
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast.error(t('changePassword.minLengthError', { count: MIN_PASSWORD_LENGTH }));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t('changePassword.passwordsNoMatch'));
      return;
    }

    setLoading(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      toast.success(t('changePassword.passwordUpdated'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('changePassword.updateFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <h1 className="page-title">{t('changePassword.title')}</h1>
      <section className="settings-card">
        <h2>{t('changePassword.updateYourPassword')}</h2>
        <form onSubmit={handleSubmit} className="change-password-form">
          <div className="form-row form-row-vertical">
            <label htmlFor="current-password">{t('changePassword.currentPassword')}</label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t('changePassword.enterCurrentPassword')}
              autoComplete="current-password"
              disabled={loading}
            />
          </div>
          <div className="form-row form-row-vertical">
            <label htmlFor="new-password">{t('changePassword.newPassword')}</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('changePassword.minCharacters')}
              autoComplete="new-password"
              disabled={loading}
            />
          </div>
          <div className="form-row form-row-vertical">
            <label htmlFor="confirm-password">{t('changePassword.confirmPassword')}</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('changePassword.confirmNewPassword')}
              autoComplete="new-password"
              disabled={loading}
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
              {loading ? t('changePassword.updating') : t('changePassword.updatePassword')}
            </button>
            <Link to="/settings" className="btn btn-secondary">
              {t('common.cancel')}
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
