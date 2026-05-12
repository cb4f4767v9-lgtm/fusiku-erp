import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { describeDatabaseUrl, getActiveDatabaseUrl } from './utils/databaseUrl';
import { assertProductionEnvironment, warnWeakJwtInDevelopment } from './utils/productionEnv';
import { logger } from './utils/logger';

// Support DOTENV_CONFIG_PATH override set by Electron's spawn env.
// Fallback: __dirname in compiled dist/env.js is backend/dist/, so '../.env' = backend/.env.
const envPath = process.env.DOTENV_CONFIG_PATH || path.resolve(__dirname, '../.env');

if (!fs.existsSync(envPath)) {
  logger.warn({ envPath }, '[env] .env file not found');
} else {
  dotenv.config({ path: envPath });
}

const _db = describeDatabaseUrl(getActiveDatabaseUrl());
logger.info({ db: _db.kind, target: _db.safeLog }, '[env] Active database');

// Audit required variables and warn early so errors are obvious in logs
const REQUIRED_VARS = ['DATABASE_URL', 'JWT_SECRET', 'REFRESH_SECRET'];
for (const key of REQUIRED_VARS) {
  if (!process.env[key]) {
    logger.warn({ key }, '[env] Required environment variable is not set');
  }
}

assertProductionEnvironment();
warnWeakJwtInDevelopment();
