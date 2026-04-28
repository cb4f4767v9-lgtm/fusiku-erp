import type { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Safe, minimal indexes for BI queries. Best-effort: never blocks startup.
const statements = [
  // Invoice time-series (sales_summary_* / profit_analysis_product)
  `CREATE INDEX IF NOT EXISTS idx_invoice_company_branch_createdat ON "Invoice" ("companyId","branchId","createdAt");`,
  `CREATE INDEX IF NOT EXISTS idx_invoice_company_createdat ON "Invoice" ("companyId","createdAt");`,
  // InvoiceItem joins to Inventory
  `CREATE INDEX IF NOT EXISTS idx_invoiceitem_invoiceid ON "InvoiceItem" ("invoiceId");`,
  `CREATE INDEX IF NOT EXISTS idx_invoiceitem_inventoryid ON "InvoiceItem" ("inventoryId");`,
  // Expense time-series
  `CREATE INDEX IF NOT EXISTS idx_expense_company_branch_date ON "Expense" ("companyId","branchId","expenseDate");`,
  `CREATE INDEX IF NOT EXISTS idx_expense_company_date ON "Expense" ("companyId","expenseDate");`,
  // Inventory aging
  `CREATE INDEX IF NOT EXISTS idx_inventory_company_branch_createdat ON "Inventory" ("companyId","branchId","createdAt");`,
  `CREATE INDEX IF NOT EXISTS idx_inventory_company_branch_status ON "Inventory" ("companyId","branchId","status");`,
  `CREATE INDEX IF NOT EXISTS idx_inventory_company_brand_model ON "Inventory" ("companyId","brand","model");`,
];

export async function ensureAnalyticsIndexes(prismaLike: PrismaClient): Promise<void> {
  try {
    for (const stmt of statements) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prismaLike as any).$executeRawUnsafe(stmt);
    }
    logger.info('[analytics] indexes ensured');
  } catch (err) {
    logger.warn({ err }, '[analytics] failed to ensure indexes');
  }
}

