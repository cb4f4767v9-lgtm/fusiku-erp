import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import toast from 'react-hot-toast';
import i18n from 'i18next';
import { api } from '../services/api';
import { flushDesktopOutbox, getDesktopLocalCounts } from '../offline/outboxFlush';
import { refreshDesktopCaches } from '../offline/desktopCache';
import { flushWebOutbox, getWebOutboxCounts } from '../offline/webOutbox';
import { refreshWebCaches } from '../offline/webCacheRefresh';

export type HybridBanner = 'none' | 'offline' | 'syncing' | 'updated';

type Ctx = {
  browserOnline: boolean;
  banner: HybridBanner;
  /** Legacy cloud queue (server-side file) when CLOUD_API_BASE_URL is set. */
  pendingCount: number;
  cloudConfigured: boolean;
  /** Electron SQLite outbox (Phase 5). */
  localPendingCount: number;
  localConflictCount: number;
  flushSync: () => Promise<void>;
};

const HybridSyncContext = createContext<Ctx | null>(null);

export function HybridSyncProvider({ children }: { children: React.ReactNode }) {
  const [browserOnline, setBrowserOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [banner, setBanner] = useState<HybridBanner>('none');
  const [pendingCount, setPendingCount] = useState(0);
  const [cloudConfigured, setCloudConfigured] = useState(false);
  const [localPendingCount, setLocalPendingCount] = useState(0);
  const [localConflictCount, setLocalConflictCount] = useState(0);
  const [webPendingCount, setWebPendingCount] = useState(0);
  const flushLock = useRef(false);
  const statusFetchLock = useRef(false);
  const statusLastFetchAt = useRef(0);
  const statusBackoffUntil = useRef(0);

  const SYNC_STATUS_POLL_MS = 15_000;
  const SYNC_STATUS_MIN_GAP_MS = 12_000;
  const SYNC_STATUS_429_BACKOFF_MS = 60_000;
  const DISABLE_SYNC_STATUS =
    String((import.meta as any)?.env?.VITE_DISABLE_SYNC_STATUS ?? '').trim() === '1';

  const refreshLocalDesktop = useCallback(async () => {
    try {
      const { pending, conflicts } = await getDesktopLocalCounts();
      setLocalPendingCount(pending);
      setLocalConflictCount(conflicts);
    } catch {
      setLocalPendingCount(0);
      setLocalConflictCount(0);
    }
  }, []);

  const refreshWebOutbox = useCallback(async () => {
    try {
      const { pending } = await getWebOutboxCounts();
      setWebPendingCount(pending);
    } catch {
      setWebPendingCount(0);
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    if (DISABLE_SYNC_STATUS) return;
    const now = Date.now();
    if (statusBackoffUntil.current && now < statusBackoffUntil.current) return;
    if (statusFetchLock.current) return;
    if (statusLastFetchAt.current && now - statusLastFetchAt.current < SYNC_STATUS_MIN_GAP_MS) return;
    statusFetchLock.current = true;
    statusLastFetchAt.current = now;
    try {
      const { data } = await api.get<{
        pendingCount?: number;
        cloudConfigured?: boolean;
        online?: boolean;
      }>('/sync/status');
      setPendingCount(data.pendingCount ?? 0);
      setCloudConfigured(Boolean(data.cloudConfigured));
      statusBackoffUntil.current = 0;
    } catch (e: any) {
      // If the backend rate-limits, back off aggressively to avoid cascading 429s.
      const status = e?.response?.status;
      if (status === 429) {
        statusBackoffUntil.current = Date.now() + SYNC_STATUS_429_BACKOFF_MS;
      }
    }
    finally {
      statusFetchLock.current = false;
    }
    await refreshLocalDesktop();
    await refreshWebOutbox();
  }, [refreshLocalDesktop, refreshWebOutbox, DISABLE_SYNC_STATUS]);

  useEffect(() => {
    const on = () => {
      setBrowserOnline(true);
    };
    const off = () => {
      setBrowserOnline(false);
      setBanner((b) => (b === 'updated' ? b : 'offline'));
    };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    // Hot-frontend updates are disabled; keep this slot if we add other desktop update banners.
  }, []);

  useEffect(() => {
    if (window.electron?.on) {
      window.electron.on('electron-update', (detail: unknown) => {
        const d = detail as { state?: string; version?: string; message?: string };
        if (d?.state === 'available') {
          toast(i18n.t('offline.appUpdateDownloading'));
        }
        if (d?.state === 'downloaded') {
          const v = String(d.version || '').trim();
          toast.success(
            v ? i18n.t('offline.appUpdateReadyVersion', { version: v }) : i18n.t('offline.appUpdateReady')
          );
        }
        if (d?.state === 'error') {
          if (import.meta.env.DEV) {
            toast.error(i18n.t('offline.appUpdateError'));
          }
        }
      });
    }
  }, []);

  useEffect(() => {
    const onOutbox = () => {
      void refreshLocalDesktop();
    };
    window.addEventListener('fusiku-local-outbox-changed', onOutbox);
    return () => window.removeEventListener('fusiku-local-outbox-changed', onOutbox);
  }, [refreshLocalDesktop]);

  useEffect(() => {
    const onOutbox = () => {
      void refreshWebOutbox();
    };
    window.addEventListener('fusiku-web-outbox-changed', onOutbox);
    return () => window.removeEventListener('fusiku-web-outbox-changed', onOutbox);
  }, [refreshWebOutbox]);

  useEffect(() => {
    if (DISABLE_SYNC_STATUS) return;
    void refreshStatus();
    const t = window.setInterval(() => void refreshStatus(), SYNC_STATUS_POLL_MS);
    return () => window.clearInterval(t);
  }, [refreshStatus]);

  useEffect(() => {
    if (!browserOnline) {
      setBanner((b) => (b === 'updated' ? b : 'offline'));
      return undefined;
    }

    let cancelled = false;

    const run = async () => {
      const workLocal = localPendingCount > 0;
      const workWeb = webPendingCount > 0;
      const workCloud = pendingCount > 0 && cloudConfigured;
      if (!workLocal && !workWeb && !workCloud) {
        if (!cancelled) setBanner((b) => (b === 'updated' ? b : 'none'));
        return;
      }

      setBanner('syncing');
      try {
        if (workLocal) {
          const r = await flushDesktopOutbox();
          if (!cancelled && r.conflicts > 0) {
            toast.error(i18n.t('offline.conflictsAfterSync', { count: r.conflicts }));
          }
          if (!cancelled) await refreshLocalDesktop();
          if (!cancelled && r.synced > 0) {
            await refreshDesktopCaches().catch(() => {});
          }
        }
        if (cancelled) return;
        if (workWeb) {
          const r = await flushWebOutbox((url, payload, cfg) => api.post(url, payload, cfg));
          if (!cancelled) await refreshWebOutbox();
          if (!cancelled && r.synced > 0) {
            await refreshWebCaches().catch(() => {});
          }
        }
        if (cancelled) return;
        if (workCloud) {
          await api.post('/sync/flush');
          if (!cancelled) await refreshStatus();
        }
      } catch {
        /* queues stay for retry */
      } finally {
        if (!cancelled) {
          setBanner((b) => (b === 'updated' ? b : 'none'));
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    browserOnline,
    pendingCount,
    cloudConfigured,
    localPendingCount,
    webPendingCount,
    refreshStatus,
    refreshLocalDesktop,
    refreshWebOutbox
  ]);

  const flushSync = useCallback(async () => {
    if (flushLock.current) return;
    flushLock.current = true;
    setBanner('syncing');
    try {
      const counts = await getDesktopLocalCounts();
      if (counts.pending > 0) {
        const r = await flushDesktopOutbox();
        await refreshLocalDesktop();
        if (r.conflicts > 0) {
          toast.error(i18n.t('offline.conflictsAfterSync', { count: r.conflicts }));
        }
        if (r.synced > 0) {
          await refreshDesktopCaches().catch(() => {});
        }
      }
      const web = await getWebOutboxCounts();
      if (web.pending > 0) {
        const r = await flushWebOutbox((url, payload, cfg) => api.post(url, payload, cfg));
        await refreshWebOutbox();
        if (r.synced > 0) {
          await refreshWebCaches().catch(() => {});
        }
      }
      await api.post('/sync/flush');
      await refreshStatus();
      setBanner((b) => (b === 'updated' ? b : 'none'));
    } catch {
      if (browserOnline) {
        setBanner((b) => (b === 'updated' ? b : 'none'));
      } else {
        setBanner('offline');
      }
    } finally {
      flushLock.current = false;
    }
  }, [browserOnline, refreshStatus, refreshLocalDesktop, refreshWebOutbox]);

  const value = useMemo(
    () => ({
      browserOnline,
      banner,
      pendingCount,
      cloudConfigured,
      localPendingCount,
      localConflictCount,
      flushSync,
    }),
    [
      browserOnline,
      banner,
      pendingCount,
      cloudConfigured,
      localPendingCount,
      localConflictCount,
      flushSync,
    ]
  );

  return <HybridSyncContext.Provider value={value}>{children}</HybridSyncContext.Provider>;
}

export function useHybridSync() {
  const ctx = useContext(HybridSyncContext);
  if (!ctx) throw new Error('useHybridSync outside HybridSyncProvider');
  return ctx;
}
