#!/usr/bin/env bash
# Round 9, the shop lane: everything that needs the browser in one hold of the machine's one slot: the place on a desk
# (High, Low) and a phone with the race-distance sheets named (r9-shop-place.sh), the place under reduced motion
# (r9-shop-reduced.sh), and a held run's GL calls on Low (r9-shop-glv.sh).
#   R9_Z=470 scripts/playtest/r9-shop-all.sh hats scarves ...
ROOT="$(cd "$(dirname "$0")/../.." && pwd -W)"
SLOT="C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh"
bash "$SLOT" take r9-shop >/dev/null || { echo "no slot"; exit 2; }
echo "$(date +%H:%M:%S) took the slot"
R9_HELD=1 bash "$ROOT/scripts/playtest/r9-shop-place.sh" "$@"
R9_HELD=1 bash "$ROOT/scripts/playtest/r9-shop-reduced.sh"
R9_HELD=1 bash "$ROOT/scripts/playtest/r9-shop-glv.sh"
bash "$SLOT" give r9-shop >/dev/null
echo "$(date +%H:%M:%S) gave the slot back"
