# Roadmap

What is planned: ideas and the details of features still to build, deferred ideas, open issues. Feature numbers
refer to [SPEC.md](SPEC.md), section 2. When a feature is built, it is documented in `docs/` (how it works and why:
[profiles.md](profiles.md), [tasks.md](tasks.md), [window.md](window.md), [ui.md](ui.md)) and removed from
here; what is left of it stays.

## Next

- **Projects and tasks: Kulisa rebuilt around them** (designed with the author 2026-10-10; built first, on the branch
  `tasks`, before the store of extensions). It replaces the model of workspaces ([tasks.md](tasks.md)): a project
  was a folder with a main workspace and forks; now a project is a composite of things from catalogs, and the work is
  done in **tasks** (the word replaced "workspace" everywhere: code, docs, CLAUDE.md). No migration: Kulisa is in
  development, the new layout does not read the old data, the author starts with an empty `~/.config/Kulisa`.
  - **Status** (keep it current: a new session reads it first). 2026-10-10: all steps below are built and
    committed on `tasks`, not pushed; the full `npm test` passes. Step 7, the projects' manager, built 2026-10-10 (`147e862`); the
    author's data was cleared of the old format then (one data format only: old data is deleted, never read or
    migrated). The author is testing it by hand. The window was then rewritten in Vue 3 and TypeScript, built by Vite (the author's
    decision, 2026-10-10: the whole renderer at once, TypeScript from the start, the bugs of the rebuild after; how it is
    built: CLAUDE.md, Window UI; [ui.md](ui.md)); the author tests that too. Next: fix what the author's testing finds;
    then what is left of each step ("Left:" in it), only once the author has decided it.
    Open, for the author to decide: Refresh from Master… now matters only for a local app's cookies (keep or drop);
    a script the agent runs in a page (`browser_evaluate`) could read a test password back from its field (only the
    skill forbids it: close it or not). For the author's real accounts, not testable by Claude: device-bound cookies
    (DBSC, Google) and MSAL's sign-ins kept in step (step 6); "Sign in with Google" without the sign-in pause is the
    author's own replacement of `signin-pause.js`. Not discussed, so not to build unasked: signing a CLI in from the
    Agents window, tabs in a master's window, tasks in a former folder getting copies.
  - **Agents** (a catalog in ☰, global): the human picks a CLI (Claude Code, Codex, …) and signs in with the CLI's
    own login in Kulisa's terminal; each account has its own config folder (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`) in
    Kulisa's data folder, gone with the entry. An existing `~/.claude` is taken over as the first account, not signed
    in again (and never deleted: it is the human's).
  - **Profiles** (one flat store, each listing the projects it belongs to; it goes, after a question, when its last
    project does; seen in the project's editor: + New, + From another project). A profile is a person with all their
    sign-ins, in one or more forms:
    - sessions of real accounts: the human signs in by hand to the profile's **master**, which no one works in
      (opened in a window of its own for that);
    - login-password pairs, for local addresses only (below): the agent signs in itself; kept by Kulisa, encrypted
      (Electron's `safeStorage`, to read in the installed version's docs); set by the human in the editor or by the
      agent (an MCP tool, e.g. after it signed a test user up); never logged;
    - none: a blank profile, for sign-up tests (SPEC feature 7).
  - **Projects** (composite; a wizard to create and edit): a name, a color from a pool, an icon (the repository's
    favicon if it has one, else Kulisa's set), agents (one default), profiles, repositories or folders (local, or
    cloned from a URL; one default). A project needs no repository: then it has a folder, by default
    `~/Kulisa/<project>` (`~/Kulisa` is the default place of every new project, as JetBrains' `~/PycharmProjects`,
    changeable), or one the human picks. That folder is the human's: Kulisa never deletes it. Once a repository is
    added, tasks no longer work in it; the editor shows it ("former folder, tasks no longer work in it", Show) while
    it exists, and the human moves its files (or asks the agent).
  - **Tasks.** + in a project's group makes one with the project's default agent, its default repository and its
    profiles, all closed until opened (step 7); the human describes the task in the agent's terminal. A task always works in copies: a worktree per
    repository, on one branch, named `task-N` until the agent renames it (an MCP tool; `git branch -m`). The agent
    starts in the default repository's copy and gets the others with their instructions: Claude Code `--add-dir` and
    `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1`, Codex `--add-dir`, other CLIs a line at session start
    (`agents.js`, one entry each). More repositories only from the project, also while the task works (Kulisa types
    into the agent's prompt what was added; Claude Code also gets `/add-dir`). A folder without git has no copies: the
    task works right in it, and a second open task there shows a warning ("two agents may get in each other's way")
    and may go on. Ports as today: one offset per task (`KULISA_PORT_OFFSET`, copied tabs moved).
  - **Profiles in a task**: a copy of the master, made when the profile is first opened in the task (not all at
    once). Local apps' sessions are each task's own (each task runs its own dev server, often with its own
    database, and cookies do not depend on the port: shared, two tasks would keep signing each other out); the
    agent signs in there with the profile's pair.
  - **Closing and deleting.** × on a task's tab closes it: the agent stops, tabs close, everything else stays; it is
    listed as closed in its project's group, and opening it resumes the agent's conversation. Delete is in the tab's
    menu, after a question naming what is lost. With git a task is atomic: worktrees, branch and the agent's session
    go together (the question warns of uncommitted files and of commits not in main and not pushed). Without git:
    the conversation, profile copies and the task go, files in the folder stay. Closed tasks stay on disk until the
    human deletes them; Kulisa offers it once the PR is merged.
  - **The project's folder is the human's**: agents never touch it on their own. To bring work into it without a
    remote, the human asks the agent ("merge into main"); the skill: first check the folder for the human's
    uncommitted changes, and stop if there are any.
  - **The bar is a task bar, drawn as Chrome's tab groups**: a group per project (its name, color and icon;
    collapsible; + makes a task), a tab per task (the project's icon and color, the task's name, the agent's state).
    A group moves to another window whole (as a project does today), e.g. to keep one client's tasks out of a screen
    share. The Welcome screen: New Project…, Open Folder… (a project with that folder), recent projects.
  - **Sign-in rule, narrowed**: built with step 5 ([profiles.md](profiles.md), "Test users' sign-ins"; CLAUDE.md,
    Rules). Left: "Sign in with Google" on a local app, where the human signs in once to a test Google account in the
    profile's master and the agent goes the whole way itself (account chooser, consent) with no sign-in pause on that
    path, never typing a Google password: the pause part goes into the author's replacement of `signin-pause.js`.
  - **Steps**, each working on its own, with its tests:
    1. Tasks replace workspaces: built 2026-10-10 ([tasks.md](tasks.md)), with Kulisa offering to delete a closed
       task once its PR is merged. Left: a squash merge is not seen as merged.
    2. Projects as composites: built 2026-10-10 ([tasks.md](tasks.md), Projects and Tasks). Left: a task in the
       former folder (no git) is not moved when a repository comes; profiles and agents as catalogs (steps 3, 4).
    3. The agents' catalog with accounts: built 2026-10-10 ([tasks.md](tasks.md), "Choosing the agent"). Left: the
       catalog in ☰ is the Agents window; a CLI's login started from there (today: at the first start in a task).
    4. Profiles: built 2026-10-10 ([profiles.md](profiles.md): the flat store, masters, copies at the first open, a
       profile in several projects, signing in to a master in a window of its own, Refresh from Master…). Left: the
       master's window has one tab shown at a time (a sign-in's popup takes it, the tab before comes back when it
       closes); Refresh brings cookies only (storage: step 6 has the same limit).
    5. Login-password pairs and the narrowed rule: built 2026-10-10 ([profiles.md](profiles.md), "Test users'
       sign-ins"; what is local: `local.js`, as proposed, with the project's own list in Project Settings…).
    6. Cookies of non-local sites kept in step between a master and its copies: built 2026-10-10
       ([profiles.md](profiles.md), "Sign-ins kept in step"). Left: device-bound session cookies (DBSC) to check with
       a real Google account in this Electron; sign-ins in a site's storage (MSAL) not kept in step; Refresh from
       Master… now matters only for a local app's cookies, to keep or drop.
    7. The projects' manager: built 2026-10-10 ([tasks.md](tasks.md), Projects: the Projects button in the title
       bar, every project on the left, one's configuration on the right; a list of agents with a default; + makes a
       task from the configuration, New Task with on its right-click; a new task opens no profile).
  - **Put off**: ongoing tasks ("watch the feedback for a month") with Kulisa kept in the tray (none in GNOME by
    default); rights on profiles, when real accounts come (one flag, "view only": reading allowed, clicks and typing
    refused; today the agent's own modes cover test users).

- **Kulisa plugin: more the agent can do in the browsers** (tools in `mcp-server.js`, each described in the skill;
  what is built: [profiles.md](profiles.md), "What the agent does"). What else an agent needs comes from using it
  (the author moves to working in Kulisa, 2026-10-08): where the agent goes around the tools (its own Playwright
  scripts, `curl`, asking the human to do it) is a tool missing; from every user's computer through "Ideas for
  Kulisa" (below). Thought of, not built: console and requests since the agent's last action only; a button over the
  pane for the human to say they signed in, for sign-ins that keep the address.
- **Screenshots the agent can use** (the author's idea, 2026-10-09; to discuss with the author before building).
  `browser_screenshot` today takes the visible part of a tab, JPEG at the screen's pixel density (`mcp-server.js`).
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
    one: a mobile variant of `mimic-chrome.js`'s identity, put back after the pause where the identity is
    (`Profile.setSigninMode`). During the pause only the desktop identity: a strict sign-in (GoDaddy's Kasada) may
    not take an Android UA from a Linux machine.
  - Kept with the tab across restarts (a field in `Kulisa Tabs.json`). No RAM: no process, no buffers.
  - Next to it, small: `browser_emulate_media` (dark or light, print, reduced motion; Playwright's
    `page.emulateMedia`): the profiles' pages follow the OS's theme, so the agent cannot check the site's other one.
  - Estimate: code +200 (the core ~80, the pane ~60, MCP ~60), tests +90, docs +40.
- **Ideas for Kulisa: what agents could not do, sent to us** (designed with the author 2026-10-08; to build as one
  feature). Agents on users' computers meet what Kulisa cannot do (a tool missing, a tool that does not work); they
  note it, the human sends what they want, without leaving Kulisa. Nothing leaves the computer without the human's
  click: a page could make the agent "report an idea" with the user's data in it (prompt injection), and Kulisa's
  promise is that everything stays on the user's computer.
  - **The agent notes** (`kulisa_idea` in `mcp-server.js`, any agent): `kind` (`missing`: no tool for it; `bug`: a
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
  - **Kept** (`ideas.js` in main: the core; `add` is the agent's only handle, sending and deleting the human's):
    `ideas.json` in the data folder, `[{ id, at, kind, project, agent, need, missing, instead, count }]`, at most 30
    (the oldest go), written whole. A note goes when sent, deleted, or with its project (Remove Project). Listed in
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
  - **Tests** (`test/agent.js`, `test/window.js`): the tool notes, `adds_to` counts, the limit of 30, removing a
    project removes its notes; a foreign proxy client brings the reminder once, the shell's does not; an unexpected
    exception in a tool becomes a `bug` note, an error thrown on purpose does not; the question comes after done, not
    twice for a note, not twice a day, never after Don't ask; the list edits, deletes and sends (to the test's
    receiver), keeps the note when sending fails; the checkbox removes the tool.
  - Docs when built: profiles.md (the tool, the table of actions), tasks.md (`ideas.json`), window.md (☰, the
    bar, the dialog), ui.md (the bar at the bottom, the dot on ☰), the skill, README, LICENSING (a service of
    Kulisa's: its own terms). Estimate: code +350, tests +100, docs +60; the Worker apart.
- **Kulisa plugin: running the app, rest** (designed 2026-10-06 with the tasks; the terminals it runs in built
  2026-10-09: [window.md](window.md), "The terminal"). Any agent is told its task's ports in the MCP server's
  instructions and runs the app with `terminal_run`, where the human sees it.
  - Tried 2026-10-09 with Claude Code 2.1.295 on a small Node project ("run the app and open it in the buyer
    profile"): in a fork (a task now) it read the README and `$KULISA_PORT_OFFSET`, ran `PORT=3100 npm run dev` with
    `terminal_run`, read it and opened 3100 in the profile; in main (the project's folder then) the same on 3000. Without Kulisa's tools (a
    task not loaded) it ran the server in its own background shell. To try: Codex (see "Choosing the agent,
    rest": once there is a Codex account), and a project with docker compose.
  - Possibly tools: the app's address for this task, opening its profiles there once the server answers.
  - Besides the port, worktrees share the local database (migrations of different branches), Redis and queues,
    OAuth redirect URLs registered for one address. Common practice: a database per branch, docker compose per
    worktree (it names containers after the folder already), or one dev server at a time. The developer's matter;
    perhaps recipes in the skill. A project that cannot run twice: one shared dev server, the panes show whose
    branch it is.
- **Other terminals: ▶ after a restart** (the author's idea, 2026-10-09). Today a task's other terminals come
  back after a restart as shells with nothing running (the agent runs its command again). Then: the command they
  ran is kept too, and ▶ in the header runs it again (starting by itself could run what the human did not expect,
  e.g. migrations).
- **Closing and opening the agent's terminal** (the author's idea, 2026-10-09; being discussed, not decided). Today
  the agent's terminal cannot be closed: its menu has Change agent… where the others have Close. The goal is the full
  set of actions: close it when the human wants (more room on the screen, memory, no agent for a while), open an
  agent again when they want (Claude Code, Codex, a plain shell).
  - Processes stay as they are: Kulisa starts the user's shell in a pty and types the agent's command into it
    (`terminal.js`), as a human in GNOME Terminal would, so the project's environment applies (direnv, nvm, mise).
    Closing kills that shell (`p.kill()`) and the agent with it (SIGHUP), and frees its memory (hundreds of MB).
    Opening again starts a new shell and types the agent with `--resume`: the same conversation (`agents.js`: Claude
    `--resume <id>`, Codex `resume <id>|--last`). Starting the agent directly in the pty, without a shell, was
    weighed and left: the project's environment is made by the shell's startup files and cannot be passed in `env`
    without running a shell anyway.
  - Proposed: × or Close ends it (agent.json keeps the agent and its session, and that it is closed: a restart does
    not bring it back); + offers the installed agents and Shell; Ctrl+` opens the task's agent when closed. A new
    task still starts with its agent open.
  - In the code (Claude's recommendation): today the agent's terminal is a thing of its own (`Task.pty`, panel
    id `terminal`, started by `startAgent`, closed only by `changeAgent` or `unload`) and the others another
    (`Task.terminals`, `openTerminal`/`closeTerminal`, `terminals.json`). Make them one list, each terminal
    saying whether Kulisa started an agent in it (`agent: 'claude' | null`): that one gets picks, dictation and the
    hooks' state, and after a restart runs its agent again with resume; a shell comes back empty. Cheaper: give the
    agent's terminal its own close and open and keep the two kinds (about half the code), but everything about
    terminals stays written twice, and "Several agents in one task" (Deferred ideas) would need the merge
    anyway. To change with it: the renderer assumes the panel `terminal` is always there (it anchors new profiles
    and terminals, and the grid adds it back: `lib/grid.ts`, `restoreGrid`, `syncGrid`, `applyPreset`); saved grids name it, so a migration.
  - Open questions for the author, each with Claude's proposal:
    - A second agent in the same task (Codex next to Claude)? Proposed: not yet; + shows the open one.
      Several agents is its own task (Deferred ideas), with each terminal's own hooks state, picks and dictation.
    - Ask before closing? Proposed: only while the agent works (its hooks say so); agents without hooks: never,
      as Ctrl+C in any terminal.
    - Pick and dictation with the agent closed? Proposed: they open the agent and put the reference there.
    - Where + lives once the agent's terminal can be gone (today it is in that terminal's header)? Proposed: the
      title bar, always there. Change agent… then goes: close one, open another.
    - The agent exits by itself (`/exit`, a crash)? Today the shell stays; proposed: still so, and Ctrl+` starts
      the agent again in that shell, with resume.
    - agent.json keeps one session: Claude → Codex → Claude loses Claude's conversation (`startAgent` resumes only
      the same agent). Proposed: the last session of each agent.
  - Cost, roughly: code +200–300 · tests +80 · docs +50.
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
  - Codex (0.160.1, Linux, 2026-10-06): its installer puts it in `~/.local/bin`, as assumed; `codex mcp list` with
    Kulisa's `-c mcp_servers.kulisa.url=…` lists the server, enabled; `codex resume` takes `--last` and `-c`. Not yet
    tried: a whole session driving the profiles. It gets the MCP tools and the MCP server's `instructions` (the
    essentials: profiles, sign-in, `terminal_run`, the task's ports), not the profiles skill: Codex has skills
    and plugins, but none found that a session takes without writing into the user's `~/.codex` (2026-10-09).
  - Codex's hooks (the agent's state, the session to resume, the open profiles at start; tasks.md, "Choosing the
    agent"): built from its documentation (learn.chatgpt.com/docs/hooks) on 2026-10-08, not yet tried in a session:
    no Codex account here then. Checked: Codex 0.160.1 takes the `-c hooks=…` override and checks a handler's fields,
    but not the events' names (a wrong one passes silently). To try, signed in: how Codex asks to trust the hooks and
    that trusting once is enough; that `$KULISA_URL` reaches the hook's command; that `SessionStart`'s answer
    (Claude Code's shape, `hookSpecificOutput.additionalContext`) is taken; each event moving the tab (Esc:
    `Interrupt`); `codex resume <session>`. Windows: the command is sh's (`commandWindows` for PowerShell).
  - **Once there is a Codex account** (the author has none yet, 2026-10-09; it is signed in by the human, `codex
    login`), try in one go, in a task with git and in a project without, as Claude Code was tried ("running the app, rest"):
    1. A session driving the profiles: `browser_profiles`, a snapshot, a click; the sign-in pause.
    2. Running the app: does it read the instructions, move its ports, use `terminal_run` (Codex was expected to
       wait on a server in its own shell) and open the app in a profile.
    3. Its hooks, as in the item above: trusting them, `$KULISA_URL`, `SessionStart`'s answer, the tab's state,
       `codex resume`.
  - More agents (Gemini CLI, …): an entry each in `agents.js`.
  - Windows: the installers run in PowerShell, untested; macOS untested.
  - A hint in an empty grid (no profiles yet): "create the first profile".
- **Tasks, rest** (how they work now, and why: [tasks.md](tasks.md)).
  - Helping the agent run the app ("Kulisa plugin: running the app", above). Today the agent gets
    `KULISA_PORT_OFFSET` and a line about it at session start.
  - The agent's state on the task tab for other agent CLIs: Claude Code's hooks report it, Codex's are built
    and not yet tried ("Choosing the agent, rest"). For CLIs without hooks, e.g. from MCP calls and terminal output (working
    while they come, idle after a quiet while).
  - Tried with Claude Code in forks (as tasks were called); the tests run `cat` as the agent. Still to check in a
    task's copy: the hooks (session, state), `--resume` after a restart, `task_rename` called by Claude Code.
  - Unloading a background task's tabs while its agent is idle: it needs to know the agent is idle (Claude
    Code's hooks tell it; for other CLIs, no MCP calls and no terminal output for a while).
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
  - **Electron hardening:** the shell window runs with `sandbox: false` and a preload that forwards any IPC
    channel; profile pages are sandboxed and have no preload. Check against Electron's security checklist. To
    sandbox the window, its preload must be one file: a sandboxed preload `require`s only `electron`, `events`,
    `timers`, `url` (Electron's `tutorial/sandbox.md`, "Preload scripts"), and ours takes the rule for names from
    `../main/names` and the profiles' pictures from `../main/avatars`; pass that another way (IPC, `additionalArguments`).
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
    has for it first), the project and task tabs, the menus (arrows, Esc), the dialogs. Shortcuts are built
    ([window.md](window.md), Keys: none without a modifier, WCAG 2.1.4); check they do not clash with screen readers.
  - Screen readers: the window read in a sensible order, with names and states (a tab's agent state, the shown
    project). Kulisa's own questions: the profiles' pages are native views of their own (a tree each) next to the
    window's page, and pictures stand in for them under menus and dialogs: how a screen reader moves between them. The
    terminal: xterm's `screenReaderMode` (as VS Code turns on when it detects one).
  - Checking: Chromium's accessibility tree in DevTools (Accessibility pane); automated checks in the tests, e.g.
    axe-core (Deque's, the most used) on the window's page; by hand with Orca (Linux), NVDA (Windows), VoiceOver
    (macOS).
- **Keyboard shortcuts, rest** (built: [window.md](window.md), Keys; the table in `src/main/keys.js`).
  - **A command palette** (Ctrl+Shift+P, as VS Code's; JetBrains' Find Action), where every action is found by its
    name, with its key: the next step. The commands are the keys' table plus the menus' actions: one list of commands
    (an id, a label, `run`) the menus, the keys and the palette use; a dialog of its own (`Modal.vue`).
  - Moving the keyboard between the panels and the tabs of the bar without a mouse (with Accessibility, above).
  - Find in a page (Ctrl+F, as Chrome's: `webContents.findInPage`), a bar of its own over the page.
  - Remapping: the keys in `settings.json` over the table's (VS Code's `keybindings.json`).
  - A closed tab comes back with its address only, not its history (Chrome's keeps it): Electron has no API for that.
- **A desktop app's ways, not only buttons** (talked over with the author 2026-10-08, who liked them all). A web page
  puts a button on every action; a desktop app gives an action several ways in: a visible one for a newcomer, quick
  ones for daily use (keys above, a right-click, dragging). Kulisa has some, here and there (the menus of a project,
  a task's tab and a pane; a middle click closes a project; projects and
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
  - A Vue component as the rest of the window (CLAUDE.md, Window UI). Not Tailwind (styles are tiny) and no ready-made
    component kits (Kulisa needs its own IDE look).
- **Feature 6, profile mail.** A local mail catcher with a mailbox per profile, shown next to the panes and
  readable by the agent.
- **Feature 5, run to test.** Save a multi-profile run as a Playwright test.

## Deferred ideas

- **The agent tests calls and voice: a profile's microphone and what it hears** (the author's idea, 2026-10-08,
  after dictation was tried with a virtual microphone). Calls need several people at once, which is what profiles
  are: the buyer calls, the seller hears; mute silences; the sound comes back after a reconnect; voice messages
  arrive. Tools of the Kulisa plugin (`mcp-server.js`, any agent), e.g. one for what plays into a profile's
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

- **The main process in TypeScript** (the window is, since 2026-10-10: CLAUDE.md, Window UI; the author: the whole
  project moves to it later). Tried and dropped on 2026-10-08: `tsc` checking JavaScript with types in JSDoc, and `.mts`
  files that Node 24 runs with their types stripped (a mix of `.mts`, `.js` and JSDoc was not one way of writing code).
  To decide: built (Vite, as the window, or esbuild) into `dist/`, `node_modules` left out of its bundle (`node-pty` is
  native; `playwright-core` and the MCP SDK read their own files); then Forge's own Vite plugin fits (it packages only
  what Vite built). Check first: the main process built so runs from source and packaged.
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
- **Several agents in one task, working as a team** (discussed 2026-10-06; after tasks, which do not
  depend on it). A task may hold several terminals, each an agent (any CLI, Claude and Codex together; built on
  the task's other terminals, [window.md](window.md), "The terminal"); all
  see the task's code and profiles. Covers a tester next to the developer, a side question (Claude: a forked
  conversation), browser-only research, and parallel agents in a project without git (its tasks share its folder). Cheaper than
  a task: one agent process, no profile copies. Agents
  coordinate through the Kulisa plugin, for any agent:
  - `agents`: who is in the task, their role, what they are doing, which tabs and profiles they use.
  - `agent_message(to, text)`: typed into the other agent's prompt when it waits for input (as a pick), queued
    while it works; for Claude Code possibly through hooks.
  - A task list of the task, seen by the agents (MCP) and the human (a panel).
  - Own tabs: each agent works in tabs it opened (`browser_tab_new`); Kulisa knows whose tab is whose, the pane
    shows which agent acts. A pick goes to the terminal active last.
  - The skill: check who else is here, tell the one waiting when done, report a bug in another's part to its
    author instead of fixing it.

  Open questions:
  - An agent acting in another agent's tab: only a hint ("agent 1's tab"), or refused?
  - Who coordinates: the human (agents equal, roles set by the human, talking directly; proposed to start with),
    a lead agent that splits the task and hands it out (as Claude Code's agent teams), or both.
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
    touches: `app.js` (its IPC, a `voiceModel` option), `tasks.js` (`press`), the renderer's dictation (now
    `Dictation.vue`, rewritten in Vue since: the branch's window part is to be redone), `forge.config.js` (`asar.unpack` for the native module),
    `package.json`, the tests' `run.js` (Chromium's fake microphone). Its own files: `listen.js`,
    `listen-worker.js`, the renderer's `listen.js` and `listen-worklet.js`, `test/unit/listen.test.js`,
    `test/fixtures/hey-kulisa.wav`. The branch's docs say how it works (`docs/window.md`, Voice commands) and what is
    left (its ROADMAP, "Voice commands, rest").
  - **Before it is installed** (the author's idea): the ear stays in the terminal's header; a click opens the store
    at voice commands, with Install. So the core shows suggested extensions where they would be used.
  - **The Kulisa plugin as a built-in extension**, on by default and not to be turned off (the author's idea,
    2026-10-09; to decide when the store is designed). Claude's objection: the Kulisa plugin is the core's second
    handle (the MCP tools call the same `Task` and `Profile` as the window), and the rules on it (the sign-in
    pause, 127.0.0.1 only, `local-only.js`) are the core's; as an extension the API would have to expose nearly the
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
    - Window: places to add to: the terminal's header (after dictation), ☰, a panel in the grid (Stripe); its icons
      added to the sprite; the window's components (`.icon`, `openMenu`, `ask`) rather than its own; its module
      loaded with `import()` when it is turned on. The microphone for the window only for an extension that asked
      for it (today the window's session grants media to all of its own pages).
    - MCP: tools added to every task's server and lines to the skill, behind `local-only.js` as the others.
    - Native modules: N-API only (no rebuild per Electron version); the store downloads the platform's package
      (sherpa-onnx-node's per-platform packages) and keeps it outside the asar.
    - Tests: an extension's unit tests in plain Node, and e2e in the same harness (`run.js`), with switches it needs
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
  (`app.js`) and a translucent background color for those systems (`tokens.css`). Check transparent windows'
  known issues there (resizing, maximizing, the title bar overlay, profile views above the HTML). Faking the blur
  (a picture of the wallpaper, blurred) was rejected: a workaround, and it lags when the window moves.
- **One panel in its own OS window** (e.g. the buyer's profile on a second monitor, the terminal and the other
  profiles staying in the main window). Today only a whole project moves to another window (Move to New Window).
  dockview has popout windows, and a profile's native views can move between windows (`Profile.moveTo`), but a
  window shows one task's grid today: a window holding a part of another window's task is a new model
  (the views' bounds, closing, restoring after a restart). Medium work; to discuss.
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
    them itself (`Kulisa Tabs.json`, `Kulisa Session Cookies.bin` in the profile's folder).
  - Considered and not chosen for now (a workaround, not native): an "Open in Chrome" button that starts Chrome
    (`chrome-launcher`) on its own folder per Kulisa profile and copies cookies and tabs over a short CDP
    connection. Copies only; `localStorage` tokens and Kasada-protected sessions may not carry over.

## Open issues

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
  (`pty.resize` is in a `try` in `src/main/terminal.js`, but the agent's CLI draws garbage at a tiny size). Ways to weigh:
  panes shrink to a `minimumWidth` per panel (dockview) and views too small to use are hidden, or a narrow grid
  turns into tabs.

- **Workarounds of Electron bugs: check at every Electron upgrade** whether they are still needed, and remove them
  when not.
  - Drag regions (`app-region: drag`) of a view's page stay after the page has gone, in a window without a system
    title bar; they took every click over the panes after Teams (window.md, "The title bar"). Workaround:
    `app-region: no-drag` in every profile page (`profiles.js`, `_add`). Electron issue: [electron/electron#54743](https://github.com/electron/electron/issues/54743) (2026-10-08).
    Check: remove the workaround, open Teams (or a page with `app-region: drag`, then another page) in a pane, and
    click the page with a real mouse (`debug-kulisa` skill). Linux only so far; macOS and Windows draw frameless
    windows their own way (see "macOS and Windows are untested").
  - A page's alert and confirm in its pane (profiles.md, "Dialogs"): Electron has no API for them, so Kulisa replaces
    the listener of its internal `-run-dialog` event (`lib/browser/api/web-contents.ts`, Electron 44; `-cancel-dialogs`
    too). Check: that file at the new version's tag; the test of dialogs in `test/agent.js` fails when the event is
    gone (Electron's message box comes back instead of the pane's dialog). Ask Electron for a public event
    (`webContents` 'dialog', as `select-bluetooth-device` takes a callback), then use it.
- **The MCP server and the CDP proxy do not authenticate local processes.** Web pages are refused
  (`local-only.js`: Host and Origin checks), but any local process can drive the signed-in profiles. Needs a
  per-launch token (passed to the agent through the environment, like `KULISA_MCP_URL`) at least.
- **`signin-pause.js` is a temporary implementation** to be replaced by the author. It recognizes sign-in pages
  only by host and pauses the whole profile.
- **macOS and Windows are untested** (only Linux so far; Kulisa targets all three, see SPEC section 4). Known gaps:
  - Drag regions left by a page (Workarounds of Electron bugs, above): seen on Linux; whether macOS and Windows
    have the bug, and whether the workaround is enough there, is not known. Open Teams in a pane and click its page.
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
      `COMSPEC` (untested). SIGINT and SIGTERM work differently there (quit handling in `app.js`). The other
      terminals (`terminal_run`, +) type their command into `COMSPEC` there: untested; PowerShell as above would
      serve them too, and `terminal_stop`'s Ctrl+C in cmd asks "Terminate batch job?".
    - Both: closing a project and opening it again (`claude --resume`) and the project folder dialog
      ("Open Folder…", native) are untested.
  - `safeStorage` (Keychain, DPAPI) for session cookies: expected to work, untested.
  - Dictation (the terminal's microphone): the agent records itself. macOS: the system asks for the microphone for
    Kulisa (`NSMicrophoneUsageDescription` in `forge.config.js`); check that it asks and that `claude`'s `/voice`
    then records, packaged and from `npm start` (the Terminal app's permission may be the one asked then); signed
    with the hardened runtime it also needs the `com.apple.security.device.audio-input` entitlement. Windows: the
    microphone privacy setting for desktop apps.
  - macOS: the window screenshot (`KULISA_SHOT`) needs the screen-recording permission; distribution needs code
    signing and notarization (Apple Developer account). Windows: code signing certificate.
  - The first start: a packaged app opens no project (the Welcome screen), later the projects open last
    (untested packaged).
  - The one-row title bar (`titleBarStyle: 'hidden'` + `titleBarOverlay`, Window Controls Overlay): checked on
    Linux/X11 only. Check the window buttons, dragging and double-click to maximize on macOS (traffic lights on the
    left), Windows and Wayland.
  - Keyboard shortcuts ([window.md](window.md), Keys): checked on Linux only (with Latin and Russian layouts). macOS:
    ⌘ for Kulisa's and Chrome's keys, ⌘⌥1…9 for tasks, ⌘[ / ⌘] back and forward, its own menu bar (Quit, Edit,
    Window) instead of Electron's default; check that a page does not get ⌘-keys before Kulisa (on Linux
    `before-input-event` comes first, and the app menu after the page: REPORT, "Keyboard shortcuts"), and that Ctrl
    stays the terminal's. Windows: Alt+D and F6 to the address bar, Ctrl+F4; the keys with AltGr layouts (Polish,
    German), where AltGr is Ctrl+Alt.
  - Copy and paste in the terminal (`clipboardKey` in `terminal.js`): checked on Linux only. Windows: Ctrl+V pastes
    once, Ctrl+C copies a selection and interrupts without one. macOS: ⌘C / ⌘V through Electron's default app menu
    (Kulisa sets none), and Ctrl+V reaching the agent.
  - Several windows (Move to New Window): a profile's native views moved from one window to another, and a window's
    place restored (`getNormalBounds`, maximized); checked on Linux/X11 only. Dragging a project's label: tested with
    synthetic events only, not yet by hand; a project let go outside the windows is told from a cancelled drag by where the
    pointer is (`screen.getCursorScreenPoint`), which Wayland may not report.
  - The theme (☰ → Theme): the OS buttons' strip recolored (`setTitleBarOverlay`) and System following the OS
    (`nativeTheme.shouldUseDarkColors`, `updated`; on Linux through GTK or the desktop portal): checked on
    Linux/X11 (GNOME) by the tests only, not by changing the OS's setting by hand. macOS draws its own window
    buttons.
  - Tests run often on Linux only; on macOS and Windows before a release (the author's decision, 2026-10-09). CI with
    a matrix (GitHub Actions) would do it. There they run on the human's screen (Xvfb is Linux's), taking its focus.
    The test bench assumes Linux; to adapt on each OS where it can be run (the author's decision, 2026-10-08), known so far:
    - Windows: the agent is `bash -c '… exec cat -v'` with a `bashrc` (`test/run.js`), the fake agent's installer is
      `sh` only (`printf`, `chmod`; the real agents have a `win32` one), the hooks' test runs commands with `bash`
      (`test/agent.js`). A Node script as the agent would run everywhere.
    - macOS: keys are Ctrl's (`ctrl` in `helpers.js`, the zoom tests, `keys` in the terminal's copy and paste test,
      `test/grid.js`), where macOS has ⌘; Ctrl+Shift+V pastes nothing there.
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
  the computer"; to decide for good, the author). Chromium's HTTP cache, Code Cache and GPU caches per profile (on
  the author's main profiles 47 and 78 MB after a few days); Chromium sets the HTTP cache's limit itself from the
  free disk space, and open profiles still grow to it. Several profiles in several projects add up.
  - Alternative: a limit for the whole app, `--disk-cache-size=<bytes>` (`app.commandLine.appendSwitch` before
    ready): every profile's HTTP cache at most that, open ones too; not the code and GPU caches.
  - Or both, or clearing when a task or project is closed as well. Cost of clearing: the first load of a
    reopened profile's sites is slower (no cache), which matters little for profiles set aside.
- **Tests that failed now and then.** Fixed 2026-10-08: pictures of pages for a menu wait 500 ms at most (`window.js`,
  test "a menu opens even when a page gives no picture"); a project's label let go on the side of the screen with
  room. 2026-10-09: the tests run on a screen of their own on Linux (Xvfb, [testing.md](testing.md)), so the human's
  work no longer takes the focus from them (menus closed in the middle of a test, about 1 run in 7); races that a
  slower screen showed (a click while the window still showed another project) are waited for. Watch whether any
  come back. Not looked at: the address bar's click (seen 2026-10-07); the first point-and-tell test once timed out waiting for the pick (2026-10-10, right after the window moved to Vue; not in the runs after). Slow but not flaky: deleting a task (a fork's closing took 11 s,
  git's work), a site that never answers (10 s: two 5 s waits by design).
- **The test "after a restart: a task's other terminal comes back …" takes 5.6 s** (`restart-tasks.js`;
  found 2026-10-09, to come back to). Most of it is showing the project `other` until its task has loaded and
  the terminal's shell runs; it looks like another 5 s wait (as a tab's `ready` held a profile on a refused site:
  `profiles.js`). To find: time the steps of loading `other` after a restart (its profiles' tabs, its terminals).
- **The GPU renderer only on terminals in sight** (discussed with the author 2026-10-09; the author builds it later).
  Today every terminal loads xterm's WebGL addon when made (`makeTerminal` in `src/renderer/lib/terminals.ts`), hidden ones
  too (other tasks and projects, terminals behind another panel): each keeps a WebGL context and its glyph atlas.
  Chromium keeps at most 16 contexts per page; the 17th takes the oldest one's, and that terminal falls back to the DOM
  renderer for good (`onContextLoss`), drawing slower. Nothing breaks: at about 5 projects × 3 tasks it starts.
  - The fix: a terminal gets the WebGL addon when it comes into sight and disposes of it when hidden (`showTerminal`;
    the other terminals' panels: dockview's visibility of a panel), so only the terminals on screen hold a context.
    The buffer (the text, scrollback) is untouched: it is xterm's, not the renderer's. About 15 lines. Test
    (`test/window.js`, next to "GPU renderer"): the shown terminal is `webgl`, a hidden one has none and gets it back
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
    in xterm (the pty in the main process passes bytes on). It would have to live elsewhere anyway (`@xterm/headless`
    per pty: the same memory, plus serializing and writing it again at every switch, losing the scroll position and
    the selection; or the raw output replayed: a log that grows, slow for a long session), and several terminals are
    on screen at once (the other terminals' panels, other windows). VS Code too keeps an xterm per terminal.
- **No performance numbers taken with the monitor on.** CPU, RAM, many profiles; see REPORT, E8.
- **`playwright-core` is pinned to a 1.64 alpha.** Move to the stable release once it ships with the same APIs.
