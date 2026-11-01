// The Resources panel of the grid (docs/tasks.md, The Resources panel).
import { useEffect, useMemo, useState } from 'react';
import { ChevronRightIcon, FileIcon, FilesIcon, FolderIcon, FolderTreeIcon, GripVerticalIcon, GitBranchIcon, GitCompareArrowsIcon, TerminalSquareIcon, Trash2Icon } from 'lucide-react';
import type { IDockviewPanelProps } from 'dockview-react';
import { useShallow } from 'zustand/react/shallow';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupAction, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuAction,
  Button, Collapsible, CollapsibleTrigger, CollapsibleContent, SidebarMenuButton, SidebarMenuItem, SidebarProvider } from '@ui';
import { ProjectDirectory, type ExplorerActions } from '../../../project-explorer/renderer';
import { menuAt } from '../../lib/menu';
import { RightClickMenu } from '../Menus';
import { shownTask, useWindow } from '../../lib/store';
import type { MenuItem } from '../../lib/menu';
import { startResourceDrag, selectResource, type ResourceParams } from '../../lib/grid';
import { sizeText } from '../../../shared/bytes';
import { Dictation } from '../../../dictation/renderer';
import { useShortcuts } from '../../lib/common';
import { focusDevelopmentTerminal, showDevelopmentTerminal } from '../../lib/development-terminals';
import { DevelopmentTerminalList } from './DevelopmentTerminalList';
import { Changes } from '../changes/Changes';

const language = new Intl.DisplayNames(['en'], { type: 'language' });
const KINDS: Record<string, string> = { screenshot: 'Screenshot', snapshot: 'Snapshot', request: 'Request body', response: 'Response body', terminal: 'Terminal screen' };
const kindOf = (kind: string) => KINDS[kind] ?? kind;
const day = (t: number) => new Date(t).toDateString();
const when = (t: number) => (day(t) === day(Date.now()) ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  : new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' }));
const openFile = (file: string) => kulisa.invoke('file:open', file);

export function Resources({ api, params, containerApi }: IDockviewPanelProps<ResourceParams>) {
  const key = useWindow((s) => shownTask(s)?.key);
  const front = useWindow((s) => s.developmentTerminals.front), lang = useWindow((s) => s.language?.language);
  const hold = useShortcuts().find((s) => s.id === 'voice.hold')?.keys[0] || '';
  const section = params.section === undefined ? 'project' : params.section;
  const [barSide, setBarSide] = useState<'left' | 'right'>('left');
  useEffect(() => {
    const update = () => {
      const resources = api.group.api.boundingBox, terminal = containerApi.getPanel('terminal')?.group.api.boundingBox;
      setBarSide(resources && terminal && resources.left >= terminal.left + terminal.width ? 'right' : 'left');
    };
    const layout = containerApi.onDidLayoutChange(update);
    update();
    return () => layout.dispose();
  }, [api, containerApi]);
  return <aside id="resources" aria-label="The task's resources" data-bar-side={barSide} className="flex h-full min-h-0 min-w-0 data-[bar-side=right]:flex-row-reverse">
    <nav aria-label="Resources" className={`flex w-10 shrink-0 flex-col items-center gap-1 py-2 ${barSide === 'right' ? 'border-l' : 'border-r'}`}>
      {([['terminals', 'Agents', TerminalSquareIcon], ['project', 'Project', FolderTreeIcon], ['changes', 'Changes', GitCompareArrowsIcon], ['artifacts', 'Artifacts', FilesIcon]] as const).map(([value, label, Icon]) =>
        <Button key={value} variant="ghost" size="icon-sm" aria-label={label} title={label}
          aria-expanded={section === value} aria-controls="resource-content" onClick={() => {
            selectResource(api, params, value);
            if (value === 'terminals') focusDevelopmentTerminal();
          }}><Icon /></Button>)}
      <div className="mt-auto flex flex-col items-center gap-1">
        <Dictation task={key ?? null} keyName={hold} language={lang ? language.of(lang) ?? '' : ''}
          onDone={() => { if (front !== null) void showDevelopmentTerminal(front); }} />
        <div className="[&_button]:cursor-grab [&_button]:active:cursor-grabbing">
          <Button variant="ghost" size="icon-sm" draggable aria-label="Move Resources panel" title="Move Resources panel"
            onDragStart={(e) => startResourceDrag(api, e.nativeEvent)}><GripVerticalIcon /></Button>
        </div>
      </div>
    </nav>
    {section && key && <div id="resource-content" role="region" aria-label={section === 'project' ? 'Project' : section === 'artifacts' ? 'Artifacts' : section === 'changes' ? 'Changes' : 'Agents'} className="min-h-0 min-w-0 flex-1">
      <TaskResources key={key} taskKey={key} section={section} />
    </div>}
  </aside>;
}

function TaskResources({ taskKey: key, section }: { taskKey: string; section: NonNullable<ResourceParams['section']> }) {
  const task = useWindow((s) => shownTask(s));
  const explorer = useMemo<ExplorerActions>(() => ({
    readFolder: (folder) => kulisa.invoke('task:files', { key, folder }),
    openFile: (file) => kulisa.invoke('task:file-open', { key, file }),
    showFile: (file) => kulisa.invoke('file:show', file),
    showMenu: menuAt,
  }), [key]);
  const artifacts = useWindow((s) => (s.artifacts.task === key ? s.artifacts.list : null)) ?? [];
  const bytes = useWindow((s) => s.artifacts.bytes);
  const names = useWindow(useShallow((s) => Object.fromEntries([...s.profiles, ...s.closedProfiles].map((p) => [p.id, p.name]))));
  const stageTerminals = useWindow(useShallow((s) => Object.fromEntries(s.stageTerminals.map((a) => [a.id, a.name]))));
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
  const lines = (name: string, line: string) => <span className="flex min-w-0 flex-1 flex-col text-start">
    <span className="truncate">{name}</span><span className="truncate text-xs text-muted-foreground">{line}</span>
  </span>;
  return <SidebarProvider className="h-full min-h-0">
      <Sidebar collapsible="none" className="h-full w-full">
        {section === 'terminals' && <DevelopmentTerminalList />}
        {section === 'changes' && <Changes task={key} roots={task.resources} />}
        {section === 'project' && <div className="h-full overflow-auto"><SidebarContent>
          <SidebarGroup><SidebarGroupContent>
            <SidebarMenu aria-label="Folders">
              {task.resources.map((r) => <SidebarMenuItem key={r.folder}><RightClickMenu items={() => [{ label: 'Open Folder', run: () => open(r.folder) }, ...(r.removable ? [{ label: 'Remove Repository', run: () => remove(r.folder) }] : [])]}><Collapsible defaultOpen>
                <CollapsibleTrigger asChild><Button variant="ghost" aria-label={r.label} title={r.folder} className="h-auto w-full justify-start not-hover:[--muted:transparent]" onDoubleClick={() => void open(r.folder)}>
                  <ChevronRightIcon className="group-aria-expanded/button:rotate-90" />
                  {r.kind === 'maintree' ? <FolderIcon /> : <GitBranchIcon />}
                  {lines(r.label, r.branch ? `branch ${r.branch}` : 'main working tree')}
                </Button></CollapsibleTrigger>
                {r.removable && <SidebarMenuAction showOnHover aria-label="Remove Repository" title="Remove Repository" onClick={() => void remove(r.folder)}>
                  <Trash2Icon /></SidebarMenuAction>}
                <CollapsibleContent><div className="ms-4"><ProjectDirectory actions={explorer} folder={r.folder} /></div></CollapsibleContent>
              </Collapsible></RightClickMenu></SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent></SidebarGroup>
          </SidebarContent></div>}
          {section === 'artifacts' && <div className="h-full overflow-auto"><SidebarContent>
          {artifacts.length === 0 && <p className="p-3 text-sm text-muted-foreground">No artifacts yet</p>}
          {artifacts.length > 0 && <SidebarGroup>
            <SidebarGroupLabel>Artifacts ·&nbsp;<span data-testid="artifacts-size">{sizeText(bytes)}</span></SidebarGroupLabel>
            <SidebarGroupAction aria-label="Delete All Artifacts" title="Delete All Artifacts" onClick={() => void deleteArtifacts(null)}><Trash2Icon /></SidebarGroupAction>
            <SidebarGroupContent>
              <RightClickMenu items={menu}>
                <SidebarMenu aria-label="Artifacts">
                  {artifacts.map((a) => <SidebarMenuItem key={a.file}>
                    <div className="rounded-md hover:bg-sidebar-accent">
                      <SidebarMenuButton data-file={a.file} aria-label={kindOf(a.kind)} title={`Open: ${a.file} (${sizeText(a.bytes)})`} className="h-auto"
                        draggable onDragStart={(e) => { e.preventDefault(); void kulisa.invoke('task:artifact-drag', { key: task.key, file: a.file }); }}
                        onClick={() => void openFile(a.file)}>
                        {/* a page's head: where its picture is cut */}
                        {a.thumb ? <img src={a.thumb} draggable={false} alt="" className="size-8 rounded-sm border object-cover object-top" /> : <FileIcon />}
                        {lines(kindOf(a.kind), [a.source.kind === 'profile' ? names[a.source.id] : stageTerminals[a.source.id], when(a.time), sizeText(a.bytes)].filter(Boolean).join(' · '))}
                      </SidebarMenuButton>
                      <SidebarMenuAction showOnHover className="!top-0 bottom-0 my-auto size-5" aria-label={`Delete ${kindOf(a.kind)}`} title={`Delete ${kindOf(a.kind)}`}
                        onClick={() => void deleteArtifacts([a.file])}><Trash2Icon /></SidebarMenuAction>
                    </div>
                  </SidebarMenuItem>)}
                </SidebarMenu>
              </RightClickMenu>
            </SidebarGroupContent>
          </SidebarGroup>}
        </SidebarContent></div>}
      </Sidebar>
    </SidebarProvider>;
}
