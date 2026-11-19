#!/usr/bin/env bash
# Round 8: the laptop blue-screens under load (DECISIONS 365, notes/r8-lanes.md), so lanes share two browser slots.
# Take a slot before opening a playwright browser and give it back when the browser is closed:
#   scripts/playtest/browser-slot.sh take <lane>      waits (up to 40 min) for one of the two slots, prints it
#   scripts/playtest/browser-slot.sh give <lane>      gives back whatever slot <lane> holds
#   scripts/playtest/browser-slot.sh who              lists the slots held, by whom and since when
# A slot is a directory under the main checkout's shots/r8/slots (mkdir is atomic, so two lanes never take the same
# one). A slot held for more than 90 minutes is stale (a lane that died) and may be taken.
SLOTS="C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/slots"
mkdir -p "$SLOTS"
cmd="$1"; lane="$2"
now() { date +%s; }
case "$cmd" in
  take)
    [ -z "$lane" ] && { echo "usage: take <lane>"; exit 1; }
    deadline=$(( $(now) + 2400 ))
    while :; do
      for s in 1 2; do
        d="$SLOTS/slot$s"
        if [ -d "$d" ] && [ -f "$d/owner" ]; then
          since=$(cut -d' ' -f2 "$d/owner" 2>/dev/null || echo 0)
          [ "$(cut -d' ' -f1 "$d/owner")" = "$lane" ] && { echo "slot$s"; exit 0; }
          if [ $(( $(now) - since )) -gt 5400 ]; then rm -rf "$d"; fi
        fi
        if mkdir "$d" 2>/dev/null; then echo "$lane $(now)" > "$d/owner"; echo "slot$s"; exit 0; fi
      done
      [ "$(now)" -gt "$deadline" ] && { echo "no slot free after 40 min"; exit 2; }
      sleep 20
    done ;;
  give)
    for s in 1 2; do
      d="$SLOTS/slot$s"
      [ -f "$d/owner" ] && [ "$(cut -d' ' -f1 "$d/owner")" = "$lane" ] && rm -rf "$d" && echo "gave slot$s"
    done; exit 0 ;;
  who)
    for s in 1 2; do
      d="$SLOTS/slot$s"
      if [ -f "$d/owner" ]; then read -r o t < "$d/owner"; echo "slot$s: $o for $(( ($(now) - t) / 60 )) min"; else echo "slot$s: free"; fi
    done ;;
  *) echo "usage: take|give <lane>, or who"; exit 1 ;;
esac
