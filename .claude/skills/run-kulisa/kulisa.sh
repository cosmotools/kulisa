#!/usr/bin/env bash
# Run the author's Kulisa from the repository (Linux; the author's machine). Used by SKILL.md.
#   kulisa.sh stop     stop it gracefully (SIGINT to the main Electron process: session cookies and tabs get saved)
#   kulisa.sh check    what a fresh start would find: no Kulisa running, its data, forks, worktrees, branches, ports
#   kulisa.sh start    start it in the foreground (run this in the background from Claude Code), without the parent
#                      Claude session's CLAUDE_* variables except CLAUDE_CONFIG_DIR (CLAUDE.md, Commands)
set -u
repo="$(cd "$(dirname "$0")/../../.." && pwd)"
data="${KULISA_DATA:-$HOME/.config/Kulisa}"

# The app's main process: `electron … .` (npm start). Not its children (--type=), not the tests' site server
# (`electron test/fixtures/site.js`, which outlives a test run).
main_pid() { ps -eo pid,comm,args | awk '$2 == "electron" && $0 !~ /--type=/ && $NF == "." { print $1; exit }'; }

case "${1:-}" in
  stop)
    pid="$(main_pid)"
    if [ -z "$pid" ]; then echo "not running"; exit 0; fi
    kill -INT "$pid"
    for _ in $(seq 1 60); do kill -0 "$pid" 2>/dev/null || { echo "stopped ($pid)"; exit 0; }; sleep 0.5; done
    echo "still running after 30 s: $pid" >&2; exit 1 ;;
  check)
    echo "electron processes: $(ps -eo comm | grep -c '^electron$')"
    if [ -e "$data" ]; then echo "data: $data exists"; else echo "data: none"; fi
    ls -d "$HOME"/IdeaProjects/*@* 2>/dev/null | sed 's/^/fork folder: /'
    git -C "$repo" worktree list | sed 's/^/worktree: /'
    git -C "$repo" branch --list | sed 's/^/branch: /'
    if ss -ltn | grep -qE ':(4450|4417) '; then echo "ports: 4450 or 4417 in use"; else echo "ports: free"; fi ;;
  start)
    cd "$repo" || exit 1
    exec env $(env | grep -o '^CLAUDE[A-Z_]*' | grep -v '^CLAUDE_CONFIG_DIR$' | sed 's/^/-u /') npm start ;;
  *) echo "usage: $0 stop|check|start" >&2; exit 2 ;;
esac
