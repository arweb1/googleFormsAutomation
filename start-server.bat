@echo off
REM Простой запуск на сервере с доступом по сети

echo ========================================
echo   Google Forms Automator - Сервер
echo ========================================
echo.

REM Проверка Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js не установлен!
    echo Скачайте и установите Node.js с https://nodejs.org/
    pause
    exit /b 1
)

echo [INFO] Node.js найден: 
node --version

REM Установка зависимостей сервера
echo.
echo [INFO] Установка зависимостей сервера...
call npm install
if errorlevel 1 (
    echo [ERROR] Ошибка установки зависимостей сервера!
    pause
    exit /b 1
)

REM Установка зависимостей клиента
echo.
echo [INFO] Установка зависимостей клиента...
cd client
call npm install
if errorlevel 1 (
    echo [ERROR] Ошибка установки зависимостей клиента!
    pause
    exit /b 1
)
cd ..

REM Создание файла .env если его нет
if not exist ".env" (
    echo.
    echo [INFO] Создание файла конфигурации...
    echo PORT=3001 > .env
    echo CLIENT_URL=http://localhost:3000 >> .env
    echo BROWSER_HEADLESS=true >> .env
    echo [INFO] Файл .env создан
)

REM Настройка файрвола
echo.
echo [INFO] Настройка файрвола...
netsh advfirewall firewall add rule name="Google Forms Automator Port 3000" dir=in action=allow protocol=TCP localport=3000 >nul 2>&1
netsh advfirewall firewall add rule name="Google Forms Automator Port 3001" dir=in action=allow protocol=TCP localport=3001 >nul 2>&1

REM Получение IP адреса
echo.
echo [INFO] Получение IP адреса сервера...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        set SERVER_IP=%%b
        goto :ip_found
    )
)
:ip_found

echo.
echo ========================================
echo   Запуск приложения...
echo ========================================
echo.
echo [INFO] Приложение будет доступно по адресам:
echo   Локально на сервере: http://localhost:3000
if defined SERVER_IP (
    echo   С вашего ПК: http://%SERVER_IP%:3000
)
echo.
echo [INFO] Для остановки нажмите Ctrl+C
echo.

REM Запуск приложения с доступом по сети
set HOST=0.0.0.0
call npm run dev

pause
