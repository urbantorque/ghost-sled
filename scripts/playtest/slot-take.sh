#!/usr/bin/env bash
# Round 8, the light lane: takes the one browser slot (two until 21 November) exactly as browser-slot.sh does (an atomic mkdir under
# the main checkout's shots/r8/slots, the same owner file, the same stale rule), asking every 0.3 s rather than
# every 20 s, so a lane that takes and gives back in a tight loop does not hold both slots between its own turns. Prints
# the slot; give it back with browser-slot.sh give <lane>.
#   scripts/playtest/slot-take.sh <lane> [minutes]
SLOTS="C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/slots"
lane="$1"; deadline=$(( $(date +%s) + ${2:-60} * 60 ))
mkdir -p "$SLOTS"
while :; do
  for s in 1; do  # one browser on the machine since the 21 November crash with two
    d="$SLOTS/slot$s"
    if [ -f "$d/owner" ]; then
      [ "$(cut -d' ' -f1 "$d/owner")" = "$lane" ] && { echo "slot$s"; exit 0; }
      since=$(cut -d' ' -f2 "$d/owner" 2>/dev/null || echo 0)
      [ $(( $(date +%s) - since )) -gt 5400 ] && rm -rf "$d"
    fi
    if mkdir "$d" 2>/dev/null; then echo "$lane $(date +%s)" > "$d/owner"; echo "slot$s"; exit 0; fi
  done
  [ "$(date +%s)" -gt "$deadline" ] && { echo "no slot"; exit 2; }
  sleep 0.3
done
