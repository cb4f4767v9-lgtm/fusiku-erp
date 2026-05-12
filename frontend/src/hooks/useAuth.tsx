import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { clearBillingUiStorage } from '../utils/billingUi';
import {
  clearStoredAccessToken,
  clearStoredRefreshToken,
  persistAccessToken,
  persistRefreshToken,
  readStoredAccessToken,
  readStoredRefreshToken,
  rememberCompanyId,
  resolveCompanyIdForAuth,
  setAccessTokenInMemory,
} from '../utils/authSession';
import { decodeJwtPayload } from '../utils/jwtClient';
import { useProviderDebug } from '../utils/providerDebug';
import { authApi, ensureAccessTokenReady, otpApi, resetApiSessionExpiredGate } from '../services/api';
import i18n from '../i18n';
import { getBaseLanguage } from '../utils/i18nLocale';
import { persistLanguageCode } from '../utils/i18nPersist';
import { clearOfflineLicenseDeadline, refreshOfflineLicenseDeadline } from '../utils/offlineLicense';

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
  /** Tenant profile: drives optional vertical modules in the UI (e.g. institute). */
  companyBusinessType?: string | null;
  /** Multi-select tenant verticals from setup wizard (backward compatible). */
  companyBusinessTypes?: string[] | null;
  /** When true, login always triggers step-up OTP. */
  twoFactorEnabled?: boolean;
  /** Preferred step-up channel from profile (email | sms | whatsapp). */
  otpChannel?: string;
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
  /** True once initial storage + /auth/me hydration (if needed) completes. */
  isHydrated: boolean;
  loginWithPassword: (
    email: string,
    password: string,
    rememberDevice?: boolean
  ) => Promise<
    | { requiresDeviceVerification: true; challengeId: string }
    | { requiresDeviceVerification: false; isNewUser: boolean }
  >;
  verifyDeviceLogin: (challengeId: string, code: string) => Promise<{ isNewUser: boolean }>;
  resendDeviceOtp: (challengeId: string) => Promise<void>;
  requestOtp: (email: string) => Promise<{ challengeId: string; expiresInSeconds: number }>;
  verifyOtp: (challengeId: string, code: string) => Promise<{ isNewUser: boolean }>;
  setSession: (token: string, user: AuthUser, refreshToken?: string | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function isMeHydrationCanceled(e: unknown): boolean {
  return axios.isCancel(e);
}

function isMeHydrationUnauthorized(e: unknown): boolean {
  return (e as { response?: { status?: number } })?.response?.status === 401;
}

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
        let abortedHydration = false;
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
          const needsMe =
            !next?.companyId ||
            !next?.branchId ||
            typeof next.companyBusinessType === 'undefined' ||
            typeof next.companyBusinessTypes === 'undefined' ||
            !Array.isArray(next.permissions) ||
            next.permissions.length === 0;

          if (needsMe) {
            try {
              const { data } = await authApi.me();
              const me = data as AuthUser;
              if (me?.id) {
                next = branchRole ? { ...me, branchRole } : me;
                applyLocaleFromSessionUser(next);
                localStorage.setItem('user', JSON.stringify(next));
                if (typeof navigator !== 'undefined' && navigator.onLine) {
                  refreshOfflineLicenseDeadline();
                }
              }
            } catch (e: unknown) {
              if (isMeHydrationCanceled(e) || isMeHydrationUnauthorized(e)) {
                abortedHydration = true;
                clearStoredAccessToken();
                clearStoredRefreshToken();
                try {
                  localStorage.removeItem('user');
                  localStorage.removeItem('token');
                } catch {
                  /* ignore */
                }
                if (!cancelled) {
                  setUser(null);
                  setToken(null);
                }
              }
              /* else: offline / transient — keep cached user without permissions */
            }
          }
          if (!cancelled && !abortedHydration) {
            applyLocaleFromSessionUser(next);
            setUser(next);
          }
        } catch {
          clearStoredAccessToken();
          clearStoredRefreshToken();
          localStorage.removeItem('user');
        }
      } else if (rt && u) {
        let abortedHydration = false;
        try {
          const parsed = JSON.parse(u) as AuthUser;
          const primed = await ensureAccessTokenReady();
          const access = readStoredAccessToken();
          let next = parsed;

          if (primed && access) {
            const needsMe =
              !next?.companyId ||
              !next?.branchId ||
              typeof next.companyBusinessType === 'undefined' ||
              typeof next.companyBusinessTypes === 'undefined' ||
              !Array.isArray(next.permissions) ||
              next.permissions.length === 0;
            if (needsMe) {
              try {
                const { data } = await authApi.me();
                const me = data as AuthUser;
                if (me?.id) {
                  next = me;
                  applyLocaleFromSessionUser(next);
                  localStorage.setItem('user', JSON.stringify(next));
                  if (typeof navigator !== 'undefined' && navigator.onLine) {
                    refreshOfflineLicenseDeadline();
                  }
                }
              } catch (e: unknown) {
                if (isMeHydrationCanceled(e) || isMeHydrationUnauthorized(e)) {
                  abortedHydration = true;
                  clearStoredAccessToken();
                  clearStoredRefreshToken();
                  try {
                    localStorage.removeItem('user');
                    localStorage.removeItem('token');
                  } catch {
                    /* ignore */
                  }
                  if (!cancelled) {
                    setUser(null);
                    setToken(null);
                  }
                }
              }
            }
          }

          if (!cancelled && !abortedHydration) {
            applyLocaleFromSessionUser(next);
            setUser(next);
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

  const requestOtp = async (email: string) => {
    const cid = resolveCompanyIdForAuth();
    const { data } = await otpApi.request({
      contact: String(email ?? '').trim(),
      method: 'email',
      ...(cid ? { companyId: cid } : {}),
    });
    if (!data || typeof data !== 'object' || !('challengeId' in data)) throw new Error('Invalid OTP response');
    const challengeId = String((data as any).challengeId || '').trim();
    const expiresInSeconds = Number((data as any).expiresInSeconds || 0);
    if (!challengeId) throw new Error('Invalid OTP response');
    return { challengeId, expiresInSeconds };
  };

  const loginWithPassword = async (email: string, password: string, rememberDevice = true) => {
    const { data } = await authApi.login(String(email ?? '').trim(), String(password ?? ''), undefined, {
      rememberDevice,
    });
    const d = data as Record<string, unknown>;
    if (d?.requiresDeviceVerification && d?.challengeId) {
      return { requiresDeviceVerification: true as const, challengeId: String(d.challengeId) };
    }
    const sessionToken = String(d.token ?? d.accessToken ?? '').trim();
    const refreshToken = String(d.refreshToken ?? '').trim();
    const rawUser = d.user as AuthUser | undefined;
    if (!sessionToken || !rawUser?.id) throw new Error('Invalid login response');

    setSession(sessionToken, rawUser, refreshToken || undefined);
    try {
      const { data: meData } = await authApi.me();
      const me = meData as AuthUser;
      if (me?.id) setSession(sessionToken, me, refreshToken || undefined);
    } catch {
      /* offline hydration */
    }
    const isNewUser = Boolean(d.isNewUser);
    const effectiveCompanyId = String(rawUser?.companyId || '').trim();
    if (!effectiveCompanyId) return { requiresDeviceVerification: false as const, isNewUser: true };
    return { requiresDeviceVerification: false as const, isNewUser };
  };

  const verifyDeviceLogin = async (challengeId: string, code: string) => {
    const { data } = await authApi.verifyLoginDevice(
      String(challengeId ?? '').trim(),
      String(code ?? '').replace(/\s/g, '').slice(0, 6)
    );
    const d = data as Record<string, unknown>;
    const sessionToken = String(d.token ?? d.accessToken ?? '').trim();
    const refreshToken = String(d.refreshToken ?? '').trim();
    const rawUser = d.user as AuthUser | undefined;
    if (!sessionToken || !rawUser?.id) throw new Error('Invalid verification response');

    setSession(sessionToken, rawUser, refreshToken || undefined);
    try {
      const { data: meData } = await authApi.me();
      const me = meData as AuthUser;
      if (me?.id) setSession(sessionToken, me, refreshToken || undefined);
    } catch {
      /* offline */
    }
    const effectiveCompanyId = String(rawUser?.companyId || '').trim();
    if (!effectiveCompanyId) return { isNewUser: true };
    return { isNewUser: false };
  };

  const resendDeviceOtp = async (challengeId: string) => {
    await authApi.resendLoginDeviceOtp(String(challengeId ?? '').trim());
  };

  const verifyOtp = async (challengeId: string, code: string) => {
    const { data } = await otpApi.verify({
      challengeId: String(challengeId ?? '').trim(),
      code: String(code ?? '').replace(/\s/g, '').slice(0, 6),
    });
    if (!data || typeof data !== 'object') throw new Error('Invalid verification response');

    const sessionToken = String((data as any).accessToken ?? (data as any).token ?? '').trim();
    const refreshToken = String((data as any).refreshToken ?? '').trim();
    const rawUser = (data as any).user as AuthUser | undefined;
    if (!sessionToken || !rawUser?.id) throw new Error('Invalid verification response');

    setSession(sessionToken, rawUser, refreshToken || undefined);
    try {
      // Hydrate complete session user (companyId/branchId/verticals/permissions) before routing.
      const { data: meData } = await authApi.me();
      const me = meData as AuthUser;
      if (me?.id) setSession(sessionToken, me, refreshToken || undefined);
    } catch {
      /* ignore hydration failures (offline) */
    }
    // Safety: if tenant info is missing for any reason, route to setup instead of showing an error.
    const isNewUser = Boolean((data as any).isNewUser);
    const effectiveCompanyId = String(rawUser?.companyId || '').trim();
    if (!effectiveCompanyId) {
      return { isNewUser: true };
    }
    return { isNewUser };
  };

  const setSession = (token: string, user: AuthUser, refreshToken?: string | null) => {
    const safeToken = String(token ?? '').trim();
    if (!safeToken || !user || typeof user !== 'object' || !user.id) {
      console.error('[AuthProvider] setSession: invalid token or user');
      return;
    }

    resetApiSessionExpiredGate();

    persistAccessToken(safeToken);
    const rt = String(refreshToken ?? '').trim();
    if (rt) persistRefreshToken(rt);

    const p = decodeJwtPayload(safeToken);
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

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      refreshOfflineLicenseDeadline();
    }

    setToken(safeToken);
    setUser(u);
  };

  const logout = () => {
    clearStoredAccessToken();
    clearStoredRefreshToken();
    setAccessTokenInMemory(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    clearBillingUiStorage();
    clearOfflineLicenseDeadline();

    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isHydrated: !loading,
        loginWithPassword,
        verifyDeviceLogin,
        resendDeviceOtp,
        requestOtp,
        verifyOtp,
        setSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}