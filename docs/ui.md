# The window's UI

**The window is shadcn/ui as it ships** (`src/ui`, a Kulisa package its CLI writes: [its README](../src/ui/README.md)),
built as shadcn's examples build it. **A component of `src/ui` takes only where it sits and its size** (layout and size
classes: `w-64`, `flex-1`, `ms-auto`; its variants and sizes for the rest); **its look is the theme's alone**
(`src/ui/theme.css`; Kulisa's own variables in `src/renderer/window.css`); a part with a role of its own may look a
little different. Variables passed to a component configure it (`[--muted:transparent]`, or in `style`); `src/ui` itself is never edited. What shadcn
has no component for (a layout, a frame, the log) is a div or span with Tailwind's classes around shadcn's components,
not on them (Own drawing). How a component is used: shadcn's documentation
(`https://ui.shadcn.com/docs/components/radix/<name>`) and its generated file, read rather than remembered; here only
what shadcn cannot know (the native pages, the desktop) and the choices it leaves. Nothing of ours where shadcn or
Radix has a component, a prop or a pattern: their keyboard, focus and accessibility are maintained upstream. A
deviation gets a comment at it saying why. Tests find a part as the human does (role and name, label,
`data-*`; never a class: [testing.md](testing.md)).

The grids and their headerless split are Dockview's (`dockview-react`): its API before layout code of our own. State is zustand's; the terminal is
xterm's (`src/terminal/`). The Log page uses TanStack Virtual for its scrollable rows ([window.md](window.md), The log).

**The profiles' pages are native views, drawn above the window's HTML**, so whatever HTML covers the panes hides the
pages or puts pictures of them in their place (Layers, below; a tasks' window's pages under it: `lib/views.ts`); while
a panel is dragged, pictures stand in too. The renderer sends each pane's content box (or that it is off screen) to
the main process after every grid change ([window.md](window.md), The grid).

## The code

| Where | What |
|---|---|
| `src/renderer/index.html`, `main.tsx`; `master.html`, `master.tsx`; `public/theme.js` | a tasks' window's page and a master's window's: the theme from the URL before the first paint (`theme.js`), then the app |
| `src/renderer/window.css` | Tailwind and shadcn's theme for the window, Kulisa's own variables (`--warning`, `--success`), the few global rules (text selection, the cursor, no scrolling) |
| `src/renderer/components/` | the parts. `App.tsx` a tasks' window; `Menus.tsx` the menus; `Tip.tsx` a tooltip; `BrowserTabs.tsx` the browser tabs; `Ask.tsx` the questions; `TopBar.tsx`, `TaskBar.tsx`, `Sidebar.tsx`, `Empty.tsx`, `Welcome.tsx`; `Grid.tsx` (`Grid.css`) and `grid/` (`ProfilePane.tsx`, `StageTerminalPane.tsx` (including its inline terminal search), `Terminals.tsx`, `Resources.tsx` (Project and Artifacts tabs, Project Explorer: directory browsing through its renderer entry): a panel and its header each; `Stage.tsx`: the nested testing grid, its scroll viewport; `EnvironmentFocus.tsx`: shared maximize/restore; `StageMenu.tsx`: the title-bar position, view, Follow agent and environment menu); the dialogs `NewProject.tsx` (also `Wizard`, the welcome's), `TaskRename.tsx`, `StageTerminalSettings.tsx` (a Stage terminal’s saved configuration), `AgentPicker.tsx`, `HandOver.tsx`, `Shortcuts.tsx`; `settings/` Settings, its own chunk (`index.ts` its one entry, loaded by `import()`: `npm run deps`): `Settings.tsx`, `kit.tsx` (what its pages are built of) and its pages (`ProjectPage.tsx`, `AgentPage.tsx`, `ProfilePage.tsx`, `GitHubPage.tsx`, `LogPage.tsx`, `AboutPage.tsx`; `agents.ts`, `changed.ts` theirs); `SignIn.tsx` a new account's sign-in (Settings', New Project's); `AgentMark.tsx`, `ProjectIcon.tsx` the marks; `Terminal.tsx` a terminal in a page; `Master.tsx` a master's bar |
| `src/renderer/lib/` | what parts share or what outlives a component, no component, UI library or icon (`npm run deps`): `store.ts` (the window's state as the main process sends it: `useWindow(selector)` in a component, `store.getState()` elsewhere; `act`), `theme.ts`, `cover.ts` (and `cover.css`), `views.ts`, `menu.ts` (what a menu holds, the menu at a point), `project-menu.ts` (a project's, the sidebar's and a tab's), `dialogs.ts`, `settings.ts` (Settings shown, at what), `ask.ts`, `strip.ts`, `keys.ts`, `sidebar.ts`, `grid.ts`, `dock-theme.ts`, `environments.ts` (Stage launch choices and manual terminal focus requests), `terminals.ts`, `agents.ts`, `new-project.ts`, `profiles.ts`, `project-color.ts`, `common.ts`, `names.ts` (name fields: `data-name`), `test-hooks.ts` |
| `src/shared/types.ts`, `ipc.ts`, `stage-layout.ts` (saved-grid normalization and pruning); `src/renderer/env.d.ts` | the shapes the main process sends and the channels they come by ([window.md](window.md), IPC); the bridge (`kulisa`) typed by them |
| `src/renderer/public/avatars/` | the profiles' pictures (Noto Emoji), copied as they are |
| `src/*/renderer/` | a Kulisa package's part of the window (the terminal, dictation, screenshots): its own `README.md` |

## shadcn in Kulisa

- **The theme** is shadcn's `neutral` (`src/ui/theme.css`), Geist and the terminal's JetBrains Mono bundled, so the
  window looks the same on every OS. Kulisa's own colors where shadcn has none are variables beside it (`window.css`:
  `--warning`, `--success`, used as `text-warning`). Dark, Light or System ([window.md](window.md), Theme) is `.dark`
  on the root: `public/theme.js` puts it before the first paint, `lib/theme.ts` changes it; what draws outside CSS (a
  terminal) reads the theme's colors by `termStyle()`.
- **A color is the theme's** (`bg-muted`, `text-destructive`, `var(--card)`), never Tailwind's palette nor written
  out: one palette, dark and light. A literal color only where none can be: the marks.
- **Not Lucide's icons**: the agents' marks (`AgentMark.tsx`: the makers' own, in their colors, 1em), the logo
  (`Logo`, `ProjectIcon.tsx`: its curtain in the color given) and the profiles' pictures (`avatarSrc` in an `Avatar`).
- **No CSS Modules, no second UI library.** A plain `.css` only for what classes cannot say, with its reason: what is
  dockview's own elements (`Grid.css`), Radix's layers (`lib/cover.css`).
- **A component missing**: `npm run ui -- <name>` adds it, without asking whether to; nothing in shadcn fits: say so
  before building one of our own.
- **`npm run lint` refuses** in the window a raw `button`, `input`, `select` or `textarea`, a `className` on a
  component of `src/ui` that is not a literal of layout and size classes and variables, a `style` on one that is not a size, a place
  or a custom property (`kulisa/ui-as-shipped`), Tailwind's palette or a hex color (but the marks), a constant in
  `style` but a variable (a class), `@fluentui` and a `*.module.css`; and React's hook rules (`eslint.config.ts`), not its memoization
  ones: the window is not compiled by the React Compiler.

## Layers over the pages

`lib/cover.ts` sees Radix's layers in the document as Radix draws them, so **no component knows of the pages**: a
dialog's open state is a plain `useState`.

- **A layer with an overlay** (a `Dialog`, an `AlertDialog`, a `Sheet`: `[data-slot$="-overlay"]` open) hides the
  pages while it is open, and the keys are its (`lib/keys.ts`, zone `dialog`).
- **A popper** (a menu, a `Popover`, a `Select`'s list) opens over pictures of the pages: it is drawn once they are
  pictures (`lib/cover.css` keeps it clipped until then), then marked `data-ready` (the tests' handle). A tooltip is
  no layer: it opens over no page (Tooltips).
- **Settings**, no Radix layer, says so itself (`coverPage(true)`, awaited before it is drawn; `coverPage(false)`).
- **Closing**: the grid taken down closes every layer, the window left closes its menus (`closeLayers`), both by the
  Esc Radix closes them on.

## Desktop, not a web page

Kulisa is a desktop app, an IDE: its window looks like one, JetBrains its model (not big titles, framed cards in
frames, pills, rows that show their buttons only under the pointer: those read as a web page's).

- **Flat panes split by a gap** (dockview's `gap`: at 0 the native pages draw over a hairline).
- **The project's color only on its icon** and the title bar's logo (`--project` on the root, `lib/store.ts`; the
  author's choice). `projectColor` (`lib/project-color.ts`): a favicon's hue in Kulisa's lightness and chroma.
- **The sidebar** is shadcn's `Sidebar`, docked in the empty window and in a `Sheet` over the grid (covering as a
  dialog does), so the grid keeps its room.
- **Every object has a right-click menu with all its actions**, so the window shows one or two buttons. No swipes (a
  sideways swipe is the OS's and the pages' back and forward), nor a double-click as the only way to anything.
- **Labels and buttons are not text to select, fields and errors are** (`data-selectable` on a span of the error's
  words); **the arrow over buttons, tabs and menus' rows**, as in Chrome (`window.css`). The window never scrolls
  (`overflow: clip`); a part scrolls inside.
- **An agent's state is an icon each**, not a color alone (some people do not tell yellow from green): one component
  (`AgentState.tsx`) on a task's tab, its row in the sidebar, a terminal's tab.
- **Explanations are a card's line, an empty list's line, a field's `FieldDescription` and tooltips**, not a paragraph
  per section: that reads as documentation.
- **A dialog asks one thing**; what is browsed (Settings) is a nav of categories (shadcn's `Sidebar`) and a page under
  its `Breadcrumb`, saved as it changes, no OK, as Windows' Settings: a project or a profile is a category's page, not
  in the nav (it would grow with each). No search field over the nav (the author's choice). Back to the tasks is the
  nav header's ←: a × at the nav's edge reads as closing the nav.
- **It fits the smallest window** (640 × 400, or any at 200%): a dialog that keeps a height of its own (New Project)
  gives it as `max-h-[70vh]` on our box inside it, so its buttons stay in the window.

## Tooltips

`Tip` (`Tip.tsx`, shadcn's `Tooltip`) on a control where it opens over no page: the title bar, the sidebar, dialogs,
Settings, the tasks' bar's buttons (`side`: over or under them are the pages). The native `title` elsewhere:
- in the grid, over and next to the pages (a pane's tabs, toolbar and header; the terminals' header; the microphone),
  and on a master's bar: the OS draws it above the native views, which would cover the window's;
- on a row (of a list, a nav) and on a text that cuts: a tooltip of the window's over a row covers the row above;
- on a line of the log (Settings → Log, its date): a tooltip per line would be thousands of components.

A tooltip's text is not hoverable: the pointer leaving onto a page moves on no more in the window, and Radix's grace
area would keep it open. A dialog whose first control has one gives the keyboard to itself (`Shortcuts.tsx`): the tooltip opened by
that focus would take the dialog's Esc.

A command with a key says it at the end of its tooltip, as Chrome's toolbar: `withKeys('Reload', 'tab.reload')` →
"Reload (Ctrl+R)" (`lib/common.ts`). A disabled button has no tooltip: it gets no pointer events.

## Menus

`SubmenuContent` includes the component's padding in Radix's available-height limit so long choices scroll inside the window.

`Menus.tsx`, on shadcn's `DropdownMenu`: a button's (`ButtonMenu`: `items` built as it opens; `end`: its end edge at
the button's), an area's right-click menu at the pointer (`RightClickMenu`: `items(e)` the rows for what was
right-clicked, or `null`), one at a point (`menuAt(e, items)`, `lib/menu.ts`: a link in the terminal, a screenshot's
thumbnail). A right-click's and a point's are the window's one menu at a point (`PointMenu`, in `App.tsx`): an
element fixed inside dockview's panels is placed in their box, not the window's; not `ContextMenu`, whose open state
is Radix's own. A Radix menu of a part's own only for a row's own menu inside one
(`ChoiceRow`, `TopBar.tsx`).

- A button's menu opens on the press, and a press, a drag to a row and the release there chooses it, as the OS's
  (Radix's). Rows are chosen with the left button only (on Linux a right-click menu opens on the press, and the
  release must not choose a row).
- One menu at a time, not modal: a press outside closes it and acts there, so another menu opens right from this one,
  as a menu bar's. Leaving the window closes it: the window's blur from the main process (`window:blur`), not its
  page's, which Radix would close it on (a profile's page taking the keyboard as it loads, on macOS, would close a
  menu under the hand). Closed, it gives the keyboard back where it was before it opened (the terminal, a field), not
  to its button. A delayed close leaves the keyboard with any menu opened meanwhile.
  A blur checks the native window's current focus (`window:focused`): the page's focus can lag the OS's, and a stale
  notification must leave a window that has focus again alone.
- Gone at once as it closes, not faded: a fading menu keeps the keyboard, taking it back from a dialog its row opened
  under the pointer, and takes the next Esc.
- It shows once the pages under it are pictures (Layers); then its list is `[role="menu"][data-ready]` (the tests'
  handle).
- Rows are `MenuItem`s (`lib/menu.ts`).
- **A row's accessible name is its label alone** (`aria-label`), so it is found by what it says.

## Dialogs

- shadcn's `Dialog` (a question: `AlertDialog`), its open state a `useState`; the pages hidden under it (Layers).
- Every dialog of a tasks' window is in `App.tsx` from the start and registers what it does (`registerDialog`);
  anything opens one by name: `(await dialog('newproject')).open()` (`lib/dialogs.ts`). Settings is not a
  dialog: `openSettings(section, id)` (`lib/settings.ts`), through the main process, which logs it.
- Its content is mounted only while it is open, so what must outlive it lives outside it: an agents' list and its
  install (`lib/agents.ts`), New Project's steps (`lib/new-project.ts`), Change Agent's (a store in `HandOver.tsx`).
- One that waits for an answer takes no click outside or × (`onInteractOutside`; `AgentPicker.tsx`); Esc cancels it.
- **Questions** before something that cannot be undone, before closing, or between two ways to go are not new dialogs:
  `ask(q)` (`lib/ask.ts`) or the main process's `shell.ask` → `Ask.tsx`, an `AlertDialog`, queued: Cancel has the
  keyboard, Esc is Cancel, a click outside does nothing.
- **A page's alert or confirm** (`ProfilePane.tsx`) is drawn in its pane, not modal, over a dimmed picture of the page,
  as Chrome shows it; the other panes go on.
- **New Project** is `Wizard` (`NewProject.tsx`), shown by the dialog and by the welcome (`Welcome.tsx`, in a `Card`),
  never a copy of the steps: it gives its parts (steps, error, Back, Next) to what shows it. A Create under way keeps
  the dialog open however it would close.

## Controls

- **A page of Settings** is a column of sections (`kit.tsx`). A section is a `Card` (`role="group"`, named by its
  title): its `CardTitle`, its **Add …** as the `CardAction`, its settings (each a `Field`), its things
  (`Things`: `Item`s). A thing's row: its picture, its name, one line under it (default and state `Badge`s by the
  name), its actions its ⋯ and its right-click (the same rows); a row that opens a page ends in a chevron instead.
  What is added in place goes under the rows (`AddInPlace`: Enter takes it, Esc puts it away). A list of words
  (hosts) is a field and its words as `Badge`s with their ×.
- **A section of a dialog** is a `FieldSet` under its `FieldLegend`; a choice of one agent a `RadioGroup` of shadcn's
  choice cards (a `FieldLabel` around a horizontal `Field`: `AgentPicker.tsx`, `HandOver.tsx`); a checkbox's row a
  horizontal `Field`.
- **Notices**: work under way (an install, a sign-in, a search) is a `Spinner` with its label, the line the `status`; a
  `Progress` once how far it is is known (Change Agent's reading). An
  error of a field is that `Field`'s `FieldError` (`data-invalid` on the field, `aria-invalid` on its control); any
  other error, a warning, a step to take or what is done is an `Alert` (`variant="destructive"` an error's, its text
  selectable). A confirmation that passes (Copied, Saved as) is a `toast` (sonner's `Toaster`), in Settings only
  (elsewhere in a tasks' window the pages would cover it), at the bottom left, over the nav's empty foot: at the right
  are a page's buttons (the log's).
- **Tabs** are shadcn's `Tabs` as browser tabs, which shadcn does not have (`BrowserTabs.tsx`: `TabStrip`,
  `BrowserTab`): the tasks' bar, a pane's tabs, the terminals'. A tab is chosen on the press, as a browser's (not on its ×). Its × is on every tab, always, as Chrome's: inside the tab, so not a button (a button holds none) but a
  `role="button"` span that takes its own click and never the tab's press; a terminal's agent mark (Change Agent)
  likewise. A task's tab keeps its width whichever is shown, so none moves under the mouse ([window.md](window.md),
  The tasks' bar). A pane's tabs shrink to their icon and ×; a terminal's never shrinks (the agents' marks look alike).
- **A strip of tabs that do not all fit** (those three, the closed profiles' buttons) shrinks, then scrolls: `useStrip`
  (`lib/strip.ts`), not tabs moved past the end into a menu, which pushes others under the mouse (Office's model, not
  Chrome's): no scrollbar; a mouse's wheel scrolls it sideways; an edge with tabs past it fades (`data-past-start`,
  `data-past-end`); the chosen tab is brought into sight only when another is chosen, a tab grows in (`grow`) or the
  strip is resized, so an update (a title, a page loading) leaves it where the human scrolled it.
- **A narrow pane gives up its buttons in order** (Back and Forward, then Reload, into ⋮; never Pick or ⋮): container
  queries on the pane (`@container`, `ProfilePane.tsx`); the address is no button, it shrinks.

## Own drawing

What is drawn or moved here rather than by shadcn, each for a reason at it:

- dockview's look, its variables set from the theme's (`Grid.css`);
- the dictation's pill with its wave bars, read from the microphone (`src/dictation/`, its `README.md`); its motions and
  the microphone's ring are Tailwind's and tw-animate-css';
- the strips (`lib/strip.ts`, its classes on the element `useStrip` is given): the fades tied to the scroll; a tab
  growing in (`grow`, the Web Animations API); the marks and the logo;
- the browser tabs' ×, drag and drop marks (`BrowserTabs.tsx`);
- a page's alert or confirm placed in its pane under the address bar (`ProfilePane.tsx`): a dialog is placed over the
  window;
- Settings' frame (`Settings.tsx`): the nav beside the page, the path over it, the page scrolling with its scrollbar
  at the window's edge;
- the log's box of lines (`LogPage.tsx`): shadcn has no log view; its tags in the theme's colors; the installer's
  output (`AgentPage.tsx`, `AgentPicker.tsx`) a `role="log"` of monospace lines, as tall as what it says;
- the steps' names of New Project (`StepNames`, `NewProject.tsx`) and the welcome's dots (`Dots`, `Welcome.tsx`):
  shadcn has no stepper, and its `carousel` brings no dots;
- the welcome's pictures (`Welcome.tsx`): a task's window drawn small in boxes of our own, its terminal's lines in a
  terminal's colors.