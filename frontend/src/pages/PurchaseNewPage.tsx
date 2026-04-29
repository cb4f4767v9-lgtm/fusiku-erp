import { useEffect, useState, useCallback } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  purchasesApi,
  suppliersApi,
  customersApi,
  branchesApi,
  masterDataApi,
  importApi
} from '../services/api';
import toast from 'react-hot-toast';
import { Upload } from 'lucide-react';
import { getErrorMessage } from '../utils/getErrorMessage';
import { QuickAddDropdown } from '../components/QuickAddDropdown';
import { BarcodeStickerSheet } from '../components/BarcodeSticker';
import { useSaasCommercialGate } from '../hooks/useSaasCommercialGate';
import { enqueueIfOfflineDesktop } from '../offline/outboxEnqueue';
import { OUTBOX_KIND } from '../offline/outboxKinds';
import { PageLayout } from '../components/design-system';
import { formatNumberForUi } from '../utils/formatting';
import { useAuth } from '../hooks/useAuth';
import { isSuperAdmin } from '../utils/permissions';

const PURCHASE_CATEGORIES = [
  'Phones', 'Screens', 'Batteries', 'Speakers', 'Flex Cables', 'IC Chips',
  'Back Glass', 'Camera', 'Charging Port', 'Motherboard', 'Tools', 'Accessories'
];

const SCREEN_TYPES = ['OLED', 'LCD', 'Incell', 'Hard OLED', 'Soft OLED'];

type PhoneItem = {
  imei: string;
  brandId: string;
  brandName: string;
  modelId: string;
  modelName: string;
  storageId: string;
  storageLabel: string;
  colorId: string;
  colorName: string;
  qualityId: string;
  qualityName: string;
  qty: number;
  price: number;
};

type ScreenItem = {
  brandId: string;
  brandName: string;
  modelId: string;
  modelName: string;
  screenType: string;
  qualityId: string;
  qualityName: string;
  qty: number;
  price: number;
};

export function PurchaseNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { commercialWritesAllowed } = useSaasCommercialGate();
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [phoneModels, setPhoneModels] = useState<any[]>([]);
  const [storageSizes, setStorageSizes] = useState<any[]>([]);
  const [deviceColors, setDeviceColors] = useState<any[]>([]);
  const [deviceQualities, setDeviceQualities] = useState<any[]>([]);
  const [screenQualities, setScreenQualities] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [customScreenTypes, setCustomScreenTypes] = useState<string[]>([]);

  const [partyType, setPartyType] = useState<'Supplier' | 'Customer'>('Supplier');
  const [partyId, setPartyId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [category, setCategory] = useState('Phones');
  const categoryOptions = [
    ...PURCHASE_CATEGORIES.map((c) => ({ id: c, label: c })),
    ...categories
      .filter((c) => !PURCHASE_CATEGORIES.includes(c.name))
      .map((c) => ({ id: c.name, label: c.displayName ?? c.name }))
  ];
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [cargoCost, setCargoCost] = useState(0);
  const [phoneItems, setPhoneItems] = useState<PhoneItem[]>([
    { imei: '', brandId: '', brandName: '', modelId: '', modelName: '', storageId: '', storageLabel: '', colorId: '', colorName: '', qualityId: '', qualityName: '', qty: 1, price: 0 }
  ]);
  const [screenItems, setScreenItems] = useState<ScreenItem[]>([
    { brandId: '', brandName: '', modelId: '', modelName: '', screenType: '', qualityId: '', qualityName: '', qty: 1, price: 0 }
  ]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importForm, setImportForm] = useState({ supplierId: '', branchId: '' });
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [savedPurchaseId, setSavedPurchaseId] = useState<string | null>(null);
  const [savedStickerItems, setSavedStickerItems] = useState<Array<{ barcode: string; brand: string; model: string; storage: string; color: string; condition: string; price: number }>>([]);
  const [showBarcodePrint, setShowBarcodePrint] = useState(false);

  const loadMasterData = useCallback(() => {
    suppliersApi.getAll().then((r) => setSuppliers(r.data)).catch(() => setSuppliers([]));
    customersApi.getAll().then((r) => setCustomers(r.data)).catch(() => setCustomers([]));
    branchesApi.getAll().then((r) => setBranches(r.data)).catch(() => setBranches([]));
    masterDataApi.getAll('brands').then((r) => setBrands(r.data)).catch(() => setBrands([]));
    masterDataApi.getAll('storageSizes').then((r) => setStorageSizes(r.data)).catch(() => setStorageSizes([]));
    masterDataApi.getAll('deviceColors').then((r) => setDeviceColors(r.data)).catch(() => setDeviceColors([]));
    masterDataApi.getAll('deviceQualities').then((r) => setDeviceQualities(r.data)).catch(() => setDeviceQualities([]));
    masterDataApi.getAll('screenQualities').then((r) => setScreenQualities(r.data)).catch(() => setScreenQualities([]));
    masterDataApi.getAll('categories').then((r) => setCategories(r.data)).catch(() => setCategories([]));
  }, []);

  useEffect(() => { loadMasterData(); }, [loadMasterData]);
  useEffect(() => {
    if (!isSuperAdmin(user) && user?.branchId) {
      setBranchId(user.branchId);
      setImportForm((f) => ({ ...f, branchId: user.branchId! }));
    }
  }, [user?.branchId]);
  useEffect(() => {
    masterDataApi.getAll('phoneModels').then((r) => setPhoneModels(r.data)).catch(() => setPhoneModels([]));
  }, []);

  useEffect(() => {
    if (showBarcodePrint && savedStickerItems.length > 0) {
      const t = setTimeout(() => {
        window.print();
        setShowBarcodePrint(false);
        navigate('/purchases');
      }, 300);
      return () => clearTimeout(t);
    }
  }, [showBarcodePrint, savedStickerItems.length, navigate]);

  const getModelsForBrand = (brandId: string) =>
    phoneModels.filter((m) => m.brandId === brandId);

  const addPhoneRow = () => {
    setPhoneItems((prev) => [...prev, {
      imei: '', brandId: '', brandName: '', modelId: '', modelName: '', storageId: '', storageLabel: '',
      colorId: '', colorName: '', qualityId: '', qualityName: '', qty: 1, price: 0
    }]);
  };

  const addScreenRow = () => {
    setScreenItems((prev) => [...prev, {
      brandId: '', brandName: '', modelId: '', modelName: '', screenType: '', qualityId: '', qualityName: '', qty: 1, price: 0
    }]);
  };

  const updatePhoneItem = (i: number, field: keyof PhoneItem, val: any) => {
    setPhoneItems((prev) => prev.map((it, idx) => {
      if (idx !== i) return it;
      const next = { ...it, [field]: val };
      if (field === 'brandId') {
        const b = brands.find((x) => x.id === val);
        next.brandName = b?.name || '';
        next.modelId = '';
        next.modelName = '';
      } else if (field === 'modelId') {
        const m = phoneModels.find((x) => x.id === val);
        next.modelName = m?.name || '';
      } else if (field === 'storageId') {
        const s = storageSizes.find((x) => x.id === val);
        next.storageLabel = s?.label || '';
      } else if (field === 'colorId') {
        const c = deviceColors.find((x) => x.id === val);
        next.colorName = c?.name || '';
      } else if (field === 'qualityId') {
        const q = deviceQualities.find((x) => x.id === val);
        next.qualityName = q?.name || '';
      }
      return next;
    }));
  };

  const updateScreenItem = (i: number, field: keyof ScreenItem, val: any) => {
    setScreenItems((prev) => prev.map((it, idx) => {
      if (idx !== i) return it;
      const next = { ...it, [field]: val };
      if (field === 'qualityId') {
        const q = screenQualities.find((x) => x.id === val);
        next.qualityName = q?.name ?? '';
      }
      return next;
    }));
  };

  const phoneTotal = phoneItems.reduce((sum, i) => sum + (i.qty || 0) * (i.price || 0), 0);
  const screenTotal = screenItems.reduce((sum, i) => sum + (i.qty || 0) * (i.price || 0), 0);
  const grandTotal = category === 'Phones' ? phoneTotal : screenTotal;

  const buildPurchaseItems = (): Array<{ imei: string; brand: string; model: string; storage: string; color: string; condition: string; price: number }> => {
    if (category === 'Phones') {
      return phoneItems
        .filter((i) => (i.imei || i.modelName) && i.price > 0)
        .flatMap((i) => {
          const imei = i.imei || `PH-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          const arr: Array<{ imei: string; brand: string; model: string; storage: string; color: string; condition: string; price: number }> = [];
          for (let q = 0; q < (i.qty || 1); q++) {
            arr.push({
              imei: q === 0 ? imei : `PH-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              brand: i.brandName,
              model: i.modelName,
              storage: i.storageLabel,
              color: i.colorName,
              condition: i.qualityName || 'Used',
              price: i.price
            });
          }
          return arr;
        });
    }
    return screenItems
      .filter((i) => i.modelName && i.price > 0)
      .flatMap((i) => {
        const arr: Array<{ imei: string; brand: string; model: string; storage: string; color: string; condition: string; price: number }> = [];
        for (let q = 0; q < (i.qty || 1); q++) {
          arr.push({
            imei: `SC-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            brand: i.brandName,
            model: i.modelName,
            storage: '',
            color: '',
            condition: i.qualityName || 'OEM',
            price: i.price
          });
        }
        return arr;
      });
  };

  const handleSave = async () => {
    if (!commercialWritesAllowed) {
      toast.error(t('saas.actionBlocked'));
      return;
    }
    if (!partyId || !branchId) {
      toast.error(t('purchases.fillRequiredFields'));
      return;
    }
    const items = buildPurchaseItems();
    if (items.length === 0) {
      toast.error(t('purchases.fillRequiredFields'));
      return;
    }
    const payload: any = {
      branchId: isSuperAdmin(user) ? branchId : (user?.branchId || branchId),
      items: items.map((i) => ({ ...i, price: Number(i.price) })),
      cargoCost: Number(cargoCost) || 0,
      notes: invoiceNumber ? `Invoice: ${invoiceNumber}` : undefined
    };
    if (partyType === 'Supplier') payload.supplierId = partyId;
    else payload.customerId = partyId;
    try {
      if (await enqueueIfOfflineDesktop(OUTBOX_KIND.PURCHASE_CREATE, payload)) {
        toast.success(t('offline.purchaseQueuedOffline'));
        setShowSaveConfirm(false);
        return;
      }
      const { data } = await purchasesApi.create(payload);
      setSavedPurchaseId(data.id);
      setSavedStickerItems(data.createdItems || []);
      setShowSaveConfirm(false);
      toast.success(t('purchases.purchaseCreated'));
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
    const supplierId = importForm.supplierId || (partyType === 'Supplier' ? partyId : '');
    const branchIdForImport = isSuperAdmin(user) ? (importForm.branchId || branchId) : (user?.branchId || importForm.branchId || branchId);
    if (!file || !branchIdForImport || !supplierId) {
      toast.error(t('purchases.selectFileBranchSupplier'));
      return;
    }
    try {
      const { data } = await importApi.purchases(file, branchIdForImport, supplierId);
      toast.success(t('purchases.importedItems', { count: data.success }));
      setShowImportModal(false);
      setImportForm({ supplierId: '', branchId: '' });
      navigate('/purchases');
    } catch (err: any) {
      toast.error(getErrorMessage(err, t('inventory.importFailed')));
    }
    e.target.value = '';
  };

  const removeLastRow = () => {
    if (category === 'Phones' && phoneItems.length > 1) {
      setPhoneItems((prev) => prev.slice(0, -1));
    } else if (category === 'Screens' && screenItems.length > 1) {
      setScreenItems((prev) => prev.slice(0, -1));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (showSaveConfirm) setShowSaveConfirm(false);
      else if (['Phones', 'Screens'].includes(category) && ((category === 'Phones' && phoneItems.length > 1) || (category === 'Screens' && screenItems.length > 1))) removeLastRow();
      else navigate('/purchases');
    }
    if (e.key === 'Enter' && !e.shiftKey && !showSaveConfirm) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'BUTTON' || target.tagName === 'SELECT') return;
      e.preventDefault();
      if (category === 'Phones') addPhoneRow();
      else if (category === 'Screens') addScreenRow();
    }
  };

  const handleTableKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const key = e.key;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) return;
    const target = e.target as HTMLElement;
    const cell = target.getAttribute?.('data-cell') ?? (target.closest?.('[data-cell]') as HTMLElement)?.getAttribute?.('data-cell');
    if (!cell) return;
    const [r, c] = cell.split('-').map(Number);
    const isPhone = category === 'Phones';
    const maxRow = isPhone ? phoneItems.length - 1 : screenItems.length - 1;
    const maxCol = isPhone ? 8 : 6;
    let nr = r, nc = c;
    if (key === 'ArrowRight') nc = Math.min(c + 1, maxCol);
    else if (key === 'ArrowLeft') nc = Math.max(c - 1, 1);
    else if (key === 'ArrowDown') nr = Math.min(r + 1, maxRow);
    else if (key === 'ArrowUp') nr = Math.max(r - 1, 0);
    if (nr === r && nc === c) return;
    e.preventDefault();
    const next = document.querySelector(`[data-cell="${nr}-${nc}"]`) as HTMLElement;
    next?.focus();
  };

  return (
    <PageLayout className="page purchase-new-page" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="purchase-new-header">
        <NavLink to="/purchases" className="breadcrumb-link">{t('purchases.purchaseList')}</NavLink>
      </div>

      <div className="purchase-new-top purchase-new-top-compact">
        <div className="form-field">
          <label>{t('purchases.partyType')}</label>
          <select value={partyType} onChange={(e) => { setPartyType(e.target.value as 'Supplier' | 'Customer'); setPartyId(''); }}>
            <option value="Supplier">{t('purchases.supplier')}</option>
            <option value="Customer">{t('purchases.customer')}</option>
          </select>
        </div>
        <div className="form-field">
          <label>{t('purchases.partyName')}</label>
          <QuickAddDropdown
            type={partyType === 'Supplier' ? 'supplier' : 'customer'}
            value={partyId}
            onChange={(id) => setPartyId(id)}
            options={(partyType === 'Supplier' ? suppliers : customers).map((p) => ({ id: p.id, label: p.name }))}
            onRefresh={loadMasterData}
            placeholder={t('common.select')}
          />
          {partyType === 'Supplier' && partyId && (() => {
            const supplier = suppliers.find((s) => s.id === partyId);
            if (!supplier) return null;
            const available = Number(supplier.availableBalance ?? 0);
            const blocked = Number(supplier.blockedBalance ?? 0);
            const invoiceAmount = grandTotal;
            const remaining = available - invoiceAmount;
            return (
              <div className="supplier-balance-card">
                <h4>{supplier.name}</h4>
                <div className="supplier-balance-row">
                  <span>{t('suppliers.availableBalance')}</span>
                  <span>{formatNumberForUi(available, { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="supplier-balance-row">
                  <span>{t('suppliers.blockedBalance')}</span>
                  <span>{formatNumberForUi(blocked, { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="supplier-balance-row">
                  <span>{t('suppliers.invoiceAmount')}</span>
                  <span>{formatNumberForUi(invoiceAmount, { maximumFractionDigits: 2 })}</span>
                </div>
                <div className={`supplier-balance-row remaining ${remaining < 0 ? 'negative' : ''}`}>
                  <span>{t('suppliers.remainingAfterInvoice')}</span>
                  <span>
                    {formatNumberForUi(remaining, { maximumFractionDigits: 2 })}
                    {remaining < 0 ? ` (${t('suppliers.creditPayable')})` : ''}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
        <div className="form-field">
          <label>{t('purchases.branch')}</label>
          {isSuperAdmin(user) ? (
            <QuickAddDropdown
              type="branch"
              value={branchId}
              onChange={(id) => setBranchId(id)}
              options={branches.map((b) => ({ id: b.id, label: b.name }))}
              onRefresh={loadMasterData}
              placeholder={t('common.select')}
            />
          ) : (
            <select value={user?.branchId || branchId} disabled>
              <option value="">{t('common.select')}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="form-field">
          <label>{t('purchases.currency')}</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="CNY">CNY</option>
            <option value="PKR">PKR</option>
          </select>
        </div>
        <div className="form-field">
          <label>{t('purchases.invoiceNumber')}</label>
          <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder={t('purchases.auto')} />
        </div>
        <div className="form-field">
          <label>{t('purchases.cargoCost')}</label>
          <input type="number" min={0} step={0.01} value={cargoCost || ''} onChange={(e) => setCargoCost(Number(e.target.value) || 0)} placeholder="0" />
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-compact"
          disabled={!commercialWritesAllowed}
          onClick={() => setShowImportModal(true)}
        >
          <Upload size={14} /> {t('common.import')}
        </button>
        <div className="form-field">
          <label>{t('purchases.category')}</label>
          <QuickAddDropdown
            type="category"
            value={category}
            onChange={(id) => setCategory(id)}
            options={categoryOptions}
            onRefresh={() => masterDataApi.getAll('categories').then((r) => setCategories(r.data)).catch(() => {})}
            placeholder={t('common.select')}
          />
        </div>
      </div>

      {category === 'Phones' && (
        <div className="purchase-table-wrap" onKeyDown={handleTableKeyDown}>
          <table className="purchase-table table-grid">
            <thead>
              <tr>
                <th className="col-sr">Sr#</th>
                <th>{t('inventory.imei')}</th>
                <th>{t('masterData.brand')}</th>
                <th>{t('masterData.modelName')}</th>
                <th>{t('masterData.storageSizes')}</th>
                <th>{t('masterData.deviceColors')}</th>
                <th>{t('masterData.deviceQualities')}</th>
                <th>{t('purchases.qty')}</th>
                <th>{t('receipt.price')}</th>
                <th>{t('purchases.total')}</th>
              </tr>
            </thead>
            <tbody>
              {phoneItems.map((row, i) => (
                <tr key={i}>
                  <td className="col-sr">{i + 1}</td>
                  <td><input type="text" data-cell={`${i}-1`} value={row.imei} onChange={(e) => updatePhoneItem(i, 'imei', e.target.value)} placeholder={t('inventory.imei')} /></td>
                  <td>
                    <QuickAddDropdown
                      type="brand"
                      value={row.brandId}
                      onChange={(id) => updatePhoneItem(i, 'brandId', id)}
                      options={brands.map((b) => ({ id: b.id, label: b.displayName ?? b.name }))}
                      onRefresh={loadMasterData}
                      placeholder={t('common.selectPlaceholder')}
                      dataCell={`${i}-2`}
                    />
                  </td>
                  <td>
                    <QuickAddDropdown
                      type="phoneModel"
                      value={row.modelId}
                      onChange={(id) => updatePhoneItem(i, 'modelId', id)}
                      options={getModelsForBrand(row.brandId).map((m) => ({ id: m.id, label: m.displayName ?? m.name }))}
                      onRefresh={() => masterDataApi.getAll('phoneModels').then((r) => setPhoneModels(r.data)).catch(() => {})}
                      brands={brands}
                      placeholder={t('common.selectPlaceholder')}
                      dataCell={`${i}-3`}
                    />
                  </td>
                  <td>
                    <QuickAddDropdown
                      type="storage"
                      value={row.storageId}
                      onChange={(id) => updatePhoneItem(i, 'storageId', id)}
                      options={storageSizes.map((s) => ({ id: s.id, label: s.label }))}
                      onRefresh={loadMasterData}
                      placeholder={t('common.selectPlaceholder')}
                      dataCell={`${i}-4`}
                    />
                  </td>
                  <td>
                    <QuickAddDropdown
                      type="color"
                      value={row.colorId}
                      onChange={(id) => updatePhoneItem(i, 'colorId', id)}
                      options={deviceColors.map((c) => ({ id: c.id, label: c.name }))}
                      onRefresh={loadMasterData}
                      placeholder={t('common.selectPlaceholder')}
                      dataCell={`${i}-5`}
                    />
                  </td>
                  <td>
                    <QuickAddDropdown
                      type="quality"
                      value={row.qualityId}
                      onChange={(id) => updatePhoneItem(i, 'qualityId', id)}
                      options={deviceQualities.map((q) => ({ id: q.id, label: q.name }))}
                      onRefresh={loadMasterData}
                      placeholder={t('common.selectPlaceholder')}
                      dataCell={`${i}-6`}
                    />
                  </td>
                  <td><input type="number" data-cell={`${i}-7`} min={1} value={row.qty || ''} onChange={(e) => updatePhoneItem(i, 'qty', parseInt(e.target.value, 10) || 0)} /></td>
                  <td><input type="number" data-cell={`${i}-8`} min={0} step={0.01} value={row.price || ''} onChange={(e) => updatePhoneItem(i, 'price', parseFloat(e.target.value) || 0)} /></td>
                  <td>{(row.qty || 0) * (row.price || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="btn btn-secondary btn-compact" onClick={addPhoneRow}>+ {t('purchases.addItem')}</button>
        </div>
      )}

      {category === 'Screens' && (
        <div className="purchase-table-wrap" onKeyDown={handleTableKeyDown}>
          <table className="purchase-table table-grid">
            <thead>
              <tr>
                <th className="col-sr">Sr#</th>
                <th className="col-excel">{t('masterData.brand')}</th>
                <th className="col-excel">{t('masterData.modelName')}</th>
                <th className="col-excel">{t('purchases.screenType')}</th>
                <th className="col-excel">{t('masterData.deviceQualities')}</th>
                <th className="col-excel">{t('purchases.qty')}</th>
                <th className="col-excel">{t('receipt.price')}</th>
                <th className="col-excel">{t('purchases.total')}</th>
              </tr>
            </thead>
            <tbody>
              {screenItems.map((row, i) => (
                <tr key={i}>
                  <td className="col-sr">{i + 1}</td>
                  <td>
                    <QuickAddDropdown
                      type="brand"
                      value={row.brandId}
                      onChange={(id) => {
                        const b = brands.find((x) => x.id === id);
                        updateScreenItem(i, 'brandId', id);
                        updateScreenItem(i, 'brandName', b?.name ?? '');
                      }}
                      options={brands.map((b) => ({ id: b.id, label: b.displayName ?? b.name }))}
                      onRefresh={loadMasterData}
                      placeholder={t('common.selectPlaceholder')}
                      dataCell={`${i}-1`}
                    />
                  </td>
                  <td><input type="text" data-cell={`${i}-2`} value={row.modelName} onChange={(e) => updateScreenItem(i, 'modelName', e.target.value)} placeholder={t('masterData.modelName')} /></td>
                  <td>
                    <QuickAddDropdown
                      type="screenType"
                      value={row.screenType}
                      onChange={(id) => updateScreenItem(i, 'screenType', id)}
                      options={[...SCREEN_TYPES, ...customScreenTypes].map((s) => ({ id: s, label: s }))}
                      onRefresh={() => {}}
                      onAddScreenType={(name) => setCustomScreenTypes((prev) => prev.includes(name) ? prev : [...prev, name])}
                      placeholder={t('common.selectPlaceholder')}
                      dataCell={`${i}-3`}
                    />
                  </td>
                  <td>
                    <QuickAddDropdown
                      type="screenQuality"
                      value={row.qualityId}
                      onChange={(id) => updateScreenItem(i, 'qualityId', id)}
                      options={screenQualities.map((q) => ({ id: q.id, label: q.name }))}
                      onRefresh={loadMasterData}
                      placeholder={t('common.selectPlaceholder')}
                      dataCell={`${i}-4`}
                    />
                  </td>
                  <td><input type="number" data-cell={`${i}-5`} min={1} value={row.qty || ''} onChange={(e) => updateScreenItem(i, 'qty', parseInt(e.target.value, 10) || 0)} /></td>
                  <td><input type="number" data-cell={`${i}-6`} min={0} step={0.01} value={row.price || ''} onChange={(e) => updateScreenItem(i, 'price', parseFloat(e.target.value) || 0)} /></td>
                  <td>{(row.qty || 0) * (row.price || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="btn btn-secondary btn-compact" onClick={addScreenRow}>+ {t('purchases.addItem')}</button>
        </div>
      )}

      {!['Phones', 'Screens'].includes(category) && (
        <p className="purchase-other-cat">{t('purchases.otherCategoryNote')}</p>
      )}

      <div className="purchase-total-row">
        <strong>
          {t('purchases.total')}: {currency}{' '}
          {formatNumberForUi(grandTotal, { maximumFractionDigits: 2 })}
        </strong>
      </div>

      <div className="purchase-actions">
        <button
          type="button"
          className="btn btn-primary btn-compact"
          disabled={!commercialWritesAllowed}
          onClick={() => setShowSaveConfirm(true)}
        >
          {t('common.save')} {t('purchases.purchase')}
        </button>
      </div>

      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{t('purchases.importPurchases')}</h2>
            <select
              value={importForm.supplierId || (partyType === 'Supplier' ? partyId : '')}
              onChange={(e) => setImportForm((f) => ({ ...f, supplierId: e.target.value }))}
            >
              <option value="">{t('purchases.supplier')}</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select
              value={importForm.branchId || branchId}
              onChange={(e) => setImportForm((f) => ({ ...f, branchId: e.target.value }))}
              disabled={!isSuperAdmin(user)}
            >
              <option value="">{t('purchases.branch')}</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
              <Upload size={18} /> {t('purchases.chooseFile')}
              <input type="file" accept=".xlsx,.xls" onChange={handleImport} hidden />
            </label>
            <button type="button" className="btn btn-secondary" onClick={() => setShowImportModal(false)}>{t('common.cancel')}</button>
          </div>
        </div>
      )}

      {showSaveConfirm && (
        <div className="modal-overlay" onClick={() => setShowSaveConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('purchases.saveConfirm')}</h3>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowSaveConfirm(false)}>{t('common.no')}</button>
              <button type="button" className="btn btn-primary" onClick={handleSave}>{t('common.yes')}</button>
            </div>
          </div>
        </div>
      )}

      {savedPurchaseId && (
        <div className="modal-overlay" onClick={() => navigate('/purchases')}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('purchases.printBarcodeStickers')}</h3>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary btn-compact" onClick={() => navigate('/purchases')}>{t('common.no')}</button>
              <button type="button" className="btn btn-primary btn-compact" onClick={() => {
                if (savedStickerItems.length > 0) {
                  setSavedPurchaseId(null);
                  setShowBarcodePrint(true);
                } else {
                  navigate('/purchases');
                }
              }}>{t('common.yes')}</button>
            </div>
          </div>
        </div>
      )}
      {showBarcodePrint && savedStickerItems.length > 0 && (
        <div id="barcode-print-area" className="barcode-print-area">
          <BarcodeStickerSheet items={savedStickerItems} />
        </div>
      )}
    </PageLayout>
  );
}
