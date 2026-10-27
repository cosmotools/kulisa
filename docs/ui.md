# The window's UI

What the window's UI is built of, so every dialog, button and list looks and behaves the same. **Before making a
button, an icon, a row, a dialog, a menu or a control, look here:** it is Fluent UI's component, placed by our code.

React 19 in TypeScript, built by Vite (`vite.config.mts`, into `dist/renderer`). The components are Fluent UI v9's
(`@fluentui/react-components`): its documentation and examples at https://react.fluentui.dev (the storybook), its API in
the installed version's `node_modules/@fluentui/react-components/dist/index.d.ts` and each component's
`node_modules/@fluentui/react-<component>/dist/index.d.ts`; read those, not what you remember, before using a part new
to the window or writing a "how to" here. Icons are `lucide-react` (lucide.dev); state is zustand's; the grid is
dockview's (`dockview-react`: panels, splits, drag and drop, saving the grid; its API before layout code of our own);
the terminal is xterm's (`src/terminal/`).

**The profiles' pages are native views, drawn above the window's HTML**, so whatever HTML covers the panes hides the
pages or puts pictures of them in their place: every dialog hides them and every menu opens over pictures of them
(`useCovered`, `lib/cover.ts`; a tasks' window's pages under it: `lib/views.ts`), which come back however it closes;
while a panel is dragged, pictures stand in too. The renderer sends each pane's content box (or that it is off screen)
to the main process after every grid change ([window.md](window.md), The grid).

## The code

| Where | What |
|---|---|
| `src/renderer/index.html`, `main.tsx`; `settings.html`, `settings.tsx`; `master.html`, `master.tsx` | a tasks' window's page, Settings' window's and a master's window's: the theme (and the tasks' bar's place) from the URL before the first paint, Inter, then the app; the few global rules (text selection, the cursor, Lucide's size in Fluent's icon slots) in `settings.tsx`, `master.tsx` and `App.tsx`. Settings' loads nothing of a tasks' window (no grid, store or keys): `components/avatar.ts` copies `avatarSrc` so as not to pull in `lib/common.ts` |
| `src/renderer/components/` | the parts. `App.tsx` a tasks' window; `theme.ts` the theme; `Menus.tsx`, `PointMenu.tsx` the menus; `Ask.tsx` the questions; `TopBar.tsx`, `TaskBar.tsx`, `Sidebar.tsx`, `Empty.tsx`, `Welcome.tsx`; `Grid.tsx` and `grid/` (`ProfilePane.tsx`, `Terminals.tsx`, `Resources.tsx`: a panel and its header each); the dialogs `NewProject.tsx` (also `Wizard`, the welcome's), `TaskRename.tsx`, `AgentPicker.tsx`, `HandOver.tsx`, `Shortcuts.tsx`; `Settings.tsx` and its pages (`ProjectPage.tsx`, `AgentPage.tsx`, `ProfilePage.tsx`, `GitHubPage.tsx`, `LogPage.tsx`, `AboutPage.tsx`; `Group.tsx`, `List.tsx`, `SignIn.tsx`, `agents.ts` theirs); `AgentMark.tsx`, `ProjectIcon.tsx` the marks; `Terminal.tsx` a terminal in a page; `Master.tsx` a master's bar |
| `src/renderer/lib/` | what parts share or what outlives a component: `store.ts` (the window's state as the main process sends it: `useWindow(selector)` in a component, `store.getState()` elsewhere; `act`), `cover.ts`, `views.ts`, `menu.ts` (what a menu holds, the menu at a point), `dialogs.ts`, `ask.ts`, `strip.ts`, `keys.ts`, `sidebar.ts`, `grid.ts`, `terminals.ts`, `agents.ts`, `new-project.ts`, `profiles.ts`, `project-color.ts`, `common.ts`, `names.ts` (name fields: `data-name`), `test-hooks.ts` |
| `src/shared/types.ts`, `ipc.ts`; `src/renderer/env.d.ts` | the shapes the main process sends and the channels they come by ([window.md](window.md), IPC); the bridge (`kulisa`) typed by them |
| `src/renderer/public/avatars/` | the profiles' pictures (Noto Emoji), copied as they are |
| `src/*/renderer/` | a Kulisa package's part of the window (the terminal, dictation, screenshots): its own `README.md` |

## Fluent as it ships

- **Only Fluent's stock components; our own code is layout** (where they go: flex, grid, gaps, widths). Nothing is
  restyled into a component of our own, and nothing of ours where Fluent has one: its keyboard, focus and
  accessibility are maintained upstream, and every part looks like every other. A deviation is the exception: a
  comment at it says why, and a line here names it.
- **Colors and sizes only from Fluent's tokens** (`tokens.colorNeutralForeground3` in `makeStyles` or `style`, or
  `var(--colorNeutralForeground3)`): both themes come from one place. Muted text is `colorNeutralForeground3`, an
  error `colorPaletteRedForeground1` (selectable: text to copy and search for), a hairline `colorNeutralStroke2`. A
  literal color only where no token can be: a mask (alpha alone, `lib/strip.ts`), the logo, the agents' marks, a
  question's deleting button (`Ask.tsx`: Fluent's Button has no danger appearance).
- **The theme** (`theme.ts`): Fluent's dark and light themes over a neutral brand ramp, so the main button and what is
  chosen are in the text's own color, not Microsoft's blue; Inter, bundled (`@fontsource-variable/inter`), so the
  window looks the same on every OS; softer radii (4, 6, 8, 12 px). **Dark by default**, as JetBrains; Light; System
  follows the OS ([window.md](window.md), Theme). What draws outside Fluent's components (a terminal) takes the shown
  theme from `ThemeShown` (`termStyle`).
- **Icons are Lucide's**, in Fluent's icon slots (`icon={<XIcon />}`), sized by the slot. Not icons: the agents'
  marks (`agentMark`, `AgentMark.tsx`: the makers' own marks in their own colors, Lucide's square-terminal for the
  terminal only, its bot for an agent new to Kulisa), the logo (`Logo`, `ProjectIcon.tsx`: the app icon's drawing,
  its curtain in `currentColor`, the folds a shadow over any color) and the profiles' pictures (Fluent's `Avatar` with
  `avatarSrc`).
- **Styles** are Griffel's (`makeStyles`, Fluent's), or `style` for a one-off place; no CSS file of our own.
  dockview's look is its variables, set from the tokens (`Grid.tsx`), before any rule over its classes.
- **React's hook rules are lint errors** (`eslint.config.ts`, react-hooks: a hook called conditionally, an effect
  missing what it reads, a ref read while rendering, state set in render or copied in an effect, a component made in
  another); not its memoization rules: the window is not compiled by the React Compiler.

## Desktop, not a web page

Kulisa is a desktop app, an IDE: its window looks like one, JetBrains its model (not big titles, framed cards in
frames, pills, rows that show their buttons only under the pointer: those read as a web page's).

- **Flat panes split by hairlines** (dockview's `gap` 0, its separators `colorNeutralStroke2`); a profile's pane's
  header is "picture, name · what the agent does · ⋯ · ×" (`ProfileHeader`), the terminals' is their tabs, + and the
  microphone, the Resources' its title.
- **The project's color only on its icon and on its task tab's marker** (Fluent's selected-tab line, its
  `colorCompoundBrandStroke` set per tab: `TaskBar.tsx`); the title bar's logo is the shown project's (`--project` on
  the root, `lib/store.ts`). Nothing else is colored by it (the author's choice). `projectColor`
  (`lib/project-color.ts`): a favicon's hue in Kulisa's lightness and chroma, so it suits both themes.
- **The tasks' bar is at the bottom by default** (☰ → Tasks bar: Top puts it in the title bar); its + makes a task of
  the shown task's project in one click.
- **The sidebar** (projects, then their tasks: Fluent's `Tree` in a `Drawer`) is docked in the empty window
  (`InlineDrawer`), where it is the content, and over the grid as an overlay (`OverlayDrawer`, covering as a dialog
  does), so the grid keeps its room.
- **Every object has a right-click menu with all its actions** (a pane, a tab, a task, a row of a list, the
  terminal), so the window shows one or two buttons and the rest is in menus. No swipes (on a laptop a sideways swipe
  is the OS's and the pages' back and forward), nor a double-click as the only way to anything (only a shortcut to a
  menu's row: Rename… on a task's tab).
- **Labels and buttons are not text to select, fields are; the arrow over buttons, tabs and menus' rows**, as in
  Chrome (`App.tsx`, `!important` over Fluent's hand). The window never scrolls (`overflow: clip`, also from
  a script); a part scrolls inside.
- **An agent's state is an icon each**, not a color alone (some people do not tell yellow from green): working,
  waiting for you, done; nothing otherwise. On a task's tab, its row in the sidebar, a terminal's tab.
- **A dialog asks one thing and ends with its buttons**; what is browsed (Settings, a window of its own) is a nav on
  the left (`NavDrawer`) and a page on the right under its path (`Breadcrumb`, its ⋯ at the end), saved as it
  changes, no OK. No search field over the nav (the author's choice).
- **It fits the smallest window** (640 × 400, or any at 200%): Fluent's dialog keeps to the window's height and
  scrolls its content; one that keeps a height of its own (New Project) gives it as `min(…, 85vh)`, so its buttons
  stay in the window.

## Tooltips

Fluent's `Tooltip` where it opens over no page: the title bar, the sidebar, dialogs, Settings. In the grid, over and
next to the pages (a pane's tabs, toolbar and header; the terminals' header; the microphone), the native `title`: the
OS draws it above the native views, which would cover Fluent's. An icon-only button is named by `aria-label`, or by a
`Tooltip` with `relationship="label"`. A command with a key says it at the end of its tooltip, as Chrome's toolbar:
`withKeys('Reload', 'tab.reload')` → "Reload (Ctrl+R)" (`lib/common.ts`, from `src/main/keys.ts`). A button disabled
under a tooltip is `disabledFocusable` (`Tool`, `Group.tsx`): a disabled one gets no pointer events, and its tooltip
would stay and take the next Esc.

## Menus

`Menus.tsx`, on Fluent's `Menu`: a button's (`ButtonMenu`: `items` built as it opens; `end`: its end edge at the
button's, at a bar's end), an area's right-click menu at the pointer (`RightClickMenu`: `items(e)` the rows for what
was right-clicked, or `null`: none), one at a point (`menuAt(e, items)`, `menuAtPoint` in `lib/menu.ts`, shown by
`PointMenu.tsx`: a link in the terminal, a screenshot's thumbnail). Fluent's `Menu` alone only for a row's own menu
inside one (`ChoiceRow`, `TopBar.tsx`): these keep the desktop's rules.

- A button's menu opens on the press, and a press, a drag to a row and the release there chooses it, as the OS's;
  Enter, Space or ↓ open it. Rows are chosen with the left button only (on Linux a right-click menu opens on the press,
  and the release must not choose a row). A disabled-focusable button opens nothing.
- One menu at a time. Esc, a press outside, the same button, a chosen row or leaving the window closes it, and the
  keyboard goes back where it was. Leaving is the window's blur from the main process (`window:blur`), not its page's:
  a profile's page taking the keyboard as it loads (macOS) would close a menu under the hand; Settings' window, with no
  pages, goes by its page's.
- It shows once the pages under it are pictures; then its list is `[role="menu"][data-ready]` (the tests' handle). A
  menu taller than the window scrolls, as far as its edge (`FIT`).
- Rows (`MenuItem` in `lib/menu.ts`): `{ label, sub, keys, title, icon, color, avatar, project, inset, enabled, run,
  remove }`; `'-'` a divider; `{ heading, icon }`; `{ submenu, items, project, run }` (a menu of its own at its side,
  on hover; `run`: a click on the row itself acts); `{ component }` a row of its own (☰'s zoom, theme, tasks' bar,
  language and arrangements in `TopBar.tsx`, of Fluent's menu items; a choice there leaves the menu open:
  `persistOnClick`). `keys` is the row's key at its end (`keyText(id)`); `title` its tooltip (native); `remove` a 🗑 at
  its end, shown on the row under the pointer or the keyboard, Delete too.
- **A row's accessible name is its label alone** (`aria-label`): not its `sub` line, its key or its 🗑, so it is
  found by what it says. **Fluent's `MenuDivider` is presentational**: no separator in the accessibility tree, so a
  test checks a row's place among rows, not dividers.
- A row that opens a field gives the field the keyboard once the menu has given it back to its button
  (`requestAnimationFrame`, `GitHubPage.tsx`).

## Dialogs

Fluent's `Dialog`: `DialogSurface` › `DialogBody` › `DialogTitle`, `DialogContent`, `DialogActions` (the buttons at
the end, the main one `appearance="primary"` last).

- Its open state is `useCovered('hide')` (`lib/cover.ts`): the pages are hidden while it is open, and the keys are its
  (`lib/keys.ts`, zone `dialog`). Closing the grid closes every layer (`closeLayers`).
- Every dialog of a tasks' window is in `App.tsx` from the start and registers what it does (`registerDialog`);
  anything opens one by name: `(await dialog('newproject')).open()` (`lib/dialogs.ts`, its `Dialogs`). Settings is a
  window: `openSettings(section, id)`.
- Its content is mounted only while it is open, so what must outlive it lives outside it: an agents' list and its
  install (`lib/agents.ts`), New Project's steps (`lib/new-project.ts`), Change Agent's (a store in `HandOver.tsx`).
- A form is a `<form>` (Enter submits); a field is Fluent's `Field` (label, `hint`, `validationMessage`: the main
  process's refusal at its field).
- One that waits for an answer takes no Esc, × or click outside (`AgentPicker.tsx`: `onOpenChange` does nothing).
- **Questions** before something that cannot be undone, before closing, or between two ways to go are not new
  dialogs: `ask(q)` (`lib/ask.ts`) or the main process's `shell.ask` → `Ask.tsx`, an alert dialog, queued: Cancel has
  the keyboard (named by the question when the word is another: Later), Esc is Cancel (its own listener: Fluent's alert
  dialog takes none), a click outside does nothing; `other` a second way's button before the main one; `link` a page
  the answer may need, under the detail; `danger` a red main button.
- **A page's alert or confirm** (`ProfilePane.tsx`) is a non-modal `Dialog` mounted in its pane (`mountNode`), under
  the address bar over a dimmed picture of the page, as Chrome shows it: the page's, not Kulisa's; the other panes go
  on. OK has the keyboard, Esc is Cancel, a click outside does nothing.
- **New Project** is `Wizard` (`NewProject.tsx`): its steps, a form, the kinds of code as a vertical `TabList` on the
  left (JetBrains' New Project). The dialog and the welcome (`Welcome.tsx`, in a `Card`: nothing to cover) both show
  `Wizard`, never a copy of the steps.

## Controls and rows

- **Buttons**: `Button`, `ToolbarButton` in a `Toolbar`, `ToggleButton` for one that stays on (Pick: `checked`), a
  `CompoundButton` for a row with a line under its name (Resources). `subtle` for a bar's or a row's icon buttons.
  Where nothing else is (an empty grid), big `secondary` buttons, a mark over a name (`Launchers`,
  `grid/Terminals.tsx`); with no profile open, a row of buttons that open them over the terminal (`ClosedProfiles`,
  `Grid.tsx`).
- **A list to act on** is `List` (`List.tsx`, on Fluent's `Table`) in a `Group` (`Group.tsx`: a `Card` with its title,
  a line under it and a `Toolbar` of `Tool`s at its end: + adds (often a `ButtonMenu`), − removes the selected row, ★
  makes it the default), as JetBrains' lists: columns at the same place in every row, the selected one lit
  (`aria-selected`), the arrows move, Delete removes it, a state at its end in a `Badge` ("default", "no git"). Each
  row has `data-<attr>` for a `RightClickMenu` around the list (it selects the row), its name (`rowLabel`) and the
  whole of what its cells cut in its tooltip (`rowTitle`). What is added in place goes under the list: a field and its
  buttons, Enter adds, Esc puts it away.
- **Trees**: the sidebar's `Tree` (`TreeItemLayout`: `aside` a task's line and badges, `actions` its buttons); Settings'
  `NavDrawer` (`NavSectionHeader` with its + at its end, `NavItem`).
- **Choices**: one of a few, `RadioGroup` (`AgentPicker.tsx`, `HandOver.tsx`); several, `Checkbox`; one of many,
  `Dropdown`; a picture, a `Popover` of `ToggleButton`s (`ProfilePage.tsx`). Something shown on demand (an installer's
  output, a sign-in's terminal) is an `Accordion` "Details", opened by itself when it fails. A warning or error over a
  part is a `MessageBar`; progress `Spinner` or `ProgressBar`.
- **Tabs** are Fluent's `TabList` (`size="small"`, `reserveSelectedTabSpace={false}`): the tasks' bar, a pane's tabs,
  the terminals'. A tab is chosen on the press, as a browser's (not on its ×); the arrows move between them and Enter
  chooses. A task's tab is shown on the release or as its drag begins, and keeps its width whichever is shown, so none
  moves under the mouse ([window.md](window.md), The tasks' bar). Its × is on every tab, always, as Chrome's: inside
  the tab, so not a `<button>` (a button holds none) but an element that takes its own click and never the tab's
  press. A pane's tabs are 220 px and shrink to their icon and × (64 px; the title hidden by a container query); a
  terminal's is as wide as its name up to 220 px and never shrinks (the agents' marks look alike).
- **A strip of tabs that do not all fit** (those three, the closed profiles' buttons) takes `useStrip`
  (`lib/strip.ts`), one for every strip: no scrollbar; a mouse's wheel scrolls it sideways (Shift and a touchpad's
  swipe are the browser's); an edge with tabs past it fades (a mask: `data-past-start`, `data-past-end`); the chosen
  tab (`aria-selected`) is brought into sight, clear of the fade, only when another is chosen, a tab grows in or the
  strip is resized, so an update (a title, a page loading) leaves it where the human scrolled it; a tab with
  `data-grow` grows in from the left as it opens (`data-opening`).
- **A narrow pane gives up its buttons in order** (Back and Forward, then Reload, into ⋮; never Pick or ⋮): container
  queries on its toolbar (`ProfilePane.tsx`).

## Own drawing

What is drawn here rather than taken from Fluent, each for a reason at it:

- the grid's slide between tasks (a view transition of `#dock`, `Grid.tsx`): pictures, so the compositor moves them;
- the dictation's pill with its wave bars, and the microphone breathing red while it records (`src/dictation/`, its
  `README.md`): what the agent hears, caught from across the window;
- the strips' fades and a tab growing in (`lib/strip.ts`), the marks and the logo (above).

## Adding something

- A component: Fluent's (its storybook, then its `.d.ts`), placed by layout, its colors and sizes tokens. Nothing
  fits: say so before building one; a deviation gets its comment and its line here.
- A dialog: Fluent's `Dialog` with `useCovered('hide')`, in `App.tsx`, registered (`registerDialog`, a line in
  `Dialogs`).
- A menu: `ButtonMenu`, `RightClickMenu` or `menuAt`, its rows `MenuItem`s.
- An icon: Lucide's.
- Its tests find it as the human does (role and name, label, `data-*`; never a class: [testing.md](testing.md)).
