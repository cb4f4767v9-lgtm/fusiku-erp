import type { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

function viewSql() {
  // NOTE: these views are “best-effort USD” using stored *Usd fields when present,
  // otherwise falling back to raw amounts only when currency is USD.
  // For “effective USD” (currency service normalization), use the API report endpoints.
  return `
CREATE OR REPLACE VIEW sales_summary_daily AS
SELECT
  i."companyId"                      AS company_id,
  i."branchId"                       AS branch_id,
  date_trunc('day', i."createdAt")   AS day,
  COUNT(*)                           AS invoices_count,
  COALESCE(SUM(COALESCE(i."totalAmountUsd", CASE WHEN upper(i."currency") = 'USD' THEN i."totalAmount" ELSE 0 END)), 0) AS sales_usd,
  COALESCE(SUM(COALESCE(i."profitUsd", CASE WHEN upper(i."currency") = 'USD' THEN i."profit" ELSE 0 END)), 0)        AS profit_usd
FROM "Invoice" i
WHERE i."status" <> 'void'
GROUP BY i."companyId", i."branchId", date_trunc('day', i."createdAt");

CREATE OR REPLACE VIEW sales_summary_monthly AS
SELECT
  i."companyId"                        AS company_id,
  i."branchId"                         AS branch_id,
  date_trunc('month', i."createdAt")   AS month,
  COUNT(*)                             AS invoices_count,
  COALESCE(SUM(COALESCE(i."totalAmountUsd", CASE WHEN upper(i."currency") = 'USD' THEN i."totalAmount" ELSE 0 END)), 0) AS sales_usd,
  COALESCE(SUM(COALESCE(i."profitUsd", CASE WHEN upper(i."currency") = 'USD' THEN i."profit" ELSE 0 END)), 0)        AS profit_usd
FROM "Invoice" i
WHERE i."status" <> 'void'
GROUP BY i."companyId", i."branchId", date_trunc('month', i."createdAt");

CREATE OR REPLACE VIEW sales_summary AS
SELECT
  i."companyId"                      AS company_id,
  i."branchId"                       AS branch_id,
  date_trunc('day', i."createdAt")   AS day,
  COUNT(*)                           AS invoices_count,
  COALESCE(SUM(COALESCE(i."totalAmountUsd", CASE WHEN upper(i."currency") = 'USD' THEN i."totalAmount" ELSE 0 END)), 0) AS sales_usd,
  COALESCE(SUM(COALESCE(i."profitUsd", CASE WHEN upper(i."currency") = 'USD' THEN i."profit" ELSE 0 END)), 0)        AS profit_usd
FROM "Invoice" i
WHERE i."status" <> 'void'
GROUP BY i."companyId", i."branchId", date_trunc('day', i."createdAt");

CREATE OR REPLACE VIEW profit_analysis AS
WITH sales AS (
  SELECT
    i."companyId" AS company_id,
    i."branchId"  AS branch_id,
    date_trunc('month', i."createdAt") AS month,
    COALESCE(SUM(COALESCE(i."profitUsd", CASE WHEN upper(i."currency") = 'USD' THEN i."profit" ELSE 0 END)), 0) AS gross_profit_usd
  FROM "Invoice" i
  WHERE i."status" <> 'void'
  GROUP BY i."companyId", i."branchId", date_trunc('month', i."createdAt")
),
expenses AS (
  SELECT
    e."companyId" AS company_id,
    COALESCE(e."branchId", '__unassigned__') AS branch_id,
    date_trunc('month', e."expenseDate") AS month,
    COALESCE(SUM(COALESCE(e."amountUsd", CASE WHEN upper(e."currency") = 'USD' THEN e."amount" ELSE 0 END)), 0) AS expenses_usd
  FROM "Expense" e
  GROUP BY e."companyId", COALESCE(e."branchId", '__unassigned__'), date_trunc('month', e."expenseDate")
)
SELECT
  s.company_id,
  s.branch_id,
  s.month,
  s.gross_profit_usd,
  COALESCE(x.expenses_usd, 0) AS expenses_usd,
  (s.gross_profit_usd - COALESCE(x.expenses_usd, 0)) AS net_profit_usd
FROM sales s
LEFT JOIN expenses x
  ON x.company_id = s.company_id
 AND x.branch_id = s.branch_id
 AND x.month = s.month;

CREATE OR REPLACE VIEW inventory_status AS
SELECT
  inv."companyId" AS company_id,
  inv."branchId"  AS branch_id,
  inv."status"    AS status,
  COUNT(*)        AS items_count,
  COALESCE(SUM(inv."sellingPrice"), 0) AS total_selling_value,
  COALESCE(SUM(COALESCE(inv."costUsd", inv."purchasePrice")), 0) AS total_cost_usd_best_effort
FROM "Inventory" inv
GROUP BY inv."companyId", inv."branchId", inv."status";

CREATE OR REPLACE VIEW inventory_aging AS
SELECT
  inv."companyId" AS company_id,
  inv."branchId"  AS branch_id,
  inv."status"    AS status,
  inv."brand"     AS brand,
  inv."model"     AS model,
  inv."imei"      AS imei,
  inv."createdAt" AS created_at,
  GREATEST(0, CAST(EXTRACT(EPOCH FROM (now() - inv."createdAt")) / 86400 AS INT)) AS age_days,
  COALESCE(inv."costUsd", inv."purchasePrice") AS cost_usd_best_effort,
  inv."sellingPrice" AS selling_price
FROM "Inventory" inv;

CREATE OR REPLACE VIEW profit_analysis_product AS
SELECT
  inv."companyId" AS company_id,
  inv."branchId"  AS branch_id,
  date_trunc('month', i."createdAt") AS month,
  inv."brand"     AS brand,
  inv."model"     AS model,
  COUNT(*)        AS items_sold,
  COALESCE(SUM(COALESCE(ii."revenueUsd", i."totalAmountUsd", CASE WHEN upper(i."currency")='USD' THEN i."totalAmount" ELSE 0 END)), 0) AS revenue_usd_best_effort,
  COALESCE(SUM(COALESCE(ii."costUsdUsed", inv."costUsd", inv."purchasePrice")), 0) AS cost_usd_best_effort,
  COALESCE(SUM(COALESCE(ii."profitUsd", i."profitUsd", CASE WHEN upper(i."currency")='USD' THEN i."profit" ELSE 0 END)), 0) AS profit_usd_best_effort
FROM "InvoiceItem" ii
JOIN "Invoice" i ON i."id" = ii."invoiceId"
LEFT JOIN "Inventory" inv ON inv."id" = ii."inventoryId"
WHERE i."status" <> 'void'
GROUP BY inv."companyId", inv."branchId", date_trunc('month', i."createdAt"), inv."brand", inv."model";

CREATE OR REPLACE VIEW branch_performance AS
WITH month_sales AS (
  SELECT
    i."companyId" AS company_id,
    i."branchId"  AS branch_id,
    date_trunc('month', i."createdAt") AS month,
    COALESCE(SUM(COALESCE(i."totalAmountUsd", CASE WHEN upper(i."currency") = 'USD' THEN i."totalAmount" ELSE 0 END)), 0) AS sales_usd,
    COALESCE(SUM(COALESCE(i."profitUsd", CASE WHEN upper(i."currency") = 'USD' THEN i."profit" ELSE 0 END)), 0) AS profit_usd
  FROM "Invoice" i
  WHERE i."status" <> 'void'
  GROUP BY i."companyId", i."branchId", date_trunc('month', i."createdAt")
),
month_expenses AS (
  SELECT
    e."companyId" AS company_id,
    e."branchId"  AS branch_id,
    date_trunc('month', e."expenseDate") AS month,
    COALESCE(SUM(COALESCE(e."amountUsd", CASE WHEN upper(e."currency") = 'USD' THEN e."amount" ELSE 0 END)), 0) AS expenses_usd
  FROM "Expense" e
  WHERE e."branchId" IS NOT NULL
  GROUP BY e."companyId", e."branchId", date_trunc('month', e."expenseDate")
)
SELECT
  b."companyId" AS company_id,
  b."id"        AS branch_id,
  b."name"      AS branch_name,
  s.month,
  s.sales_usd,
  s.profit_usd,
  COALESCE(x.expenses_usd, 0) AS expenses_usd,
  (s.profit_usd - COALESCE(x.expenses_usd, 0)) AS net_profit_usd
FROM "Branch" b
JOIN month_sales s ON s.branch_id = b."id" AND s.company_id = b."companyId"
LEFT JOIN month_expenses x ON x.branch_id = b."id" AND x.company_id = b."companyId" AND x.month = s.month;
`;
}

export async function ensurePowerBiViews(prismaLike: PrismaClient): Promise<void> {
  const sql = viewSql();
  try {
    // Split statements for safer execution with drivers that dislike multi-statement.
    const statements = sql
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (s.endsWith(';') ? s : `${s};`));

    for (const stmt of statements) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prismaLike as any).$executeRawUnsafe(stmt);
    }
    logger.info('[analytics] PowerBI views ensured');
  } catch (err) {
    // Never block startup; views can be applied later via maintenance job.
    logger.warn({ err }, '[analytics] Failed to ensure PowerBI views');
  }
}

