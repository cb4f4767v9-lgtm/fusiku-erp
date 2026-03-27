# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FUSIKU ERP is a full-stack Enterprise Resource Planning system for mobile phone refurbishing and trading companies. It ships as a web app and an Electron desktop app.

**Default credentials:** `admin@fusiku.com` / `admin123`

## Commands

### Setup
```bash
npm run install:all    # Install all workspace dependencies
npm run db:setup       # Push schema + seed + demo data
```

### Development
```bash
npm run dev            # Backend + Frontend (ports 3001 + 5173)
npm run dev:all        # Backend + Frontend + Electron
npm run dev:backend    # Backend only
npm run dev:frontend   # Frontend only
```

### Build
```bash
npm run build          # Build frontend + backend
npm run build:desktop  # Package Electron app (.exe on Windows)
```

### Database
```bash
npm run db:push        # Sync Prisma schema to DB
npm run db:studio      # Open Prisma Studio GUI
npm run seed:demo      # Load demo data
npm run reset-admin    # Reset admin password
```

### Health check
```bash
curl http://localhost:3001/api/health
curl http://localhost:3001/api/v1/system/check
```

There is no configured test or lint runner. TypeScript compilation serves as type checking.

## Architecture

### Monorepo Structure

```
backend/    Express API (Node.js + TypeScript)
frontend/   React + Vite SPA
desktop/    Electron wrapper
```

**Default ports:** Frontend dev: 5173 | Backend: 3001 | PostgreSQL: 5432 | Redis: 6379

### Backend (`backend/src/`)

MVC-style Express app with this layering:

- **`index.ts`** — App entry: registers routes, middleware, Socket.io, plugin loader, workers
- **`routes/`** — Route definitions (37+ files). Dual-mounted: `/api/v1/*` (primary) and `/api/*` (legacy compatibility)
- **`controllers/`** — Request parsing, delegates to services, returns responses
- **`services/`** — All business logic (inventory, POS, purchases, repairs, refurbishing, reports, auth)
- **`middlewares/`** — JWT auth, API key validation, RBAC permissions, rate limiting, performance metrics
- **`ai/`** — 12 AI modules: agents (forecasting, risk, price optimization, alerts) and services (device ID, condition assessment, repair patterns)
- **`jobs/`** — Background jobs with Redis-backed queue and scheduler
- **`integrations/`** — Third-party integration framework (accounting, ecommerce, shipping)
- **`plugins/`** — Dynamic plugin system; plugins register routes and hooks at startup
- **`utils/prisma.ts`** — Prisma client singleton
- **`utils/companyContext.ts`** — Multi-branch tenancy context

### Frontend (`frontend/src/`)

- **`App.tsx`** — Root component with all route definitions and protected route wrapper
- **`pages/`** — One component per route (Dashboard, Inventory, POS, Repairs, Refurbishing, Reports, Settings, AI BI, Auth flows)
- **`layouts/Layout.tsx`** — Main shell: sidebar + content area
- **`components/`** — Shared UI components
- **`hooks/useAuth`** — Authentication state
- **`contexts/SearchContext`** — Global search
- **`services/`** — Axios-based API clients
- **`i18n/`** — i18next multi-language support
- **`config/sidebarItems.ts`** — Navigation menu definition

Path alias `@/` maps to `frontend/src/`.

### Desktop (`desktop/`)

- **`electron-main.js`** — Spawns the backend as a child process, polls `/api/health` until ready, then opens the Electron window. In dev, loads from `localhost:5173`; in production, loads bundled resources from `process.resourcesPath`. Polls `/api/version` every 10s for update detection.
- **`preload.js`** — IPC security bridge between main and renderer processes
- See `desktop/BACKEND_CONNECTION_AUDIT.md` for a 10-step troubleshooting checklist for packaged app issues.

### Database

Prisma schema at `backend/prisma/schema.prisma`. Core entities: `User`, `Role`, `Branch`, `Supplier`, `Customer`, `Inventory` (IMEI-tracked), `IMEIRecord`, `Purchase`/`PurchaseItem`, `Sale`/`SaleItem`, `Repair`, `RefurbishJob`, `ExchangeRate`, `AuditLog`.

After editing the schema, run `npm run db:push` and restart the backend.

### Key API Structure

Public (no auth): `/api/v1/auth/*`, `/api/v1/setup/*`, `/api/health`, `/api/version`
Public API (rate-limited, API key required): `/api/public/v1/*`
Authenticated: all other `/api/v1/*` routes

### Real-time

Socket.io is initialized in `backend/src/index.ts` and broadcasts inventory changes, order updates, and repair status across branches.

### Docker

`docker-compose.yml` orchestrates PostgreSQL, Redis, backend, and frontend (nginx). Frontend is served on port 80.
