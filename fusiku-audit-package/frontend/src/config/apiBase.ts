/**
 * Single source of truth for the REST base path `/api/v1` (Express backend).
 *
 * - LAN / same host: when `VITE_API_URL` is unset, the API base uses this page's hostname + `VITE_BACKEND_PORT` (default 3001).
 * - Accepts common misconfigs: origin-only, or `/api` without `/v1`.
 */

const DEFAULT_BACKEND_PORT = Number(
  String((import.meta as any).env?.VITE_BACKEND_PORT ?? '3001').trim() || 3001
);

function stripTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, '');
}

/**
 * Backend mounts `authRoutes` at `/api/v1/auth` (see Express `app.use('/api/v1/auth', authRoutes)`).
 * Axios `baseURL` must be **`/api/v1` only**; requests use paths like `/auth/login`.
 * If `VITE_API_URL` is wrongly set to `.../api/v1/auth`, login would hit `.../api/v1/auth/auth/login` (404).
 */
function ensureAuthNotInApiBase(s: string): string {
  const t = stripTrailingSlashes(s);
  if (/\/api\/v1\/auth$/i.test(t)) {
    return t.replace(/\/auth$/i, '');
  }
  return t;
}

function devHostname(): string {
  if (typeof window === 'undefined' || !window.location?.hostname) return 'localhost';
  return window.location.hostname;
}

/**
 * Axios `baseURL`: no trailing slash, always ends with `/api/v1`.
 * May be absolute (`http://host:3001/api/v1`) or root-relative (`/api/v1` when using Vite proxy).
 */
export function resolveApiV1BaseUrl(): string {
  const raw = String((import.meta as any).env?.VITE_API_URL ?? '').trim();
  if (!raw) {
    const origin = `http://${devHostname()}:${DEFAULT_BACKEND_PORT}`;
    return ensureAuthNotInApiBase(`${stripTrailingSlashes(origin)}/api/v1`);
  }

  let s = stripTrailingSlashes(raw);
  const lower = s.toLowerCase();

  // Root-relative (e.g. "/api/v1" with Vite dev proxy to Express :3001)
  if (s.startsWith('/')) {
    if (/\/api\/v1$/i.test(s)) return ensureAuthNotInApiBase(s);
    if (/\/api$/i.test(s)) return ensureAuthNotInApiBase(`${s}/v1`);
    if (!lower.includes('/api')) return ensureAuthNotInApiBase(`${s}/api/v1`);
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[fusiku] VITE_API_URL should be /api/v1 (or /api). Got:', s);
    }
    return ensureAuthNotInApiBase(s);
  }

  if (!lower.includes('/api')) {
    return ensureAuthNotInApiBase(`${s}/api/v1`);
  }

  if (/\/api$/i.test(s)) {
    return ensureAuthNotInApiBase(`${s}/v1`);
  }

  if (/\/api\/v1$/i.test(s)) {
    return ensureAuthNotInApiBase(s);
  }

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn('[fusiku] VITE_API_URL should end with /api/v1 (or /api for auto-fix). Using as-is:', s);
  }
  return ensureAuthNotInApiBase(s);
}

export function resolveBackendOrigin(): string {
  const base = resolveApiV1BaseUrl();
  if (base.startsWith('/')) {
    if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
    return '';
  }
  try {
    return new URL(base).origin;
  } catch {
    return '';
  }
}
