#!/usr/bin/env bash
# Round 8, the modes lane: the last check in one hold of the browser slot. Low's canvas figures plain against mirrored
# (the DOM shown), a two-leg night's beat, and Low's GL calls on this branch plain once more.
#   scripts/playtest/modes-last.sh <branch url> <abs out>
MINE="$1"; OUT="$2"
HERE="$(cd "$(dirname "$0")" && pwd -W)"
S="r8-modes"
SLOT="C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh"
slot=$(bash "$SLOT" take modes); echo "$(date +%H:%M) took $slot"
playwright-cli -s="$S" open --config=.playwright/cli-headless.config.json >/dev/null 2>&1
mkdir -p "$OUT/figs/plain" "$OUT/figs/mirror" "$OUT/night-last" "$OUT/cost"
for run in "plain|" "mirror|&mirror"; do
  IFS='|' read -r tag q <<< "$run"
  playwright-cli -s="$S" goto "$MINE" >/dev/null 2>&1
  playwright-cli -s="$S" eval "window.__mirCfg = { base: '$MINE', out: '$OUT/figs/$tag/', tier: 'low', m: 0, zs: [1535, 4440], extra: '$q' }" >/dev/null 2>&1
  timeout 400 playwright-cli -s="$S" --raw run-code --filename="$HERE/modes-mirror.js" > "$OUT/figs/$tag.json" 2>&1
  echo "$(date +%H:%M) figs $tag $(grep -o 'shots[^}]*' "$OUT/figs/$tag.json" | head -1)"
done
playwright-cli -s="$S" goto "$MINE" >/dev/null 2>&1
playwright-cli -s="$S" eval "window.__nightCfg = { base: '$MINE', out: '$OUT/night-last/', tier: 'high', legs: 2 }" >/dev/null 2>&1
timeout 900 playwright-cli -s="$S" --raw run-code --filename="$HERE/modes-night.js" > "$OUT/night-last/night.json" 2>&1
echo "$(date +%H:%M) night $(wc -c < "$OUT/night-last/night.json")"
playwright-cli -s="$S" goto "$MINE" >/dev/null 2>&1
playwright-cli -s="$S" eval "window.__glCfg = { base: '$MINE', m: 0, tier: 'low', query: '', warm: 6, seconds: 10 }" >/dev/null 2>&1
timeout 240 playwright-cli -s="$S" --raw run-code --filename="$HERE/glcount.js" > "$OUT/cost/gl-mine2-m0.json" 2>&1
echo "$(date +%H:%M) gl mine2 $(grep -o 'callsPerFrame[^,]*' "$OUT/cost/gl-mine2-m0.json" | head -1)"
playwright-cli -s="$S" close >/dev/null 2>&1
bash "$SLOT" give modes
echo done
