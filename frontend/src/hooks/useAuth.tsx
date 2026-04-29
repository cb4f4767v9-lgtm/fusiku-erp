import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { clearBillingUiStorage } from '../utils/billingUi';
import {
  clearStoredAccessToken,
  clearStoredRefreshToken,
  persistAccessToken,
  persistRefreshToken,
  readStoredAccessToken,
  readStoredRefreshToken,
  rememberCompanyId,
  setAccessTokenInMemory,
} from '../utils/authSession';
import { decodeJwtPayload } from '../utils/jwtClient';
import { useProviderDebug } from '../utils/providerDebug';
import { authApi, ensureAccessTokenReady } from '../services/api';
import i18n from '../i18n';
import { getBaseLanguage } from '../utils/i18nLocale';
import { persistLanguageCode } from '../utils/i18nPersist';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  branchRole?: 'SUPER_ADMIN' | 'BRANCH_ADMIN' | 'BRANCH_USER';
  companyId?: string;
  branchId?: string;
  branch?: string;
  /** RBAC codes from backend (login or GET /auth/me). */
  permissions?: string[];
  /** Persisted UI language (en | zh | ar | ur). */
  language?: string;
  direction?: 'ltr' | 'rtl';
  /** Preferred view currency (ISO 4217). */
  currency?: string;
  branchDefaultLanguage?: string;
  branchDefaultCurrency?: string;
}

function applyLocaleFromSessionUser(u: AuthUser) {
  if (u.language) {
    const base = getBaseLanguage(u.language);
    void i18n.changeLanguage(base);
    persistLanguageCode(base);
  }
  if (u.currency) {
    try {
      localStorage.setItem('fusiku_view_currency', String(u.currency).trim().toUpperCase());
    } catch {
      /* ignore */
    }
  }
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string, opts?: { companyId?: string | null }) => Promise<void>;
  setSession: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  useProviderDebug('AuthProvider');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await ensureAccessTokenReady();
      const t = readStoredAccessToken();
      const rt = readStoredRefreshToken();
      const u = localStorage.getItem('user');

      if (t && u) {
        try {
          if (!cancelled) setToken(t);
          const parsed = JSON.parse(u) as AuthUser;

          const p = decodeJwtPayload(t);
          const branchRole =
            p?.branchRole === 'SUPER_ADMIN' ||
            p?.branchRole === 'BRANCH_ADMIN' ||
            p?.branchRole === 'BRANCH_USER'
              ? p.branchRole
              : undefined;

          let next = branchRole ? { ...parsed, branchRole } : parsed;
          if (!Array.isArray(next.permissions) || next.permissions.length === 0) {
            try {
              const { data } = await authApi.me();
              const me = data as AuthUser;
              if (me?.id) {
                next = branchRole ? { ...me, branchRole } : me;
                applyLocaleFromSessionUser(next);
                localStorage.setItem('user', JSON.stringify(next));
              }
            } catch {
              /* offline or legacy; keep user without permissions */
            }
          }
          if (!cancelled) {
            applyLocaleFromSessionUser(next);
            setUser(next);
          }
        } catch {
          clearStoredAccessToken();
          clearStoredRefreshToken();
          localStorage.removeItem('user');
        }
      } else if (rt && u) {
        try {
          const parsed = JSON.parse(u) as AuthUser;
          const primed = await ensureAccessTokenReady();
          const access = readStoredAccessToken();
          if (!cancelled) {
            applyLocaleFromSessionUser(parsed);
            setUser(parsed);
            if (primed && access) setToken(access);
          }
        } catch {
          clearStoredRefreshToken();
          localStorage.removeItem('user');
        }
      }

      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string, opts?: { companyId?: string | null }) => {
    const { data } = await authApi.login(email, password, opts?.companyId);

    const sessionToken = String(data?.accessToken ?? data?.token ?? '').trim();
    const refreshToken = String(data?.refreshToken ?? '').trim();

    if (!sessionToken) throw new Error('No token');

    persistAccessToken(sessionToken);
    if (refreshToken) persistRefreshToken(refreshToken);
    // Back-compat with older code paths that read `localStorage.token`.
    localStorage.setItem('token', sessionToken);

    const p = decodeJwtPayload(sessionToken);
    const branchRole =
      p?.branchRole === 'SUPER_ADMIN' ||
      p?.branchRole === 'BRANCH_ADMIN' ||
      p?.branchRole === 'BRANCH_USER'
        ? p.branchRole
        : undefined;

    const rawUser = data.user as AuthUser;
    const nextUser = branchRole ? { ...rawUser, branchRole } : rawUser;

    applyLocaleFromSessionUser(nextUser);
    localStorage.setItem('user', JSON.stringify(nextUser));
    rememberCompanyId(nextUser.companyId);

    setToken(sessionToken);
    setUser(nextUser);
  };

  const setSession = (token: string, user: AuthUser) => {
    persistAccessToken(token);

    const p = decodeJwtPayload(token);
    const branchRole =
      user.branchRole ||
      (p?.branchRole === 'SUPER_ADMIN' ||
      p?.branchRole === 'BRANCH_ADMIN' ||
      p?.branchRole === 'BRANCH_USER'
        ? p.branchRole
        : undefined);

    const u = branchRole ? { ...user, branchRole } : user;

    applyLocaleFromSessionUser(u);
    localStorage.setItem('user', JSON.stringify(u));
    rememberCompanyId(user.companyId);

    setToken(token);
    setUser(u);
  };

  const logout = () => {
    clearStoredAccessToken();
    clearStoredRefreshToken();
    setAccessTokenInMemory(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    clearBillingUiStorage();

    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, setSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}