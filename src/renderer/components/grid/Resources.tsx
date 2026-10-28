// The Resources panel of the grid, and its header (docs/tasks.md, The Resources panel).
import { useEffect } from 'react';
import { FileIcon, FolderIcon, GitBranchIcon, Trash2Icon } from 'lucide-react';
import type { IDockviewPanelHeaderProps } from 'dockview-react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@ui';
import { RightClickMenu } from '../Menus';
import { IconText } from './IconText';
import { shownTask, useWindow } from '../../lib/store';
import type { MenuItem } from '../../lib/menu';
import { sizeText } from '../../../shared/bytes';

const KINDS: Record<string, string> = { screenshot: 'Screenshot', snapshot: 'Snapshot', request: 'Request body', response: 'Response body' };
const kindOf = (kind: string) => KINDS[kind] ?? kind;
const day = (t: number) => new Date(t).toDateString();
const when = (t: number) => (day(t) === day(Date.now()) ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  : new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' }));
const openFile = (file: string) => kulisa.invoke('file:open', file);

export function Resources() {
  const task = useWindow((s) => shownTask(s));
  const key = task?.key;
  const artifacts = useWindow((s) => (s.artifacts.task === key ? s.artifacts.list : null)) ?? [];
  const bytes = useWindow((s) => s.artifacts.bytes);
  const names = useWindow(useShallow((s) => Object.fromEntries([...s.profiles, ...s.closedProfiles].map((p) => [p.id, p.name]))));
  // The list comes when the task is shown and whenever its agent keeps one (window.ts, sendArtifacts).
  useEffect(() => { if (key) void kulisa.invoke('task:artifacts', key); }, [key]);
  if (!task) return null;
  const open = (folder: string) => kulisa.invoke('task:open-folder', { key: task.key, folder });
  const remove = (folder: string) => kulisa.invoke('task:remove-repo', { key: task.key, repo: folder });
  const deleteArtifacts = (files: string[] | null) => kulisa.invoke('task:artifacts-delete', { key: task.key, files });
  const menu = (e: MouseEvent): MenuItem[] | null => {
    const file = (e.target as Element).closest<HTMLElement>('[data-file]')?.dataset.file;
    return file ? [{ label: 'Open', run: () => openFile(file) }, { label: 'Show in Folder', run: () => kulisa.invoke('file:show', file) }, '-',
      { label: 'Delete', run: () => deleteArtifacts([file]) }] : null;
  };
  return <aside id="resources" aria-label="The task's resources" className="h-full overflow-y-auto px-2 pb-2">
    <ul aria-label="Folders" className="flex flex-col">
      {task.resources.map((r) => <li key={r.folder} className="flex items-center gap-0.5">
        <Button variant="ghost" aria-label={r.label} title={`Open Folder: ${r.folder}`} className="h-auto min-w-0 flex-1 justify-start" onClick={() => void open(r.folder)}>
          <IconText icon={r.kind === 'maintree' ? <FolderIcon /> : <GitBranchIcon />} name={r.label} line={r.branch ? `branch ${r.branch}` : 'main working tree'} />
        </Button>
        {r.removable && <Button variant="ghost" size="icon-sm" aria-label="Remove Repository" title="Remove Repository" onClick={() => void remove(r.folder)}>
          <Trash2Icon />
        </Button>}
      </li>)}
    </ul>
    {artifacts.length > 0 && <>
      <div className="mt-2 mb-0.5 flex items-center gap-2 ps-2.5">
        <h3 className="text-xs font-medium text-muted-foreground">Artifacts</h3>
        <span data-testid="artifacts-size" className="ms-auto text-xs text-muted-foreground">{sizeText(bytes)}</span>
        <Button variant="ghost" size="icon-sm" aria-label="Delete All Artifacts" title="Delete All Artifacts" onClick={() => void deleteArtifacts(null)}>
          <Trash2Icon />
        </Button>
      </div>
      <RightClickMenu items={menu}>
        <ul aria-label="Artifacts" className="flex flex-col">
          {artifacts.map((a) => <li key={a.file} className="flex">
            <Button variant="ghost" data-file={a.file} aria-label={kindOf(a.kind)} title={`Open: ${a.file} (${sizeText(a.bytes)})`}
              className="h-auto min-w-0 flex-1 justify-start" onClick={() => void openFile(a.file)}>
              {/* a page's head: where its picture is cut */}
              <IconText icon={a.thumb ? <img src={a.thumb} alt="" className="size-8 rounded-sm border object-cover object-top" /> : <FileIcon />}
                name={kindOf(a.kind)} line={[names[a.profile], when(a.time)].filter(Boolean).join(' · ')} />
            </Button>
          </li>)}
        </ul>
      </RightClickMenu>
    </>}
  </aside>;
}

// The panel is dragged by its header.
export function ResourcesHeader({ api }: IDockviewPanelHeaderProps) {
  return <div data-panel={api.id} className="flex h-full min-w-0 items-center px-2">
    <span className="min-w-0 truncate">{api.title}</span>
  </div>;
}
