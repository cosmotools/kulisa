# Diff

Read-only local Git comparisons for the Resources tree and development review.

- Comparisons use the merge base to match pull-request semantics while including the worktree's uncommitted changes.
- NUL-delimited listings preserve tabs, newlines and rename pairs; simple-git's `diffSummary` cannot read that format.
  Untracked files need separate reads because Git diff omits them.
- External diffs and text conversion are disabled to prevent project-defined converters from executing during review.
  Symlinks show link text; path containment checks confine reads to the supplied resource.
- Patch batches and Load diff bound memory; full file contents load only for explicit context expansion.
- Pierre Trees virtualizes changed-file navigation; presorted paths keep the tree in the review document's order.
- Publishing complete snapshots avoids incremental layout shifts. Stable CodeView path IDs and content versions
  preserve unchanged models and expanded context across refreshes.
- TanStack Query shares each visible comparison between the tree and document; zero inactive retention makes
  reopening read Git again. Patches are parsed only for files whose version changes.
