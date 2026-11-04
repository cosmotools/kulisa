# The window's UI

Use shipped shadcn/ui ([README](../src/ui/README.md)), following its current examples and generated source.
Component callers pass layout/size classes, variants and custom properties; the theme owns appearance. Never
hand-edit generated `src/ui` files. Use wrappers for custom layout/drawing, not styling patches on components.
Prefer upstream components/props/patterns; justify necessary deviations in comments.

Dockview owns grids; zustand owns window state; xterm owns terminals; Pierre owns Diff/tree virtualization;
TanStack Virtual owns log rows. Grid lifecycle and native-page geometry: [window.md](window.md#the-grid).
Stage uses a 6 px gap for native pages; development uses gap 0. Resources' native vertical tab header owns its border,
including when collapsed. Pane content can shrink and isolates stacking so overlays stay below Dockview separators;
menus stay above them.

## The code

| Area | Responsibility |
|---|---|
| `src/renderer/*.html`, `main.tsx`, `master.tsx`, `public/theme.js` | Window/master entries; theme before first paint |
| `src/renderer/window.css` | Global theme, selection, cursor and scroll rules |
| `components/App.tsx`, title/task bars, sidebar, empty/welcome | Window frame and task navigation |
| `components/welcome/Welcome.tsx` | Welcome entry; its examples, SVG characters, animation CSS and assets stay in `welcome/` |
| `components/project-map/ProjectMap.tsx`, `components/NewProject.tsx` | Shared project form and its dialog wrapper; the draft stays in `lib/new-project.ts` |
| `task-view/` | Retained task screens, both Dockviews and their outer split, pane controls, Resources, native-view bounds |
| `components/settings/` | Lazy Settings chunk through its `index.ts`; shared page controls in `kit.tsx` |
| `components/Menus.tsx`, dialogs, `lib/menu.ts`, `dialogs.ts`, `ask.ts` | Shared menus/questions/dialog opening |
| `lib/` | Non-component state, actions, lifecycle and coordination; no UI library/icon imports |
| `src/shared/`, `env.d.ts` | Main/renderer contracts and typed bridge |
| `src/*/renderer/` | Kulisa package UI, documented by its README |
| `public/avatars/` | Bundled Noto Emoji profile pictures |

`lib/store.ts`: components use `useWindow(selector)`; other code uses `store.getState()`.
The `task-view/` module exposes actions/hooks through `index.ts` and UI through `TaskView.tsx`; dependency-cruiser
protects these entries. Resources sections use SidebarContent scrolling inside Dockview's named region; avoid duplicate
region wrappers.

## shadcn in Kulisa

The upstream `shadcn` skill supplies component patterns. Kulisa's rules here take precedence:

- Use the pinned CLI for read-only commands: `node node_modules/shadcn/dist/index.js <command>` in place of
  `npx shadcn@latest`. Configuration is in `components.json`; imports outside `src/ui` go through `@ui`.
- Generate components and theme through `npm run ui` (adding components below), as
  [src/ui/README.md](../src/ui/README.md) describes. Keep generated source unchanged instead of applying the skill's
  manual edits or smart merges. Kulisa's theme overrides belong in `src/renderer/window.css`.
- Preserve the native-page layer, tooltip, menu and scrolling rules below when composing upstream components.

- Use shadcn neutral, bundled Geist and JetBrains Mono. `.dark` controls window theme; `public/theme.js` applies it
  before paint, `lib/theme.ts` updates it. Native drawings read `termStyle()`.
- Use theme tokens, not literal colors/Tailwind palette. Kulisa-specific warning/success variables live in
  `window.css`. Brand marks are the color exception.
- Resources uses `text-sm` for filenames/messages/controls, `text-xs` for captions/status/metadata.
- App branding uses the original red `assets/icon.svg` through `AppLogo`; project icons keep their project color.
- Use Lucide except maker marks (`AgentMark`), logo/project icon, profile avatars and file-type icons.
- Add missing shadcn components with `npm run ui -- <name>`. Discuss custom components if none fits.
- No CSS Modules or second UI library; standalone CSS needs a reason (Dockview/Radix layers).
- ESLint enforces shipped UI styling, no raw form controls, theme colors, hook rules and no Fluent UI. React Compiler
  memoization rules are not enabled.

## Layers over the pages

`lib/cover.ts` sees Radix's layers in the document as Radix draws them, so **no component knows of the pages**: a
dialog's open state is a plain `useState`.

- **A layer with an overlay** (a `Dialog`, an `AlertDialog`, a `Sheet`: `[data-slot$="-overlay"]` open) hides the
  pages while it is open, and the keys are its (`lib/keys.ts`, zone `dialog`).
- **A popper** (a menu, a `Popover`, a `Select`'s list) opens over pictures of the pages: it is drawn once they are
  pictures (`lib/cover.css` keeps it clipped until then), then marked `data-ready` (the tests' handle). A tooltip is
  no layer: it opens over no page (Tooltips).
- **Settings**, no Radix layer, says so itself (`coverPage(true)`, awaited before it is drawn; `coverPage(false)`).
- **Closing**: switching tasks closes every layer; leaving the window closes menus (`closeLayers`), using Radix's Esc
  handling. Dialog content remains mounted through exit animations; focus handoffs wait for removal.

## Desktop, not a web page

- Use flat Dockview panes and compact rows. Keep project color on its icon/title logo (`--project`, author's choice).
- Sidebar docks in the empty window; over tasks it uses a Sheet without resizing the grid.
- Give objects complete right-click menus and one or two visible actions. Avoid swipes and double-click-only actions.
- Labels/buttons are unselectable; fields, errors (`data-selectable`) and review code permit selection. Use arrow
  cursors on controls. The window never scrolls; parts own their scrolling.
- Represent agent state with distinct icons (`AgentState`), not color alone.
- Explain controls through field descriptions, tooltips and concise empty/status lines.
- Dialogs ask one thing. Settings uses categories, breadcrumbs, immediate saving and a back arrow; entities open
  within categories. No nav search (author's choice).
- Fit 640 × 400 and 200% zoom; cap dialog content height, e.g. `max-h-[70vh]`, keeping buttons reachable.

## Tooltips

Use `Tip` (shadcn Tooltip) only where it cannot overlap a native page: title/sidebar/dialogs/Settings and suitable
task-bar buttons. Use native `title` on pane controls, Resources, master bars, list rows, clipped text and log lines:
native views cover HTML tooltips, and per-log-line components are costly.

Disable tooltip hoverability: crossing into a native page stops pointer events and can leave Radix's grace area
open. Give dialog initial focus to the dialog itself if its first control has a tooltip, or Esc closes the tooltip.
`withKeys('Reload', 'tab.reload')` appends the shortcut. Disabled buttons receive no pointer events/tooltips.

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
  install (`lib/agents.ts`), New Project's draft (`lib/new-project.ts`), Change Agent's (a store in `HandOver.tsx`).
- One that waits for an answer takes no click outside or × (`onInteractOutside`; `AgentPicker.tsx`); Esc cancels it.
- **Questions** before something that cannot be undone, before closing, or between two ways to go are not new dialogs:
  `ask(q)` (`lib/ask.ts`) or the main process's `shell.ask` → `Ask.tsx`, an `AlertDialog`, queued: Cancel has the
  keyboard, Esc is Cancel, a click outside does nothing.
- **A page's alert or confirm** (`ProfilePane.tsx`) is drawn in its pane, not modal, over a dimmed picture of the page,
  as Chrome shows it; the other panes go on.
- **New Project** uses `project-map/ProjectMap.tsx`, shared by the dialog (`NewProject.tsx`) and the welcome
  (`welcome/Welcome.tsx`). Its
  draft owns validation/creation; each node edits that draft. Its scrollable body keeps Create reachable. A Create
  under way keeps the dialog open however it would close.

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
  `Progress` once how far it is is known (Change Agent's reading). Diff uses one indeterminate `Progress` in the review
  while file rows and code prepare; its search and From/To controls stay visible. An
  error of a field is that `Field`'s `FieldError` (`data-invalid` on the field, `aria-invalid` on its control); any
  other error, a warning, a step to take or what is done is an `Alert` (`variant="destructive"` an error's, its text
  selectable). A confirmation that passes (Copied, Saved as) is a `toast` (sonner's `Toaster`), in Settings only
  (elsewhere in a tasks' window the pages would cover it), at the bottom left, over the nav's empty foot: at the right
  are a page's buttons (the log's).
- **Tabs** are shadcn's `Tabs` as browser tabs, which shadcn does not have (`BrowserTabs.tsx`: `TabStrip`,
  `BrowserTab`): the tasks' bar and a pane's tabs. A tab is chosen on the press, as a browser's (not on its ×). Its × is on every tab, always, as Chrome's: inside the tab, so not a button (a button holds none) but a
  `role="button"` span that takes its own click and never the tab's press. A task's tab keeps its width whichever is shown, so none moves under the mouse ([window.md](window.md),
  The tasks' bar). A pane's tabs shrink to their icon and ×. They share a 32 px row with navigation and page controls; an
  address editor occupies the tabs’ and + button’s space while editing, with the strip kept mounted to preserve its
  elements. Development terminals switch through Resources’ named sidebar rows.
- **A strip of tabs that do not all fit** (the tasks' bar, a pane's tabs, the closed profiles' buttons) shrinks, then scrolls: `useStrip`
  (`lib/strip.ts`), not tabs moved past the end into a menu, which pushes others under the mouse (Office's model, not
  Chrome's): no scrollbar; a mouse's wheel scrolls it sideways; an edge with tabs past it fades (`data-past-start`,
  `data-past-end`); the chosen tab is brought into sight only when another is chosen, a tab grows in (`grow`) or the
  strip is resized, so an update (a title, a page loading) leaves it where the human scrolled it.
- **A narrow pane gives up its buttons in order** (Back and Forward, then Reload, into ⋮; never Pick or ⋮): container
  queries on the pane (`@container`, `ProfilePane.tsx`); the tabs or address editor shrink.

## Own drawing

What is drawn or moved here rather than by shadcn, each for a reason at it:

- dockview's look, its variables set from the theme's (`Grid.css`);
- Diff's indeterminate progress motion (`src/diff/renderer/loading.css`): shadcn supplies the bar and semantics;
  a transform animates its indicator without layout work;
- the profile notch's concave shoulders (`task-view/ProfilePane.css`): masked corners attach its identity to the top edge;
- the dictation's pill with its wave bars, read from the microphone (`src/dictation/`, its `README.md`); its motions and
  the microphone's ring are Tailwind's and tw-animate-css';
- the strips (`lib/strip.ts`, its classes on the element `useStrip` is given): the fades tied to the scroll; a tab
  growing in (`grow`, the Web Animations API); the marks and the logo;
- the browser tabs' ×, drag and drop marks (`BrowserTabs.tsx`);
- a page's alert or confirm placed in its pane under the controls row (`ProfilePane.tsx`): a dialog is placed over the
  window;
- Settings' frame (`Settings.tsx`): the nav beside the page, the path over it, the page scrolling with its scrollbar
  at the window's edge;
- the log's box of lines (`LogPage.tsx`): shadcn has no log view; its tags in the theme's colors; the installer's
  output (`AgentPage.tsx`, `AgentPicker.tsx`) a `role="log"` of monospace lines, as tall as what it says;
- the project's fixed map connectors (`components/project-map/ProjectMap.tsx`): decorative SVG between shadcn cards, hidden in the narrow
  column layout; no graph editor or graph dependency;
- the welcome's web/CLI examples (`components/welcome/`, entered through `Welcome.tsx`): switched through shadcn Tabs, with no real pages or terminal
  processes. `WebExample.tsx` shows a fictional shop in Customer and Admin browser profiles side by side, linked by
  order #1042. Both pages keep a 1120 × 656 desktop layout and scale into their frames with CSS. One ResizeObserver on the pair
  updates their scale and the character’s coordinates, and disconnects on unmount. Pages stay light using theme token variants,
  independently of browser chrome; product photos are bundled, never fetched at runtime.
  `animations.css` owns one shared 20-second CSS cycle. A small red curtain character chooses a product,
  scrolls and places an order in Customer, then moves across to Admin and opens the matching order. Customer
  holds its result while Admin is used; Admin stays still until the character arrives. `AgentTerminal.tsx` draws
  the user’s coding CLI with a request, file edits, indented tool results and a bottom prompt/status line. Its
  animated transcript follows the cycle and its header names CLI examples, without presenting a Kulisa agent.
  `CliExample.tsx` shows a coding agent under development: shell launch, a typed request, file access, a diff and
  a checked response. Its native 960 × 360 terminal scales with one ResizeObserver; `DemoAgent.tsx` is shared
  by the web and CLI examples. The lower transcript remounts with the selected example so both clocks start together. This coordinated timeline needs named keyframes rather than independent utility animations. Pause
  freezes the entire cycle; reduced motion shows its final result. Switching examples or leaving welcome unmounts
  the animated elements. `CoffeeBreak.tsx` adds an SVG vignette beside the example on wide windows: a person
  sends the task, reclines with coffee and nods at the result. Its upper body and chair back pivot at the hips;
  the legs stay supported by an ottoman. The back, arm and head follow the same clock and
  pause state; narrow or very short windows omit the vignette. No JavaScript animation timer or running browser is retained. Photo sources and license
  live beside the photographs in `welcome/assets/CREDITS.txt`; the build emits them as `welcome-photography-CREDITS.txt`.
  Vite imports the photographs from this folder. Outside callers use only `Welcome.tsx` and `ProjectMap.tsx`,
  enforced by dependency-cruiser; the shared project draft and app branding stay outside these views.
