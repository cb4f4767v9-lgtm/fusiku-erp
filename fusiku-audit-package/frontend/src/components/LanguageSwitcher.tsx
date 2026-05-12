import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { getBaseLanguage } from '../utils/i18nLocale';
import { persistLanguageCode } from '../utils/i18nPersist';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../services/api';
import { readStoredAccessToken } from '../utils/authSession';

export type LanguageSwitcherPlacement = 'header' | 'sidebar';

type LanguageSwitcherProps = {
  /** `header`: dropdown opens downward; `sidebar`: opens upward (footer). */
  placement?: LanguageSwitcherPlacement;
  /** Optional Tailwind override for auth screens. */
  buttonClassName?: string;
  /** Optional Tailwind override for auth screens. */
  labelClassName?: string;
};

export function LanguageSwitcher({ placement = 'header', buttonClassName, labelClassName }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const languages = [
    { code: 'en', labelKey: 'languages.en' as const },
    { code: 'zh', labelKey: 'languages.zh' as const },
    { code: 'ar', labelKey: 'languages.ar' as const },
    { code: 'ur', labelKey: 'languages.ur' as const },
  ];

  const base = getBaseLanguage(i18n.resolvedLanguage || i18n.language);
  const active = languages.find((l) => l.code === base);

  const changeLang = (lang: string) => {
    void i18n.changeLanguage(lang);
    persistLanguageCode(lang);
    setOpen(false);
    const hasSession = !!(token || readStoredAccessToken());
    if (hasSession) {
      void authApi.updatePreferences({ language: getBaseLanguage(lang) }).catch(() => {
        /* offline / legacy */
      });
    }
  };

  const menuDirClass = placement === 'header' ? 'lang-switcher-menu--down' : 'lang-switcher-menu--up';
  const rootClass = ['lang-switcher', placement === 'header' ? 'lang-switcher--header' : 'lang-switcher--sidebar']
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={ref} className={rootClass}>
      <button
        type="button"
        className={buttonClassName || 'lang-switcher-btn'}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('languages.menuAria')}
        title={t('languages.chooseLanguage')}
      >
        {placement === 'header' ? <Globe size={16} strokeWidth={2} aria-hidden /> : null}
        <span className={labelClassName || 'lang-switcher-btn__label'}>{active ? t(active.labelKey) : t('languages.en')}</span>
      </button>

      {open ? (
        <div className={`lang-switcher-menu ${menuDirClass}`} role="menu" aria-label={t('languages.menuAria')}>
          {languages.map((l) => {
            const isActive = l.code === base;

            return (
              <button
                key={l.code}
                type="button"
                role="menuitem"
                className={`lang-switcher-item ${isActive ? 'active' : ''}`}
                onClick={() => changeLang(l.code)}
              >
                <span>{t(l.labelKey)}</span>
                {isActive ? <span className="lang-switcher-item__mark">{t('languages.selectedMark')}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
