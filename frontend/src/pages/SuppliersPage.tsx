import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { suppliersApi, importApi } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Upload, Pencil, Trash2, Eye } from 'lucide-react';

export function SuppliersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);

  const load = () => suppliersApi.getAll().then((r) => setSuppliers(r.data)).catch(() => setSuppliers([]));
  useEffect(() => { load(); }, []);

  const filtered = suppliers.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.country || '').toLowerCase().includes(q) ||
      (s.city || '').toLowerCase().includes(q) ||
      (s.contacts || []).some((c: any) => (c.value || '').toLowerCase().includes(q))
    );
  });

  const handleDelete = async (id: string) => {
    if (!confirm(t('suppliers.deleteConfirm'))) return;
    try {
      await suppliersApi.delete(id);
      toast.success(t('suppliers.supplierDeleted'));
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('common.failed'));
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { toast.error(t('suppliers.selectFile')); return; }
    try {
      const { data } = await importApi.suppliers(file);
      toast.success(t('suppliers.importedSuppliers', { count: data.success }));
      setShowImport(false);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('suppliers.importFailed'));
    }
    e.target.value = '';
  };

  return (
    <div className="page erp-list-page">
      <div className="erp-page-header">
        <div />
        <div className="erp-header-actions">
          <input
            type="text"
            className="erp-search"
            placeholder={t('suppliers.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn btn-secondary btn-erp" onClick={() => setShowImport(true)}>
            <Upload size={16} /> {t('common.import')}
          </button>
          <button className="btn btn-primary btn-erp" onClick={() => navigate('/suppliers/new')}>
            <Plus size={16} /> {t('suppliers.addSupplier')}
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table erp-table-compact">
          <thead>
            <tr>
              <th>{t('suppliers.name')}</th>
              <th>{t('suppliers.country')}</th>
              <th>{t('suppliers.city')}</th>
              <th>{t('suppliers.contacts')}</th>
              <th>{t('suppliers.availableBalance')} / {t('suppliers.blockedBalance')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.country || '—'}</td>
                <td>{s.city || '—'}</td>
                <td>{(s.contacts || []).map((c: any) => `${c.contactType}: ${c.value}`).join('; ') || '—'}</td>
                <td>
                  <span>{Number(s.availableBalance ?? 0).toLocaleString()}</span> / <span>{Number(s.blockedBalance ?? 0).toLocaleString()}</span>
                </td>
                <td>
                  <button className="btn btn-sm" onClick={() => navigate(`/suppliers/${s.id}`)} title={t('common.view')}>
                    <Eye size={14} />
                  </button>
                  <button className="btn btn-sm" onClick={() => navigate(`/suppliers/${s.id}/edit`)} title={t('common.edit')}>
                    <Pencil size={14} />
                  </button>
                  <button className="btn btn-sm btn-danger ml-1" onClick={() => handleDelete(s.id)} title={t('common.delete')}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6}>{t('suppliers.noSuppliers')}</td></tr>}
          </tbody>
        </table>
      </div>

      {showImport && (
        <div className="modal-overlay" onClick={() => setShowImport(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{t('suppliers.importSuppliersExcel')}</h2>
            <p>{t('suppliers.importColumnsNew')}</p>
            <label className="btn btn-primary">
              <Upload size={18} /> {t('suppliers.chooseFile')}
              <input type="file" accept=".xlsx,.xls" onChange={handleImport} hidden />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
