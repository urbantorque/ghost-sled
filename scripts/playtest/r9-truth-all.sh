#!/usr/bin/env bash
# Round 9, the truth lane: every capture r9-truth.js makes, for one form factor, in one hold of the browser slot (about
# 40 minutes). The challenge link rides a Pinecrest pool rider's record (Elif-346, a mid-field finish).
#   bash scripts/playtest/r9-truth-all.sh <desk|phone> [titles,results,sheets,again,crawl]
FORM="${1:-desk}"
PARTS=",${2:-titles,results,sheets,again,crawl},"
HERE="$(cd "$(dirname "$0")" && pwd -W)"
LINK="$(node -e "const j=require('$HERE/../../src/data/ghosts/pinecrest.json');process.stdout.write(j.ghosts.find((g)=>g.name==='Elif-346').record)")"
jobs=()
case "$PARTS" in *,titles,*)
  jobs+=("titles=\"{ part: 'titles', stages: ['fresh', 'mid-1', 'mid-5', 'mid-20', 'mid-50', 'mid-100', 'novice-1', 'novice-5', 'novice-20', 'novice-50', 'novice-100'], link: '$LINK', linkStages: ['fresh', 'mid-20'] }\"") ;;
esac
case "$PARTS" in *,results,*)
  for s in "first fresh" "crash mid-5" "duel-won mid-20" "duel-lost mid-20" "daily mid-20" "cup mid-50" "night mid-50" "trial mid-100"; do
    set -- $s
    jobs+=("results-$1=\"{ part: 'results', scenario: '$1', stages: ['$2'] }\"")
  done ;;
esac
case "$PARTS" in *,sheets,*)
  for st in mid-50 mid-5 mid-20 mid-100 mid-1 novice-50; do jobs+=("sheets-$st=\"{ part: 'sheets', stages: ['$st'] }\""); done ;;
esac
case "$PARTS" in *,again,*) jobs+=("again=\"{ part: 'again', stages: ['fresh'], n: 5 }\"") ;; esac
case "$PARTS" in *,crawl,*) for st in mid-50 mid-5; do jobs+=("crawl-$st=\"{ part: 'crawl', stages: ['$st'] }\""); done ;; esac
eval "bash \"$HERE/r9-truth.sh\" $FORM ${jobs[*]}"
