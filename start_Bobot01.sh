#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

BOT_HOST="${1:-4u4n.qiunaruto.top}"
BOT_PORT="${2:-25565}"
BOT_VERSION="${3:-1.21.11}"
SESSION_NAME="minebot-Bobot01"

if screen -list | grep -q "[.]${SESSION_NAME}[[:space:]]"; then
  echo "Screen session ${SESSION_NAME} is already running."
  echo "Attach with: screen -r ${SESSION_NAME}"
  exit 0
fi

mkdir -p logs
screen -dmS "${SESSION_NAME}" bash -lc "cd '$(pwd)' && npm start -- Bobot01 '${BOT_HOST}' '${BOT_PORT}' '${BOT_VERSION}' 2>&1 | tee -a 'logs/${SESSION_NAME}.log'"

echo "Started Bobot01 in screen session ${SESSION_NAME}."
echo "Attach with: screen -r ${SESSION_NAME}"
echo "Log file: logs/${SESSION_NAME}.log"
