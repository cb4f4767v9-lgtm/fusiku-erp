import type { CookieOptions, Request, Response } from 'express';
import { refreshTokenMaxAgeMs } from './jwt';

/**
 * Name of the HttpOnly refresh-token cookie.
 *
 * Scoped to `/api/v1/auth` so it's only attached to refresh / logout
 * requests and never leaks to other API endpoints.
 */
export const REFRESH_COOKIE_NAME = 'fusiku_rt';

const REFRESH_COOKIE_PATH = '/api/v1/auth';

function isProd(): boolean {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

/** Resolve SameSite from env override, with a sensible per-environment default. */
function resolveSameSite(): CookieOptions['sameSite'] {
  const raw = String(process.env.REFRESH_COOKIE_SAMESITE || '').trim().toLowerCase();
  if (raw === 'lax' || raw === 'strict' || raw === 'none') return raw;
  // Cross-site SPA → API in production needs `none` (with Secure).
  // Same-site dev (localhost:5173 ↔ localhost:3001) is happy with `lax`.
  return isProd() ? 'none' : 'lax';
}

/** Build cookie options consistently for set + clear (must match for the browser to drop it). */
function refreshCookieOptions(): CookieOptions {
  const sameSite = resolveSameSite();
  return {
    httpOnly: true,
    secure: isProd() || sameSite === 'none',
    sameSite,
    path: REFRESH_COOKIE_PATH,
  };
}

/**
 * Set the refresh token as an HttpOnly cookie.
 *
 * - HttpOnly so JS can't read it (XSS-safe).
 * - Secure in production (and whenever SameSite=None).
 * - Path-scoped to `/api/v1/auth` so other endpoints don't see it.
 * - `Max-Age` matches the refresh token's lifetime — once it expires the user
 *   must sign in again.
 */
export function setRefreshTokenCookie(res: Response, token: string): void {
  const t = String(token || '').trim();
  if (!t) return;
  res.cookie(REFRESH_COOKIE_NAME, t, {
    ...refreshCookieOptions(),
    maxAge: refreshTokenMaxAgeMs(),
  });
}

/** Read the refresh token from the HttpOnly cookie (requires `cookie-parser`). */
export function readRefreshTokenCookie(req: Request): string | null {
  const cookies = (req as Request & { cookies?: Record<string, unknown> }).cookies;
  if (!cookies || typeof cookies !== 'object') return null;
  const raw = cookies[REFRESH_COOKIE_NAME];
  const t = typeof raw === 'string' ? raw.trim() : '';
  return t || null;
}

/** Clear the refresh cookie (logout / 401 cleanup). */
export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions());
}
