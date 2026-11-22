#!/usr/bin/env bash
# Round 8, review lane m4 (Lanternfall): one pass of the critic loop's captures on a served build.
#   bash scripts/playtest/rev4-pass.sh <pass number> [base]
# The fixed frames as stills (High and Low at 1280x720, the phone on Medium; stills.sh takes and gives the browser
# slot itself), then, in the lane's own slot, strips in motion at the vistas and set pieces with the finish through the
# results (rev4-motion.js), the Great Rising's strips at the break, and the contact sheets the critic reads.
K="$1"; BASE="${2:-http://127.0.0.1:4874/}"
ROOT="C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/review/m4"
OUT="$ROOT/pass$K"
HERE="$(cd "$(dirname "$0")" && pwd -W)"
SLOT="C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh"
mkdir -p "$OUT"
cd "$HERE/../.." || exit 1
bash scripts/playtest/stills.sh "$BASE" "$OUT" desk "high low" "4" rev4
bash scripts/playtest/stills.sh "$BASE" "$OUT" phone "medium" "4" rev4
slot=$(bash "$SLOT" take rev4) || { echo "no slot: $slot"; exit 2; }; echo "$(date +%H:%M) took $slot"
S=r8-rev4
mkdir -p "$OUT/motion" "$OUT/rising"
playwright-cli -s="$S" open --config=.playwright/cli-headless.config.json >/dev/null 2>&1
playwright-cli -s="$S" goto "$BASE" >/dev/null 2>&1
playwright-cli -s="$S" eval "window.__revCfg = { base: '$BASE', out: '$OUT/motion/', tier: 'high', m: 4, zs: [80, 450, 565, 1000, 1300, 1460, 1600, 1690, 1730, 2209, 2600, 3297, 3500, 3950, 4300], fin: [400, 1200, 2200, 3400, 4500, 6000] }" >/dev/null 2>&1
timeout 1500 playwright-cli -s="$S" --raw run-code --filename="$HERE/rev4-motion.js" 2>&1 | grep -v '^[╔║╚]' | grep -v '^$' > "$OUT/motion.json"
echo "$(date +%H:%M) motion $(ls "$OUT/motion" | wc -l)"
playwright-cli -s="$S" goto "$BASE" >/dev/null 2>&1
playwright-cli -s="$S" eval "window.__revCfg = { base: '$BASE', out: '$OUT/rising/', tier: 'high', m: 4, zs: [1600, 1730], fin: [], extra: '&legend=1' }" >/dev/null 2>&1
timeout 900 playwright-cli -s="$S" --raw run-code --filename="$HERE/rev4-motion.js" 2>&1 | grep -v '^[╔║╚]' | grep -v '^$' > "$OUT/rising.json"
echo "$(date +%H:%M) rising $(ls "$OUT/rising" | wc -l)"
playwright-cli -s="$S" close >/dev/null 2>&1
# The sheets (tile.mjs opens a browser of its own: still inside the slot, after the capture's is closed).
mkdir -p "$OUT/sheets"
node scripts/playtest/speedstrips-tile.mjs "$OUT/motion" "$OUT/sheets/strips" >/dev/null 2>&1
node scripts/playtest/speedstrips-tile.mjs "$OUT/rising" "$OUT/sheets/rising" >/dev/null 2>&1
for tier in low phone-medium; do
  files=("$OUT/$tier"/m4-*.png); n=${#files[@]}; i=0; s=1
  cols=2; w=1280; [ "$tier" = phone-medium ] && cols=4
  while [ $i -lt $n ]; do
    node scripts/playtest/tile.mjs "$OUT/sheets/$tier-$(printf %02d $s).png" $cols $w "${files[@]:$i:4}" >/dev/null 2>&1
    i=$((i + 4)); s=$((s + 1))
  done
done
fin=("$OUT/motion"/m4-fin-*.png)
node scripts/playtest/tile.mjs "$OUT/sheets/finish.png" 2 1280 "${fin[@]}" >/dev/null 2>&1
bash "$SLOT" give rev4
echo "$(date +%H:%M) done"
