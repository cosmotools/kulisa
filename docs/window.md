# The window

How a Kulisa window works for the human: the title bar, the grid of panels, the tasks' bar, the zoom, the menus
and dialogs, the terminal, the keyboard shortcuts, and why they are built so. Projects and their tasks in the tasks' bar, several
windows: [tasks.md](tasks.md);
profiles' panes and tabs: [profiles.md](profiles.md); the components the window is built of: [ui.md](ui.md); what is
next: [ROADMAP.md](ROADMAP.md). Keep this file current when the window changes.

## The title bar

One row: the app's logo (the shown task's project's color on its curtain), Settings (a window of its own: below), ☰, and the OS's window buttons drawn over its right end (`titleBarStyle: 'hidden'` with
`titleBarOverlay`); no menu bar. Their strip is see-through (`CLEAR` in `window.ts`), as macOS's traffic lights have
none: the bar under it shows, and a dialog's backdrop dims it with the rest of the window (a strip in the theme's
color would stay bright under one); their symbols are the theme's, and stay as they are under a dialog, as macOS's do. On macOS the window buttons are at the left end, and there is no logo: Mac apps
show their icon in the Dock, not by the window's buttons. macOS centers them in the bar
the window is made with (its zoom then); Electron there cannot change that strip's height later (`setTitleBarOverlay`
is Windows' and Linux's), so when the zoom changes `setZoom` moves them to the new bar's middle
(`setWindowButtonPosition`), but not below the strip they were made in: below it they take no click (Electron's
`window_buttons_proxy.mm`). Zoomed past about 175% from 100%, they sit a
little above the middle until the next start. Dragging the empty part moves the window. When the Kulisa zoom is not 100%, the bar
shows it (a click resets it).

A right-click on the title bar does nothing on Linux. There Chromium asks the window manager for its window menu, and
GNOME on X11 places it at a NaN position: invisible, it keeps the pointer and keyboard grab, and the whole desktop
takes no clicks until the Win key opens the overview (gnome-shell logs an `StDrawingArea` allocated
-2147483648 × -2147483648). The window cancels it (`system-context-menu`). Windows keeps its system menu.

Pages never drag the window, as in Chrome. Without a system title bar Electron takes `app-region: drag` from every
view in the window, the profiles' pages too, and keeps a region after its page has gone: Teams
(`teams.cloud.microsoft`, whose code is shared with the Teams desktop app) declares one, and from then on every click
and wheel over the panes, the grid's sashes too, would go to dragging the window, mouse moves still passing, so the
pages look frozen; a maximized window cannot be dragged, so only an unmaximized one shows it (bare Electron with
`titleBarStyle: 'hidden'` does it too, not with a system title bar). Every document of a profile gets
`app-region: no-drag` on all elements (`insertCSS`, user origin, `!important` beats the page's), which also replaces a
region left behind. A page can read that value (`getComputedStyle`), where Chrome says `none`; `none` would not
replace a region left by the page before.

## The tasks' bar

Under the grid, in the middle: a tab per open task (its project's icon, its agent's state, its name, ×:
[tasks.md](tasks.md), Projects), then +, a new tab: the board, every project's tasks, where one is made or opened again (tasks.md, Projects). ☰ → **Tasks bar: Top, Bottom** puts it in the
title bar instead, after the logo, as a browser's tabs are (no row of its own; `settings.json`: `bar`; the page gets it in its URL, so it is drawn in its place at once;
`App.vue` puts `TaskBar.vue` in `TopBar.vue`'s slot or under the grid). Bottom is the
default, on macOS too: the hand goes to the terminal under the grid all the time, so the tabs are where it already is,
and they are apart from the tabs of the grid's panels, which a bar on top sits right over. The tabs are Firefox's: rounded rectangles on the window's background, the
shown one filled in the panels' color, the others plain, lit under the pointer; a gap between them and the grid, whose
panels sit on the window's background too (the author's choice). A tab is as big as a browser's (36 px tall,
at least 160 px wide, so its name keeps about ten letters; × on every tab, as Chrome's), the
tabs 8 px apart, a target for a quick throw of the mouse; in the title bar a tab keeps its 36 px and the title bar its 44, so a tab
sits in the middle with 4 px above and below, the grid right under, as a browser's tabs sit over its content (the
title bar no taller around the tab, nor the tab as low as the bar's buttons). The window is a grid of rows (App.vue: the title bar, the grid, the bar when it is below) with one
gap, 8 px: the title bar holds it above and below what is in it (`--title` = 8 + 28 + 8, tokens.css; the OS buttons'
strip is as tall, `TITLE_BAR_HEIGHT` in window.ts), so the grid starts at its edge; the grid keeps it from the sides,
the bar from the grid, the window's bottom edge from the last row; nothing else adds to it (the author's choice). In the title bar the
tabs are not a handle to drag the window by (`app-region: no-drag`). Nothing in the bar moves when another task is
shown.

More tabs than the bar holds scroll, as every strip of tabs does ([ui.md](ui.md), Controls: `.tabstrip`). In the title bar the tabs give way before at least 40 px after + (`--drag`), where the
window is dragged however many tabs there are, as Chrome's space after its +; by the logo too. Chromium takes the tabs
scrolled past the bar's edges as no-drag over both (it does not clip them to the bar, `overflow`, `contain` or
`clip-path` alike) and the page's regions in order, the last one winning: so the logo and that space come after the
bar in the page (TopBar.vue), the logo put back first by `order`.

A press on a tab not shown chooses it at once, as Chrome's, and its task is shown when the button is let go or the
tab starts being dragged, whichever is first. Showing a task
starts the grid's slide (a view transition), and Chromium drops a drag about to begin when one starts; a drag already
begun goes on through it. So the grid changes on the release, not on the press as in Chrome, which has no slide.
The pressed tab stays lit from the press until the task is shown, through the moment the pictures for the slide are
taken, so the tab left is not lit again meanwhile.

## The grid

A task's profiles' panes and its island of terminals are peer panels in a grid (dockview), in JetBrains' Islands look:
drag one by its header to another place, onto another panel to stack them as tabs, drag the gaps to resize. A
panel stacked behind another hides its page until it is chosen (and after a while unloads it: [profiles.md](profiles.md),
"Tabs unloaded"). **☰ → Arrange panels** offers ready-made
arrangements, each drawn as a small picture of itself, as Windows' snap layouts (the words in its tooltip):
profiles in columns with the terminal below, two by two with the terminal on the right, one profile at a time.
Each fits the window with nothing cut off, the terminal taking a third of it (`TERMINAL_SHARE`, `lib/grid.ts`): the
pages are what is looked at. The first profile opened over the terminal alone keeps that share too (dockview's own
would halve the room, a terminal as tall as the pages and mostly empty). The grid is saved per task (`layout.json`) and restored: 300 ms after
its last change, and at once when the task is left, so a change just before is kept (a saved grid naming a profile
deleted since is not restored at all, and the default arrangement takes its place).
The island is one panel however many terminals it holds ("The terminal").

A window made narrower or wider changes every panel in its share, as VS Code's and JetBrains' do (dockview's
`proportionalLayout`, on by default; it needs dockview-vue 8.6.0 or later:
[1691](https://github.com/dockview/dockview/issues/1691), [1692](https://github.com/dockview/dockview/issues/1692)).

A pane's header (its profile's picture, name and ×) shrinks with the pane: a name longer than the pane is wide is cut
with …, the whole of it and the profile's description in its tooltip, and the × stays, as on every tab
(`ProfileHeader.vue`).

**No profile open, a terminal open**: the profiles' room is folded to a row of tiles over the grid, where the first
one opens (`ClosedProfiles.vue`, `#closedprofiles`; where it is seen). A `.launcher.small` per closed profile, from the left: its
picture over its name, who it is under it; a click opens it, its pane over the terminal, and the row goes. A project
with no profiles has one tile, Add Profile…, its page in Settings. The tiles are outside dockview: the grid's room is
what is left under them (`room()`, `lib/grid.ts`). More than fit scroll, as a strip of tabs does (`.tabstrip`,
[ui.md](ui.md); `#dock` keeps `min-width: 0`, or many profiles stretch the window's column, the terminal and the
tasks' bar past its edge). With
no terminal either, they are the second row of the big buttons
("The terminal"). As the folded island, the row is a part of the window, nothing opens by itself: the agent opens a
profile when it needs it (`profile_open`). Not on the task's tab (the tasks' bar is no place
for profiles), nor in the terminals' row (it folds with the island).

The window itself never scrolls, also not from a script (`overflow` on `html` and `body`, App.vue): a panel stacked
behind another is kept laid out below the grid (dockview), which makes the page taller than the window, and the
tasks' bar bringing its tab into view (`scrollIntoView`) would move the whole grid up by a window's height.

The profiles' pages are native views above the window's HTML (CLAUDE.md, "What must hold in the window"). While a
panel is dragged, a menu is open or a dialog is shown, the pages are pictures of themselves (or hidden), so the
HTML can be on top; they are live again after, once nothing covers them: a task's slide ending under a menu leaves
them pictures until the menu closes (`livePages`). A page that gives no
picture (covered, the monitor off, busy) leaves its pane empty meanwhile: waiting for it would hold the menu, and every
one after it, and a task's slide after the click. How long is the pages' own pace, not a fixed
time: once the first has answered, the rest get three times as long, a tenth of a second at least (a live page
answers in a few milliseconds on a fast machine, in over a hundred on a slow one); none answering, half a second (`AppWindow.pictures`).

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
  text and controls take their size from `--font` and `--control` (tokens.css), so one zoom scales them all. From 50%
  to 200%: the window's minimum grows with it, and at 300% it is past a laptop's screen; the OS's
  own magnification is there for more. A site's zoom goes on to 300%.
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

**☰ → Language**: the language the human speaks with the agents, one for all of them (one
setting, so what the agents do because of it is plain). A row with the language chosen at its end, opening a menu
beside it (Reka's submenu: too many to show in the row, as Theme's are): the languages the agents' own settings take,
the system's first, then by name in each language itself (`LanguageRow.vue`). English by default, as the agents are
without it. Saved (`settings.json`), the same in every window.

- Kulisa gives the agents' own language settings one place and keeps them in step; it tells the agents nothing
  itself. An agent with one (its entry's `language`: Claude Code's `language`, which it
  dictates and answers in) gets it in every account's folder: when it is chosen, and at an agent's start (an account
  made since, or the setting changed in the agent's own `/config`), never in the human's own folder. Claude Code
  reads it again at once, in every running session. An agent without one (Codex) is not told otherwise:
  the row's tooltip names it ("has no language setting yet").
- One setting for dictation and answers, not two: Claude Code's setting wins over an instruction to answer in
  another language, given as Kulisa gives context (the SessionStart hook) or in `--append-system-prompt` (Claude Code). Which language code and comments are in is the project's to say, in its CLAUDE.md or AGENTS.md (with the
  setting alone, Claude Code writes comments in it too), which the tooltip says too.
- The terminal takes the panels' colors ([src/terminal](../src/terminal/README.md)).

## Menus

Kulisa draws its menus in HTML, as Chrome does (Reka UI's menus: `components/menu/`; how they open, close and are
built: [ui.md](ui.md), Menus):

- a task tab's right-click menu ([tasks.md](tasks.md), Projects, "A tab's right-click menu"), ☰ (as Chrome's ⋮, each row with its icon: the zoom row, the theme row, the
  tasks' bar's row, Language (a menu beside it), Arrange panels, Keyboard Shortcuts, the links
  (Documentation, the user guide on kulisa.app; GitHub; one list in `lib/common.ts`), Report a Problem… (Settings at
  its Log page: The log; not everyone has a GitHub account, and an issue without the log says little), About Kulisa
  (below), and Exit, which quits as the last window's × does; not on macOS, where Cmd+Q and the app's menu quit);
- right-click on a pane's header (New tab, About this profile… (Settings at it), Sign In to Master…, Refresh
  from Master…, Close profile, Remove from Project…), a tab (Reload, Duplicate, Close tab, Close other tabs), a terminal (Copy, Paste, Select all, Clear;
  then what its tab's has) and a terminal's tab (Change agent…, the Change Agent dialog as its icon opens, and New Conversation in an agent's; Close).

A row whose command has a key shows it at its end (Keys, below).

**About Kulisa** (a page of Settings, `settings/AboutPage.vue`, under Log; ☰ → About Kulisa opens Settings at it, on
macOS also first in the app menu, where Mac apps have it, in place of Electron's own panel; as Chrome's About is a page of
its settings, one place for what is about the app): Kulisa's version (package.json's: run from source `app.getVersion()`
is Electron's), Electron's and Chromium's (for a bug report, and What sites see), kulisa.app and the license; then the
folders Kulisa writes in on this computer, as the OS and its variables make them (`about:get`, `ipc/window.ts`): the
data folder, the projects' folder (`KulisaProjects`) and the program's (the checkout; packaged, what the installer put
there: the `.app`, Squirrel's root), each its path to select and copy and a button that opens it in the file manager
(`about:show-folder`, by the folder's id: the window names no path), disabled while the folder is not made yet. The
docs name the usual places, but only the app knows the exact ones (issue #67); so the guide
points here, and still lists the usual places for whoever reads it after uninstalling.

The window's menus are not native: a native menu has rows of text only, no buttons in a row.

**The right-click menu in a profile's page** is the one native menu (`page-menu.ts`; Electron's
`tutorial/context-menu.md`): drawn above the pages by the OS, it needs no pictures of them, and a page's menu is
the OS's in Chrome too. Its rows are Chrome's for what is under the pointer (the `context-menu` event's `params`): a
link (Open Link in New Tab, behind, in the same profile; Copy Link Address), an image (Open Image in New Tab, Copy
Image), a field (Undo, Redo, Cut, Copy, Paste, Select All: Electron's roles), a selection (Copy; macOS selects the word
under a right-click, so a link's menu has it there, as Chrome's), else the page's (Back,
Forward, Reload); then Pick an Element for the Agent and Screenshot of an Element (they start choosing an element, as
their keys do), and Inspect (the element in the tab's DevTools, `Profile.inspect`). Back, Forward, Reload, Pick and the
screenshot are sent to the window as their keys' commands, so each is done one way. A site with a menu of its own
(Teams, Google Docs) keeps it: it cancels the page's `contextmenu`, and Chromium asks for none. The agent's
right-click opens none, so no menu holds the human's pointer while the agent works: Electron reports the agent's input
through Playwright as the human's (`before-mouse-event`), so its right press is told by the CDP proxy it passes.

## Dialogs and questions

Every dialog has one look, as in JetBrains ([ui.md](ui.md), Dialogs). Questions before something that cannot be
undone (deleting a profile, a task, a project), before closing (a task while an agent works, a window,
quitting while an agent works: [tasks.md](tasks.md)) or between two ways to go (a second button, `other`) are asked
in that dialog too (`shell.ask` → `lib/ask.ts`, `Ask.vue`, queued; its keys: [ui.md](ui.md), Dialogs), in the window the action is in: Settings' for what is done in Settings, a tasks'
window's for what is done there, the agent's in its task's window (`asker` in `ipc/`; `Asker` in `window.ts`). A tasks'
window asked in comes to the front with its question, restored when minimized, while another of Kulisa's windows has
the focus (Settings, another tasks' window): left behind, it would look as if nothing happened (on macOS a window's ×
works behind Settings); never from another app. While a dialog is open the profiles' pages are
hidden (they are native views above the HTML), and the keys are the dialog's (Keys). Not the OS's own question (`dialog.showMessageBox`): it looks different on each OS and plain on Linux, and
cannot mark the deleting button or lay out what goes. The OS's own dialogs stay for choosing a folder.

## Settings

Settings (a tree of Projects, Agents and Profiles: [tasks.md](tasks.md), Projects; GitHub's page after Agents:
[src/github](../src/github/README.md), The window; under them the Log page, The log below, and About, Menus above) is a window of its own, as a desktop
app's settings are (JetBrains', macOS apps'; what users of desktop apps expect, and settings
apart from the work): the OS's title bar ("Settings — Kulisa"), its own size and place, kept (`settings.json`:
`settingsWindow`), at least 640 × 420 times the Kulisa zoom. Open it, set things, close it; or leave it open beside
the work:

- **One for the whole app.** The gear (on macOS also Kulisa → Settings… in the menu bar, ⌘,, where Mac apps have it, under About Kulisa), a task tab's Manage Profiles… and Project Settings…, a pane's About this
  profile… and a project's Add Profile… tile open it at that page (a project's: none named, the
  shown task's); open already, it comes to the front at that page. No gear while Settings would be empty: no project,
  no account, no profile, as at the first start, where the welcome makes them (a window saying
  "No projects yet" is no use there); it comes with the first account signed in to. An account or a profile left
  after the last project is deleted keeps it: Settings is where they are removed (`settings` in the projects' news).
- **Not modal**, as macOS apps' settings, VS Code's and Chrome's are: the tasks' windows go on
  taking clicks and keys beside it, and either comes in front of the other. Not holding them as JetBrains' Settings
  holds its IDE (`setEnabled(false)`): on macOS Electron disables a window by putting a half-black sheet over it
  (`NativeWindowMac::SetEnabled`; electron#9272 `wontfix`). Its page saves what is typed as it goes, so nothing
  waits for it to close. Not Electron's modal window either (on macOS a sheet, attached to its parent's title bar,
  not movable: [Electron's docs](https://github.com/electron/electron/blob/v44.8.0/docs/api/browser-window.md#platform-notices)),
  nor a child of a tasks' window (on macOS a child stays above its parent, which then never comes in front of it).
- **It acts for the tasks' window last in front** (`shell.front`: clicked, or brought up by the keyboard or the OS):
  what it asks the main process about a project or a task goes there (`owner` in `ipc/`): the shown task's project
  (where it opens when none is named, also on macOS's Kulisa → Settings…), the folder agents are looked for in. That
  window closed, the next one; the last one closed, Kulisa quits as always, Settings with it. Closed, Settings gives
  the keyboard back to that window. A new account's sign-in and an installer answer the page that asked.
- **Its lists follow** what changes elsewhere while it is open: the profiles made and let go in a tasks' window or by
  the agent (`settings:changed`, sent on `profilesChanged`), its tree's and the shown project's; nothing typed on its
  page is touched.
- **Never full screen** (`fullscreenable: false`), as Mac apps' settings: opened from a task's window in full screen,
  macOS would make it a full-screen window of its own, in a Space of its own. Not full-screenable, it opens at
  its size over that window, in its Space. As a
  window of its own, macOS's Window menu lists it too.
- **Esc closes it**, as a dialog's: unless a menu, a question or a popover is open (Esc closes that first), or a field
  takes it. Esc and the OS's × alike, its page saves what is typed first (a project's name), then closes it; while an
  agent installs, it stays.
- **Settings only**: a project is made in a tasks' window (New Project: the empty window with no project, New Project… on the board),
  which opens its first task (one way to open each, not New Project inside Settings too).
- **Shown once its page is filled** (the projects, the profiles, the agents as last found, its fonts: `settings:ready`),
  as Electron's docs advise for a window (`show: false`), so its tree and page do not jump as they come. A page that never says so is shown after 2 s all the same.
- Its page is the app's third (`settings.html`, `settings/Settings.vue`): nothing of a tasks' window (no grid, no profiles'
  views, no keys of its own). Its process lives while it is open: about 40 MB of its own (PSS).
- Not tried on Wayland: there an app may not place, move or focus its windows itself (Electron's docs, the same
  Platform notices), so where it opens and bringing it to the front are the compositor's.

## The terminal

A task's terminals are an **island** of the grid, one panel: the terminal in front, a **row of tabs** over it, apart
from it as a browser's tabs (the row in the toolbar's color, the tab in front in the terminal's, as if part of it;
`TerminalTabs.vue`, `Terminals.vue`). One terminal is shown at a time (two side by side are
not needed): a terminal is not split off into a panel of its own. Each is the user's shell in the task's folder
(`src/terminal/`), an agent the human chose started in it
([tasks.md](tasks.md), "Several agents in a task") or not. Each tab: the agent's icon (a shell's, for a shell), its
name, its state (an agent's: working, waiting for you, done), ×; each its name whole (not shrunk), more than fit
scroll, as a strip of tabs does (`.tabstrip`, [ui.md](ui.md); dockview's tab keeps `min-width: 0`, or it grows to its
content and the tabs run past the island, + and the microphone with them). After the tabs, the island's own **+**, whatever
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
as JetBrains' tool windows go but with their button kept in place): by its height under or over the grid,
by its width at a side (dockview's constraints hold it there; the row goes). Alone in the grid (no profile open), the +'s rows are big
buttons in a line in the grid's middle, whatever the arrangement (its group fills the grid there, so it is not drawn;
quick to open an agent or a shell in an empty task): `.launch`, a `.launcher` each, the agent's icon over its name, an account's email
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
`Task.loadTerminals`), so the folded island's buttons do not show while the agents are looked for. A pick or a dictation meanwhile goes nowhere: the human gives it again.

The terminal itself, the same wherever it is shown (a pty in the user's shell, its output in a buffer, one xterm a
place that shows it, the keys of the OS's own terminal, its size), is a Kulisa package, `src/terminal/` ([packages.md](packages.md)): how it works
and why in its [README](../src/terminal/README.md). The island is the task's: its tabs, its agents, its shells.

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
(`Task.openTerminal`, `openAgent`, `runInTerminal`, `interruptTerminal`, `readTerminal`, `closeTab`).

**Dictation**, where the agent in front has its own ([tasks.md](tasks.md), "Choosing the agent"), is a key held:
the **right Ctrl** (the right ⌘ on macOS: Apple keyboards have no right Ctrl), anywhere in the window: in a profile's
page, its address bar, the terminal, the bar. Held, the agent records until it is let go; pressed once, it records
until the next press (or 5 minutes, a recording left on; another tab brought to the front, or the window losing the
keyboard with the key down, stops it too). Why a key and not a button: speaking to the agent
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
(`NSMicrophoneUsageDescription`, `forge.config.ts`).

Links in the terminal open with Ctrl+click (⌘ on macOS; which links: [src/terminal](../src/terminal/README.md)), and
always ask where, in a menu at the pointer (the island's `termHooks.open`): a new tab in one of the shown task's open
profiles, or the user's browser. Asked every time, so a link never lands somewhere the human did not expect (which profile a link belongs to cannot be told, and a rule such as "where that site is
open" is not obvious).

## Keys

Kulisa's keyboard shortcuts, as an IDE has them, one table for all (`src/main/keys.ts`): the keys, the command each
does, and where; the window's menus, the buttons' tooltips ("Reload (Ctrl+R)", `withKeys`) and
**Keyboard Shortcuts** (☰, or Ctrl+Shift+/: `Shortcuts.vue`) show them from it, as this OS writes them (⇧⌘T on macOS),
so they are never out of date.

Who gets a key depends on where the keyboard is, and **the keyboard stays where the human put it**:
a profile's page takes it only from the human, a click or a key in it, or from Kulisa for them (a tab chosen
by a key, Ctrl+`, their dialog answered, Pick, an address from its pane's bar). A page taking it by itself, as one
loading does (a tab the agent opened, a redirect: on macOS every one does, and the next keys typed to the agent would
go to the site), gives it back to where it was in its window (`page-focus.ts`). A real click's own order on macOS is the
page's focus, then the click 2 ms later: a page's focus is the human's when their input in it comes within 150 ms of
it, before or after.

- **In a profile's page, or its pane** (its address bar, its toolbar): Chrome's keys, for that pane, as the hands know
  them: Ctrl+T a new tab with the address to type in, Ctrl+W, Ctrl+Shift+T (the tab closed last: its address, kept in
  memory, ten at most), Ctrl+L / Alt+D / F6, Ctrl+R / F5, Ctrl+Shift+R (not from the cache), Alt+← / →, Ctrl+Tab,
  Ctrl+PgDn / PgUp, Ctrl+1…8, Ctrl+9; Ctrl+Shift+C for Pick (Chrome's Inspect), Ctrl+Shift+S for a screenshot of an element ([src/screenshots](../src/screenshots/README.md)). The site does not get them, as in
  Chrome. Closing or switching a tab from the page leaves the keyboard in the page shown next.
- **Everywhere, the terminal too**: Ctrl+` to the terminal in front and back to the page used last (on the folded
  island, a new conversation of the task's agent), Ctrl+Shift+` a new terminal, Ctrl+Shift+1…9 the bar's first to ninth tab, Ctrl+Shift+PgDn / PgUp the next or previous
  one (in the bar's order), Ctrl+Shift+N a new task of the shown task's project, Ctrl+Shift+A the bar's + (a new tab: the board; again, back),
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

Not Electron's application menu with accelerators, its own way of keys: on Linux the page gets a key before the menu, and the menu none that the page handled itself,
as xterm and many web apps do: Kulisa's keys would not work in the terminal nor in those apps, and others would act
twice (the site's and Kulisa's). Nor `globalShortcut`: it takes keys from every app on the computer. macOS has its own
menu bar with Settings… (⌘,), Quit Kulisa (⌘Q: Kulisa's quit, asking when an agent works, not Electron's role, which
quit at once), Hide, the Edit menu (⌘C, ⌘V) and the windows (Electron's default one reloads Kulisa's own page with
⌘R); Linux and Windows windows have no menu.

## DevTools

A pane's ⋮ menu (where more of a pane's actions will go, as in Chrome), or F12 or Ctrl+Shift+I in its page, opens
the active tab's DevTools in a window of their own. Kulisa's own DevTools (F12 outside the pages) exist only when
running from source (`appDevTools`, off when `app.isPackaged`).

## The log

What happened and who asked, for a bug the author cannot watch (a user's, another OS's): `logs/kulisa.log` in the data folder
([tasks.md](tasks.md), "What is on the computer"), written by electron-log (MIT, the most used: the file and its
turnover, Electron's own events) with lines of Kulisa's own (`log.ts`). At 1 MB it becomes `kulisa.old.log` and a new
one starts: 2 MB at most, nothing piling up. The same place on every OS (electron-log would put macOS's in
`~/Library/Logs`): one path to name in the guide, and the tests' log in their own folder. The lines go to the console too
(`npm start`'s terminal, the tests' output), until it has no reader (the terminal closed, `npm start | head`): then the
console transport goes off at its first failed write, and the file goes on. Left to Node, that write is an uncaught
exception, which `app.ts` logs to the console again, and so on, in nextTicks that let nothing else run: Kulisa would
stop answering the OS. Each line has the time (ISO
8601 with the computer's offset, `stamp`: a user's log is read next to an issue's or a message's time from another
zone; electron-log's own has no offset), the level and a tag:

- `[kulisa]`: the start (the version, Electron's, the OS and its session, X11 or Wayland, packaged or from source,
  the data folder), whether the OS keeps Kulisa's key (`encryption available`, on Linux which keyring; `basic_text`
  is none: a warning), quitting. And, at a start, that the run before did not say it quit (`quitSaid`, from the
  file's end): a crash of the main process, a kill or the computer going down, which nothing else can write; a crash
  leaves its minidump in `crashDumps` (Electron's crashReporter, `uploadToServer: false`: Crashpad keeps them, pruned
  by itself, 90 days or 128 MB; no server), to ask a user for.
- `[ipc]`: every channel a window sends (`ipc.ts`, `handle` and `on`), the sender's webContents id (`wc=`: a window's,
  Settings', a master's; `[window] new wc=` says which) and its arguments; an answer refused, with its reason. Not the
  terminal's keystrokes and size (never: what is typed), nor what comes at every change or draw (`QUIET`: the grid's
  boxes, layouts, lists read again), and a question's answer without the answer.
- `[mcp]`: every tool the agent calls (`mcp-server.ts`), its task and terminal, its arguments; one that failed, with
  its error.
- `[key]`: a key of Kulisa's taken (`shortcuts.ts`), where the keyboard was.
- `[page-menu]`: a row of a page's right-click menu chosen (`page-menu.ts`), its profile and tab.
- `[hook]`: an agent's hook event (`agent-hooks.ts`), its task and terminal.
- `[project]`: a project loaded, its id named by the project's name and folder (the home folder as `~`):
  `[project] k3f9a2 loaded: shop (~/IdeaProjects/shop)`; a project renamed, by whoever renamed it, only when its name
  changed (a save writes every field): `[project] k3f9a2 renamed: Shop-2`. Its id is random (tasks.md, What is on the
  computer): where it first appears in a run it comes with the name, and the lines after it name it by the id alone,
  the key a line is found by.
- `[task]`, `[window]`, `[settings]`, `[terminal]`: a project's task opened, a task created (its project's name, where:
  `[task] created k3f9a2/1 (shop) in ~/IdeaProjects/shop@task-1`), closed, deleted;
  a window made, showing a task, dropped; Settings opened (at what) and closed; a terminal started (the agent and
  whether its session is resumed, or a shell), gone, its exit code.
- `[github]`: a GitHub account, its id with its login beside it (`, token` for a fine-grained token's), at every start
  and as it is added, signed in again, signed out (and why: a refresh refused, its token refused) and deleted; a refresh
  that did not reach GitHub. Never a token, a code or an address with a token ([src/github](../src/github/README.md)).
- `[accounts]`: an agent's account, its id named by its agent and its email shortened (three letters of the name, at
  most half of it: a log goes with a bug report; none without an email), at every start and as it is made and
  deleted: `[accounts] k3x9ab (Claude Code, mar…@shop.com)`; a terminal started names it so too. Its id is random,
  as a project's.
- `[page wc=…]`: an error or a warning in one of Kulisa's own pages (its console: an uncaught error is one); never a
  profile's page.
- `[profiles]`: a profile, its id with its name beside it, at every start and as it is made and deleted
  (`[profiles] m2q7xd (ann@shop.com)`), and renamed (`[profiles] m2q7xd renamed: anna@shop.com`). Its id is random, as
  a project's: a later line naming it is found by these.
- `[profile]`: a profile's page that would not load (`did-fail-load`, the main frame; a white pane is a common report):
  the profile, the address bare, Chromium's error. The one kind of line about a profile's page.
- `[session-cookies]`: a profile's saved session cookies that cannot be read (saved with another keyring key: after
  a restart it comes back signed out), or not saved (the error).
- `[electron]`: Electron's own events, named one by one in `startLog` and written by `electronEvent` (electron-log's own
  line appends the page's address in full): a renderer gone (its page's address, bare: where it crashed is worth
  knowing), a child process (the GPU) gone, a page unresponsive, a preload error. Not its defaults,
  which listen on every webContents, the profiles' pages too, and log their failed loads and certificate errors with
  the address (every cancelled navigation, an OAuth callback's `?code=`), and their console.
- `[warning]`: a process warning (Node's, a deprecation), in place of Node's own line. Not Electron's warning of every
  failed load, which carries the address in full (`[profile]` has it bare).

Never there: what is typed into a terminal or a page, passwords, tokens, cookies, an address's user and query.
`summary` writes an action's arguments in one short line: a value left out by its key (password, secret, token,
cookie, credential; `text` and `values`, what the agent types into a page) or by what the text says of itself
(`token=…`, `Bearer …`), an address without its user and password (`https://…@github.com/…`) and without its query
and fragment (`?…`: an OAuth code, a magic link; the addresses in a refusal's or a failed tool's message too, `bare`), long
strings and the whole cut. A second Kulisa started on the same
data writes its start line and "already running" into the same file: two starts in a row are not a restart. What the code says with
`console.*` goes to the file too (`startLog`). A new action of the core goes through `handle()` or the MCP server's
`registerTool`, so it is logged by itself; a line elsewhere says what happened and who asked, never what was typed.

**The Log page** (Settings → Log, under Profiles; ☰ → Report a Problem… opens it; `settings/LogPage.vue`; issue #73) is
where the human reads it and passes it on, by any means: not everyone has a GitHub account, so
GitHub is one way of several, not the way.

- The file whole (1 MB at most), read when the page is first shown, not as Settings opens (`log:get`); then followed
  (`log:lines`): a hook of electron-log's runs before its file transport, which writes at once, so what came since is
  read from the file at the end of the same tick and sent, a burst of lines as one (`readLog` in `log.ts`; the last
  page that read is the one followed). The file turned over under it (shorter than what was read): the page reads it
  again. Nothing of this is logged: a line of its own would send it again.
- A line each with its time (the date in its tooltip) and its tag, the tag in the color of who acted (`--log-agent`,
  `--log-human`, `--log-tasks`), warnings and errors in red; what is not a line of that shape (an object's lines under
  an `[electron]` event) hangs under the line before it. **Follow** keeps the end in view, as a terminal does, lets go
  when the log is scrolled up, and goes back to the end when checked again.
- The chips (`.chips`, [ui.md](ui.md)), one always chosen, and a text filter on top of the chosen one (a task's key,
  `wc=1`, a tag): **All**; **Errors** (warn and error lines, `[page]`, `[electron]`, an action refused or failed);
  **Agent** (`[mcp]`, `[hook]`, `[terminal]`); **Human** (`[ipc]`, `[key]`, `[settings]`); **Tasks** (`[task]`,
  `[window]`, `[kulisa]`). Nothing left says so.
- Under it: the file's size of its 1 MB, when `kulisa.old.log` is from, and what is never in the log.
- **Copy All** (the whole log to the clipboard), **Save As…** (a copy of the file where the human says, their Downloads
  by default: to attach to a message, a chat, an issue; `log:save`), **Open Folder** (the file picked out in the file
  manager; `log:show-folder`), **Report…**: *On GitHub…* opens the user's browser on a new issue from the repository's
  bug template (`.github/ISSUE_TEMPLATE/bug.yml`), its environment filled in (the start line's facts: `environment`,
  `issueUrl`; GitHub takes a form's fields by their id in the query); the template asks for the file and says what is
  in it and that the issue is public. *By email…* comes when there is an address on the kulisa.app domain (the
  author's personal address is not put into released versions). No sending by itself and no crash server: no server,
  and a log without the human's words says little; back to it when there are users and a crash the log did not explain.

## IPC

A window's page and the main process talk by named channels: `invoke` (an answer comes back), `send` (none), and the
main process's messages to a page. Each channel is declared once, in `src/shared/ipc.ts`: what it takes and what it
answers (`Invoke`, `Send`, `Events`); `npm run build` checks both ends against it. The main process's end goes through
`handle` and `on` (`src/main/ipc.ts`), in a file a domain (`src/main/ipc/`), and `AppWindow.send`; the page's through the bridge's types (`env.d.ts`) and
`act`, which adds the task shown (a message about the shown task's profiles and tabs is refused once another is shown).
A new channel is declared there first, then its two ends.

- An answer the page does not read is `void`: the main process may answer anything there (the tests read some).
- An answer that may be a refusal is a `Result` (`src/shared/result.ts`), read with `refused()`, so the types keep a
  page from reading `r.accounts` after a no (`{ error: null }`).
- What crosses comes from the page and is checked again where it matters (a theme, a name); the types say what a
  well-behaved page sends, not what any page may.
- The tests call channels by their names in pages (`kulisa.invoke('…')`, in `executeJavaScript`): those are not checked.

## The app icon, installers and updates

The icon is a stage curtain drawn apart with the agent's pointer (`assets/icon.svg`, rendered for each OS by `npm run
icons`): in the title bar, the taskbar and the installers. Run from source, GNOME's dock shows a generic icon: it
takes icons from installed `.desktop` files only (the `.deb` installs one matching the window class `kulisa`, named Kulisa by its own template, `assets/linux.desktop.ejs`: the makers' would name it after the package and give it the class `Kulisa`); left
so on purpose. The macOS Dock shows Electron's own icon for a bundle run from source, so Kulisa sets its own there
(`app.dock.setIcon`); a packaged one has it in its bundle.

Installers are made with Electron Forge (`npm run make`, `forge.config.ts`), each on its own OS: `.deb` and `.rpm` on
Linux (the `.deb` checked: it installs `chrome-sandbox` setuid root, a menu entry and the icon, and the app starts;
99 MB, about 280 of its 320 MB installed being Electron itself, as VS Code's or Slack's),
Squirrel `.exe` on Windows, `.dmg` and `.zip` on macOS (signed and notarized when the Apple secrets are set; without
them unsigned, which runs on the Mac it was built on: ROADMAP, "Windows is untested; macOS has gaps left"). On macOS node-pty is
not built again: its own prebuilt binary is packaged (N-API, the one `npm start` loads), so no compiler is needed, and
its `spawn-helper`, the program it starts a shell with, is kept outside the archive, where it runs it from (in it, a
packaged Kulisa's terminal fails). **What the package holds** is what the main process runs: its `dependencies`, the
window's build (`dist/renderer`, 2 MB) and the agents' packages. The window's libraries (Vue, Reka UI, dockview, xterm
and its addons, the fonts: about 40 MB) are `devDependencies`, which Forge leaves out, since Vite bundles them into
the build and the main process imports none of them (`@xterm/headless` apart, which keeps each shell's screen:
The terminal); node-pty's prebuilt binaries for the other platforms (58 MB, mostly Windows's) are removed by a
packaging hook (`prunePrebuilds` in `forge.config.ts`), since it loads only its own platform's, on Linux the one
built at install: the archive is 40 MB. The `.dmg` needs `appdmg`, whose native parts npm builds at install with the Command
Line Tools: without a working compiler it is left out, and `npm run package` (the app in `out/`) or the `.zip` do. `npm run
publish` makes them and uploads them to a **draft release** on GitHub (`@electron-forge/publisher-github`). A merge
into `main` (a pull request from `develop`, its version raised: CLAUDE.md, Releases) releases them by itself, on GitHub
Actions (`.github/workflows/release.yml`; macOS once its secrets are set): the workflow first makes the draft
`v<version>` at the merged commit, its notes the pull request's text (Forge's own would name no commit, and GitHub
would tag whatever `main` is when the draft is published); Ubuntu and Windows build and Forge uploads into it, finding
it by its name, and each file's provenance is attested (`actions/attest`: a statement signed through
Sigstore and kept by GitHub, not in the release, that this workflow built this very file from this commit; the `.nupkg`
the Windows updater downloads too; whoever has a file checks it with `gh attestation verify <file> -R cosmotools/kulisa`);
the `.deb` is installed on Ubuntu and started under Xvfb (its MCP server listening, nothing uncaught,
still running after 5 s: the tests run Kulisa from source, and what breaks only packaged would reach every installed
copy, one failing at start never able to update again); then the draft is published, the tag made at that commit.
Before that, and when a step fails, it is a draft nobody is served. A version released before stops it. Once
published, kulisa.app is built again (`kulisa-site`'s deploy, run with the secret `SITE_DEPLOY_TOKEN`): its
download buttons lead to this release's files. Releases are built and the updates checked as ROADMAP's "Releases and auto-update" plans them; what is
left is there too.

**Not made, and why** (the guide, Systems, says it to users): AppImage (on Ubuntu 24.04 and later Electron in an
AppImage starts only with `--no-sandbox`: its FUSE mount is `nosuid` and AppArmor restricts unprivileged user
namespaces; Kulisa's pages hold real accounts; no maker of Forge's own); Snap and Flatpak (their sandbox is in the way
of what Kulisa does: the user's shell, agent CLIs, git, direnv, agents installed in `~/.local/bin`; Snap only with
classic confinement, reviewed by hand). Not Velopack or electron-updater for updates: one leaves Forge's makers and has
AppImage only on Linux, the other needs electron-builder.

**Updates**, Forge's way (`updates.ts`, called by `index.ts`): Electron's `autoUpdater` (Squirrel) through the
Electron team's `update-electron-app`, from update.electronjs.org, which serves a public repository's published
GitHub releases. A packaged Kulisa on Windows or macOS checks at start and every 6 hours (its 10 minutes by default:
Kulisa stays open for days), downloads a newer release in the background, and starts it the next time it is started.
It never restarts by itself nor asks with the OS's dialog (the module's, off: `notifyUser: false`). Not from source
(`app.isPackaged`), nor on Linux, where Electron has no updater: there the distribution's package manager updates it,
as Electron's docs advise, under the running Kulisa, which goes on from the old files (dpkg and rpm write each file
beside and rename it over).

**A new version ready while Kulisa runs** (`updateNotices` in `updates.ts`): downloaded by the updater
(`update-downloaded`), or installed on disk (Linux: the app archive's folder watched, `installed.ts`: the version read
from the archive as it is on disk, `process.noAsar` for that read, since Electron's own reads go to the file it opened
at start) is asked about once per version, in Kulisa's own dialog (Dialogs and questions), in the tasks' window in
front: "Kulisa <version> is ready", Restart or Later, saying which agents it would stop, as quitting does. Restart
(`shell.restart`) saves everything as `before-quit` does (session cookies, tabs, the windows), then Squirrel's
`quitAndInstall` (which closes the windows before `before-quit`, Electron's `api/auto-updater.md`: `quitting` is set
already, so they close without a question) or, on disk, `app.relaunch` (the same path, its files replaced) and quit;
the windows and their tasks come back in the new version. Later: nothing more; the next start is the new version
anyway. The `.deb` adds Kulisa's apt
repository and its key as Chrome's and VS Code's do (`assets/deb/postinst`; gone with `purge`, `postrm`), so a new
release comes with the system's updates. The repository is a flat one on GitHub Releases, nothing else to host
(GitHub Pages takes no file over 100 MB, and the `.deb` is about that): its index, signed with the key in the secret
`APT_SIGNING_KEY`, is the files of the release `apt` (a prerelease, never the latest: kulisa.app's buttons are the
latest's files), naming the newest `.deb` by its path in its own release, `v<version>/kulisa_<version>_amd64.deb`,
whose address GitHub answers with a redirect apt follows. `release.yml` writes it once the release is published, then
installs the `.deb`, Kulisa again from the repository, and purges it. An `.rpm` is still installed again by hand
(a dnf repository: ROADMAP). Each format updates its own way only, never one put over another. A check sends
update.electronjs.org the version, the OS and the IP; the download comes from GitHub.

On Windows, Squirrel starts the app while installing, updating and removing it (`--squirrel-install` …), to make or
remove its shortcuts: `electron-squirrel-startup` does that and Kulisa quits without starting (Forge's Squirrel.Windows
maker). Its first run after installing checks nothing (Squirrel holds a lock then), and the app's id is the one its
shortcuts carry (`com.squirrel.kulisa.kulisa`), or Windows would not pin it to the taskbar (Electron's
`api/auto-updater.md`).

## The code

| File | What |
|---|---|
| `src/main/index.ts` | the entry: the environment's variables (README, Run) into `start`; Squirrel's events first (`updates.ts`) |
| `src/main/app.ts` | the app put together: the shell, the Kulisa zoom, the theme, the language, the agents; start and quit |
| `src/main/shell.ts` | `Shell`, the app every module of the main process is given: types only |
| `src/main/open-tasks.ts` | the windows' open tasks: open, show, create, move, close, delete (one change after another, `serial`) |
| `src/main/ipc/*.ts` | the windows' handles, a file a domain: `tasks`, `projects`, `profiles` (Settings → Profiles), `agents`, `panes` (the shown task's profiles, tabs, terminals), `window` (its zoom, theme, bar, language) |
| `src/main/shortcuts.ts` | the keys as they are typed (Keys), the hold keys changed |
| `src/main/page-menu.ts` | the right-click menu in a profile's page (Menus) |
| `src/shared/ipc.ts`, `src/main/ipc.ts` | the channels between a page and the main process; `handle` and `on`, checked against them (IPC) |
| `src/main/window.ts` | a window: its BrowserWindow, the native views' places, its questions, screenshot |
| `src/main/settings-window.ts`, `src/renderer/settings.html`, `components/settings/` | Settings' window (Settings); its page is `ProjectEditor.vue` |
| `src/preload/index.cjs` | the window's bridge to the main process: the windows' pages are sandboxed (no Node: about 15 MB less a window, PSS), so it is a few lines of plain JavaScript; the window imports what it shares with the main process from `src/shared/` (`names.ts`, `avatars.ts`, `result.ts`) |
| `src/main/log.ts` | the log: the file (electron-log), `summary` of an action's arguments, the Log page's reading and following of it, the issue's address (The log) |
| `components/settings/LogPage.vue`, `AboutPage.vue` | the Log and About pages of Settings (The log; Menus, About Kulisa) |
| `src/main/keys.ts` | the keyboard shortcuts: the table, which key an input event is; `shortcuts.ts` takes them (Keys) |
| `src/main/updates.ts`, `installed.ts`, `forge.config.ts` | updates, Squirrel's events, a new version ready while Kulisa runs (the version installed on disk); the installers and the release |
| `src/terminal/` | the terminal, a Kulisa package: its pty, its buffers, the xterm shown ([README](../src/terminal/README.md)) |
| `src/renderer/components/Grid.vue`, `grid/*.vue`, `lib/grid.ts` | the grid (dockview), the panes and their headers, the island of terminals (`Terminals.vue`, its row of tabs `TerminalTabs.vue`), the closed profiles' tiles over it (`ClosedProfiles.vue`), Arrange panels |
| `src/renderer/components/TopBar.vue`, `menu/*.vue` | the title bar, ☰ and its own rows |
| `src/renderer/components/menu/*.vue`, `Modal.vue`, `Ask.vue`, `lib/menu.ts`, `cover.ts`, `views.ts`, `ask.ts`, `terminals.ts`, `voice.ts` | the menus, the dialogs and questions (Reka UI's: `cover.ts`), the pages under them in a tasks' window (`views.ts`), a tasks' window's island (`terminals.ts`), dictation |
| `src/renderer/lib/keys.ts`, `components/Shortcuts.vue` | where the keyboard is, the commands the keys run; Keyboard Shortcuts |
| `test/window.ts`, `grid.ts`, `keys.ts`, `zoom-and-closing.ts`, `unit/keys.test.ts` | the tests |
