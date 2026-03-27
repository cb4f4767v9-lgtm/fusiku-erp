import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { setupApi } from "../services/api";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import toast from "react-hot-toast";

export function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setupApi
      .getStatus()
      .then((r) => {
        if (!r.data?.setupComplete) {
          navigate("/setup", { replace: true });
        }
      })
      .catch(() => {});
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error(t('auth.pleaseFillFields'));
      return;
    }

    setLoading(true);

    try {
      await login(email, password);
      toast.success(t('auth.welcomeBack'));
      navigate("/");
    } catch (err: any) {
      const status = err.response?.status;
      const msg = err.response?.data?.error || t('auth.loginFailed');
      if (status === 403) {
        toast.error(t('auth.accountConfigError'));
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <LanguageSwitcher />
      <div className="login-card">
      <div className="login-brand-block">
  <img
    src="./logo-vertical.svg"
    alt="Fusiku"
    style={{ height: "140px", marginBottom: "10px" }}
  />
</div>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="email"
            placeholder={t('auth.email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={loading}
          />

          <input
            type="password"
            placeholder={t('auth.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={loading}
          />

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? t('auth.signingIn') : t('auth.signIn')}
          </button>

          <Link to="/forgot-password" className="login-link">{t('auth.forgotPassword')}</Link>
        </form>
        <div className="login-footer">
          <div className="powered-by" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", opacity: "0.6", marginTop: "20px" }}>
            <img src="./logo-icon.svg" alt="" style={{ height: "14px" }} />
            <span style={{ fontSize: "12px" }}>{t('brand.poweredBy')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}