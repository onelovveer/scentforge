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
echo   1. Загрузите проект на GitHub (без node_modules и .env)
echo   2. render.com - New Web Service - подключите репозиторий
echo   3. Добавьте переменные из .env в Render
echo   4. Обновите Google OAuth callback URL
echo.
echo   Открываю инструкцию и GitHub...
echo.

start "" "%~dp0HOSTING.md"
start "" "https://github.com/new"
start "" "https://dashboard.render.com/register"

pause
