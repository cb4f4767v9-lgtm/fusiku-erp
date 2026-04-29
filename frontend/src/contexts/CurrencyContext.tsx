import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { companyApi } from '../services/api';
import { FALLBACK_EXCHANGE_RATES, fetchLatestRates, LEDGER_BASE_CURRENCY } from '../services/currencyService';
import { formatCurrencyForUi } from '../utils/formatting';
import { useProviderDebug } from '../utils/providerDebug';

export type CurrencyCode = string;

type CurrencyContextValue = {
  /** User-selected "view currency" used for display/formatting. */
  selectedCurrency: CurrencyCode;
  setSelectedCurrency: (code: CurrencyCode) => void;

  /**
   * System ledger / storage currency (USD). API monetary fields and backend rates pivot on USD.
   * Use this as the `from` currency when converting stored amounts for display.
   */
  ledgerBaseCurrency: CurrencyCode;

  /**
   * @deprecated Use `ledgerBaseCurrency` (same value: USD). Kept for backward compatibility.
   */
  baseCurrency: CurrencyCode;

  /** Company reporting preference from settings (labels only; does not change conversion source). */
  reportingCurrency: CurrencyCode;

  /** FX table: units of code per 1 USD (matches backend `finalRate` map). */
  exchangeRates: Record<CurrencyCode, number>;
  setRate: (code: CurrencyCode, ratePerUsd: number) => void;
  setRates: (ratesByCode: Record<CurrencyCode, number>) => void;

  /** Convert between currencies using ratesByCode. */
  convert: (amount: number, from: CurrencyCode, to: CurrencyCode) => number;

  /** Format money with ISO currency code visible (e.g. AED, USD). */
  formatMoney: (amount: number, currency?: CurrencyCode) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

const LS_SELECTED_CURRENCY = 'fusiku_view_currency';
const LS_FX_RATES = 'fusiku_fx_rates_v1';

function normalizeCode(raw: unknown): CurrencyCode {
  const c = String(raw || '').trim().toUpperCase();
  return c || 'USD';
}

function safeRate(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

function withUsdFallback(rates: Record<CurrencyCode, number>) {
  const out: Record<CurrencyCode, number> = { ...rates };
  out.USD = safeRate(out.USD) || 1;
  return out;
}

function loadRatesFromStorage(): Record<CurrencyCode, number> {
  try {
    const raw = localStorage.getItem(LS_FX_RATES);
    if (!raw) return { USD: 1 };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<CurrencyCode, number> = {};
    for (const [k, v] of Object.entries(parsed || {})) {
      const code = normalizeCode(k);
      const rate = safeRate(v);
      if (code && rate) out[code] = rate;
    }
    return withUsdFallback(out);
  } catch {
    return { USD: 1 };
  }
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  useProviderDebug('CurrencyProvider');
  const { user, token } = useAuth();

  const [selectedCurrency, setSelectedCurrencyState] = useState<CurrencyCode>(() => {
    try {
      return normalizeCode(localStorage.getItem(LS_SELECTED_CURRENCY));
    } catch {
      return 'USD';
    }
  });

  const [ledgerBaseCurrency] = useState<CurrencyCode>(LEDGER_BASE_CURRENCY);
  const [reportingCurrency, setReportingCurrency] = useState<CurrencyCode>(LEDGER_BASE_CURRENCY);
  const [exchangeRates, setExchangeRates] = useState<Record<CurrencyCode, number>>(() => loadRatesFromStorage());

  useEffect(() => {
    const c = user?.currency?.trim().toUpperCase();
    if (!c || c.length !== 3) return;
    setSelectedCurrencyState((prev) => {
      if (prev === c) return prev;
      try {
        localStorage.setItem(LS_SELECTED_CURRENCY, c);
      } catch {
        /* ignore */
      }
      return c;
    });
  }, [user?.currency]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_FX_RATES, JSON.stringify(withUsdFallback(exchangeRates)));
    } catch {
      /* ignore */
    }
  }, [exchangeRates]);

  const setSelectedCurrency = useCallback((code: CurrencyCode) => {
    const next = normalizeCode(code);
    setSelectedCurrencyState(next);
    try {
      localStorage.setItem(LS_SELECTED_CURRENCY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const setRate = useCallback((code: CurrencyCode, ratePerUsd: number) => {
    const c = normalizeCode(code);
    const r = safeRate(ratePerUsd);
    if (!c || !r) return;
    setExchangeRates((prev: Record<CurrencyCode, number>) => withUsdFallback({ ...prev, [c]: r }));
  }, []);

  const setRates = useCallback((nextRates: Record<CurrencyCode, number>) => {
    setExchangeRates(withUsdFallback(nextRates || { USD: 1 }));
  }, []);

  // Company reporting currency (invoices / settings UI); ledger amounts remain USD-pivoted.
  useEffect(() => {
    let cancelled = false;
    const loadReporting = async () => {
      try {
        const s = await companyApi.getSettings();
        const c = normalizeCode((s.data as any)?.baseCurrency || (s.data as any)?.currency);
        if (!cancelled && c) setReportingCurrency(c);
      } catch {
        if (!cancelled) setReportingCurrency(LEDGER_BASE_CURRENCY);
      }
    };
    if (user) void loadReporting();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Live rates refresh (periodic, offline safe) — only after JWT exists (protected API).
  useEffect(() => {
    if (!token) return;
    let alive = true;
    const refresh = async () => {
      try {
        const next = await fetchLatestRates();
        if (!alive) return;
        setExchangeRates(withUsdFallback(next));
      } catch (error) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn('Exchange rate refresh failed, using fallback', error);
        }
        if (!alive) return;
        setExchangeRates(withUsdFallback({ ...FALLBACK_EXCHANGE_RATES }));
      }
    };
    void refresh();
    const id = window.setInterval(refresh, 1000 * 60 * 10);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [token]);

  const convert = useCallback(
    (amount: number, from: CurrencyCode, to: CurrencyCode) => {
      const a = Number(amount);
      if (!Number.isFinite(a)) return 0;
      const f = normalizeCode(from);
      const t = normalizeCode(to);
      if (f === t) return a;
      const fr = safeRate(exchangeRates[f]) || (f === 'USD' ? 1 : 0);
      const tr = safeRate(exchangeRates[t]) || (t === 'USD' ? 1 : 0);
      if (!fr || !tr) return a;
      return a * (tr / fr);
    },
    [exchangeRates]
  );

  const formatMoney = useCallback((amount: number, currency?: CurrencyCode) => {
    const code = normalizeCode(currency || selectedCurrency);
    const n = Number(amount);
    const value = Number.isFinite(n) ? n : 0;
    return formatCurrencyForUi(value, code);
  }, [selectedCurrency]);

  const value = useMemo(
    () => ({
      selectedCurrency,
      setSelectedCurrency,
      ledgerBaseCurrency,
      baseCurrency: ledgerBaseCurrency,
      reportingCurrency,
      exchangeRates,
      setRate,
      setRates,
      convert,
      formatMoney,
    }),
    [
      selectedCurrency,
      setSelectedCurrency,
      ledgerBaseCurrency,
      reportingCurrency,
      exchangeRates,
      setRate,
      setRates,
      convert,
      formatMoney,
    ]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    return {
      selectedCurrency: 'USD' as CurrencyCode,
      setSelectedCurrency: () => {},
      ledgerBaseCurrency: LEDGER_BASE_CURRENCY,
      baseCurrency: LEDGER_BASE_CURRENCY,
      reportingCurrency: LEDGER_BASE_CURRENCY,
      exchangeRates: { USD: 1 },
      setRate: () => {},
      setRates: () => {},
      convert: (amount: number) => Number(amount) || 0,
      formatMoney: (amount: number) => formatCurrencyForUi(Number(amount) || 0, 'USD'),
    };
  }
  return ctx;
}