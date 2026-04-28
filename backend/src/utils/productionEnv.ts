import { logger } from './logger';

/** Values that must never sign tokens in production. */
const FORBIDDEN_JWT_SECRETS = new Set([
  '',
  'fusiku-erp-secret-key-change-in-production',
  'your-super-secret-jwt-key-change-in-production',
  'change-me-in-production',
]);

const MIN_JWT_SECRET_LENGTH = 32;

const FORBIDDEN_REFRESH_SECRETS = new Set([
  '',
  'fusiku-erp-refresh-secret-change-in-production',
  'change-me-refresh-secret-min-32-chars-required',
]);

/** True if secret is non-empty, not a known placeholder, and long enough for production checks. */
export function isJwtSecretStrong(secret: string | undefined): boolean {
  const jwt = secret || '';
  return !FORBIDDEN_JWT_SECRETS.has(jwt) && jwt.length >= MIN_JWT_SECRET_LENGTH;
}

export function isRefreshSecretStrong(secret: string | undefined): boolean {
  const s = secret || '';
  return !FORBIDDEN_REFRESH_SECRETS.has(s) && s.length >= MIN_JWT_SECRET_LENGTH;
}

export function assertProductionEnvironment(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv !== 'production') return;

  const jwt = process.env.JWT_SECRET || '';
  if (!isJwtSecretStrong(jwt)) {
    logger.fatal(
      { MIN_JWT_SECRET_LENGTH },
      '[env] FATAL: JWT_SECRET must be set to a strong non-default value in production (min 32 characters, not a known placeholder).'
    );
    process.exit(1);
  }

  const refresh = process.env.REFRESH_SECRET || '';
  if (!isRefreshSecretStrong(refresh)) {
    logger.fatal(
      { MIN_JWT_SECRET_LENGTH },
      '[env] FATAL: REFRESH_SECRET must be set to a strong value in production (min 32 characters, not a known placeholder).'
    );
    process.exit(1);
  }

  if (!process.env.CORS_ORIGIN?.trim()) {
    logger.fatal('[env] FATAL: CORS_ORIGIN must be set in production (comma-separated browser origin allowlist).');
    process.exit(1);
  }
}

/** Default admin auto-creation is unsafe with a weak password; production requires explicit strong password. */
export function isStrongBootstrapPassword(password: string | undefined): boolean {
  const pw = String(password || '');
  if (pw.length < 16) return false;
  if (!/[A-Za-z]/.test(pw)) return false;
  if (!/[0-9]/.test(pw)) return false;
  return true;
}

export function warnWeakJwtInDevelopment(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv === 'production') return;

  const jwt = process.env.JWT_SECRET || '';
  if (!jwt) {
    logger.warn('[env] JWT_SECRET is not set — auth will fail until you set it in .env');
    return;
  }
  if (!isJwtSecretStrong(jwt)) {
    logger.warn(
      { MIN_JWT_SECRET_LENGTH },
      '[env] JWT_SECRET is weak or placeholder — use a long random secret before production.'
    );
  }

  const refresh = process.env.REFRESH_SECRET || '';
  if (!refresh) {
    logger.warn('[env] REFRESH_SECRET is not set — refresh tokens will fail until you set it in .env');
  } else if (!isRefreshSecretStrong(refresh)) {
    logger.warn(
      { MIN_JWT_SECRET_LENGTH },
      '[env] REFRESH_SECRET is weak or placeholder — use a long random secret before production.'
    );
  }
}
