#!/usr/bin/env bash
# One whole review pass for Lanternfall on the build being served: the fixed 35 on High, Low and the phone
# (Medium), then review-m4.sh's motion strips and legends. One browser at a time.
#   scripts/playtest/review-m4-all.sh http://127.0.0.1:4534/ "C:/.../shots/r7/review/m4/pass2"
BASE="$1"; OUT="$2"; export FRAMES_SESSION="${FRAMES_SESSION:-r7-review-m4}"
bash scripts/playtest/frames.sh "$BASE" "$OUT" desk "high low" "4"
bash scripts/playtest/frames.sh "$BASE" "$OUT" phone "medium" "4"
bash scripts/playtest/review-m4.sh "$BASE" "$OUT" high 1
for t in high low phone-medium; do echo "$t: $(node scripts/playtest/lanternworld-digest.mjs "$OUT/$t-m4.json" | head -1)"; done
echo ALLDONE
