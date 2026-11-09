#!/usr/bin/env bash
# The round 5 and 6 telemetry plan in small batches (one pilot a batch, one fresh run a mountain, on Low), so one
# failed page load costs a batch, not the lot. Serve the build first.
#   scripts/playtest/tele-batch.sh http://127.0.0.1:4310/ shots/r6/tele/before [session]
BASE="$1"
OUT="$2"
S="${3:-tele}"
mkdir -p "$OUT"
playwright-cli -s="$S" open --config=.playwright/cli-headless.config.json >/dev/null 2>&1
for p in clumsy novice mid expert stunt; do
  PLAN="[{skill:'$p',runs:1,fresh:true,m:0,tier:'low'},{skill:'$p',runs:1,fresh:true,m:1,tier:'low'},{skill:'$p',runs:1,fresh:true,m:2,tier:'low'},{skill:'$p',runs:1,fresh:true,m:3,tier:'low'}]"
  playwright-cli -s="$S" goto "$BASE" >/dev/null 2>&1
  playwright-cli -s="$S" eval "window.__teleCfg = { base: '$BASE', label: '$p', lean: true, plan: $PLAN }" >/dev/null 2>&1
  playwright-cli -s="$S" run-code --filename=scripts/playtest/telemetry.js > "$OUT/$p.txt" 2>&1
done
playwright-cli -s="$S" close >/dev/null 2>&1
echo done
