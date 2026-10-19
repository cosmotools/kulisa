# Roadmap

What is planned: ideas and the details of features still to build, deferred ideas, open issues. When a feature is built, it is documented in `docs/` (how it works and why:
[profiles.md](profiles.md), [tasks.md](tasks.md), [window.md](window.md), [ui.md](ui.md)) and removed from
here; what is left of it stays.

**Since 2026-10-17 planned features go to GitHub issues** (`enhancement`; the author's decision), and what is here
moves there over time: what has an issue is removed from here, the issue being the one source (CLAUDE.md,
`docs/ROADMAP.md`). Before building something, look in both.

## Next

- **Projects and tasks, rest** (how they work: [tasks.md](tasks.md), [profiles.md](profiles.md)).
  - **Open, for the author to decide:** Refresh from Master… now matters only for a local app's cookies (keep or
    drop); a script the agent runs in a page (`browser_evaluate`) could read a test password back from its field
    (only the skill forbids it: close it or not). For the author's real accounts, not testable by Claude:
    device-bound cookies (DBSC, Google) and MSAL's sign-ins kept in step.
  - **Left of the steps:**
    - Tasks: a squash merge is not seen as merged (Kulisa offers to delete a closed task only once its commits are
      in the remote's default branch).
    - Projects: a task in the former folder (no git) is not moved when a repository comes.
    - A repository added to a task (2026-10-13, [tasks.md](tasks.md), Tasks), to try in a real task: whether Claude
      Code reads the project's other repositories without asking; `/add-dir` sent in a turn and held while it waits
      for the human (checked with 2.1.296 alone, not through Kulisa's hooks); Codex given a line in its turn.
    - Sign-ins kept in step: device-bound session cookies (DBSC) to check with a real Google account in this
      Electron; sign-ins in a site's storage (MSAL) are not kept in step.
    - "Sign in with Google" on a local app: the human signs in once to a test Google account in the profile's
      master, and the agent goes the whole way itself (account chooser, consent) with no sign-in pause on that path,
      never typing a Google password. The pause part goes into the author's replacement of `signin-pause.ts`.
    - Agents' accounts: Codex's is shown by its id: `codex
      login status` does not say the email (it is in `auth.json`'s token, which Kulisa does not read).
  - **Put off**: ongoing tasks ("watch the feedback for a month") with Kulisa kept in the tray (none in GNOME by
    default); rights on profiles, when real accounts come (one flag, "view only": reading allowed, clicks and typing
    refused; today the agent's own modes cover test users).

- **Kulisa plugin: more the agent can do in the browsers** (tools in `mcp-server.ts`, each described in the skill;
  what is built: [profiles.md](profiles.md), "What the agent does"). What else an agent needs comes from using it
  (the author moves to working in Kulisa, 2026-10-08): where the agent goes around the tools (its own Playwright
  scripts, `curl`, asking the human to do it) is a tool missing; from every user's computer through Ideas for
  Kulisa (#84). Thought of, not built: console and requests since the agent's last action only; a button over the
  pane for the human to say they signed in, for sign-ins that keep the address.
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
    one: an Android variant of the profile's own User-Agent, put back after the pause (`Profile.setSigninMode`); during the pause the desktop one: a strict sign-in
    (GoDaddy's Kasada) may not take an Android UA from a Linux machine. Not Google Chrome's: presenting as Chrome got
    a profile refused by Google ([profiles.md](profiles.md), What sites see).
  - Kept with the tab across restarts (a field in `Kulisa Tabs.json`). No RAM: no process, no buffers.
  - Next to it, small: `browser_emulate_media` (dark or light, print, reduced motion; Playwright's
    `page.emulateMedia`): the profiles' pages follow the OS's theme, so the agent cannot check the site's other one.
  - Estimate: code +200 (the core ~80, the pane ~60, MCP ~60), tests +90, docs +40.
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
  - Codex (0.160.1, tried by the author 2026-10-12): not tried the sign-in pause, a project without git, Windows (the
    hooks' command is sh's: `commandWindows` for PowerShell).
  - More agents (Gemini CLI, …): an entry each in `agents/`.
  - Windows: the installers run in PowerShell, untested. macOS: Claude Code's installer untested.
- **Tasks, rest** (how they work now, and why: [tasks.md](tasks.md)).
  - The agent's state on the task tab for CLIs without hooks (Claude Code's and Codex's report it), e.g. from MCP
    calls and terminal output (working while they come, idle after a quiet while). After a permission answered, both
    show waiting until a tool finishes (no hook says it was answered): a long command run after it shows waiting.
  - To check with Claude Code in a task's copy (the tests run `cat` as the agent): the state hooks, `task_rename`
    called by Claude Code.
  - Other tools that, like direnv, want a folder allowed before they apply (mise's `trust`): not handled yet.
  - Windows: copying an open profile (locked files are skipped and logged), removing a deleted task's profile
    folders while their sessions are open (left for the next start): untested there.
  - A task's start point is the remote's default branch: local commits not pushed yet are not in it (as with Claude
    Code's `--worktree`). If that surprises, an option as Claude's `worktree.baseRef: "head"`.
  - The agent making tasks itself (an MCP tool on `Project.createTask`), e.g. to hand parallel parts of a task to
    agents of their own, as Conductor does: a gap in the table of actions ([tasks.md](tasks.md), "Actions"). To
    discuss with Ensemble (#49); deleting stays the human's.
- **Discuss security for the end user** (with the author, before a public release). Kulisa holds signed-in work
  accounts and lets an agent act in them. Topics, each to decide or document for users:
  - **What the agent can do in signed-in accounts:** read private data (it saw passwords in a Teams chat), send
    messages, delete things. Confirmation for risky actions? Per-profile read-only mode?
  - **Prompt injection from pages:** text on a page the agent reads (snapshots, console messages) can carry
    instructions to the agent.
  - **Local access:** any local process can drive the profiles through the MCP server or the CDP proxy (issue #90,
    a token per task).
  - **Data at rest:** browser profiles in the user-data folder (Chromium's own cookie encryption), saved session
    cookies (`safeStorage`; what if the OS keyring is unavailable).
  - **Electron hardening:** the windows are sandboxed (since 2026-10-12) with a preload that forwards any IPC
    channel; profile pages are sandboxed and have no preload. Check against Electron's security checklist.
  - **Distribution:** code signing (Windows a certificate, macOS notarization: "Releases and auto-update") and the
    `.deb`'s setuid `chrome-sandbox`. Built: the update channel ("Releases and auto-update") and each release file's
    signed provenance ([window.md](window.md), "The app icon, installers and updates"; 2026-10-18).
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
  - A closed tab comes back with its address only, not its history (Chrome's keeps it): how it could be kept,
    "Tabs unloaded, rest" (Deferred ideas).
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
  - **Dragging from the system**: a folder from the file manager onto Kulisa opens it as a project; a link onto a
    profile's pane opens it in a tab there.
- **Releases and auto-update, rest** (built: [window.md](window.md), "The app icon, installers and updates").
  - **macOS** only once signed and notarized (Squirrel.Mac does not update an unsigned app): `.dmg` and `.zip`, x64
    and arm64. The author has no Apple Developer account yet: an Individual one ($99 a year), then a Developer ID
    Application certificate (its CSR made with `openssl`, no Mac needed) and an App Store Connect API key for
    notarization, as CI secrets; `osxSign`, `osxNotarize` in `forge.config.ts`, on only when those are set. Not before
    there are users of macOS (the author, 2026-10-16: alone, on their own Macs, an unsigned build does; "macOS and
    Windows are untested", below).
  - **Later, each discussed apart:** a size limit on the release's files in `release.yml`, to tell when the package
    grows again (its size: [window.md](window.md), "The app icon, installers and updates"); a dnf repository for the `.rpm`, as the apt one; "Restart to update" in ☰ once
    Later was chosen (through Kulisa's own quit, asking when an agent works); a switch to turn the checks off; delta updates (Squirrel
    downloads the whole app each time); winget.
- **Timeline.** One feed of DOM (rrweb-like), network, console and agent actions, recorded in step across all profiles;
  scrub back to the moment a bug happened, pick an element in the past, tell the agent to fix it.
- **Profile mail.** A local mail catcher (Mailpit-like) with a mailbox per profile, shown next to the panes and readable
  by the agent.
- **Run to test.** A multi-profile run the agent did by hand, saved as a Playwright test.

## Deferred ideas

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
  - Nearly no RAM (the sound is handled in the tab already open), no new process. First: the permissions (issue
    #109, pages get the microphone and camera without asking), so the agent can test the site's own request too.

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
- **The agent's label in the page, by its outline** (found 2026-10-15 taking the site's pictures; left so, the
  author's decision). `browser_highlight`'s outline is Playwright's `locator.highlight()`, which writes the locator
  next to it (`locator('aria-ref=f2e20')`); its only option is the style (1.64), and the label is in a closed shadow
  root. The agent's label shows over the pane meanwhile. When Playwright lets the text be set, put the label there; not
  an outline of our own.
- **A store of extensions** (the author's idea, 2026-10-06). Installs four kinds of things: agent plugins (Claude Code,
  Codex), MCP servers, skills, and Kulisa extensions: features of the IDE that not everyone needs (a heavy
  dependency, a model to download, a microphone always on, one service's panel), installed, turned off and removed by
  the user. Not a Kulisa package: that is built in ([packages.md](packages.md)). Ideas for extensions:
  - **Voice commands**: "Эй, Кулиса" holds the agent's dictation key, "Кулиса, отправь" is Enter, "Кулиса, стоп" is
    Esc; recognized on the computer (sherpa-onnx's keyword spotter, a 30 MB model, Silero VAD) in a utility process
    alive only while they are on. A working prototype on the branch `worktree-voice-trigger` (tried by the author,
    2026-10-09), its window part to be redone in Vue. Before it is installed, its icon could stay by the dictation's
    microphone, opening the store at it.
  - **Stripe:** a panel with the project's test-mode events and webhooks, test cards in one click; tools for the
    agent to read events and trigger them ("the buyer pays, the seller sees the order").
  - **Feature flags** (LaunchDarkly, Unleash, GrowthBook, PostHog): each profile's flags in a panel, switched per
    profile; a tool for the agent to set them, to check a feature with the flag on and off, per role.
- **A right-click menu in pages** (copy, paste, open a link in a new tab of the profile, Inspect Element). Tried with
  electron-context-menu (a native GTK menu) on 2026-10-05 and removed: on Ubuntu GNOME (X11) a right-click in a page
  froze the whole desktop, twice (gnome-shell logged a menu window at a NaN position holding the pointer and keyboard
  grab), and the menu took the right button from sites with a menu of their own (Teams, Google Docs). The likely cause
  was not the menu: the same freeze came on 2026-10-12 from GNOME's own window menu for a drag region
  ([window.md](window.md), The title bar), and pages' drag regions are forced off since; not checked again. If built
  again: an HTML menu as the window's ([window.md](window.md), Menus: `RightClickMenu.vue`) over a picture of the page,
  shown only where the page did not handle the right-click.
- **Tabs unloaded, rest** (built 2026-10-13: [profiles.md](profiles.md), "Tabs unloaded"). A pane whose tab loads
  again is empty meanwhile: a picture of the page taken at the unload could stand there (a JPEG per tab in memory, as
  the pictures under menus); a tab's history (Back, Forward), its scroll position and its forms go with its process, as
  a closed tab's do. Electron 44 can keep them: `navigationHistory.getAllEntries()` gives the entries with their
  `pageState`, and `restore()` takes them (`electron.d.ts`; checked 2026-10-13), so the tab could come back as Chrome's
  does, with Back and its place in the page. To watch in use: whether 5 minutes is the right time, and a tab loading
  again at a bad moment. The two steps Chrome takes before unloading (throttling, freezing) wait on the tabs sleeping: issue
  #52.
- **A Kulisa profile as a real Chrome profile.** Wanted: the profile's folder in Chrome's own format, so one button
  opens the same profile in the installed Google Chrome with the same tabs and sign-ins, and the storage layout
  is simply Chrome's. Wanted natively, without workarounds, so deferred until there is a clean way. Why it does
  not work as a shared folder today:
  - Cookies are encrypted with different keys: Chrome's "Chrome Safe Storage" vs Electron's "kulisa Safe
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

- **The OS's window buttons are not dimmed under a dialog** (the author, 2026-10-11; put off). They are drawn by the
  OS over the window (`titleBarOverlay`, `window.ts`), so the dialog's backdrop, HTML, cannot cover them: under a
  dialog they stay bright. To look at: dim them with `setTitleBarOverlay` while a dialog is open (Windows and Linux;
  macOS's traffic lights have no such color), or leave them, as many desktop apps do.

- **The grid in a small window** (not decided; the window's own minimum is built: window.md, "The window's size"). When the panes do not fit,
  dockview overflows and cuts them, the profiles' native views get boxes near 0, and the terminal may get 0 columns
  (`pty.resize` is in a `try` in `src/terminal/main/index.ts`, but the agent's CLI draws garbage at a tiny size). Ways to weigh:
  panes shrink to a `minimumWidth` per panel (dockview) and views too small to use are hidden, or a narrow grid
  turns into tabs.

- **Windows is untested; macOS has gaps left** (Linux is where Kulisa is developed; it targets all three: CLAUDE.md,
  Conventions). **The macOS support** in two (the author, 2026-10-16):
  1. **For development**: reached on 2026-10-16 and 17. Kulisa works on a Mac from source and from a build made there,
     unsigned (one's own machines need no Apple Developer account; a build made on the Mac is not quarantined, so
     Gatekeeper lets it run), its tests pass and are a required check of `develop` and `main` since 2026-10-18
     (CLAUDE.md, Releases); what was checked by hand: [testing.md](testing.md), "On macOS". Left, marked macOS below.
  2. **For users**, later, once there are some: signed and notarized, `.dmg` and `.zip`, updates ("Releases and
     auto-update", macOS), with the Apple Developer account. Until then an unsigned build downloaded on another Mac
     is refused by Gatekeeper and does not update, and kulisa.app says "coming soon" for macOS.

  Known gaps:
  - Drag regions left by a page ([testing.md](testing.md), Upgrading Electron) on Windows: open Teams in a pane and
    click its page.
  - Signing in to Google, GoDaddy (Kasada) and Microsoft with the User-Agent without `Electron/<version>` (2026-10-16,
    [profiles.md](profiles.md), What sites see): check on Linux and Windows.
  - The sandbox on Linux, packaged: the `.deb` installs `chrome-sandbox` setuid root; the unpacked `out/` folder needs
    `--no-sandbox` to try it. Other Linux formats (AppImage, rpm, snap) are not set up.
  - Starting the agent (`src/terminal/main/`; on Linux and macOS typed into the user's shell: [tasks.md](tasks.md),
    Projects, "An agent"):
    - Windows: the agent starts directly, without a shell, so no project environment; `claude` from npm is a
      `.cmd` that node-pty may not find. Proposed: type it into PowerShell (`pwsh -NoExit`, falling back to
      `powershell.exe`) in the project's folder, as on the other systems: the PowerShell profile applies, `.cmd`
      resolves, the shell stays after the agent exits. Without an agent command the terminal falls back to
      `COMSPEC` (untested). SIGINT and SIGTERM work differently there (quit handling in `app.ts`). The other
      terminals (`terminal_run`, +) type their command into `COMSPEC` there: untested; PowerShell as above would
      serve them too, and `terminal_stop`'s Ctrl+C in cmd asks "Terminate batch job?". Closing a task and opening it
      again (`claude --resume`) and the project folder dialog (New Project…'s Browse…): untested.
  - `safeStorage` (DPAPI) for session cookies on Windows: untested.
  - Screenshots ([src/screenshots](../src/screenshots/README.md)), tested on Linux (X11) only: the folder of
    screenshots on macOS (the one ⇧⌘5 chose, read by `defaults`) and Windows (`Pictures\Screenshots`); the image on the
    clipboard and the thumbnail's file dragged out on Wayland, macOS and Windows; the thumbnail's view at a Retina
    screen's density; Send to Agent and Ctrl+V of an image in Codex.
  - One xterm a place ([window.md](window.md), The terminal): the RAM it saves where the GPU's memory is the RAM (a
    Mac's, a laptop's integrated GPU): measured on Linux with a GeForce only (the video memory 472 → 178 MB, 20 terminals).
  - Dictation (the right ⌘ held, or the terminals' microphone): the agent records itself. macOS: signed with the
    hardened runtime, the packaged app also needs the `com.apple.security.device.audio-input` entitlement. Windows: the microphone privacy setting for
    desktop apps; the right Ctrl of a keyboard with AltGr (it sends a Ctrl before AltGr on Windows: check that a typed
    AltGr character does not start a recording).
  - A packaged app's later starts and an agent started in a task of it: untested packaged on Linux and Windows. Its
    update check fails while there is no release for its OS ("The server sent an invalid response" on macOS) and is
    only logged.
  - The one-row title bar (`titleBarStyle: 'hidden'` + `titleBarOverlay`, Window Controls Overlay): the window
    buttons, dragging and double-click to maximize on Windows and Wayland (Electron 44 runs natively there by default;
    the author's GNOME is X11: "Ubuntu on Wayland" at the login screen). Ask
    Electron for `setTitleBarOverlay` on macOS: with it the traffic lights would follow any zoom ([window.md](window.md),
    The title bar).
  - Windows at a display scale of 125% or 150%: the profiles' native views placed from the window's CSS boxes
    (`window.ts` scales them): check that no page is a pixel off its pane or leaves a gap at its edge, and that the
    scrollbars follow the dark theme (`color-scheme`).
  - Keyboard shortcuts ([window.md](window.md), Keys) on Windows: Alt+D and F6 to the address bar, Ctrl+F4; the keys
    with AltGr layouts (Polish, German), where AltGr is Ctrl+Alt.
  - The window's menus and dialogs (Reka UI, [ui.md](ui.md), Menus and Dialogs) on Windows, where a right-click menu
    opens on the release: that it opens at the pointer and the release does not choose a row (`MenuButton.vue` takes
    the left button only); press, drag and let go on a row; a window's blur closing a menu. On every OS: Esc in a
    field edited in place (a profile's name) not closing its dialog; Select's list over a dialog.
  - Copy and paste in the terminal (`clipboardKey` in `src/terminal/renderer/`) on Windows: Ctrl+V pastes once, Ctrl+C copies a
    selection and interrupts without one.
  - Several windows (Move to New Window): a profile's native views moved from one window to another, and a window's
    place restored (`getNormalBounds`, maximized); checked on Linux/X11 only. Dragging a task's tab out of its window: tested
    with synthetic events only, not yet by hand; a tab let go outside the windows is told from a cancelled drag by where the
    pointer is (`screen.getCursorScreenPoint`), which Wayland may not report.
  - The theme (☰ → Theme): the OS buttons' strip recolored (`setTitleBarOverlay`) and System following the OS
    (`nativeTheme.shouldUseDarkColors`, `updated`; on Linux through GTK or the desktop portal): on Linux/X11 (GNOME)
    checked by the tests only, not by changing the OS's setting by hand; Windows untested.
  - Tests on Windows ([testing.md](testing.md), CI): its job hangs and is cancelled at its timeout every run
    (2026-10-18; `continue-on-error`, so it marks nothing red); the author adapts Kulisa to Windows next (2026-10-18: a
    day or two).
    The test bench was made on Linux; adapted on each OS where it can be run (the author's decision, 2026-10-08). Known for Windows:
    - Windows: the agent is `bash -c '… exec cat -v'` with a `bashrc` (`test/run.ts`), the fake agent's installer is
      `sh` only (`printf`, `chmod`; the real agents have a `win32` one), the hooks' test runs commands with `bash`
      (`test/agent.ts`). A Node script as the agent would run everywhere.
    - What one OS alone has: skipped with the reason, not left to fail.
- **Profiles' caches** (2026-10-08: a closed profile's caches are cleared, [profiles.md](profiles.md), "What is on
  the computer"; to decide for good, the author; since 2026-10-16 the sites' Cache API too). Chromium's HTTP cache, Code Cache and GPU caches per profile (on
  the author's main profiles 47 and 78 MB after a few days; a task's copy used in Teams 430 MB, half of it the Cache API); Chromium sets the HTTP cache's limit itself from the
  free disk space, and open profiles still grow to it. Several profiles in several projects add up.
  - Alternative: a limit for the whole app, `--disk-cache-size=<bytes>` (`app.commandLine.appendSwitch` before
    ready): every profile's HTTP cache at most that, open ones too; not the code and GPU caches.
  - Or both, or clearing when a task is closed as well. Cost of clearing: the first load of a
    reopened profile's sites is slower (no cache), which matters little for profiles set aside.
