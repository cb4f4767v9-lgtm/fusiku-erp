import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Plus, Trash2, Send, Sparkles } from 'lucide-react';

import { PageLayout, PageHeader, TableWrapper } from '../components/design-system';
import {
  inventoryApi,
  pricingRulesApi,
  quotationsApi,
  type PricingRule,
  type Quotation,
  type QuotationGeneratePayload,
  type QuotationItemInput,
} from '../services/api';
import { getErrorMessage } from '../utils/getErrorMessage';
import { formatNumberForUi } from '../utils/formatting';

type DraftRow = {
  key: string;
  inventoryId: string;
  description: string;
  costPrice: string;
  quantity: string;
};

const newRow = (): DraftRow => ({
  key: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now() + Math.random()),
  inventoryId: '',
  description: '',
  costPrice: '',
  quantity: '1',
});

const DEFAULT_SHARE_CURRENCY = 'AED';

export function QuotationsPage() {
  const { t } = useTranslation();

  const [rows, setRows] = useState<DraftRow[]>([newRow()]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [latest, setLatest] = useState<Quotation | null>(null);

  const [rules, setRules] = useState<PricingRule[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);

  useEffect(() => {
    pricingRulesApi
      .list({ active: true, take: 200 })
      .then((r) => setRules(Array.isArray(r.data) ? r.data : []))
      .catch(() => setRules([]));
    inventoryApi
      .getAll({ status: 'available', take: 200 })
      .then((r) => setInventory(Array.isArray(r.data) ? r.data : (r.data as any)?.data ?? []))
      .catch(() => setInventory([]));
  }, []);

  const inventoryById = useMemo(
    () => new Map<string, any>((inventory || []).map((i: any) => [String(i.id), i])),
    [inventory]
  );

  const updateRow = (key: string, patch: Partial<DraftRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, newRow()]);
  const removeRow = (key: string) =>
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.key !== key)));

  const handleInventoryPick = (key: string, inventoryId: string) => {
    const inv = inventoryById.get(inventoryId);
    if (!inv) {
      updateRow(key, { inventoryId, description: '', costPrice: '' });
      return;
    }
    const desc = [inv.brand, inv.model, inv.storage, inv.color].filter(Boolean).join(' ').trim();
    updateRow(key, {
      inventoryId,
      description: desc,
      costPrice: String(inv.purchasePrice ?? ''),
    });
  };

  const buildPayload = (): QuotationGeneratePayload => {
    const items: QuotationItemInput[] = rows
      .map((r) => {
        const trimmedDesc = r.description.trim();
        const costNum = r.costPrice === '' ? undefined : Number(r.costPrice);
        const qtyNum = Math.max(1, Math.trunc(Number(r.quantity || 1)));
        const item: QuotationItemInput = { quantity: qtyNum };
        if (r.inventoryId) item.inventoryId = r.inventoryId;
        if (trimmedDesc) item.description = trimmedDesc;
        if (typeof costNum === 'number' && Number.isFinite(costNum)) item.costPrice = costNum;
        return item;
      })
      .filter((it) => it.inventoryId || (it.description && typeof it.costPrice === 'number'));

    return {
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      notes: notes.trim() || undefined,
      items,
    };
  };

  const handleGenerate = async () => {
    const payload = buildPayload();
    if (payload.items.length === 0) {
      toast.error(t('quotations.errorNeedItems'));
      return;
    }
    try {
      setGenerating(true);
      const r = await quotationsApi.generate(payload);
      setLatest(r.data);
      toast.success(t('quotations.generatedToast'));
    } catch (e: any) {
      toast.error(getErrorMessage(e, t('quotations.generateFailed')));
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = async () => {
    if (!latest) return;
    try {
      setSharing(true);
      const r = await quotationsApi.share(latest.id, DEFAULT_SHARE_CURRENCY);
      const url = r.data?.whatsappUrl;
      if (!url) {
        toast.error(t('quotations.shareFailed'));
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      toast.error(getErrorMessage(e, t('quotations.shareFailed')));
    } finally {
      setSharing(false);
    }
  };

  const total = useMemo(() => {
    if (!latest) return 0;
    return latest.items.reduce((sum, it) => sum + Number(it.sellingPrice || 0) * Math.max(1, it.quantity), 0);
  }, [latest]);

  return (
    <PageLayout className="page erp-list-page">
      <PageHeader
        title={t('quotations.title', { defaultValue: 'Auto Quotations' })}
        subtitle={t('quotations.subtitle', { defaultValue: 'Enter cost — pricing rules calculate selling price and the WhatsApp share text.' })}
        actions={
          <>
            <button
              type="button"
              className="btn btn-primary btn-erp"
              onClick={handleGenerate}
              disabled={generating}
            >
              <Sparkles size={16} /> {generating ? t('common.loading') : t('quotations.generate')}
            </button>
            <button
              type="button"
              className="btn btn-erp"
              onClick={handleShare}
              disabled={!latest || sharing}
              title={!latest ? t('quotations.shareDisabledHint', { defaultValue: 'Generate a quotation first' }) : undefined}
            >
              <Send size={16} /> {sharing ? t('common.loading') : t('quotations.shareWhatsapp')}
            </button>
          </>
        }
      />

      <section className="card" style={{ padding: 16, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <label className="form-row">
          <span className="form-label">{t('quotations.customerName', { defaultValue: 'Customer name' })}</span>
          <input className="form-input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </label>
        <label className="form-row">
          <span className="form-label">{t('quotations.customerPhone', { defaultValue: 'Customer phone (digits only)' })}</span>
          <input className="form-input" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="971501234567" />
        </label>
        <label className="form-row" style={{ gridColumn: '1 / -1' }}>
          <span className="form-label">{t('common.notes')}</span>
          <input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </section>

      <TableWrapper>
        <table className="data-table erp-table-compact">
          <thead>
            <tr>
              <th>{t('quotations.item', { defaultValue: 'Item' })}</th>
              <th>{t('quotations.description', { defaultValue: 'Description' })}</th>
              <th>{t('quotations.costPrice', { defaultValue: 'Cost' })}</th>
              <th>{t('quotations.quantity', { defaultValue: 'Qty' })}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>
                  <select
                    className="form-input"
                    value={row.inventoryId}
                    onChange={(e) => handleInventoryPick(row.key, e.target.value)}
                  >
                    <option value="">{t('quotations.freeText', { defaultValue: '— Free text —' })}</option>
                    {inventory.map((inv: any) => (
                      <option key={inv.id} value={inv.id}>
                        {[inv.brand, inv.model, inv.storage, inv.color].filter(Boolean).join(' ')} ({inv.imei})
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    className="form-input"
                    value={row.description}
                    placeholder={t('quotations.descriptionPlaceholder', { defaultValue: 'e.g. LCD iPhone 13' })}
                    onChange={(e) => updateRow(row.key, { description: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="form-input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={row.costPrice}
                    onChange={(e) => updateRow(row.key, { costPrice: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className="form-input"
                    type="number"
                    min={1}
                    step={1}
                    value={row.quantity}
                    onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => removeRow(row.key)}
                    disabled={rows.length === 1}
                    title={t('common.delete')}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrapper>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" className="btn btn-erp" onClick={addRow}>
          <Plus size={14} /> {t('quotations.addItem', { defaultValue: 'Add item' })}
        </button>
        {rules.length === 0 ? (
          <span className="muted" style={{ alignSelf: 'center' }}>
            {t('quotations.noRulesHint', { defaultValue: 'No pricing rules configured — items will use 0% margin.' })}
          </span>
        ) : null}
      </div>

      {latest ? (
        <section className="card" style={{ padding: 16, marginTop: 16 }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span className="title">
              {t('quotations.latestTitle', { defaultValue: 'Latest quotation' })}
            </span>
            <span className="badge positive">
              {t('quotations.total', { defaultValue: 'Total' })}: {formatNumberForUi(total, { maximumFractionDigits: 2 })} {DEFAULT_SHARE_CURRENCY}
            </span>
          </div>
          <TableWrapper>
            <table className="data-table erp-table-compact">
              <thead>
                <tr>
                  <th>{t('quotations.description', { defaultValue: 'Description' })}</th>
                  <th>{t('quotations.costPrice', { defaultValue: 'Cost' })}</th>
                  <th>{t('quotations.profitPercent', { defaultValue: 'Margin %' })}</th>
                  <th>{t('quotations.sellingPrice', { defaultValue: 'Selling price' })}</th>
                  <th>{t('quotations.quantity', { defaultValue: 'Qty' })}</th>
                  <th>{t('quotations.lineTotal', { defaultValue: 'Line total' })}</th>
                </tr>
              </thead>
              <tbody>
                {latest.items.map((it) => (
                  <tr key={it.id}>
                    <td>
                      {it.description || '—'}
                      {it.ruleSource && it.ruleSource !== 'matched' ? (
                        <span className="badge neutral" style={{ marginInlineStart: 8 }}>
                          {it.ruleSource === 'fallback_highest'
                            ? t('quotations.flagFallback', { defaultValue: 'Highest band' })
                            : t('quotations.flagNoRule', { defaultValue: 'No rule' })}
                        </span>
                      ) : null}
                    </td>
                    <td>{formatNumberForUi(it.costPrice, { maximumFractionDigits: 2 })}</td>
                    <td>{formatNumberForUi(it.profitPercent, { maximumFractionDigits: 2 })}%</td>
                    <td>{formatNumberForUi(it.sellingPrice, { maximumFractionDigits: 2 })}</td>
                    <td>{it.quantity}</td>
                    <td>{formatNumberForUi(it.sellingPrice * it.quantity, { maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrapper>
        </section>
      ) : null}
    </PageLayout>
  );
}

export default QuotationsPage;
