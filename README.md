# Kulisa

One window for testing a web app with several users at once. Each **profile** is an embedded browser profile, as
in Chrome (cookies, storage, tabs). You sign in by hand in a profile's pane; a coding agent you choose (Claude Code, Codex) runs
in the built-in terminal and drives the profiles through Kulisa's MCP server. Point at an element (⌖ Pick; Pick again or Esc cancels): a reference
with a locator the agent can act on lands in its prompt, and you write the rest of the message around it.

Website: [kulisa.app](https://kulisa.app). The product and its decisions: [docs/SPEC.md](docs/SPEC.md); status and plans: [docs/ROADMAP.md](docs/ROADMAP.md);
how the design was tested: [docs/REPORT.md](docs/REPORT.md).

## Run

```sh
npm install          # Node 22.13+. Linux: rebuilds node-pty for Electron; macOS, Windows: its prebuilt binaries
npm start            # opens the project used last; at first start the window offers to open one
KULISA_PROJECT=~/my-app npm start
npm test             # starts the real app against a local test site, then again to check a restart
npm run package      # the app for this platform, in out/
npm run make         # installers for this platform, in out/make/ (.deb on Linux, .exe on Windows, .dmg/.zip on macOS)
npm run icons        # after changing assets/icon.svg: icon.png, .ico, .icns next to it
```

Kulisa targets macOS, Windows and Linux; `npm test` passes on Ubuntu and macOS, Windows is untested (see docs/ROADMAP.md). Installers are
built with [Electron Forge](https://www.electronforge.io/) (`forge.config.js`), each on its own platform.

`npm start` and `npm test` run Electron with `--no-sandbox`: on Linux `chrome-sandbox` in `node_modules` is not
setuid on a plain install. The `.deb` installs it setuid, so the installed app runs sandboxed.

| Variable | Effect |
|---|---|
| `KULISA_PROJECT` | Open the project in this folder (added if new). The agent of its main workspace runs there |
| `KULISA_AGENT` | One agent command for every workspace, without asking (e.g. a CLI Kulisa does not know). It gets no Claude Code plugin; its workspace's MCP URL is in its environment as `KULISA_MCP_URL`, with `KULISA_PORT_OFFSET` and `KULISA_WORKSPACE` |
| `KULISA_MIMIC=0` | Do not present profiles as Google Chrome |
| `KULISA_SIGNIN_HOSTS` | More sign-in hosts for the automatic sign-in pause, comma-separated |
| `KULISA_DATA` | Data folder instead of `~/.config/Kulisa` (e.g. to try a build next to your real one) |
| `KULISA_MCP_PORT` | MCP server port (default 4450; `0` picks a free one) |
| `KULISA_SHOT` | Save a screenshot of the whole window to this PNG file ~4 s after start (`KULISA_SHOT_DELAY`, ms) |

**Projects:** a project is a folder, usually a repository, with its own profiles, grid and agent. The project's
name in the title bar opens **Projects**: open another one, open a folder, create a project without a folder
(Kulisa makes `~/Kulisa/<name>`), close the project (back to the Welcome screen), or remove it (Kulisa's data of it and its forks; its folder stays). Opening another project closes this one: its tabs and sign-ins are kept, and its
agent stops; when you come back, the agent continues the conversation where it can (`claude --resume`,
`codex resume --last`). The agent starts in your shell in the project's folder, as if you typed its command in a
terminal there, so the project's environment (direnv's `.envrc`, nvm, mise) applies; when it exits, the shell stays.

**The agent:** the first time a workspace starts, Kulisa asks which agent to run there: Claude Code, Codex, or
the terminal only. One that is not installed gets an **Install** button (Kulisa runs its maker's installer); on its
first start the agent asks you to sign in to it. Each workspace keeps its choice; **Change agent…** in the
terminal's right-click menu picks another (with a new conversation).

**Workspaces:** several tasks of a project at once, each with its own agent. The strip under the grid shows the
project's workspaces: **main** is the project itself; **+** makes a fork of it with a name you give: a git worktree
on a branch of its own next to the project (`~/IdeaProjects/myshop@checkout/`; `.env*` and files named in
`.worktreeinclude` are copied), copies of main's profiles, still signed in, and a new agent session started there.
The fork's app runs on its own ports: the usual ones plus `KULISA_PORT_OFFSET` (100, 200, …), and the fork's tabs
on local addresses point there. Click a workspace to switch; the others keep working. **×** on a fork deletes it
(its folder, branch, profile copies and conversation; it asks first when the fork has changes not in main); **×**
on main closes the project. A project needs git for workspaces (**Initialize git…** in the strip runs `git init`).

Panes and the terminal are panels: drag one by its header to another place (or onto another panel to stack them as
tabs), drag the gaps between them to resize; **☰ → Arrange panels** offers ready-made arrangements. The grid is
kept across restarts. Profiles are added, renamed and deleted in **Profiles ▾ → Manage Profiles…**, or by right-clicking a pane's header
(a name can also be renamed by double-clicking it). **×** at the top right of a profile's pane closes it: its tabs
go and free their memory, it stays signed in; **Profiles ▾** lists it as closed and brings it back with the same tabs. Right-click a tab or the terminal for their menus. **Zoom:**
Ctrl + / Ctrl − / Ctrl 0 outside the pages, or ☰ in the title bar, zooms all of Kulisa, and the pages follow; when it
is not 100%, the title bar shows it (click to reset). The same keys in a page zoom that site in that profile on top of it (shown in the address bar,
click to reset). Both are kept across restarts. **DevTools** on a pane (or F12, Ctrl+Shift+I in its page) opens the DevTools of its active tab. Kulisa's own DevTools
(F12 outside the pages) exist only when running from source (`npm start`), not in a packaged build. Data
(profiles with your sign-ins) lives in `~/.config/Kulisa`.

## Code

```
src/main/        Electron main process
  index.js         entry: reads the environment, calls app.start()
  app.js           window, projects and their workspaces (open, show, create, close), IPC, quit
  workspaces.js    a workspace: its profiles, agent (terminal, environment) and folder; a fork's copies of the profiles
  agents.js        the agent CLIs to choose from: how to find, install, start and resume each
  worktrees.js     git for workspaces: worktree and branch of a fork, files outside git copied, changes, removal
  project-profiles.js  a workspace's profiles in order, open and closed: create, rename, close, open, delete
  profiles.js      a profile: a session on its own folder, tabs (WebContentsView), Playwright connection, sign-in mode
  store.js         projects.json, settings.json (Kulisa zoom, last project); per project in projects/<id>/:
                   workspaces.json, and per workspace <n>/: profiles.json (with sites' zoom), layout.json (the window's
                   grid), agent.json (the session to resume), Profile <k>/ (a Chromium profile, its tabs and session
                   cookies in it).
  cdp-proxy.js     per-profile CDP endpoint over webContents.debugger (no --remote-debugging-port)
  local-only.js    refuses requests from web pages to the MCP server and the proxy (Host, Origin)
  mcp-server.js    MCP tools for the agent, each takes a profile; a URL per workspace (/ws/<n>/mcp)
  agent-hooks.js   answers for the plugin's hooks (/ws/<n>/hooks/…: the open profiles, the session; the agent's state)
  mimic-chrome.js  UA, UA-CH headers and userAgentData of Google Chrome
  signin-pages.js  which pages are sign-in pages; what URL to restore instead of one
  signin-pause.js  pauses the agent on sign-in pages (temporary implementation, see docs/REPORT.md)
  session-cookies.js  keeps session cookies across restarts (encrypted with the OS keyring)
  picker.js        point and tell: Playwright pickLocator → a reference (profile, tab, locator) typed into the agent's prompt
  ghost.js         the agent's actions: Playwright's annotations in the page, a caption over the pane
  terminal.js      node-pty running the agent CLI, one per workspace
src/agent/claude-plugin/  the Kulisa plugin for Claude Code: MCP config, the profiles skill, hooks (claude --plugin-dir)
src/preload/     the window's bridge to the main process
src/renderer/    window UI. renderer.js: the grid of panels (dockview), panes, ☰ and right-click menus; parts in their
                 own files: common.js, menu.js (the menus), terminal.js (xterm.js, one per workspace), projects.js,
                 workspaces.js (the strip, the new-workspace dialog), profile-editor.js; agent-picker.js (choosing and
                 installing an agent; an ES module loaded when needed)
assets/          the app icon: icon.svg (source) and what each OS needs, rendered by scripts/icons.js
test/            run.js (starts the app, runs the files in order), helpers.js, the tests by area (agent.js,
                 profiles.js, window.js, grid.js, zoom-and-closing.js, workspaces.js; restart.js after a restart),
                 fixtures/site.js
```

The experiments behind the design (SPEC section 6, E1–E8) were removed after they answered their questions.
They are in git history at commit `9fe8661`; their results are in docs/REPORT.md.
