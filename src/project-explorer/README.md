# Project Explorer

Shallow directory browsing and a virtualized Trees file tree, a [Kulisa package](../../docs/packages.md). Callers own tasks,
projects, roots and desktop actions; it writes no files.

## Directory access

`main/index.ts` exports `listResourceFiles(roots, folder)` and `resourcePath(roots, file)`. Paths are resolved through
symbolic links and confined to a supplied root; errors are returned as `Result`. Directory reads are shallow,
include hidden entries, and sort folders before files, then names with numeric ordering. Symbolic links are leaf
entries; directory links are not expanded. Opening files is the caller's action, which may select an editor.

## Tree

Project occupies the Workbench [Side bar](../../docs/ui.md#workbench-terminology).

`ProjectTree` takes caller-supplied roots, a header and `ExplorerActions` for shallow reads, file/root actions and
window menus. Trees owns one shared selection, focus, keyboard navigation and scrolling across all roots. A single
click selects; double-click/Enter opens files. Root menus offer Open Folder and caller-authorized removal. The window
shows the common branch in the header and labels exceptional branches/main-tree roots separately.

Expanded, visible directories refresh every 3 s while `active`; collapsed ancestors and background tasks suspend
reads. Cached entries/expansion survive pausing. Obsolete replies are ignored after collapse, pause, root replacement
or disposal; reopening waits for an outstanding request before reading again. Errors require explicit Retry or
reopening. Unmounting releases timers, subscriptions and cached data. There are no watchers or recursive scans.

The public API lacks async children/expansion events. `directories.ts` bridges model subscriptions, skipping ordinary
focus/selection notifications. It replaces paths only after actual listing changes, retaining expansion; Trees retains
surviving selection/focus. Replacement bounds retained storage (#348). Row decorations show loading/empty/error
states; #389 tracks replacing these compatibility mechanisms when released APIs cover them.

Use Trees' complete built-in icon set, filename/extension matching and automatic colors (the author's choice).
Public host CSS variables integrate the window palette and typography; `tree.css` only sizes row metadata.
Native Git statuses describe the working tree and index, independently of Diff comparisons. One snapshot per root
refreshes on the same foreground timer, including collapsed roots; ignored folders inherit Trees' native treatment.
Reads never overlap for a root, obsolete replies cannot cross root/task lifetimes, and Git errors require Retry.

## Contracts

`ipc.ts` declares directory entries and Git statuses shared by both halves. Task-specific channels (`task:file:list`,
`task:file:status`, `task:file:open`) belong to the core: their handles find the task and its methods check that task's roots.
The renderer receives those actions as callbacks, with no channels or task keys of its own.

## The code

- `main/files.ts`, `git-status.ts`, `main/index.ts`: confined shallow reads, Git snapshots through the caller's Git runner and public entry.
- `renderer/ProjectTree.tsx`, `directories.ts`, `git-status.ts`, `actions.ts`, `index.ts`: view, directory/Git lifecycle, callbacks and entry.
- `renderer/tree.css`: metadata typography; `src/shared/tree-style.ts` integrates the window theme and borderless focus indication.
- `ipc.ts`: directory-entry contract. Core task handles supply roots (`tasks.ts`, `ipc/tasks.ts`, `shared/ipc.ts`).
- `task-view/Resources.tsx`: repository grouping/ownership, panel controls and action bindings.
- `files.test.ts`, `directories.test.ts`: reads/containment and async directory lifecycle. E2e:
  `test/e2e/resources.spec.ts`, `project-repositories.spec.ts`; containing layouts/artifacts use Workbench tests.
