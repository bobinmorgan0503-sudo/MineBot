#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

BOT_HOST="${1:-4u4n.qiunaruto.top}"
BOT_PORT="${2:-25565}"
BOT_VERSION="${3:-1.21.11}"
BOT_PROXY_HOST="${4:-127.0.0.1}"
BOT_PROXY_PORT="${5:-7890}"
SESSION_NAME="minebot-Demo001"

if screen -list | grep -q "[.]${SESSION_NAME}[[:space:]]"; then
  echo "Screen session ${SESSION_NAME} is already running."
  echo "Attach with: screen -r ${SESSION_NAME}"
  exit 0
fi

mkdir -p logs
screen -dmS "${SESSION_NAME}" bash -lc "cd '$(pwd)' && npm start -- Demo001 '${BOT_HOST}' '${BOT_PORT}' '${BOT_VERSION}' '--proxy-host=${BOT_PROXY_HOST}' '--proxy-port=${BOT_PROXY_PORT}' 2>&1 | tee -a 'logs/${SESSION_NAME}.log'"

echo "Started Demo001 through SOCKS5 proxy ${BOT_PROXY_HOST}:${BOT_PROXY_PORT}."
echo "Screen session: ${SESSION_NAME}"
echo "Attach with: screen -r ${SESSION_NAME}"
echo "Log file: logs/${SESSION_NAME}.log"
