@echo off
cd /d "%~dp0"
set "BOT_NAME=%~1"
set "BOT_HOST=%~2"
set "BOT_PORT=%~3"
if "%BOT_NAME%"=="" set "BOT_NAME=default"
if "%BOT_HOST%"=="" set "BOT_HOST=default-host"
if "%BOT_PORT%"=="" set "BOT_PORT=default-port"

title MineBot - %BOT_NAME% @ %BOT_HOST%:%BOT_PORT%
npm start -- %*
pause
