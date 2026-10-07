# Roadmap

What is planned: ideas and the details of features still to build, deferred ideas, open issues. Feature numbers
refer to [SPEC.md](SPEC.md), section 2. When a feature is built, it is documented in `docs/` (how it works and why:
[profiles.md](profiles.md), [workspaces.md](workspaces.md), [window.md](window.md), [ui.md](ui.md)) and removed from
here; what is left of it stays.

## Next

- **Kulisa plugin: more the agent can do in the browsers** (a feature of its own; tools in `mcp-server.js`, each
  described in the skill). What else an agent needs comes from using it. The human
  has handles the agent does not yet (the table of actions in [profiles.md](profiles.md)): back, forward, reload,
  renaming a profile; each a thin tool on the core.
- **The window's handles name their workspace.** A window's IPC acts on the workspace that window shows (found by
  `event.sender`, so never another window's); an action sent just as the human switches workspaces or projects could
  still reach the other one. The renderer should send the workspace's key, as `layout` does.
- **Kulisa plugin: running the app** (a feature of its own, found while designing workspaces, 2026-10-06). The
  agent gets help with starting the app under test: the WS's port offset in its environment
  (`KULISA_PORT_OFFSET`), and the skill on how to apply it for common stacks (`PORT`, `--port`, `.env.local`,
  published ports in `docker compose`). Possibly tools: the app's address for this WS, opening the WS's profiles
  there once the server answers, reporting that the app cannot run here. To design with the workspaces.
  - Why: every worktree has the same README command (`npm run dev` → `localhost:3000`). Besides the port,
    worktrees share the local database (migrations of different branches), Redis and queues, OAuth redirect URLs
    registered for one address, and cookies (one jar for all ports of `localhost`). Common practice: a port per
    worktree through `PORT` or `.env.local`, a database per branch, hostnames through a local proxy
    (`a.localhost`), docker compose per worktree, or one dev server at a time. A project that cannot run twice:
    one shared dev server, the panes show whose branch it is.
- **Choosing the agent, rest** (how it works: [workspaces.md](workspaces.md), "Choosing the agent").
  - Codex (0.160.1, Linux, 2026-10-06): its installer puts it in `~/.local/bin`, as assumed; `codex mcp list` with
    Kulisa's `-c mcp_servers.kulisa.url=…` lists the server, enabled; `codex resume` takes `--last` and `-c`. Not yet
    tried: a whole session driving the profiles. It gets the MCP tools but not
    the profiles skill: give every agent the essentials through the MCP server's own `instructions`, or a Codex
    plugin.
  - Codex's hooks (the agent's state, the session to resume, the open profiles at start; workspaces.md, "Choosing the
    agent"): built from its documentation (learn.chatgpt.com/docs/hooks) on 2026-10-08, not yet tried in a session:
    no Codex account here then. Checked: Codex 0.160.1 takes the `-c hooks=…` override and checks a handler's fields,
    but not the events' names (a wrong one passes silently). To try, signed in: how Codex asks to trust the hooks and
    that trusting once is enough; that `$KULISA_URL` reaches the hook's command; that `SessionStart`'s answer
    (Claude Code's shape, `hookSpecificOutput.additionalContext`) is taken; each event moving the tab (Esc:
    `Interrupt`); `codex resume <session>`. Windows: the command is sh's (`commandWindows` for PowerShell).
  - More agents (Gemini CLI, …): an entry each in `agents.js`.
  - Windows: the installers run in PowerShell, untested; macOS untested.
  - A hint in an empty grid (no profiles yet): "create the first profile".
- **Projects, rest.**
  - Use a profile of another project.
- **Workspaces, rest** (how they work now, and why: [workspaces.md](workspaces.md)).
  - Helping the agent run the app ("Kulisa plugin: running the app", above). Today the agent gets
    `KULISA_PORT_OFFSET` and a line about it at session start.
  - The agent's state on the workspace tab for other agent CLIs: Claude Code's hooks report it, Codex's are built
    and not yet tried ("Choosing the agent, rest"). For CLIs without hooks, e.g. from MCP calls and terminal output (working
    while they come, idle after a quiet while).
  - Tried with Claude Code in forks; the tests run `cat` as the agent. Still to check in a fork: the hooks
    (session, state), `--resume` after a restart.
  - Unloading a background workspace's tabs while its agent is idle: it needs to know the agent is idle (Claude
    Code's hooks tell it; for other CLIs, no MCP calls and no terminal output for a while).
  - Other tools that, like direnv, want a folder allowed before they apply (mise's `trust`): not handled yet.
  - Windows: copying an open profile (locked files are skipped and logged), removing a deleted fork's profile
    folders while their sessions are open (left for the next start). macOS and Windows untested.
  - A fork's start point is the remote's default branch: local commits not pushed yet are not in it (as with Claude
    Code's `--worktree`). If that surprises, an option as Claude's `worktree.baseRef: "head"`.
  - The agent making and closing forks itself (MCP tools on `Project.createFork`, `deleteFork`), e.g. to hand
    parallel parts of a task to agents of their own, as Conductor does: a gap in the table of actions
    ([workspaces.md](workspaces.md), "Actions"). To discuss with "Several agents in one workspace" (Deferred
    ideas); deleting asks the human, as `profile_delete` does.
  - Maybe: an archive to reopen closed forks (Conductor keeps the git state and the conversation), or an agent that
    names the fork itself once it knows the task (Conductor does that too).
- **Discuss security for the end user** (with the author, before a public release). Kulisa holds signed-in work
  accounts and lets an agent act in them. Topics, each to decide or document for users:
  - **What the agent can do in signed-in accounts:** read private data (it saw passwords in a Teams chat), send
    messages, delete things. Confirmation for risky actions? Per-profile read-only mode?
  - **Prompt injection from pages:** text on a page the agent reads (snapshots, console messages) can carry
    instructions to the agent.
  - **Local access:** any local process can drive the profiles through the MCP server or the CDP proxy (see Open
    issues; a per-launch token).
  - **Data at rest:** browser profiles in the user-data folder (Chromium's own cookie encryption), saved session
    cookies (`safeStorage`; what if the OS keyring is unavailable).
  - **Electron hardening:** the shell window runs with `sandbox: false` and a preload that forwards any IPC
    channel; profile pages are sandboxed and have no preload. Check against Electron's security checklist. To
    sandbox the window, its preload must be one file: a sandboxed preload `require`s only `electron`, `events`,
    `timers`, `url` (Electron's `tutorial/sandbox.md`, "Preload scripts"), and ours takes the rule for names from
    `../main/names`; pass that another way (IPC, `additionalArguments`).
  - **Distribution:** code signing, notarization, auto-update channel, the `.deb`'s setuid `chrome-sandbox`.
  - **Presenting as Google Chrome:** what users should know (sites' terms, bot detection).
- **Accessibility** (a11y; before a public release, as security). Kulisa should work for people who see poorly, do
  not use a mouse, or use a screen reader, as the big IDEs do; for software bought by public bodies and large companies
  it is also a requirement (Section 508 in the US, EN 301 549 in the EU, both on WCAG). Start from Electron's guide
  (electronjs.org/docs/latest/tutorial/accessibility): Electron turns Chromium's accessibility tree on by itself when
  assistive technology runs (JAWS, NVDA, VoiceOver, Orca); `app.setAccessibilitySupportEnabled()` turns it on by hand,
  and on macOS other apps can ask for it (`AXManualAccessibility`); the OS's setting always wins.
  - Already there: icon buttons have names (`aria-label`, checked by a test), the Kulisa zoom scales the whole UI,
    slides follow reduced motion, semantic elements (`header`, `nav`, `dialog`), dialogs focus Cancel.
  - Seeing: high contrast, the OS's setting (`nativeTheme.shouldUseHighContrastColors`; CSS `forced-colors` on
    Windows, where the browser puts in the system's colors: check that nothing disappears; `prefers-contrast`); WCAG
    contrast of every token in both themes (the muted text first).
  - Keyboard: everything without a mouse, focus always visible. Moving between the panels and tabs (what dockview
    has for it first), the project and workspace tabs, the menus (arrows, Esc), the dialogs. Shortcuts are a feature of
    their own (below); for accessibility they must not clash with screen readers and the OS, and single-key ones must
    be possible to turn off (WCAG 2.1.4).
  - Screen readers: the window read in a sensible order, with names and states (a tab's agent state, the shown
    project). Kulisa's own questions: the profiles' pages are native views of their own (a tree each) next to the
    window's page, and pictures stand in for them under menus and dialogs: how a screen reader moves between them. The
    terminal: xterm's `screenReaderMode` (as VS Code turns on when it detects one).
  - Checking: Chromium's accessibility tree in DevTools (Accessibility pane); automated checks in the tests, e.g.
    axe-core (Deque's, the most used) on the window's page; by hand with Orca (Linux), NVDA (Windows), VoiceOver
    (macOS).
- **Keyboard shortcuts** (an IDE's power users work by them, as in JetBrains and VS Code). Today Kulisa takes only a
  few: its zoom (Ctrl + / − / 0 outside the pages), F12 and Ctrl+Shift+I (DevTools), Ctrl+Shift+C / V in the terminal.
  - Which actions get one: switching projects and workspaces (Ctrl+Tab, Ctrl+1…9), a new tab, a new profile, the focus
    between the terminal and the panels, Pick, closing.
  - A command palette, where every action is found by its name (VS Code's Ctrl+Shift+P, JetBrains' Find Action):
    every action also reachable without remembering keys.
  - Who gets a key: Kulisa, the page of a profile (the site under test has shortcuts of its own) or the terminal (the
    agent CLI uses Ctrl+C, Ctrl+R and others). A rule for what Kulisa takes everywhere, and what only outside the
    pages and the terminal; the same keys on every OS (Cmd on macOS).
  - A list of the shortcuts (in the palette, the menus' rows already have room for a key: `kbd`); remapping later.
- **Auto-update** (not started; discuss with the author before building). The point: users never download a new
  version by hand; installed copies update themselves in the background from the installers on GitHub Releases of
  `cosmotools/kulisa` (where they are to be published anyway), the new version starting next time.
  - Windows and macOS: Electron's own `autoUpdater` (Squirrel; Forge already makes the Squirrel `.exe`), most
    simply through the Electron team's `update-electron-app` and the free update.electronjs.org service for public
    GitHub repositories; Forge's GitHub publisher uploads the release. macOS needs the app signed (and notarized)
    for updates to apply.
  - Linux: Electron has no updater for the `.deb`. Without downloading by hand: an apt repository of our own
    (Kulisa updates with the system's updates; the repository must be hosted and signed), Flathub or the Snap
    Store (they update apps themselves, but their sandbox may get in the way of running the user's agent CLIs, git
    and project folders), or AppImage with electron-updater (electron-builder's, not Forge's). Telling the user
    that a newer release is out is only a stopgap.
  - Size: Squirrel downloads the whole app (100+ MB) each time; delta updates if that matters.
  - Needs first: releases on GitHub (versioning, the publisher in `forge.config.js`), code signing (Distribution in
    the security list above). Updating must not touch the user's data folder or interrupt running agents: apply
    on the next start, not mid-session.
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

- **A public skill: "read the documentation of the installed version"** (2026-10-07; to judge around 2026-11-07,
  after a few features built with Electron). An agent builds from what it learned in training, older than the
  libraries in use; Kulisa's agent got the dark mode wrong until it read Electron's guide. Today it is a rule in
  CLAUDE.md (Conventions): before building anything that touches Electron, look it up in the installed version's
  documentation (the guides and `breaking-changes.md` at the version's tag, the API in `electron.d.ts`); the same for playwright-core's `types.d.ts`; and name what was read in
  the plan. To judge: did plans name what was read, did features need redoing for an outdated API. If it works,
  publish it as a skill for any Electron project (an agent skill, `SKILL.md`; check Codex reads it): none of the
  Electron skills found (2026-10-07: electron-apps, full-stack-skills, gentleman-skills) points to the installed
  version's docs, they retell Electron in text that ages as training does. If plans skip it, a hook instead.
- **A screenshot taken at a pick** (point and tell), if a transient element (a tooltip, an open menu, a toast) turns
  out to need it: today the pick is a locator only, and the agent looks at the live page.
- **Two agents need the same account** (before workspaces; forks copy main's profiles today). Options:
  - *Fork* (copy the profile folder, sign-ins included; Playwright's `storageState` does the same for parallel
    tests). Cannot be merged back: storage and rotated tokens have one valid copy. With rotating tokens
    (Microsoft, Google) a copy can sign the other out, the original included; apps with one session per user
    kick one out; logout ends both; forgotten forks keep live sessions on disk.
  - *Linked clone*: copies that keep the sign-in cookies in sync (Electron's cookie `changed` event), so a
    rotated token reaches all copies; tabs stay separate. To check: sign-ins kept in `localStorage` (MSAL).
  - *A pool per role*: the human signs in "admin #1", "admin #2"; an agent takes a free one and returns it.
  - *Shared profile, own tabs*, actions queued: no copies, weak isolation (shared cookies, logout).
  - Whether an agent may take a free profile itself or only gets one from the human.

- **Workspaces for projects without git: a shadow repository** (2026-10-06). Kulisa keeps the history itself
  (`git --git-dir=<Kulisa data>/projects/<id>/git --work-tree=<project>`), so nothing appears in the user's folder,
  and forks work as in a git project; also gives undo points. Needs rules for what stays out of snapshots and a
  limit for huge folders. Not now: projects without git have no WS ("Initialize git" instead). `git init` in the
  user's folder without asking was rejected (secrets in history, huge folders, nested repositories).
- **Several agents in one workspace, working as a team** (discussed 2026-10-06; after workspaces, which do not
  depend on it). A workspace may hold several terminals, each an agent (any CLI, Claude and Codex together); all
  see the workspace's code and profiles. Covers a tester next to the developer, a side question (Claude: a forked
  conversation), browser-only research. Cheaper than a workspace: one agent process, no profile copies. Agents
  coordinate through the Kulisa plugin, for any agent:
  - `agents`: who is in the workspace, their role, what they are doing, which tabs and profiles they use.
  - `agent_message(to, text)`: typed into the other agent's prompt when it waits for input (as a pick), queued
    while it works; for Claude Code possibly through hooks.
  - A task list of the workspace, seen by the agents (MCP) and the human (a panel).
  - Own tabs: each agent works in tabs it opened (`browser_tab_new`); Kulisa knows whose tab is whose, the pane
    shows which agent acts. A pick goes to the terminal active last.
  - The skill: check who else is here, tell the one waiting when done, report a bug in another's part to its
    author instead of fixing it.

  Open questions:
  - An agent acting in another agent's tab: only a hint ("agent 1's tab"), or refused?
  - Who coordinates: the human (agents equal, roles set by the human, talking directly; proposed to start with),
    a lead agent that splits the task and hands it out (as Claude Code's agent teams), or both.
- **A store** (the author's idea, 2026-10-06). Installs four kinds of things: agent plugins (Claude Code, Codex),
  MCP servers, skills, and Kulisa extensions (code that extends the IDE: a panel and its tools). Examples of
  extensions:
  - **Stripe:** a panel with the project's test-mode events and webhooks, test cards in one click; tools for the
    agent to read events and trigger them ("the buyer pays, the seller sees the order").
  - **Feature flags** (LaunchDarkly, Unleash, GrowthBook, PostHog): each profile's flags in a panel, switched per
    profile; a tool for the agent to set them, to check a feature with the flag on and off, per role.
- **A translucent, blurred window background** (the author's idea, 2026-10-06; Windows 7's Aero glass): the
  desktop blurred behind the gaps between the islands, the title bar and the project's glow; the islands stay
  opaque. The blur is the OS's, not Kulisa's: Electron's `vibrancy` on macOS, `backgroundMaterial: 'acrylic'` (or
  `'mica'`) on Windows 11; on Linux only a transparent window (KDE can blur it, GNOME cannot: the desktop would show
  through sharp, worse than now), nothing reliable on Windows 10. Deferred: the author works on GNOME and would not
  see it. If built: only where it is real (macOS, Windows 11), opaque elsewhere; a few lines where the window is made
  (`app.js`) and a translucent background color for those systems (`tokens.css`). Check transparent windows'
  known issues there (resizing, maximizing, the title bar overlay, profile views above the HTML). Faking the blur
  (a picture of the wallpaper, blurred) was rejected: a workaround, and it lags when the window moves.
- **A panel in its own OS window** (e.g. a profile on a second monitor). dockview has popout windows, but a
  profile's page is a native view of its window and would have to move to the new window (`Profile.moveTo` does that
  for a whole project, Move to New Window). To discuss.
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
  - The window's menus are HTML now ([window.md](window.md), Menus); a page menu could be one too, over a picture of the page.
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
    - Both: closing a project and opening it again (`claude --resume`) and the project folder dialog
      ("Open Folder…", native) are untested.
  - `safeStorage` (Keychain, DPAPI) for session cookies: expected to work, untested.
  - macOS: the window screenshot (`KULISA_SHOT`) needs the screen-recording permission; distribution needs code
    signing and notarization (Apple Developer account). Windows: code signing certificate.
  - The first start: a packaged app opens no project (the Welcome screen), later the project tabs open last
    (untested packaged).
  - The one-row title bar (`titleBarStyle: 'hidden'` + `titleBarOverlay`, Window Controls Overlay): checked on
    Linux/X11 only. Check the window buttons, dragging and double-click to maximize on macOS (traffic lights on the
    left), Windows and Wayland.
  - Several windows (Move to New Window): a profile's native views moved from one window to another, and a window's
    place restored (`getNormalBounds`, maximized); checked on Linux/X11 only. Dragging a project's tab: tested with
    synthetic events only, not yet by hand; a tab let go outside the windows is told from a cancelled drag by where the
    pointer is (`screen.getCursorScreenPoint`), which Wayland may not report.
  - The theme (☰ → Theme): the OS buttons' strip recolored (`setTitleBarOverlay`) and System following the OS
    (`nativeTheme.shouldUseDarkColors`, `updated`; on Linux through GTK or the desktop portal): checked on
    Linux/X11 (GNOME) by the tests only, not by changing the OS's setting by hand. macOS draws its own window
    buttons.
  - Tests run only on Linux. Needs CI with a macOS/Windows/Linux matrix (GitHub Actions on the repository).
- **A profile dropped from its list, its folder left behind** (found 2026-10-07; to come back to). The author's
  data held a `Profile 2` in a main workspace, in no `profiles.json` and not in `deleted-folders.json`.
  - Not deleted: deleting a profile, open or closed, removes its folder at the next start (tried 2026-10-07), and
    removes its session cookies file at once; that file is still there.
  - Its timestamps: created 2026-10-06 22:17; session cookies and storage written 22:42:12, as closing a profile
    does; at 22:42:41 `Profile 3` was created and `profiles.json` written without `Profile 2`. So it was closed and
    then dropped from the list without being deleted. The code path is not found; ask the author what they did then.
  - Whatever the cause, a folder no `profiles.json` names: proposed to add it back to the list as a closed profile
    (nothing signed in is lost; the human deletes it if not needed), rather than remove it at start, which would
    destroy sign-ins of a profile dropped by a bug. The author's decision.
- **Profiles' caches have no limit of Kulisa's.** Chromium's HTTP cache, Code Cache and GPU caches per profile
  (on the author's main profiles 47 and 78 MB after a few days); Chromium sets the HTTP cache's limit itself from the
  free disk space. Several profiles in several projects add up. To decide: a limit (`--disk-cache-size`, the whole
  app) or clearing a profile's cache when it is closed.
- **Some tests fail now and then** (seen 2026-10-07, 2 runs of 3): the menus (`context menus …`), DevTools in ⋮, the
  address bar's click; each waits for a menu or the focus. Cause not looked for. Also to look at: the slowest tests
  (closing a fork 11 s, a site that never answers 10 s) may wait on fixed timeouts.
- **No performance numbers taken with the monitor on.** CPU, RAM, many profiles; see REPORT, E8.
- **`playwright-core` is pinned to a 1.64 alpha.** Move to the stable release once it ships with the same APIs.
