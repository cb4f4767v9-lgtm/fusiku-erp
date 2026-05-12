# Power BI (Read-only) Integration

This backend exposes **SQL views** designed for BI tools (Power BI, Metabase, Looker Studio, etc.).

## Views created at startup

The API ensures these views exist on startup (best-effort, non-blocking):

- `sales_summary`
- `profit_analysis`
- `inventory_status`
- `branch_performance`

Implementation: `src/analytics/ensurePowerBiViews.ts` (runs after DB connect).

## Important notes (USD normalization)

These views use **best-effort USD**:

- Uses stored `*Usd` fields when present (`Invoice.totalAmountUsd`, `Invoice.profitUsd`, `Expense.amountUsd`, …)
- Falls back to raw amounts **only when currency is USD**

For fully normalized “effective USD” reporting (using FX snapshots + tenant currency rules), use the API report endpoints.

## Recommended Power BI DB user (read-only)

Create a read-only Postgres role and grant it access to views and tables.

Example (run as a DB admin):

```sql
CREATE ROLE powerbi_reader LOGIN PASSWORD 'REPLACE_ME_STRONG_PASSWORD';

GRANT CONNECT ON DATABASE fusiku_erp TO powerbi_reader;
GRANT USAGE ON SCHEMA public TO powerbi_reader;

-- Read-only tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO powerbi_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO powerbi_reader;
```

If you want stricter control, grant select only on the views + required dimension tables.

