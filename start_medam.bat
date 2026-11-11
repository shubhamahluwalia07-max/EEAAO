@echo off
echo ===================================================
echo Starting MEDAM Studio (Backend + Frontend)
echo ===================================================

cd /d "%~dp0"

start "MEDAM Backend (FastAPI)" cmd /c "cd /d "%~dp0backend" && .venv\Scripts\python.exe main.py"

timeout /t 2 /nobreak >nul

cd /d "%~dp0frontend"
start "MEDAM Frontend (Vite)" cmd /c "npm run dev"

echo MEDAM Studio launched at http://localhost:5173
