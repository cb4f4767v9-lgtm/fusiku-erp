@echo off
setlocal EnableExtensions
set "LINK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Fusiku ERP.lnk"
if exist "%LINK%" (
  del "%LINK%"
  echo [Fusiku] Removed: %LINK%
) else (
  echo [Fusiku] No startup shortcut found.
)
exit /b 0
