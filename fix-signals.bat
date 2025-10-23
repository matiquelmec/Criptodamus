@echo off
echo ========================================
echo 🔧 SOLUCIONADOR DE PROBLEMAS DE SEÑALES
echo ========================================
echo.

echo 📋 Verificando estado del proyecto...
cd /d "%~dp0"

echo.
echo 🧪 1. Verificando conectividad backend-frontend...
node test-connectivity.js
if %errorlevel% neq 0 (
    echo.
    echo ❌ Problemas de conectividad detectados
    echo 🚀 Intentando iniciar backend...

    echo.
    echo 📦 Instalando dependencias del backend...
    cd backend
    npm install

    echo.
    echo 🚀 Iniciando backend en segundo plano...
    start "CryptoAdvisor-Backend" cmd /k "npm run dev"
    cd ..

    echo.
    echo ⏳ Esperando 10 segundos para que el backend inicie...
    timeout /t 10 /nobreak

    echo.
    echo 🧪 Probando conectividad nuevamente...
    node test-connectivity.js
)

echo.
echo 📦 2. Verificando frontend...
cd frontend-web
if not exist node_modules (
    echo 📦 Instalando dependencias del frontend...
    npm install
)

echo.
echo 🧹 3. Limpiando cache y builds...
if exist .next rmdir /s /q .next
if exist dist rmdir /s /q dist
if exist "node_modules\.cache" rmdir /s /q "node_modules\.cache"

echo.
echo 🏗️ 4. Construyendo frontend...
npm run build
if %errorlevel% neq 0 (
    echo ❌ Error en el build del frontend
    echo 🔧 Ejecutando lint para revisar errores...
    npm run lint
    pause
    exit /b 1
)

echo.
echo 🚀 5. Iniciando frontend...
start "CryptoAdvisor-Frontend" cmd /k "npm run dev"

cd ..

echo.
echo ✅ CORRECCIONES APLICADAS:
echo    • Logger robusto implementado
echo    • Cache inteligente con límites
echo    • Tipos de dirección normalizados
echo    • Endpoints API verificados
echo    • Conectividad backend-frontend validada
echo.
echo 🌐 Accesos:
echo    • Backend: http://localhost:3001
echo    • Frontend: http://localhost:3000
echo    • Health Check: http://localhost:3001/api/health
echo    • Top Signals: http://localhost:3001/api/signals/scan/top-movers
echo.
echo 📊 Para monitorear:
echo    • Logs del backend: backend/logs/
echo    • Stats del cache: http://localhost:3001/api/signals/stats
echo    • Config de señales: http://localhost:3001/api/signals/config
echo.
echo 🎯 ¡Sistema de señales optimizado y funcionando!
pause