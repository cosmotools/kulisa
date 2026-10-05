# Kulisa

Desktop app (Electron) for developing and testing web apps with several users at once. Each **profile** is an
embedded browser profile (own cookies, storage, tabs) shown as a pane. The human signs in by hand in a pane; a
coding agent (Claude Code, unchanged CLI) runs in the built-in terminal and drives profiles through Kulisa's MCP
server. Point-and-tell (⌖ Pick, then click an element) puts a reference with a Playwright locator into the agent's
prompt; the human writes the rest of the message around it.

The author's framing: Kulisa is an IDE for developers (like JetBrains or VS Code), not a bot. Everything happens
inside Kulisa; no external Chrome windows.

- `docs/SPEC.md`: the product: problem, features and phases, architecture decisions.
- `docs/REPORT.md`: how the design was tested and decided. Read its later sections (sign-in, Kasada, session
  cookies) before changing sign-in, identity or persistence code.
- `docs/ROADMAP.md`: what is done, what is next, open issues. Keep it current when a feature lands. **Before
  building something, look for it there** (Deferred ideas, Open issues): it may have been tried and put off, with
  the reason (a native menu in pages froze the desktop, and was built again without reading this).
- `README.md`: how to run, environment variables, a map of `src/`.

## Conventions

- Everything in the repository is written in English: code, comments, documentation, commit messages.
- **Terminology: "profile"**, the word Chrome uses, for one embedded browser identity (cookies, storage, tabs) and
  its pane. Not "persona", "user" or "account" (an account is what a profile signs in to). Early commits and
  experiments said "persona".
- **Keep the amount of own code minimal, so the project stays under control.** Prefer maintained open-source
  libraries to writing our own.
  - Before writing browser or CDP code, check whether playwright-core already does it: picker
    (`page.pickLocator`), snapshots (`ariaSnapshot`), action annotations (`page.screencast.showActions`),
    highlights (`locator.highlight`), recent console messages and requests (`page.consoleMessages`, `requests`).
    Check `@playwright/mcp` and the MCP SDK the same way.
  - Window layout (panels, splits, drag and drop, tabs of panels, saving the grid) is dockview's; use its API
    before adding layout code.
  - Hand-written protocol code is the exception: today only `cdp-proxy.js`, because nothing existing exposes
    `webContents.debugger` over CDP.
  - When adding a dependency, prefer one that is widely used and maintained, and say why in the commit message.
- **Window UI: current HTML, CSS and JS, no build step.** Electron ships a recent Chromium; use what it has instead
  of code or workarounds:
  - Markup in `index.html`, repeated parts as `<template>`s that `renderer.js` clones (not HTML strings in JS);
    semantic elements (`header`, `main`, `nav`, `dialog`).
  - What the platform does natively stays native: `<dialog>` with `form method="dialog"` and `closedby`, `hidden`,
    form submit; one delegated listener on a container rather than one per item.
  - CSS: nesting, custom properties for every color and size (`:root` in styles.css; no literal colors elsewhere),
    `:is()`, `:has()`, `color-mix()`, logical properties. Before overriding dockview, check that its own variables
    or rules don't already do it.
  - No wrapper elements or rules without an effect; when touching a part, remove what it no longer needs.
  - A reusable part of the window (a menu, a dialog, a list) is a file of its own in `src/renderer/` with a small
    interface, like `menu.js` (`openMenu(items, at)`); `renderer.js` wires such parts to the window and holds what
    is specific to it.
- **RAM matters.** Kulisa is Electron plus a Chromium process per tab, for several profiles at once, next to the
  user's own browser and IDE. When choosing how to build something, weigh how much memory it keeps and prefer the
  cheaper way. If a feature would noticeably raise RAM use (a process per tab or profile, keeping hidden things
  alive, large buffers), discuss it with the author before building it. Reference: 5 profiles × 3 tabs ≈ 4 GB,
  almost all in tab processes (REPORT, E8).
- **Every behavior change comes with a test** in `test/run.js`, which drives the real app.
  - Fix a bug by first reproducing it as a failing test, then making it pass (the session-cookie bug was done
    this way).
  - Run `npm test` before committing.
- **Kulisa runs on macOS, Windows and Linux.** Write code for all three: no shell commands, Unix-only paths or
  signals, or Linux-only flags without a branch for the others. Keep platform branches few and in one place per
  concern (e.g. the shell fallback in `terminal.js`). What is untested on a platform goes into ROADMAP.
- Ask before anything outward-facing: pushing, publishing, registering domains.
- Commit only when asked. The repo is public on GitHub (`origin`, github.com/cosmotools/kulisa); push only when
  asked, and never print the remote URL (`git remote -v`): it carries the author's token.

## Commands

```sh
npm start   # the app: the project in $KULISA_PROJECT, else the one opened last (at first start, the folder npm ran in)
npm test    # real app against a local test site (test/fixtures/site.js), then a second run to check a restart
npm run make  # installers for this platform with Electron Forge (forge.config.js), in out/make/
npm run icons # renders assets/icon.svg to icon.png/.ico/.icns (committed; run after changing the SVG)
```

- **Node 22.13+ and npm 11.** npm 11 runs dependencies' install scripts only when listed in `allowScripts` in
  package.json (`npm install-scripts approve <pkg>`). Approving `node-pty` builds it for Node, not Electron;
  run `npm run postinstall` after that.

- **Sandbox and native module.** Electron needs `--no-sandbox` here (`chrome-sandbox` is not setuid); the npm
  scripts pass it. `npm install` rebuilds `node-pty` for Electron (postinstall).
- **Starting the app from a Claude Code session.** The app's terminal starts `claude`, which would inherit the
  parent session's `CLAUDE_*` variables, take itself for a child session and not save its history. Unset them all
  except `CLAUDE_CONFIG_DIR`, and run it in the background:
  `env $(env | grep -o '^CLAUDE[A-Z_]*' | grep -v '^CLAUDE_CONFIG_DIR$' | sed 's/^/-u /') npm start`.
- **Looking at the window.** `KULISA_SHOT=/tmp/kulisa.png npm start` saves a screenshot of the whole window,
  profile views included, about 4 s after start (`KULISA_SHOT_DELAY` in ms). In tests: `shell.screenshot(file)`.
  Then read the PNG. Use it to check any UI change.

## Rules

- **A human signs in, never the agent or the code.** Never type passwords, automate logins, or print or log
  cookie values or tokens.
- **The author's data is in `~/.config/Kulisa`**: profiles with real sign-ins to work tenants.
  - Never delete or overwrite it.
  - Tests use their own temp folder (`/tmp/kulisa-test`).
  - To restart the author's running app, stop it gracefully with SIGINT to the main `electron … .` process, so
    session cookies and tabs get saved; then `npm start` in the background.
- **`src/main/signin-pause.js` is a deliberately temporary implementation** (the author's decision, see REPORT).
  Keep it isolated; the author will replace it. Claude declined to research hiding the agent from bot detection
  (Kasada); don't build that.
- **The MCP server and the CDP proxy listen on 127.0.0.1 only.** Never bind them to 0.0.0.0 or another
  interface: they control signed-in browser profiles. `local-only.js` also refuses requests from web pages (a
  foreign Host: DNS rebinding; any Origin: a page's fetch or WebSocket); keep every new endpoint behind it. Local
  processes are not authenticated yet (open issue in ROADMAP).
- **Do not downgrade `playwright-core`.** It is pinned to `1.64.0-alpha-…` because Kulisa uses APIs that exist
  only there: `page.pickLocator()` (the picker), `page.screencast.showActions()` (the agent's actions in the
  page), `page.consoleMessages()`/`requests()`. Move to the stable release once it ships with them.
- **Killing processes:** `pkill -f <pattern>` also matches the shell running it. Select Electron by
  `ps -eo pid,comm,args` with `comm == "electron"`.

## Architecture

Layers, each using only the ones below it:

1. **Profiles** (`profiles.js`, `store.js`, `session-cookies.js`, `mimic-chrome.js`, `signin-*.js`): browser
   profiles, their tabs and storage. Knows nothing about agents, MCP or the window UI.
2. **Automation access** (`cdp-proxy.js`): the only way anything automated reaches a profile's pages, and where
   sign-in mode is enforced.
3. **Agent bridge**: everything that lets an unchanged agent CLI understand and use profiles.
   - `mcp-server.js` is the functional part and is agent-agnostic: any capability for the agent is an MCP tool
     there, so Codex and other CLIs get it too.
   - Knowledge for Claude Code lives in the Kulisa plugin, `src/agent/claude-plugin/`, which `app.js` passes as
     `claude --plugin-dir`: `.mcp.json` (the URL from `KULISA_MCP_URL`, set in the pty) and the `profiles` skill
     (what profiles are, multi-user work, the sign-in rules, point-and-tell notes), and `hooks/hooks.json`. Hooks
     are `curl` to `$KULISA_URL/hooks/<event>`, answered by `agent-hooks.js` (bash runs hook commands on every
     OS, curl ships with all three); outside Kulisa they do nothing. Change the skill when a tool or a rule
     changes. Packaged, the plugin sits outside the asar (`extraResource`). Point-and-tell types a short
     `[kulisa pick: …]` reference into the agent's prompt without Enter (`picker.js`); it works with any agent CLI.
   - Do not add agent-facing behavior elsewhere (e.g. in `profiles.js` or the renderer).
4. **Window** (`app.js`, `renderer/`, `ghost.js`, `picker.js`, `terminal.js`): what the human sees and does.

Modules (src/main):

- `app.js`: window, projects, profile lifecycle, IPC, terminal, quit handling.
  - A project is a folder with its own profiles, tabs, grid and agent session (`store.js`: `projects/<id>/`; never
    in the project's folder, so sign-ins stay out of its git). Partitions are unique across projects. One project
    is open at a time: opening another saves and closes this one's profiles and stops the agent; the window builds
    the other's grid in place (not reloaded), hidden until laid out (`html.loading`, the views hidden meanwhile), so
    nothing jumps. Claude Code resumes the project's session (the plugin's SessionStart hook reports it).
  - The agent is typed into the user's shell started in the project's folder (`terminal.js`), so the project's
    own environment applies (direnv's `.envrc`, nvm, mise), not the one Kulisa was started with; e.g. a project's
    `CLAUDE_CONFIG_DIR` (another Claude account). On Windows it starts directly.
  - Kulisa's own DevTools exist only when running from source (`appDevTools`, off when `app.isPackaged`; the
    window is created with `devTools: false`). End users get DevTools for profiles' tabs only.
- `profiles.js`: a profile is a `session.fromPartition(partition)` plus one `WebContentsView` per tab.
  - The partition is fixed at creation; a rename changes only id and name.
  - Sign-in mode detaches all automation from the profile's tabs.
  - Close (`app.js`, `shell.closed`) closes its tabs and keeps the profile, signed in; the agent opens it with
    `profile_open`.
  - Delete wipes the session's data at once; the partition folder is removed at the next start
    (`deleted-partitions.json` in `store.js`), and a new profile never reuses a deleted partition.
- **Sizes and zoom.** UI text and controls use `--font` and `--control` (styles.css), not their own sizes. The
  Kulisa zoom is Chromium's zoom of the window's page (`setUiZoom` in app.js); the renderer's boxes are CSS
  pixels and `app.js` scales them for the native views. Pages get the Kulisa zoom times their site's own zoom
  (`profiles.js`).
- The window is a grid of peer panels (dockview, `renderer.js`): a pane per profile and the terminal; dragged,
  stacked as tabs, resized, saved in `layout.json`. Profile views are native and draw above the window's HTML:
  the renderer sends each pane's `.content` box (or that it is off screen) to the main process after every grid
  change. Anything HTML over the panes must hide them (`views:hidden`): the profile editor; while a panel is
  dragged and while a menu is open, pictures of the pages stand in for them (dockview's drop targets and the menus
  are HTML).
- `cdp-proxy.js`: a fake CDP "browser" endpoint per profile over `webContents.debugger`; no
  `--remote-debugging-port`, so the shell UI is never exposed and `navigator.webdriver` stays false. Clients:
  - the shell's own playwright-core connection (MCP tools, picker);
  - `@playwright/mcp`, covered by a test.
- `mcp-server.js`: tools take a `profile` id. Also serves `/hooks/*` (`agent-hooks.js`) for the plugin's hooks.
- `ghost.js`: shows the agent's actions: Playwright's `screencast.showActions()` in the page (the shell's
  connection), and a caption over the pane from commands passing through the proxy (any client).
- `picker.js`: point-and-tell.
- `mimic-chrome.js`: profiles present as Google Chrome of the same engine version (the author's decision).
- `session-cookies.js`: session cookies saved encrypted with `safeStorage` and restored on start.
- `signin-pages.js`: the sign-in host list; restore URLs for tabs on sign-in pages.

## Hard-won facts (each cost hours; details in docs/REPORT.md)

- **`setWindowOpenHandler` → `createWindow`:** pass `options.webContents` into the new `WebContentsView`.
  A fresh one freezes the main process.
- **An uncaught exception in the main process** opens a modal GTK dialog that blocks everything, including the
  proxy and MCP. `app.js` logs instead; keep it that way.
- **No HTTP server in the Electron main process that the app's own pages load from.** A sync Electron call
  waiting on a renderer that waits on that server deadlocks. The test site runs in a child process.
- **The proxy must report real Chrome target ids** (`Target.getTargetInfo`). Playwright assumes
  main frame id == target id. One debugger session per tab is shared by all clients; events fan out.
- **A brand-new `webContents` has no renderer, and CDP commands wait for one.** Tabs go
  `about:blank` → identity override → real URL; clients attach only after `tab.ready`.
- **Electron sends no `Sec-CH-UA*` on navigation requests** (Chrome does). `mimic-chrome.js` adds them, and
  high-entropy hints only after `Accept-CH`.
- **Electron drops session cookies on exit.** Entra and federated sign-ins depend on them, hence
  `session-cookies.js`. Tests must quit with `app.quit()`, not `app.exit()`, so `before-quit` runs.
- **Pages with Trusted Types (Microsoft 365, Google) refuse HTML strings**, so Playwright's
  `screencast.showOverlay(html)` draws nothing there. `locator.highlight()` and `screencast.showActions()` work;
  use those (test page `/strict`).
- **GoDaddy SSO uses Kasada.** Sign-in passes in an embedded profile when no automation is attached during
  sign-in, with mimicry on.
- **With the monitor off or the screen locked**, Chromium renders at 1–2 fps, and anything waiting for frames
  crawls. Don't trust timings taken then (`xset q` shows "Monitor is Off").
- **`ensureSite()` reuses whatever listens on :4417.** A stale server from an earlier run makes tests lie. Check
  `ss -ltnp | grep 4417`.
