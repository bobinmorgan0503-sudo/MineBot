#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

BOT_HOST="${1:-4u4n.qiunaruto.top}"
BOT_PORT="${2:-25565}"
BOT_VERSION="${3:-1.21.11}"
BOT_PROXY_HOST="${4:-49.232.133.49}"
BOT_PROXY_PORT="${5:-1080}"
BOT_PROXY_USERNAME="${6:-minebot}"
BOT_PROXY_PASSWORD="${7:-nCaLdWs0RiKEfBOfGhWG}"
SESSION_NAME="minebot-muck-proxy"

if screen -list | grep -q "[.]${SESSION_NAME}[[:space:]]"; then
  echo "Screen session ${SESSION_NAME} is already running."
  echo "Attach with: screen -r ${SESSION_NAME}"
  exit 0
fi

mkdir -p logs
screen -dmS "${SESSION_NAME}" bash -lc "cd '$(pwd)' && npm start -- muck '${BOT_HOST}' '${BOT_PORT}' '${BOT_VERSION}' '--proxy-host=${BOT_PROXY_HOST}' '--proxy-port=${BOT_PROXY_PORT}' '--proxy-username=${BOT_PROXY_USERNAME}' '--proxy-password=${BOT_PROXY_PASSWORD}' 2>&1 | tee -a 'logs/${SESSION_NAME}.log'"

echo "Started muck proxy in screen session ${SESSION_NAME}."
echo "Attach with: screen -r ${SESSION_NAME}"
echo "Log file: logs/${SESSION_NAME}.log"
