import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { inventoryApi, branchesApi, importApi, imeiApi, warrantyApi, aiApi } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Upload, X, History, AlertTriangle } from 'lucide-react';

export function InventoryPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [filters, setFilters] = useState({
    branchId: '', status: '', search: '', brand: '', model: '', storage: '', color: '', condition: ''
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

  const load = () => {
    inventoryApi.getAll(filters).then((r) => setItems(r.data)).catch(() => setItems([]));
  };

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
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    load();
    setLoading(false);
  }, [filters.branchId, filters.status, filters.search, filters.brand, filters.model, filters.storage, filters.color, filters.condition]);

  useEffect(() => {
    aiApi.businessIntelligence({ branchId: filters.branchId || undefined }).then((r) => setInventoryRiskAlerts(r.data?.inventoryRiskAlerts || [])).catch(() => setInventoryRiskAlerts([]));
  }, [filters.branchId]);

  useEffect(() => {
    branchesApi.getAll().then((r) => setBranches(r.data)).catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    if (form.brand && form.model) {
      aiApi.priceEstimate({
        brand: form.brand,
        model: form.model,
        storage: form.storage,
        condition: form.condition,
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : undefined
      }).then((r) => setPriceEstimate(r.data)).catch(() => setPriceEstimate(null));
    } else setPriceEstimate(null);
  }, [form.brand, form.model, form.storage, form.condition, form.purchasePrice]);

  useEffect(() => {
    if (imeiHistoryImei) {
      imeiApi.getHistory(imeiHistoryImei).then((r) => setImeiHistory(r.data || [])).catch(() => setImeiHistory([]));
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
        } catch { /* ignore */ }
      })
    ).then(() => setPriceOptMap((prev) => ({ ...prev, ...map })));
  }, [items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inventoryApi.create({
        ...form,
        purchasePrice: Number(form.purchasePrice),
        sellingPrice: Number(form.sellingPrice)
      });
      toast.success(t('inventory.itemAdded'));
      setShowForm(false);
      setForm({ imei: '', brand: '', model: '', storage: '', color: '', condition: 'refurbished', purchasePrice: '', sellingPrice: '', branchId: '', notes: '' });
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('common.failed'));
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const branchId = form.branchId || branches[0]?.id;
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
      toast.error(err.response?.data?.error || t('inventory.importFailed'));
    }
    e.target.value = '';
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t('inventory.title')}</h1>
        <div className="page-actions">
          <div className="warranty-check" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              placeholder={t('inventory.checkWarrantyByImei')}
              value={warrantyCheckImei}
              onChange={(e) => { setWarrantyCheckImei(e.target.value); setWarrantyResult(null); }}
              onKeyDown={(e) => e.key === 'Enter' && warrantyApi.getByImei(warrantyCheckImei).then((r) => setWarrantyResult(r.data)).catch(() => setWarrantyResult(null))}
              style={{ width: 180 }}
            />
            <button
              className="btn btn-secondary"
              onClick={() => warrantyApi.getByImei(warrantyCheckImei).then((r) => setWarrantyResult(r.data)).catch(() => setWarrantyResult(null))}
            >
              {t('inventory.check')}
            </button>
          </div>
          {warrantyResult && (
            <div className="warranty-result" style={{ padding: 8, background: (warrantyResult.isActive ?? new Date() <= new Date(warrantyResult.warrantyEnd)) ? '#dcfce7' : '#fee2e2', borderRadius: 6, fontSize: 12 }}>
              {(warrantyResult.isActive ?? new Date() <= new Date(warrantyResult.warrantyEnd)) ? t('inventory.warrantyActive') : t('inventory.warrantyExpired')} — {t('inventory.warrantyUntil')} {new Date(warrantyResult.warrantyEnd).toLocaleDateString()}
            </div>
          )}
          <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
            <Upload size={18} /> {t('inventory.import')}
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={18} /> {t('inventory.addItem')}
          </button>
        </div>
      </div>
      {inventoryRiskAlerts.length > 0 && (
        <div className="inventory-alerts-section" style={{ marginBottom: 16, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
          <h3 style={{ margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={18} /> {t('inventory.inventoryRiskAlerts')}</h3>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {inventoryRiskAlerts.slice(0, 5).map((r: any, i: number) => (
              <li key={i} style={{ marginBottom: 4 }}>{r.brand} {r.model} — {r.daysInStock} days in stock: {r.suggestion}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="filters filters-advanced">
        <input
          placeholder={t('inventory.searchPlaceholder')}
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          className="filter-input"
          style={{ maxWidth: 200 }}
        />
        <input placeholder={t('inventory.brand')} value={filters.brand} onChange={(e) => setFilters((f) => ({ ...f, brand: e.target.value }))} />
        <input placeholder={t('inventory.model')} value={filters.model} onChange={(e) => setFilters((f) => ({ ...f, model: e.target.value }))} />
        <input placeholder={t('inventory.storage')} value={filters.storage} onChange={(e) => setFilters((f) => ({ ...f, storage: e.target.value }))} />
        <input placeholder={t('inventory.color')} value={filters.color} onChange={(e) => setFilters((f) => ({ ...f, color: e.target.value }))} />
        <input placeholder={t('inventory.condition')} value={filters.condition} onChange={(e) => setFilters((f) => ({ ...f, condition: e.target.value }))} />
        <select value={filters.branchId} onChange={(e) => setFilters((f) => ({ ...f, branchId: e.target.value }))}>
          <option value="">{t('inventory.allBranches')}</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">{t('inventory.allStatus')}</option>
          <option value="available">{t('inventory.available')}</option>
          <option value="sold">{t('inventory.sold')}</option>
          <option value="in_repair">{t('inventory.inRepair')}</option>
        </select>
      </div>
      <div className="table-container">
        <table className="data-table table-grid">
          <thead>
            <tr>
              <th>{t('inventory.barcode', 'Barcode')}</th>
              <th>{t('inventory.imei')}</th>
              <th>{t('inventory.brand')}</th>
              <th>{t('inventory.model')}</th>
              <th>{t('inventory.storage')}</th>
              <th>{t('inventory.color')}</th>
              <th>{t('inventory.condition')}</th>
              <th>{t('inventory.purchase')}</th>
              <th>{t('inventory.selling')}</th>
              <th>{t('inventory.aiPrice')}</th>
              <th>{t('inventory.status')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>{i.barcode || '—'}</td>
                <td>
                  <span style={{ cursor: 'pointer', textDecoration: 'underline', marginRight: 8 }} onClick={() => setImeiHistoryImei(i.imei)} title={t('inventory.viewHistory')}>{i.imei}</span>
                  <button type="button" className="btn-sm" onClick={() => setImeiHistoryImei(i.imei)} title={t('inventory.viewHistory')}><History size={14} /></button>
                </td>
                <td>{i.brand}</td>
                <td>{i.model}</td>
                <td>{i.storage}</td>
                <td>{i.color}</td>
                <td>{i.condition}</td>
                <td>${Number(i.purchasePrice).toFixed(2)}</td>
                <td>${Number(i.sellingPrice).toFixed(2)}</td>
                <td>
                  {priceOptMap[i.id] ? (
                    <span className={`ai-price-badge ai-price-${priceOptMap[i.id].status || 'optimal'}`} title={`Confidence: ${(priceOptMap[i.id].confidenceScore * 100).toFixed(0)}%`}>
                      ${priceOptMap[i.id].recommendedPrice.toFixed(0)} ({(priceOptMap[i.id].confidenceScore * 100).toFixed(0)}%)
                    </span>
                  ) : (
                    <span className="ai-price-loading">—</span>
                  )}
                </td>
                <td><span className={`badge badge-${i.status}`}>{i.status}</span></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={11}>{t('inventory.noItems')}</td></tr>}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('inventory.addInventoryItem')}</h2>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <input
                required
                placeholder={t('inventory.imeiAutoFills')}
                value={form.imei}
                onChange={(e) => setForm((f) => ({ ...f, imei: e.target.value }))}
                onBlur={(e) => lookupImei(e.target.value)}
              />
              <input required placeholder={t('inventory.brand')} value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} />
              <input required placeholder={t('inventory.model')} value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
              <input placeholder={t('inventory.storage')} value={form.storage} onChange={(e) => setForm((f) => ({ ...f, storage: e.target.value }))} />
              <input placeholder={t('inventory.color')} value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} />
              <select value={form.condition} onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}>
                <option value="new">{t('inventory.conditionNew')}</option>
                <option value="refurbished">{t('inventory.conditionRefurbished')}</option>
                <option value="used">{t('inventory.conditionUsed')}</option>
              </select>
              <input type="number" required placeholder={t('inventory.purchasePrice')} value={form.purchasePrice} onChange={(e) => setForm((f) => ({ ...f, purchasePrice: e.target.value }))} />
              <input type="number" required placeholder={t('inventory.sellingPrice')} value={form.sellingPrice} onChange={(e) => setForm((f) => ({ ...f, sellingPrice: e.target.value }))} />
              {priceEstimate && (
                <div className="price-estimate-hint" style={{ padding: 8, background: 'var(--bg-tertiary)', borderRadius: 8, fontSize: 13 }}>
                  <strong>{t('inventory.aiRecommended')}</strong> ${priceEstimate.recommendedPrice} (range ${priceEstimate.minPrice}–${priceEstimate.maxPrice})
                </div>
              )}
              <select required value={form.branchId} onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}>
                <option value="">{t('inventory.selectBranch')}</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <textarea placeholder={t('common.notes')} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              <button type="submit" className="btn btn-primary">{t('common.add')}</button>
            </form>
          </div>
        </div>
      )}
      {imeiHistoryImei && (
        <div className="modal-overlay" onClick={() => setImeiHistoryImei(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2>{t('inventory.imeiHistory')} — {imeiHistoryImei}</h2>
              <button onClick={() => setImeiHistoryImei(null)}><X size={20} /></button>
            </div>
            <div className="imei-history-list" style={{ maxHeight: 400, overflow: 'auto' }}>
              {imeiHistory.length === 0 && <p>{t('inventory.noHistoryRecorded')}</p>}
              {imeiHistory.map((h, i) => (
                <div key={i} className="imei-history-item" style={{ padding: 8, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span><strong>{h.actionType}</strong> {h.location && `@ ${h.location}`}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{new Date(h.timestamp).toLocaleString()}</span>
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
            <select value={form.branchId} onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}>
              <option value="">{t('inventory.selectBranch')}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <label className="btn btn-primary">
              <Upload size={18} /> {t('inventory.chooseFile')}
              <input type="file" accept=".xlsx,.xls" onChange={handleImport} hidden />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
