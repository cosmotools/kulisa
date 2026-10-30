// The Resources panel of the grid, and its header (docs/tasks.md, The Resources panel).
import { useEffect } from 'react';
import { FileIcon, FolderIcon, GitBranchIcon, Trash2Icon } from 'lucide-react';
import type { IDockviewPanelHeaderProps } from 'dockview-react';
import { useShallow } from 'zustand/react/shallow';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupAction, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuAction,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider } from '@ui';
import { RightClickMenu } from '../Menus';
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
  // The list comes when the task is shown and whenever the human or agent keeps one (window.ts, sendArtifacts).
  useEffect(() => { if (key) void kulisa.invoke('task:artifacts', key); }, [key]);
  if (!task) return null;
  const open = (folder: string) => kulisa.invoke('task:open-folder', { key: task.key, folder });
  const remove = (folder: string) => kulisa.invoke('task:remove-repo', { key: task.key, repo: folder });
  const deleteArtifacts = (files: string[] | null) => kulisa.invoke('task:artifacts-delete', { key: task.key, files });
  const menu = (e: MouseEvent): MenuItem[] | null => {
    const file = (e.target as Element).closest<HTMLElement>('[data-file]')?.dataset.file;
    return file ? [{ label: 'Open', run: () => openFile(file) }, { label: 'Show in Folder', run: () => kulisa.invoke('file:show', file) },
      { label: 'Send to Agent', run: () => kulisa.invoke('task:artifact-send', { key: task.key, file }) }, '-',
      { label: 'Delete', run: () => deleteArtifacts([file]) }] : null;
  };
  // A row: its icon, its name and a muted line under it, as a task's in the sidebar.
  const lines = (name: string, line: string) => <span className="flex min-w-0 flex-1 flex-col">
    <span className="truncate">{name}</span><span className="truncate text-xs text-muted-foreground">{line}</span>
  </span>;
  return <aside id="resources" aria-label="The task's resources" className="h-full min-h-0">
    <SidebarProvider className="h-full min-h-0">
      <Sidebar collapsible="none" className="h-full w-full">
        <SidebarContent>
          <SidebarGroup><SidebarGroupContent>
            <SidebarMenu aria-label="Folders">
              {task.resources.map((r) => <SidebarMenuItem key={r.folder}>
                <SidebarMenuButton aria-label={r.label} title={`Open Folder: ${r.folder}`} className="h-auto" onClick={() => void open(r.folder)}>
                  {r.kind === 'maintree' ? <FolderIcon /> : <GitBranchIcon />}
                  {lines(r.label, r.branch ? `branch ${r.branch}` : 'main working tree')}
                </SidebarMenuButton>
                {r.removable && <SidebarMenuAction showOnHover aria-label="Remove Repository" title="Remove Repository" onClick={() => void remove(r.folder)}>
                  <Trash2Icon /></SidebarMenuAction>}
              </SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent></SidebarGroup>
          {artifacts.length > 0 && <SidebarGroup>
            <SidebarGroupLabel>Artifacts ·&nbsp;<span data-testid="artifacts-size">{sizeText(bytes)}</span></SidebarGroupLabel>
            <SidebarGroupAction aria-label="Delete All Artifacts" title="Delete All Artifacts" onClick={() => void deleteArtifacts(null)}><Trash2Icon /></SidebarGroupAction>
            <SidebarGroupContent>
              <RightClickMenu items={menu}>
                <SidebarMenu aria-label="Artifacts">
                  {artifacts.map((a) => <SidebarMenuItem key={a.file}>
                    <SidebarMenuButton data-file={a.file} aria-label={kindOf(a.kind)} title={`Open: ${a.file} (${sizeText(a.bytes)})`} className="h-auto"
                      draggable onDragStart={(e) => { e.preventDefault(); void kulisa.invoke('task:artifact-drag', { key: task.key, file: a.file }); }}
                      onClick={() => void openFile(a.file)}>
                      {/* a page's head: where its picture is cut */}
                      {a.thumb ? <img src={a.thumb} draggable={false} alt="" className="size-8 rounded-sm border object-cover object-top" /> : <FileIcon />}
                      {lines(kindOf(a.kind), [names[a.profile], when(a.time)].filter(Boolean).join(' · '))}
                    </SidebarMenuButton>
                  </SidebarMenuItem>)}
                </SidebarMenu>
              </RightClickMenu>
            </SidebarGroupContent>
          </SidebarGroup>}
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  </aside>;
}

// The panel is dragged by its header.
export function ResourcesHeader({ api }: IDockviewPanelHeaderProps) {
  return <div data-panel={api.id} className="flex h-full min-w-0 items-center px-2">
    <span className="min-w-0 truncate">{api.title}</span>
  </div>;
}
