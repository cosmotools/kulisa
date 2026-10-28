#!/usr/bin/env bash
# A real mouse click (X11, xdotool) in a window found by its exact title, at a point relative to that window.
#   click.sh "<window title>" <x> <y> [button]     button: 1 left (default), 3 right, 4/5 wheel up/down
# It raises the window and clicks only if that window is then the active one: the pointer is the author's, and a
# click elsewhere lands in their own windows.
set -u
title=$1 x=$2 y=$3 button=${4:-1}
command -v xdotool > /dev/null || { echo "no xdotool (debug-kulisa skill: Installing)"; exit 2; }
ids=$(xdotool search --onlyvisible --name "^${title}\$")
[ -n "$ids" ] || { echo "no visible window titled \"$title\": nothing clicked"; exit 1; }
# A window with a system frame shows twice (the frame and the window): raise each in turn until one of them is the
# active window, and click that one.
active=
for id in $ids; do
  xdotool windowactivate --sync "$id" 2> /dev/null
  for _ in $(seq 20); do a=$(xdotool getactivewindow); echo "$ids" | grep -qx "$a" && { active=$a; break 2; }; sleep 0.1; done
done
[ -n "$active" ] || { echo "\"$title\" is not the active window: nothing clicked"; exit 1; }
xdotool mousemove --window "$active" "$x" "$y" click "$button"
