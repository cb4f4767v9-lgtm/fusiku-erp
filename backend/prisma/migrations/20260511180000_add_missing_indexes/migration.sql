-- Add missing critical indexes identified in the ERP audit.
-- These prevent full table scans on high-traffic join and filter columns.

-- PurchaseItem: join from Purchase detail view
CREATE INDEX IF NOT EXISTS "PurchaseItem_purchaseId_idx"
  ON "PurchaseItem" ("purchaseId");

-- SaleItem: join from Sale detail + inventory lookups
CREATE INDEX IF NOT EXISTS "SaleItem_saleId_idx"
  ON "SaleItem" ("saleId");
CREATE INDEX IF NOT EXISTS "SaleItem_inventoryId_idx"
  ON "SaleItem" ("inventoryId");

-- TransferItem: join from Transfer detail
CREATE INDEX IF NOT EXISTS "TransferItem_transferId_idx"
  ON "TransferItem" ("transferId");
CREATE INDEX IF NOT EXISTS "TransferItem_inventoryId_idx"
  ON "TransferItem" ("inventoryId");

-- Sale: branch, customer, status, date filtering
CREATE INDEX IF NOT EXISTS "Sale_branchId_idx"
  ON "Sale" ("branchId");
CREATE INDEX IF NOT EXISTS "Sale_customerId_idx"
  ON "Sale" ("customerId");
CREATE INDEX IF NOT EXISTS "Sale_status_idx"
  ON "Sale" ("status");
CREATE INDEX IF NOT EXISTS "Sale_createdAt_idx"
  ON "Sale" ("createdAt");

-- Payment: branch and date reporting
CREATE INDEX IF NOT EXISTS "Payment_branchId_idx"
  ON "Payment" ("branchId");
CREATE INDEX IF NOT EXISTS "Payment_paidAt_idx"
  ON "Payment" ("paidAt");

-- PhoneVariant: model lookups
CREATE INDEX IF NOT EXISTS "PhoneVariant_modelId_idx"
  ON "PhoneVariant" ("modelId");

-- ActivityLog: needs at least timestamp + userId for any useful query
CREATE INDEX IF NOT EXISTS "ActivityLog_timestamp_idx"
  ON "ActivityLog" ("timestamp");
CREATE INDEX IF NOT EXISTS "ActivityLog_userId_idx"
  ON "ActivityLog" ("userId");
