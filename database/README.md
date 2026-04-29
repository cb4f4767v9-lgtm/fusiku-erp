# Database

The **only** Prisma schema for this project is:

`backend/prisma/schema.prisma`

Do not duplicate schema files here — this folder only holds documentation.

## Setup

1. Create a PostgreSQL database.
2. Copy `backend/.env.example` to `backend/.env` (or configure Electron `runtime-config.json` for desktop).
3. Set `DATABASE_URL` in that file.
4. From repo root: `npm run db:deploy` (or `cd backend && npx prisma migrate deploy`).
5. Seed: `cd backend && npm run db:seed` as needed.
