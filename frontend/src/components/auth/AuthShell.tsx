import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { applyTheme, getInitialTheme } from '../../utils/theme';

export function AuthShell({
  children,
  overflow = 'hidden',
}: {
  children: React.ReactNode;
  overflow?: 'hidden' | 'auto' | 'visible';
}) {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    applyTheme(getInitialTheme());
  }, []);

  const isRTL = useMemo(() => {
    const code = (i18n.language || 'en').split('-')[0].toLowerCase();
    return ['ar', 'ur'].includes(code);
  }, [i18n.language]);

  return (
    <div
      className={`relative min-h-screen w-full overflow-x-hidden ${
        overflow === 'auto' ? 'overflow-y-auto' : overflow === 'visible' ? 'overflow-visible' : 'overflow-hidden'
      } bg-gradient-to-br from-[#bfe3ff] via-[#cfe9ff] to-[#efe9ff] text-white dark:from-[#0b1025] dark:via-[#111a3a] dark:to-[#2b1b5a]`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="fixed top-6 right-8 z-50 flex items-center gap-3">
        <ThemeToggle variant="switch" compact />
        <LanguageSwitcher />
      </div>

      {/* CONTENT */}
      <div className="relative z-10 h-full w-full">{children}</div>

      {/* Footer — login/signup/setup/pricing (premium branding, left-aligned) */}
      <div className="auth-shell-brand-footer fixed bottom-4 left-6 z-50 flex select-none items-center gap-[7px] text-left">
        <span className="brand-powered-mark" aria-hidden />
        <span>{t('brand.poweredBy')}</span>
      </div>
    </div>
  );
}
