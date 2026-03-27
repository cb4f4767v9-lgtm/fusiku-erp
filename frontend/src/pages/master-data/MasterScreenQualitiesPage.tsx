import { MasterDataList } from '../../components/MasterDataList';

const config = {
  entity: 'screenQualities',
  titleKey: 'masterData.screenQualities',
  addKey: 'masterData.addScreenQuality',
  columns: [{ key: 'name', labelKey: 'masterData.name' }],
  formFields: [{ key: 'name', labelKey: 'masterData.name' }]
};

export function MasterScreenQualitiesPage() {
  return <MasterDataList config={config} />;
}
