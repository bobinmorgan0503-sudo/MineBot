@echo off
cd /d "%~dp0"
set "BOT_HOST=%~1"
set "BOT_PORT=%~2"
if "%BOT_HOST%"=="" set "BOT_HOST=azrxjh.cn"
if "%BOT_PORT%"=="" set "BOT_PORT=25568"

title MineBot - muck @ %BOT_HOST%:%BOT_PORT%
npm start -- muck %BOT_HOST% %BOT_PORT%
pause
