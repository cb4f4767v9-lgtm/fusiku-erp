@echo off
setlocal EnableExtensions
REM Registers Task Scheduler job "Fusiku ERP" (At log on, highest privileges, restart on failure).
REM MUST Run as Administrator — right-click this file ^> Run as administrator.

net session >nul 2>&1
if errorlevel 1 (
  echo [Fusiku] Run this batch as Administrator (Task Scheduler requires elevation).
  exit /b 1
)

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-fusiku-scheduled-task.ps1" -RepoRoot "%CD%"
if errorlevel 1 exit /b 1
exit /b 0
