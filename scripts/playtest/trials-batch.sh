#!/usr/bin/env bash
# Round 8, the trials lane: the browser slot taken once for a list of Trial passes (trials-ui.js), each "device:tier:week:demo",
# then closed and given back.
#   scripts/playtest/trials-batch.sh <base> <abs out> "desk:high:2026-W48:12 phone:medium:2026-W51:9"
BASE="$1"; OUT="$2"; PASSES="$3"
HERE="$(cd "$(dirname "$0")" && pwd -W)"
MAIN="C:/Users/roger/OneDrive/Desktop/Ghost Sled"
S="r8-trials"
mkdir -p "$OUT"
slot=$(bash "$MAIN/scripts/playtest/browser-slot.sh" take trials); echo "$(date +%H:%M) took $slot"
open=""
for p in $PASSES; do
  IFS=: read -r dev tier week demo <<< "$p"
  cfg="$MAIN/.playwright/cli-headless.config.json"; [ "$dev" = phone ] && cfg="$MAIN/.playwright/mobile-headless.config.json"
  if [ "$open" != "$dev" ]; then
    [ -n "$open" ] && playwright-cli -s="$S" close >/dev/null 2>&1
    playwright-cli -s="$S" open --config="$cfg" >/dev/null 2>&1
    open="$dev"
  fi
  playwright-cli -s="$S" goto "$BASE" >/dev/null 2>&1
  playwright-cli -s="$S" eval "window.__trCfg = { base: '$BASE', out: '$OUT/', tier: '$tier', tag: '$dev-$tier', week: '$week', demo: $demo }" >/dev/null 2>&1
  timeout 900 playwright-cli -s="$S" --raw run-code --filename="$HERE/trials-ui.js" > "$OUT/$dev-$tier-$week.json" 2>&1
  echo "$(date +%H:%M) $p $(head -c 300 "$OUT/$dev-$tier-$week.json")"
done
playwright-cli -s="$S" close >/dev/null 2>&1
bash "$MAIN/scripts/playtest/browser-slot.sh" give trials
echo done
