# FUSIKU ERP - Cloud Deployment Guide

**Think Smart. Play Cool.**

## Supported Platforms

- **AWS** (EC2, ECS, Elastic Beanstalk)
- **DigitalOcean** (Droplets, App Platform)
- **VPS** (Any Linux VPS with Docker)

## Quick Start with Docker

```bash
docker-compose up -d
```

Access: http://localhost (frontend) | http://localhost:3001 (API)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | development / staging / production | development |
| PORT | Backend port | 3001 |
| DATABASE_URL | PostgreSQL connection string | - |
| REDIS_URL | Redis for jobs (optional) | - |
| JWT_SECRET | JWT signing secret | - |
| RATE_LIMIT_MAX | Max requests per window | 100 |

## AWS Deployment

1. **EC2**: Launch Ubuntu 22.04, install Docker, clone repo, run `docker-compose up -d`
2. **RDS**: Use for PostgreSQL (update DATABASE_URL)
3. **ElastiCache**: Use for Redis (update REDIS_URL)
4. **S3**: Future - configure STORAGE_PROVIDER=s3 for file uploads

## DigitalOcean Deployment

1. **App Platform**: Connect GitHub, set build command `npm run build`, start command `npm run start`
2. **Droplet**: Same as VPS - Docker recommended
3. **Managed Database**: PostgreSQL add-on
4. **Spaces**: Future - for cloud storage

## Storage Abstraction

The system supports `STORAGE_PROVIDER`:

- `local` (default): Files in ./uploads
- `s3`: AWS S3 (future)
- `spaces`: DigitalOcean Spaces (future)

Extend `backend/src/services/storage.service.ts` for cloud providers.
