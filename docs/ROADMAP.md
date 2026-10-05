# Roadmap

Feature numbers refer to [SPEC.md](SPEC.md), section 2. Update this file when something lands or changes plan.

## Done

- **Feature 1, profiles.** A profile editor (Profiles ▾ → Manage Profiles…): add, rename, delete (with a confirmation; wipes the
  profile's sign-ins and data). Renaming also works by double-clicking a pane's name. Each profile has its own
  cookies and storage; tabs, `target=_blank` and `window.open` stay in it. Sign-ins and tabs survive restarts,
  session cookies included.
- **Feature 2, see what the agent does.** Playwright's action annotations in the page (a mark at each action
  point, the element outlined, a title, fading out; for the agent's Kulisa tools); a caption in the pane header
  for any client.
- **The agent points back.** `browser_highlight` outlines elements on a profile's page (Playwright's
  `locator.highlight()`, following the element) and shows the labels in the pane header, until the human
  clicks or types in that tab.
- **Feature 3, point and tell.** ⌖ Pick (again, or Esc in the page, cancels), then click an element: a reference to it (profile, locator, a details file)
  is typed into the agent's prompt without Enter, and the terminal gets the focus. Picks from several panes go into
  one message.
- **Projects.** A project is a folder (usually a repository) with its own profiles, tabs, grid and agent
  session; the Kulisa zoom is global. The project's name in the title bar opens a menu of the projects, as in
  JetBrains: open another, Open Folder…, and Manage Projects… (the dialog: also create one without a folder,
  `~/Kulisa/<name>`). Opening another closes this one (tabs, sign-ins
  and grid saved, agent stopped); coming back resumes Claude Code's conversation (`--resume` with the session the
  SessionStart hook reported). Data in `<user data>/projects/<id>/`; the data from before projects became the first
  project (copied, originals kept). Each project gets its own color: a round glow from the middle of the window
  (seen in the gaps between the islands and the title bar), the logo's curtain and the name's plate. The agent is typed into the user's shell started in the project's folder, so
  the project's environment (direnv's `.envrc`, e.g. another Claude account) applies; untested on macOS (login
  shell) and Windows (started directly, no shell).
- **Window grid.** Profiles' panes and the terminal are peer panels in a grid (dockview): drag one to another
  place, stack panels as tabs, resize; JetBrains' Islands look. Ready-made arrangements in ☰ → Arrange panels: profiles in
  columns with the terminal below, two by two with the terminal right, one profile at a time. The grid is saved
  and restored.
- **Zoom.** One text size and control height for the whole UI (`--font`, `--control` in styles.css). The Kulisa
  zoom (Ctrl + / − / 0 outside the pages, or ☰ in the title bar, as Chrome's menu; the title bar shows it when not
  100%) scales the UI, the terminal and the pages
  together; Ctrl + / − / 0 in a page zooms that site in that profile on top of it, as in Chrome. Both saved.
- **Closing a profile.** × at the top right of its pane (or its right-click menu, or the agent) closes it: the
  pane and tabs go and free their memory; it stays in the project, signed in (session cookies saved), and Profiles ▾
  (a menu of the profiles, as the project button's; or `profile_open`) brings it back with the same tabs. Stays closed across restarts (`closed` in
  profiles.json).
- **Menus.** Kulisa draws its menus in HTML, as Chrome does (a popover, `src/renderer/menu.js`): the project
  button (projects with their color and folder), ☰ (the zoom row "− 100% +", Arrange panels), and right-click on a
  pane's header (New tab, Rename, Delete profile…), a tab (Reload, Duplicate, Close, Close others) and the
  terminal (Copy, Paste, Select all, Clear). The pages are native views above the HTML, so while a menu is open
  they are pictures of themselves, as during a drag. Native menus were tried first (2026-10-05): rows of text
  only, no buttons in a row; and a native menu in a page had frozen the desktop before (Deferred ideas). Deleting
  a profile asks with the OS's own question (`dialog.showMessageBox`). Not in the pages yet.
- **App icon.** A stage curtain drawn apart with the agent's pointer (`assets/icon.svg`); in the window's top
  bar, the taskbar, and the installers (`.deb` checked: menu entry and pixmap; `.exe`, `.dmg` not built yet). Run
  from source (`npm start`), GNOME's dock shows a generic icon: it takes icons from installed `.desktop` files
  only (the `.deb` installs one matching the window class `kulisa`); left as is on purpose.
- **Packaging.** Electron Forge (`npm run make`): `.deb` on Linux (tested: installs `chrome-sandbox` setuid root,
  the packaged app starts), Squirrel `.exe` on Windows, `.dmg`/`.zip` on macOS (not built yet).
- **DevTools.** A DevTools button on each pane (also F12 or Ctrl+Shift+I in its page) opens the active tab's
  DevTools in a separate window. Kulisa's own DevTools only when running from source; a packaged build has
  none (`appDevTools`, off when `app.isPackaged`).
- **Terminal.** The agent CLI (Claude Code by default) runs unchanged in the window.
- **MCP.** Tools take a profile id; `profile_create`, `profile_open`, `profile_close` and `profile_delete` manage
  profiles (a deletion by the agent asks the human first); `browser_tab_new`/`_select`/`_close` manage tabs. `@playwright/mcp` also works through the per-profile CDP proxy. Web pages cannot reach the MCP
  server or the proxy (`local-only.js`).
- **Agent bridge.** `claude` starts with the Kulisa plugin (`src/agent/claude-plugin`): the MCP config and a
  skill on working with profiles, and a `SessionStart` hook that tells it which profiles are open. The user's own
  MCP servers stay available (no `--strict-mcp-config`).
- **Profiles present as Google Chrome.** UA, UA-CH, `userAgentData` (`mimic-chrome.js`).
- **Strict sign-in.** Entra, including a GoDaddy-federated tenant behind Kasada, passes with the automatic sign-in
  pause.

## Next

- **Projects, rest.**
  - Opening a project asks "this window or a new window"; a new window is a second window of the same Kulisa (two
    instances cannot share the user-data folder). Needs what is one per app today (terminal, picker, the
    window's IPC) to become one per window.
  - Use a profile of another project.
  - Remove a project from the list (and decide what happens to its profiles).
- **Several agents in one project**, to build several features at once. Agreed so far:
  - Each agent is a terminal panel with its own Claude Code session (`--session-id`, resumed later) and its own
    git worktree and branch (`claude --worktree`); without worktrees, agents edit the same files.
  - Each agent has its own profiles and sees only them: the MCP server tells agents apart by a URL per agent with
    a secret token (which also closes the open issue below about local processes). A profile's header shows its
    agent; a pick goes to the agent that has the profile.
  - When an agent is closed, its profiles become free and stay signed in, for the next agent.

  Open problems, to decide when this is built:
  - **Two agents need the same account.** Options:
    - *Fork* (copy the profile folder, sign-ins included; Playwright's `storageState` does the same for parallel
      tests). Cannot be merged back: storage and rotated tokens have one valid copy. With rotating tokens
      (Microsoft, Google) a copy can sign the other out, the original included; apps with one session per user
      kick one out; logout ends both; forgotten forks keep live sessions on disk. If built: started by the
      human, tied to an agent, on closing the agent "delete / keep as a profile / replace the original".
    - *Linked clone*: copies that keep the sign-in cookies in sync (Electron's cookie `changed` event), so a
      rotated token reaches all copies; tabs stay separate. To check: sign-ins kept in `localStorage` (MSAL).
    - *A pool per role*: the human signs in "admin #1", "admin #2"; an agent takes a free one and returns it.
    - *Shared profile, own tabs*, actions queued: no copies, weak isolation (shared cookies, logout).
    - Whether an agent may take a free profile itself or only gets one from the human.
  - **The app under test runs once.** Every worktree has the same README command (`npm run dev` →
    `localhost:3000`). Besides the port, worktrees share the local database (migrations of different branches),
    Redis and queues, OAuth redirect URLs registered for one address, and cookies (one jar for all ports of
    `localhost`). Common practice: a port per worktree through `PORT` or `.env.local`, a database per branch,
    hostnames through a local proxy (`a.localhost`), docker compose per worktree, or one dev server at a time.
    Kulisa could give each agent `PORT` and its name in the environment, tell it in the skill to run its server
    there, and open the agent's profiles at the address the agent reports. A project that cannot run twice:
    one shared dev server, the panes show whose branch it is.
  - **Window:** all agents' panels at once, or switch between agents (each with its terminal and profiles).
  - RAM: each agent is a Claude Code process (about 200–400 MB) plus its own profiles.
- **Discuss security for the end user** (with the author, before a public release). Kulisa holds signed-in work
  accounts and lets an agent act in them. Topics, each to decide or document for users:
  - **What the agent can do in signed-in accounts:** read private data (it saw passwords in a Teams chat), send
    messages, delete things. Confirmation for risky actions? Per-profile read-only mode?
  - **Prompt injection from pages:** text on a page the agent reads (snapshots, a picked element's details) can
    carry instructions to the agent.
  - **Local access:** any local process can drive the profiles through the MCP server or the CDP proxy (see Open
    issues; a per-launch token).
  - **Data at rest:** browser profiles in the user-data folder (Chromium's own cookie encryption), saved session
    cookies (`safeStorage`; what if the OS keyring is unavailable), picked-element details in
    `<project>/.kulisa/notes` (page HTML, screenshots; could get committed to the project's git).
  - **Electron hardening:** the shell window runs with `sandbox: false` and a preload that forwards any IPC
    channel; profile pages are sandboxed and have no preload. Check against Electron's security checklist.
  - **Distribution:** code signing, notarization, auto-update channel, the `.deb`'s setuid `chrome-sandbox`.
  - **Presenting as Google Chrome:** what users should know (sites' terms, bot detection).
- **Feature 7, rest.** Reset a profile to a clean state (keeping its name), seeded test users.
- **Feature 4, timeline.** One feed of DOM (rrweb-like), network, console and agent actions across profiles; scrub
  back and pick in the past.
  - **Decide first: a UI library.** The window UI is plain HTML/CSS/JS with hand-kept keyed DOM updates (panes,
    tabs, editor rows); layout is dockview's (framework-free). Fine at this size; the timeline and profile mail
    would make that own code grow, and become dockview panels. Candidates: Preact (+ htm) or Lit, both small and
    usable without a heavy build. Not Tailwind (styles are tiny; it needs a build step) and no ready-made
    component kits (Kulisa needs its own IDE look).
- **Feature 6, profile mail.** A local mail catcher with a mailbox per profile, shown next to the panes and
  readable by the agent.
- **Feature 5, run to test.** Save a multi-profile run as a Playwright test.

## Deferred ideas

- **A panel in its own OS window** (e.g. a profile on a second monitor). dockview has popout windows, but a
  profile's page is a native view of the main window and would have to move to the new window. To discuss.
- **A right-click menu in pages** (copy, paste, open a link in a new tab of the profile, Inspect Element; more items
  later). Tried with electron-context-menu (native GTK menu) on 2026-10-05 and removed:
  - On Ubuntu GNOME (X11) a right-click in a profile's page froze the whole desktop, twice: gnome-shell logged a
    menu window with a NaN position and a size of -2147483648 (the invisible menu kept the pointer and keyboard
    grab). Cause not found; suspects: the frameless window with the title-bar overlay, the page in a
    `WebContentsView`.
  - The menu also took the right button from sites that have their own context menu (Teams, Google Docs).
  - Before trying again: show it only where the page did not handle the right-click, and either find the cause of
    the freeze in a minimal window first or draw the menu in HTML (a small view above the page, as VS Code draws
    its menus on Linux).
  - The window's menus are HTML now (Menus, above); a page menu could be one too, over a picture of the page.
- **Memory of panes off screen.** A pane stacked behind another keeps its tabs alive (and their memory). Unloading
  them while hidden would save RAM at the cost of reloading; not done.
- **A Kulisa profile as a real Chrome profile.** Wanted: the profile's folder in Chrome's own format, so one button
  opens the same profile in the installed Google Chrome with the same tabs and sign-ins, and the storage layout
  is simply Chrome's. Wanted natively, without workarounds, so deferred until there is a clean way. Why it does
  not work as a shared folder today:
  - Cookies are encrypted with different keys: Chrome's "Chrome Safe Storage" vs Electron's "Kulisa Safe
    Storage" (keyring, Keychain); on Windows, Chrome 127+ also binds cookies to Chrome itself (App-Bound
    Encryption). Only Linux with `--password-store=basic` on both sides would share a key.
  - Chromium versions differ (Electron's vs the installed Chrome); each side may migrate the databases into a
    format the other cannot read.
  - A profile folder is locked by whoever has it open, and Electron cannot unload a partition while running.
  - Electron does not write Chrome's tab session files (`Sessions/`) and drops session cookies; Kulisa keeps
    them itself (`tabs.json`, `session-cookies/`).
  - Considered and not chosen for now (a workaround, not native): an "Open in Chrome" button that starts Chrome
    (`chrome-launcher`) on its own folder per Kulisa profile and copies cookies and tabs over a short CDP
    connection. Copies only; `localStorage` tokens and Kasada-protected sessions may not carry over.

## Open issues

- **The MCP server and the CDP proxy do not authenticate local processes.** Web pages are refused
  (`local-only.js`: Host and Origin checks), but any local process can drive the signed-in profiles. Needs a
  per-launch token (passed to the agent through the environment, like `KULISA_MCP_URL`) at least.
- **`signin-pause.js` is a temporary implementation** to be replaced by the author. It recognizes sign-in pages
  only by host and pauses the whole profile.
- **macOS and Windows are untested** (only Linux so far; Kulisa targets all three, see SPEC section 4). Known gaps:
  - `mimic-chrome.js` takes the machine part (OS, OS version, CPU, the UA's platform) from what Electron's
    Chromium reports itself, so it should match Chrome everywhere. Compared with real Chrome on Linux only; check
    on macOS and Windows against a real Chrome (`navigator.userAgentData.getHighEntropyValues`).
  - `--no-sandbox` is needed only for `npm start`/`npm test` on Linux, where `chrome-sandbox` in `node_modules` is
    not setuid. It must be on the command line (Chromium's zygote starts before `main`; `appendSwitch` is too late),
    so the npm scripts pass it on every OS: dev runs on macOS and Windows are unsandboxed for no reason. Packaged
    apps never use it. The `.deb` installs `chrome-sandbox` setuid root; the unpacked `out/` folder needs
    `--no-sandbox` to try it. Other Linux formats (AppImage, rpm, snap) are not set up.
  - Starting the agent (`terminal.js`): on Linux and macOS it is typed into the user's shell started in the
    project's folder, so the project's environment applies (direnv's `.envrc`, nvm, mise) and `PATH` is the
    user's even when Kulisa was started from a menu. Checked on Linux with bash only.
    - macOS: a login shell (`$SHELL -l`, zsh by default; `os.userInfo().shell` when started from the Dock without
      `SHELL`). Check: started from the Dock, `claude` is found; a project with an `.envrc` (direnv hook in
      `.zshrc`) gets its variables, e.g. `CLAUDE_CONFIG_DIR` (`/status` in Claude shows the account); quoting of the
      typed command in zsh and fish; the shell stays after the agent exits.
    - Windows: the agent starts directly, without a shell, so no project environment; `claude` from npm is a
      `.cmd` that node-pty may not find. Proposed: type it into PowerShell (`pwsh -NoExit`, falling back to
      `powershell.exe`) in the project's folder, as on the other systems: the PowerShell profile applies, `.cmd`
      resolves, the shell stays after the agent exits. Without an agent command the terminal falls back to
      `COMSPEC` (untested). SIGINT and SIGTERM work differently there (quit handling in `app.js`).
    - Both: switching projects (the agent stops, `claude --resume` on coming back) and the project folder dialog
      ("Open Folder…", native) are untested, and so is the native question when deleting a profile.
  - `safeStorage` (Keychain, DPAPI) for session cookies: expected to work, untested.
  - macOS: the window screenshot (`KULISA_SHOT`) needs the screen-recording permission; distribution needs code
    signing and notarization (Apple Developer account). Windows: code signing certificate.
  - The project folder: a packaged app starts with `~/Kulisa/Default`, then the project opened last (untested
    packaged).
  - The one-row title bar (`titleBarStyle: 'hidden'` + `titleBarOverlay`, Window Controls Overlay): checked on
    Linux/X11 only. Check the window buttons, dragging and double-click to maximize on macOS (traffic lights on the
    left), Windows and Wayland.
  - Tests run only on Linux. Needs CI with a macOS/Windows/Linux matrix (needs a remote repository).
- **No performance numbers taken with the monitor on.** CPU, RAM, many profiles; see REPORT, E8.
- **`playwright-core` is pinned to a 1.64 alpha.** Move to the stable release once it ships with the same APIs.
