@echo off
setlocal enabledelayedexpansion
title Soukhya Tech — Stop Services

echo ================================================================
echo    SOUKHYA TECH ENTERPRISE — STOP ALL SERVICES
echo ================================================================
echo.

:: Check if Python is available (avoids Microsoft Store dummy alias)
python -c "import sys" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    python stop_all.py
    goto :end
)

py -3 -c "import sys" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    py -3 stop_all.py
    goto :end
)

:: Native Windows Fallback: Terminate processes listening on ports 3000 and 3001
echo [INFO] Stopping Node.js (Port 3000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 "') do (
    if "%%a" neq "0" (
        taskkill /F /T /PID %%a >nul 2>&1
    )
)

echo [INFO] Stopping Java Spring Boot (Port 3001)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 "') do (
    if "%%a" neq "0" (
        taskkill /F /T /PID %%a >nul 2>&1
    )
)

echo [OK] All backend services stopped.

:end
echo.
exit /b 0
