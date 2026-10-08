# The window

How a Kulisa window works for the human: the title bar, the grid of panels, the projects' bar, the zoom, the menus
and dialogs, the terminal, and why they are built so. Projects and their workspaces in the projects' bar, several
windows: [workspaces.md](workspaces.md);
profiles' panes and tabs: [profiles.md](profiles.md); the components the window is built of: [ui.md](ui.md); what is
next: [ROADMAP.md](ROADMAP.md). Keep this file current when the window changes.

## The title bar

One row: the app's logo (the open project's color on its curtain), Profiles ▾, ☰, and the OS's window buttons drawn over its right end (`titleBarStyle: 'hidden'` with
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

Under the grid, in the middle: an island per open project with its workspaces' tabs, then the projects' menu
([workspaces.md](workspaces.md), Projects). ☰ → **Projects bar: Top, Bottom** puts it over the grid instead, under the
title bar (`settings.json`: `bar`; the page gets it in its URL, so it is drawn in its place at once). Bottom is the
default: the hand goes to the terminal under the grid all the time, so the tabs are where it already is; at first
the projects were tabs in the title bar and the workspaces a strip under the grid, and both switched with the same
slide, which mixed them up (2026-10-08). Each island looks like a tab of the grid, its flat side on the grid and
merging into it with curves; the grid leaves no gap on that side. The grid is one dark box (`--well`, a step from its panels, so they
stand apart) from edge to edge of the window, square, the gap inside it, its panels' gaps dark too; the islands are
of its color, so an island merges into it wherever it meets it: on the window's glow, over a gap between two
panels (profiles side by side, a split row), its curve hung in the air (2026-10-08). Its tabs are a step taller than a button and never
narrow, targets for a quick throw of the mouse; nothing in the bar moves when another project or workspace is shown.

## The grid

A workspace's profiles' panes and its terminal are peer panels in a grid (dockview), in JetBrains' Islands look:
drag one by its header to another place, onto another panel to stack them as tabs, drag the gaps to resize. A
panel stacked behind another hides its page until it is chosen. **☰ → Arrange panels** offers ready-made
arrangements, each drawn as a small picture of itself, as Windows' snap layouts (the words in its tooltip):
profiles in columns with the terminal below, two by two with the terminal on the right, one profile at a time.
Each fits the window with nothing cut off. The grid is saved per workspace (`layout.json`) and restored.

The profiles' pages are native views above the window's HTML (CLAUDE.md, "What must hold in the window"). While a
panel is dragged, a menu is open or a dialog is shown, the pages are pictures of themselves (or hidden), so the
HTML can be on top; they are live again after. A page that gives no picture within 500 ms (covered, the monitor off,
busy) leaves its pane empty meanwhile: waiting for it held the menu, and every one after it.

A pane's tab strip and toolbar move as Chrome's: a tab opened grows in from the left (`.tab.opening`; the strip keeps
its tabs' elements by id, so only a new one animates), the address's hover fades in. Not with reduced motion.

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
  sets `color-scheme: dark` on the grid; `window.css` gives it back the root's.
- What CSS does not paint follows from the main process: the window's background and the OS buttons' strip
  (`window.js`).
- The terminal takes the panels' colors (`term.options.theme`, set again on a change); the programs' own colors stay
  xterm's, made readable on either background by its `minimumContrastRatio` (as VS Code does), with no palette of
  Kulisa's own.

## Menus

Kulisa draws its menus in HTML, as Chrome does (a popover, `menu.js`; [ui.md](ui.md), Menus):

- the button after the projects' islands (the projects), a project label's right-click menu, Profiles ▾ (open and
  closed profiles, Manage Profiles…), ☰ (as Chrome's ⋮, each row with its icon: the zoom row, the theme row, the
  projects' bar's row, Arrange panels, Agents…, Kulisa's version with the Welcome screen's links
  (Documentation, GitHub, Report an issue; one list in `index.html`), and Exit, which quits as the last window's × does; not on macOS, where
  Cmd+Q and the app's menu quit);
- right-click on a pane's header (New tab, Rename, About this profile…, Close profile, Delete profile…), a tab (Reload, Duplicate,
  Close, Close others) and the terminal (Copy, Paste, Select all, Clear, Change agent…).

Native menus were tried first (2026-10-05): rows of text only, no buttons in a row; and a native menu in a page had
frozen the desktop (ROADMAP, Deferred ideas, "A right-click menu in pages"). There is no menu in the pages yet.

## Dialogs and questions

Every dialog has one look, as in JetBrains: the title with × on top, the content, the buttons at the bottom right,
the main one last (blue; red when it deletes) ([ui.md](ui.md), Dialogs). Questions before something that cannot be
undone (deleting a profile, a workspace, a project), before closing (a project, a window, quitting
while an agent works: [workspaces.md](workspaces.md)) or between two ways to go (This Window or New Window) are asked
in that dialog too (`shell.ask` → `ask.js`, queued, Cancel focused), in the window the action is
in. Not the OS's own question (`dialog.showMessageBox`): it looked different on each OS and plain on Linux, and
could not mark the deleting button or lay out what goes. The OS's own dialogs stay for choosing a folder.

## The terminal

One terminal per workspace (xterm.js in the window, node-pty in the main process: `terminal.js`), running the agent
the human chose ([workspaces.md](workspaces.md), "Choosing the agent") unchanged. Unicode 11 widths (the cursor stays
put after an emoji), a bundled font, the GPU renderer. Copy and paste take the keys of the OS's own terminal, so hands
need nothing new: Ctrl+Shift+C / V (GNOME Terminal, Konsole); on Windows also Ctrl+V, and Ctrl+C copies a selection,
else interrupts (Windows Terminal); on macOS ⌘C / ⌘V (the app menu's). xterm leaves those keys to the app, as VS Code
sets its own; otherwise Ctrl+C and Ctrl+V go to the agent (Claude Code pastes an image with Ctrl+V, with Alt+V on
Windows). The paste itself is Chromium's, which xterm takes (pasting again from Kulisa had doubled it).
With nothing selected in xterm, copying keeps the clipboard: Claude Code's fullscreen rendering selects with its own
mouse and copies on release itself (code.claude.com/docs/en/fullscreen; an empty copy had wiped it); Shift held while
dragging selects in xterm instead.

Links in the terminal, those an agent marks (OSC 8, as Claude Code does) and addresses in plain text (xterm's web-links
addon), open with Ctrl+click (⌘ on macOS), and always ask where, in a menu at the pointer: a new tab in one of the
shown workspace's open profiles, or the user's browser. Asked every time, so a link never lands somewhere the human
did not expect (the author's choice, 2026-10-08: which profile a link belongs to cannot be told, and a rule such as
"where that site is open" was not obvious). Only `http` and `https`; the address shows on hover. xterm's own handler
asked with the browser's `confirm()`, an OS dialog. Keys are known by `keyCode` too, as ibus with a Cyrillic layout leaves
`code` out. The agent starts once the terminal is laid out, at its real
size. The rows that fit sit in the middle of the panel, what is left under a whole row shared above and below them:
at the bottom, it was a row's height under the agent's status line in one workspace and nothing in another, whose
grids differed by a pixel (2026-10-08). When a project moves to another window, what its terminals show moves along (xterm's serialize addon, as VS
Code keeps terminals), at the same size.

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
| `src/main/window.js` | a window: its BrowserWindow, keys (zoom, DevTools), the native views' places, its questions, screenshot |
| `src/main/terminal.js` | a pty per workspace |
| `src/renderer/renderer.js` | the grid (dockview), the panes, ☰, Arrange panels, the right-click menus |
| `src/renderer/menu.js`, `ask.js`, `terminal.js` | the menus, the questions, the terminal |
| `test/window.js`, `grid.js`, `zoom-and-closing.js` | the tests |
