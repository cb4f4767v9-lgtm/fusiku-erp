const LS_ACCESS = 'accessToken';
// Back-compat with older builds / quick-debug tooling.
const LS_ACCESS_LEGACY = 'token';
const LS_REFRESH = 'refreshToken';
const LS_LAST_COMPANY = 'fusiku_last_company_id';

let memoryAccessToken: string | null = null;

export function readStoredAccessToken(): string | null {
  if (memoryAccessToken) return memoryAccessToken;

  try {
    const t = String(localStorage.getItem(LS_ACCESS) || '').trim();
    if (t) return t;
  } catch {
    // ignore
  }

  // Fallback to legacy key used by some screens / older builds.
  try {
    const t2 = String(localStorage.getItem(LS_ACCESS_LEGACY) || '').trim();
    return t2 || null;
  } catch {
    return null;
  }
}

export function persistAccessToken(token: string): void {
  const t = String(token || '').trim();
  if (!t) return;

  memoryAccessToken = t;

  try {
    localStorage.setItem(LS_ACCESS, t);
    localStorage.setItem(LS_ACCESS_LEGACY, t);
  } catch {}
}

export function clearStoredAccessToken(): void {
  memoryAccessToken = null;

  try {
    localStorage.removeItem(LS_ACCESS);
    localStorage.removeItem(LS_ACCESS_LEGACY);
  } catch {}
}

export function setAccessTokenInMemory(token: string | null | undefined): void {
  memoryAccessToken = String(token || '').trim() || null;
}

/**
 * Refresh tokens now live in an HttpOnly cookie (`fusiku_rt`) set by the
 * backend on login / refresh. Persisting them in localStorage would defeat the
 * XSS-hardening — so this is a no-op kept for call-site compatibility, and
 * actively scrubs any value written by an older build of the app.
 */
export function persistRefreshToken(_token: string): void {
  try {
    localStorage.removeItem(LS_REFRESH);
  } catch {}
}

/**
 * Read a refresh token from legacy localStorage. Returns `null` for new
 * sessions (cookie-only). Used by `services/api.ts` exactly once on first
 * refresh after upgrade, to migrate the user onto the cookie.
 */
export function readStoredRefreshToken(): string | null {
  try {
    const t = String(localStorage.getItem(LS_REFRESH) || '').trim();
    return t || null;
  } catch {
    return null;
  }
}

export function clearStoredRefreshToken(): void {
  try {
    localStorage.removeItem(LS_REFRESH);
  } catch {}
}

export function rememberCompanyId(companyId: string | null | undefined): void {
  const id = String(companyId || '').trim();
  if (!id) return;

  try {
    localStorage.setItem(LS_LAST_COMPANY, id);
  } catch {}
}

export function readDefaultCompanyIdFromEnv(): string | null {
  const s = String(import.meta.env.VITE_DEFAULT_COMPANY_ID ?? '').trim();
  return s || null;
}

export function resolveCompanyIdForAuth(): string | null {
  const fromEnv = readDefaultCompanyIdFromEnv();
  if (fromEnv) return fromEnv;

  try {
    const fromLast = localStorage.getItem(LS_LAST_COMPANY);
    if (fromLast && fromLast.trim()) return fromLast.trim();
  } catch {}

  try {
    const raw = localStorage.getItem('user');
    if (raw) {
      const u = JSON.parse(raw) as { companyId?: string };
      const id = String(u?.companyId || '').trim();
      if (id) return id;
    }
  } catch {}

  return null;
}