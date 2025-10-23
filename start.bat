@echo off
echo Iniciando CryptoTrading AI Advisor...
echo.

echo Iniciando Backend...
start "Backend" cmd /k "cd /d "%~dp0backend" && npm start"

echo Esperando 3 segundos...
timeout /t 3 /nobreak > nul

echo Iniciando Frontend...
start "Frontend" cmd /k "cd /d "%~dp0frontend-web" && npm run dev"

echo.
echo Servidores iniciados correctamente!
echo Backend: http://localhost:3001
echo Frontend: http://localhost:3000
echo.
pause

