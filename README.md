# Kulisa

![Kulisa: three profiles of a shop (buyer, seller, admin) side by side, the agent outlining the new orders in two of them, and Claude Code in the terminal below](docs/images/kulisa.png)

**Your AI agent builds, checks the result as every user, fixes, and goes again until it works. Watch every step, or
take a break.**

Kulisa is a desktop app where the agent you choose (Claude Code, Codex) works in your signed-in browser profiles, side
by side. It is made for developing web apps with several users at once, and good for any work in web apps. Each
**profile** is an embedded browser profile, as in Chrome (cookies, storage, tabs). You sign in by hand in a profile's
pane, never the agent; the agent runs in the built-in terminal and drives the profiles through Kulisa's MCP server. Point at an element (Pick; Pick again or Esc cancels): a reference
with a locator the agent can act on lands in its prompt, and you write the rest of the message around it.

Website: [kulisa.app](https://kulisa.app). The product and its decisions: [docs/SPEC.md](docs/SPEC.md); how it works: [docs/profiles.md](docs/profiles.md),
[docs/tasks.md](docs/tasks.md), [docs/window.md](docs/window.md); plans: [docs/ROADMAP.md](docs/ROADMAP.md);
how the design was tested: [docs/REPORT.md](docs/REPORT.md).

## Run

```sh
npm install          # Node 22.13+. Rebuilds node-pty for Electron.
npm run build        # the window (src/renderer, Vue + TypeScript): type check, then Vite into dist/renderer
npm start            # builds the window, then opens the windows and projects open last; at first start the Welcome screen
KULISA_PROJECT=~/my-app npm start
npm test             # unit tests, then the real app against a local test site (groups in parallel), then restarted
npm run test:visible # the same on your screen (npm test uses its own screen on Linux: sudo apt install xvfb openbox)
npm run package      # the app for this platform, in out/
npm run make         # installers for this platform, in out/make/ (.deb on Linux, .exe on Windows, .dmg/.zip on macOS)
npm run icons        # after changing assets/icon.svg: icon.png, .ico, .icns next to it
```

Kulisa targets macOS, Windows and Linux; so far it is tested on Ubuntu only (see docs/ROADMAP.md). Installers are
built with [Electron Forge](https://www.electronforge.io/) (`forge.config.js`), each on its own platform.

`npm start` and `npm test` run Electron with `--no-sandbox`: on Linux `chrome-sandbox` in `node_modules` is not
setuid on a plain install. The `.deb` installs it setuid, so the installed app runs sandboxed.

| Variable | Effect |
|---|---|
| `KULISA_PROJECT` | Open the project in this folder (added if new), on the task it showed last, or a new one |
| `KULISA_AGENT` | One agent command for every task, without asking (e.g. a CLI Kulisa does not know). It gets no Claude Code plugin; its task's MCP URL is in its environment as `KULISA_MCP_URL`, with `KULISA_PORT_OFFSET` and `KULISA_TASK` |
| `KULISA_MIMIC=0` | Do not present profiles as Google Chrome |
| `KULISA_SIGNIN_HOSTS` | More sign-in hosts for the automatic sign-in pause, comma-separated |
| `KULISA_DATA` | Data folder instead of `~/.config/Kulisa` (e.g. to try a build next to your real one) |
| `KULISA_MCP_PORT` | MCP server port (default 4450; `0` picks a free one) |
| `KULISA_SHOT` | Save a screenshot of the whole window to this PNG file ~4 s after start (`KULISA_SHOT_DELAY`, ms) |

**Projects:** a project is the configuration its tasks are made from: a name, a color and an icon, its agents (one
the default), its profiles, and its code: a folder, or one or more repositories (local, or cloned from a URL; one the
default). **Projects** in the title bar (left of ☰) opens the projects' manager: every project on the left, open or
not, and **+ New Project**; on the right the chosen one's configuration. The bar under the
grid (or over it: **☰ → Projects bar**) has a group per open project, as Chrome's tab groups: its name (a click folds
it), its tasks, and **+** for a new task. A click on a task shows it, of any project, and the others keep running
(their agents and pages) until you close their project (**×** on its last open task, the middle button on its name,
or **Close Project** in its right-click menu, after a question; closing a window asks once for all its projects). The button after the islands opens a menu of the
projects: open another one (in this window or in a new window: Kulisa asks), remove one (its **×** on hover:
Kulisa's data of it and its tasks' copies; its folder stays), **Projects…**, **New Project…** (a name and where its
folder goes, `~/Kulisa` by default; git on by default, with an empty first commit; its color and icon; then its
configuration: its agents' accounts, code, profiles; **Open** opens it),
**Open Folder…** (a folder no project has becomes one: its configuration is shown first, as a new project's), close the project. **Project Settings…** on its name's right-click menu opens the manager at it. Closing the last project shows the
Welcome screen. A closed project keeps its tabs and
sign-ins; when you open it again, its agent continues the conversation where it can (`claude --resume`,
`codex resume`). The agent starts in your shell in its task's folder, as if you typed its command in a terminal
there, so the project's environment (direnv's `.envrc`, nvm, mise) applies; when it exits, the shell stays.

**The agent:** **☰ → Agents…** shows which agent CLIs are installed (Claude Code, Codex),
their versions and folders, and installs the others (Kulisa runs its maker's installer). The agents a project's tasks
run are its accounts, made in its settings: **New Account…** starts the agent's own sign-in right there, its page in a
clean browser of Kulisa's (none of your other sign-ins there); the account is shown by the email you signed in to,
has a folder of its own (several side by side: a work and a personal one), and goes (after a question) when no project
has it any more. Each starts as a clean agent: your own `~/.claude` and `~/.codex` are not used. A project without
one starts its tasks with the terminal only. Each task keeps its choice; **Change agent…** in the terminal's
right-click menu picks another of the project's (with a new conversation).

**Tasks:** several tasks of a project at once, each with its own agent, in its project's group. **+** makes one at
once, `task-<n>` until its agent names it (or you do: **Rename…** in its tab's menu): a git worktree on a branch of
its own next to the project (`~/IdeaProjects/myshop@task-2/`; `.env*` and files named in `.worktreeinclude` are
copied), a new session of the project's default agent there (right-click **+**: **New Task with** another of its
agents), and its profiles, all closed until the agent or you open one (👥): each a copy of its master, where you
signed in once, for every task. Your
project's folder stays yours: agents merge into it only when you ask. The task's app runs on its own ports: the usual
ones plus `KULISA_PORT_OFFSET` (100, 200, …), and its tabs on local addresses point there. Click a task to switch;
the others keep working. **×** closes a task (its agent stops; its code, profiles and conversation stay, and its
project's menu opens it again); **Delete Task…** in its tab's menu deletes it, after a question that says what goes
and any work not in main and not pushed. Without git, tasks work in the project's folder itself.

**More terminals:** **+** in the terminal's header opens your shell in the task's folder next to the agent's.
The agent runs what keeps running there too (the app's dev server, `docker compose up`), in a terminal of its own
behind its tab, so you see it, stop it and type into it; it reads the output itself. Terminals are kept across
restarts, as in an IDE, each a fresh shell in its place; **×** or `exit` closes one.

Panes and the terminal are panels: drag one by its header to another place (or onto another panel to stack them as
tabs), drag the gaps between them to resize; **☰ → Arrange panels** offers ready-made arrangements, each drawn as a picture. The grid is
kept across restarts. Profiles are added, renamed, described (who each one is in your app: the agent chooses profiles by it, and asks you when it is not said), given another picture and deleted in **👥 → Manage Profiles…** (👥 on the shown task's tab, at the bottom; every task's tab shows how many of its profiles are open), or by right-clicking a pane's
header. **×** at the top right of a profile's pane closes it: its tabs
go and free their memory, it stays signed in; **👥** lists it as closed and brings it back with the same tabs. Right-click a tab or the terminal for their menus. **Keys:** Chrome's keys in a profile's page (Ctrl+T, Ctrl+W,
Ctrl+Shift+T, Ctrl+L, Ctrl+Tab …), Kulisa's everywhere, the terminal too (Ctrl+` the agent's terminal and back, Ctrl+Shift+1…9
a task); every other key in the terminal is the agent's. **☰ → Keyboard Shortcuts** (Ctrl+Shift+/) lists them all. **Zoom:**
Ctrl + / Ctrl − / Ctrl 0 outside the pages, or ☰ in the title bar, zooms all of Kulisa, and the pages follow; when it
is not 100%, the title bar shows it (click to reset). The same keys in a page zoom that site in that profile on top of it (shown in the address bar,
click to reset). Both are kept across restarts. **☰ → Theme**: Dark (the default), Light, or System (as your OS); profiles' pages keep your OS's. **☰ → Exit** quits
(on macOS Cmd+Q); the windows and their projects open again at the next start. **⋮ → DevTools** on a pane (or F12, Ctrl+Shift+I in its page) opens the DevTools of its active tab. Kulisa's own DevTools
(F12 outside the pages) exist only when running from source (`npm start`), not in a packaged build. Data
(profiles with your sign-ins) lives in `~/.config/Kulisa`.

## Code

```
src/main/        Electron main process
  index.js         entry: reads the environment, calls app.start()
  app.js           the app: windows, open projects (open, close, move to a new window), agents, IPC, quit
  window.js        a window: its open projects and what it shows, its questions
  keys.js          the keyboard shortcuts: one table, which key an input event is (app.js takes them before the pages)
  projects.js      an open project: its tasks (make, close, open again, delete); removing a project's data
  names.js         the one rule for names of projects, tasks and profiles; slugs for ids and folders
  tasks.js         a task: its profiles, agent (terminal, environment), folder and name; copies for a new task
  agents.js        the agent CLIs to choose from: how to find, install, start and resume each
  accounts.js      the agents' accounts, one store: each made in a project (New Account…), a config folder of its own
  worktrees.js     git for tasks: worktree and branch, files outside git copied, changes, renaming, removal
  profile-store.js     the profiles, one store: who each is, its master, its projects
  master.js        a profile's master in a window of its own, to sign in to once for every task
  local.js         what is local: where a test user's login-password pair may be typed
  cookie-sync.js   real accounts' cookies kept in step between a profile's master and its copies
  project-profiles.js  a task's profiles (copies of their masters, made at their first open), open and closed
  avatars.js       the profiles' pictures to choose from (Noto Emoji's, in src/renderer/public/avatars/)
  profiles.js      a profile: a session on its own folder, tabs (WebContentsView), Playwright connection, sign-in mode
  store.js         projects.json, settings.json (Kulisa zoom, theme, the windows and their tabs), profiles.json and
                   profiles/Profile <k>/ (the profiles' masters); per project in projects/<id>/: tasks.json, and per
                   task <n>/: profiles.json (with sites' zoom), layout.json (the window's grid), agent.json (the
                   session to resume), Profile <k>/ (its copy of a master: a Chromium profile, its tabs and session
                   cookies in it).
  cdp-proxy.js     per-profile CDP endpoint over webContents.debugger (no --remote-debugging-port)
  local-only.js    refuses requests from web pages to the MCP server and the proxy (Host, Origin)
  mcp-server.js    MCP tools for the agent, each takes a profile; a URL per task (/task/<project>/<n>/mcp)
  agent-hooks.js   answers for the plugin's hooks (/task/<project>/<n>/hooks/…: the open profiles, the session; the agent's state)
  mimic-chrome.js  UA, UA-CH headers and userAgentData of Google Chrome
  signin-pages.js  which pages are sign-in pages; what URL to restore instead of one
  signin-pause.js  pauses the agent on sign-in pages (temporary implementation, see docs/REPORT.md)
  session-cookies.js  keeps session cookies across restarts (encrypted with the OS keyring)
  picker.js        point and tell: Playwright pickLocator → a reference (profile, tab, locator) typed into the agent's prompt
  ghost.js         the agent's actions: Playwright's annotations in the page, a caption over the pane
  terminal.js      node-pty: the agent CLI, one per task, and the task's other terminals
src/agent/claude-plugin/  the Kulisa plugin for Claude Code: MCP config, the profiles skill, hooks (claude --plugin-dir)
src/preload/     the window's bridge to the main process
src/renderer/    window UI: Vue 3 components in TypeScript, built by Vite into dist/renderer (vite.config.mts; docs/ui.md).
                 components/: the window's parts (App.vue; TopBar, Grid and grid/ its panels, ProjectBar, TaskTab, Welcome,
                 the dialogs on Modal.vue, menu/ the menus; menus and dialogs are Reka UI's); lib/: what they share
                 (store.ts: what the main process sends;
                 grid.ts, terminals.ts, menu.ts, agents.ts, ask.ts, dialogs.ts, keys.ts, voice.ts). Styles: tokens.css,
                 components.css, each part's own in its file; the icons are Sprite.vue
dist/            the window built (npm run build; not in git)
assets/          the app icon: icon.svg (source) and what each OS needs, rendered by scripts/icons.js
test/            start.js (npm test: the groups in parallel), run.js (one app, its files in order), helpers.js,
                 setup.js, the tests by area (agent.js, profiles.js, window.js, grid.js, zoom-and-closing.js,
                 tasks.js; restart-*.js after a restart), unit/ (plain Node), fixtures/site.js (docs/testing.md)
```

The experiments behind the design (SPEC section 6, E1–E8) were removed after they answered their questions.
They are in git history at commit `9fe8661`; their results are in docs/REPORT.md.

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
