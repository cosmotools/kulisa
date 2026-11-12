# Task view UI

Retained task screens: Workbench, Stage and pane controls.
Names: [UI terminology](../../../docs/ui.md#workbench-terminology). Grid lifecycle, focus and native views belong to [window.md](../../../docs/window.md#the-grid); task/resource semantics belong to
[tasks.md](../../../docs/tasks.md). General UI integration: [ui.md](../../../docs/ui.md).

## Boundary

Outside callers use `TaskView.tsx` for UI and `index.ts` for commands/state. Dependency-cruiser protects these
entries. Keep the task's controllers, stores, pane layout and native-view measurements behind them; shared window
coordination remains in `renderer/lib/`. Other Kulisa packages are reached through their public entries.

## Layout and drawing constraints

Dockview owns the Workbench and Stage grids; a headerless outer Gridview divides them. Apply the window's theme
through Dockview variables in `Grid.css`. Stage has a 6 px gap for native pages; Workbench has no gap. The Activity bar
vertical tab header owns its border even when content is collapsed. Pane children may shrink; isolate stacking so
overlays stay below Dockview separators while menus stay above them.
Activity bar selection stays highlighted independently of Dockview group focus.

`TaskView` keeps an observable outer host; task selection changes its native group's visibility. Preserve retained
grids and measurements when changing pane markup. Disposal follows closure or a
[caught render failure](../../../docs/window.md#task-rendering-failures), not selection.
Side bar lists use `SidebarContent` scrolling; Project and Diff own virtualized scrolling inside Dockview's named
region without duplicate region wrappers.
`development.ts` owns Activity bar selection; Dockview IDs remain stable for saved layouts.
It also owns the caller's Editor session. Project's Main pane retains the lazy editor while other Activity bar items
are selected; task disposal releases retained histories. Filesystem/draft/autosave ownership: [Editor](../../editor/README.md).
`Artifacts.tsx` adapts task-authorized reads, native PDF access and host actions to [File Viewer](../../file-viewer/README.md).
Selection survives Activity bar/task changes, while the viewer unmounts to release content and native processes.

Profile identity uses a custom notch: masked concave shoulders in `ProfilePane.css` attach it to the pane's top edge.
This geometry is outside shadcn's component shapes. A narrow pane gives up Back, Forward and Reload into ⋮ in that
order; never hide Pick or ⋮. Container queries handle that priority while tabs/address editing can shrink.

Browser tab mechanics are shared with the tasks' bar; see [Tabs](../../../docs/ui.md#tabs).
Pane controls, Activity bar and Side bar use native title tooltips, not HTML poppers over native pages. Page alert/confirm stays in its own pane so other
panes and the current keyboard target continue working; see [page dialogs](../../../docs/profiles.md#page-dialogs).

## The code

- `TaskView.tsx` composes the retained screen; `state.ts` and `controller.ts` own activation, commands and layout.
- Profile/terminal panes, Workbench terminals, Activity bar and Side bar own their controls and native-content bounds.
- `Grid.css` and `ProfilePane.css` own documented geometry exceptions, using theme variables.
- Coverage: grid layout/resize scenarios in `test/e2e/`, `stage.spec.ts`, `resources.spec.ts` and window tests.
