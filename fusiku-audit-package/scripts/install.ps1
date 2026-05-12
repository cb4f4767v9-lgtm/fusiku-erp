# FUSIKU ERP - Windows Installation Script
Write-Host "FUSIKU ERP - Think Smart. Play Cool." -ForegroundColor Cyan
Write-Host "Installing dependencies..." -ForegroundColor Yellow

Set-Location $PSScriptRoot\..

# Root
npm install

# Backend
Set-Location backend
npm install
Set-Location ..

# Frontend
Set-Location frontend
npm install
Set-Location ..

# Desktop
Set-Location desktop
npm install
Set-Location ..

Write-Host "Done! Next steps:" -ForegroundColor Green
Write-Host "1. Create PostgreSQL database: CREATE DATABASE fusiku_erp;"
Write-Host "2. Copy backend\.env.example to backend\.env and set DATABASE_URL"
Write-Host "3. Run: npm run db:push"
Write-Host "4. Run: npm run db:seed"
Write-Host "5. Run: npm run dev"
