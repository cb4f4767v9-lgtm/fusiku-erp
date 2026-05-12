import type { ReactNode } from 'react';
import { AuthProvider } from '../hooks/useAuth';
import { ThemeProvider } from './ThemeContext';
import { BrandingProvider } from './BrandingContext';
import { CurrencyProvider } from './CurrencyContext';
import { BranchProvider } from './BranchContext';

/**
 * Single root provider tree mounted once from `App.tsx` (not inside route
 * elements). Order: auth → theme → branding → currency → branch.
 * Branding/Currency/Branch no-op or short-circuit when logged out (no token/user).
 */
export function AppStateProvider({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrandingProvider>
          <CurrencyProvider>
            <BranchProvider>{children}</BranchProvider>
          </CurrencyProvider>
        </BrandingProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

/** @deprecated Use `AppStateProvider` only — kept for incremental refactors / imports. */
export function ProtectedAppProviders({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
