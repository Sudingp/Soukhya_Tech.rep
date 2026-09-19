@echo off
title Soukhya Tech - Unified Windows Shutdown
echo =============================================================================
echo SOUKHYA TECH — UNIFIED STOP SCRIPT (WINDOWS NATIVE)
echo Scans and terminates any active processes listening on ports 3000, 3001
echo =============================================================================
echo.

REM --- TERMINATE PORT 3000 (Node.js) ---
echo [INFO] Stopping Node.js Backend on port 3000...
set FOUND_3000=false
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    echo [KILL] Found PID %%a listening on port 3000. Terminating...
    taskkill /f /pid %%a >nul 2>nul
    set FOUND_3000=true
)
if "%FOUND_3000%"=="false" (
    echo [INFO] No process found on port 3000.
)

REM --- TERMINATE PORT 3001 (Java) ---
echo.
echo [INFO] Stopping Java Spring Boot Backend on port 3001...
set FOUND_3001=false
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
    echo [KILL] Found PID %%a listening on port 3001. Terminating...
    taskkill /f /pid %%a >nul 2>nul
    set FOUND_3001=true
)
if "%FOUND_3001%"=="false" (
    echo [INFO] No process found on port 3001.
)



echo.
echo =============================================================================
echo SHUTDOWN SEQUENCE COMPLETE
echo All backend services terminated on ports 3000 and 3001.
echo =============================================================================
pause
exit /b 0
