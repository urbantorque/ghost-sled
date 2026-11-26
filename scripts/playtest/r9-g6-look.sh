#!/usr/bin/env bash
# Round 9, the g6 lane (the u4 lane's r9-u4-look.sh): r9-u4-look.js in one headless browser through the slot (as
# g6-look), on this worktree's dev server at 5010. Frames and the run's JSON go to the main checkout's shots/r9/g6/<dir>/.
#   scripts/playtest/r9-g6-look.sh <desk|phone> <dir> "<steps as a JS array literal>"
FORM="$1"; DIR="$2"; STEPS="$3"
ROOT="$(cd "$(dirname "$0")/../.." && pwd -W)"
OUT="C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/g6/$DIR/"
BASE="${R9_BASE:-http://127.0.0.1:5010/}"
mkdir -p "$OUT"
CFG="$ROOT/.playwright/cli-headless.config.json"; TIER=high
[ "$FORM" = phone ] && { CFG="$ROOT/.playwright/mobile-headless.config.json"; TIER=medium; }
S="r9-g6-look"
SLOT="C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh"
bash "$SLOT" take g6-look >/dev/null || { echo "no slot"; exit 2; }
playwright-cli -s="$S" open --config="$CFG" >/dev/null 2>&1
# A fresh browser's first loads stall 9 to 13 s: load the origin once before anything is judged.
playwright-cli -s="$S" goto "${BASE}?debug&save=fresh&tier=$TIER" >/dev/null 2>&1
sleep 12
playwright-cli -s="$S" eval "window.__u4 = { base: '$BASE', out: '$OUT', tag: '$FORM', tier: '$TIER', steps: $STEPS }" >/dev/null 2>&1
timeout 1500 playwright-cli -s="$S" --raw run-code --filename="$ROOT/scripts/playtest/r9-u4-look.js" 2>&1 | grep -v '^[╔║╚]' | grep -v '^$' > "$OUT/$FORM.json"
playwright-cli -s="$S" close >/dev/null 2>&1
bash "$SLOT" give g6-look >/dev/null
head -c 3000 "$OUT/$FORM.json"; echo
