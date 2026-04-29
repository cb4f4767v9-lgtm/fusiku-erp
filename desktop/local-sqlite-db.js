/**
 * Phase 5 — SQLite-backed local store for Electron (sql.js, persisted to userData).
 * Tables: outbox (write queue), cache_kv (inventory / expenses / currency / sales snapshots).
 */
const path = require('path');
const fs = require('fs');
const { app, ipcMain } = require('electron');
const { randomUUID } = require('crypto');

const MAX_ATTEMPTS = 8;

/** @type {import('sql.js').SqlJs | null} */
let SQL = null;
/** @type {import('sql.js').Database | null} */
let db = null;
let dbPath = '';
/** @type {Promise<import('sql.js').Database> | null} */
let initPromise = null;

function wasmDir() {
  return path.join(__dirname, 'node_modules', 'sql.js', 'dist');
}

async function initSqlJsOnce() {
  if (SQL) return SQL;
  const initSqlJs = require('sql.js');
  SQL = await initSqlJs({
    locateFile: (file) => path.join(wasmDir(), file),
  });
  return SQL;
}

function migrate() {
  if (!db) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY NOT NULL,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      conflict_detail TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_outbox_status_created ON outbox(status, created_at);

    CREATE TABLE IF NOT EXISTS cache_kv (
      cache_key TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales_cache (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_cache (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses_cache (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS currency_cache (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function persist() {
  if (!db || !dbPath) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, buffer);
  } catch (e) {
    console.error('[local-sqlite-db] persist failed', e);
  }
}

async function getDb() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const SqlJs = await initSqlJsOnce();
    dbPath = path.join(app.getPath('userData'), 'fusiku-offline.sqlite');
    if (fs.existsSync(dbPath)) {
      const buf = fs.readFileSync(dbPath);
      db = new SqlJs.Database(buf);
    } else {
      db = new SqlJs.Database();
    }
    migrate();
    persist();
    return db;
  })();
  return initPromise;
}

function nowIso() {
  return new Date().toISOString();
}

function registerLocalDatabaseIpc() {
  ipcMain.handle('localdb:outbox-enqueue', async (_e, kind, payload) => {
    await getDb();
    const id = randomUUID();
    const t = nowIso();
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
    db.run(
      `INSERT INTO outbox (id, kind, payload, status, attempts, created_at, updated_at) VALUES (?, ?, ?, 'pending', 0, ?, ?)`,
      [id, String(kind || 'unknown'), payloadStr, t, t]
    );
    persist();
    return { id };
  });

  ipcMain.handle('localdb:outbox-list-pending', async () => {
    await getDb();
    const stmt = db.prepare(
      `SELECT id, kind, payload, status, attempts, last_error, conflict_detail, created_at, updated_at
       FROM outbox WHERE status = 'pending' ORDER BY datetime(created_at) ASC LIMIT 200`
    );
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  });

  ipcMain.handle('localdb:outbox-mark-synced', async (_e, id) => {
    await getDb();
    const t = nowIso();
    db.run(`UPDATE outbox SET status = 'synced', updated_at = ? WHERE id = ?`, [t, String(id)]);
    persist();
    return { ok: true };
  });

  ipcMain.handle('localdb:outbox-mark-conflict', async (_e, id, detail) => {
    await getDb();
    const t = nowIso();
    db.run(`UPDATE outbox SET status = 'conflict', conflict_detail = ?, updated_at = ? WHERE id = ?`, [
      String(detail || '').slice(0, 4000),
      t,
      String(id),
    ]);
    persist();
    return { ok: true };
  });

  ipcMain.handle('localdb:outbox-bump-attempt', async (_e, id, errMsg) => {
    await getDb();
    const t = nowIso();
    db.run(
      `UPDATE outbox SET attempts = attempts + 1, last_error = ?, updated_at = ? WHERE id = ?`,
      [String(errMsg || '').slice(0, 2000), t, String(id)]
    );
    const stmt = db.prepare(`SELECT attempts FROM outbox WHERE id = ?`);
    stmt.bind([String(id)]);
    let attempts = 0;
    if (stmt.step()) {
      attempts = Number(stmt.getAsObject().attempts) || 0;
    }
    stmt.free();
    if (attempts >= MAX_ATTEMPTS) {
      db.run(`UPDATE outbox SET status = 'failed', updated_at = ? WHERE id = ?`, [t, String(id)]);
    }
    persist();
    return { ok: true, attempts };
  });

  ipcMain.handle('localdb:outbox-mark-failed', async (_e, id, errMsg) => {
    await getDb();
    const t = nowIso();
    db.run(`UPDATE outbox SET status = 'failed', last_error = ?, updated_at = ? WHERE id = ?`, [
      String(errMsg || '').slice(0, 2000),
      t,
      String(id),
    ]);
    persist();
    return { ok: true };
  });

  ipcMain.handle('localdb:outbox-pending-count', async () => {
    await getDb();
    const stmt = db.prepare(`SELECT COUNT(*) AS c FROM outbox WHERE status = 'pending'`);
    stmt.step();
    const row = stmt.getAsObject();
    stmt.free();
    return Number(row.c) || 0;
  });

  ipcMain.handle('localdb:outbox-conflict-count', async () => {
    await getDb();
    const stmt = db.prepare(`SELECT COUNT(*) AS c FROM outbox WHERE status = 'conflict'`);
    stmt.step();
    const row = stmt.getAsObject();
    stmt.free();
    return Number(row.c) || 0;
  });

  ipcMain.handle('localdb:outbox-conflicts-list', async () => {
    await getDb();
    const stmt = db.prepare(
      `SELECT id, kind, conflict_detail, created_at FROM outbox WHERE status = 'conflict' ORDER BY datetime(updated_at) DESC LIMIT 50`
    );
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  });

  ipcMain.handle('localdb:outbox-delete', async (_e, id) => {
    await getDb();
    db.run(`DELETE FROM outbox WHERE id = ?`, [String(id)]);
    persist();
    return { ok: true };
  });

  ipcMain.handle('localdb:cache-set', async (_e, key, jsonStr) => {
    await getDb();
    const k = String(key || '').trim();
    const t = nowIso();
    const payload = typeof jsonStr === 'string' ? jsonStr : JSON.stringify(jsonStr ?? {});
    if (['inventory', 'expenses', 'currency', 'sales'].includes(k)) {
      db.run(`INSERT INTO cache_kv (cache_key, payload, updated_at) VALUES (?, ?, ?)
              ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`, [
        k,
        payload,
        t,
      ]);
      const table =
        k === 'inventory'
          ? 'inventory_cache'
          : k === 'expenses'
            ? 'expenses_cache'
            : k === 'currency'
              ? 'currency_cache'
              : 'sales_cache';
      db.run(`INSERT INTO ${table} (id, payload, updated_at) VALUES (1, ?, ?)
              ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`, [
        payload,
        t,
      ]);
    } else {
      db.run(
        `INSERT INTO cache_kv (cache_key, payload, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
        [k, payload, t]
      );
    }
    persist();
    return { ok: true };
  });

  ipcMain.handle('localdb:cache-get', async (_e, key) => {
    await getDb();
    const k = String(key || '').trim();
    const stmt = db.prepare(`SELECT payload FROM cache_kv WHERE cache_key = ? LIMIT 1`);
    stmt.bind([k]);
    let out = null;
    if (stmt.step()) {
      out = String(stmt.getAsObject().payload || '');
    }
    stmt.free();
    return out;
  });
}

module.exports = { registerLocalDatabaseIpc, getDb };
