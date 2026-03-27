import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { api } from '../services/api';

export type HybridBanner = 'none' | 'offline' | 'syncing' | 'updated';

type Ctx = {
  browserOnline: boolean;
  banner: HybridBanner;
  pendingCount: number;
  cloudConfigured: boolean;
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
  const flushLock = useRef(false);

  const refreshStatus = useCallback(async () => {
    try {
      const { data } = await api.get<{
        pendingCount?: number;
        cloudConfigured?: boolean;
        online?: boolean;
      }>('/sync/status');
      setPendingCount(data.pendingCount ?? 0);
      setCloudConfigured(Boolean(data.cloudConfigured));
    } catch {
      /* offline API */
    }
  }, []);

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
    if (window.electron) {
      window.electron.on('frontend-updated', () => {
        setBanner('updated');
        window.setTimeout(() => setBanner('none'), 6000);
      });
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    const t = window.setInterval(refreshStatus, 15_000);
    return () => window.clearInterval(t);
  }, [refreshStatus]);

  useEffect(() => {
    if (!browserOnline) {
      setBanner((b) => (b === 'updated' ? b : 'offline'));
      return;
    }
    if (pendingCount > 0 && cloudConfigured) {
      setBanner('syncing');
      let cancelled = false;
      (async () => {
        try {
          await api.post('/sync/flush');
          if (!cancelled) await refreshStatus();
        } catch {
          /* queue stays */
        } finally {
          if (!cancelled) {
            setBanner((b) => (b === 'updated' ? b : 'none'));
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    setBanner((b) => (b === 'updated' ? b : 'none'));
    return undefined;
  }, [browserOnline, pendingCount, cloudConfigured, refreshStatus]);

  const flushSync = useCallback(async () => {
    if (flushLock.current) return;
    flushLock.current = true;
    setBanner('syncing');
    try {
      await api.post('/sync/flush');
      await refreshStatus();
      setBanner('none');
    } catch {
      setBanner(browserOnline ? 'none' : 'offline');
    } finally {
      flushLock.current = false;
    }
  }, [browserOnline, refreshStatus]);

  const value = useMemo(
    () => ({
      browserOnline,
      banner,
      pendingCount,
      cloudConfigured,
      flushSync,
    }),
    [browserOnline, banner, pendingCount, cloudConfigured, flushSync]
  );

  return <HybridSyncContext.Provider value={value}>{children}</HybridSyncContext.Provider>;
}

export function useHybridSync() {
  const ctx = useContext(HybridSyncContext);
  if (!ctx) throw new Error('useHybridSync outside HybridSyncProvider');
  return ctx;
}
