# Changes

Read-only local Git comparisons for the Resources tree and development review. A [Kulisa package](../../docs/packages.md):
callers supply folders, starting commits, access callbacks, selection, menus and typography; task identity stays outside.

## Git reads

The main half uses the installed Git through simple-git, without a shell or network access. Comparisons use the
target's merge base and include committed, staged, unstaged and untracked changes; HEAD compares uncommitted changes.
The default target follows the remote's default branch, main/master, the supplied starting commit, then HEAD.

`loadReview` returns one complete summary and a bounded batch of patches. NUL-delimited listings preserve unusual
paths and rename pairs; `diffSummary` cannot read that format. Tracked patches come from one Git call; untracked
files need separate reads because Git diff omits them. Full contents load only for explicit context expansion.
Size and line limits defer large diffs behind Load diff to bound memory. Binary and non-UTF-8 files show notices.
Resource membership belongs to the caller; path containment belongs here. Symlinks show link text, and external
diffs and text conversion are disabled so reading a comparison cannot execute project-defined converters.

## Review lifecycle

The caller shares one `createChanges` session between tree and document. Each review response publishes one snapshot;
refresh waits three seconds after completion, and stale replies are ignored. Reopening reads fresh data. The last
reader releases metadata; unmounting the document releases its models and highlighting worker. Review data stays in memory.

@pierre/diffs CodeView owns one virtualized scroll document. Stable path IDs and content versions preserve unchanged
models and expanded context across refreshes. Tree clicks navigate; scrolling only updates selection, without Git reads.
Palette and font metrics come from the caller and CSS tokens; Chromium applies global zoom.

## The code

| Where | What |
|---|---|
| `ipc.ts`, `main/index.ts`, `renderer/index.ts` | contracts and public entries |
| `main/changes.ts` | comparison resolution, bounded Git patches and file reads |
| `renderer/actions.ts`, `session.ts` | caller callbacks and shared metadata |
| `renderer/Changes.tsx`, `ChangeCounts.tsx`, `ChangeStatus.tsx` | tree, comparison controls and change indicators |
| `renderer/DiffPanel.tsx`, `ReviewDocument.tsx`, `use-review.ts` | lazy document, navigation and snapshot refresh |
| `renderer/review-theme.ts`, `review.css` | highlighting worker, palette and typography |
| `changes.test.ts` | Git comparisons, unusual paths, limits and batching |

Outside integration stays with its owner:

- `src/main/tasks.ts`, `src/main/ipc/tasks.ts`, `src/shared/ipc.ts`: task resource ownership, starting commits and IPC handles;
  `src/main/worktrees.ts`: Git execution shared with task operations.
- `src/renderer/lib/changes.ts`, `components/Changes.tsx`: task-bound callbacks, window selection and typography;
  `lib/store.ts`, `lib/grid.ts`: task selection and Dockview persistence;
  `components/grid/Resources.tsx`, `DevelopmentContent.tsx`: placement of the tree and review in the window.
- `vite.config.mts`: app worker build and distributed license; `.dependency-cruiser.ts`: boundary enforcement;
  root README and `docs/packages.md`, `tasks.md`, `ui.md`: package discovery and integration links.
- `test/e2e/changes.spec.ts`, `resources.spec.ts`, `project-repositories.spec.ts` and grid specs: window integration coverage.
