// The sidebar (docs/tasks.md, The sidebar): every project with its tasks, any task one click away, the project worked in
// last first (lib/common.ts, lastWorked); New Project… at its foot. shadcn's Sidebar: docked in the empty window; in a
// Sheet over the grid while a task is shown (the title bar's button, Ctrl+Shift+A; Esc or a choice closes it).
import { useEffect, useRef, useState } from 'react';
import { ChevronRightIcon, FolderPlusIcon, PanelLeftIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Badge, Button, Collapsible, CollapsibleContent, CollapsibleTrigger, Kbd, Sheet, SheetContent, SheetDescription, SheetTitle, Sidebar as Bar,
  SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupAction, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu,
  SidebarMenuAction, SidebarMenuButton, SidebarMenuItem, SidebarProvider } from '@ui';
import { ProjectIcon } from './ProjectIcon';
import { AgentState } from './AgentState';
import { RightClickMenu } from './Menus';
import { Tip } from './Tip';
import { store, useWindow } from '../lib/store';
import { sidebarDocked, sidebarOverlay, toggleSidebar } from '../lib/sidebar';
import { dialog } from '../lib/dialogs';
import { openSettings } from '../lib/settings';
import { keyText, lastWorked, taskLine, withKeys } from '../lib/common';
import type { MenuItem } from '../lib/menu';
import type { ProjectEntry, ProjectTask } from '../../shared/types';

// What a choice in it does; over the grid it closes then.
const newTask = (p: ProjectEntry) => kulisa.invoke('project:open', { id: p.id }); // its project loaded, open or not
const openTask = (p: ProjectEntry, t: ProjectTask) => (t.closed ? kulisa.invoke('project:open', { id: p.id, task: t.id }) : kulisa.invoke('task:show', `${p.id}/${t.id}`));
const deleteTask = (p: ProjectEntry, t: ProjectTask) => (t.closed ? kulisa.invoke('task:delete-closed', { project: p.id, id: t.id }) : kulisa.invoke('task:delete', `${p.id}/${t.id}`));
const newProject = () => dialog('newproject').then((d) => d.open());

// A project's menu (its right-click): what is not one task's. What needs it loaded (a task of it open somewhere) only then.
function projectItems(p: ProjectEntry, done: () => void): MenuItem[] {
  const loaded = store.getState().projects.open.some((x) => x.id === p.id), open = p.tasks.some((t) => !t.closed);
  const merged = loaded && p.tasks.some((t) => t.closed && t.merged); // its PR merged, nothing uncommitted (projects.ts, checkMerged)
  return [{ label: 'New Task', run: () => { done(); return newTask(p); } },
    '-', { label: 'Project Settings…', run: () => { done(); openSettings('projects', p.id); } },
    { label: 'Show Data Folder', enabled: loaded, run: () => kulisa.invoke('project:show-data', { id: p.id }) },
    ...(merged ? [{ label: 'Delete Merged Tasks…', run: () => kulisa.invoke('project:delete-merged', { id: p.id }) }] : []),
    '-', { label: 'Close All Tasks', enabled: open, run: () => kulisa.invoke('project:close-tasks', { id: p.id }) }];
}
function taskItems(p: ProjectEntry, t: ProjectTask, done: () => void): MenuItem[] {
  return [{ label: t.closed ? 'Open' : 'Show', run: () => { done(); return openTask(p, t); } },
    ...(t.closed ? [] : [{ label: 'Close', run: () => kulisa.invoke('task:close', `${p.id}/${t.id}`) }]),
    '-', { label: 'Delete Task…', run: () => deleteTask(p, t) }];
}

// A task's row: its agent's state, its name, its line (its branch, when it closed); open in another window, merged. A
// closed task's muted. Delete: Delete Task….
function TaskRow({ p, t, done }: { p: ProjectEntry; t: ProjectTask; done: () => void }) {
  const key = `${p.id}/${t.id}`;
  const tab = useWindow((s) => s.projects.tabs.find((x) => x.key === key)), shown = useWindow((s) => s.current === key);
  const line = taskLine(t);
  return <SidebarMenuItem>
    <SidebarMenuButton data-task={key} aria-label={t.name} aria-current={shown || undefined} isActive={shown} title={t.name} className="h-auto"
      onClick={() => { done(); void openTask(p, t); }} onKeyDown={(e) => { if (e.key === 'Delete') { e.preventDefault(); void deleteTask(p, t); } }}>
      <AgentState state={tab?.state} room />
      <span className={t.closed ? 'flex min-w-0 flex-1 flex-col text-muted-foreground' : 'flex min-w-0 flex-1 flex-col'}>
        <span className="truncate">{t.name}</span>
        {line && <span className="truncate text-xs text-muted-foreground">{line}</span>}
      </span>
      {!t.closed && !tab && <Badge variant="outline">open</Badge>}
      {t.closed && t.merged && <Badge variant="secondary">merged</Badge>}
    </SidebarMenuButton>
    <SidebarMenuAction showOnHover aria-label="Delete Task…" title="Delete Task…" onClick={() => void deleteTask(p, t)}><Trash2Icon /></SidebarMenuAction>
  </SidebarMenuItem>;
}

// A project: its name (its tasks folded away or not) and its +, its tasks under it, the open ones first.
function ProjectGroup({ p, done }: { p: ProjectEntry; done: () => void }) {
  const tasks = [...p.tasks.filter((t) => !t.closed), ...p.tasks.filter((t) => t.closed)]; // closed: the last first (main)
  const [open, setOpen] = useState(true);
  return <Collapsible open={open} onOpenChange={setOpen} asChild>
    <SidebarGroup role="group" data-project={p.id} aria-label={p.name}>
      <SidebarGroupLabel asChild>
        <CollapsibleTrigger title={p.folders[0]}>
          <ProjectIcon p={p} /><span className="ms-2 truncate">{p.name}</span>
          <ChevronRightIcon className={open ? 'ms-auto rotate-90' : 'ms-auto'} />
        </CollapsibleTrigger>
      </SidebarGroupLabel>
      <SidebarGroupAction aria-label={`New Task of ${p.name}`} title={`New Task of ${p.name}`} onClick={() => { done(); void newTask(p); }}>
        <PlusIcon /></SidebarGroupAction>
      <CollapsibleContent>
        <SidebarGroupContent>
          <SidebarMenu>
            {tasks.map((t) => <TaskRow key={t.id} p={p} t={t} done={done} />)}
            {!tasks.length && <SidebarMenuItem><span className="px-2 text-sm text-muted-foreground">No tasks yet</span></SidebarMenuItem>}
          </SidebarMenu>
        </SidebarGroupContent>
      </CollapsibleContent>
    </SidebarGroup>
  </Collapsible>;
}

// Its content, docked or over the grid. done: a choice made (over the grid it closes then).
function Projects({ done }: { done: () => void }) {
  const projects = useWindow(useShallow((s) => [...s.projects.projects].sort((a, b) => lastWorked(b) - lastWorked(a))));
  const rightClick = (e: MouseEvent): MenuItem[] | null => {
    const el = e.target as Element, task = el.closest<HTMLElement>('[data-task]')?.dataset.task, id = el.closest<HTMLElement>('[data-project]')?.dataset.project;
    const p = projects.find((x) => x.id === id);
    if (!p) return null;
    const t = task ? p.tasks.find((x) => `${p.id}/${x.id}` === task) : undefined;
    return t ? taskItems(p, t, done) : projectItems(p, done);
  };
  return <SidebarProvider className="h-full min-h-0">
    <Bar collapsible="none" className="h-full w-full">
      <SidebarHeader>
        <div className="flex items-center justify-between px-2 pt-1 text-sm font-medium">Projects<Kbd>{keyText('task.menu')}</Kbd></div>
      </SidebarHeader>
      <SidebarContent>
        <RightClickMenu items={rightClick} className="flex min-h-0 flex-col">
          <nav aria-label="Projects">{projects.map((p) => <ProjectGroup key={p.id} p={p} done={done} />)}</nav>
        </RightClickMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu><SidebarMenuItem><Tip text="Its code, its agents, its profiles" side="right">
          <SidebarMenuButton onClick={() => { done(); void newProject(); }}><FolderPlusIcon />New Project…</SidebarMenuButton>
        </Tip></SidebarMenuItem></SidebarMenu>
      </SidebarFooter>
    </Bar>
  </SidebarProvider>;
}

// Over the grid, while a task is shown: a Sheet, covering the pages as a dialog does (lib/cover.ts).
export function Sidebar() {
  const [open, setOpen] = useState(false);
  useEffect(() => { sidebarOverlay({ open, setOpen }); return () => sidebarOverlay(null); }, [open]);
  return <Sheet open={open} onOpenChange={setOpen}>
    <SheetContent side="left" showCloseButton={false} className="w-72">
      <SheetTitle className="sr-only">Projects</SheetTitle>
      <SheetDescription className="sr-only">Every project with its tasks</SheetDescription>
      <Projects done={() => setOpen(false)} />
    </SheetContent>
  </Sheet>;
}

// Docked, in the empty window.
export function DockedSidebar() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { sidebarDocked(ref.current); return () => sidebarDocked(null); }, []);
  return <div ref={ref} className="h-full w-64 flex-none border-e"><Projects done={() => {}} /></div>;
}

// The title bar's button: the sidebar over the grid, or back. None in the empty window, where it is docked.
export function SidebarToggle() {
  const shown = useWindow((s) => s.current !== null);
  return shown ? <Tip text={withKeys('Projects and tasks', 'task.menu')}>
    <Button variant="ghost" size="icon" aria-label="Projects and tasks" onClick={toggleSidebar}><PanelLeftIcon /></Button>
  </Tip> : null;
}
