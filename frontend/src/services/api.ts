import axios, { AxiosResponse } from 'axios';
import { getApiBaseUrl } from '../config/appConfig';

const API_URL = getApiBaseUrl();

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' }
});
export type ApiResponse<T = any> = Promise<AxiosResponse<T>>;

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      const url = err?.config?.url || '';
      if (url.includes('/auth/login') || url.includes('/auth/register')) {
        return Promise.reject(err);
      }
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

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

// AUTH
export const authApi = {
  login: (email: string, password: string): ApiResponse<any> =>
    post('/auth/login', { email, password }),
  register: (payload: any): ApiResponse<any> => post('/auth/register', payload),
  refresh: (payload: any): ApiResponse<any> => post('/auth/refresh', payload),
  forgotPassword: (email: string): ApiResponse<any> => post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string): ApiResponse<any> =>
    post('/auth/reset-password', { token, password }),
  changePassword: (currentPassword: string, newPassword: string): ApiResponse<any> =>
    post('/auth/change-password', { currentPassword, newPassword }),
};

// SETUP
export const setupApi = {
  getStatus: (): ApiResponse<any> => get('/setup/status'),
  complete: (payload: any): ApiResponse<any> => post('/setup/complete', payload),
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
  inventory: (file: File, branchId: string): ApiResponse<any> => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('branchId', branchId);
    return api.post('/import/inventory', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  suppliers: (file: File): ApiResponse<any> => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/import/suppliers', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  purchases: (file: File, branchId: string, supplierId: string): ApiResponse<any> => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('branchId', branchId);
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
  getDashboard: (params?: Record<string, any>): ApiResponse<any> => get('/reports/dashboard', params),
  getTopSellingModels: (params?: Record<string, any>): ApiResponse<any> => get('/reports/top-selling-models', params),
  getMonthlyRevenue: (params?: Record<string, any>): ApiResponse<any> => get('/reports/monthly-revenue', params),

  getSalesReport: (params?: Record<string, any>): ApiResponse<any> => get('/reports/sales', params),
  getInventoryReport: (params?: Record<string, any>): ApiResponse<any> => get('/reports/inventory', params),
  getProfitReport: (params?: Record<string, any>): ApiResponse<any> => get('/reports/profit', params),
  getTechniciansReport: (params?: Record<string, any>): ApiResponse<any> => get('/reports/technicians', params),
  getInventoryAging: (params?: Record<string, any>): ApiResponse<any> => get('/reports/inventory-aging', params),

  exportSales: (params?: Record<string, any>): ApiResponse<any> => get('/reports/export-sales', params),
  exportInventory: (params?: Record<string, any>): ApiResponse<any> => get('/reports/export-inventory', params),
};

export const integrationLogsApi = {
  list: (params?: Record<string, any>): ApiResponse<any> => get('/integration-logs', params),
};

// PDF DOWNLOAD
export async function downloadPdf(type: string, id: string): Promise<void> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/pdf/${type}/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error('Download failed');

  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${type}-${id}.pdf`;
  a.click();
  URL.revokeObjectURL(a.href);
}