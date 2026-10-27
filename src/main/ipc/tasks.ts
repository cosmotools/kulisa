// The windows' handles on the open tasks (docs/tasks.md; the core: open-tasks.ts): open, show, create, move, close and
// delete them; a task's own actions (rename, its repositories).
import { shell as electronShell } from 'electron';
import path from 'path';
import fs from 'fs';
import { deleteClosedTask } from '../projects.ts';
import type { AppWindow } from '../window.ts';
import { refused } from '../../shared/result.ts';
import { handle } from '../ipc.ts';
import type { Ipc } from '../ipc.ts';
import type { ProjectEntry } from '../store.ts';
import type { Task } from '../tasks.ts';

export function registerTasks(ipc: Ipc) {
  const { shell, at, owner, asker, serial, tasks } = ipc;
  const store = shell.store;
  const { openProject, closeTasks, askClosing, moveTask, moveAll, dropTask, dragOut, quit, createTask, showTask, closeTask, deleteTask, deleteMerged, deleteProject, openTasksOf } = tasks;
  const sendProjects = () => shell.sendProjects();
  handle('projects:list', (e) => owner(e)?.info());
  // The switch runs on its own; the window hears about it through grid:closing, projects and state. No question
  // where: a tab in this window, which Move to New Window takes away.
  const openLater = (p: ProjectEntry, w: AppWindow, task?: string) => {
    setImmediate(() => serial(() => (shell.windows.includes(w) ? openProject(p, w, task) : null)).catch((err) => console.error('[project:open]', err)));
    return w.info();
  };
  handle('project:open', (e, { id, folder, task }) => {
    const p = id ? store.projects().find((x) => x.id === id) : folder && fs.existsSync(folder) ? store.projectFor(path.resolve(folder)) : null;
    return p ? openLater(p, at(e)!, task) : { error: 'no such project' };
  });
  // Close All Tasks (a project's menu): its open tasks in every window, asked once in the window it came from.
  handle('project:close-tasks', (e, { id }) => serial(async () => {
    const p = shell.open.get(id), w = at(e);
    if (!p || !w) return { error: 'the project is not open' };
    const tasks = p.open().filter((t) => t.window);
    if (!await askClosing(w, tasks)) return { error: 'the human said no' };
    for (const win of [...shell.windows]) await closeTasks(win, openTasksOf(p, win), { asked: true });
    return { keys: tasks.map((t) => t.key) };
  }));
  // to: the id of the window it goes to (window.ts), none for a new one.
  const windowById = (to?: number | null) => (to ? shell.windows.find((w) => w.id === to) : null);
  handle('task:move', (_e, { key, to, terminals }) => serial(() => {
    const target = windowById(to);
    return to && !target ? { error: 'that window is closed' } : moveTask(shell.taskByKey(key), terminals, target);
  }));
  handle('project:move-all', (e, { id, to, terminals }) => serial(() => {
    const target = windowById(to);
    return to && !target ? { error: 'that window is closed' } : moveAll(shell.open.get(id), at(e), terminals, target ?? null);
  }));
  // A task's tab dragged (components/TaskBar.tsx): let go on this window's tabs, or where no window took it.
  handle('task:drop', (e, { key, index, terminals }) => serial(() => dropTask(shell.taskByKey(key), at(e), index, terminals)));
  handle('task:drag-out', (_e, { key, terminals }) => serial(() => dragOut(shell.taskByKey(key), terminals)));
  handle('app:quit', (e) => serial(() => quit(at(e))));
  handle('project:delete', (e, { id }) => serial(() => deleteProject(id, asker(e))));
  // A task of any project (the bar shows every open task).
  const taskAt = <T>(key: string, fn: (task: Task) => T | Promise<T>) => serial(() => { const task = shell.taskByKey(key); return task ? fn(task) : { error: `no task ${key}` }; });
  handle('task:show', (_e, key) => taskAt(key, showTask));
  handle('task:new', (e, { project } = {}) => serial(() => createTask(project ? shell.open.get(project) : at(e)?.task?.project, at(e) ?? null)));
  handle('task:close', (_e, key) => taskAt(key, closeTask));
  handle('task:delete', (_e, key) => taskAt(key, deleteTask));
  // 🗑 on a closed task's row (the sidebar): its project need not be loaded.
  handle('task:delete-closed', (e, { project, id }) => serial(async () => {
    const open = shell.open.get(project)?.tasks.get(id);
    if (open) return open.entry.closed ? deleteTask(open) : { error: `task ${id} is open` };
    const p = store.projects().find((x) => x.id === project);
    if (!p) return { error: 'no such project' };
    const r = await deleteClosedTask(shell, p, id, at(e)!);
    if (!refused(r)) sendProjects();
    return r;
  }));
  handle('task:rename', (_e, { key, name }) => taskAt(key, (task) => task.rename(name)));
  handle('task:add-repo', (_e, { key, repo }) => taskAt(key, (task) => task.addRepository(repo)));
  handle('task:remove-repo', (_e, { key, repo }) => taskAt(key, (task) => task.removeRepository(repo)));
  handle('project:delete-merged', (e, { id }) => serial(() => { const p = shell.open.get(id); return p ? deleteMerged(p, at(e)) : { error: 'the project is not open' }; }));
  handle('task:show-folder', (_e, key) => { const task = shell.taskByKey(key); return task && electronShell.openPath(task.folder); });
  handle('task:open-folder', (_e, { key, folder }) => {
    const task = shell.taskByKey(key); // only a folder the task owns (a resource), not any path the renderer names
    return task && task.resources().some((r) => r.folder === folder) ? electronShell.openPath(folder) : undefined;
  });
  handle('task:artifacts', (e, key) => { const w = at(e); return w?.task?.key === key ? w.sendArtifacts() : undefined; });
  handle('task:artifacts-delete', (_e, { key, files }) => taskAt(key, (task) => task.deleteArtifacts(files)));
  handle('tasks:get', (e) => at(e)?.sendProjects());

}
