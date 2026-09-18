@echo off
title Soukhya Tech - Unified Windows Launcher
echo =============================================================================
echo SOUKHYA TECH — UNIFIED START SCRIPT (WINDOWS NATIVE)
echo Auto-detects runtimes, compiles, and launches Node.js and Java backends in separate windows
echo =============================================================================
echo.

REM --- Auto-detect JDK 21 ---
if exist "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot" (
    set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot"
    set "PATH=C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot\bin;%PATH%"
)

REM --- 1. PRE-FLIGHT RUNTIME CHECKS ---
echo [INFO] Verifying installed runtimes...

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in your PATH.
    echo Please install Node.js from https://nodejs.org/
    goto ERROR_EXIT
) else (
    echo [OK] Node.js is available.
)

where mvn >nul 2>nul
if errorlevel 1 (
    echo [WARN] Maven is not installed or not in your PATH. Java backend will be skipped.
    set PLAY_JAVA=false
) else (
    echo [OK] Maven is available.
    set PLAY_JAVA=true
)



echo.

REM --- 2. PORT CONFLICT CHECKS ---
echo [INFO] Checking for port conflicts - 3000, 3001...
set PORT_CONFLICT=false

netstat -ano | findstr :3000 | findstr LISTENING >nul
if not errorlevel 1 (
    echo [WARN] Port 3000 Node.js is already in use!
    set PORT_CONFLICT=true
)
if "%PLAY_JAVA%"=="true" (
    netstat -ano | findstr :3001 | findstr LISTENING >nul
    if not errorlevel 1 (
        echo [WARN] Port 3001 Java is already in use!
        set PORT_CONFLICT=true
    )
)


if "%PORT_CONFLICT%"=="true" (
    echo [INFO] If services are already running, you can stop them using stop-all.bat
    echo.
)

REM --- 3. START NODE.JS BACKEND ---
echo =============================================================================
echo Starting Node.js Backend on Port 3000...
echo =============================================================================
if not exist node_modules (
    echo [INFO] node_modules directory not found. Running npm install...
    call npm install
)
start "Soukhya Tech - Node.js Backend" cmd /k "node server.js"
echo [OK] Node.js server command spawned.

REM --- 4. START JAVA BACKEND ---
if "%PLAY_JAVA%"=="true" (
    echo.
    echo =============================================================================
    echo Starting Java Spring Boot Backend on Port 3001...
    echo =============================================================================
    if not exist target (
        echo [INFO] Target directory not found. Running mvn clean install...
        call mvn clean install -DskipTests
    )
    start "Soukhya Tech - Java Backend" cmd /k "mvn spring-boot:run -Dspring-boot.run.mainClass=com.soukhyatech.faceattendance.FaceAttendanceApplication -Dspring-boot.run.jvmArguments=-Dserver.port=3001"
    echo [OK] Java server command spawned.
)



echo.
echo =============================================================================
echo ALL SERVICES SPAWNED SUCCESSFULLY!
echo =============================================================================
echo - Node.js:  http://localhost:3000
echo - Java:     http://localhost:3001
echo.
echo You can close individual command windows to stop services,
echo or run stop-all.bat to terminate them all automatically.
echo =============================================================================
pause
exit /b 0

:ERROR_EXIT
echo.
echo [ERROR] Startup aborted due to missing prerequisites.
pause
exit /b 1
