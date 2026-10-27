# The window's UI

**The window is Fluent UI v9 as it ships** (`@fluentui/react-components`, its icons `@fluentui/react-icons`): its
components, tokens, type ramp, Griffel's `makeStyles` and its motion; our code only places them (layout: a component's
size and place, never its padding, colors or slots' insides). How a component is used is Fluent's documentation (https://react.fluentui.dev, the storybook) and the installed version's `.d.ts`
(`node_modules/@fluentui/react-<component>/dist/index.d.ts`), read rather than remembered: this doc holds only what
Fluent cannot know (the native pages, the desktop) and where Fluent leaves a choice, the one made. Nothing of ours where
Fluent has a component, a prop or a pattern: its keyboard, focus and accessibility are maintained upstream. A deviation
is the exception: a comment at it says why, and a line here names it.

React 19 in TypeScript, built by Vite (`vite.config.mts`, into `dist/renderer`); state is zustand's; the grid is
dockview's (`dockview-react`: its API before layout code of our own); the terminal is xterm's (`src/terminal/`).

**The profiles' pages are native views, drawn above the window's HTML**, so whatever HTML covers the panes hides the
pages or puts pictures of them in their place: every dialog hides them and every menu opens over pictures of them
(`useCovered`, `lib/cover.ts`; a tasks' window's pages under it: `lib/views.ts`), which come back however it closes;
while a panel is dragged, pictures stand in too. The renderer sends each pane's content box (or that it is off screen)
to the main process after every grid change ([window.md](window.md), The grid).

## The code

| Where | What |
|---|---|
| `src/renderer/index.html`, `main.tsx`; `settings.html`, `settings.tsx`; `master.html`, `master.tsx` | a tasks' window's page, Settings' window's and a master's window's: the theme (and the tasks' bar's place) from the URL before the first paint, Inter, then the app; the few global rules (text selection, the cursor) in `settings.tsx`, `master.tsx` and `App.tsx`. Settings' loads nothing of a tasks' window (no grid, store or keys): `components/avatar.ts` copies `avatarSrc` so as not to pull in `lib/common.ts` |
| `src/renderer/components/` | the parts. `App.tsx` a tasks' window; `theme.ts` the theme and the classes many parts share (`useCommonStyles`: muted, selectable); `ErrorBar.tsx` an error not of a field; `Menus.tsx`, `PointMenu.tsx` the menus; `Ask.tsx` the questions; `TopBar.tsx`, `TaskBar.tsx`, `Sidebar.tsx`, `Empty.tsx`, `Welcome.tsx`; `Grid.tsx` and `grid/` (`ProfilePane.tsx`, `Terminals.tsx`, `Resources.tsx`: a panel and its header each); the dialogs `NewProject.tsx` (also `Wizard`, the welcome's), `TaskRename.tsx`, `AgentPicker.tsx`, `HandOver.tsx`, `Shortcuts.tsx`; `Settings.tsx` and its pages (`ProjectPage.tsx`, `AgentPage.tsx`, `ProfilePage.tsx`, `GitHubPage.tsx`, `LogPage.tsx`, `AboutPage.tsx`; `Group.tsx`, `List.tsx`, `SignIn.tsx`, `agents.ts` theirs); `AgentMark.tsx`, `ProjectIcon.tsx` the marks; `Terminal.tsx` a terminal in a page; `Master.tsx` a master's bar |
| `src/renderer/lib/` | what parts share or what outlives a component: `store.ts` (the window's state as the main process sends it: `useWindow(selector)` in a component, `store.getState()` elsewhere; `act`), `cover.ts`, `views.ts`, `menu.ts` (what a menu holds, the menu at a point), `dialogs.ts`, `ask.ts`, `strip.ts`, `keys.ts`, `sidebar.ts`, `grid.ts`, `terminals.ts`, `agents.ts`, `new-project.ts`, `profiles.ts`, `project-color.ts`, `common.ts`, `names.ts` (name fields: `data-name`), `test-hooks.ts` |
| `src/shared/types.ts`, `ipc.ts`; `src/renderer/env.d.ts` | the shapes the main process sends and the channels they come by ([window.md](window.md), IPC); the bridge (`kulisa`) typed by them |
| `src/renderer/public/avatars/` | the profiles' pictures (Noto Emoji), copied as they are |
| `src/*/renderer/` | a Kulisa package's part of the window (the terminal, dictation, screenshots): its own `README.md` |

## Fluent in Kulisa

- **The theme** (`theme.ts`): Fluent's dark and light themes, with a neutral brand ramp (the main button and what is
  chosen grey, not Microsoft's blue) and Inter and JetBrains Mono (the terminal's), bundled, so the window looks the
  same on every OS. Nothing else set: a color by hand would be a second palette. **Dark by default**, as JetBrains;
  Light; System follows the OS ([window.md](window.md), Theme). What draws outside Fluent (a terminal) takes the shown
  theme from `ThemeShown` (`termStyle`).
- **A literal color only where no token can be**: a mask (alpha alone, `lib/strip.ts`) and the marks. A question's
  deleting button takes the danger tokens (`Ask.tsx`: Fluent's Button has no danger appearance).
- **Not Fluent's icons**: the agents' marks (`agentMark`, `AgentMark.tsx`: the makers' own, in their colors, 1em),
  the logo (`Logo`, `ProjectIcon.tsx`: its curtain in `currentColor`) and the profiles' pictures (`avatarSrc` in an
  `Avatar` or `Persona`). A chosen or checked control's icon is `bundleIcon(…Filled, …Regular)`.
- **A window's layout is a div inside `FluentProvider`**, not its `className`: Fluent copies that to every portal's
  node (a menu's, a tooltip's), which would then cover the window. `style` holds only what run time knows (a width,
  the project's color). dockview's look is its variables, set from the tokens in `Grid.tsx`'s `dock` class.
- **Under reduced motion a Fluent motion still runs** (1 ms): a part that waits for its end (`Grow`, `lib/strip.ts`)
  gets no motion then.
- **`npm run lint` refuses** in the window a raw `button`, `input`, `select` or `textarea`, `lucide-react`, a hex
  color (but `theme.ts` and the marks), a `'var(--color…)'` string and a constant in `style`; and React's hook rules
  (`eslint.config.ts`), not its memoization ones: the window is not compiled by the React Compiler.

## Desktop, not a web page

Kulisa is a desktop app, an IDE: its window looks like one, JetBrains its model (not big titles, framed cards in
frames, pills, rows that show their buttons only under the pointer: those read as a web page's).

- **Flat panes split by a gap** (dockview's `gap`: 6 px of the window's background; at 0 the native pages draw over
  a hairline); a profile's pane's header is "picture, name · what the agent does · ⋯ · ×" (`ProfileHeader`; paused on
  a sign-in page, a warning `Badge` with a lock), the terminals' is their tabs, + and the microphone.
- **The project's color only on its icon** and the title bar's logo (`--project` on the root, `lib/store.ts`; the
  author's choice). `projectColor` (`lib/project-color.ts`): a favicon's hue in Kulisa's lightness and chroma.
- **The sidebar** is docked in the empty window (`InlineDrawer`) and over the grid as an overlay (`OverlayDrawer`,
  covering as a dialog does), so the grid keeps its room.
- **Every object has a right-click menu with all its actions**, so the window shows one or two buttons. No swipes (a
  sideways swipe is the OS's and the pages' back and forward), nor a double-click as the only way to anything.
- **Labels and buttons are not text to select, fields and errors are** (`useCommonStyles().selectable`); **the arrow
  over buttons, tabs and menus' rows**, as in Chrome (`App.tsx`, `!important` over Fluent's hand). The window never
  scrolls (`overflow: clip`); a part scrolls inside.
- **An agent's state is an icon each**, not a color alone (some people do not tell yellow from green): one component
  (`AgentState.tsx`) on a task's tab, its row in the sidebar, a terminal's tab.
- **Explanations are a card's line, an empty list's line, a field's hint and tooltips**, not a paragraph per
  section: that reads as documentation.
- **A dialog asks one thing**; what is browsed (Settings, a window of its own) is a `NavDrawer` and a page under its
  `Breadcrumb`, saved as it changes, no OK. No search field over the nav (the author's choice).
- **It fits the smallest window** (640 × 400, or any at 200%): a dialog that keeps a height of its own (New Project)
  gives it as `min(…, 85vh)`, so its buttons stay in the window.

## Tooltips

Fluent's `Tooltip` on a control where it opens over no page: the title bar, the sidebar, dialogs, Settings, the tasks'
bar's + (`positioning="after"`: over or under it are the pages). The native `title` elsewhere:
- in the grid, over and next to the pages (a pane's tabs, toolbar and header; the terminals' header; the microphone),
  and on a master's bar: the OS draws it above the native views, which would cover Fluent's;
- on a row (of a list, a tree, a nav) and on a text that cuts: Fluent's stays open while the pointer is over it,
  covering the row above and taking its click, and takes the first Esc;
- on a line of the log (Settings → Log, its date): a Fluent tooltip per line would be thousands of components.

A command with a key says it at the end of its tooltip, as Chrome's toolbar: `withKeys('Reload', 'tab.reload')` →
"Reload (Ctrl+R)" (`lib/common.ts`). A button disabled under a tooltip is `disabledFocusable` (`Tool`, `Group.tsx`): a
disabled one gets no pointer events, and its tooltip would stay and take the next Esc.

## Menus

`Menus.tsx`, on Fluent's `Menu`: a button's (`ButtonMenu`: `items` built as it opens; `end`: its end edge at the
button's), an area's right-click menu at the pointer (`RightClickMenu`: `items(e)` the rows for what was
right-clicked, or `null`), one at a point (`menuAt(e, items)`, `lib/menu.ts`, shown by `PointMenu.tsx`: a link in the
terminal, a screenshot's thumbnail). Fluent's `Menu` alone only for a row's own menu inside one (`ChoiceRow`,
`TopBar.tsx`): these keep the desktop's rules.

- A button's menu opens on the press, and a press, a drag to a row and the release there chooses it, as the OS's.
  Rows are chosen with the left button only (on Linux a right-click menu opens on the press, and the release must not
  choose a row).
- One menu at a time. Leaving the window closes it: the window's blur from the main process (`window:blur`), not its
  page's (a profile's page taking the keyboard as it loads, on macOS, would close a menu under the hand); Settings'
  window, with no pages, goes by its page's.
- It shows once the pages under it are pictures; then its list is `[role="menu"][data-ready]` (the tests' handle). A
  menu taller than the window scrolls, as far as its edge (`FIT`).
- Rows (`MenuItem` in `lib/menu.ts`): `{ label, sub, keys, title, icon, color, avatar, project, inset, enabled, run,
  remove }`; `'-'` a divider; `{ heading, icon }`; `{ submenu, items, project, run }`; `{ component }` a row of its own
  (☰'s zoom, theme, tasks' bar, language and arrangements, `persistOnClick`). `remove` a 🗑 at its end, on the row
  under the pointer or the keyboard, Delete too.
- **A row's accessible name is its label alone** (`aria-label`), so it is found by what it says. Fluent's
  `MenuDivider` is presentational: a test checks a row's place among rows, not dividers.
- A row that opens a field gives the field the keyboard once the menu has given it back to its button
  (`requestAnimationFrame`, `GitHubPage.tsx`).

## Dialogs

- Its open state is `useCovered('hide')` (`lib/cover.ts`): the pages are hidden while it is open, and the keys are its
  (`lib/keys.ts`, zone `dialog`). Closing the grid closes every layer (`closeLayers`).
- Every dialog of a tasks' window is in `App.tsx` from the start and registers what it does (`registerDialog`);
  anything opens one by name: `(await dialog('newproject')).open()` (`lib/dialogs.ts`). Settings is a window:
  `openSettings(section, id)`.
- Its content is mounted only while it is open, so what must outlive it lives outside it: an agents' list and its
  install (`lib/agents.ts`), New Project's steps (`lib/new-project.ts`), Change Agent's (a store in `HandOver.tsx`).
- One that waits for an answer takes no Esc, × or click outside (`AgentPicker.tsx`).
- **Questions** before something that cannot be undone, before closing, or between two ways to go are not new dialogs:
  `ask(q)` (`lib/ask.ts`) or the main process's `shell.ask` → `Ask.tsx`, an alert dialog, queued: Cancel has the
  keyboard, Esc is Cancel, a click outside does nothing; `other` a second way's button; `link` a page the answer may
  need; `danger` a red main button.
- **A page's alert or confirm** (`ProfilePane.tsx`) is a non-modal `Dialog` mounted in its pane (`mountNode`), over a
  dimmed picture of the page, as Chrome shows it; the other panes go on.
- **New Project** is `Wizard` (`NewProject.tsx`), shown by the dialog and by the welcome (`Welcome.tsx`, in a `Card`),
  never a copy of the steps: it gives its parts (steps, error, Back, Next) to what shows it. A Create under way keeps
  the dialog open however it would close.

## Controls

- **A list to act on** is `List` (`List.tsx`: Fluent's `DataGrid`, single selection) in a `Group` (`Group.tsx`: a
  `Card`, its `Toolbar` of `Tool`s: + adds, − removes the selected row, ★ makes it the default). Each row has
  `data-<attr>` for a `RightClickMenu` around the list (it selects the row), and Delete removes it. What is added in
  place goes under the list, a `form` (Enter submits it; Esc puts it away).
- **Notices**: work under way (an install, a sign-in, a search) is a `Spinner` with its label, done a success
  `MessageBar`. An error of a field is that `Field`'s `validationMessage`; any other error, a warning, a step to take
  or what is done is a `MessageBar` of its intent, an error's through `ErrorBar`. A `MessageBar` announces itself
  through the `AriaLiveAnnouncer` around each window's content (`App.tsx`, `Settings.tsx`, `Master.tsx`). A
  confirmation that passes (Copied, Saved as) is a `Toast`, in Settings' window only: in a tasks' window the pages
  would cover it. A field's explanation in a dialog is its `hint`, not an `InfoLabel`: a dialog gives the keyboard to
  its first focusable, which would be the (i), not the field.
- **Tabs** are `TabList appearance="filled-circular"` (the author's choice) as browser tabs, which Fluent does not
  have: the tasks' bar, a pane's tabs, the terminals'. A tab is chosen on the press, as a browser's (not on its ×). Its
  × is on every tab, always, as Chrome's: inside the tab, so not a `<button>` (a button holds none) but `Button
  as="a"` (`tabIndex={-1}`) that takes its own click and never the tab's press; a terminal's agent mark (Change Agent)
  likewise. A task's tab keeps its width whichever is shown, so none moves under the mouse ([window.md](window.md),
  The tasks' bar). A pane's tabs are 220 px and shrink to their icon and × (64 px; the title hidden by a container
  query); a terminal's is as wide as its name up to 220 px and never shrinks (the agents' marks look alike).
- **A strip of tabs that do not all fit** (those three, the closed profiles' buttons) shrinks, then scrolls: `useStrip`
  (`lib/strip.ts`), not Fluent's `Overflow`, which moves the tabs past the end into a menu and pushes others under the
  mouse (Office's model, not Chrome's): no scrollbar; a mouse's wheel scrolls it sideways; an edge with tabs past it
  fades (`data-past-start`, `data-past-end`); the chosen tab is brought into sight only when another is chosen, a tab
  grows in or the strip is resized, so an update (a title, a page loading) leaves it where the human scrolled it.
- **A narrow pane gives up its buttons in order** (Back and Forward, then Reload, into ⋮; never Pick or ⋮): Fluent's
  `Overflow` on its toolbar (`ProfilePane.tsx`); the address is no item, it shrinks.

## Own drawing

What is drawn or moved here rather than by Fluent, each for a reason at it:

- the grid's slide between tasks (a view transition of `#dock`, `Grid.tsx`): pictures, so the compositor moves them;
- the dictation's pill with its wave bars, and the microphone breathing red while it records (`src/dictation/`, its
  `README.md`). The breathing is the Web Animations API: a Fluent motion only pauses, and remounting the button would
  drop its press's pointer capture;
- the strips' fades (`lib/strip.ts`: tied to the scroll), the marks and the logo;
- the log's box of lines (`LogPage.tsx`): Fluent has no log view; its tags in Fluent's palette tokens;
- the sidebar's task rows (`Sidebar.tsx`): the shown task's lit and a closed one's muted, pointed at too, as `Tree` has
  no current item;
- a dangerous question's button in the danger tokens (`Ask.tsx`): `Button` has no danger appearance.

## Adding something

- A component: Fluent's. Nothing fits: say so before building one; a deviation gets its comment and its line here.
- A dialog: Fluent's `Dialog` with `useCovered('hide')`, in `App.tsx`, registered (`registerDialog`).
- A menu: `ButtonMenu`, `RightClickMenu` or `menuAt`, its rows `MenuItem`s.
- Its tests find it as the human does (role and name, label, `data-*`; never a class: [testing.md](testing.md)).
