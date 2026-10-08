#!/usr/bin/env bash
# A scratch Kulisa next to the author's: its own data, project and ports; a bash "agent".
#   scratch.sh start <folder>   (the session's scratch folder; data and a project "myshop" go there, made anew)
#   scratch.sh stop
# Main process: Node inspector on 9230 (inspect.mjs 9230 …). The window's page: CDP on 9333 (Playwright
# connectOverCDP; window.kulisa.invoke(…) there, e.g. 'profile:new'). MCP: http://127.0.0.1:4499/ws/myshop/1/mcp.
set -u
repo=$(cd "$(dirname "$0")/../../.." && pwd)
pid() { ps -eo pid,comm,args | awk '$2=="electron" && /--inspect=9230/ && !/--type=/ {print $1}'; }
case "${1:-}" in
  start)
    dir=${2:?folder}; [ -n "$(pid)" ] && { echo "already running ($(pid))"; exit 1; }
    rm -rf "${dir:?}/data"; mkdir -p "$dir/myshop"
    cd "$repo"
    env $(env | grep -o '^CLAUDE[A-Z_]*' | grep -v '^CLAUDE_CONFIG_DIR$' | sed 's/^/-u /') \
      KULISA_DATA="$dir/data" KULISA_MCP_PORT=4499 KULISA_AGENT=bash KULISA_PROJECT="$dir/myshop" \
      npx electron --no-sandbox --inspect=9230 --remote-debugging-port=9333 . > "$dir/log.txt" 2>&1 &
    for _ in $(seq 60); do curl -s -o /dev/null http://127.0.0.1:9333/json/version && break; sleep 0.5; done
    sleep 3; echo "started ($(pid)); log: $dir/log.txt" ;;
  stop)
    p=$(pid); [ -z "$p" ] && { echo "not running"; exit 0; }
    kill -INT "$p"; while [ -n "$(pid)" ]; do sleep 0.5; done; echo "stopped ($p)" ;;
  *) echo "usage: scratch.sh start <folder> | stop"; exit 2 ;;
esac
