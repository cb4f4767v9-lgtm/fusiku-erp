import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { isOfflineLicenseExpired, refreshOfflineLicenseDeadline } from '../../utils/offlineLicense';

/**
 * When the app has been offline past the local license deadline, require reconnect
 * (prevents unlimited offline use; renewed on successful online session).
 */
export function OfflineLicenseBlock({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [online, setOnline] = useState(
    () => (typeof navigator !== 'undefined' ? navigator.onLine : true)
  );

  useEffect(() => {
    const on = () => {
      setOnline(true);
      refreshOfflineLicenseDeadline();
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const blocked = Boolean(user && !online && isOfflineLicenseExpired());

  if (!blocked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0b1025]/95 p-6 text-center">
      <div className="max-w-md rounded-2xl border border-white/15 bg-[#141a2e] p-8 shadow-2xl">
        <h1 className="text-lg font-semibold text-white mb-2">
          {t('license.offlineExpiredTitle', { defaultValue: 'Connection required' })}
        </h1>
        <p className="text-sm text-white/75 leading-relaxed">
          {t('license.offlineExpiredBody', {
            defaultValue: 'Reconnect to the internet to continue. Your offline access period has ended.',
          })}
        </p>
        <p className="text-xs text-white/50 mt-4">
          {t('license.offlineExpiredHint', {
            defaultValue: 'After you are online again, the app will refresh your access automatically.',
          })}
        </p>
      </div>
    </div>
  );
}
