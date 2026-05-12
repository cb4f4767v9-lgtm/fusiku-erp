import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { PageLayout, PageHeader, TableWrapper, LoadingSkeleton } from '../../components/design-system';
import { useAuth } from '../../hooks/useAuth';
import { isSuperAdmin } from '../../utils/permissions';
import { branchesApi, companyApi, purchasesApi, suppliersApi } from '../../services/api';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { useSaasCommercialGate } from '../../hooks/useSaasCommercialGate';
import { formatNumberForUi } from '../../utils/formatting';

type Supplier = { id: string; name: string };
type Branch = { id: string; name: string };

type PurchaseItemDraft = {
  productType: 'phone' | 'part' | 'accessory';
  brand: string;
  model: string;
  imei: string;
  quantity: number;
  costPrice: number;
  condition: 'new' | 'used' | 'refurbished';
};

export default function NewPurchasePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { commercialWritesAllowed } = useSaasCommercialGate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [supplierId, setSupplierId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [cargoCost, setCargoCost] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [otherCosts, setOtherCosts] = useState(0);
  const [items, setItems] = useState<PurchaseItemDraft[]>([
    { productType: 'phone', brand: '', model: '', imei: '', quantity: 1, costPrice: 0, condition: 'new' },
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sRes, bRes, settingsRes] = await Promise.allSettled([
          suppliersApi.getAll(),
          branchesApi.getAll(),
          companyApi.getSettings(),
        ]);

        const nextSuppliers =
          sRes.status === 'fulfilled' && Array.isArray(sRes.value.data) ? (sRes.value.data as Supplier[]) : [];
        const nextBranches =
          bRes.status === 'fulfilled' && Array.isArray(bRes.value.data) ? (bRes.value.data as Branch[]) : [];

        const baseCurrency =
          settingsRes.status === 'fulfilled'
            ? String((settingsRes.value.data as any)?.baseCurrency || (settingsRes.value.data as any)?.currency || 'USD')
                .trim()
                .toUpperCase() || 'USD'
            : 'USD';

        if (!cancelled) {
          setSuppliers(nextSuppliers);
          setBranches(nextBranches);
          setCurrency(baseCurrency);

          if (!isSuperAdmin(user) && user?.branchId) {
            setBranchId(user.branchId);
          }
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(getErrorMessage(e));
          setSuppliers([]);
          setBranches([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.branchId]);

  const merchandiseSubtotal = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.costPrice) || 0), 0);
  }, [items]);

  const landedTotal = useMemo(
    () => merchandiseSubtotal + (Number(cargoCost) || 0) + (Number(taxAmount) || 0) + (Number(otherCosts) || 0),
    [merchandiseSubtotal, cargoCost, taxAmount, otherCosts]
  );

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { productType: 'phone', brand: '', model: '', imei: '', quantity: 1, costPrice: 0, condition: 'new' },
    ]);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const updateItem = (idx: number, patch: Partial<PurchaseItemDraft>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const validate = (): { ok: true } | { ok: false; message: string } => {
    if (!commercialWritesAllowed) return { ok: false, message: t('saas.actionBlocked') };
    if (!supplierId) return { ok: false, message: t('purchases.fillRequiredFields') };
    if (!branchId) return { ok: false, message: t('purchases.fillRequiredFields') };
    const cleaned = items
      .map((it) => ({
        productType: it.productType,
        brand: String(it.brand || '').trim(),
        model: String(it.model || '').trim(),
        imei: String(it.imei || '').trim(),
        quantity: Number(it.quantity) || 0,
        costPrice: Number(it.costPrice) || 0,
        condition: it.condition,
      }))
      .filter((it) => it.model || it.imei);

    if (cleaned.length === 0) return { ok: false, message: t('purchases.fillRequiredFields') };

    for (const it of cleaned) {
      if (!it.model) return { ok: false, message: t('purchases.fillRequiredFields') };
      if (it.costPrice <= 0) return { ok: false, message: `${t('products.costPrice')}: ${t('purchases.fillRequiredFields')}` };

      if (it.productType === 'phone') {
        if (!it.imei) return { ok: false, message: `${t('inventory.imei')}: ${t('purchases.fillRequiredFields')}` };
        if (it.quantity !== 1) {
          return { ok: false, message: t('purchases.quantityOnePerImeiRow') };
        }
      } else {
        if (it.quantity < 1) return { ok: false, message: t('purchases.fillRequiredFields') };
        if (it.imei && it.quantity !== 1) {
          return { ok: false, message: 'When IMEI is set for parts/accessories, quantity must be 1.' };
        }
      }
    }

    return { ok: true };
  };

  const onSubmit = async () => {
    const v = validate();
    if (!v.ok) {
      toast.error(v.message);
      return;
    }
    setSubmitting(true);
    try {
      const cleaned = items
        .map((it) => ({
          productType: it.productType,
          brand: String(it.brand || '').trim() || '-',
          model: String(it.model || '').trim(),
          imei: String(it.imei || '').trim(),
          quantity: Number(it.quantity) || 1,
          costPrice: Number(it.costPrice) || 0,
          condition: it.condition,
        }))
        .filter((it) => it.model || it.imei);

      const payload = {
        supplierId,
        branchId,
        currency,
        cargoCost: Number(cargoCost) || 0,
        taxAmount: Number(taxAmount) || 0,
        otherCosts: Number(otherCosts) || 0,
        items: cleaned.map((it) => ({
          productType: it.productType,
          brand: it.brand,
          model: it.model,
          imei: it.imei,
          quantity: it.quantity,
          costPrice: it.costPrice,
          condition: it.condition,
          storage: '-',
          color: '-',
        })),
      };

      await purchasesApi.create(payload);
      toast.success(t('purchases.purchaseCreated'));
      navigate('/purchases');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageLayout className="page page-compact page-container">
      <PageHeader
        title={t('purchases.newPurchase')}
        subtitle={`${t('purchases.purchaseList')} → ${t('purchases.newPurchase')}`}
      />

      {loading ? (
        <LoadingSkeleton variant="table" rows={6} cols={3} />
      ) : (
        <>
          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <label className="form-field">
                <div className="label">{t('purchases.supplier')}</div>
                <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">{t('common.select')}</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <div className="label">{t('purchases.branch')}</div>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  disabled={!isSuperAdmin(user) && Boolean(user?.branchId)}
                >
                  <option value="">{t('common.select')}</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <div className="label">{t('purchases.currency')}</div>
                <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
              </label>
            </div>
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
              <label className="form-field">
                <div className="label">{t('purchases.shipping', { defaultValue: 'Shipping' })}</div>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={cargoCost}
                  onChange={(e) => setCargoCost(Number(e.target.value) || 0)}
                />
              </label>
              <label className="form-field">
                <div className="label">{t('purchases.tax', { defaultValue: 'Tax' })}</div>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(Number(e.target.value) || 0)}
                />
              </label>
              <label className="form-field">
                <div className="label">{t('purchases.otherCosts', { defaultValue: 'Other costs' })}</div>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={otherCosts}
                  onChange={(e) => setOtherCosts(Number(e.target.value) || 0)}
                />
              </label>
            </div>
          </div>

          <TableWrapper>
            <table className="data-table table-grid">
              <thead>
                <tr>
                  <th>{t('purchases.productType', { defaultValue: 'Type' })}</th>
                  <th>{t('inventory.brand', { defaultValue: 'Brand' })}</th>
                  <th>{t('inventory.model', { defaultValue: 'Model' })}</th>
                  <th>{t('purchases.condition', { defaultValue: 'Condition' })}</th>
                  <th>{t('inventory.imei')}</th>
                  <th style={{ width: 120 }}>{t('purchases.qty')}</th>
                  <th style={{ width: 160 }}>{t('products.costPrice')}</th>
                  <th style={{ width: 140 }}>{t('purchases.total')}</th>
                  <th style={{ width: 120 }}>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const lineTotal = (Number(it.quantity) || 0) * (Number(it.costPrice) || 0);
                  return (
                    <tr key={idx}>
                      <td>
                        <select
                          value={it.productType}
                          onChange={(e) =>
                            updateItem(idx, {
                              productType: e.target.value as PurchaseItemDraft['productType'],
                              quantity: e.target.value === 'phone' ? 1 : it.quantity,
                            })
                          }
                        >
                          <option value="phone">phone</option>
                          <option value="part">part</option>
                          <option value="accessory">accessory</option>
                        </select>
                      </td>
                      <td>
                        <input
                          value={it.brand}
                          onChange={(e) => updateItem(idx, { brand: e.target.value })}
                          placeholder={t('inventory.brand', { defaultValue: 'Brand' })}
                        />
                      </td>
                      <td>
                        <input
                          value={it.model}
                          onChange={(e) => updateItem(idx, { model: e.target.value })}
                          placeholder={t('inventory.model', { defaultValue: 'Model' })}
                        />
                      </td>
                      <td>
                        <select
                          value={it.condition}
                          onChange={(e) =>
                            updateItem(idx, { condition: e.target.value as PurchaseItemDraft['condition'] })
                          }
                        >
                          <option value="new">new</option>
                          <option value="used">used</option>
                          <option value="refurbished">refurbished</option>
                        </select>
                      </td>
                      <td>
                        <input
                          value={it.imei}
                          onChange={(e) => updateItem(idx, { imei: e.target.value })}
                          placeholder={it.productType === 'phone' ? t('inventory.imei') : `${t('inventory.imei')} (optional)`}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={it.quantity}
                          disabled={it.productType === 'phone'}
                          onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 1 })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={it.costPrice}
                          onChange={(e) => updateItem(idx, { costPrice: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td>{formatNumberForUi(lineTotal, { maximumFractionDigits: 2 })}</td>
                      <td>
                        <button type="button" className="btn btn-secondary" onClick={() => removeItem(idx)}>
                          {t('common.remove')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={9}>{t('common.noData')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableWrapper>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, gap: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={addItem}>
              {t('purchases.addItem')}
            </button>

            <div className="card" style={{ padding: 16, minWidth: 280 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <div>{t('purchases.subtotal', { defaultValue: 'Merchandise' })}</div>
                <div>
                  {formatNumberForUi(merchandiseSubtotal, { maximumFractionDigits: 2 })} {currency}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontWeight: 700 }}>
                <div>{t('purchases.landedTotal', { defaultValue: 'Total landed' })}</div>
                <div>
                  {formatNumberForUi(landedTotal, { maximumFractionDigits: 2 })} {currency}
                </div>
              </div>
              <button type="button" className="btn btn-primary" disabled={submitting || !commercialWritesAllowed} onClick={onSubmit}>
                {submitting ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </div>
        </>
      )}
    </PageLayout>
  );
}

