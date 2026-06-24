@echo off
chcp 65001 >nul
title ScentForge — загрузка на GitHub
cd /d "%~dp0"

set "GIT=C:\Program Files\Git\bin\git.exe"
if not exist "%GIT%" set "GIT=git"

echo.
echo  ══════════════════════════════════════════════════════
echo   Загрузка ScentForge на GitHub
echo  ══════════════════════════════════════════════════════
echo.

"%GIT%" --version >nul 2>&1
if errorlevel 1 (
  echo  [!] Git не найден. Установите: winget install Git.Git
  pause
  exit /b 1
)

if not exist ".git" (
  echo  Инициализация репозитория...
  "%GIT%" init
  "%GIT%" add -A
  "%GIT%" commit -m "ScentForge marketplace"
)

echo  Создаю архив для загрузки (без node_modules и секретов)...
powershell -NoProfile -Command ^
  "$d='%~dp0'; $z=Join-Path $d 'scentforge-github.zip'; if(Test-Path $z){Remove-Item $z};" ^
  "$files=Get-ChildItem -Path $d -Recurse -File | Where-Object {" ^
  "  $_.FullName -notmatch 'node_modules|\\.env$|data\\.json$|scentforge-github\\.zip|\\.git\\' }; " ^
  "$temp=Join-Path $env:TEMP ('sf-deploy-'+[guid]::NewGuid().ToString()); New-Item -ItemType Directory -Path $temp | Out-Null; " ^
  "foreach($f in $files){ $rel=$f.FullName.Substring($d.Length).TrimStart('\'); $dest=Join-Path $temp $rel; New-Item -ItemType Directory -Path (Split-Path $dest) -Force | Out-Null; Copy-Item $f.FullName $dest }; " ^
  "Compress-Archive -Path (Join-Path $temp '*') -DestinationPath $z -Force; Remove-Item $temp -Recurse -Force; Write-Host ('  Архив: ' + $z)"

echo.
echo  ──────────────────────────────────────────────────────
echo   Вариант A — через Git (рекомендуется для Render)
echo  ──────────────────────────────────────────────────────
echo.
echo  1. Создайте репозиторий: https://github.com/new
echo     Имя: scentforge, БЕЗ README
echo.
echo  2. Вставьте URL репозитория (например https://github.com/USER/scentforge.git):
set /p REPO_URL="  URL: "

if "%REPO_URL%"=="" goto manual

echo.
echo  Отправка на GitHub...
"%GIT%" branch -M main 2>nul
"%GIT%" remote remove origin 2>nul
"%GIT%" remote add origin "%REPO_URL%"
"%GIT%" push -u origin main

if errorlevel 1 (
  echo.
  echo  [!] Не удалось отправить. Возможные причины:
  echo      - неверный URL
  echo      - нужен вход в GitHub (откроется окно авторизации)
  echo      - используйте Вариант B ниже
  goto manual
)

echo.
echo  [OK] Код на GitHub! Дальше: https://dashboard.render.com
echo       New Web Service - подключите репозиторий scentforge
echo.
start "" "https://dashboard.render.com/register"
start "" "%~dp0HOSTING.md"
pause
exit /b 0

:manual
echo.
echo  ──────────────────────────────────────────────────────
echo   Вариант B — загрузить ZIP вручную
echo  ──────────────────────────────────────────────────────
echo.
echo  1. https://github.com/new - создайте scentforge
echo  2. Add file - Upload files - перетащите scentforge-github.zip
echo  3. Commit changes
echo  4. Render.com - New Web Service - подключите репозиторий
echo.
if exist "%~dp0scentforge-github.zip" start "" "%~dp0"
start "" "https://github.com/new"
start "" "%~dp0HOSTING.md"
pause
