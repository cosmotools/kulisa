// shadcn File Tree composition; directory loading: docs/tasks.md, The Resources panel.
import { useEffect, useState } from 'react';
import { ChevronRightIcon, FileIcon, FolderIcon } from 'lucide-react';
import { Alert, AlertDescription, Collapsible, CollapsibleContent, CollapsibleTrigger, Button } from '@ui';
import type { ProjectFile } from '../../../shared/types';
import { RightClickMenu } from '../Menus';

export function ProjectDirectory({ task, folder }: { task: string; folder: string }) {
  const [entries, setEntries] = useState<ProjectFile[]>([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    const read = async () => {
      const result = await kulisa.invoke('task:files', { key: task, folder });
      if (!active) return;
      setLoaded(true);
      if (result.error !== undefined) setError(result.error);
      else { setError(''); setEntries(result.entries); }
    };
    void read();
    // Only mounted, expanded folders poll; no recursive watchers or background-project scans.
    const timer = setInterval(() => void read(), 3000);
    return () => { active = false; clearInterval(timer); };
  }, [task, folder]);
  return <>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {!loaded && <p role="status" className="px-2 text-xs text-muted-foreground">Loading…</p>}
    {loaded && !error && entries.length === 0 && <p className="px-2 text-xs text-muted-foreground">Empty folder</p>}
    <div aria-label={folder} className="flex flex-col">
      {entries.map((entry) => <ProjectEntry key={entry.path} task={task} entry={entry} />)}
    </div>
  </>;
}

function ProjectEntry({ task, entry }: { task: string; entry: ProjectFile }) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');
  const open = async () => {
    const result = await kulisa.invoke('task:file-open', { key: task, file: entry.path });
    setError(result.error ?? '');
  };
  const row = <Button variant="ghost" size="sm" className="w-full justify-start" aria-label={entry.name} title={entry.path}
    onDoubleClick={entry.directory ? undefined : () => void open()}
    onKeyDown={(e) => { if (!entry.directory && e.key === 'Enter') { e.preventDefault(); void open(); } }}>
    {entry.directory ? <ChevronRightIcon className={expanded ? 'size-4 rotate-90' : 'size-4'} /> : <span className="size-4 shrink-0" />}
    {entry.directory ? <FolderIcon /> : <FileIcon />}<span className="truncate">{entry.name}</span>
  </Button>;
  return <div>
    <RightClickMenu items={() => [{ label: 'Open', run: () => entry.directory ? setExpanded(true) : open() },
      { label: 'Show in Folder', run: () => kulisa.invoke('file:show', entry.path) }]}>
      {entry.directory ? <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>{row}</CollapsibleTrigger>
        <CollapsibleContent><div className="ms-4">{expanded && <ProjectDirectory task={task} folder={entry.path} />}</div></CollapsibleContent>
      </Collapsible> : row}
    </RightClickMenu>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
  </div>;
}
