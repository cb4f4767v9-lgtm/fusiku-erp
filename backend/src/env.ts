import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { describeDatabaseUrl, getActiveDatabaseUrl } from './utils/databaseUrl';

// Support DOTENV_CONFIG_PATH override set by Electron's spawn env.
// Fallback: __dirname in compiled dist/env.js is backend/dist/, so '../.env' = backend/.env.
const envPath = process.env.DOTENV_CONFIG_PATH || path.resolve(__dirname, '../.env');

if (!fs.existsSync(envPath)) {
  console.warn(`[env] WARNING: .env file not found at ${envPath}`);
} else {
  dotenv.config({ path: envPath });
}

const _db = describeDatabaseUrl(getActiveDatabaseUrl());
console.log(`[env] Active database (${_db.kind}): ${_db.safeLog}`);

// Audit required variables and warn early so errors are obvious in logs
const REQUIRED_VARS = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of REQUIRED_VARS) {
  if (!process.env[key]) {
    console.warn(`[env] WARNING: Required environment variable "${key}" is not set`);
  }
}

if (process.env.JWT_SECRET === 'your-super-secret-jwt-key-change-in-production') {
  console.warn('[env] WARNING: JWT_SECRET is using the default placeholder — change it before going to production!');
}
