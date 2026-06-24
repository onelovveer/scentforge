@echo off
chcp 65001 >nul
title ScentForge — тестовая почта Ethereal
cd /d "%~dp0"

if exist "D:\Node\node.exe" (
  set "NODE_EXE=D:\Node\node.exe"
) else if exist "%ProgramFiles%\nodejs\node.exe" (
  set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
) else (
  set "NODE_EXE=node"
)

"%NODE_EXE%" setup-ethereal.js
pause
