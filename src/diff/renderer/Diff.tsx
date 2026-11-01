// Local review navigation and comparison controls (../README.md).
import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { ArrowRightIcon, ChevronRightIcon, FolderIcon, GitBranchIcon } from 'lucide-react';
import { Alert, AlertDescription, Button, Collapsible, CollapsibleContent, CollapsibleTrigger, Input,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SidebarMenu, SidebarMenuItem } from '@ui';
import type { DiffFile, DiffOptions, DiffSelection } from '../ipc';
import { refused } from '../../shared/result';
import { DiffCounts } from './DiffCounts';
import { diffLabel, DiffStatus } from './DiffStatus';
import { comparisonKey, type DiffSession } from './session';

type DiffProps = { session: DiffSession; roots: { folder: string; label: string }[]; selection: DiffSelection | null; reviewing: boolean };
export function Diff({ session, roots, selection, reviewing }: DiffProps) {
  useEffect(() => session.observe(), [session]);
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
    <div className="min-h-0 flex-1 overflow-auto px-1 pb-2">
      {roots.map((root) => <RepositoryDiff key={root.folder} session={session} selected={selection} reviewing={reviewing} root={root} grouped={roots.length > 1} filter={filter} />)}
    </div>
  </section>;
}

function RepositoryDiff({ session, selected, reviewing: activeReview, root, grouped, filter }: {
  session: DiffSession; selected: DiffSelection | null; reviewing: boolean;
  root: { folder: string; label: string }; grouped: boolean; filter: string;
}) {
  const [choosingTarget, setChoosingTarget] = useState(false);
  const [targets, setTargets] = useState<string[]>([]);
  const [targetError, setTargetError] = useState<string | null>(null);
  useEffect(() => {
    if (!choosingTarget) return;
    let active = true;
    void session.actions.targets(root.folder).then((response) => {
      if (!active) return;
      if (refused(response)) setTargetError(response.error);
      else { setTargets(response.branches); setTargetError(null); }
    }, (e: Error) => { if (active) setTargetError(e.message); });
    return () => { active = false; };
  }, [choosingTarget, session, root.folder]);
  const [options, setOptions] = useState<DiffOptions>(() => {
    return selected?.folder === root.folder ? { to: selected.options.to } : session.listings.getState().get(root.folder)?.options ?? {};
  });
  const comparison = { folder: root.folder, options }, query = comparisonKey(comparison);
  const loaded = useStore(session.listings, (s) => s.get(root.folder));
  const result = loaded?.query === query ? loaded.result : null;
  const reader = useStore(session.activity);
  const reviewing = reader === query || (!!selected && comparisonKey(selected) === query && activeReview);
  useEffect(() => {
    if (reviewing) return;
    let active = true, timer = 0;
    const read = async () => {
      try {
        const response = await session.actions.list(root.folder, options);
        if (active) session.publish({ folder: root.folder, options }, response);
      } catch (e) { if (active) session.publish({ folder: root.folder, options }, { error: (e as Error).message }); }
      if (active) timer = window.setTimeout(() => void read(), 3000);
    };
    void read();
    return () => { active = false; clearTimeout(timer); };
  }, [session, root.folder, options, reviewing]);
  const data = result && !refused(result) ? result : null;
  // Keep selectors usable when an agent renames or removes a selected branch.
  const metadata = data ?? loaded?.metadata;
  const choose = (file: DiffFile) => session.actions.select({ folder: root.folder, path: file.path, options, filter });
  const compare = (next: DiffOptions) => {
    setOptions(next);
    session.actions.select({ folder: root.folder, path: selected?.folder === root.folder ? selected.path : '', options: next, filter });
  };
  const error = result?.error;
  const content = <>
      {!result && <p role="status" className="p-2 text-xs text-muted-foreground">Loading diff…</p>}
      {targetError && <Alert variant="destructive"><AlertDescription>{targetError}</AlertDescription></Alert>}
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {data && !data.git && <p className="p-2 text-xs text-muted-foreground">This folder is not a Git repository.</p>}
      {metadata?.git && <>
        <div className="flex flex-col gap-2 px-2 py-2">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-1">
            <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-muted-foreground">From</span>
            <div role="group" aria-label={`From for ${root.label}`} title={metadata.from} className="flex h-7 min-w-0 items-center gap-1.5 text-sm">
              <GitBranchIcon className="size-4 shrink-0 text-muted-foreground" /><span className="truncate select-text">{metadata.from}</span>
            </div>
            </div>
            <ArrowRightIcon className="mb-1.5 size-4 text-muted-foreground" />
            <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-muted-foreground">To</span>
            <Select open={choosingTarget} onOpenChange={setChoosingTarget} value={options.to ?? metadata.to} onValueChange={(to) => compare({ to })}>
              <SelectTrigger size="sm" className="w-full min-w-0" aria-label={`To for ${root.label}`} title={options.to ?? metadata.to}><span className="min-w-0 truncate"><SelectValue>{options.to ?? metadata.to}</SelectValue></span></SelectTrigger>
              {/* Radix mounts closed items to obtain their labels; the explicit value keeps large branch lists out of the first paint. */}
              {choosingTarget && <SelectContent position="popper">{[...new Set([...metadata.branches, ...targets])].map((branch) => <SelectItem value={branch} key={branch}>{branch}</SelectItem>)}</SelectContent>}
            </Select>
            </div>
          </div>
        </div>
        {data && !data.files.length && <p className="p-2 text-xs text-muted-foreground">No changes</p>}
        {!!data?.files.length && <DiffTree session={session} files={data.files.filter((f) => `${f.path}\n${f.previousPath ?? ''}`.toLowerCase().includes(filter.toLowerCase()))}
          selected={selected?.folder === root.folder ? selected.path : null} choose={choose} />}
      </>}
  </>;
  if (!grouped) return content;
  return <Collapsible defaultOpen>
    <div className="not-hover:[--muted:transparent]"><CollapsibleTrigger asChild><Button variant="ghost" className="h-8 w-full justify-start" aria-label={`Repository ${root.label}`} title={root.folder}>
      <ChevronRightIcon className="group-aria-expanded/button:rotate-90" /><GitBranchIcon /><span className="min-w-0 flex-1 truncate text-start">{root.label}</span>
      {data && <span className="text-xs text-muted-foreground">{data.files.length}</span>}
    </Button></CollapsibleTrigger></div>
    <CollapsibleContent>{content}</CollapsibleContent>
  </Collapsible>;
}

function DiffTree({ session, files, selected, choose, prefix = '' }: { session: DiffSession; files: DiffFile[]; selected: string | null; choose(file: DiffFile): void; prefix?: string }) {
  const folders = new Map<string, DiffFile[]>(), leaves: DiffFile[] = [];
  for (const file of files) {
    const rest = file.path.slice(prefix.length), slash = rest.indexOf('/');
    if (slash < 0) leaves.push(file);
    else {
      const name = rest.slice(0, slash), children = folders.get(name);
      if (children) children.push(file); else folders.set(name, [file]);
    }
  }
  return <SidebarMenu aria-label={prefix || 'Changed file tree'}>
    {[...folders].sort(([a], [b]) => a.localeCompare(b)).map(([name, children]) => <Collapsible defaultOpen key={name} asChild><SidebarMenuItem>
      {/* An expanded folder is a disclosure, so its resting background stays clear. */}
      <div className="not-hover:[--muted:transparent]"><CollapsibleTrigger asChild><Button variant="ghost" className="h-7 w-full justify-start" aria-label={prefix + name}>
        <ChevronRightIcon className="group-aria-expanded/button:rotate-90" /><FolderIcon /><span className="min-w-0 truncate">{name}</span>
      </Button></CollapsibleTrigger></div>
      <CollapsibleContent><div className="ms-4"><DiffTree session={session} files={children} selected={selected} choose={choose} prefix={`${prefix}${name}/`} /></div></CollapsibleContent>
    </SidebarMenuItem></Collapsible>)}
    {leaves.sort((a, b) => a.path.localeCompare(b.path)).map((file) => <SidebarMenuItem key={file.path}><div onContextMenu={(e) => {
      if (e.defaultPrevented) return;
      e.preventDefault();
      session.actions.showMenu(e.nativeEvent, [{ label: 'View diff', run: () => choose(file) }]);
    }}>
        <Button variant={selected === file.path ? 'secondary' : 'ghost'} className="h-7 w-full justify-start" aria-current={selected === file.path ? 'true' : undefined}
          aria-label={file.path} title={`${file.previousPath ? `${file.previousPath} → ` : ''}${file.path}\n${diffLabel(file.status)}`}
          onClick={() => choose(file)}>
          <span className="size-4 shrink-0" /><DiffStatus status={file.status} iconOnly /><span className="min-w-0 flex-1 truncate text-start">{file.path.slice(prefix.length)}</span>
          <span className="text-xs text-muted-foreground" title={diffLabel(file.status)}>{file.status}</span><DiffCounts additions={file.additions} deletions={file.deletions} />
        </Button>
    </div></SidebarMenuItem>)}
    {!files.length && <SidebarMenuItem><p className="p-2 text-xs text-muted-foreground">No files match</p></SidebarMenuItem>}
  </SidebarMenu>;
}
