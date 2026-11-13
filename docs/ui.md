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

## Stage and panes

**Stage** is the task's application testing area, containing browser and application-terminal panes.
A **pane** is an individual UI container displaying a browser profile, an application terminal or Workbench content.
A task can show several panes of each kind together; opening one kind does not limit which others can be opened.
Coding-agent terminals belong to Workbench. Stage's grid and pane lifetime belong to [Task view](../src/task-view/README.md).

## shadcn in Kulisa

These integration rules take precedence over generic skill instructions:

- Run read-only CLI commands from the checkout root with the pinned
  `node node_modules/shadcn/dist/index.js <command>`, including `info --json` and `docs <name>`.
  Do not substitute a freshly downloaded CLI. Generate or update components through the
  [repository generation workflow](../src/ui/AGENTS.md#generation).
- Outside `src/ui`, import only through `@ui`. Registry aliases reported by `info` describe generated internals;
  they do not replace this public entry.
- Put shared page theme variables in `src/appearance/renderer/page.css`, shell transparency in `src/renderer/window.css`.
  Package drawing palettes stay scoped to their drawing. The CLI reports generated `src/ui/theme.css`;
  do not put application overrides there. Callers use layout/size classes, variants and custom
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
remain in their owning layer. A cluster is part of the window; shared shell/task capabilities are
[Kulisa packages](packages.md#the-kulisa-packages).

Document lifecycle, boundaries and exceptions in the cluster's README. Keep detailed screen behavior there and
leave links here. Dependency-cruiser protects public entries and keeps non-UI logic independent of components.

| Owner | Responsibility |
|---|---|
| `components/App.tsx`, title/tasks' bars, sidebar | Window frame and navigation; [window.md](window.md) |
| [welcome](../src/renderer/components/welcome/README.md) | First-start introduction, example drawings and their shared animation |
| [Settings](../src/renderer/components/settings/README.md) | Lazy settings UI and shared page controls |
| [Projects](tasks.md#projects) | Project creation, membership and setup behavior |
| `lib/dialogs.ts`, `lib/shell-ask.ts` | Shell dialog registration and questions; shared menus use their package entry |
| `lib/store.ts` | Shell navigation, selected-task summary and core projection; shared preferences belong to [Window client](../src/window-client/README.md) |
| `src/renderer/window.css`, `public/theme.js` | Shell transparency and first-paint theme application; shared styles use Appearance |
| `src/shared/`, `env.d.ts` | Main/renderer contracts and bridge |
| `src/*/renderer/` | Kulisa package UI, documented by each package |

Profile pictures come from bundled Noto Emoji avatars in `public/avatars/`.

## Layers over the pages

[Layers](../src/layers/README.md) owns DOM observation/readiness and keyboard zones. Shell/task supply native coverage;
see [window ordering](window.md#native-ownership) and [local snapshots](../src/task-view/README.md#the-grid).

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
native views cover HTML tooltips, and per-log-line components cost memory. Shell bar tooltips stay horizontally
inside their bar: the task UI's native group covers the entire workspace, including its HTML pane headers.

Disable tooltip hoverability. Crossing into a native page stops window pointer events and can leave Radix's
grace area open. Give a dialog initial focus on itself if its first control has a tooltip, so Escape reaches
the dialog. `withKeys` appends the shortcut; disabled controls receive no pointer events or tooltips.

## Menus

Use [Menus](../src/menus/README.md) for shared button/area/point menus; callers supply rows/actions.
Native profile-page menus remain separate ([window](window.md#menus)).

## Dialogs

Window-modal dialogs are mounted by the shell App and register commands through `registerDialog` in `lib/dialogs.ts`.
Shell callers open them by name; task controls use core-routed `shell:dialog` requests. Content mounts only while open.
State that must outlive content belongs to the dialog's owning module or shared store; installation continues after
its controls unmount.

A dialog awaiting an answer rejects outside clicks and ×; Escape cancels it. Queue questions through `ask`
or core `shell.ask` in the action's window, using AlertDialog. Settings is a separate view opened through
`openSettings`; see its [owner](../src/renderer/components/settings/README.md).

Profile-page alert/confirm is positioned in that pane under its controls rather than over the whole window,
so other panes remain usable and the pane keeps the keyboard. See [page dialogs](profiles.md#page-dialogs).

## Tabs

[Tab strip](../src/tab-strip/README.md) owns browser-style selection, close targets, overflow and growth.
Shell/task callers supply their own actions; development terminals use Agents Side bar items instead.

## Own drawing

Prefer upstream components for their normal jobs. The remaining custom surfaces have specific owners and reasons:

| Surface | Reason and owner |
|---|---|
| Dockview grids, profile notch, narrow-pane controls | Native-page geometry and profile identity; [task-view](../src/task-view/README.md) |
| Browser tabs and scrolling strips | Close targets, width stability and reveal policy; [Tabs](#tabs) |
| Diff loading indicator | Transform-only motion without layout work; [Diff](../src/diff/README.md) |
| Dictation pill/wave | Live microphone data and recording lifecycle; [dictation](../src/dictation/README.md) |
| Settings frame and log output | Window-wide navigation and plain-text logs; [Settings](../src/renderer/components/settings/README.md) |
| Welcome examples and characters | Coordinated demonstration without live profiles or terminals; [welcome](../src/renderer/components/welcome/README.md) |

## Artifact tree

The [Task Files package](../src/task-files/README.md#tree) owns the Trees view, row layout and previews.
Workbench supplies controls, captions and shared menu/action callbacks. Storage: [tasks](tasks.md#artifacts-and-temporary-files).
