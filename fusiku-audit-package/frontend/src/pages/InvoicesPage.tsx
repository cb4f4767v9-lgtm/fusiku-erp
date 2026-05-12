import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Search, CreditCard, X } from 'lucide-react';
import { PageLayout, PageHeader } from '../components/design-system';
import { invoicesApi } from '../services/api';
import { getErrorMessage } from '../utils/getErrorMessage';
import { formatDateTimeForUi } from '../utils/formatting';

type InvoiceRow = {
  id: string;
  invoiceNumber?: string | null;
  status: string;
  totalAmount: number;
  amountPaid: number;
  currency: string;
  customer?: { id: string; name: string } | null;
  branch?: { id: string; name: string } | null;
  createdAt: string;
};

export function InvoicesPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'cash' | 'card' | 'transfer'>('cash');

  const load = useCallback(() => {
    setLoading(true);
    invoicesApi
      .list({ q: q.trim() || undefined, status: status || undefined })
      .then((r) => setRows(Array.isArray(r.data) ? r.data : []))
      .catch((e) => toast.error(getErrorMessage(e, t('common.failedToLoad'))))
      .finally(() => setLoading(false));
  }, [q, status, t]);

  useEffect(() => {
    load();
  }, [load]);

  const loadDetail = useCallback(
    (id: string) => {
      setSelectedId(id);
      setDetail(null);
      setPayAmount('');
      invoicesApi
        .getById(id)
        .then((r) => setDetail(r.data))
        .catch((e) => toast.error(getErrorMessage(e, t('common.failedToLoad'))));
    },
    [t]
  );

  const totals = useMemo(() => {
    const due = Number(detail?.totalAmount || 0);
    const paid = Number(detail?.amountPaid || 0);
    return { due, paid, remaining: Math.max(0, due - paid) };
  }, [detail]);

  const addPayment = async () => {
    if (!selectedId) return;
    const amt = Number(payAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error(t('common.invalidAmount') || 'Invalid amount');
      return;
    }
    try {
      await invoicesApi.addPayment(selectedId, { amount: amt, method: payMethod });
      toast.success(t('common.saved') || 'Saved');
      await invoicesApi.getById(selectedId).then((r) => setDetail(r.data));
      load();
      setPayAmount('');
    } catch (e: any) {
      toast.error(getErrorMessage(e, t('common.actionFailed')));
    }
  };

  return (
    <PageLayout className="page">
      <PageHeader
        title={t('nav.invoices') || 'Invoices'}
        subtitle={t('invoices.subtitle') || 'Track unpaid/partial/paid invoices and profit per item.'}
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
            <option value="unpaid">{t('common.unpaid') || 'Unpaid'}</option>
            <option value="partial">{t('common.partial') || 'Partial'}</option>
            <option value="paid">{t('common.paid') || 'Paid'}</option>
            <option value="void">{t('common.void') || 'Void'}</option>
          </select>
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
            {t('common.refresh') || 'Refresh'}
          </button>
        </div>

        <div className="sales-split">
          <div className="sales-split__left">
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('common.id') || 'ID'}</th>
                    <th>{t('customers.title') || 'Customer'}</th>
                    <th>{t('branches.title') || 'Branch'}</th>
                    <th>{t('common.status') || 'Status'}</th>
                    <th className="num">{t('pos.total') || 'Total'}</th>
                    <th className="num">{t('common.paid') || 'Paid'}</th>
                    <th>{t('common.created') || 'Created'}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className={selectedId === r.id ? 'is-selected' : ''}
                      onClick={() => loadDetail(r.id)}
                    >
                      <td>{r.invoiceNumber || r.id.slice(-8)}</td>
                      <td>{r.customer?.name || '—'}</td>
                      <td>{r.branch?.name || '—'}</td>
                      <td>{r.status}</td>
                      <td className="num">
                        {Number(r.totalAmount || 0).toFixed(2)} {r.currency || 'USD'}
                      </td>
                      <td className="num">
                        {Number(r.amountPaid || 0).toFixed(2)} {r.currency || 'USD'}
                      </td>
                      <td>{formatDateTimeForUi(r.createdAt)}</td>
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

          <div className="sales-split__right">
            {detail ? (
              <div className="card sales-detail-card">
                <div className="sales-detail-head">
                  <div>
                    <div className="sales-detail-title">{t('nav.invoices') || 'Invoice'} #{(detail.invoiceNumber || detail.id).slice(-8)}</div>
                    <div className="muted">
                      {detail.customer?.name || (t('pos.walkIn') || 'Walk-in')} · {detail.status} ·{' '}
                      {formatDateTimeForUi(detail.createdAt)}
                    </div>
                  </div>
                  <button type="button" className="btn btn-secondary btn-compact" onClick={() => { setSelectedId(null); setDetail(null); }}>
                    <X size={16} /> {t('common.close') || 'Close'}
                  </button>
                </div>

                <div className="sales-totals sales-totals--compact">
                  <div className="sales-totals__row">
                    <span className="muted">{t('pos.total') || 'Total'}</span>
                    <strong>
                      {Number(detail.totalAmount || 0).toFixed(2)} {detail.currency}
                    </strong>
                  </div>
                  <div className="sales-totals__row">
                    <span className="muted">{t('common.paid') || 'Paid'}</span>
                    <strong>
                      {Number(detail.amountPaid || 0).toFixed(2)} {detail.currency}
                    </strong>
                  </div>
                  <div className="sales-totals__row">
                    <span className="muted">{t('common.remaining') || 'Remaining'}</span>
                    <strong>
                      {totals.remaining.toFixed(2)} {detail.currency}
                    </strong>
                  </div>
                </div>

                <div className="sales-payment">
                  <div className="sales-payment__row">
                    <div className="sales-payment__field">
                      <div className="sales-payment__label">{t('common.amount') || 'Amount'}</div>
                      <input className="input" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0.00" />
                    </div>
                    <div className="sales-payment__field">
                      <div className="sales-payment__label">{t('pos.paymentMethod') || 'Method'}</div>
                      <select className="input" value={payMethod} onChange={(e) => setPayMethod(e.target.value as any)}>
                        <option value="cash">{t('erp.paymentCash') || 'Cash'}</option>
                        <option value="card">{t('common.card') || 'Card'}</option>
                        <option value="transfer">{t('erp.paymentTransfer') || 'Transfer'}</option>
                      </select>
                    </div>
                    <button type="button" className="btn btn-primary sales-payment__btn" onClick={() => void addPayment()}>
                      <CreditCard size={18} /> {t('common.addPayment') || 'Add payment'}
                    </button>
                  </div>
                </div>

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t('receipt.imei') || 'IMEI'}</th>
                        <th>{t('pos.item') || 'Item'}</th>
                        <th className="num">{t('pos.price') || 'Sale'}</th>
                        <th className="num">{t('purchases.cost') || 'Cost'}</th>
                        <th className="num">{t('reports.profit') || 'Profit'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.items || []).map((it: any) => (
                        <tr key={it.id}>
                          <td>{it.imei || '—'}</td>
                          <td>{it.description || '—'}</td>
                          <td className="num">{Number(it.salePrice || 0).toFixed(2)}</td>
                          <td className="num">{Number(it.costPrice || 0).toFixed(2)}</td>
                          <td className="num">{Number(it.profit || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                      {!detail.items?.length ? (
                        <tr>
                          <td colSpan={5} className="data-table-empty-cell">
                            {t('common.noData') || 'No data'}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="card sales-detail-card sales-detail-card--empty">
                <div className="muted">{t('invoices.selectHint') || 'Select an invoice to view details and add payments.'}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

