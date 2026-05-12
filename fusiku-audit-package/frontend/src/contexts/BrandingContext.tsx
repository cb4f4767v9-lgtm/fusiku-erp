import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { companyApi } from '../services/api';
import { publicAssetUrl } from '../config/appConfig';
import { useProviderDebug } from '../utils/providerDebug';
import { readStoredAccessToken } from '../utils/authSession';

export type CompanyProfile = {
  id: string;
  name: string;
  logo: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  businessType?: string | null;
  saas?: {
    subscription: {
      status: string;
      trialEndsAt: string | null;
      startedAt: string;
      endsAt: string;
    } | null;
    planName: string | null;
    features: Record<string, boolean>;
    showPoweredBy: boolean;
    limits: { maxBranches: number; maxUsers: number; unlimited: boolean };
    entitled: boolean;
    hardExpired: boolean;
    trialCommercialLock: boolean;
    commercialWritesAllowed: boolean;
  };
};

type BrandingContextValue = {
  profile: CompanyProfile | null;
  loading: boolean;
  companyName: string;
  companyLogoUrl: string | null;
  /** When false and footer is hidden, plan allows removing “Powered by” and tenant opted out. */
  showPoweredBy: boolean;
  refresh: () => void;
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

export function BrandingProvider({ children }: { children: ReactNode }) {
  useProviderDebug('BrandingProvider');
  const { token, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (authLoading) return;
    const effectiveToken = token || readStoredAccessToken();
    if (!effectiveToken) {
      setProfile(null);
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        const r = await companyApi.getProfile();
        setProfile(r.data || null);
      } catch {
        await new Promise<void>((resolve) => setTimeout(resolve, 400));
        try {
          const r2 = await companyApi.getProfile();
          setProfile(r2.data || null);
        } catch {
          setProfile(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [token, authLoading]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onBranding = () => refresh();
    window.addEventListener('fusiku-branding-refresh', onBranding);
    return () => window.removeEventListener('fusiku-branding-refresh', onBranding);
  }, [refresh]);

  const value = useMemo<BrandingContextValue>(
    () => ({
      profile,
      loading,
      companyName: (() => {
        const n = profile?.name?.trim() || '';
        if (!n) return '';
        if (/^default\s+company$/i.test(n)) return '';
        return n;
      })(),
      companyLogoUrl: publicAssetUrl(profile?.logo ?? undefined),
      showPoweredBy: profile?.saas?.showPoweredBy !== false,
      refresh
    }),
    [profile, loading, refresh]
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    return {
      profile: null,
      loading: false,
      companyName: '',
      companyLogoUrl: null,
      showPoweredBy: true,
      refresh: () => {}
    };
  }
  return ctx;
}
