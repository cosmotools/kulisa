// Workbench Activity bar and Side bar (docs/tasks.md, The Workbench).
import { useEffect, useMemo, useState } from 'react';
import { FilesIcon, FolderOpenIcon, FolderTreeIcon, GitBranchIcon, GitCompareArrowsIcon, TerminalSquareIcon, Trash2Icon } from 'lucide-react';
import type { IDockviewPanelProps, IDockviewPanelHeaderProps, IDockviewHeaderActionsProps } from 'dockview-react';
import { useShallow } from 'zustand/react/shallow';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupAction, SidebarGroupLabel, SidebarProvider } from '@ui';
import { ProjectTree, type ExplorerActions } from '../../project-explorer/renderer';
import { menuAt } from '../lib/menu';
import { ArtifactTree } from '../../task-files/renderer';
import { shownTask, useWindow } from '../lib/store';
import { useTask, useTaskActive, useTaskGrid } from './state';
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
  const selectedArtifact = useTask((s) => s.selectedArtifact);
  const artifactNavigation = useTask((s) => s.artifactNavigation);
  const selectedPath = artifacts.find((a) => a.file === selectedArtifact)?.path ?? null;
  const bytes = useTask((s) => s.artifacts.bytes);
  const names = useTask(useShallow((s) => Object.fromEntries([...s.profiles, ...s.closedProfiles].map((p) => [p.id, p.name]))));
  const stageTerminals = useTask(useShallow((s) => Object.fromEntries(s.stageTerminals.map((a) => [a.id, a.name]))));
  const branch = task?.resources.find((r) => r.branch)?.branch ?? null;
  const roots = useMemo(() => (task?.resources ?? []).map((r) => ({ folder: r.folder, label: r.label,
    caption: r.branch === branch ? '' : r.branch ? `branch ${r.branch}` : 'main working tree' })), [task?.resources, branch]);
  const entries = useMemo(() => artifacts.map((a) => ({ path: a.path, time: a.time, thumb: a.thumb,
    caption: a.directory ? '' : [a.kind === 'file' ? null : kindOf(a.kind), a.source?.kind === 'profile' ? names[a.source.id] : a.source?.kind === 'stage-terminal' ? stageTerminals[a.source.id] : null, when(a.time), sizeText(a.bytes)].filter(Boolean).join(' · '),
  })), [artifacts, names, stageTerminals]);
  const artifactActions = useMemo(() => {
    const fileAt = (path: string) => artifacts.find((a) => a.path === path)?.file;
    return {
      thumbnails: (paths: string[]) => {
        const files = paths.map(fileAt).filter((file): file is string => !!file);
        if (files.length) void kulisa.invoke('task:artifact:thumbnails', { key, files });
      },
      open: (path: string) => { const file = fileAt(path); if (file) void kulisa.invoke('task:artifact:view', { key, file }); },
      drag: (path: string) => { const file = fileAt(path); if (file) void kulisa.invoke('task:artifact:drag', { key, file }); },
      menu: (path: string, at: { clientX: number; clientY: number }) => {
        const file = fileAt(path); if (!file) return;
        const directory = artifacts.find((a) => a.file === file)?.directory;
        menuAt(at, [{ label: 'Open', run: () => kulisa.invoke(directory ? 'task:artifact:open' : 'task:artifact:view', { key, file }) },
          ...(!directory ? [{ label: 'Open in System Application', run: () => kulisa.invoke('task:artifact:open', { key, file }) }] : []), { label: 'Show in Folder', run: () => kulisa.invoke('file:show', file) },
          { label: 'Send to Agent', run: () => kulisa.invoke('task:artifact:send', { key, file }) }, '-',
          { label: 'Delete', run: () => kulisa.invoke('task:artifact:delete', { key, files: [file] }) }]);
      },
    };
  }, [artifacts, key]);
  if (!task) return null;
  const folders = async (at: { clientX: number; clientY: number }) => {
    const list = await kulisa.invoke('task:files:folders', key);
    if (!list.length) return;
    menuAt(at, [{ label: 'Open Artifacts Folder', run: () => kulisa.invoke('task:files:open', { key, folder: list[0]!.folder }) },
      { submenu: 'Temporary Files', items: list.slice(1).map((a) => ({ label: a.name, run: () => kulisa.invoke('task:files:open', { key, folder: a.folder }) })) }]);
  };
  const deleteArtifacts = (files: string[] | null) => kulisa.invoke('task:artifact:delete', { key: task.key, files });
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
            <SidebarGroupAction className="right-9" aria-label="File Folders" title="File Folders" onClick={(e) => { void folders({ clientX: e.clientX, clientY: e.clientY }); }}><FolderOpenIcon /></SidebarGroupAction>
            {artifacts.length > 0 && <SidebarGroupAction aria-label="Delete All Artifacts" title="Delete All Artifacts" onClick={() => void deleteArtifacts(null)}><Trash2Icon /></SidebarGroupAction>}
          </SidebarGroup>
          {!artifacts.length && <p className="p-2 text-sm text-muted-foreground">No artifacts yet</p>}
          <div className="min-h-0 flex-1"><ArtifactTree entries={entries} actions={artifactActions} selectedPath={selectedPath} selectionVersion={artifactNavigation} /></div>
        </SidebarContent>}
      </Sidebar>
    </SidebarProvider>;
}
