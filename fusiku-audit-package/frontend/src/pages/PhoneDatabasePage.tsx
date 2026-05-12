import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { phoneDatabaseApi } from '../services/api';
import { ChevronRight } from 'lucide-react';
import { PageLayout, PageHeader } from '../components/design-system';

export function PhoneDatabasePage() {
  const { t } = useTranslation();
  const [brands, setBrands] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  useEffect(() => {
    phoneDatabaseApi.getBrands().then((r) => setBrands(r.data)).catch(() => setBrands([]));
  }, []);

  useEffect(() => {
    if (selectedBrand) {
      phoneDatabaseApi.getModels(selectedBrand).then((r) => setModels(r.data)).catch(() => setModels([]));
      setSelectedModel(null);
      setVariants([]);
    } else {
      setModels([]);
      setVariants([]);
    }
  }, [selectedBrand]);

  useEffect(() => {
    if (selectedModel) {
      phoneDatabaseApi.getVariants(selectedModel).then((r) => setVariants(r.data)).catch(() => setVariants([]));
    } else {
      setVariants([]);
    }
  }, [selectedModel]);

  return (
    <PageLayout className="page">
      <PageHeader title={t('phoneDatabase.title')} subtitle={t('phoneDatabase.subtitle')} />
      <div className="phone-db-layout">
        <div className="phone-db-panel">
          <h3>{t('phoneDatabase.brands')}</h3>
          <ul>
            {brands.map((b) => (
              <li
                key={b.id}
                className={selectedBrand === b.id ? 'selected' : ''}
                onClick={() => setSelectedBrand(b.id)}
              >
                {b.displayName ?? b.name}
                <ChevronRight size={16} />
              </li>
            ))}
          </ul>
        </div>
        <div className="phone-db-panel">
          <h3>{t('phoneDatabase.models')}</h3>
          <ul>
            {models.map((m) => (
              <li
                key={m.id}
                className={selectedModel === m.id ? 'selected' : ''}
                onClick={() => setSelectedModel(m.id)}
              >
                {m.displayName ?? m.name}
                <ChevronRight size={16} />
              </li>
            ))}
            {models.length === 0 && selectedBrand && <li className="muted">{t('phoneDatabase.noModels')}</li>}
          </ul>
        </div>
        <div className="phone-db-panel">
          <h3>{t('phoneDatabase.variants')}</h3>
          <ul>
            {variants.map((v) => (
              <li key={v.id}>
                {v.storage} / {v.color}
              </li>
            ))}
            {variants.length === 0 && selectedModel && <li className="muted">{t('phoneDatabase.noVariants')}</li>}
          </ul>
        </div>
      </div>
    </PageLayout>
  );
}
