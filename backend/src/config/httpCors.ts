import type { CorsOptions } from 'cors';
import { logger } from '../utils/logger';

/**
 * HTTP + browser CORS. Set `CORS_ORIGIN` to a comma-separated allowlist
 * (e.g. `https://app.example.com,http://localhost:5173`). When unset, dev
 * allows any origin; production logs a warning until you configure it.
 */
export function getHttpCorsOptions(): CorsOptions {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      logger.warn(
        '[cors] CORS_ORIGIN is not set — browser origins are denied. Set CORS_ORIGIN to a comma-separated allowlist.'
      );
      return { origin: false, credentials: true };
    }
    return { origin: true, credentials: true };
  }

  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return {
    credentials: true,
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (list.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
  };
}

/** Socket.io v4 `cors` option — same allowlist when `CORS_ORIGIN` is set. */
export function getSocketIoCors(): { origin: string | string[] | boolean; credentials: boolean } {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      return { origin: false, credentials: true };
    }
    return { origin: true, credentials: true };
  }
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return { origin: list.length ? list : true, credentials: true };
}
