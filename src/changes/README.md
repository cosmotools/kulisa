# Changes

Read-only local Git comparisons, a changed-file tree and a continuous virtualized review. A Kulisa package
([packages](../../docs/packages.md)): callers supply resource folders, Git starting points, access callbacks,
selection, menus and typography. Neither half knows tasks, agents or Dockview. Review data stays off disk.

## Git comparisons

`main/index.ts` exports `listChanges`, `listChangeTargets`, `loadReview` and `readDiff`. The shared simple-git client
runs the user's installed Git, with external diffs and text conversion disabled. Reads stay inside the supplied
resource; symlinks show their link text. Git state and remotes are unchanged.

From shows the resource's current worktree branch as plain text. To defaults to the remote's default branch, an
available main/master branch, the supplied starting commit or HEAD. An Empty tree target supports an unborn branch.
The comparison uses the source and target's merge base, including committed, staged, unstaged and untracked changes.
Comparing with the current branch or HEAD shows uncommitted changes. Ignored files stay out.

`loadReview` resolves the comparison and reads its summary once, then obtains one bounded patch batch. The reply
contains the complete tree, patches and Load diff notices. Raw NUL-delimited listings preserve tabs, newlines and
rename pairs; simple-git's `diffSummary` does not accept that format. Listings have an 8 MiB limit.

Automatic loading includes up to 32 files and 8,000 changed lines, with a 128 KiB/2,000-line limit per file.
`ls-tree` sizes and worktree stats defer larger files before patch generation. Git's summary computes tracked line
counts. Up to four explicit loads join the automatic allowance within its 32-file bound; another explicit file
keeps the latest four choices. Tracked patches use one `git diff --raw -z --patch`, bounded to 24 MiB; NUL headers
associate patches with paths for per-patch UTF-8 validation and hashing. Untracked additions use bounded reads,
four at a time. Complete tracked contents load only for explicit context expansion through `readDiff`.

Text sides have a 2 MiB limit. Binary, non-UTF-8, larger and non-file entries show a notice. The caller's resource
membership check precedes each read; the package checks path containment and text limits.

## Tree and review

`renderer/index.ts` exports `Changes`, `DiffPanel` and `createChanges`. The caller creates one session per visible
owner and passes it to both views. Its `ChangesActions` callbacks read summaries, targets, reviews and full text,
persist selection, mark the visible file and open the window's menu. Theme shade and text size are DiffPanel props.

The tree groups several resources by repository, with folders first and compact rows sharing disclosure, icon and
indentation columns. Folder trigger wrappers make `--muted` transparent when unhovered, keeping expanded folders
plain. Lucide status icons distinguish added (green), deleted (red), renamed and modified files, including
untracked additions; the selected file uses the secondary Button variant. Filtering matches current and previous
paths in both views. To options load only when its menu opens; its explicit selected label keeps Radix from mounting
large closed branch lists. Non-Git resources and unavailable comparisons have notices.

Selecting a file by click, Enter or View diff scrolls to its header. CodeView owns one scroll container, file and
line virtualization, sticky headers and scroll anchoring. Navigation carries a sequence; manual scrolling marks
the visible file without Git requests. Removing it selects the first remaining match. The header shows filtered
line totals, with unavailable counts noted in their title; Unified/Split applies to the whole document.

`use-review.ts` publishes one React snapshot per complete response and refreshes three seconds after the previous
request. Unchanged patch versions retain their models and expanded context. Explicit loads repeat the same request;
cleanup ignores stale replies. The tree and document share metadata; inactive resource trees read their summaries.
Transient errors retain the current document for recovery. Every reopening reads fresh data. Unmounting the review
releases its models and worker; closing the last tree or review releases the session's metadata.

@pierre/diffs supplies parsing and CodeView. Git patch strings are released after parsing; a stable path ID and
content version preserve each unchanged model. Untracked text uses `parseDiffFromFile(null, newFile)`. The
highlighting pool has one worker and four entries per AST cache. `review-theme.ts` maps syntax colors to the
window's palette; `review.css` maps additions, deletions, gutters, selection and JetBrains Mono. The caller's text
size supplies matching line metrics; Chromium applies global zoom. Editing belongs to a separate surface.

## The code

| Where | What |
|---|---|
| `ipc.ts` | comparison, file, patch and selection contracts |
| `main/index.ts`, `main/changes.ts` | public Git entry and bounded local comparison reads |
| `renderer/index.ts`, `actions.ts` | public renderer entry and caller callbacks |
| `renderer/session.ts` | visible metadata, last-reader cleanup and tree/document read coordination |
| `renderer/Changes.tsx` | comparison controls, resource grouping and changed-file navigation |
| `renderer/DiffPanel.tsx` | lazy document loading |
| `renderer/ReviewDocument.tsx`, `use-review.ts` | CodeView, navigation, full context and complete snapshot refresh |
| `renderer/review-theme.ts`, `review.css` | worker and palette/typography integration |
| `renderer/ChangeCounts.tsx`, `ChangeStatus.tsx` | line counts and status labels/icons |
| `changes.test.ts` | local Git comparisons, unusual paths, limits, batching and patch versions |

Outside integration, kept with its owner:

- `src/main/tasks.ts`: resource membership and starting commits; `src/main/ipc/tasks.ts`: the task's IPC handles.
- `src/shared/ipc.ts`: task channel types use the package's contracts; task identity stays outside this package.
- `src/main/worktrees.ts`: installed-Git execution shared with other task Git operations.
- `src/renderer/lib/changes.ts`: task-bound IPC, menus and selection callbacks; switches discard the current session.
- `src/renderer/components/Changes.tsx`: the window's selected task/screen and typography supplied to both views.
- `src/renderer/lib/store.ts`, `grid.ts`: task-specific selection and Dockview screen/comparison persistence.
- `src/renderer/components/grid/Resources.tsx`, `DevelopmentContent.tsx`: Resources placement and terminal/review screens.
- `vite.config.mts`: worker module format and the distributed renderer license belong to the app's build.
- `.dependency-cruiser.ts`: package boundaries; `docs/packages.md`, `tasks.md`, `ui.md` and the root README link here.

End-to-end coverage stays in `test/e2e/changes.spec.ts`, with Resources and task layout integration in
`resources.spec.ts`, `project-repositories.spec.ts` and the grid files.
