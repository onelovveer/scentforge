@echo off
chcp 65001 >nul
title ScentForge Server
cd /d "%~dp0"

set "NODE_EXE="
set "NPM_CMD="

REM Проверка стандартных путей Node.js
if exist "D:\Node\node.exe" (
  set "NODE_EXE=D:\Node\node.exe"
  set "NPM_CMD=D:\Node\npm.cmd"
  set "PATH=D:\Node;%PATH%"
)

if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" (
  set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
  set "NPM_CMD=%ProgramFiles%\nodejs\npm.cmd"
  set "PATH=%ProgramFiles%\nodejs;%PATH%"
)

if not defined NODE_EXE (
  where node >nul 2>&1
  if %errorlevel% equ 0 (
    set "NODE_EXE=node"
    set "NPM_CMD=npm"
  )
)

if not defined NODE_EXE (
  echo.
  echo  [!] Node.js не найден!
  echo  Установите с https://nodejs.org и перезагрузите ПК.
  echo.
  pause
  exit /b 1
)

echo.
echo  Node.js: 
"%NODE_EXE%" -v
echo.

if not exist node_modules\express (
  echo  Установка зависимостей...
  call "%NPM_CMD%" install
  if errorlevel 1 (
    echo.
    echo  [!] Ошибка npm install
    pause
    exit /b 1
  )
  echo  Готово!
  echo.
)

echo  ==========================================
echo   ScentForge запускается...
echo   НЕ ЗАКРЫВАЙТЕ это окно!
echo  ==========================================
echo.

REM Остановить старый сервер на порту 3000 (если завис)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
  taskkill /F /PID %%a >nul 2>&1
)

echo  Сайт: http://localhost:3000
echo  Google-вход работает только через этот адрес
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

"%NODE_EXE%" server.js

echo.
echo  [!] Сервер остановлен. Нажмите любую клавишу...
pause >nul
