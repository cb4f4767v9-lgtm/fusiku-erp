import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import zh from './zh.json';
import ar from './ar.json';
import ur from './ur.json';
import { getBaseLanguage, isRtlBaseLanguage } from '../utils/i18nLocale';
import { getPersistedLanguage, persistLanguageCode } from '../utils/i18nPersist';

const resources = {
  en: { translation: en },
  zh: { translation: zh },
  ar: { translation: ar },
  ur: { translation: ur },
};

function syncDocumentDirAndLang(lng: string) {
  const base = getBaseLanguage(lng);
  document.documentElement.lang = base;
  document.documentElement.dir = isRtlBaseLanguage(base) ? 'rtl' : 'ltr';
}

i18n.on('languageChanged', (lng) => {
  syncDocumentDirAndLang(lng || '');
  persistLanguageCode(lng || '');
  window.dispatchEvent(new Event('languageChanged'));
});

const initialLng = getPersistedLanguage();

i18n.use(initReactI18next).init({
  resources,

  lng: initialLng,

  fallbackLng: {
    default: ['en'],
  },

  supportedLngs: ['en', 'zh', 'ar', 'ur'],
  nonExplicitSupportedLngs: true,
  load: 'languageOnly',

  interpolation: {
    escapeValue: false,
  },

  react: {
    useSuspense: false,
    bindI18n: 'languageChanged loaded',
    bindI18nStore: 'added removed',
  },
});

// Initial sync
syncDocumentDirAndLang(i18n.resolvedLanguage || i18n.language || 'en');

export default i18n;