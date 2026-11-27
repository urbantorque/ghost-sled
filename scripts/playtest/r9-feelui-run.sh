#!/usr/bin/env bash
# Round 9, the feelui lane: one run-code script (r9-u4-look.js, r9-feelui-reel.js) in one headless browser through the
# slot as feelui-look, on this worktree's dev server at 5050. Its config goes in as window.<var>; its JSON to <json>.
#   scripts/playtest/r9-feelui-run.sh <desk|phone> <script.js> <var> "<config object literal>" <json file>
#   scripts/playtest/r9-feelui-run.sh desk scripts/playtest/r9-feelui-reel.js __rl "{ out: 'C:/.../reel/before/', stage: 'mid-50' }" C:/.../reel/before/desk.json
FORM="$1"; SCRIPT="$2"; VAR="$3"; CONF="$4"; JSON="$5"
ROOT="$(cd "$(dirname "$0")/../.." && pwd -W)"
BASE="${R9_BASE:-http://127.0.0.1:5050/}"
CFG="$ROOT/.playwright/cli-headless.config.json"; TIER=high
[ "$FORM" = phone ] && { CFG="$ROOT/.playwright/mobile-headless.config.json"; TIER=medium; }
S="r9-feelui"
SLOT="C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh"
bash "$SLOT" take feelui-look >/dev/null || { echo "no slot"; exit 2; }
echo "$(date +%H:%M:%S) took the slot"
playwright-cli -s="$S" open --config="$CFG" >/dev/null 2>&1
# A fresh browser's first loads stall 9 to 13 s: load the origin once before anything is judged.
playwright-cli -s="$S" goto "${BASE}?debug&save=fresh&tier=$TIER" >/dev/null 2>&1
sleep 12
playwright-cli -s="$S" eval "window.$VAR = Object.assign({ base: '$BASE', tag: '$FORM', tier: '$TIER' }, $CONF)" >/dev/null 2>&1
case "$SCRIPT" in /*|?:*) P="$SCRIPT" ;; *) P="$ROOT/$SCRIPT" ;; esac
timeout 1500 playwright-cli -s="$S" --raw run-code --filename="$P" 2>&1 | grep -v '^[╔║╚]' | grep -v '^$' > "$JSON"
playwright-cli -s="$S" close >/dev/null 2>&1
bash "$SLOT" give feelui-look >/dev/null
echo "$(date +%H:%M:%S) gave the slot back"
head -c 1500 "$JSON"; echo
