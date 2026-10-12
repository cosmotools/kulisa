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
npm install          # Node 24.12+. Rebuilds node-pty for Electron.
npm run build        # type checks (tsc, vue-tsc), then the window (src/renderer, Vue) built by Vite into dist/renderer
npm start            # builds the window, then opens the windows and groups open last; at first start the projects' manager on New Project
KULISA_PROJECT=~/my-app npm start
npm run knip         # no file, export or dependency that nothing uses (docs/testing.md, Dead code)
npm test             # unit tests, knip, then the real app against a local test site (groups in parallel), then restarted
npm run test:visible # the same on your screen (npm test uses its own screen on Linux: sudo apt install xvfb openbox)
npm run package      # the app for this platform, in out/
npm run make         # installers for this platform, in out/make/ (.deb on Linux, .exe on Windows, .dmg/.zip on macOS)
npm run icons        # after changing assets/icon.svg: icon.png, .ico, .icns next to it
```

Kulisa targets macOS, Windows and Linux; so far it is tested on Ubuntu only (see docs/ROADMAP.md). Installers are
built with [Electron Forge](https://www.electronforge.io/) (`forge.config.ts`), each on its own platform.

`npm start` and `npm test` run Electron with `--no-sandbox`: on Linux `chrome-sandbox` in `node_modules` is not
setuid on a plain install. The `.deb` installs it setuid, so the installed app runs sandboxed.

| Variable | Effect |
|---|---|
| `KULISA_PROJECT` | The project in this folder (added if new): its task shown last opened, or a new one |
| `KULISA_AGENT` | One agent command for every task, without asking (e.g. a CLI Kulisa does not know). It gets no Claude Code plugin; its task's MCP URL is in its environment as `KULISA_MCP_URL`, with `KULISA_PORT_OFFSET` and `KULISA_TASK` |
| `KULISA_MIMIC=0` | Do not present profiles as Google Chrome |
| `KULISA_SIGNIN_HOSTS` | More sign-in hosts for the automatic sign-in pause, comma-separated |
| `KULISA_DATA` | Data folder instead of `~/.config/Kulisa` (e.g. to try a build next to your real one) |
| `KULISA_MCP_PORT` | MCP server port (default 4450; `0` picks a free one) |
| `KULISA_SHOT` | Save a screenshot of the whole window to this PNG file ~4 s after start (`KULISA_SHOT_DELAY`, ms) |

**Projects:** a project is the configuration its tasks are made from: a name, a color and an icon, its agents (one
the default), its profiles, and its code: a folder, or one or more repositories (local, or cloned from a URL; one the
default). **Settings** in the title bar (left of ☰, the gear) has two tabs, **Projects** and **Agents**. Projects is
the projects' manager: every project on the left
and **+ New Project**; on the right the chosen one's page: **New Task**, its code, agents, profiles and look, each saved as it changes, and **⋯ → Delete Project…** (Kulisa's data of it and its tasks' copies; its folder stays). The bar under the
grid (or over it: **☰ → Tasks bar**) has a group per project with open tasks, as Chrome's tab groups: its name (a click folds
it) and its tasks. A project itself is not opened or closed: its tasks are. A click on a task shows it, of any group, and the others keep running
(their agents and pages) until you close them (**×** on a task; **Close Group** in its name's right-click menu or the middle
button on its name closes all its tasks, asking only when an agent works). **+** after the islands (or Ctrl+Shift+A)
lists every project: a click makes a task of it with its default agent, in its group (a new one in this window when it
has none); under each project its closed tasks, a click opens one again. **Settings → Projects** has **New Project**: its code first, a **New folder** (a name
and where it goes, `~/Kulisa` by default; git on by default, with an empty first commit), **Folders on disk** (one or
several, a frontend and a backend: taken as they are, nothing made) or **Clone from URL** (one or several: into
`~/Kulisa/<name>` by default, several each in a folder of its own there); then its
configuration: its agents' accounts, more code, profiles; the bar's **+** makes its first task. **Project Settings…** on its name's right-click menu opens the manager at it. Closing the last group leaves the
window empty: New Task (+'s menu) and New Project… in it. A closed task keeps its tabs and
sign-ins; when you open it again, its agent continues the conversation where it can (`claude --resume`,
`codex resume`). The agent starts in your shell in its task's folder, as if you typed its command in a terminal
there, so the project's environment (direnv's `.envrc`, nvm, mise) applies; when it exits, the shell stays.

**The agent:** **Settings → Agents** (or **☰ → Agents…**) shows which agent CLIs are installed (Claude Code, Codex),
their versions and folders, installs the others (Kulisa runs its maker's installer), and lists each one's accounts.
**New Account…** there, or New Account under a project's Agents' **+**, starts the agent's own sign-in right there, its page in a clean browser
of Kulisa's (none of your other sign-ins there); the account is shown by the email you signed in to and has a folder
of its own (several side by side: a work and a personal one). A project's tasks run the accounts its page lists
(**Add Agent…**). An account stays until you delete it in Settings → Agents (×, after a question), also when no project
has it any more. Each starts as a clean agent: your own `~/.claude` and `~/.codex` are not used. A project without
one starts its tasks with the terminal only. Each task keeps its choice; **Change agent…** in the terminal's
right-click menu picks another of the project's (with a new conversation).

**Tasks:** several tasks of a project at once, each with its own agent, in its project's group. **+** (a project in
its menu; Ctrl+Shift+N for the shown one's) makes one at once, `task-<n>` until its agent names it (or you do: **Rename…** in its tab's menu): a git worktree on a branch of
its own next to the project (`~/IdeaProjects/myshop@task-2/`; `.env*` and files named in `.worktreeinclude` are
copied), a new session of the project's default agent there (another one: **Make Default** on it in the project's
page, or **Change agent…** after), and its profiles, all closed until the agent or you open one (right-click the task's tab): each a copy of its master, where you
signed in once, for every task. Your
project's folder stays yours: agents merge into it only when you ask. The task's app runs on its own ports: the usual
ones plus `KULISA_PORT_OFFSET` (100, 200, …), and its tabs on local addresses point there. Click a task to switch;
the others keep working. **×** closes a task (its agent stops; its code, profiles and conversation stay, and its
group's menu or **+** opens it again); **Delete Task…** in its tab's menu deletes it, after a question that says what goes
and any work not in main and not pushed. Without git, tasks work in the project's folder itself.

**More terminals:** **+** in the terminal's header opens your shell in the task's folder next to the agent's.
The agent runs what keeps running there too (the app's dev server, `docker compose up`), in a terminal of its own
behind its tab, so you see it, stop it and type into it; it reads the output itself. Terminals are kept across
restarts, as in an IDE, each a fresh shell in its place; **×** or `exit` closes one.

Panes and the terminal are panels: drag one by its header to another place (or onto another panel to stack them as
tabs), drag the gaps between them to resize; **☰ → Arrange panels** offers ready-made arrangements, each drawn as a picture. The grid is
kept across restarts. Profiles are made, renamed, described (who each one is in your app: the agent chooses profiles by it, and asks you when it is not said), given another picture, a test user's login, signed in to once for every task and deleted in **Settings → Profiles** (the gear at the top right; Manage Profiles… in the shown task's tab's right-click menu opens it too), and added to a project on its page there. **×** at the top right of a profile's pane closes it: its tabs
go and free their memory, it stays signed in; the task tab's right-click menu lists it as closed and brings it back with the same tabs. Right-click a tab or the terminal for their menus. **Keys:** Chrome's keys in a profile's page (Ctrl+T, Ctrl+W,
Ctrl+Shift+T, Ctrl+L, Ctrl+Tab …), Kulisa's everywhere, the terminal too (Ctrl+` the agent's terminal and back, Ctrl+Shift+1…9
a task); every other key in the terminal is the agent's. **☰ → Keyboard Shortcuts** (Ctrl+Shift+/) lists them all. **Zoom:**
Ctrl + / Ctrl − / Ctrl 0 outside the pages, or ☰ in the title bar, zooms all of Kulisa, and the pages follow; when it
is not 100%, the title bar shows it (click to reset). The same keys in a page zoom that site in that profile on top of it (shown in the address bar,
click to reset). Both are kept across restarts. **☰ → Theme**: Dark (the default), Light, or System (as your OS); profiles' pages keep your OS's. **☰ → Exit** quits
(on macOS Cmd+Q); the windows and their groups open again at the next start. **⋮ → DevTools** on a pane (or F12, Ctrl+Shift+I in its page) opens the DevTools of its active tab. Kulisa's own DevTools
(F12 outside the pages) exist only when running from source (`npm start`), not in a packaged build. Data
(profiles with your sign-ins) lives in `~/.config/Kulisa`.

## Code

```
src/main/        Electron main process
  index.ts         entry: reads the environment, calls app.start()
  app.ts           the app: windows, groups (a project's open tasks: open a task, close, move to a new window), agents, IPC, quit
  window.ts        a window: its groups and what it shows, its questions
  keys.ts          the keyboard shortcuts: one table, which key an input event is (app.ts takes them before the pages)
  projects.ts      a project's group: its tasks (make, close, open again, delete); removing a project's data
  names.ts         the one rule for names of projects, tasks and profiles; slugs for ids and folders
  tasks.ts         a task: its profiles, agent (terminal, environment), folder and name; copies for a new task
  agents.ts        the agent CLIs to choose from: how to find, install, start and resume each
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
                   task <n>/: profiles.json (with sites' zoom), layout.json (the window's grid), agent.json (the
                   session to resume), Profile <k>/ (its copy of a master: a Chromium profile, its tabs and session
                   cookies in it).
  cdp-proxy.ts     per-profile CDP endpoint over webContents.debugger (no --remote-debugging-port)
  local-only.ts    refuses requests from web pages to the MCP server and the proxy (Host, Origin)
  mcp-server.ts    MCP tools for the agent, each takes a profile; a URL per task (/task/<project>/<n>/mcp)
  agent-hooks.ts   answers for the plugin's hooks (/task/<project>/<n>/hooks/…: the open profiles, the session; the agent's state)
  mimic-chrome.ts  UA, UA-CH headers and userAgentData of Google Chrome
  signin-pages.ts  which pages are sign-in pages; what URL to restore instead of one
  signin-pause.ts  pauses the agent on sign-in pages (temporary implementation, see docs/REPORT.md)
  session-cookies.ts  keeps session cookies across restarts (encrypted with the OS keyring)
  picker.ts        point and tell: Playwright pickLocator → a reference (profile, tab, locator) typed into the agent's prompt
  ghost.ts         the agent's actions: Playwright's annotations in the page, a caption over the pane
  terminal.ts      node-pty: the agent CLI, one per task, and the task's other terminals
src/agent/claude-plugin/  the Kulisa plugin for Claude Code: MCP config, the profiles skill, hooks (claude --plugin-dir)
src/preload/     the window's bridge to the main process
src/renderer/    window UI: Vue 3 components in TypeScript, built by Vite into dist/renderer (vite.config.mts; docs/ui.md).
                 components/: the window's parts (App.vue; TopBar, Grid and grid/ its panels, TaskBar, TaskTab, NewTask, Empty,
                 the dialogs on Modal.vue, menu/ the menus; menus and dialogs are Reka UI's); lib/: what they share
                 (store.ts: what the main process sends;
                 grid.ts, terminals.ts, menu.ts, agents.ts, ask.ts, dialogs.ts, keys.ts, voice.ts). Styles: tokens.css,
                 components.css, each part's own in its file; the icons are Sprite.vue
dist/            the window built (npm run build; not in git)
assets/          the app icon: icon.svg (source) and what each OS needs, rendered by scripts/icons.ts
test/            start.ts (npm test: the groups in parallel), run.ts (one app, its files in order), helpers.ts,
                 setup.ts, the tests by area (agent.ts, profiles.ts, window.ts, grid.ts, zoom-and-closing.ts,
                 tasks.ts; restart-*.ts after a restart), unit/ (plain Node), fixtures/site.ts (docs/testing.md)
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
