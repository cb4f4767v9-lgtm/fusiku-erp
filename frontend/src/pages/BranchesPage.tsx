import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { branchesApi } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export function BranchesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [branches, setBranches] = useState<any[]>([]);
  const [search, setSearch] = useState('');

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

  return (
    <div className="page erp-list-page">
      <div className="erp-page-header">
        <div />
        <div className="erp-header-actions">
          <input
            type="text"
            className="erp-search"
            placeholder={t('branches.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn btn-primary btn-erp" onClick={() => navigate('/branches/new')}>
            <Plus size={16} /> {t('settings.addBranch')}
          </button>
        </div>
      </div>

      <div className="table-container">
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
            {filtered.map((b) => (
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
                          .catch((err) => toast.error(err.response?.data?.error));
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
      </div>
    </div>
  );
}
