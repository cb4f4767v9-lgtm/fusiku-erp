import { MasterDataList } from '../../components/MasterDataList';

const config = {
  entity: 'brands',
  titleKey: 'masterData.brands',
  addKey: 'masterData.addBrand',
  columns: [{ key: 'name', labelKey: 'masterData.name' }],
  formFields: [{ key: 'name', labelKey: 'masterData.name' }]
};

export function MasterBrandsPage() {
  return <MasterDataList config={config} />;
}
