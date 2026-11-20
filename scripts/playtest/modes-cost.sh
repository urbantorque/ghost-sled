#!/usr/bin/env bash
# Round 8, the modes lane: what the modes cost a frame. glcount.js (every GL call, exact) on Low, the round-8 base
# against this branch plain and mirrored, and systime.js (each system's ms, Low at 6x) base against this branch.
#   scripts/playtest/modes-cost.sh <base url> <branch url> <abs out> [mountains]
BASE="$1"; MINE="$2"; OUT="$3"; MS="${4:-0 2}"
HERE="$(cd "$(dirname "$0")" && pwd -W)"
CFG=.playwright/cli-headless.config.json
S="r8-modes"
mkdir -p "$OUT"
slot=$(bash "C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh" take modes); echo "$(date +%H:%M) took $slot"
playwright-cli -s="$S" open --config="$CFG" >/dev/null 2>&1
for m in $MS; do
  for run in "base|$BASE|" "mine|$MINE|" "mirror|$MINE|&mirror"; do
    IFS='|' read -r tag url q <<< "$run"
    playwright-cli -s="$S" goto "$url" >/dev/null 2>&1
    playwright-cli -s="$S" eval "window.__glCfg = { base: '$url', m: $m, tier: 'low', query: '$q', warm: 8, seconds: 12 }" >/dev/null 2>&1
    timeout 300 playwright-cli -s="$S" --raw run-code --filename="$HERE/glcount.js" > "$OUT/gl-$tag-m$m.json" 2>&1
    echo "$(date +%H:%M) gl $tag m$m $(grep -o '"callsPerFrame": [0-9.]*' "$OUT/gl-$tag-m$m.json")"
  done
done
for run in "base|$BASE" "mine|$MINE"; do
  IFS='|' read -r tag url <<< "$run"
  playwright-cli -s="$S" goto "$url" >/dev/null 2>&1
  playwright-cli -s="$S" eval "window.__stCfg = { base: '$url', m: 3, tier: 'low', throttle: 6, warm: 8, seconds: 20 }" >/dev/null 2>&1
  timeout 400 playwright-cli -s="$S" --raw run-code --filename="$HERE/systime.js" > "$OUT/systime-$tag.json" 2>&1
  echo "$(date +%H:%M) systime $tag $(head -c 400 "$OUT/systime-$tag.json")"
done
playwright-cli -s="$S" close >/dev/null 2>&1
bash "C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh" give modes
echo done
