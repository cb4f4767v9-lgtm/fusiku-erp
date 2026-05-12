import type { ReactNode } from 'react';
import { AuthProvider } from '../hooks/useAuth';
import { ThemeProvider } from './ThemeContext';
import { BrandingProvider } from './BrandingContext';
import { CurrencyProvider } from './CurrencyContext';
import { BranchProvider } from './BranchContext';

/** Composes root providers: auth → theme → branding → currency (display FX). */
export function AppStateProvider({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </AuthProvider>
  );
}

/** Providers that should only run in the authenticated app (they call protected APIs). */
export function ProtectedAppProviders({ children }: { children: ReactNode }) {
  return (
    <BrandingProvider>
      <CurrencyProvider>
        <BranchProvider>{children}</BranchProvider>
      </CurrencyProvider>
    </BrandingProvider>
  );
}
