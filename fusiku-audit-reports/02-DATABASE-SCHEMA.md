# Fusiku ERP — Database Schema Report
**Generated:** 2026-05-11

---

## Summary

| Metric | Value |
|--------|-------|
| Total models | 107 |
| Enums | 5 (UserBranchRole, 4 PartCatalog enums) |
| Explicit indexes | 134 |
| Migrations | 6 |
| Domains | 15 |

## Domain Model Distribution

| Domain | Models | Key Tables |
|--------|--------|-----------|
| Company & SaaS | 7 | Company, CompanySettings, Subscription, SubscriptionPlan |
| Auth & Access | 7 | User, Role, Permission, RolePermission, TrustedDevice |
| Branch | 2 | Branch, BranchContact |
| Supplier | 4 | Supplier, SupplierContact, SupplierFxRate |
| Customer | 2 | Customer, CustomerContact |
| Device Catalog | 10 | PhoneBrand, PhoneModel, PhoneVariant, DeviceSpec |
| Master Data | 9 | MasterCategory, MasterSparePart, StorageSize, etc. |
| Inventory | 11 | Inventory, IMEIRecord, StockMovement, InventoryPart |
| Purchases | 3 | Purchase, PurchaseItem, PriceHistory |
| Sales (Legacy) | 4 | Sale, SaleItem, SalesOrder, SalesOrderItem |
| Invoicing | 7 | Invoice, InvoiceItem, Payment, Quotation, PricingRule, Warranty |
| Repairs | 5 | Repair, RepairPart, RefurbishJob, Tests, Results |
| Financial / FX | 9 | Currency, Expense, Investor, ProfitReport |
| Institute | 6 | Student, Course, Batch, Enrollment, FeeCharge, Attendance |
| Part Catalog | 6 | Series, Category (tree), Item, Compatibility, Suggestion |
| Communication | 2 | ChatRoom, ChatMessage |
| Localization | 1 | Translation |
| Logging | 3 | AuditLog, ActivityLog, Incident |
| Integration | 7 | ApiKey, Webhook, IntegrationLog, FileUpload, Marketplace |

## Critical Issues Found

### 1. Missing indexes (16 critical)

| Model | Missing Index | Impact |
|-------|--------------|--------|
| PurchaseItem | purchaseId | Table scan on every purchase detail load |
| SaleItem | saleId, inventoryId | Table scan on every sale detail |
| TransferItem | transferId, inventoryId | Table scan on transfer details |
| ActivityLog | ALL fields (zero indexes) | Every query is full table scan |
| Sale | branchId, customerId, status, createdAt | Only companyId indexed |
| Payment | branchId, paidAt | Branch/date reporting unindexed |
| PhoneVariant | modelId | Model→variant lookups scan |

### 2. Float for money (13 models)

All financial models EXCEPT Institute use IEEE 754 Float for monetary amounts. Precision errors accumulate. Institute correctly uses Decimal(18,4). Schema has TODO comments for migration.

**Affected:** Purchase, Sale, SalesOrder, Invoice, Expense, Investor, Payment, Inventory, ProfitReport

### 3. Redundant columns

| Model | Columns | Issue |
|-------|---------|-------|
| CompanySettings | baseCurrency + currency | Same meaning, both default "USD" |
| Purchase | exchangeRateAtTransaction + exchangeRateAtPurchase | Acknowledged as alias |
| Purchase | currency + purchaseCurrency | Same meaning |
| InstituteStudent | nationalId + identityDocumentNumber | Dual identity stores |

### 4. Naming inconsistencies

| Pattern | Models using it |
|---------|----------------|
| `isActive` | Company, Branch, Supplier, User, InventoryPart (9 total) |
| `active` | InstituteCourse, Investor, SubscriptionPlan, PricingRule (4 total) |
| **Missing isActive** | Customer (cannot soft-delete customers) |
| **Missing currency** | Customer (Supplier has one) |

### 5. Redundant @@index on @unique fields

TACCache(tac), ApiKey(key), Inventory(imei) — 3 instances

### 6. Status fields — no type safety

17 models store status as freeform String. No enum constraints.

## Migration History

| # | Date | Name | Scope |
|---|------|------|-------|
| 1 | 2026-05-06 | vertical_modules_foundation | Full schema creation (~2580 lines SQL) |
| 2 | 2026-05-06 | setup_profile_business_types | Add businessTypes JSON to SetupProfile |
| 3 | 2026-05-09 | institute_production_v1 | Institute Decimal money, companyId on enrollment |
| 4 | 2026-05-10 | institute_student_profile_fields | 17 student profile columns |
| 5 | 2026-05-10 | institute_timing_identity_enrollment | Identity, timing, enrollment dates |
| 6 | 2026-05-10 | branch_institute_currency_fields | 3 institute currency overrides on Branch |
