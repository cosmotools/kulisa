# Task view

Retained task UI and native attachment. Core owns [resources/storage](../../docs/tasks.md),
[window selection, global overlays and sender authorization](../../docs/window.md).

## Ownership and native lifetime

The package owns the UI WebContentsView, its View group, ready/drain/recovery, placement and local coverage/capture.
Profile containers and native previews must be siblings of the UI: nesting browser WCVs under it caused black panes
on Linux Wayland. Moves retain UI/PTY/profile identities. Explicitly close webContents; destroying the group is insufficient.

`TaskViewHost` supplies core facts, eligible native pages and callbacks; resolve the task's current window after
transfer without retaining the source. Attachment registration identifies ownership, never grants cross-task authority.
Ready sends initial facts/preferences before process startup/output; URL facts only seed paint. Hidden tasks retain
UI processes with default background throttling; activity pauses UI polling while core autosave/terminal service continue.

## The grid

Core sizes retained groups from shell CSS workspace bounds without waiting for hidden renderers. Profile placement
uses task-local CSS coordinates and UI zoom; revision/dimension checks reject stale resize/zoom/transfer reports.
Native pages wait for valid placement, while the UI stays visible for its first layout. Prepared groups swap in one turn.

Nested Dockviews use explicit parent layout. Include Workbench's edge group in its outer minimum: Dockview excludes
edges from the central minimum. Preserve the observable outer host and observe edge dimensions as well as central
layout events, so hidden resizes and Side bar changes reach the retained grid. Keep the terminal-fit timer fallback
when animation frames are suspended.
Proportional layout requires Dockview >= 8.6.0 (issues 1691/1692).

Restore settings before constructing grids; early Stage commands await restoration in order. Reveal only after both
grids mount at final dimensions. Retain/reflow grids on window moves and flush layout on deactivation/close.
Keep Dockview IDs stable and prune closed panes without losing active groups; core owns saving. Only the current
saved layout format is supported.
Workbench disables panel dragging and has fixed panels: rebuild them with Dockview APIs, restoring only Side bar
width/collapse/visibility. Core supplies the selected Workbench item once; do not also save it in a panel layout.
Empty Stage stays mounted through Gridview's visibility API to retain size; move panels/groups without replacing content.

Overflow uses Dockview's aggregated group minimums on the scroll canvas, not a pane count. Apply constraints before
layout; suspend overflow while maximized and retain its setting in Tabs. Clip native pages in parent Views without
shrinking child viewports; remove clipping on full visibility, close or move. Always restore Stage headers as visible.

Capture without hiding, paint decoded snapshots before hiding native pages, then restore natives before removing
snapshots. Scope captures/delayed visibility commands to their task; successive menus retain prepared images.
Adaptive deadlines keep missing frames from blocking menus. Core's `ArtifactViewer` supplies native PDF access/eligibility.

Preserve address drafts through unsolicited native focus; cancel for another field or a human press in a focused page,
not unfocused automation. Window `overflow: clip` keeps offscreen panels' `scrollIntoView` from shifting the grid.

## Pane registration

Terminology belongs to [UI](../../docs/ui.md#stage-and-panes). `renderer/stage-panes.tsx` registers built-in pane
kinds through `StagePaneKind` in `renderer/pane-contract.ts`; it supplies membership, components and launchers to the grid.

| Owner | Responsibility |
|---|---|
| `browser-pane.tsx`, `ProfilePane.tsx`, `profiles.ts`, `pages.ts` | Browser pane/header, launchers, caption/command adapters and native placement |
| `terminal-pane.tsx`, `StageTerminalPane.tsx`, `stage-terminal-focus.ts` | Application terminal pane/header, launchers and cancellable human launch focus |
| `DevelopmentTerminals.tsx`, `terminals.ts` | Workbench agent/working-terminal surface and its shared visible View |
| `stage-panes.tsx`, `stage.ts`, `grid.ts`, `controller.ts` | Registration, membership, grids, overflow and activity/Follow routing |

Browser/Terminal own the shared runtimes, also used by sign-in windows. Core `Task`, `ProjectProfiles`,
`StageTerminals` and `AppWindow` retain resource ownership, persistence, checks, native attachment and cleanup.
These pane adapters consume Task view's state/actions; extracting `browser-pane`/`terminal-pane` packages requires
narrow host contracts, with the shared runtimes remaining independent. Agent CLI code stays in the Kulisa plugin.

To register another pane kind:

1. Supply a unique kind/component, pane/header components and `panes(state)` returning stable IDs and current titles.
   Preserve `profile:<id>`/`stage-terminal:<id>` IDs and `profile`/`stage-terminal` component names: Dockview stores them.
2. Supply tile/strip launchers and their order. Add the descriptor to `stage-panes.tsx`; task UI composition and
   empty-Stage checks then include its panes. Shell launchers still need an adapter in `renderer/lib/task-summary.ts`.
3. Report `stage:activity` with the pane ID, or use `bind(host)` to adapt runtime events once per task page. The host
   resolves the current grid and ignores other tasks/closed panes. Do not retain a grid/native window in listeners.
4. Add `command` and `layout` only when needed. Commands call task-scoped core actions. Native placement uses
   core-owned surface IDs; core validates/scales/clips it. Main native integration still needs a `TaskViewHost` adapter.
   Browser address/Pick handles stay browser-specific. Capability-specific agent tools stay in the Kulisa plugin.

Removing/hiding a pane's UI must not stop its processes. Explicit Close and task/project teardown call core cleanup
independently of renderer disposal. Browser and terminal rules remain in [Profiles](../../docs/profiles.md) and
[Window](../../docs/window.md#stage-terminals); renderer-loss limits remain in #399. A Telegram pane (#442) can use
this registration without moving its privacy, credentials, input/capture or bot-process lifecycle into the grid.
Its pane close and bot-process stop remain separate actions.

## Layout and drawing constraints

Keep overlays below Dockview separators and menus above them. Side bar lists scroll through `SidebarContent`;
Project/Diff own virtualized scrolling without duplicate region wrappers. The profile notch in `ProfilePane.css`
needs custom concave geometry outside shadcn shapes. Narrow panes move Back, Forward, Reload into the menu in that
order; Pick and the menu stay reachable. Other controls follow [UI rules](../../docs/ui.md).
Activity bar selection remains highlighted independently of Dockview group focus.

## Task rendering failures

Construct grids inside the React boundary; subscribe only after commit, since React can abandon render. Failure
releases UI resources but retains terminal buffers, PTYs and profiles. Core latches failure and hides native pages
even after delayed placement or transfer. React failure does not automatically remount.

The shell's Reload task screen works independently of task JS and Chromium's conditional hang detection. Recovery
retains Task, agents/profiles and core-accepted Editor work; terminal screens reconstruct from future output without
replay. Retained PTYs alone do not ensure CLI progress: [terminal limits](../terminal/README.md#the-window-renderer) (#399).
Drain healthy UI layout/Editor work for at most one second; failed UIs cannot delay closure. Core flushes accepted
edits and disposes resources on close. Responsive recovery requests fresh placement; explicit reload waits for process
exit before its new ready handshake.

## The code

- `main/task-view.ts`: native attachment/lifetime and ready/drained handlers under core IPC authority;
  `ipc.ts`: UI contracts; `shared/layout.ts`: saved-grid types, format checks and pruning.
- `renderer/controller.ts`, `grid.ts`, `stage.ts`, `development.ts`: activation, composition and Editor/Diff sessions;
  `state.ts`: core projection; pane components: content bounds; `Artifacts.tsx`: File Viewer host.
- `renderer/stage-panes.tsx`, `pane-contract.ts`, `browser-pane.tsx`, `terminal-pane.tsx`: built-in pane registration,
  membership and adapters.
- Core adapter: `src/main/window.ts`; authorization: `src/main/app.ts`.
