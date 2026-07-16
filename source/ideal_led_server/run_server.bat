@echo off
cd /d "%~dp0"
if not exist "venv\Scripts\python.exe" (
    echo Virtual environment not found. Please run install_service.py first.
    pause
    exit /b 1
)
echo Starting iDeal LED Server...
"venv\Scripts\python.exe" server.py %*
pause
