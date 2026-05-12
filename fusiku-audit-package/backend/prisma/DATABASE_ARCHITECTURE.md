# FUSIKU ERP — Database Architecture Design

## Overview

Professional ERP database schema for mobile phone refurbishing and trading, with IMEI tracking, multi-branch support, and financial intelligence.

**Design Principles:**
- Extends existing schema without breaking migrations
- Uses `cuid()` for IDs (consistent with existing)
- All new tables include `createdAt` / `updatedAt`
- Foreign keys with proper cascade/setNull behavior

---

## 1. IMEI Intelligence System

| Table | Purpose |
|-------|---------|
| `Inventory` (existing) | Primary device tracking by IMEI |
| `DeviceHistory` (new) | Full lifecycle audit trail |
| `DeviceGrade` (existing) | Grade definitions |

**Relationships:**
- `Inventory` → `Purchase` (via purchaseItems)
- `Inventory` → `Repair` (via imei)
- `Inventory` → `RefurbishJob` (via incomingDevice)
- `Inventory` → `Sale` (via SaleItem)
- `DeviceHistory` → `Inventory`

---

## 2. Smart Inventory System

| Table | Purpose |
|-------|---------|
| `Inventory` (existing) | Device inventory |
| `InventoryLocation` (new) | Warehouse zones/shelves |
| `StockMovement` (existing) | Stock transactions |
| `InventoryBatch` (new) | Batch/lot tracking |
| `InventoryPart` (new) | Parts, accessories, tools |

**Relationships:**
- `Inventory` → `Branch` → `InventoryLocation`
- `StockMovement` → `Inventory` / `InventoryPart`
- `InventoryBatch` → `Purchase`

---

## 3. Repair Management System

| Table | Purpose |
|-------|---------|
| `Repair` (existing) | Repair jobs |
| `RepairPart` (new) | Parts consumed |
| `User` (existing) | Technicians |

**Workflow States:** received → diagnosing → waiting_parts → repairing → testing → completed

---

## 4. Refurbishing Pipeline

| Table | Purpose |
|-------|---------|
| `RefurbishJob` (existing) | Refurbishment jobs |
| `RefurbishmentTest` (new) | Quality tests |
| `RefurbishmentResult` (new) | Test results |

---

## 5. Supplier & Purchasing System

| Table | Purpose |
|-------|---------|
| `Supplier` (existing) | Suppliers |
| `Purchase` (existing) | Purchase orders |
| `PurchaseItem` (existing) | Line items |
| `SupplierRating` (new) | Performance tracking |
| `PriceHistory` (new) | Price trends |

---

## 6. Multi-Branch System

| Table | Purpose |
|-------|---------|
| `Branch` (existing) | Branches |
| `Transfer` (existing) | Stock transfers |
| `TransferItem` (existing) | Transfer line items |
| `BranchPermission` (new) | User-branch access |

---

## 7. Financial Intelligence System

| Table | Purpose |
|-------|---------|
| `Sale` (existing) | Sales |
| `SaleItem` (existing) | Sale line items |
| `Expense` (new) | Operating expenses |
| `Payment` (new) | Payment tracking |
| `ProfitReport` (new) | Aggregated profit analytics |

---

## Entity Relationship Summary

```
Company ─┬─ Branch ─┬─ Inventory
         │          ├─ Transfer (from/to)
         │          └─ Sale
         ├─ Supplier ─ Purchase ─ PurchaseItem
         ├─ Customer ─ Sale, Repair
         └─ User (technician) ─ Repair, RefurbishJob

Inventory ─┬─ SaleItem
           ├─ StockMovement
           ├─ TransferItem
           └─ DeviceHistory

Repair ─ RepairPart ─ InventoryPart
RefurbishJob ─ RefurbishmentTest ─ RefurbishmentResult
```

---

## Total Tables (Existing + New)

| Category | Existing | New | Total |
|----------|----------|-----|-------|
| Core | 25 | 0 | 25 |
| IMEI/Devices | 2 | 1 | 3 |
| Inventory | 3 | 4 | 7 |
| Repairs | 1 | 1 | 2 |
| Refurbishing | 1 | 2 | 3 |
| Suppliers | 1 | 2 | 3 |
| Financial | 2 | 3 | 5 |
| Branch | 0 | 1 | 1 |
| **Total** | **35** | **14** | **~40** |
