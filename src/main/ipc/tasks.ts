// The windows' handles on the open tasks (docs/tasks.md; the core: open-tasks.ts): open, show, create, move, close and
// delete them; a task's own actions (rename, its repositories).
import { app, nativeImage, shell as electronShell } from 'electron';
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
  const { shell, at, serial, tasks } = ipc;
  const store = shell.store;
  const { openProject, closeTasks, askClosing, moveTask, moveAll, dropTask, dragOut, quit, createTask, showTask, closeTask, deleteTask, deleteProject, openTasksOf } = tasks;
  const sendProjects = () => shell.sendProjects();
  handle('project:list', (e) => at(e)?.info());
  // The switch runs on its own; the window hears about it through project:state and profile:state. No question
  // where: a tab in this window, which Move to New Window takes away.
  const openLater = (p: ProjectEntry, w: AppWindow, task?: string) => {
    setImmediate(() => serial(() => (shell.windows.includes(w) ? openProject(p, w, task) : null)).catch((err) => console.error('[project:open]', err)));
    return w.info();
  };
  // A folder's project (made for it), or a project's given task; a new task of a project is task:new's.
  handle('project:open', (e, a) => {
    const p = 'id' in a ? store.projects().find((x) => x.id === a.id) : fs.existsSync(a.folder) ? store.projectFor(path.resolve(a.folder)) : null;
    return p ? openLater(p, at(e)!, a.task) : { error: 'no such project' };
  });
  // Close All Tasks (a project's menu): its open tasks in every window, asked once in the window it came from.
  handle('project:task:close-all', (e, { id }) => serial(async () => {
    const p = shell.open.get(id), w = at(e);
    if (!p || !w) return { error: 'the project is not open' };
    const tasks = p.open().filter((t) => t.window);
    if (!await askClosing(w, tasks)) return { error: 'the human said no' };
    for (const win of [...shell.windows]) await closeTasks(win, openTasksOf(p, win), { asked: true });
    return { keys: tasks.map((t) => t.key) };
  }));
  // to: the id of the window it goes to (window.ts), none for a new one.
  const windowById = (to?: number | null) => (to ? shell.windows.find((w) => w.id === to) : null);
  handle('task:move', (_e, { key, to }) => serial(() => {
    const target = windowById(to);
    return to && !target ? { error: 'that window is closed' } : moveTask(shell.taskByKey(key), target);
  }));
  handle('project:task:move-all', (e, { id, to }) => serial(() => {
    const target = windowById(to);
    return to && !target ? { error: 'that window is closed' } : moveAll(shell.open.get(id), at(e), target ?? null);
  }));
  // A task's tab dragged (components/TaskBar.tsx): let go on this window's tabs, or where no window took it.
  handle('task:drop', (e, { key, index }) => serial(() => dropTask(shell.taskByKey(key), at(e), index)));
  handle('task:drag-out', (_e, { key }) => serial(() => dragOut(shell.taskByKey(key))));
  handle('app:quit', (e) => serial(() => quit(at(e))));
  handle('project:delete', (e, { id }) => serial(() => deleteProject(id, at(e))));
  // A task of any project (the bar shows every open task).
  const taskAt = <T>(key: string, fn: (task: Task) => T | Promise<T>) => serial(() => { const task = shell.taskByKey(key); return task ? fn(task) : { error: `no task ${key}` }; });
  handle('task:show', (_e, key) => taskAt(key, showTask));
  // A new task of a project, any (the bar's and the sidebar's +, New Project: loaded with it), or without one of the shown
  // task's (Ctrl+Shift+N).
  handle('task:new', (e, { project } = {}) => serial(() => {
    if (!project) return createTask(at(e)?.task?.project, at(e) ?? null);
    const p = store.projects().find((x) => x.id === project), w = at(e);
    return p && w ? openProject(p, w) : { error: 'no such project' };
  }));
  handle('task:close', (_e, key) => taskAt(key, closeTask));
  handle('task:delete', (_e, key) => taskAt(key, deleteTask));
  // 🗑 on a closed task's row (the sidebar): its project need not be loaded.
  handle('task:delete-closed', (e, { project, id }) => serial(async () => {
    const open = shell.open.get(project)?.tasks.get(id);
    if (open) return open.entry.closedAt !== undefined ? deleteTask(open) : { error: `task ${id} is open` };
    const p = store.projects().find((x) => x.id === project);
    if (!p) return { error: 'no such project' };
    const r = await deleteClosedTask(shell, p, id, at(e)!);
    if (!refused(r)) sendProjects();
    return r;
  }));
  handle('task:rename', (_e, { key, name }) => taskAt(key, (task) => task.rename(name)));
  handle('task:repo:add', (_e, { key, repo }) => taskAt(key, (task) => task.addRepository(repo)));
  handle('task:repo:remove', (_e, { key, repo }) => taskAt(key, (task) => task.removeRepository(repo)));
  handle('task:show-folder', (_e, key) => { const task = shell.taskByKey(key); return task && electronShell.openPath(task.folder); });
  handle('task:open-folder', (_e, { key, folder }) => {
    const task = shell.taskByKey(key); // only a folder the task owns (a resource), not any path the renderer names
    return task && task.resources().some((r) => r.folder === folder) ? electronShell.openPath(folder) : undefined;
  });
  handle('task:file:list', (_e, { key, folder }) => {
    const task = shell.taskByKey(key);
    return task ? task.files(folder) : { error: 'the task is closed' };
  });
  handle('task:file:open', (_e, { key, file }) => {
    const task = shell.taskByKey(key);
    return task ? task.openProjectFile(file) : { error: 'the task is closed' };
  });
  handle('task:file:status', (_e, { key, folder }) => {
    const task = shell.taskByKey(key);
    return task ? task.fileStatus(folder) : { error: 'The task is closed.' };
  });
  handle('task:editor', (_e, { key, action }) => {
    const task = shell.taskByKey(key);
    return task ? task.editor.execute(action) : { error: 'The task is closed.' };
  });
  handle('task:diff:list', (_e, { key, folder, options }) => {
    const task = shell.taskByKey(key);
    return task ? task.diff(folder, options) : { error: 'The task is closed.' };
  });
  handle('task:diff:targets', (_e, { key, folder }) => {
    const task = shell.taskByKey(key);
    return task ? task.diffTargets(folder) : { error: 'The task is closed.' };
  });
  handle('task:diff:review', (_e, { key, folder, options, load }) => {
    const task = shell.taskByKey(key);
    return task ? task.review(folder, options, load) : { error: 'The task is closed.' };
  });
  handle('task:diff:contents', (_e, { key, folder, path, options }) => {
    const task = shell.taskByKey(key);
    return task ? task.diffContents(folder, path, options) : { error: 'The task is closed.' };
  });
  handle('task:files:folders', (_e, key) => shell.taskByKey(key)?.fileFolders() ?? []);
  handle('task:files:open', (_e, { key, folder }) => taskAt(key, (task) => task.openFileFolder(folder)));
  handle('task:artifact:open', (_e, { key, file }) => taskAt(key, (task) => task.openArtifact(file)));
  handle('task:artifact:view', (e, { key, file }) => {
    const task = at(e)?.task;
    return task?.key === key ? task.viewArtifact(file) : { error: 'That task is not on screen.' };
  });
  handle('task:artifact:thumbnails', (_e, { key, files }) => taskAt(key, (task) => task.artifactThumbnails(files.slice(0, 100))));
  handle('task:artifact:refresh', (e, key) => { const w = at(e); return w?.task?.key === key ? w.sendArtifacts() : undefined; });
  handle('task:artifact:read', (e, { key, file, offset, length }) => {
    const task = at(e)?.task;
    return task?.key === key ? task.readArtifact(file, offset, length) : { error: 'That task is not on screen.' };
  });
  handle('task:artifact:pdf:open', (e, { key, file, request, box }) => {
    const window = at(e), task = window?.task;
    return window && task?.key === key ? window.artifactViewer.open(task, file, request, box) : { error: 'That task is not on screen.' };
  });
  handle('task:artifact:media:open', (e, { key, file, revision, request }) => {
    const window = at(e), task = window?.task;
    return window && task?.key === key ? window.artifactViewer.openMedia(task, file, revision, request) : { error: 'That task is not on screen.' };
  });
  handle('task:artifact:media:close', (e, { request }) => at(e)?.artifactViewer.close(request));
  handle('task:artifact:pdf:place', (e, { request, box }) => at(e)?.artifactViewer.place(request, box));
  handle('task:artifact:pdf:close', (e, { request }) => at(e)?.artifactViewer.close(request));
  handle('task:artifact:pdf:find', (e, { request, query, forward }) => at(e)?.artifactViewer.find(request, query, forward) ?? { matches: 0, active: 0 });
  handle('task:artifact:send', (_e, { key, file }) => taskAt(key, (task) => task.sendArtifact(file)));
  handle('task:artifact:drag', async (e, { key, file }) => {
    const w = at(e), task = w?.task, frame = e.senderFrame;
    if (!task || task.key !== key) return { error: 'that task is not on screen' };
    const r = await task.findArtifact(file);
    if (refused(r)) return r;
    const artifact = r.artifact;
    const thumb = (await task.artifacts()).find((a) => a.file === artifact.file)?.thumb;
    const icon = thumb ? nativeImage.createFromDataURL(thumb) : await app.getFileIcon(artifact.file, { size: 'small' });
    if (w?.task !== task || task.window !== w || e.sender.isDestroyed() || e.sender.mainFrame !== frame) return { error: 'that task is not on screen' };
    e.sender.startDrag({ file: artifact.file, icon });
    return {};
  });
  handle('task:artifact:delete', (_e, { key, files }) => taskAt(key, (task) => task.deleteArtifacts(files)));
  handle('project:refresh', (e) => at(e)?.sendProjects());

}
