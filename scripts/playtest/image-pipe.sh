#!/usr/bin/env bash
# Round 8 (image): pipe.js (shimmer by DECISIONS 287's metric, GPU pass times, draws) from a JSON config file, in
# the image lane's own session, holding a browser slot only while it runs.
#   scripts/playtest/image-pipe.sh <cfg.json> <abs report.json>
CFG_JSON="$1"; REPORT="$2"
HERE="$(cd "$(dirname "$0")" && pwd -W)"
SLOT="C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh"
S="r8-image"
BASE="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).base)" "$CFG_JSON")"
slot=$(bash "$SLOT" take image) || { echo "$(date +%H:%M) no slot: $slot"; exit 2; }; echo "$(date +%H:%M) took $slot"
playwright-cli -s="$S" open --config=.playwright/cli-headless.config.json >/dev/null 2>&1
playwright-cli -s="$S" goto "$BASE" >/dev/null 2>&1
playwright-cli -s="$S" eval "window.__pipeCfg = $(tr -d '\r\n' < "$CFG_JSON")" >/dev/null 2>&1
timeout 1500 playwright-cli -s="$S" --raw run-code --filename="$HERE/pipe.js" 2>&1 | grep -v '^[╔║╚]' | grep -v '^$' > "$REPORT"
playwright-cli -s="$S" close >/dev/null 2>&1
[ -n "$NOGIVE" ] || bash "$SLOT" give image
echo "$(date +%H:%M) done"
