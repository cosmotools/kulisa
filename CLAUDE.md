# Kulisa

Desktop app (Electron) for developing and testing web apps with several users at once. Each **profile** is an
embedded browser profile (own cookies, storage, tabs) shown as a pane. The human signs in by hand in a pane; a
coding agent the human chooses (Claude Code, Codex: the unchanged CLI) runs in the built-in terminal and drives
profiles through Kulisa's MCP server. Workspaces run several agents on one project at once. Point-and-tell (Pick, then click an element) puts a reference with a Playwright locator into the agent's
prompt; the human writes the rest of the message around it.

The author's framing: Kulisa is an IDE for developers (like JetBrains or VS Code), not a bot. Everything happens
inside Kulisa; no external Chrome windows.

- `docs/SPEC.md`: the product: problem, features and phases, architecture decisions.
- `docs/REPORT.md`: how the design was tested and decided. Read its later sections (sign-in, Kasada, session
  cookies) before changing sign-in, identity or persistence code.
- `docs/ROADMAP.md`: only what is planned: ideas and details of features to build, deferred ideas, open issues.
  When a feature is built, document it in the docs below (how it works, and why it is built so) and remove it from
  the ROADMAP, keeping only what is left of it. **Before
  building something, look for it there** (Deferred ideas, Open issues): it may have been tried and put off, with
  the reason (a native menu in pages froze the desktop, and was built again without reading this).
- `docs/profiles.md`, `docs/workspaces.md`, `docs/window.md`: how profiles, projects with their workspaces, and the
  window work now: what the human and the agent do, what Kulisa creates on the computer and removes, why it is built
  so, the code. Read the one for the part you change; keep it current.
- `docs/ui.md`: what the window's UI is built of: tokens, icons, components (buttons, rows, dialogs, menus). Look
  there before making a button, an icon, a row or a dialog; keep it current.
- `README.md`: how to run, environment variables, a map of `src/`.
- `docs/LICENSING.md`: Kulisa is GPL-3.0-or-later, the author's; what the license covers and what it does not.

## Conventions

- Everything in the repository is written in English: code, comments, documentation, commit messages.
- **Terminology: "profile"**, the word Chrome uses, for one embedded browser identity (cookies, storage, tabs) and
  its pane. Not "persona", "user" or "account" (an account is what a profile signs in to). Early commits and
  experiments said "persona".
- **Terminology: "Kulisa plugin"** for the layer between the agent and the profiles (Architecture, layer 3): the
  MCP server with the browser tools (agent-agnostic, where new abilities go) plus a package per agent that brings
  it in with a skill and hooks (for Claude Code `src/agent/claude-plugin/`; Codex plugins have the same parts).
  Giving the agent more it can do in the browsers is one of Kulisa's features: extend the MCP server, then describe
  it in the skill.
- **Terminology: "plugin" vs "extension".** A plugin is always an agent's (Claude Code's, Codex's), the Kulisa plugin
  being one. Code that extends Kulisa itself (panels, features of the IDE) is an "extension", as in VS Code and
  Chrome. Not "module": that is a file of code.
- **The agent is the human's choice, per workspace** (`agents.js`): never assume `claude` is installed. Kulisa
  installs a missing agent itself with its maker's installer when the human asks, without steps for them to type.
- **Terminology: "Welcome screen"** (the author also says "Экран"), as JetBrains names it: what the window shows
  instead of the grid when no project is open (at first start, after its last tab is closed): New Project…, Open Folder…,
  the recent projects. `#welcome` in `index.html`, `projects.js`. Not "window" (there is one) or "page".
- **Terminology: "workspace"**, the word tools for parallel agents use (e.g. Conductor), for one line of work
  inside a project: an agent (its terminal and session, any agent CLI), a branch of the code, profiles and a grid.
  Main is the project itself; forks are temporary worktrees next to it (`myshop@<ws>`). Several workspaces build
  several features at once. A project is the folder; a workspace is inside it (not VS Code's sense of the word).
  How they work and why: `docs/workspaces.md`; what is left: ROADMAP, "Workspaces, rest".
- **Not tied to one agent or LLM vendor.** The user chooses the agent CLI (Claude Code, Codex, others); Kulisa must
  not require Claude Code or any one model provider. When planning a feature, design it for any agent CLI:
  - The core of a feature works through what every agent has: a terminal, the MCP server, files, git. Kulisa's
    own data and conventions (e.g. its own folders), not one agent's (`.claude/…`).
  - What only some agents can do (Claude Code's `--resume`, `--fork-session`, plugin, hooks) is an optional extra
    per agent, kept in one place per agent, and the feature still works without it.
  - Claude Code is the default and the best supported today; that is fine as long as the others are not locked out.
- **Keep the amount of own code minimal, so the project stays under control.** Prefer maintained open-source
  libraries to writing our own.
  - Before writing browser or CDP code, check whether playwright-core already does it: picker
    (`page.pickLocator`), snapshots (`ariaSnapshot`), action annotations (`page.screencast.showActions`),
    highlights (`locator.highlight`), recent console messages and requests (`page.consoleMessages`, `requests`).
    Check `@playwright/mcp` and the MCP SDK the same way. Read the API of the installed version, not what you
    remember: it is a 1.64 alpha, whose newest APIs are younger than your training. Its documentation is in
    `node_modules/playwright-core/types/types.d.ts` (playwright.dev describes the stable release); name what you read
    in the plan.
  - Window layout (panels, splits, drag and drop, tabs of panels, saving the grid) is dockview's; use its API
    before adding layout code.
  - Before building anything that touches Electron, look it up in Electron's documentation for the installed version
    instead of building from memory (Electron ships every 8 weeks; knowledge from training is older). The guides,
    their index and what changed between versions are in the repository's docs at the version's tag
    (`https://raw.githubusercontent.com/electron/electron/v<version>/docs/`: `README.md`, `tutorial/…`, `api/…`,
    `breaking-changes.md`); the API is in `node_modules/electron/electron.d.ts`. Name what you read in the plan. The
    dark mode was first built from memory, and redone after its guide was read.
  - Hand-written protocol code is the exception: today only `cdp-proxy.js`, because nothing existing exposes
    `webContents.debugger` over CDP.
  - When adding a dependency, prefer one that is widely used and maintained, and say why in the commit message. Its
    license must allow being part of a GPL-3.0 program (MIT, ISC, BSD, Apache-2.0 do; `docs/LICENSING.md`).
- **Window UI: current HTML, CSS and JS, no build step.** Electron ships a recent Chromium; use what it has instead
  of code or workarounds:
  - Markup in `index.html`, repeated parts as `<template>`s that `renderer.js` clones (not HTML strings in JS);
    semantic elements (`header`, `main`, `nav`, `dialog`).
  - What the platform does natively stays native: `<dialog>` with `form method="dialog"` and `closedby`, `hidden`,
    form submit; one delegated listener on a container rather than one per item.
  - **One set of components** (`docs/ui.md`): the window is built of them, each defined once. Icons are the
    sprite's in `index.html` (`<use href="#i-…">`), never drawn in place; icon buttons are `.icon`; rows `.item`;
    every dialog has the same parts: `header` (title, × when it may be closed), `.body`, `footer` with the buttons at
    the right end, the main one last (`.primary`, `.danger` when it deletes). CSS in three files: `tokens.css`
    (colors, sizes), `components.css` (the components), `window.css` (the layout and the window's own parts; it
    places components, never restyles them into new ones). Something new that more than one place could use goes
    into `components.css` and `docs/ui.md` first.
  - CSS: nesting, custom properties for every color and size (`tokens.css`; no literal colors elsewhere; each color
    `light-dark()` for both themes),
    `:is()`, `:has()`, `color-mix()`, logical properties. Before overriding dockview, check that its own variables
    or rules don't already do it.
  - No wrapper elements or rules without an effect; when touching a part, remove what it no longer needs.
  - A reusable part of the window (a menu, a dialog, a list) is a file of its own in `src/renderer/` with a small
    interface, like `menu.js` (`openMenu(items, at)`); `renderer.js` wires such parts to the window and holds what
    is specific to it.
  - A part needed only now and then (a first-start wizard, a dialog opened rarely) is an ES module loaded when
    needed, with `import()` (works over `file://`, no build step; it sees the window's globals such as `tpl` and
    `kulisa`), like `agent-picker.js`. Its markup stays in `index.html`. Parts the window uses all the time stay
    plain scripts. Order in the code matters as much as speed: each part in its file, loaded when it is used.
- **RAM matters.** Kulisa is Electron plus a Chromium process per tab, for several profiles at once, next to the
  user's own browser and IDE. When choosing how to build something, weigh how much memory it keeps and prefer the
  cheaper way. If a feature would noticeably raise RAM use (a process per tab or profile, keeping hidden things
  alive, large buffers), discuss it with the author before building it. Reference: 5 profiles × 3 tabs ≈ 4 GB,
  almost all in tab processes (REPORT, E8).
- **Nothing piles up on the user's computer.** Everything Kulisa writes has an owner and an end:
  - It goes when its owner goes (a profile, a workspace, a project: their data, the copies, git's and the agent's
    records of a fork), at once or at the next start when a file is still open (`deleted-folders.json`).
  - It is rewritten rather than added to: no files per event, no logs that grow; or it has a limit.
  - Temporary files are removed when done, also after an error; pictures and the like stay in memory.
  - A new kind of file or folder is listed in "What is on the computer" (`docs/workspaces.md`, `profiles.md`) with
    when it goes, and its removal is tested.
  - The same in development: tests write only in their temp folder; screenshots, logs and scripts made while working
    go into the session's scratch folder and are deleted when the task is done.
- **Every behavior change comes with a test** in `test/` (the file of its area; `run.js` starts the real app and
  runs the files in order, later tests building on earlier ones; shared helpers in `helpers.js`).
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
npm start   # the app: the project tabs open last, plus $KULISA_PROJECT's (at first start none: open one)
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
  - To restart the author's running app, or give them a fresh start: the `run-kulisa` skill
    (`.claude/skills/run-kulisa/`): SIGINT to the main `electron … .` process, so session cookies and tabs get
    saved; then `npm start` in the background.
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

How the parts work, in detail: `docs/profiles.md` (profiles, sign-ins, the CDP proxy, the agent's tools, point and
tell), `docs/workspaces.md` (projects, workspaces, agents, windows, what is on the computer) and `docs/window.md`
(the title bar, the grid, zoom, menus, dialogs, the terminal). Read the one for the part you
change; keep it current. Here: the layers, the modules, and what must hold.

Layers, each using only the ones below it:

1. **Profiles** (`profiles.js`, `project-profiles.js`, `store.js`, `session-cookies.js`, `mimic-chrome.js`,
   `signin-*.js`): browser profiles, their tabs and storage. Knows nothing about agents, MCP or the window UI.
2. **Automation access** (`cdp-proxy.js`): the only way anything automated reaches a profile's pages, and where
   sign-in mode is enforced.
3. **Kulisa plugin** (formerly "agent bridge"): everything that lets an unchanged agent CLI understand and use
   profiles: tools, knowledge (skill) and hooks, as Claude Code and Codex plugins bundle them.
   - `mcp-server.js` is the functional part and is agent-agnostic: any capability for the agent is an MCP tool
     there, so Codex and other CLIs get it too. One URL per workspace (`/ws/<project>/<n>/mcp`).
   - Claude Code's package is `src/agent/claude-plugin/` (`claude --plugin-dir`): `.mcp.json` (`KULISA_MCP_URL`),
     the `profiles` skill (change it when a tool or a rule changes), `hooks/hooks.json` (`curl` to
     `$KULISA_URL/hooks/<event>`, answered by `agent-hooks.js`; outside Kulisa they do nothing). Packaged, it sits
     outside the asar (`extraResource`).
   - Do not add agent-facing behavior elsewhere (e.g. in `profiles.js` or the renderer).
4. **Window** (`app.js`, `window.js`, `projects.js`, `workspaces.js`, `worktrees.js`, `agents.js`, `renderer/`, `ghost.js`, `picker.js`,
   `terminal.js`): what the human sees and does.

**One core, with handles for the human and for the agent.** The human (the window) and the agent (the Kulisa
plugin) do the same things to profiles, tabs and workspaces: open a tab, go to an address, close or delete a profile.
Each such action is written once, in the core (`Workspace`: `find`, `findTab`, `createProfile`, `deleteProfile` …;
`Profile`: `newTab`, `navigate`, `closeTab` …), with its checks, its questions to the human and its rules. The
windows' IPC (`app.js`) and the agent's MCP tools (`mcp-server.js`) are handles on it: each finds what to act on
through the core, calls it, and translates the answer (`{ error }` for the window, an error the agent reads). A
check, a rule or a way of doing an action is never written in a handle, nor twice.

- A new action goes into the core first, then gets both handles. When one side should not have it, say why in
  the table of actions in `docs/profiles.md` (Pick is the human's, `browser_highlight` the agent's). An action
  missing on one side for no reason is a gap to fill, not a decision.
- What only automation keeps to stays in the agent's handle: the sign-in pause. What the agent does inside a page
  goes through Playwright over the proxy (layer 2), so the human sees it and the pause holds; the core still
  decides what is done (`browser_navigate` takes the address as the address bar does: `toUrl`).
- What only the window needs (where the keyboard focus goes, pictures of the pages under a menu) stays in the
  window.

Modules (`src/main`):

- `app.js`: the app: its windows, the open projects (open, close, move one to a new window; one change after
  another: `serial`), the agents, the windows' IPC (each message acts in the window it comes from: `event.sender`),
  quit. `shell.win`, `shell.ws`, `shell.profiles`, `shell.closed`, `shell.pty` are the first window's (the tests').
- `window.js`: a window: its project tabs and what it shows (show a project or a workspace, the grid's state, the
  views' places), the questions asked there (`shell.ask(q, window)`, in its dialog: `ask.js`), the theme's colors
  CSS does not paint.
- `projects.js`: an open project: its workspaces, making and deleting a fork, removing a project's data.
- `workspaces.js`: a workspace: its profiles, its agent in its own terminal and environment, a fork's copies.
- `worktrees.js`: git for forks (the user's git, never a shell): worktree, branch, files outside git, direnv.
- `agents.js`: the agents to choose from, one entry each: find, install, start, resume. Agent-specific code goes
  here.
- `project-profiles.js`: a workspace's profiles in order, open and closed: create, rename, close, open, delete.
- `profiles.js`: a profile: `session.fromPath(<workspace>/Profile <k>)` plus a `WebContentsView` per tab.
- `store.js`: Kulisa's data folder, laid out as Chrome's user data.
- `names.js`: the one rule for names (projects, workspaces, profiles: an email address's characters) and slugs.
- `session-cookies.js`, `signin-pages.js`, `signin-pause.js`, `mimic-chrome.js`: sign-ins that last, the sign-in
  pause, presenting as Google Chrome.
- `cdp-proxy.js`, `local-only.js`: the CDP endpoint per profile; refusing web pages.
- `mcp-server.js`, `agent-hooks.js`, `ghost.js`, `picker.js`: the agent's tools and hooks, its actions shown, point
  and tell.
- `terminal.js`: a pty per workspace, the agent typed into the user's shell in its folder (the project's own
  environment: direnv, nvm, mise). On Windows started directly.

What must hold in the window:

- **Profile views are native and draw above the window's HTML.** They belong to their project's window (moving a
  project moves them: `Profile.moveTo`). The renderer sends each pane's `.content` box (or
  that it is off screen) to the main process after every grid change. Anything HTML over the panes must hide them
  (`views:hidden`): dialogs; while a panel is dragged or a menu is open, pictures of the pages stand in for them.
- **Sizes and zoom.** UI text and controls use `--font` and `--control` (tokens.css), not their own sizes. The Kulisa
  zoom is Chromium's zoom of every window's page (`setUiZoom` in app.js); the renderer's boxes are CSS pixels and
  `window.js` scales them for the native views. Pages get the Kulisa zoom times their site's own zoom.
- Kulisa's own DevTools exist only when running from source (`appDevTools`, off when `app.isPackaged`). End users
  get DevTools for profiles' tabs only.

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
- **Chromium holds CDP commands to a tab until its navigation commits.** A site that never answers hung
  `connectOverCDP` and with it opening the project; the proxy shows a tab only once its site has answered
  (`tab.answered`, test `/hang`).
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
