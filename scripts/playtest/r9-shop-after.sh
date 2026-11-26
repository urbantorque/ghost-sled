#!/usr/bin/env bash
# Round 9, the shop lane: the reduced-motion pass and the held run's GL calls in one hold of the machine's browser slot
# (r9-shop-reduced.sh, r9-shop-glv.sh), so no other lane's take falls between them.
#   scripts/playtest/r9-shop-after.sh
ROOT="$(cd "$(dirname "$0")/../.." && pwd -W)"
SLOT="C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh"
bash "$SLOT" take r9-shop >/dev/null || { echo "no slot"; exit 2; }
echo "$(date +%H:%M:%S) took the slot"
R9_HELD=1 bash "$ROOT/scripts/playtest/r9-shop-reduced.sh"
R9_HELD=1 bash "$ROOT/scripts/playtest/r9-shop-glv.sh"
bash "$SLOT" give r9-shop >/dev/null
echo "$(date +%H:%M:%S) gave the slot back"
