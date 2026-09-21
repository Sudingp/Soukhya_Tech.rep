@echo off
setlocal enabledelayedexpansion
title Soukhya Tech — Integration & Benchmark Test Runner

echo ================================================================
echo    SOUKHYA TECH ENTERPRISE — INTEGRATION TEST & BENCHMARK
echo ================================================================
echo.

:: Check if Python is available (avoids Microsoft Store dummy alias)
python -c "import sys" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [INFO] Running test suite via test_all.py...
    python test_all.py %*
    goto :end
)

py -3 -c "import sys" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [INFO] Running test suite via test_all.py...
    py -3 test_all.py %*
    goto :end
)

:: Native Windows Fallback: Run Node.js integration tests and DB benchmarks
echo [INFO] Running automated integration tests (test_integration.js)...
node test_integration.js

echo.
echo [INFO] Running database benchmark suite (scripts\db_benchmark.js)...
node scripts\db_benchmark.js

:end
echo.
pause
exit /b 0
