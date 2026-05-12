import { MasterDataList } from '../../components/MasterDataList';

const config = {
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
  ]
};

export function MasterCategoriesPage() {
  return <MasterDataList config={config} />;
}
