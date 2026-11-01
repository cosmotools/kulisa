// Shared line counts in review navigation and file headers.
export function ChangeCounts({ additions, deletions, partial = false }: { additions: number | null; deletions: number | null; partial?: boolean }) {
  return <span className="flex shrink-0 items-center gap-1.5 text-xs tabular-nums" title={partial ? 'Known line counts; some files have no text line count.' : undefined}>
    <span className={additions === null ? 'text-muted-foreground' : 'text-success'} title={additions === null ? 'Added line count unavailable' : undefined}>{additions === null ? '—' : `+${additions}`}</span>
    <span className={deletions === null ? 'text-muted-foreground' : 'text-destructive'} title={deletions === null ? 'Deleted line count unavailable' : undefined}>{deletions === null ? '—' : `−${deletions}`}</span>
  </span>;
}
