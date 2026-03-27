import { useTranslation } from "react-i18next";

export default function Brand({ variant = "sidebar" }: { variant?: "sidebar" | "login" }) {
  const { t } = useTranslation();

  if (variant === "login") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "10px" }}>
        <img src="./logo-icon.svg" alt={t('brand.name')} style={{ height: "70px", marginBottom: "4px" }} />
        <div style={{ fontSize: "30px", fontWeight: "700", letterSpacing: "1px" }}>
          {t('brand.name')}
        </div>
        <div style={{ fontSize: "14px", color: "#6b7280" }}>
          {t('brand.slogan')}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <img src="./logo-icon.svg" alt={t('brand.name')} style={{ height: "42px" }} />
      <div>
        <div style={{ fontWeight: "700", fontSize: "16px" }}>
          {t('brand.name')}
        </div>
        <div style={{ fontSize: "11px", color: "#6b7280" }}>
          {t('brand.slogan')}
        </div>
      </div>
    </div>
  );
}