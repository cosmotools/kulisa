# The window's UI

What the window is built of: the tokens, the icons, and the components, each defined once, so every dialog, button
and list looks and behaves the same. **Before making a button, an icon, a row or a dialog, look here:** use the
component, or add one here (and in `components.css`) when nothing fits. Keep this file current.

Vue 3 components in TypeScript, built by Vite (CLAUDE.md, Window UI; `vite.config.mts`, into `dist/renderer`):

| Where | What |
|---|---|
| `src/renderer/components/*.vue` | the window's parts, each its markup, behavior and own look (`<style>`, rooted at its id or class): `App.vue` puts them together; `grid/` the grid's panels and headers, `menu/` ☰'s own rows |
| `src/renderer/lib/*.ts` | what parts share or what outlives a component: `store.ts` (what the main process sends, `act`), `grid.ts`, `terminals.ts`, `menu.ts`, `ask.ts`, `dialogs.ts`, `keys.ts`, `voice.ts`, `views.ts` (the pages under HTML), `common.ts` |
| `src/renderer/tokens.css` | every color and size (`:root`); no literal color anywhere else |
| `src/renderer/components.css` | the shared components below, global |
| `src/renderer/index.html`, `main.ts`; `master.html`, `master.ts` | the window's page and a master's window's: the theme before the first paint, then the app |
| `src/renderer/public/avatars/` | the profiles' pictures, copied as they are |

## Tokens (`tokens.css`)

- Colors for both themes ([window.md](window.md), Theme): each is `light-dark(light, dark)`, so a new color gets
  both values. JS reads a color as shown through an element that uses it (`lib/terminals.ts`), not the token's text.
  JetBrains' themes: `--window` (gaps, title bar), `--island` (panels, dialogs, menus), `--well` (under a
  task's panels and the projects' islands, a step from `--island`), `--island-hi`
  (a lit row, a divider), `--toolbar` (a pane's toolbar and active tab), `--field`, `--button`, `--line` (borders);
  text `--text`, `--text-strong`, `--text-dim`, `--text-muted`; `--accent` (main button, focus), `--danger`,
  `--error`, `--note` (the agent's caption), `--done`; `--on-accent` (text on `--accent` and `--danger`),
  `--selection` (the terminal's); `--page-button`, `--on-page-button` (Chrome's blue, a page's dialog: `.pagedialog`); `--page`, `--backdrop`, `--shadow`; `--hover` (under the
  pointer, on any background); `--project` (the open project's color, set by `lib/store.ts`).
- Sizes: `--font` (all text, the terminal too), `--control` (the height of buttons and fields), `--radius`,
  `--tab-radius`, `--island-radius`, `--gap` (the space between and inside islands; also dockview's `gap` in
  `Grid.vue`); room as Chrome's menus and dialogs have it: `--row` (a row of a menu or a list), `--inset` (inside
  a row, between its icon and text, between a dialog's fields), `--pad` (inside a dialog along its edges). Things
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
| `i-plus` | new tab, new task |
| `i-projects` | the projects' manager in the title bar, the projects' menu (after the islands of the projects' bar) (Lucide's folder-open) |
| `i-logo` | the app icon with its curtain in `currentColor`: the title bar's (`--project`), and a project's label in the projects' bar (its `--color`). The folds are a shadow over the color, one for every color: a `<use>` takes the sprite's gradient, not one of its own |
| `i-docs`, `i-github`, `i-bug` | the Welcome screen's links (Documentation, GitHub, Report an issue) as rows of ☰ (`data-icon` on each link; Lucide's book-open, github, bug) |
| `i-menu` | ☰, the window's menu |
| `i-more` | ⋮, a pane's menu |
| `i-back`, `i-forward`, `i-reload` | a pane's toolbar (Chrome's) |
| `i-pick` | Pick (DevTools' inspect icon) |
| `i-globe` | a tab whose site has no icon |
| `i-zoom`, `i-theme`, `i-arrange`, `i-agent`, `i-keyboard`, `i-exit` | ☰'s rows: Zoom, Theme, Arrange panels, Agents…, Keyboard Shortcuts, Exit |
| `i-mic` | dictation's microphone in the terminal's header (Lucide's mic) |
| `i-users` | the profiles' chip on every task's tab (Lucide's users) |
| `i-p-cart`, `i-p-briefcase`, `i-p-globe`, `i-p-flask`, `i-p-rocket`, `i-p-code`, `i-p-building`, `i-p-people`, `i-p-book`, `i-p-heart` | a project's icon to choose (Lucide's shopping-cart, briefcase, globe, flask-conical, rocket, code, building-2, users-round, book-open-text, heart), drawn in its color (`projectIcon`, `lib/common.ts`) |
| `i-working`, `i-waiting`, `i-done` | an agent's state on a tab (`.state`) |

An icon is 16 px; × and + are 14 px, as in Chrome (`.icon`), and so is an agent's state. ☰'s and the agent's states are Lucide's (lucide.dev, ISC), drawn on 24 × 24 with
their lines thickened to match; take a new one from there rather than drawing it. The sprite takes no room but is not
`display: none`, so the logo's gradient and clip path reach its `<use>`s. Pictures are not icons: the arrangements in ☰
are drawn in place; the Welcome screen shows `assets/icon.svg` itself (imported, so Vite bundles it); the profiles' pictures are files of their own
(`src/renderer/public/avatars/`, Noto Emoji, in their own colors). The test `icons: …` in `test/window.js` checks that
every other `<svg>` uses the sprite.

## Components (`components.css`)

### Buttons

- `<button>`: a framed button with text, `--control` high. `.primary` (blue, the main action of a dialog, last in its
  footer), `.danger` (red, when it deletes). Disabled: faded.
- `.icon`: an icon alone, round, no frame, lit under the pointer (`--hover`); always with `aria-label` (or `title`).
  - `.quiet`: muted until pointed at, for × and removing.
  - `.small`: 22 px, inside a row (a tab's ×, a task's ×).
  - `--icon`: the icon's size, when a place needs another (☰ is 18 px).
  - A `<span class="icon">` where a button cannot be (a tab's ×, inside the tab).
- In a menu or the title bar, a button is still one of these.
- `:title="withKeys('Reload', 'tab.reload')"` (a command of `src/main/keys.js`; `lib/common.ts`): its key at the end
  of its tooltip, "Reload (Ctrl+R)", as Chrome's toolbar says it.

### Rows

- `.item`: a row of a menu or a list (`MenuButton.vue`, the Welcome screen's projects, the projects' manager's rows), `--row` high: an optional icon (`.ico`), `.dot`
  (a project's color, `--color`) or `.avatar` (a profile's picture), `.text` with `.label` and a `small` line under it, a `kbd` key at the end. Lit under the
  pointer and on keyboard focus.
- `.removable`: a row with a × (`button.remove.icon.quiet`) at its end, shown on hover or focus; the row is lit as
  one. A recent project in the project menu and on the Welcome screen; a project's repository, agent and profile in the
  projects' manager.
- `.item[aria-current="true"]`: the chosen row of a list, lit (a project in the projects' manager).
- A radio at a row's start (`input[type="radio"]` in an `.item`, the row a `<label>`): the default of a list, exactly one
  (a project's repositories and agents in the manager).
- `.dot`: a 10 px circle in `--color`, a project's.
- `.choices`: icon buttons (`.icon`, `aria-pressed`) to choose one of, the chosen one ringed in `--accent`: a
  profile's pictures, a project's colors (a `.dot` each) and icons.
- `.avatar`: a profile's picture (`<img>`, `avatarSrc(name)` in `lib/common.ts`; `Avatars.vue` the ones to choose from), 16 px; `--avatar` where a place needs
  another size (22 px in the editor).
- `.striptab`: a tab of a strip on an island, as a browser's: the agent's `.state`, `.name`, × at the end
  (`button.close.icon.quiet.small`), shown under the pointer and on the shown tab, its room kept so nothing moves. A
  step taller than a button (`--control` + 4 px) and at least 64 px wide: a target for a quick throw of the mouse.
  Lit under the pointer; `.active`: the shown one, in the panels' color (`--island`) on the dark island. A
  task's tab (`TaskTab.vue`).
- `.chip`: an icon and a number inside a tab: on every task's tab, 👥 and how many of its profiles are open; on
  the shown one a button (`#openProfiles`, lit under the pointer) with the menu of them. On every tab, so that tabs
  keep their widths as another is shown.
- `.state`: an agent's state by `data-state` (from its hooks), an icon each so that color is not the only sign (some
  people do not tell yellow from green): working (sparkles in `--accent`, twinkling; not with reduced motion), waiting
  for you (a bell in `--note`), done (a check in `--done`: come and see, until the human sees that task); nothing otherwise, as nothing asks for
  the human then (the author's rule). On a task's tab (`TaskTab.vue`), with its tooltip.

### Dialogs

Every dialog is `Modal.vue`, a `<dialog>` with the same parts:

```html
<Modal id="…" title="Title" form form-id="…" @submit="save">
  …the content…
  <template #footer><button type="button" command="close" commandfor="…">Cancel</button><button class="primary">Create</button></template>
</Modal>
```

- `header`: the title, and × when it may be closed (`closable`; Esc and a click outside close it too: `closedby`).
- `.body`: `.hint` (what it is about, muted), `.field` (a label and its input, the labels in one column), `.row` (a
  field with its button), `.check` (a checkbox in the fields' column), `.error` (hidden while empty).
- `footer`: the buttons at the right end, the main one last; `.start` puts a button at the left end.
- With `form` the content and the buttons are a form: Enter submits.
- Its ref: `open()` (hiding the profiles' pages while it is open: `showModal`, `lib/views.ts`), `close(value)`, `el`.
- Every dialog is in `App.vue` from the start and registers what it does (`registerDialog`); anything opens one by
  name: `(await dialog('projects')).openProjects(id)` (`lib/dialogs.ts`).
- A page's alert or confirm (`.pagedialog`, in `ProfilePane.vue`) is not a `Modal`: opened non-modal (`show()`) right
  under its pane's address bar, over a picture of the page, in Chrome's size, shape and blue: the page's, not Kulisa's;
  `closedby="closerequest"` gives Esc.
- Questions before something that cannot be undone, before closing, or between two ways to go (This Window or New
  Window), are not new dialogs: `shell.ask` (main process) or `ask(q)` (`lib/ask.ts`) → `Ask.vue`; `other` adds the
  second way's button before the main one.

### Menus

`openMenu(items, at)` (`lib/menu.ts`, drawn by `Menu.vue`): one popover, under its button (`data-menu-end`: its right
edge at the button's) or at the pointer, flipped to stay in the window. Items are `{ label, sub, keys, icon, color,
avatar, enabled, run, remove }` (`keys`: the row's key at its end, from the keys' table: `keyText(id)`,
`lib/common.ts`), `'-'` (a divider), `{ heading, icon }`, `{ note }` (small dim words under the rows, not one of them:
☰'s version, so nothing looks clickable that is not) or `{ component, props }` (a row of its own: ☰'s zoom, theme,
projects' bar and arrangements, `components/menu/`); `icon` is the sprite's id, at the row's start; rows are `.item`
and `.removable`. While a menu is open, the pages are pictures of themselves.

## Adding something

- A new icon: a `<symbol>` in `Sprite.vue`, a row in the table above.
- A new kind of control or row: in `components.css` with a comment saying what it is and its variants (or a component
  of its own when it has behavior), and a section here. A part used by one place only (a pane's tab strip, the omnibox,
  the projects' islands) keeps its look in its own `.vue` file.
- A new dialog: a component with `Modal.vue`, in `App.vue`, registered in `lib/dialogs.ts`; its own contents' look in
  its `<style>` under its id.
