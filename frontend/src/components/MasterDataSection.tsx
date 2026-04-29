import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { masterDataApi } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, X, Search, ChevronDown } from 'lucide-react';
import { getErrorMessage } from '../utils/getErrorMessage';

export type SectionConfig = {
  entity: string;
  titleKey: string;
  addKey: string;
  columns: { key: string; labelKey: string }[];
  formFields: { key: string; labelKey: string; type?: 'text' | 'number' }[];
  renderCell?: (row: any, key: string) => React.ReactNode;
  getFormInit?: (row?: any) => Record<string, string>;
};

export function MasterDataSection({ config, brands }: { config: SectionConfig; brands?: any[] }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(true);
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
    if (!form.name && !form[firstKey] && !form.sizeGb) {
      toast.error(t('masterData.nameRequired'));
      return;
    }
    try {
      const payload: any = {};
      config.formFields.forEach((f) => {
        const v = form[f.key];
        if (v !== undefined && v !== '') payload[f.key] = f.type === 'number' ? parseInt(v, 10) : v;
      });
      if (config.entity === 'storageSizes' && payload.sizeGb && !payload.label) {
        payload.label = payload.sizeGb >= 1024 ? `${payload.sizeGb / 1024} TB` : `${payload.sizeGb} GB`;
      }
      if (editingId) {
        await masterDataApi.update(config.entity, editingId, payload);
        toast.success(t('common.update'));
      } else {
        await masterDataApi.create(config.entity, payload);
        toast.success(t('common.save'));
      }
      resetForm();
      load();
    } catch (err: any) {
      toast.error(getErrorMessage(err, t('common.failed')));
    }
  };

  const handleEdit = (row: any) => {
    const f = config.getFormInit ? config.getFormInit(row) : {};
    config.formFields.forEach((field) => {
      const val = row[field.key] ?? row.brand?.id ?? '';
      if (f[field.key] === undefined) f[field.key] = String(val ?? '');
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

  const renderCell = (row: any, key: string) => {
    if (config.renderCell) return config.renderCell(row, key);
    if (key === 'brand' && row.brand) return row.brand.displayName ?? row.brand.name;
    if (key === 'label' && config.entity === 'storageSizes') return row.label || `${row.sizeGb} GB`;
    return row.displayName ?? row[key] ?? '—';
  };

  return (
    <div className="master-data-section">
      <button type="button" className={`master-data-section-header ${open ? 'open' : ''}`} onClick={() => setOpen(!open)}>
        <span>{t(config.titleKey)}</span>
        <ChevronDown size={16} className="section-chevron" />
      </button>
      {open && (
        <>
          <div className="master-data-section-toolbar">
            <div className="master-data-search">
              <Search size={14} />
              <input type="text" placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="search-input-compact" />
            </div>
            <button type="button" className="btn btn-primary btn-compact" onClick={() => { resetForm(); setShowForm(true); }}>
              <Plus size={14} /> {t(config.addKey)}
            </button>
          </div>
          <div className="master-data-list">
            {items.map((row) => (
              <div key={row.id} className="master-data-row">
                <div className="master-data-row-content">
                  {config.columns.map((c) => (
                    <span key={c.key} className="master-data-cell">{renderCell(row, c.key)}</span>
                  ))}
                </div>
                <div className="master-data-row-actions">
                  <button type="button" className="btn-icon" onClick={() => handleEdit(row)} aria-label={t('common.edit')}><Pencil size={12} /></button>
                  <button type="button" className="btn-icon" onClick={() => handleDelete(row.id)} aria-label={t('common.delete')}><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
            {items.length === 0 && <div className="master-data-empty">{t('masterData.noData')}</div>}
          </div>
          {showForm && (
            <div className="modal-overlay" onClick={resetForm}>
              <div className="modal modal-compact" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>{editingId ? t('common.edit') : t(config.addKey)}</h3>
                  <button type="button" onClick={resetForm} aria-label={t('common.close')}><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="modal-form">
                  {config.formFields.map((field) => (
                    <div key={field.key} className="form-field">
                      <label>{t(field.labelKey)}</label>
                      {field.key === 'brandId' && brands ? (
                        <select
                          value={form[field.key] || ''}
                          onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                          required
                        >
                          <option value="">{t('common.select')}</option>
                          {brands.map((b) => <option key={b.id} value={b.id}>{b.displayName ?? b.name}</option>)}
                        </select>
                      ) : (
                        <input
                          type={field.type || 'text'}
                          value={form[field.key] || ''}
                          onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                          placeholder={t(field.labelKey)}
                          required={field.key === 'name'}
                        />
                      )}
                    </div>
                  ))}
                  <div className="form-actions">
                    <button type="button" className="btn btn-secondary" onClick={resetForm}>{t('common.cancel')}</button>
                    <button type="submit" className="btn btn-primary">{t('common.save')}</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
