#!/usr/bin/env bash
# Round 9, the shop lane: the race-distance sheets (r9-shop-sheet.js) in one headless browser on the dev server at
# 4960 (npx vite --port 4960 --host 127.0.0.1 --strictPort). Takes the machine's one browser slot as r9-shop-sheet and
# gives it back at the end. Sheets go to the main checkout's shots/r9/shop/sheet/, each shelf's key to key-<shelf>.json
# beside them (never shown to a critic).
#   scripts/playtest/r9-shop-sheet.sh hats scarves burn
SHELVES="$*"
ROOT="$(cd "$(dirname "$0")/../.." && pwd -W)"
OUT="C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/shop/sheet/"
KEYS="C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/shop/keys/"
BASE="${R9_BASE:-http://127.0.0.1:4960/}"
mkdir -p "$OUT/full" "$KEYS"
CFG="$ROOT/.playwright/cli-headless.config.json"
S="r9-shop-sheet"
SLOT="C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh"
# (R9_HELD=1: the caller holds the slot already and gives it back.)
[ -n "$R9_HELD" ] || bash "$SLOT" take ${R9_LANE:-r9-shop-sheet} >/dev/null || { echo "no slot"; exit 2; }
echo "$(date +%H:%M:%S) took the slot"
playwright-cli -s="$S" open --config="$CFG" >/dev/null 2>&1
# A fresh browser's first loads stall 9 to 13 s: load the origin once before anything is judged.
playwright-cli -s="$S" goto "${BASE}?debug" >/dev/null 2>&1
sleep 12
for shelf in $SHELVES; do
  playwright-cli -s="$S" goto about:blank >/dev/null 2>&1
  playwright-cli -s="$S" eval "window.__sheetCfg = { base: '$BASE', out: '$OUT', shelves: ['$shelf'], z: ${R9_Z:-300}, z0: $(( ${R9_Z:-300} - 100 )) }" >/dev/null 2>&1
  timeout 1800 playwright-cli -s="$S" --raw run-code --filename="$ROOT/scripts/playtest/r9-shop-sheet.js" 2>&1 | grep -v '^[╔║╚]' | grep -v '^$' > "$KEYS/key-$shelf.json"
  echo "$(date +%H:%M:%S) $shelf $(head -c 300 "$KEYS/key-$shelf.json")"
done
playwright-cli -s="$S" close >/dev/null 2>&1
[ -n "$R9_HELD" ] || bash "$SLOT" give ${R9_LANE:-r9-shop-sheet} >/dev/null
echo "$(date +%H:%M:%S) gave the slot back"
