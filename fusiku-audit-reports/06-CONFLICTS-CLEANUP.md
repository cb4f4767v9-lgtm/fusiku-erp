# Fusiku ERP — Cleanliness & Conflict Detection Report
**Generated:** 2026-05-11

---

## Duplicated Fields

| Concept | Locations | Action Needed |
|---------|-----------|---------------|
| `nationalId` vs `identityDocumentNumber` | InstituteStudent | Merge: deprecate nationalId, use typed identity |
| `baseCurrency` vs `currency` | CompanySettings | Remove one, keep `baseCurrency` |
| `exchangeRateAtTransaction` vs `exchangeRateAtPurchase` | Purchase | Remove alias column |
| `currency` vs `purchaseCurrency` | Purchase | Remove alias column |
| `brand/model/storage/color` as strings | Inventory, PurchaseItem, StockAlert, TACCache, DeviceSpec, MarketPrice | Consider FK to PhoneBrand/PhoneModel (long-term) |
| `imei` as string | 10 models | Acceptable denormalization for performance |

## Duplicated / Overlapping Models

| Models | Overlap | Recommendation |
|--------|---------|---------------|
| IMEIRecord vs IMEIHistory | Both track IMEI events; different field names (action vs actionType) | Merge into single IMEIEvent model |
| AuditLog vs ActivityLog | Both track user entity actions | Keep AuditLog (richer), deprecate ActivityLog |
| Sale/SaleItem vs Invoice/InvoiceItem | Near-identical structures, Sale marked deprecated | Complete migration to Invoice, remove Sale |
| ExchangeRate (deprecated) vs Currency | Same domain | Drop ExchangeRate model |

## Naming Inconsistencies

| Issue | Count | Resolution |
|-------|-------|-----------|
| `isActive` vs `active` | 9 vs 4 models | Standardize to `isActive` |
| Customer missing `isActive` | 1 model | Add `isActive` to Customer |
| Customer missing `currency` | 1 model | Add `currency` to Customer |
| `paidAt` vs `expenseDate` vs `date` | 3 patterns | Document intent; keep domain-specific names |

## Dead / Unused Code Candidates

| File/Pattern | Evidence |
|-------------|----------|
| `ExchangeRate` model | Marked @deprecated, no indexes |
| `Sale` / `SaleItem` models | Comment: "DEPRECATED — migrated to SalesOrder + Invoice" |
| `ActivityLog` model | Zero indexes, minimal query surface |
| `modules/` barrel files | 5 empty index.ts barrel files (placeholder extraction) |
| 3 redundant @@index entries | On fields that already have @unique |

## Architectural Conflicts

| Conflict | Severity | Details |
|----------|----------|---------|
| Two theme toggle systems | MEDIUM | ThemeContext vs utils/theme.ts — different localStorage keys, different DOM targets |
| Two spacing scales | LOW | tokens.css 4px vs design-system.css 8px |
| Float vs Decimal for money | HIGH | Institute uses Decimal correctly; 13 other financial models use Float |
| Status as String everywhere | MEDIUM | 17 models with freeform status — no enum, no validation |
| AttendanceModel without API | MEDIUM | Schema exists, routes/services missing — misleading |

## Translation Gaps

| Language | Approximate coverage vs English |
|----------|-------------------------------|
| Arabic (ar) | ~85% — missing: institute, parts, sourcing sections |
| Chinese (zh) | ~85% — same gaps |
| Urdu (ur) | ~85% — same gaps |
