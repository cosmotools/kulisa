// Local review navigation and comparison controls (../README.md).
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRightIcon, ChevronRightIcon, GitBranchIcon } from 'lucide-react';
import { Alert, AlertDescription, Button, Collapsible, CollapsibleContent, CollapsibleTrigger, Input,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ui';
import type { DiffFile, DiffOptions, DiffSelection } from '../ipc';
import { refused } from '../../shared/result';
import { DiffTree } from './DiffTree';
import { useDiff, type DiffSession } from './session';

type DiffProps = { session: DiffSession; roots: { folder: string; label: string }[]; selection: DiffSelection | null; reviewing: boolean };
export function Diff({ session, roots, selection, reviewing }: DiffProps) {
  const [filter, setFilter] = useState(() => selection?.filter ?? '');
  return <section aria-label="Changed files" className="flex h-full min-h-0 flex-col">
    <header className="px-3 py-2 text-sm font-medium">Diff</header>
    <div className="flex flex-col gap-2 px-3 pb-3">
      <Input aria-label="Filter changed files" placeholder="Filter files…" value={filter} onChange={(e) => {
        const value = e.target.value;
        setFilter(value);
        if (selection) session.actions.select({ ...selection, filter: value });
      }} />
    </div>
    <div className="flex min-h-0 flex-1 flex-col overflow-auto px-1 pb-2">
      {roots.map((root) => <RepositoryDiff key={root.folder} session={session} selected={selection} reviewing={reviewing} root={root} grouped={roots.length > 1} filter={filter} />)}
    </div>
  </section>;
}

function RepositoryDiff({ session, selected, reviewing: activeReview, root, grouped, filter }: {
  session: DiffSession; selected: DiffSelection | null; reviewing: boolean;
  root: { folder: string; label: string }; grouped: boolean; filter: string;
}) {
  const [choosingTarget, setChoosingTarget] = useState(false);
  const targets = useQuery({ queryKey: ['targets', root.folder], enabled: choosingTarget, queryFn: async () => {
    const response = await session.actions.targets(root.folder);
    if (refused(response)) throw new Error(response.error);
    return response.branches;
  } }, session.client);
  const [options, setOptions] = useState<DiffOptions>(() => {
    return selected?.folder === root.folder ? { to: selected.options.to } : {};
  });
  const reviewing = activeReview && selected?.folder === root.folder && selected.options.to === options.to;
  const { data: snapshot, error } = useDiff(session, { folder: root.folder, options }, reviewing);
  const data = snapshot?.data;
  const files = useMemo(() => data?.files.filter((file) => `${file.path}\n${file.previousPath ?? ''}`.toLowerCase().includes(filter.toLowerCase())) ?? [], [data?.files, filter]);
  const choose = (file: DiffFile) => session.actions.select({ folder: root.folder, path: file.path, options, filter });
  const compare = (next: DiffOptions) => {
    setOptions(next);
    session.actions.select({ folder: root.folder, path: selected?.folder === root.folder ? selected.path : '', options: next, filter });
  };
  const content = <div className="flex min-h-40 flex-1 flex-col">
      {!data && !error && <p role="status" className="p-2 text-xs text-muted-foreground">Loading diff…</p>}
      {targets.error && <Alert variant="destructive"><AlertDescription>{targets.error.message}</AlertDescription></Alert>}
      {error && <Alert variant="destructive"><AlertDescription>{error.message}</AlertDescription></Alert>}
      {data && !data.git && <p className="p-2 text-xs text-muted-foreground">This folder is not a Git repository.</p>}
      {data?.git && <>
        <div className="flex flex-col gap-2 px-2 py-2">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-1">
            <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-muted-foreground">From</span>
            <div role="group" aria-label={`From for ${root.label}`} title={data.from} className="flex h-7 min-w-0 items-center gap-1.5 text-sm">
              <GitBranchIcon className="size-4 shrink-0 text-muted-foreground" /><span className="truncate select-text">{data.from}</span>
            </div>
            </div>
            <ArrowRightIcon className="mb-1.5 size-4 text-muted-foreground" />
            <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-muted-foreground">To</span>
            <Select open={choosingTarget} onOpenChange={setChoosingTarget} value={options.to ?? data.to} onValueChange={(to) => compare({ to })}>
              <SelectTrigger size="sm" className="w-full min-w-0" aria-label={`To for ${root.label}`} title={options.to ?? data.to}><span className="min-w-0 truncate"><SelectValue>{options.to ?? data.to}</SelectValue></span></SelectTrigger>
              {/* Radix mounts closed items to obtain their labels; the explicit value keeps large branch lists out of the first paint. */}
              {choosingTarget && <SelectContent position="popper">{[...new Set([...data.branches, ...(targets.data ?? [])])].map((branch) => <SelectItem value={branch} key={branch}>{branch}</SelectItem>)}</SelectContent>}
            </Select>
            </div>
          </div>
        </div>
        {data && !data.files.length && <p className="p-2 text-xs text-muted-foreground">No changes</p>}
        {!!data?.files.length && <DiffTree session={session} files={files}
          selected={selected?.folder === root.folder ? selected.path : null} choose={choose} />}
      </>}
  </div>;
  if (!grouped) return content;
  return <Collapsible defaultOpen asChild><div className="flex min-h-48 flex-1 flex-col data-[state=closed]:min-h-0 data-[state=closed]:flex-none">
    <div className="not-hover:[--muted:transparent]"><CollapsibleTrigger asChild><Button variant="ghost" className="h-8 w-full justify-start" aria-label={`Repository ${root.label}`} title={root.folder}>
      <ChevronRightIcon className="group-aria-expanded/button:rotate-90" /><GitBranchIcon /><span className="min-w-0 flex-1 truncate text-start">{root.label}</span>
      {data && <span className="text-xs text-muted-foreground">{data.files.length}</span>}
    </Button></CollapsibleTrigger></div>
    <CollapsibleContent asChild><div className="flex min-h-0 flex-1 flex-col">{content}</div></CollapsibleContent>
  </div></Collapsible>;
}
