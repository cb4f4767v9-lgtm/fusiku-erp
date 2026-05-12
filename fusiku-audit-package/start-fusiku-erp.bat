@echo off
setlocal EnableExtensions
REM Fusiku ERP — production backend (Express on PORT, default 3001).
REM Logs: logs\startup.log
REM Auto-start: run install-fusiku-scheduled-task.bat once (Task Scheduler, as Administrator).

cd /d "%~dp0"

echo Starting Fusiku ERP...

if not exist "logs" mkdir logs
set "LOG=%CD%\logs\startup.log"

>> "%LOG%" echo %DATE% %TIME% --- start-fusiku-erp.bat cwd=%CD% ---

REM Already healthy — do not start a second process
curl -sf http://127.0.0.1:3001/api/health >nul 2>&1
if not errorlevel 1 (
  >> "%LOG%" echo %DATE% %TIME% Already running
  exit /b 0
)
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -Uri 'http://127.0.0.1:3001/api/health' -UseBasicParsing -TimeoutSec 3; if ($r.StatusCode -eq 200) { exit 0 } } catch { } exit 1" >nul 2>&1
if not errorlevel 1 (
  >> "%LOG%" echo %DATE% %TIME% Already running
  exit /b 0
)

netstat -ano 2>nul | findstr ":3001" | findstr "LISTENING" >nul
if not errorlevel 1 (
  >> "%LOG%" echo %DATE% %TIME% ERROR: Port 3001 is in use but /api/health failed — stop the other process or change PORT in backend\.env
  exit /b 1
)

if not exist "backend\dist\index.js" (
  >> "%LOG%" echo %DATE% %TIME% ERROR: backend\dist\index.js missing — from repo root run: npm run build:backend
  exit /b 1
)

if not exist "frontend\dist\index.html" (
  >> "%LOG%" echo %DATE% %TIME% WARNING: frontend\dist missing — run npm run build:frontend (UI returns 503 until built)
)

>> "%LOG%" echo %DATE% %TIME% Starting backend

set "NODE_ENV=production"
set "NODE_EXE=node"
if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if /i "%NODE_EXE%"=="node" if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles(x86)%\nodejs\node.exe"

if /i "%NODE_EXE%"=="node" (
  where node >nul 2>&1
  if errorlevel 1 (
    >> "%LOG%" echo %DATE% %TIME% ERROR: node.exe not found — install Node LTS to Program Files or add to PATH
    exit /b 1
  )
)

"%NODE_EXE%" backend\dist\index.js >> "%LOG%" 2>&1
set "RC=%ERRORLEVEL%"
>> "%LOG%" echo %DATE% %TIME% node exited code=%RC%
exit /b %RC%
