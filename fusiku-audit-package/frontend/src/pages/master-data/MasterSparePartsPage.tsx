import { MasterDataList } from '../../components/MasterDataList';

const config = {
  entity: 'spareParts',
  titleKey: 'masterData.spareParts',
  addKey: 'masterData.addSparePart',
  columns: [{ key: 'name', labelKey: 'masterData.name' }],
  formFields: [{ key: 'name', labelKey: 'masterData.name' }]
};

export function MasterSparePartsPage() {
  return <MasterDataList config={config} />;
}
