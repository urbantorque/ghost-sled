#!/usr/bin/env bash
# Round 8, the trials lane: the cost against the lane's base, in one browser slot. A Low frame's GL calls on a plain held
# run (lowperf/glv.js) on Pinecrest and Ember, each build in turn, A B B A; then the first frame at 6x on a fresh save
# (firstframe.js), interleaved. Both builds are loaded once first (the machine's browser warms up on its first loads).
#   scripts/playtest/trials-cost.sh <base url> <trials url> <abs out>
A="$1"; B="$2"; OUT="$3"
HERE="$(cd "$(dirname "$0")" && pwd -W)"
MAIN="C:/Users/roger/OneDrive/Desktop/Ghost Sled"
S="r8-trials"
mkdir -p "$OUT"
slot=$(bash "$MAIN/scripts/playtest/browser-slot.sh" take trials); echo "$(date +%H:%M) took $slot"
playwright-cli -s="$S" open --config="$MAIN/.playwright/cli-headless.config.json" >/dev/null 2>&1
for u in "$A" "$B"; do playwright-cli -s="$S" goto "$u?platform=mock" >/dev/null 2>&1; done
for m in 0 2; do
  for u in "$A" "$B" "$B" "$A"; do
    tag=$([ "$u" = "$A" ] && echo base || echo trials)
    playwright-cli -s="$S" goto "$u" >/dev/null 2>&1
    playwright-cli -s="$S" eval "window.__gvCfg = { base: '$u', m: $m, fromZ: 230, toZ: 1230 }" >/dev/null 2>&1
    timeout 600 playwright-cli -s="$S" --raw run-code --filename="$HERE/lowperf/glv.js" >> "$OUT/glv-m$m-$tag.json" 2>&1
    echo "$(date +%H:%M) glv m$m $tag $(grep -o '"callsPerFrame": [0-9.]*' "$OUT/glv-m$m-$tag.json" | tail -1)"
  done
done
playwright-cli -s="$S" goto "$A" >/dev/null 2>&1
playwright-cli -s="$S" eval "window.__ffCfg = { builds: ['$A', '$B'], rounds: 4, throttle: 6, fresh: true }" >/dev/null 2>&1
timeout 900 playwright-cli -s="$S" --raw run-code --filename="$HERE/firstframe.js" > "$OUT/firstframe.json" 2>&1
echo "$(date +%H:%M) firstframe $(tail -c 300 "$OUT/firstframe.json")"
playwright-cli -s="$S" close >/dev/null 2>&1
bash "$MAIN/scripts/playtest/browser-slot.sh" give trials
echo done
