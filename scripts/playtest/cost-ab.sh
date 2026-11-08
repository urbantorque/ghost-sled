#!/bin/sh
# Old build, new build, new, old: other work on the GPU moves frame times more than a change does.
#   sh scripts/playtest/cost-ab.sh <old port> <new port> "<jobs>"
sh scripts/playtest/cost-run.sh "$1" old "$3"
sh scripts/playtest/cost-run.sh "$2" new "$3"
sh scripts/playtest/cost-run.sh "$2" new "$3"
sh scripts/playtest/cost-run.sh "$1" old "$3"
