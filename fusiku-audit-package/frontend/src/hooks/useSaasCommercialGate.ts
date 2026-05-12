import { useMemo } from 'react';
import { useBranding } from '../contexts/BrandingContext';

/**
 * SaaS Phase 4.1 — mirrors backend `requireActiveSubscription` for POS / purchases / inventory UX.
 * When profile has no `saas` block (legacy API), all operations stay allowed.
 */
export function useSaasCommercialGate() {
  const { profile } = useBranding();
  return useMemo(() => {
    const saas = profile?.saas;
    if (!saas) {
      return {
        commercialWritesAllowed: true,
        trialCommercialLock: false,
        hardExpired: false,
        bannerMessage: null as string | null,
      };
    }
    const { commercialWritesAllowed, trialCommercialLock, hardExpired } = saas;
    let bannerMessage: string | null = null;
    if (hardExpired) bannerMessage = 'hard';
    else if (trialCommercialLock) bannerMessage = 'trial';
    return {
      commercialWritesAllowed: commercialWritesAllowed !== false,
      trialCommercialLock: Boolean(trialCommercialLock),
      hardExpired: Boolean(hardExpired),
      bannerMessage,
    };
  }, [profile?.saas]);
}
