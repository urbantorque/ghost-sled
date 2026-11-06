#!/bin/sh
# Runs places-cost.js against a build and prints a line a probe: cost-run.sh <port> <tag> "<jobs>"
playwright-cli -s=lane-places eval "window.__costCfg = { base: 'http://127.0.0.1:$1/', tag: '$2', jobs: [$3] }" >/dev/null 2>&1
timeout 280 playwright-cli -s=lane-places run-code --filename=scripts/playtest/places-cost.js 2>&1 | grep -A1 '### Result' | tail -1 | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const r=JSON.parse(JSON.parse(s));for(const o of r.out)console.log(JSON.stringify(o));if(r.errors.length)console.log(r.errors)}catch(e){console.log('bad',s.slice(0,300))}})"
