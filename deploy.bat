@echo off
chcp 65001 >nul
title ScentForge — деплой в интернет
cd /d "%~dp0"

echo.
echo  ══════════════════════════════════════════════════════
echo   ScentForge — как выложить сайт в интернет
echo  ══════════════════════════════════════════════════════
echo.
echo   InfinityFree НЕ подходит (нет Node.js).
echo   Нужен Render.com — бесплатно, всё работает.
echo.
echo   Откройте файл HOSTING.md — там пошаговая инструкция.
echo.
echo   Кратко:
echo   1. Запустите push-github.bat — загрузка на GitHub
echo   2. render.com - New Web Service - подключите репозиторий
echo   3. Добавьте переменные из .env в Render (см. render-env.txt)
echo   4. Обновите Google OAuth callback URL
echo.
echo   Запустить загрузку на GitHub сейчас? (Y/N)
set /p GO_PUSH=
if /i "%GO_PUSH%"=="Y" (
  call "%~dp0push-github.bat"
  exit /b 0
)
echo.
echo   Открываю инструкцию...
echo.

start "" "%~dp0HOSTING.md"
start "" "https://dashboard.render.com/register"

pause
