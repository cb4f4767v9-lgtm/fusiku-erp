import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { customersApi } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { getErrorMessage } from '../utils/getErrorMessage';
import { PageLayout, PageHeader, TableWrapper } from '../components/design-system';
import { formatNumberForUi } from '../utils/formatting';

function formatCustomerBalance(c: any) {
  const opening = Number(c?.openingBalance || 0);
  const status = String(c?.moneyStatus || 'available');
  const balType = String(c?.balanceType || 'debit');
  const num = formatNumberForUi(opening, { maximumFractionDigits: 2 });

  if (status === 'blocked') return `${num} (Blocked Amount)`;
  if (balType === 'credit') return `${num} (Credit Balance)`;
  return `${num} (Advance)`;
}

export function CustomersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  const load = () => customersApi.getAll().then((r) => setCustomers(r.data)).catch(() => setCustomers([]));
  useEffect(() => { load(); }, []);

  const filtered = customers.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.city || '').toLowerCase().includes(q) ||
      (c.contacts || []).some((x: any) => (x.value || '').toLowerCase().includes(q))
    );
  });

  const handleDelete = async (id: string) => {
    if (!confirm(t('customers.deleteCustomerConfirm'))) return;
    try {
      await customersApi.delete(id);
      toast.success(t('customers.customerDeleted'));
      load();
    } catch (err: any) {
      toast.error(getErrorMessage(err, t('customers.deleteFailed')));
    }
  };

  return (
    <PageLayout className="page erp-list-page">
      <PageHeader
        title={t('customers.title')}
        actions={
          <>
            <input
              type="text"
              className="erp-search"
              placeholder={t('customers.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="button" className="btn btn-primary btn-erp" onClick={() => navigate('/customers/new')}>
              <Plus size={16} /> {t('customers.newCustomer')}
            </button>
          </>
        }
      />

      <TableWrapper>
        <table className="data-table erp-table-compact">
          <thead>
            <tr>
              <th>{t('customers.name')}</th>
              <th>{t('customers.phone')}</th>
              <th>{t('suppliers.city')}</th>
              <th>{t('erp.balance')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.phone || '—'}</td>
                <td>{c.city || '—'}</td>
                <td>{formatCustomerBalance(c)}</td>
                <td>
                  <button className="btn btn-sm" onClick={() => navigate(`/customers/${c.id}/edit`)} title={t('common.edit')}>
                    <Pencil size={14} />
                  </button>
                  <button className="btn btn-sm btn-danger ml-1" onClick={() => handleDelete(c.id)} title={t('common.delete')}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5}>{t('customers.noCustomers')}</td></tr>}
          </tbody>
        </table>
      </TableWrapper>
    </PageLayout>
  );
}
