# Project Explorer

Shallow directory browsing and a shadcn File Tree, a [Kulisa package](../../docs/packages.md). Callers own tasks,
projects, roots and desktop actions; it writes no files or processes.

## Directory access

`main/index.ts` exports `listResourceFiles(roots, folder)` and `resourcePath(roots, file)`. Paths are resolved through
symbolic links and confined to a supplied root; errors are returned as `Result`. Directory reads are shallow,
include hidden entries, and sort folders before files, then names with numeric ordering. Symbolic links are leaf
entries; directory links are not expanded. Opening files is the caller's action, which may select an editor.

## Tree

Project occupies the Workbench [Side bar](../../docs/ui.md#workbench-terminology).

`ProjectDirectory` takes `ExplorerActions` for reads, open/reveal, optional external opening and shared menu opening.
It supplies Open/Show in Folder and, when supplied, Open in System Application rows. A single click selects a row;
double-click/Enter opens files. The caller supplies one selection shared across roots and nested directories.
Selection lasts while the Side bar content is mounted, independently of the open editor document.

Use shadcn File Tree: Collapsible folders and Button rows, with the secondary variant for the selected row and
ghost otherwise. Expanded folders set `--muted` transparent while unhovered so disclosure alone has no background. Refresh mounted expanded directories every 3 s while `active`; callers set it false
for hidden trees to pause polling and ignore late replies while retaining entries/expansion. Unmounting clears timers;
collapsed/background folders keep no watchers.

Use Lucide folder icons and Material Icon Theme file icons. Vite generates case-insensitive associations, referenced
SVGs and MIT attribution; renderer receives URLs/associations only. Match exact names before longest compound
extensions, with parent-folder rules first at each match; unknown entries use generic icons. CSS loads only the
active light/dark shade. Keep matching independent of editors.

## Contracts

`ipc.ts` declares the directory-entry shape shared by both halves. Task-specific channels (`task:file:list`,
`task:file:open`) belong to the core: their handles find the task and its methods supply that task's resource roots.
The renderer receives those actions as callbacks, with no channels or task keys of its own.

## The code

- `main/files.ts`, `main/index.ts`: confined shallow reads and public entry.
- `renderer/ProjectDirectory.tsx`, `actions.ts`, `index.ts`: tree lifecycle, file/menu callbacks and entry.
- `renderer/FileIcon.tsx`, `icon.ts`, `icons.d.ts`: asset display, matching and Vite contract.
- `ipc.ts`: directory-entry contract. Core task handles supply roots (`tasks.ts`, `ipc/tasks.ts`, `shared/ipc.ts`).
- `task-view/Resources.tsx`: repository grouping/ownership, panel controls and action bindings.
- `files.test.ts`, `icons.test.ts`: reads/containment and icon resolution from supplied manifests, including path/theme fallbacks. E2e:
  `test/e2e/resources.spec.ts`, `project-repositories.spec.ts`; containing layouts/artifacts use Workbench tests.
