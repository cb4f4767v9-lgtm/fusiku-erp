/**
 * Database backup via pg_dump (PostgreSQL) or file copy (SQLite file: URLs).
 * Requires PostgreSQL client tools on PATH unless PG_DUMP_PATH is set.
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';

function backupDir(): string {
  return process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
}

function pgDumpBin(): string {
  return process.env.PG_DUMP_PATH || 'pg_dump';
}

function retentionDays(): number {
  const n = parseInt(process.env.BACKUP_RETENTION_DAYS || '14', 10);
  return Number.isFinite(n) && n > 0 ? n : 14;
}

async function pruneOldBackups(dir: string): Promise<void> {
  const days = retentionDays();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  let entries: Awaited<ReturnType<typeof fs.readdir>>;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (!e.isFile() || !e.name.startsWith('fusiku-backup-')) continue;
    const p = path.join(dir, e.name);
    const st = await fs.stat(p);
    if (st.mtimeMs < cutoff) {
      await fs.unlink(p);
      logger.info({ path: p, retentionDays: days }, 'Removed old database backup');
    }
  }
}

function runPgDump(outputFile: string, databaseUrl: string): Promise<void> {
  const bin = pgDumpBin();
  return new Promise((resolve, reject) => {
    const child = spawn(
      bin,
      ['-F', 'p', '--no-owner', '--no-acl', '-f', outputFile, '--dbname', databaseUrl],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
        windowsHide: true,
      }
    );
    let stderr = '';
    child.stderr?.on('data', (c: Buffer) => {
      stderr += c.toString();
    });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `pg_dump exited with code ${code}`));
    });
  });
}

export async function runDatabaseBackup(): Promise<void> {
  if (process.env.DATABASE_BACKUP_ENABLED === 'false') {
    logger.info('Database backup skipped (DATABASE_BACKUP_ENABLED=false)');
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  const started = Date.now();

  if (!databaseUrl) {
    logger.error('Database backup failed: DATABASE_URL not set');
    throw new Error('DATABASE_URL not set');
  }

  const dir = backupDir();
  await fs.mkdir(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  try {
    if (databaseUrl.startsWith('file:')) {
      const raw = databaseUrl.replace(/^file:/, '');
      const src = path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
      const filepath = path.join(dir, `fusiku-backup-${ts}.db`);
      await fs.copyFile(src, filepath);
      const st = await fs.stat(filepath);
      const durationMs = Date.now() - started;
      await pruneOldBackups(dir);
      logger.info(
        { filepath, bytes: st.size, durationMs, kind: 'sqlite' },
        'Database backup succeeded'
      );
      return;
    }

    const lower = databaseUrl.toLowerCase();
    if (!lower.startsWith('postgresql://') && !lower.startsWith('postgres://')) {
      throw new Error('Unsupported DATABASE_URL (use PostgreSQL or file: SQLite)');
    }

    const filepath = path.join(dir, `fusiku-backup-${ts}.sql`);
    await runPgDump(filepath, databaseUrl);
    const st = await fs.stat(filepath);
    const durationMs = Date.now() - started;
    await pruneOldBackups(dir);
    logger.info(
      { filepath, bytes: st.size, durationMs, kind: 'postgresql' },
      'Database backup succeeded'
    );
  } catch (e) {
    const durationMs = Date.now() - started;
    logger.error(
      { err: (e as Error).message, durationMs },
      'Database backup failed'
    );
    throw e;
  }
}
