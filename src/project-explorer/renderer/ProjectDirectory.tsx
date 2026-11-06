// shadcn File Tree composition and expanded-directory lifecycle (../README.md).
import { useEffect, useState } from 'react';
import { ChevronRightIcon, FolderIcon } from 'lucide-react';
import { Alert, AlertDescription, Collapsible, CollapsibleContent, CollapsibleTrigger, Button } from '@ui';
import type { ProjectFile } from '../ipc';
import type { ExplorerActions } from './actions';
import { FileIcon } from './FileIcon';

type Selection = { path: string | null; select(path: string): void };

export function ProjectDirectory({ actions, folder, selection, active = true }: { actions: ExplorerActions; folder: string; selection: Selection; active?: boolean }) {
  const [entries, setEntries] = useState<ProjectFile[]>([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!active) return;
    let mounted = true;
    const read = async () => {
      const result = await actions.readFolder(folder);
      if (!mounted) return;
      setLoaded(true);
      if (result.error !== undefined) setError(result.error);
      else { setError(''); setEntries(result.entries); }
    };
    void read();
    // Only mounted, expanded folders poll; no recursive watchers or background-project scans.
    const timer = setInterval(() => void read(), 3000);
    return () => { mounted = false; clearInterval(timer); };
  }, [actions, folder, active]);
  return <>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {!loaded && <p role="status" className="px-2 text-sm text-muted-foreground">Loading…</p>}
    {loaded && !error && entries.length === 0 && <p className="px-2 text-sm text-muted-foreground">Empty folder</p>}
    <div aria-label={folder} className="flex flex-col">
      {entries.map((entry) => <ProjectEntry key={entry.path} actions={actions} entry={entry} selection={selection} active={active} />)}
    </div>
  </>;
}

function ProjectEntry({ actions, entry, selection, active }: { actions: ExplorerActions; entry: ProjectFile; selection: Selection; active: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const open = async () => {
    selection.select(entry.path);
    const result = await actions.openFile(entry.path);
    setError(result.error ?? '');
  };
  const selected = selection.path === entry.path;
  const row = <Button variant={selected ? 'secondary' : 'ghost'} data-selected={selected} className="h-7 w-full justify-start" aria-label={entry.name} title={entry.path}
    onClick={() => selection.select(entry.path)}
    onDoubleClick={entry.directory ? undefined : () => void open()}
    onKeyDown={(e) => { if (!entry.directory && e.key === 'Enter') { e.preventDefault(); void open(); } }}>
    {entry.directory ? <ChevronRightIcon className={expanded ? 'size-4 rotate-90' : 'size-4'} /> : <span className="size-4 shrink-0" />}
    {entry.directory ? <FolderIcon /> : <FileIcon path={entry.path} />}<span className="truncate">{entry.name}</span>
  </Button>;
  return <div>
    <div onContextMenu={(e) => {
      if (e.defaultPrevented) return;
      e.preventDefault();
      selection.select(entry.path);
      actions.showMenu(e.nativeEvent, [{ label: 'Open', run: () => entry.directory ? setExpanded(true) : open() },
        ...!entry.directory && actions.openExternal ? [{ label: 'Open in System Application', run: () => actions.openExternal!(entry.path) }] : [],
        { label: 'Show in Folder', run: () => actions.showFile(entry.path) }]);
    }}>
      {entry.directory ? <Collapsible open={expanded} onOpenChange={setExpanded}>
        {/* Expanded folders only retain a resting background when selected. */}
        <div className="not-hover:[--muted:transparent]"><CollapsibleTrigger asChild>{row}</CollapsibleTrigger></div>
        <CollapsibleContent><div className="ms-4">{expanded && <ProjectDirectory actions={actions} folder={entry.path} selection={selection} active={active} />}</div></CollapsibleContent>
      </Collapsible> : row}
    </div>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
  </div>;
}
