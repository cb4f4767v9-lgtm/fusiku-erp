import { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { inventoryApi, branchesApi, importApi, imeiApi, warrantyApi, aiApi, api } from '../services/api';
import toast from 'react-hot-toast';
import { ChevronDown, ChevronRight, Eye, Pencil, Plus, Trash2, Upload, X, History, AlertTriangle, Boxes, Download, Printer } from 'lucide-react';
import { getErrorMessage } from '../utils/getErrorMessage';
import { useCurrency } from '../contexts/CurrencyContext';
import { EmptyState, PageLayout, PageHeader, TableWrapper } from '../components/design-system';
import { ErrorState, TableSkeleton } from '../components/PageStates';
import { useSaasCommercialGate } from '../hooks/useSaasCommercialGate';
import { enqueueIfOfflineDesktop } from '../offline/outboxEnqueue';
import { OUTBOX_KIND } from '../offline/outboxKinds';
import { persistDesktopCache, readDesktopCache } from '../offline/desktopCache';
import { useInputLanguage } from '../hooks/useInputLanguage';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAuth } from '../hooks/useAuth';
import { canAccessBranch, isSuperAdmin } from '../utils/permissions';
import { formatDateForUi, formatDateTimeForUi } from '../utils/formatting';
import { useLocation } from 'react-router-dom';
import { useBranchContext } from '../contexts/BranchContext';
import { BRANDS, normalizeBrandCode, resolveBrandName } from '../constants/brands';

export function InventoryPage() {
  const { t } = useTranslation();
  const inputLang = useInputLanguage();
  const { user } = useAuth();
  const location = useLocation();
  const { selectedBranchId, locked: branchLocked, branches: branchList } = useBranchContext();
  const { commercialWritesAllowed } = useSaasCommercialGate();
  const { formatMoney, convert, selectedCurrency, ledgerBaseCurrency } = useCurrency();
  const [items, setItems] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    brandCode: '',
  });
  const [form, setForm] = useState({
    imei: '', brand: '', model: '', storage: '', color: '', condition: 'refurbished',
    purchasePrice: '', sellingPrice: '', branchId: '', notes: ''
  });
  const [warrantyCheckImei, setWarrantyCheckImei] = useState('');
  const [warrantyResult, setWarrantyResult] = useState<any>(null);
  const [priceEstimate, setPriceEstimate] = useState<any>(null);
  const [imeiHistoryImei, setImeiHistoryImei] = useState<string | null>(null);
  const [imeiHistory, setImeiHistory] = useState<any[]>([]);
  const [priceOptMap, setPriceOptMap] = useState<Record<string, { recommendedPrice: number; confidenceScore: number; status?: string }>>({});
  const [inventoryRiskAlerts, setInventoryRiskAlerts] = useState<any[]>([]);
  const [pricingCtxByImei, setPricingCtxByImei] = useState<Record<string, any>>({});
  const [ratesByUsd, setRatesByUsd] = useState<Record<string, number>>({ USD: 1 });
  const [defaultMarginPct, setDefaultMarginPct] = useState<number>(20);
  const [prevRateByUsd, setPrevRateByUsd] = useState<Record<string, number>>({ USD: 1 });
  const [fxRateUpdatedAt, setFxRateUpdatedAt] = useState<number>(0);

  const buildInventoryParams = useCallback(() => {
    // Branch is global context. For restricted users it's locked (and backend enforces it anyway).
    // For super admins, empty string means "All branches".
    const params: Record<string, string> = {};
    const q = String(filters.search || '').trim();
    if (q) params.search = q;
    if (filters.status) params.status = String(filters.status);
    if (filters.brandCode) {
      // Backend expects `brand` as string. Use canonical brand name.
      const hit = BRANDS.find((b) => b.code === filters.brandCode);
      if (hit) params.brand = hit.name;
    }
    if (isSuperAdmin(user) && selectedBranchId) params.branchId = String(selectedBranchId);
    return params;
  }, [filters.search, filters.status, filters.brandCode, user, selectedBranchId]);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      void (async () => {
        const cached = await readDesktopCache<unknown[]>('inventory');
        if (cached && Array.isArray(cached)) {
          setItems(cached);
          setLoadError(false);
        } else {
          setItems([]);
          setLoadError(true);
        }
        setLoading(false);
      })();
      return;
    }
    inventoryApi
      .getAll(buildInventoryParams())
      .then((r) => {
        setItems(r.data);
        setLoadError(false);
        void persistDesktopCache('inventory', r.data);
      })
      .catch(() => {
        setItems([]);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [buildInventoryParams]);

  const lookupImei = useCallback(async (imei: string) => {
    if (imei.replace(/\D/g, '').length >= 8) {
      try {
        const { data } = await imeiApi.lookup(imei);
        if (data?.brand || data?.model) {
          setForm((f) => ({
            ...f,
            brand: data.brand || f.brand,
            model: data.model || f.model,
            storage: data.storage || f.storage,
            color: data.color || f.color
          }));
        }
      } catch (err) {
        if (import.meta.env.DEV) console.warn('imei lookup failed', err);
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // UI-only deep link: /inventory?new=1 opens the "Add item" modal.
    const params = new URLSearchParams(location.search);
    if (params.get('new') === '1') {
      setShowForm(true);
    }
  }, [location.search]);

  useEffect(() => {
    const params = isSuperAdmin(user) && selectedBranchId ? { branchId: selectedBranchId } : {};
    aiApi
      .businessIntelligence(params)
      .then((r) => setInventoryRiskAlerts(r.data?.inventoryRiskAlerts || []))
      .catch((err) => {
        if (import.meta.env.DEV) console.warn('inventory risk alerts failed', err);
        setInventoryRiskAlerts([]);
      });
  }, [selectedBranchId, user]);

  useEffect(() => {
    branchesApi
      .getAll()
      .then((r) => setBranches(r.data))
      .catch((err) => {
        if (import.meta.env.DEV) console.warn('branches load failed', err);
        setBranches([]);
      });
  }, []);

  // Map for fast branch name resolution.
  const branchNameById = useMemo(() => {
    const list = (branchList?.length ? branchList : branches) || [];
    const m = new Map<string, string>();
    for (const b of list) {
      const id = String((b as any).id || '').trim();
      const name = String((b as any).name || (b as any).code || '').trim();
      if (id && name) m.set(id, name);
    }
    return m;
  }, [branchList, branches]);

  useEffect(() => {
    let cancelled = false;
    const fetchRates = async () => {
      try {
        const r = await api.get<Record<string, number>>('/currencies/rates');
        if (cancelled) return;
        setPrevRateByUsd((prev) => ({ ...prev, ...ratesByUsd }));
        setRatesByUsd({ USD: 1, ...(r.data || {}) });
        setFxRateUpdatedAt(Date.now());
      } catch (err) {
        if (import.meta.env.DEV) console.warn('inventory FX rates fetch failed', err);
        if (!cancelled) {
          setFxRateUpdatedAt(Date.now());
          setRatesByUsd((m) => ({ USD: 1, ...m }));
        }
      }
    };
    void fetchRates();
    const id = window.setInterval(() => void fetchRates(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (form.brand && form.model) {
      aiApi.priceEstimate({
        brand: form.brand,
        model: form.model,
        storage: form.storage,
        condition: form.condition,
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : undefined
      })
        .then((r) => setPriceEstimate(r.data))
        .catch((err) => {
          if (import.meta.env.DEV) console.warn('price estimate failed', err);
          setPriceEstimate(null);
        });
    } else setPriceEstimate(null);
  }, [form.brand, form.model, form.storage, form.condition, form.purchasePrice]);

  useEffect(() => {
    if (imeiHistoryImei) {
      imeiApi
        .getHistory(imeiHistoryImei)
        .then((r) => setImeiHistory(r.data || []))
        .catch((err) => {
          if (import.meta.env.DEV) console.warn('imei history failed', err);
          setImeiHistory([]);
        });
    } else setImeiHistory([]);
  }, [imeiHistoryImei]);

  useEffect(() => {
    const slice = items.filter((i) => i.status === 'available').slice(0, 10);
    if (slice.length === 0) {
      setPriceOptMap({});
      return;
    }
    const map: Record<string, { recommendedPrice: number; confidenceScore: number; status?: string }> = {};
    Promise.all(
      slice.map(async (i) => {
        try {
          const { data } = await aiApi.priceOptimize({
            brand: i.brand,
            model: i.model,
            storage: i.storage,
            condition: i.condition,
            currentPrice: Number(i.sellingPrice),
            inventoryAgeDays: i.createdAt ? Math.floor((Date.now() - new Date(i.createdAt).getTime()) / (24 * 60 * 60 * 1000)) : undefined
          });
          map[i.id] = { recommendedPrice: data.recommendedPrice, confidenceScore: data.confidenceScore ?? 0, status: data.status };
        } catch (err) {
          if (import.meta.env.DEV) console.warn('price optimize failed', err);
        }
      })
    ).then(() => setPriceOptMap((prev) => ({ ...prev, ...map })));
  }, [items]);

  useEffect(() => {
    const imeis = [...new Set(items.map((i) => String(i.imei || '').trim()).filter(Boolean))].slice(0, 200);
    if (imeis.length === 0) {
      setPricingCtxByImei({});
      return;
    }
    const qs = imeis.join(',');
    api
      .get<Record<string, any>>('/inventory/pricing-context', { params: { imeis: qs } } as any)
      .then((r) => setPricingCtxByImei(r.data || {}))
      .catch((err) => {
        if (import.meta.env.DEV) console.warn('pricing context failed', err);
        setPricingCtxByImei({});
      });
  }, [items]);

  const safeNum = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const curCode = String(selectedCurrency || 'USD').toUpperCase();
  const currentRate = safeNum(ratesByUsd[curCode]) || 1;
  const prevRate = safeNum(prevRateByUsd[curCode]) || currentRate;

  const viewMoney = (amountUsd: number) =>
    formatMoney(convert(safeNum(amountUsd), ledgerBaseCurrency, selectedCurrency), selectedCurrency);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commercialWritesAllowed) {
      toast.error(t('saas.actionBlocked'));
      return;
    }
    if (!isSuperAdmin(user) && form.branchId && !canAccessBranch(user, form.branchId)) {
      toast.error(t('common.noAccessFeature', { defaultValue: "You don’t have access to this feature" }));
      return;
    }
    try {
      const body = {
        ...form,
        purchasePrice: Number(form.purchasePrice),
        sellingPrice: Number(form.sellingPrice),
      };
      if (await enqueueIfOfflineDesktop(OUTBOX_KIND.INVENTORY_CREATE, body)) {
        toast.success(t('offline.inventoryQueuedOffline'));
        setShowForm(false);
        setForm({
          imei: '',
          brand: '',
          model: '',
          storage: '',
          color: '',
          condition: 'refurbished',
          purchasePrice: '',
          sellingPrice: '',
          branchId: '',
          notes: '',
        });
        load();
        return;
      }
      await inventoryApi.create(body);
      toast.success(t('inventory.itemAdded'));
      setShowForm(false);
      setForm({ imei: '', brand: '', model: '', storage: '', color: '', condition: 'refurbished', purchasePrice: '', sellingPrice: '', branchId: '', notes: '' });
      load();
    } catch (err: any) {
      toast.error(getErrorMessage(err, t('common.failed')));
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!commercialWritesAllowed) {
      toast.error(t('saas.actionBlocked'));
      e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    const branchId = isSuperAdmin(user) ? (form.branchId || branches[0]?.id) : (user?.branchId || branches[0]?.id);
    if (!file || !branchId) {
      toast.error(t('inventory.selectFileAndBranch'));
      return;
    }
    try {
      const { data } = await importApi.inventory(file, branchId);
      toast.success(t('inventory.importedItems', { success: data.success, failed: data.failed }));
      setShowImport(false);
      load();
    } catch (err: any) {
      toast.error(getErrorMessage(err, t('inventory.importFailed')));
    }
    e.target.value = '';
  };

  const warrantyActive = warrantyResult
    ? (warrantyResult.isActive ?? new Date() <= new Date(warrantyResult.warrantyEnd))
    : false;
  const runWarrantyCheck = () =>
    warrantyApi
      .getByImei(warrantyCheckImei)
      .then((r) => setWarrantyResult(r.data))
      .catch((err) => {
        if (import.meta.env.DEV) console.warn('warranty check failed', err);
        setWarrantyResult(null);
      });

  usePageTitle('inventory.title');

  // -------------------- Product list view (grouped) --------------------
  type ProductRow = {
    key: string;
    name: string;
    branchId: string | null;
    branchName: string;
    status: string;
    stock: number;
    sellingPriceAvgUsd: number;
    sample: any;
    secondary: {
      brand: string;
      model: string;
      variant: string;
    };
    sampleImeis: string[];
  };

  const productRows: ProductRow[] = useMemo(() => {
    const rows = Array.isArray(items) ? items : [];
    const byKey = new Map<string, ProductRow>();

    for (const it of rows) {
      const brand = String(it?.brand || '').trim();
      const model = String(it?.model || '').trim();
      const storage = String(it?.storage || '').trim();
      const color = String(it?.color || '').trim();
      const condition = String(it?.condition || '').trim();
      const branchId = String(it?.branchId || '').trim() || null;
      const status = String(it?.status || '').trim() || 'unknown';
      const imei = String(it?.imei || '').trim();

      const brandName = resolveBrandName(brand);
      const variantParts = [storage, color, condition].filter(Boolean);
      const variant = variantParts.join(' · ');
      const name = [brandName, model, variant].filter(Boolean).join(' — ');

      const k = [
        normalizeBrandCode(brandName),
        model.toLowerCase(),
        variant.toLowerCase(),
        branchId || 'all',
        status,
      ].join('|');

      const hit = byKey.get(k);
      const sellingUsd = Number(it?.sellingPrice) || 0;
      if (!hit) {
        byKey.set(k, {
          key: k,
          name: name || t('inventory.unknownItem', { defaultValue: 'Unknown item' }),
          branchId,
          branchName: branchId ? (branchNameById.get(branchId) || '—') : '—',
          status,
          stock: 1,
          sellingPriceAvgUsd: sellingUsd,
          sample: it,
          secondary: { brand: brandName, model, variant },
          sampleImeis: imei ? [imei] : [],
        });
      } else {
        hit.stock += 1;
        hit.sellingPriceAvgUsd = (hit.sellingPriceAvgUsd * (hit.stock - 1) + sellingUsd) / hit.stock;
        if (imei && hit.sampleImeis.length < 5) hit.sampleImeis.push(imei);
      }
    }

    let out = [...byKey.values()];

    // Client-side filtering (fast, consistent UX; backend filtering already applied too).
    const q = String(filters.search || '').trim().toLowerCase();
    if (q) out = out.filter((r) => r.name.toLowerCase().includes(q));
    if (filters.status) out = out.filter((r) => r.status === filters.status);
    if (filters.brandCode) {
      const hit = BRANDS.find((b) => b.code === filters.brandCode);
      const bn = String(hit?.name || '').toLowerCase();
      if (bn) out = out.filter((r) => r.secondary.brand.toLowerCase() === bn);
    }

    // Stable ordering: name, then branch, then status.
    out.sort((a, b) => a.name.localeCompare(b.name) || a.branchName.localeCompare(b.branchName) || a.status.localeCompare(b.status));
    return out;
  }, [items, filters.search, filters.status, filters.brandCode, branchNameById, t]);

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState<number>(1);

  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.status, filters.brandCode, selectedBranchId]);

  const pageCount = Math.max(1, Math.ceil(productRows.length / Math.max(1, pageSize)));
  const clampedPage = Math.min(pageCount, Math.max(1, page));
  const pagedRows = productRows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  return (
    <PageLayout className="page">
      <PageHeader
        title={t('inventory.title')}
        subtitle={t('inventory.subtitle')}
        actions={
          <div className="inventory-header-actions">
            <div className="inventory-toolbar-cluster">
              <span className="inventory-toolbar-label">{t('currency.displayCurrency')}</span>
              <span className="inventory-toolbar-value">{curCode}</span>
              <label className="inventory-toolbar-field">
                <span className="inventory-toolbar-label">{t('inventory.marginPercent')}</span>
                <input
                  type="number"
                  value={defaultMarginPct}
                  onChange={(e) => setDefaultMarginPct(Math.max(0, Math.min(200, Number(e.target.value) || 0)))}
                  className="input erp-input-compact inventory-toolbar-input-num"
                  lang={inputLang}
                />
              </label>
            </div>
            <div className="inventory-toolbar-cluster inventory-warranty-row">
              <input
                placeholder={t('inventory.checkWarrantyByImei')}
                value={warrantyCheckImei}
                onChange={(e) => {
                  setWarrantyCheckImei(e.target.value);
                  setWarrantyResult(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && runWarrantyCheck()}
                className="input erp-input-compact inventory-warranty-input"
                lang={inputLang}
              />
              <button type="button" className="btn btn-secondary" onClick={() => runWarrantyCheck()}>
                {t('inventory.check')}
              </button>
            </div>
            {warrantyResult ? (
              <div
                className={`warranty-result-banner ${warrantyActive ? 'warranty-result-banner--active' : 'warranty-result-banner--expired'}`}
              >
                {warrantyActive ? t('inventory.warrantyActive') : t('inventory.warrantyExpired')} — {t('inventory.warrantyUntil')}{' '}
                {formatDateForUi(warrantyResult.warrantyEnd)}
              </div>
            ) : null}
            <button
              type="button"
              className="btn btn-secondary ds-has-tooltip"
              data-tooltip={t('common.export', { defaultValue: 'Export (coming soon)' })}
              onClick={() => toast(t('common.comingSoon', { defaultValue: 'Coming soon' }))}
            >
              <Download size={18} /> {t('common.export', { defaultValue: 'Export' })}
            </button>
            <button
              type="button"
              className="btn btn-secondary ds-has-tooltip"
              data-tooltip={t('common.print', { defaultValue: 'Print (coming soon)' })}
              onClick={() => toast(t('common.comingSoon', { defaultValue: 'Coming soon' }))}
            >
              <Printer size={18} /> {t('common.print', { defaultValue: 'Print' })}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowImport(true)}
              disabled={!commercialWritesAllowed}
            >
              <Upload size={18} /> {t('inventory.import')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowForm(true)}
              disabled={!commercialWritesAllowed}
            >
              <Plus size={18} /> {t('inventory.addItem')}
            </button>
          </div>
        }
      />
      {loadError ? (
        <ErrorState message={t('inventory.unableToLoad')} hint={t('inventory.loadHint')} onRetry={load} />
      ) : null}
      {inventoryRiskAlerts.length > 0 ? (
        <div className="inventory-alerts-section">
          <h3 className="inventory-alerts-section__title">
            <AlertTriangle size={18} aria-hidden /> {t('inventory.inventoryRiskAlerts')}
          </h3>
          <ul className="inventory-alerts-section__list">
            {inventoryRiskAlerts.slice(0, 5).map((r: any, i: number) => (
              <li key={i} className="inventory-alerts-section__item">
                {r.brand} {r.model} — {r.daysInStock} {t('inventory.daysInStock')}: {r.suggestion}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="filters filters-advanced">
        <input
          placeholder={t('inventory.searchPlaceholder')}
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          className="filter-input inventory-filter-search"
          lang={inputLang}
        />
        <select
          value={filters.brandCode}
          onChange={(e) => setFilters((f) => ({ ...f, brandCode: e.target.value }))}
          lang={inputLang}
        >
          <option value="">{t('inventory.brand', { defaultValue: 'Brand' })}</option>
          {BRANDS.map((b) => (
            <option key={b.code} value={b.code}>
              {b.name}
            </option>
          ))}
        </select>
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} lang={inputLang}>
          <option value="">{t('inventory.allStatus')}</option>
          <option value="available">{t('inventory.available')}</option>
          <option value="sold">{t('inventory.sold')}</option>
          <option value="in_repair">{t('inventory.inRepair')}</option>
        </select>
        {branchLocked ? (
          <span className="muted" style={{ alignSelf: 'center' }}>
            {t('branches.lockedToBranch', { defaultValue: 'Locked to your branch' })}
          </span>
        ) : selectedBranchId ? (
          <span className="muted" style={{ alignSelf: 'center' }}>
            {t('branches.branch', { defaultValue: 'Branch' })}: {branchNameById.get(selectedBranchId) || '—'}
          </span>
        ) : (
          <span className="muted" style={{ alignSelf: 'center' }}>
            {t('branches.allBranches', { defaultValue: 'All branches' })}
          </span>
        )}
      </div>
      {loading && !loadError ? (
        <TableSkeleton rows={8} cols={14} />
      ) : loadError ? null : productRows.length === 0 ? (
        <EmptyState
          icon={<Boxes />}
          title={t('inventory.noItems', { defaultValue: 'No products yet' })}
          description={t('inventory.noItemsHint', {
            defaultValue: 'Add your first device to start selling, tracking margin, and getting AI pricing suggestions.',
          })}
          action={
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowForm(true)}
                disabled={!commercialWritesAllowed}
              >
                <Plus size={16} /> {t('inventory.addItem')}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowImport(true)}
                disabled={!commercialWritesAllowed}
              >
                <Upload size={16} /> {t('common.import')}
              </button>
            </div>
          }
        />
      ) : (
        <TableWrapper>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 32 }} aria-hidden />
                <th>{t('inventory.productName', { defaultValue: 'Product' })}</th>
                <th className="num">{t('inventory.stock', { defaultValue: 'Stock' })}</th>
                <th className="num">{t('inventory.selling', { defaultValue: 'Selling Price' })}</th>
                <th>{t('branches.branch', { defaultValue: 'Branch' })}</th>
                <th>{t('inventory.status', { defaultValue: 'Status' })}</th>
                <th style={{ width: 140 }}>{t('common.actions', { defaultValue: 'Actions' })}</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((r) => {
                const open = expandedKey === r.key;
                return (
                  <>
                    <tr key={r.key}>
                      <td>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={open ? t('common.collapse', { defaultValue: 'Collapse' }) : t('common.expand', { defaultValue: 'Expand' })}
                          onClick={() => setExpandedKey(open ? null : r.key)}
                        >
                          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </td>
                      <td style={{ fontWeight: 600 }}>{r.name}</td>
                      <td className="num">{r.stock}</td>
                      <td className="num">{viewMoney(r.sellingPriceAvgUsd)}</td>
                      <td>{r.branchName}</td>
                      <td>
                        <span className={`badge badge-${r.status}`}>
                          {t(`inventory.statusValues.${r.status}`, { defaultValue: String(r.status) })}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button type="button" className="btn btn-sm" onClick={() => setExpandedKey(open ? null : r.key)} title={t('common.view', { defaultValue: 'View' })}>
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            title={t('common.edit', { defaultValue: 'Edit' })}
                            onClick={() => toast(t('common.comingSoon', { defaultValue: 'Coming soon' }))}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            title={t('common.delete', { defaultValue: 'Delete' })}
                            onClick={() => toast(t('common.comingSoon', { defaultValue: 'Coming soon' }))}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {open ? (
                      <tr key={`${r.key}:details`}>
                        <td colSpan={7} style={{ background: 'rgba(15, 23, 42, 0.02)' }}>
                          <div style={{ padding: '10px 12px', display: 'grid', gap: 8 }}>
                            <div className="muted" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                              <span><strong>{t('inventory.brand', { defaultValue: 'Brand' })}:</strong> {r.secondary.brand || '—'}</span>
                              <span><strong>{t('inventory.model', { defaultValue: 'Model' })}:</strong> {r.secondary.model || '—'}</span>
                              <span><strong>{t('inventory.variant', { defaultValue: 'Variant' })}:</strong> {r.secondary.variant || '—'}</span>
                            </div>
                            {r.sampleImeis.length ? (
                              <div className="muted">
                                <strong>{t('inventory.sampleImeis', { defaultValue: 'Sample IMEIs' })}:</strong> {r.sampleImeis.join(', ')}
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </>
                );
              })}
            </tbody>
          </table>
          <div className="erp-pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 4px' }}>
            <div className="muted" style={{ fontSize: 13 }}>
              {t('common.showing', { defaultValue: 'Showing' })}{' '}
              <strong>
                {productRows.length ? (clampedPage - 1) * pageSize + 1 : 0}–{Math.min(clampedPage * pageSize, productRows.length)}
              </strong>{' '}
              {t('common.of', { defaultValue: 'of' })} <strong>{productRows.length}</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value) || 20)} aria-label="Page size">
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n} / {t('common.page', { defaultValue: 'page' })}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={clampedPage <= 1}>
                {t('common.prev', { defaultValue: 'Prev' })}
              </button>
              <span className="muted" style={{ fontSize: 13 }}>
                {clampedPage} / {pageCount}
              </span>
              <button type="button" className="btn btn-secondary" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={clampedPage >= pageCount}>
                {t('common.next', { defaultValue: 'Next' })}
              </button>
            </div>
          </div>
        </TableWrapper>
      )}
      {showForm && (
        <div className="modal-overlay inventory-add-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal inventory-add-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('inventory.addInventoryItem')}</h2>
              <button type="button" aria-label={t('common.close')} onClick={() => setShowForm(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form inventory-add-modal__form">
              <label className="inventory-add-modal__field">
                <span className="inventory-add-modal__label">{t('inventory.imei')}</span>
                <input
                  required
                  placeholder={t('inventory.imeiAutoFills')}
                  value={form.imei}
                  onChange={(e) => setForm((f) => ({ ...f, imei: e.target.value }))}
                  onBlur={(e) => lookupImei(e.target.value)}
                  lang={inputLang}
                />
              </label>
              <label className="inventory-add-modal__field">
                <span className="inventory-add-modal__label">{t('inventory.brand')}</span>
                <select
                  required
                  value={normalizeBrandCode(form.brand) ? normalizeBrandCode(form.brand) : ''}
                  onChange={(e) => {
                    const code = e.target.value;
                    const hit = BRANDS.find((b) => b.code === code);
                    setForm((f) => ({ ...f, brand: hit?.name || '' }));
                  }}
                  lang={inputLang}
                >
                  <option value="">{t('inventory.brand')}</option>
                  {BRANDS.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inventory-add-modal__field">
                <span className="inventory-add-modal__label">{t('inventory.model')}</span>
                <input
                  required
                  placeholder={t('inventory.model')}
                  value={form.model}
                  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                  lang={inputLang}
                />
              </label>
              <label className="inventory-add-modal__field">
                <span className="inventory-add-modal__label">{t('inventory.storage')}</span>
                <input
                  placeholder={t('inventory.storage')}
                  value={form.storage}
                  onChange={(e) => setForm((f) => ({ ...f, storage: e.target.value }))}
                  lang={inputLang}
                />
              </label>
              <label className="inventory-add-modal__field">
                <span className="inventory-add-modal__label">{t('inventory.color')}</span>
                <input
                  placeholder={t('inventory.color')}
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  lang={inputLang}
                />
              </label>
              <label className="inventory-add-modal__field">
                <span className="inventory-add-modal__label">{t('inventory.condition')}</span>
                <select value={form.condition} onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))} lang={inputLang}>
                  <option value="new">{t('inventory.conditionNew')}</option>
                  <option value="refurbished">{t('inventory.conditionRefurbished')}</option>
                  <option value="used">{t('inventory.conditionUsed')}</option>
                </select>
              </label>
              <label className="inventory-add-modal__field">
                <span className="inventory-add-modal__label">{t('inventory.purchase')}</span>
                <input
                  type="number"
                  required
                  placeholder={t('inventory.purchasePrice')}
                  value={form.purchasePrice}
                  onChange={(e) => setForm((f) => ({ ...f, purchasePrice: e.target.value }))}
                  lang={inputLang}
                />
              </label>
              <label className="inventory-add-modal__field">
                <span className="inventory-add-modal__label">{t('inventory.selling')}</span>
                <input
                  type="number"
                  required
                  placeholder={t('inventory.sellingPrice')}
                  value={form.sellingPrice}
                  onChange={(e) => setForm((f) => ({ ...f, sellingPrice: e.target.value }))}
                  lang={inputLang}
                />
              </label>
              {priceEstimate ? (
                <div className="price-estimate-hint">
                  <strong>{t('inventory.aiRecommended')}</strong> {viewMoney(priceEstimate.recommendedPrice)}{' '}
                  <span className="muted">
                    ({viewMoney(priceEstimate.minPrice)} – {viewMoney(priceEstimate.maxPrice)})
                  </span>
                </div>
              ) : null}
              <label className="inventory-add-modal__field">
                <span className="inventory-add-modal__label">{t('inventory.selectBranch')}</span>
                <select
                  required
                  value={isSuperAdmin(user) ? (form.branchId || selectedBranchId || '') : (user?.branchId || form.branchId)}
                  disabled={!isSuperAdmin(user)}
                  onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
                  lang={inputLang}
                >
                  <option value="">{t('inventory.selectBranch')}</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inventory-add-modal__field">
                <span className="inventory-add-modal__label">{t('common.notes')}</span>
                <textarea
                  placeholder={t('common.notes')}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  lang={inputLang}
                  rows={3}
                />
              </label>
              <button type="submit" className="btn btn-primary" disabled={!commercialWritesAllowed}>
                {t('common.add')}
              </button>
            </form>
          </div>
        </div>
      )}
      {imeiHistoryImei && (
        <div className="modal-overlay" onClick={() => setImeiHistoryImei(null)}>
          <div className="modal modal--narrow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('inventory.imeiHistory')} — {imeiHistoryImei}</h2>
              <button onClick={() => setImeiHistoryImei(null)}><X size={20} /></button>
            </div>
            <div className="imei-history-list">
              {imeiHistory.length === 0 && <p>{t('inventory.noHistoryRecorded')}</p>}
              {imeiHistory.map((h, i) => (
                <div key={i} className="imei-history-item">
                  <span>
                    <strong>{h.actionType}</strong> {h.location && `@ ${h.location}`}
                  </span>
                  <span className="imei-history-item__time">{formatDateTimeForUi(h.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {showImport && (
        <div className="modal-overlay" onClick={() => setShowImport(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{t('inventory.importInventoryExcel')}</h2>
            <p>{t('inventory.importInventoryDesc')}</p>
            {isSuperAdmin(user) ? (
              <select value={form.branchId} onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))} lang={inputLang}>
                <option value="">{t('inventory.selectBranch')}</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            ) : null}
            <label className="btn btn-primary">
              <Upload size={18} /> {t('inventory.chooseFile')}
              <input type="file" accept=".xlsx,.xls" onChange={handleImport} hidden />
            </label>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
