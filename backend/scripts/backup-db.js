#!/usr/bin/env node
/**
 * FUSIKU ERP - Database Backup Script (manual / CI)
 * Run: npm run backup:db
 * Same logic as the scheduled databaseBackup job (see services/backup.service.ts).
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

if (process.env.DATABASE_BACKUP_ENABLED === 'false') {
  console.error('DATABASE_BACKUP_ENABLED=false — skipping');
  process.exit(0);
}

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const lower = dbUrl.toLowerCase();
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const pgDump = process.env.PG_DUMP_PATH || 'pg_dump';

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

if (dbUrl.startsWith('file:')) {
  const raw = dbUrl.replace(/^file:/, '');
  const src = path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
  const dest = path.join(BACKUP_DIR, `fusiku-backup-${ts}.db`);
  try {
    fs.copyFileSync(src, dest);
    console.log(`Backup saved: ${dest}`);
  } catch (e) {
    fail(`Backup failed: ${e.message}`);
  }
  process.exit(0);
}

if (!lower.startsWith('postgresql://') && !lower.startsWith('postgres://')) {
  fail('Unsupported DATABASE_URL (expected PostgreSQL or file: SQLite)');
}

const filepath = path.join(BACKUP_DIR, `fusiku-backup-${ts}.sql`);
const child = spawn(
  pgDump,
  ['-F', 'p', '--no-owner', '--no-acl', '-f', filepath, '--dbname', dbUrl],
  { stdio: ['ignore', 'inherit', 'inherit'], env: process.env, windowsHide: true }
);

child.on('error', (err) => fail(`pg_dump: ${err.message}`));
child.on('close', (code) => {
  if (code === 0) {
    console.log(`Backup saved: ${filepath}`);
    process.exit(0);
  }
  fail(`pg_dump exited with code ${code}`);
});
