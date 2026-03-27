@echo off
cd /d "%~dp0"
set "BOT_HOST=%~1"
set "BOT_PORT=%~2"
set "BOT_VERSION=%~3"
if "%BOT_HOST%"=="" set "BOT_HOST=azrxjh.cn"
if "%BOT_PORT%"=="" set "BOT_PORT=25568"
if "%BOT_VERSION%"=="" set "BOT_VERSION=1.20.4"

title MineBot - Arthas @ %BOT_HOST%:%BOT_PORT% (%BOT_VERSION%)
npm start -- Arthas %BOT_HOST% %BOT_PORT% %BOT_VERSION%
pause
