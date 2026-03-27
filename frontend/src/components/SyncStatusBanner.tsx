import { useTranslation } from 'react-i18next';
import { useHybridSync } from '../contexts/HybridSyncContext';

export function SyncStatusBanner() {
  const { t } = useTranslation();
  const { banner, pendingCount, cloudConfigured, flushSync } = useHybridSync();

  if (banner === 'none') return null;

  const className =
    banner === 'offline'
      ? 'sync-hybrid-bar sync-hybrid-offline'
      : banner === 'syncing'
        ? 'sync-hybrid-bar sync-hybrid-syncing'
        : 'sync-hybrid-bar sync-hybrid-updated';

  return (
    <div className={className} role="status">
      {banner === 'offline' && <span>{t('common.offlineMode')}</span>}
      {banner === 'syncing' && (
        <span>
          {t('common.syncing')}
          {pendingCount > 0 ? ` (${pendingCount})` : ''}
        </span>
      )}
      {banner === 'updated' && <span>{t('common.updatedSuccessfully')}</span>}
      {cloudConfigured && banner === 'offline' && pendingCount > 0 && (
        <button type="button" className="btn btn-sm btn-secondary sync-hybrid-retry" onClick={() => flushSync()}>
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}
