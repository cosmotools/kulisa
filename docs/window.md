# The window

How a Kulisa window works for the human: the title bar, the grid of panels, the projects' bar, the zoom, the menus
and dialogs, the terminal, the keyboard shortcuts, and why they are built so. Projects and their tasks in the projects' bar, several
windows: [tasks.md](tasks.md);
profiles' panes and tabs: [profiles.md](profiles.md); the components the window is built of: [ui.md](ui.md); what is
next: [ROADMAP.md](ROADMAP.md). Keep this file current when the window changes.

## The title bar

One row: the app's logo (the shown group's project's color on its curtain), Projects (the projects' manager:
[tasks.md](tasks.md), Projects), ☰, and the OS's window buttons drawn over its right end (`titleBarStyle: 'hidden'` with
`titleBarOverlay`); no menu bar. Dragging the empty part moves the window. When the Kulisa zoom is not 100%, the bar
shows it (a click resets it).

Pages never drag the window, as in Chrome. Without a system title bar Electron takes `app-region: drag` from every
view in the window, the profiles' pages too, and keeps a region after its page has gone: Teams
(`teams.cloud.microsoft`, whose code is shared with the Teams desktop app) declares one, and from then on every click
and wheel over the panes, the grid's sashes too, went to dragging the window; mouse moves still passed, so the pages
looked frozen. Maximized, the window cannot be dragged, which made it work now and then (found 2026-10-08; reproduced
in bare Electron 44 with `titleBarStyle: 'hidden'`, not with a system title bar). Every document of a profile gets
`app-region: no-drag` on all elements (`insertCSS`, user origin, `!important` beats the page's), which also replaces a
region left behind. A page can read that value (`getComputedStyle`), where Chrome says `none`; `none` would not
replace a region left by the page before.

## The projects' bar

Under the grid, in the middle: an island per group (a project's open tasks), drawn as Chrome's tab groups (its label, which folds it;
its open tasks' tabs; + for a new task, its right-click New Task with one of the project's agents), then Search Tasks, every project's tasks ([tasks.md](tasks.md), Projects). ☰ → **Projects bar: Top, Bottom** puts it over the grid instead, under the
title bar (`settings.json`: `bar`; the page gets it in its URL, so it is drawn in its place at once). Bottom is the
default: the hand goes to the terminal under the grid all the time, so the tabs are where it already is; at first
the projects were tabs in the title bar and the tasks a strip under the grid, and both switched with the same
slide, which mixed them up (2026-10-08). Each island looks like a tab of the grid, its flat side on the grid and
merging into it with curves; the grid leaves no gap on that side. The grid is one dark box (`--well`, a step from its panels, so they
stand apart) from edge to edge of the window, square, the gap inside it, its panels' gaps dark too; the islands are
of its color, so an island merges into it wherever it meets it: on the window's glow, over a gap between two
panels (profiles side by side, a split row), its curve hung in the air (2026-10-08). Its tabs are a step taller than a button and never
narrow, targets for a quick throw of the mouse; nothing in the bar moves when another project or task is shown.

## The grid

A task's profiles' panes and its terminal are peer panels in a grid (dockview), in JetBrains' Islands look:
drag one by its header to another place, onto another panel to stack them as tabs, drag the gaps to resize. A
panel stacked behind another hides its page until it is chosen. **☰ → Arrange panels** offers ready-made
arrangements, each drawn as a small picture of itself, as Windows' snap layouts (the words in its tooltip):
profiles in columns with the terminal below, two by two with the terminal on the right, one profile at a time.
Each fits the window with nothing cut off. The grid is saved per task (`layout.json`) and restored.
The task's other terminals ("The terminal") are panels too, next to the agent's; an arrangement keeps them there.

The window itself never scrolls, also not from a script (`overflow` on `html` and `body`, App.vue): a panel stacked
behind another is kept laid out below the grid (dockview), which made the page taller than the window, and the
projects' bar bringing its tab into view (`scrollIntoView`) moved the whole grid up by a window's height
(2026-10-09, after an agent's turn ended).

The profiles' pages are native views above the window's HTML (CLAUDE.md, "What must hold in the window"). While a
panel is dragged, a menu is open or a dialog is shown, the pages are pictures of themselves (or hidden), so the
HTML can be on top; they are live again after. A page that gives no picture within 500 ms (covered, the monitor off,
busy) leaves its pane empty meanwhile: waiting for it held the menu, and every one after it.

A pane's tab strip and toolbar move as Chrome's: a tab opened grows in from the left (`.tab.opening`; the strip keeps
its tabs' elements by id, so only a new one animates), the address's hover fades in. Not with reduced motion.

## The window's size

The window has a minimum, as VS Code's: 640×400 (DIP) times the Kulisa zoom (`MIN_SIZE` in `window.js`), the
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
  window, the terminal and the pages together (Chromium's zoom of the window's page; `setUiZoom` in `app.js`). All
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
  (`window.js`).
- The terminal takes the panels' colors (`term.options.theme`, set again on a change); the programs' own colors stay
  xterm's, made readable on either background by its `minimumContrastRatio` (as VS Code does), with no palette of
  Kulisa's own.

## Menus

Kulisa draws its menus in HTML, as Chrome does (Reka UI's menus: `components/menu/`; [ui.md](ui.md), Menus): a
button's opens on the press (press, drag to a row, let go there), a right-click's at the pointer, one at a time; the
pages are pictures of themselves meanwhile; afterwards the keyboard is back where it was:

- the button after the projects' islands (the projects), +'s right-click menu (New
  Task with each of the project's agents), the profiles' chip on the shown task's tab (open
  and closed profiles, Manage Profiles…; the tab's right-click menu has them too, with Show Folder), ☰ (as Chrome's ⋮, each row with its icon: the zoom row, the theme row, the
  projects' bar's row, Arrange panels, Agents…, Keyboard Shortcuts, the links
  (Documentation, GitHub, Report an issue; one list in `lib/common.ts`), and Exit, which quits as the last window's × does; not on macOS, where
  Cmd+Q and the app's menu quit; under them all Kulisa's version, small and dim: words, not a row, as nothing happens on a click);
- right-click on a pane's header (New tab, About this profile…, Sign In to Master…, Refresh from Master…, Close profile,
  Delete profile…), a tab (Reload, Duplicate, Close tab, Close other tabs) and a terminal (Copy, Paste, Select all, Clear;
  then Change agent… in the agent's, Close in the others).

A project label's right-click opens its group's panel instead, as Chrome's tab groups have it ([tasks.md](tasks.md),
Projects): its name typed there, which a menu would take for its rows (a menu finds a row by the letters typed and
moves the focus under the pointer); it looks and closes as a menu (`GroupPanel.vue`; [ui.md](ui.md), Panels).

A row whose command has a key shows it at its end (Keys, below).

Native menus were tried first (2026-10-05): rows of text only, no buttons in a row; and a native menu in a page had
frozen the desktop (ROADMAP, Deferred ideas, "A right-click menu in pages"). There is no menu in the pages yet.

## Dialogs and questions

Every dialog has one look, as in JetBrains: the title with × on top, the content, the buttons at the bottom right,
the main one last (blue; red when it deletes) ([ui.md](ui.md), Dialogs). Questions before something that cannot be
undone (deleting a profile, a task, a project), before closing (a group or a task while an agent works, a window,
quitting while an agent works: [tasks.md](tasks.md)) or between two ways to go (a second button, `other`) are asked
in that dialog too (`shell.ask` → `lib/ask.ts`, `Ask.vue`, queued, Cancel focused; Esc is Cancel, a click outside
does nothing: it waits for an answer), in the window the action is in. While a dialog is open the profiles' pages are
hidden (they are native views above the HTML), and the keys are the dialog's (Keys). Not the OS's own question (`dialog.showMessageBox`): it looked different on each OS and plain on Linux, and
could not mark the deleting button or lay out what goes. The OS's own dialogs stay for choosing a folder.

## The terminal

A terminal per task for its agent (xterm.js in the window, node-pty in the main process: `terminal.js`), running
the agent the human chose ([tasks.md](tasks.md), "Choosing the agent") unchanged. Unicode 11 widths (the cursor stays
put after an emoji), a bundled font, the GPU renderer. Copy and paste take the keys of the OS's own terminal, so hands
need nothing new: Ctrl+Shift+C / V (GNOME Terminal, Konsole); on Windows also Ctrl+V, and Ctrl+C copies a selection,
else interrupts (Windows Terminal); on macOS ⌘C / ⌘V (the app menu's). xterm leaves those keys to the app, as VS Code
sets its own; otherwise Ctrl+C and Ctrl+V go to the agent (Claude Code pastes an image with Ctrl+V, with Alt+V on
Windows). The paste itself is Chromium's, which xterm takes (pasting again from Kulisa had doubled it).
With nothing selected in xterm, copying keeps the clipboard: Claude Code's fullscreen rendering selects with its own
mouse and copies on release itself (code.claude.com/docs/en/fullscreen; an empty copy had wiped it); Shift held while
dragging selects in xterm instead.

**Other terminals** next to the agent's, each a tab in its panel's group (dockview's: moved, split off and saved as
any panel): the human's shells (+ in the agent's terminal's header, `Terminal 2` …) and what the agent keeps
running for the human to see (`terminal_run`: the app's dev server, `docker compose up`), behind the agent's tab
so the human goes on watching the agent. Each is the user's shell in the task's folder with the agent's
environment (`KULISA_PORT_OFFSET`), the command typed in, so the human can stop it, type into it and read it as
in their own terminal; the agent reads its last lines (`terminal_read`, colors left out) and presses Ctrl+C
(`terminal_stop`). Why not the agent's own background shell: some agents cannot keep a process running (Codex waits
on it), and the human does not see what runs there. The task closing ends what runs in it. As in an IDE, the terminals are kept (`terminals.json`): when the task loads again
(a restart, its task opened again) each comes back in its place in the grid, its shell with nothing running; the
agent runs its command again. × or the menu's Close, or the shell's `exit`, ends one for good
(`Task.openTerminal`, `runInTerminal`, `interruptTerminal`, `readTerminal`, `closeTerminal`). The main process
keeps each one's last 200 KB of output for the agent, in memory.

**Dictation**, where the shown task's agent has its own ([tasks.md](tasks.md), "Choosing the
agent"): the terminal's header ends with the language it hears (EN, RU …) and a microphone (`Dictation.vue`). The
microphone works as a voice message's button: held, the agent records until it is let go; a click starts and another
click stops (or 5 minutes, a recording left on). The text goes where the cursor is in the agent's input, after what
is there, so several sentences can be dictated one after another, and is left there to read and send (recognition
makes mistakes, and a task misheard costs more than a key). Kulisa only holds the agent's key (`Task.dictate`);
the agent records and recognizes. The button is lit while Kulisa holds it, which is when the agent records. The language opens a menu of those the agent
understands, the system's first; it is the agent's own setting, so the agent answers in it too (said on hover).
The agent hears through its own program (Claude Code: its audio module, or `arecord`/SoX on Linux); on macOS the
system asks for the microphone on Kulisa's behalf (`NSMicrophoneUsageDescription`, `forge.config.js`).

Links in the terminal, those an agent marks (OSC 8, as Claude Code does) and addresses in plain text (xterm's web-links
addon), open with Ctrl+click (⌘ on macOS), and always ask where, in a menu at the pointer: a new tab in one of the
shown task's open profiles, or the user's browser. Asked every time, so a link never lands somewhere the human
did not expect (the author's choice, 2026-10-08: which profile a link belongs to cannot be told, and a rule such as
"where that site is open" was not obvious). Only `http` and `https`; the address shows on hover. xterm's own handler
asked with the browser's `confirm()`, an OS dialog. Keys are known by `keyCode` too, as ibus with a Cyrillic layout leaves
`code` out. The agent starts once the terminal is laid out, at its real
size. The rows that fit sit in the middle of the panel, what is left under a whole row shared above and below them:
at the bottom, it was a row's height under the agent's status line in one task and nothing in another, whose
grids differed by a pixel (2026-10-08). When a project moves to another window, what its terminals show moves along (xterm's serialize addon, as VS
Code keeps terminals), at the same size.

## Keys

Kulisa's keyboard shortcuts, as an IDE has them, one table for all (`src/main/keys.js`): the keys, the command each
does, and where; the window's menus, the buttons' tooltips ("Reload (Ctrl+R)", `withKeys`) and
**Keyboard Shortcuts** (☰, or Ctrl+Shift+/: `Shortcuts.vue`) show them from it, as this OS writes them (⇧⌘T on macOS),
so they are never out of date.

Who gets a key depends on where the keyboard is:

- **In a profile's page, or its pane** (its address bar, its toolbar): Chrome's keys, for that pane, as the hands know
  them: Ctrl+T a new tab with the address to type in, Ctrl+W, Ctrl+Shift+T (the tab closed last: its address, kept in
  memory, ten at most), Ctrl+L / Alt+D / F6, Ctrl+R / F5, Ctrl+Shift+R (not from the cache), Alt+← / →, Ctrl+Tab,
  Ctrl+PgDn / PgUp, Ctrl+1…8, Ctrl+9; and Ctrl+Shift+C for Pick (Chrome's Inspect). The site does not get them, as in
  Chrome. Closing or switching a tab from the page leaves the keyboard in the page shown next.
- **Everywhere, the terminal too**: Ctrl+` to the agent's terminal and back to the page used last, Ctrl+Shift+` a new
  terminal, Ctrl+Shift+1…9 a task of the shown project, Ctrl+Shift+PgDn / PgUp the next or previous one of every
  open project (in the bar's order), Ctrl+Shift+N a new task, Ctrl+Shift+A Search Tasks (Chrome's Search tabs),
  Ctrl+Shift+/ the list. Ctrl+Shift+… and Ctrl+` are
  what agents and sites leave alone; Alt+letters are Claude Code's (Alt+V, Alt+P, Alt+T), Ctrl+Alt+arrows GNOME's,
  Ctrl+Shift+U and E ibus's, so Kulisa takes none of them.
- **In the terminal** every other key is the agent's (Ctrl+R, Ctrl+T, Ctrl+O …), with the copy and paste of the OS's
  terminal (The terminal, above).
- **In a dialog** its keys are its own; only the zoom works there.

The zoom and DevTools keys mean the nearest: in a page that site's zoom and that tab's DevTools, elsewhere Kulisa's.
No key without a modifier but F keys (WCAG 2.1.4). On macOS the keys are ⌘'s and Ctrl stays the terminal's;
tasks are ⌘⌥1…9 (⌘⇧3, 4, 5 are macOS's screenshots), back and forward ⌘[ and ⌘] as in Chrome.

How: the main process sees every key of the window and of every tab before the page does (`before-input-event`, on
every webContents as it is made: `app.js`), and takes one of Kulisa's (`preventDefault`: the page never gets it) or
leaves it, untouched. Where the keyboard is in the window's own page, the page tells it (`keys:zone`: the terminal, a
dialog, a pane; `src/renderer/lib/keys.ts`), which also runs the commands the main process sends back (`command`, with
the profile and tab). Letters are matched by what they type on a Latin layout (Ctrl+W on an AZERTY keyboard is its W)
and by their place on others (Ctrl+Е on a Russian one is Ctrl+T); digits and keys typed with Shift by their place. Keys
are written as Electron's accelerators (`CommandOrControl+T`).

Not Electron's application menu with accelerators, its own way of keys, tried first in bare Electron 44 (REPORT,
"Keyboard shortcuts"): on Linux the page gets a key before the menu, and the menu none that the page handled itself,
as xterm and many web apps do: Kulisa's keys would not work in the terminal nor in those apps, and others would act
twice (the site's and Kulisa's). Nor `globalShortcut`: it takes keys from every app on the computer. macOS has its own
menu bar with Quit, Hide, the Edit menu (⌘C, ⌘V) and the windows (Electron's default one reloaded Kulisa's own page with
⌘R); Linux and Windows windows have no menu.

## DevTools

A pane's ⋮ menu (where more of a pane's actions will go, as in Chrome), or F12 or Ctrl+Shift+I in its page, opens
the active tab's DevTools in a window of their own. Kulisa's own DevTools (F12 outside the pages) exist only when
running from source (`appDevTools`, off when `app.isPackaged`).

## The app icon and installers

The icon is a stage curtain drawn apart with the agent's pointer (`assets/icon.svg`, rendered for each OS by `npm run
icons`): in the title bar, the taskbar and the installers. Run from source, GNOME's dock shows a generic icon: it
takes icons from installed `.desktop` files only (the `.deb` installs one matching the window class `kulisa`); left
so on purpose.

Installers are made with Electron Forge (`npm run make`, `forge.config.js`): `.deb` on Linux (checked: it installs
`chrome-sandbox` setuid root, a menu entry and the icon, and the app starts), Squirrel `.exe` on Windows,
`.dmg`/`.zip` on macOS (those not built yet).

## The code

| File | What |
|---|---|
| `src/main/app.js` | the windows, the Kulisa zoom, the theme, the IPC |
| `src/main/window.js` | a window: its BrowserWindow, the native views' places, its questions, screenshot |
| `src/main/keys.js` | the keyboard shortcuts: the table, which key an input event is; `app.js` takes them (Keys) |
| `src/main/terminal.js` | the ptys: the agent's per task, and its other terminals; their output's last 200 KB |
| `src/renderer/components/Grid.vue`, `grid/*.vue`, `lib/grid.ts` | the grid (dockview), the panes and their headers, the terminals' panels, Arrange panels |
| `src/renderer/components/TopBar.vue`, `menu/*.vue` | the title bar, ☰ and its own rows |
| `src/renderer/components/menu/*.vue`, `Modal.vue`, `Ask.vue`, `lib/menu.ts`, `views.ts`, `ask.ts`, `terminals.ts`, `voice.ts` | the menus, the dialogs and questions (Reka UI's), the pages under them, the terminals, dictation |
| `src/renderer/lib/keys.ts`, `components/Shortcuts.vue` | where the keyboard is, the commands the keys run; Keyboard Shortcuts |
| `test/window.js`, `grid.js`, `keys.js`, `zoom-and-closing.js`, `unit/keys.test.js` | the tests |
