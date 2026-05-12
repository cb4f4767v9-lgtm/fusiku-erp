# Fusiku ERP — Project Structure Report
**Generated:** 2026-05-11 | **Auditor:** Automated full-scan

---

## Architecture Overview

| Layer | Technology | Files |
|-------|-----------|-------|
| Frontend | React 18 + TypeScript + Vite | ~204 source files |
| Backend | Express + TypeScript + Prisma | ~349 source files |
| Database | PostgreSQL 16 | 107 models, 5 enums |
| Desktop | Electron | Wrapper for offline-first |
| Queue | BullMQ + Redis | 9 job types |
| Realtime | Socket.io | Branch chat |
| AI | LangChain + OpenAI | 13 AI service files |
| Observability | Sentry + OpenTelemetry + Pino + Prometheus | Full stack |

## Directory Map

```
fusiku-erp/
├── frontend/src/           React SPA
│   ├── pages/              60 page components
│   ├── components/         49 reusable components
│   │   ├── design-system/  6 primitives (PageLayout, Card, TableWrapper, EmptyState, ErrorState, Skeleton)
│   │   ├── dashboard/      7 widgets (KPI, RevenueChart, RecentSales, QuickActions, SmartActions, AI, Trial)
│   │   ├── sidebar/        3 files (Sidebar, SidebarItem, SidebarSection)
│   │   ├── institute/      7 files (modals, forms, table row)
│   │   ├── auth/           3 files (AuthShell, ThemeToggle, OfflineLicense)
│   │   └── chat/           1 file (BranchChat)
│   ├── hooks/              4 custom hooks
│   ├── contexts/           8 providers (Auth, Theme, Branding, Currency, Branch, NavShell, Search, HybridSync)
│   ├── services/           5 files (api, socket, currency, locale, sync)
│   ├── utils/              29 utility files
│   ├── i18n/               4 languages (en, ar, zh, ur) + config
│   ├── styles/             9 CSS files (tokens, design-system, global, layout, components, final, login, brand, tailwind)
│   ├── routes/             AppRoutes + preload (40+ routes, all lazy-loaded)
│   ├── config/             4 files (sidebar, apiBase, appConfig, billing)
│   ├── offline/            9 files (IndexedDB outbox, desktop bridge, cache)
│   └── tests/              3 test files
│
├── backend/src/            Express API
│   ├── routes/             59 route files (200+ endpoints)
│   ├── controllers/        56 controller files
│   ├── services/           85 service files
│   │   ├── institute/      7 institute-specific services
│   │   └── partCatalog/    3 part catalog services
│   ├── middlewares/        19 middleware files
│   ├── core/
│   │   ├── validation/     9 Zod schema files + zodMiddleware
│   │   ├── tenant/         Prisma tenant isolation middleware
│   │   └── auth/           Branch guard utilities
│   ├── ai/                 5 AI service files
│   ├── aiBusiness/         4 AI business intelligence files
│   ├── selfHealing/        3 self-healing AI files
│   ├── realtime/           Chat gateway (Socket.io)
│   ├── jobs/               BullMQ queue + 9 job types
│   ├── observability/      OpenTelemetry + Prometheus metrics
│   ├── infrastructure/     Redis, DB client, cache, queue
│   ├── i18n/               Server-side localized messages
│   └── utils/              JWT, logger, tenant context, crypto
│
├── backend/prisma/
│   ├── schema.prisma       2140 lines, 107 models
│   └── migrations/         6 migrations
│
├── desktop/                Electron wrapper
├── shared/                 Shared types/constants
├── docker-compose.yml      5 services (pg, redis, backend, worker, frontend)
└── .github/                CI/CD workflows
```

## Module Map

| Module | Backend Services | Frontend Pages | DB Models | Status |
|--------|-----------------|----------------|-----------|--------|
| Auth / Login | 8 services | 5 pages | 7 models | Production |
| Dashboard | 2 services | 1 page | — | Production |
| Inventory | 3 services | 2 pages | 11 models | Production |
| POS / Sales | 3 services | 2 pages | 4 models | Production |
| Sales Orders | 1 service | 1 page | 2 models | Production |
| Invoicing | 1 service | 1 page | 3 models | Production |
| Quotations | 1 service | 1 page | 2 models | Production |
| Purchases | 1 service | 2 pages | 3 models | Production |
| Suppliers | 2 services | 3 pages | 4 models | Production |
| Customers | 1 service | 2 pages | 2 models | Production |
| Transfers | 1 service | 1 page | 2 models | Production |
| Repairs | 1 service | 1 page | 2 models | Production |
| Refurbishment | 1 service | 1 page | 3 models | Production |
| Currency / FX | 5 services | 1 page | 4 models | Production |
| Expenses | 1 service | 1 page | 1 model | Production |
| Investors | 1 service | — | 3 models | API-only |
| Reports | 2 services | 2 pages | 1 model | Production |
| AI Intelligence | 13 services | 2 pages | 1 model | Production |
| Institute Students | 1 service | 2 pages | 1 model | Production |
| Institute Courses | 1 service | placeholder | 1 model | API-only |
| Institute Batches | 1 service | placeholder | 1 model | API-only |
| Institute Enrollment | 1 service | modal only | 1 model | Production |
| Institute Fees | 2 services | 1 page | 1 model | Production |
| Institute Attendance | — | placeholder | 1 model (schema only) | Not started |
| Part Catalog | 3 services | placeholder | 5 models | API-only |
| Sourcing | — | placeholder | 1 model | Stub |
| Chat | 1 service + gateway | 1 component | 2 models | Production |
| Branches | 1 service | 2 pages | 2 models | Production |
| Users / Roles | 2 services | 1 page | 4 models | Production |
| Settings | 2 services | 2 pages | 2 models | Production |
| Billing / SaaS | 2 services | 2 pages | 2 models | Production |
| Translations | 1 service | 1 page | 1 model | Production |
| Phone Database | 1 service | 1 page + 5 master data | 10 models | Production |
| Imports | 1 service | — | — | API-only |
| PDF Generation | 1 service | — | — | API-only |
| System Monitoring | 3 services | 3 pages | 3 models | Production |
| Public API | 1 controller | — | 2 models | Production |
| Webhooks | 1 service | — | 2 models | API-only |
