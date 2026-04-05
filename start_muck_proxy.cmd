@echo off
cd /d "%~dp0"
set "BOT_HOST=%~1"
set "BOT_PORT=%~2"
set "BOT_VERSION=%~3"
set "BOT_PROXY_HOST=%~4"
set "BOT_PROXY_PORT=%~5"
set "BOT_PROXY_USERNAME=%~6"
set "BOT_PROXY_PASSWORD=%~7"
if "%BOT_HOST%"=="" set "BOT_HOST=mc101.ytonidc.com"
if "%BOT_PORT%"=="" set "BOT_PORT=50305"
if "%BOT_VERSION%"=="" set "BOT_VERSION=1.21.11"
if "%BOT_PROXY_HOST%"=="" set "BOT_PROXY_HOST=49.232.133.49"
if "%BOT_PROXY_PORT%"=="" set "BOT_PROXY_PORT=1080"
if "%BOT_PROXY_USERNAME%"=="" set "BOT_PROXY_USERNAME=minebot"
if "%BOT_PROXY_PASSWORD%"=="" set "BOT_PROXY_PASSWORD=nCaLdWs0RiKEfBOfGhWG"

title MineBot - muck @ %BOT_HOST%:%BOT_PORT% (%BOT_VERSION%)
npm start -- muck "%BOT_HOST%" "%BOT_PORT%" "%BOT_VERSION%" "--proxy-host=%BOT_PROXY_HOST%" "--proxy-port=%BOT_PROXY_PORT%" "--proxy-username=%BOT_PROXY_USERNAME%" "--proxy-password=%BOT_PROXY_PASSWORD%"
pause
