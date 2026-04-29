import { useTranslation } from 'react-i18next';
import { useHybridSync } from '../contexts/HybridSyncContext';

export function SyncStatusBanner() {
  const { t } = useTranslation();
  const {
    banner,
    pendingCount,
    cloudConfigured,
    flushSync,
    localPendingCount,
    localConflictCount,
  } = useHybridSync();

  const totalPending = pendingCount + localPendingCount;
  const showConflictStrip = localConflictCount > 0;
  const showMainBar = banner !== 'none' || showConflictStrip;

  if (!showMainBar) return null;

  const className =
    banner === 'offline'
      ? 'sync-hybrid-bar sync-hybrid-offline'
      : banner === 'syncing'
        ? 'sync-hybrid-bar sync-hybrid-syncing'
        : banner === 'updated'
          ? 'sync-hybrid-bar sync-hybrid-updated'
          : 'sync-hybrid-bar sync-hybrid-conflict';

  return (
    <div className="sync-hybrid-banners" role="region" aria-label={t('offline.syncRegion')}>
      {banner !== 'none' ? (
        <div className={className} role="status">
          {banner === 'offline' && <span>{t('common.offlineMode')}</span>}
          {banner === 'syncing' && (
            <span>
              {t('common.syncing')}
              {totalPending > 0 ? ` (${totalPending})` : ''}
            </span>
          )}
          {banner === 'updated' && <span>{t('common.updatedSuccessfully')}</span>}
          {(cloudConfigured && banner === 'offline' && pendingCount > 0) ||
          (banner === 'offline' && localPendingCount > 0) ? (
            <button type="button" className="btn btn-sm btn-secondary sync-hybrid-retry" onClick={() => flushSync()}>
              {t('common.retry')}
            </button>
          ) : null}
        </div>
      ) : null}
      {showConflictStrip ? (
        <div className="sync-hybrid-bar sync-hybrid-conflict" role="alert">
          <span>
            {t('offline.conflictBanner', { count: localConflictCount })}
          </span>
        </div>
      ) : null}
    </div>
  );
}
