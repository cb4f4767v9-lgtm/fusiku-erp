@echo off
setlocal EnableExtensions
REM DEPRECATED for auto-start: prefer install-fusiku-scheduled-task.bat (Task Scheduler, more reliable).
REM This only adds a Startup-folder shortcut.

cd /d "%~dp0"
set "REPO=%CD%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\create-windows-startup-shortcut.ps1" -RepoRoot "%REPO%"
if errorlevel 1 (
  echo [Fusiku] Failed to create shortcut.
  exit /b 1
)
echo.
echo Re-run this if you move the project folder. Log file: "%REPO%\logs\startup.log"
exit /b 0
