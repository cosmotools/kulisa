# The window's UI

What the window is built of: the tokens, the icons, and the components, each defined once, so every dialog, button
and list looks and behaves the same. **Before making a button, an icon, a row or a dialog, look here:** use the
component, or add one here (and in `components.css`) when nothing fits. Keep this file current.

Plain HTML, CSS and JS, no build step (CLAUDE.md, Window UI): markup in `index.html` (repeated parts as
`<template>`s), styles in three files loaded in this order:

| File | What |
|---|---|
| `src/renderer/tokens.css` | every color and size (`:root`); no literal color anywhere else |
| `src/renderer/components.css` | the components below |
| `src/renderer/window.css` | the window's layout and its own parts (title bar, panes, the projects' bar, Welcome screen, the dialogs' and menus' contents). It places components and adjusts them through their custom properties; it does not make its own buttons, icons or rows |

## Tokens (`tokens.css`)

- Colors for both themes ([window.md](window.md), Theme): each is `light-dark(light, dark)`, so a new color gets
  both values. JS reads a color as shown through an element that uses it (`terminal.js`), not the token's text.
  JetBrains' themes: `--window` (gaps, title bar), `--island` (panels, dialogs, menus), `--well` (under a
  workspace's panels and the projects' islands, a step from `--island`), `--island-hi`
  (a lit row, a divider), `--toolbar` (a pane's toolbar and active tab), `--field`, `--button`, `--line` (borders);
  text `--text`, `--text-strong`, `--text-dim`, `--text-muted`; `--accent` (main button, focus), `--danger`,
  `--error`, `--note` (the agent's caption), `--done`; `--on-accent` (text on `--accent` and `--danger`),
  `--selection` (the terminal's); `--page`, `--backdrop`, `--shadow`; `--hover` (under the
  pointer, on any background); `--project` (the open project's color, set by `renderer.js`).
- Sizes: `--font` (all text, the terminal too), `--control` (the height of buttons and fields), `--radius`,
  `--tab-radius`, `--island-radius`, `--gap` (the space between and inside islands; also dockview's `gap` in
  `renderer.js`); room as Chrome's menus and dialogs have it: `--row` (a row of a menu or a list), `--inset` (inside
  a row, between its icon and text, between a dialog's fields), `--pad` (inside a dialog along its edges). Things
  set close together were the author's complaint (2026-10-07): space comes from these, not from new numbers. The
  Kulisa zoom scales them all.

## Icons

Each icon is drawn once, as a `<symbol id="i-…">` in the sprite at the top of `index.html`, on a 16 × 16 grid, in
lines (`stroke`) of the text's color; a filled part has `fill="currentColor"`. Use it as:

```html
<svg aria-hidden="true"><use href="#i-close"/></svg>
```

| Icon | Where |
|---|---|
| `i-close` | × of dialogs, profiles, tabs, workspaces; removing a row |
| `i-plus` | new tab, new workspace |
| `i-projects` | the projects' menu (after the islands of the projects' bar), its row in ☰ (Lucide's folder-open) |
| `i-logo` | the app icon with its curtain in `currentColor`: the title bar's (`--project`), a project's label in the projects' bar (its `--color`) and ☰'s version heading. The folds are a shadow over the color, one for every color: a `<use>` takes the sprite's gradient, not one of its own |
| `i-menu` | ☰, the window's menu |
| `i-more` | ⋮, a pane's menu |
| `i-back`, `i-forward`, `i-reload` | a pane's toolbar (Chrome's) |
| `i-pick` | Pick (DevTools' inspect icon) |
| `i-globe` | a tab whose site has no icon |
| `i-zoom`, `i-theme`, `i-arrange`, `i-agent`, `i-exit` | ☰'s rows: Zoom, Theme, Arrange panels, Agents…, Exit |
| `i-working`, `i-waiting`, `i-done` | an agent's state on a tab (`.state`) |

An icon is 16 px; × and + are 14 px, as in Chrome (`.icon`), and so is an agent's state. ☰'s and the agent's states are Lucide's (lucide.dev, ISC), drawn on 24 × 24 with
their lines thickened to match; take a new one from there rather than drawing it. The sprite takes no room but is not
`display: none`, so the logo's gradient and clip path reach its `<use>`s. Pictures are not icons: the arrangements in ☰
are drawn in place; the Welcome screen shows `assets/icon.svg` itself; the profiles' pictures are files of their own
(`src/renderer/avatars/`, Noto Emoji, in their own colors). The test `icons: …` in `test/window.js` checks that
every other `<svg>` uses the sprite.

## Components (`components.css`)

### Buttons

- `<button>`: a framed button with text, `--control` high. `.primary` (blue, the main action of a dialog, last in its
  footer), `.danger` (red, when it deletes). Disabled: faded.
- `.icon`: an icon alone, round, no frame, lit under the pointer (`--hover`); always with `aria-label` (or `title`).
  - `.quiet`: muted until pointed at, for × and removing.
  - `.small`: 22 px, inside a row (a tab's ×, a workspace's ×).
  - `--icon`: the icon's size, when a place needs another (☰ is 18 px).
  - A `<span class="icon">` where a button cannot be (a tab's ×, inside the tab).
- In a menu or the title bar, a button is still one of these.

### Rows

- `.item`: a row of a menu or a list (`tpl-menuitem`, `tpl-project`), `--row` high: an optional icon (`.ico`), `.dot`
  (a project's color, `--color`) or `.avatar` (a profile's picture), `.text` with `.label` and a `small` line under it, a `kbd` key at the end. Lit under the
  pointer and on keyboard focus.
- `.removable`: a row with a × (`button.remove.icon.quiet`) at its end, shown on hover or focus; the row is lit as
  one. A recent project in the project menu and on the Welcome screen.
- `.dot`: a 10 px circle in `--color`, a project's.
- `.avatar`: a profile's picture (`<img>`, `avatarSrc(name)` in `common.js`), 16 px; `--avatar` where a place needs
  another size (22 px in the editor).
- `.striptab`: a tab of a strip on an island, as a browser's: the agent's `.state`, `.name`, × at the end
  (`button.close.icon.quiet.small`), shown under the pointer and on the shown tab, its room kept so nothing moves. A
  step taller than a button (`--control` + 4 px) and at least 64 px wide: a target for a quick throw of the mouse.
  Lit under the pointer; `.active`: the shown one, in the panels' color (`--island`) on the dark island. A
  workspace's tab (`tpl-wstab`).
- `.state`: an agent's state by `data-state` (from its hooks), an icon each so that color is not the only sign (some
  people do not tell yellow from green): working (sparkles in `--accent`, twinkling; not with reduced motion), waiting
  for you (a bell in `--note`), done (a check in `--done`: come and see, until the human sees that workspace); nothing otherwise, as nothing asks for
  the human then (the author's rule). On a workspace's tab; `showAgentState` (`common.js`) sets it with its tooltip.

### Dialogs

Every dialog is a `<dialog>` with the same parts:

```html
<dialog id="…" closedby="any">
  <header><h2>Title</h2><button class="x icon quiet" type="button" command="close" commandfor="…" title="Close"
    aria-label="Close"><svg aria-hidden="true"><use href="#i-close"/></svg></button></header>
  <div class="body">…</div>
  <footer><button type="button" command="close" commandfor="…">Cancel</button><button class="primary">Create</button></footer>
</dialog>
```

- `header`: the title, and × when it may be closed (Esc and a click outside close it too: `closedby`).
- `.body`: `.hint` (what it is about, muted), `.field` (a label and its input, the labels in one column), `.row` (a
  field with its button), `.check` (a checkbox in the fields' column), `.error` (hidden while empty).
- `footer`: the buttons at the right end, the main one last; `.start` puts a button at the left end.
- While a dialog is open the profiles' pages are hidden (`coverWhileOpen`, `common.js`): they are native views
  above the HTML.
- Questions before something that cannot be undone, before closing, or between two ways to go (This Window or New
  Window), are not new dialogs: `shell.ask` (main process) → `ask.js`; `other` adds the second way's button before
  the main one.

### Menus

`openMenu(items, at)` (`menu.js`): one popover, under its button (`data-menu-end`: its right edge at the button's) or
at the pointer, flipped to stay in the window. Items are `{ label, sub, keys, icon, color, avatar, enabled, run, remove }`,
`'-'` (a divider), `{ heading, icon }` or `{ element }` (a row of its own); `icon` is the sprite's id, at the row's start; rows are `.item` and `.removable`. A menu's own kind of row (the zoom row, the theme
row, the arrangements) is a template in `index.html` and its look in `window.css`. While a menu is open, the pages are
pictures of themselves.

## Adding something

- A new icon: a `<symbol>` in the sprite, a row in the table above.
- A new kind of control or row: in `components.css` with a comment saying what it is and its variants, and a section
  here. A part used by one place only (a pane's tab strip, the omnibox, the projects' islands) stays in `window.css`.
- A new dialog: the markup above in `index.html`; its own contents' look in `window.css` under its id.
