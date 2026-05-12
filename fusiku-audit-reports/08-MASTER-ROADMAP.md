# Fusiku ERP — Master Improvement Roadmap
**Generated:** 2026-05-11

---

## CRITICAL (Week 1-2) — Production blockers

| # | Task | Impact | Effort |
|---|------|--------|--------|
| C1 | Add 16 missing database indexes | Prevents table scans / production outages | 1 day |
| C2 | Add server-side pagination to ALL list endpoints | Prevents memory explosion | 3 days |
| C3 | Unify theme toggle system (single source of truth) | Eliminates race conditions | 0.5 day |
| C4 | Remove/hide placeholder navigation items (courses, batches, attendance) OR build real pages | Eliminates broken UX trust | 2 days |
| C5 | Fix Client-side 3-call join on students page → server-side aggregation | Prevents slow loads | 1 day |

## HIGH (Week 2-4) — Quality & reliability

| # | Task | Impact | Effort |
|---|------|--------|--------|
| H1 | Build real Courses page (list + create + edit) using existing API | Fills placeholder gap | 2 days |
| H2 | Build real Batches page (list + create + edit) using existing API | Fills placeholder gap | 2 days |
| H3 | Wire Attendance API (service + routes) + build basic page | Completes institute core | 3 days |
| H4 | Add PATCH endpoints for courses, batches, enrollments | Completes CRUD matrix | 1 day |
| H5 | Merge identity fields (nationalId → identityDocumentType/Number) | Eliminates duplication | 0.5 day |
| H6 | Build shared DataTable component (sort, filter, pagination, export) | Eliminates table code duplication | 5 days |
| H7 | Consolidate spacing scale to single 4px system | Design consistency | 1 day |
| H8 | Fill translation gaps for ar/zh/ur (institute + parts sections) | Multilingual completeness | 2 days |
| H9 | Add `isActive` + `currency` to Customer model | Entity symmetry with Supplier | 0.5 day |
| H10 | Standardize `isActive` vs `active` across all 13 models | Naming consistency | Migration + 0.5 day |

## MEDIUM (Week 4-8) — Feature completeness

| # | Task | Impact | Effort |
|---|------|--------|--------|
| M1 | Exam + Result system (schema + API + UI) | Completes academic ERP | 1 week |
| M2 | Teacher + Classroom reference tables, batch FK migration | Structured reference data | 3 days |
| M3 | Float → Decimal migration for financial models (13 models) | Financial precision | 3 days |
| M4 | Remove deprecated models (Sale, SaleItem, ExchangeRate) | Schema cleanup | 1 day |
| M5 | Merge IMEIRecord + IMEIHistory → single IMEIEvent | Model cleanup | 1 day |
| M6 | Deprecate ActivityLog (keep AuditLog) | Eliminate overlap | 0.5 day |
| M7 | Application/Admission workflow (InstituteApplication model) | Structured admissions | 1 week |
| M8 | HTTP cache headers for static-ish data | Fewer redundant requests | 1 day |
| M9 | Virtual scrolling for large tables (>100 rows) | Smoother UI | 2 days |
| M10 | Per-tenant rate limiting | SaaS fairness | 2 days |

## FUTURE (Month 2+) — Scale & expansion

| # | Task | Impact | Effort |
|---|------|--------|--------|
| F1 | Certificate/transcript generation (PDF + QR verification) | Academic completeness | 1 week |
| F2 | Communication layer (WhatsApp/email event dispatch) | Student/parent notifications | 1 week |
| F3 | Online application portal (public routes) | Self-service admissions | 2 weeks |
| F4 | Automated test suite (backend integration + frontend component) | Enterprise confidence | Ongoing |
| F5 | Multi-region deployment (read replicas, CDN) | Global scale | 2 weeks |
| F6 | Offline conflict resolution UI | Desktop reliability | 1 week |
| F7 | Hijri calendar support | Arabic market | 3 days |
| F8 | Student/parent mobile portal | Self-service | 3 weeks |
| F9 | API documentation (Swagger completeness) | Developer experience | 1 week |
| F10 | Redis adapter for Socket.io (horizontal scaling) | Multi-instance chat | 1 day |

---

## Weekly Development Plan

### Week 1: Foundation fixes
- Day 1: C1 (indexes) + C3 (theme unification)
- Day 2-3: C2 (server-side pagination on key endpoints)
- Day 4: C4 + C5 (placeholder pages → real pages, aggregated student endpoint)
- Day 5: H4 + H5 (PATCH endpoints, identity merge)

### Week 2: Institute completeness
- Day 1-2: H1 (Courses page)
- Day 3-4: H2 (Batches page)
- Day 5: H3 start (Attendance service + routes)

### Week 3: Table system + polish
- Day 1-2: H3 finish (Attendance UI)
- Day 3-5: H6 (Shared DataTable component)

### Week 4: Cleanup + i18n
- Day 1: H7 (spacing consolidation)
- Day 2-3: H8 (translation gap fill)
- Day 4: H9 + H10 (Customer fields, isActive standardization)
- Day 5: Buffer / bug fixes

### Week 5-8: Academic features
- M1 (Exam + Result system)
- M2 (Teacher + Classroom)
- M7 (Admission workflow)
- M3 (Float → Decimal migration)
