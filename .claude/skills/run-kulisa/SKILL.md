---
name: run-kulisa
description: Restart the author's running Kulisa after a change, or give them a fresh start "as if just installed". Use whenever Kulisa (the app itself, not the tests) has to be stopped, started or restarted on the author's machine.
---

# Running the author's Kulisa

The author's Kulisa runs from one checkout of this repository at a time (`npm start`): the one whose `kulisa.sh` started
it. Its data is in `~/.config/Kulisa`: profiles with real sign-ins (CLAUDE.md, Rules). `kulisa.sh` next to this file
does the steps the same way each time.

Work is done in a worktree of its own (CLAUDE.md, Conventions), so run that worktree's `kulisa.sh`
(`.claude/worktrees/<name>/.claude/skills/run-kulisa/kulisa.sh`): the author then sees its code. Say from which
worktree it runs now. Another session's Kulisa, started from its worktree, is stopped by this: tell the author whose
change they no longer see.

## Restart after a change

After each change, restart it without asking, so the author sees it (the author wants the change live; the full
`npm test` runs only when they say the work is done, CLAUDE.md):

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
2. `kulisa.sh check`, and tell the author what is there besides the data: tasks' copies (`<repo>@task-<n>`, or
   `~/Kulisa/<project>@task-<n>/`), worktrees, branches. Remove a task's copy (`git worktree remove --force <folder>`,
   `git branch -D <branch>`) only if they say so; a task may hold their work. Deleting the data does not remove them.
3. `rm -rf ~/.config/Kulisa` (what they asked for), then `kulisa.sh check` again: no data, ports free.
4. `kulisa.sh start` in the background, as above. At first start it opens no task: the empty window, with the projects'
   manager open on New Project.

Leave alone what is not Kulisa's: installed agents (`~/.local/bin/claude`, `codex`), their own data (`~/.codex`,
Claude's config), unless the author asks.
