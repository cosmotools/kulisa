# Project Explorer

A folder browser, a Kulisa package ([packages.md](../../docs/packages.md)): directory reads and a shadcn File Tree,
independent of tasks, projects, agents and the window's store. It writes no files and starts no processes.

## Directory access

`main/index.ts` exports `listResourceFiles(roots, folder)` and `resourcePath(roots, file)`. Paths are resolved through
symbolic links and confined to a supplied root; errors are returned as `Result`. Directory reads are shallow,
include hidden entries, and sort folders before files, then names with numeric ordering. Symbolic links are leaf
entries; directory links are not expanded. Opening files is the caller's desktop action.

## Tree

`renderer/index.ts` exports `ProjectDirectory` and `ExplorerActions`. A caller supplies the root folder and callbacks
to read a directory, open and reveal a file, and show menu rows through the window's menu opener. The tree supplies
the Open and Show in Folder rows. Double-click or Enter opens a file.

The UI follows [shadcn's File Tree](https://ui.shadcn.com/docs/ai-elements/radix/file-tree): Collapsible folders with
Button triggers and ghost Button files. Each expanded directory reads on mount and every three seconds; unmounting
clears its timer and ignores late replies. Collapsed folders and background tasks keep no watchers. The caller
unmounts the tree when hidden or when its owner changes, so state and timers belong to the visible tree.

## Contracts

`ipc.ts` declares the directory-entry shape shared by both halves. Task-specific channels (`task:files`,
`task:file-open`) belong to the core: their handles find the task and its methods supply that task's resource roots.
The renderer receives those actions as callbacks, with no channels or task keys of its own.

## The code

| File | What |
|---|---|
| `main/index.ts` | main entry |
| `main/files.ts` | path containment and shallow directory reads |
| `renderer/index.ts` | renderer entry |
| `renderer/actions.ts` | file and desktop callbacks |
| `renderer/ProjectDirectory.tsx` | directory loading, refresh, expansion, file interactions and menu rows |
| `ipc.ts` | directory-entry contract |
| `files.test.ts` | shallow reads, ordering, refresh, multiple roots, missing paths and symbolic-link containment |

Outside callers and integration:

- `src/main/tasks.ts`: resource ownership, roots and the existing protected desktop opening action.
- `src/main/ipc/tasks.ts`: task-specific IPC handles; `src/shared/ipc.ts`: their typed contracts.
- `src/renderer/components/grid/Resources.tsx`: task selection, repository root labels and grouping, repository removal,
  tabs, artifacts, and callback bindings to the window's IPC and menu opener.
- `.dependency-cruiser.ts`: entry and dependency enforcement; `docs/packages.md`, `docs/tasks.md` and `docs/ui.md`: integration links.
- `src/shared/types.ts`: the core's task and resource shapes; explorer entries are declared in this Kulisa package's contract.

End-to-end tests stay in `test/e2e/resources.spec.ts` (expansion, file opening and project switching) and
`test/e2e/project-repositories.spec.ts` (task worktrees and additional repositories). Resources layout and artifact
tests cover the containing window panel.
