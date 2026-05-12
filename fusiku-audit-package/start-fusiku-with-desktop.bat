@echo off
setlocal EnableExtensions
REM Starts production backend (minimized) then opens Electron when /api/health is ready.
REM Uses one backend on :3001; Electron loads http://127.0.0.1:3001/ in dev (unpackaged) mode.

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [Fusiku] Node.js is not on PATH.
  exit /b 1
)

REM If already healthy, only launch Electron.
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -Uri 'http://127.0.0.1:3001/api/health' -UseBasicParsing -TimeoutSec 3; if ($r.StatusCode -eq 200) { exit 0 } } catch { } exit 1" >nul 2>&1
if errorlevel 1 (
  if not exist "frontend\dist\index.html" (
    echo [Fusiku] Building frontend...
    call npm run build:frontend
    if errorlevel 1 exit /b 1
  )
  if not exist "backend\dist\index.js" (
    echo [Fusiku] Building backend...
    call npm run build:backend
    if errorlevel 1 exit /b 1
  )
  echo [Fusiku] Starting backend (minimized)...
  set "FUSIKU_HOME=%~dp0"
  powershell -NoProfile -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','call',(Join-Path $env:FUSIKU_HOME.TrimEnd('\') 'start-fusiku-erp.bat') -WorkingDirectory $env:FUSIKU_HOME.TrimEnd('\') -WindowStyle Minimized"
)

echo [Fusiku] Waiting for http://127.0.0.1:3001/api/health ...
powershell -NoProfile -Command ^
  "$ok=$false; for ($i=0; $i -lt 120; $i++) { try { $r=Invoke-WebRequest -Uri 'http://127.0.0.1:3001/api/health' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { $ok=$true; break } } catch { } Start-Sleep -Milliseconds 500 }; if (-not $ok) { exit 1 } exit 0"
if errorlevel 1 (
  echo [Fusiku] Backend did not become ready in time.
  exit /b 1
)

call npm run electron
exit /b %ERRORLEVEL%
