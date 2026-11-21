#!/usr/bin/env bash
# Round 8 (image): the image lane's strips in motion. For each variant (a tag and the URL switches it adds) and
# each mountain, speedstrips.js rides the pool rider as the player on a virtual clock from a fresh save to each
# strip's metre and shoots `n` frames `every` ticks apart (1: consecutive frames, so a crawl shows from frame to
# frame). Frames go to `<out>/<tag>/frames/`; image-tile.mjs crops and tiles them. Takes a browser slot for its
# whole run and gives it back.
#   scripts/playtest/image-strips.sh <base> <abs out> "<tag>=<extra> ..." [mountains] [n] [every] [tier]
#   scripts/playtest/image-strips.sh http://127.0.0.1:4860/ "C:/.../shots/r8/image/s1" "base= taa=&taa" "0 1 2 3 4" 8 1
BASE="$1"; OUT="$2"; VARIANTS="$3"; MS="${4:-0 1 2 3 4}"; N="${5:-8}"; EVERY="${6:-1}"; TIER="${7:-high}"
HERE="$(cd "$(dirname "$0")" && pwd -W)"
SLOT="C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh"
S="r8-image"
# The strips' metres, a mountain each: thin things (trees, cables, bunting, rails), what moves on its own (lifts,
# gondolas, lamps, flags) and round 8's motion (a dash at flow 6 on Pinecrest at 290 m).
zs() {
  case "$1" in
    0) echo "[290, 900, 1763, 3464]" ;;
    1) echo "[1045, 2405]" ;;
    2) echo "[2441]" ;;
    3) echo "[1301, 2580]" ;;
    4) echo "[2209, 3500]" ;;
  esac
}
slot=$(bash "$SLOT" take image) || { echo "$(date +%H:%M) no slot: $slot"; exit 2; }; echo "$(date +%H:%M) took $slot"
playwright-cli -s="$S" open --config=.playwright/cli-headless.config.json >/dev/null 2>&1
for v in $VARIANTS; do
  tag="${v%%=*}"; extra="${v#*=}"
  dir="$OUT/$tag/frames"; mkdir -p "$dir"
  for m in $MS; do
    playwright-cli -s="$S" goto "$BASE" >/dev/null 2>&1
    playwright-cli -s="$S" eval "window.__stripsCfg = { base: '$BASE', out: '$dir/', tier: '$TIER', m: $m, demo: 0, zs: $(zs "$m"), n: $N, every: $EVERY, extra: '$extra' }" >/dev/null 2>&1
    timeout 1200 playwright-cli -s="$S" --raw run-code --filename="$HERE/speedstrips.js" 2>&1 | grep -v '^[╔║╚]' | grep -v '^$' > "$OUT/$tag/m$m.json"
    echo "$(date +%H:%M) $tag m$m $(ls "$dir" | grep -c "^m$m-")"
  done
done
playwright-cli -s="$S" close >/dev/null 2>&1
bash "$SLOT" give image
echo done
