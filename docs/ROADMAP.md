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
- **Feature 3, point and tell.** ⌖ Pick (again, or Esc in the page, cancels), then click an element: a reference to
  it (profile, tab, locator) is typed into the agent's prompt without Enter, and the terminal gets the focus. Picks
  from several panes go into one message. The locator only (2026-10-06): nothing is saved and nothing written into
  the project (the details file and `<project>/.kulisa/notes` are gone); the agent looks at the element on the live
  page with its tools, on that tab (`tab` on the browser tools), and reads the tab's console and requests. If a
  transient element (tooltip, open menu, toast) turns out to need it, add a screenshot taken at the pick.
- **Console and network tools.** `browser_console_messages` and `browser_network_requests` of a profile's tab
  (Playwright's `page.consoleMessages()`, `pageErrors()`, `requests()`), errors or failures only on request.
- **Projects.** A project is a folder (usually a repository) with its own profiles, tabs, grid and agent
  session; the Kulisa zoom is global. The project's name in the title bar opens a menu of the projects, as in
  JetBrains: open another, remove one (its × on hover), New Project…, Open Folder…. The Manage
  Projects dialog was dropped (2026-10-06): the menu and the Welcome screen do all it did, as in JetBrains, whose
  Manage Projects… only shows the Welcome screen. New Project… (2026-10-06), as
  JetBrains': a name and a location (the home folder by default, Browse…), the folder it makes shown, Create Git
  repository on by default. It made `~/Kulisa/<name>` without asking before: the human then did not know where the
  agent's files were. Opening another closes this one (tabs, sign-ins
  and grid saved, agent stopped); coming back resumes the agent's conversation (Claude Code: `--resume` with the session the
  SessionStart hook reported; Codex: `resume --last`). Data in `<user data>/projects/<id>/`. Each project gets its own color: a round glow from the middle of the window
  (seen in the gaps between the islands and the title bar), the logo's curtain and the name's plate. The agent is typed into the user's shell started in the project's folder, so
  the project's environment (direnv's `.envrc`, e.g. another Claude account) applies; untested on macOS (login
  shell) and Windows (started directly, no shell).
- **Workspaces, first version** (2026-10-06; how they work now: [workspaces.md](workspaces.md); the design and what
  is left: Next, "Workspaces"). A strip of the
  project's workspaces under the grid: main (the project itself) and its forks, each with its agent's state (Claude
  Code's hooks: working, waiting for you, done). + asks for a name and makes a fork of main: a git worktree with its
  own branch next to the project (`myshop@<name>`, started as Claude Code's `--worktree`; `.env*`, Claude's local
  settings and `.worktreeinclude` copied), copies of main's profiles (signed in; closed ones closed, open ones with
  their active tab, moved to the fork's port offset), main's grid, and a new agent session in its folder with
  `KULISA_PORT_OFFSET` and its own MCP URL (`/ws/<n>/mcp`: its agent sees its profiles only). A click on a tab shows
  that workspace's grid and terminal, sliding as macOS desktops do with pictures of the pages (not with reduced
  motion); the one left keeps running. × on a fork deletes it (worktree, branch, profile copies, Claude's
  conversations), always asking first (what goes, and any commits or files not in main; until 2026-10-06 a fork
  without changes went without a question); × on main closes the project, and the
  window shows the Welcome screen. Without git, + is off and "Initialize git…" runs `git init`
  after a confirmation. Restored after a restart; a workspace loads (profiles, agent) when first shown. Storage
  as Chrome's (store.js): `projects/<id>/<n>/Profile <k>/` per profile via `session.fromPath`, with its tabs and
  session cookies inside. Linux only so far.
- **Choosing the agent** (2026-10-06, with the author; found testing a fresh install: Kulisa started `claude`
  without asking). Each workspace has the agent the human chose for it (its `agent.json`): when one has none, or
  it is not installed, a dialog asks: Claude Code (Anthropic), Codex (OpenAI) or the terminal only, each with what
  it needs and whether it is on this computer. One that is not has an Install button: Kulisa runs its maker's own
  installer (the command line shown before; its output while it runs), no "type command X" steps, for people who are
  not programmers. Then the agent starts and asks the human to sign in to it. A new workspace proposes main's
  agent, another can be picked in its dialog. Official native installers (no Node, no sudo, they update
  themselves; checked 2026-10-06): Claude Code `curl -fsSL https://claude.ai/install.sh | bash`, Codex
  `curl -fsSL https://chatgpt.com/codex/install.sh | sh` (`install.ps1` on Windows). Not a separate window, as
  first proposed: a dialog in the window costs no extra process, and its code is a module loaded only when the
  dialog is needed (`agent-picker.js`; the rule is in CLAUDE.md). Each agent is one entry in `agents.js`: how to
  find, install, start (Claude Code: the plugin; Codex: the MCP server as a config override) and resume it.
  `KULISA_AGENT` still forces one agent everywhere, without asking. **Change agent…** in the terminal's right-click
  menu opens the same dialog (with Cancel) and starts the chosen agent with a new conversation; found when a
  fresh start with Codex and no Codex account left no way back.
- **No project at first start** (2026-10-06, found testing a fresh install: Kulisa opened the folder it was started
  from, `~/Kulisa/Default` when installed). The Welcome screen (the term: CLAUDE.md), as JetBrains': Open Folder…,
  New Project…, and the recent projects; links to kulisa.app, the documentation (the README on GitHub for now), GitHub
  and its issues, opened in the user's browser, and Kulisa's version. **Close Project** in the project button's menu
  shows it again. **Remove Project…** (2026-10-06; the project menu: the open one's Remove Project…, any row's ×; on the
  Welcome screen a recent project's × and right-click menu; one function in `app.js`): after a question, the project is closed if open, each of
  its workspaces deleted (one `deleteWorkspace`, also behind a fork's ×), its data removed; its own folder stays. A
  deleted fork leaves nothing behind: worktree, branch, direnv's permission, profiles, and what its agent keeps of
  the folder (Claude Code's conversations, history and trust; Codex's sessions and trust; not Codex's databases).
  Later starts open the project opened last; `KULISA_PROJECT` names one. The
  copying of data from older layouts (before projects, before workspaces) is gone: no such data is left.
- **A fork's agent as main's** (2026-10-06, found testing: Claude Code asked whether to trust the fork's folder).
  - direnv: a copied `.envrc` was blocked in the fork (direnv wants `direnv allow` per folder), so the project's
    environment was missing there, `CLAUDE_CONFIG_DIR` included: the fork's Claude ran with another config, maybe
    another account. Now Kulisa allows the copy when main's `.envrc` is allowed (same content), and removes direnv's
    records of it when the fork is deleted (`worktrees.js`). Other tools with the same rule (mise's `trust`) are not handled yet.
  - Claude Code's question about trusting a new folder: the fork's folder is marked trusted in Claude's own config
    when main is (`agents.js`, Claude's entry; the config file found from the transcript path Claude reported, so it
    is the one the project's environment chose). Undocumented format: when the file is not as expected, nothing is
    changed and Claude asks as usual. Claude rewrites that file often; Kulisa writes it whole at once (rename), and
    a write of Claude's at the same moment may undo it (then Claude asks).
- **Names** (2026-10-06, the author's rule). Projects, workspaces and profiles are named with the characters of an
  email address and the letters of any language: letters, digits, `@ . _ + -`, starting with a letter or a digit (not `@` alone, `.x`, `..`, `-x`), no spaces, at most 64 (`names.js`),
  so a profile can be named after the account it signs in to. Name fields leave other characters out as they are
  typed or pasted; the main process checks again (the agent's `profile_create` too). Branches, fork folders and ids
  keep letters of any language. Names given before stay until renamed.
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
  button (projects with their color and folder), Profiles ▾ (open and closed profiles, Manage Profiles…), ☰ (the zoom row "− 100% +", Arrange panels), and right-click on a
  pane's header (New tab, Rename, Close profile, Delete profile…), a tab (Reload, Duplicate, Close, Close others) and the
  terminal (Copy, Paste, Select all, Clear, Change agent…). The pages are native views above the HTML, so while a menu is open
  they are pictures of themselves, as during a drag. Native menus were tried first (2026-10-05): rows of text
  only, no buttons in a row; and a native menu in a page had frozen the desktop before (Deferred ideas). Not in
  the pages yet.
- **Dialogs, one look** (2026-10-06), as in JetBrains: the title with × on top, the content, and a strip of buttons
  at the bottom right, the main one last (blue; red when it deletes); the same markup and styles for all
  (`index.html`, styles.css). Questions before something that cannot be undone (deleting a profile, a workspace, a
  project; Initialize git) are asked in that dialog too (`shell.ask` → `ask.js`, queued, Cancel focused), no longer
  with the OS's own question (`dialog.showMessageBox`): that one looked different on each OS and plain on Linux, and
  could not mark the deleting button or lay out what goes. The OS's own windows stay for choosing a folder.
- **App icon.** A stage curtain drawn apart with the agent's pointer (`assets/icon.svg`); in the window's top
  bar, the taskbar, and the installers (`.deb` checked: menu entry and pixmap; `.exe`, `.dmg` not built yet). Run
  from source (`npm start`), GNOME's dock shows a generic icon: it takes icons from installed `.desktop` files
  only (the `.deb` installs one matching the window class `kulisa`); left as is on purpose.
- **Packaging.** Electron Forge (`npm run make`): `.deb` on Linux (tested: installs `chrome-sandbox` setuid root,
  the packaged app starts), Squirrel `.exe` on Windows, `.dmg`/`.zip` on macOS (not built yet).
- **DevTools.** A DevTools button on each pane (also F12 or Ctrl+Shift+I in its page) opens the active tab's
  DevTools in a separate window. Kulisa's own DevTools only when running from source; a packaged build has
  none (`appDevTools`, off when `app.isPackaged`).
- **Terminal.** The agent CLI the human chose for the workspace (Choosing the agent) runs unchanged in the window.
- **MCP.** Tools take a profile id; `profile_create`, `profile_open`, `profile_close` and `profile_delete` manage
  profiles (a deletion by the agent asks the human first); `browser_tab_new`/`_select`/`_close` manage tabs. `@playwright/mcp` also works through the per-profile CDP proxy. Web pages cannot reach the MCP
  server or the proxy (`local-only.js`).
- **Kulisa plugin.** `claude` starts with the Kulisa plugin (`src/agent/claude-plugin`): the MCP config and a
  skill on working with profiles, and a `SessionStart` hook that tells it which profiles are open. The user's own
  MCP servers stay available (no `--strict-mcp-config`).
- **Profiles present as Google Chrome.** UA, UA-CH, `userAgentData` (`mimic-chrome.js`).
- **Strict sign-in.** Entra, including a GoDaddy-federated tenant behind Kasada, passes with the automatic sign-in
  pause.

## Next

- **Kulisa plugin: more the agent can do in the browsers** (a feature of its own; tools in `mcp-server.js`, each
  described in the skill). Console and network are done; what else an agent needs comes from using it.
- **Kulisa plugin: running the app** (a feature of its own, found while designing workspaces, 2026-10-06). The
  agent gets help with starting the app under test: the WS's port offset in its environment
  (`KULISA_PORT_OFFSET`), and the skill on how to apply it for common stacks (`PORT`, `--port`, `.env.local`,
  published ports in `docker compose`). Possibly tools: the app's address for this WS, opening the WS's profiles
  there once the server answers, reporting that the app cannot run here. To design with the workspaces.
- **Choosing the agent, rest** (first version: Done). Still to do:
  - Codex (0.160.1, Linux, 2026-10-06): its installer puts it in `~/.local/bin`, as assumed; `codex mcp list` with
    Kulisa's `-c mcp_servers.kulisa.url=…` lists the server, enabled; `codex resume` takes `--last` and `-c`. Not yet
    tried: a whole session driving the profiles. It gets the MCP tools but not
    the profiles skill: give every agent the essentials through the MCP server's own `instructions`, or a Codex
    plugin. Its state on the workspace tab: none (no hooks used).
  - More agents (Gemini CLI, …): an entry each in `agents.js`.
  - Windows: the installers run in PowerShell, untested; macOS untested.
  - A hint in an empty grid (no profiles yet): "create the first profile".
- **Projects, rest.**
  - Opening a project asks "this window or a new window"; a new window is a second window of the same Kulisa (two
    instances cannot share the user-data folder). Needs what is one per app today (terminal, picker, the
    window's IPC) to become one per window.
  - Use a profile of another project.
- **Workspaces: several features of a project at once** (the term: CLAUDE.md; how they work now:
  [workspaces.md](workspaces.md); below, the decisions as they were taken). Designed with the author on
  2026-10-06; the first version is built (Done), what is left is at the end. A workspace (WS) is a branch of code,
  profiles, a grid and an agent. The decisions:
  - **Window.** Each WS is its own dockview grid, like a desktop in macOS: switching a WS changes the whole grid
    (the switch animated like macOS desktops, with pictures of the pages; off with "reduce motion"). A strip of WS
    tabs under the grid, outside dockview, as a browser's tab strip, with "+" and each agent's state (working,
    waiting for you, done).
  - **Main and forks.** Main is the project itself: its folder, its branch, its profiles with their sign-ins; it
    is permanent, and closing it closes the project (the Welcome screen: "open a project or create one").
    "+" in any WS makes a fork of main. Forks are temporary: their branch goes back into main through git (merge
    or pull request), and the fork is closed and deleted. A fork never becomes main (no pointer, no swapping of
    branches). Something a fork needs that main lacks (e.g. a new sign-in) is done in main; later forks get it.
  - **Code: git only.** A fork's code is a git worktree with its own branch, next to the project:
    `~/IdeaProjects/myshop@<ws>/` (visible, opens in an IDE; not inside the project, where IDEs and tools would see
    it twice). The branch starts as Claude Code's `--worktree` does: from the remote's default branch after a
    fetch, else the local HEAD; uncommitted changes are not carried. Files outside git: Kulisa copies small ones
    (`.env*`, the agent's local settings such as Claude's `.claude/settings.local.json`) and follows
    `.worktreeinclude` when the project has one; the agent installs dependencies (the skill says so). A project
    without git has no WS: "+" is off, with "Initialize git" (only on the human's click). Kulisa writes nothing
    into the project's own folder.
  - **Agent.** A new WS gets a new agent session (any agent CLI), started in the WS's folder, so it has no
    questions about access outside its folder (Claude still asks once whether to trust a new folder). Not a fork
    of main's conversation (`--fork-session`): the fork's code starts clean, and an agent remembering main's
    unfinished edits would be misled. A pick in a WS's pane goes to that WS's agent. Several agents in one WS: a
    deferred idea (Deferred ideas).
  - **Profiles.** A fork copies main's profiles, sign-ins included, opening only each one's active tab. Main's
    profiles are open while they are copied: flush cookies and storage first; on Windows open files are locked
    (to check). Risks with real SSO (rotated tokens may sign a copy or the original out) are accepted for now:
    test the idea first.
  - **Storage, as Chrome keeps it**, so what is known about Chrome's storage applies:
    ```
    ~/.config/Kulisa/projects/myshop/
      workspaces.json             the WS: number, name, branch, folder
      1/                          a WS (main is 1)
        profiles.json             folder → name, color, closed   (as Chrome's Local State)
        layout.json, agent.json
        Profile 1/                a Chromium profile (session.fromPath), plus Kulisa's own files in it:
          Kulisa Tabs.json, Kulisa Session Cookies.bin
    ```
    Main is WS `1/`; forks get the next numbers. Profile folders are `Profile N`, as Chrome names them: fixed at
    creation, so a rename touches only `profiles.json` (partition names kept a profile's first name). `Partitions/`,
    `session-cookies/` and per-project `tabs.json` went (their data was copied over once, then the copying was removed
    with the old data).
    To check: how `session.fromPath` lays a profile out; whether caches can live outside the profile, as Chrome's
    do on Linux (`~/.cache`), so a fork copies the folder whole.
  - **Creating a fork** asks for its name (a dialog); the branch and the folder take it. All of main's profiles
    are copied, closed ones stay closed.
  - **Closing a fork** asks for confirmation, then deletes it: worktree folder, its branch (`git branch -D`; a
    copy already pushed stays on the remote), profile copies, the agent's conversation. The dialog says when the
    fork has changes not in main, which go with it. A fork without changes (no commits of its own, nothing
    uncommitted) closed without asking at first, as Claude Code's `--worktree` does; since 2026-10-06 every fork asks
    (the author's decision: its conversation and profile copies go too, and × is easy to hit by mistake), the
    question the same as for removing a project: what goes for good, the work not in main. Later maybe an
    archive to reopen closed forks (Conductor keeps the git state and the conversation) or an agent that names the
    fork itself once it knows the task (Conductor does that too).
  - **WS in the background** stay alive (their pages and agent keep working) in the first version. Unloading a
    background WS's tabs while its agent does nothing is a later step: it needs to know the agent is idle (Claude
    Code's hooks tell it; for other CLIs, no MCP calls and no terminal output for a while).
  - **Opening another project** asks: in a new window (this project and its WS keep running) or in this one
    (warns that this project's agents stop, when any is working). Coming back, or restarting Kulisa, restores all
    WS and resumes their agents (where the agent can resume). The new window needs what is one per app today
    (terminal, picker, the window's IPC) to become one per window; WS need a terminal per WS anyway.
  - **Ports.** Each WS has a port offset (main 0, forks 100, 200, …): its app runs on the usual ports plus the
    offset (3000 → 3100, 8080 → 8180), any number of services with one number. The fork's copied tabs are
    rewritten to it (`localhost:3000/cart` → `localhost:3100/cart`); cookies do not depend on the port, so the
    copies stay signed in to the app (separate hostnames such as `checkout.localhost` would lose that). The local
    database is the developer's matter (`docker compose` already names containers after the folder, so a fork
    gets its own; only published ports clash). Known limit: an app that cannot change its port (hard-coded,
    OAuth bound to `localhost:3000`) cannot run in a fork; the agent says so.

  Checked before building (2026-10-06): `session.fromPath` lays out a plain Chromium profile in the folder (Cookies,
  Local Storage, IndexedDB…), its caches included (Cache, Code Cache, GPUCache, Dawn*): they cannot live elsewhere, so
  a copy skips them. A profile copied while open, after flushing cookies and storage, opens signed in with its
  storage (Linux).

  Built differently from the above, or added while building:
  - A workspace loads (profiles, agent) when it is first shown, not at the start: after a restart nothing works in
    the background anyway, and the agent starts at its terminal's real size.
  - The agent's state comes from Claude Code's hooks only (UserPromptSubmit, Notification, Stop); other CLIs show
    none.
  - Without git, + stays off until git has a first commit; Kulisa checks again when the pointer comes to the strip.

  Still to do:
  - Opening another project asks "this window or a new window" (Projects, rest); today it opens in this window,
    without warning about working agents.
  - Helping the agent run the app ("Kulisa plugin: running the app", above). Today the agent gets
    `KULISA_PORT_OFFSET` and a line about it at session start.
  - The agent's state on the workspace tab for other agent CLIs (Codex…): today only Claude Code's hooks report
    it. For the others, e.g. from MCP calls and terminal output (working while they come, idle after a quiet
    while).
  - Tried with Claude Code in forks (the trust question and direnv fixed: Done, "A fork's agent as main's"); the
    tests run `cat` as the agent. Still to check in a fork: the hooks (session, state), `--resume` after a restart.
  - Unloading a background workspace whose agent is idle (above).
  - Windows: copying an open profile (locked files are skipped and logged), removing a deleted fork's profile
    folders while their sessions are open (left for the next start). macOS and Windows untested.
  - A fork's start point is the remote's default branch: local commits not pushed yet are not in it (as with Claude
    Code's `--worktree`). If that surprises, an option as Claude's `worktree.baseRef: "head"`.

  Earlier notes, partly superseded by the above:
  - The MCP server tells agents apart by a URL per agent with a secret token. Built: a URL per workspace
    (`/ws/<n>/mcp`); the token is not (Open issues, local processes).
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
  - RAM: each agent is a Claude Code process (about 200–400 MB) plus its own profiles.
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
  (`app.js`) and a translucent background color for those systems (`styles.css`). Check transparent windows'
  known issues there (resizing, maximizing, the title bar overlay, profile views above the HTML). Faking the blur
  (a picture of the wallpaper, blurred) was rejected: a workaround, and it lags when the window moves.
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
      ("Open Folder…", native) are untested.
  - `safeStorage` (Keychain, DPAPI) for session cookies: expected to work, untested.
  - macOS: the window screenshot (`KULISA_SHOT`) needs the screen-recording permission; distribution needs code
    signing and notarization (Apple Developer account). Windows: code signing certificate.
  - The first start: a packaged app opens no project (the window offers to open one), later the project opened last
    (untested packaged).
  - The one-row title bar (`titleBarStyle: 'hidden'` + `titleBarOverlay`, Window Controls Overlay): checked on
    Linux/X11 only. Check the window buttons, dragging and double-click to maximize on macOS (traffic lights on the
    left), Windows and Wayland.
  - Tests run only on Linux. Needs CI with a macOS/Windows/Linux matrix (GitHub Actions on the repository).
- **No performance numbers taken with the monitor on.** CPU, RAM, many profiles; see REPORT, E8.
- **`playwright-core` is pinned to a 1.64 alpha.** Move to the stable release once it ships with the same APIs.
