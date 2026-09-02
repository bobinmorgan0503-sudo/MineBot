#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

BOT_NAME="${1:-default}"
BOT_HOST="${2:-default-host}"
BOT_PORT="${3:-default-port}"
BOT_VERSION="${4:-1.21.11}"
SESSION_NAME="minebot-${BOT_NAME}"

if screen -list | grep -q "[.]${SESSION_NAME}[[:space:]]"; then
  echo "Screen session ${SESSION_NAME} is already running."
  echo "Attach with: screen -r ${SESSION_NAME}"
  exit 0
fi

mkdir -p logs
screen -dmS "${SESSION_NAME}" bash -lc "cd '$(pwd)' && npm start -- '${BOT_NAME}' '${BOT_HOST}' '${BOT_PORT}' '${BOT_VERSION}' 2>&1 | tee -a 'logs/${SESSION_NAME}.log'"

echo "Started ${BOT_NAME} in screen session ${SESSION_NAME}."
echo "Attach with: screen -r ${SESSION_NAME}"
echo "Log file: logs/${SESSION_NAME}.log"
