# The window's UI

What the window is built of: the tokens, the icons, and the components, each defined once, so every dialog, button
and list looks and behaves the same. **Before making a button, an icon, a row or a dialog, look here:** use the
component, or add one here (and in `components.css`) when nothing fits. Keep this file current.

Vue 3 components in TypeScript, built by Vite (`vite.config.mts`, into `dist/renderer`). Before using a part of Vue
new to the window, read its page in Vue's own documentation for agents (`https://vuejs.org/llms.txt`, each page as
`.md`; it describes 3.5, the installed version); official sources only, no community skills or MCP servers (the
author's choice). The
generic parts are Reka UI's (`reka-ui`, the author's choice: behavior, keyboard and accessibility, no look of its own),
in the look below: menus, dialogs and the controls Reka has (choices, radios, selects, checkboxes, lists, tabs …);
nothing of our own where Reka has it. Its documentation for agents: `https://reka-ui.com/llms.txt` (each page as
`.md`); its API: the installed version's `node_modules/reka-ui/dist/` (`.d.ts`). Not Reka's: what is not generic (the
grid is dockview's: panels, splits, drag and drop, tabs of panels, saving the grid, its API before layout code of our
own; the terminal xterm's) and tooltips: the native `title`, drawn above the profiles' pages (an HTML one would be
under them).

**The profiles' pages are native views, drawn above the window's HTML**: HTML over a pane is under its page. So
whatever HTML covers the panes hides the pages or puts pictures of them in their place: every menu and dialog opens
through `covered()` (`lib/cover.ts`; a tasks' window's pages under it: `lib/views.ts`), which puts the pages back
however it closes; while a panel is dragged, pictures stand in too. The renderer sends each pane's `.content` box (or
that it is off screen) to the main process after every grid change (docs/window.md).

| Where | What |
|---|---|
| `src/renderer/components/*.vue` | the window's parts, each its markup, behavior and own look (`<style>`, rooted at its id or class): `App.vue` puts a tasks' window together; `grid/` the grid's panels and headers, `menu/` the menus (`ButtonMenu`, `RightClickMenu`, `PointMenu`, `MenuRows`) and ☰'s own rows; `Modal.vue` the dialogs; the clusters (below): `settings/` Settings' window (`Settings.vue`, its pages `ProjectEditor.vue`, `AgentPage.vue`, `ProfilePage.vue`, `GitHubPage.vue`), `newproject/` New Project's steps |
| `src/renderer/lib/*.ts` | what parts share or what outlives a component: `store.ts` (what the main process sends, `act`), `grid.ts`, `terminals.ts` (a tasks' window's island; the terminal itself is `src/terminal/`), `menu.ts` (what a menu holds), `agents.ts` (the agents' list of a dialog, and an install under way), `ask.ts`, `dialogs.ts`, `keys.ts`, `cover.ts` (`covered()` for every menu and dialog: one menu at a time, all closed at once), `views.ts` (a tasks' window's profiles' pages under them: hidden, or pictures), `profiles.ts` (the profiles' menu), `names.ts` (name fields), `strip.ts` (a strip of tabs that scrolls), `common.ts`, `test-hooks.ts` (what the tests reach by name) |
| `src/shared/types.ts`, `ipc.ts`; `env.d.ts` | the shapes the main process sends, the channels they come by (docs/window.md, IPC); the bridge to it (`src/preload`) typed by them, and Vite's types |
| `src/renderer/tokens.css` | every color and size (`:root`); no literal color anywhere else |
| `src/renderer/components.css` | the shared components below, global |
| `src/renderer/index.html`, `main.ts`; `settings.html`, `settings.ts`; `master.html`, `master.ts` | a tasks' window's page, Settings' window's and a master's window's: the theme before the first paint, then the app. Settings' loads nothing of a tasks' window (no grid, no store of its tasks): `cover.ts` and the terminal (`src/terminal/renderer/`) are what the two share of `views.ts` and `terminals.ts` |
| `src/renderer/public/avatars/` | the profiles' pictures, copied as they are |

## Desktop, not a web page

Kulisa is a desktop app, an IDE: its window looks like one, JetBrains' Settings its model (not big
titles, framed cards, a paragraph each, pills and rows that show their buttons under the pointer: those read as a
web page's and are hard to read). The one pill: the closed profiles' buttons over the terminal (`.opener`), the one
place where a button is there to draw the eye, seen only while no profile is open. So:

- **JetBrains' UI font and size**: Geist (shadcn-vue's) at 14 px (a step above their UI Guidelines' 13, Typography: 13 reads small), bundled
  (`@fontsource-variable/geist`, `app.css`), so the window looks the same on every OS (the OS's own, on Linux Noto
  Sans, is wide and reads as a web page's). The terminal keeps JetBrains Mono.
- **Two text sizes** (`--font`, `--font-small` for group titles and a dialog's title), two weights; nothing bigger.
  Weight and color carry what matters, not size. The one exception, the welcome (`welcome/`), the one place the window
  speaks to a new user rather than being worked in: its questions and slides' titles `--font-hero`, the words under
  them `--font-lead`.
- **Dense**: rows and controls `--control` high (`--row` the same), toolbar buttons 24 px, corners `--corner` (4 px)
  on controls and `--island-radius` on windows and dialogs.
- **One scrollbar everywhere** (`components.css`, `--scrollbar`): a rounded thumb on no track, no arrows, as JetBrains'
  (not the OS's, with arrows, in menus, Settings and dialogs). Chromium's `::-webkit-scrollbar`:
  the standard `scrollbar-color` and `scrollbar-width: thin` left the arrows. A tabs' strip has none
  (`scrollbar-width: none`): it scrolls by the wheel.
- **Forms are "Label: field"**, the labels in one column (`.field`); a comment under a field only when needed.
- **Groups under a titled line** (`.titled`), not framed cards: no frame in a frame.
- **A list has a toolbar over it** (`.list`: + adds, − removes the selected row, ★ makes it the default), and
  its actions act on the selected row (also Delete, and its right-click). It is a table: the names of its columns,
  then rows of facts, each in its column (what it is, its path or email muted, a state at its end in words: "default",
  "no commit yet"), the columns at the same places in every row (values one after another read
  as chaos); no buttons that show under the pointer, no pills.
- **Every object has a right-click menu with all its actions** (a profile's pane, a task's tab, the terminal), so the
  window shows one or two buttons and the rest is in menus. Not swipes (a phone's gesture; on a laptop's touchpad a
  sideways swipe is the OS's and the pages' back and forward), nor a double-click as the only way to anything (nobody
  sees it; only a shortcut to a menu's item).
- **A dialog asks one thing and ends with its buttons** (`Modal.vue`); what is browsed (Settings, a window of its own:
  [window.md](window.md), Settings) is a tree on the left and a page on the right, under its path. No search field over the tree (the author's choice).

## Tokens (`tokens.css`)

- Colors for both themes ([window.md](window.md), Theme): each is `light-dark(light, dark)`, so a new color gets
  both values. JS reads a color as shown through an element that uses it (`src/terminal/renderer/`), not the token's text.
  JetBrains' themes: `--window` (the title bar, under the grid and the tasks' bar), `--island` (panels, dialogs, menus), `--island-hi`
  (a lit row, a divider), `--toolbar` (a pane's toolbar and active tab), `--field`, `--button`, `--line` (borders);
  text `--text`, `--text-strong`, `--text-dim`, `--text-muted`; `--blue` (main button, focus), `--danger`,
  `--error`, `--note` (what waits for the human), `--agent` (the agent's caption on a pane, in the accent's hue, not
  `--note`'s, the color of "waiting for you"), `--done`; `--on-accent` (text on `--blue` and `--danger`),
  `--selection` (the terminal's); `--chosen`, `--chosen-idle` (a list's selected row, while the list has the keyboard
  and when it has not: JetBrains'); `--page-button`, `--on-page-button`, `--page-pad` (Chrome's blue and room, a page's
  dialog: `.pagedialog`); `--page`, `--backdrop`, `--shadow`; `--hover` (under the
  pointer, on any background); `--project` (the shown task's project's color, set by `lib/store.ts`), `--glow` (the window's glow, the same color, kept as the last task closes so the glow fades in it; registered as a color, `@property`, so it changes softly: `App.vue`).
- Sizes: `--sans` (the window's font, Geist), `--font` (all text, the terminal too), `--font-small` (a group's title, a dialog's title), `--font-hero` and `--font-lead` (the welcome's alone, above), `--control` (the
  height of buttons and fields), `--tab` (a tab's: a step taller), `--corner`,
  `--tab-radius` (a pane's tab's and a task's), `--island-radius`, `--gap` (the space between and inside islands, between the
  window's rows, between the tasks' tabs; also dockview's `gap` in `Grid.vue`), `--bartab` (a task's tab's height), `--title` (the title bar's: `--gap`,
  `--control`, `--gap`; the OS buttons' strip is as tall, `window.ts`); room as Chrome's menus and dialogs have it: `--row` (a row of a menu or a list), `--inset` (inside
  a row, between its icon and text, between a dialog's fields), `--pad` (inside a dialog along its edges), `--label` (a form's labels' column, "Name:", `.field`, and what lines up
  with its fields). Space
  comes from these, not from new numbers (things set close together). The
  Kulisa zoom scales them all.

## Icons

Lucide's (`@lucide/vue`, lucide.dev; the one shadcn-vue uses), imported where used: `<XIcon />`. Choose by the name
Lucide gives the meaning (× `XIcon`, ⋮ `EllipsisVerticalIcon`, an agent's states `STATE_ICONS` in `lib/agents.ts`);
the same meaning, the same icon everywhere. A place sizes it with a utility (`size-4`); where nothing does, it is
16 px. What Lucide does not have is ours, in `components/marks/`, an `<svg data-icon="…">` each: the app icon with its
curtain in the text's color (`LogoMark.vue`: the title bar's, a project's without a favicon, `ProjectIcon.vue`), the
agents' marks in their makers' colors (`agentMark` in `lib/agents.ts`; not under the GPL: `docs/LICENSING.md`), and
GitHub's (Lucide has no brands' marks). Pictures are not icons: the arrangements in ☰ are drawn in place; the
profiles' pictures are files of their own (`src/renderer/public/avatars/`, Noto Emoji). The test `icons: …` in
`test/e2e/window.spec.ts` checks that every other `<svg>` is one of these.

## Components (`components.css`)

What is `hidden` is off the screen, whatever `display` its component sets (`[hidden] { display: none !important }`,
the browser's own `until-found` apart): a component's `display` beats the browser's own `[hidden]` rule. Tests check what is on screen (`checkVisibility()`), not the attribute.

### Buttons

- `<button>`: a framed button with text, `--control` high. `.primary` (blue, the main action of a dialog, last in its
  footer), `.danger` (red, when it deletes). Lit under the pointer and darker while pressed, so it answers the hand;
  a button of its own kind (`.icon`, a tab) keeps its own (the rule is as weak as `button`'s). Disabled: faded.
- `.icon`: an icon alone, square with `--corner` corners as a toolbar's, no frame, lit under the pointer (`--hover`);
  always with `aria-label` (or `title`).
  - `.quiet`: muted until pointed at, for × and removing.
  - `.small`: 24 px, inside a row or a list's toolbar (a tab's ×, a task's ×, `.list`'s + − ★).
  - `.round`: a circle filled `--island-hi`, an 18 px icon: a button that stands out in a row (the dictation's microphone).
  - `--icon`: the icon's size, when a place needs another (☰ is 18 px).
  - A `<span class="icon">` where a button cannot be (a tab's ×, inside the tab).
- In the title bar, a button is still one of these. shadcn-vue's `Button` (`components/ui/button`) where a part is
  already in Tailwind (a menu row's 🗑); the element rules of `components.css` are in `@layer base`, so its utilities
  win.
- `:title="withKeys('Reload', 'tab.reload')"` (a command of `src/main/keys.ts`; `lib/common.ts`): its key at the end
  of its tooltip, "Reload (Ctrl+R)", as Chrome's toolbar says it.

### Rows

- `.item`: a row of a list (Settings' rows, the board's tasks), `--row` high: an optional icon (`.ico`), `.dot`
  (a project's color, `--color`), `ProjectIcon.vue` (a project's icon in its color: its favicon, one of Kulisa's set or
  the curtain; `.picon`, also on a task's tab in the tasks' bar, 20 px there) or `.avatar` (a profile's picture), `.text` with `.label` and a `small` line under it, a `kbd` key at the end. Lit under the
  pointer and on keyboard focus. Named by its label alone (`aria-label`), not its icon, its `small` line or its key.
- `.list`: a list a dialog edits (a project's Code, Agents and Profiles; New Project's folders; an agent's accounts),
  or chooses from (Settings → Agents' agents, no toolbar), as JetBrains': framed,
  `.tools` over it (`.icon.small` buttons: + adds, often a `ButtonMenu`; − removes the selected row; ★ makes it the
  default), then `.head` (its columns' names, small and dim; shown with rows), then its rows, Reka's Listbox items
  (`.item`, a `.cell` a value: the `.label` first with its icon or picture, its facts in `small.cell`, muted; a state in
  the last, `.cell.end`, `kbd`: "default" (`.default`), `.warn` in `--note` when it needs the human), each cut with …
  and whole in its title. The list sets its columns, `--cols` (e.g. `fit-content(45%) minmax(0, 1fr) auto`: the name as
  wide as it needs up to about half, what it is in the rest, the state); the head and the rows take them by `subgrid`,
  so they line up. The selected row in `--chosen` (`--chosen-idle` when the list has not the keyboard). Delete removes
  the selected one; a `RightClickMenu` around the whole `.list` has the row's actions (it selects the row): around the
  Listbox, which is there only with rows, its menu did not open on a row added after. `.empty` in it when it has none.
- `.titled`: a group's title, its name and a line to the end (JetBrains' titled separator), over a `.list` or fields.
- `.item[aria-selected="true"]`: the chosen row of a list (Reka's Listbox, Tree), lit.
- `.dot`: a 10 px circle in `--color`, a project's.
- `.launcher`: a tile, big, for the hand to find at once where nothing else is: an icon or a profile's picture as
  large as two rows, its `.name`, a `small` line under it (an account's email; none under a profile's: who it is is in its tooltip, as under the name the tile's edge would cut it), on an island's color,
  lit under the pointer. The empty grid's agents and profiles (`Terminals.vue`).
- `.opener`: a button that names a thing it opens, in one row beside what is looked at: a pill, large and bold to
  draw the eye (as high as 1¾ rows), a profile's `.avatar` (as the tiles'), its `.name`, the action's icon (20 px, muted) at the end; up to 18em wide, the name cut with … so that one long
  name does not crowd out the rest, the whole in its tooltip. The closed profiles over the terminal
  (`ClosedProfiles.vue`; Add Profile… with no picture).
- `.dots`: where one is in a few slides or steps, a short bar each, lit up to the one shown (an `ol`, `li[data-on]`): the
  welcome's slides and its steps.
- `.chip`: a thing named in a pill, its icon first (14 px, muted), `--font-small`: what goes along to another agent
  (Change Agent). A name the human gave (a folder, a branch) goes in a `.name` inside it: cut with … past 14em, the
  whole in the chip's tooltip; a row of chips gives way before what is beside it (the terminals' tabs).

### Controls

The window's controls are Reka UI's, in this look:

- `.radio`: a radio (Reka's `RadioGroupItem`, its `RadioGroupIndicator` the dot), in a `RadioGroupRoot`: at a row's
  start (the row a `<label>`), exactly one of a list: the agent to start (`AgentList.vue`). The arrows move between
  them. Not for a list's default, whose rows are what the list is about: a radio there reads as choosing the row; that is "default" at the row's end and ★. Not for a few big choices either
  (New Project's code: a list on the dialog's left, Reka's Listbox, as JetBrains' New Project).
- `.checkbox`: a checkbox (Reka's `CheckboxRoot`, its `CheckboxIndicator` the check, `CheckIcon`): New Project's agents and profiles, the log's Follow.
- `.select`: a button that opens what to choose from below it (Reka's `Popover`), as a field: the chosen one and
  `ChevronDownIcon` (a profile's picture); or Reka's `Select`, where the choices are rows of words, in a menu's look (`.menu`, its
  rows `.item`, the chosen one checked: `CheckIcon`): a repository's GitHub account (`settings/RepoAccount.vue`).
- `.choices`: icon buttons (`.icon`) to choose one of, the chosen one ringed in `--blue`: a profile's pictures
  (Reka's `ToggleGroup`, one always chosen).
- `.chips`: a row of `.chip`s to choose one of (Reka's `ToggleGroup`, one always chosen), the chosen one in `--chosen`
  with the accent's edge: the log's preset filters (`settings/LogPage.vue`).
- `.editable`: a value edited in place (Reka's `Editable`: a profile's name, who it is, its test login): text in a
  field's box (`.preview`), a click or Tab edits it; Enter or leaving saves, Shift+Enter is a new line where it has
  lines, Esc puts it back (and leaves the dialog open).
- Fields in a dialog: shadcn-vue's `Field`, `FieldLabel`, `Input`, `FieldDescription`, `FieldError`; choosing one of a
  few, its `RadioGroup` (the agents to choose from, `AgentList.vue`: its choice cards).
- Tabs: a pane's tabs and the tasks' tabs are Reka's `Tabs` (`activationMode` manual): chosen on the press, as a
  browser's (not on their ×), one Tab stop for the strip, the arrows move and Enter chooses. A task's is shown on
  the release, or as its drag begins ([window.md](window.md), The tasks' bar).
- A strip of tabs that do not all fit (the tasks' bar, a pane's tabs, the closed profiles' tiles, the terminals' tabs) is `.tabstrip` (`components.css`) with
  `useStrip` (`lib/strip.ts`), one for every strip, so all scroll one way:
  no scrollbar; a mouse's wheel scrolls it sideways (Shift and a touchpad's swipe are the browser's: with Shift both
  would scroll, twice as far); an edge with tabs past it fades (`--fade`; `data-past-start`, `data-past-end` from the scroll: CSS's
  scroll-driven animations leave an edge faded when little is out of sight); the active tab is brought into sight,
  clear of the fade, when another is chosen (`aria-selected`, Reka's), a tab grows in or the strip is resized, and only then, so an update
  (a title, a page loading, an agent's state) leaves the strip where the human scrolled it.
- `Toggle`: a button that stays on (Pick, `[data-state="on"]`).
- `Collapsible`: something shown on demand (a profile's pictures to choose from; Details: `button.disclose` its trigger, an
  installer's output, an agent's sign-in's terminal).
- `.avatar`: a profile's picture (`<img>`, `avatarSrc(name)` in `lib/common.ts`; `settings/Avatars.vue` the ones to choose from), 16 px; `--avatar` where a place needs
  another size (22 px in a profile's row, `ProfileRow.vue`).
- `.tab`: a panel's tab, as Chrome's: a pane's (`ProfilePane.vue`: the page's icon, its title, ×) and a terminal's
  (`TerminalTabs.vue`: the agent's icon, its name, its `.state`, ×). The row in the island's color, the active tab in
  `--toolbar`, rounded at its top only (`--tab-radius`) and joined to what is under the row: a pane's toolbar, the
  terminal (in `--toolbar` too: the island's `View` is given that background). A short line between two tabs that
  are not lit; × is `span.x.icon.small`, on every tab, always. A tab opened grows in from the left (`data-opening`,
  set by `useStrip`). A pane's tabs are 220 px and shrink as Chrome's, to their icon and × (64 px), then scroll; a
  terminal's is as wide as its name, up to 220 px, and never shrinks (the agents' marks look alike, so a tab without
  its name could not be told from another): more than fit scroll.
- `.striptab`: a tab of a strip with nothing to join (the tasks' bar, `TaskTab.vue`), as a browser's: the agent's
  `.state`, `.name`, × at the end (`button.close.icon.quiet.small`), on every tab, always, as Chrome's. A
  step taller than a button (`--tab`, `--control` + 4 px) and at least 64 px wide: a target for a quick throw of the mouse.
  Lit under the pointer; chosen (`aria-selected`): the shown one, or the one pressed until it is shown, in the panels'
  color (`--island`) on the dark island.
- `.state`: an agent's state by `data-state` (from its hooks), an icon each so that color is not the only sign (some
  people do not tell yellow from green): working (sparkles in `--blue`, twinkling; not with reduced motion), waiting
  for you (a bell in `--note`), done (a check in `--done`: come and see, until the human sees that task); nothing otherwise, as nothing asks for
  the human then. On a task's tab (`TaskTab.vue`), with its tooltip.

### Dialogs

Every dialog is `Modal.vue`, shadcn-vue's `Dialog` (`components/ui/`): its title, the content, the buttons.

```html
<Modal id="…" title="Title" class="sm:max-w-xl">
  …the content: shadcn-vue's parts (Field, Input, RadioGroup …)…
  <template #footer><DialogClose as-child><Button variant="outline">Cancel</Button></DialogClose><Button>Create</Button></template>
</Modal>
```

- × at the title's end when it may be closed (`closable`; Esc and a click outside close it too; `stay`: not while
  something runs, an agent's install). The main button last (`Button`'s default variant).
- No taller than the window: the content scrolls, the title and the buttons stay. A dialog that keeps one height (New
  Project's) sets it on itself, `min(…, 85vh)`; a part that scrolls on its own (New Project's step) fills the content.
- A form is the content's own `<form id>`, its submit button in the footer by `form="…"`: Enter submits. The main
  process's refusal is the field's `FieldError` (`TaskRename.vue`).
- It fades and zooms in and out (shadcn-vue's, 100 ms). Fading out it is closed (`data-state="closed"`) yet holds the
  keyboard: what gives the keyboard somewhere takes it as nowhere, and the dialog, gone, gives it back only when nothing
  took it meanwhile (`closing`, `keepTaken`, `lib/cover.ts`).
- What Settings' window (`.page`) and New Project's steps (`.wizard`) hold: `.hint` (what it is about, muted), `.field` (a
  label, "Name:", and its input, the labels in one column; `.pick` in it: the input with its button, Location and
  Browse…), `.row` (a line of controls: a field with its buttons, a URL to clone, a new profile's name), `.check` (a
  `.checkbox` in the fields' column), `.error` (hidden while empty; its text selectable, to copy and search for); a
  field's `.hint` under it (its `FieldDescription`). New Project's buttons are its `footer`, the main one last, `.start`
  at the left end. What is saved as it changes (Settings' window) has none: Esc or × closes it.
- A part of what it edits: a `.titled` line, then its `.list` or fields, a `.row` under the list for what is being
  added in place (a URL to clone, a new profile's name). Not framed cards or sections with a + in their heading
  (a frame in a dialog in a split is a frame in a frame in a frame, and reads as a web page).
- `.empty`: a list's line when it has none ("No accounts yet."), dim.
- What is browsed (Settings' window, `settings/ProjectEditor.vue`) is a tree on the left (Reka's `Tree`, `#pjlist`: its rows
  `.item`, `data-section`, `data-project`, `data-agent` or `data-profile`; a section opens and closes, it is not
  chosen, and makes one of its own with the `.icon` + at its end (Agents, Profiles; a project is made in a tasks' window); a row's right-click has its page's ⋯) and the chosen
  page on the right under its path (`.crumbs`: "Projects › shop", its ⋯ at the end). Each thing is a row of the tree
  with a page of its own, not a list inside a page. A row the column cuts (…) has its whole name in its tooltip, and
  so has a list's row in a page (a project's profiles: the name, its description); not a wider or resizable column,
  as names past any width still come (two profiles alike to their 20th letter). A dialog of a few big choices and a form (New
  Project) has the choices as a list on its left (Reka's Listbox), the form on its right.
- Its ref: `await open()` (shown, the keyboard in its `[autofocus]` field or on it; the profiles' pages hidden while it
  is open: `covered('hide')`, `lib/cover.ts`, `views.ts`), `close()`, `isOpen()`. Its content is in the page only while it is open
  (Reka's default; kept closed, the dialogs' parts would take about 2.5 MB of the window's memory), so it opens first and
  is filled after; what must outlive it lives in the dialog's component or in `lib/` (the agents' list and an install
  under way: `lib/agents.ts`). When it closes, the keyboard goes back where it was.
- Every dialog is in `App.vue` from the start and registers what it does (`registerDialog`); anything opens one by
  name: `(await dialog('newproject')).open()` (`lib/dialogs.ts`). Settings is no dialog: `openSettings(section, id)`
  there opens its window.
- A page's alert or confirm (`.pagedialog`, in `ProfilePane.vue`) is not a `Modal`: a Dialog that is not modal (the
  other panes go on), in its pane right under the address bar, over a picture of the page, in Chrome's size, shape and
  blue: the page's, not Kulisa's. Esc is Cancel; a click outside does nothing; OK has the keyboard.
- Change Agent (`HandOver.vue`, `#handover`): the two agents with what goes along between them (`Badge`s on a dashed
  line, the profiles' `AvatarGroup` in one), which fly to the new one, again and again, while it reads (`handed`,
  `received`; none with reduced motion), its progress under them; the accounts under them as a `RadioGroup`.
- Questions before something that cannot be undone, before closing, or between two ways to go (a second button,
  `other`), are not new dialogs: `shell.ask` (main process) or `ask(q)` (`lib/ask.ts`) → `Ask.vue`, shadcn-vue's
  `AlertDialog`: the main button red when it deletes (`danger`); Cancel (named by the question when the word is another: Later) has the keyboard, Esc is Cancel, a
  click outside does nothing (it waits for an answer);
  `other` adds the second way's button before the main one; `link`, a page the answer may need, under the detail
  (where to revoke a GitHub sign-in), opened in the user's browser.

### Menus

shadcn-vue's `DropdownMenu` and `ContextMenu` (`components/ui/`), the rows built as one opens: a button's
(`ButtonMenu.vue`: ☰, ⋮, a project's ⋯ …; `end`: its end edge at the button's, at a bar's end), an area's right-click
menu at the pointer (`RightClickMenu.vue`: `items(e)` builds the rows for what was right-clicked, or `null`: none),
one at a point (`menuAt(e, items)` in `lib/menu.ts`, `PointMenu.vue`: a link in the terminal).

- `ButtonMenu` opens on the press, so a press, a drag to a row and the release there chooses it, as the OS's menus;
  Enter, Space or ↓ on the button open it. Rows are chosen with the left button only (on Linux a right-click menu
  opens on the press, and the release must not choose a row).
- One menu at a time; Esc, a press outside, the same button, a chosen row or leaving the window closes it, and the
  keyboard goes back where it was (`focusBack`). Leaving is the window's blur (`window:blur`, from the main process),
  not its page's: a profile's page taking the keyboard as it loads (macOS) would close a menu under the hand;
  Settings' window, with no pages in it, goes by its page's (`lib/cover.ts`). The keyboard moving within the window
  does not close one (Reka's focus outside, prevented): the window's page getting the keyboard back after a menu
  opened puts it on what had it before, the terminal.
- It fades out as it closes (shadcn-vue's, 100 ms): reopened meanwhile, it takes no keyboard, and its rows keep the
  keyboard where it went (`leaveClosing`: Reka's row the pointer leaves gives it to its menu).
- While one is open, the pages are pictures of themselves (`covered('pictures')`); it shows once they are
  (`data-ready`). It is no part of the title bar's drag area (`-webkit-app-region: no-drag`).

Items (`lib/menu.ts`, laid out by `menu/MenuRows.vue`):

- `{ label, sub, keys, title, icon, color, avatar, project, inset, enabled, run, remove }`: a row (`MenuButton.vue`).
  `keys` the row's key at its end (`keyText(id)`, `lib/common.ts`); `title` its tooltip; `icon` a component (Lucide's
  or a mark); `project` a project's icon in its color (`ProjectIcon.vue`); `remove` a 🗑 at its end, on the row the
  pointer or the keyboard is on, and Delete, running it instead of `run` (a closed task's); `inset` sets the row in
  under the one above (`data-inset`). Named by its label alone (`aria-label`).
- `'-'` a divider; `{ heading, icon }` a label over rows.
- `{ submenu, items, project, run }`: a row opening a menu of its own at its side, its rows the same items (a task
  tab's menu holds its project's rows so). `run` makes a click on the row itself act and close the menu, hover still
  opening the submenu (a project in the bar's +: a click makes a new task of it).
- `{ component, props }`: a row of its own, ☰'s (`components/menu/`): zoom (− and + leave the menu open), theme and
  tasks' bar (`ChoiceRow.vue`: its choices side by side as shadcn-vue's Tabs show theirs, as no menu part does; they
  leave it open), language (a submenu of radio rows, its value at the row's end as its description,
  `aria-describedby`) and the arrangements, pictures of themselves.

### Panels

A panel is a menu's look with fields in it, where a menu cannot hold them (its rows take the keys typed and the
focus under the pointer): Reka UI's Popover, `.menu` with its rows `.item` (buttons) under a top of its own, the pages
pictures meanwhile (`covered('pictures')`), closed as a menu is (Esc, a press outside, a row chosen, the window left);
a row's action runs once it has closed. One today: a profile's picture
(`.profilepics` in `settings/ProfilePage.vue`, from its picture at its page's top: `.choices`).

A menu's row that opens a field (New Profile…) gives it the keyboard with `focusAfterMenu(el)` (`lib/menu.ts`): the
menu, closing, would give it back to its button.

## Clusters

A part of several files with a state of its own is a folder of `components/` (against
spaghetti), reached from outside only through its entries; `npm run deps` refuses any other import (`clusters` in
`.dependency-cruiser.ts`: a new cluster is a line there). Its state is a module in it, provided to its files (Vue's
`provide`/`inject`), not in `lib/store.ts`; what it shares with the rest of the window (`Modal.vue`,
`InstallProgress.vue`, `AccountSignIn.vue`, `lib/`) stays outside it; its actions are the core's, over IPC, as
every handle's (CLAUDE.md, "One core"). A single component is no cluster.

| Folder | Its entries | What |
|---|---|---|
| `settings/` | `Settings.vue` | Settings' window: the tree, a project's, an agent's and a profile's page, GitHub's |
| `newproject/` | `Wizard.vue`, `NewProject.vue` | New Project's steps (Code, Agents, Profiles; `wizard.ts` their state): the welcome's and the dialog |
| `welcome/` | `Welcome.vue` | the first start, no project at all: what Kulisa does in three slides (`Tour.vue`), then New Project's steps (`Wizard.vue`, its head a question each); the empty window's (`Empty.vue`) |
| `newtab/` | `Board.vue` | the board: every project a column (an island, as the grid's panels) with its tasks as `.item` rows, the empty window's |

New Project's steps (`.wizard`) are a form: the steps over it (`.steps`, the one shown `aria-current`; the welcome puts
its own head there, the `head` slot), one step at a time, its buttons in a dialog's `footer` (Back at the start, Cancel
in the dialog, Next, Create last); the fields' look is a dialog's (`components.css`, what a dialog holds). A view of
them is one more cluster taking `Wizard.vue`, never a copy of the steps: the welcome is the dialog's steps under its
questions, `leavable` (Back on the first step goes back to its slides).

## Adding something

- A new icon: Lucide's, imported where used; one of ours only for what Lucide has not (Icons).
- A new kind of control or row: in `components.css` with a comment saying what it is and its variants (or a component
  of its own when it has behavior), and a section here. A part used by one place only (a pane's tab strip, the omnibox,
  the projects' islands) keeps its look in its own `.vue` file.
- A new dialog: a component with `Modal.vue`, in `App.vue`, registered in `lib/dialogs.ts`; its content shadcn-vue's
  parts placed with Tailwind's utilities.
- Something generic (a menu, a dialog, a choice, a field): Reka UI's part, in Kulisa's look; never our own where Reka
  has one (above).
- A part's own CSS places the components, never restyles them into new ones. Before overriding dockview, check that
  its own variables or rules don't already do it.
