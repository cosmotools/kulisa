# The window

How a Kulisa window works for the human: the title bar, the grid of panels, the tasks' bar, the zoom, the menus
and dialogs, the terminal, the keys, and why they are built so. Projects and their tasks, several windows:
[tasks.md](tasks.md); profiles' panes and tabs: [profiles.md](profiles.md); the components: [ui.md](ui.md).

## The title bar

One row, 44 px (`TopBar.tsx`; `TITLE_BAR_HEIGHT` in `window.ts`, the OS buttons' strip, kept in step): the app's logo
(the shown task's project's color on its curtain), the tasks' bar when it is here, Settings (checked while shown:
below), ☰, and the OS's window buttons over its right end (`titleBarStyle: 'hidden'` with `titleBarOverlay`); no menu
bar. Their strip is see-through (`CLEAR` in `window.ts`), as macOS's traffic lights: a dialog's backdrop dims it with
the rest of the window (a strip in the theme's color would stay bright); their symbols are the theme's and stay as they are under a dialog. On macOS the buttons are at the left
end and there is no logo (Mac apps show their icon in the Dock). macOS centers them in the bar the window is made
with, and Electron there cannot change that strip's height (`setTitleBarOverlay` is Windows' and Linux's): on a zoom
change `setZoom` moves them to the new bar's middle (`setWindowButtonPosition`), never below the strip they were made
in, where they take no click (Electron's `window_buttons_proxy.mm`). Zoomed past about 175%, they sit a little above
the middle until the next start. Dragging the empty part moves the window. A Kulisa zoom other than 100% shows in the
bar (a click resets it).

A right-click on the title bar does nothing on Linux: there Chromium asks the window manager for its window menu, and
GNOME on X11 places it at a NaN position, invisible, keeping the pointer and keyboard grab, so the whole desktop takes
no clicks until the Win key opens the overview (gnome-shell logs an `StDrawingArea` allocated -2147483648 ×
-2147483648). The window cancels it (`system-context-menu`). Windows keeps its system menu.

Pages never drag the window, as in Chrome. Without a system title bar Electron takes `app-region: drag` from every
view in the window, the profiles' pages too, and keeps a region after its page has gone: one Teams declares
(`teams.cloud.microsoft`) sends every later click and wheel over the panes and the grid's sashes to dragging the
window, mouse moves still passing, so the pages look frozen (in an unmaximized window; bare Electron with
`titleBarStyle: 'hidden'` does it too). Every document of a profile gets `app-region: no-drag` on all elements
(`insertCSS`, user origin, `!important` beats the page's), which also replaces a region left behind; a page reads
`no-drag` there (`getComputedStyle`), where Chrome says `none`, which would not replace one.

## The tasks' bar

Under the grid: the sidebar's button ([tasks.md](tasks.md), The sidebar), a tab per open task ([tasks.md](tasks.md),
Projects), +; in the title bar the room after them is the window's handle. +, a new task: with one project made in one click, with several a menu of the projects asks which (each with
its icon, as the sidebar orders them; one not loaded is loaded), since the bar holds tasks of several and the shown
task's project is no guess to make. A task closed is
opened from the sidebar. ☰ → **Tasks bar: Top, Bottom** puts it in the title bar
after the logo instead, as a browser's tabs (`settings.json`: `bar`; in the page's URL, so it is drawn in place at
once; `App.tsx` puts `TaskBar.tsx` in `TopBar.tsx`'s children or under the grid). Bottom is the default, on macOS too:
the hand is at the terminal under the grid all the time, and a bar on top sits right over the grid's panels' tabs. The
tabs are shadcn's, the shown one raised (the author's choice). A tab is a target for a
quick throw of the mouse: at least 160 px wide (about ten letters of its name), × on every tab as Chrome's. The window
is three rows (`App.tsx`: the title bar, the grid, the bar when below), the grid from edge to edge. In the title bar
the tabs are no drag handle (`app-region: no-drag`). Nothing in the bar moves when another task is shown.

More tabs than the bar holds scroll (`useStrip`, `lib/strip.ts`). In the title bar the tabs give way before at least
40 px after + (`drag-area` in `TopBar.tsx`), where the window is dragged however many tabs there are, as Chrome's
space after its +; by the logo too. Chromium takes the tabs scrolled past the bar's edges as no-drag over both (it
does not clip them to the bar: `overflow`, `contain` or `clip-path` alike) and the page's regions in order, the last
one winning: so the logo and that space come after the bar in the page (`TopBar.tsx`), the logo put back first by
`order`.

A press on a tab not shown shows its task at once, as Chrome's; the tab is lit once the window is told so.

## The grid

A task has two independent Dockview grids (`Grid.tsx`, `grid/Stage.tsx`): development terminals with Resources,
and the **stage** of browser profiles and Stage terminals as testing **environments**. A headerless Gridview splits their areas; its
sash resizes them. Headers move or stack panels within their own grid. The empty stage is absent; opening the first
environment adds it, closing the last removes it. A new task opens only its default development terminal.

**Stage** in the title bar offers **Position: Left, Right, Above** the development area, **View: Horizontal stack**
(side by side), **Vertical stack** (one above another), **Tabs** (one environment at a time), and **Open an environment**.
Moving Stage preserves the development grid and its panels; Terminal and Resources stay together. Resources keeps at
least its header's height so it can fold with the development terminal. The human's `stage:arrange` IPC and the agent's
`stage_arrange` tool call `Task.arrangeStage`: the task must be shown, and settings apply with an empty Stage too.
The task-scoped event reaches that window.

Each environment header offers **Maximize environment** and **Restore environment**, also in its menu
(`grid/EnvironmentFocus.tsx`). Dockview maximizes its group inside Stage, retaining its tabs and split sizes;
development stays visible. A maximized group fits the Stage viewport with overflow suspended. Restoring resumes
the stack and overflow setting.

**Follow agent** in the Stage menu is opt-in, saved globally in `settings.json` (`stageFollow`) and shared by
all tasks and windows. Browser MCP calls, CDP actions and named
Stage-terminal calls report the environment used (`stage:activity`; the plugin reports, the window follows).
`lib/grid.ts` selects a hidden tab and scrolls its group into view; visible groups keep their selection. Both
profile and terminal headers highlight activity for two seconds. Selecting or interacting with Stage pauses
following; **Follow agent (paused)** resumes it. A maximized group stays maximized, and background tasks never
move the shown Stage. Pause state and activity are transient in each window; the global preference resumes when another task opens.

**Allow overflow** is independent of the layout, off by default: panes fit the stage. On, Horizontal stack allocates 600 CSS
pixels of width per environment, Vertical stack 300 pixels of height, plus Dockview’s gaps; the stack scrolls on that axis.
Tabs hides the toggle and ignores overflow while preserving its value. Constraint changes give Dockview room for
both old and new group minimums before restoring its size; its resize observer can lag behind the scroll container.
`stage_arrange` accepts any combination of position, view and overflow; omitted settings stay unchanged. Changing
only overflow preserves the panes and active tab. `Stage.tsx` sizes
the inner grid inside its scroll viewport. Its scroll and all layout changes report page bounds and their visible
intersection (`lib/grid.ts`). `Profile` puts a partially visible page inside a native `View` at that intersection;
the child keeps its full viewport, offset within the parent. Fully offscreen pages are hidden. The clipping parent
is removed when the page fits, the profile closes, or it moves to another window. Dragging in either grid turns
pages into pictures for HTML drop targets.

`task.json` keeps Stage view/overflow/layout in `stage`, and development layout, Stage position/share in `workspace`, saved 300 ms after a change and flushed when the
task is left. `shared/stage-layout.ts` separates a flat saved layout into development and testing groups, retaining
panel order, stacking and sizes; development panels share an area, separate from Stage. Saved stack settings normalize to explicit horizontal and vertical directions without moving panes. An invalid grid falls back to its default arrangement.

**No environment open, a development terminal open**: a row above the workspace offers **Stage Terminal** and
the closed profiles (`ClosedProfiles`, `Grid.tsx`). With no development terminal either, the same choices sit under
the agents' launchers. More than fit scroll (`useStrip`); `#dock` keeps `min-width: 0` so these choices cannot stretch
the window. The title bar's **Stage → Open an environment** opens the same environments.

### Stage terminals

A Stage terminal (`grid/StageTerminalPane.tsx`) is the CLI or TUI under test, in its own stage pane. Its name,
optional launch command and fixed columns/rows are saved per task; every terminal starts a fresh shell when its task loads; saved app commands run through Run app. The pane’s Find… context-menu action and Ctrl+Shift+F (⌘+Shift+F on macOS) open an inline search bar; xterm’s search addon selects matches in retained output, with Enter/Shift+Enter navigation and Escape returning focus to the terminal. Search keys stay in the window. Runtime session kind records whether Kulisa launched a shell or app, independently of changes to the saved command. The header holds its status, Start, Run app, Restart app, Restart shell or Run again, Maximize/Restore, a **⋯** menu and Close;
the terminal fills the pane below it. Opening a terminal starts the user’s shell in the task folder.
A blank launch command starts a shell; a supplied command runs as the application session and keeps its final screen on exit. **Settings…** in the menu opens `StageTerminalSettings.tsx` for the saved name,
command and dimensions; empty dimensions fit the pane.
The task’s `StageTerminals` actions (`main/stage-terminals.ts`) serve the window and agent.
Its host contract supplies a terminal key, saved setup, availability, current launch context, persistence and window
notifications. `Task` wires these callbacks; dependency rules forbid the controller from importing task, window or
store types. Agent conversations and accounts stay in `Task`; Stage layout, menus and focus stay in the window.
`terminal_run(name, command, size?)` creates a Stage terminal or reruns the supplied command in that named terminal;
validation precedes stopping the previous process. The agent builds the app and chooses its command.
`terminal_read`, `terminal_input`, `terminal_resize`, `terminal_stop` and `terminal_close` provide the interactive bridge.
Development shells use `shell_run`, `shell_read` and `shell_stop` beside the coding agent. Launch uses the user's shell in the task's
current working folder, with shell startup settings; the process's exit code and final screen stay visible after
exit. Launch actions clear the previous run's screen. Stop cancels pending restarts, ends the session and keeps its final screen readable; Close also removes its setup and buffers. Closing a task stops its Stage terminals and keeps their setup for reopening.

A shell launch failure stays in the terminal’s runtime state (`launchError`) and appears as a selectable error
in its pane. A new launch attempt clears it; it is omitted from saved configuration.

**Send selection to agent** in a Stage terminal’s right-click menu captures xterm’s selected text when the menu
opens. A browser page uses Electron’s `selectionText` from its native context menu, except in password fields.
Both call `Task.sendSelection`: validate the source in the shown task, quote the text with its environment name
and browser tab, and use `typeForAgent` to append it to the draft without Enter. Terminal control characters
are removed before pasting; selected text is omitted from logs and saved nowhere. An open agent terminal is
required.

Manual Open and launch actions request keyboard focus for that terminal after a successful launch.
`lib/environments.ts` keeps one pending request; newer pointer or keyboard input, window blur or a task switch
cancels it. The pane applies it after its View and font are ready. Agent launches and Follow agent preserve the
existing keyboard focus.

The human types and pastes in the same PTY the agent operates. Screen reads flush xterm's parser and return the
current normal or alternate screen; scrollback reads are limited to 500 lines. Reads over 40,000 characters go to
bounded task artifacts with a short preview; Resources identifies their application source. Fixed dimensions are 2–500 columns
and 2–200 rows; Auto follows the pane. Stage terminal sizes are independent of development terminals. The shared
terminal Kulisa package owns the PTY, headless parser and visible View ([README](../src/terminal/README.md)); each
visible application uses WebGL with DOM fallback when WebGL is unavailable or its context is lost. Hidden environments keep their
process and bounded buffers. Shells share home directories, credentials and settings: these are execution places,
not separate identities. Real-account sign-in stays the human's.

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

A window made narrower or wider changes every panel in its share, as VS Code's and JetBrains' do (dockview's
`proportionalLayout`; it needs dockview 8.6.0 or later:
[1691](https://github.com/dockview/dockview/issues/1691), [1692](https://github.com/dockview/dockview/issues/1692)).

A pane's header (`ProfileHeader`, `components/grid/ProfilePane.tsx`): its profile's picture and name, a caption of what
the agent does in it (or that it is paused on a sign-in page), ⋯ (its menu, as a right-click on the header: Menus) and
×. It shrinks with the pane: the caption first, then the name, cut with … (the whole and the profile's description in
its tooltip); ⋯ and × stay. Under it the pane's tabs and its toolbar, ⋮ at its end ([profiles.md](profiles.md), Tabs).

The window itself never scrolls, also not from a script (`overflow` on `html` and `body`, `App.tsx`): a panel stacked
behind another is laid out below the grid (dockview), making the page taller than the window, and the tasks' bar
bringing its tab into view (`scrollIntoView`) would move the whole grid up by a window's height.

The profiles' pages are native views above the window's HTML ([ui.md](ui.md)) and belong to their project's window
(`Profile.moveTo`). While a panel is dragged, a menu is open or a dialog is shown, the pages are pictures of
themselves (or hidden), so the HTML can be on top; live again once nothing covers them (`livePages`). A page that
gives no picture (covered, the monitor off, busy) leaves its pane empty meanwhile: waiting would hold the menu and
every one after it. How long is the pages' own pace: once the first has answered, the rest get three times as long, a
tenth of a second at least (a live page answers in a few milliseconds on a fast machine, over a hundred on a slow
one); none answering, half a second (`AppWindow.pictures`).

A pane's tab strip and toolbar move as Chrome's, the terminals' tabs too: a tab opened grows in from the left
(`data-opening`, `useStrip` in `lib/strip.ts`; the strip keeps its tabs' elements by id, so only a new one animates),
the address's hover fades in. Not with reduced motion.

## The window's size

The window has a minimum, as VS Code's: 640×400 (DIP) times the Kulisa zoom (`MIN_SIZE` in `window.ts`), the smallest
at which the top bar (the OS buttons, ☰, a task's tab) and something under it fit; half of a 1366 px laptop screen holds
it. Fixed, not the sum of the panels' minimums (dockview's `minimumWidth`), which would keep a window with five profiles
in a row from half a screen next to the human's IDE. What the grid does when its panes do not fit: #202.

The OS keeps the minimum only while the human drags the window's edge (`minWidth`/`minHeight`, `setMinimumSize`; on
Linux a hint to the window manager). The constructor's bounds and `setSize` pass below it, so Kulisa raises a window to
it itself: bounds restored from `settings.json`, and a window now smaller when the zoom grows (`setZoom`; not made
smaller again when it goes down).

## Zoom

- **The Kulisa zoom**: Ctrl + / − / 0 outside the pages, or the zoom row in ☰. It scales the whole UI of every window,
  the terminal and the pages together (Chromium's zoom of the window's page; `setUiZoom` in `app.ts`). From 50% to
  200%: the window's minimum grows with it, and at 300% it is past a laptop's screen; the OS's own magnification is
  there for more.
- **A site's zoom**: the same keys in a page zoom that site in that profile on top of the Kulisa zoom, as in Chrome, to
  300%; shown in the address bar (a click resets it).

Both are saved (`settings.json`; the profile's `profiles.json`).

## Theme

**☰ → Theme**, a row opening a menu beside it: Dark (the default, as in JetBrains), Light or System (as the OS,
following it when it changes). Saved (`settings.json`), the same in every window.

- Only Kulisa's own UI changes: the profiles' pages keep the OS's light or dark (`prefers-color-scheme`), so a site
  under test looks as its users see it. So Kulisa does not set `nativeTheme.themeSource` (it would change every page's
  scheme); System reads `nativeTheme.shouldUseDarkColors` and its `updated` event.
- shadcn's theme does it ([ui.md](ui.md), shadcn in Kulisa): the root's `.dark` class and its `color-scheme`
  (`public/theme.js`), so the browser's own controls (scrollbars) follow; the grid takes dockview's colors from the same
  variables (`Grid.css`), a terminal its colors (`termStyle`). The choice comes in the page's URL, set before the first paint, so a
  light window never flashes dark.
- What CSS does not paint follows from the main process: the window's background and the OS buttons' strip
  (`window.ts`).

## Language

**☰ → Language**: the language the human speaks with the agents, one for all of them (one setting, so what the agents
do because of it is plain). A row with the language chosen at its end, opening a menu beside it (`ChoiceRow`): the
languages the agents' own settings take, the system's first, then by name in each language itself (`TopBar.tsx`, `LanguageRow`).
English by default, as the agents are without it. Saved (`settings.json`), the same in every window.

- Kulisa keeps the agents' own language settings in step and tells the agents nothing itself. An agent with one (its
  entry's `language`: Claude Code's `language`, which it dictates and answers in) gets it in every account's folder:
  when it is chosen, and at an agent's start (an account made since, or the setting changed in the agent's own
  `/config`), never in the human's own folder. Claude Code reads it again at once, in every running session. An agent
  without one (Codex) is not told otherwise: the row's tooltip names it ("has no language setting yet").
- One setting for dictation and answers: Claude Code's setting wins over an instruction to answer in another language
  (the SessionStart hook, `--append-system-prompt`). Which language code and comments are in is the project's to say,
  in its CLAUDE.md or AGENTS.md (with the setting alone, Claude Code writes comments in it too); the tooltip says so.

## Menus

Kulisa draws its menus in HTML, as Chrome does (shadcn's menus: `components/Menus.tsx`; how they open, close and are
built: [ui.md](ui.md), Menus):

- a task tab's right-click menu ([tasks.md](tasks.md), Projects, "A tab's right-click menu"), a project's and a task's
  row's in the sidebar ([tasks.md](tasks.md), The sidebar), ☰ (as Chrome's ⋮, each row with its icon: the zoom row;
  Theme, Tasks bar and Language, rows each opening a menu beside it, the choice at the row's end;
  Keyboard Shortcuts, the links (Documentation, the user guide on kulisa.app; GitHub; one list in `TopBar.tsx`),
  Report a Problem… (Settings at its Log page: not everyone has a GitHub account, and an issue without the log says
  little), About Kulisa (below), and Exit, which quits as the last window's × does; not on macOS, where Cmd+Q and the
  app's menu quit);
- right-click on a pane's header or its ⋯ (New tab, About this profile… (Settings at it), Sign In to Master…, Close
  profile, Remove from Project…), a pane's ⋮ ([profiles.md](profiles.md), Tabs), a tab (Reload, Duplicate, Close tab,
  Close other tabs), a terminal (Copy, Paste, Select all, Clear; then its tab's) and a terminal's tab (Change agent…,
  the dialog its icon opens, and New Conversation in an agent's; Close).

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

Every dialog has one look, as in JetBrains ([ui.md](ui.md), Dialogs). Questions before something that cannot be undone
(deleting a profile, a task, a project), before closing (a task while an agent works, a window, quitting while an agent
works: [tasks.md](tasks.md)) or between two ways to go (a second button, `other`) are asked in that dialog too
(`shell.ask` → `lib/ask.ts`, `Ask.tsx`, queued; its keys: [ui.md](ui.md), Dialogs), in the window the action is in
(Settings' too), the agent's in its task's window (`Asker` in `window.ts`). A tasks' window asked in comes to the front
with its question, restored when minimized, while another of Kulisa's windows has the focus (another tasks' window, a
master's): left behind, it would look as if nothing happened; never from another app. While a dialog
is open the profiles' pages are hidden (native views above the HTML), and the keys are the dialog's (Keys): a page that
had the keyboard would keep it unseen, the dialog's keys going nowhere, so the window's page takes the keyboard (`hideViews` in `window.ts`); a menu, over pictures of the
pages, puts the keyboard back itself as it closes. Not the
OS's own question (`dialog.showMessageBox`): it looks different on each OS and plain on Linux, and cannot mark the
deleting button or lay out what goes. The OS's own dialogs stay for choosing a folder.

## Settings

Settings (a nav of its categories: Projects, Agents and Profiles, [tasks.md](tasks.md), Projects; GitHub,
[src/github](../src/github/README.md), The window; Log, The log below; About, Menus above; a category's page lists its
things, each with its own page, as Windows' Settings) is shown
in a tasks' window, over all of it under the title bar (the sidebar, the grid, the tasks' bar), as Chrome's and VS
Code's settings are a page of their window: the window it is opened in is the one it acts for, with nothing to keep in front or in step.

- **Opened** by the gear (on macOS also Kulisa → Settings…, ⌘,, under About Kulisa: in the window last in front), a
  task tab's Manage Profiles… and Project Settings…, a pane's About this profile… and a project's Add Profile… tile, at
  that page (a project's: none named, the window's shown task's); shown already, it goes to that page. Each window has
  its own. No gear while Settings would be empty (no project, no account, no profile, as at the first start, where the
  welcome makes them); it comes with the first account signed in to. An account or a profile left after the last
  project is deleted keeps it: Settings is where they are removed (`settings` in the projects' news).
- **Shown in one go**, once its page is filled (not the agents: looked for again once it is drawn, the Agents page
  saying so while it has none); until then the window stays as it was. The profiles' pages are hidden once it is drawn
  under them (`coverPage`, `lib/cover.ts`): hidden before, the panes show empty until it comes.
- **The grid stays under it**, laid out and hidden (dockview's sizes, the terminals), its agents working on; the
  profiles' pages are hidden as under a dialog (`coverPage`, `lib/cover.ts`), and the keys are its own. A
  grid changed underneath (a task shown by the agent, the shown project deleted) leaves it open. The agent's questions
  show over it.
- **Closed** by Esc (unless a menu, a question or a popover is open: Esc closes that first; or a field takes it), its
  ←, or the gear; what is typed is saved first (a project's name); while an agent installs, it stays. The keyboard goes
  back where it was.
- **Its lists follow** what changes elsewhere while it is shown: the profiles made and let go in another window or by
  the agent (`settings:changed` to every window, on `profilesChanged`), its nav's and the shown project's; nothing
  typed on its page is touched.
- **Settings only**: a project is made in a tasks' window (New Project: the empty window with no project, New Project…
  at the sidebar's foot), which opens its first task: one way to open each.
- **Its code is a chunk of its own** (`components/settings/`, reached only by `import()` of its `index.ts`: `npm run
  deps`), read as Settings is first asked for: a window never showing it never parses it. A module is never unloaded, so
  once shown it stays in that window's memory: about 7 MB of its renderer (PSS), against some 80 MB for a window of its
  own.

## The terminal

A terminal sends its first size once dockview's grid matches its current room and the retained panel's DOM matches
its layout, so the program starts at the room it will keep when the panel is drawn. The comparison rounds Dockview's
fractional CSS dimensions to match DOM client/offset sizes; the same readiness check gates later resizes.

A task's terminals are one **panel** of the grid: the terminal in front, a **row of tabs** over it, the panel's header
(`TerminalsHeader` and `Terminals` in `grid/DevelopmentTerminals.tsx`). One terminal is shown at a time, none
split off into a panel of its own. Each is the user's shell in the task's folder (`src/terminal/`), an agent the human
chose started in it ([tasks.md](tasks.md), "Several agents in a task") or not. Each tab: the agent's icon (a shell's,
for a shell), its name whole, its state (an agent's: working, waiting for you, done), ×; more than fit scroll
(`useStrip`, `lib/strip.ts`; dockview's tab keeps `min-width: 0`, or it grows to its content and the tabs run past the
panel, + and the microphone with them). After the tabs, the panel's own **+** (a menu of the project's accounts, the
default first, each a new conversation; then Terminal, a shell); last, the dictation's microphone (Dictation, below).
The task's repositories are in the Resources panel, not in this row. The agent's icon opens **Change Agent**, a dialog
(the project's accounts: the one chosen opens in a new tab, told to go on with this conversation, a progress bar of
the parts of it read; [tasks.md](tasks.md), "Several agents in a task"). An agent's × asks first; a shell's closes it.
The terminal in front is named by the task and the tab from one message (`terminals`), not the task from the window's
shown task: that comes in another message, and between the two a terminal that does not exist would be shown.

**The last terminal closed folds the panel** to a strip of one button, + in its middle, as JetBrains' tool windows go
but with their button kept in place (the author's choice): by its height under or over the grid, by its width at a side
(dockview's constraints hold it there; the row goes). Alone in the grid (no profile open), the +'s rows are big buttons
in a line in the grid's middle, whatever the arrangement (its group fills the grid there, its header hidden): a
`data-launcher` button each, the agent's icon beside its name, an account's email under it, no keys (Ctrl+` opens the task's agent,
which the window does not show: a key on one of them would read as a mistake). Each is a Tab stop, Enter opens it; the
first, the project's default agent, gets the keyboard when they come, unless the keyboard is in something else (a
field, a dialog). Under them, a second row: the task's closed profiles, a `data-launcher` each, its picture beside its name
(The grid: No profile open). A terminal opened unfolds it to the size it had. Ctrl+` there opens a new conversation of
the task's agent; a task with none (its project had no default agent: [tasks.md](tasks.md), "Choosing the agent")
gives the keyboard to the buttons, or opens the +. A task that never had a terminal opens its agent, or nothing (the
buttons).

**A tab comes before its program.** An agent's tab is there at once, before its program is looked for (the user's
login shell, its `--version`: a second or so): until it starts, a status over its terminal, a spinner and "Starting
Claude Code…" (`starting` in `Sent.Terminals`, the tab without its `pty`). Its terminal stays
laid out under it, so the program starts at its size. Not found and none chosen in its place (Choose the Agent,
Cancel), the tab goes. A task opening sends its tabs with its first state, each starting (`Window.showLoaded`, then
`Task.loadTerminals`), so the folded panel's buttons do not show while the agents are looked for. A pick or a
dictation meanwhile goes nowhere: the human gives it again.

Files dropped onto a terminal insert their paths, quoted for its shell and separated by spaces, without Enter
([src/terminal](../src/terminal/README.md)).

A clipboard image pasted through the OS's Paste action or the terminal's menu sends the agent's `imagePaste`
shortcut (`Task.pasteImage`); the agent reads the clipboard itself. Shells and agents without that shortcut receive
no image input. The terminal's image hook knows only its key; the agent's definition owns the shortcut.

The terminal itself (a pty in the user's shell, its output in a buffer, one xterm a place that shows it, the keys of the
OS's own terminal, its size) is a Kulisa package, `src/terminal/` ([packages.md](packages.md); its
[README](../src/terminal/README.md)). The panel is the task's: its tabs, its agents, its shells.

**Shells**: the human's (+ → Terminal, `Terminal`, `Terminal 2` …) and what an agent keeps running for the human to see
(`shell_run`: the app's dev server, `docker compose up`), behind the tab in front so the human goes on watching the
agent. Each is the user's shell in the task's folder with the agent's environment (`KULISA_MCP_URL`, `KULISA_URL`,
`KULISA_TASK`), the command typed in, so the human can stop it, type into it and read it; an agent reads its last lines
as the screen shows them (`shell_read`, colors left out) and presses Ctrl+C (`shell_stop`), in shells only, never
another agent's tab. Not the agent's own background shell: some agents cannot keep a process running (Codex waits on
it), and the human does not see what runs there. The task closing ends what runs in it. As in an IDE, the terminals are
kept (`task.json`): when the task loads again (a restart, the task opened again) each comes back in its tab, the
one in front too, an agent's conversation resumed, a shell with nothing running; the agent runs its command again. ×,
the menu's Close, `shell_stop` with close, or the shell's `exit` ends one for good (`Task.openTerminal`,
`openAgent`, `runInTerminal`, `interruptTerminal`, `readTerminal`, `closeTab`).

**Dictation**, where the agent in front has its own ([tasks.md](tasks.md), "Choosing the agent"), is a key held: the
**right Ctrl** (the right ⌘ on macOS: Apple keyboards have no right Ctrl), anywhere in the window (a profile's page, its
address bar, the terminal, the bar): held, it records until let go; pressed once, until the next press (how it records,
and the microphone: [src/dictation](../src/dictation/README.md)). A key, not a button: speaking to the agent happens
hundreds of times a day. One key held alone, no chord: users are not pianists. That one: a modifier alone types nothing
and does nothing in any page or terminal, so it is taken from no one (the page keeps its chords), and it sits at the
right hand's edge, where push-to-talk keys go; the space bar, Claude Code's own key, is the page's in a page. The human
may hold another key instead: Keyboard Shortcuts, Change on its row, then the key pressed (a modifier by its side, an F
key not Kulisa's, Insert, Pause or Scroll Lock; a key that types is refused, saying so); kept in `settings.json`
(`keys`), every window told (`keys:set`, `shell.keys()`; `Shortcuts.tsx`). With a shell in front, the key brings the
agent the prompt goes to in front first (`Task.holdKey`, `promptTarget`): it always means "speak to the agent".

The key's indicator, and the way by the mouse, is the round microphone at the end of the terminals' row of tabs
([src/dictation](../src/dictation/README.md), The microphone); what the dictation does meanwhile is the pill at the
terminal's top, a badge (the same, The pill). The agent hears through its own program (Claude Code: its audio
module, or `arecord`/SoX on Linux); on macOS the system asks for the microphone on Kulisa's behalf
(`NSMicrophoneUsageDescription`, `forge.config.ts`); the pill's wave is the window's own reading of it, the level
only.

Links in the terminal open with Ctrl+click (⌘ on macOS; which links: [src/terminal](../src/terminal/README.md)) and
always ask where, in a menu at the pointer (the panel's `termHooks.open`): a new tab in one of the shown task's open
profiles, or the user's browser. Every time, so a link never lands where the human did not expect: which profile a link
belongs to cannot be told, and a rule such as "where that site is open" is not obvious.

A path that exists is a link the same way, and so is a file an agent marks as one (the terminal finds the candidates;
the main process says which exist, relative to the task's folder, `~/` from the home folder: `file-links.ts`, its
channel `terminal:files` not logged, as it comes on every hover). Ctrl+click asks in the same menu: Open (the OS's app
for it, `shell.openPath`) or Show in Folder (`shell.showItemInFolder`). What would run when opened (a file with `+x` on
Linux and macOS; by its extension a Windows program or script, a `.desktop`, a macOS `.app`) is only shown in its
folder, checked again in the main process when opened, as the window's answer may be stale. A `file://` address opens
only when its host is this computer (none, `localhost`, or its name): one of another host, as `ls --hyperlink` gives in
an ssh session, never opens the same path here (the OSC 8 spec,
gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda).

## Keys

Kulisa's keyboard shortcuts, as an IDE has them, are one table (`src/main/keys.ts`): the keys, the command each does,
and where; the window's menus, the buttons' tooltips ("Reload (Ctrl+R)", `withKeys`) and **Keyboard Shortcuts** (☰, or
Ctrl+Shift+/: `Shortcuts.tsx`) show them from it, as this OS writes them (⇧⌘T on macOS).

Who gets a key depends on where the keyboard is, and **the keyboard stays where the human put it**: a profile's page
takes it only from the human (a click or a key in it), or from Kulisa for them (a tab chosen by a key, Ctrl+`, their
dialog answered, Pick, an address from its pane's bar). A page taking it by itself, as one loading does (a tab the agent
opened, a redirect: on macOS every one does, and the next keys typed to the agent would go to the site), gives it back
to where it was in its window (`page-focus.ts`). On macOS a real click is the page's focus, then the click 2 ms later: a
page's focus is the human's when their input in it comes within 150 ms of it, before or after. A focus given back
150 ms later is not given back over Kulisa's gift of it since (Ctrl+` at once after a page loaded). Each decision is a
line in the log (`[focus]`): given back, or left and why.

- **In a profile's page, or its pane** (its address bar, its toolbar): Chrome's keys, for that pane: Ctrl+T a new tab
  with the address to type in, Ctrl+W, Ctrl+Shift+T (the tab closed last: its address, kept in memory, ten at most),
  Ctrl+L / Alt+D / F6, Ctrl+R / F5, Ctrl+Shift+R (not from the cache), Alt+← / →, Ctrl+Tab, Ctrl+PgDn / PgUp,
  Ctrl+1…8, Ctrl+9; Ctrl+Shift+C for Pick (Chrome's Inspect), Ctrl+Shift+S for a screenshot of an element
  ([src/screenshots](../src/screenshots/README.md)). The site does not get them, as in Chrome. Closing or switching a
  tab from the page leaves the keyboard in the page shown next.
- **Everywhere, the terminal too**: Ctrl+` to the terminal in front and back to the page used last (on the folded
  terminals, a new conversation of the task's agent), Ctrl+Shift+` a new terminal, Ctrl+Shift+1…9 the bar's first to
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
or leaves it untouched. Where the keyboard is in the window's own page, the page tells it (`keys:zone`: the terminal, a
dialog, a pane; `src/renderer/lib/keys.ts`), which also runs the commands the main process sends back (`command`, with
the profile and tab). Letters are matched by what they type on a Latin layout (Ctrl+W on an AZERTY keyboard is its W)
and by their place on others (Ctrl+Е on a Russian one is Ctrl+T); digits and keys typed with Shift by their place. Keys
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

What happened and who asked, for a bug the author cannot watch (a user's, another OS's): `logs/kulisa.log` in the data
folder ([tasks.md](tasks.md), "What is on the computer"), written by electron-log (MIT, the most used: the file and its
turnover, Electron's own events) with lines of Kulisa's own (`log.ts`). At 1 MB it becomes `kulisa.old.log` and a new
one starts: 2 MB at most. The same place on every OS (electron-log would put macOS's in `~/Library/Logs`): one path to
name in the guide, and the tests' log in their own folder. The lines go to the console too (`npm start`'s terminal,
the tests' output) until it has no reader (the terminal closed, `npm start | head`): then the console transport goes
off at its first failed write, and the file goes on. Left to Node, that write is an uncaught exception, which `app.ts`
logs to the console again, and so on, in nextTicks that let nothing else run: Kulisa would stop answering the OS. Each
line has the time (ISO 8601 with the computer's offset, `stamp`: a user's log is read next to times from another zone;
electron-log's own has no offset), the level and a tag:

- `[kulisa]`: the start (the version, Electron's, the OS and its session, X11 or Wayland, packaged or from source, the
  data folder), whether the OS keeps Kulisa's key (`encryption available`, on Linux which keyring; `basic_text` is
  none: a warning), quitting. At a start, that the run before did not say it quit (`quitSaid`, from the file's end): a
  crash of the main process, a kill or the computer going down, which nothing else can write; a crash leaves its
  minidump in `crashDumps` (Electron's crashReporter, `uploadToServer: false`: Crashpad keeps them, pruned by itself,
  90 days or 128 MB; no server), to ask a user for.
- `[ipc]`: every channel a window sends (`ipc.ts`, `handle` and `on`), the sender's webContents id (`wc=`: a window's,
  a master's; `[window] new wc=` says which) and its arguments; an answer refused, with its reason. Not the
  terminal's keystrokes and size (never: what is typed), nor what comes at every change or draw (`QUIET`: the grid's
  boxes, layouts, lists read again; Settings shown and closed, `[settings]`'s), and a question's answer without the
  answer.
- `[mcp]`: every tool the agent calls (`mcp-server.ts`), its task and terminal, its arguments; one that failed, with
  its error.
- `[key]`: a key of Kulisa's taken (`shortcuts.ts`), where the keyboard was.
- `[page-menu]`: a row of a page's right-click menu chosen (`page-menu.ts`), its profile and tab.
- `[hook]`: an agent's hook event (`agent-hooks.ts`), its task and terminal.
- `[project]`: a project loaded, its id named by the project's name and folder (the home folder as `~`):
  `[project] k3f9a2 loaded: shop (~/IdeaProjects/shop)`; renamed, by whoever renamed it, only when its name changed (a
  save writes every field): `[project] k3f9a2 renamed: Shop-2`. Its id is random (tasks.md, What is on the computer):
  it comes with the name where it first appears in a run, alone after, the key a line is found by.
- `[task]`, `[window]`, `[settings]`, `[terminal]`: a project's task opened, created (its project's name, where:
  `[task] created k3f9a2/1 (shop) in ~/IdeaProjects/shop@task-1`), closed, deleted; a window made, showing a task,
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
- TanStack Virtual draws the visible entries with a buffer; wrapped entries are measured, and the whole log scrolls
  continuously. Filters search the whole log before virtualization. Stable entry ids keep measurements across filters.
- A line each with its time (the date in its tooltip) and its tag, the tag in the color of who acted (the theme's: success the agent, warning the human,
  the text's the tasks), warnings and errors in red; what is not a line of that shape (an object's lines under an
  `[electron]` event) hangs under the line before it. **Follow** keeps the end in view, as a terminal does, lets go when the log is scrolled up, and
  goes back to the end when checked again.
- What to show (a toolbar's radio buttons, one always chosen) and a text filter on top of it (a task's key, `wc=1`, a
  tag): **All**; **Errors** (warn and error lines, `[page]`, `[electron]`, an action refused or failed); **Agent**
  (`[mcp]`, `[hook]`, `[terminal]`); **Human** (`[ipc]`, `[key]`, `[settings]`); **Tasks** (`[task]`, `[window]`,
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

A window's page and the main process talk by named channels: `invoke` (an answer comes back), `send` (none), and the
main process's messages to a page. Each channel is declared once, in `src/shared/ipc.ts`: what it takes and what it
answers (`Invoke`, `Send`, `Events`); `npm run build` checks both ends against it. The main process's end goes through
`handle` and `on` (`src/main/ipc.ts`), in a file a domain (`src/main/ipc/`), and `AppWindow.send`; the page's through
the bridge's types (`env.d.ts`) and `act`, which adds the task shown (a message about the shown task's profiles and
tabs is refused once another is shown). A new channel is declared there first, then its two ends. A message acts in the
window it comes from (`event.sender`); one change to the open tasks after another (`serial`).

- An answer the page does not read is `void`: the main process may answer anything there (the tests read some).
- An answer that may be a refusal is a `Result` (`src/shared/result.ts`), read with `refused()`, so the types keep a
  page from reading `r.accounts` after a no (`{ error: null }`).
- What crosses comes from the page and is checked again where it matters (a theme, a name); the types say what a
  well-behaved page sends, not what any page may.
- The tests call channels by their names in pages (`invoke` and `act` in `test/e2e/helpers.ts`, through
  `page.evaluate`): those are not checked.

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
| `src/renderer/components/settings/`, `lib/settings.ts` | Settings: its nav and its pages, a chunk of its own; shown and closed (Settings) |
| `src/preload/index.cjs` | the window's bridge to the main process: the windows' pages are sandboxed (no Node: about 15 MB less a window, PSS), so it is a few lines of plain JavaScript; the window imports what it shares with the main process from `src/shared/` (`names.ts`, `avatars.ts`, `result.ts`) |
| `src/main/log.ts` | the log: the file (electron-log), `summary` of an action's arguments, the Log page's reading and following of it, the issue's address (The log) |
| `components/settings/LogPage.tsx`, `AboutPage.tsx` | the Log and About pages of Settings (The log; Menus, About Kulisa) |
| `src/main/keys.ts` | the keyboard shortcuts: the table, which key an input event is; `shortcuts.ts` takes them (Keys) |
| `src/terminal/` | the terminal, a Kulisa package: its pty, its buffers, the xterm shown ([README](../src/terminal/README.md)) |
| `src/main/file-links.ts` | the paths a terminal names: which exist, opening one or showing it in its folder (The terminal) |
| `src/renderer/components/Grid.tsx`, `components/grid/`, `lib/grid.ts` | the grid (dockview), the panes and their headers, the terminals (`grid/DevelopmentTerminals.tsx`: `Terminals`, its row of tabs `TerminalsHeader`), the closed profiles' buttons over it (`ClosedProfiles`, `Grid.tsx`), the title-bar Stage menu (`StageMenu.tsx`) |
| `src/renderer/components/grid/Resources.tsx` | Resources next to the terminal: the shown task's resources (its worktree(s) or the main working tree) and its artifacts, each with its actions (tasks.md) |
| `src/renderer/components/TopBar.tsx`, `ProjectIcon.tsx` | the title bar, ☰ and its own rows; the logo, a project's icon |
| `src/renderer/components/Menus.tsx`, `Ask.tsx`, `lib/menu.ts`, `project-menu.ts`, `cover.ts`, `views.ts`, `ask.ts`, `terminals.ts` | the menus (`project-menu.ts`: a project's, the sidebar's and a tab's), the dialogs and questions (shadcn's: `cover.ts`), the pages under them in a tasks' window (`views.ts`), a tasks' window's terminals (`terminals.ts`) |
| `src/renderer/lib/keys.ts`, `components/Shortcuts.tsx` | where the keyboard is, the commands the keys run; Keyboard Shortcuts |
| `test/e2e/window.spec.ts`, `grid*.spec.ts`, `keys.spec.ts`, `log.spec.ts`, `zoom-and-closing.spec.ts`, `test/unit/keys.test.ts` | the tests |
