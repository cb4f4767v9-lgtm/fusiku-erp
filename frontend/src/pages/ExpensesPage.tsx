import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { expensesApi, branchesApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { enqueueIfOfflineDesktop } from '../offline/outboxEnqueue';
import { OUTBOX_KIND } from '../offline/outboxKinds';
import { persistDesktopCache, readDesktopCache } from '../offline/desktopCache';
import { PageLayout, PageHeader } from '../components/design-system';
import { getErrorMessage } from '../utils/getErrorMessage';
import { formatDateForUi, formatNumberForUi } from '../utils/formatting';
import { isSuperAdmin } from '../utils/permissions';

const CATEGORIES = ['rent', 'salary', 'cargo', 'misc'] as const;

export function ExpensesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({
    category: 'misc' as string,
    amount: '',
    branchId: '',
    expenseDate: new Date().toISOString().slice(0, 10),
    description: ''
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    branchesApi
      .getAll()
      .then((r) => {
        const b = (r.data || []) as { id: string; name: string }[];
        setBranches(b);
        if (user?.branchId) {
          setForm((f) => ({ ...f, branchId: user.branchId! }));
        } else if (b.length === 1) {
          setForm((f) => ({ ...f, branchId: b[0].id }));
        }
      })
      .catch(() => setBranches([]));
  }, [user?.branchId]);

  const loadList = () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      void (async () => {
        const cached = await readDesktopCache<unknown[]>('expenses');
        setList(Array.isArray(cached) ? cached : []);
      })();
      return;
    }
    expensesApi
      .list({ month })
      .then((r) => {
        const rows = r.data || [];
        setList(rows);
        void persistDesktopCache('expenses', rows);
      })
      .catch(() => setList([]));
  };

  useEffect(() => {
    loadList();
  }, [month]);

  const monthTotal = useMemo(() => list.reduce((s, x) => s + Number(x.amount || 0), 0), [list]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    if (!form.branchId) {
      setErr(t('expenses.branch'));
      return;
    }
    try {
      const body = {
        category: form.category,
        amount: Number(form.amount),
        branchId: form.branchId,
        expenseDate: form.expenseDate,
        description: form.description || undefined,
      };
      if (await enqueueIfOfflineDesktop(OUTBOX_KIND.EXPENSE_CREATE, body)) {
        setMsg(t('offline.expenseQueuedOffline'));
        setForm((f) => ({ ...f, amount: '', description: '' }));
        loadList();
        window.dispatchEvent(new Event('fusiku-dashboard-refresh'));
        return;
      }
      await expensesApi.create(body);
      setMsg(t('expenses.saved'));
      setForm((f) => ({ ...f, amount: '', description: '' }));
      loadList();
      window.dispatchEvent(new Event('fusiku-dashboard-refresh'));
    } catch (ex: any) {
      setErr(getErrorMessage(ex, t('expenses.saveFailed')));
    }
  };

  return (
    <PageLayout className="page">
      <PageHeader title={t('expenses.title')} subtitle={t('expenses.subtitle')} />

      <div className="dashboard-grid-2">
        <div className="card">
          <h3>{t('expenses.add')}</h3>
          <form className="stack-form" onSubmit={submit}>
            <label>
              <span>{t('expenses.type')}</span>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`expenses.types.${c}`)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t('expenses.amount')}</span>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </label>
            <label>
              <span>{t('expenses.branch')}</span>
              <select
                required
                value={form.branchId}
                disabled={!isSuperAdmin(user)}
                onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}
              >
                <option value="">{t('common.selectPlaceholder')}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t('expenses.date')}</span>
              <input
                type="date"
                required
                value={form.expenseDate}
                onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
              />
            </label>
            <label>
              <span>{t('expenses.description')}</span>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            {msg ? <p className="ds-field-success">{msg}</p> : null}
            {err ? <p className="ds-field-error">{err}</p> : null}
            <div className="ds-form-actions">
              <button type="submit" className="btn btn-primary">
                {t('common.save')}
              </button>
            </div>
          </form>
        </div>

        <div className="card">
          <h3>{t('expenses.listTitle')}</h3>
          <label className="report-filters report-filters--inline">
            <span>{t('expenses.monthFilter')}</span>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
          <p className="muted">
            {t('expenses.monthTotal')}:{' '}
            <strong>
              {formatNumberForUi(monthTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </p>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('expenses.date')}</th>
                  <th>{t('expenses.branch')}</th>
                  <th>{t('expenses.type')}</th>
                  <th className="num">{t('expenses.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDateForUi(row.expenseDate)}</td>
                    <td>{row.branch?.name ?? '—'}</td>
                    <td>{t(`expenses.types.${row.category}`, { defaultValue: row.category })}</td>
                    <td className="num">
                      {formatNumberForUi(Number(row.amount), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
                {!list.length && (
                  <tr>
                    <td colSpan={4} className="data-table-empty-cell">
                      {t('expenses.emptyList')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
