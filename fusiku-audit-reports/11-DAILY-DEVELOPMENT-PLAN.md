# Fusiku ERP — Daily Development Plan
**Generated:** 2026-05-11

---

## Sprint 1: Foundation Hardening (Days 1-5)

### Day 1 — Database Safety
- [ ] Add 16 missing indexes (migration)
- [ ] Remove 3 redundant @@index on @unique fields
- [ ] Unify theme toggle system → single ThemeContext

### Day 2 — Server Pagination (Part 1)
- [ ] Add cursor/offset pagination to `institute/students`
- [ ] Add cursor/offset pagination to `institute/fees`
- [ ] Add cursor/offset pagination to `inventory`
- [ ] Update frontend to use paginated endpoints

### Day 3 — Server Pagination (Part 2)
- [ ] Add pagination to remaining list endpoints (sales, purchases, repairs, transfers)
- [ ] Build server-side aggregated student endpoint (fees + enrollment pre-joined)
- [ ] Remove client-side 3-call join on InstituteStudentsPage

### Day 4 — Institute Pages (Courses + Batches)
- [ ] Build InstituteCourses page (list + create + edit modal)
- [ ] Build InstituteBatches page (list + create + edit modal)
- [ ] Wire to existing backend APIs
- [ ] Replace placeholder navigation items

### Day 5 — Institute CRUD Completion
- [ ] Add PATCH endpoint for courses
- [ ] Add PATCH endpoint for batches
- [ ] Add PATCH endpoint for enrollments
- [ ] Merge identity fields (nationalId → identityDocumentType/Number migration)

---

## Sprint 2: Academic Core (Days 6-10)

### Day 6 — Attendance System (Backend)
- [ ] Create `instituteAttendance.service.ts` (CRUD + bulk record)
- [ ] Create attendance routes + controller methods
- [ ] Add Zod schemas for attendance endpoints
- [ ] Test with API client

### Day 7 — Attendance System (Frontend)
- [ ] Build InstituteAttendancePage with date picker + batch selector
- [ ] Create attendance grid component (student rows × date columns)
- [ ] Add status toggles (present/absent/late/excused)
- [ ] Wire to backend API

### Day 8 — Exam System (Backend)
- [ ] Design InstituteExam + InstituteResult models
- [ ] Create migration
- [ ] Build `instituteExam.service.ts` + `instituteResult.service.ts`
- [ ] Create routes + controller methods

### Day 9 — Exam System (Frontend)
- [ ] Build InstituteExamsPage (list exams per batch)
- [ ] Build exam creation modal (type, date, max marks, batch)
- [ ] Build result entry grid (students × marks)
- [ ] Auto-calculate percentage, grade, pass/fail

### Day 10 — Buffer / Integration
- [ ] Link attendance to enrollment
- [ ] Link results to enrollment
- [ ] Update student profile page to show exam history
- [ ] Bug fixes from Sprint 1

---

## Sprint 3: Shared Components (Days 11-15)

### Day 11-12 — DataTable Component
- [ ] Create reusable DataTable with props: columns, data, sorting, filtering
- [ ] Add pagination controls (client or server)
- [ ] Add search bar integration
- [ ] Add column visibility toggle
- [ ] Add export (CSV at minimum)

### Day 13 — DataTable Migration
- [ ] Migrate InstituteStudentsPage to DataTable
- [ ] Migrate InstituteFeesPage to DataTable
- [ ] Migrate InventoryPage to DataTable

### Day 14 — Design Cleanup
- [ ] Consolidate spacing scale → single 4px system
- [ ] Remove design-system.css redundant scale
- [ ] Audit all `--ds-space-*` usages → migrate to `--space-*`
- [ ] Standardize `isActive` across models (migration)

### Day 15 — Translation Completion
- [ ] Fill ar.json gaps (institute + parts sections)
- [ ] Fill zh.json gaps
- [ ] Fill ur.json gaps
- [ ] Add missing pluralization keys

---

## Sprint 4: Financial Precision (Days 16-20)

### Day 16-17 — Float → Decimal Migration
- [ ] Plan migration strategy (column-by-column)
- [ ] Create migration: Purchase, PurchaseItem amounts
- [ ] Create migration: Sale, SaleItem, SalesOrder amounts
- [ ] Create migration: Invoice, InvoiceItem, Payment amounts
- [ ] Update service layer calculations for Prisma Decimal type

### Day 18 — Schema Cleanup
- [ ] Remove deprecated Sale + SaleItem models (verify no references)
- [ ] Remove deprecated ExchangeRate model
- [ ] Merge IMEIRecord + IMEIHistory → IMEIEvent
- [ ] Remove duplicate columns on Purchase + CompanySettings

### Day 19-20 — Customer/Supplier Parity + Status Enums
- [ ] Add `isActive` + `currency` to Customer model
- [ ] Create Prisma enums for common statuses
- [ ] Migrate string status fields to enums (critical models first)
- [ ] Update frontend status filters to use enum values

---

## Sprint 5+: Feature Expansion (Weeks 5-8)
- Application/Admission workflow (InstituteApplication model)
- Certificate/transcript generation
- Communication layer (WhatsApp/email notifications)
- HTTP cache headers
- Virtual scrolling for large tables
- Per-tenant rate limiting
- API documentation completeness
- Test suite foundation

---

## Module Priority Order

1. **Institute Core** — Students, Courses, Batches, Enrollment (fix placeholders)
2. **Institute Academic** — Attendance, Exams, Results
3. **Shared Components** — DataTable, FormField, spacing unification
4. **Data Integrity** — Indexes, Float→Decimal, status enums, cleanup
5. **Institute Business** — Fees (installments, penalties), Payments (gateways)
6. **Institute Expansion** — Certificates, Application portal, Notifications
7. **Platform** — Testing, documentation, multi-region, mobile portal
