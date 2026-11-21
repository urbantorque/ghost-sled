#!/usr/bin/env bash
# Round 8, the light lane: the cost of a change, before against after, in one browser slot: a Low frame's GL calls
# (glcount.js, exact), and a Low frame's script by system at 6x (systime.js), on the mountains named.
#   scripts/playtest/cost-light.sh <before base> <after base> <abs out dir> "<m m>" [lane]
A="$1"; B="$2"; OUT="$3"; MS="$4"; LANE="${5:-light}"
HERE="$(cd "$(dirname "$0")" && pwd -W)"
S="r8-cost-$LANE"
SL="C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh"
mkdir -p "$OUT"
slot=$(bash "$HERE/slot-take.sh" "$LANE-cost") || { echo "no slot: $slot"; exit 2; }
echo "$(date +%H:%M) took $slot"
playwright-cli -s="$S" open --config=.playwright/cli-headless.config.json >/dev/null 2>&1
for m in $MS; do
  for side in before after; do
    base="$A"; [ "$side" = after ] && base="$B"
    playwright-cli -s="$S" goto "$base" >/dev/null 2>&1
    playwright-cli -s="$S" eval "window.__glCfg = { base: '$base', m: $m, tier: 'low' }" >/dev/null 2>&1
    timeout 300 playwright-cli -s="$S" --raw run-code --filename="$HERE/glcount.js" 2>&1 | grep -v '^[╔║╚]' > "$OUT/gl-$side-m$m.json"
    echo "$(date +%H:%M) gl $side m$m $(grep -o '"callsPerFrame": [0-9.]*' "$OUT/gl-$side-m$m.json")"
  done
done
for side in before after after before; do
  base="$A"; [ "$side" = after ] && base="$B"
  playwright-cli -s="$S" goto "$base" >/dev/null 2>&1
  playwright-cli -s="$S" eval "window.__stCfg = { base: '$base', m: 4, tier: 'low', throttle: 6, warm: 8, seconds: 20 }" >/dev/null 2>&1
  timeout 400 playwright-cli -s="$S" --raw run-code --filename="$HERE/systime.js" 2>&1 | grep -v '^[╔║╚]' >> "$OUT/systime-$side-m4.json"
  echo "$(date +%H:%M) systime $side"
done
playwright-cli -s="$S" close >/dev/null 2>&1
bash "$SL" give "$LANE-cost"
echo done
