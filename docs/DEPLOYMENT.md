# FUSIKU ERP – Cloud Deployment Guide

This guide covers deploying FUSIKU ERP to various cloud platforms and VPS environments.

---

## Quick Start: Docker

The fastest way to run FUSIKU ERP is with Docker Compose:

```bash
# From project root
docker-compose up -d
```

This starts:

- **PostgreSQL** (port 5432)
- **Redis** (port 6379)
- **Backend API** (port 3001)
- **Frontend** (port 80)

**Production checklist before `docker-compose up`:**

1. Set `JWT_SECRET` in the environment or `.env`
2. Use a strong `POSTGRES_PASSWORD` (override via env)
3. Ensure `backend_uploads` volume is backed up for file persistence

---

## AWS

### Option A: ECS (Fargate)

1. **Create ECR repositories** for backend and frontend images.
2. **Build and push images:**
   ```bash
   docker build -t fusiku-backend ./backend
   docker tag fusiku-backend:latest <account>.dkr.ecr.<region>.amazonaws.com/fusiku-backend:latest
   docker push <account>.dkr.ecr.<region>.amazonaws.com/fusiku-backend:latest
   ```
3. **RDS PostgreSQL:** Create a PostgreSQL instance and note the connection string.
4. **ElastiCache Redis:** Create a Redis cluster for jobs/caching.
5. **ECS Task Definition:** Define tasks for backend and frontend with env vars:
   - `DATABASE_URL` (RDS)
   - `REDIS_URL` (ElastiCache)
   - `JWT_SECRET`
   - `NODE_ENV=production`
6. **ECS Service:** Run tasks behind an Application Load Balancer.
7. **Storage:** Use EFS for shared `uploads` or configure S3 (see Storage section).

### Option B: EC2

1. **Launch EC2** (Ubuntu 22.04 LTS recommended).
2. **Install Docker & Docker Compose:**
   ```bash
   sudo apt update && sudo apt install -y docker.io docker-compose-plugin
   sudo usermod -aG docker ubuntu
   ```
3. **Clone repo** and copy `docker-compose.yml`.
4. **Create `.env`** with production values (see Environment Variables).
5. **Run:** `docker compose up -d`
6. **Security group:** Allow 80 (HTTP), 443 (HTTPS), 22 (SSH).
7. **Optional:** Use RDS and ElastiCache instead of containerized Postgres/Redis for production.

---

## DigitalOcean

### Option A: App Platform

1. **Connect GitHub** and select the FUSiku ERP repo.
2. **Backend component:**
   - Build: `cd backend && npm ci && npx prisma generate && npm run build`
   - Run: `node dist/index.js`
   - Add PostgreSQL and Redis add-ons (or use external).
   - Set env vars: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `NODE_ENV=production`.
3. **Frontend component:**
   - Build: `cd frontend && npm ci && npm run build`
   - Output: static files from `dist/`.
   - Set `VITE_API_URL` to the backend URL.
4. **Storage:** Use DigitalOcean Spaces (see Storage section).

### Option B: Droplet

1. **Create Droplet** (Ubuntu 22.04, 2GB RAM minimum).
2. **Install Docker & Compose:**
   ```bash
   sudo apt update && sudo apt install -y docker.io docker-compose-plugin
   ```
3. **Clone and deploy:**
   ```bash
   git clone <repo-url> fusiku-erp && cd fusiku-erp
   cp backend/src/config/env.example .env
   # Edit .env with production values
   docker compose up -d
   ```
4. **Managed DB (optional):** Create a PostgreSQL database and update `DATABASE_URL`.
5. **Managed Redis (optional):** Create a Redis cluster and set `REDIS_URL`.

---

## VPS (Generic)

For any Linux VPS (Linode, Vultr, Hetzner, etc.):

### 1. Environment Variables

Create `.env` in the project root:

```env
NODE_ENV=production
PORT=3001

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/fusiku_erp

# Redis (for jobs/caching)
REDIS_URL=redis://localhost:6379

# JWT – use a strong secret
JWT_SECRET=<generate-with-openssl-rand-hex-32>
JWT_EXPIRES=7d
JWT_REFRESH_EXPIRES=30d

# Optional
RATE_LIMIT_MAX=200
UPLOAD_PATH=/var/fusiku/uploads
CORS_ORIGIN=https://your-domain.com
```

### 2. Nginx Reverse Proxy

Example `/etc/nginx/sites-available/fusiku`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend (static)
    location / {
        proxy_pass http://127.0.0.1:80;  # or serve from /var/www/fusiku
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 10M;
    }

    # Uploads
    location /uploads/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/fusiku /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 3. Systemd (without Docker)

If running Node directly instead of Docker:

**Backend service** `/etc/systemd/system/fusiku-backend.service`:

```ini
[Unit]
Description=FUSIKU ERP Backend
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/fusiku-erp/backend
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
Environment=NODE_ENV=production
EnvironmentFile=/opt/fusiku-erp/.env

[Install]
WantedBy=multi-user.target
```

**Worker (optional)** `/etc/systemd/system/fusiku-worker.service`:

```ini
[Unit]
Description=FUSIKU ERP Worker
After=network.target redis.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/fusiku-erp/backend
ExecStart=/usr/bin/node dist/worker-entry.js
Restart=on-failure
Environment=NODE_ENV=production
EnvironmentFile=/opt/fusiku-erp/.env

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable fusiku-backend fusiku-worker
sudo systemctl start fusiku-backend fusiku-worker
```

---

## Storage

### Default: Local

By default, uploads are stored on the filesystem at `uploads/` (or `UPLOAD_PATH`). This works for single-instance deployments.

### Future: S3 / DigitalOcean Spaces

For multi-instance or scalable deployments, configure object storage:

- **AWS S3:** Set `STORAGE_PROVIDER=s3` and add `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET`.
- **DigitalOcean Spaces:** S3-compatible; use `STORAGE_PROVIDER=s3` with Spaces endpoint and credentials.

The backend config supports `STORAGE_PROVIDER` (`local` | `s3` | `spaces`). S3/Spaces integration can be added when needed.

---

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | `development` \| `production` | `development` |
| `PORT` | Backend port | `3001` |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `REDIS_URL` | Redis URL (optional, for jobs) | — |
| `JWT_SECRET` | JWT signing secret | Must change in prod |
| `JWT_EXPIRES` | Access token expiry | `7d` |
| `JWT_REFRESH_EXPIRES` | Refresh token expiry | `30d` |
| `UPLOAD_PATH` | Local upload directory | `uploads` |
| `STORAGE_PROVIDER` | `local` \| `s3` \| `spaces` | `local` |
| `CORS_ORIGIN` | Allowed origins | `true` (all) |
| `RATE_LIMIT_MAX` | Requests per window | `100` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (ms) | `900000` |

---

## Health Checks

- **API:** `GET /api/health` → `{ "status": "ok" }`
- **System health:** `GET /api/v1/system/health` (includes DB, Redis status)

---

## Backup

- **Database:** Use `pg_dump` or managed DB backups.
- **Uploads:** Back up the `uploads` directory or S3/Spaces bucket.
- **Redis:** Optional; job queues can be rebuilt. Persistence is useful for caching.
