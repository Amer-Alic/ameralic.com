#!/bin/zsh
# The only command. Opens the writing interface in your browser.
#
#   w          the interface
#   w menu     the small terminal menu instead

set -u
REPO="${0:A:h}"
PORT=4321
URL="http://127.0.0.1:$PORT"

export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$REPO" || exit 1

if [[ "${1:-}" == "menu" ]]; then
  exec node w-menu.js
fi

# Already running from an earlier session? Just bring it up.
if curl -s -o /dev/null --max-time 1 "$URL"; then
  open "$URL"
  echo "already running → $URL"
  exit 0
fi

node studio.js &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' INT TERM EXIT

for _ in 1 2 3 4 5 6 7 8 9 10; do
  curl -s -o /dev/null --max-time 1 "$URL" && break
  sleep 0.3
done

open "$URL"
echo "writing → $URL"
echo "ctrl-c here when you are done"
wait $SERVER
