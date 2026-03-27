#!/usr/bin/env bash
# FUSIKU ERP - One-Command Installer
# Run: bash scripts/install.sh
# Think Smart. Play Cool.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== FUSIKU ERP Installer ==="
echo "Root: $ROOT_DIR"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "Error: Node.js is required. Install from https://nodejs.org/"
  exit 1
fi

# Check npm
if ! command -v npm &> /dev/null; then
  echo "Error: npm is required. Install Node.js from https://nodejs.org/"
  exit 1
fi

# Check Docker (optional)
echo "Node: $(node -v) | npm: $(npm -v)"
if command -v docker &> /dev/null; then
  echo "Docker: $(docker --version)"
else
  echo "Docker: not found (optional - use for containerized deployment)"
fi
echo ""

# Root install
echo ">>> npm install (root)"
cd "$ROOT_DIR"
npm install

# Backend install
echo ">>> cd backend && npm install"
cd "$ROOT_DIR/backend"
npm install

# Frontend install
echo ">>> cd frontend && npm install"
cd "$ROOT_DIR/frontend"
npm install

# Create .env from .env.example if missing
cd "$ROOT_DIR/backend"
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo ">>> Creating backend/.env from .env.example"
    cp .env.example .env
    echo "    Edit backend/.env with your DATABASE_URL (PostgreSQL required)."
  else
    echo ">>> Creating backend/.env with defaults"
    echo 'DATABASE_URL="postgresql://user:password@localhost:5432/fusiku_erp"' > .env
    echo 'JWT_SECRET="change-this-in-production"' >> .env
    echo 'PORT=3001' >> .env
    echo "    Edit backend/.env with your DATABASE_URL."
  fi
else
  echo ">>> backend/.env already exists, skipping"
fi

# Prisma
echo ">>> npx prisma generate"
cd "$ROOT_DIR/backend"
npx prisma generate

echo ">>> npx prisma db push"
npx prisma db push || { echo "Database connection failed. Ensure PostgreSQL is running and DATABASE_URL is correct."; exit 1; }

echo ">>> npx prisma db seed"
npx prisma db seed

echo ""
echo "=== Installation complete ==="
echo ""
echo "1. Start the ERP:"
echo "   npm run dev"
echo ""
echo "2. Open browser: http://localhost:5173"
echo ""
echo "3. Complete setup wizard at /setup (company name, admin email, password)"
echo ""
echo "4. Optional: Add demo data: npm run seed:demo"
echo ""
