---
name: run-kulisa
description: Restart the author's running Kulisa after a change, or give them a fresh start "as if just installed". Use whenever Kulisa (the app itself, not the tests) has to be stopped, started or restarted on the author's machine.
---

# Running the author's Kulisa

The author's Kulisa runs from one checkout of this repository at a time (`npm start`): the one whose `kulisa.sh` started
it. Its data is in `~/.config/Kulisa` (macOS: `~/Library/Application Support/Kulisa`): profiles with real sign-ins (CLAUDE.md, Rules). `kulisa.sh` next to this file
does the steps the same way each time.

Work is done in a worktree of its own (CLAUDE.md, Conventions), so run that worktree's `kulisa.sh`
(`.claude/worktrees/<name>/.claude/skills/run-kulisa/kulisa.sh`): the author then sees its code. Say from which
worktree it runs now. Once the work is merged, run the repository's own `kulisa.sh` (its folder holds `develop`). Another session's Kulisa, started from its worktree, is stopped by this: tell the author whose
change they no longer see.

## Restart after a change

After each change, restart it without asking, so the author sees it (the author wants the change live; the full
`npm test` runs only when they say the work is done, CLAUDE.md):

1. `.claude/skills/run-kulisa/kulisa.sh stop`: SIGINT to the main Electron process, so session cookies and tabs are
   saved. Never `kill -9`, never `pkill -f` (it matches the shell running it).
2. `.claude/skills/run-kulisa/kulisa.sh start`. It runs without the parent Claude session's `CLAUDE_*` variables
   (except `CLAUDE_CONFIG_DIR`), or the `claude` inside would take itself for a child session.
   - Linux: with the Bash tool's `run_in_background`: the app keeps running after the turn. A few seconds later, read
     the background output: `[kulisa] MCP server: …` means it is up.
   - macOS: in the foreground. It starts the app through LaunchServices (`open`), so the app is its own and not the
     terminal's (the screen recording permission, `KULISA_SHOT`, is the responsible app's: `docs/testing.md`, "On
     macOS"), and without the terminal's variables either (`TERM_PROGRAM` made zsh in its terminals load Terminal.app's
     own startup). It returns once `[kulisa] MCP server: …` is in the app's output, `dist/kulisa.log` of the checkout.

Do not start a second one while one runs: stop first. `kulisa.sh start` refuses then and names the checkout it runs
from (Kulisa itself lets one run per data folder: a second one shows the first one's window and quits); another
session's: tell the author whose change they stop seeing.

## A fresh start, as if just installed

Only when the author asks for it in their message: it deletes their profiles and sign-ins for good.

1. `kulisa.sh stop`.
2. `kulisa.sh check`, and tell the author what is there besides the data: tasks' copies (`<repo>@task-<n>`, or
   `~/Kulisa/<project>@task-<n>/`), worktrees, branches. Remove a task's copy (`git worktree remove --force <folder>`,
   `git branch -D <branch>`) only if they say so; a task may hold their work. Deleting the data does not remove them.
3. `rm -rf` the data folder (`~/.config/Kulisa`; macOS: `~/Library/Application Support/Kulisa`; what they asked for), then `kulisa.sh check` again: no data, ports free.
4. `kulisa.sh start` in the background, as above. At first start it opens no task: the empty window, the welcome
   (three slides, then New Project's steps), the keyboard on Next.

Leave alone what is not Kulisa's: installed agents (`~/.local/bin/claude`, `codex`), their own data (`~/.codex`,
Claude's config), unless the author asks.
