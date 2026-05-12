import { MasterDataList } from '../../components/MasterDataList';

const config = {
  entity: 'toolBrands',
  titleKey: 'masterData.toolBrands',
  addKey: 'masterData.addToolBrand',
  columns: [{ key: 'name', labelKey: 'masterData.name' }],
  formFields: [{ key: 'name', labelKey: 'masterData.name' }]
};

export function MasterToolBrandsPage() {
  return <MasterDataList config={config} />;
}
