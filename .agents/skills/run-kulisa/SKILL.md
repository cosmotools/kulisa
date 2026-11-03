---
name: run-kulisa
description: Restart the author's running Kulisa after a change, or give them a fresh start "as if just installed". Use whenever Kulisa (the app itself, not the tests) has to be stopped, started or restarted on the author's machine.
---

# Running the author's Kulisa

Run commands from the checkout root. Use that worktree's `kulisa.sh` while reviewing its change, and the root
`develop` checkout after merge. State the running checkout; if replacing another session's app, tell the author
whose change they stop seeing.

Data contains real sign-ins: `~/.config/Kulisa` on Linux, `~/Library/Application Support/Kulisa` on macOS.

## Restart after a change

Restart after application changes without asking, so the author sees them. Test timing: `docs/testing.md`.

1. `.agents/skills/run-kulisa/kulisa.sh stop` saves cookies/tabs through SIGINT, or `KULISA_QUIT` on Windows.
   Never force-kill (`kill -9`, `taskkill /F`, `Stop-Process`) or use `pkill -f`.
2. `.agents/skills/run-kulisa/kulisa.sh start`; wait for `[kulisa] MCP server: …` in the checkout's `dist/kulisa.log`.

Stop before starting; never run two apps against the same data folder. The script checks the running checkout.
It clears parent `CLAUDE_*` except `CLAUDE_CONFIG_DIR`, and color override variables, preserving terminal behavior.
Launch is independent of the agent terminal: Linux `setsid`, macOS LaunchServices, Windows a separate hidden console.
macOS clears terminal identity variables for correct shell startup/screen-recording permissions; Windows uses the
Start menu PATH so Git Bash's GNU tar cannot break CLI installers. Keep these script guarantees.

## A fresh start, as if just installed

Only when explicitly requested: this permanently deletes profiles and sign-ins.

1. `kulisa.sh stop`.
2. `kulisa.sh check`. Report task copies, worktrees and branches outside app data. Remove them only if separately
   authorized; they may contain work.
3. Remove the requested data folder, then `kulisa.sh check`: data absent, ports free.
4. `kulisa.sh start`: empty window, welcome, New Project; keyboard on Next.

Leave installed CLIs and their own data (`~/.codex`, Claude config) alone unless explicitly requested.
