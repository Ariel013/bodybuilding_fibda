@echo off
setlocal
set "APP_DIR=%~dp0.."
if not exist "%APP_DIR%\.venv\Scripts\python.exe" (
  echo Installer les dependances selon docs/LANCEMENT.md avant le lancement.
  exit /b 1
)
"%APP_DIR%\.venv\Scripts\python.exe" "%APP_DIR%\launch.py" %*
