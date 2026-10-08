# Roadmap

What is planned: ideas and the details of features still to build, deferred ideas, open issues. Feature numbers
refer to [SPEC.md](SPEC.md), section 2. When a feature is built, it is documented in `docs/` (how it works and why:
[profiles.md](profiles.md), [workspaces.md](workspaces.md), [window.md](window.md), [ui.md](ui.md)) and removed from
here; what is left of it stays.

## Next

- **Kulisa plugin: more the agent can do in the browsers** (tools in `mcp-server.js`, each described in the skill;
  what is built: [profiles.md](profiles.md), "What the agent does"). What else an agent needs comes from using it
  (the author moves to working in Kulisa, 2026-10-08): where the agent goes around the tools (its own Playwright
  scripts, `curl`, asking the human to do it) is a tool missing; from every user's computer through "Ideas for
  Kulisa" (below). Thought of, not built: console and requests since the agent's last action only; a button over the
  pane for the human to say they signed in, for sign-ins that keep the address.
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
      `@playwright/mcp`. The next kulisa tool's answer in that workspace gets one line ("a program of yours drove
      profile X directly: if a Kulisa tool was missing, note it with kulisa_idea"), at most once an hour per
      workspace. No note without the agent: only it knows what for.
    - Its own bugs: errors the tools throw on purpose (no such element, a closed profile) are the agent's; an
      unexpected exception inside a tool (`TypeError` …) is Kulisa's, and becomes a `bug` note by itself: the tool,
      the message, the stack without the user's paths.
  - **Kept** (`ideas.js` in main: the core; `add` is the agent's only handle, sending and deleting the human's):
    `ideas.json` in the data folder, `[{ id, at, kind, project, agent, need, missing, instead, count }]`, at most 30
    (the oldest go), written whole. A note goes when sent, deleted, or with its project (Remove Project). Listed in
    "What is on the computer" (workspaces.md), its removal tested.
  - **The human: a question, at most once a day.** Kulisa, not the agent, asks, and its core decides when: only
    after the agent's turn ended (done, from its hooks), never about a note it asked about before, at most once a
    day. A bar at the bottom of the window, not a dialog (nothing covered, gone by itself after a minute): "The agent
    noticed: no tool to read emails. Send · Later · Don't ask". Don't ask turns the questions off for good; notes
    still gather in the list. No system notification: not urgent.
  - **The human: the list**, ☰ → Ideas for Kulisa… (the number of notes in its row, a dot on ☰ while some are
    unseen). A dialog (an ES module loaded when needed, its markup in `index.html`): what Kulisa's developers get
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
  - Docs when built: profiles.md (the tool, the table of actions), workspaces.md (`ideas.json`), window.md (☰, the
    bar, the dialog), ui.md (the bar at the bottom, the dot on ☰), the skill, README, LICENSING (a service of
    Kulisa's: its own terms). Estimate: code +350, tests +100, docs +60; the Worker apart.
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
  - Forks copy main's profiles, sign-ins included; with rotating tokens (Microsoft, Google) a copy may sign the
    other out, an app with one session per user kicks one out, a logout ends both. Not seen yet; if it happens: a
    linked copy, its sign-in cookies kept in sync with main's (Electron's cookie `changed` event; to check: sign-ins
    kept in `localStorage`, as MSAL does).
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
  few: its zoom (Ctrl + / − / 0 outside the pages), F12 and Ctrl+Shift+I (DevTools), copy and paste in the terminal (the OS's own terminal's keys: [window.md](window.md), The terminal).
  - Which actions get one: switching projects and workspaces (Ctrl+Tab, Ctrl+1…9), a new tab, a new profile, the focus
    between the terminal and the panels, Pick, closing.
  - A command palette, where every action is found by its name (VS Code's Ctrl+Shift+P, JetBrains' Find Action):
    every action also reachable without remembering keys.
  - Who gets a key: Kulisa, the page of a profile (the site under test has shortcuts of its own) or the terminal (the
    agent CLI uses Ctrl+C, Ctrl+R and others). A rule for what Kulisa takes everywhere, and what only outside the
    pages and the terminal; the same keys on every OS (Cmd on macOS).
  - A list of the shortcuts (in the palette, the menus' rows already have room for a key: `kbd`); remapping later.
- **A desktop app's ways, not only buttons** (talked over with the author 2026-10-08, who liked them all). A web page
  puts a button on every action; a desktop app gives an action several ways in: a visible one for a newcomer, quick
  ones for daily use (keys above, a right-click, dragging). Kulisa has some, here and there (the menus of a project,
  a workspace's tab and a pane; a middle click closes a project; projects and
  panels are dragged). To build:
  - **The system's notifications: first** (small: Electron's `Notification`, `app.setBadgeCount`, `win.flashFrame`).
    The human is in their browser or IDE while agents work; today only the icon on a workspace's tab says one waits
    or is done, seen only while looking at Kulisa. A notification ("checkout: the agent waits for you"; a click shows
    that workspace), the number of waiting agents on the app's icon in the dock or taskbar, the window flashing there.
  - **Undo rather than "are you sure?"** for what can be undone: closing a profile, a workspace's tab, a project shows
    "Closed · Undo" for a few seconds, and Ctrl+Z brings it back. Deleting (a fork, a profile with its sign-ins) is
    for good and keeps its question.
  - **A right-click menu on every object, as a rule** (a profile's pane, a workspace's tab, a project's island, the
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
  - **Decide first: a UI library.** The window UI is plain HTML/CSS/JS with hand-kept keyed DOM updates (panes,
    tabs, editor rows); layout is dockview's (framework-free). Fine at this size; the timeline and profile mail
    would make that own code grow, and become dockview panels. Candidates: Preact (+ htm) or Lit, both small and
    usable without a heavy build. Not Tailwind (styles are tiny; it needs a build step) and no ready-made
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

- **TypeScript, with esbuild** (2026-10-08, the author's question; put off: plain JavaScript is enough at this size).
  Tried and dropped the same day: `tsc` checking JavaScript with types in JSDoc (`// @ts-check`), and `.mts` files
  that Node 24 (Electron 44) runs as they are, types stripped: it works in the main process, packaged too, but not
  in the window (Chromium runs no TypeScript), and the mix of `.mts`, `.js` and JSDoc was not one way of writing
  code. If types are wanted: TypeScript everywhere, built by esbuild (`dist/`, source maps), the window's scripts
  turned into modules (`import`), `node_modules` left out of the main process's bundle (`node-pty` is native;
  `playwright-core` and the MCP SDK read their own files), `tsc` checking in `npm test`. A build also lets the window
  use npm packages that ship no file for a `<script>` tag (today only dockview's and xterm's, which do), and a UI
  library (Feature 4, timeline). Check first: the main process built so runs from source and packaged.
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
- **Several agents in one workspace, working as a team** (discussed 2026-10-06; after workspaces, which do not
  depend on it). A workspace may hold several terminals, each an agent (any CLI, Claude and Codex together); all
  see the workspace's code and profiles. Covers a tester next to the developer, a side question (Claude: a forked
  conversation), browser-only research, and parallel agents in a project without git (it has no forks). Cheaper than
  a workspace: one agent process, no profile copies. Agents
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
- **One panel in its own OS window** (e.g. the buyer's profile on a second monitor, the terminal and the other
  profiles staying in the main window). Today only a whole project moves to another window (Move to New Window).
  dockview has popout windows, and a profile's native views can move between windows (`Profile.moveTo`), but a
  window shows one workspace's grid today: a window holding a part of another window's workspace is a new model
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
      `COMSPEC` (untested). SIGINT and SIGTERM work differently there (quit handling in `app.js`).
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
  - Tests run only on Linux. Needs CI with a macOS/Windows/Linux matrix (GitHub Actions on the repository). The
    test bench assumes Linux; to adapt on each OS where it can be run (the author's decision, 2026-10-08), known so far:
    - Windows: the agent is `bash -c '… exec cat -v'` with a `bashrc` (`test/run.js`), the fake agent's installer is
      `sh` only (`printf`, `chmod`; the real agents have a `win32` one), the hooks' test runs commands with `bash`
      (`test/agent.js`). A Node script as the agent would run everywhere.
    - macOS: keys are Ctrl's (`ctrl` in `helpers.js`, the zoom tests, `keys` in the terminal's copy and paste test,
      `test/grid.js`), where macOS has ⌘; Ctrl+Shift+V pastes nothing there.
    - What one OS alone has: skipped with the reason, not left to fail.
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
  - The author started over with fresh data on 2026-10-08: watched, not fixed. To look for it (read only): every
    `Profile N` folder of a workspace that its `profiles.json` does not name and `deleted-folders.json` does not list:
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
  - Or both, or clearing when a workspace or project is closed as well. Cost of clearing: the first load of a
    reopened profile's sites is slower (no cache), which matters little for profiles set aside.
- **Tests that failed now and then** (fixed 2026-10-08; watch whether they come back). The menus' tests (context
  menus, DevTools in ⋮, the zoom's) waited for a picture of every page before a menu opened, and a page drawing no
  frame (covered, the monitor off) held that menu and every one after it: pictures now wait 500 ms at most
  (`window.js`, test "a menu opens even when a page gives no picture"). `projects: a tab dragged …` let go off the
  screen when the window manager put the test's window near its right edge; it lets go on the side with room now.
  Not looked at: the address bar's click (seen 2026-10-07). Slow but not flaky: closing a fork (11 s, git's work), a
  site that never answers (10 s: two 5 s waits by design).
- **No performance numbers taken with the monitor on.** CPU, RAM, many profiles; see REPORT, E8.
- **`playwright-core` is pinned to a 1.64 alpha.** Move to the stable release once it ships with the same APIs.
