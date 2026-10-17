# The window's UI

What the window is built of: the tokens, the icons, and the components, each defined once, so every dialog, button
and list looks and behaves the same. **Before making a button, an icon, a row or a dialog, look here:** use the
component, or add one here (and in `components.css`) when nothing fits. Keep this file current.

Vue 3 components in TypeScript, built by Vite (CLAUDE.md, Window UI; `vite.config.mts`, into `dist/renderer`). The
generic parts (menus, dialogs) are Reka UI's (`reka-ui`: behavior, keyboard and accessibility, no look of its own), in
the look below:

| Where | What |
|---|---|
| `src/renderer/components/*.vue` | the window's parts, each its markup, behavior and own look (`<style>`, rooted at its id or class): `App.vue` puts a tasks' window together; `grid/` the grid's panels and headers, `menu/` the menus (`ButtonMenu`, `RightClickMenu`, `PointMenu`, `MenuRows`) and ☰'s own rows; `Modal.vue` the dialogs; the clusters (below): `settings/` Settings' window (`Settings.vue`, its pages `ProjectEditor.vue`, `AgentPage.vue`, `ProfilePage.vue`), `newproject/` New Project's steps |
| `src/renderer/lib/*.ts` | what parts share or what outlives a component: `store.ts` (what the main process sends, `act`), `grid.ts`, `xterm.ts` (a terminal, in any window), `terminals.ts` (a tasks' window's), `menu.ts` (what a menu holds), `agents.ts` (the agents' list of a dialog, and an install under way), `ask.ts`, `dialogs.ts`, `keys.ts`, `voice.ts`, `cover.ts` (`covered()` for every menu and dialog: one menu at a time, all closed at once), `views.ts` (a tasks' window's profiles' pages under them: hidden, or pictures), `profiles.ts` (the profiles' menu), `names.ts` (name fields), `strip.ts` (a strip of tabs that scrolls), `common.ts`, `test-hooks.ts` (what the tests reach by name) |
| `src/shared/types.ts`, `ipc.ts`; `env.d.ts` | the shapes the main process sends, the channels they come by (docs/window.md, IPC); the bridge to it (`src/preload`) typed by them, and Vite's types |
| `src/renderer/tokens.css` | every color and size (`:root`); no literal color anywhere else |
| `src/renderer/components.css` | the shared components below, global |
| `src/renderer/index.html`, `main.ts`; `settings.html`, `settings.ts`; `master.html`, `master.ts` | a tasks' window's page, Settings' window's and a master's window's: the theme before the first paint, then the app. Settings' loads nothing of a tasks' window (no grid, no store of its tasks): `cover.ts` and `xterm.ts` are what the two share of `views.ts` and `terminals.ts` |
| `src/renderer/public/avatars/` | the profiles' pictures, copied as they are |

## Desktop, not a web page

Kulisa is a desktop app, an IDE: its window looks like one, JetBrains' Settings its model (the author, 2026-10-11:
the dialogs, with big titles, framed cards, a paragraph each, pills and rows that showed their buttons under the
pointer, read as a web page's and were hard to read). So:

- **JetBrains' UI font and size**: Inter at 14 px (a step above their UI Guidelines' 13, Typography: the author found 13 small, 2026-10-13), bundled
  (`@fontsource-variable/inter`, `main.ts`), so the window looks the same on every OS; until 2026-10-13 it was the OS's
  own (`system-ui`: on Linux Noto Sans at 14 px, wide, read as a web page's). The terminal keeps JetBrains Mono.
- **Two text sizes** (`--font`, `--font-small` for group titles and a dialog's title), two weights; nothing bigger.
  Weight and color carry what matters, not size. The one exception, the welcome (`welcome/`), the one place the window
  speaks to a new user rather than being worked in: its questions and slides' titles `--font-hero`, the words under
  them `--font-lead` (the author, 2026-10-17).
- **Dense**: rows and controls `--control` high (`--row` the same), toolbar buttons 24 px, corners `--radius` (4 px)
  on controls and `--island-radius` on windows and dialogs.
- **One scrollbar everywhere** (`components.css`, `--scrollbar`): a rounded thumb on no track, no arrows, as JetBrains'
  (the author, 2026-10-15: the OS's, with arrows, in menus, Settings and dialogs). Chromium's `::-webkit-scrollbar`:
  the standard `scrollbar-color` and `scrollbar-width: thin` left the arrows. A tabs' strip has none
  (`scrollbar-width: none`): it scrolls by the wheel.
- **Forms are "Label: field"**, the labels in one column (`.field`); a comment under a field only when needed.
- **Groups under a titled line** (`.titled`), not framed cards: no frame in a frame.
- **A list has a toolbar over it** (`.list`: + adds, − removes the selected row, ★ makes it the default), and
  its actions act on the selected row (also Delete, and its right-click). It is a table: the names of its columns,
  then rows of facts, each in its column (what it is, its path or email muted, a state at its end in words: "default",
  "no commit yet"), the columns at the same places in every row (the author, 2026-10-16: values one after another read
  as chaos); no buttons that show under the pointer, no pills.
- **A dialog asks one thing and ends with its buttons** (`Modal.vue`); what is browsed (Settings, a window of its own:
  [window.md](window.md), Settings) is a tree on the left and a page on the right, under its path. No search field over the tree (the author, 2026-10-11).

## Tokens (`tokens.css`)

- Colors for both themes ([window.md](window.md), Theme): each is `light-dark(light, dark)`, so a new color gets
  both values. JS reads a color as shown through an element that uses it (`lib/xterm.ts`), not the token's text.
  JetBrains' themes: `--window` (the title bar, under the grid and the tasks' bar), `--island` (panels, dialogs, menus), `--island-hi`
  (a lit row, a divider), `--toolbar` (a pane's toolbar and active tab), `--field`, `--button`, `--line` (borders);
  text `--text`, `--text-strong`, `--text-dim`, `--text-muted`; `--accent` (main button, focus), `--danger`,
  `--error`, `--note` (what waits for the human), `--agent` (the agent's caption on a pane, in the accent's hue: until
  2026-10-13 it was `--note`'s, the color of "waiting for you"), `--done`; `--on-accent` (text on `--accent` and `--danger`),
  `--selection` (the terminal's); `--chosen`, `--chosen-idle` (a list's selected row, while the list has the keyboard
  and when it has not: JetBrains'); `--page-button`, `--on-page-button`, `--page-pad` (Chrome's blue and room, a page's
  dialog: `.pagedialog`); `--page`, `--backdrop`, `--shadow`; `--hover` (under the
  pointer, on any background); `--project` (the shown task's project's color, set by `lib/store.ts`), `--glow` (the window's glow, the same color, kept as the last task closes so the glow fades in it; registered as a color, `@property`, so it changes softly: `App.vue`).
- Sizes: `--sans` (the window's font, Inter), `--font` (all text, the terminal too), `--font-small` (a group's title, a dialog's title), `--font-hero` and `--font-lead` (the welcome's alone, above), `--control` (the
  height of buttons and fields), `--tab` (a tab's: a step taller), `--radius`,
  `--tab-radius` (a pane's tab's and a task's), `--island-radius`, `--gap` (the space between and inside islands, between the
  window's rows, between the tasks' tabs; also dockview's `gap` in `Grid.vue`), `--bartab` (a task's tab's height), `--title` (the title bar's: `--gap`,
  `--control`, `--gap`; the OS buttons' strip is as tall, `window.ts`); room as Chrome's menus and dialogs have it: `--row` (a row of a menu or a list), `--inset` (inside
  a row, between its icon and text, between a dialog's fields), `--pad` (inside a dialog along its edges), `--label` (a form's labels' column, "Name:", `.field`, and what lines up
  with its fields). Things
  set close together were the author's complaint (2026-10-07): space comes from these, not from new numbers. The
  Kulisa zoom scales them all.

## Icons

Each icon is drawn once, as a `<symbol id="i-…">` in the sprite (`Sprite.vue`, the window's first element), on a
16 × 16 grid, in lines (`stroke`) of the text's color; a filled part has `fill="currentColor"`. Use it as:

```html
<Icon name="i-close" />   <!-- Icon.vue: <svg aria-hidden="true"><use href="#i-close"/></svg> -->
```

| Icon | Where |
|---|---|
| `i-close` | × of dialogs, profiles, tabs, tasks |
| `i-plus` | a pane's new tab, the bar's + (a new tab: the board) and the New Tab's own icon, a project's new task (its column's +), a new terminal (the island's +); adding to a section of a dialog |
| `i-settings` | Settings in the title bar (Lucide's settings) |
| `i-projects` | ☰'s Tasks bar row (Lucide's folder-open) |
| `i-logo` | the app icon with its curtain in `currentColor`: the title bar's (`--project`; not on macOS, whose apps show their icon in the Dock), and a project's label in the tasks' bar (its `--color`). The folds are a shadow over the color, one for every color: a `<use>` takes the sprite's gradient, not one of its own |
| `i-docs`, `i-github`, `i-bug` | the links (Documentation, GitHub, Report an issue), rows of ☰ (`data-icon` on each link; Lucide's book-open, github, bug) |
| `i-menu` | ☰, the window's menu |
| `i-more` | ⋮, a pane's menu |
| `i-back`, `i-forward`, `i-reload` | a pane's toolbar (Chrome's) |
| `i-pick` | Pick (DevTools' inspect icon) |
| `i-globe` | a tab whose site has no icon |
| `i-zoom`, `i-theme`, `i-language`, `i-arrange`, `i-keyboard`, `i-exit` | ☰'s rows: Zoom, Theme, Language, Arrange panels, Keyboard Shortcuts, Exit |
| `i-agent` | an agent without a mark of its own (`agentMark`, `lib/agents.ts`; until 2026-10-14 also ☰'s Agents… row) |
| `i-chevron` | a row that opens a menu beside it (☰'s Language; Lucide's chevron-right) |
| `i-mic` | dictation's microphone at the end of the terminals' row of tabs (Lucide's mic) |
| `i-working`, `i-waiting`, `i-done` | an agent's state on a tab (`.state`); `i-done` also checks the chosen row of a menu, and a checkbox |
| `i-down` | what opens below it: a `.select`'s choices, an agent's details (`AgentList.vue`) |
| `i-trash` | a closed task's row in a menu: delete it (`remove`; Lucide's trash-2) |
| `i-minus`, `i-star` | a list's toolbar (`.list`, after its `i-plus`): remove the selected row, make it the default (Lucide's star) |
| `i-folder-plus`, `i-folder`, `i-git` | New Project's code: New Folder, Folders on Disk, Clone from URL (Lucide's folder-plus, folder, git-branch) |
| `i-agent-claude`, `i-agent-codex`, `i-agent-shell` | an agent's row and its accounts' (`AgentList.vue`, `i-agent-<id>`, 20 px; `agentMark` in `lib/agents.ts`), a terminal's tab (`TerminalTabs.vue`), the island's + menu and its big buttons in an empty grid: the makers' own marks in their own colors (claude.ai's and developers.openai.com's favicons; not under the GPL: `docs/LICENSING.md`), and Lucide's square-terminal for the terminal only and a shell's tab; `i-agent` for an agent without a mark of its own |

An icon is 16 px; × and + are 14 px, as in Chrome (`.icon`), and so is an agent's state. ☰'s and the agent's states are Lucide's (lucide.dev, ISC), drawn on 24 × 24 with
their lines thickened to match; take a new one from there rather than drawing it. The sprite takes no room but is not
`display: none`, so the logo's gradient and clip path reach its `<use>`s. Pictures are not icons: the arrangements in ☰
are drawn in place; the profiles' pictures are files of their own
(`src/renderer/public/avatars/`, Noto Emoji, in their own colors). The test `icons: …` in `test/window.ts` checks that
every other `<svg>` uses the sprite.

## Components (`components.css`)

### Buttons

- `<button>`: a framed button with text, `--control` high. `.primary` (blue, the main action of a dialog, last in its
  footer), `.danger` (red, when it deletes). Lit under the pointer and darker while pressed, so it answers the hand;
  a button of its own kind (`.icon`, a tab) keeps its own (the rule is as weak as `button`'s). Disabled: faded.
- `.icon`: an icon alone, square with `--radius` corners as a toolbar's, no frame, lit under the pointer (`--hover`);
  always with `aria-label` (or `title`).
  - `.quiet`: muted until pointed at, for × and removing.
  - `.small`: 24 px, inside a row or a list's toolbar (a tab's ×, a task's ×, `.list`'s + − ★).
  - `.round`: a circle filled `--island-hi`, an 18 px icon: a button that stands out in a row (the dictation's microphone).
  - `--icon`: the icon's size, when a place needs another (☰ is 18 px).
  - A `<span class="icon">` where a button cannot be (a tab's ×, inside the tab).
- In a menu or the title bar, a button is still one of these.
- `:title="withKeys('Reload', 'tab.reload')"` (a command of `src/main/keys.ts`; `lib/common.ts`): its key at the end
  of its tooltip, "Reload (Ctrl+R)", as Chrome's toolbar says it.

### Rows

- `.item`: a row of a menu or a list (`MenuButton.vue`, the projects' manager's rows), `--row` high: an optional icon (`.ico`), `.dot`
  (a project's color, `--color`), `ProjectIcon.vue` (a project's icon in its color: its favicon, one of Kulisa's set or
  the curtain; `.picon`, also on a task's tab in the tasks' bar, 20 px there) or `.avatar` (a profile's picture), `.text` with `.label` and a `small` line under it, a `kbd` key at the end. Lit under the
  pointer and on keyboard focus.
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
  large as two rows, its `.name`, a `small` line under it (an account's email; none under a profile's: who it is is in its tooltip, under the name it was cut off by the tile's edge, 2026-10-17), on an island's color,
  lit under the pointer. The empty grid's agents and profiles (`Terminals.vue`); `.small`, beside what is looked at:
  the closed profiles over the terminal (`ClosedProfiles.vue`).
- `.dots`: where one is in a few slides or steps, a short bar each, lit up to the one shown (an `ol`, `li.on`): the
  welcome's slides and its steps.
- `.chip`: a thing named in a pill, its icon first (14 px, muted), `--font-small`: what goes along to another agent
  (Change Agent), a task's repositories at the end of its terminals' row (`TaskRepos.vue`). A name the human gave (a
  folder, a branch) goes in a `.name` inside it: cut with … past 14em, the whole in the chip's tooltip; a row of chips
  gives way before what is beside it (2026-10-15: three repositories' whole names pushed the terminals' tabs out).

### Controls

The window's controls are Reka UI's, in this look (CLAUDE.md, Window UI):

- `.radio`: a radio (Reka's `RadioGroupItem`, its `RadioGroupIndicator` the dot), in a `RadioGroupRoot`: at a row's
  start (the row a `<label>`), exactly one of a list: the agent to start (`AgentList.vue`). The arrows move between
  them. Not for a list's default, whose rows are what the list is about: a radio there read as choosing the row (the
  projects' manager until 2026-10-11); that is "default" at the row's end and ★. Not for a few big choices either
  (New Project's code: a list on the dialog's left, Reka's Listbox, as JetBrains' New Project).
- `.checkbox`: a checkbox (Reka's `CheckboxRoot`, its `CheckboxIndicator` the check, `i-done`): Create Git repository.
- `.select`: a button that opens what to choose from below it (Reka's `Popover`), as a field: the chosen one and
  `i-down` (a profile's picture).
- `.choices`: icon buttons (`.icon`) to choose one of, the chosen one ringed in `--accent`: a profile's pictures
  (Reka's `ToggleGroup`, one always chosen).
- `.editable`: a value edited in place (Reka's `Editable`: a profile's name, who it is, its test login): text in a
  field's box (`.preview`), a click or Tab edits it; Enter or leaving saves, Shift+Enter is a new line where it has
  lines, Esc puts it back (and leaves the dialog open).
- Fields (Reka's `FieldRoot`, `FieldLabel`, `FieldControl`, `FieldDescription`, `FieldError`) in `.field`; a
  dialog's form is its `FormRoot` (`Modal.vue`, `errors`: the main process's refusal at its field).
- Tabs: a pane's tabs and the tasks' tabs are Reka's `Tabs` (`activationMode` manual): chosen on the press, as a
  browser's (not on their ×), one Tab stop for the strip, the arrows move and Enter chooses. A task's is shown on
  the release, or as its drag begins ([window.md](window.md), The tasks' bar).
- A strip of tabs that do not all fit (the tasks' bar, a pane's tabs, the closed profiles' tiles, the terminals' tabs) is `.tabstrip` (`components.css`) with
  `useStrip` (`lib/strip.ts`), one for every strip (2026-10-15: each scrolled its own way, two with the same bugs):
  no scrollbar; a mouse's wheel scrolls it sideways (Shift and a touchpad's swipe are the browser's: with Shift both
  scrolled, twice as far); an edge with tabs past it fades (`--fade`; two classes from the scroll: CSS's
  scroll-driven animations left an edge faded when little was out of sight); the active tab is brought into sight,
  clear of the fade, when another is chosen, a tab grows in or the strip is resized, and only then: on every update
  (a title, a page loading, an agent's state) it took the strip back from where the human had scrolled it.
- `Toggle`: a button that stays on (Pick, `[data-state="on"]`).
- `Collapsible`: something shown on demand (a profile's pictures to choose from; Details: `button.disclose` its trigger, an
  installer's output, an agent's sign-in's terminal).
- `.avatar`: a profile's picture (`<img>`, `avatarSrc(name)` in `lib/common.ts`; `settings/Avatars.vue` the ones to choose from), 16 px; `--avatar` where a place needs
  another size (22 px in a profile's row, `ProfileRow.vue`).
- `.striptab`: a tab of a strip on an island, as a browser's: the agent's `.state`, `.name`, × at the end
  (`button.close.icon.quiet.small`), on every tab, always, as
  Chrome's (the author, 2026-10-12: until then only under the pointer and on the shown tab). A
  step taller than a button (`--tab`, `--control` + 4 px) and at least 64 px wide: a target for a quick throw of the mouse.
  Lit under the pointer; `.active`: the shown one, in the panels' color (`--island`) on the dark island. A
  task's tab (`TaskTab.vue`); a terminal's (`TerminalTabs.vue`: the agent's icon before its name, its row in
  `--toolbar` over the terminal, the shown one in the terminal's color, as if part of it).
- `.state`: an agent's state by `data-state` (from its hooks), an icon each so that color is not the only sign (some
  people do not tell yellow from green): working (sparkles in `--accent`, twinkling; not with reduced motion), waiting
  for you (a bell in `--note`), done (a check in `--done`: come and see, until the human sees that task); nothing otherwise, as nothing asks for
  the human then (the author's rule). On a task's tab (`TaskTab.vue`), with its tooltip.

### Dialogs

Every dialog is `Modal.vue`, Reka UI's Dialog (`reka-ui`) with the same parts:

```html
<Modal id="…" title="Title" form form-id="…" @submit="save">
  …the content…
  <template #footer><DialogClose>Cancel</DialogClose><button class="primary">Create</button></template>
</Modal>
```

- `header`: a title strip, as a window's: the title small in the middle (`--font-small`), × at its end when it may be
  closed (`closable`; Esc and a click outside close it too; `stay`: not while something runs, an agent's install).
  Over a dimmed backdrop (`.backdrop`), in the middle of the window (`.dialog`; its corners clip what is in it, a side
  panel's color). A question (`.dialog.question`, `Ask.vue`) has no strip: its question is the first words, bold.
  At most 85% of the window's height, the `.body` scrolling: a dialog that keeps one height (New Project's) sets it on
  itself, `min(…, 85vh)`, never on its body, or its footer goes out of a short window (640×400, or any at 200%).
- `.body`: (in Settings' window, `.page`, the same) `.hint` (what it is about, muted), `.field` (a label, "Name:", and its input, the labels in one column; `.pick` in
  it: the input with its button, Location and Browse…), `.row` (a line of controls: a field with its buttons,
  a URL to clone, a new profile's name), `.check` (a `.checkbox` in the fields' column), `.error` (hidden while empty; its text
  selectable, to copy and search for, as a question's detail is); a field's
  `.hint` under it (its `FieldDescription`).
- `footer`: the buttons at the right end, the main one last; `.start` puts a button at the left end. A button that
  only closes is Reka's `DialogClose`. What is saved as it changes (Settings' window) has none: Esc or × closes it.
- A part of what it edits: a `.titled` line, then its `.list` or fields, a `.row` under the list for what is being
  added in place (a URL to clone, a new profile's name). Not framed cards or sections with a + in their heading
  (until 2026-10-11: a frame in a dialog in a split was a frame in a frame in a frame, and it read as a web page).
- `.empty`: a list's line when it has none ("No accounts yet."), dim.
- What is browsed (Settings' window, `settings/ProjectEditor.vue`) is a tree on the left (Reka's `Tree`, `#pjlist`: its rows
  `.item`, `data-section`, `data-project`, `data-agent` or `data-profile`; a section opens and closes, it is not
  chosen, and makes one of its own with the `.icon` + at its end (Agents, Profiles; a project is made in a tasks' window); a row's right-click has its page's ⋯) and the chosen
  page on the right under its path (`.crumbs`: "Projects › shop", its ⋯ at the end). Each thing is a row of the tree
  with a page of its own, not a list inside a page. A row the column cuts (…) has its whole name in its tooltip, and
  so has a list's row in a page (a project's profiles: the name, its description); not a wider or resizable column,
  as names past any width still come (2026-10-15: two profiles alike to their 20th letter looked the same). A dialog of a few big choices and a form (New
  Project) has the choices as a list on its left (Reka's Listbox), the form on its right.
- With `form` the content and the buttons are a form: Enter submits.
- Its ref: `await open()` (shown, the keyboard in its `[autofocus]` field or on it; the profiles' pages hidden while it
  is open: `covered('hide')`, `lib/cover.ts`, `views.ts`), `close()`, `isOpen()`. Its content is in the page only while it is open
  (Reka's default; kept closed, the dialogs' parts took about 2.5 MB of the window's memory), so it opens first and
  is filled after; what must outlive it lives in the dialog's component or in `lib/` (the agents' list and an install
  under way: `lib/agents.ts`). When it closes, the keyboard goes back where it was.
- Every dialog is in `App.vue` from the start and registers what it does (`registerDialog`); anything opens one by
  name: `(await dialog('newproject')).open()` (`lib/dialogs.ts`). Settings is no dialog: `openSettings(section, id)`
  there opens its window.
- A page's alert or confirm (`.pagedialog`, in `ProfilePane.vue`) is not a `Modal`: a Dialog that is not modal (the
  other panes go on), in its pane right under the address bar, over a picture of the page, in Chrome's size, shape and
  blue: the page's, not Kulisa's. Esc is Cancel; a click outside does nothing; OK has the keyboard.
- Change Agent (`HandOver.vue`, `#handover`): the two agents with what goes along between them (`.baton`: pills on a
  dashed line, a profile's `.avatar`s in one), which fly to the new one, again and again, while it reads (`handed`,
  `received`; none with reduced motion), its progress under them; the accounts under them as `.radio` rows.
- Questions before something that cannot be undone, before closing, or between two ways to go (a second button,
  `other`), are not new dialogs: `shell.ask` (main process) or `ask(q)` (`lib/ask.ts`) → `Ask.vue`, Reka's AlertDialog
  in the same look: Cancel (named by the question when the word is another: Later) has the keyboard, Esc is Cancel, a
  click outside does nothing (it waits for an answer);
  `other` adds the second way's button before the main one.

### Menus

Reka UI's menus, the rows built as one opens: a button's (`ButtonMenu.vue`: ☰, ⋮, a project's ⋯
…; `end`: its end edge at the button's, at a bar's end), an area's right-click menu at the pointer
(`RightClickMenu.vue`: `items(e)` builds the rows for what was right-clicked, or `null`: none), one at a point
(`menuAt(e, items)` in `lib/menu.ts`, `PointMenu.vue`: a link in the terminal). `ButtonMenu` opens on the press, so a
press, a drag to a row and the release there chooses it, as the OS's menus; Enter, Space or ↓ on the button open it.
Rows are chosen with the left button only (on Linux a right-click menu opens on the press, and the release must not
choose a row). A menu taller than the window has scrolls, reaching as far as its edge (Reka's room for it,
`--reka-popper-available-height`; the bar's + with thirty closed tasks ran past the window, 2026-10-15). One menu at a time; Esc, a press outside, the same button, a chosen row or leaving the window closes
it, and the keyboard goes back where it was. Leaving is the window's blur (`window:blur`, from the main process), not
its page's: a profile's page in the window taking the keyboard as it loads (macOS) closed a menu under the hand
(2026-10-16); Settings' window, with no pages in it, goes by its page's (`lib/cover.ts`). Nor does the keyboard moving
within the window close one (Reka's focus outside, prevented): the window's page getting the keyboard back after a
menu opened puts it on what had it before, the terminal (2026-10-16). While one is open, the pages are pictures of themselves
(`covered('pictures')`); it shows once they are.

Items (`lib/menu.ts`, laid out by `menu/MenuRows.vue`) are `{ label, sub, keys, title, icon, color, avatar, project, inset,
enabled, run, remove }` (`MenuButton.vue`; `keys`: the row's key at its end, from the keys' table: `keyText(id)`, `lib/common.ts`), `'-'` (a divider), `{ heading, icon }`, `{ note }` (small dim words
under the rows, not one of them: ☰'s version, so nothing looks clickable that is not), `{ submenu, items, project }` (a row with a chevron at its end
opening a menu of its own at its side, Reka's Sub parts, its rows the same items: a task tab's menu holds its project's
rows so, under the project's icon and name) or `{ component, props }` (a row
of its own: ☰'s zoom, theme, tasks' bar, language (a menu beside it: Reka's submenu, its rows `MenuButton`s, the
chosen one checked) and arrangements, `components/menu/`, built of Reka's menu items; − and + and the choices leave the menu open);
`title` its tooltip (the native one, as every tooltip); `icon` is the sprite's id, at the row's start; `project` a project's icon in its color there (`ProjectIcon.vue`,
`.picon`); `remove` puts a 🗑 at the row's end (`.remove`, on the row the pointer or the keyboard is on, `:focus-visible` too; Delete too) that runs it instead of `run`, the menu closing as for any row (a closed task's, deleted); `inset` sets a row in under the one above, its text under that one's; rows are `.item`, lit as Reka highlights them
(`[data-highlighted]`).

### Panels

A panel is a menu's look with fields in it, where a menu cannot hold them (its rows take the keys typed and the
focus under the pointer): Reka UI's Popover, `.menu` with its rows `.item` (buttons) under a top of its own, the pages
pictures meanwhile (`covered('pictures')`), closed as a menu is (Esc, a press outside, a row chosen, the window left);
a row's action runs once it has closed. One today: a profile's picture
(`.profilepics` in `settings/ProfilePage.vue`, from its picture at its page's top: `.choices`).

A menu's row that opens a field (New Profile…) gives it the keyboard with `focusAfterMenu(el)` (`lib/menu.ts`): the
menu, closing, would give it back to its button.

## Clusters

A part of several files with a state of its own is a folder of `components/` (the author, 2026-10-17: against
spaghetti), reached from outside only through its entries; `npm run deps` refuses any other import (`clusters` in
`.dependency-cruiser.ts`: a new cluster is a line there). Its state is a module in it, provided to its files (Vue's
`provide`/`inject`), not in `lib/store.ts`; what it shares with the rest of the window (`Modal.vue`,
`InstallProgress.vue`, `AccountSignIn.vue`, `lib/`) stays outside it; its actions are the core's, over IPC, as
every handle's (CLAUDE.md, "One core"). A single component is no cluster.

| Folder | Its entries | What |
|---|---|---|
| `settings/` | `Settings.vue` | Settings' window: the tree, a project's, an agent's and a profile's page |
| `newproject/` | `Wizard.vue`, `NewProject.vue` | New Project's steps (Code, Agents, Profiles; `wizard.ts` their state): the welcome's and the dialog |
| `welcome/` | `Welcome.vue` | the first start, no project at all: what Kulisa does in three slides (`Tour.vue`), then New Project's steps (`Wizard.vue`, its head a question each); the empty window's (`Empty.vue`) |
| `newtab/` | `Board.vue` | the board: every project a column (an island, as the grid's panels) with its tasks as `.item` rows, a new tab's and the empty window's |

New Project's steps (`.wizard`) are a form: the steps over it (`.steps`, the one shown `aria-current`; the welcome puts
its own head there, the `head` slot), one step at a time, its buttons in a dialog's `footer` (Back at the start, Cancel
in the dialog, Next, Create last); the fields' look is a dialog's (`components.css`, what a dialog holds). A view of
them is one more cluster taking `Wizard.vue`, never a copy of the steps: the welcome is the dialog's steps under its
questions, `leavable` (Back on the first step goes back to its slides).

## Adding something

- A new icon: a `<symbol>` in `Sprite.vue`, a row in the table above.
- A new kind of control or row: in `components.css` with a comment saying what it is and its variants (or a component
  of its own when it has behavior), and a section here. A part used by one place only (a pane's tab strip, the omnibox,
  the projects' islands) keeps its look in its own `.vue` file.
- A new dialog: a component with `Modal.vue`, in `App.vue`, registered in `lib/dialogs.ts`; its own contents' look in
  its `<style>` under its id.
- Something generic (a menu, a dialog, a choice, a field): Reka UI's part, in Kulisa's look; never our own where Reka
  has one (CLAUDE.md, Window UI).
