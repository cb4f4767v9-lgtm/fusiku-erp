/**
 * Backend API message catalog (keys + per-language strings).
 * Prefer returning `code` + client-side i18n; use `messageFor` for SMS/email or non-React consumers.
 */
import { normalizeUiLanguage, type SupportedUiLanguage } from '../utils/supportedLocale';

export const API_MESSAGE_KEYS = [
  'AUTH_LOGIN_FAILED',
  'AUTH_REFRESH_FAILED',
  'AUTH_REQUIRED',
  'VALIDATION_FAILED',
  'SERVER_ERROR',
] as const;
export type ApiMessageKey = (typeof API_MESSAGE_KEYS)[number];

const CATALOG: Record<ApiMessageKey, Record<SupportedUiLanguage, string>> = {
  AUTH_LOGIN_FAILED: {
    en: 'Invalid credentials',
    zh: '凭据无效',
    ar: 'بيانات الاعتماد غير صالحة',
    ur: 'غلط اسنادات',
  },
  AUTH_REFRESH_FAILED: {
    en: 'Invalid or expired token',
    zh: '令牌无效或已过期',
    ar: 'رمز غير صالح أو منتهي',
    ur: 'ٹوکن غلط یا ختم ہو چکا',
  },
  AUTH_REQUIRED: {
    en: 'Unauthorized',
    zh: '未授权',
    ar: 'غير مصرح',
    ur: 'اجازت نہیں',
  },
  VALIDATION_FAILED: {
    en: 'Validation failed',
    zh: '验证失败',
    ar: 'فشل التحقق',
    ur: 'تصدیق ناکام',
  },
  SERVER_ERROR: {
    en: 'Server error',
    zh: '服务器错误',
    ar: 'خطأ في الخادم',
    ur: 'سرور کی خرابی',
  },
};

export function messageFor(key: ApiMessageKey, lang: string): string {
  const l = normalizeUiLanguage(lang);
  return CATALOG[key][l] || CATALOG[key].en;
}
