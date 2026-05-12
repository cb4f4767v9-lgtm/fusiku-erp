import { api } from './api';

export type FxRatesByCode = Record<string, number>;

/** Must match backend `LEDGER_BASE_CURRENCY` — amounts & rates pivot on USD. */
export const LEDGER_BASE_CURRENCY = 'USD' as const;

export type LedgerConfigResponse = {
  ledgerBaseCurrency: string;
  ratesPivotCurrency: string;
};

export async function fetchLedgerConfig(): Promise<LedgerConfigResponse> {
  try {
    const res = await api.get<LedgerConfigResponse>('/currencies/ledger-config');
    return res.data || { ledgerBaseCurrency: LEDGER_BASE_CURRENCY, ratesPivotCurrency: LEDGER_BASE_CURRENCY };
  } catch {
    return { ledgerBaseCurrency: LEDGER_BASE_CURRENCY, ratesPivotCurrency: LEDGER_BASE_CURRENCY };
  }
}

export type CurrencyRow = {
  id: string;
  code: string;
  baseRate: number;
  marginPercent: number;
  finalRate: number;
  isAuto: boolean;
  manualRate: number | null;
  lastUpdatedAt: string;
  updatedAt: string;
};

function normalize(code: unknown) {
  return String(code || '').trim().toUpperCase();
}

function safeRate(n: unknown) {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/** Used when the API is down, returns 404/401, or payload is invalid. */
export const FALLBACK_EXCHANGE_RATES: FxRatesByCode = {
  USD: 1,
  AED: 3.67,
  CNY: 7.2,
  PKR: 280,
};

/**
 * Fetch latest FINAL rates from backend if available.
 * Assumes backend rows represent "per USD" final rates (USD pivot).
 * Falls back to a small offline map when API is unavailable.
 */
export async function fetchLatestRates(): Promise<FxRatesByCode> {
  try {
    const res = await api.get<FxRatesByCode>('/currencies/rates');
    const raw = (res.data || {}) as FxRatesByCode;
    const out: FxRatesByCode = { USD: 1 };
    for (const [k, v] of Object.entries(raw)) {
      const c = normalize(k);
      const r = safeRate(v);
      if (c && r) out[c] = r;
    }
    out.USD = safeRate(out.USD) || 1;
    return out;
  } catch (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('Exchange rate failed, using fallback', error);
    }
    return { ...FALLBACK_EXCHANGE_RATES };
  }
}

export async function fetchCurrencies(): Promise<CurrencyRow[]> {
  const res = await api.get<CurrencyRow[]>('/currencies');
  return res.data || [];
}

export async function refreshCurrencies(): Promise<CurrencyRow[]> {
  const res = await api.post<{ rows: CurrencyRow[]; source?: string }>('/currencies/refresh');
  return res.data?.rows || [];
}

/** Admin: push USD-base rates without external APIs. Body: { rates: { CNY: 7.2, EUR: 0.92, ... } } */
export async function manualUpdateCurrencies(rates: Record<string, number>): Promise<CurrencyRow[]> {
  const res = await api.post<{ rows: CurrencyRow[]; source?: string }>('/currencies/manual-update', { rates });
  return res.data?.rows || [];
}

export async function updateCurrency(
  code: string,
  patch: Partial<{ marginPercent: number; isAuto: boolean; manualRate: number | null }>
): Promise<CurrencyRow> {
  const res = await api.patch<CurrencyRow>(`/currencies/${encodeURIComponent(code)}`, patch);
  return res.data as CurrencyRow;
}

