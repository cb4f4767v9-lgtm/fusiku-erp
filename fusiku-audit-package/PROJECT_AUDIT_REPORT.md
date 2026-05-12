# Fusiku ERP — Project Audit Report (External Review Package)

Date: 2026-05-08  
Repo: `fusiku-erp`  
Audit type: **Read-only scan + architecture review** (no code changes performed as part of this report)

---

## 1) Project overview

Fusiku ERP is a multi-tenant ERP/SaaS product targeting phone/mobile businesses (and additional verticals like **Institute**). It includes:

- **Frontend**: React + TypeScript, Tailwind + custom CSS layers, React Router
- **Backend**: Node.js + Express, Prisma ORM, PostgreSQL
- **Desktop**: a `desktop/` package (packaging shell; details depend on build configuration)

High-level goals implied by the schema and routes:
- Inventory, IMEI/device lifecycle tracking
- Purchasing → stock movements/transfers → sales → payments → reporting
- Multi-branch operation
- Multi-currency viewing (ledger appears USD pivot with UI conversion)
- SaaS onboarding: setup wizard, plans, trials, subscription enforcement

---

## 2) Core modules identified

### Backend (Prisma-driven domain)
From `backend/prisma/schema.prisma`:

- **Tenant / SaaS**
  - `Company`, `CompanySettings`, `SetupProfile`
  - `SubscriptionPlan`, `Subscription`, `CompanyUsage`
- **Multi-branch**
  - `Branch` (relation exists via `Company.branches`)
- **Inventory & IMEI**
  - `Inventory`, `InventoryPart`, `IMEIRecord`, `IMEIHistory`, `DeviceHistory`
- **Purchasing / Sales / Payments**
  - `Purchase`, `Sale`, `Invoice`, `Payment`, `SalesOrder`
- **Stock movement**
  - `Transfer`, `StockMovement`, `StockAlert`, `Warranty`
- **Forex / Currency**
  - `Currency`, `CurrencyHistory`, `ExchangeRateHistory`, `SupplierFxRate`
- **Repairs / Refurb**
  - `Repair`, `RefurbishJob`
- **Institute vertical**
  - `InstituteStudent`, `InstituteCourse`, `InstituteBatch`, `InstituteAttendance`, `InstituteFeeCharge`
- **Observability / integrations**
  - `IntegrationLog`, `Webhook`, `ApiKey`, `Translation`

### Frontend (UI shell + flows)
Key pages present:
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/SignupVerifyPage.tsx` (OTP verify for signup)
- `frontend/src/pages/SetupWizardPage.tsx`
- `frontend/src/pages/PricingPage.tsx`
- `frontend/src/pages/DashboardPage.tsx`

Primary shell:
- `frontend/src/layouts/Layout.tsx` (sidebar + topbar + routing outlet)

Styles:
- `frontend/src/styles/login.css` (auth-specific)
- `frontend/src/styles/final.css` (app-wide override layer; dark-glass system + layout polish)
- plus `layout.css`, `components.css`, `design-system.css`, `tokens.css`

---

## 3) Business logic audit (what exists + what to verify)

This section maps the **intended** business logic to observable code/schema signals. A full verification requires endpoint-by-endpoint walkthrough and test data runs.

### Inventory system (IMEI / parts / tools)
**Evidence**
- Schema has `Inventory`, `InventoryPart`, `IMEIRecord`, `IMEIHistory`, `DeviceHistory`
- Suggests per-device lifecycle and audit trail capabilities

**Audit checks**
- IMEI uniqueness per company/branch and sale constraints
- Device status transitions: purchased → in stock → transferred → sold → returned/warranty
- Parts catalog / spare parts mapping (presence of master tables like `MasterSparePart`, `MasterToolBrand`)

### Currency conversion (RMB → AED → others)
**Evidence**
- `CompanySettings.baseCurrency` (reporting currency), `Currency`, `ExchangeRateHistory`, `SupplierFxRate`
- Frontend has `useCurrency` context (seen in dashboard page)

**Audit checks**
- Confirm “ledger base USD pivot” vs “company base currency” policy
- Confirm conversion is deterministic for reporting (historical rates locked) vs live rates for viewing
- Confirm spread handling (`spreadBps`) and buy/sell rate display rules

### Costing method (FIFO/LIFO) + profit locking
**Evidence**
- `CompanySettings.pricingMethod` default `"FIFO"`
- `pricingLocked` / `pricingLockedAt` flags in `CompanySettings`

**Audit checks**
- Identify where inventory costing is applied (sale posting pipeline)
- Confirm historical sales are not recalculated (profit locking semantics)
- Verify whether LIFO is implemented, or only FIFO is supported today

### Multi-branch workflow
**Evidence**
- `Company.branches`, `Transfer`, `StockMovement`, `Branch` references

**Audit checks**
- Access control: per-branch restrictions vs global
- Transfer pipeline: draft → shipped → received; stock movements and audit trails

### Purchase → transfer → sale → payment lifecycle
**Evidence**
- Schema includes `Purchase`, `Transfer`, `Sale`, `Payment`, `Invoice`

**Audit checks**
- Ensure payments link correctly to invoices/sales orders
- Support for advance/credit sales (partial payments, outstanding balances)
- Refund/return and warranty flows (if present)

### Reporting (daily/monthly/yearly)
**Evidence**
- Frontend calls `reportsApi.getDashboard()` and `getMonthlyRevenue()` from dashboard
- Schema includes `ProfitReport`

**Audit checks**
- Validate reporting correctness under multi-currency + transfers + returns
- Define “source of truth” for KPIs (computed vs materialized)

---

## 4) UI/UX audit (high-level)

### Login + OTP
- Login page uses a premium glass aesthetic with clear hierarchy and value props.
- Signup OTP verify page (`SignupVerifyPage.tsx`) includes resend logic with cooldown and user feedback.

### Setup wizard
- Uses “glass card” selection patterns and multi-select components (country picker).
- Primary risk: visual consistency across dark/light and interaction states.

### Pricing
- Premium styling, billing cycle toggles, “coming soon” yearly state.
- Needs strict visual parity with the main app shell primitives (button/input/card consistency).

### Dashboard + shell (sidebar/topbar/content)
- `Layout.tsx` defines sidebar/topbar and route outlet.
- Styling depends on a layered CSS approach; `final.css` is the override authority.
- Floating chat was moved to layout root to avoid clipping by route containers.

---

## 5) Data & system flow (conceptual map)

### Purchasing flow
1. Create purchase (supplier, items/devices, costs)
2. Stock increases → stock movement records
3. Optional: tag IMEI/devices into inventory records

### Stock transfer flow
1. Create transfer between branches
2. Deduct from source branch inventory
3. Receive into destination branch inventory
4. Audit in `StockMovement` / `DeviceHistory`

### Sales flow
1. Create sale (POS/sales order)
2. Allocate inventory lots/devices (costing method applied)
3. Profit computed and persisted (should not change retroactively)

### Payment flow
1. Payment captured (cash/card/bank/credit)
2. Links to sale/invoice; supports partial/advance if implemented
3. Updates receivables and reporting

### Reporting flow
1. Pull from sales/payments/inventory movements
2. Aggregate into dashboard KPIs and profit reports

---

## 6) Feature gaps / completeness risks

Likely gaps to validate (based on signals + typical ERP complexity):

- **Costing completeness**: FIFO default present; LIFO may not be fully implemented everywhere.
- **Historical rate locking**: multi-currency reporting can drift if live rates are used for historical KPIs.
- **Return/refund workflows**: often missing or partial in early ERP builds.
- **AI insights**: present as UI/placeholder; validate if actual backend analytics exist.
- **Mobile/Desktop sync**: presence of offline cache hints; validate conflict resolution strategy.
- **Table clarity**: consistent column alignment, empty states, and density across modules.

---

## 7) Architecture review (scalability & SaaS readiness)

### Frontend
- Strength: clean routing and modular page structure; dedicated layout shell.
- Risk: mixed styling paradigms (Tailwind vs multiple CSS layers) creates “override wars” and slows redesign.

### Backend
- Strength: Prisma schema suggests broad module coverage; SaaS constructs exist (plans/subscriptions/settings).
- Risk: large domain surface area requires strong boundaries (services/controllers), consistent validation, and a robust permission model.

### Multi-tenancy & security
- Ensure every query is tenant-scoped (companyId/branchId) and covered by middleware guards.
- Ensure audit trails for sensitive operations (stock movements, payments, pricing locks).

---

## 8) SaaS readiness score (/10)

These are directional scores for planning, not marketing claims:

- **UI quality**: 7.5/10 (strong auth pages; app shell improved; consistency work remains)
- **Logic completeness**: 7/10 (schema suggests completeness; correctness must be validated with scenario testing)
- **Scalability**: 6.5/10 (depends on tenant scoping, query/indexing, reporting strategy)
- **Market readiness**: 6.5/10 (strong base; needs consistency + reporting polish + robust edge cases)

---

## 9) Critical issues to watch

- **Style drift** across pages: Tailwind glass vs app-shell CSS primitives.
- **Light mode** partially supported; decide whether to fully support or position as secondary.
- **Enterprise correctness risks**: costing, currency, returns, multi-branch transfers require careful validation.
- **Performance**: dashboard/reporting endpoints need caching/indexing as tenant data grows.

---

## 10) Improvement roadmap

### High priority (0–2 weeks)
- Scenario-test the full purchase → transfer → sale → payment lifecycle with multi-branch and multi-currency.
- Standardize UI primitives: Card, Button, Input, EmptyState, Table.
- Consolidate style tokens; reduce duplicated CSS rules.

### Medium (2–6 weeks)
- Robust permissions + audit logs
- Reporting reliability: daily/monthly/yearly with locked historical rates and locked costing
- Return/refund/warranty completeness

### Future
- Real AI insights pipeline (not just UI)
- Desktop/offline sync hardening (conflicts, retries, observability)

