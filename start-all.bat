@echo off
setlocal enabledelayedexpansion
title Soukhya Tech — Unified Windows Launcher

echo ================================================================
echo    SOUKHYA TECH ENTERPRISE — WINDOWS UNIFIED LAUNCHER
echo ================================================================
echo.

:: Step 1: Ensure .env exists
if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] .env not found. Creating .env from .env.example...
        copy ".env.example" ".env" >nul
        echo [OK]   .env created successfully.
    ) else (
        echo [WARN] Neither .env nor .env.example found.
    )
)

:: Step 2: Check if Python 3 is available (avoids Microsoft Store dummy alias)
python -c "import sys" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [INFO] Python 3 detected. Launching unified cross-platform runner start_all.py...
    echo.
    python start_all.py %*
    goto :end
)

py -3 -c "import sys" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [INFO] Python launcher (py -3) detected. Launching start_all.py...
    echo.
    py -3 start_all.py %*
    goto :end
)

:: Step 3: Fallback Native Windows Launch (if Python is not installed)
echo [WARN] Python not found in PATH. Initiating native Node.js / Windows fallback launch...
echo.

:: Verify Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is required but not found in PATH.
    echo Please install Node.js (v18+) from https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Step 3a: Verify node_modules
if not exist "node_modules" (
    echo [INFO] Installing Node.js dependencies (npm install)...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

:: Step 3b: Boot MySQL Database if needed
if exist "scripts\setup_mysql.js" (
    echo [INFO] Initializing MySQL 8.4 database setup...
    node scripts\setup_mysql.js
)

:: Step 3c: Check for Java / Spring Boot Backend
where java >nul 2>&1
if %ERRORLEVEL% equ 0 (
    if exist "pom.xml" (
        where mvn >nul 2>&1
        if %ERRORLEVEL% equ 0 (
            echo [INFO] Launching Java Spring Boot backend on port 3001 in separate window...
            start "Soukhya Tech — Java Spring Boot (Port 3001)" cmd /k "mvn spring-boot:run"
        )
    )
)

:: Step 3d: Launch Node.js Express Server
echo [INFO] Checking port 3000 availability...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 "') do (
    if "%%a" neq "0" (
        echo [INFO] Releasing occupied port 3000 (PID: %%a)...
        taskkill /F /T /PID %%a >nul 2>&1
    )
)

echo [INFO] Starting Node.js Express Server on port 3000...
echo [INFO] Access Application UI at: http://localhost:3000
echo.

start "Soukhya Tech — Node.js Express (Port 3000)" cmd /k "node server.js"

:: Open default browser
timeout /t 2 >nul
start http://localhost:3000

:end
echo.
echo [OK] Launch commands dispatched.
exit /b 0
