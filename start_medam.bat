@echo off
echo ===================================================
echo Starting MEDAM Studio (Backend + Frontend)
echo ===================================================

cd /d "%~dp0"

start "MEDAM Backend (FastAPI)" cmd /c "backend\.venv\Scripts\uvicorn.exe main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload"

timeout /t 2 /nobreak >nul

cd /d "%~dp0frontend"
start "MEDAM Frontend (Vite)" cmd /c "npm run dev"

echo MEDAM Studio launched at http://localhost:5173
