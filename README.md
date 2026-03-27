# FUSIKU ERP

**Think Smart. Play Cool.**

Enterprise ERP system for mobile phone refurbishing and trading companies with multiple branches.

## Tech Stack

- **Backend:** Node.js, Express.js, PostgreSQL, Prisma ORM
- **Frontend:** React, Vite, TypeScript
- **Desktop:** Electron
- **Auth:** JWT, bcrypt, role-based access control

## Quick Start

```bash
# Install all dependencies
npm run install:all

# Setup database (requires PostgreSQL running)
# 1. Create database: CREATE DATABASE fusiku_erp;
# 2. Copy backend/.env.example to backend/.env
# 3. Set DATABASE_URL in .env

npm run db:push
npm run db:seed

# Start development
npm run dev
```

- **Web:** http://localhost:5173
- **API:** http://localhost:3001

**Default login:** admin@fusiku.com / admin123

## Project Structure

```
fusiku-erp/
├── backend/       # Express API
├── frontend/      # React/Vite app
├── desktop/       # Electron wrapper
├── database/      # Schema reference
├── docs/          # Documentation
└── scripts/       # Install scripts
```

## Modules

| Module | Description |
|--------|-------------|
| Dashboard | Overview metrics, recent sales |
| Inventory | IMEI tracking, Excel import |
| Purchases | Purchase orders |
| Suppliers | Supplier management |
| POS | Point of sale, IMEI scanning |
| Repairs | Repair tracking |
| Refurbishing | Refurbishment workflow |
| Reports | Sales & inventory reports |
| Settings | Users, branches |

## License

Proprietary
