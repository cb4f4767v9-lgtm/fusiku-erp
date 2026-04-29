import Brand from "../components/Brand";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { authApi, MissingCompanyIdError } from "../services/api";
import toast from "react-hot-toast";
import { getErrorMessage } from "../utils/getErrorMessage";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error(t("auth.enterEmail"));
      return;
    }
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
      toast.success(t("auth.resetLinkSent"));
    } catch (err: unknown) {
      if (err instanceof MissingCompanyIdError) {
        toast.error(t("login.missingCompanyId"));
        return;
      }
      toast.error(getErrorMessage(err, t("common.somethingWentWrong")));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <LanguageSwitcher />
      <div className="login-card">
        <Brand variant="login" />
        {sent ? (
          <div className="forgot-sent">
            <p>{t("auth.checkEmail")}</p>
            <Link to="/login" className="login-link">{t("auth.backToSignIn")}</Link>
          </div>
        ) : (
          <>
            <h2 className="forgot-title">{t("auth.forgotPasswordTitle")}</h2>
            <p className="forgot-desc">{t("auth.forgotPasswordDesc")}</p>
            <form onSubmit={handleSubmit} className="login-form">
              <input
                type="email"
                placeholder={t("auth.email")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={loading}
              />
              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? t("auth.sending") : t("auth.sendResetLink")}
              </button>
            </form>
            <Link to="/login" className="login-link">{t("auth.backToSignIn")}</Link>
          </>
        )}
      </div>
    </div>
  );
}
