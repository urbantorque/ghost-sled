#!/usr/bin/env bash
# Round 7's before and after contact sheets: round 6's fixed frames (shots/r7/before, taken as the round began) beside
# the final build's (shots/r7/final), at the same distances, a mountain and a tier a sheet; Lanternfall, new this
# round, has after sheets only. Tiles are labelled r6-/r7- so the pairs read left to right.
#   scripts/playtest/round-sheets.sh shots/r7/before shots/r7/final shots/r7/sheets
BEFORE="$1"; AFTER="$2"; OUT="$3"
mkdir -p "$OUT"
TMP="$OUT/.tiles"
for tier in high low phone-medium; do
  for m in 0 1 2 3 4; do
    rm -rf "$TMP"; mkdir -p "$TMP"
    list=()
    for f in "$AFTER/$tier"/m$m-z*.png; do
      [ -f "$f" ] || continue
      b="$(basename "$f")"
      if [ "$m" != 4 ] && [ -f "$BEFORE/$tier/$b" ]; then
        cp "$BEFORE/$tier/$b" "$TMP/r6-$b"
        list+=("$TMP/r6-$b")
      fi
      cp "$f" "$TMP/r7-$b"
      list+=("$TMP/r7-$b")
    done
    [ ${#list[@]} -gt 0 ] || continue
    cols=6; width=2400
    [ "$tier" = phone-medium ] && cols=10 && width=2400
    [ "$m" = 4 ] && cols=$((cols / 2))
    # (At most 40 tiles a sheet: the tiler holds every frame in one page, and more than that closed the browser.)
    part=0
    for ((i = 0; i < ${#list[@]}; i += 40)); do
      part=$((part + 1))
      node scripts/playtest/tile.mjs "$OUT/m$m-$tier-$part.png" "$cols" "$width" "${list[@]:i:40}" >/dev/null
    done
    echo "m$m $tier: ${#list[@]} tiles in $part sheets"
  done
done
rm -rf "$TMP"
