#!/usr/bin/env bash
# Round 8, the light lane: any playtest run-code scripts in one browser slot, one session. Each job line of the file
# is "<window var>|<config object literal>|<script under scripts/playtest>|<abs output file>".
#   scripts/playtest/batch.sh <jobs file> [desk|phone] [lane]
JOBS="$1"; DEV="${2:-desk}"; LANE="${3:-light}"
HERE="$(cd "$(dirname "$0")" && pwd -W)"
CFG=.playwright/cli-headless.config.json; [ "$DEV" = phone ] && CFG=.playwright/mobile-headless.config.json
S="r8-batch-$LANE"
slot=$(bash "$HERE/slot-take.sh" "$LANE-batch") || { echo "no slot: $slot"; exit 2; }
echo "$(date +%H:%M) took $slot"
playwright-cli -s="$S" open --config="$CFG" >/dev/null 2>&1
while IFS='|' read -r var obj script out; do
  [ -z "$var" ] && continue
  case "$var" in \#*) continue ;; esac
  mkdir -p "$(dirname "$out")"
  playwright-cli -s="$S" goto "about:blank" >/dev/null 2>&1
  playwright-cli -s="$S" eval "window.$var = $obj" >/dev/null 2>&1
  timeout 900 playwright-cli -s="$S" --raw run-code --filename="$HERE/$script" 2>&1 | grep -v '^[╔║╚]' | grep -v '^$' > "$out"
  echo "$(date +%H:%M) $script $(head -c 240 "$out")"
done < "$JOBS"
playwright-cli -s="$S" close >/dev/null 2>&1
bash "C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh" give "$LANE-batch"
echo done
