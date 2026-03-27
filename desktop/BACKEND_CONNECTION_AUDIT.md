# Backend connection audit (Electron + API)

This document tracks the **Fusiku** packaged app vs your checklist.

## STEP 1 — Backend exists in built app

**Path:** `dist/win-unpacked/resources/backend/dist/`

**Entry file:** `index.js` (not `main.js`)

- Repo: `backend/package.json` → `"main": "dist/index.js"`
- Electron: `desktop/electron-main.js` → `path.join(..., 'dist', 'index.js')`

If `index.js` is missing → run `cd backend && npm run build`, then rebuild desktop.

## STEP 2 — Electron backend path

Use:

```text
packaged: path.join(process.resourcesPath, 'backend', 'dist', 'index.js')
dev:       path.join(__dirname, '..', 'backend', 'dist', 'index.js')
```

## STEP 3 — Logging

On startup, logs include:

- `Backend root`, `Backend entry`, `exists: true/false`
- File: `%appdata%\com.fusiku.erp\backend-process.log`

## STEP 4 — Start method

**Use:** `spawn` with `process.execPath` + `ELECTRON_RUN_AS_NODE=1` (packaged) so users don’t need `node` on PATH.

**`cwd`:** Must be the bundled **`backend`** folder (`resources/backend`), **not** only `userData`.

Reason: Prisma schema, `node_modules`, `.env`, and `prisma/` resolve from that tree.  
`userData` is still used for optional `backend-data` (see `electron-main.js`).

## STEP 5 — Crash detection

`stdout` / `stderr` / `exit` / `spawn error` → console + `backend-process.log`.

## STEP 6 — Port

Backend: `PORT` from env or **3001** (`backend/src/index.ts`).

Electron health check: `http://127.0.0.1:3001/api/health`.

## STEP 7 — Manual test

```bash
cd backend
node dist/index.js
```

Browser: `http://127.0.0.1:3001/api/v1/setup/status`  
(Use `index.js`, not `main.js`.)

## STEP 8 — electron-builder

`desktop/package.json` → `extraResources` includes `../backend/dist` → `backend/dist` (and prisma, .env, node_modules).

## STEP 9 — Clean rebuild

```bash
cd backend && npm install && npm run build
cd ../frontend && npm run build
cd ../desktop && npm run build
```

## STEP 10 — Test unpacked EXE

Run: `dist/win-unpacked/Fusiku.exe`

For main-process logs, run from a terminal:

```bash
cd dist/win-unpacked
".\Fusiku.exe"
```

Or read `%appdata%\com.fusiku.erp\backend-process.log`.
