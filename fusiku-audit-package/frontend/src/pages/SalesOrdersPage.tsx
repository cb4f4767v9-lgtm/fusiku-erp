import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Plus, CheckCircle2, FileText, Search, X } from 'lucide-react';
import { PageLayout, PageHeader } from '../components/design-system';
import { customersApi, inventoryApi, salesOrdersApi } from '../services/api';
import { getErrorMessage } from '../utils/getErrorMessage';
import { formatDateTimeForUi } from '../utils/formatting';

type SalesOrderRow = {
  id: string;
  orderNumber?: string | null;
  status: string;
  totalAmount: number;
  currency: string;
  customer?: { id: string; name: string } | null;
  branch?: { id: string; name: string } | null;
  createdAt: string;
};

type DraftItem = { inventoryId: string; imei: string; description: string; unitPrice: number; quantity: 1 };

export function SalesOrdersPage(props?: { title?: string; subtitle?: string }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<SalesOrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [notes, setNotes] = useState('');
  const [scan, setScan] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.unitPrice * i.quantity, 0), [items]);
  const total = useMemo(() => Math.max(0, subtotal * (1 - discountPercent / 100)), [subtotal, discountPercent]);

  const load = useCallback(() => {
    setLoading(true);
    salesOrdersApi
      .list({ q: q.trim() || undefined, status: status || undefined })
      .then((r) => setRows(Array.isArray(r.data) ? r.data : []))
      .catch((e) => toast.error(getErrorMessage(e, t('common.failedToLoad'))))
      .finally(() => setLoading(false));
  }, [q, status, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!createOpen) return;
    customersApi
      .getAll()
      .then((r) => setCustomers(Array.isArray(r.data) ? r.data : []))
      .catch(() => setCustomers([]));
  }, [createOpen]);

  const addByScan = async () => {
    const input = scan.trim();
    if (!input) return;
    try {
      const res = input.startsWith('FUS') ? await inventoryApi.getByBarcode(input) : await inventoryApi.getByImei(input);
      const inv = res.data;
      if (!inv || inv.status !== 'available') {
        toast.error(t('pos.itemNotAvailable'));
        return;
      }
      if (items.some((i) => i.inventoryId === inv.id)) {
        toast.error(t('pos.alreadyInCart'));
        return;
      }
      setItems((prev) => [
        ...prev,
        {
          inventoryId: inv.id,
          imei: String(inv.imei || ''),
          description: `${inv.brand} ${inv.model} ${inv.storage || ''}`.trim(),
          unitPrice: Number(inv.sellingPrice || 0),
          quantity: 1,
        },
      ]);
      setScan('');
    } catch (e: any) {
      toast.error(getErrorMessage(e, t('pos.imeiNotFound')));
    }
  };

  const removeItem = (inventoryId: string) => setItems((prev) => prev.filter((x) => x.inventoryId !== inventoryId));

  const resetDraft = () => {
    setCustomerId('');
    setCurrency('USD');
    setDiscountPercent(0);
    setNotes('');
    setScan('');
    setItems([]);
  };

  const create = async () => {
    if (!items.length) {
      toast.error(t('pos.cartEmpty'));
      return;
    }
    try {
      const payload = {
        customerId: customerId || undefined,
        currency,
        discountPercent: discountPercent > 0 ? discountPercent : undefined,
        notes: notes.trim() || undefined,
        items: items.map((i) => ({
          inventoryId: i.inventoryId,
          imei: i.imei,
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      };
      await salesOrdersApi.create(payload);
      toast.success(t('common.saved') || 'Saved');
      setCreateOpen(false);
      resetDraft();
      load();
    } catch (e: any) {
      toast.error(getErrorMessage(e, t('common.saveFailed')));
    }
  };

  const confirm = async (id: string) => {
    try {
      await salesOrdersApi.confirm(id);
      toast.success(t('common.updated') || 'Updated');
      load();
    } catch (e: any) {
      toast.error(getErrorMessage(e, t('common.actionFailed')));
    }
  };

  const convertToInvoice = async (id: string) => {
    try {
      const { data } = await salesOrdersApi.convertToInvoice(id, {});
      toast.success((t('invoices.created') || 'Invoice created') + (data?.invoiceId ? ` #${String(data.invoiceId).slice(-8)}` : ''));
      load();
    } catch (e: any) {
      toast.error(getErrorMessage(e, t('common.actionFailed')));
    }
  };

  return (
    <PageLayout className="page">
      <PageHeader
        title={props?.title ?? (t('nav.salesOrders') || 'Sales Orders')}
        subtitle={props?.subtitle ?? (t('salesOrders.subtitle') || 'Create, confirm, and convert sales orders to invoices.')}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            <Plus size={18} /> {t('common.new') || 'New'}
          </button>
        }
      />

      <div className="card">
        <div className="sales-toolbar">
          <div className="sales-toolbar__search">
            <Search size={18} aria-hidden />
            <input
              className="input sales-toolbar__input"
              placeholder={t('common.search') || 'Search'}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select className="input sales-toolbar__select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('common.allStatuses') || 'All statuses'}</option>
            <option value="draft">{t('common.draft') || 'Draft'}</option>
            <option value="confirmed">{t('common.confirmed') || 'Confirmed'}</option>
            <option value="invoiced">{t('common.invoiced') || 'Invoiced'}</option>
            <option value="cancelled">{t('common.cancelled') || 'Cancelled'}</option>
          </select>
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
            {t('common.refresh') || 'Refresh'}
          </button>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('common.id') || 'ID'}</th>
                <th>{t('customers.title') || 'Customer'}</th>
                <th>{t('branches.title') || 'Branch'}</th>
                <th>{t('common.status') || 'Status'}</th>
                <th className="num">{t('pos.total') || 'Total'}</th>
                <th>{t('common.created') || 'Created'}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.orderNumber || r.id.slice(-8)}</td>
                  <td>{r.customer?.name || '—'}</td>
                  <td>{r.branch?.name || '—'}</td>
                  <td>{r.status}</td>
                  <td className="num">
                    {Number(r.totalAmount || 0).toFixed(2)} {r.currency || 'USD'}
                  </td>
                  <td>{formatDateTimeForUi(r.createdAt)}</td>
                  <td className="num">
                    {r.status === 'draft' ? (
                      <button type="button" className="btn btn-secondary btn-compact" onClick={() => confirm(r.id)}>
                        <CheckCircle2 size={16} /> {t('common.confirm') || 'Confirm'}
                      </button>
                    ) : r.status === 'confirmed' ? (
                      <button type="button" className="btn btn-primary btn-compact" onClick={() => convertToInvoice(r.id)}>
                        <FileText size={16} /> {t('nav.invoices') || 'Invoice'}
                      </button>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={7} className="data-table-empty-cell">
                    {loading ? t('common.loading') : t('common.noData')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h2>{t('salesOrders.newTitle') || 'New Sales Order'}</h2>
              <button type="button" onClick={() => setCreateOpen(false)} aria-label={t('common.close') || 'Close'}>
                <X size={18} />
              </button>
            </div>

            <div className="stack-form">
              <label>
                <span>{t('customers.title') || 'Customer'}</span>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">{t('pos.walkIn') || 'Walk-in'}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="sales-draft-grid">
                <label>
                  <span>{t('currency.title') || 'Currency'}</span>
                  <input className="input" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
                </label>
                <label>
                  <span>{t('pos.discount') || 'Discount %'}</span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={100}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                  />
                </label>
              </div>

              <label>
                <span>{t('common.notes') || 'Notes'}</span>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>

              <div className="sales-add-item">
                <div className="sales-add-item__search">
                  <Search size={18} aria-hidden />
                  <input
                    className="input sales-toolbar__input"
                    placeholder={t('pos.scanPlaceholder') || 'Scan IMEI or barcode'}
                    value={scan}
                    onChange={(e) => setScan(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void addByScan();
                      }
                    }}
                  />
                </div>
                <button type="button" className="btn btn-secondary" onClick={() => void addByScan()}>
                  {t('common.add') || 'Add'}
                </button>
              </div>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('receipt.imei') || 'IMEI'}</th>
                      <th>{t('pos.item') || 'Item'}</th>
                      <th className="num">{t('pos.price') || 'Price'}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.inventoryId}>
                        <td>{i.imei}</td>
                        <td>{i.description}</td>
                        <td className="num">{i.unitPrice.toFixed(2)}</td>
                        <td className="num">
                          <button type="button" className="btn btn-secondary btn-compact" onClick={() => removeItem(i.inventoryId)}>
                            {t('common.remove') || 'Remove'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!items.length ? (
                      <tr>
                        <td colSpan={4} className="data-table-empty-cell">
                          {t('pos.scanEmptyCart') || 'Add items to continue.'}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="sales-totals">
                <div className="sales-totals__row">
                  <span className="muted">{t('pos.subtotal') || 'Subtotal'}</span>
                  <strong>
                    {subtotal.toFixed(2)} {currency}
                  </strong>
                </div>
                <div className="sales-totals__row">
                  <span className="muted">{t('pos.total') || 'Total'}</span>
                  <strong>
                    {total.toFixed(2)} {currency}
                  </strong>
                </div>
              </div>

              <div className="ds-form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => { resetDraft(); setCreateOpen(false); }}>
                  {t('common.cancel') || 'Cancel'}
                </button>
                <button type="button" className="btn btn-primary" onClick={() => void create()}>
                  {t('common.save') || 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PageLayout>
  );
}

