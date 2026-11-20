#!/usr/bin/env bash
# Round 8, the light lane: stills.js (a pool rider replayed on a virtual clock) at distances you name, for looking at
# a change between full stills.sh runs. Every job runs in one browser slot, held only while it shoots.
#   scripts/playtest/stills-at.sh <base> <abs out dir> <desk|phone> <tier> "<m>:<z,z,z> <m>:<z,z>" [lane] [extra url params] ["<m m>" finish.js too]
BASE="$1"; OUT="$2"; DEV="$3"; T="$4"; JOBS="$5"; LANE="${6:-light}"; EXTRA="${7:-}"; FIN="${8:-}"
HERE="$(cd "$(dirname "$0")" && pwd -W)"
CFG=.playwright/cli-headless.config.json; [ "$DEV" = phone ] && CFG=.playwright/mobile-headless.config.json
S="r8-at-$LANE"
SL="C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh"
mkdir -p "$OUT"
slot=$(bash "$HERE/slot-take.sh" "$LANE-at") || { echo "no slot: $slot"; exit 2; }
echo "$(date +%H:%M) took $slot"
playwright-cli -s="$S" open --config="$CFG" >/dev/null 2>&1
for job in $JOBS; do
  M="${job%%:*}"; ZS="${job#*:}"
  playwright-cli -s="$S" goto "$BASE" >/dev/null 2>&1
  playwright-cli -s="$S" eval "window.__stillsCfg = { base: '$BASE', out: '$OUT/', tier: '$T', m: $M, demo: 0, zs: [$ZS], extra: '$EXTRA' }" >/dev/null 2>&1
  timeout 900 playwright-cli -s="$S" --raw run-code --filename="$HERE/stills.js" 2>&1 | grep -v '^[╔║╚]' | grep -v '^$' > "$OUT/m$M-$T.json"
  echo "$(date +%H:%M) m$M $(head -c 300 "$OUT/m$M-$T.json")"
done
if [ -n "$FIN" ]; then
  J="[$(for m in $FIN; do printf "{ m: %s, mood: 0 }," "$m"; done)]"
  playwright-cli -s="$S" goto "$BASE" >/dev/null 2>&1
  playwright-cli -s="$S" eval "window.__finishCfg = { base: '$BASE', out: '$OUT/fin-', tier: '$T', jobs: $J }" >/dev/null 2>&1
  timeout 900 playwright-cli -s="$S" --raw run-code --filename="$HERE/finish.js" 2>&1 | grep -v "^[╔║╚]" | grep -v "^$" > "$OUT/finish-$T.json"
  echo "$(date +%H:%M) finish $(head -c 300 "$OUT/finish-$T.json")"
fi
playwright-cli -s="$S" close >/dev/null 2>&1
bash "$SL" give "$LANE-at"
echo done
