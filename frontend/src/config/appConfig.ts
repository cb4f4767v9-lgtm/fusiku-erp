import configJson from '../../../shared/config.json';
import { resolveApiV1BaseUrl, resolveBackendOrigin } from './apiBase';

export type AppConfig = typeof configJson;

export function getApiBaseUrl() {
  return resolveApiV1BaseUrl();
}

/** Origin only (static files like `/uploads/*` are served from the API host root). */
export function getBackendOrigin(): string {
  return resolveBackendOrigin();
}

/** Turn stored `/uploads/...` into an absolute URL for `<img src>`. */
export function publicAssetUrl(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (stored.startsWith('http')) return stored;
  const p = stored.startsWith('/') ? stored : `/${stored}`;
  const origin = getBackendOrigin();
  return origin ? `${origin}${p}` : p;
}

/** Routes still mounted under `/api/*` (not `/api/v1/*`) — same host, no third-party CDNs. */
export function getLegacyApiBaseUrl() {
  return getApiBaseUrl().replace(/\/?v1\/?$/, '');
}

export const appConfig = configJson;

