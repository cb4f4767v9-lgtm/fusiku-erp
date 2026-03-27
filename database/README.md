# FUSIKU ERP Database

This folder contains the Prisma schema reference. The actual schema lives in `backend/prisma/schema.prisma`.

## Setup

1. Create a PostgreSQL database
2. Copy `backend/.env.example` to `backend/.env`
3. Set `DATABASE_URL` in `.env`
4. Run from project root: `npm run db:push`
5. Seed: `npm run db:seed`
