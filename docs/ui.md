# The window's UI

What the window is built of: shadcn-vue's components in its theme, Tailwind's utilities, the icons, each defined once,
so every dialog, button and list looks and behaves the same. **Before making a button, an icon, a row or a dialog, look
here:** use the component, or add shadcn-vue's (`npx shadcn-vue add`) when nothing fits. Keep this file current.

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
however it closes; while a panel is dragged, pictures stand in too. The renderer sends each pane's page box (`data-testid="page"`; or
that it is off screen) to the main process after every grid change (docs/window.md).

| Where | What |
|---|---|
| `src/renderer/components/*.vue` | the window's parts, each its markup, behavior and own look (`<style>`, rooted at its id or class): `App.vue` puts a tasks' window together; `grid/` the grid's panels and headers, `menu/` the menus (`ButtonMenu`, `RightClickMenu`, `PointMenu`, `MenuRows`) and ☰'s own rows; `Modal.vue` the dialogs; the clusters (below): `settings/` Settings' window (`Settings.vue`, its pages `ProjectEditor.vue`, `AgentPage.vue`, `ProfilePage.vue`, `GitHubPage.vue`), `newproject/` New Project's steps |
| `src/renderer/lib/*.ts` | what parts share or what outlives a component: `store.ts` (what the main process sends, `act`), `grid.ts`, `terminals.ts` (a tasks' window's island; the terminal itself is `src/terminal/`), `menu.ts` (what a menu holds), `agents.ts` (the agents' list of a dialog, and an install under way), `ask.ts`, `dialogs.ts`, `keys.ts`, `cover.ts` (`covered()` for every menu and dialog: one menu at a time, all closed at once), `views.ts` (a tasks' window's profiles' pages under them: hidden, or pictures), `profiles.ts` (the profiles' menu), `names.ts` (name fields), `strip.ts` (a strip of tabs that scrolls), `common.ts`, `test-hooks.ts` (what the tests reach by name) |
| `src/shared/types.ts`, `ipc.ts`; `env.d.ts` | the shapes the main process sends, the channels they come by (docs/window.md, IPC); the bridge to it (`src/preload`) typed by them, and Vite's types |
| `src/renderer/app.css` | Tailwind, shadcn-vue's theme (its colors for both themes, as its CLI writes them), and what utilities cannot reach: the icons' size, the scrollbars, dockview's variables, switching tasks' slide |
| `src/renderer/index.html`, `main.ts`; `settings.html`, `settings.ts`; `master.html`, `master.ts` | a tasks' window's page, Settings' window's and a master's window's: the theme before the first paint, then the app. Settings' loads nothing of a tasks' window (no grid, no store of its tasks): `cover.ts` and the terminal (`src/terminal/renderer/`) are what the two share of `views.ts` and `terminals.ts` |
| `src/renderer/public/avatars/` | the profiles' pictures, copied as they are |

## Desktop, not a web page

Kulisa is a desktop app, an IDE: its window looks like one, JetBrains' Settings its model (not big
titles, framed cards, a paragraph each, pills and rows that show their buttons under the pointer: those read as a
web page's and are hard to read). The one pill: the closed profiles' buttons over the terminal (`ClosedProfiles.vue`),
the one place where a button is there to draw the eye, seen only while no profile is open. So:

- **JetBrains' UI font and size**: Geist (shadcn-vue's) at 14 px (a step above their UI Guidelines' 13, Typography: 13 reads small), bundled
  (`@fontsource-variable/geist`, `app.css`), so the window looks the same on every OS (the OS's own, on Linux Noto
  Sans, is wide and reads as a web page's). The terminal keeps JetBrains Mono.
- **Two text sizes** (`text-sm`, `text-xs`), two weights; nothing bigger. Weight and color carry what matters, not
  size. The one exception, the welcome (`welcome/`), the one place the window speaks to a new user rather than being
  worked in: its slides' titles `text-4xl`.
- **One scrollbar everywhere** (`app.css`): a rounded thumb on no track, no arrows, as JetBrains'
  (not the OS's, with arrows, in menus, Settings and dialogs). Chromium's `::-webkit-scrollbar`:
  the standard `scrollbar-color` and `scrollbar-width: thin` left the arrows. A tabs' strip has none
  (`scrollbar-width: none`): it scrolls by the wheel.
- **A form is shadcn-vue's `Field`s**, the label over its field; a comment under a field only when needed.
- **A page of Settings is a column of `Card`s**, a group each (a project's Folders, Agents, Profiles).
- **A list has a toolbar** (its card's `CardAction`: + adds, − removes the selected row, ★ makes it the default), and
  its actions act on the selected row (also Delete, and its right-click): Rows, below.
- **Every object has a right-click menu with all its actions** (a profile's pane, a task's tab, the terminal), so the
  window shows one or two buttons and the rest is in menus. Not swipes (a phone's gesture; on a laptop's touchpad a
  sideways swipe is the OS's and the pages' back and forward), nor a double-click as the only way to anything (nobody
  sees it; only a shortcut to a menu's item).
- **A dialog asks one thing and ends with its buttons** (`Modal.vue`); what is browsed (Settings, a window of its own:
  [window.md](window.md), Settings) is a nav on the left (shadcn-vue's `Sidebar`) and a page on the right, under its path
  (`Breadcrumb`, `settings/PageHead.vue`). No search field over the nav (the author's choice).

## Colors

shadcn-vue's theme (`app.css`: `:root`, `.dark`), nothing of our own: a part takes its colors from its utilities
(`bg-background`, `text-muted-foreground`, `border`, `text-destructive`). Where the theme has no meaning for it,
Tailwind's palette, one color a meaning everywhere: the agent `blue-500` (also its marks in the pages, `ghost.ts`),
waiting for the human `amber-500`, done `green-500`; a project's own color (`--project`, `lib/store.ts`: the logo's).
JS reads a color as shown through an element that uses it (`src/terminal/renderer/`), not the variable's text.

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

## Components

What is `hidden` is off the screen, whatever `display` its component sets (Tailwind's base). Tests check what is on
screen (`checkVisibility()`), not the attribute.

### Buttons

- shadcn-vue's `Button` (`components/ui/button`): the main action of a form `default`, last; the others `outline`; an
  icon alone `ghost` with `size="icon-sm"`, always with `aria-label` (or `title`). Inside a form, a button that does not
  submit is `type="button"`.
- A Kulisa package imports nothing of the window: its button is the window's, given its attributes and handlers by a
  slot (the dictation's microphone, `TerminalTabs.vue`).
- `:title="withKeys('Reload', 'tab.reload')"` (a command of `src/main/keys.ts`; `lib/common.ts`): its key at the end
  of its tooltip, "Reload (Ctrl+R)", as Chrome's toolbar says it.

### Rows

- A row: shadcn-vue's `Item` (`size="xs"`): `ItemMedia` (an icon, `ProjectIcon.vue`, an `Avatar`), `ItemContent`
  (`ItemTitle`, its facts in `ItemDescription`), `ItemActions` (a state as a `Badge`: "default", "no git"; a `Select`).
  Named by its title alone (`aria-label`).
- A list to choose a row of and act on (a project's Folders, Agents and Profiles, an agent's accounts, the GitHub
  accounts, New Project's folders): Reka's `Listbox` around the `Item`s (`ListboxItem as-child`), the selected one
  `bg-muted`. Delete removes the selected one; a `RightClickMenu` around its card's content has the row's actions (it
  selects the row). `Empty` when it has none.
- `ProjectIcon.vue`: a project's icon in its color (`--color`): its favicon or the curtain.

### Controls

The window's controls are Reka UI's, in this look:

- Fields: shadcn-vue's `Field`, `FieldLabel`, `Input`, `Textarea`, `FieldDescription`, `FieldError` (its text
  selectable, to copy and search for: `app.css`); `Checkbox` (New Project's agents and profiles, the log's Follow);
  choosing one of a few, its `RadioGroup` (the agents to choose from, `AgentList.vue`: its choice cards). Not for a
  list's default, whose rows are what the list is about: "default" at the row's end and ★.
- `Select`: one of a few words (a repository's GitHub account, `settings/RepoAccount.vue`); `Popover` with a
  `ToggleGroup`: one of a few pictures (a profile's, `settings/Avatars.vue`); `ToggleGroup` of words: the log's preset
  filters (`settings/LogPage.vue`), one always chosen.
- `Tabs` with `orientation="vertical"`: a few big choices on a dialog's left (New Project's code, as JetBrains' New
  Project).
- `Stepper`: New Project's steps; the welcome's a `Progress` and its question instead, as its slides' (`welcome/`).
- Tabs: a pane's tabs are Reka's `Tabs`, the tasks' tabs shadcn-vue's (`activationMode` manual): chosen on the press, as a
  browser's (not on their ×), one Tab stop for the strip, the arrows move and Enter chooses. A task's is shown on
  the release, or as its drag begins ([window.md](window.md), The tasks' bar).
- A strip of tabs that do not all fit (the tasks' bar, a pane's tabs, the closed profiles' buttons, the terminals' tabs) is
  `no-scrollbar scroll-fade-x scroll-px-10 overflow-x-auto` with
  `useStrip` (`lib/strip.ts`), one for every strip, so all scroll one way:
  no scrollbar; a mouse's wheel scrolls it sideways (Shift and a touchpad's swipe are the browser's: with Shift both
  would scroll, twice as far); an edge with tabs past it fades (`scroll-fade-x`; `data-past-start`, `data-past-end` say
  which); the active tab is brought into sight,
  clear of the fade, when another is chosen (`aria-selected`, Reka's) or the strip is resized, and only then, so an update
  (a title, a page loading, an agent's state) leaves the strip where the human scrolled it.
- `Toggle` (shadcn-vue's): a button that stays on (Pick).
- `Collapsible`: something shown on demand (Details, a link `Button` its trigger: an installer's output, an agent's
  sign-in's terminal).
- A profile's picture: `Avatar` with `AvatarImage` (`avatarSrc(name)` in `lib/common.ts`).
- A panel's tabs, a pane's (`ProfilePane.vue`: the page's icon, its title, ×) and a terminal's (`TerminalTabs.vue`: the
  agent's icon, its name, its state, ×), are shadcn-vue's `Tabs`, as the tasks' bar's; × on every tab, always; more
  than fit scroll.
- `AgentState.vue`: an agent's state by `data-state` (from its hooks), an icon each so that color is not the only sign
  (some people do not tell yellow from green): working (sparkles, pulsing; not with reduced motion), waiting for you
  (a bell), done (a check: come and see, until the human sees that task), in Tailwind's blue, amber and green; nothing
  otherwise, as nothing asks for the human then. On a task's tab and its row in the sidebar, on a terminal's tab.
- shadcn-vue's `Sidebar` (`ProjectsSidebar.vue`, its parts as its docs build one): docked (`collapsible="none"`) in
  the empty window; over the grid in a `Sheet`, as shadcn-vue's own on a narrow screen (`TopBar.vue`), because its
  offcanvas pushes the content aside and the grid keeps its width ([window.md](window.md), The sidebar).

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
- New Project's steps (`newproject/Wizard.vue`) end with their buttons, the main one last, Back at the left end. What is
  saved as it changes (Settings' window) has none: Esc or × closes it.
- What is added in place under a list (a URL to clone, a new profile's name): an `Input` with its buttons in a row.
- What is browsed (Settings' window, `settings/ProjectEditor.vue`): the nav on the left (`#pjlist`: a `SidebarGroup`
  each section, its rows `SidebarMenuButton`s with `data-project`, `data-agent`, `data-profile` or `data-page`, the
  shown one `aria-current="page"`; a section is no page, and makes one of its own with its `SidebarGroupAction` +
  (Agents, Profiles; a project is made in a tasks' window); a row's right-click has its page's ⋯), the chosen page on
  the right under its path ("Projects › shop", its ⋯ at the end). Each thing is a row of the nav with a page of its
  own, not a list inside a page. A name the nav cuts (…) is whole in its tooltip, and so is a list's row in a page;
  not a wider or resizable nav, as names past any width still come (two profiles alike to their 20th letter).
- Its ref: `await open()` (shown, the keyboard in its `[autofocus]` field or on it; the profiles' pages hidden while it
  is open: `covered('hide')`, `lib/cover.ts`, `views.ts`), `close()`, `isOpen()`. Its content is in the page only while it is open
  (Reka's default; kept closed, the dialogs' parts would take about 2.5 MB of the window's memory), so it opens first and
  is filled after; what must outlive it lives in the dialog's component or in `lib/` (the agents' list and an install
  under way: `lib/agents.ts`). When it closes, the keyboard goes back where it was.
- Every dialog is in `App.vue` from the start and registers what it does (`registerDialog`); anything opens one by
  name: `(await dialog('newproject')).open()` (`lib/dialogs.ts`). Settings is no dialog: `openSettings(section, id)`
  there opens its window.
- A page's alert or confirm (in `ProfilePane.vue`) is not a `Modal`: a Dialog that is not modal (the other panes go
  on), in its pane right under the address bar, over a dimmed picture of the page, as Chrome shows it. Esc is Cancel; a click outside does nothing; OK has the keyboard.
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

- `{ label, sub, keys, title, icon, avatar, enabled, run }`: a row (`MenuButton.vue`). `keys` the row's key at its end
  (`keyText(id)`, `lib/common.ts`); `title` its tooltip; `icon` a component (Lucide's or a mark). Named by its label
  alone (`aria-label`).
- `'-'` a divider; `{ heading, icon }` a label over rows.
- `{ submenu, items, project }`: a row opening a menu of its own at its side, its rows the same items (a task tab's
  menu holds its project's rows so, under its icon: `project`, `ProjectIcon.vue`).
- `{ component, props }`: a row of its own, ☰'s (`components/menu/`): zoom (− and + leave the menu open), theme and
  tasks' bar (`ChoiceRow.vue`: its choices side by side as shadcn-vue's Tabs show theirs, as no menu part does; they
  leave it open), language (a submenu of radio rows, its value at the row's end as its description,
  `aria-describedby`) and the arrangements, pictures of themselves.

### Panels

A panel is a `Popover` with what a menu cannot hold (its rows take the keys typed and the focus under the pointer), the
pages pictures meanwhile (`covered('pictures')`): a profile's pictures (`settings/ProfilePage.vue`).

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
| `settings/` | `Settings.vue` | Settings' window: the nav, a project's, an agent's and a profile's page, GitHub's |
| `newproject/` | `Wizard.vue`, `NewProject.vue` | New Project's steps (Code, Agents, Profiles; `wizard.ts` their state): the welcome's and the dialog |
| `welcome/` | `Welcome.vue` | the first start, no project at all: what Kulisa does in three slides (`Tour.vue`), then New Project's steps (`Wizard.vue`, its head a question each); the empty window's (`Empty.vue`) |

New Project's steps (`Wizard.vue`) are a form: the steps over it (a `Stepper`; the welcome puts its own head there, the
`head` slot), one step at a time, its buttons at its end (Back at the start, Cancel in the dialog, Next, Create last).
A step done is gone back to from the `Stepper`; the next one only by Next, which checks this one. A view of
them is one more cluster taking `Wizard.vue`, never a copy of the steps: the welcome is the dialog's steps under its
questions, `leavable` (Back on the first step goes back to its slides).

## Adding something

- A new icon: Lucide's, imported where used; one of ours only for what Lucide has not (Icons).
- A new kind of control or row: shadcn-vue's, added by its CLI (`npx shadcn-vue add …`), and a line here. A part used by one place only (a pane's tab strip, the omnibox,
  the projects' islands) keeps its look in its own `.vue` file.
- A new dialog: a component with `Modal.vue`, in `App.vue`, registered in `lib/dialogs.ts`; its content shadcn-vue's
  parts placed with Tailwind's utilities.
- Something generic (a menu, a dialog, a choice, a field): Reka UI's part, in Kulisa's look; never our own where Reka
  has one (above).
- A part's own CSS places the components, never restyles them into new ones. Before overriding dockview, check that
  its own variables or rules don't already do it.
