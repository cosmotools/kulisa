# Task view UI

Retained task screens: Workbench, Stage and pane controls.
Names: [UI terminology](../../../docs/ui.md#workbench-terminology). Grid lifecycle, focus and native views belong to [window.md](../../../docs/window.md#the-grid); task/resource semantics belong to
[tasks.md](../../../docs/tasks.md). General UI integration: [ui.md](../../../docs/ui.md).

## Boundary

The public UI entry is `index.ts`; dependency-cruiser prevents outside access to the implementation.
`task.html` loads the page bootstrap `main.tsx`, which uses that entry.
Keep the task's commands, controllers, stores, pane layout and native-view measurements inside; shared window
coordination remains in `renderer/lib/`. Other Kulisa packages are reached through their public entries.

## Layout and drawing constraints

Apply the window's theme through Dockview variables in `Grid.css`. Stage has a 6 px gap for native pages;
Workbench has no gap. The Activity bar vertical tab header owns its border even when content is collapsed.
Pane children may shrink; isolate stacking so
overlays stay below Dockview separators while menus stay above them.
Activity bar selection stays highlighted independently of Dockview group focus.

Preserve the observable outer host when changing pane markup: hidden native resizes must reach the retained grid.
Side bar lists use `SidebarContent` scrolling; Project and Diff own virtualized scrolling inside Dockview's named
region without duplicate region wrappers.
Keep Dockview IDs stable for saved layouts. Workbench item lifetimes belong to
[tasks.md](../../../docs/tasks.md#the-workbench); package contracts belong to
[Editor](../../editor/README.md) and [File Viewer](../../file-viewer/README.md).

Profile identity uses a custom notch: masked concave shoulders in `ProfilePane.css` attach it to the pane's top edge.
This geometry is outside shadcn's component shapes. A narrow pane gives up Back, Forward and Reload into ⋮ in that
order; never hide Pick or ⋮. Container queries handle that priority while tabs/address editing can shrink.

Browser tab mechanics are shared with the tasks' bar; see [Tabs](../../../docs/ui.md#tabs).
Pane controls, Activity bar and Side bar use native title tooltips, not HTML poppers over native pages. Page alert/confirm stays in its own pane so other
panes and the current keyboard target continue working; see [page dialogs](../../../docs/profiles.md#page-dialogs).

## The code

- `main.tsx` boots one task page; `TaskView.tsx` composes its screen. `state.ts` owns its single task store;
  `controller.ts` connects the committed grid and scoped commands.
- `keys.ts` handles task commands; `ask.ts` requests shell questions; `test-hooks.ts` exposes task-page test handles.
- `development.ts` owns Activity bar selection and Editor/Diff sessions; `Artifacts.tsx` supplies the File Viewer host.
- Profile/terminal panes, Workbench terminals, Activity bar and Side bar own their controls and native-content bounds.
- `Grid.css` and `ProfilePane.css` own documented geometry exceptions, using theme variables.
- Coverage: grid layout/resize scenarios in `test/e2e/`, `stage.spec.ts`, `resources.spec.ts` and window tests.
