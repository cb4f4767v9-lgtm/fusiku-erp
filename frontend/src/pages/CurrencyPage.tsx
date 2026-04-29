import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getBaseLanguage } from '../utils/i18nLocale';
import { api, companyApi } from '../services/api';
import { forexSidesFromMid } from '../utils/forexDesk';
import { PageLayout, PageHeader } from '../components/design-system';
import { TableSkeleton } from '../components/PageStates';
import { persistDesktopCache } from '../offline/desktopCache';
import { TradingChart } from '../components/TradingChart';

type UiRow = {
  code: string;
  type?: string;
  sourceProvider?: string;
  confidence?: 'live' | 'stale' | 'fallback';
  ageSeconds?: number | null;
  volatility7d?: number;
  isSupplierOverride?: boolean;
  buy: number;
  sell: number;
  lastRate: number | null;
  currentRate: number;
  changePct: number | null;
  marketPrice: number | null;
  xauPricePkr?: number | null;
  xauPriceAed?: number | null;
};

type HistoryPoint = { rate: number; date: string };
type ChartPoint = { time: number; value: number };

type CurrencyCache = {
  ratesByUsd: Record<string, number>;
  lastUpdatedAt: number;
};

const REQUIRED_CURRENCIES = ['USD', 'CNY', 'CNH', 'PKR', 'AED', 'EUR', 'USDT', 'XAU'] as const;
type RequiredCurrency = typeof REQUIRED_CURRENCIES[number];

const CURRENCY_CACHE_KEY = 'fusiku_currency_cache';

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeCode(v: unknown) {
  return String(v || '').trim().toUpperCase();
}

/** Quotes API may return a bare array or `{ rows | data | quotes: [] }` after envelope unwrap. */
function asQuoteRowsPayload(d: unknown): unknown[] {
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object') {
    const o = d as Record<string, unknown>;
    if (Array.isArray(o.rows)) return o.rows;
    if (Array.isArray(o.data)) return o.data;
    if (Array.isArray(o.quotes)) return o.quotes;
  }
  return [];
}

/** `/currencies/rates` is usually a code→rate map; some builds return `{ rows: [...] }`. */
function asRatesMapPayload(d: unknown): Record<string, number> {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return {};
  const o = d as Record<string, unknown>;
  if (Array.isArray(o.rows)) {
    const out: Record<string, number> = { USD: 1 };
    for (const row of o.rows) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const code = normalizeCode(r.code);
      const rate = safeNum(r.finalRate);
      if (code && rate > 0) out[code] = rate;
    }
    return out;
  }
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(o)) {
    if (k === 'rows' || k === 'source' || k === 'message' || k === 'success') continue;
    const code = normalizeCode(k);
    const rate = safeNum(v);
    if (code) out[code] = rate;
  }
  if (!out.USD || out.USD <= 0) out.USD = 1;
  return out;
}

function asHistoryRows(d: unknown): Array<{ rate: number; date: string }> {
  if (!Array.isArray(d)) return [];
  return d.filter((x) => x && typeof x === 'object') as Array<{ rate: number; date: string }>;
}

function formatLastUpdated(ms: number, locale: string): string | null {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  try {
    const d = new Date(ms);
    if (!Number.isFinite(d.getTime())) return null;
    return new Intl.DateTimeFormat(locale, { timeStyle: 'medium' }).format(d);
  } catch {
    return null;
  }
}

function readCurrencyCache(): CurrencyCache | null {
  try {
    const raw = localStorage.getItem(CURRENCY_CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as Partial<CurrencyCache>;
    if (!obj || typeof obj !== 'object') return null;
    const ratesByUsd = obj.ratesByUsd && typeof obj.ratesByUsd === 'object' ? (obj.ratesByUsd as Record<string, unknown>) : null;
    const lastUpdatedAt = Number(obj.lastUpdatedAt);
    if (!ratesByUsd || !Number.isFinite(lastUpdatedAt) || lastUpdatedAt <= 0) return null;
    const out: Record<string, number> = { USD: 1 };
    for (const [k, v] of Object.entries(ratesByUsd)) {
      const code = normalizeCode(k);
      const rate = safeNum(v);
      if (code && rate > 0) out[code] = rate;
    }
    out.USD = out.USD || 1;
    return { ratesByUsd: out, lastUpdatedAt };
  } catch {
    return null;
  }
}

function writeCurrencyCache(cache: CurrencyCache) {
  try {
    localStorage.setItem(CURRENCY_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
  void persistDesktopCache('currency', cache);
}

function buildRowsFromRatesMap(args: {
  ratesByUsd: Record<string, number>;
  baseCurrency: string;
  spreadBps: number;
}): UiRow[] {
  const base = normalizeCode(args.baseCurrency);
  const basePerUsd = base === 'USD' ? 1 : safeNum(args.ratesByUsd[base]);
  if (base !== 'USD' && !basePerUsd) return [];
  return REQUIRED_CURRENCIES
    .filter((c) => normalizeCode(c) !== base)
    .map((c) => {
      const code = normalizeCode(c);
      const rUsd = safeNum(args.ratesByUsd[code]);
      const current = base === 'USD' ? rUsd : rUsd && basePerUsd ? rUsd / basePerUsd : 0;
      const desk = forexSidesFromMid(current, { spreadBps: args.spreadBps });
      return {
        code,
        buy: desk.buyRate,
        sell: desk.sellRate,
        lastRate: null,
        currentRate: current,
        changePct: null,
        marketPrice: null
      } satisfies UiRow;
    });
}

function Sparkline({ points }: { points: HistoryPoint[] }) {
  const vals = (points || []).map((p) => safeNum(p.rate)).filter((x) => Number.isFinite(x) && x > 0);
  if (vals.length < 2) return null;

  const w = 92;
  const h = 22;
  const pad = 1;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const step = vals.length > 1 ? (w - pad * 2) / (vals.length - 1) : w;

  const d = vals
    .map((v, i) => {
      const x = pad + i * step;
      const y = pad + (h - pad * 2) * (1 - (v - min) / span);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const up = vals[vals.length - 1] >= vals[0];
  return (
    <svg className={`fx-sparkline ${up ? 'fx-sparkline--up' : 'fx-sparkline--down'}`} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline points={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function LargeChart({ points }: { points: HistoryPoint[] }) {
  const vals = (points || []).map((p) => safeNum(p.rate)).filter((x) => Number.isFinite(x) && x > 0);
  if (vals.length < 2) return <div className="fx-detail-chart__empty">—</div>;

  const w = 560;
  const h = 180;
  const padX = 12;
  const padY = 10;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const step = (w - padX * 2) / (vals.length - 1);

  const pts = vals
    .map((v, i) => {
      const x = padX + i * step;
      const y = padY + (h - padY * 2) * (1 - (v - min) / span);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const up = vals[vals.length - 1] >= vals[0];
  return (
    <svg
      className={`fx-detail-chart ${up ? 'fx-detail-chart--up' : 'fx-detail-chart--down'}`}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function CurrencyPage() {
  const { t, i18n } = useTranslation();

  const [baseCurrency, setBaseCurrency] = useState<RequiredCurrency>('USD');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'live' | 'cached' | 'fallback' | 'offline'>('offline');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(0);
  const [rows, setRows] = useState<UiRow[]>([]);
  const [spreadBps, setSpreadBps] = useState(0);
  const [historyByCode, setHistoryByCode] = useState<Record<string, HistoryPoint[]>>({});
  const [selectedCurrency, setSelectedCurrency] = useState<string>('PKR');
  const [detailHistory, setDetailHistory] = useState<HistoryPoint[]>([]);
  const [pairSeries, setPairSeries] = useState<ChartPoint[]>([]);

  const setRowsIfNonEmpty = (next: UiRow[] | null | undefined) => {
    if (Array.isArray(next) && next.length > 0) setRows(next);
  };

  useEffect(() => {
    let cancelled = false;
    void companyApi
      .getSettings()
      .then((r) => {
        if (cancelled) return;
        const v = Math.floor(Number((r.data as { spreadBps?: number })?.spreadBps));
        setSpreadBps(Number.isFinite(v) && v >= 0 ? Math.min(v, 50_000) : 0);
      })
      .catch(() => {
        if (!cancelled) setSpreadBps(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // LOAD FROM CACHE FIRST: hydrate from localStorage immediately.
  useEffect(() => {
    const cached = readCurrencyCache();
    if (!cached) return;
    const next = buildRowsFromRatesMap({
      ratesByUsd: cached.ratesByUsd,
      baseCurrency,
      spreadBps
    });
    if (next.length > 0) {
      setRows(next);
      setMode('cached');
      setLastUpdatedAt(cached.lastUpdatedAt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Quotes from backend (USD pivot). Rebases for selected display currency. */
  async function loadLiveRates(nextBase = baseCurrency) {
    setIsLoading(true);

    const base = normalizeCode(nextBase);

    try {
      const res = await api.get<Array<{
        code: string;
        type?: string;
        sourceProvider?: string;
        confidence?: 'live' | 'stale' | 'fallback';
        ageSeconds?: number | null;
        volatility7d?: number;
        isSupplierOverride?: boolean;
        buy: number;
        sell: number;
        lastRate: number | null;
        currentRate: number;
        changePct: number | null;
        lastUpdatedAt: string;
        marketPrice?: number | null;
        xauPricePkr?: number | null;
        xauPriceAed?: number | null;
      }>>('/currencies/quotes');
      const raw = asQuoteRowsPayload(res.data).map((row) => {
        const r = row as Record<string, unknown>;
        return {
        code: normalizeCode(r.code),
        type: r.type ? String(r.type) : undefined,
        sourceProvider: r.sourceProvider ? String(r.sourceProvider) : undefined,
        confidence: r.confidence as 'live' | 'stale' | 'fallback' | undefined,
        ageSeconds: typeof r.ageSeconds === 'number' && Number.isFinite(r.ageSeconds) ? r.ageSeconds : null,
        volatility7d: r.volatility7d != null ? safeNum(r.volatility7d) : undefined,
        isSupplierOverride: Boolean(r.isSupplierOverride),
        buy: safeNum(r.buy),
        sell: safeNum(r.sell),
        lastRate: r.lastRate != null ? safeNum(r.lastRate) : null,
        currentRate: safeNum(r.currentRate),
        changePct: r.changePct != null && Number.isFinite(Number(r.changePct)) ? Number(r.changePct) : null,
        lastUpdatedAt: String(r.lastUpdatedAt ?? ''),
        marketPrice: r.marketPrice != null ? safeNum(r.marketPrice) : null,
        xauPricePkr: r.xauPricePkr != null ? safeNum(r.xauPricePkr) : null,
        xauPriceAed: r.xauPriceAed != null ? safeNum(r.xauPriceAed) : null,
      };
      });

      const byCode = new Map(raw.map((r) => [r.code, r]));
      const baseRow = byCode.get(base);
      const basePerUsd = base === 'USD' ? 1 : safeNum(baseRow?.currentRate);
      if (base !== 'USD' && !basePerUsd) {
        // Keep existing data (do not clear UI); only go offline if we have nothing.
        if (!rows.length) setMode('offline');
        return;
      }

      const rebased = REQUIRED_CURRENCIES
        .filter((c) => normalizeCode(c) !== base)
        .map((c) => {
          const code = normalizeCode(c);
          const r = byCode.get(code);
          const currentUsd = safeNum(r?.currentRate);
          const lastUsd = r?.lastRate != null ? safeNum(r.lastRate) : null;
          const marketUsd = r?.marketPrice != null ? safeNum(r.marketPrice) : null;

          const current = base === 'USD' ? currentUsd : currentUsd && basePerUsd ? currentUsd / basePerUsd : 0;
          const last = lastUsd == null ? null : base === 'USD' ? lastUsd : lastUsd && basePerUsd ? lastUsd / basePerUsd : null;
          const market =
            marketUsd == null
              ? null
              : base === 'USD'
                ? marketUsd
                : marketUsd && basePerUsd
                  ? marketUsd / basePerUsd
                  : null;

          const changePct = last != null && last > 0 ? ((current - last) / last) * 100 : null;
          const desk = forexSidesFromMid(current, { spreadBps });
          return {
            code,
            type: r?.type,
            sourceProvider: r?.sourceProvider,
            confidence: r?.confidence,
            ageSeconds: r?.ageSeconds ?? null,
            volatility7d: r?.volatility7d,
            isSupplierOverride: Boolean(r?.isSupplierOverride),
            buy: desk.buyRate,
            sell: desk.sellRate,
            lastRate: last != null && Number.isFinite(last) && last > 0 ? last : null,
            currentRate: current,
            changePct: changePct == null || !Number.isFinite(changePct) ? null : Number(changePct.toFixed(4)),
            marketPrice: market != null && Number.isFinite(market) && market > 0 ? market : null,
            xauPricePkr: r?.xauPricePkr ?? null,
            xauPriceAed: r?.xauPriceAed ?? null,
          } satisfies UiRow;
        });

      // Guard: never replace table with empty dataset.
      setRowsIfNonEmpty(rebased);
      if (rebased.length > 0) setMode('live');
      const lastUpdateFromServer = raw
        .map((r) => new Date(String(r.lastUpdatedAt || '')).getTime())
        .filter((x) => Number.isFinite(x))
        .sort((a, b) => b - a)[0];
      const lu = Number.isFinite(lastUpdateFromServer) ? lastUpdateFromServer : Date.now();
      setLastUpdatedAt(lu);

      // cache USD-pivot rates for offline use
      const ratesByUsd: Record<string, number> = { USD: 1 };
      for (const r of raw) {
        const code = normalizeCode(r.code);
        const rate = safeNum(r.currentRate);
        if (code && rate > 0) ratesByUsd[code] = rate;
      }
      writeCurrencyCache({ ratesByUsd, lastUpdatedAt: lu });
    } catch (err) {
      // Fallback chain: quotes → rates → cache. Never clears UI.
      try {
        const res = await api.get<Record<string, number>>('/currencies/rates');
        const ratesByUsd = { ...asRatesMapPayload(res.data) };
        const rebased = buildRowsFromRatesMap({ ratesByUsd, baseCurrency: base, spreadBps });
        if (!rebased.length) throw new Error('missing base rate');
        setRowsIfNonEmpty(rebased);
        if (rebased.length > 0) setMode('fallback');
        setLastUpdatedAt(Date.now());
        writeCurrencyCache({ ratesByUsd: { USD: 1, ...ratesByUsd }, lastUpdatedAt: Date.now() });
      } catch (fallbackErr) {
        const cached = readCurrencyCache();
        if (cached) {
          const rebased = buildRowsFromRatesMap({
            ratesByUsd: cached.ratesByUsd,
            baseCurrency: base,
            spreadBps
          });
          if (rebased.length) {
            setRowsIfNonEmpty(rebased);
            setMode('cached');
            setLastUpdatedAt(cached.lastUpdatedAt);
          } else {
            setMode('offline');
          }
        } else {
          setMode('offline');
        }
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadLiveRates(baseCurrency);
    const id = window.setInterval(() => void loadLiveRates(baseCurrency), 60_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseCurrency]);

  // Detail panel chart (fetch deeper history only for the selected currency).
  useEffect(() => {
    let cancelled = false;
    const code = normalizeCode(selectedCurrency);
    if (!code) return;
    void (async () => {
      try {
        const res = await api.get<Array<{ rate: number; date: string }>>(
          `/currencies/${encodeURIComponent(code)}/history?limit=14`
        );
        const pts = asHistoryRows(res.data)
          .map((x) => ({ rate: safeNum(x.rate), date: String(x.date || '') }))
          .filter((p) => p.rate > 0)
          .reverse();
        if (!cancelled) setDetailHistory(pts);
      } catch {
        if (!cancelled) setDetailHistory([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCurrency]);

  // Trading chart: build pair series using CurrencyHistory (USD pivot rebased to baseCurrency).
  useEffect(() => {
    let cancelled = false;
    const base = normalizeCode(baseCurrency);
    const quote = normalizeCode(selectedCurrency);
    if (!quote) return;
    void (async () => {
      try {
        const limit = 90;
        const [qRes, bRes] = await Promise.all([
          api.get<Array<{ rate: number; date: string }>>(`/currencies/${encodeURIComponent(quote)}/history?limit=${limit}`),
          base === 'USD'
            ? Promise.resolve({ data: [] as Array<{ rate: number; date: string }> })
            : api.get<Array<{ rate: number; date: string }>>(`/currencies/${encodeURIComponent(base)}/history?limit=${limit}`),
        ]);
        const qPts = asHistoryRows(qRes.data)
          .map((x) => ({ rate: safeNum(x.rate), t: new Date(String(x.date || '')).getTime() }))
          .filter((p) => p.rate > 0 && Number.isFinite(p.t));
        const bPts =
          base === 'USD'
            ? []
            : asHistoryRows(bRes.data)
                .map((x) => ({ rate: safeNum(x.rate), t: new Date(String(x.date || '')).getTime() }))
                .filter((p) => p.rate > 0 && Number.isFinite(p.t));

        const bByT = new Map(bPts.map((p) => [p.t, p.rate]));
        const series = qPts
          .map((p) => {
            const basePerUsd = base === 'USD' ? 1 : safeNum(bByT.get(p.t));
            const v = base === 'USD' ? p.rate : basePerUsd > 0 ? p.rate / basePerUsd : 0;
            return { time: p.t, value: v };
          })
          .filter((p) => p.value > 0)
          .sort((a, b) => a.time - b.time);

        if (!cancelled) setPairSeries(series);
      } catch {
        if (!cancelled) setPairSeries([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [baseCurrency, selectedCurrency]);

  // Fetch sparklines (last ~7 points) for currently visible rows.
  useEffect(() => {
    let cancelled = false;
    const codes = rows.map((r: UiRow) => normalizeCode(r.code)).filter(Boolean);
    if (!codes.length) return;

    void (async () => {
      const tasks = codes.map(async (code) => {
        try {
          const res = await api.get<Array<{ rate: number; date: string }>>(
            `/currencies/${encodeURIComponent(code)}/history?limit=7`
          );
          const pts = asHistoryRows(res.data)
            .map((x) => ({ rate: safeNum(x.rate), date: String(x.date || '') }))
            .filter((p) => p.rate > 0)
            .reverse(); // oldest->newest for plotting
          return [code, pts] as const;
        } catch {
          return [code, [] as HistoryPoint[]] as const;
        }
      });
      const pairs = await Promise.all(tasks);
      if (cancelled) return;
      setHistoryByCode((prev: Record<string, HistoryPoint[]>) => {
        const next = { ...prev };
        for (const [code, pts] of pairs) next[code] = pts;
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [rows]);

  const fmtRate = useMemo(() => {
    const locale = getBaseLanguage(i18n.resolvedLanguage || i18n.language);
    return (v: number) => {
      if (!Number.isFinite(v) || v <= 0) return '-';
      const abs = Math.abs(v);
      const digits = abs >= 100 ? 2 : abs >= 1 ? 4 : 6;
      return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(v);
    };
  }, [i18n.resolvedLanguage, i18n.language]);

  const uiRows: UiRow[] = useMemo(() => {
    const base = normalizeCode(baseCurrency);
    return rows.filter((r: UiRow) => normalizeCode(r.code) !== base);
  }, [baseCurrency, rows]);

  const selectedRow = useMemo(() => {
    const code = normalizeCode(selectedCurrency);
    return uiRows.find((r) => normalizeCode(r.code) === code) || null;
  }, [uiRows, selectedCurrency]);

  const detail = useMemo(() => {
    if (!selectedRow) return null;
    const change = selectedRow.changePct;
    const dir = change == null ? null : change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
    const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '';
    const your = safeNum(selectedRow.currentRate);
    const market = selectedRow.marketPrice != null ? safeNum(selectedRow.marketPrice) : null;
    const diff = market != null && market > 0 ? your - market : null;
    const diffPct = market != null && market > 0 ? (diff! / market) * 100 : null;

    const conf = selectedRow.confidence || 'fallback';
    const confLabel = conf === 'live' ? 'Live' : conf === 'stale' ? 'Stale' : 'Fallback';
    const ageMin = selectedRow.ageSeconds != null ? Math.floor(Number(selectedRow.ageSeconds) / 60) : null;

    const vol = selectedRow.volatility7d != null ? safeNum(selectedRow.volatility7d) : null;

    return { dir, arrow, market, diff, diffPct, conf, confLabel, ageMin, vol };
  }, [selectedRow]);

  const lastUpdatedLabel = useMemo(
    () => formatLastUpdated(lastUpdatedAt, getBaseLanguage(i18n.resolvedLanguage || i18n.language)),
    [lastUpdatedAt, i18n.resolvedLanguage, i18n.language]
  );

  return (
    <PageLayout className="page page-master-data">
      <PageHeader title={t('currency.title')} subtitle={t('currency.subtitle')} />
      <div className="erp-page-header currency-page-toolbar">
        <div className="currency-page-toolbar__row">
          <div className="currency-page-toolbar__title">
            <span>{t('currency.marketOverview')}</span>
          </div>
          <div className="currency-page-toolbar__spacer" />
          <div className="currency-market-pill">
            <span
              className={`currency-market-status ${
                mode === 'live'
                  ? 'currency-market-status--live'
                  : mode === 'fallback'
                    ? 'currency-market-status--stored'
                    : 'currency-market-status--offline'
              }`}
            />
            <span className="currency-market-status__label">
              {mode === 'live'
                ? t('currency.liveMarket')
                : mode === 'fallback' || mode === 'cached'
                  ? t('currency.usingStoredRates')
                  : t('currency.offlineMode')}
            </span>
          </div>
          <div className="currency-page-toolbar__label">{t('currency.baseCurrency')}:</div>
          <select
            className="input erp-input-compact"
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(normalizeCode(e.target.value) as RequiredCurrency)}
            aria-label={t('currency.baseCurrency')}
          >
            {REQUIRED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <button
            className="btn btn-secondary btn-erp"
            onClick={async () => {
              await loadLiveRates(baseCurrency);
            }}
            disabled={isLoading}
          >
            {isLoading ? t('common.loading') : t('common.refresh')} ⟳
          </button>

          {lastUpdatedLabel ? (
            <span className="currency-page-toolbar__updated">
              {t('currency.lastUpdated')}: {lastUpdatedLabel}
            </span>
          ) : null}
        </div>
      </div>

      {mode === 'cached' || mode === 'fallback' ? (
        <div className="card currency-info-card">
          <div className="currency-info-card__title">{t('currency.usingSavedRates')}</div>
          <div className="currency-info-card__detail">{t('currency.usingSavedRatesDetail')}</div>
        </div>
      ) : null}

      {!isLoading && uiRows.length === 0 ? (
        <div className="card currency-error-card">
          <div className="currency-error-card__title">{t('currency.noCurrencyDataYet')}</div>
          <div className="currency-error-card__detail">
            {t('currency.noCurrencyDataYetDetail')}
          </div>
        </div>
      ) : null}

      {isLoading && uiRows.length === 0 ? (
        <div className="currency-page-skeleton" aria-busy="true">
          <TableSkeleton rows={6} cols={7} />
        </div>
      ) : null}

      <div className="fx-terminal">
        <div className="card fx-terminal__pairs">
          <div className="fx-terminal__pairs-header">
            <div className="fx-terminal__pairs-title">Pairs</div>
            <div className="fx-terminal__pairs-sub">{`${baseCurrency}/…`}</div>
          </div>
          <div className="fx-terminal__pairs-list">
            {uiRows.map((r) => {
              const code = normalizeCode(r.code);
              const isSelected = code === normalizeCode(selectedCurrency);
              const tag =
                String(r.type || 'forex') === 'crypto'
                  ? 'Crypto'
                  : String(r.type || 'forex') === 'commodity'
                    ? 'Gold'
                    : String(r.type || 'forex') === 'supplier'
                      ? 'Supplier'
                      : 'Forex';
              const conf = r.confidence || 'fallback';
              const confDot =
                conf === 'live' ? 'fx-conf-dot fx-conf-dot--live' : conf === 'stale' ? 'fx-conf-dot fx-conf-dot--stale' : 'fx-conf-dot';
              const vol = r.volatility7d != null ? safeNum(r.volatility7d) : 0;
              return (
                <button
                  key={r.code}
                  type="button"
                  className={`fx-pair-row ${isSelected ? 'fx-pair-row--active' : ''} ${
                    r.isSupplierOverride ? 'fx-pair-row--supplier' : ''
                  }`}
                  onClick={() => setSelectedCurrency(code)}
                >
                  <div className="fx-pair-row__left">
                    <div className="fx-pair-row__code">
                      <span className={confDot} aria-hidden="true" />
                      <span>{code}</span>
                    </div>
                    <div className="fx-pair-row__meta">
                      <span className="fx-pill">{tag}</span>
                      {r.isSupplierOverride ? <span className="fx-pill fx-pill--warn">Override</span> : null}
                    </div>
                  </div>
                  <div className="fx-pair-row__right">
                    <div className="fx-pair-row__px">{fmtRate(r.currentRate)}</div>
                    <div className="fx-pair-row__sub">
                      <span className="fx-subtle">{r.sourceProvider || '—'}</span>
                      <span className="fx-subtle">{vol > 0 ? `vol7d ${(vol * 100).toFixed(2)}%` : 'vol7d —'}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card fx-terminal__chart">
          <div className="fx-terminal__chart-header">
            <div className="fx-terminal__chart-title">{`${baseCurrency}/${selectedCurrency}`}</div>
            <div className="fx-terminal__chart-sub">
              <span className="fx-subtle">{detail?.confLabel || '—'}</span>
              {detail?.ageMin != null ? <span className="fx-subtle">{`${detail.ageMin}m`}</span> : null}
              {detail?.vol != null && detail.vol > 0 ? <span className="fx-subtle">{`vol7d ${(detail.vol * 100).toFixed(2)}%`}</span> : null}
            </div>
          </div>
          <TradingChart points={pairSeries} height={340} label="CurrencyHistory (rebased)" />
        </div>

        <div className="card fx-terminal__panel">
          <div className="fx-panel__section">
            <div className="fx-panel__title">Quote</div>
            <div className="fx-panel__kpis">
              <div className="fx-panel-kpi">
                <div className="fx-panel-kpi__label">{t('currency.currentRate')}</div>
                <div className="fx-panel-kpi__value">{selectedRow ? fmtRate(selectedRow.currentRate) : '—'}</div>
              </div>
              <div className="fx-panel-kpi">
                <div className="fx-panel-kpi__label">{t('currency.buyRate')}</div>
                <div className="fx-panel-kpi__value">{selectedRow ? fmtRate(selectedRow.buy) : '—'}</div>
              </div>
              <div className="fx-panel-kpi">
                <div className="fx-panel-kpi__label">{t('currency.sellRate')}</div>
                <div className="fx-panel-kpi__value">{selectedRow ? fmtRate(selectedRow.sell) : '—'}</div>
              </div>
            </div>
          </div>

          <div className="fx-panel__section">
            <div className="fx-panel__title">Gold (XAU)</div>
            {rows.find((x) => normalizeCode(x.code) === 'XAU') ? (
              (() => {
                const xau = rows.find((x) => normalizeCode(x.code) === 'XAU')!;
                const usdPerXau = xau.marketPrice != null ? safeNum(xau.marketPrice) : null;
                return (
                  <div className="fx-gold-grid">
                    <div className="fx-gold-kpi">
                      <div className="fx-gold-kpi__label">USD / XAU</div>
                      <div className="fx-gold-kpi__value">{usdPerXau != null && usdPerXau > 0 ? fmtRate(usdPerXau) : '—'}</div>
                    </div>
                    <div className="fx-gold-kpi">
                      <div className="fx-gold-kpi__label">PKR / XAU</div>
                      <div className="fx-gold-kpi__value">{xau.xauPricePkr != null && xau.xauPricePkr > 0 ? fmtRate(xau.xauPricePkr) : '—'}</div>
                    </div>
                    <div className="fx-gold-kpi">
                      <div className="fx-gold-kpi__label">AED / XAU</div>
                      <div className="fx-gold-kpi__value">{xau.xauPriceAed != null && xau.xauPriceAed > 0 ? fmtRate(xau.xauPriceAed) : '—'}</div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="fx-subtle">—</div>
            )}
          </div>

          <div className="fx-panel__section">
            <div className="fx-panel__title">USDT path</div>
            {(() => {
              const usdt = rows.find((x) => normalizeCode(x.code) === 'USDT');
              const q = selectedRow;
              if (!usdt || !q) return <div className="fx-subtle">—</div>;
              // Multi-hop: base -> USD -> USDT and base -> USD -> quote; display quote per 1 USDT when base=USD.
              const usdtPerBase =
                normalizeCode(baseCurrency) === 'USD' ? safeNum(usdt.currentRate) : 0; // only accurate when base=USD in this simplified panel
              return (
                <div className="fx-subtle">
                  {normalizeCode(baseCurrency) === 'USD'
                    ? `1 USD = ${fmtRate(usdtPerBase)} USDT`
                    : 'Switch base to USD to view path details.'}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
