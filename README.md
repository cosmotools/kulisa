# Kulisa

One window for testing a web app with several users at once. Each **profile** is an embedded browser profile, as
in Chrome (cookies, storage, tabs). You sign in by hand in a profile's pane; a coding agent (Claude Code) runs in the
built-in terminal and drives the profiles through Kulisa's MCP server. Point at an element (⌖ Pick; Pick again or Esc cancels): a reference
with a locator the agent can act on lands in its prompt, and you write the rest of the message around it.

The product and its decisions: [docs/SPEC.md](docs/SPEC.md); status and plans: [docs/ROADMAP.md](docs/ROADMAP.md);
how the design was tested: [docs/REPORT.md](docs/REPORT.md).

## Run

```sh
npm install          # Node 22.13+. Rebuilds node-pty for Electron.
npm start            # opens the project used last (at first start: the current folder)
KULISA_PROJECT=~/my-app npm start
npm test             # starts the real app against a local test site, then again to check a restart
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
| `KULISA_PROJECT` | Open the project in this folder (added if new). The agent runs there; details of picked elements go to `<project>/.kulisa/notes` |
| `KULISA_AGENT` | Another agent CLI, e.g. `KULISA_AGENT="codex"`. It gets no Claude Code plugin; the MCP server's URL is in its environment as `KULISA_MCP_URL` |
| `KULISA_MIMIC=0` | Do not present profiles as Google Chrome |
| `KULISA_SIGNIN_HOSTS` | More sign-in hosts for the automatic sign-in pause, comma-separated |
| `KULISA_DATA` | Data folder instead of `~/.config/Kulisa` (e.g. to try a build next to your real one) |
| `KULISA_MCP_PORT` | MCP server port (default 4450; `0` picks a free one) |
| `KULISA_SHOT` | Save a screenshot of the whole window to this PNG file ~4 s after start (`KULISA_SHOT_DELAY`, ms) |

**Projects:** a project is a folder, usually a repository, with its own profiles, grid and agent. The project's
name in the title bar opens **Projects**: open another one, open a folder, or create a project without a folder
(Kulisa makes `~/Kulisa/<name>`). Opening another project closes this one: its tabs and sign-ins are kept, and its
agent stops; when you come back, Claude Code continues the conversation (`claude --resume`). The agent starts in
your shell in the project's folder, as if you typed `claude` in a terminal there, so the project's environment
(direnv's `.envrc`, nvm, mise) applies; when it exits, the shell stays.

Panes and the terminal are panels: drag one by its header to another place (or onto another panel to stack them as
tabs), drag the gaps between them to resize; **⋮ → Arrange panels** offers ready-made arrangements. The grid is
kept across restarts. Profiles are added, renamed and deleted in **Profiles ▾ → Manage Profiles…**, or by right-clicking a pane's header
(a name can also be renamed by double-clicking it). **×** at the top right of a profile's pane closes it: its tabs
go and free their memory, it stays signed in; **Profiles ▾** lists it as closed and brings it back with the same tabs. Right-click a tab or the terminal for their menus. **Zoom:**
Ctrl + / Ctrl − / Ctrl 0 outside the pages, or ⋮ in the title bar, zooms all of Kulisa, and the pages follow; when it
is not 100%, the title bar shows it (click to reset). The same keys in a page zoom that site in that profile on top of it (shown in the address bar,
click to reset). Both are kept across restarts. **DevTools** on a pane (or F12, Ctrl+Shift+I in its page) opens the DevTools of its active tab. Kulisa's own DevTools
(F12 outside the pages) exist only when running from source (`npm start`), not in a packaged build. Data
(profiles with your sign-ins) lives in `~/.config/Kulisa`.

## Code

```
src/main/        Electron main process
  index.js         entry: reads the environment, calls app.start()
  app.js           window, profiles lifecycle, IPC, agent terminal
  profiles.js      a profile: session partition, tabs (WebContentsView), Playwright connection, sign-in mode
  store.js         projects.json, settings.json (Kulisa zoom, last project); per project in projects/<id>/: profiles.json
                   (with sites' zoom), tabs.json, layout.json (the window's grid), agent.json (the session to resume)
  cdp-proxy.js     per-profile CDP endpoint over webContents.debugger (no --remote-debugging-port)
  local-only.js    refuses requests from web pages to the MCP server and the proxy (Host, Origin)
  mcp-server.js    MCP tools for the agent, each takes a profile
  agent-hooks.js   answers for the plugin's hooks (/hooks/session-start: the open profiles; notes the session)
  mimic-chrome.js  UA, UA-CH headers and userAgentData of Google Chrome
  signin-pages.js  which pages are sign-in pages; what URL to restore instead of one
  signin-pause.js  pauses the agent on sign-in pages (temporary implementation, see docs/REPORT.md)
  session-cookies.js  keeps session cookies across restarts (encrypted with the OS keyring)
  picker.js        point and tell: Playwright pickLocator → details files → a reference typed into the agent's prompt
  ghost.js         the agent's actions: Playwright's annotations in the page, a caption over the pane
  terminal.js      node-pty running the agent CLI
src/agent/claude-plugin/  the Kulisa plugin for Claude Code: MCP config, the profiles skill, hooks (claude --plugin-dir)
src/preload/     the window's bridge to the main process
src/renderer/    window UI: top bar, menus (menu.js), profile editor, the grid of panels (dockview): panes, xterm.js
assets/          the app icon: icon.svg (source) and what each OS needs, rendered by scripts/icons.js
test/            run.js (the tests), fixtures/site.js (local test site)
```

The experiments behind the design (SPEC section 6, E1–E8) were removed after they answered their questions.
They are in git history at commit `9fe8661`; their results are in docs/REPORT.md.
