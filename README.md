# Kulisa

![Kulisa: three profiles of a shop (buyer, seller, admin) side by side, the agent outlining the new orders in two of them, and Claude Code in the terminal below](docs/images/kulisa.png)

**Your AI agent builds, checks the result as every user, fixes, and goes again until it works. Watch every step, or
take a break.**

Kulisa is a desktop app where the agent you choose (Claude Code, Codex) works in your signed-in browser profiles, side
by side. It is made for developing web apps with several users at once, and good for any work in web apps. Each
**profile** is an embedded browser profile, as in Chrome (cookies, storage, tabs). You sign in by hand in a profile's
pane, never the agent; the agent runs in the built-in terminal and drives the profiles through Kulisa's MCP server. Point at an element (Pick; Pick again or Esc cancels): a reference
with a locator the agent can act on lands in its prompt, and you write the rest of the message around it.

Website: [kulisa.app](https://kulisa.app).

## Documentation

- **Using Kulisa:** the [user guide](https://kulisa.app/docs) on the website, also here as
  [docs/guide.md](docs/guide.md): projects, tasks, agents, profiles, signing in, the window, keys.
- **For developers:**
  - [docs/SPEC.md](docs/SPEC.md): the product, its features and the architecture's decisions;
  - [docs/profiles.md](docs/profiles.md), [docs/tasks.md](docs/tasks.md), [docs/window.md](docs/window.md),
    [docs/transcripts.md](docs/transcripts.md), [docs/ui.md](docs/ui.md): how it works and why it is built so;
  - [docs/ROADMAP.md](docs/ROADMAP.md): what is planned, open issues;
  - [docs/REPORT.md](docs/REPORT.md): how the design was tested;
  - [docs/testing.md](docs/testing.md) and [CONTRIBUTING.md](CONTRIBUTING.md): the tests, contributing.

## Run

```sh
npm install          # Node 24.12+. Rebuilds node-pty for Electron.
npm run build        # type checks (tsc, vue-tsc), then the window (src/renderer, Vue) built by Vite into dist/renderer
npm start            # builds the window, then opens the windows and groups open last; at first start New Project
KULISA_PROJECT=~/my-app npm start
npm run knip         # no file, export or dependency that nothing uses (docs/testing.md, Dead code)
npm test             # unit tests, knip, then the real app against a local test site (groups in parallel), then restarted
npm run test:visible # the same on your screen (npm test uses its own screen on Linux: sudo apt install xvfb openbox)
npm run package      # the app for this platform, in out/
npm run make         # installers for this platform, in out/make/ (.deb, .rpm on Linux: sudo apt install rpm; .exe on Windows; .dmg/.zip on macOS)
npm run publish      # the same, uploaded to a draft release on GitHub (GITHUB_TOKEN); the CI does it on a tag v*
npm run icons        # after changing assets/icon.svg: icon.png, .ico, .icns next to it
```

Kulisa targets macOS, Windows and Linux; so far it is tested on Ubuntu only (see docs/ROADMAP.md). Installers are
built with [Electron Forge](https://www.electronforge.io/) (`forge.config.ts`), each on its own platform.

On Linux `npm start` and `npm test` run Electron with `--no-sandbox`: `chrome-sandbox` in `node_modules` is not
setuid on a plain install, and the flag must be on the command line (`scripts/electron.ts`). macOS and Windows need
no such file, so they run sandboxed. The `.deb` installs it setuid, so the installed app runs sandboxed.

| Variable | Effect |
|---|---|
| `KULISA_PROJECT` | The project in this folder (added if new): its task shown last opened, or a new one |
| `KULISA_AGENT` | One agent command for every task, without asking (e.g. a CLI Kulisa does not know). It gets no Claude Code plugin; its task's MCP URL is in its environment as `KULISA_MCP_URL`, with `KULISA_PORT_OFFSET` and `KULISA_TASK` |
| `KULISA_SIGNIN_HOSTS` | More sign-in hosts for the automatic sign-in pause, comma-separated |
| `KULISA_DATA` | Data folder instead of `~/.config/Kulisa` (e.g. to try a build next to your real one: one Kulisa runs per data folder, a second on the same one shows the first's window) |
| `KULISA_MCP_PORT` | MCP server port (default 4450; `0` picks a free one) |
| `KULISA_SHOT` | Save a screenshot of the whole window to this PNG file ~4 s after start (`KULISA_SHOT_DELAY`, ms) |

## Code

```
src/main/        Electron main process
  index.ts         entry: reads the environment, calls app.start()
  app.ts           the app: windows, groups (a project's open tasks: open a task, close, move to a new window), agents, IPC, quit
  window.ts        a window: its groups and what it shows, its questions
  keys.ts          the keyboard shortcuts: one table, which key an input event is (app.ts takes them before the pages)
  projects.ts      a project's group: its tasks (make, close, open again, delete); removing a project's data
  names.ts         the one rule for names of projects, tasks and profiles; slugs for ids and folders
  tasks.ts         a task: its profiles, terminals and agents (environment, handing over), folder and name; copies
  agents/          the agent CLIs to choose from, a file each (claude.ts, codex.ts: how to start, resume, trust,
                   forget, read its transcript); agent.ts what an entry is; index.ts the list, finding, installing
  accounts.ts      the agents' accounts, one store: each made with New Account… (Settings), a config folder of its own,
                   kept until deleted
  worktrees.ts     git for tasks: worktree and branch, files outside git copied, changes, renaming, removal
  profile-store.ts     the profiles, one store: who each is, its master, its projects
  master.ts        a profile's master in a window of its own, to sign in to once for every task
  local.ts         what is local: where a test user's login-password pair may be typed
  cookie-sync.ts   real accounts' cookies kept in step between a profile's master and its copies
  project-profiles.ts  a task's profiles (copies of their masters, made at their first open), open and closed
  avatars.ts       the profiles' pictures to choose from (Noto Emoji's, in src/renderer/public/avatars/)
  profiles.ts      a profile: a session on its own folder, tabs (WebContentsView), Playwright connection, sign-in mode
  store.ts         projects.json, settings.json (Kulisa zoom, theme, the windows and their tabs), profiles.json and
                   profiles/Profile <k>/ (the profiles' masters); per project in projects/<id>/: tasks.json, and per
                   task <n>/: profiles.json (with sites' zoom), layout.json (the window's grid), agent.json (its agents'
                   conversations), terminals.json (its island's tabs), Profile <k>/ (its copy of a master: a Chromium profile, its tabs and session
                   cookies in it).
  cdp-proxy.ts     per-profile CDP endpoint over webContents.debugger (no --remote-debugging-port)
  local-only.ts    refuses requests from web pages to the MCP server and the proxy (Host, Origin)
  mcp-server.ts    MCP tools for the agent, each takes a profile; a URL per task (/task/<project>/<n>/mcp)
  history.ts       the task's history for its agent (task_history), read from the agents' transcripts
  transcripts.ts   the entries an agent's transcript is read as (each reader in its agent's file; docs/transcripts.md)
  agent-hooks.ts   answers for the agents' hooks (/task/<project>/<n>/hooks/…: the open profiles, the session; the agent's state)
  signin-pages.ts  which pages are sign-in pages; what URL to restore instead of one
  signin-pause.ts  pauses the agent on sign-in pages (temporary implementation, see docs/REPORT.md)
  session-cookies.ts  keeps session cookies across restarts (encrypted with the OS keyring)
  updates.ts       a packaged Kulisa updating itself (update.electronjs.org), Squirrel's events on Windows
  picker.ts        point and tell: Playwright pickLocator → a reference (profile, tab, locator) typed into the agent's prompt
  ghost.ts         the agent's actions: Playwright's annotations in the page, a caption over the pane
  terminal.ts      node-pty: a task's terminals, each a shell, an agent CLI started in some
src/agent/        what Kulisa gives the agents: skills/profiles (the profiles skill, every agent's), claude-plugin (Claude
                 Code's MCP config, claude --plugin-dir)
src/preload/     the window's bridge to the main process (plain JavaScript: the window is sandboxed)
src/renderer/    window UI: Vue 3 components in TypeScript, built by Vite into dist/renderer (vite.config.mts; docs/ui.md).
                 components/: the window's parts (App.vue; TopBar, Grid and grid/ its panels, TaskBar, TaskTab, NewTask, Empty,
                 the dialogs on Modal.vue, menu/ the menus; menus and dialogs are Reka UI's); lib/: what they share
                 (store.ts: what the main process sends;
                 grid.ts, terminals.ts, menu.ts, agents.ts, ask.ts, dialogs.ts, keys.ts, voice.ts). Styles: tokens.css,
                 components.css, each part's own in its file; the icons are Sprite.vue
dist/            the window built (npm run build; not in git)
assets/          the app icon: icon.svg (source) and what each OS needs, rendered by scripts/icons.ts
scripts/         electron.ts (npm start: Electron, --no-sandbox on Linux only), icons.ts (npm run icons)
test/            start.ts (npm test: the groups in parallel), run.ts (one app, its files in order), helpers.ts,
                 setup.ts, the tests by area (agent.ts, profiles.ts, window.ts, grid.ts, zoom-and-closing.ts,
                 tasks.ts; restart-*.ts after a restart), unit/ (plain Node), fixtures/site.ts (docs/testing.md)
```

The experiments behind the design (E1–E8, docs/REPORT.md) were removed after they answered their questions.
They are in git history at commit `9fe8661`.

## License

Kulisa is free software: Copyright (C) 2026 Orudzhali Nagaev, licensed under the GNU General Public License,
version 3 or (at your option) any later version ([LICENSE](LICENSE)). It comes with no warranty.

- **Free.** Kulisa is free to use, at home and at work, and the app on your computer stays free. You pay only for
  the agent you choose (Claude Code, Codex). Paid services may come one day, only for what costs money to run
  (a cloud service), never for what runs on your computer.
- **Forks** are welcome: you may change Kulisa, share it and even charge for copies, but whoever gets your version
  gets its source under the same license, free to share on. No one can close the code.
- **The name and the logo** are not covered by the license: a fork must be called otherwise and not look like the
  official Kulisa.

What the license covers and what it does not (agents, their plugins, MCP servers, extensions, services):
[docs/LICENSING.md](docs/LICENSING.md). Contributing: [CONTRIBUTING.md](CONTRIBUTING.md).
