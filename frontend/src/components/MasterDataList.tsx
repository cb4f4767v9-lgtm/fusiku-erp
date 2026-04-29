import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { masterDataApi } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, X, Search } from 'lucide-react';
import { getErrorMessage } from '../utils/getErrorMessage';

export type MasterDataConfig = {
  entity: string;
  titleKey: string;
  addKey: string;
  columns: { key: string; labelKey: string }[];
  formFields: { key: string; labelKey: string; type?: 'text' | 'number' }[];
};

export function MasterDataList({ config }: { config: MasterDataConfig }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const load = () => {
    masterDataApi.getAll(config.entity, search ? { q: search } : undefined)
      .then((r) => setItems(r.data))
      .catch(() => setItems([]));
  };

  useEffect(() => { load(); }, [config.entity, search]);


  const resetForm = () => {
    const init: Record<string, string> = {};
    config.formFields.forEach((f) => { init[f.key] = ''; });
    setForm(init);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const firstKey = config.formFields[0]?.key;
    if (!form.name && !form[firstKey]) {
      toast.error(t('masterData.nameRequired'));
      return;
    }
    try {
      const payload: any = {};
      config.formFields.forEach((f) => {
        const v = form[f.key];
        if (v !== undefined && v !== '') payload[f.key] = f.type === 'number' ? parseInt(v, 10) : v;
      });
      if (editingId) {
        await masterDataApi.update(config.entity, editingId, payload);
        toast.success(t('common.update'));
      } else {
        await masterDataApi.create(config.entity, payload);
        toast.success(t('common.update'));
      }
      resetForm();
      load();
    } catch (err: any) {
      toast.error(getErrorMessage(err, t('common.failed')));
    }
  };

  const handleEdit = (row: any) => {
    const f: Record<string, string> = {};
    config.formFields.forEach((field) => {
      const val = row[field.key] ?? row.brand?.id ?? '';
      f[field.key] = String(val ?? '');
    });
    setForm(f);
    setEditingId(row.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('masterData.deleteConfirm'))) return;
    try {
      await masterDataApi.delete(config.entity, id);
      toast.success(t('common.delete'));
      load();
    } catch (err: any) {
      toast.error(getErrorMessage(err, t('common.failed')));
    }
  };

  return (
    <div className="page page-master-data">
      <div className="page-header">
        <h1>{t(config.titleKey)}</h1>
        <div className="page-actions">
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
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus size={18} /> {t(config.addKey)}
          </button>
        </div>
      </div>

      <div className="table-container table-compact">
        <table className="data-table data-table-compact">
          <thead>
            <tr>
              {config.columns.map((c) => (
                <th key={c.key}>{t(c.labelKey)}</th>
              ))}
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                {config.columns.map((c) => (
                  <td key={c.key}>
                    {c.key === 'brand' && row.brand
                      ? (row.brand.displayName ?? row.brand.name)
                      : (row.displayName ?? row[c.key] ?? '—')}
                  </td>
                ))}
                <td>
                  <button type="button" className="btn btn-secondary btn-compact" onClick={() => handleEdit(row)}>
                    <Pencil size={14} />
                  </button>
                  <button type="button" className="btn btn-secondary btn-compact" onClick={() => handleDelete(row.id)}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={config.columns.length + 1}>{t('masterData.noData')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal product-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="product-form-header">
              <h2>{editingId ? t('common.edit') : t(config.addKey)}</h2>
              <button type="button" onClick={resetForm} aria-label={t('common.close')}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="product-form">
              <div className="product-form-grid">
                {config.formFields.map((field) => (
                  <div key={field.key} className="product-form-field">
                    <label>{t(field.labelKey)}</label>
                    <input
                      type={field.type || 'text'}
                      value={form[field.key] || ''}
                      onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                      placeholder={t(field.labelKey)}
                      required={field.key === 'name'}
                    />
                  </div>
                ))}
              </div>
              <div className="product-form-actions">
                <button type="button" className="btn btn-secondary" onClick={resetForm}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary">{t('common.save')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
