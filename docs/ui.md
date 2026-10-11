# The window's UI

What the window is built of: the tokens, the icons, and the components, each defined once, so every dialog, button
and list looks and behaves the same. **Before making a button, an icon, a row or a dialog, look here:** use the
component, or add one here (and in `components.css`) when nothing fits. Keep this file current.

Vue 3 components in TypeScript, built by Vite (CLAUDE.md, Window UI; `vite.config.mts`, into `dist/renderer`). The
generic parts (menus, dialogs) are Reka UI's (`reka-ui`: behavior, keyboard and accessibility, no look of its own), in
the look below:

| Where | What |
|---|---|
| `src/renderer/components/*.vue` | the window's parts, each its markup, behavior and own look (`<style>`, rooted at its id or class): `App.vue` puts them together; `grid/` the grid's panels and headers, `menu/` the menus (`ButtonMenu`, `RightClickMenu`, `PointMenu`, `MenuRows`) and ☰'s own rows; `Modal.vue` the dialogs |
| `src/renderer/lib/*.ts` | what parts share or what outlives a component: `store.ts` (what the main process sends, `act`), `grid.ts`, `terminals.ts`, `menu.ts` (what a menu holds), `agents.ts` (the agents' list of a dialog, and an install under way), `ask.ts`, `dialogs.ts`, `keys.ts`, `voice.ts`, `views.ts` (the pages under HTML: `covered()` for every menu and dialog), `profiles.ts` (the profiles' menu), `names.ts` (name fields), `common.ts`, `test-hooks.ts` (what the tests reach by name) |
| `src/renderer/types.ts`, `env.d.ts` | the shapes the main process sends; the bridge to it (`src/preload`) and Vite's types |
| `src/renderer/tokens.css` | every color and size (`:root`); no literal color anywhere else |
| `src/renderer/components.css` | the shared components below, global |
| `src/renderer/index.html`, `main.ts`; `master.html`, `master.ts` | the window's page and a master's window's: the theme before the first paint, then the app |
| `src/renderer/public/avatars/` | the profiles' pictures, copied as they are |

## Desktop, not a web page

Kulisa is a desktop app, an IDE: its window looks like one, JetBrains' Settings its model (the author, 2026-10-11:
the dialogs, with big titles, framed cards, a paragraph each, pills and rows that showed their buttons under the
pointer, read as a web page's and were hard to read). So:

- **Two text sizes** (`--font`, `--font-small` for group titles and a dialog's title), two weights; nothing bigger.
  Weight and color carry what matters, not size.
- **Dense**: rows and controls `--control` high (`--row` the same), toolbar buttons 24 px, corners `--radius` (4 px)
  on controls and `--island-radius` on windows and dialogs.
- **Forms are "Label: field"**, the labels in one column (`.field`); a comment under a field only when needed.
- **Groups under a titled line** (`.titled`), not framed cards: no frame in a frame.
- **A list has a toolbar over it** (`.list`: + adds, − removes the selected row, ★ makes it the default), and
  its actions act on the selected row (also Delete, and its right-click). A row shows facts: what it is, its path or
  email muted after it, a state at its end in words ("default", "no commit yet"); no buttons that show under the
  pointer, no pills.
- **A dialog asks one thing and ends with its buttons** (`Modal.vue`); what is browsed (Settings) is a tree on the
  left and a page on the right, under its path.

## Tokens (`tokens.css`)

- Colors for both themes ([window.md](window.md), Theme): each is `light-dark(light, dark)`, so a new color gets
  both values. JS reads a color as shown through an element that uses it (`lib/terminals.ts`), not the token's text.
  JetBrains' themes: `--window` (gaps, title bar), `--island` (panels, dialogs, menus), `--well` (under a
  task's panels and the projects' islands, a step from `--island`), `--island-hi`
  (a lit row, a divider), `--toolbar` (a pane's toolbar and active tab), `--field`, `--button`, `--line` (borders);
  text `--text`, `--text-strong`, `--text-dim`, `--text-muted`; `--accent` (main button, focus), `--danger`,
  `--error`, `--note` (the agent's caption), `--done`; `--on-accent` (text on `--accent` and `--danger`),
  `--selection` (the terminal's); `--chosen`, `--chosen-idle` (a list's selected row, while the list has the keyboard
  and when it has not: JetBrains'); `--page-button`, `--on-page-button`, `--page-pad` (Chrome's blue and room, a page's
  dialog: `.pagedialog`); `--page`, `--backdrop`, `--shadow`; `--hover` (under the
  pointer, on any background); `--project` (the shown group's project's color, set by `lib/store.ts`).
- Sizes: `--font` (all text, the terminal too), `--font-small` (a group's title, a dialog's title), `--control` (the
  height of buttons and fields), `--radius`,
  `--tab-radius`, `--island-radius`, `--gap` (the space between and inside islands; also dockview's `gap` in
  `Grid.vue`); room as Chrome's menus and dialogs have it: `--row` (a row of a menu or a list), `--inset` (inside
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
| `i-close` | × of dialogs, profiles, tabs, tasks; removing a row |
| `i-plus` | new tab, new task (the bar's +, after the islands); adding to a section of a dialog |
| `i-settings` | Settings in the title bar (Lucide's settings) |
| `i-projects` | ☰'s Tasks bar row (Lucide's folder-open) |
| `i-logo` | the app icon with its curtain in `currentColor`: the title bar's (`--project`), and a project's label in the tasks' bar (its `--color`). The folds are a shadow over the color, one for every color: a `<use>` takes the sprite's gradient, not one of its own |
| `i-docs`, `i-github`, `i-bug` | the links (Documentation, GitHub, Report an issue), rows of ☰ (`data-icon` on each link; Lucide's book-open, github, bug) |
| `i-menu` | ☰, the window's menu |
| `i-more` | ⋮, a pane's menu |
| `i-back`, `i-forward`, `i-reload` | a pane's toolbar (Chrome's) |
| `i-pick` | Pick (DevTools' inspect icon) |
| `i-globe` | a tab whose site has no icon |
| `i-zoom`, `i-theme`, `i-arrange`, `i-agent`, `i-keyboard`, `i-exit` | ☰'s rows: Zoom, Theme, Arrange panels, Agents…, Keyboard Shortcuts, Exit |
| `i-mic` | dictation's microphone in the terminal's header (Lucide's mic) |
| `i-users` | the profiles' button on the shown task's tab (Lucide's users) |
| `i-p-cart`, `i-p-briefcase`, `i-p-globe`, `i-p-flask`, `i-p-rocket`, `i-p-code`, `i-p-building`, `i-p-people`, `i-p-book`, `i-p-heart` | a project's icon to choose (Lucide's shopping-cart, briefcase, globe, flask-conical, rocket, code, building-2, users-round, book-open-text, heart), drawn in its color (`projectIcon`, `lib/common.ts`) |
| `i-working`, `i-waiting`, `i-done` | an agent's state on a tab (`.state`); `i-done` also checks the chosen row of a menu or a select, and a checkbox |
| `i-down` | a select's button (`SelectBox.vue`) |
| `i-minus`, `i-star` | a list's toolbar (`.list`, after its `i-plus`): remove the selected row, make it the default (Lucide's star) |
| `i-folder-plus`, `i-folder`, `i-git` | New Project's code: New Folder, Folders on Disk, Clone from URL (Lucide's folder-plus, folder, git-branch) |
| `i-agent-claude`, `i-agent-codex`, `i-agent-shell` | an agent's row and its accounts' (`AgentList.vue`, `i-agent-<id>`, 20 px): the makers' own marks in their own colors (claude.ai's and developers.openai.com's favicons; not under the GPL: `docs/LICENSING.md`), and Lucide's square-terminal for the terminal only |

An icon is 16 px; × and + are 14 px, as in Chrome (`.icon`), and so is an agent's state. ☰'s and the agent's states are Lucide's (lucide.dev, ISC), drawn on 24 × 24 with
their lines thickened to match; take a new one from there rather than drawing it. The sprite takes no room but is not
`display: none`, so the logo's gradient and clip path reach its `<use>`s. Pictures are not icons: the arrangements in ☰
are drawn in place; the profiles' pictures are files of their own
(`src/renderer/public/avatars/`, Noto Emoji, in their own colors). The test `icons: …` in `test/window.js` checks that
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
  - `--icon`: the icon's size, when a place needs another (☰ is 18 px).
  - A `<span class="icon">` where a button cannot be (a tab's ×, inside the tab).
- In a menu or the title bar, a button is still one of these.
- `:title="withKeys('Reload', 'tab.reload')"` (a command of `src/main/keys.js`; `lib/common.ts`): its key at the end
  of its tooltip, "Reload (Ctrl+R)", as Chrome's toolbar says it.

### Rows

- `.item`: a row of a menu or a list (`MenuButton.vue`, the projects' manager's rows), `--row` high: an optional icon (`.ico`), `.dot`
  (a project's color, `--color`), `ProjectIcon.vue` (a project's icon in its color: its favicon, one of Kulisa's set or
  the curtain; `.picon`, also on its label in the tasks' bar) or `.avatar` (a profile's picture), `.text` with `.label` and a `small` line under it, a `kbd` key at the end. Lit under the
  pointer and on keyboard focus.
- `.removable`: a menu's row with a × (`button.remove.icon.quiet`) at its end, shown on hover or focus; the row is
  lit as one (removing a recent project). Not in a dialog's lists: those are `.list`.
- `.list`: a list a dialog edits (a project's Code, Agents and Profiles; New Project's folders; an agent's accounts),
  or chooses from (Settings → Agents' agents, no toolbar), as JetBrains': framed,
  `.tools` over it (`.icon.small` buttons: + adds, often a `ButtonMenu`; − removes the selected row; ★ makes it the
  default), its rows Reka's Listbox items (`.item` on one line: `.label`, its facts in a `small` after it, muted; a
  state at the end, `kbd`: "default" (`.default`), `.warn` in `--note` when it needs the human), the selected one in
  `--chosen` (`--chosen-idle` when the list has not the keyboard). Delete removes the selected one; a
  `RightClickMenu` around the Listbox has the row's actions (it selects the row). `.empty` in it when it has none.
- `.titled`: a group's title, its name and a line to the end (JetBrains' titled separator), over a `.list` or fields.
- `.item[aria-selected="true"]`: the chosen row of a list (Reka's Listbox, Tree), lit.
- `.dot`: a 10 px circle in `--color`, a project's.

### Controls

The window's controls are Reka UI's, in this look (CLAUDE.md, Window UI):

- `.radio`: a radio (Reka's `RadioGroupItem`, its `RadioGroupIndicator` the dot), in a `RadioGroupRoot`: at a row's
  start (the row a `<label>`), exactly one of a list: the agent to start (`AgentList.vue`). The arrows move between
  them. Not for a list's default, whose rows are what the list is about: a radio there read as choosing the row (the
  projects' manager until 2026-10-11); that is "default" at the row's end and ★. Not for a few big choices either
  (New Project's code: a list on the dialog's left, Reka's Listbox, as JetBrains' New Project).
- `.checkbox`: a checkbox (Reka's `CheckboxRoot`, its `CheckboxIndicator` the check, `i-done`): Create Git repository.
- `SelectBox.vue`: one of a few (Reka's `Select`): a button (`.select`) with the chosen one and `i-down`; its list a
  menu's (`.menu`, rows `.item`, the chosen one checked). `v-model`, `options: [{ value, label }]`; `''` is a value too.
- `.choices`: icon buttons (`.icon`) to choose one of, the chosen one ringed in `--accent`: a profile's pictures and
  a project's icons (Reka's `ToggleGroup`, one always chosen), a project's colors (its `ColorSwatchPicker`, a `.dot`
  each: the color's name for screen readers).
- `.editable`: a value edited in place (Reka's `Editable`: a profile's name, who it is, its test login): text in a
  field's box (`.preview`), a click or Tab edits it; Enter or leaving saves, Shift+Enter is a new line where it has
  lines, Esc puts it back (and leaves the dialog open).
- Fields (Reka's `FieldRoot`, `FieldLabel`, `FieldControl`, `FieldDescription`, `FieldError`) in `.field`; a
  dialog's form is its `FormRoot` (`Modal.vue`, `errors`: the main process's refusal at its field).
- Tabs: a pane's tabs and the tasks' tabs are Reka's `Tabs` (`activationMode` manual): chosen on the press, as a
  browser's (not on their ×), one Tab stop for the strip, the arrows move and Enter chooses.
- `Toggle`: a button that stays on (Pick, `[data-state="on"]`).
- `Collapsible`: something shown on demand (a profile's pictures to choose from; Details: `button.more` its trigger, an
  installer's output, an agent's sign-in's terminal).
- `.avatar`: a profile's picture (`<img>`, `avatarSrc(name)` in `lib/common.ts`; `Avatars.vue` the ones to choose from), 16 px; `--avatar` where a place needs
  another size (22 px in a profile's row, `ProfileRow.vue`).
- `.striptab`: a tab of a strip on an island, as a browser's: the agent's `.state`, `.name`, × at the end
  (`button.close.icon.quiet.small`), shown under the pointer and on the shown tab, its room kept so nothing moves. A
  step taller than a button (`--control` + 4 px) and at least 64 px wide: a target for a quick throw of the mouse.
  Lit under the pointer; `.active`: the shown one, in the panels' color (`--island`) on the dark island. A
  task's tab (`TaskTab.vue`).
- `.chip`: an icon button inside a tab: on the shown task's tab 👥 (`#openProfiles`, lit under the pointer) with the
  menu of its profiles; the other tabs keep its room only (not shown), so that tabs keep their widths as another is
  shown. No number (the author, 2026-10-11).
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
- `.body`: `.hint` (what it is about, muted), `.field` (a label, "Name:", and its input, the labels in one column; `.pick` in
  it: the input with its button, Location and Browse…), `.row` (a line of controls: a field with its buttons,
  a URL to clone, a new profile's name), `.check` (a `.checkbox` in the fields' column), `.error` (hidden while empty; its text
  selectable, to copy and search for, as a question's detail is); a field's
  `.hint` under it (its `FieldDescription`).
- `footer`: the buttons at the right end, the main one last; `.start` puts a button at the left end. A button that
  only closes is Reka's `DialogClose`. A dialog whose parts are saved as they change (Settings) has none: × closes it.
- A part of what it edits: a `.titled` line, then its `.list` or fields, a `.row` under the list for what is being
  added in place (a URL to clone, a new profile's name). Not framed cards or sections with a + in their heading
  (until 2026-10-11: a frame in a dialog in a split was a frame in a frame in a frame, and it read as a web page).
- `.empty`: a list's line when it has none ("No accounts yet."), dim.
- A dialog that is browsed (Settings, `ProjectEditor.vue`) is a tree on the left (Reka's `Tree`, `#pjlist`: its rows
  `.item`, `data-project` or `data-tab`; a parent opens and closes, it is not chosen) and the chosen page on the right
  under its path (`.crumbs`: "Projects › shop", its actions at the end). A page of things with details (Settings →
  Agents) is a `.list` on its left and the chosen one's fields on its right. A dialog of a few big choices and a form (New
  Project) has the choices as a list on its left (Reka's Listbox), the form on its right.
- With `form` the content and the buttons are a form: Enter submits.
- Its ref: `await open()` (shown, the keyboard in its `[autofocus]` field or on it; the profiles' pages hidden while it
  is open: `covered('hide')`, `lib/views.ts`), `close()`, `isOpen()`. Its content is in the page only while it is open
  (Reka's default; kept closed, the dialogs' parts took about 2.5 MB of the window's memory), so it opens first and
  is filled after; what must outlive it lives in the dialog's component or in `lib/` (the agents' list and an install
  under way: `lib/agents.ts`). When it closes, the keyboard goes back where it was.
- Every dialog is in `App.vue` from the start and registers what it does (`registerDialog`); anything opens one by
  name: `(await dialog('projects')).openProjects(id)` (`lib/dialogs.ts`).
- A page's alert or confirm (`.pagedialog`, in `ProfilePane.vue`) is not a `Modal`: a Dialog that is not modal (the
  other panes go on), in its pane right under the address bar, over a picture of the page, in Chrome's size, shape and
  blue: the page's, not Kulisa's. Esc is Cancel; a click outside does nothing; OK has the keyboard.
- Questions before something that cannot be undone, before closing, or between two ways to go (a second button,
  `other`), are not new dialogs: `shell.ask` (main process) or `ask(q)` (`lib/ask.ts`) → `Ask.vue`, Reka's AlertDialog
  in the same look: Cancel has the keyboard, Esc is Cancel, a click outside does nothing (it waits for an answer);
  `other` adds the second way's button before the main one.

### Menus

Reka UI's menus, the rows built as one opens: a button's (`ButtonMenu.vue`: ☰, ⋮, a project's ⋯, the profiles'
button, the bar's + …; `end`: its end edge at the button's, at a bar's end), an area's right-click menu at the pointer
(`RightClickMenu.vue`: `items(e)` builds the rows for what was right-clicked, or `null`: none), one at a point
(`menuAt(e, items)` in `lib/menu.ts`, `PointMenu.vue`: a link in the terminal). `ButtonMenu` opens on the press, so a
press, a drag to a row and the release there chooses it, as the OS's menus; Enter, Space or ↓ on the button open it.
Rows are chosen with the left button only (on Linux a right-click menu opens on the press, and the release must not
choose a row). One menu at a time; Esc, a press outside, the same button, a chosen row or leaving the window closes
it, and the keyboard goes back where it was. While one is open, the pages are pictures of themselves
(`covered('pictures')`); it shows once they are.

Items (`lib/menu.ts`, laid out by `menu/MenuRows.vue`) are `{ label, sub, keys, icon, color, avatar, project, inset,
enabled, run, remove }` (`MenuButton.vue`; `keys`: the row's key at its end, from the keys' table: `keyText(id)`, `lib/common.ts`;
`remove`: a × after the row, an item of its own), `'-'` (a divider), `{ heading, icon }`, `{ note }` (small dim words
under the rows, not one of them: ☰'s version, so nothing looks clickable that is not), `{ choose, chosen, rows }` (one
of them checked: the dictation language) or `{ component, props }` (a row of its own: ☰'s zoom, theme, tasks' bar
and arrangements, `components/menu/`, built of Reka's menu items; − and + and the choices leave the menu open);
`icon` is the sprite's id, at the row's start; `project` a project's icon in its color there (`ProjectIcon.vue`,
`.picon`); `inset` sets a row in under the one above, its text under that one's (a project's closed task under it, in
the bar's +); rows are `.item` and `.removable`, lit as Reka highlights them
(`[data-highlighted]`).

### Panels

A panel is a menu's look with fields in it, where a menu cannot hold them (its rows take the keys typed and the
focus under the pointer): Reka UI's Popover, `.menu` with its rows `.item` (buttons) under a top of its own, the pages
pictures meanwhile (`covered('pictures')`), closed as a menu is (Esc, a press outside, a row chosen, the window left);
a row's action runs once it has closed. One today: a project's color and icon
(`.pjlookpanel` in `ProjectEditor.vue`, from its icon at its page's top: `.choices` under `.heading`s).

A menu's row that opens a field (New Profile…) gives it the keyboard with `focusAfterMenu(el)` (`lib/menu.ts`): the
menu, closing, would give it back to its button.

## Adding something

- A new icon: a `<symbol>` in `Sprite.vue`, a row in the table above.
- A new kind of control or row: in `components.css` with a comment saying what it is and its variants (or a component
  of its own when it has behavior), and a section here. A part used by one place only (a pane's tab strip, the omnibox,
  the projects' islands) keeps its look in its own `.vue` file.
- A new dialog: a component with `Modal.vue`, in `App.vue`, registered in `lib/dialogs.ts`; its own contents' look in
  its `<style>` under its id.
- Something generic (a menu, a dialog, a choice, a field): Reka UI's part, in Kulisa's look; never our own where Reka
  has one (CLAUDE.md, Window UI).
