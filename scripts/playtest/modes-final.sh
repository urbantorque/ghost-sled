#!/usr/bin/env bash
# Round 8, the modes lane: the last captures in one hold of the machine's one browser slot. A mirrored run on every
# mountain (modes-mirror.js) on High and Low, then on the phone (medium), and what a frame costs (glcount.js on Low:
# the round-8 base, this branch plain and mirrored).
#   scripts/playtest/modes-final.sh <branch url> <base url> <abs out> [what: "desk phone cost"]
MINE="$1"; BASE="$2"; OUT="$3"; WHAT="${4:-desk phone cost}"
HERE="$(cd "$(dirname "$0")" && pwd -W)"
S="r8-modes"
SLOT="C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh"
slot=$(bash "$SLOT" take modes); echo "$(date +%H:%M) took $slot"
for w in $WHAT; do
  CFG=.playwright/cli-headless.config.json; [ "$w" = phone ] && CFG=.playwright/mobile-headless.config.json
  playwright-cli -s="$S" open --config="$CFG" >/dev/null 2>&1
  if [ "$w" = cost ]; then
    mkdir -p "$OUT/cost"
    for run in "base|$BASE|" "mine|$MINE|" "mirror|$MINE|&mirror"; do
      IFS='|' read -r tag url q <<< "$run"
      playwright-cli -s="$S" goto "$url" >/dev/null 2>&1
      playwright-cli -s="$S" eval "window.__glCfg = { base: '$url', m: 0, tier: 'low', query: '$q', warm: 6, seconds: 10 }" >/dev/null 2>&1
      timeout 240 playwright-cli -s="$S" --raw run-code --filename="$HERE/glcount.js" > "$OUT/cost/gl-$tag-m0.json" 2>&1
      echo "$(date +%H:%M) gl $tag $(grep -o 'callsPerFrame[^,]*' "$OUT/cost/gl-$tag-m0.json" | head -1)"
    done
  else
    tiers="high low"; [ "$w" = phone ] && tiers="medium"
    for t in $tiers; do
      dir="$OUT/mirror/$t"; [ "$w" = phone ] && dir="$OUT/mirror/phone-$t"
      mkdir -p "$dir"
      for m in 0 1 2 3 4; do
        playwright-cli -s="$S" goto "$MINE" >/dev/null 2>&1
        playwright-cli -s="$S" eval "window.__mirCfg = { base: '$MINE', out: '$dir/', tier: '$t', m: $m, zs: [95, 1535, 4440] }" >/dev/null 2>&1
        timeout 400 playwright-cli -s="$S" --raw run-code --filename="$HERE/modes-mirror.js" > "$dir-m$m.json" 2>&1
        echo "$(date +%H:%M) $w $t m$m $(grep -o 'shots[^}]*' "$dir-m$m.json" | head -1)"
      done
    done
  fi
  playwright-cli -s="$S" close >/dev/null 2>&1
done
bash "$SLOT" give modes
echo done
