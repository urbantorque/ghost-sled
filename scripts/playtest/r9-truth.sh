#!/usr/bin/env bash
# Round 9, the truth lane: parts of r9-truth.js in one headless browser, on the dev server at 4900 (npx vite --port
# 4900 --host 127.0.0.1 --strictPort). Takes the machine's one browser slot as r9-truth and gives it back at the end.
# Each job's raw JSON goes to the main checkout's shots/r9/truth/raw/<form>-<name>.json, its frames beside them;
# r9-screenbars.mjs merges them into shots/r9/truth/<form>.json.
#   scripts/playtest/r9-truth.sh <desk|phone> <name>="<config object literal>" [...]
#   scripts/playtest/r9-truth.sh desk titles-a="{ part: 'titles', stages: ['fresh', 'mid-1'] }"
FORM="$1"; shift
ROOT="$(cd "$(dirname "$0")/../.." && pwd -W)"
OUT="C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/truth/"
BASE="${R9_BASE:-http://127.0.0.1:4900/}"
mkdir -p "$OUT/raw"
CFG="$ROOT/.playwright/cli-headless.config.json"; TIER=high
[ "$FORM" = phone ] && { CFG="$ROOT/.playwright/mobile-headless.config.json"; TIER=medium; }
S="r9-truth"
SLOT="C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh"
bash "$SLOT" take r9-truth >/dev/null || { echo "no slot"; exit 2; }
echo "$(date +%H:%M:%S) took the slot"
playwright-cli -s="$S" open --config="$CFG" >/dev/null 2>&1
# A fresh browser's first loads stall 9 to 13 s: load the origin once before anything is judged.
playwright-cli -s="$S" goto "${BASE}?debug&save=fresh&tier=$TIER" >/dev/null 2>&1
sleep 12
for job in "$@"; do
  name="${job%%=*}"; obj="${job#*=}"
  playwright-cli -s="$S" goto about:blank >/dev/null 2>&1
  playwright-cli -s="$S" eval "window.__t9 = Object.assign({ base: '$BASE', out: '$OUT', tag: '$FORM', tier: '$TIER' }, $obj)" >/dev/null 2>&1
  timeout 1800 playwright-cli -s="$S" --raw run-code --filename="$ROOT/scripts/playtest/r9-truth.js" 2>&1 | grep -v '^[╔║╚]' | grep -v '^$' > "$OUT/raw/$FORM-$name.json"
  echo "$(date +%H:%M:%S) $FORM $name $(head -c 160 "$OUT/raw/$FORM-$name.json")"
done
playwright-cli -s="$S" close >/dev/null 2>&1
bash "$SLOT" give r9-truth >/dev/null
echo "$(date +%H:%M:%S) gave the slot back"
