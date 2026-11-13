#!/usr/bin/env bash
# Shoots the set pieces' worlds (momentsworld.js) on one tier and device.
#   scripts/playtest/momentsworld.sh <out dir> desk|phone <tier> "<runs json>" ["<only json>"]
OUT="$1"; DEV="${2:-desk}"; TIER="${3:-high}"; RUNS="$4"; ONLY="${5:-null}"
BASE=http://127.0.0.1:4520/
CFG=.playwright/cli-headless.config.json; [ "$DEV" = phone ] && CFG=.playwright/mobile-headless.config.json
S=r7-momentsworld
mkdir -p "$OUT"
playwright-cli -s="$S" open --config="$CFG" >/dev/null 2>&1
playwright-cli -s="$S" goto "$BASE" >/dev/null 2>&1
playwright-cli -s="$S" eval "window.__mwCfg = { base: '$BASE', out: '$OUT', tier: '$TIER', runs: $RUNS, only: $ONLY }" >/dev/null 2>&1
timeout 1500 playwright-cli -s="$S" --raw run-code --filename=scripts/playtest/momentsworld.js 2>&1 | grep -v '^[╔║╚]' | grep -v '^$' > "$OUT/log-$DEV-$TIER-$(date +%H%M%S).json"
playwright-cli -s="$S" close >/dev/null 2>&1
ls "$OUT" | grep -c png
