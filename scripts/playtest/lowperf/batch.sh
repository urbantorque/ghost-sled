#!/usr/bin/env bash
# The lowperf lane's probes in one browser slot: each line of the jobs file is  script|config js|output file
# (the script's path relative to the worktree, the config evaluated in the page first, the output an absolute path).
# Takes the slot, opens one headless browser (session r8-lowperf), runs the jobs, closes it and gives the slot back.
#   bash scripts/playtest/lowperf/batch.sh <jobs file>
JOBS="$1"
W="$(cd "$(dirname "$0")/../../.." && pwd)"
SL="C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh"
S=r8-lowperf
cd "$W" || exit 1
slot=$(bash "C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/slot-take.sh" lowperf 600) || { echo "no slot: $slot"; exit 2; }
echo "$(date +%H:%M:%S) took $slot"
trap 'playwright-cli -s=$S close >/dev/null 2>&1; bash "$SL" give lowperf; echo "$(date +%H:%M:%S) gave"' EXIT
playwright-cli -s=$S open --config=.playwright/cli-headless.config.json </dev/null >/dev/null 2>&1
while IFS='|' read -r script conf out; do
  [ -z "$script" ] && continue
  case "$script" in \#*) continue ;; esac
  playwright-cli -s=$S goto "http://127.0.0.1:4880/" </dev/null >/dev/null 2>&1
  playwright-cli -s=$S eval "$conf" </dev/null >/dev/null 2>&1
  timeout 1800 playwright-cli -s=$S --raw run-code --filename="$script" </dev/null 2>&1 | grep -v '^[╔║╚]' | grep -v '^$' > "$out"
  echo "$(date +%H:%M:%S) $(basename "$out") $(head -c 200 "$out" | tr '\n' ' ')"
done < "$JOBS"
