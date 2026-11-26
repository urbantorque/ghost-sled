#!/usr/bin/env bash
# Round 9, the shop lane: the garage's place under playwright (r9-shop-place.js) on the dev server at 4960, desk at High
# and Low and the phone held upright, then (optionally) the race-distance sheets, all in the machine's one browser slot
# taken as r9-shop. Frames and the raw results go to the main checkout's shots/r9/shop/place/.
#   scripts/playtest/r9-shop-place.sh [sheet shelves...]
ROOT="$(cd "$(dirname "$0")/../.." && pwd -W)"
OUT="C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/shop/place/"
BASE="${R9_BASE:-http://127.0.0.1:4960/}"
SLOT="C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh"
mkdir -p "$OUT"
# (R9_HELD=1: the caller holds the slot already and gives it back.)
[ -n "$R9_HELD" ] || bash "$SLOT" take r9-shop >/dev/null || { echo "no slot"; exit 2; }
echo "$(date +%H:%M:%S) took the slot"
run() { # form config tag tier
  local S="r9-shop-$1"
  playwright-cli -s="$S" open --config="$ROOT/.playwright/$2" >/dev/null 2>&1
  playwright-cli -s="$S" goto "${BASE}?debug&save=fresh" >/dev/null 2>&1
  sleep 12
  shift 2
  for job in "$@"; do
    tag="${job%%:*}"; tier="${job#*:}"
    playwright-cli -s="$S" goto about:blank >/dev/null 2>&1
    playwright-cli -s="$S" eval "window.__placeCfg = { base: '$BASE', out: '$OUT', tag: '$tag', tier: '$tier' }" >/dev/null 2>&1
    timeout 600 playwright-cli -s="$S" --raw run-code --filename="$ROOT/scripts/playtest/r9-shop-place.js" 2>&1 | grep -v '^[╔║╚]' | grep -v '^$' > "$OUT/raw-$tag.json"
    echo "$(date +%H:%M:%S) $tag $(head -c 400 "$OUT/raw-$tag.json")"
  done
  playwright-cli -s="$S" close >/dev/null 2>&1
}
run desk cli-headless.config.json desk:high desk-low:low
run phone mobile-headless.config.json phone:medium
if [ $# -gt 0 ]; then R9_LANE=r9-shop R9_Z="${R9_Z:-620}" bash "$ROOT/scripts/playtest/r9-shop-sheet.sh" "$@"; fi
[ -n "$R9_HELD" ] || bash "$SLOT" give r9-shop >/dev/null
echo "$(date +%H:%M:%S) gave the slot back"
