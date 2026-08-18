@echo off
chcp 65001 >nul
title DaengCut
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  type scripts\no-node.txt
  start https://nodejs.org/ko/download
  pause
  exit /b 1
)

node scripts\start.mjs

echo.
pause
