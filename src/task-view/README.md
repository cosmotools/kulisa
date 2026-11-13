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

## Scene registration

Stage previews applications; Workbench development terminals run agents and working shells. A task can open several
instances of each scene kind together. Neither surface owns the shared terminal emulator or PTY implementation.

| Owner | Responsibility |
|---|---|
| `browser-scene.tsx`, `ProfilePane.tsx`, `profiles.ts`, `pages.ts` | Browser scene: pane/header, launchers, browser activity/commands and native placement adapter |
| `terminal-scene.tsx`, `StageTerminalPane.tsx`, `stage-terminal-focus.ts` | Application terminal scene: pane/header, launchers and cancellable human launch focus |
| `DevelopmentTerminals.tsx`, `terminals.ts` | Agent/working-terminal surface, its shared visible View, launchers and terminal menus |
| `scenes.tsx`, `stage.ts`, `grid.ts`, `controller.ts` | Built-in registration, membership, grids, overflow, activity/Follow and task-page event routing |
| `src/browser/`, `src/terminal/` | Shared runtimes, also used by master/account sign-in windows |
| Core `Task`, `ProjectProfiles`, `StageTerminals`, `AppWindow` | Resource ownership, saved state, native attachment, actions/checks, explicit close and task/project teardown |
| `src/main/plugin.ts`, `src/kulisa-plugin/` | Core contracts and capability-specific agent tools/adapters |

These scene adapters remain inside Task view: they consume its store, pane handles and task-scoped actions.
Extracting them into `browser-stage`/`terminal-stage` or the working surface into `agent-terminal` requires narrow
host contracts for those dependencies, rather than packages forwarding back to Task view. The shared runtimes
must remain independent of those scene packages. No common Stage runtime package is needed for the current grid host.

`renderer/scenes.tsx` is the registration point. `StageScene` in `scene-contract.ts` declares the available renderer
capabilities; `shared/scenes.ts` validates identity and projects open panels without a closed union of scene kinds.
To add another built-in scene:

1. Supply a unique kind and Dockview component name, pane and header. `panels(state)` supplies stable panel IDs and
   current titles. Preserve existing `profile:<id>`/`stage-terminal:<id>` IDs and `profile`/`stage-terminal` component
   names: Dockview stores them. No format changes or runtime migrations accompany scene naming.
2. Supply launchers for the empty Workbench's tiles and empty Stage's strip, with their ordering. Add the descriptor
   to `scenes.tsx`; the task UI's launcher composition and Stage-empty checks receive it automatically.
3. Use the generic `stage:activity` event with a registered panel ID for Follow. If a runtime has a different event
   (browser captions), `bind(host)` adapts it once per task page. The host resolves the current grid at delivery,
   ignores other tasks/closed environments and does not transfer keyboard focus during Follow. Page-owned listeners
   disappear with the task UI, not when a pane hides. Do not retain a grid/native window in these adapters.
4. Implement task commands through the descriptor when needed. They invoke existing task-scoped core handles.
   Declare new channel/state facts in the owning IPC contracts; do not replace type-specific checks with a generic
   automation API. Shell menu projection still belongs to `renderer/lib/task-summary.ts`; adding a shell launcher
   currently requires that adapter too.
5. Supply `layout(context)` only for a scene needing native placement; DOM-only terminal scenes need none. Its keys
   identify core-owned native surfaces, independently of Dockview IDs. Core validates placement revision, task and
   viewport, scales/clips it and decides native visibility. Browser address/Pick handles remain browser-specific;
   other scenes do not implement them. Main native registration still needs an adapter in `AppWindow`/`TaskViewHost`.

The common grid receives membership, presentation and optional placement from registration; removing a panel only
removes its UI. Hiding, tabbing, maximizing or moving a pane must never stop its processes. Explicit Close goes
through a scene's core action; task close/delete use core resource cleanup, independently of renderer disposal.
Browser Close saves its tabs/sign-ins; terminal Stop keeps output while Close removes its setup/buffer. Task close
preserves reopenable setup. Account sign-in terminals continue using Terminal directly. Renderer recovery retains
the existing protocol-service limits of #399.

Telegram integration (#442) can register its own pane/header, launchers and activity adapter here. Native capture,
private input, human-owned privacy pause, credentials and bot runtimes remain that integration's capabilities and
core lifetime. In particular, closing its preview may restore the desktop without stopping bot runtimes; task close
has separate cleanup. Registration does not implement or authorize those backends.

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
- `renderer/scenes.tsx`, `scene-contract.ts`, `browser-scene.tsx`, `terminal-scene.tsx`: built-in scene registration and
  adapters; `shared/scenes.ts`: panel identity and membership.
- Core adapter: `src/main/window.ts`; authorization: `src/main/app.ts`.
