#!/usr/bin/env bash
# Round 9, the shop lane: the garage's place under reduced motion (r9-shop-place.js with reduced: true), on a desk at
# High, in the machine's one browser slot taken as r9-shop. Frames to the main checkout's shots/r9/shop/place/
# (desk-reduced-*), the raw result beside them.
#   scripts/playtest/r9-shop-reduced.sh
ROOT="$(cd "$(dirname "$0")/../.." && pwd -W)"
OUT="C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/shop/place/"
BASE="${R9_BASE:-http://127.0.0.1:4960/}"
SLOT="C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh"
S="r9-shop-reduced"
# (R9_HELD=1: the caller holds the slot already and gives it back.)
[ -n "$R9_HELD" ] || bash "$SLOT" take r9-shop >/dev/null || { echo "no slot"; exit 2; }
echo "$(date +%H:%M:%S) took the slot"
playwright-cli -s="$S" open --config="$ROOT/.playwright/cli-headless.config.json" >/dev/null 2>&1
playwright-cli -s="$S" goto "${BASE}?debug&save=fresh" >/dev/null 2>&1
sleep 12
playwright-cli -s="$S" goto about:blank >/dev/null 2>&1
playwright-cli -s="$S" eval "window.__placeCfg = { base: '$BASE', out: '$OUT', tag: 'desk-reduced', tier: 'high', reduced: true }" >/dev/null 2>&1
timeout 600 playwright-cli -s="$S" --raw run-code --filename="$ROOT/scripts/playtest/r9-shop-place.js" 2>&1 | grep -v '^[╔║╚]' | grep -v '^$' > "$OUT/raw-desk-reduced.json"
echo "$(date +%H:%M:%S) desk-reduced $(head -c 300 "$OUT/raw-desk-reduced.json")"
playwright-cli -s="$S" close >/dev/null 2>&1
[ -n "$R9_HELD" ] || bash "$SLOT" give r9-shop >/dev/null
echo "$(date +%H:%M:%S) gave the slot back"
