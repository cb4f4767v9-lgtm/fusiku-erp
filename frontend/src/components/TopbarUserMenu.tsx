import { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useBranding } from '../contexts/BrandingContext';
import { sanitizeDisplayLabel } from '../utils/displayLabel';
import { User, Settings, Key, LogOut, ChevronDown, Globe, Check } from 'lucide-react';
import { getBaseLanguage } from '../utils/i18nLocale';
import { persistLanguageCode } from '../utils/i18nPersist';
import { authApi } from '../services/api';
import { readStoredAccessToken } from '../utils/authSession';

export function TopbarUserMenu() {
  const { t, i18n } = useTranslation();
  const { user, logout, token } = useAuth();
  const { companyName } = useBranding();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [langExpanded, setLangExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /**
   * Top-bar clutter is reduced by collapsing the language picker into this
   * dropdown. We avoid mounting a second `<LanguageSwitcher>` (with its own
   * outside-click handler etc.) — the language list is inlined here as menu
   * rows for cleaner keyboard navigation.
   */
  const languages = useMemo(
    () => [
      { code: 'en', labelKey: 'languages.en' as const },
      { code: 'zh', labelKey: 'languages.zh' as const },
      { code: 'ar', labelKey: 'languages.ar' as const },
      { code: 'ur', labelKey: 'languages.ur' as const },
    ],
    []
  );
  const activeLangCode = getBaseLanguage(i18n.resolvedLanguage || i18n.language);
  const activeLang = languages.find((l) => l.code === activeLangCode) ?? languages[0];

  const changeLang = (lang: string) => {
    void i18n.changeLanguage(lang);
    persistLanguageCode(lang);
    setLangExpanded(false);
    setOpen(false);
    const hasSession = !!(token || readStoredAccessToken());
    if (hasSession) {
      void authApi.updatePreferences({ language: getBaseLanguage(lang) }).catch(() => {
        /* offline / legacy — preference is local-only in that case */
      });
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate('/login');
  };

  const displayName = useMemo(() => {
    const fromName = sanitizeDisplayLabel(user?.name);
    const fromCompany = sanitizeDisplayLabel(companyName);
    const fromEmail = sanitizeDisplayLabel(user?.email?.split('@')[0]);
    const fromRole = sanitizeDisplayLabel(user?.role);
    return fromName || fromCompany || fromEmail || fromRole || '';
  }, [user?.name, user?.email, user?.role, companyName]);

  return (
    <div ref={ref} className="topbar-user-wrap">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="topbar-user-trigger"
        aria-label={displayName || t('auth.profile')}
      >
        {displayName ? (
          <span className="topbar-user-trigger__label">{displayName}</span>
        ) : (
          <User size={18} strokeWidth={2} aria-hidden className="topbar-user-trigger__icon-only" />
        )}
        <ChevronDown size={16} aria-hidden className="topbar-user-trigger__chevron" />
      </button>

      {open && (
        <div className="topbar-user-dropdown-panel">
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
          >
            <User size={16} />
            <span>{t('auth.profile')}</span>
          </Link>

          <Link
            to="/change-password"
            onClick={() => setOpen(false)}
          >
            <Key size={16} />
            <span>{t('auth.changePassword')}</span>
          </Link>

          <Link
            to="/settings"
            onClick={() => setOpen(false)}
          >
            <Settings size={16} />
            <span>{t('nav.settings')}</span>
          </Link>

          <button
            type="button"
            className="topbar-user-menu-row"
            aria-expanded={langExpanded}
            aria-controls="topbar-user-menu-langs"
            onClick={() => setLangExpanded((v) => !v)}
          >
            <Globe size={16} />
            <span style={{ flex: 1, textAlign: 'start' }}>
              {t('languages.chooseLanguage')}
            </span>
            <span className="topbar-user-menu-row__current" aria-hidden>
              {t(activeLang.labelKey)}
            </span>
            <ChevronDown
              size={14}
              aria-hidden
              style={{
                transition: 'transform 0.15s ease',
                transform: langExpanded ? 'rotate(-180deg)' : 'rotate(0deg)',
              }}
            />
          </button>

          {langExpanded ? (
            <div
              id="topbar-user-menu-langs"
              role="group"
              aria-label={t('languages.menuAria')}
              className="topbar-user-menu-sublist"
            >
              {languages.map((l) => {
                const isActive = l.code === activeLangCode;
                return (
                  <button
                    key={l.code}
                    type="button"
                    className={`topbar-user-menu-sublist__item ${isActive ? 'is-active' : ''}`}
                    onClick={() => changeLang(l.code)}
                    role="menuitemradio"
                    aria-checked={isActive}
                  >
                    <span>{t(l.labelKey)}</span>
                    {isActive ? <Check size={14} aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          <button
            type="button"
            className="topbar-user-logout"
            onClick={handleLogout}
          >
            <LogOut size={16} />
            <span>{t('auth.logout')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
