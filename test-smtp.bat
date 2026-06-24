@echo off
chcp 65001 >nul
title ScentForge — тест почты
cd /d "%~dp0"

if exist "D:\Node\node.exe" (
  set "NODE_EXE=D:\Node\node.exe"
) else if exist "%ProgramFiles%\nodejs\node.exe" (
  set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
) else (
  set "NODE_EXE=node"
)

echo.
echo  Тест отправки письма ScentForge
echo  ================================
echo.

"%NODE_EXE%" test-smtp.js %*

echo.
pause
