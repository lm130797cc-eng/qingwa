
@echo off
echo 👻 Ghost Global Protocol - One Click Start
echo =========================================

echo [1/2] Starting Backend API (Port 3001)...
cd /d "D:\MAYIJU\MAYIDAO\03_BACKEND"
start "Ghost Backend" node dashboard_api.js

echo [2/2] Opening Review Dashboard...
timeout /t 2 >nul
start "" "D:\MAYIJU\MAYIDAO\review\dashboard.html"

echo.
echo 🟢 System Autonomous. 
echo 📋 Please check the opened browser window for reviews.
echo.
pause
