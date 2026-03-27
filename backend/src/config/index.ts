/**
 * Fusiku - Config Loader
 * Load from process.env with defaults for development/staging/production
 */

const NODE_ENV = process.env.NODE_ENV || 'development';
const env = (process.env.APP_ENV || NODE_ENV) as 'development' | 'staging' | 'production';

export const nodeEnv = NODE_ENV;
export const port = parseInt(process.env.PORT || '3001', 10);
export const databaseUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/fusiku_erp';
export const jwtSecret = process.env.JWT_SECRET || 'fusiku-erp-secret-key-change-in-production';
export const jwtExpires = process.env.JWT_EXPIRES || '7d';
export const jwtRefreshExpires = process.env.JWT_REFRESH_EXPIRES || '30d';
export const redisUrl = process.env.REDIS_URL || undefined;

export const config = {
  env,
  nodeEnv: NODE_ENV,
  port,
  databaseUrl,
  jwtSecret,
  jwtExpires,
  jwtRefreshExpires,
  redisUrl,

  isDev: env === 'development',
  isStaging: env === 'staging',
  isProd: env === 'production',

  server: {
    port,
    host: process.env.HOST || '0.0.0.0',
  },

  database: {
    url: databaseUrl,
  },

  redis: {
    url: redisUrl,
    enabled: !!redisUrl,
  },

  jwt: {
    secret: jwtSecret,
    expiresIn: jwtExpires,
    refreshExpiresIn: jwtRefreshExpires,
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  upload: {
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE || '10485760', 10),
    path: process.env.UPLOAD_PATH || 'uploads',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || true,
  },

  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    localPath: process.env.UPLOAD_PATH || 'uploads',
  },
};

export type Config = typeof config;
