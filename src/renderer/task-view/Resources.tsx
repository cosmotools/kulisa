// Workbench Activity bar and Side bar (docs/tasks.md, The Workbench).
import { useEffect, useMemo, useState } from 'react';
import { FileIcon, FilesIcon, FolderTreeIcon, GitBranchIcon, GitCompareArrowsIcon, TerminalSquareIcon, Trash2Icon } from 'lucide-react';
import type { IDockviewPanelProps, IDockviewPanelHeaderProps, IDockviewHeaderActionsProps } from 'dockview-react';
import { useShallow } from 'zustand/react/shallow';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupAction, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuAction,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider } from '@ui';
import { ProjectTree, type ExplorerActions } from '../../project-explorer/renderer';
import { menuAt } from '../lib/menu';
import { RightClickMenu } from '../components/Menus';
import { shownTask, useWindow } from '../lib/store';
import { useTask, useTaskActive, useTaskGrid } from './state';
import type { MenuItem } from '../lib/menu';
import { activityItems, type ActivityItem } from './development';
import { sizeText } from '../../shared/bytes';
import { Dictation } from '../../dictation/renderer';
import { useShortcuts } from '../lib/common';
import { focusDevelopmentTerminal, showDevelopmentTerminal } from './terminals';
import { DevelopmentTerminalList } from './DevelopmentTerminalList';
import { TaskDiffTree } from './Diff';

const language = new Intl.DisplayNames(['en'], { type: 'language' });
const KINDS: Record<string, string> = { screenshot: 'Screenshot', snapshot: 'Snapshot', request: 'Request body', response: 'Response body', terminal: 'Terminal screen' };
const kindOf = (kind: string) => KINDS[kind] ?? kind;
const day = (t: number) => new Date(t).toDateString();
const when = (t: number) => (day(t) === day(Date.now()) ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  : new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' }));
const openFile = (file: string) => kulisa.invoke('file:open', file);

export function ResourceIcon({ params }: IDockviewPanelHeaderProps<{ section: ActivityItem }>) {
  const Icon = { terminals: TerminalSquareIcon, project: FolderTreeIcon, diff: GitCompareArrowsIcon, artifacts: FilesIcon }[params.section];
  return <span title={activityItems[params.section]} className="grid h-10 w-full place-items-center"><Icon className="size-4" /></span>;
}
export function ResourceActions({ api, group, location }: IDockviewHeaderActionsProps) {
  const key = useTask((s) => s.key);
  useEffect(() => {
    if (location?.type !== 'edge') return;
    void kulisa.invoke('task:artifact:refresh', key);
    const focus = () => { if (!api.isCollapsed() && group.activePanel?.params?.section === 'terminals') focusDevelopmentTerminal(key); };
    const selected = api.onDidActivePanelChange(({ panel, origin }) => {
      if (origin === 'user' && panel?.params?.section === 'terminals') focusDevelopmentTerminal(key);
    });
    const expanded = api.onDidCollapsedChange(focus);
    return () => { selected.dispose(); expanded.dispose(); };
  }, [api, group, location?.type, key]);
  return location?.type === 'edge' ? <div className="grid place-items-center py-1"><TaskDictation /></div> : null;
}
export function Resources({ api, params }: IDockviewPanelProps<{ section: ActivityItem }>) {
  const [visible, setVisible] = useState(api.isVisible && !api.group.api.isCollapsed());
  useEffect(() => {
    const update = () => setVisible(api.isVisible && !api.group.api.isCollapsed());
    const shown = api.onDidVisibilityChange(update), collapsed = api.group.api.onDidCollapsedChange(update);
    update();
    return () => { shown.dispose(); collapsed.dispose(); };
  }, [api]);
  return visible ? <TaskResources section={params.section} /> : null;
}

function TaskDictation() {
  const key = useTask((s) => s.key), front = useTask((s) => s.developmentTerminals.front);
  const active = useTaskActive(), lang = useWindow((s) => s.language?.language);
  const hold = useShortcuts().find((s) => s.id === 'voice.hold')?.keys[0] || '';
  return <Dictation task={active ? key : null} keyName={hold} language={lang ? language.of(lang) ?? '' : ''}
    onDone={() => { if (front !== null) void showDevelopmentTerminal(key, front); }} />;
}

function TaskResources({ section }: { section: ActivityItem }) {
  const grid = useTaskGrid();
  const key = useTask((s) => s.key);
  const task = useWindow((s) => shownTask(s, key));
  const active = useTaskActive();
  const explorer = useMemo<ExplorerActions>(() => ({
    openFolder: (folder) => kulisa.invoke('task:open-folder', { key, folder }),
    folderMenu: (folder) => [{ label: 'Open Folder', run: () => kulisa.invoke('task:open-folder', { key, folder }) },
      ...(shownTask(undefined, key)?.resources.find((r) => r.folder === folder)?.removable
        ? [{ label: 'Remove Repository', run: () => kulisa.invoke('task:repo:remove', { key, repo: folder }) }] : [])],
    readFolder: (folder) => kulisa.invoke('task:file:list', { key, folder }),
    readGitStatus: (folder) => kulisa.invoke('task:file:status', { key, folder }),
    openFile: (file) => grid.development.editor.open(file),
    openExternal: (file) => kulisa.invoke('task:file:open', { key, file }),
    showFile: (file) => kulisa.invoke('file:show', file),
    showMenu: menuAt,
  }), [key, grid]);
  const artifacts = useTask((s) => s.artifacts.list);
  const bytes = useTask((s) => s.artifacts.bytes);
  const names = useTask(useShallow((s) => Object.fromEntries([...s.profiles, ...s.closedProfiles].map((p) => [p.id, p.name]))));
  const stageTerminals = useTask(useShallow((s) => Object.fromEntries(s.stageTerminals.map((a) => [a.id, a.name]))));
  const branch = task?.resources.find((r) => r.branch)?.branch ?? null;
  const roots = useMemo(() => (task?.resources ?? []).map((r) => ({ folder: r.folder, label: r.label,
    caption: r.branch === branch ? '' : r.branch ? `branch ${r.branch}` : 'main working tree' })), [task?.resources, branch]);
  if (!task) return null;
  const deleteArtifacts = (files: string[] | null) => kulisa.invoke('task:artifact:delete', { key: task.key, files });
  const menu = (e: MouseEvent): MenuItem[] | null => {
    const file = (e.target as Element).closest<HTMLElement>('[data-file]')?.dataset.file;
    return file ? [{ label: 'Open', run: () => openFile(file) }, { label: 'Show in Folder', run: () => kulisa.invoke('file:show', file) },
      { label: 'Send to Agent', run: () => kulisa.invoke('task:artifact:send', { key: task.key, file }) }, '-',
      { label: 'Delete', run: () => deleteArtifacts([file]) }] : null;
  };
  // A row: its icon, its name and a muted line under it, as a task's in the sidebar.
  const lines = (name: string, line: string) => <span className="flex min-w-0 flex-1 flex-col text-start">
    <span className="truncate">{name}</span><span className="truncate text-xs text-muted-foreground">{line}</span>
  </span>;
  return <SidebarProvider data-resources className="h-full min-h-0">
      <Sidebar collapsible="none" className="w-full">
        {section === 'terminals' && <DevelopmentTerminalList />}
        {section === 'diff' && <TaskDiffTree roots={task.resources} />}
        {section === 'project' && <ProjectTree actions={explorer} roots={roots} active={active}
          header={<div className="flex min-w-0 items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
            <GitBranchIcon className="size-4 shrink-0" /><span className="truncate" title={branch ? `branch ${branch}` : 'main working tree'}>
              {branch ? `branch ${branch}` : 'main working tree'}</span>
          </div>} />}
          {section === 'artifacts' && <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Artifacts ·&nbsp;<span data-testid="artifacts-size">{sizeText(bytes)}</span></SidebarGroupLabel>
            {artifacts.length > 0 && <SidebarGroupAction aria-label="Delete All Artifacts" title="Delete All Artifacts" onClick={() => void deleteArtifacts(null)}><Trash2Icon /></SidebarGroupAction>}
            <SidebarGroupContent>
              {!artifacts.length && <p className="p-2 text-sm text-muted-foreground">No artifacts yet</p>}
              <RightClickMenu items={menu}>
                <SidebarMenu aria-label="Artifacts">
                  {artifacts.map((a) => <SidebarMenuItem key={a.file}>
                    <div className="rounded-md hover:bg-sidebar-accent">
                      <SidebarMenuButton data-file={a.file} aria-label={kindOf(a.kind)} title={`Open: ${a.file} (${sizeText(a.bytes)})`} className="h-auto"
                        draggable onDragStart={(e) => { e.preventDefault(); void kulisa.invoke('task:artifact:drag', { key: task.key, file: a.file }); }}
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
          </SidebarGroup>
        </SidebarContent>}
      </Sidebar>
    </SidebarProvider>;
}
