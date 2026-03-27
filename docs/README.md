# FUSIKU ERP Documentation

**Think Smart. Play Cool.**

## Overview

FUSIKU ERP is an enterprise resource planning system for mobile phone refurbishing and trading companies with multiple branches.

## Architecture

```
User
  │
  ├── Desktop App (Electron)
  ├── Web App (React/Vite)
  └── Future Mobile
        │
    API Gateway (Node.js + Express)
        │
    Services Layer
        │
    Prisma ORM
        │
    PostgreSQL
```

## Modules

- **Dashboard** - Overview metrics and recent sales
- **Inventory** - IMEI-tracked device stock with Excel import
- **Purchases** - Purchase orders with supplier tracking
- **Suppliers** - Supplier management
- **POS** - Fast point-of-sale with IMEI scanning
- **Repairs** - Phone repair tracking
- **Refurbishing** - Refurbishment workflow
- **Reports** - Sales and inventory reports
- **Settings** - User and branch settings

## API Endpoints

| Module | Endpoints |
|--------|-----------|
| Auth | POST /api/auth/login, /api/auth/register |
| Users | CRUD /api/users |
| Branches | CRUD /api/branches |
| Inventory | CRUD /api/inventory, GET /api/inventory/imei/:imei |
| IMEI | GET /api/imei/check/:imei, POST /api/imei/record |
| Suppliers | CRUD /api/suppliers |
| Purchases | GET/POST /api/purchases |
| POS | POST /api/pos/sale, GET /api/pos/receipt/:id |
| Repairs | CRUD /api/repairs |
| Refurbish | CRUD /api/refurbish |
| Reports | GET /api/reports/dashboard, /sales, /inventory |
| Import | POST /api/import/inventory, /suppliers, /purchases |

## Excel Import Format

### Inventory
Columns: imei, brand, model, storage, color, condition, purchase_price, selling_price

### Suppliers
Columns: name, contact, email, phone, address

### Purchases
Columns: imei, brand, model, storage, color, condition, price
