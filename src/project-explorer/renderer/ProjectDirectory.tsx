// shadcn File Tree composition and expanded-directory lifecycle (../README.md).
import { useEffect, useState } from 'react';
import { ChevronRightIcon } from 'lucide-react';
import { Alert, AlertDescription, Collapsible, CollapsibleContent, CollapsibleTrigger, Button } from '@ui';
import type { ProjectFile } from '../ipc';
import type { ExplorerActions } from './actions';
import { FileIcon } from './FileIcon';

export function ProjectDirectory({ actions, folder }: { actions: ExplorerActions; folder: string }) {
  const [entries, setEntries] = useState<ProjectFile[]>([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    const read = async () => {
      const result = await actions.readFolder(folder);
      if (!active) return;
      setLoaded(true);
      if (result.error !== undefined) setError(result.error);
      else { setError(''); setEntries(result.entries); }
    };
    void read();
    // Only mounted, expanded folders poll; no recursive watchers or background-project scans.
    const timer = setInterval(() => void read(), 3000);
    return () => { active = false; clearInterval(timer); };
  }, [actions, folder]);
  return <>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {!loaded && <p role="status" className="px-2 text-xs text-muted-foreground">Loading…</p>}
    {loaded && !error && entries.length === 0 && <p className="px-2 text-xs text-muted-foreground">Empty folder</p>}
    <div aria-label={folder} className="flex flex-col">
      {entries.map((entry) => <ProjectEntry key={entry.path} actions={actions} entry={entry} />)}
    </div>
  </>;
}

function ProjectEntry({ actions, entry }: { actions: ExplorerActions; entry: ProjectFile }) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const open = async () => {
    const result = await actions.openFile(entry.path);
    setError(result.error ?? '');
  };
  const row = <Button variant="ghost" className="h-7 w-full justify-start" aria-label={entry.name} title={entry.path}
    onDoubleClick={entry.directory ? undefined : () => void open()}
    onKeyDown={(e) => { if (!entry.directory && e.key === 'Enter') { e.preventDefault(); void open(); } }}>
    {entry.directory ? <ChevronRightIcon className={expanded ? 'size-4 rotate-90' : 'size-4'} /> : <span className="size-4 shrink-0" />}
    <FileIcon path={entry.path} directory={entry.directory} expanded={expanded} /><span className="truncate">{entry.name}</span>
  </Button>;
  return <div>
    <div onContextMenu={(e) => {
      if (e.defaultPrevented) return;
      e.preventDefault();
      actions.showMenu(e.nativeEvent, [{ label: 'Open', run: () => entry.directory ? setExpanded(true) : open() },
        { label: 'Show in Folder', run: () => actions.showFile(entry.path) }]);
    }}>
      {entry.directory ? <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>{row}</CollapsibleTrigger>
        <CollapsibleContent><div className="ms-4">{expanded && <ProjectDirectory actions={actions} folder={entry.path} />}</div></CollapsibleContent>
      </Collapsible> : row}
    </div>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
  </div>;
}
