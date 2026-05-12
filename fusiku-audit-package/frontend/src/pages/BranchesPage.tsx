import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { branchesApi } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { getErrorMessage } from '../utils/getErrorMessage';
import { PageLayout, PageHeader, TableWrapper } from '../components/design-system';

export function BranchesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [branches, setBranches] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);

  const load = () => branchesApi.getAll().then((r) => setBranches(r.data)).catch(() => setBranches([]));
  useEffect(() => {
    load();
  }, []);

  const filtered = branches.filter((b) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (b.name || '').toLowerCase().includes(q) ||
      (b.code || '').toLowerCase().includes(q) ||
      (b.adminName || '').toLowerCase().includes(q) ||
      (b.phone || '').toLowerCase().includes(q) ||
      (b.city || '').toLowerCase().includes(q) ||
      (b.contacts || []).some((c: any) => (c.value || '').toLowerCase().includes(q))
    );
  });

  useEffect(() => {
    setPage(1);
  }, [search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / Math.max(1, pageSize)));
  const clampedPage = Math.min(pageCount, Math.max(1, page));
  const paged = filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  return (
    <PageLayout className="page erp-list-page">
      <PageHeader
        title={t('nav.branches')}
        actions={
          <>
            <input
              type="text"
              className="erp-search"
              placeholder={t('branches.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="button" className="btn btn-primary btn-erp" onClick={() => navigate('/branches/new')}>
              <Plus size={16} /> {t('settings.addBranch')}
            </button>
          </>
        }
      />

      <TableWrapper>
        <table className="data-table erp-table-compact">
          <thead>
            <tr>
              <th>{t('branches.branchName')}</th>
              <th>{t('branches.branchCode')}</th>
              <th>{t('branches.admin')}</th>
              <th>{t('suppliers.phone')}</th>
              <th>{t('suppliers.city')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td>{b.code || '—'}</td>
                <td>{b.adminName || '—'}</td>
                <td>{(b.contacts || []).find((c: any) => c.contactType === 'phone')?.value || b.phone || '—'}</td>
                <td>{b.city || '—'}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => navigate(`/branches/${b.id}/edit`)}
                    title={t('common.edit')}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger ml-1"
                    onClick={() => {
                      if (confirm(t('branches.deleteConfirm')))
                        branchesApi
                          .delete(b.id)
                          .then(() => {
                            toast.success(t('branches.branchDeleted'));
                            load();
                          })
                          .catch((err) => toast.error(getErrorMessage(err, t('common.failed'))));
                    }}
                    title={t('common.delete')}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6}>{t('branches.noBranches')}</td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="erp-pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 4px' }}>
          <div className="muted" style={{ fontSize: 13 }}>
            {t('common.showing', { defaultValue: 'Showing' })}{' '}
            <strong>
              {filtered.length ? (clampedPage - 1) * pageSize + 1 : 0}–{Math.min(clampedPage * pageSize, filtered.length)}
            </strong>{' '}
            {t('common.of', { defaultValue: 'of' })} <strong>{filtered.length}</strong>
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
    </PageLayout>
  );
}
