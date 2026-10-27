// The sidebar (docs/tasks.md, The sidebar): every project with its tasks, any task one click away, the project worked in
// last first (lib/common.ts, lastWorked); New Project… at its foot. Docked in the empty window; over the grid while a
// task is shown (the title bar's button, Ctrl+Shift+A; Esc or a choice closes it).
import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Divider, DrawerBody, DrawerFooter, DrawerHeader, DrawerHeaderTitle, InlineDrawer, OverlayDrawer, Text, Tooltip, Tree, TreeItem, TreeItemLayout, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { AddRegular, DeleteRegular, FolderAddRegular, PanelLeftRegular } from '@fluentui/react-icons';
import { useShallow } from 'zustand/react/shallow';
import { ProjectIcon } from './ProjectIcon';
import { AgentState } from './AgentState';
import { RightClickMenu } from './Menus';
import { store, useWindow } from '../lib/store';
import { useCovered } from '../lib/cover';
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

// A closed task's row muted, the shown one's lit: pointed at or pressed too, over the row's own hover.
const muted = { color: tokens.colorNeutralForeground3 }, lit = { backgroundColor: tokens.colorSubtleBackgroundSelected };
const useStyles = makeStyles({
  muted,
  closed: { ...muted, ':hover': muted, ':active': muted },
  shown: { ...lit, ':hover': lit, ':active': lit },
  body: { padding: `0 ${tokens.spacingHorizontalS}` },
  footer: { padding: tokens.spacingHorizontalS },
  newProject: { flex: 1, justifyContent: 'flex-start' },
  docked: { height: '100%' },
  toggle: { WebkitAppRegion: 'no-drag' }, // Electron's: the title bar's button is pressed, not a handle to drag the window by
});

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


function TaskRow({ p, t, done }: { p: ProjectEntry; t: ProjectTask; done: () => void }) {
  const key = `${p.id}/${t.id}`;
  const tab = useWindow((s) => s.projects.tabs.find((x) => x.key === key)), shown = useWindow((s) => s.current === key);
  const line = taskLine(t), styles = useStyles();
  const choose = () => { done(); void openTask(p, t); };
  return <TreeItem itemType="leaf" value={key} data-task={key} aria-label={t.name} aria-current={shown || undefined} title={t.name}
    onClick={choose} onKeyDown={(e) => { // Enter: Fluent's, a click
      if (e.target !== e.currentTarget) return;
      if (e.key === ' ') { e.preventDefault(); choose(); } else if (e.key === 'Delete') { e.preventDefault(); void deleteTask(p, t); }
    }}>
    <TreeItemLayout iconBefore={<AgentState state={tab?.state} room />}
      aside={<>
        {line && <Text size={200} className={styles.muted}>{line}</Text>}
        {!t.closed && !tab && <Badge appearance="outline" size="small" color="informative">open</Badge>}
        {t.closed && t.merged && <Badge appearance="outline" size="small" color="success">merged</Badge>}
      </>}
      actions={<Tooltip content="Delete Task…" relationship="label"><Button appearance="subtle" size="small" icon={<DeleteRegular />}
        onClick={() => void deleteTask(p, t)} /></Tooltip>}
      className={mergeClasses(t.closed && styles.closed, shown && styles.shown)}>
      {t.name}
    </TreeItemLayout>
  </TreeItem>;
}

function ProjectRow({ p, done }: { p: ProjectEntry; done: () => void }) {
  const styles = useStyles();
  const tasks = [...p.tasks.filter((t) => !t.closed), ...p.tasks.filter((t) => t.closed)]; // closed: the last first (main)
  return <TreeItem itemType="branch" value={p.id} data-project={p.id} aria-label={p.name}>
    <TreeItemLayout iconBefore={<ProjectIcon p={p} />} title={p.folders[0]}
      actions={<Tooltip content={`New Task of ${p.name}`} relationship="label"><Button appearance="subtle" size="small" icon={<AddRegular />}
        onClick={() => { done(); void newTask(p); }} /></Tooltip>}>
      <Text weight="semibold">{p.name}</Text></TreeItemLayout>
    <Tree>
      {tasks.map((t) => <TaskRow key={t.id} p={p} t={t} done={done} />)}
      {!tasks.length && <TreeItem itemType="leaf" value={`${p.id}/`} aria-disabled>
        <TreeItemLayout className={styles.muted}>No tasks yet</TreeItemLayout></TreeItem>}
    </Tree>
  </TreeItem>;
}

// Its content, docked or over the grid. done: a choice made (over the grid it closes then).
function Projects({ done }: { done: () => void }) {
  const projects = useWindow(useShallow((s) => [...s.projects.projects].sort((a, b) => lastWorked(b) - lastWorked(a))));
  const [folded, setFolded] = useState<string[]>([]); // the projects whose tasks are put away
  const styles = useStyles();
  const rightClick = (e: MouseEvent): MenuItem[] | null => {
    const el = e.target as Element, task = el.closest<HTMLElement>('[data-task]')?.dataset.task, id = el.closest<HTMLElement>('[data-project]')?.dataset.project;
    const p = projects.find((x) => x.id === id);
    if (!p) return null;
    const t = task ? p.tasks.find((x) => `${p.id}/${x.id}` === task) : undefined;
    return t ? taskItems(p, t, done) : projectItems(p, done);
  };
  return <>
    <DrawerHeader>
      <DrawerHeaderTitle action={<Text size={200} className={styles.muted}>{keyText('task.menu')}</Text>}>
        <Text size={300} weight="semibold">Projects</Text>
      </DrawerHeaderTitle>
    </DrawerHeader>
    <DrawerBody className={styles.body}>
      <RightClickMenu items={rightClick}>
        <Tree aria-label="Projects" openItems={projects.map((p) => p.id).filter((id) => !folded.includes(id))}
          onOpenChange={(_, d) => setFolded((f) => (d.open ? f.filter((x) => x !== d.value) : [...f, d.value as string]))}>
          {projects.map((p) => <ProjectRow key={p.id} p={p} done={done} />)}
        </Tree>
      </RightClickMenu>
    </DrawerBody>
    <Divider />
    <DrawerFooter className={styles.footer}>
      <Tooltip content="Its code, its agents, its profiles" relationship="description">
        <Button appearance="subtle" icon={<FolderAddRegular />} onClick={() => { done(); void newProject(); }} className={styles.newProject}>New Project…</Button>
      </Tooltip>
    </DrawerFooter>
  </>;
}

// Over the grid, while a task is shown: covering the pages as a dialog does (cover.ts, 'hide'): it is modal, and its
// own menus (a right-click) open over it, which as a menu of its own ('pictures': one at a time) they would close.
export function Sidebar() {
  const { open, setOpen } = useCovered('hide');
  useEffect(() => { sidebarOverlay({ open, setOpen }); return () => sidebarOverlay(null); }, [open, setOpen]);
  return <OverlayDrawer open={open} onOpenChange={(_, d) => setOpen(d.open)} position="start" size="small" aria-label="Projects">
    {open && <Projects done={() => setOpen(false)} />}
  </OverlayDrawer>;
}

// Docked, in the empty window.
export function DockedSidebar() {
  const ref = useRef<HTMLDivElement>(null), styles = useStyles();
  useEffect(() => { sidebarDocked(ref.current); return () => sidebarDocked(null); }, []);
  return <InlineDrawer ref={ref} open separator position="start" size="small" aria-label="Projects" className={styles.docked}>
    <Projects done={() => {}} />
  </InlineDrawer>;
}

// The title bar's button: the sidebar over the grid, or back. None in the empty window, where it is docked.
export function SidebarToggle() {
  const shown = useWindow((s) => s.current !== null), styles = useStyles();
  return shown ? <Tooltip content={withKeys('Projects and tasks', 'task.menu')} relationship="label">
    <Button appearance="subtle" icon={<PanelLeftRegular />} onClick={toggleSidebar} className={styles.toggle} />
  </Tooltip> : null;
}
