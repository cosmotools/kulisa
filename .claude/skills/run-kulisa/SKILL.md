---
name: run-kulisa
description: Restart the author's running Kulisa after a change passes the tests, or give them a fresh start "as if just installed". Use whenever Kulisa (the app itself, not the tests) has to be stopped, started or restarted on the author's machine.
---

# Running the author's Kulisa

The author's Kulisa runs from this repository (`npm start`). Its data is in `~/.config/Kulisa`: profiles with real
sign-ins (CLAUDE.md, Rules). `kulisa.sh` next to this file does the steps the same way each time.

## Restart after a change

Once `npm test` passes, restart it without asking (the author wants the change live):

1. `.claude/skills/run-kulisa/kulisa.sh stop`: SIGINT to the main Electron process, so session cookies and tabs are
   saved. Never `kill -9`, never `pkill -f` (it matches the shell running it).
2. `.claude/skills/run-kulisa/kulisa.sh start` with the Bash tool's `run_in_background`: the app keeps running after
   the turn. It runs without the parent Claude session's `CLAUDE_*` variables (except `CLAUDE_CONFIG_DIR`), or the
   `claude` inside would take itself for a child session.
3. A few seconds later, read the background output: `[kulisa] MCP server: …` means it is up.

Do not start a second one while one runs: stop first.

## A fresh start, as if just installed

Only when the author asks for it in their message: it deletes their profiles and sign-ins for good.

1. `kulisa.sh stop`.
2. `kulisa.sh check`, and tell the author what is there besides the data: fork folders (`<repo>@<name>`),
   worktrees, branches. Remove a fork (`git worktree remove --force <folder>`, `git branch -D <branch>`) only if they
   say so; a fork may hold their work.
3. `rm -rf ~/.config/Kulisa` (what they asked for), then `kulisa.sh check` again: no data, ports free.
4. `kulisa.sh start` in the background, as above. At first start it opens no project: the Welcome screen.

Leave alone what is not Kulisa's: installed agents (`~/.local/bin/claude`, `codex`), their own data (`~/.codex`,
Claude's config), unless the author asks.
