# The window's UI

What the window is built of, each part defined once, so every dialog, button and list looks and behaves the same.
**Before making a button, an icon, a row, a dialog or a control, look here.** Keep this file current.

- **shadcn-vue's components** (`components/ui/`), on Reka UI (behavior, keyboard, accessibility): nothing of our own
  where either has it. One missing is added by its CLI (`npx shadcn-vue add …`), and a line here; its files stay as
  the CLI writes them, so that it can update them.
- **Tailwind's utilities place them**, and never restyle them into new ones; a part has no `<style>` but the keyframes
  of an animation of its own (`HandOver.vue`). CSS of our own only for what utilities cannot reach (`app.css`). ESLint
  refuses an unknown class.
- **Not generic, so not shadcn-vue's**: the grid, dockview's (panels, splits, drag and drop, saving it: its API
  before layout code of our own; themed by its variables, never its rules where a variable does it), the terminal,
  xterm's. Tooltips are the native `title`: drawn above the profiles' pages, where an HTML one would be under them.
- **Every animation of our own stops with reduced motion** (`motion-safe:`, `motion-reduce:`).
- Before using a part new to the window, read its page in the documentation for agents: Vue's
  (`https://vuejs.org/llms.txt`, 3.5), Reka UI's (`https://reka-ui.com/llms.txt`; its API the installed `.d.ts` in
  `node_modules/reka-ui/dist/`); official sources only, no community skills or MCP servers (the author's choice).

**The profiles' pages are native views, drawn above the window's HTML**: HTML over a pane is under its page. Every menu
and dialog opens through `covered()` (`lib/cover.ts`; the pages under it: `lib/views.ts`), which hides the pages or
puts pictures of them in their place, and puts them back however it closes; while a panel is dragged, pictures stand in
too. The renderer sends each pane's page box (`data-testid="page"`, or that it is off screen) to the main process after
every grid change (docs/window.md).

| Where | What |
|---|---|
| `src/renderer/components/` | the window's parts: `App.vue` a tasks' window; `grid/` the grid's panels; `menu/` the menus and ☰'s rows; `Modal.vue`, `Ask.vue` the dialogs; `marks/` our icons; `ui/` shadcn-vue's; the clusters (below) |
| `src/renderer/lib/` | what parts share or what outlives a component: `store.ts` (what the main process sends, `act`), `grid.ts`, `terminals.ts` (the terminal itself is `src/terminal/`), `menu.ts`, `agents.ts`, `ask.ts`, `dialogs.ts`, `keys.ts`, `cover.ts`, `views.ts`, `profiles.ts`, `names.ts`, `strip.ts`, `theme.ts`, `common.ts`, `test-hooks.ts` (what the tests reach by name) |
| `src/shared/types.ts`, `ipc.ts`; `env.d.ts` | the shapes the main process sends and their channels (docs/window.md, IPC), which type the bridge (`src/preload`); Vite's types |
| `src/renderer/app.css` | Tailwind, shadcn-vue's theme as its CLI writes it, and what utilities cannot reach: the icons' size, the scrollbars, dockview's variables, the slide between tasks |
| `index.html`, `main.ts`; `settings.html`, `settings.ts`; `master.html`, `master.ts` | a tasks' window's page, Settings' and a master's: the theme before the first paint, then the app. Settings' loads nothing of a tasks' window but `cover.ts` and the terminal |
| `src/renderer/public/avatars/` | the profiles' pictures, copied as they are |

## Desktop, not a web page

Kulisa is an IDE, and looks like one, JetBrains' Settings its model: no big titles, paragraphs, pills or rows that show
their buttons under the pointer, which read as a web page's. The one pill: the closed profiles' buttons over the
terminal (`ClosedProfiles.vue`), seen only while no profile is open, to draw the eye.

- **Geist at 14 px**, bundled (`@fontsource-variable/geist`), so the window looks the same on every OS; the terminal
  JetBrains Mono.
- **Two text sizes** (`text-sm`, `text-xs`), two weights: weight and color carry what matters. The one exception, the
  welcome's slides' titles (`text-4xl`), the one place that speaks to a new user.
- **One scrollbar everywhere** (`app.css`), a thumb on no track; a strip of tabs has none.
- **Every object has a right-click menu with all its actions** (a profile's pane, a task's tab, the terminal), so the
  window shows one or two buttons. No swipes (a touchpad's sideways swipe is the OS's and the pages' back), no
  double-click as the only way to anything (nobody sees it).
- **A dialog asks one thing**; what is browsed (Settings, a window of its own: [window.md](window.md)) is a nav on the
  left (`Sidebar`) and a page on the right under its path (`Breadcrumb`, `settings/PageHead.vue`), a page a column of
  `Card`s, a group each. No search over the nav (the author's choice).
- **A form is `Field`s**, the label over its field, a `FieldDescription` only when needed.

## Colors

shadcn-vue's theme (`app.css`), through its utilities (`bg-background`, `text-muted-foreground`, `text-destructive`).
Where it has no meaning, Tailwind's palette, one color a meaning everywhere: the agent `blue-500` (its marks in the
pages too, `ghost.ts`), waiting for the human `amber-500`, done `green-500`; a project's own color `--project` (the
logo's, `lib/store.ts`). JS reads a color as shown, through an element that uses it (`src/terminal/renderer/`).

## Icons

Lucide's (`@lucide/vue`), imported where used: `<XIcon />`, chosen by the name Lucide gives the meaning, the same icon
for a meaning everywhere (an agent's states: `STATE_ICONS`, `lib/agents.ts`). 16 px unless a utility sizes it. What
Lucide has not is ours, `components/marks/`, an `<svg data-icon>` each: the app's curtain (`LogoMark.vue`), the agents'
marks in their makers' colors (`agentMark`; not under the GPL: `docs/LICENSING.md`), GitHub's. Pictures are no icons
(☰'s arrangements, the profiles' pictures). The test `icons: …` (`test/e2e/window.spec.ts`) checks every other `<svg>`.

## Components

What is `hidden` is off the screen, whatever `display` a component sets; tests check `checkVisibility()`, not the
attribute.

- **Buttons**: `Button`: a form's main action `default`, last; the others `outline`; an icon alone `ghost`
  `size="icon-sm"` with an `aria-label`. In a form, one that does not submit is `type="button"`. A command's key ends its
  tooltip: `withKeys('Reload', 'tab.reload')` (`lib/common.ts`), as Chrome's. A Kulisa package's button is the
  window's, given its attributes and handlers by a slot (the microphone, `TerminalTabs.vue`).
- **Rows**: `Item` (`size="xs"`) named by its title alone; its state a `Badge` ("default", "no git"). A list to act on
  is a `Listbox` of them in a `Card`, its toolbar the `CardAction` (+ adds, − removes the selected row, ★ makes it the
  default), Delete and the row's right-click acting on the selected row; `Empty` when it has none.
- **Choices**: one of a few words `Select`; of pictures a `Popover` with a `ToggleGroup`; filters, one always chosen,
  `ToggleGroup`; one of a few described things `RadioGroup` cards (`AgentList.vue`), never for a list's default (its
  "default" and ★); a few big choices on a dialog's left vertical `Tabs`; on/off `Toggle` (Pick); on demand
  `Collapsible` (Details); steps `Stepper` (New Project's).
- **Tabs** (the tasks', a pane's, a terminal's) are `Tabs`, `activationMode` manual: chosen on the press, as a browser's,
  one Tab stop for the strip; × on every tab, always. A strip that does not fit is `no-scrollbar scroll-fade-x
  scroll-px-10 overflow-x-auto` with `useStrip` (`lib/strip.ts`), the same for every strip: the wheel scrolls it
  sideways; an edge with tabs past it fades; the active tab is brought into sight only when another is chosen or the
  strip resized, so an update leaves it where the human scrolled it.
- **An agent's state** (`AgentState.vue`, by `data-state`): an icon each, as color is not everyone's sign; nothing while
  nothing asks for the human.
- **The sidebar** (`ProjectsSidebar.vue`): docked in the empty window; over the grid in a `Sheet`, as offcanvas would
  push the grid aside ([window.md](window.md), The sidebar).

### Dialogs

Every dialog is `Modal.vue` (`Dialog`): its title, the content, the buttons in the footer, the main one last.

```html
<Modal id="…" title="Title" class="sm:max-w-xl">
  …the content…
  <template #footer><DialogClose as-child><Button variant="outline">Cancel</Button></DialogClose><Button>Create</Button></template>
</Modal>
```

- `closable`: ×, Esc and a click outside close it; `stay`: not while something runs.
- No taller than the window: the content scrolls. One that keeps a height sets it, `min(…, 85vh)`.
- A form is the content's `<form id>`, its submit button in the footer by `form="…"`, so Enter submits; the main
  process's refusal is the field's `FieldError`.
- Its content is in the page only while it is open (kept, the dialogs' parts take about 2.5 MB), so `await open()`
  first, then fill it; what outlives it is in its component or `lib/`. `open()` puts the keyboard in its `[autofocus]`;
  closing gives it back where it was. Fading out it still holds the keyboard: what takes the keyboard meanwhile keeps it
  (`closing`, `keepTaken`, `lib/cover.ts`).
- Each is in `App.vue` and registers itself (`registerDialog`); anything opens one by name, `(await
  dialog('newproject')).open()` (`lib/dialogs.ts`). Settings is a window: `openSettings(section, id)`.
- A question before what cannot be undone, before closing, or between two ways is no new dialog: `shell.ask` (main
  process) or `ask(q)` (`lib/ask.ts`) → `Ask.vue` (`AlertDialog`): the main button red when it deletes (`danger`),
  `other` a second way's button before it, `link` a page the answer may need. Cancel has the keyboard; a click outside
  does nothing.
- A page's alert or confirm (`ProfilePane.vue`) is a non-modal `Dialog` in its pane under the address bar, as Chrome's:
  the other panes go on.
- New Project's steps end with their buttons, Back at the left end; what is saved as it changes (Settings) has none.

### Menus

`DropdownMenu` and `ContextMenu`, the rows built as one opens: a button's (`ButtonMenu.vue`; `end`: aligned to its end
edge), an area's right-click (`RightClickMenu.vue`: `items(e)` the rows, or `null`), one at a point (`menuAt(e, items)`,
`lib/menu.ts`: a link in the terminal).

- `ButtonMenu` opens on the press, so press, drag and release on a row chooses it, as the OS's menus. Rows are chosen
  with the left button only: on Linux a right-click menu opens on the press, and its release must not choose.
- One at a time. Esc, a press outside, a chosen row or leaving the window closes it, the keyboard going back
  (`focusBack`). Leaving is the window's blur from the main process, not its page's: a page taking the keyboard as it
  loads (macOS) would close it under the hand; Settings' window goes by its page's. The keyboard moving inside the window
  does not close it.
- Reopened while fading out, it takes no keyboard (`leaveClosing`).
- While one is open the pages are pictures (`covered('pictures')`); it shows once they are (`data-ready`).
- Items (`lib/menu.ts`, laid out by `MenuRows.vue`): `{ label, sub, keys, title, icon, avatar, enabled, run }` a row,
  named by its label alone; `'-'` a divider; `{ heading }`; `{ submenu, items }`; `{ component, props }` a row of its
  own, ☰'s (`components/menu/`; its choices side by side, `ChoiceRow.vue`, leave it open).
- What a menu cannot hold (rows that take keys) is a `Popover`, the pages pictures meanwhile (a profile's pictures). A
  row that opens a field gives it the keyboard with `focusAfterMenu(el)`: the menu, closing, would give it back to its
  button.

## Clusters

A part of several files with a state of its own is a folder of `components/`, reached from outside only through its
entries (`clusters` in `.dependency-cruiser.ts`: a new cluster is a line there). Its state is a module in it, given to
its files by `provide`/`inject`, not in `lib/store.ts`; what it shares with the window (`Modal.vue`, `lib/`) stays
outside; its actions are the core's, over IPC (CLAUDE.md, "One core"). A single component is no cluster.

| Folder | Its entries | What |
|---|---|---|
| `settings/` | `Settings.vue` | Settings' window |
| `newproject/` | `Wizard.vue`, `NewProject.vue` | New Project's steps (`wizard.ts` their state): the dialog's and the welcome's |
| `welcome/` | `Welcome.vue` | the first start: three slides (`Tour.vue`), then New Project's steps under its questions |

New Project's steps are one form, a step at a time: a step done is gone back to from the `Stepper`, the next one only by
Next, which checks this one. Another view of them takes `Wizard.vue`, never a copy (the welcome: its `head` slot,
`leavable`).
