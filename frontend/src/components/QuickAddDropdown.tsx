import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { masterDataApi, suppliersApi, branchesApi, customersApi } from '../services/api';
import toast from 'react-hot-toast';
import { Plus, X } from 'lucide-react';

type QuickAddType = 'supplier' | 'customer' | 'branch' | 'brand' | 'phoneModel' | 'storage' | 'color' | 'quality' | 'screenQuality' | 'fault' | 'screenType' | 'category';

type QuickAddDropdownProps = {
  type: QuickAddType;
  value: string;
  onChange: (id: string, label?: string) => void;
  options: { id: string; label: string }[];
  onRefresh: () => void;
  brands?: { id: string; name: string }[];
  placeholder?: string;
  className?: string;
  onAddScreenType?: (name: string) => void;
  buttonOnly?: boolean;
  dataCell?: string;
};

const SCREEN_TYPES = ['OLED', 'LCD', 'Incell', 'Hard OLED', 'Soft OLED'];

export function QuickAddDropdown({ type, value, onChange, options, onRefresh, brands = [], placeholder, className, onAddScreenType, buttonOnly, dataCell }: QuickAddDropdownProps) {
  const { t } = useTranslation();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const getAddTitle = () => {
    const titles: Record<QuickAddType, string> = {
      supplier: 'Add New Supplier',
      customer: 'Add New Customer',
      branch: 'Add New Branch',
      brand: 'Add New Brand',
      phoneModel: 'Add New Model',
      storage: 'Add New Storage',
      color: 'Add New Color',
      quality: 'Add New Quality',
      screenQuality: 'Add New Screen Quality',
      fault: 'Add New Fault',
      screenType: 'Add New Screen Type',
      category: 'Add New Category'
    };
    return t(`quickAdd.${type}`, titles[type]);
  };

  const handleSave = async () => {
    try {
      if (type === 'supplier') {
        const contacts = form.phone ? [{ contactType: 'phone', value: form.phone }] : [];
        const { data } = await suppliersApi.create({
          name: form.name || '',
          country: form.country || 'US',
          contacts
        });
        onRefresh();
        onChange(data.id);
      } else if (type === 'customer') {
        const { data } = await customersApi.create({ name: form.name || '', phone: form.phone || '' });
        onRefresh();
        onChange(data.id);
      } else if (type === 'branch') {
        const contacts = form.phone ? [{ contactType: 'phone', value: form.phone }] : [];
        const { data } = await branchesApi.create({
          name: form.name || '',
          contacts
        });
        onRefresh();
        onChange(data.id);
      } else if (type === 'brand') {
        const { data } = await masterDataApi.create('brands', { name: form.name || '' });
        onRefresh();
        onChange(data.id);
      } else if (type === 'phoneModel') {
        const { data } = await masterDataApi.create('phoneModels', {
          brandId: form.brandId || '',
          name: form.name || '',
          releaseYear: form.releaseYear ? parseInt(form.releaseYear, 10) : null
        });
        onRefresh();
        onChange(data.id);
      } else if (type === 'storage') {
        const sizeGb = parseInt(form.sizeGb || '0', 10);
        const { data } = await masterDataApi.create('storageSizes', { sizeGb, label: form.label || `${sizeGb}GB` });
        onRefresh();
        onChange(data.id);
      } else if (type === 'color') {
        const { data } = await masterDataApi.create('deviceColors', { name: form.name || '' });
        onRefresh();
        onChange(data.id);
      } else if (type === 'quality') {
        const { data } = await masterDataApi.create('deviceQualities', { name: form.name || '' });
        onRefresh();
        onChange(data.id);
      } else if (type === 'screenQuality') {
        const { data } = await masterDataApi.create('screenQualities', { name: form.name || '' });
        onRefresh();
        onChange(data.id);
      } else if (type === 'fault') {
        const { data } = await masterDataApi.create('deviceFaults', { name: form.name || '' });
        onRefresh();
        onChange(data.id);
      } else if (type === 'screenType') {
        const name = form.name || '';
        if (name) {
          onAddScreenType?.(name);
          onChange(name);
        }
        setShowAdd(false);
        setForm({});
        return;
      } else if (type === 'category') {
        const { data } = await masterDataApi.create('categories', { name: form.name || '' });
        onRefresh();
        onChange(data.id);
      }
      toast.success(t('common.save'));
      setShowAdd(false);
      setForm({});
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('common.failed'));
    }
  };

  const renderAddForm = () => {
    if (type === 'supplier' || type === 'customer') {
      return (
        <>
          <div className="quick-add-field">
            <label>{t('suppliers.name')}</label>
            <input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t('quickAdd.namePlaceholder')} required />
          </div>
          <div className="quick-add-field">
            <label>{t('suppliers.phone', 'Phone')}</label>
            <input value={form.phone || ''} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder={t('quickAdd.phonePlaceholder')} />
          </div>
        </>
      );
    }
    if (type === 'branch') {
      return (
        <>
          <div className="quick-add-field">
            <label>{t('purchases.branch')}</label>
            <input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t('quickAdd.branchNamePlaceholder')} required />
          </div>
          <div className="quick-add-field">
            <label>{t('suppliers.phone')}</label>
            <input value={form.phone || ''} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder={t('quickAdd.phonePlaceholder')} />
          </div>
        </>
      );
    }
    if (type === 'phoneModel') {
      return (
        <>
          <div className="quick-add-field">
            <label>{t('masterData.brand')}</label>
            <select value={form.brandId || ''} onChange={(e) => setForm((f) => ({ ...f, brandId: e.target.value }))} required>
              <option value="">{t('common.select')}</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="quick-add-field">
            <label>{t('masterData.modelName')}</label>
            <input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t('quickAdd.modelPlaceholder')} required />
          </div>
        </>
      );
    }
    if (type === 'storage') {
      return (
        <>
          <div className="quick-add-field">
            <label>{t('masterData.sizeGb')}</label>
            <input type="number" value={form.sizeGb || ''} onChange={(e) => setForm((f) => ({ ...f, sizeGb: e.target.value }))} placeholder={t('quickAdd.sizeGbPlaceholder')} required />
          </div>
          <div className="quick-add-field">
            <label>{t('masterData.label')}</label>
            <input value={form.label || ''} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder={t('quickAdd.labelPlaceholder')} />
          </div>
        </>
      );
    }
    if (type === 'screenType') {
      return (
        <div className="quick-add-field">
          <label>{t('masterData.name')}</label>
          <input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t('quickAdd.screenTypeExample')} required />
        </div>
      );
    }
    return (
      <div className="quick-add-field">
        <label>{t('masterData.name')}</label>
        <input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t('masterData.name')} required />
      </div>
    );
  };

  return (
    <div className={`quick-add-dropdown ${buttonOnly ? 'button-only' : ''} ${className || ''}`}>
      {!buttonOnly && (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...(dataCell ? { 'data-cell': dataCell } : {})}
        >
          <option value="">{placeholder || '—'}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      )}
      <button type="button" className="quick-add-btn" onClick={() => setShowAdd(true)} title={getAddTitle()} aria-label={getAddTitle()} {...(dataCell ? { 'data-cell': dataCell } : {})}>
        <Plus size={14} />
      </button>
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal modal-quick-add" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{getAddTitle()}</h3>
              <button type="button" onClick={() => setShowAdd(false)} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="modal-form">
              {renderAddForm()}
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>{t('common.cancel')}</button>
                <button type="button" className="btn btn-primary" onClick={handleSave}>{t('common.save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
