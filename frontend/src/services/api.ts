import axios, { AxiosResponse } from 'axios';
import {
  clearStoredAccessToken,
  clearStoredRefreshToken,
  persistAccessToken,
  persistRefreshToken,
  readStoredAccessToken,
  readStoredRefreshToken,
  resolveCompanyIdForAuth,
} from '../utils/authSession';

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

/** Must be `/api/v1` (or absolute `.../api/v1`), never `.../api/v1/auth` — auth uses paths `/auth/login`, etc. */
const API_BASE = resolveApiV1BaseUrl();

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});
export type ApiResponse<T = any> = Promise<AxiosResponse<T>>;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refreshToken = readStoredRefreshToken();
    if (!refreshToken) return null;
    try {
      const res = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken }, {
        headers: { 'Content-Type': 'application/json' },
      });
      const data = (res.data && typeof res.data === 'object' && 'data' in res.data)
        ? (res.data as any).data
        : res.data;
      const accessToken = String(data?.token || data?.accessToken || '').trim();
      const nextRefreshToken = String(data?.refreshToken || '').trim();
      if (!accessToken) return null;
      persistAccessToken(accessToken);
      if (nextRefreshToken) persistRefreshToken(nextRefreshToken);
      return accessToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
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

/** Paths where 401 should not force logout / redirect (explicitly public flows). */
function isPublicAuthBypassUrl(url: string) {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh') ||
    url.includes('/signup')
  );
}

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

    if (err?.response?.status === 401) {
      const url = err?.config?.url || '';
      if (isPublicAuthBypassUrl(url)) {
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
      window.location.href = '/login';
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
  updatePreferences: (body: { language?: string; currency?: string }): ApiResponse<any> =>
    patch('/auth/preferences', body),
  /**
   * If `companyId` is `null`, we intentionally DO NOT auto-resolve tenant id from env/localStorage.
   * This allows the login screen to "retry without tenant" when a stale/wrong tenant id is cached.
   */
  login: (email: string, password: string, companyId?: string | null): ApiResponse<any> => {
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
    const body = {
      email: String(email ?? '').trim(),
      password: String(password ?? ''),
      ...(cid ? { companyId: cid } : {}),
      ...(language ? { language } : {}),
      ...(currency ? { currency } : {}),
    };
    return post('/auth/login', body);
  },
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

/** Public SaaS tenant signup — requires `ENABLE_PUBLIC_SIGNUP` on server. Response shape matches login + companyId/userId. */
export const signupApi = {
  createTenant: (payload: {
    companyName: string;
    email: string;
    password: string;
    website?: string;
    businessType?: string;
  }): ApiResponse<{
    companyId: string;
    userId: string;
    token: string;
    refreshToken: string;
    user: { id: string; email: string; name: string; role: string; companyId?: string; branchId?: string; branch?: string };
  }> => post('/signup', payload),
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