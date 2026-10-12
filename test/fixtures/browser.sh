#!/bin/sh
# The user's browser in the tests (run.ts, BROWSER): it notes the page it is asked to open, in $FAKE_OPENED.
printf '%s\n' "$1" >> "$FAKE_OPENED"
