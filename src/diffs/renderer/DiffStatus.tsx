// Git status markers shared by the review tree and file headers.
import { FileDiffIcon, FileInputIcon, FileMinusCornerIcon, FilePlusCornerIcon, TriangleAlertIcon } from 'lucide-react';

export const diffLabel = (status: string) => ({ A: 'Added', D: 'Deleted', R: 'Renamed', C: 'Copied', M: 'Modified', T: 'Type changed', U: 'Unmerged' } as Record<string, string>)[status] ?? 'Changed';

export function DiffStatus({ status, iconOnly = false }: { status: string; iconOnly?: boolean }) {
  const label = diffLabel(status);
  const Icon = status === 'A' || status === 'C' ? FilePlusCornerIcon : status === 'D' ? FileMinusCornerIcon
    : status === 'R' ? FileInputIcon : status === 'U' ? TriangleAlertIcon : FileDiffIcon;
  const color = status === 'A' || status === 'C' ? 'text-success' : status === 'D' ? 'text-destructive' : status === 'U' ? 'text-warning' : 'text-muted-foreground';
  return <span role={iconOnly ? 'img' : undefined} aria-label={iconOnly ? label : undefined} title={label}
    className={`inline-flex shrink-0 items-center gap-1.5 text-xs ${color}`}>
    <Icon className="size-4" />{!iconOnly && label}
  </span>;
}
