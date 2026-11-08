#!/bin/sh
# The contact sheets: every street, bridge, tunnel, finish and start on all four mountains by day, and one
# night mood. Each mountain is a run of its own: run-code has a time limit.
#   sh scripts/playtest/sheets.sh <out dir under shots/>
OUT=${1:-sheets}
mkdir -p "shots/$OUT/day" "shots/$OUT/night"
KINDS="['start', 'village', 'viaduct', 'gallery', 'lavatunnel', 'toriirow', 'finish', 'lift', 'lip']"
for m in 0 1 2 3; do
  playwright-cli -s=lane-places eval "window.__placesCfg = { out: 'shots/$OUT/day/', jobs: [{ m: $m, mood: 0, kinds: $KINDS }] }" >/dev/null 2>&1
  timeout 400 playwright-cli -s=lane-places run-code --filename=scripts/playtest/places.js 2>&1 | grep -o 'errors.*' | tail -1 | cut -c1-200
done
for m in 0 1 2 3; do
  playwright-cli -s=lane-places eval "window.__placesCfg = { out: 'shots/$OUT/night/', jobs: [{ m: $m, mood: 2, kinds: ['village', 'viaduct', 'finish', 'toriirow', 'lavatunnel'] }] }" >/dev/null 2>&1
  timeout 300 playwright-cli -s=lane-places run-code --filename=scripts/playtest/places.js 2>&1 | grep -o 'errors.*' | tail -1 | cut -c1-200
done
node scripts/playtest/sheet.mjs "shots/$OUT/day.html" 4 "shots/$OUT/day"
node scripts/playtest/sheet.mjs "shots/$OUT/night.html" 4 "shots/$OUT/night"
