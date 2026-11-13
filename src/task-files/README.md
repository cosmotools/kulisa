# Task Files

Ordinary result files, confined recursive actions, live listing and previews, a [Kulisa package](../../docs/packages.md).
Core supplies storage paths and lifecycle facts. Tasks, conversation identities, retention policy, agent launch,
MCP routing, desktop actions and window state stay outside.

## Storage

The filesystem is authoritative: ordinary files, nested directories and empty directories need no registration.
Generated tool filenames preserve optional provenance. Reads and actions reject symbolic links at every path component;
recursive deletion uses the shared removal helper. `readFileRange` returns at most 4 MiB of a regular file with
its size and listing-compatible revision, rejecting replacement or mutation during the read. Generated filenames use exclusive creation across concurrent writers.
The caller chooses the results or working folder; this package applies no quota or expiry. Ownership, folder layout
and cleanup policy belong to [tasks](../../docs/tasks.md#artifacts-and-temporary-files).

## Live results

`TaskFiles` receives the results folder, its parent, preparation/open-state callbacks and change/log callbacks.
It owns native recursive watching, replacement of the results root, polling fallback, refresh coalescing, in-flight
scan versions and preview state. `dispose()` releases watchers, timers, queued work and previews when its caller unloads;
pending requests cannot publish changes afterward. A reopened caller creates a new instance.

Only rendered raster rows request thumbnails. Previews are made serially, cached by revision and invalidated on file
changes. The queue/cache retain at most 128 entries; files above 16 MiB or dimensions above 16 million pixels are
rejected before decoding. Unsupported images keep generic icons. These memory bounds do not limit disk storage.

## Tree

`ArtifactTree` receives entries, the caller’s preview path/navigation version and callbacks for opening, menus, native dragging and thumbnail requests. It imports
no window state or IPC handles. Entries include modification times; siblings sort folders first, then newest modified
first, with natural filename order for ties. Timestamp changes reorder rows while preserving selection and expansion.
The core supplies captions, source names and shared menus. Trees owns virtualization,
selection, focus and expansion; path changes preserve expanded directories. A preview navigation selects/reveals its
row and expands ancestors without moving keyboard focus; unrelated list updates preserve the human’s expansion. Scoped shadow CSS gives each row a
32 px icon/preview and separate filename/caption lines, including bounded truncation backgrounds.

Trees' public basename icon API cannot distinguish identical names in different folders. Those collisions keep
generic icons until supported per-path icons ship (#400, upstream pierrecomputer/pierre#1279).

## Contracts

`ipc.ts` owns file records shared by both halves. Task-specific channels remain in the core: their handles select
the task, call its action and translate the result. Package callers use only `main/index.ts`, `renderer/index.ts`
and `ipc.ts`.

## The code

- `main/files.ts`, `read.ts`: confined listing, exclusive writes, recursive deletion, bounded reads and ownership checks.
- `main/results.ts`, `preview.ts`: live listing lifecycle, bounded preview queue/cache and raster validation.
- `renderer/ArtifactTree.tsx`, `rows.css`: Trees adaptation and shadow layout; `renderer/index.ts`: entry.
- `files.test.ts`, `read.test.ts`: filesystem, bounded-read and preview guards. E2e: `task-files.spec.ts`, `agent-reports.spec.ts`, `profiles.spec.ts`.
- Core integration: `tasks.ts` supplies ownership/lifecycle/actions, `store.ts` owns storage paths,
  `plugin.ts` binds agent contracts, and `task-view/Resources.tsx` supplies Workbench controls and callbacks.
