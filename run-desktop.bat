@echo off
setlocal
title ClassroomOS - Desktop Edition

echo ========================================================
echo   Starting ClassroomOS...
echo ========================================================

cd /d "%~dp0codebase\backend"

if exist venv\Scripts\python.exe (
    set "PYTHON_EXE=venv\Scripts\python.exe"
) else (
    set "PYTHON_EXE=python"
)

"%PYTHON_EXE%" launcher.py %*

if %ERRORLEVEL% neq 0 (
    echo.
    echo ClassroomOS exited with error code %ERRORLEVEL%.
    pause
)
