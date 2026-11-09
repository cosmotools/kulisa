# The window's UI

Kulisa-specific UI rules and integration constraints. Component APIs and composition patterns come from the
development skill required by [AGENTS.md](../AGENTS.md#implementation). Window lifecycle and native-page geometry:
[window.md](window.md); generated components: [src/ui](../src/ui/README.md).

## Workbench terminology

Use these names for the task's development UI (the author's choice). Workbench and Stage are sibling areas;
Workbench contains three adjacent parts, not three nested containers:

| Name | Meaning |
|---|---|
| Workbench | The whole development area: Activity bar, Side bar and Main pane. |
| Activity bar | The vertical strip for choosing Agents, Project, Diff or Artifacts; dictation sits below these choices. |
| Activity bar item | One of those navigation buttons, such as Project. |
| Side bar | The collapsible pane showing the selected Activity bar item's agents, project tree, changed-file tree or artifact tree. |
| Side bar item | An entry inside that pane: an agent, folder, file or artifact. |
| Main pane | The selected Activity bar item's content. |

Append **item** to the containing bar's name when referring to a particular button or entry. Use its visible
name when useful: “Project Activity bar item” or “the agent's Side bar item”.
Name Main pane content directly: terminal, code editor or Diff review.

The navigation relationship is Activity bar item → Side bar items → selected content. Selecting an Activity bar
item restores its Main pane; collapsing the Side bar leaves it selected. Project text files open in its code editor;
other project files open in the system app. Artifacts select a read-only text/PDF/image preview with system opening available;
unsupported formats show a fallback. Owners: [Editor](../src/editor/README.md), [File Viewer](../src/file-viewer/README.md).
The code surface uses JetBrains-style syntax palettes (the author's choice); its controls retain the neutral
window theme. Its palettes and keyboard behavior belong to Editor.
Keep Workbench's Side bar distinct from the window's **project sidebar**, which lists projects and tasks.

Layout and lifecycle: [window.md](window.md#the-grid); item actions and saved state: [tasks.md](tasks.md#the-workbench).
`Resources` in existing component names and `resources` layout identifiers refer to the Activity bar and Side bar;
task resource folders are a separate domain concept.

## shadcn in Kulisa

These integration rules take precedence over generic skill instructions:

- Run read-only CLI commands from the checkout root with the pinned
  `node node_modules/shadcn/dist/index.js <command>`, including `info --json` and `docs <name>`.
  Do not substitute a freshly downloaded CLI. Generate or update components through the
  [repository generation workflow](../src/ui/AGENTS.md#generation).
- Outside `src/ui`, import only through `@ui`. Registry aliases reported by `info` describe generated internals;
  they do not replace this public entry.
- Put shared window theme variables in `src/renderer/window.css`. Package-owned drawing palettes stay in their
  package and are scoped to its drawing. The CLI reports `src/ui/theme.css`, which is generated
  base styling; do not put application overrides there. Callers use layout/size classes, variants and custom
  properties; custom drawings/layout use wrappers, with their reasons documented by the owner.
- Use neutral shadcn styling, bundled Geist and JetBrains Mono. Native drawings use `termStyle()`;
  theme propagation/first paint belongs to [window.md](window.md#theme).
- Kulisa's warning/success colors are theme variables. Brand marks are the color exception: the original red
  `assets/icon.svg` goes through `AppLogo`; projects keep their own identity color.
- Lucide is the icon library; maker marks (`AgentMark`), logo/project icons, avatars and file-type icons are
  exceptions. The Side bar uses `text-sm` for filenames/messages/controls and `text-xs` for captions/status metadata.
- Keep CSS Modules and additional UI libraries out. Standalone CSS needs an owning explanation; see
  [custom drawing](#own-drawing). ESLint checks shipped-control styling, theme colors, raw form controls,
  hook rules and the Fluent UI exclusion; React Compiler memoization rules are not enabled.

## Clusters

A window UI cluster owns one screen or closely related set of views: its state, private components and assets
stay together behind an explicit entry. Shared non-UI coordination stays in `lib/`; application/core actions
remain in their owning layer. A cluster is part of the window, distinct from a [Kulisa package](packages.md).

Document lifecycle, boundaries and exceptions in the cluster's README. Keep detailed screen behavior there and
leave links here. Dependency-cruiser protects public entries and keeps non-UI logic independent of components.

| Owner | Responsibility |
|---|---|
| `components/App.tsx`, title/tasks' bars, sidebar | Window frame and navigation; [window.md](window.md) |
| [welcome](../src/renderer/components/welcome/README.md) | First-start introduction, example drawings and their shared animation |
| [Settings](../src/renderer/components/settings/README.md) | Lazy settings UI and shared page controls |
| [task-view](../src/renderer/task-view/README.md) | Retained task screens, grids, Workbench and pane drawings |
| [Projects](tasks.md#projects) | Project creation, membership and setup behavior |
| `components/Menus.tsx`, `lib/menu.ts`, `lib/dialogs.ts`, `lib/ask.ts` | Shared menus, dialog registration and questions |
| `lib/store.ts` | Window state; components use `useWindow(selector)`, other code uses `store.getState()` |
| `src/renderer/window.css`, `public/theme.js`, `lib/theme.ts` | Theme and first-paint application |
| `src/shared/`, `env.d.ts` | Main/renderer contracts and bridge |
| `src/*/renderer/` | Kulisa package UI, documented by each package |

Window/master HTML and scripts live under `src/renderer/`; profile pictures come from bundled Noto Emoji avatars
in `public/avatars/`. The window has no second router or UI framework.

## Layers over the pages

`lib/cover.ts` observes Radix layers; individual dialogs/popovers do not manage native browser views themselves.

- Dialog, AlertDialog and Sheet overlays hide native pages and take window-page keyboard focus. A popper/menu
  opens over pictures of the pages only after they are ready (`lib/cover.css`, `[data-ready]`). A tooltip is not
  a covering layer.
- Settings covers without a Radix overlay: its owner calls `coverPage(true)` after drawing the cover and releases
  it with `coverPage(false)` on cleanup, avoiding an empty frame between native pages and Settings.
- Task changes close all layers; leaving the native window closes menus. Use `closeLayers` and Radix's Escape
  handling. Dialog content remains mounted through exit animations; focus handoffs wait for removal.

## Desktop behavior

- Use flat Dockview panes and compact rows. Keep project color on its icon/title logo (`--project`, the author's choice).
  The sidebar docks in the empty window and uses a Sheet over tasks without resizing the grid.
- Objects have complete right-click menus and one or two visible actions. Avoid swipe or double-click-only actions.
- Labels/buttons remain unselectable; fields, errors (`data-selectable`) and review code allow selection. Controls
  use arrow cursors. The window itself never scrolls; its parts own scrolling.
- Agent state has distinct `AgentState` icons as well as color. Explain controls with field descriptions,
  tooltips and concise empty/status messages.
- Success toasts belong only in Settings, where native pages cannot cover them; placement belongs to the
  [Settings UI](../src/renderer/components/settings/README.md#page-controls).
- Fit 640 × 400 and 200% zoom. Bound dialog bodies and preserve reachable actions when the body scrolls.

## Tooltips

Use `Tip` only where it cannot overlap a native page: title/sidebar/dialogs/Settings and suitable tasks' bar
buttons. Pane controls, Activity bar, Side bar, master bars, list rows, clipped text and log lines use native `title`:
native views cover HTML tooltips, and per-log-line components cost memory.

Disable tooltip hoverability. Crossing into a native page stops window pointer events and can leave Radix's
grace area open. Give a dialog initial focus on itself if its first control has a tooltip, so Escape reaches
the dialog. `withKeys` appends the shortcut; disabled controls receive no pointer events or tooltips.

## Menus

`components/Menus.tsx` owns the window's shared DropdownMenu wrappers: `ButtonMenu` for buttons, `RightClickMenu`
for areas, and `menuAt`/`PointMenu` for positions. Use this single point menu; a fixed menu inside Dockview can be
clipped by panels. ContextMenu is not the window's menu implementation. An isolated part may own its Radix menu
(`ChoiceRow`, `TopBar.tsx`). Native profile-page menus are separate: [window.md](window.md#menus).

- Press/release behavior matches the OS: a press followed by dragging and release selects a row. Rows accept the
  left button only; Linux right-click opens on press and its later release must not choose a row.
- Only one menu is open, nonmodal: a press outside closes it and acts there, including opening the next menu.
  Native-window blur closes it. Check current `window:focused` state because renderer focus/blur can lag the OS;
  a stale notification must not close a window that has focus again.
- Closing restores the opener's focus, except when another menu now owns it. Remove menus immediately rather
  than fading them: a fading layer can steal focus and the next Escape from a dialog opened by its row.
- Draw only after native-page pictures are ready; `[role="menu"][data-ready]` is the tests' handle.
  Submenu padding participates in Radix's available-height limit so long lists stay scrollable inside the window.
- Build rows as `MenuItem`s from `lib/menu.ts`. A row's accessible name is its label alone, including when a
  shortcut/icon is also shown.

## Dialogs

Task-window dialogs are mounted by App and register commands through `registerDialog` in `lib/dialogs.ts`;
callers open them by name. Content mounts only while open. State that must outlive content belongs to the
dialog's owning module or shared store; installation continues after its controls unmount.

A dialog awaiting an answer rejects outside clicks and ×; Escape cancels it. Queue questions through `ask`
or core `shell.ask` in the action's window, using AlertDialog. Settings is a separate view opened through
`openSettings`; see its [owner](../src/renderer/components/settings/README.md).

Profile-page alert/confirm is positioned in that pane under its controls rather than over the whole window,
so other panes remain usable and the pane keeps the keyboard. See [page dialogs](profiles.md#page-dialogs).

## Tabs

`BrowserTabs.tsx` adapts shadcn Tabs for browser-like task/profile navigation. Choose on press, keep × on every
tab, and let it handle its own click without selecting the tab. The nested close target is a `role="button"`
span because TabsTrigger is already a button.

Task tabs keep their width across selection so neighbors do not move under the pointer. Profile tabs shrink to
icon and ×, sharing a 32 px row with navigation controls. Editing the address occupies the tabs/+ area while the
strip stays mounted. Development terminals switch through Agents Side bar items instead.

`lib/strip.ts` shrinks overflowing strips, then scrolls them sideways without a scrollbar. The mouse wheel scrolls;
`data-past-start`/`data-past-end` fade hidden edges. Reveal the selected tab only after selection, growth or resizing:
title/loading/state updates must preserve the human's scroll. The Web Animations opening effect grows tabs;
reduced motion disables it. This behavior also serves closed-profile strips above terminals.

## Own drawing

Prefer upstream components for their normal jobs. The remaining custom surfaces have specific owners and reasons:

| Surface | Reason and owner |
|---|---|
| Dockview grids, profile notch, narrow-pane controls | Native-page geometry and profile identity; [task-view](../src/renderer/task-view/README.md) |
| Browser tabs and scrolling strips | Close targets, width stability and reveal policy; [Tabs](#tabs) |
| Diff loading indicator | Transform-only motion without layout work; [Diff](../src/diff/README.md) |
| File viewer toolbars | Scoped controls for search and image viewing, with colors supplied by the host theme; [File Viewer](../src/file-viewer/README.md) |
| Dictation pill/wave | Live microphone data and recording lifecycle; [dictation](../src/dictation/README.md) |
| Settings frame and log output | Window-wide navigation and plain-text logs; [Settings](../src/renderer/components/settings/README.md) |
| Welcome examples and characters | Coordinated demonstration without live environments; [welcome](../src/renderer/components/welcome/README.md) |

## Artifact tree

The [Task Files package](../src/task-files/README.md#tree) owns the Trees view, row layout and previews.
Workbench supplies controls, captions and shared menu/action callbacks. Storage: [tasks](tasks.md#artifacts-and-temporary-files).
