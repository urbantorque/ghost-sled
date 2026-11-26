#!/usr/bin/env bash
# Round 9, the shop lane: a held run's GL calls a frame on Low (r9-shop-glv.js, round 8's lowperf/glv.js with a look),
# the round's base build against this lane's, the stock look and dressed ones, Pinecrest z 230 to 1230. The base is
# served from an extract of round-9 at 6255b8d on 4961 (R9_BASE0); this lane's dev server on 4960.
#   scripts/playtest/r9-shop-glv.sh
ROOT="$(cd "$(dirname "$0")/../.." && pwd -W)"
OUT="C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/shop/glv/"
BASE="${R9_BASE:-http://127.0.0.1:4960/}"
BASE0="${R9_BASE0:-http://127.0.0.1:4961/}"
SLOT="C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh"
S="r9-shop-glv"
mkdir -p "$OUT"
# (R9_HELD=1: the caller holds the slot already and gives it back.)
[ -n "$R9_HELD" ] || bash "$SLOT" take r9-shop >/dev/null || { echo "no slot"; exit 2; }
playwright-cli -s="$S" open --config="$ROOT/.playwright/cli-headless.config.json" >/dev/null 2>&1
for b in "$BASE0" "$BASE"; do playwright-cli -s="$S" goto "${b}?debug" >/dev/null 2>&1; sleep 12; done
job() { # name base look
  playwright-cli -s="$S" goto about:blank >/dev/null 2>&1
  playwright-cli -s="$S" eval "window.__gvCfg = { base: '$2', tier: 'low', look: $3 }" >/dev/null 2>&1
  timeout 900 playwright-cli -s="$S" --raw run-code --filename="$ROOT/scripts/playtest/r9-shop-glv.js" 2>&1 | grep -v '^[╔║╚]' | grep -v '^$' > "$OUT/gv-$1.json"
  echo "$(date +%H:%M:%S) $1 $(grep -o '"callsPerFrame": [0-9.]*' "$OUT/gv-$1.json")"
}
job base "$BASE0" null
job stock "$BASE" null
job base2 "$BASE0" null
job stock2 "$BASE" null
job dressed "$BASE" "{ scarf: 'double', hat: 'floppeak', finish: 'snow', tiers: 5, trail: 'kitetails' }"
job pom "$BASE" "{ scarf: 'pomtails', tiers: 4, trail: 'stardust' }"
job comet "$BASE" "{ scarf: 'almanacknot', tiers: 3, trail: 'comet' }"
playwright-cli -s="$S" close >/dev/null 2>&1
[ -n "$R9_HELD" ] || bash "$SLOT" give r9-shop >/dev/null
echo "$(date +%H:%M:%S) done"
