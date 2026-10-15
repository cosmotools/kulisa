# The window

How a Kulisa window works for the human: the title bar, the grid of panels, the tasks' bar, the zoom, the menus
and dialogs, the terminal, the keyboard shortcuts, and why they are built so. Projects and their tasks in the tasks' bar, several
windows: [tasks.md](tasks.md);
profiles' panes and tabs: [profiles.md](profiles.md); the components the window is built of: [ui.md](ui.md); what is
next: [ROADMAP.md](ROADMAP.md). Keep this file current when the window changes.

## The title bar

One row: the app's logo (the shown task's project's color on its curtain), Settings (a window of its own: below), ☰, and the OS's window buttons drawn over its right end (`titleBarStyle: 'hidden'` with
`titleBarOverlay`); no menu bar. Dragging the empty part moves the window. When the Kulisa zoom is not 100%, the bar
shows it (a click resets it).

A right-click on the title bar does nothing on Linux. There Chromium asks the window manager for its window menu, and
GNOME 46 (X11) placed it at a NaN position: invisible, it kept the pointer and keyboard grab, and the whole desktop
stopped taking clicks until the Win key opened the overview (gnome-shell logged an `StDrawingArea` allocated
-2147483648 × -2147483648; 2026-10-12). The window cancels it (`system-context-menu`). Windows keeps its system menu.

Pages never drag the window, as in Chrome. Without a system title bar Electron takes `app-region: drag` from every
view in the window, the profiles' pages too, and keeps a region after its page has gone: Teams
(`teams.cloud.microsoft`, whose code is shared with the Teams desktop app) declares one, and from then on every click
and wheel over the panes, the grid's sashes too, went to dragging the window; mouse moves still passed, so the pages
looked frozen. Maximized, the window cannot be dragged, which made it work now and then (found 2026-10-08; reproduced
in bare Electron 44 with `titleBarStyle: 'hidden'`, not with a system title bar). Every document of a profile gets
`app-region: no-drag` on all elements (`insertCSS`, user origin, `!important` beats the page's), which also replaces a
region left behind. A page can read that value (`getComputedStyle`), where Chrome says `none`; `none` would not
replace a region left by the page before.

## The tasks' bar

Under the grid, in the middle: a tab per open task (its project's icon, its agent's state, its name, ×; a tab of
its own since 2026-10-14, until then a project's tasks in one island under its label: [tasks.md](tasks.md), Projects), then +, a new task of any project or a closed one opened again. ☰ → **Tasks bar: Top, Bottom** puts it in the
title bar instead, after the logo, as a browser's tabs are (the author, 2026-10-14; until then over the grid in a row
of its own, which cost a row; `settings.json`: `bar`; the page gets it in its URL, so it is drawn in its place at once;
`App.vue` puts `TaskBar.vue` in `TopBar.vue`'s slot or under the grid). Bottom is the
default: the hand goes to the terminal under the grid all the time, so the tabs are where it already is; at first
the bar was on top, as a browser's tabs, and the tabs of the grid's panels were right under it in the same
slide, which mixed them up (2026-10-08). The tabs are Firefox's: rounded rectangles on the window's background, the
shown one filled in the panels' color, the others plain, lit under the pointer; a gap between them and the grid, whose
panels sit on the window's background too (the author, 2026-10-14; from 2026-10-08 until then the grid was a dark well
from edge to edge, and each tab an island merging into it with curves). A tab is as big as a browser's (36 px tall,
at least 160 px wide, so its name keeps about ten letters (at 120 px thirty tabs all read "task…"; the author,
2026-10-15: wider, × kept on every tab, as Chrome's), the tabs 8 px apart; in the title bar a tab keeps its 36 px and the title bar its 44, so a tab
sits in the middle with 4 px above and below, the grid right under, as a browser's tabs sit over its content (the
author, 2026-10-14: the grid's own gap under those 4 px added up and showed; a title bar grown to 52 px around the tab
was not wanted, nor a tab as low as the bar's buttons). The window is a grid of rows (App.vue: the title bar, the grid, the bar when it is below) with one
gap, 8 px: the title bar holds it above and below what is in it (`--title` = 8 + 28 + 8, tokens.css; the OS buttons'
strip is as tall, `TITLE_BAR_HEIGHT` in window.ts), so the grid starts at its edge; the grid keeps it from the sides,
the bar from the grid, the window's bottom edge from the last row; nothing else adds to it; the author, 2026-10-14: the bar's own
tabs, a step taller than a button, were out of scale), a target for a quick throw of the mouse; in the title bar the
tabs are not a handle to drag the window by (`app-region: no-drag`). Nothing in the bar moves when another task is
shown.

More tabs than the bar holds scroll, as every strip of tabs does ([ui.md](ui.md), Controls: `.tabstrip`): by a
mouse's wheel, an edge with tabs past it faded, the shown tab in sight (the author, 2026-10-15, found with thirty
tasks: the wheel scrolled nothing, nothing said 17 were out of sight). In the title bar the tabs give way before at least 40 px after + (`--drag`), where the
window is dragged however many tabs there are, as Chrome's space after its +; by the logo too. Chromium takes the tabs
scrolled past the bar's edges as no-drag over both (it does not clip them to the bar, `overflow`, `contain` or
`clip-path` alike) and the page's regions in order, the last one winning: so the logo and that space come after the
bar in the page (TopBar.vue), the logo put back first by `order`.

A press on a tab not shown chooses it at once, as Chrome's, and its task is shown when the button is let go or the
tab starts being dragged, whichever is first (the author, 2026-10-15: such a tab could not be dragged). Showing a task
starts the grid's slide (a view transition), and Chromium drops a drag about to begin when one starts; a drag already
begun goes on through it. So the grid changes on the release, not on the press as in Chrome, which has no slide.

## The grid

A task's profiles' panes and its island of terminals are peer panels in a grid (dockview), in JetBrains' Islands look:
drag one by its header to another place, onto another panel to stack them as tabs, drag the gaps to resize. A
panel stacked behind another hides its page until it is chosen (and after a while unloads it: [profiles.md](profiles.md),
"Tabs unloaded"). **☰ → Arrange panels** offers ready-made
arrangements, each drawn as a small picture of itself, as Windows' snap layouts (the words in its tooltip):
profiles in columns with the terminal below, two by two with the terminal on the right, one profile at a time.
Each fits the window with nothing cut off, the terminal taking a third of it (`TERMINAL_SHARE`, `lib/grid.ts`): the
pages are what is looked at. The first profile opened over the terminal alone keeps that share too (dockview halved
the room, a terminal as tall as the pages and mostly empty; 2026-10-13). The grid is saved per task (`layout.json`) and restored: 300 ms after
its last change, and at once when the task is left (a change just before was lost, and a saved grid naming a profile
deleted since is not restored at all: a profile deleted, then another task shown at once, came back to the default
arrangement; 2026-10-13).
The island is one panel however many terminals it holds ("The terminal").

A window made narrower or wider changes every panel in its share, as VS Code's and JetBrains' do. Until 2026-10-15
the last panel of a row took it all, down to a sliver while the first kept its size, for two reasons:
dockview-vue declares dockview's `proportionalLayout` (on by default) a Boolean prop, which Vue makes false when left
out (`Grid.vue` sets it; dockview issue [1691](https://github.com/dockview/dockview/issues/1691)); and in dockview (8.4, 8.5) a row with a panel below it, built again after the grid was
cleared (an arrangement; a saved grid restored clears it too), keeps no shares. After a change of its panels the grid
takes its shares again on the next frame (`lib/grid.ts`, turning the option off and on), until dockview fixes it
([1692](https://github.com/dockview/dockview/issues/1692)).

A pane's header (its profile's picture, name and ×) shrinks with the pane: a name longer than the pane is wide is cut
with …, the whole of it and the profile's description in its tooltip, and the × stays, as on every tab
(`ProfileHeader.vue`). Until 2026-10-15 the header ran past a narrow pane, the name cut mid-letter, the × out of sight
and dockview's list of hidden tabs (˅ 1) shown for the header alone.

**No profile open, a terminal open**: the profiles' room is folded to a row of tiles over the grid, where the first
one opens (`ClosedProfiles.vue`, `#closedprofiles`; the author, 2026-10-14: until then a profile was opened from the
task tab's right-click menu alone, which no one found). A `.launcher.small` per closed profile, from the left: its
picture over its name, who it is under it; a click opens it, its pane over the terminal, and the row goes. A project
with no profiles has one tile, Add Profile…, its page in Settings. The tiles are outside dockview: the grid's room is
what is left under them (`room()`, `lib/grid.ts`). More than fit scroll, as a strip of tabs does (`.tabstrip`,
[ui.md](ui.md)): by the wheel, the edge with tiles past it faded (2026-10-15: 19 profiles stretched the window's column,
the terminal and the tasks' bar past its edge, the last ones out of reach; `#dock` keeps `min-width: 0` for it). With
no terminal either, they are the second row of the big buttons
("The terminal"). As the folded island, the row is a part of the window, nothing opens by itself: the agent opens a
profile when it needs it (`profile_open`). Not on the task's tab (the author, 2026-10-12: the tasks' bar is no place
for profiles), nor in the terminals' row (it folds with the island). A row of tabs was tried first and turned into
tiles (the author, 2026-10-14).

The window itself never scrolls, also not from a script (`overflow` on `html` and `body`, App.vue): a panel stacked
behind another is kept laid out below the grid (dockview), which made the page taller than the window, and the
tasks' bar bringing its tab into view (`scrollIntoView`) moved the whole grid up by a window's height
(2026-10-09, after an agent's turn ended).

The profiles' pages are native views above the window's HTML (CLAUDE.md, "What must hold in the window"). While a
panel is dragged, a menu is open or a dialog is shown, the pages are pictures of themselves (or hidden), so the
HTML can be on top; they are live again after, once nothing covers them: a task's slide ending under a menu leaves
them pictures until the menu closes (`livePages`; until 2026-10-15 they came back over it). A page that gives no
picture (covered, the monitor off, busy) leaves its pane empty meanwhile: waiting for it held the menu, and every one
after it, and a task's slide after the click (500 ms until 2026-10-15). How long is the pages' own pace, not a fixed
time: once the first has answered, the rest get three times as long, a tenth of a second at least (a live page
answers in a few milliseconds on the author's computer, in over a hundred on GitHub's runner, where a fixed tenth of
a second left every pane empty); none answering, half a second (`AppWindow.pictures`).

A pane's tab strip and toolbar move as Chrome's: a tab opened grows in from the left (`.tab.opening`; the strip keeps
its tabs' elements by id, so only a new one animates), the address's hover fades in. Not with reduced motion.

## The window's size

The window has a minimum, as VS Code's: 640×400 (DIP) times the Kulisa zoom (`MIN_SIZE` in `window.ts`), the
smallest size at which the top bar (the OS buttons, ☰, a project tab) and something under it still fit; half of a
1366 px laptop screen holds it. It is fixed, not derived from the grid as Chrome's is from its own layout: the sum of
the panels' minimums (dockview's `minimumWidth`) would keep a window with five profiles in a row from half a screen
next to the human's IDE, which is what a narrow window is for. What the grid does when its panes do not fit is open
(ROADMAP).

The OS keeps the minimum only while the human drags the window's edge (`minWidth`/`minHeight`, `setMinimumSize`; on
Linux a hint to the window manager). The constructor's bounds and `setSize` pass below it, so Kulisa raises a window
to it itself: bounds restored from `settings.json` when the window is made, and a window now smaller when the zoom
grows (`setZoom`; it is not made smaller again when the zoom goes down).

## Zoom

- **The Kulisa zoom**: Ctrl + / − / 0 outside the pages, or the zoom row in ☰. It scales the whole UI of every
  window, the terminal and the pages together (Chromium's zoom of the window's page; `setUiZoom` in `app.ts`). All
  text and controls take their size from `--font` and `--control` (tokens.css), so one zoom scales them all.
- **A site's zoom**: the same keys in a page zoom that site in that profile on top of the Kulisa zoom, as in
  Chrome; shown in the address bar (a click resets it).

Both are saved (`settings.json`; the profile's `profiles.json`).

## Theme

**☰ → Theme**: Dark (the default, as in JetBrains), Light (JetBrains' Islands Light) or System (as the OS, following it
when it changes, as JetBrains' Sync with OS). Saved (`settings.json`), the same in every window.

- Only Kulisa's own UI changes: the profiles' pages keep the OS's light or dark (`prefers-color-scheme`), as without
  Kulisa, so a site under test looks as its users see it. That is why Kulisa does not set Electron's
  `nativeTheme.themeSource` (it would change every page's scheme too); System reads the OS's from
  `nativeTheme.shouldUseDarkColors` and its `updated` event.
- CSS does it, as the platform has it: each color token is `light-dark(light, dark)` (tokens.css), and the choice is
  `data-theme` on the page's root, which sets `color-scheme`: `dark`, `light`, or `light dark` for System, where the
  page's own `prefers-color-scheme` (the OS's) picks. The browser's own controls (fields, scrollbars) follow. The
  choice comes in the page's URL, set before the first paint, so a light window never flashes dark. dockview's theme
  sets `color-scheme: dark` on the grid; `Grid.vue` gives it back the root's.
- What CSS does not paint follows from the main process: the window's background and the OS buttons' strip
  (`window.ts`).

## Language

**☰ → Language**: the language the human speaks with the agents, one for all of them (the author, 2026-10-13: one
setting, so what the agents do because of it is plain). A row with the language chosen at its end, opening a menu
beside it (Reka's submenu: too many to show in the row, as Theme's are): the languages the agents' own settings take,
the system's first, then by name in each language itself (`LanguageRow.vue`). English by default, as the agents are
without it. Saved (`settings.json`), the same in every window.

- Kulisa gives the agents' own language settings one place and keeps them in step; it tells the agents nothing
  itself (the author, 2026-10-13). An agent with one (its entry's `language`: Claude Code's `language`, which it
  dictates and answers in) gets it in every account's folder: when it is chosen, and at an agent's start (an account
  made since, or the setting changed in the agent's own `/config`), never in the human's own folder. Claude Code
  reads it again at once, in every running session. An agent without one (Codex 0.160.1) is not told otherwise:
  the row's tooltip names it ("has no language setting yet").
- Tried before it was decided (Claude Code 2.1.296, 2026-10-13): an instruction to answer in another language than
  the setting's lost to it, given as Kulisa gives context (the SessionStart hook: 2 runs of 3) and in
  `--append-system-prompt`; a project's CLAUDE.md won. So one setting for dictation and answers, not two. With it
  set to Russian and no rule, Claude Code wrote a file's comments in Russian too: which language code and comments
  are in is the project's to say, in its CLAUDE.md or AGENTS.md, which the tooltip says too.
- The terminal takes the panels' colors (`term.options.theme`, set again on a change); the programs' own colors stay
  xterm's, made readable on either background by its `minimumContrastRatio` (as VS Code does), with no palette of
  Kulisa's own.

## Menus

Kulisa draws its menus in HTML, as Chrome does (Reka UI's menus: `components/menu/`; [ui.md](ui.md), Menus): a
button's opens on the press (press, drag to a row, let go there), a right-click's at the pointer, one at a time; the
pages are pictures of themselves meanwhile; afterwards the keyboard is back where it was:

- the bar's + (every project, a new task of it; their closed tasks; New Project…), a task tab's right-click menu (the shown one's open
  and closed profiles, Manage Profiles…: Settings → Profiles; Rename…, Show Folder, Delete Task…), ☰ (as Chrome's ⋮, each row with its icon: the zoom row, the theme row, the
  tasks' bar's row, Language (a menu beside it), Arrange panels, Keyboard Shortcuts, the links
  (Documentation, the user guide on kulisa.app; GitHub; Report an issue; one list in `lib/common.ts`; until 2026-10-14 also
  Agents…, Settings at its agents: the author, agents are set up in Settings, the gear beside ☰), and Exit, which quits as the last window's × does; not on macOS, where
  Cmd+Q and the app's menu quit; under them all Kulisa's version, small and dim: words, not a row, as nothing happens on a click);
- right-click on a pane's header (New tab, About this profile… (Settings at it), Sign In to Master…, Refresh
  from Master…, Close profile, Remove from Project…), a tab (Reload, Duplicate, Close tab, Close other tabs), a terminal (Copy, Paste, Select all, Clear;
  then what its tab's has) and a terminal's tab (Change agent…, the Change Agent dialog as its icon opens, and New Conversation in an agent's; Close).

A project label's right-click opens its group's menu, as Chrome's tab groups have it ([tasks.md](tasks.md), Projects).

A row whose command has a key shows it at its end (Keys, below).

Native menus were tried first (2026-10-05): rows of text only, no buttons in a row; and a native menu in a page had
frozen the desktop (ROADMAP, Deferred ideas, "A right-click menu in pages"). There is no menu in the pages yet.

## Dialogs and questions

Every dialog has one look, as in JetBrains: the title with × on top, the content, the buttons at the bottom right,
the main one last (blue; red when it deletes) ([ui.md](ui.md), Dialogs). Questions before something that cannot be
undone (deleting a profile, a task, a project), before closing (a task while an agent works, a window,
quitting while an agent works: [tasks.md](tasks.md)) or between two ways to go (a second button, `other`) are asked
in that dialog too (`shell.ask` → `lib/ask.ts`, `Ask.vue`, queued, Cancel focused; Esc is Cancel, a click outside
does nothing: it waits for an answer), in the window the action is in; while Settings is open, in its window (below),
whichever asks: the tasks' windows take no input then. While a dialog is open the profiles' pages are
hidden (they are native views above the HTML), and the keys are the dialog's (Keys). Not the OS's own question (`dialog.showMessageBox`): it looked different on each OS and plain on Linux, and
could not mark the deleting button or lay out what goes. The OS's own dialogs stay for choosing a folder.

## Settings

Settings (a tree of Projects, Agents and Profiles: [tasks.md](tasks.md), Projects) is a window of its own, as a desktop
app's settings are (JetBrains', macOS apps'; the author, 2026-10-16: what users of desktop apps expect, and settings
apart from the work): the OS's title bar ("Settings — Kulisa"), its own size and place, kept (`settings.json`:
`settingsWindow`), at least 640 × 420 times the Kulisa zoom. Open it, set things, close it:

- **One for the whole app.** The gear, a task tab's Manage Profiles… and Project Settings…, a pane's About this
  profile…, a project's Add Profile… tile and New Project's Create open it at that page (a project's: none named, the
  shown task's); open already, it comes to the front at that page.
- **The tasks' windows take no input while it is open** (`setEnabled(false)`), as JetBrains' Settings holds its IDE;
  their profiles' pages and terminals stay on screen and live (as a dialog, it had hidden the pages, and the agent's
  work with them). Every question is asked in its window then (`shell.askWhich`), whichever part of Kulisa asks: one in
  a held window could not be answered. A click on a held window brings Settings back to the front: on Linux (X11) a child
  window is not kept above its parent (no transient hint on Electron's window; seen 2026-10-16).
- **Not Electron's modal window**: on macOS that is a sheet, attached to its parent's title bar, with no title bar
  of its own and not movable ([Electron's docs](https://github.com/electron/electron/blob/v44.5.1/docs/api/browser-window.md#platform-notices));
  GNOME (X11) gave a plain window for it as well (2026-10-16). A child window (`parent`: the window it was opened
  from) with the tasks' windows held is the same on the three OSes.
- **Esc closes it**, as a dialog's: unless a menu, a question or a popover is open (Esc closes that first), or a field
  takes it. Esc and the OS's × alike, its page saves what is typed first (a project's name), then closes it; while an
  agent installs, it stays.
- **Settings only**: a project is made in a tasks' window (New Project…: the bar's +, the empty window), which then
  opens Settings at it (the author, 2026-10-16: one way to open each, not New Project inside Settings too).
- **Shown once its page is filled** (the projects, the profiles, the agents as last found, its fonts: `settings:ready`),
  as Electron's docs advise for a window (`show: false`): shown at once, its tree and page jumped as they came (the
  author, 2026-10-16). A page that never says so is shown after 2 s all the same: the tasks' windows are held meanwhile.
- Its page is the app's third (`settings.html`, `Settings.vue`): nothing of a tasks' window (no grid, no profiles'
  views, no keys of its own). Its process lives while it is open: about 40 MB of its own (PSS; 2026-10-16).
- What it asks the main process about a project or a task goes to its parent (`owner` in `ipc/`): the shown task's
  project, the folder agents are looked for in. A new account's sign-in and an installer answer the page that asked.
- Not tried on Wayland: there an app may not place, move or focus its windows itself (Electron's docs, the same
  Platform notices), so where it opens and bringing it to the front are the compositor's.

## The terminal

A task's terminals are an **island** of the grid, one panel: the terminal in front, a **row of tabs** over it, apart
from it as a browser's tabs (the row in the toolbar's color, the tab in front in the terminal's, as if part of it;
`TerminalTabs.vue`, `Terminals.vue`). One terminal is shown at a time (the author, 2026-10-12: two side by side are
not needed): a terminal is not split off into a panel of its own. Each is the user's shell in the task's folder
(xterm.js in the window, node-pty in the main process: `terminal.ts`), an agent the human chose started in it
([tasks.md](tasks.md), "Several agents in a task") or not. Each tab: the agent's icon (a shell's, for a shell), its
name, its state (an agent's: working, waiting for you, done), ×; each its name whole (not shrunk), more than fit
scroll, as a strip of tabs does (`.tabstrip`, [ui.md](ui.md); 2026-10-15: 36 terminals ran past the island, cut off
there with + and the microphone, dockview's tab growing to its content until `min-width: 0`). After the tabs, the island's own **+**, whatever
tab is in front (a menu of the project's accounts, the default first, each a new conversation; then Terminal, a
shell). At the row's end, in a project of several repositories, the task's copies of them, a `.chip` each (its
name; its folder and branch in its tooltip; `TaskRepos.vue`): which repositories it works in, seen without asking. One
added (Add Repository, or its agent's `task_add_repository`) comes in from the right, lit in the accent color for a
moment (`.fresh`; not with reduced motion), so the human sees it arrive; another task shown is no news. An added one's
right-click menu: Remove Repository (the task's own folder has none). Last in the row, the dictation's microphone
(Dictation, below). The agent's icon opens **Change Agent**, a dialog
(the project's accounts: the one chosen opens in a new tab, told to go on with this conversation; [tasks.md](tasks.md),
"Several agents in a task"). An agent's × asks first; a shell's closes it.

**The last terminal closed folds the island** to a strip of one button, + in its middle (the author's choice,
2026-10-12, as JetBrains' tool windows go but with their button kept in place): by its height under or over the grid,
by its width at a side (dockview's constraints hold it there; the row goes). Alone in the grid (no profile open), the +'s rows are big
buttons in a line in the grid's middle, whatever the arrangement (its group fills the grid there, so it is not drawn;
until then the strip was drawn at the grid's bottom, the room above it empty; the author, 2026-10-12: quick to open an
agent or a shell in an empty task): `.launch`, a `.launcher` each, the agent's icon over its name, an account's email
under it, no keys (Ctrl+` opens the task's agent, which the window does not show: a key on one of them read as a
mistake). Each is a Tab stop, Enter opens it; the first, the project's default agent, gets the keyboard when they come,
unless the keyboard is in something else (a field, a dialog). Under them, a second row: the task's closed profiles,
a `.launcher` each, its picture over its name ("The grid": No profile open). A terminal opened unfolds it to the size it had. Ctrl+` there opens a new conversation of the task's agent; a task with none (its project had no default agent:
[tasks.md](tasks.md), "Choosing the agent") gives the keyboard to the buttons, or opens the +. A task that never had a
terminal opens its agent, or nothing (the buttons).

**A tab comes before its program.** An agent's tab is there at once, before its program is looked for (the user's
login shell, its `--version`: a second or so): until it starts, `.starting` over its terminal, the agent's working
`.state` and "Starting Claude Code…" (`starting` in `Sent.Terminals`, the tab without its `pty`). Its terminal stays laid
out under it: the program starts at its size. Not found and none chosen in its place (Choose the Agent, Cancel), the
tab goes. A task opening sends its tabs with its first state, each starting (`Window.showLoaded`, then
`Task.loadTerminals`): until 2026-10-15 the window got none until each agent was found, and showed the folded island's
buttons for that second. A pick or a dictation meanwhile goes nowhere: the human gives it again.

Unicode 11 widths (the cursor stays put after an emoji), a bundled font, the GPU renderer. Copy and paste take the
keys of the OS's own terminal, so hands need nothing new: Ctrl+Shift+C / V (GNOME Terminal, Konsole); on Windows also
Ctrl+V, and Ctrl+C copies a selection, else interrupts (Windows Terminal); on macOS ⌘C / ⌘V (the app menu's). xterm
leaves those keys to the app, as VS Code sets its own; otherwise Ctrl+C and Ctrl+V go to the agent (Claude Code
pastes an image with Ctrl+V, with Alt+V on Windows). The paste itself is Chromium's, which xterm takes (pasting again
from Kulisa had doubled it). With nothing selected in xterm, copying keeps the clipboard: Claude Code's fullscreen
rendering selects with its own mouse and copies on release itself (code.claude.com/docs/en/fullscreen; an empty copy
had wiped it); Shift held while dragging selects in xterm instead.

**Shells**: the human's (+ → Terminal, `Terminal`, `Terminal 2` …) and what an agent keeps running for the human to
see (`terminal_run`: the app's dev server, `docker compose up`), behind the tab in front so the human goes on
watching the agent. Each is the user's shell in the task's folder with the agent's environment
(`KULISA_PORT_OFFSET`), the command typed in, so the human can stop it, type into it and read it as in their own
terminal; an agent reads its last lines as the screen shows them (`terminal_read`, colors left out) and presses Ctrl+C (`terminal_stop`), in
shells only, never another agent's tab. Why not the agent's own background shell: some agents cannot keep a process
running (Codex waits on it), and the human does not see what runs there. The task closing ends what runs in it. As
in an IDE, the terminals are kept (`terminals.json`): when the task loads again (a restart, its task opened again)
each comes back in its tab, the one in front too, an agent's conversation resumed, a shell with nothing running; the
agent runs its command again. ×, the menu's Close, `terminal_stop` with close, or the shell's `exit` ends one for good
(`Task.openTerminal`, `openAgent`, `runInTerminal`, `interruptTerminal`, `readTerminal`, `closeTab`). The main process
keeps each shell's screen for the agent, in memory: a terminal without a window (`@xterm/headless`, xterm's own
parser), its last 500 lines, so what a program redraws in place (a progress, a container's state) is read as it
became, not as every frame it went through (the output with its codes left out, until 2026-10-12). About 1 MB a shell
at 200 columns; an agent's terminal keeps none (`terminal_read` does not read it).

**Dictation**, where the agent in front has its own ([tasks.md](tasks.md), "Choosing the agent"), is a key held:
the **right Ctrl** (the right ⌘ on macOS: Apple keyboards have no right Ctrl), anywhere in the window: in a profile's
page, its address bar, the terminal, the bar. Held, the agent records until it is let go; pressed once, it records
until the next press (or 5 minutes, a recording left on; another tab brought to the front, or the window losing the
keyboard with the key down, stops it too). Why a key and not a button (the author, 2026-10-13): speaking to the agent
happens hundreds of times a day, and nobody aims at a button that often; why one key held alone and no chord: users
are not pianists; why that one: a modifier alone types nothing and does nothing in any page or terminal, so it is
taken from no one and left to the page (its chords still work), and it sits at the right hand's edge, where
push-to-talk keys go; the space bar, Claude Code's own key, is the page's in a page. The human may hold another key
instead: Keyboard Shortcuts, Change on its row, then the key pressed (a modifier by its side, an F key not Kulisa's,
Insert, Pause or Scroll Lock; a key that types is refused, saying so); kept in `settings.json` (`keys`), every
window told (`keys:set`, `shell.keys()`; `Shortcuts.vue`). With a shell in front, the key brings the agent the prompt
goes to in front first (`Task.holdKey`, `promptTarget`), so it always means "speak to the agent".

The key's indicator, and the way by the mouse, is the round microphone at the end of the terminals' row of tabs
(`Dictation.vue`, after the task's repositories): its tooltip names the key and the language it hears (Language,
above); while the agent records it is red and breathes with a ring (`mic-breathe`; not with reduced motion), so the
eye catches from across the window that the agent is listening. It works as a voice message's button too: held, or
a click to start and another to stop. With a shell in front, or an agent without dictation, it is disabled, its
tooltip saying why (a button that came and went would move the row). The text goes where the cursor is in the agent's
input, after what is there, so several sentences can be dictated one after another, and is left there to read and
send (recognition makes mistakes, and a task misheard costs more than a key). Kulisa only holds the agent's key
(`Task.dictate`); the agent records and recognizes. The agent hears through its own program (Claude Code: its audio
module, or `arecord`/SoX on Linux); on macOS the system asks for the microphone on Kulisa's behalf
(`NSMicrophoneUsageDescription`, `forge.config.ts`). The voice bar, an island of its own under the terminals with
the microphone in its middle (2026-10-13, for a day): a whole row for one button.

Links in the terminal, those an agent marks (OSC 8, as Claude Code does) and addresses in plain text (xterm's web-links
addon), open with Ctrl+click (⌘ on macOS), and always ask where, in a menu at the pointer: a new tab in one of the
shown task's open profiles, or the user's browser. Asked every time, so a link never lands somewhere the human
did not expect (the author's choice, 2026-10-08: which profile a link belongs to cannot be told, and a rule such as
"where that site is open" was not obvious). Only `http` and `https`; the address shows on hover. xterm's own handler
asked with the browser's `confirm()`, an OS dialog. Keys are known by `keyCode` too, as ibus with a Cyrillic layout leaves
`code` out. An agent starts once the island is laid out, at its real
size (a terminal behind another tab takes the island's), however long that takes: until 2026-10-15 it started at a
default size after 5 s, which GitHub's runner reached. The rows that fit sit in the middle of the panel, what is left under a whole row shared above and below them:
at the bottom, it was a row's height under the agent's status line in one task and nothing in another, whose
grids differed by a pixel (2026-10-08). When a task moves to another window, what its terminals show moves along (xterm's serialize addon, as VS
Code keeps terminals), at the same size.

## Keys

Kulisa's keyboard shortcuts, as an IDE has them, one table for all (`src/main/keys.ts`): the keys, the command each
does, and where; the window's menus, the buttons' tooltips ("Reload (Ctrl+R)", `withKeys`) and
**Keyboard Shortcuts** (☰, or Ctrl+Shift+/: `Shortcuts.vue`) show them from it, as this OS writes them (⇧⌘T on macOS),
so they are never out of date.

Who gets a key depends on where the keyboard is:

- **In a profile's page, or its pane** (its address bar, its toolbar): Chrome's keys, for that pane, as the hands know
  them: Ctrl+T a new tab with the address to type in, Ctrl+W, Ctrl+Shift+T (the tab closed last: its address, kept in
  memory, ten at most), Ctrl+L / Alt+D / F6, Ctrl+R / F5, Ctrl+Shift+R (not from the cache), Alt+← / →, Ctrl+Tab,
  Ctrl+PgDn / PgUp, Ctrl+1…8, Ctrl+9; and Ctrl+Shift+C for Pick (Chrome's Inspect). The site does not get them, as in
  Chrome. Closing or switching a tab from the page leaves the keyboard in the page shown next.
- **Everywhere, the terminal too**: Ctrl+` to the terminal in front and back to the page used last (on the folded
  island, a new conversation of the task's agent), Ctrl+Shift+` a new terminal, Ctrl+Shift+1…9 the bar's first to ninth tab, Ctrl+Shift+PgDn / PgUp the next or previous
  one (in the bar's order), Ctrl+Shift+N a new task of the shown task's project, Ctrl+Shift+A the bar's + (a task of which project),
  Ctrl+Shift+/ the list; the right Ctrl (right ⌘ on macOS) held alone, speak to the agent (The terminal, Dictation:
  the one key the human may change, in the list). Ctrl+Shift+… and Ctrl+` are
  what agents and sites leave alone; Alt+letters are Claude Code's (Alt+V, Alt+P, Alt+T), Ctrl+Alt+arrows GNOME's,
  Ctrl+Shift+U and E ibus's, so Kulisa takes none of them.
- **In the terminal** every other key is the agent's (Ctrl+R, Ctrl+T, Ctrl+O …), with the copy and paste of the OS's
  terminal (The terminal, above).
- **In a dialog** its keys are its own; only the zoom works there.

The zoom and DevTools keys mean the nearest: in a page that site's zoom and that tab's DevTools, elsewhere Kulisa's.
No key without a modifier but F keys (WCAG 2.1.4); the key held alone is a modifier itself. On macOS the keys are ⌘'s and Ctrl stays the terminal's;
tasks are ⌘⌥1…9 (⌘⇧3, 4, 5 are macOS's screenshots), back and forward ⌘[ and ⌘] as in Chrome.

How: the main process sees every key of the window and of every tab before the page does (`before-input-event`, on
every webContents as it is made: `shortcuts.ts`), and takes one of Kulisa's (`preventDefault`: the page never gets it) or
leaves it, untouched. Where the keyboard is in the window's own page, the page tells it (`keys:zone`: the terminal, a
dialog, a pane; `src/renderer/lib/keys.ts`), which also runs the commands the main process sends back (`command`, with
the profile and tab). Letters are matched by what they type on a Latin layout (Ctrl+W on an AZERTY keyboard is its W)
and by their place on others (Ctrl+Е on a Russian one is Ctrl+T); digits and keys typed with Shift by their place. Keys
are written as Electron's accelerators (`CommandOrControl+T`); a key held alone by its code (`ControlRight`, `F9`:
`hold` bindings, matched on the press and the release, a modifier by its side), its repeats while held no presses.

Not Electron's application menu with accelerators, its own way of keys, tried first in bare Electron 44 (2026-10-09): on Linux the page gets a key before the menu, and the menu none that the page handled itself,
as xterm and many web apps do: Kulisa's keys would not work in the terminal nor in those apps, and others would act
twice (the site's and Kulisa's). Nor `globalShortcut`: it takes keys from every app on the computer. macOS has its own
menu bar with Quit, Hide, the Edit menu (⌘C, ⌘V) and the windows (Electron's default one reloaded Kulisa's own page with
⌘R); Linux and Windows windows have no menu.

## DevTools

A pane's ⋮ menu (where more of a pane's actions will go, as in Chrome), or F12 or Ctrl+Shift+I in its page, opens
the active tab's DevTools in a window of their own. Kulisa's own DevTools (F12 outside the pages) exist only when
running from source (`appDevTools`, off when `app.isPackaged`).

## IPC

A window's page and the main process talk by named channels: `invoke` (an answer comes back), `send` (none), and the
main process's messages to a page. Each channel is declared once, in `src/shared/ipc.ts`: what it takes and what it
answers (`Invoke`, `Send`, `Events`); `npm run build` checks both ends against it. The main process's end goes through
`handle` and `on` (`src/main/ipc.ts`), in a file a domain (`src/main/ipc/`), and `AppWindow.send`; the page's through the bridge's types (`env.d.ts`) and
`act`, which adds the task shown (a message about the shown task's profiles and tabs is refused once another is shown).
A new channel is declared there first, then its two ends.

- An answer the page does not read is `void`: the main process may answer anything there (the tests read some).
- An answer that may be a refusal is a `Result` (`src/shared/result.ts`), read with `refused()`: a page that read
  `r.accounts` after a no (`{ error: null }`) threw, unseen, until the types said so (2026-10-15).
- What crosses comes from the page and is checked again where it matters (a theme, a name); the types say what a
  well-behaved page sends, not what any page may.
- The tests call channels by their names in pages (`kulisa.invoke('…')`, in `executeJavaScript`): those are not checked.

## The app icon, installers and updates

The icon is a stage curtain drawn apart with the agent's pointer (`assets/icon.svg`, rendered for each OS by `npm run
icons`): in the title bar, the taskbar and the installers. Run from source, GNOME's dock shows a generic icon: it
takes icons from installed `.desktop` files only (the `.deb` installs one matching the window class `kulisa`); left
so on purpose.

Installers are made with Electron Forge (`npm run make`, `forge.config.ts`), each on its own OS: `.deb` and `.rpm` on
Linux (the `.deb` checked: it installs `chrome-sandbox` setuid root, a menu entry and the icon, and the app starts),
Squirrel `.exe` on Windows, `.dmg` and `.zip` on macOS (signed and notarized when the Apple secrets are set). `npm run
publish` makes them and uploads them to a **draft release** on GitHub (`@electron-forge/publisher-github`). A merge
into `main` (a pull request from `develop`, its version raised: CLAUDE.md, Releases) releases them by itself, on GitHub
Actions (`.github/workflows/release.yml`; macOS once its secrets are set): the workflow first makes the draft
`v<version>` at the merged commit, its notes the pull request's text (Forge's own would name no commit, and GitHub
would tag whatever `main` is when the draft is published); Ubuntu and Windows build and Forge uploads into it, finding
it by its name; the `.deb` is installed on Ubuntu and started under Xvfb (its MCP server listening, nothing uncaught,
still running after 5 s: the tests run Kulisa from source, and what breaks only packaged would reach every installed
copy, one failing at start never able to update again); then the draft is published, the tag made at that commit.
Until then, and when a step fails, it is a draft nobody is served. A version released before stops it. Once
published, kulisa.app is built again (`kulisa-site`'s deploy, run with the secret `SITE_DEPLOY_TOKEN`): its
download buttons lead to this release's files. Releases are built and the updates checked as ROADMAP's "Releases and auto-update" plans them; what is
left is there too.

**Updates**, Forge's way (`updates.ts`, called by `index.ts`): Electron's `autoUpdater` (Squirrel) through the
Electron team's `update-electron-app`, from update.electronjs.org, which serves a public repository's published
GitHub releases. A packaged Kulisa on Windows or macOS checks at start and every 6 hours (its 10 minutes by default:
Kulisa stays open for days), downloads a newer release in the background, and starts it the next time it is started.
It never restarts by itself nor asks with the OS's dialog (the module's, off: `notifyUser: false`): Kulisa asks in its
own (Dialogs and questions), and that dialog's Restart (`quitAndInstall`) closes the windows before `before-quit`,
where session cookies and tabs are saved. Not from source (`app.isPackaged`), nor on Linux, where Electron has no
updater: a `.deb` or an `.rpm` is installed again by hand, or by the distribution's package manager once there is a
repository (ROADMAP). Each format updates its own way only, never one put over another. A check sends
update.electronjs.org the version, the OS and the IP; the download comes from GitHub.

On Windows, Squirrel starts the app while installing, updating and removing it (`--squirrel-install` …), to make or
remove its shortcuts: `electron-squirrel-startup` does that and Kulisa quits without starting (Forge's Squirrel.Windows
maker). Its first run after installing checks nothing (Squirrel holds a lock then), and the app's id is the one its
shortcuts carry (`com.squirrel.kulisa.kulisa`), or Windows would not pin it to the taskbar (Electron's
`api/auto-updater.md`).

## The code

| File | What |
|---|---|
| `src/main/app.ts` | the app put together: the shell, the Kulisa zoom, the theme, the language, the agents; start and quit |
| `src/main/open-tasks.ts` | the windows' open tasks: open, show, create, move, close, delete (one change after another, `serial`) |
| `src/main/ipc/*.ts` | the windows' handles, a file a domain: `tasks`, `projects`, `profiles` (Settings → Profiles), `agents`, `panes` (the shown task's profiles, tabs, terminals), `window` (its zoom, theme, bar, language) |
| `src/main/shortcuts.ts` | the keys as they are typed (Keys), the hold keys changed |
| `src/shared/ipc.ts`, `src/main/ipc.ts` | the channels between a page and the main process; `handle` and `on`, checked against them (IPC) |
| `src/main/window.ts` | a window: its BrowserWindow, the native views' places, its questions, screenshot |
| `src/main/settings-window.ts`, `src/renderer/settings.html`, `components/Settings.vue` | Settings' window (Settings); its page is `ProjectEditor.vue` |
| `src/preload/index.cjs` | the window's bridge to the main process: the windows' pages are sandboxed (no Node: about 15 MB less a window, PSS; 2026-10-12), so it is a few lines of plain JavaScript; the window imports what it shares with the main process from `src/shared/` (`names.ts`, `avatars.ts`, `result.ts`) |
| `src/main/keys.ts` | the keyboard shortcuts: the table, which key an input event is; `shortcuts.ts` takes them (Keys) |
| `src/main/updates.ts`, `forge.config.ts` | updates, Squirrel's events; the installers and the release |
| `src/main/terminal.ts` | the ptys of the tasks' terminals; each shell's screen for `terminal_read` |
| `src/renderer/components/Grid.vue`, `grid/*.vue`, `lib/grid.ts` | the grid (dockview), the panes and their headers, the island of terminals (`Terminals.vue`, its row of tabs `TerminalTabs.vue`), the closed profiles' tiles over it (`ClosedProfiles.vue`), Arrange panels |
| `src/renderer/components/TopBar.vue`, `menu/*.vue` | the title bar, ☰ and its own rows |
| `src/renderer/components/menu/*.vue`, `Modal.vue`, `Ask.vue`, `lib/menu.ts`, `cover.ts`, `views.ts`, `ask.ts`, `xterm.ts`, `terminals.ts`, `voice.ts` | the menus, the dialogs and questions (Reka UI's: `cover.ts`), the pages under them in a tasks' window (`views.ts`), a terminal in any window (`xterm.ts`), a tasks' window's terminals, dictation |
| `src/renderer/lib/keys.ts`, `components/Shortcuts.vue` | where the keyboard is, the commands the keys run; Keyboard Shortcuts |
| `test/window.ts`, `grid.ts`, `keys.ts`, `zoom-and-closing.ts`, `unit/keys.test.ts` | the tests |
