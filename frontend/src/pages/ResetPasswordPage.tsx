import Brand from "../components/Brand";
import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { authApi } from "../services/api";
import toast from "react-hot-toast";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { getErrorMessage } from "../utils/getErrorMessage";

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) toast.error(t("auth.invalidResetLink"));
  }, [token, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error(t("auth.invalidResetLink"));
      return;
    }
    if (password.length < 6) {
      toast.error(t("auth.passwordMin6"));
      return;
    }
    if (password !== confirm) {
      toast.error(t("auth.passwordsDoNotMatch"));
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
      toast.success(t("auth.passwordUpdatedCanSignIn"));
    } catch (err: any) {
      toast.error(getErrorMessage(err, t("auth.resetFailed")));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="login-page">
        <LanguageSwitcher />
        <div className="login-card">
          <Brand variant="login" />
          <p>{t("auth.invalidResetToken")}</p>
          <Link to="/forgot-password" className="login-link">{t("auth.requestNewLink")}</Link>
          <Link to="/login" className="login-link">{t("auth.backToSignIn")}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <LanguageSwitcher />
      <div className="login-card">
        <Brand variant="login" />
        {success ? (
          <div className="forgot-sent">
            <p>{t("auth.passwordUpdatedSignIn")}</p>
            <Link to="/login" className="login-btn">{t("auth.signIn")}</Link>
          </div>
        ) : (
          <>
            <h2 className="forgot-title">{t("auth.setNewPassword")}</h2>
            <form onSubmit={handleSubmit} className="login-form">
              <input
                type="password"
                placeholder={t("auth.newPassword")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={loading}
              />
              <input
                type="password"
                placeholder={t("auth.confirmPassword")}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                disabled={loading}
              />
              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? t("auth.updating") : t("auth.updatePassword")}
              </button>
            </form>
            <Link to="/login" className="login-link">{t("auth.backToSignIn")}</Link>
          </>
        )}
      </div>
    </div>
  );
}
