# The window

Window layout, focus, controls, logging and IPC. Project/task lifecycle: [tasks.md](tasks.md); profiles:
[profiles.md](profiles.md); component conventions: [ui.md](ui.md), including [Workbench terminology](ui.md#workbench-terminology).

## Native ownership

A BaseWindow's persistent shell WebContentsView owns bars, navigation, Settings and window-modal dialogs.
[Task view](../src/task-view/README.md#ownership-and-native-lifetime) owns each visited task's retained native group.
The shell normally sits below the selected group in the workspace. Global overlays raise it: native `#00000000` and
transparent HTML reveal the task while intercepting pointer input. [Layers](../src/layers/README.md) coordinates coverage.

`index.html`/`main.tsx` boot the shell; `task.html` loads the task bootstrap. Keep their stores/controllers separate.
The shell receives navigation facts and a selected-task summary; main owns [sender authorization/routing](#ipc),
task navigation keys and file-dialog ownership. Core shutdown callers share one completion promise.

## The title bar

One 44 px row (`TITLE_BAR_HEIGHT`, `TopBar.tsx`): colored project logo, Stage, Settings, ☰ and
OS buttons. `titleBarStyle: hidden`/`titleBarOverlay` keeps native controls with a transparent strip so dialog backdrops
dim it; symbols retain theme colors. Empty space drags; non-100% zoom shows a reset button.
The shell's opaque title background extends under the native controls; only its workspace is transparent.
On Linux the shell view also matches Electron's frame rounding; Windows and macOS keep the window's native clipping.

macOS has left traffic lights and no logo. Zoom repositions buttons with `setWindowButtonPosition`, bounded by the
original native strip's height because buttons below it receive no clicks; high zoom can leave them above center.
Linux cancels `system-context-menu`: GNOME X11 can position it invisibly and retain the desktop input grab.
Windows retains its system menu.

Profile documents receive user-origin `app-region: no-drag !important` on every element. Electron otherwise accepts
page drag regions in frameless windows and retains them across navigation, stealing pane input; `none` does not
clear them. Recheck this workaround on Electron upgrades.

## The tasks' bar

The bar stays below the grid (the author's choice), with sidebar toggle, open-task tabs and +; no bar with no task.
Multiple projects make + ask which one. Closed tasks reopen from the sidebar. Tabs are at least 160 px, keep ×/width
when selected and activate on press. `useStrip` scrolls overflowing tabs; active tabs are raised (the author's choice).

## The grid

The shell reports workspace bounds in CSS pixels; core converts them and sizes retained task groups.
[Task view](../src/task-view/README.md#the-grid) owns grids, placement validity/scaling and local snapshots.
Core supplies profile policy; `ArtifactViewer` owns file access and the window's active native preview.

### Task rendering failures

The shell exposes recovery independently of task JavaScript; lifetime, bounded drain and service limits belong to
[Task view](../src/task-view/README.md#task-rendering-failures).

### Stage terminals

A CLI/TUI pane uses the shared terminal runtime, with task-saved name, optional command and dimensions.
On task load, start fresh shells; saved commands wait for Run app. Runtime shell/app kind is independent of edited
configuration. Header: state, launch/restart/run-again, maximize, menu, close. Settings edits setup; blank size fits.

`StageTerminals` (`main/stage-terminals.ts`) serves window and MCP through a host contract for keys, configuration,
launch context, persistence and notifications. It imports no task/window/store types; `Task` owns wiring and agent
state, the window owns layout/menu/focus.

- `terminal_run` creates/reruns a named command after validation, clearing the old screen. Shell startup applies
  project settings; final output/exit code survive exit. Stop cancels pending restart and retains output;
  Close removes setup/buffers. Task close stops processes but preserves setup.
- Keep launch failures selectable in transient `launchError`; clear on retry, never persist them.
- Human Open/launch requests focus after success, View and font readiness. New input, blur or task switch cancels
  `task-view/renderer/stage-terminal-focus.ts`'s pending request; delayed selection also rechecks intent, window focus and dialogs.
  Agent launch/Follow never steals focus.
- `terminal_read` flushes parsing and reads normal/alternate screen, with scrollback limited to 500 lines. Over
  40,000 characters spills to the caller’s temporary folder with a bounded preview. Fixed sizes: 2–500 columns, 2–200 rows, independent
  of development sizes. Visible Views use WebGL/DOM fallback; hidden sessions retain bounded buffers/processes.
- Shared home, credentials and settings are not identity isolation; real sign-ins remain human.
- Find or Ctrl+Shift+F (⌘ on macOS) opens retained-output search; Enter/Shift+Enter navigate, Esc restores focus.
- Send selection captures xterm text at menu opening; browser selection uses native `selectionText`, excluding
  passwords. `Task.sendSelection` verifies shown-task ownership, strips terminal control codes, labels environment/tab
  and appends through `typeForAgent` without Enter. Require an open agent; never log or save selected text.

| Action | The human | The agent | The core |
|---|---|---|---|
| Open a shell | Stage Terminal; Stage → Open an environment | type a shell command through `terminal_input` in an open terminal; `terminal_run` requires a command | `StageTerminals.open` |
| Save name and command | ⋯ → Settings… | command supplied with each `terminal_run`; the pane name selects the session | `configure` |
| Run or rerun | header launch button; pane menu | `terminal_run` | `run` |
| Resize or fit to pane | ⋯ → Settings…; Fit to pane | `terminal_resize`; optional size on `terminal_run` | `configure` |
| Stop process, keep final screen | ⋯ → Stop | `terminal_stop` | `stop` |
| Inspect screen and status | visible terminal and status | `terminal_read` | `read`, `info` |
| Type, paste, keys | terminal input; right-click Paste | `terminal_input` | terminal Kulisa package's input; `input` |
| Close | ×; pane's menu | `terminal_close` | `close` |

## The window's size

Without a saved position, start at 1280 × 960 DIP, centered in the primary display's work area and reduced to leave
16 DIP on each edge, subject to the zoomed minimum. This fits the full welcome on a large enough display;
smaller windows use its compact introduction. Restore saved sizes/maximization and copy a nearby window's size.

Minimum 640 × 400 DIP times UI zoom (`MIN_SIZE`), independent of pane minimums; narrow-grid adaptation: #202.
OS minimums constrain manual resize only. Clamp restored bounds and growing zoom in `setZoom`; lowering zoom does
not shrink the window automatically.

## Zoom

- **The Kulisa zoom**: Ctrl + / − / 0 outside the pages, or the zoom row in ☰. It scales the whole UI of every window,
  the terminal and the pages together (shell/task UI zoom; `setUiZoom` in `app.ts`). From 50% to
  200%: the window's minimum grows with it, and at 300% it is past a laptop's screen; the OS's own magnification is
  there for more.
- **A site's zoom**: the same keys in a page zoom that site in that profile on top of the Kulisa zoom, as in Chrome, to
  300%; shown beside the tabs (a click resets it).

Both are saved (`settings.json`; the profile's `profiles.json`).

## Theme

☰ → Theme: Dark (default), Light, System; shared/saved across windows. Only UI changes: preserve profile pages'
OS `prefers-color-scheme` by leaving `nativeTheme.themeSource` untouched. System follows `shouldUseDarkColors` and
`updated`. URL/`public/theme.js` apply `.dark` and color-scheme before paint; theme variables supply Dockview and
terminal colors. Main updates native background/button colors.

## Language

☰ → Language selects one saved language for agent speech/answers, English default. Show supported settings in their
native names, system language first. Sync accounts created in Kulisa on change and launch; external connections retain their own language settings.
Adapters own the setting; unsupported agents such as Codex stay unchanged and are named in the tooltip.

Claude reads `settings.json.language` live; it governs speech/answers and can affect comments. Project instructions
must specify code/comment language separately; injected answer instructions cannot override its setting.

## Menus

Kulisa draws its menus in HTML, as Chrome does (shadcn's menus: [Menus](../src/menus/README.md); how they open, close and are
built: [ui.md](ui.md), Menus):

- a task tab's right-click menu ([tasks.md](tasks.md), Projects, "A tab's right-click menu"), a project's and a task's
  row's in the sidebar ([tasks.md](tasks.md), The sidebar), ☰ (as Chrome's ⋮, each row with its icon: the zoom row;
  Theme and Language, rows each opening a menu beside it, the choice at the row's end;
  Keyboard Shortcuts, the links (Documentation, the user guide on kulisa.app; GitHub; one list in `TopBar.tsx`),
  Report a Problem… (Settings at its Log page: not everyone has a GitHub account, and an issue without the log says
  little), About Kulisa (below), and Exit, which quits as the last window's × does; not on macOS, where Cmd+Q and the
  app's menu quit);
- right-click on a pane's header or its ⋯ (New tab, About this profile… (Settings at it), Sign In to Master…, Close
  profile, Remove from Project…), a pane's ⋮ ([profiles.md](profiles.md), Tabs), a tab (Reload, Duplicate, Close tab,
  Close other tabs), a terminal (Copy, Paste, Select all, Clear; then its Side bar item's) and a terminal's Side bar item (Change agent…,
  New Conversation in an agent's; Close).

A row whose command has a key shows it at its end (Keys). The window's menus are not native: a native menu has rows of
text only, no buttons in a row.

**About Kulisa** (a page of Settings, `components/settings/AboutPage.tsx`, under Log, as Chrome's About: one place for what is
about the app; ☰ → About Kulisa opens Settings at it; on macOS also first in the app menu, in place of Electron's own
panel): Kulisa's version (package.json's: from source `app.getVersion()` is Electron's), Electron's and Chromium's (for
a bug report, and What sites see), kulisa.app and the license; then the folders Kulisa writes in on this computer, as
the OS and its variables make them (`about:get`, `ipc/window.ts`): the data folder, the projects' folder
(`KulisaProjects`) and the program's (the checkout; packaged, the `.app`, Squirrel's root), each its path to select and
copy and a button that opens it in the file manager (`about:show-folder`, by the folder's id: the window names no path),
disabled while the folder is not made yet. Only the app knows the exact places (issue #67): the guide points here, and
lists the usual places for whoever reads it after uninstalling.

**The right-click menu in a profile's page** is the one native menu (`page-menu.ts`; Electron's
`tutorial/context-menu.md`): drawn above the pages by the OS, it needs no pictures of them, as a page's menu in Chrome.
Its rows are Chrome's for what is under the pointer (the `context-menu` event's `params`): a link (Open Link in New
Tab, behind, in the same profile; Copy Link Address), an image (Open Image in New Tab, Copy Image), a field (Undo, Redo,
Cut, Copy, Paste, Select All: Electron's roles), a selection (Copy and Send selection to agent; macOS selects the word under a right-click, so a
link's menu has it there, as Chrome's), else the page's (Back, Forward, Reload); then Pick an Element for the Agent and
Screenshot of an Element (they start choosing an element, as their keys do), and Inspect (the element in the tab's
DevTools, `Profile.inspect`). Back, Forward, Reload, Pick and the screenshot are sent to the window as their keys'
commands, so each is done one way. A site with a menu of its own (Teams, Google Docs) cancels the page's
`contextmenu`, and Chromium asks for none. The agent's right-click opens none, so no menu holds the human's pointer
while the agent works: Electron reports the agent's input through Playwright as the human's (`before-mouse-event`), so
its right press is told by the CDP proxy it passes.

## Dialogs and questions

Window-modal dialogs and queued questions live in the shell ([ui.md](ui.md#dialogs)). Core actions use `shell.ask`;
task UI requests use `shell:ask` or `shell:dialog`, routed to their current native owner. Questions include explicit
destructive effects. Raise/restore that window only when another Kulisa window is focused, never over another app.

Shell dialogs take shell focus and cover live task surfaces through [native ownership](#native-ownership).
OS dialogs are reserved for choosing folders; they cannot express Kulisa's deletion details consistently.

## Settings

Settings covers the task area below the title bar, preserving the laid-out grid and running work beneath it.
Each window owns its instance; categories/pages: [tasks.md](tasks.md#projects), [GitHub](../src/github/README.md),
Log and About below. UI ownership, page composition, loading/saving and cross-window updates:
[Settings UI](../src/renderer/components/settings/README.md).

- Open with gear, contextual settings actions or macOS ⌘,; choose the requested entity or current project. Hide gear
  only when there are no projects/accounts/profiles to edit.
- Task changes do not dismiss Settings; questions appear above it. Native-page covering follows
  [the shared layer contract](ui.md#layers-over-the-pages).
- Close with Esc, back arrow or gear; layers/fields consume Esc first. Installation prevents
  closing. Restore prior keyboard focus.

## The terminal

Development terminals share one headerless Dockview panel, selected through Agents in the Side bar. Send task and
active-terminal identity together (`terminals`) to avoid combining asynchronous states.

- Start/rescale only after Dockview and retained DOM dimensions agree, rounding fractional layout sizes.
- Closing the last terminal keeps its panel's size, showing +. With no environments/terminals, show agent/shell
  launchers and closed-profile buttons.
  Launchers are Tab/Enter targets; focus default only if no field/dialog already has it. Ctrl+` opens the task's
  agent or focuses no-default launchers.
- **A terminal row precedes its program.** Send rows before discovery/launch, with Starting overlay at real size;
  cancelling selection removes it. Pick/dictation require a running agent.
- Development shells (`shell_run`) use task folder/environment and start behind the agent. `shell_read` reads
  rendered screen; `shell_stop` interrupts only shells. Task close stops them; reopening resumes agents and fresh
  shells, preserving row order/selection. Close/exit removes a terminal permanently.
- Drops paste shell-quoted paths without Enter. Image paste uses adapter `imagePaste` through `Task.pasteImage`;
  shells/unsupported agents get no image input. Runtime, buffers and keys: [terminal](../src/terminal/README.md).
- Dictation defaults to right Ctrl (right ⌘ on macOS), hold or tap-toggle from anywhere. With a shell active, bring
  `promptTarget` forward first. Keyboard Shortcuts may rebind to a side-specific modifier, unclaimed F key, Insert,
  Pause or Scroll Lock; reject typing keys. Persist/broadcast `settings.json.keys`. Microphone and pill:
  [dictation](../src/dictation/README.md). macOS permission uses `NSMicrophoneUsageDescription`; renderer meter
  reads levels only.
- Ctrl+click/⌘click URLs always asks which open profile/new tab or system browser, avoiding inferred identity.
- File links resolve relative to task/home through `file-links.ts`; batch hover existence checks use quiet
  `terminal:files`. Offer Open/Show in Folder, but executables/scripts/desktop launchers/apps only reveal. Recheck in
  main at opening. Accept `file://` only for local hosts, never remote-machine paths.

## Keys

Kulisa's keyboard shortcuts, as an IDE has them, are one table (`src/main/keys.ts`): the keys, the command each does,
and where; the window's menus, the buttons' tooltips ("Reload (Ctrl+R)", `withKeys`) and **Keyboard Shortcuts** (☰, or
Ctrl+Shift+/: `Shortcuts.tsx`) show them from it, as this OS writes them (⇧⌘T on macOS).

Who gets a key depends on where the keyboard is, and **the keyboard stays where the human put it**: a profile's page
takes it only from the human (a click or a key in it), or from Kulisa for them (a tab chosen by a key, Ctrl+`, their
dialog answered, Pick, an address from its pane's bar). A page taking it by itself, as one loading does (a tab the agent
opened, a redirect: on macOS every one does, and the next keys typed to the agent would go to the site), gives it back
through the [Browser Kulisa package](../src/browser/README.md#focus).

- **In a profile's page, or its pane** (its address bar, its toolbar): Chrome's keys, for that pane: Ctrl+T a new tab
  with the address to type in, Ctrl+W, Ctrl+Shift+T (the tab closed last: its address, kept in memory, ten at most),
  Ctrl+L / Alt+D / F6, Ctrl+R / F5, Ctrl+Shift+R (not from the cache), Alt+← / →, Ctrl+Tab, Ctrl+PgDn / PgUp,
  Ctrl+1…8, Ctrl+9; Ctrl+Shift+C for Pick (Chrome's Inspect), Ctrl+Shift+S for a screenshot of an element
  ([src/screenshots](../src/screenshots/README.md)). The site does not get them, as in Chrome. Closing or switching a
  tab from the page leaves the keyboard in the page shown next.
- **Everywhere, the terminal too**: Ctrl+` to the terminal in front and back to the page used last (with no development
  terminal, a new conversation of the task's agent), Ctrl+Shift+` a new terminal, Ctrl+Shift+1…9 the bar's first to
  ninth tab, Ctrl+Shift+PgDn / PgUp the next or previous one (in the bar's order), Ctrl+Shift+N a new task of the shown
  task's project, Ctrl+Shift+A the sidebar (over the grid, again to close it; docked in the empty window, the keyboard
  to it), Ctrl+Shift+/ the list; the right Ctrl
  (right ⌘ on macOS) held alone, speak to the agent (The terminal, Dictation: the one key the human may change).
  Ctrl+Shift+… and Ctrl+` are what agents and sites leave alone; Alt+letters are Claude Code's (Alt+V, Alt+P, Alt+T),
  Ctrl+Alt+arrows GNOME's, Ctrl+Shift+U and E ibus's, so Kulisa takes none of them.
- **In the terminal** every other key is the agent's (Ctrl+R, Ctrl+T, Ctrl+O …), with the copy and paste of the OS's
  terminal.
- **In a dialog** its keys are its own; only the zoom works there.

The zoom and DevTools keys mean the nearest: in a page that site's zoom and that tab's DevTools, elsewhere Kulisa's. No
key without a modifier but F keys (WCAG 2.1.4); the key held alone is a modifier itself. On macOS the keys are ⌘'s and
Ctrl stays the terminal's; tasks are ⌘⌥1…9 (⌘⇧3, 4, 5 are macOS's screenshots), back and forward ⌘[ and ⌘] as in Chrome.

How: the main process sees every key of the window and of every tab before the page does (`before-input-event`, on
every webContents as it is made: `shortcuts.ts`), and takes one of Kulisa's (`preventDefault`: the page never gets it)
or leaves it untouched. Each UI reports its keyboard zone through `layers/renderer/key-zone.ts` (`keys:zone`: terminal, dialog,
pane or window). Main handles task navigation itself; `lib/shell-keys.ts` handles shell commands and `task-view/renderer/keys.ts`
handles task commands (`command:run`, with task/profile/tab identity). Letters are matched by what they type on a
Latin layout (Ctrl+W on an AZERTY keyboard is its W) and by their place on others (Ctrl+Е on a Russian one is Ctrl+T);
digits and keys typed with Shift by their place. Keys
are written as Electron's accelerators (`CommandOrControl+T`); a key held alone by its code (`ControlRight`, `F9`: `hold`
bindings, matched on the press and the release, a modifier by its side), its repeats while held no presses.

Not Electron's application menu with accelerators: on Linux the page gets a key before the menu, and the menu none that
the page handled itself, as xterm and many web apps do, so Kulisa's keys would not work in the terminal nor in those
apps, and others would act twice. Nor `globalShortcut`: it takes keys from every app on the computer. macOS has its own
menu bar with Settings… (⌘,), Quit Kulisa (⌘Q: Kulisa's quit, asking when an agent works; Electron's role quits at once),
Hide, the Edit menu (⌘C, ⌘V) and the windows (Electron's default one reloads Kulisa's own page with ⌘R); Linux and
Windows windows have no menu.

## DevTools

A pane's ⋮ → DevTools, or F12 or Ctrl+Shift+I in its page, opens the active tab's DevTools in a window of their own.
Kulisa's own DevTools (F12 outside the pages) exist only when running from source (`appDevTools`, off when
`app.isPackaged`).

## The log

`src/main/log.ts` uses electron-log for `logs/kulisa.log`, rotating at 1 MB to `kulisa.old.log` (2 MB total) on every OS.
Console output mirrors it until the first failed write, then disables that transport to avoid recursive exception
logging. Lines carry ISO time with local offset, level and tag:

- `[kulisa]`: the start (the version, Electron's, the OS and its session, X11 or Wayland, packaged or from source, the
  data folder), whether the OS keeps Kulisa's key (`encryption available`, on Linux which keyring; `basic_text` is
  none: a warning), quitting. At a start, that the run before did not say it quit (`quitSaid`, from the file's end): a
  crash of the main process, a kill or the computer going down, which nothing else can write; a crash leaves its
  minidump in `crashDumps` (Electron's crashReporter, `uploadToServer: false`: Crashpad keeps them, pruned by itself,
  90 days or 128 MB; no server), to ask a user for.
- `[ipc]`: every channel a UI sends (`ipc.ts`, `handle` and `on`), the sender's webContents id (`wc=`: shell, task or
  master; `[window] new` and `[task-view] created` identify owners) and its arguments; a refusal, with its reason. Not the
  terminal's keystrokes and size (never: what is typed), nor what comes at every change or draw (`QUIET`: the grid's
  boxes, layouts, lists read again; Settings shown and closed, `[settings]`'s), and a question's answer without the
  answer.
- `[mcp]`: every tool the agent calls (`mcp-server.ts`), its task and terminal, its arguments; one that failed, with
  its error.
- `[key]`: a key of Kulisa's taken (`shortcuts.ts`), where the keyboard was.
- `[editor]`: a project file opened, reloaded, autosaved or closed, a conflict choice or refused save; never its text.
- `[page-menu]`: a row of a page's right-click menu chosen (`page-menu.ts`), its profile and tab.
- `[hook]`: an agent's hook event (`agent-hooks.ts`), its task and terminal.
- `[project]`: a project loaded, its id named by the project's name and folder (the home folder as `~`):
  `[project] k3f9a2 loaded: shop (~/IdeaProjects/shop)`; renamed, by whoever renamed it, only when its name changed (a
  save writes every field): `[project] k3f9a2 renamed: Shop-2`. Its id is random (tasks.md, What is on the computer):
  it comes with the name where it first appears in a run, alone after, the key a line is found by.
- `[task]`, `[window]`, `[settings]`, `[terminal]`: a project's task opened, created (its project's name, where:
  `[task] created k3f9a2/k3x9q2 (shop) in ~/IdeaProjects/shop`), closed, deleted; a window made, showing a task,
  dropped; Settings shown (at what) and closed; a terminal started (the agent and whether its session is resumed, or a
  shell), gone, its exit code.
- `[github]`: a GitHub account, its id with its login beside it (`, token` for a fine-grained token's), at every start
  and as it is added, signed in again, signed out (and why: a refresh refused, its token refused) and deleted; a
  refresh that did not reach GitHub. Never a token, a code or an address with a token
  ([src/github](../src/github/README.md)).
- `[accounts]`: an agent's account, its id named by its agent and its email shortened (three letters of the name, at
  most half of it: a log goes with a bug report; none without an email), at every start and as it is made and deleted:
  `[accounts] k3x9ab (Claude Code, mar…@shop.com)`; a terminal started names it so too. Its id is random, as a
  project's.
- `[page wc=…]`: an error or a warning in one of Kulisa's own pages (its console: an uncaught error is one); never a
  profile's page.
- `[profiles]`: a profile, its id with its name beside it, at every start and as it is made and deleted
  (`[profiles] m2q7xd (ann@shop.com)`), and renamed (`[profiles] m2q7xd renamed: anna@shop.com`). Its id is random, as
  a project's.
- `[profile]`: a profile's page that would not load (`did-fail-load`, the main frame; a white pane is a common report):
  the profile, the address bare, Chromium's error. The one kind of line about a profile's page.
- `[session-cookies]`: a profile's saved session cookies that cannot be read (saved with another keyring key: after a
  restart it comes back signed out), or not saved (the error).
- `[electron]`: Electron's own events, named one by one in `startLog` and written by `electronEvent` (electron-log's
  own line appends the page's address in full): a renderer gone (its page's address, bare: where it crashed is worth
  knowing), a child process (the GPU) gone, a page unresponsive, a preload error. Not its defaults, which listen on
  every webContents, the profiles' pages too, and log their failed loads and certificate errors with the address (every
  cancelled navigation, an OAuth callback's `?code=`), and their console.
- `[warning]`: a process warning (Node's, a deprecation), in place of Node's own line. Not Electron's warning of every
  failed load, which carries the address in full (`[profile]` has it bare).

Never there: what is typed into a terminal or a page, passwords, tokens, cookies, an address's user and query.
`summary` writes an action's arguments in one short line: a value left out by its key (password, secret, token, cookie,
credential; `text` and `values`, what the agent types into a page) or by what the text says of itself (`token=…`,
`Bearer …`), an address without its user and password (`https://…@github.com/…`) and without its query and fragment
(`?…`: an OAuth code, a magic link; the addresses in a refusal's or a failed tool's message too, `bare`), long strings
and the whole cut. A second Kulisa started on the same data writes its start line and "already running" into the same
file: two starts in a row are not a restart. What the code says with `console.*` goes to the file too (`startLog`). A
new action of the core goes through `handle()` or the MCP server's `registerTool`, so it is logged by itself; a line
elsewhere says what happened and who asked, never what was typed.

**The Log page** (Settings → Log, under Profiles; ☰ → Report a Problem… opens it; `components/settings/LogPage.tsx`;
issue #73) is where the human reads it and passes it on, by any means: not everyone has a GitHub account.

- The file whole (1 MB at most), read each time the page is shown and let go when it is left, not as Settings opens
  (`log:get`); then followed (`log:lines`): a hook of electron-log's runs before its file transport, which writes at
  once, so what came since is read from the file at the end of the same tick and sent, a burst of lines as one
  (`readLog` in `log.ts`; the last page that read is the one followed). The file turned over under it (shorter than
  what was read): the page reads it again. Nothing of this is logged: a line of its own would send it again.
  Each snapshot and its updates share a stream identity. The page buffers updates during a read and replays only
  the matching stream, so messages queued by a previous opening cannot duplicate the new snapshot. Rotation bounds
  pending stream data; leaving the page drops it.
- TanStack Virtual draws the visible entries with a buffer; wrapped entries are measured, and the whole log scrolls
  continuously. Filters search the whole log before virtualization. Stable entry ids keep measurements across filters.
- A line each with its time (the date in its tooltip) and its tag, the tag in the color of who acted (the theme's: success the agent, warning the human,
  the text's the tasks), warnings and errors in red; what is not a line of that shape (an object's lines under an
  `[electron]` event) hangs under the line before it. **Follow** keeps the end in view, as a terminal does, lets go when the log is scrolled up, and
  goes back to the end when checked again.
- What to show (a toolbar's radio buttons, one always chosen) and a text filter on top of it (a task's key, `wc=1`, a
  tag): **All**; **Errors** (warn and error lines, `[page]`, `[electron]`, an action refused or failed); **Agent**
  (`[mcp]`, `[hook]`, `[terminal]`); **Human** (`[ipc]`, `[key]`, `[settings]`, `[editor]`); **Tasks** (`[task]`, `[window]`,
  `[kulisa]`). Nothing left says so.
- Under it: the file's size of its 1 MB, when `kulisa.old.log` is from, and what is never in the log.
- **Copy All** (the whole log to the clipboard), **Save As…** (a copy of the file where the human says, their Downloads
  by default; `log:save`), **Open Folder** (the file picked out in the file manager; `log:show-folder`), **Report…**:
  *On GitHub…* opens the user's browser on a new issue from the repository's bug template
  (`.github/ISSUE_TEMPLATE/bug.yml`), its environment filled in (the start line's facts: `environment`, `issueUrl`;
  GitHub takes a form's fields by their id in the query); the template asks for the file and says what is in it and
  that the issue is public. *By email…* comes when there is an address on the kulisa.app domain (the author's personal
  address is not put into released versions). No sending by itself and no crash server: a log without the human's
  words says little; back to it when there are users and a crash the log did not explain.

## IPC

Shell/task pages and the main process talk by named channels: `invoke` (an answer comes back), `send` (none), and the
main process's messages to a page. Each channel is declared once: core channels in `src/shared/ipc.ts`, Kulisa
packages' in their own `ipc.ts`, joined into `Invoke`, `Send` and `Events`. `npm run build` checks both ends against
their arguments and answers. The main process's end goes through
`handle` and `on` (`src/main/ipc.ts`), in a file per domain (`src/main/ipc/`). `AppWindow.send` delivers shell events;
`Task.send` delivers task events. The bridge's types (`env.d.ts`) check renderer calls; task `act` binds the page's
immutable task identity. Main validates the registered sender and current frame, resolves its current window after
moves, and enforces shown-task restrictions where required. Shell navigation may name a tab in its own window.
Declare a new channel before its two ends; open-task changes still run serially (`serial`).

- Name channels `<domain>[:<subdomain>]:<action-or-event>`: a subgroup for related operations (`task:diff:review`,
  `project:profile:add`, `account:signin:cancel`), simple families shallow (`tab:navigate`), compound actions
  hyphenated (`project:folder:set-default`). Keep requests and notifications under the same domain and subgroup,
  with consistent singular/plural choices; name what they do (`task:artifact:refresh` → `task:artifact:state`).
- An answer the page does not read is `void`: the main process may answer anything there (the tests read some).
- An answer that may be a refusal is a `Result` (`src/shared/result.ts`), read with `refused()`, so the types keep a
  page from reading `r.accounts` after a no (`{ error: null }`).
- What crosses comes from the page and is checked again where it matters (a theme, a name); the types say what a
  well-behaved page sends, not what any page may.
- The tests call channels by their names in pages (`invoke` and `act` in `test/e2e/helpers.ts`, through
  `page.evaluate`): those are not checked.

## The code

- `src/main/index.ts`, `app.ts`: environment, Squirrel handling, startup and app services; `shell.ts` defines the
  shared main-process interface. `open-tasks.ts` serializes task/window changes.
- `src/main/window.ts`: native window/shell, workspace bounds, task host adapter, questions and screenshots. `shortcuts.ts`/`keys.ts` own keyboard
  routing/table; `page-menu.ts` owns native page menus; `file-links.ts` protects desktop file opening.
- `src/main/ipc/`, `ipc.ts`, `src/shared/ipc.ts`: handles and shared contracts. `src/preload/index.cjs` exposes the
  sandboxed window bridge without Node; shared helpers/types are imported from `src/shared/`.
- [Task view](../src/task-view/README.md) owns retained screens, grids, native placement and recovery.
  Its [scene registration](../src/task-view/README.md#scene-registration) supplies browser/application-terminal
  presentation to the common Stage host; working agent terminals remain a separate Workbench surface.
  `components/settings/` is lazy-loaded through `index.ts`; UI structure: [ui.md](ui.md).
- Renderer `lib/shell-cover.ts` adapts [Layers](../src/layers/README.md) to shell coverage;
  `lib/shell-keys.ts` executes shell commands. Task adapters belong to Task view; PTY/buffers to [Terminal](../src/terminal/README.md).
- `src/main/log.ts` owns logging, redaction, live reads and issue links; Settings' Log/About pages expose them.
  `files.ts` supplies shared atomic writes.
- Coverage: window/grid/keys/log/zoom-and-closing e2e files; keys/log unit tests.
