@echo off
title AutoParts POS Server
cd /d "%~dp0"
echo ========================================================
echo   AutoParts POS - Multi-Terminal Server Launcher
echo ========================================================
echo.
echo Starting local web server on port 8080...
echo Opening browser...
start http://localhost:8080
npx serve -p 8080 -s .
pause
