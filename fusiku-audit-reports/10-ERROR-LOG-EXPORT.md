# Fusiku ERP — Error & Risk Log
**Generated:** 2026-05-11

---

## Architectural Errors / Risks

| ID | Type | Severity | Description | Location |
|----|------|----------|-------------|----------|
| ERR-001 | Data Precision | CRITICAL | Float used for money in 13 financial models | schema.prisma: Purchase, Sale, Invoice, Expense, etc. |
| ERR-002 | Performance | CRITICAL | 16 missing database indexes on high-traffic tables | schema.prisma: PurchaseItem, SaleItem, ActivityLog, etc. |
| ERR-003 | Performance | HIGH | No server-side pagination on ANY list endpoint | All service list() methods |
| ERR-004 | Performance | HIGH | Client-side 3-call data join on students page | InstituteStudentsPage.tsx |
| ERR-005 | UX | HIGH | 4 placeholder pages in live navigation | Institute: courses, batches, attendance, settings |
| ERR-006 | Configuration | MEDIUM | Two theme toggle systems (race condition) | ThemeContext.tsx vs utils/theme.ts |
| ERR-007 | Data Quality | MEDIUM | 17 models use freeform String for status (no enum) | All status fields |
| ERR-008 | Data Quality | MEDIUM | Duplicated fields: nationalId + identityDocumentNumber | InstituteStudent |
| ERR-009 | Data Quality | MEDIUM | Duplicated fields: baseCurrency + currency | CompanySettings |
| ERR-010 | Data Quality | MEDIUM | Duplicated columns on Purchase (2 pairs) | Purchase model |
| ERR-011 | Code Quality | MEDIUM | Deprecated models still in schema (Sale, SaleItem, ExchangeRate) | schema.prisma |
| ERR-012 | Code Quality | MEDIUM | Overlapping audit models (AuditLog + ActivityLog) | schema.prisma |
| ERR-013 | i18n | MEDIUM | 15% translation gap across ar/zh/ur | i18n/*.json |
| ERR-014 | Naming | LOW | isActive vs active inconsistency across 13 models | schema.prisma |
| ERR-015 | Performance | LOW | 3 redundant @@index on @unique fields | TACCache, ApiKey, Inventory |
| ERR-016 | Architecture | LOW | IMEIRecord + IMEIHistory overlap | schema.prisma |
| ERR-017 | Design | LOW | Two spacing scales (4px vs 8px) | tokens.css vs design-system.css |
| ERR-018 | Testing | HIGH | Near-zero test coverage (3 frontend test files, 0 backend tests) | Entire project |
| ERR-019 | Realtime | LOW | Socket.io lacks Redis adapter (single-instance only) | chatGateway.ts |
| ERR-020 | Security | LOW | Some API-key routes missing permission checks (supplier FX rates) | supplier.routes.ts |

## Warnings (Non-blocking)

| ID | Description |
|----|-------------|
| WARN-001 | CompanySettings has multiple JSON fields (locale, dateFormat, etc.) — not queryable |
| WARN-002 | FX rate refresh is setInterval (not cron) — skips if server restarts |
| WARN-003 | No backup verification/restore endpoint — backup.service.ts is write-only |
| WARN-004 | No email/WhatsApp integration for institute notifications yet |
| WARN-005 | No file size validation on profile photo uploads (rules exist in design but not enforced) |
