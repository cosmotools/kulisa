# Roadmap

What is planned and not in a GitHub issue yet: features still to build, deferred ideas, open issues. New ones go to
issues (`enhancement`); an item given an issue leaves here, the issue its one source. Before building something, look
in both. A feature built is documented in its doc ([profiles.md](profiles.md), [tasks.md](tasks.md),
[window.md](window.md), [ui.md](ui.md)) and leaves here; what is left of it stays.

## Next

- **Projects and tasks, rest** (how they work: [tasks.md](tasks.md), [profiles.md](profiles.md)).
  - **Left of the steps:**
    - A repository added to a task ([tasks.md](tasks.md), Tasks), to try in a real task: whether Claude
      Code reads the project's other repositories without asking; `/add-dir` sent in a turn and held while it waits
      for the human (checked with Claude Code alone, not through Kulisa's hooks); Codex given a line in its turn.
    - Sign-ins kept in step, for the author to check with real accounts (Claude cannot): device-bound session
      cookies (DBSC) with a real Google account in this Electron; sign-ins in a site's storage (MSAL) are not kept in
      step.
    - "Sign in with Google" on a local app: the human signs in once to a test Google account in the profile's
      master, and the agent goes the whole way itself (account chooser, consent) with no sign-in pause on that path,
      never typing a Google password. The pause part goes into the author's replacement of `signin-pause.ts`.

- **Phone, tablet and desktop views of a site** (to discuss with the author before building). Responsive layouts are
  checked only by resizing the pane.
  - A device view **per tab**, as Chrome DevTools' device mode, written once in the core (the tab), with both handles:
    the agent's `browser_device` (`phone`, `tablet`, `desktop`, or a width and height) and `device` on
    `browser_tab_new`, so the agent opens a tab of its own as a phone and leaves the human's tab as it was; the
    human's in the pane's ⋮ menu (Device: Desktop, Tablet, Phone), with a mark in the address bar as a site's zoom
    has (a click resets it). Every other tool then works in that view (snapshot, click, type): the agent tests the
    mobile layout, not only looks at it. `browser_screenshot` with `devices: ['phone', 'tablet', 'desktop']` takes
    one picture in each and puts the tab back as it was; the human sees it switch (the caption over the pane says
    why). Not in a hidden tab: one more process, and without the page's state (a form half filled).
  - The size: Electron's own `webContents.enableDeviceEmulation` (`screenPosition: 'mobile'`, `screenSize`,
    `viewSize`, `deviceScaleFactor`, `scale` to fit a desktop's width into a narrow pane; `electron.d.ts`):
    not CDP, so it survives the sign-in pause, which detaches the debugger and with it every CDP override. To try
    first in bare Electron: where it draws a page smaller than its `WebContentsView` (centered, in a corner, what
    around it) and what `scale` does; else CDP's `Emulation.setDeviceMetricsOverride`, put back after the pause.
  - The presets: playwright-core's `devices` (Pixel 7, Galaxy Tab S9, Desktop Chrome), not numbers of our own.
    Android ones: Kulisa is Chromium, so its UA honestly says Chrome; an "iPhone" would be its size only, never
    Safari (WebKit is not in Electron; a separate question).
  - A mobile UA and touch (CDP `Emulation.setUserAgentOverride` with `mobile: true`,
    `Emulation.setTouchEmulationEnabled`), else sites that choose by the UA on the server (`m.site`) send the desktop
    one: an Android variant of the profile's own User-Agent, put back after the pause (`Profile.setSigninMode`); during the pause the desktop one: a strict sign-in
    (GoDaddy's Kasada) may not take an Android UA from a Linux machine. Not Google Chrome's: Google refuses a profile
    presenting as Chrome ([profiles.md](profiles.md), What sites see).
  - Kept with the tab across restarts (a field in `Kulisa Tabs.json`). No RAM: no process, no buffers.
  - Next to it, small: `browser_emulate_media` (dark or light, print, reduced motion; Playwright's
    `page.emulateMedia`): the profiles' pages follow the OS's theme, so the agent cannot check the site's other one.
  - Estimate: code +200 (the core ~80, the pane ~60, MCP ~60), tests +90, docs +40.
- **Sign-in: whoever holds the password signs in** (the best idea so far, not final: to think over again before
  building). The sign-in pause is tied to the page's address (a list of hosts), so the agent cannot test the
  developer's own sign-in, sign-up and password reset through Auth0 and the like: it stops and asks the human every
  time.
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
  - No decision yet; the author wants an elegant, simple rule. Not chosen: pausing when
    the human focuses a secret field (`type=password`, `autocomplete="one-time-code"` …) plus a short list of sites
    that refuse automation and an exception for sign-ins returning to `localhost`: four mechanisms, not one rule.
    Not chosen: "these sites are never the developer's" (Microsoft, Google): it breaks Kulisa for developers at those
    companies testing their own sign-in. Whose account it is cannot be told from the site, only from who types.
  - Open idea, "whoever holds the wheel drives": a key the human presses in a pane takes that profile from the agent
    (clicks and scrolling do not); typing in the terminal, or "Give back to the agent" on the pane, returns it. The
    agent types wherever it holds the password; no host list for the pause. To check: whether GoDaddy's Kasada
    passes when the agent is detached at the first key rather than before the page loads (else the human takes the
    profile first and reloads, as `profile_ask_signin` does); telling the human's keys from the agent's (Electron's
    `before-input-event`, or the proxy knowing its own `Input.*`).
- **Choosing the agent, rest** (how it works: [tasks.md](tasks.md), "Choosing the agent").
  - Codex: untested with the sign-in pause, a project without git (Windows and macOS: #194, #193).
  - More agents (Gemini CLI, …): an entry each in `agents/`.
- **Tasks, rest** (how they work now, and why: [tasks.md](tasks.md)).
  - The agent's state on the task tab for CLIs without hooks (Claude Code's and Codex's report it), e.g. from MCP
    calls and terminal output (working while they come, idle after a quiet while). After a permission answered, both
    show waiting until a tool finishes (no hook says it was answered): a long command run after it shows waiting.
  - Other tools that, like direnv, want a folder allowed before they apply (mise's `trust`): not handled.
  - A task's start point is the remote's default branch: local commits not pushed yet are not in it (as with Claude
    Code's `--worktree`). If that surprises, an option as Claude's `worktree.baseRef: "head"`.
- **Discuss security for the end user** (with the author, before a public release): Kulisa holds signed-in work
  accounts and lets an agent act in them. Each topic to decide or document for users:
  - **What the agent can do in signed-in accounts:** read private data (it saw passwords in a Teams chat), send
    messages, delete things. Kulisa does not restrict the agent (its own permission modes are its maker's): what to
    tell users about it.
  - **Prompt injection from pages:** text on a page the agent reads (snapshots, console messages) can carry
    instructions to the agent.
  - **Local access:** any local process can drive the profiles through the MCP server or the CDP proxy (issue #90,
    a token per task).
  - **Data at rest:** browser profiles in the user-data folder (Chromium's own cookie encryption), saved session
    cookies (`safeStorage`; what if the OS keyring is unavailable).
  - **Electron hardening:** the windows are sandboxed with a preload that forwards any IPC
    channel; profile pages are sandboxed and have no preload. Check against Electron's security checklist.
  - **Distribution:** code signing (Windows a certificate, macOS notarization: #206) and the
    `.deb`'s setuid `chrome-sandbox`.
- **Accessibility** (a11y; before a public release, as security): for people who see poorly, do not use a mouse, or
  use a screen reader, as the big IDEs do; a requirement for software bought by public bodies and large companies
  (Section 508 in the US, EN 301 549 in the EU, both on WCAG). Start from Electron's guide
  (electronjs.org/docs/latest/tutorial/accessibility).
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
- **A desktop app's ways, not only buttons**: an action has a visible way in for a newcomer and quick ones for daily
  use (keys above, a right-click, dragging). To build:
  - **The system's notifications: first** (small: Electron's `Notification`, `app.setBadgeCount`, `win.flashFrame`).
    The human is in their browser or IDE while agents work, and only the icon on a task's tab says one waits or is
    done. A notification ("checkout: the agent waits for you"; a click shows
    that task), the number of waiting agents on the app's icon in the dock or taskbar, the window flashing there.
  - **Undo rather than "are you sure?"** for what can be undone: closing a profile, a task's tab, a project shows
    "Closed · Undo" for a few seconds, and Ctrl+Z brings it back. Deleting (a task, a profile with its sign-ins) is
    for good and keeps its question.
  - **Dragging from the system**: a folder from the file manager onto Kulisa opens it as a project; a link onto a
    profile's pane opens it in a tab there.
- **Timeline.** One feed of DOM (rrweb-like), network, console and agent actions, recorded in step across all profiles;
  scrub back to the moment a bug happened, pick an element in the past, tell the agent to fix it.

## Deferred ideas

- **The agent tests calls and voice: a profile's microphone and what it hears**.
  Calls need several people at once, which is what profiles
  are: the buyer calls, the seller hears; mute silences; the sound comes back after a reconnect; voice messages
  arrive. Tools of the Kulisa plugin (`kulisa-plugin/tools/`, any agent), e.g. one for what plays into a profile's
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

- **Tabs unloaded, rest** (built: [profiles.md](profiles.md), "Tabs unloaded"). A pane whose tab loads
  again is empty meanwhile: a picture of the page taken at the unload could stand there (a JPEG per tab in memory, as
  the pictures under menus); a tab's history (Back, Forward), its scroll position and its forms go with its process, as
  a closed tab's do. Electron can keep them: `navigationHistory.getAllEntries()` gives the entries with their
  `pageState`, and `restore()` takes them (`electron.d.ts`), so the tab could come back as Chrome's
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
