# Diff

Read-only local Git comparisons for the Diff Side bar tree and Main pane review.
UI names: [Workbench terminology](../../docs/ui.md#workbench-terminology).

- Comparisons use the merge base to match pull-request semantics while including the worktree's uncommitted changes.
- NUL-delimited listings preserve tabs, newlines and rename pairs; simple-git's `diffSummary` cannot read that format.
  Untracked files need separate reads because Git diff omits them.
- External diffs and text conversion are disabled to prevent project-defined converters from executing during review.
  Symlinks show link text; path containment checks confine reads to the supplied resource.
- Patch batches and Load diff bound memory; full file contents load only for explicit context expansion.
- Pierre Trees virtualizes changed-file navigation; presorted paths keep the tree in the review document's order.
- The tree uses Pierre's complete built-in file-type icons and Git-status badges alongside added/deleted counts.
- One filter controls Trees' built-in search and the review's current-path matches, ignoring case, trimming outer
  whitespace and accepting backslashes as separators. Previous rename paths remain display metadata, not search aliases.
  Filtering keeps the complete tree model; clearing search restores its expansion state. No matches hides Trees'
  unfiltered fallback and shows an empty result in both panes.
- Tree and review use the window's `text-sm` size for file names, code and empty-state messages; code uses JetBrains Mono.
- Code blocks allow native text selection and copying; file headers stay unselectable and Pierre owns line-number selection.
- File headers copy the current repository-relative path, including for renamed and collapsed files.
- Pierre's built-in headers own paths, rename arrows, change icons and patch counts; slots add collapse and Copy path.
  Placeholder rows keep Git-supplied status and counts because they have no patch metadata; copied, type-changed and
  unmerged files also keep their exact Git-status labels.
- Each opening reads Git afresh. Branch names, file rows and review share a loading state for at least 500 ms and appear together
  after the listings and the review's first rendered file are ready; empty comparisons need no file render.
- Search, repository headings and empty From/To controls appear immediately; the comparison selector stays disabled during loading.
- Loading prepares the virtualized views with one indeterminate progress bar in the review; one timer controls their reveal.
  Unmounting clears the timer, and aborted requests cannot publish results to another opening.
- Complete document snapshots and stable CodeView IDs and versions preserve expanded context across refreshes.
- First-file navigation targets the document start to preserve its top padding; other files target their headings.
- TanStack Query shares each visible comparison between the tree and document; zero inactive retention makes
  reopening read Git again. Patches are parsed only for files whose version changes.
- The session preserves review view state across unmounts; the caller owns its lifetime and cleanup.
- Callers set the session's `active` to false while a retained review is hidden, pausing polling without losing queries
  or document state.
