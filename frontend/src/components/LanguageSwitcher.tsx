import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../i18n';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) || SUPPORTED_LANGUAGES[0];

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng);
    setOpen(false);
    window.location.reload();
  };

  return (
    <div className="language-switcher" ref={ref}>
      <button
        type="button"
        className="language-switcher-trigger"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        title={currentLang.name}
      >
        <Globe size={18} />
        <span>{currentLang.name}</span>
      </button>
      {open && (
        <div className="language-switcher-dropdown">
          {SUPPORTED_LANGUAGES.map(({ code, name }) => (
            <button key={code} type="button" className={`language-switcher-item ${i18n.language === code ? 'active' : ''}`} onClick={() => changeLanguage(code)}>
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
