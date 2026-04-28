# Power BI Dashboard Blueprint (Fusiku ERP)

Use the SQL views ensured by the backend (see `docs/POWERBI.md`):

## Dataset / model (star schema)

### Facts (import or DirectQuery)
- **`sales_summary_daily`**: day-level sales + profit (best-effort USD)
- **`sales_summary_monthly`**: month-level sales + profit (best-effort USD)
- **`branch_performance`**: month + branch P&L (profit, expenses, net)
- **`profit_analysis_product`**: month + product profitability
- **`inventory_aging`**: row-level aging for dead-stock analysis

### Dimensions
- **`Branch`**: `id`, `name`, `companyId`
- Optional: **Product dimension** built from `Inventory` (`brand`, `model`) for slicers

### Relationships (recommended)
- `sales_summary_daily.branch_id` → `Branch.id`
- `sales_summary_monthly.branch_id` → `Branch.id`
- `branch_performance.branch_id` → `Branch.id`
- `profit_analysis_product.branch_id` → `Branch.id`

Use `company_id` as a row-level security (RLS) key if you have multi-tenant BI.

## Dashboard 1: Daily Profit (Owner view)

**Primary visuals**
- Line chart: `sales_summary_daily.day` vs `sales_usd`
- Line chart: `sales_summary_daily.day` vs `profit_usd`
- KPI cards:
  - Sales (last 7d)
  - Profit (last 7d)
  - Profit Margin % (last 7d)

**Measures (DAX examples)**
- Sales 7d:
  - `Sales 7d = CALCULATE(SUM(sales_summary_daily[sales_usd]), DATESINPERIOD(sales_summary_daily[day], MAX(sales_summary_daily[day]), -7, DAY))`
- Profit 7d:
  - `Profit 7d = CALCULATE(SUM(sales_summary_daily[profit_usd]), DATESINPERIOD(sales_summary_daily[day], MAX(sales_summary_daily[day]), -7, DAY))`
- Margin % 7d:
  - `Margin % 7d = DIVIDE([Profit 7d], [Sales 7d])`

**Filters**
- Branch slicer (optional)
- Date range slicer (default last 30 days)

## Dashboard 2: Branch Performance Comparison

**Primary visuals**
- Matrix: `branch_name` x `month` with `net_profit_usd`, `sales_usd`, `expenses_usd`
- Bar chart: `branch_name` vs `net_profit_usd` (latest month)
- Waterfall: `profit_usd` − `expenses_usd` = `net_profit_usd`

**Source**
- `branch_performance`

## Dashboard 3: Top-Selling Products

**Primary visuals**
- Table: `brand`, `model`, `items_sold`, `revenue_usd_best_effort`, `profit_usd_best_effort`
- Bar chart: `brand model` vs `items_sold`
- Scatter: `items_sold` vs `profit_usd_best_effort`

**Source**
- `profit_analysis_product`

## Dashboard 4: Inventory Aging / Dead Stock

**Primary visuals**
- Histogram: `age_days` buckets (0–30, 31–60, 61–90, 90+)
- Table: oldest devices (brand/model/imei/age_days/cost/selling)
- KPI cards:
  - Count of items \(age_days >= 90\)
  - “dead stock value” (sum of cost_usd_best_effort where age_days >= 90)

**Source**
- `inventory_aging`

## Notes
- These views are **best-effort USD** (uses stored USD fields when present; falls back to raw only when currency is USD).
- For “effective USD” (FX-normalized), use backend report endpoints and import those results into BI if needed.

