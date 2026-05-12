import { useTranslation } from 'react-i18next';
import { useBranding } from '../contexts/BrandingContext';

export default function Brand({ variant = "sidebar" }: { variant?: "sidebar" | "login" }) {
  const { t } = useTranslation();
  const { companyName, companyLogoUrl } = useBranding();
  const name = companyName?.trim() || t('brand.name');
  const logoUrl = companyLogoUrl || '/logo-icon.svg';

  if (variant === "login") {
    return (
      <div className="brand brand--login">
        <img src={logoUrl} alt={name} className="brand__logo brand__logo--login" />
        <div className="brand__name brand__name--login">{name}</div>
        <div className="brand__slogan">{t('brand.slogan')}</div>
      </div>
    );
  }

  return (
    <div className="brand brand--sidebar">
      <img src={logoUrl} alt={name} className="brand__logo" />
      <div className="brand__text">
        <div className="brand__name">{name}</div>
        <div className="brand__slogan">{t('brand.slogan')}</div>
      </div>
    </div>
  );
}