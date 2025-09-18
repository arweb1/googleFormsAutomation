@echo off
REM Быстрое исправление и запуск

echo [INFO] Остановка всех процессов Node.js...
taskkill /f /im node.exe >nul 2>&1

echo [INFO] Очистка кэша клиента...
cd client
if exist "node_modules" rmdir /s /q "node_modules"
if exist "package-lock.json" del "package-lock.json"
call npm cache clean --force
call npm install
cd ..

echo [INFO] Запуск приложения...
set HOST=0.0.0.0
call npm run dev
