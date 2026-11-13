#!/usr/bin/env bash
# The hazard read on one build, as one line a mountain and speed (round 7 hero lane).
#   scripts/playtest/read.sh http://127.0.0.1:4430/ r7-hero "0 1 2 3" "30 44" [tier]
BASE="$1"; S="${2:-r7-hero}"; MS="${3:-0 1 2 3}"; SP="${4:-30 44}"; TIER="${5:-high}"
playwright-cli -s="$S" eval "window.__readCfg = { base: '$BASE', speeds: [${SP// /,}], ms: [${MS// /,}], tier: '$TIER' }" >/dev/null 2>&1
playwright-cli -s="$S" --raw run-code --filename=scripts/playtest/readability.js 2>&1 | grep -v '^[╔║╚]' | grep out | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(JSON.parse(s));for(const r of j.out)console.log('m'+r.m,'v'+r.speed,'road',r.roadMed,'min',r.roadMin,'rider',r.riderMed,'row',r.riderRow,'back',r.backMed,'up',r.upMed,'fov',r.fov,JSON.stringify(r.why));if(j.errors.length)console.log('errors',j.errors)})"
