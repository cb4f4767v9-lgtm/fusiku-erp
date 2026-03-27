# FUSIKU ERP — Installation Guide

**Think Smart. Play Cool.**

## Quick Install (One Command)

```bash
bash scripts/install.sh
```

Then start the application:

```bash
npm run dev
```

Open http://localhost:5173 and complete the setup wizard at `/setup`.

---

## Prerequisites

- **Node.js** 18+ (required)
- **PostgreSQL** 14+ (required)
- **Docker** (optional, for containerized deployment)
- **Redis** (optional, for background job queue)

---

## Local Installation

### 1. Clone and Install

```bash
git clone <repository-url>
cd fusiku-erp
bash scripts/install.sh
```

### 2. Configure Database

Edit `backend/.env`:

```
DATABASE_URL="postgresql://user:password@localhost:5432/fusiku_erp"
JWT_SECRET="your-secure-secret-key"
PORT=3001
```

### 3. Initialize Database (if not done by install script)

```bash
cd backend
npx prisma generate
npx prisma db push
npx prisma db seed
```

### 4. Start Development Server

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

### 5. First-Time Setup

1. Open http://localhost:5173/setup
2. Enter company name, admin email, admin password, branch name, currency
3. Click "Complete Setup"
4. Log in with your admin credentials

---

## Docker Installation

### Using Docker Compose

```bash
docker-compose up -d --build
```

- Frontend: http://localhost (port 80)
- Backend API: http://localhost:3001
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### Environment Variables

Create `.env` in project root:

```
JWT_SECRET=your-secure-secret-key
DATABASE_URL=postgresql://fusiku:fusiku_secret@postgres:5432/fusiku_erp
REDIS_URL=redis://redis:6379
```

---

## Production Deployment

### 1. Build

```bash
npm run build
```

### 2. Run Migrations

```bash
npm run migrate
```

### 3. Start Production Server

```bash
npm run start:prod
```

Or run backend separately:

```bash
cd backend && npm run start
```

Serve frontend static files with nginx or your preferred web server.

### 4. AWS / DigitalOcean / VPS

- Use the Docker setup for containerized deployment
- Ensure PostgreSQL and Redis are available (or use managed services)
- Set `NODE_ENV=production`
- Configure reverse proxy (nginx) for HTTPS
- Set secure `JWT_SECRET` and `DATABASE_URL`

---

## Optional: Demo Data

Add sample inventory, repairs, and customers:

```bash
npm run seed:demo
```

Login: demo@fusiku.com / demo123

---

## Admin Password Reset

```bash
npm run reset-admin -- admin@example.com newpassword
```

---

## Verification

Check system readiness:

```bash
curl http://localhost:3001/api/v1/system/check
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Database connection failed | Verify PostgreSQL is running, check DATABASE_URL |
| Port already in use | Change PORT in .env or stop conflicting process |
| Setup wizard doesn't show | Ensure no companies exist; run seed then visit /setup |
| 401 on auth | Check JWT_SECRET is set |
