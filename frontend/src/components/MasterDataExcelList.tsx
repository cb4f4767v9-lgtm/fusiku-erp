import { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { masterDataApi } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, X, Search } from 'lucide-react';

const LANG_COLUMN_MAP: Record<string, string> = {
  en: 'name',
  'en-US': 'name',
  zh: 'nameZh',
  'zh-CN': 'nameZh',
  ar: 'nameAr',
  'ar-SA': 'nameAr',
  ur: 'nameUr',
  'ur-PK': 'nameUr'
};

export type ExcelListConfig = {
  entity: string;
  titleKey: string;
  addKey: string;
  columns: { key: string; labelKey: string }[];
  formFields: { key: string; labelKey: string; type?: 'text' | 'number' }[];
  renderCell?: (row: any, key: string) => React.ReactNode;
  getFormInit?: (row?: any) => Record<string, string>;
  /** For categories: use single language column */
  useLanguageColumn?: boolean;
};

export function MasterDataExcelList({ config, brands }: { config: ExcelListConfig; brands?: any[] }) {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [brandFilter, setBrandFilter] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isPhoneModels = config.entity === 'phoneModels';

  const lang = (i18n.language || 'en').split('-')[0];
  const langColumn = LANG_COLUMN_MAP[lang] || LANG_COLUMN_MAP[i18n.language] || 'name';
  const displayColumns = config.useLanguageColumn
    ? [{ key: langColumn, labelKey: 'masterData.name' }]
    : config.columns;
  const displayFormFields = config.useLanguageColumn
    ? config.formFields.filter((f) => f.key === langColumn)
    : config.formFields;

  const load = useCallback(() => {
    const params: { q?: string; brandId?: string } = {};
    if (search) params.q = search;
    if (isPhoneModels && brandFilter) params.brandId = brandFilter;
    masterDataApi.getAll(config.entity, Object.keys(params).length ? params : undefined)
      .then((r) => setItems(r.data))
      .catch(() => setItems([]));
  }, [config.entity, search, isPhoneModels, brandFilter]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    const init: Record<string, string> = {};
    config.formFields.forEach((f) => { init[f.key] = ''; });
    setForm(init);
    setEditingId(null);
    setShowForm(false);
    setSelectedIndex(-1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const firstKey = displayFormFields[0]?.key;
    if (!form.name && !form[firstKey] && !form.sizeGb) {
      toast.error(t('masterData.nameRequired'));
      return;
    }
    try {
      const payload: any = {};
      displayFormFields.forEach((f) => {
        const v = form[f.key];
        if (v !== undefined && v !== '') payload[f.key] = f.type === 'number' ? parseInt(v, 10) : v;
      });
      if (config.useLanguageColumn && payload[langColumn]) {
        if (!editingId) payload.name = payload[langColumn];
      }
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
      const msg = err.response?.data?.error || t('common.failed');
      toast.error(msg === 'Item already exists.' ? t('masterData.itemExists') : msg);
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
      toast.error(err.response?.data?.error || t('common.failed'));
    }
  };

  const renderCell = (row: any, key: string) => {
    if (config.renderCell) return config.renderCell(row, key);
    if (key === 'brand' && row.brand) return row.brand.name;
    if (key === 'label' && config.entity === 'storageSizes') return row.label || `${row.sizeGb} GB`;
    return row[key] ?? '—';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showForm) {
      if (e.key === 'Escape') {
        e.preventDefault();
        resetForm();
      }
      return;
    }
    if (e.key === 'ArrowDown' && selectedIndex < items.length - 1) {
      e.preventDefault();
      const next = selectedIndex + 1;
      setSelectedIndex(next);
      listRef.current?.querySelector(`[data-row-index="${next}"]`)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp' && selectedIndex > 0) {
      e.preventDefault();
      const prev = selectedIndex - 1;
      setSelectedIndex(prev);
      listRef.current?.querySelector(`[data-row-index="${prev}"]`)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && selectedIndex >= 0 && items[selectedIndex]) {
      e.preventDefault();
      handleEdit(items[selectedIndex]);
    }
  };

  return (
    <div className="master-data-excel" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="master-data-excel-header">
        <span className="master-data-excel-title">{t(config.titleKey)}</span>
        <div className="master-data-excel-toolbar">
          {isPhoneModels && brands && (
            <select
              className="master-data-brand-filter"
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              aria-label={t('masterData.filterByBrand')}
            >
              <option value="">{t('masterData.allBrands')}</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <div className="master-data-search master-data-search-excel" ref={searchInputRef}>
            <Search size={12} />
            <input
              type="text"
              placeholder={t('common.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input-compact"
            />
          </div>
          <button type="button" className="btn btn-primary btn-excel" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus size={12} /> {t(config.addKey)}
          </button>
        </div>
      </div>
      <div className="master-data-excel-table" ref={listRef}>
        <table className="master-data-excel-grid table-grid">
          <thead>
            <tr>
              {displayColumns.map((c) => (
                <th key={c.key}>{t(c.labelKey)}</th>
              ))}
              <th className="th-actions">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, idx) => (
              <tr
                key={row.id}
                className={selectedIndex === idx ? 'selected' : ''}
                data-row-index={idx}
                onClick={() => setSelectedIndex(idx)}
                onDoubleClick={() => handleEdit(row)}
              >
                {displayColumns.map((c) => (
                  <td key={c.key}>{renderCell(row, c.key)}</td>
                ))}
                <td className="td-actions">
                  <button type="button" className="btn-icon btn-icon-excel" onClick={(e) => { e.stopPropagation(); handleEdit(row); }} aria-label={t('common.edit')}><Pencil size={10} /></button>
                  <button type="button" className="btn-icon btn-icon-excel" onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }} aria-label={t('common.delete')}><Trash2 size={10} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <div className="master-data-excel-empty">{t('masterData.noData')}</div>}
      </div>
      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal modal-compact modal-excel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? t('common.edit') : t(config.addKey)}</h3>
              <button type="button" onClick={resetForm} aria-label="Close"><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              {displayFormFields.map((field) => (
                <div key={field.key} className="form-field">
                  <label>{t(field.labelKey)}</label>
                  {field.key === 'brandId' && brands ? (
                    <select
                      value={form[field.key] || ''}
                      onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                      required
                    >
                      <option value="">{t('common.select')}</option>
                      {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
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
    </div>
  );
}
