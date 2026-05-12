@echo off
setlocal EnableExtensions
REM Runs Node from repo root; stdout/stderr append to logs\startup.log (called by start-fusiku-erp.bat).

cd /d "%~dp0.."
if not exist "logs" mkdir logs
set "LOG=%CD%\logs\startup.log"
set "NODE_ENV=production"

set "NODE_RUN="
if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_RUN=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_RUN if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE_RUN=%ProgramFiles(x86)%\nodejs\node.exe"
if not defined NODE_RUN set "NODE_RUN=node"

>> "%LOG%" echo %DATE% %TIME% [worker] using: %NODE_RUN%
>> "%LOG%" echo %DATE% %TIME% [worker] starting backend\dist\index.js (cwd=%CD%)

if /i "%NODE_RUN%"=="node" (
  node backend\dist\index.js >> "%LOG%" 2>&1
) else (
  "%NODE_RUN%" backend\dist\index.js >> "%LOG%" 2>&1
)
set "RC=%ERRORLEVEL%"
>> "%LOG%" echo %DATE% %TIME% [worker] node exited code=%RC%
exit /b %RC%
