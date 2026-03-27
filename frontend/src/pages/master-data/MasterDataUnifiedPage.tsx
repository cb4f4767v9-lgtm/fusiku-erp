import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { masterDataApi } from '../../services/api';
import { MasterDataExcelList } from '../../components/MasterDataExcelList';
import type { ExcelListConfig } from '../../components/MasterDataExcelList';
import { ChevronDown } from 'lucide-react';

const DROPDOWN_OPTIONS: { value: string; config: ExcelListConfig }[] = [
  {
    value: 'categories',
    config: {
      entity: 'categories',
      titleKey: 'masterData.categories',
      addKey: 'masterData.addCategory',
      columns: [
        { key: 'name', labelKey: 'masterData.name' },
        { key: 'nameZh', labelKey: 'masterData.nameZh' },
        { key: 'nameAr', labelKey: 'masterData.nameAr' },
        { key: 'nameUr', labelKey: 'masterData.nameUr' }
      ],
      formFields: [
        { key: 'name', labelKey: 'masterData.name' },
        { key: 'nameZh', labelKey: 'masterData.nameZh' },
        { key: 'nameAr', labelKey: 'masterData.nameAr' },
        { key: 'nameUr', labelKey: 'masterData.nameUr' }
      ],
      useLanguageColumn: true
    }
  },
  {
    value: 'brands',
    config: {
      entity: 'brands',
      titleKey: 'masterData.brands',
      addKey: 'masterData.addBrand',
      columns: [{ key: 'name', labelKey: 'masterData.name' }],
      formFields: [{ key: 'name', labelKey: 'masterData.name' }]
    }
  },
  {
    value: 'phoneModels',
    config: {
      entity: 'phoneModels',
      titleKey: 'masterData.phoneModels',
      addKey: 'masterData.addPhoneModel',
      columns: [
        { key: 'brand', labelKey: 'masterData.brand' },
        { key: 'name', labelKey: 'masterData.modelName' },
        { key: 'releaseYear', labelKey: 'masterData.releaseYear' }
      ],
      formFields: [
        { key: 'brandId', labelKey: 'masterData.brand' },
        { key: 'name', labelKey: 'masterData.modelName' },
        { key: 'releaseYear', labelKey: 'masterData.releaseYear', type: 'number' }
      ],
      getFormInit: (row?: any) => ({
        brandId: row?.brandId || row?.brand?.id || '',
        name: row?.name || '',
        releaseYear: row?.releaseYear ? String(row.releaseYear) : ''
      })
    }
  },
  {
    value: 'spareParts',
    config: {
      entity: 'spareParts',
      titleKey: 'masterData.spareParts',
      addKey: 'masterData.addSparePart',
      columns: [{ key: 'name', labelKey: 'masterData.name' }],
      formFields: [{ key: 'name', labelKey: 'masterData.name' }]
    }
  },
  {
    value: 'screenQualities',
    config: {
      entity: 'screenQualities',
      titleKey: 'masterData.screenQualities',
      addKey: 'masterData.addScreenQuality',
      columns: [{ key: 'name', labelKey: 'masterData.name' }],
      formFields: [{ key: 'name', labelKey: 'masterData.name' }]
    }
  },
  {
    value: 'toolBrands',
    config: {
      entity: 'toolBrands',
      titleKey: 'masterData.toolBrands',
      addKey: 'masterData.addToolBrand',
      columns: [{ key: 'name', labelKey: 'masterData.name' }],
      formFields: [{ key: 'name', labelKey: 'masterData.name' }]
    }
  },
  {
    value: 'deviceColors',
    config: {
      entity: 'deviceColors',
      titleKey: 'masterData.deviceColors',
      addKey: 'masterData.addDeviceColor',
      columns: [{ key: 'name', labelKey: 'masterData.name' }],
      formFields: [{ key: 'name', labelKey: 'masterData.name' }]
    }
  },
  {
    value: 'deviceQualities',
    config: {
      entity: 'deviceQualities',
      titleKey: 'masterData.deviceQualities',
      addKey: 'masterData.addDeviceQuality',
      columns: [{ key: 'name', labelKey: 'masterData.name' }],
      formFields: [{ key: 'name', labelKey: 'masterData.name' }]
    }
  },
  {
    value: 'deviceFaults',
    config: {
      entity: 'deviceFaults',
      titleKey: 'masterData.deviceFaults',
      addKey: 'masterData.addDeviceFault',
      columns: [{ key: 'name', labelKey: 'masterData.name' }],
      formFields: [{ key: 'name', labelKey: 'masterData.name' }]
    }
  },
  {
    value: 'storageSizes',
    config: {
      entity: 'storageSizes',
      titleKey: 'masterData.storageSizes',
      addKey: 'masterData.addStorage',
      columns: [
        { key: 'sizeGb', labelKey: 'masterData.sizeGb' },
        { key: 'label', labelKey: 'masterData.label' }
      ],
      formFields: [
        { key: 'sizeGb', labelKey: 'masterData.sizeGb', type: 'number' },
        { key: 'label', labelKey: 'masterData.label' }
      ],
      renderCell: (row, key) => key === 'label' ? (row.label || (row.sizeGb >= 1024 ? `${row.sizeGb / 1024} TB` : `${row.sizeGb} GB`)) : (row[key] ?? '—'),
      getFormInit: (row?: any) => ({
        sizeGb: row?.sizeGb ? String(row.sizeGb) : '',
        label: row?.label || ''
      })
    }
  }
];

export function MasterDataUnifiedPage() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState('categories');
  const [brands, setBrands] = useState<any[]>([]);

  useEffect(() => {
    masterDataApi.getAll('brands').then((r) => setBrands(r.data)).catch(() => setBrands([]));
  }, []);

  const current = DROPDOWN_OPTIONS.find((o) => o.value === selected) || DROPDOWN_OPTIONS[0];

  return (
    <div className="page page-master-data-excel">
      <div className="page-header page-header-excel">
        <h1>{t('masterData.title')}</h1>
        <div className="master-data-dropdown-wrap">
          <select
            id="master-data-select"
            className="master-data-dropdown"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            aria-label={t('masterData.title')}
          >
            {DROPDOWN_OPTIONS.map(({ value, config }) => (
              <option key={value} value={value}>{t(config.titleKey)}</option>
            ))}
          </select>
          <ChevronDown size={14} className="master-data-dropdown-chevron" aria-hidden />
        </div>
      </div>
      <MasterDataExcelList
        config={current.config}
        brands={current.config.entity === 'phoneModels' ? brands : undefined}
      />
    </div>
  );
}
