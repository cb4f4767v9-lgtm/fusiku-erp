import axios, { AxiosResponse, CanceledError } from 'axios';
import {
  clearStoredAccessToken,
  clearStoredRefreshToken,
  persistAccessToken,
  readStoredAccessToken,
  readStoredRefreshToken,
  resolveCompanyIdForAuth,
} from '../utils/authSession';
import { getOrCreateDeviceId } from '../utils/deviceId';

const SESSION_LOGIN_FLAG = 'fusiku_redirect_login';
const SESSION_REASON_KEY = 'fusiku_session_reason';
import { getSessionBranchScope } from '../utils/jwtClient';
import { resolveApiV1BaseUrl } from '../config/apiBase';
import { setLastApiResponseMeta } from './apiLocaleMeta';
import type { ApiResponseMeta } from './apiLocaleMeta';
import { enqueueWebOutbox, classifyOutboxKindFromUrl } from '../offline/webOutbox';

export { getLastApiResponseMeta } from './apiLocaleMeta';
export type { ApiResponseMeta };

/** Thrown before login when no tenant id is available (handled in UI with a toast). */
export class MissingCompanyIdError extends Error {
  override name = 'MissingCompanyIdError';
  constructor() {
    super(
      'Missing company (tenant) id. Set VITE_DEFAULT_COMPANY_ID in your environment to your Company UUID, or use Sign up / a previous session on this browser.'
    );
  }
}

/** Password OK but backend requires step-up OTP (new device, risk, or 2FA). */
export class LoginDeviceVerificationRequiredError extends Error {
  override name = 'LoginDeviceVerificationRequiredError';
  readonly challengeId: string;
  readonly availableChannels: string[];
  readonly defaultChannel: string;
  constructor(
    challengeId: string,
    meta?: { availableChannels?: string[]; defaultChannel?: string }
  ) {
    super('Device verification required');
    this.challengeId = challengeId;
    this.availableChannels =
      Array.isArray(meta?.availableChannels) && meta!.availableChannels!.length > 0
        ? meta!.availableChannels!
        : ['email'];
    this.defaultChannel = typeof meta?.defaultChannel === 'string' ? meta.defaultChannel : this.availableChannels[0];
  }
}

/** Must be `/api/v1` (or absolute `.../api/v1`), never `.../api/v1/auth` — auth uses paths `/auth/login`, etc. */
const API_BASE = resolveApiV1BaseUrl();

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  // Required so the browser sends the HttpOnly `fusiku_rt` refresh cookie on
  // `/auth/refresh` and `/auth/logout` calls (and any future cookie-bound endpoint).
  withCredentials: true,
});
export type ApiResponse<T = any> = Promise<AxiosResponse<T>>;
let refreshPromise: Promise<string | null> | null = null;

/**
 * After a definitive session failure (refresh failed), block further authenticated
 * requests until full reload/login so parallel callers (e.g. GET /auth/me) do not
 * keep hammering the API.
 */
let apiSessionExpiredGate = false;
let authRedirectScheduled = false;

export function resetApiSessionExpiredGate() {
  apiSessionExpiredGate = false;
  authRedirectScheduled = false;
}

/** Paths where 401 should not force logout / redirect (explicitly public flows). */
function isPublicAuthBypassUrl(url: string) {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh') ||
    url.includes('/signup')
  );
}

/**
 * Silent refresh.
 *
 * Strategy:
 * 1. Try cookie-based refresh (`POST /auth/refresh` with credentials). The
 *    backend reads the HttpOnly `fusiku_rt` cookie and rotates both tokens.
 * 2. Migration fallback: older sessions stored the refresh token in
 *    localStorage. If a cookie isn't present yet (first refresh after
 *    upgrade), send the legacy LS value in the body so the backend can
 *    establish the cookie. The legacy LS value is wiped after first use.
 */
async function refreshAccessToken(): Promise<string | null> {
  if (apiSessionExpiredGate) return null;
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const tryRefresh = async (body: Record<string, unknown>) => {
      const res = await axios.post(`${API_BASE}/auth/refresh`, body, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      });
      const data = (res.data && typeof res.data === 'object' && 'data' in res.data)
        ? (res.data as any).data
        : res.data;
      const accessToken = String(data?.token || data?.accessToken || '').trim();
      return accessToken || null;
    };

    try {
      const fromCookie = await tryRefresh({});
      if (fromCookie) {
        persistAccessToken(fromCookie);
        return fromCookie;
      }
    } catch {
      // fall through to legacy fallback
    }

    const legacy = readStoredRefreshToken();
    if (legacy) {
      try {
        const fromBody = await tryRefresh({ refreshToken: legacy });
        if (fromBody) {
          persistAccessToken(fromBody);
          // Backend has now set the HttpOnly cookie; LS copy is no longer needed
          // (and is unsafe long-term — leave the cookie as the source of truth).
          clearStoredRefreshToken();
          return fromBody;
        }
      } catch {
        // ignore — fall through to null
      }
    }
    return null;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

/**
 * Ensures a usable access token exists (localStorage + in-memory cache).
 * If only a refresh token exists, performs a silent refresh.
 */
export async function ensureAccessTokenReady(): Promise<boolean> {
  let t = readStoredAccessToken();
  if (t) return true;
  try {
    const leg = typeof localStorage !== 'undefined' ? String(localStorage.getItem('token') || '').trim() : '';
    if (leg) {
      persistAccessToken(leg);
      t = readStoredAccessToken();
      if (t) return true;
    }
  } catch {
    /* ignore */
  }
  const refreshed = await refreshAccessToken();
  return Boolean(refreshed);
}

api.interceptors.request.use((config) => {
  const rel = String(config.url || '');
  if (apiSessionExpiredGate && !isPublicAuthBypassUrl(rel)) {
    return Promise.reject(new CanceledError('Session expired'));
  }

  let token = readStoredAccessToken();
  if (!token) {
    try {
      const leg = String(localStorage.getItem('token') || '').trim();
      if (leg) {
        persistAccessToken(leg);
        token = readStoredAccessToken();
      }
    } catch {
      /* ignore */
    }
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    // Avoid sending a misleading empty Bearer header on anonymous calls.
    delete (config.headers as Record<string, unknown>).Authorization;
  }
  // New workspace signup must not send a stale Bearer token or imply an existing tenant.
  try {
    const method = String(config.method || 'get').toLowerCase();
    const rel = String(config.url || '');
    if (method === 'post' && rel.includes('/signup')) {
      delete (config.headers as Record<string, unknown>).Authorization;
    }
  } catch {
    /* ignore */
  }
  // Branch-safe UX: do not allow non-super users to send arbitrary branchId.
  // Backend is authoritative; this prevents UI branchId spoofing.
  if (token) {
    const scope = getSessionBranchScope(token);
    const isSuper = scope.isSystemAdmin || scope.branchRole === 'SUPER_ADMIN' || !scope.branchId;
    if (!isSuper) {
      // Query params
      if (config.params && typeof config.params === 'object') {
        if ('branchId' in (config.params as any)) {
          delete (config.params as any).branchId;
        }
      }
      // JSON body payload
      if (config.data && typeof config.data === 'object' && !(config.data instanceof FormData)) {
        if ('branchId' in (config.data as any)) {
          delete (config.data as any).branchId;
        }
        if ('fromBranchId' in (config.data as any)) {
          delete (config.data as any).fromBranchId;
        }
        if ('toBranchId' in (config.data as any)) {
          delete (config.data as any).toBranchId;
        }
      }
    }
  }
  // Send current UI language to backend for translated fields + envelope `meta`.
  // i18next stores e.g. "en" or "en-US" in localStorage under "i18nextLng".
  try {
    const raw = localStorage.getItem('i18nextLng') || '';
    const base = raw.split(/[-_]/)[0]?.trim().toLowerCase();
    if (base) config.headers['x-lang'] = base;
    const cur = (localStorage.getItem('fusiku_view_currency') || '').trim().toUpperCase();
    if (cur.length === 3) config.headers['x-currency'] = cur;
  } catch {
    /* ignore */
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    // Web offline retry queue (lightweight): enqueue selected write actions when offline / network error.
    try {
      const cfg = err?.config as { method?: string; url?: string; data?: any } | undefined;
      const method = String(cfg?.method || '').toLowerCase();
      const url = String(cfg?.url || '');
      const networkish = !err?.response || err?.code === 'ERR_NETWORK' || err?.message?.includes('Network Error');
      if (method === 'post' && url && (typeof navigator === 'undefined' || !navigator.onLine || networkish)) {
        const kind = classifyOutboxKindFromUrl(url);
        if (kind) {
          const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now());
          const payload = cfg?.data ?? null;
          await enqueueWebOutbox({ id, kind, url, payload });
          return Promise.resolve({
            data: { queued: true, outboxId: id, kind },
            status: 202,
            statusText: 'Accepted',
            headers: {},
            config: err.config,
          } as any);
        }
      }
    } catch {
      /* ignore enqueue failures */
    }

    // SaaS gating: when trial expired / subscription expired, route to pricing.
    // Backend returns 402 with a stable `code`. We avoid redirect loops by not forcing pricing while already there,
    // and by allowing billing/plans endpoints to remain accessible.
    if (err?.response?.status === 402) {
      try {
        const code = String(err?.response?.data?.code || '').trim();
        const url = String(err?.config?.url || '');
        const alreadyPricing = typeof window !== 'undefined' && window.location?.pathname?.startsWith('/pricing');
        const allow = url.includes('/billing/') || url.includes('/plans');
        if (!alreadyPricing && !allow && (code === 'TRIAL_EXPIRED' || code === 'SUBSCRIPTION_EXPIRED')) {
          window.location.href = '/pricing';
          return Promise.reject(err);
        }
      } catch {
        /* ignore */
      }
    }

    if (err?.response?.status === 401) {
      const url = err?.config?.url || '';
      if (isPublicAuthBypassUrl(url)) {
        return Promise.reject(err);
      }
      if (apiSessionExpiredGate) {
        return Promise.reject(err);
      }
      const original = err?.config || {};
      if (!original._retry) {
        original._retry = true;
        const nextAccessToken = await refreshAccessToken();
        if (nextAccessToken) {
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${nextAccessToken}`;
          return api.request(original);
        }
      }
      apiSessionExpiredGate = true;
      clearStoredAccessToken();
      clearStoredRefreshToken();
      try {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        sessionStorage.setItem(SESSION_LOGIN_FLAG, '1');
        sessionStorage.setItem(SESSION_REASON_KEY, 'session_expired');
      } catch {
        /* ignore */
      }
      if (!authRedirectScheduled) {
        authRedirectScheduled = true;
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

/** Unwrap `{ success: true, data, meta? }` (registered after 401 handler → runs first on fulfilled responses). */
api.interceptors.response.use((res) => {
  const d = res.data;
  if (d && typeof d === 'object' && !Array.isArray(d) && 'success' in d) {
    const rec = d as { success?: boolean; data?: unknown; meta?: ApiResponseMeta };
    if (rec.meta && typeof rec.meta === 'object' && rec.meta.language && rec.meta.direction) {
      setLastApiResponseMeta(rec.meta);
    }
    if (rec.success === true && 'data' in rec) {
      res.data = rec.data as typeof res.data;
    }
  }
  return res;
});

function get<T = any>(url: string, params?: Record<string, any>): ApiResponse<T> {
  if (params) return api.get<T>(url, { params });
  return api.get<T>(url);
}

function post<T = any>(url: string, data?: any): ApiResponse<T> {
  return api.post<T>(url, data);
}

function put<T = any>(url: string, data?: any): ApiResponse<T> {
  return api.put<T>(url, data);
}

function patch<T = any>(url: string, data?: any): ApiResponse<T> {
  return api.patch<T>(url, data);
}

// AUTH
export const authApi = {
  me: (): ApiResponse<any> => get('/auth/me'),
  /** Persist language/currency to the signed-in user (no-op if unauthenticated). */
  updatePreferences: (body: {
    language?: string;
    currency?: string;
    twoFactorEnabled?: boolean;
    otpChannel?: 'EMAIL' | 'SMS' | 'WHATSAPP';
  }): ApiResponse<any> => patch('/auth/preferences', body),
  /**
   * If `companyId` is `null`, we intentionally DO NOT auto-resolve tenant id from env/localStorage.
   * This allows the login screen to "retry without tenant" when a stale/wrong tenant id is cached.
   */
  login: (
    email: string,
    password: string,
    companyId?: string | null,
    loginOpts?: { stepUpChannel?: 'EMAIL' | 'SMS' | 'WHATSAPP'; rememberDevice?: boolean }
  ): ApiResponse<any> => {
    const cid =
      companyId === null
        ? undefined
        : (companyId && String(companyId).trim()) || resolveCompanyIdForAuth() || undefined;
    let language: string | undefined;
    let currency: string | undefined;
    try {
      const raw = localStorage.getItem('i18nextLng') || '';
      const base = raw.split(/[-_]/)[0]?.trim().toLowerCase();
      if (base) language = base;
      const cur = (localStorage.getItem('fusiku_view_currency') || '').trim().toUpperCase();
      if (cur.length === 3) currency = cur;
    } catch {
      /* ignore */
    }
    let deviceId: string | undefined;
    let browserLabel: string | undefined;
    const remember = loginOpts?.rememberDevice !== false;
    if (remember) {
      try {
        deviceId = getOrCreateDeviceId();
        if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(deviceId)) {
          deviceId = undefined;
        } else {
          browserLabel =
            typeof navigator !== 'undefined' && navigator.userAgent
              ? String(navigator.userAgent).slice(0, 256)
              : undefined;
        }
      } catch {
        deviceId = undefined;
      }
    }
    const body = {
      email: String(email ?? '').trim(),
      password: String(password ?? ''),
      ...(cid ? { companyId: cid } : {}),
      ...(language ? { language } : {}),
      ...(currency ? { currency } : {}),
      ...(deviceId ? { deviceId, ...(browserLabel ? { browserLabel } : {}) } : {}),
      ...(loginOpts?.stepUpChannel ? { stepUpChannel: loginOpts.stepUpChannel } : {}),
    };
    return post('/auth/login', body);
  },
  verifyLoginDevice: (challengeId: string, code: string): ApiResponse<any> =>
    post('/auth/login/verify-device', { challengeId, code: String(code ?? '').replace(/\s/g, '').slice(0, 6) }),
  resendLoginDeviceOtp: (
    challengeId: string,
    channel?: 'EMAIL' | 'SMS' | 'WHATSAPP'
  ): ApiResponse<{ ok: true }> =>
    post('/auth/login/resend-device-otp', {
      challengeId,
      ...(channel ? { channel } : {}),
    }),
  register: (payload: any): ApiResponse<any> => post('/auth/register', payload),
  refresh: (payload: any): ApiResponse<any> => post('/auth/refresh', payload),
  logout: (): ApiResponse<any> => post('/auth/logout'),
  forgotPassword: (email: string, companyId?: string): ApiResponse<any> => {
    const cid = (companyId && String(companyId).trim()) || resolveCompanyIdForAuth();
    if (!cid) {
      return Promise.reject(new MissingCompanyIdError());
    }
    return post('/auth/forgot-password', { email: String(email ?? '').trim(), companyId: cid });
  },
  resetPassword: (token: string, password: string): ApiResponse<any> =>
    post('/auth/reset-password', { token, password }),
  changePassword: (currentPassword: string, newPassword: string): ApiResponse<any> =>
    post('/auth/change-password', { currentPassword, newPassword }),
};

// OTP (public login/signup)
export const otpApi = {
  request: (payload: { contact: string; method: 'email' | 'whatsapp'; companyId?: string }): ApiResponse<{
    success?: boolean;
    challengeId: string;
    expiresInSeconds: number;
    message?: string;
  }> => post('/otp/request', payload),

  verify: (payload: { challengeId: string; code: string }): ApiResponse<{
    success?: boolean;
    token?: string;
    accessToken?: string;
    refreshToken?: string;
    user: { id: string; email: string; name: string; role: string; companyId?: string; branchId?: string; branch?: string };
    isNewUser?: boolean;
  }> => post('/otp/verify', payload),
};

/** Public SaaS tenant signup (OTP): start → verify. Requires `ENABLE_PUBLIC_SIGNUP` on server. */
export const signupApi = {
  start: (payload: {
    companyName: string;
    email: string;
    password: string;
    phone?: string;
    website?: string;
    businessType?: string;
    alsoSendPhone?: boolean;
    phoneOtpChannel?: 'SMS' | 'WHATSAPP';
  }): ApiResponse<{ challengeId: string; expiresInSeconds: number; message?: string }> =>
    post('/signup/start', payload),

  verify: (payload: { challengeId: string; code: string }): ApiResponse<{
    companyId: string;
    accessToken?: string;
    token?: string;
    refreshToken: string;
    user: { id: string; email: string; name: string; role: string; companyId?: string; branchId?: string; branch?: string };
  }> => post('/signup/verify', payload),

  resend: (payload: { challengeId: string }): ApiResponse<{ message?: string; expiresInSeconds?: number }> =>
    post('/signup/resend', payload),
};

/** Public SaaS plan catalog (no auth). */
export const plansApi = {
  list: (): ApiResponse<any[]> => get('/plans'),
};

// TRANSLATIONS (Admin)
export const translationsApi = {
  list: (params?: { languageCode?: string; search?: string; limit?: number; offset?: number }): ApiResponse<any[]> =>
    get('/translations', params as any),
  upsert: (payload: { key: string; languageCode: string; value: string; isVerified?: boolean }): ApiResponse<any> =>
    put('/translations', payload),
  verify: (payload: { key: string; languageCode: string; isVerified: boolean }): ApiResponse<any> =>
    patch('/translations/verify', payload),
  importBulk: (payload: { languageCode: string; entries: { key: string; value: string }[]; markVerified?: boolean }): ApiResponse<any> =>
    post('/translations/import', payload),
  missing: (languageCode: string): ApiResponse<{ languageCode: string; missingKeys: string[]; count: number }> =>
    get(`/translations/missing/${encodeURIComponent(languageCode)}`),
  autoFill: (payload: { targetLanguageCode: string; limit?: number }): ApiResponse<any> =>
    post('/translations/auto-fill', payload),
};

// SETUP
export const setupApi = {
  complete: (payload: any): ApiResponse<any> => post('/setup/complete', payload),
  saveProfile: (payload: {
    businessType: string;
    businessTypes?: string[];
    platform: string;
    sourcingCountries: string[];
    sourcingOther?: string | null;
    requirements: string;
  }): ApiResponse<any> => post('/setup/profile', payload),
};

// BILLING (tenant-auth)
export const billingApi = {
  choosePlan: (payload: { planKey: 'BASIC' | 'PRO' | 'ENTERPRISE' }): ApiResponse<any> =>
    post('/billing/choose-plan', payload),
};

// COMMON CRUD (single resource under v1 mount)
export const branchesApi = {
  getAll: (params?: Record<string, any>): ApiResponse<any> => get('/branches', params),
  getById: (id: string): ApiResponse<any> => get(`/branches/${id}`),
  create: (payload: any): ApiResponse<any> => post('/branches', payload),
  update: (id: string, payload: any): ApiResponse<any> => put(`/branches/${id}`, payload),
  delete: (id: string): ApiResponse<any> => api.delete(`/branches/${id}`),
};

export const customersApi = {
  getAll: (params?: Record<string, any>): ApiResponse<any> => get('/customers', params),
  getById: (id: string): ApiResponse<any> => get(`/customers/${id}`),
  create: (payload: any): ApiResponse<any> => post('/customers', payload),
  update: (id: string, payload: any): ApiResponse<any> => put(`/customers/${id}`, payload),
  delete: (id: string): ApiResponse<any> => api.delete(`/customers/${id}`),
};

export const suppliersApi = {
  getAll: (params?: Record<string, any>): ApiResponse<any> => get('/suppliers', params),
  getById: (id: string): ApiResponse<any> => get(`/suppliers/${id}`),
  create: (payload: any): ApiResponse<any> => post('/suppliers', payload),
  update: (id: string, payload: any): ApiResponse<any> => put(`/suppliers/${id}`, payload),
  delete: (id: string): ApiResponse<any> => api.delete(`/suppliers/${id}`),
};

export const usersApi = {
  getAll: (params?: Record<string, any>): ApiResponse<any> => get('/users', params),
};

export const inventoryApi = {
  getAll: (params?: Record<string, any>): ApiResponse<any> => get('/inventory', params),
  getByImei: (imei: string): ApiResponse<any> => get(`/inventory/imei/${imei}`),
  getByBarcode: (barcode: string): ApiResponse<any> => get(`/inventory/barcode/${barcode}`),
  create: (payload: any): ApiResponse<any> => post('/inventory', payload),
};

export const imeiApi = {
  lookup: (imei: string): ApiResponse<any> => get(`/imei/lookup/${imei}`),
  getHistory: (imei: string): ApiResponse<any> => get(`/imei/history/${imei}`),
};

export const warrantyApi = {
  getByImei: (imei: string): ApiResponse<any> => get(`/warranty/${imei}`),
};

export const posApi = {
  createSale: (payload: any): ApiResponse<any> => post('/pos/sale', payload),
};

export const repairsApi = {
  getAll: (params?: Record<string, any>): ApiResponse<any> => get('/repairs', params),
  create: (payload: any): ApiResponse<any> => post('/repairs', payload),
  update: (id: string, payload: any): ApiResponse<any> => put(`/repairs/${id}`, payload),
};

export const refurbishApi = {
  getAll: (params?: Record<string, any>): ApiResponse<any> => get('/refurbish', params),
  create: (payload: any): ApiResponse<any> => post('/refurbish', payload),
  update: (id: string, payload: any): ApiResponse<any> => put(`/refurbish/${id}`, payload),
};

export const transfersApi = {
  getAll: (params?: Record<string, any>): ApiResponse<any> => get('/transfers', params),
  create: (payload: any): ApiResponse<any> => post('/transfers', payload),
  approve: (id: string): ApiResponse<any> => post(`/transfers/${id}/approve`),
};

// SALES + INVOICES (Phase 12)
export const salesOrdersApi = {
  list: (params?: Record<string, any>): ApiResponse<any[]> => get('/sales-orders', params),
  getById: (id: string): ApiResponse<any> => get(`/sales-orders/${id}`),
  create: (payload: any): ApiResponse<any> => post('/sales-orders', payload),
  update: (id: string, payload: any): ApiResponse<any> => put(`/sales-orders/${id}`, payload),
  confirm: (id: string): ApiResponse<any> => post(`/sales-orders/${id}/confirm`),
  convertToInvoice: (id: string, payload?: any): ApiResponse<any> => post(`/sales-orders/${id}/convert-to-invoice`, payload),
};

export const invoicesApi = {
  list: (params?: Record<string, any>): ApiResponse<any[]> => get('/invoices', params),
  getById: (id: string): ApiResponse<any> => get(`/invoices/${id}`),
  addPayment: (id: string, payload: any): ApiResponse<any> => post(`/invoices/${id}/payments`, payload),
};

export type PricingRule = {
  id: string;
  name: string;
  minPrice: number;
  maxPrice: number;
  profitPercent: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PricingPreview = {
  rule: PricingRule | null;
  profitPercent: number;
  sellingPrice: number;
  source: 'matched' | 'fallback_highest' | 'fallback_zero';
};

export const pricingRulesApi = {
  list: (params?: { active?: boolean; take?: number; skip?: number }): ApiResponse<PricingRule[]> =>
    get('/pricing-rules', params),
  getById: (id: string): ApiResponse<PricingRule> => get(`/pricing-rules/${id}`),
  create: (payload: Omit<PricingRule, 'id' | 'createdAt' | 'updatedAt' | 'active'> & { active?: boolean }): ApiResponse<PricingRule> =>
    post('/pricing-rules', payload),
  update: (id: string, payload: Partial<Omit<PricingRule, 'id' | 'createdAt' | 'updatedAt'>>): ApiResponse<PricingRule> =>
    put(`/pricing-rules/${id}`, payload),
  remove: (id: string): ApiResponse<{ success: boolean }> => api.delete(`/pricing-rules/${id}`),
  preview: (costPrice: number): ApiResponse<PricingPreview> => get('/pricing-rules/preview', { costPrice }),
};

export type QuotationItemInput = {
  inventoryId?: string;
  description?: string;
  costPrice?: number;
  quantity?: number;
};

export type QuotationGeneratePayload = {
  customerName?: string;
  customerPhone?: string;
  notes?: string;
  items: QuotationItemInput[];
};

export type QuotationItem = {
  id: string;
  inventoryId: string | null;
  description: string | null;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  profitPercent: number;
  pricingRuleId: string | null;
  ruleSource?: 'matched' | 'fallback_highest' | 'fallback_zero';
  inventory?: {
    id: string;
    brand: string;
    model: string;
    storage: string;
    color: string;
    imei: string;
  } | null;
};

export type Quotation = {
  id: string;
  customerName: string | null;
  customerPhone: string | null;
  notes: string | null;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  items: QuotationItem[];
};

export type QuotationShare = {
  text: string;
  whatsappUrl: string;
  currency: string;
  phone: string | null;
};

export const quotationsApi = {
  list: (params?: { q?: string; take?: number; skip?: number }): ApiResponse<any[]> =>
    get('/quotations', params),
  getById: (id: string): ApiResponse<Quotation> => get(`/quotations/${id}`),
  generate: (payload: QuotationGeneratePayload): ApiResponse<Quotation> => post('/quotations/generate', payload),
  remove: (id: string): ApiResponse<{ success: boolean }> => api.delete(`/quotations/${id}`),
  share: (id: string, currency?: string): ApiResponse<QuotationShare> =>
    get(`/quotations/${id}/share`, currency ? { currency } : undefined),
};

export type ChatRoomKind = 'BRANCH' | 'BRANCH_PAIR' | 'COMPANY';

export type ChatRoom = {
  id: string;
  kind: ChatRoomKind;
  name: string;
  branchId: string | null;
  branchAId: string | null;
  branchBId: string | null;
  participants: { id: string; name: string }[];
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  chatRoomId: string;
  body: string;
  createdAt: string;
  sender: { id: string; name: string; email: string } | null;
  senderBranch: { id: string; name: string } | null;
};

export type ChatRoomOpenPayload = {
  kind?: ChatRoomKind;
  branchId?: string;
  withBranchId?: string;
};

export const chatApi = {
  /** Rooms visible to the current user (auto-creates Company + own Branch on first call). */
  listRooms: (): ApiResponse<ChatRoom[]> => get('/chat/rooms'),
  /**
   * Open or create a room.
   *  - `{}` (default) → own branch room, or company-wide if user has no branch.
   *  - `{ kind: 'COMPANY' }` → company-wide room.
   *  - `{ branchId }` → that branch's room (super admin only outside own branch).
   *  - `{ withBranchId }` → pair room between caller's branch and target.
   */
  openRoom: (payload?: ChatRoomOpenPayload): ApiResponse<ChatRoom> =>
    post('/chat/rooms', payload ?? {}),
  /** REST fallback for fetching history (oldest-first). Use with `before` for pagination. */
  listMessages: (roomId: string, params?: { take?: number; before?: string }): ApiResponse<ChatMessage[]> =>
    get(`/chat/rooms/${roomId}/messages`, params),
  /** REST fallback when the websocket isn't connected. Live clients should emit `chat:send`. */
  sendMessage: (roomId: string, body: string): ApiResponse<ChatMessage> =>
    post(`/chat/rooms/${roomId}/messages`, { body }),
};

// --- Institute (training vertical) ---

export type InstituteStudent = {
  id: string;
  companyId: string;
  branchId: string | null;
  studentCode: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  profilePhotoUrl?: string | null;
  nationalId?: string | null;
  identityDocumentType?: string | null;
  identityDocumentNumber?: string | null;
  bloodGroup?: string | null;
  whatsApp?: string | null;
  addressLine?: string | null;
  city?: string | null;
  country?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  guardianName?: string | null;
  emergencyContact?: string | null;
  guardianPhone?: string | null;
  previousSchool?: string | null;
  qualification?: string | null;
  notes?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

/** Payload for create/update (omit empty strings). */
export type InstituteStudentWritePayload = Partial<
  Omit<
    InstituteStudent,
    'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'branchId' | 'studentCode' | 'status'
  >
> & {
  fullName?: string;
  studentCode?: string | null;
  branchId?: string | null;
  status?: string;
};

export type InstituteCourseRow = {
  id: string;
  companyId: string;
  title: string;
  code: string | null;
  description: string | null;
  active: boolean;
  defaultFee: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InstituteBatchRow = {
  id: string;
  companyId: string;
  courseId: string;
  name: string;
  startsOn: string | null;
  endsOn: string | null;
  feeOverride: string | null;
  timingSlot?: string | null;
  timingLabel?: string | null;
  teacherName?: string | null;
  capacity?: number | null;
  course: { id: string; title: string; code: string | null; defaultFee?: string | null };
};

export type InstituteFeeCharge = {
  id: string;
  companyId: string;
  studentId: string;
  enrollmentId: string | null;
  label: string | null;
  amount: string | number;
  paidAmount: string | number;
  balance: string | number;
  currency: string;
  dueDate: string | null;
  status: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  student?: { id: string; fullName: string; studentCode: string | null };
  enrollment?: {
    id: string;
    batch: {
      id: string;
      name: string;
      course: { id: string; title: string; code: string | null };
    };
  } | null;
  payments?: {
    id: string;
    amount: number;
    currency: string;
    method: string;
    reference: string | null;
    paidAt: string;
    status: string;
  }[];
};

export type InstituteEnrollment = {
  id: string;
  companyId: string;
  studentId: string;
  batchId: string;
  status: string;
  enrolledAt: string;
  admissionDate?: string | null;
  expectedCompletionDate?: string | null;
  student: {
    id: string;
    fullName: string;
    studentCode: string | null;
    status: string;
    profilePhotoUrl?: string | null;
    guardianName?: string | null;
    guardianPhone?: string | null;
  };
  batch: {
    id: string;
    name: string;
    startsOn: string | null;
    endsOn: string | null;
    timingSlot?: string | null;
    timingLabel?: string | null;
    teacherName?: string | null;
    capacity?: number | null;
    course: { id: string; title: string; code: string | null };
  };
  feeCharges: {
    id: string;
    label: string | null;
    amount: string | number;
    paidAmount: string | number;
    balance: string | number;
    currency: string;
    dueDate: string | null;
    status: string;
  }[];
};

export type InstituteEnrollPayload = {
  studentId: string;
  batchId: string;
  status?: string;
  admissionDate?: string | Date;
  expectedCompletionDate?: string | Date;
  fees?: { label?: string; amount: number; currency?: string; dueDate?: string | Date }[];
  skipAutoFee?: boolean;
};

export type InstituteFeeCreatePayload = {
  studentId: string;
  enrollmentId?: string;
  label?: string;
  amount: number;
  currency?: string;
  dueDate?: string | Date;
};

export type InstitutePaymentPayload = {
  feeChargeId: string;
  amount: number;
  currency?: string;
  method?: string;
  reference?: string;
  paidAt?: string | Date;
  branchId?: string;
};

export type InstitutePaymentResult = {
  payment: {
    id: string;
    companyId: string;
    instituteFeeChargeId: string | null;
    amount: number;
    currency: string;
    method: string;
    paidAt: string;
  };
  charge: InstituteFeeCharge;
};

export type InstituteAttendanceRow = {
  id: string;
  companyId: string;
  batchId: string;
  enrollmentId: string;
  date: string;
  present: boolean;
  notes: string | null;
  enrollment?: {
    id: string;
    student: { id: string; fullName: string; studentCode: string | null; profilePhotoUrl: string | null };
  };
};

export type InstituteAttendanceSummary = {
  enrollmentId: string;
  student: { id: string; fullName: string; studentCode: string | null; profilePhotoUrl: string | null };
  totalClasses: number;
  present: number;
  absent: number;
  percentage: number | null;
};

export type InstituteExam = {
  id: string;
  companyId: string;
  branchId: string | null;
  batchId: string;
  title: string;
  type: string;
  totalMarks: number;
  passingMarks: number;
  examDate: string | null;
  weightPercent: number | null;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
  batch?: { id: string; name: string; course: { id: string; title: string; code: string | null } };
  _count?: { results: number };
  results?: InstituteExamResult[];
};

export type InstituteExamResult = {
  id: string;
  companyId: string;
  examId: string;
  enrollmentId: string;
  obtainedMarks: number;
  percentage: number | string;
  grade: string | null;
  gpa: number | string | null;
  status: string;
  remarks: string | null;
  createdAt: string;
  exam?: {
    id: string; title: string; type: string; totalMarks: number; passingMarks: number;
    examDate: string | null; weightPercent: number | null;
  };
  enrollment?: {
    id: string;
    student: { id: string; fullName: string; studentCode: string | null; profilePhotoUrl: string | null };
  };
};

export type InstituteAcademicSummary = {
  enrollments: {
    enrollmentId: string;
    batch: string;
    course: string;
    results: InstituteExamResult[];
    gpa: number | null;
    totalExams: number;
    passed: number;
    failed: number;
  }[];
  overallGpa: number | null;
};

export const instituteApi = {
  listStudents: (params?: { status?: string; branchId?: string; q?: string }): ApiResponse<InstituteStudent[]> =>
    get('/institute/students', params),
  getStudent: (studentId: string): ApiResponse<InstituteStudent> => get(`/institute/students/${studentId}`),
  createStudent: (payload: InstituteStudentWritePayload & { fullName: string }): ApiResponse<InstituteStudent> =>
    post('/institute/students', payload),
  updateStudent: (studentId: string, payload: InstituteStudentWritePayload): ApiResponse<InstituteStudent> =>
    patch(`/institute/students/${studentId}`, payload),

  listCourses: (params?: { activeOnly?: boolean }): ApiResponse<InstituteCourseRow[]> =>
    get('/institute/courses', params as Record<string, unknown>),
  createCourse: (payload: { title: string; code?: string; description?: string; active?: boolean; defaultFee?: number }): ApiResponse<InstituteCourseRow> =>
    post('/institute/courses', payload),
  updateCourse: (courseId: string, payload: Partial<{ title: string; code: string; description: string; active: boolean; defaultFee: number | null }>): ApiResponse<InstituteCourseRow> =>
    patch(`/institute/courses/${courseId}`, payload),

  listBatches: (params?: { courseId?: string }): ApiResponse<InstituteBatchRow[]> =>
    get('/institute/batches', params),
  createBatch: (payload: { courseId: string; name: string; startsOn?: string; endsOn?: string; feeOverride?: number; timingSlot?: string; timingLabel?: string; teacherName?: string; capacity?: number }): ApiResponse<InstituteBatchRow> =>
    post('/institute/batches', payload),
  updateBatch: (batchId: string, payload: Record<string, unknown>): ApiResponse<InstituteBatchRow> =>
    patch(`/institute/batches/${batchId}`, payload),

  listEnrollments: (params?: { studentId?: string; batchId?: string; status?: string }): ApiResponse<
    InstituteEnrollment[]
  > => get('/institute/enrollments', params),
  enroll: (payload: InstituteEnrollPayload): ApiResponse<InstituteEnrollment> =>
    post('/institute/enrollments', payload),

  listFees: (params?: {
    studentId?: string;
    enrollmentId?: string;
    status?: string;
    dueBefore?: string | Date;
  }): ApiResponse<InstituteFeeCharge[]> => get('/institute/fees', params as Record<string, unknown>),
  createFee: (payload: InstituteFeeCreatePayload): ApiResponse<InstituteFeeCharge> =>
    post('/institute/fees', payload),

  recordPayment: (payload: InstitutePaymentPayload): ApiResponse<InstitutePaymentResult> =>
    post('/institute/payments', payload),

  listAttendance: (params?: { batchId?: string; enrollmentId?: string; dateFrom?: string; dateTo?: string }): ApiResponse<InstituteAttendanceRow[]> =>
    get('/institute/attendance', params as Record<string, unknown>),
  attendanceSummary: (batchId: string): ApiResponse<InstituteAttendanceSummary[]> =>
    get('/institute/attendance/summary', { batchId }),
  recordAttendance: (payload: { enrollmentId: string; batchId: string; date: string; present: boolean; notes?: string }): ApiResponse<InstituteAttendanceRow> =>
    post('/institute/attendance', payload),
  recordAttendanceBulk: (payload: { batchId: string; date: string; records: { enrollmentId: string; present: boolean; notes?: string }[] }): ApiResponse<InstituteAttendanceRow[]> =>
    post('/institute/attendance/bulk', payload),

  listExams: (params?: { batchId?: string; type?: string }): ApiResponse<InstituteExam[]> =>
    get('/institute/exams', params as Record<string, unknown>),
  getExam: (examId: string): ApiResponse<InstituteExam> =>
    get(`/institute/exams/${examId}`),
  createExam: (payload: {
    batchId: string; branchId?: string; title: string; type?: string;
    totalMarks: number; passingMarks: number; examDate?: string;
    weightPercent?: number; remarks?: string;
  }): ApiResponse<InstituteExam> =>
    post('/institute/exams', payload),
  updateExam: (examId: string, payload: Record<string, unknown>): ApiResponse<InstituteExam> =>
    patch(`/institute/exams/${examId}`, payload),

  listResults: (params?: { examId?: string; enrollmentId?: string }): ApiResponse<InstituteExamResult[]> =>
    get('/institute/results', params as Record<string, unknown>),
  recordResult: (payload: {
    examId: string; enrollmentId: string; obtainedMarks: number;
    remarks?: string; status?: string;
  }): ApiResponse<InstituteExamResult> =>
    post('/institute/results', payload),
  recordResultBulk: (payload: {
    examId: string; results: { enrollmentId: string; obtainedMarks: number; remarks?: string; status?: string }[];
  }): ApiResponse<InstituteExamResult[]> =>
    post('/institute/results/bulk', payload),

  academicSummary: (studentId: string): ApiResponse<InstituteAcademicSummary> =>
    get('/institute/academic-summary', { studentId }),
};

export const activityApi = {
  getAll: (params?: Record<string, any>): ApiResponse<any> => get('/activity', params),
};

export const logsApi = {
  getAll: (params?: Record<string, any>): ApiResponse<any> => get('/logs', params),
};

export const stockMovementsApi = {
  getAll: (params?: Record<string, any>): ApiResponse<any> => get('/stock-movements', params),
};

export const stockAlertsApi = {
  check: (): ApiResponse<any> => post('/stock-alerts/check'),
};

export const masterDataApi = {
  getAll: (entity: string, params?: Record<string, any>): ApiResponse<any> =>
    get(`/master-data/${entity}`, params),
  create: (entity: string, payload: any): ApiResponse<any> => post(`/master-data/${entity}`, payload),
  update: (entity: string, id: string, payload: any): ApiResponse<any> =>
    put(`/master-data/${entity}/${id}`, payload),
  delete: (entity: string, id: string): ApiResponse<any> => api.delete(`/master-data/${entity}/${id}`),
};

export const locationsApi = {
  getCountries: (): ApiResponse<any> => get('/locations/countries'),
  getProvinces: (country: string): ApiResponse<any> => get('/locations/provinces', { country }),
  getCities: (country: string, province?: string): ApiResponse<any> =>
    get('/locations/cities', { country, ...(province ? { province } : {}) }),
};

export const uploadApi = {
  uploadQr: (file: File): ApiResponse<any> => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/upload/qr', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  /** Generic image upload → `{ url: '/uploads/...' }` */
  uploadBranding: (file: File): ApiResponse<{ url: string }> => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: { type: 'branding' }
    });
  },
};

export const apiKeysApi = {
  list: (): ApiResponse<any> => get('/api-keys'),
  create: (payload: any): ApiResponse<any> => post('/api-keys', payload),
  revoke: (id: string): ApiResponse<any> => api.delete(`/api-keys/${id}`),
};

export const webhooksApi = {
  list: (): ApiResponse<any> => get('/webhooks'),
  create: (payload: any): ApiResponse<any> => post('/webhooks', payload),
  delete: (id: string): ApiResponse<any> => api.delete(`/webhooks/${id}`),
};

export const setupQrApi = undefined;

export const companyApi = {
  getProfile: (): ApiResponse<any> => get('/company/profile'),
  updateProfile: (payload: any): ApiResponse<any> => put('/company/profile', payload),
  getSettings: (): ApiResponse<any> => get('/company/settings'),
  updateSettings: (payload: any): ApiResponse<any> => put('/company/settings', payload),
};

export const phoneDatabaseApi = {
  getBrands: (): ApiResponse<any> => get('/phone-database/brands'),
  getModels: (brandId: string): ApiResponse<any> => get(`/phone-database/brands/${brandId}/models`),
  getVariants: (modelId: string): ApiResponse<any> => get(`/phone-database/models/${modelId}/variants`),
};

export const purchasesApi = {
  getAll: (params?: Record<string, any>): ApiResponse<any> => get('/purchases', params),
  create: (payload: any): ApiResponse<any> => post('/purchases', payload),
};

export const importApi = {
  inventory: (file: File, branchId?: string): ApiResponse<any> => {
    const fd = new FormData();
    fd.append('file', file);
    const token = readStoredAccessToken();
    const scope = getSessionBranchScope(token);
    const isSuper = scope.isSystemAdmin || scope.branchRole === 'SUPER_ADMIN' || !scope.branchId;
    const effectiveBranchId = isSuper ? String(branchId || '').trim() : String(scope.branchId || '').trim();
    fd.append('branchId', effectiveBranchId);
    return api.post('/import/inventory', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  suppliers: (file: File): ApiResponse<any> => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/import/suppliers', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  purchases: (file: File, branchId: string | undefined, supplierId: string): ApiResponse<any> => {
    const fd = new FormData();
    fd.append('file', file);
    const token = readStoredAccessToken();
    const scope = getSessionBranchScope(token);
    const isSuper = scope.isSystemAdmin || scope.branchRole === 'SUPER_ADMIN' || !scope.branchId;
    const effectiveBranchId = isSuper ? String(branchId || '').trim() : String(scope.branchId || '').trim();
    fd.append('branchId', effectiveBranchId);
    fd.append('supplierId', supplierId);
    return api.post('/import/purchases', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export const aiApi = {
  repairSuggestions: (params: Record<string, any>): ApiResponse<any> =>
    get('/ai/repair-suggestions', params),
  priceEstimate: (params: Record<string, any>): ApiResponse<any> =>
    get('/ai/price-estimate', params),
  conditionSuggest: (notes: string): ApiResponse<any> =>
    post('/ai/condition-suggest', { notes }),
  priceOptimize: (params: Record<string, any>): ApiResponse<any> =>
    get('/ai/price-optimize', params),
  businessIntelligence: (params?: Record<string, any>): ApiResponse<any> =>
    get('/ai/business-intelligence', params),
};

export const reportsApi = {
  /** Same KPIs as GET /api/dashboard — { sales, profit, stock, repairs } */
  getDashboardSummary: (): ApiResponse<{ sales: number; profit: number; stock: number; repairs: number }> =>
    get('/dashboard'),
  getDashboard: (params?: Record<string, any>): ApiResponse<any> => get('/reports/dashboard', params),
  getTopSellingModels: (params?: Record<string, any>): ApiResponse<any> => get('/reports/top-selling-models', params),
  getMonthlyRevenue: (params?: Record<string, any>): ApiResponse<any> => get('/reports/monthly-revenue', params),

  getSalesReport: (params?: Record<string, any>): ApiResponse<any> => get('/reports/sales', params),
  getInventoryReport: (params?: Record<string, any>): ApiResponse<any> => get('/reports/inventory', params),
  getProfitReport: (params?: Record<string, any>): ApiResponse<any> => get('/reports/profit', params),
  getExpenseReportDetail: (params?: Record<string, any>): ApiResponse<any> =>
    get('/reports/expense-detail', params),
  getBranchComparison: (params?: Record<string, any>): ApiResponse<any> =>
    get('/reports/branch-comparison', params),
  getTechniciansReport: (params?: Record<string, any>): ApiResponse<any> => get('/reports/technicians', params),
  getInventoryAging: (params?: Record<string, any>): ApiResponse<any> => get('/reports/inventory-aging', params),

  exportSales: (params?: Record<string, any>): ApiResponse<any> => get('/reports/export-sales', params),
  exportInventory: (params?: Record<string, any>): ApiResponse<any> => get('/reports/export-inventory', params),
};

export const expensesApi = {
  list: (params?: Record<string, any>): ApiResponse<any[]> => get('/expenses', params),
  create: (data: Record<string, any>): ApiResponse<any> => post('/expenses', data),
};

export const integrationLogsApi = {
  list: (params?: Record<string, any>): ApiResponse<any> => get('/integration-logs', params),
};

// PDF DOWNLOAD
export async function downloadPdf(type: string, id: string): Promise<void> {
  const token = readStoredAccessToken();
  const res = await fetch(`${API_BASE}/pdf/${type}/${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) throw new Error('Download failed');

  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${type}-${id}.pdf`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default api;