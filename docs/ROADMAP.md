# Roadmap

What is planned: ideas and the details of features still to build, deferred ideas, open issues. When a feature is built, it is documented in `docs/` (how it works and why:
[profiles.md](profiles.md), [tasks.md](tasks.md), [window.md](window.md), [ui.md](ui.md)) and removed from
here; what is left of it stays.

## Next

- **Projects and tasks: Kulisa rebuilt around them** (designed with the author 2026-10-10). It replaced the model of
  workspaces: a project is the configuration its tasks are made from, and the work is done in **tasks**; how it
  works: [tasks.md](tasks.md), [profiles.md](profiles.md). No migration: the new layout does not read the old data
  (one data format only: old data is deleted, never read or migrated).
  - **Status** (keep it current: a new session reads it first). 2026-10-11: all eight steps are built and in `main`,
    the branch the stabilization goes on from, and so is what came after them: the window in Vue 3 and Reka UI, the
    groups and the tasks' bar as Chrome's tab groups with one + after the islands, the empty window, Settings as
    JetBrains' (a tree of Projects, Agents and Profiles; [ui.md](ui.md), Desktop, not a web page), the whole project
    in TypeScript; 2026-10-12, a task's island of terminals with several agents in it ("Several agents in a task, rest",
    below); 2026-10-13, a repository added to a task when its work needs it (the human's menu or the agent's tool,
    [tasks.md](tasks.md), Tasks), dictation by a key held anywhere, the right Ctrl ([window.md](window.md), The terminal) and one
    language for every agent (☰ → Language, [window.md](window.md), Language); 2026-10-14, the tasks' bar a tab per
    task, of its own (no groups: each tab its project's icon, moved and ordered alone, its project's rows in a
    submenu of its menu; [tasks.md](tasks.md), Projects), the grid sliding between any two tabs; 2026-10-17, New
    Project in three steps (code, agents, profiles) opening the project's first task, the bar's + a new tab with every
    project's tasks in columns (the empty window shows them too), the project's glow only while a task is shown, and
    the window's clusters ([ui.md](ui.md), Clusters). The author tests it by hand. Next: fix what the author's testing finds; then what is left of the
    steps (below), only once the author has decided it.
  - **Open, for the author to decide:** Refresh from Master… now matters only for a local app's cookies (keep or
    drop); a script the agent runs in a page (`browser_evaluate`) could read a test password back from its field
    (only the skill forbids it: close it or not). For the author's real accounts, not testable by Claude:
    device-bound cookies (DBSC, Google) and MSAL's sign-ins kept in step. Not discussed, so not to build unasked: tabs
    in a master's window, tasks in a former folder getting copies.
  - **Left of the steps:**
    - Tasks: a squash merge is not seen as merged (Kulisa offers to delete a closed task only once its commits are
      in the remote's default branch).
    - Projects: a task in the former folder (no git) is not moved when a repository comes.
    - A repository added to a task (2026-10-13, [tasks.md](tasks.md), Tasks), to try in a real task: whether Claude
      Code reads the project's other repositories without asking; `/add-dir` sent in a turn and held while it waits
      for the human (checked with 2.1.296 alone, not through Kulisa's hooks); Codex given a line in its turn.
    - Profiles: the master's window has one tab shown at a time (a sign-in's popup takes it, the tab before comes
      back when it closes); Refresh from Master… brings cookies only, not the sites' storage.
    - Sign-ins kept in step: device-bound session cookies (DBSC) to check with a real Google account in this
      Electron; sign-ins in a site's storage (MSAL) are not kept in step.
    - "Sign in with Google" on a local app: the human signs in once to a test Google account in the profile's
      master, and the agent goes the whole way itself (account chooser, consent) with no sign-in pause on that path,
      never typing a Google password. The pause part goes into the author's replacement of `signin-pause.ts`.
    - Agents' accounts: the sign-in tried with a real Claude account (the tests use a fake agent); whether Claude
      Code's Keychain entry on macOS goes with `auth logout` (a macOS check). Codex's is shown by its id: `codex
      login status` does not say the email (it is in `auth.json`'s token, which Kulisa does not read).
  - **Put off**: ongoing tasks ("watch the feedback for a month") with Kulisa kept in the tray (none in GNOME by
    default); rights on profiles, when real accounts come (one flag, "view only": reading allowed, clicks and typing
    refused; today the agent's own modes cover test users).

- **Several agents in a task, rest** (built 2026-10-12: [tasks.md](tasks.md), "Several agents in a task";
  [window.md](window.md), The terminal; [transcripts.md](transcripts.md)).
  - **Codex**: its transcript is read (2026-10-12, [transcripts.md](transcripts.md)); to try with a real Codex: a
    task handed to Claude Code after a Codex conversation, and one to Codex (its first prompt as an argument is built;
    tried by the author on 2026-10-12: it read the history). Two Codex conversations in one task: one without a
    session reported (no hooks trusted) resumes with `codex resume --last` after a restart, which may be the other's.
  - To try with a real Claude Code: handing over end to end (the tests run fake agents); `conversation_rename` asked
    for by the instructions and the skill: does it name its tab, and when (loaded with the session since 2026-10-12:
    behind the tool search `task_rename` was not called).
  - The island folded at a side (by its width) is built, not tested; nor a terminal's tabs too many for the row (they
    scroll, without arrows).
  - **Open, for the author:** Kulisa offering to hand the task over when an agent stops on its limit (`StopFailure`),
    and to whom (another vendor bypasses nothing; a second subscription of the same vendor may: tasks.md, "Several
    agents in a task").
- **Ensemble: agents working as a team on one task, in one Kulisa or from several computers, talking**: moved to
  [#49](https://github.com/cosmotools/kulisa/issues/49) (2026-10-17), the design and its open questions there. The
  logical next step after [#48](https://github.com/cosmotools/kulisa/issues/48) (GitHub accounts), not tied to it.
- **Kulisa plugin: more the agent can do in the browsers** (tools in `mcp-server.ts`, each described in the skill;
  what is built: [profiles.md](profiles.md), "What the agent does"). What else an agent needs comes from using it
  (the author moves to working in Kulisa, 2026-10-08): where the agent goes around the tools (its own Playwright
  scripts, `curl`, asking the human to do it) is a tool missing; from every user's computer through "Ideas for
  Kulisa" (below). Thought of, not built: console and requests since the agent's last action only; a button over the
  pane for the human to say they signed in, for sign-ins that keep the address.
- **Screenshots the agent can use** (the author's idea, 2026-10-09; to discuss with the author before building).
  `browser_screenshot` today takes the visible part of a tab, JPEG at the screen's pixel density (`mcp-server.ts`).
  Proposed, on the same tool, so every agent gets it through the MCP server (the skill and a line in `INSTRUCTIONS`
  describe it):
  - `ref` / `locator`: one element (`locator.screenshot`); `fullPage`: the whole page, scrolled;
  - `also`: several profiles' active tabs in one call, as `browser_snapshot` has it ("what the buyer sees, what the
    seller sees");
  - `scale: 'css'` by default (playwright-core's `screenshot` option): at a device's pixel density the picture is
    several times larger and costs the agent's context for nothing.
  - Small, independent of the device views below. Estimate: code +30, tests +30, docs +10.
- **Phone, tablet and desktop views of a site** (the author's idea, 2026-10-09; to discuss with the author before
  building). Responsive layouts are checked today only by resizing the pane.
  - A device view **per tab**, as Chrome DevTools' device mode, written once in the core (the tab), with both handles:
    the agent's `browser_device` (`phone`, `tablet`, `desktop`, or a width and height) and `device` on
    `browser_tab_new`, so the agent opens a tab of its own as a phone and leaves the human's tab as it was; the
    human's in the pane's ⋮ menu (Device: Desktop, Tablet, Phone), with a mark in the address bar as a site's zoom
    has (a click resets it). Every other tool then works in that view (snapshot, click, type): the agent tests the
    mobile layout, not only looks at it. `browser_screenshot` with `devices: ['phone', 'tablet', 'desktop']` takes
    one picture in each and puts the tab back as it was; the human sees it switch (the caption over the pane says
    why). Not in a hidden tab: one more process, and without the page's state (a form half filled).
  - The size: Electron's own `webContents.enableDeviceEmulation` (`screenPosition: 'mobile'`, `screenSize`,
    `viewSize`, `deviceScaleFactor`, `scale` to fit a desktop's width into a narrow pane; `electron.d.ts`, 44.5.1):
    not CDP, so it survives the sign-in pause, which detaches the debugger and with it every CDP override. To try
    first in bare Electron: where it draws a page smaller than its `WebContentsView` (centered, in a corner, what
    around it) and what `scale` does; else CDP's `Emulation.setDeviceMetricsOverride`, put back after the pause.
  - The presets: playwright-core's `devices` (Pixel 7, Galaxy Tab S9, Desktop Chrome), not numbers of our own.
    Android ones: Kulisa is Chromium, so its UA honestly says Chrome; an "iPhone" would be its size only, never
    Safari (WebKit is not in Electron; a separate question).
  - A mobile UA and touch (CDP `Emulation.setUserAgentOverride` with `mobile: true`,
    `Emulation.setTouchEmulationEnabled`), else sites that choose by the UA on the server (`m.site`) send the desktop
    one: an Android variant of the profile's own User-Agent, put back after the pause (`Profile.setSigninMode`), which
    detaches the debugger and with it every CDP override; during the pause the desktop one: a strict sign-in
    (GoDaddy's Kasada) may not take an Android UA from a Linux machine. Not Google Chrome's: presenting as Chrome got
    a profile refused by Google ([profiles.md](profiles.md), What sites see).
  - Kept with the tab across restarts (a field in `Kulisa Tabs.json`). No RAM: no process, no buffers.
  - Next to it, small: `browser_emulate_media` (dark or light, print, reduced motion; Playwright's
    `page.emulateMedia`): the profiles' pages follow the OS's theme, so the agent cannot check the site's other one.
  - Estimate: code +200 (the core ~80, the pane ~60, MCP ~60), tests +90, docs +40.
- **Ideas for Kulisa: what agents could not do, sent to us** (designed with the author 2026-10-08; to build as one
  feature). Agents on users' computers meet what Kulisa cannot do (a tool missing, a tool that does not work); they
  note it, the human sends what they want, without leaving Kulisa. Nothing leaves the computer without the human's
  click: a page could make the agent "report an idea" with the user's data in it (prompt injection), and Kulisa's
  promise is that everything stays on the user's computer.
  - **The agent notes** (`kulisa_idea` in `mcp-server.ts`, any agent): `kind` (`missing`: no tool for it; `bug`: a
    tool did not do what it says), `need` (what it had to do, in general words: "read an invitation email"),
    `missing`, `instead` (what it did instead: its own script through the proxy, `curl`, asked the human, gave up),
    `adds_to` (an earlier note of the same gap: its count grows). The tool's description lists the notes there are
    (as `profileArg` lists profiles), so the agent sees what is noted. Written without addresses, names, page
    contents or the project's name ("a chat app"); after it, one line to the human ("noted an idea for Kulisa"). The
    rule in the tool's description, one sentence in `INSTRUCTIONS` (agents without the skill), a section in the skill.
    It only notes; it never asks the human: how often an agent asks would be the agent's choice, and a question in
    the middle of a task breaks it.
  - **Kulisa notices by itself:**
    - The agent going around the tools: the shell's own connection to the CDP proxy sends a header
      (`connectOverCDP(endpoint, { headers })`), any other client of a profile's proxy is the agent's script or
      `@playwright/mcp`. The next kulisa tool's answer in that task gets one line ("a program of yours drove
      profile X directly: if a Kulisa tool was missing, note it with kulisa_idea"), at most once an hour per
      task. No note without the agent: only it knows what for.
    - Its own bugs: errors the tools throw on purpose (no such element, a closed profile) are the agent's; an
      unexpected exception inside a tool (`TypeError` …) is Kulisa's, and becomes a `bug` note by itself: the tool,
      the message, the stack without the user's paths.
  - **Kept** (`ideas.ts` in main: the core; `add` is the agent's only handle, sending and deleting the human's):
    `ideas.json` in the data folder, `[{ id, at, kind, project, agent, need, missing, instead, count }]`, at most 30
    (the oldest go), written whole. A note goes when sent, deleted, or with its project (Delete Project…). Listed in
    "What is on the computer" (tasks.md), its removal tested.
  - **The human: a question, at most once a day.** Kulisa, not the agent, asks, and its core decides when: only
    after the agent's turn ended (done, from its hooks), never about a note it asked about before, at most once a
    day. A bar at the bottom of the window, not a dialog (nothing covered, gone by itself after a minute): "The agent
    noticed: no tool to read emails. Send · Later · Don't ask". Don't ask turns the questions off for good; notes
    still gather in the list. No system notification: not urgent.
  - **The human: the list**, ☰ → Ideas for Kulisa… (the number of notes in its row, a dot on ☰ while some are
    unseen). A dialog (a component, `Modal.vue`): what Kulisa's developers get
    from the notes (a link to the page on kulisa.app); each note as it will be sent, editable, × deletes it, Send.
    A checkbox at the footer's start, "Agents note ideas" (on by default: nothing leaves without a click): off, the
    tool is not registered and the proxy's reminder is off.
  - **Sending, without leaving Kulisa:** the main process POSTs the note (the fields, the count, Kulisa's version,
    the agent and its version, the OS) to `https://ideas.kulisa.app`; on a network error the note stays and the
    dialog says so. Then it is deleted. `KULISA_IDEAS_URL` replaces the address; the tests run a receiver of their
    own and send nothing out.
  - **The receiver:** a Cloudflare Worker (free plan, ~60 lines) checks the note (its fields, at most 8 KB, how
    often from one IP; IPs not kept) and creates an issue through a GitHub App (only Issues: write, installed on
    one repository; its key only in the Worker's secrets) in the private `cosmotools/kulisa-ideas`, labelled
    `missing` or `bug`, by `kulisa-ideas[bot]`. The author sorts them and transfers good ones to `kulisa`. The
    Worker's code lives in the same repository. Why so: a token in Kulisa's public code would be anyone's; a GitHub
    App rather than the author's own token, so issues are the bot's and it can do nothing else; a private
    repository, as the receiver is open to anyone and a note may hold what its user did not see. Not chosen: opening
    a prefilled GitHub issue in the user's browser (the author: no leaving Kulisa; needs a GitHub account; public);
    a GitHub sign-in in Kulisa (device flow: GitHub opens once, notes public and under the user's name); Sentry's
    user feedback (no server of ours, but a third company sees users' data, and its SDK collects crashes too).
  - **The author does** (outward-facing): the private repository, the GitHub App and its key, a Cloudflare account,
    `ideas.kulisa.app` in DNS, the Worker's secrets (`wrangler secret put`). **Claude writes:** the Worker with
    `wrangler.toml`, Kulisa's part, the page on what is received on kulisa.app (`kulisa-site`).
  - **Tests** (`test/agent.ts`, `test/window.ts`): the tool notes, `adds_to` counts, the limit of 30, removing a
    project removes its notes; a foreign proxy client brings the reminder once, the shell's does not; an unexpected
    exception in a tool becomes a `bug` note, an error thrown on purpose does not; the question comes after done, not
    twice for a note, not twice a day, never after Don't ask; the list edits, deletes and sends (to the test's
    receiver), keeps the note when sending fails; the checkbox removes the tool.
  - Docs when built: profiles.md (the tool, the table of actions), tasks.md (`ideas.json`), window.md (☰, the
    bar, the dialog), ui.md (the bar at the bottom, the dot on ☰), the skill, the user guide (guide.md), LICENSING (a service of
    Kulisa's: its own terms). Estimate: code +350, tests +100, docs +60; the Worker apart.
- **Kulisa plugin: running the app, rest** (designed 2026-10-06 with the tasks; the terminals it runs in built
  2026-10-09: [window.md](window.md), "The terminal"). Any agent is told its task's ports in the MCP server's
  instructions and runs the app with `terminal_run`, where the human sees it.
  - Claude Code and Codex do it (tried 2026-10-09 and 2026-10-12: read the task's ports, ran the app on its port with
    `terminal_run` and opened it in a profile). To try: a project with docker compose.
  - Possibly tools: the app's address for this task, opening its profiles there once the server answers.
  - Besides the port, worktrees share the local database (migrations of different branches), Redis and queues,
    OAuth redirect URLs registered for one address. Common practice: a database per branch, docker compose per
    worktree (it names containers after the folder already), or one dev server at a time. The developer's matter;
    perhaps recipes in the skill. A project that cannot run twice: one shared dev server, the panes show whose
    branch it is.
- **Shells: ▶ after a restart** (the author's idea, 2026-10-09). Today a task's shells come back after a restart with
  nothing running (the agent runs its command again). Then: the command they ran is kept too, and ▶ on its tab runs
  it again (starting by itself could run what the human did not expect,
  e.g. migrations).
- **Sign-in: whoever holds the password signs in** (discussed with the author 2026-10-08; the best idea so far,
  not final: to think over again before building). Today the sign-in pause is tied to the page's address (a list of
  hosts), so the agent cannot test the developer's own sign-in, sign-up and password reset through Auth0 and the like
  until they work: it stops and asks the human every time.
  - The idea: the pause belongs to the human's sign-in, not to an address. The agent signs in itself where it holds
    the password (test users from the project, accounts it signed up itself, or what the human gave it). For the
    human's own accounts it hands the profile over (`profile_ask_signin`, or a button over the pane when the human
    signs in unasked); while the human signs in, nothing automated is attached, as today.
  - The host list stays only for restoring tabs (one-time sign-in URLs). One concept ("whose turn it is in the
    profile") instead of three (hosts, the pause, a per-profile "test" flag, also considered and dropped).
  - The rule for the agent: never ask the human for a password (one given in chat stays in the agent's transcript
    and at its provider); hand over instead. Kulisa's own code still never types passwords or prints cookies or tokens.
  - Its cost: a human signing in unasked without the button keeps the agent attached (then a hint on a known
    sign-in page: "Your sign-in? Detach the agent").
  - Thought over again on 2026-10-08, no decision; the author wants an elegant, simple rule. Dropped: pausing when
    the human focuses a secret field (`type=password`, `autocomplete="one-time-code"` …) plus a short list of sites
    that refuse automation and an exception for sign-ins returning to `localhost`: four mechanisms, not one rule.
    Dropped: "these sites are never the developer's" (Microsoft, Google): it breaks Kulisa for developers at those
    companies testing their own sign-in. Whose account it is cannot be told from the site, only from who types.
  - Open idea, "whoever holds the wheel drives": a key the human presses in a pane takes that profile from the agent
    (clicks and scrolling do not); typing in the terminal, or "Give back to the agent" on the pane, returns it. The
    agent types wherever it holds the password; no host list for the pause. To check: whether GoDaddy's Kasada
    passes when the agent is detached at the first key rather than before the page loads (else the human takes the
    profile first and reloads, as `profile_ask_signin` does); telling the human's keys from the agent's (Electron's
    `before-input-event`, or the proxy knowing its own `Input.*`).
- **Choosing the agent, rest** (how it works: [tasks.md](tasks.md), "Choosing the agent").
  - **Codex, tried in a session** (0.160.1, 2026-10-12, a scratch Kulisa with the author's account): it drove a
    profile (`browser_profiles`, `profile_open`, navigate, snapshot, click), ran the app with `terminal_run` on the
    task's port, named its tab and the task, its hooks moved the tab (working, waiting on a permission, Esc), trusted
    once for every task, and `codex resume` brought its conversation back after a restart. It gets the MCP tools, the
    MCP server's `instructions` and, since 2026-10-12, the profiles skill in its account's folder (tasks.md, "What
    each agent can do"; Claude Code was checked to read one there). Not tried: the sign-in pause, a project
    without git, Windows (the hooks' command is sh's: `commandWindows` for PowerShell).
  - What was seen there, not built:
    - Kulisa's `-c` overrides make Codex run "without the shared background server" (embedded mode, a warning at
      start); no harm seen.
    - Text typed fast into Codex is taken for a paste, and an Enter in the same burst does not send it (no matter to
      a human; the handover passes its prompt as an argument).
    - Codex's sandbox (bubblewrap) needs unprivileged user namespaces, which Ubuntu's AppArmor refuses by default:
      then it asks before every command. The machine's matter, as without Kulisa.
  - More agents (Gemini CLI, …): an entry each in `agents/`.
  - Windows: the installers run in PowerShell, untested; macOS untested.
- **Tasks, rest** (how they work now, and why: [tasks.md](tasks.md)).
  - Helping the agent run the app ("Kulisa plugin: running the app", above). Today the agent gets
    `KULISA_PORT_OFFSET` and a line about it at session start.
  - The agent's state on the task tab for CLIs without hooks (Claude Code's and Codex's report it), e.g. from MCP
    calls and terminal output (working while they come, idle after a quiet while). After a permission answered, both
    show waiting until a tool finishes (no hook says it was answered): a long command run after it shows waiting.
  - To check with Claude Code in a task's copy (the tests run `cat` as the agent): the hooks (session, state),
    `--resume` after a restart, `task_rename` called by Claude Code.
  - Other tools that, like direnv, want a folder allowed before they apply (mise's `trust`): not handled yet.
  - Windows: copying an open profile (locked files are skipped and logged), removing a deleted task's profile
    folders while their sessions are open (left for the next start). macOS and Windows untested.
  - A task's start point is the remote's default branch: local commits not pushed yet are not in it (as with Claude
    Code's `--worktree`). If that surprises, an option as Claude's `worktree.baseRef: "head"`.
  - The agent making tasks itself (an MCP tool on `Project.createTask`), e.g. to hand parallel parts of a task to
    agents of their own, as Conductor does: a gap in the table of actions ([tasks.md](tasks.md), "Actions"). To
    discuss with "Several agents in one task" (Deferred ideas); deleting stays the human's.
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
  - **Electron hardening:** the windows are sandboxed (since 2026-10-12) with a preload that forwards any IPC
    channel; profile pages are sandboxed and have no preload. Check against Electron's security checklist.
  - **Distribution:** code signing, notarization, auto-update channel, the `.deb`'s setuid `chrome-sandbox`.
- **Accessibility** (a11y; before a public release, as security). Kulisa should work for people who see poorly, do
  not use a mouse, or use a screen reader, as the big IDEs do; for software bought by public bodies and large companies
  it is also a requirement (Section 508 in the US, EN 301 549 in the EU, both on WCAG). Start from Electron's guide
  (electronjs.org/docs/latest/tutorial/accessibility): Electron turns Chromium's accessibility tree on by itself when
  assistive technology runs (JAWS, NVDA, VoiceOver, Orca); `app.setAccessibilitySupportEnabled()` turns it on by hand,
  and on macOS other apps can ask for it (`AXManualAccessibility`); the OS's setting always wins.
  - The roles, states, keyboard and focus Reka UI gives the menus, dialogs and controls ([ui.md](ui.md)) are its
    promise, not checked yet (Checking, below).
  - Seeing: high contrast, the OS's setting (`nativeTheme.shouldUseHighContrastColors`; CSS `forced-colors` on
    Windows, where the browser puts in the system's colors: check that nothing disappears; `prefers-contrast`); WCAG
    contrast of every token in both themes (the muted text first). Kulisa's own: Reka has no look.
  - Keyboard: moving between the grid's panels, moving and resizing them without a mouse (dockview's, not Reka's:
    what dockview has for it first); focus always visible. Shortcuts are built ([window.md](window.md), Keys: none
    without a modifier, WCAG 2.1.4); check they do not clash with screen readers.
  - Screen readers: the window read in a sensible order, with names for what is not Reka's (a tab's agent state, the
    shown project). Kulisa's own questions: the profiles' pages are native views of their own (a tree each) next to the
    window's page, and pictures stand in for them under menus and dialogs: how a screen reader moves between them. The
    terminal: xterm's `screenReaderMode` (as VS Code turns on when it detects one).
  - Checking: Chromium's accessibility tree in DevTools (Accessibility pane); automated checks in the tests, e.g.
    axe-core (Deque's, the most used) on the window's page; by hand with Orca (Linux), NVDA (Windows), VoiceOver
    (macOS).
- **Keyboard shortcuts, rest** (built: [window.md](window.md), Keys; the table in `src/main/keys.ts`).
  - **A command palette** (Ctrl+Shift+P, as VS Code's; JetBrains' Find Action), where every action is found by its
    name, with its key: the next step. The commands are the keys' table plus the menus' actions: one list of commands
    (an id, a label, `run`) the menus, the keys and the palette use; a dialog of its own (`Modal.vue`).
  - Moving the keyboard between the panels and the tabs of the bar without a mouse (with Accessibility, above).
  - Find in a page (Ctrl+F, as Chrome's: `webContents.findInPage`), a bar of its own over the page.
  - Remapping: the keys in `settings.json` over the table's (VS Code's `keybindings.json`).
  - A closed tab comes back with its address only, not its history (Chrome's keeps it): Electron has no API for that.
- **A desktop app's ways, not only buttons** (talked over with the author 2026-10-08, who liked them all). A web page
  puts a button on every action; a desktop app gives an action several ways in: a visible one for a newcomer, quick
  ones for daily use (keys above, a right-click, dragging). Kulisa has some, here and there (the menus of a task's
  tab, its project's submenu and a pane; a middle click closes a task; tabs and
  panels are dragged). To build:
  - **The system's notifications: first** (small: Electron's `Notification`, `app.setBadgeCount`, `win.flashFrame`).
    The human is in their browser or IDE while agents work; today only the icon on a task's tab says one waits
    or is done, seen only while looking at Kulisa. A notification ("checkout: the agent waits for you"; a click shows
    that task), the number of waiting agents on the app's icon in the dock or taskbar, the window flashing there.
  - **Undo rather than "are you sure?"** for what can be undone: closing a profile, a task's tab, a project shows
    "Closed · Undo" for a few seconds, and Ctrl+Z brings it back. Deleting (a task, a profile with its sign-ins) is
    for good and keeps its question.
  - **A right-click menu on every object, as a rule** (a profile's pane, a task's tab, a project's island, the
    terminal): all of its actions there, so the window shows only one or two buttons and the rest lives in menus.
  - **Dragging from the system**: a folder from the file manager onto Kulisa opens it as a project; a link onto a
    profile's pane opens it in a tab there; a file onto the terminal types its path, as terminals do.
  - Not swipes (a phone's gesture; on a laptop's touchpad a sideways swipe is the OS's and the pages' back and
    forward), nor a double-click as the only way to anything (nobody sees it; only a shortcut to a menu's item).
- **Releases and auto-update** (decided with the author 2026-10-12; steps 1 and 2 built). Users never download a new version
  by hand: installers on GitHub Releases of `cosmotools/kulisa`, and installed copies update themselves in the
  background, the new version starting next time. **Forge's way, its recommendations followed** (the author: rely
  on Forge first; electronforge.io, Auto Update; Electron 44.5.1's `tutorial/updates.md`, `api/auto-updater.md`).
  - **Windows and macOS:** Electron's `autoUpdater` (Squirrel) through `update-electron-app` and the free
    update.electronjs.org (public GitHub repositories); `@electron-forge/publisher-github` uploads into a draft release,
    the workflow publishes it once built and started (the service takes only published releases with a semver tag). `notifyUser: false`: no
    dialog of the OS (Kulisa asks in its own, `Ask.vue`), and no restart from it: `quitAndInstall()` closes the
    windows before `before-quit`, where session cookies and tabs are saved (Hard-won facts); the update applies at
    the next start by itself. Checked every 6 hours (the module's default is 10 minutes: Kulisa stays open for
    days), only when packaged. Squirrel.Windows starts the app with `--squirrel-*` while installing, updating and
    removing it: `electron-squirrel-startup` first in `index.ts` (Forge's maker docs), and `setAppUserModelId` as
    Squirrel names its shortcut. Update checks reach update.electronjs.org (the OpenJS Foundation's: the version,
    the OS, the IP), downloads GitHub.
  - **Linux:** `.deb` and `.rpm` (Forge's makers) on the release, installed by hand; no updater (Electron has none,
    its docs point to the distribution's package manager). Each format updates its own way only: Kulisa never
    puts another format over the installed one (Cursor's updater put AppImages over `.deb`s and broke them, 2026).
  - **macOS** only once signed and notarized (Squirrel.Mac does not update an unsigned app): `.dmg` and `.zip`, x64
    and arm64. The author has no Apple Developer account yet: an Individual one ($99 a year), then a Developer ID
    Application certificate (its CSR made with `openssl`, no Mac needed) and an App Store Connect API key for
    notarization, as CI secrets; `osxSign`, `osxNotarize` in `forge.config.ts`, on only when those are set. Not before
    there are users of macOS (the author, 2026-10-16: alone, on their own Macs, an unsigned build does; "macOS and
    Windows are untested", below).
  - **CI** (GitHub Actions; the flow decided with the author 2026-10-12: CLAUDE.md, Releases): work goes into
    `develop`, `npm test` on every push there; a pull request `develop` → `main` runs it again and checks that the
    version is raised; `main` is protected, the author merges; the merge builds on Ubuntu and Windows (macOS once its
    secrets are there) into a draft release, published by the workflow once every OS built and the installed `.deb`
    started (the author, 2026-10-13: no users yet, no manual step; [window.md](window.md)). Windows not signed at
    first (Squirrel works; SmartScreen warns): Azure Trusted Signing later. kulisa.app's download buttons are the
    latest release's files, taken at the site's build (`kulisa-site`), which the release starts (`SITE_DEPLOY_TOKEN`);
    macOS's says "coming soon" until step 4.
  - **Steps:** 1. Kulisa's part (Forge's publisher and makers, the updater, Squirrel's events, docs): built
    ([window.md](window.md), "The app icon, installers and updates"). 2. The CI's
    workflows (`.github/workflows/`: `test.yml`, `release.yml`): built and run; `develop` and `main`'s ruleset
    (CLAUDE.md, Releases) set up by the author; the Apple secrets at step 4. 3. The first release, `v0.1.0`: built and
    published (2026-10-13); then
    `v0.1.1`: the update checked by hand on the author's Windows machine, by a Claude session there (below). 4.
    macOS, once the account and its secrets exist.
  - **Check on Windows** (step 3): install `Kulisa-0.1.0.Setup.exe` from the release: it installs to
    `%LocalAppData%\kulisa`, makes its shortcuts and starts once, not more (Squirrel's events); publish `v0.1.1`;
    within 6 hours, or at a restart of Kulisa, it downloads (Squirrel's log: `%LocalAppData%\kulisa\SquirrelSetup.log`);
    quit and start again: 0.1.1 (☰ shows the version), the data folder (`%APPDATA%\Kulisa`) as it was, the session
    cookies kept; uninstall leaves the data folder.
  - **Later, each discussed apart:** apt and dnf repositories (static and signed; not GitHub Pages: no file over
    100 MB in git, and an Electron `.deb` is about that; proposed Cloudflare R2 at `apt.kulisa.app`; the `.deb`
    adding its source and key as Chrome and VS Code do, removed with `purge`); "Restart to update" in ☰ (through
    Kulisa's own quit, asking when an agent works); a switch to turn the checks off; delta updates (Squirrel
    downloads the whole app each time); winget.
  - **The package's size** (measured on v0.1.1, 2026-10-13): the `.deb` is 109 MB, 413 MB installed. About 280 MB
    of that is Electron itself (Chromium and Node; VS Code's, Slack's, Discord's `.deb`s are 90–110 MB too), which
    stays. The app's own `app.asar` is 129 MB, mostly what it never loads:
    - node-pty's prebuilt binaries for the other platforms, 58 MB (`prebuilds/`: darwin-arm64, darwin-x64,
      win32-arm64, win32-x64; Linux's is built at install): left out of each OS's package (`forge.config.ts`,
      `packagerConfig.ignore` or a packaging hook).
    - The window's libraries, about 40 MB, which Vite already bundles into `dist/renderer` (2 MB): `reka-ui`,
      `dockview`, `vue`, `@vue`, the `@xterm` addons and `@xterm/xterm`, the fonts, and with them `@babel`, `@swc`.
      In `dependencies`, so Forge packs them again; moved to `devDependencies`, all but `@xterm/headless` (the main
      process keeps each terminal's screen with it: `terminal.ts`). Each checked first: the main process imports none.
    - Expected: a `.deb` of about 80 MB, about 300 MB installed, and Windows' update lighter as much. Checked by
      the release's start of the installed `.deb`; a size limit there would tell when it grows again.
  - **Not now, and why:** AppImage (on Ubuntu 24.04 and later Electron in an AppImage starts only with
    `--no-sandbox`: its FUSE mount is `nosuid` and AppArmor restricts unprivileged user namespaces; Kulisa's pages
    hold real accounts; no maker of Forge's own); Snap and Flatpak (their sandbox is in the way of what Kulisa
    does: the user's shell, agent CLIs, git, direnv, agents installed in `~/.local/bin`; Snap only with classic
    confinement, reviewed by hand); Velopack and electron-updater (one leaves Forge's makers and has AppImage only on
    Linux, the other needs electron-builder).
- **Profile reset and creation, rest.** A clean profile for sign-up tests; reset a profile to a clean state (keeping its
  name); seeded test users (the agent writes the seed for the project).
- **Timeline.** One feed of DOM (rrweb-like), network, console and agent actions, recorded in step across all profiles;
  scrub back to the moment a bug happened, pick an element in the past, tell the agent to fix it.
  - A Vue component as the rest of the window (CLAUDE.md, Window UI). Not Tailwind (styles are tiny); its generic parts
    Reka UI's (no look of its own: Kulisa keeps its IDE look), no kit with a look of its own.
- **Profile mail.** A local mail catcher (Mailpit-like) with a mailbox per profile, shown next to the panes and readable
  by the agent.
- **Run to test.** A multi-profile run the agent did by hand, saved as a Playwright test.

## Deferred ideas

- **Delete all data** (the author, 2026-10-16: put off; the guide tells the human what stays and how to remove it,
  "Reinstalling and removing Kulisa"). An action in Settings, "Delete All Data…", asked first with what goes: every
  project with its tasks (their copies, branches and git records, by `deleteTask`), every profile, every account (signed
  out), then the data folder; then Kulisa quits and the human uninstalls the program. Only while no agent runs. Its
  question must say that the tasks' branches go with their copies: the agents' work not merged. Not in the
  uninstaller: a checkbox there, as Chrome's "Also delete your browsing data", was wanted first, but no OS allows it.
  Squirrel.Windows starts the app with `--squirrel-uninstall` and cancels after 10 seconds (`FullUninstall` in
  `UpdateManager.ApplyReleases.cs`, "failed to run cleanup hook, continuing"): a dialog the human reads and gigabytes
  of profiles, a `git worktree remove` per task and the agents' sign-outs do not fit; a process spawned to outlive
  it would run from the `app-<version>` folder Squirrel is deleting. `apt remove` runs the package's scripts as
  root without a window, and Debian's policy forbids them to touch home folders. macOS has no uninstaller.
- **The agent tests calls and voice: a profile's microphone and what it hears** (the author's idea, 2026-10-08,
  after dictation was tried with a virtual microphone). Calls need several people at once, which is what profiles
  are: the buyer calls, the seller hears; mute silences; the sound comes back after a reconnect; voice messages
  arrive. Tools of the Kulisa plugin (`mcp-server.ts`, any agent), e.g. one for what plays into a profile's
  microphone (an audio file, or a tone) and one for what a profile hears (whether there is sound, its level, when).
  - Per tab, when the agent asks: in that tab `getUserMedia` gets a stream made with WebAudio, and incoming sound
    (`RTCPeerConnection`, `<audio>`) is taken with WebAudio too, by a script put into the page through Playwright over
    the proxy (`addInitScript`). Not Chromium's `--use-fake-device-for-media-stream` and
    `--use-file-for-fake-audio-capture`: they replace the microphone of every profile for the whole run, the human's
    own calls too. The camera the same way (a picture or a video for the webcam).
  - The agent cannot hear (Claude Code and Codex take no audio): check with tones, not speech, e.g. 440 Hz one way,
    880 Hz the other, as calls are usually tested. What was said (speech to text: Whisper or a cloud service) only for
    voice bots and assistants, later.
  - Nearly no RAM (the sound is handled in the tab already open), no new process. First: the permissions (Open
    issues, "Pages get the microphone and camera without asking"), so the agent can test the site's own request too.

- **Our own tools over Playwright, or a bridge to it** (the author's question, 2026-10-08; to discuss again after
  working in Kulisa). The author: a bridge passing the agent's calls to Playwright would be less code. Why the tools
  are Kulisa's own today: `@playwright/mcp` has no profile argument (a server per profile: its 25 tools each, and
  profiles come and go while the agent's servers are fixed at its start); the core's rules live in the tools (the
  sign-in pause, dialogs, captions and highlights over the pane, the human's tabs); and a tool running the agent's
  Playwright code cannot run in Electron's main process (`vm` is no boundary; it has Node and the profiles), while
  in a process of its own it is what the agent can already do with a script through the CDP proxy. Each tool is a
  few lines of Playwright; most of their size is the descriptions the agent reads. Claude's recommendation: keep the
  tools, with `browser_evaluate` and the proxy for rare needs; if the agent often writes its own Playwright scripts,
  that names a missing tool, or is the reason to run its code in a process of its own.
- **A public skill: "read the documentation of the installed version"** (2026-10-07; to judge around 2026-11-07,
  after a few features built with Electron). An agent builds from what it learned in training, older than the
  libraries in use; Kulisa's agent got the dark mode wrong until it read Electron's guide. Today it is a rule in
  CLAUDE.md (Conventions): before building anything that touches Electron, look it up in the installed version's
  documentation (the guides and `breaking-changes.md` at the version's tag, the API in `electron.d.ts`); the same for playwright-core's `types.d.ts`; and name what was read in
  the plan. To judge: did plans name what was read, did features need redoing for an outdated API. If it works,
  publish it as a skill for any Electron project (an agent skill, `SKILL.md`; check Codex reads it): none of the
  Electron skills found (2026-10-07: electron-apps, full-stack-skills, gentleman-skills) points to the installed
  version's docs, they retell Electron in text that ages as training does. If plans skip it, a hook instead.
- **Who a profile is, shared by a team** (cast had it: a slot per role with its description in a file committed to
  the project, each developer signing it in to their own account). Kulisa keeps descriptions in its own data
  ([profiles.md](profiles.md), "Who it is"), as it writes nothing into the project's folder. If a team needs it: a
  file in the project that Kulisa only reads (the developer's own description wins).
- **A screenshot taken at a pick** (point and tell), if a transient element (a tooltip, an open menu, a toast) turns
  out to need it: today the pick is a locator only, and the agent looks at the live page.
- **The agent's label in the page, by its outline** (found 2026-10-15 taking the site's pictures; left so, the
  author's decision). `browser_highlight`'s outline is Playwright's `locator.highlight()`, which writes the locator
  next to it (`locator('aria-ref=f2e20')`); its only option is the style (1.64), and the label is in a closed shadow
  root. The agent's label shows over the pane meanwhile. When Playwright lets the text be set, put the label there; not
  an outline of our own.
- **A store of extensions** (the author's idea, 2026-10-06; on 2026-10-09 the author decided to design it next, with
  voice commands as its first extension). Installs four kinds of things: agent plugins (Claude Code, Codex),
  MCP servers, skills, and Kulisa extensions (code that extends the IDE: a panel and its tools).
  - **Why** (the author): the project stays manageable to support. What not everyone needs (heavy dependencies, a
    microphone always on, one service's panel) lives outside the core, installed by whoever wants it, and can be
    turned off or removed. A feature built into the core first would have to be cut out of it later. The installer
    stays small: an extension's native modules and models come with it.
  - **The order** (decided 2026-10-09): first the store and the extension API are designed, on their own; then the
    voice commands branch is rewritten as the first extension, which tests the API on real code. A second one
    (Stripe, below) before the API is called stable: an API drawn from one example is usually wrong.
  - **The first extension: voice commands**, a working prototype on the branch `worktree-voice-trigger` (worktree
    `.claude/worktrees/voice-trigger`; tried by the author with their own voice, 2026-10-09: it works). With them
    on, Kulisa listens for its name: "Эй, Кулиса" holds the agent's dictation key (the agent records and recognizes
    the task itself), a pause lets go; "Кулиса, отправь" is Enter, "Кулиса, стоп" is Esc. The phrases are
    recognized on the computer (sherpa-onnx's keyword spotter, a 30 MB model downloaded the first time, Silero VAD)
    in a utility process alive only while they are on (about 100 MB). Why it fits an extension: a 32 MB native
    module per platform, a downloaded model, an always-on microphone, and Russian only so far. In the core today it
    touches: `app.ts` (its IPC, a `voiceModel` option), `tasks.ts` (`press`), the renderer's dictation (now
    `Dictation.vue`, rewritten in Vue since: the branch's window part is to be redone), `forge.config.ts` (`asar.unpack` for the native module),
    `package.json`, the tests' `run.ts` (Chromium's fake microphone). Its own files: `listen.js`,
    `listen-worker.js`, the renderer's `listen.js` and `listen-worklet.js`, `test/unit/listen.test.ts`,
    `test/fixtures/hey-kulisa.wav`. The branch's docs say how it works (`docs/window.md`, Voice commands) and what is
    left (its ROADMAP, "Voice commands, rest").
  - **Before it is installed** (the author's idea): the ear stays in the terminal's header; a click opens the store
    at voice commands, with Install. So the core shows suggested extensions where they would be used.
  - **The Kulisa plugin as a built-in extension**, on by default and not to be turned off (the author's idea,
    2026-10-09; to decide when the store is designed). Claude's objection: the Kulisa plugin is the core's second
    handle (the MCP tools call the same `Task` and `Profile` as the window), and the rules on it (the sign-in
    pause, 127.0.0.1 only, `local-only.ts`) are the core's; as an extension the API would have to expose nearly the
    whole core, and a boundary that cannot be turned off separates little. Proposed instead: extensions may add
    MCP tools and lines to the skill (Stripe needs it), and the Kulisa plugin stays in the core.
  - **What the API should give, as voice commands need it** (Claude's list, for rewriting the branch):
    - A manifest: id, name, version, description; its main-process entry and its window module; what it adds to
      the window; what it uses (the microphone, the network, MCP tools), shown before Install; its platforms when it
      has native code.
    - Main process: `activate(kulisa)` and `deactivate()`, without a restart (turned off, its processes end and its
      button goes). The windows and the task each shows, with an event when that changes. The core's actions
      only, never a terminal's pty: `dictate(on)`, `press(key)`, `voice()` (the agent's dictation), as the window's
      and the agent's handles call them (CLAUDE.md, "One core"). Its own data folder (`<data>/extensions/<id>/`),
      removed with it ("Nothing piles up"). `utilityProcess.fork` of its own files, ended by Kulisa when it is
      turned off. Its own IPC channels (`ext:<id>:…`) between its two halves. A download with a SHA-256 check, for
      models. A log line prefix.
    - Window: places to add to: the terminals' row (by the dictation's microphone), ☰, a panel in the grid (Stripe); its icons
      added to the sprite; the window's components (`.icon`, `ButtonMenu.vue`, `Modal.vue`, `ask`; [ui.md](ui.md)) rather than its own; its module
      loaded with `import()` when it is turned on. The microphone for the window only for an extension that asked
      for it (today the window's session grants media to all of its own pages).
    - MCP: tools added to every task's server and lines to the skill, behind `local-only.ts` as the others.
    - Native modules: N-API only (no rebuild per Electron version); the store downloads the platform's package
      (sherpa-onnx-node's per-platform packages) and keeps it outside the asar.
    - Tests: an extension's unit tests in plain Node, and e2e in the same harness (`run.ts`), with switches it needs
      (the fake microphone) and a cache of its downloads in the tests' folder.
    - Development: an extension loaded from a folder (as `claude --plugin-dir`), restarted when its files change.
  - Esc clearing the agent's working state, found on the branch, is in main since 2026-10-09
    (`Task.interrupted`): when rewriting, take main's.
  - Other extensions:
    - **Stripe:** a panel with the project's test-mode events and webhooks, test cards in one click; tools for the
      agent to read events and trigger them ("the buyer pays, the seller sees the order").
    - **Feature flags** (LaunchDarkly, Unleash, GrowthBook, PostHog): each profile's flags in a panel, switched
      per profile; a tool for the agent to set them, to check a feature with the flag on and off, per role.
- **A translucent, blurred window background** (the author's idea, 2026-10-06; Windows 7's Aero glass): the
  desktop blurred behind the gaps between the islands, the title bar and the project's glow; the islands stay
  opaque. The blur is the OS's, not Kulisa's: Electron's `vibrancy` on macOS, `backgroundMaterial: 'acrylic'` (or
  `'mica'`) on Windows 11; on Linux only a transparent window (KDE can blur it, GNOME cannot: the desktop would show
  through sharp, worse than now), nothing reliable on Windows 10. Deferred: the author works on GNOME and would not
  see it. If built: only where it is real (macOS, Windows 11), opaque elsewhere; a few lines where the window is made
  (`app.ts`) and a translucent background color for those systems (`tokens.css`). Check transparent windows'
  known issues there (resizing, maximizing, the title bar overlay, profile views above the HTML). Faking the blur
  (a picture of the wallpaper, blurred) was rejected: a workaround, and it lags when the window moves.
- **One panel in its own OS window** (e.g. the buyer's profile on a second monitor, the terminal and the other
  profiles staying in the main window). Today a task moves to another window whole (Move to New Window).
  dockview has popout windows, and a profile's native views can move between windows (`Profile.moveTo`), but a
  window shows one task's grid today: a window holding a part of another window's task is a new model
  (the views' bounds, closing, restoring after a restart). Medium work; to discuss.
- **A right-click menu in pages** (copy, paste, open a link in a new tab of the profile, Inspect Element; more items
  later). Tried with electron-context-menu (native GTK menu) on 2026-10-05 and removed:
  - On Ubuntu GNOME (X11) a right-click in a profile's page froze the whole desktop, twice: gnome-shell logged a
    menu window with a NaN position and a size of -2147483648 (the invisible menu kept the pointer and keyboard
    grab). Likely not the menu itself: the same log came on 2026-10-12 from a right-click on the title bar, GNOME's
    own window menu for a drag region ([window.md](window.md), The title bar), and Teams' pages declared drag
    regions then (before `no-drag` was forced on pages). Not checked again.
  - The menu also took the right button from sites that have their own context menu (Teams, Google Docs).
  - Before trying again: show it only where the page did not handle the right-click, and either find the cause of
    the freeze in a minimal window first or draw the menu in HTML (a small view above the page, as VS Code draws
    its menus on Linux).
  - The window's menus are HTML now, Reka UI's ([window.md](window.md), Menus); a page menu could be one too
    (`RightClickMenu.vue`), over a picture of the page.
- **Tabs unloaded, rest** (built 2026-10-13: [profiles.md](profiles.md), "Tabs unloaded"). A pane whose tab loads
  again is empty meanwhile: a picture of the page taken at the unload could stand there (a JPEG per tab in memory, as
  the pictures under menus); a tab's history (Back, Forward), its scroll position and its forms go with its process, as
  a closed tab's do. Electron 44 can keep them: `navigationHistory.getAllEntries()` gives the entries with their
  `pageState`, and `restore()` takes them (`electron.d.ts`; checked 2026-10-13), so the tab could come back as Chrome's
  does, with Back and its place in the page. To watch in use: whether 5 minutes is the right time, and a tab loading
  again at a bad moment. The two steps Chrome takes before unloading (throttling, freezing) wait on the tabs sleeping: Open
  issues, "Tabs never sleep".
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
    them itself (`Kulisa Tabs.json`, `Kulisa Session Cookies.bin` in the profile's folder).
  - Considered and not chosen for now (a workaround, not native): an "Open in Chrome" button that starts Chrome
    (`chrome-launcher`) on its own folder per Kulisa profile and copies cookies and tabs over a short CDP
    connection. Copies only; `localStorage` tokens and Kasada-protected sessions may not carry over.

## Open issues

- **The window jumps after it is restored, on Linux** (found 2026-10-12; left so, the author's decision). Restored
  from minimized, it shows about 16 px right and 10 px down, then jumps back up and left. Chromium's frame around a
  window without the system's (its shadow and resize border) is counted only after the window is shown again; bare
  Electron 44.5.1 does it too (`titleBarStyle: 'hidden'` or `frame: false`, X11, GNOME), `hasShadow: false` only makes
  the jump smaller. The system's title bar has no jump but is a second row over Kulisa's, and no app can put buttons
  into it. Check at an Electron upgrade: minimize and restore a window made with `titleBarStyle: 'hidden'`.

- **The OS's window buttons are not dimmed under a dialog** (the author, 2026-10-11; put off). They are drawn by the
  OS over the window (`titleBarOverlay`, `window.ts`), so the dialog's backdrop, HTML, cannot cover them: under a
  dialog they stay bright. To look at: dim them with `setTitleBarOverlay` while a dialog is open (Windows and Linux;
  macOS's traffic lights have no such color), or leave them, as many desktop apps do.

- **Pages get the microphone and camera without asking** (found 2026-10-08, talking about calls). Profiles' sessions
  set no `setPermissionRequestHandler` / `setPermissionCheckHandler` (`session` in `electron.d.ts`, Electron 44), and
  Electron then approves a page's requests by itself (its security checklist: "Handle session permission requests
  from remote content"; check that it still says so for 44): any site in a profile can use the real microphone and
  camera, and notifications, geolocation and the rest, with no question as Chrome asks. To build: ask as Chrome does,
  in the profile's pane (an HTML bar over the page, as Chrome's bubble under the address bar; the pane's native view
  draws over HTML, so the view is moved down or hidden meanwhile), remember the answer per site in that profile, and
  let the human change it (a site's permissions in the pane's menu). The agent: grants nothing itself; a test that
  needs the microphone asks the human, or uses the agent's own microphone (Deferred ideas, calls).

- **The grid in a small window** (not decided; the window's own minimum is built: window.md, "The window's size"). When the panes do not fit,
  dockview overflows and cuts them, the profiles' native views get boxes near 0, and the terminal may get 0 columns
  (`pty.resize` is in a `try` in `src/main/terminal.ts`, but the agent's CLI draws garbage at a tiny size). Ways to weigh:
  panes shrink to a `minimumWidth` per panel (dockview) and views too small to use are hidden, or a narrow grid
  turns into tabs.

- **Workarounds of Electron bugs: check at every Electron upgrade** whether they are still needed, and remove them
  when not.
  - Drag regions (`app-region: drag`) of a view's page stay after the page has gone, in a window without a system
    title bar; they took every click over the panes after Teams (window.md, "The title bar"). Workaround:
    `app-region: no-drag` in every profile page (`profiles.ts`, `_add`). Electron issue: [electron/electron#54743](https://github.com/electron/electron/issues/54743) (2026-10-08).
    Check: remove the workaround, open Teams (or a page with `app-region: drag`, then another page) in a pane, and
    click the page with a real mouse (`debug-kulisa` skill). Linux only so far; macOS and Windows draw frameless
    windows their own way (see "macOS and Windows are untested"). Still needed in 44.8.0 (2026-10-16: a click where
    the page before had its drag region did not reach the page; the issue open).
  - A page's alert and confirm in its pane (profiles.md, "Dialogs"): Electron has no API for them, so Kulisa replaces
    the listener of its internal `-run-dialog` event (`lib/browser/api/web-contents.ts`, Electron 44; `-cancel-dialogs`
    too). Check: that file at the new version's tag; the test of dialogs in `test/agent.ts` fails when the event is
    gone (Electron's message box comes back instead of the pane's dialog). Ask Electron for a public event
    (`webContents` 'dialog', as `select-bluetooth-device` takes a callback), then use it. The file is the same in
    44.5.1 and 44.8.0 (2026-10-16).
- **Tabs never sleep: Playwright keeps every page "visible".** Chrome treats a tab in the background in three
  steps, each cheaper for the computer: its page gets `document.visibilityState: "hidden"` at once (no animation
  frames, timers at most once a second, once a minute after 5 minutes); after 5 minutes it is frozen (no JS at all,
  its memory kept, back in an instant); under memory pressure it is unloaded. Kulisa has only the third
  (profiles.md, "Tabs unloaded"). The first Electron does by itself: a `WebContentsView` after `setVisible(false)`,
  or removed from the window, tells its page it is hidden, and Chromium throttles it (bare Electron 44.8.0, Linux,
  2026-10-16: `hidden`, no frames, timers once a second, after 4–5 minutes once a minute). What keeps Kulisa's pages
  awake is Playwright: on attaching to a page it sends `Emulation.setFocusEmulationEnabled` once (`crPage.ts`,
  `FrameSession._initialize`; skipped only with `connectOverCDP`'s `noDefaults`), which Chromium implements as a
  capture of the page (`EmulationHandler::SetFocusEmulationEnabled` → `IncrementCapturerCount`), and a captured page
  is visible always, even in a hidden window. Bare Electron with that one command behaves as Kulisa does; in Kulisa
  a tab behind the active one, or under another task, says `visible` and draws 60 frames a second (measured in the
  app, 2026-10-16). With the command dropped in the proxy the tabs sleep, but the agent's tools on a tab behind the
  active one hang: a hidden page draws no frames and Playwright waits for the element to be stable
  (`browser_highlight`, `scrollIntoViewIfNeeded`; test "tools on a tab other than the active one"). Freezing Electron
  does not do by itself (no `freeze` in 6 minutes: Chrome's rule is its performance manager's), but
  `Page.setWebLifecycleState: frozen` over the debugger freezes a hidden page at once (same measurement; a page kept
  visible ignored it). Planned (2026-10-16, with the author):
  1. **A tab is awake only while the agent works in it.** The proxy answers Playwright's command itself, without
     forwarding it, and sends it to a tab with `enabled: true` at the agent's first command to that tab, with
     `false` once its profile has had no command for a minute (`busyAt`, the clock of `discard.ts`). The active tab
     and the visibility are not touched: the agent keeps working behind the human's tab, and in the panes of tasks
     not shown (their agents cannot switch tasks, so a hidden pane must wake for them). The sign-in pause detaches
     the debugger, which drops the capture by itself. Tests in the profiles group: a tab behind the active one says
     `hidden` and draws no frames; the agent's tool on it works; after the idle time it is `hidden` again.
  2. **Freezing before unloading**: a step in `discard.ts` (`Page.setWebLifecycleState: frozen` over the debugger,
     `active` when shown or used), possible once the page is hidden.
  Open for the author, apart: whether the agent brings the tab it acts in to the front in the task the human is
  looking at (as a human at a browser would, and the human sees what it does): a rule over step 1. Related in
  Electron: [#41233](https://github.com/electron/electron/issues/41233) (a page always "visible" with
  `backgroundThrottling` off; ours is on), [#50250](https://github.com/electron/electron/issues/50250).
- **The MCP server and the CDP proxy do not authenticate local processes.** Web pages are refused
  (`local-only.ts`: Host and Origin checks), but any local process can drive the signed-in profiles. Needs a
  per-launch token (passed to the agent through the environment, like `KULISA_MCP_URL`) at least.
- **`signin-pause.ts` is a temporary implementation** to be replaced by the author. It recognizes sign-in pages
  only by host and pauses the whole profile.
- **macOS and Windows are untested** (only Linux so far; Kulisa targets all three: CLAUDE.md, Conventions). **The macOS
  support is the goal**, in two (the author, 2026-10-16):
  1. **For development**, the goal now: Kulisa works on a Mac from source and from a build made there, unsigned (one's
     own machines need no Apple Developer account; a build made on the Mac is not quarantined, so Gatekeeper lets it
     run), its tests pass, and the gaps below are checked. Then `test (macos-latest)` becomes a required check of
     `develop` and `main` (CLAUDE.md, Releases); its CI job passes and fails the workflow since that day, not required yet.
  2. **For users**, later, once there are some: signed and notarized, `.dmg` and `.zip`, updates ("Releases and
     auto-update", macOS), with the Apple Developer account. Until then an unsigned build downloaded on another Mac
     is refused by Gatekeeper and does not update, and kulisa.app says "coming soon" for macOS.

  Known gaps:
  - Drag regions left by a page (Workarounds of Electron bugs, above): seen on Linux; whether macOS and Windows
    have the bug, and whether the workaround is enough there, is not known. Open Teams in a pane and click its page.
  - Signing in to Google and GoDaddy (Kasada) in a profile: passed on Linux with Electron's own User-Agent
    (2026-10-12); without its `Electron/<version>` (2026-10-16, [profiles.md](profiles.md), What sites see) Google, GoDaddy and
    Microsoft passed on macOS (the author, 2026-10-16); check again on Linux, and on Windows.
  - The sandbox on Linux, packaged: the `.deb` installs `chrome-sandbox` setuid root; the unpacked `out/` folder needs
    `--no-sandbox` to try it. Other Linux formats (AppImage, rpm, snap) are not set up.
  - Starting the agent (`terminal.ts`): on Linux and macOS it is typed into the user's shell started in the
    project's folder, so the project's environment applies (direnv's `.envrc`, nvm, mise) and `PATH` is the
    user's even when Kulisa was started from a menu. Checked on Linux with bash only.
    - macOS: a login shell (`$SHELL -l`, zsh by default; `os.userInfo().shell` when started from the Dock without
      `SHELL`). Checked on the author's Mac (2026-10-16, `startTerminal` run alone in Electron, their own `.zshrc`):
      with no `SHELL` and the system's `PATH`, as from the Dock, the login zsh finds `claude`; direnv's hook in
      `.zshrc` loads the project's `.envrc`, and the account's `CLAUDE_CONFIG_DIR` typed before the command wins
      over the one it sets; arguments with spaces, `'`, `$`, `*`, `!` and JSON reach the agent as they were; the shell
      stays after the agent exits. Not checked: fish (not installed there).
    - Windows: the agent starts directly, without a shell, so no project environment; `claude` from npm is a
      `.cmd` that node-pty may not find. Proposed: type it into PowerShell (`pwsh -NoExit`, falling back to
      `powershell.exe`) in the project's folder, as on the other systems: the PowerShell profile applies, `.cmd`
      resolves, the shell stays after the agent exits. Without an agent command the terminal falls back to
      `COMSPEC` (untested). SIGINT and SIGTERM work differently there (quit handling in `app.ts`). The other
      terminals (`terminal_run`, +) type their command into `COMSPEC` there: untested; PowerShell as above would
      serve them too, and `terminal_stop`'s Ctrl+C in cmd asks "Terminate batch job?".
    - Both: closing a task and opening it again (`claude --resume`) and the project folder dialog
      (New Project…'s Browse…, native) are untested.
  - `safeStorage` (Keychain, DPAPI) for session cookies: works on macOS (2026-10-16: the author's profiles' files
    encrypted, Chromium's `v10`; the key in the Keychain as "kulisa Safe Storage"; the tests of sign-ins after a
    restart pass on the Mac and the CI's). Windows: untested.
  - Dictation (the right ⌘ held, or the terminals' microphone): the agent records itself. macOS: the system asks for the
    microphone for Kulisa (`NSMicrophoneUsageDescription` in `forge.config.ts`); check that it asks and that `claude`'s `/voice`
    then records, packaged and from `npm start` (the Terminal app's permission may be the one asked then); signed
    with the hardened runtime it also needs the `com.apple.security.device.audio-input` entitlement; that the right ⌘ is
    seen as one (`MetaRight`, `location` 2: tested with sent events only). Windows: the microphone privacy setting for
    desktop apps; the right Ctrl of a keyboard with AltGr (it sends a Ctrl before AltGr on Windows: check that a typed
    AltGr character does not start a recording).
  - macOS: the window screenshot (`KULISA_SHOT`) needs the screen-recording permission, which macOS checks on the app
    that started Kulisa (a terminal: [testing.md](testing.md), "On macOS"; started by `open`, Electron.app itself, which
    had it before Electron's upgrade to 44.8.0 and was refused after it, 2026-10-16: probably because ad hoc signed, a
    new binary is a new app to macOS); distribution to users needs code signing and
    notarization (the second macOS goal, above). Windows: code signing certificate.
  - The first start: a packaged app opens no task (the empty window: New Project's steps), later the windows' tasks open as they were left.
    macOS (2026-10-16, `npm run package`, unsigned, ad hoc): it starts from Finder's way (`open`), the first start as
    above; the Kulisa plugin and the skill sit outside the asar, node-pty's `spawn-helper` is executable, the icon is
    Kulisa's. Its update check fails ("The server sent an invalid response": no macOS release to serve) and is only
    logged. Not checked packaged: the later starts, an agent started in a task.
  - The one-row title bar (`titleBarStyle: 'hidden'` + `titleBarOverlay`, Window Controls Overlay): checked on
    Linux/X11 only. Check the window buttons, dragging and double-click to maximize on macOS (traffic lights on the
    left), Windows and Wayland (Electron 44 runs natively there by default; the author's GNOME is X11: "Ubuntu on
    Wayland" at the login screen). macOS: the traffic lights centered in the bar at 80%, 100% and 150% when the window
    is made at them, and moved to the middle as the zoom changes ([window.md](window.md), The title bar; screenshots,
    2026-10-16); not checked by hand: a click on them after a zoom change (150%, 300%), dragging, double-click to
    maximize. Ask Electron for `setTitleBarOverlay` on macOS: with it they would follow any zoom.
  - Windows at a display scale of 125% or 150%: the profiles' native views placed from the window's CSS boxes
    (`window.ts` scales them): check that no page is a pixel off its pane or leaves a gap at its edge, and that the
    scrollbars follow the dark theme (`color-scheme`).
  - Keyboard shortcuts ([window.md](window.md), Keys): checked on Linux only (with Latin and Russian layouts). macOS:
    ⌘ for Kulisa's and Chrome's keys, ⌘⌥1…9 for tasks, ⌘[ / ⌘] back and forward (the tests pass there with sent
    events, 2026-10-16), its own menu bar (built: Settings… ⌘,, Quit, Edit, Window); by hand: check that a page does
    not get ⌘-keys before Kulisa (on Linux
    `before-input-event` comes first, and the app menu after the page: [window.md](window.md), Keys), and that Ctrl
    stays the terminal's. Windows: Alt+D and F6 to the address bar, Ctrl+F4; the keys with AltGr layouts (Polish,
    German), where AltGr is Ctrl+Alt.
  - The window's menus and dialogs (Reka UI, [ui.md](ui.md), Menus and Dialogs): checked on Linux only. A right-click
    menu opens on the press on Linux and macOS but on the release on Windows: check that it opens at the pointer and
    that the release does not choose a row (`MenuButton.vue` takes the left button only); a button's menu opening on
    the press, and press, drag and let go on a row (macOS menus do it too); a window's blur closing a menu; Esc in a
    field edited in place (a profile's name) not closing its dialog; Select's list over a dialog.
  - Copy and paste in the terminal (`clipboardKey` in `terminal.ts`): checked on Linux only. Windows: Ctrl+V pastes
    once, Ctrl+C copies a selection and interrupts without one. macOS: ⌘C / ⌘V through the app menu's Edit roles
    (`app.ts`; tested by what they do, not by the keys: [testing.md](testing.md), "On macOS"); by hand: the keys, and
    Ctrl+V reaching the agent.
  - Several windows (Move to New Window): a profile's native views moved from one window to another, and a window's
    place restored (`getNormalBounds`, maximized); checked on Linux/X11 only. Dragging a project's label: tested with
    synthetic events only, not yet by hand; a project let go outside the windows is told from a cancelled drag by where the
    pointer is (`screen.getCursorScreenPoint`), which Wayland may not report.
  - The theme (☰ → Theme): the OS buttons' strip recolored (`setTitleBarOverlay`) and System following the OS
    (`nativeTheme.shouldUseDarkColors`, `updated`; on Linux through GTK or the desktop portal): checked on
    Linux/X11 (GNOME) by the tests only, not by changing the OS's setting by hand. macOS draws its own window
    buttons.
  - Tests run often on Linux only; on macOS and Windows before a release (the author's decision, 2026-10-09). The CI
    runs them on all three at every pull request into `develop` or `main` ([testing.md](testing.md), CI); Windows not failing the
    workflow until the bench passes there (macOS does since 2026-10-16): fixed by a Claude session on Windows. On a computer they run on the human's
    screen there (Xvfb is Linux's), taking its focus.
    The test bench was made on Linux; adapted on each OS where it can be run (the author's decision, 2026-10-08). macOS:
    passes since 2026-10-16 (on the author's Mac, twice in a row; [testing.md](testing.md), "On macOS"). Known for Windows:
    - Windows: the agent is `bash -c '… exec cat -v'` with a `bashrc` (`test/run.ts`), the fake agent's installer is
      `sh` only (`printf`, `chmod`; the real agents have a `win32` one), the hooks' test runs commands with `bash`
      (`test/agent.ts`). A Node script as the agent would run everywhere.
    - What one OS alone has: skipped with the reason, not left to fail.
- **A profile dropped from its list, its folder left behind** (found 2026-10-07; to come back to). The author's
  data held a `Profile 2` in a main workspace (the model before tasks), in no `profiles.json` and not in `deleted-folders.json`.
  - Not deleted: deleting a profile, open or closed, removes its folder at the next start (tried 2026-10-07), and
    removes its session cookies file at once; that file is still there.
  - Its timestamps: created 2026-10-06 22:17; session cookies and storage written 22:42:12, as closing a profile
    does; at 22:42:41 `Profile 3` was created and `profiles.json` written without `Profile 2`. So it was closed and
    then dropped from the list without being deleted. The code path is not found; ask the author what they did then.
  - Whatever the cause, a folder no `profiles.json` names: proposed to add it back to the list as a closed profile
    (nothing signed in is lost; the human deletes it if not needed), rather than remove it at start, which would
    destroy sign-ins of a profile dropped by a bug. The author's decision.
  - The author started over with fresh data on 2026-10-08: watched, not fixed. To look for it (read only): every
    `Profile N` folder of a task that its `profiles.json` does not name and `deleted-folders.json` does not list:
    `for d in ~/.config/Kulisa/projects/*/*/; do for f in "$d"Profile\ *; do [ -d "$f" ] || continue;
    cat "$d/profiles.json" ~/.config/Kulisa/deleted-folders.json 2>/dev/null | grep -qF "\"$(basename "$f")\"" ||
    echo "$f"; done; done` (one `grep` over several files, one of them missing, fails here: `grep` is ugrep).
    When one shows up, ask the author what they did just before.
- **Profiles' caches** (2026-10-08: a closed profile's caches are cleared, [profiles.md](profiles.md), "What is on
  the computer"; to decide for good, the author; since 2026-10-16 the sites' Cache API too). Chromium's HTTP cache, Code Cache and GPU caches per profile (on
  the author's main profiles 47 and 78 MB after a few days; a task's copy used in Teams 430 MB, half of it the Cache API); Chromium sets the HTTP cache's limit itself from the
  free disk space, and open profiles still grow to it. Several profiles in several projects add up.
  - Alternative: a limit for the whole app, `--disk-cache-size=<bytes>` (`app.commandLine.appendSwitch` before
    ready): every profile's HTTP cache at most that, open ones too; not the code and GPU caches.
  - Or both, or clearing when a task is closed as well. Cost of clearing: the first load of a
    reopened profile's sites is slower (no cache), which matters little for profiles set aside.
- **Tests that failed now and then.** Fixed 2026-10-12: the first point-and-tell test (pick mode reaches the page a
  moment after it starts and says nothing when: a click before went to the page; the test clicks again until the pick
  comes), "DevTools in a pane's ⋮ menu" (DevTools' window took the focus after the test's 3 s wait, closing the menu
  opened meanwhile; the test opens it again), "the islands keep their places" (a frame drawn while a group was folded).
  Not looked at: "Move to New Window puts a project in a window
  of its own" (a 30 s timeout) and "agents: ☰ → Agents… shows what is installed" failed together once in a full
  `npm test` (2026-10-11, after the move to Reka UI; the output not kept), not in the four runs after; the agents'
  tests failed together again once in a full `npm test` (2026-10-11, the projects' manager as a page: "☰ → Agents…"
  0 !== 3, "Installed" read "Not installed", a new account's sign-in never started), not in the group alone nor in the
  full run after: the fake agent's install seems to race something under two groups' load; "Move to New
  Window" timed out (30 s) once more on 2026-10-11 in one group's run, not in the two after; "DevTools in a pane's ⋮ menu
  opens and closes the DevTools of its active tab" failed once in a full `npm test` (2026-10-11), not in the run after; one test
  of the profiles group failed once more in a full `npm test` that day (which one not kept), not in the two runs after;
  the DevTools one again later that day (its ⋮ menu did not open: `menuOpen` timed out), not in the run after. Under the load of two full
  `npm test` at once (two worktrees, 2026-10-11) both agents' account tests failed (the account's sign-in menu did not
  open; 'custom' !== 'fake-1'), and "closing the last tab of a profile leaves an empty tab" (`browser_navigate` to the
  site interrupted by the empty tab's `about:blank`), each in one run of the two; alone, all passed in two runs. "Move to
  New Window" failed once more on 2026-10-12 in a full `npm test` with the machine loaded (load 11 on 16 cores, the
  run 76 s instead of 57), not in the two after. The master window's tests ("About this profile… opens Settings at it; its Sign
  In… opens the same master window, once": `Object has been destroyed` in `master.ts`'s `place`) failed with two after
  them in one `npm test -- tasks` on 2026-10-12, load 13 from other sessions' runs, not in the run after. "Move to New
  Window" again on 2026-10-12 (load 5 to 9), timing out while the project moves back into the first window and the
  second closes: 3 of 12 runs of the group with the windows sandboxed, 1 of 6 without. On GitHub's runner (Ubuntu, 2026-10-12): "context menus …", a tab's right-click right after the
  pane's menu closed opened no menu, once; not reproduced here (twice on two cores): the test right-clicks again until
  it opens. Its cause, a real right-click lost so, not found. Ctrl+` in an empty task (the island's buttons) given back to where the keyboard was by
  the + menu closed just before, on a loaded machine: the test presses again. "Move to New Window" still times out
  (30 s) now and then under the runner's conditions, reproduced here ([testing.md](testing.md), CI), not looked into.
  Found on the runner's logs and fixed on 2026-10-13 (#21), none of them reproduced here: the address bar's click (the
  test before it clicks Back and ended as the buttons changed, with the navigation in flight: the pane still showed the
  address before, the tab the new one; it waits for both now); "Move to New Window" (the agent's size compared the moment
  the terminal showed its text, while the new window's page had fitted it at the whole window's height before its grid
  was laid out: 46 rows for 17; the test waits for the last fit, and that passing size is an issue of its own, below);
  "× on the last open task closes its group" (the close took over 5 s there, its profiles' sign-ins written out and
  their tabs closed: 15 s). Ubuntu green 3 runs in a row after it. On GitHub's macOS runner (2026-10-16, #38): the window's
  page losing the keyboard to a profile's page that had it, about one run in six of the `tasks` group, on `develop` too
  (a probe of six runners each, before and after #38), never on the author's Mac. macOS makes a window key a moment
  after Kulisa focuses its page and then gives the keyboard back to the window's last first responder, over Kulisa's
  focus. Fixed where it was seen: Settings closed (`settings-window.ts`: the page focused again on the window's `focus`)
  and the tests' `focusWindow` (focused again until the page has it). Seen since: a menu closing while read, and the keyboard in a
  profile's page after Settings closed, each as a profile's page in the window took the keyboard as it loaded: menus
  now close on the window's blur, not its page's (`lib/cover.ts`), and a page taking the keyboard by itself gives it
  back (`page-focus.ts`; both the author's choice, 2026-10-16). `settingsClosed` says where the keyboard is when it times out. Slow but not flaky: deleting a task (a fork's closing took 11 s,
  git's work), a site that never answers (10 s: two 5 s waits by design).
- **The agent gets a passing size when its project moves to a new window** (found 2026-10-13, on the runner: the
  test above). The new window's page fits the terminal as soon as it opens, at the whole window's height (46 rows),
  and again once its grid is laid out (17): both go to the agent (`pty:resize`, `renderer/lib/xterm.ts`), which
  draws its prompt for each. A fix: fit only once the grid has laid out; the test then refuses a passing height as it
  does a width (`__ptySizes`).
- **The test "after a restart: a task's other terminal comes back …" takes 5.6 s** (`restart-tasks.ts`;
  found 2026-10-09, to come back to). Most of it is showing the project `other` until its task has loaded and
  the terminal's shell runs; it looks like another 5 s wait (as a tab's `ready` held a profile on a refused site:
  `profiles.ts`). To find: time the steps of loading `other` after a restart (its profiles' tabs, its terminals).
- **The GPU renderer only on terminals in sight** (discussed with the author 2026-10-09; the author builds it later).
  Today every terminal loads xterm's WebGL addon when made (`makeTerminal` in `src/renderer/lib/xterm.ts`), hidden ones
  too (other tasks and projects, terminals behind another tab of their island): each keeps a WebGL context and its
  glyph atlas. With several agents in a task (each a terminal) the limit below comes sooner.
  Chromium keeps at most 16 contexts per page; the 17th takes the oldest one's, and that terminal falls back to the DOM
  renderer for good (`onContextLoss`), drawing slower. Nothing breaks: at about 5 projects × 3 tasks it starts.
  - The fix: a terminal gets the WebGL addon when it comes into sight and disposes of it when hidden (its tab in front
    of the shown task's island: `Terminals.vue`, `place`), so only the terminals on screen hold a context.
    The buffer (the text, scrollback) is untouched: it is xterm's, not the renderer's. About 15 lines. Test
    (`test/window.ts`, next to "GPU renderer"): the shown terminal is `webgl`, a hidden one has none and gets it back
    when shown; `window.__termRenderer` reports the shown one already.
  - Measured 2026-10-09 (bare Electron 44 with the same xterm 6.0.0, addons and options; 173×43, scrollback full;
    Xvfb, so the GPU was software (llvmpipe) and its memory is RAM there). GPU process now → with the fix: 5
    terminals 85 → 37 MB, 10: 155 → 47, 20: 228 → 47 (4 contexts lost), 30: 243 → 54 (14 of 30 fell back to DOM).
    The window's renderer barely changes (10: 96 → 92 MB): most of a terminal's memory is its buffer, about 5 MB with
    a full scrollback. Cost: showing a terminal takes ~35 ms more (69 ms instead of 33: a context and an atlas
    made again). The author had 4 terminals then: a gain of ~25 MB, so not urgent. To check on a real GPU when
    built: the switch's time and the video memory.
  - Not chosen: **one xterm for all terminals**, switched between tasks as YouTube reuses one player (the
    author's idea). A player keeps no state (the video is on the server); a terminal's state is its buffer, kept only
    in xterm (the pty in the main process passes bytes on; since 2026-10-12 a shell's screen is kept there too, its
    last 500 lines for `terminal_read`, not an agent's: window.md, The terminal). It would have to live elsewhere anyway (`@xterm/headless`
    per pty: the same memory, plus serializing and writing it again at every switch, losing the scroll position and
    the selection; or the raw output replayed: a log that grows, slow for a long session), and several terminals are
    on screen at once (other windows). VS Code too keeps an xterm per terminal.
- **No performance numbers taken with the monitor on** (CPU, RAM, many profiles): measured when a decision needs them,
  on the version then current (`ps`, `app.getAppMetrics()`), not written down.
- **`playwright-core` is pinned to a 1.64 alpha.** Move to the stable release once it ships with the same APIs.
