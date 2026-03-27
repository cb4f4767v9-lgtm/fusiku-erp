import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './en.json';
import zh from './zh.json';
import ar from './ar.json';
import ur from './ur.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'zh', name: '中文' },
  { code: 'ar', name: 'العربية' },
  { code: 'ur', name: 'اردو' },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

/** Area-specific logo paths for branding */
export const LOGO_PATHS = {
  sidebar: '/logo/logo-full.svg',
  login: '/logo/logo-full.svg',
  icon: './logo-icon.svg',
} as const;

export type LogoArea = keyof typeof LOGO_PATHS;

export function getLogoByArea(area: LogoArea): string {
  return LOGO_PATHS[area];
}

/** @deprecated Use getLogoByArea for area-specific logos */
export function getLogoPath(lang: string, type: 'icon' | 'full' = 'icon'): string {
  return LOGO_PATHS.icon;
}

export function applyRTL(lang: string) {
  document.body.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

const savedLang = (typeof window !== 'undefined' && window.localStorage?.getItem('language')) || 'en';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      zh: { translation: zh },
      ar: { translation: ar },
      ur: { translation: ur },
    },
    fallbackLng: 'en',
    lng: savedLang,
    supportedLngs: ['en', 'zh', 'ar', 'ur'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

i18n.on('languageChanged', (lng) => {
  applyRTL(lng);
});

i18n.on('initialized', () => {
  applyRTL(i18n.language);
});

export default i18n;
