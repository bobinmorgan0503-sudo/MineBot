@echo off
cd /d "%~dp0"
set "BOT_HOST=%~1"
set "BOT_PORT=%~2"
set "BOT_VERSION=%~3"
if "%BOT_HOST%"=="" set "BOT_HOST=4u4n.qiunaruto.top"
if "%BOT_PORT%"=="" set "BOT_PORT=25565"
if "%BOT_VERSION%"=="" set "BOT_VERSION=1.21.11"

title MineBot - Bobot01 @ %BOT_HOST%:%BOT_PORT% (%BOT_VERSION%)
npm start -- Bobot01 %BOT_HOST% %BOT_PORT% %BOT_VERSION%
pause
