import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { masterDataApi } from '../../services/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, X, Search } from 'lucide-react';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { PageLayout, PageHeader, TableWrapper } from '../../components/design-system';

export function MasterPhoneModelsPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ brandId: '', name: '', releaseYear: '' });

  const load = () => {
    masterDataApi.getAll('phoneModels', search ? { q: search } : undefined)
      .then((r) => setItems(r.data))
      .catch(() => setItems([]));
  };

  useEffect(() => { load(); }, [search]);
  useEffect(() => {
    masterDataApi.getAll('brands').then((r) => setBrands(r.data)).catch(() => setBrands([]));
  }, []);

  const resetForm = () => {
    setForm({ brandId: '', name: '', releaseYear: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brandId || !form.name) {
      toast.error(t('masterData.nameRequired'));
      return;
    }
    try {
      const payload = { brandId: form.brandId, name: form.name, releaseYear: form.releaseYear ? parseInt(form.releaseYear, 10) : null };
      if (editingId) {
        await masterDataApi.update('phoneModels', editingId, payload);
        toast.success(t('common.update'));
      } else {
        await masterDataApi.create('phoneModels', payload);
        toast.success(t('common.save'));
      }
      resetForm();
      load();
    } catch (err: any) {
      toast.error(getErrorMessage(err, t('common.failed')));
    }
  };

  const handleEdit = (row: any) => {
    setForm({
      brandId: row.brandId || row.brand?.id || '',
      name: row.name || '',
      releaseYear: row.releaseYear ? String(row.releaseYear) : ''
    });
    setEditingId(row.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('masterData.deleteConfirm'))) return;
    try {
      await masterDataApi.delete('phoneModels', id);
      toast.success(t('common.delete'));
      load();
    } catch (err: any) {
      toast.error(getErrorMessage(err, t('common.failed')));
    }
  };

  return (
    <PageLayout className="page page-master-data">
      <PageHeader
        title={t('masterData.phoneModels')}
        actions={
          <>
            <div className="master-data-search">
              <Search size={18} />
              <input
                type="text"
                placeholder={t('common.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="search-input-compact"
              />
            </div>
            <button type="button" className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
              <Plus size={18} /> {t('masterData.addPhoneModel')}
            </button>
          </>
        }
      />

      <TableWrapper className="table-compact">
        <table className="data-table data-table-compact">
          <thead>
            <tr>
              <th>{t('masterData.brand')}</th>
              <th>{t('masterData.modelName')}</th>
              <th>{t('masterData.releaseYear')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                <td>{row.brand?.displayName ?? row.brand?.name ?? '—'}</td>
                <td>{row.displayName ?? row.name}</td>
                <td>{row.releaseYear || '—'}</td>
                <td>
                  <button type="button" className="btn btn-secondary btn-compact" onClick={() => handleEdit(row)}><Pencil size={14} /></button>
                  <button type="button" className="btn btn-secondary btn-compact" onClick={() => handleDelete(row.id)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={4}>{t('masterData.noData')}</td></tr>}
          </tbody>
        </table>
      </TableWrapper>

      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal product-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="product-form-header">
              <h2>{editingId ? t('common.edit') : t('masterData.addPhoneModel')}</h2>
              <button type="button" onClick={resetForm} aria-label={t('common.close')}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="product-form">
              <div className="product-form-grid">
                <div className="product-form-field">
                  <label>{t('masterData.brand')}</label>
                  <select required value={form.brandId} onChange={(e) => setForm((f) => ({ ...f, brandId: e.target.value }))}>
                    <option value="">{t('common.select')}</option>
                    {brands.map((b) => <option key={b.id} value={b.id}>{b.displayName ?? b.name}</option>)}
                  </select>
                </div>
                <div className="product-form-field">
                  <label>{t('masterData.modelName')}</label>
                  <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t('masterData.modelName')} />
                </div>
                <div className="product-form-field">
                  <label>{t('masterData.releaseYear')}</label>
                  <input type="number" min="2007" max="2030" value={form.releaseYear} onChange={(e) => setForm((f) => ({ ...f, releaseYear: e.target.value }))} placeholder="2024" />
                </div>
              </div>
              <div className="product-form-actions">
                <button type="button" className="btn btn-secondary" onClick={resetForm}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('common.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
