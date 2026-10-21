#!/usr/bin/env bash
# Run the author's Kulisa from the checkout this script is in (Linux and macOS). Used by SKILL.md.
#   kulisa.sh stop     stop it gracefully (SIGINT to the main Electron process: session cookies and tabs get saved)
#   kulisa.sh check    what a fresh start would find: no Kulisa running, its data, tasks' copies, worktrees, branches, ports
#   kulisa.sh start    start it (refused while one runs, saying from which checkout), without the parent Claude session's
#                      CLAUDE_* variables except CLAUDE_CONFIG_DIR (CLAUDE.md, Commands), as an app of its own, not the
#                      terminal's: a Claude session's terminal closed takes no Kulisa with it, unsaved (its SIGHUP).
#                      Linux: in a session of its own (setsid). macOS: through LaunchServices (`open`), so the screen
#                      recording permission is its own too (docs/testing.md, "On macOS"), without the terminal's
#                      variables either. It returns once the app is up, its output in dist/kulisa.log (the checkout's,
#                      ignored by git, gone with a worktree; rewritten at each start).
set -u
repo="$(cd "$(dirname "$0")/../../.." && pwd)"
mac=false; [ "$(uname)" = Darwin ] && mac=true
if $mac; then data="${KULISA_DATA:-$HOME/Library/Application Support/Kulisa}"; else data="${KULISA_DATA:-$HOME/.config/Kulisa}"; fi

# The app's main process: `electron … .` (npm start) or, on macOS, `…/MacOS/Electron <checkout>` (open). Not its
# children (--type=), not the tests' site server (`electron test/fixtures/site.ts`, which outlives a test run), not a
# scratch or test Kulisa (KULISA_DATA in its environment, on macOS where ps shows it).
main_pid() {
  if $mac; then
    ps -eo pid,args | awk '/\/MacOS\/Electron( |$)/ && !/--type=/ && !/fixtures\/site/ { print $1 }' | while read -r p; do
      ps eww -o command= -p "$p" | grep -q 'KULISA_DATA=' || { echo "$p"; break; }
    done
  else
    ps -eo pid,comm,args | awk '$2 == "electron" && $0 !~ /--type=/ && $NF == "." { print $1; exit }'
  fi
}
# The checkout it runs from: its working folder (npm start) or the folder it was given (open).
checkout_of() {
  local last; last="$(ps -o args= -p "$1" | awk '{ print $NF }')"
  if [ "$last" != "." ] && [ -d "$last" ]; then echo "$last"
  elif $mac; then lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p'
  else readlink "/proc/$1/cwd"; fi
}
listening() { if $mac; then lsof -nP -iTCP:4450 -sTCP:LISTEN >/dev/null 2>&1; else ss -ltn | grep -qE ':4450 '; fi; }

case "${1:-}" in
  stop)
    pid="$(main_pid)"
    if [ -z "$pid" ]; then echo "not running"; exit 0; fi
    kill -INT "$pid"
    for _ in $(seq 1 60); do kill -0 "$pid" 2>/dev/null || { echo "stopped ($pid)"; exit 0; }; sleep 0.5; done
    echo "still running after 30 s: $pid" >&2; exit 1 ;;
  check)
    if [ -n "$(main_pid)" ]; then echo "kulisa: running ($(main_pid))"; else echo "kulisa: not running"; fi
    if [ -e "$data" ]; then echo "data: $data exists"; else echo "data: none"; fi
    # Tasks' copies: those the data names (next to a repository, or in ~/Kulisa/<project>@task-<n>/), then any
    # <folder>@<name> in the usual places, left by data already gone
    { [ -e "$data/projects.json" ] && node -e '
        const fs = require("fs"), path = require("path"), d = process.argv[1];
        for (const p of JSON.parse(fs.readFileSync(path.join(d, "projects.json"), "utf8"))) {
          let t; try { t = JSON.parse(fs.readFileSync(path.join(d, "projects", p.id, "tasks.json"), "utf8")); } catch { continue; }
          for (const k of t.list || []) for (const f of [k.home, ...(k.copies || []).map((c) => c.worktree)]) if (f) console.log(f);
        }' "$data" 2>/dev/null
      ls -d "$HOME"/IdeaProjects/*@* "$HOME"/Kulisa/*@* 2>/dev/null; } | sort -u | sed 's/^/task copy: /'
    git -C "$repo" worktree list | sed 's/^/worktree: /'
    git -C "$repo" branch --list | sed 's/^/branch: /'
    if listening; then echo "ports: 4450 in use"; else echo "ports: free"; fi ;;
  start)
    pid="$(main_pid)"
    if [ -n "$pid" ]; then echo "already running ($pid) from $(checkout_of "$pid"): stop it first" >&2; exit 1; fi
    cd "$repo" || exit 1
    npx vite build --logLevel warn || exit 1 # what npm start builds first
    log="$repo/dist/kulisa.log"; : > "$log"
    if $mac; then
      env $(env | grep -oE '^(CLAUDE[A-Z_]*|TERM_PROGRAM[A-Z_]*|TERM_SESSION_ID)' | grep -v '^CLAUDE_CONFIG_DIR$' | sed 's/^/-u /') \
        open -n -a "$repo/node_modules/electron/dist/Electron.app" --stdout "$log" --stderr "$log" --args "$repo"
    else
      env $(env | grep -o '^CLAUDE[A-Z_]*' | grep -v '^CLAUDE_CONFIG_DIR$' | sed 's/^/-u /') \
        setsid -f node scripts/electron.ts . >"$log" 2>&1 </dev/null
    fi
    for _ in $(seq 1 120); do grep -q 'MCP server' "$log" && { grep 'MCP server' "$log"; echo "log: $log"; exit 0; }; sleep 0.5; done
    cat "$log"; echo "not up after 60 s (log: $log)" >&2; exit 1 ;;
  *) echo "usage: $0 stop|check|start" >&2; exit 2 ;;
esac
