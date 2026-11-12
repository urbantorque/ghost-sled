#!/usr/bin/env bash
# Runs scripts/playtest/pipe.js with a config read from a JSON file (see pipe.js for its shape), in the
# pipe lane's own headless session, and prints the report.
#   scripts/playtest/pipe.sh cfg.json [desk|phone]
CFG_JSON="$1"; DEV="${2:-desk}"
CFG=.playwright/cli-headless.config.json; [ "$DEV" = phone ] && CFG=.playwright/mobile-headless.config.json
S="r7-pipe"
BASE="$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).base||'http://127.0.0.1:4410/')" "$CFG_JSON")"
playwright-cli -s="$S" open --config="$CFG" >/dev/null 2>&1
playwright-cli -s="$S" goto "$BASE" >/dev/null 2>&1
playwright-cli -s="$S" eval "window.__pipeCfg = $(cat "$CFG_JSON")" >/dev/null 2>&1
timeout 900 playwright-cli -s="$S" --raw run-code --filename=scripts/playtest/pipe.js 2>&1 | grep -v '^[╔║╚]' | grep -v '^$'
playwright-cli -s="$S" close >/dev/null 2>&1
