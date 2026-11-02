// The windows' open tasks (docs/tasks.md, Tasks; the term: CLAUDE.md): opening, showing, creating, moving and closing
// them, one change after another (serial), in all windows. The windows' handles on them: ipc/tasks.ts.
import { app, screen } from 'electron';
import { Project, askDeleteProject, deleteProjectData } from './projects.ts';
import { AppWindow } from './window.ts';
import { log, tilde } from './log.ts';
import { refused } from '../shared/result.ts';
import type { Shell } from './shell.ts';
import type { ProjectEntry } from './store.ts';
import type { Task } from './tasks.ts';
import type { Place } from './window.ts';
import type { Result } from '../shared/result.ts';
import type { TerminalContents } from '../terminal/ipc.ts';

export function openTasks(shell: Shell, { appDevTools }: { appDevTools: boolean }) {
  const store = shell.store;
  const allTasks = () => [...shell.open.values()].flatMap((p) => [...p.tasks.values()]);
  const sendProjects = () => shell.sendProjects();
  // ---------- windows, projects and tasks ----------
  // A project is a folder with its tasks (store.ts); a task is open as a tab of a window, as a browser's. Each task has its profiles,
  // grid and agent (tasks.ts); a window shows one, the others keep running (their agents and pages), until the human
  // closes their tab. Showing another task hides this one's pages, and the window builds the next grid in place
  // (the page is not loaded again). A task loads (profiles, agent) the first time it is shown. A project is loaded
  // (shell.open) while a task of it is open in any window: its git, its agents' accounts.
  // Opening, showing, creating, moving and closing run one after another, in all windows.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => T | Promise<T>): Promise<T> => { const r = queue.then(fn); queue = r.catch(() => {}); return r; };
  const newWindow = (place: Place) => { const w = new AppWindow(shell, place, { appDevTools }); shell.windows.push(w); log.info(`[window] new wc=${w.win.webContents.id}`); return w; };
  // Loaded, the log names it beside its id: the lines after it name it by its id alone.
  const loadProject = (p: ProjectEntry) => {
    if (shell.open.has(p.id)) return shell.open.get(p.id)!;
    log.info(`[project] ${p.id} loaded: ${p.name} (${tilde(p.folders[0]!)})`);
    return shell.open.set(p.id, new Project(shell, p)).get(p.id)!;
  };
  // A project with no open task left is let go: nothing of it runs.
  const unloadIdle = () => { for (const [id, p] of shell.open) if (!p.open().length) shell.open.delete(id); };
  const openTasksOf = (project: Project, w: AppWindow) => w.tabs.filter((t) => t.project === project);
  // Task id of project p shown (the sidebar), opened again if it was closed; none: a new task of it. In the window it
  // is open in, brought to the front; a closed or new one at the end of window w's bar.
  async function openProject(p: ProjectEntry, w: AppWindow, id?: string | null): Promise<Result<{ id: string; key: string }>> {
    log.info(`[task] open ${p.id}${id != null ? `/${id}` : ''} wc=${w.win.webContents.id}`);
    const project = loadProject(p);
    const task = id != null && project.tasks.get(id);
    if (!task) {
      const r = await createTask(project, w);
      unloadIdle();
      return r;
    }
    if (task.entry.closedAt !== undefined) project.reopen(task);
    if (!task.window) w.add(task);
    await showTask(task);
    sendProjects();
    return { id: task.id, key: task.key };
  }
  // Closing tasks, wherever it starts (× on a tab, the middle button on it, Close All Tasks, deleting a project, a
  // window's ×): one function, so one rule. The human is asked first in their window w, only when an agent works (a
  // window's ×: always; asked: already). Each closes as × on it would (projects.ts, closeTask: its agent stopped,
  // its profiles saved and closed, all kept to open again), its tab goes; the one on screen goes last, so the one
  // next to it is shown, or none is left: the empty window, or the window closes when there is
  // another (as a browser's). A project with no open task left is let go.
  async function closeTasks(w: AppWindow, tasks: Task[], { asked = false, window = false } = {}): Promise<Result<{ keys: string[] }>> {
    if (!asked && !await askClosing(w, tasks, { window })) return { error: 'the human said no' };
    log.info(`[task] closing ${tasks.map((t) => t.key).join(' ')}${window ? ' (window)' : ''} wc=${w.win.webContents.id}`);
    for (const task of [...tasks.filter((t) => t !== w.current), ...tasks.filter((t) => t === w.current)]) {
      const win = task.window;
      if (!win) continue;
      await win.leave(task);
      await task.project.closeTask(task);
      win.drop(task);
    }
    unloadIdle();
    if (!w.tabs.length && shell.windows.length > 1) dropWindow(w);
    shell.saveWindows();
    sendProjects();
    return { keys: tasks.map((t) => t.key) };
  }
  // The question before closing tasks (one, or a project's: only when an agent works; a window's: window), saying which
  // agents are still working; or before quitting (quit), when the tasks come back at the next start: asked only
  // when that would stop a working agent. True: go on.
  function askClosing(w: AppWindow | null, tasks: Task[], { quit = false, window = false } = {}) {
    const projects = new Set(tasks.map((t) => t.project)), named = nameAmong(tasks);
    const working = tasks.some((task) => task.working);
    if (quit) {
      return !working || shell.ask({ message: 'Quit Kulisa?', ok: 'Quit',
        detail: `${stillWorking(tasks, 'quitting')}The windows, their tasks and conversations come back at the next start.` }, w);
    }
    if (!window) {
      const what = tasks.length === 1 ? `the task ${tasks[0]!.name}` : `the ${tasks.length} tasks of ${[...projects].map((p) => p.name).join(', ')}`;
      return !working || shell.ask({ message: `Close ${what}?`, ok: 'Close',
        detail: `${stillWorking(tasks, 'closing')}${tasks.length === 1 ? 'Its conversation, code and profiles stay' : 'Their conversations, code and profiles stay'}: open ${tasks.length === 1 ? 'it' : 'them'} again from the sidebar.` }, w);
    }
    return shell.ask({ message: 'Close the window?', ok: 'Close',
      detail: `Its tasks close: ${tasks.map(named).join(', ')}. ${stillWorking(tasks, 'closing')}`
        + 'Their conversations, code and profiles stay: open them again from the bar\'s +.' }, w);
  }
  // A task into another window (to, its tab at index; none: a window of its own next to its window, or at the
  // point at), as a browser moves a tab; it keeps running: its agent, its pages (the same views, moved, not loaded
  // again), what its terminals showed (terminals: { terminal key: its contents }, from the window it leaves). The
  // only tab of a window goes to a new one never (nothing would change); into another window, its window closes after
  // it.
  async function moveTask(task: Task | null | undefined, terminalContents: TerminalContents = {}, to: AppWindow | null = null, { index, at }: { index?: number; at?: Electron.Point } = {}): Promise<Result<{ key: string }>> {
    const from = task?.window;
    if (!task || !from) return { error: 'the task is not open' };
    if (to === from) return { key: task.key };
    if (!to && from.tabs.length < 2) return { error: 'the task is the only one in its window' };
    shell.chooseAgent.cancel(task); // none opens: the terminals' + there
    await from.leave(task);
    from.drop(task);
    const target = to || newWindow({ near: from.win, at });
    target.add(task, index);
    task.moveTo(target);
    if (!from.tabs.length) dropWindow(from); // after its pages have left it
    target.send('terminal:restore', ownTerminals(terminalContents, task)); // before any more output (window.ts: sent once the page has loaded)
    if (to) {
      to.focus();
      await to.show(task);
      shell.saveWindows();
      sendProjects();
    } else await showInNew(target, task);
    return { key: task.key };
  }
  // A task's terminals among those a window sent ("<task key>#<id>": renderer/lib/development-terminals.ts).
  const ownTerminals = (terminalContents: TerminalContents, task: Task) => Object.fromEntries(Object.entries(terminalContents).filter(([key]) => key.startsWith(`${task.key}#`)));
  // Move All Tasks to …: a project's open tasks of window w, one after another, into window to (none: a new window,
  // made for the first, the others following it).
  async function moveAll(project: Project | undefined, w: AppWindow | null, terminalContents: TerminalContents, to: AppWindow | null): Promise<Result<{ keys: string[] }>> {
    if (!project || !w) return { error: 'the project is not open' };
    const tasks = openTasksOf(project, w);
    if (to === w) return { keys: tasks.map((t) => t.key) };
    let target = to;
    for (const task of tasks) {
      const r = await moveTask(task, terminalContents, target);
      if (refused(r)) return r;
      target = task.window;
    }
    return { keys: tasks.map((t) => t.key) };
  }
  async function showInNew(to: AppWindow, task: Task) {
    const loading = to.load(task);
    await to.show(task);
    await loading;
    shell.saveWindows();
    sendProjects();
  }
  // A task's tab dragged and let go on window w's tabs (index: where): from w, it changes their order; from another
  // window, the task moves to w.
  function dropTask(task: Task | null, w: AppWindow | null, index: number, terminalContents: TerminalContents) {
    if (!task?.window || !w) return { error: 'the task is not open' };
    if (task.window !== w) return moveTask(task, terminalContents, w, { index });
    w.reorder(task, index);
    return { key: task.key };
  }
  // A tab let go where no Kulisa window took it: outside them all, a new window there; on one (cancelled, or let go
  // elsewhere in a window), nothing.
  // The first start (no project yet: nothing to do in Kulisa without one): New Project opens by itself, over the empty
  // window (components/Empty.tsx).
  shell.firstStart = (w) => { if (!store.projects().length) w.send('project:new'); };
  shell.pointer = () => screen.getCursorScreenPoint(); // where the pointer is on the screen (the tests set it)
  async function dragOut(task: Task | null, terminalContents: TerminalContents): Promise<Result<{ key?: string }>> {
    const at = shell.pointer();
    return shell.windows.some((w) => w.contains(at)) ? { key: task?.key } : moveTask(task, terminalContents, null, { at });
  }
  // The OS's × of a window. The last one closes and Kulisa quits: its tabs open again at the next start (asked first
  // only when an agent works). Another one closes its tasks, as closing their tabs would.
  shell.windowClosing = (w, e) => {
    if (shell.quitting) return;
    e.preventDefault();
    serial(() => closeWindow(w)).catch((err) => console.error('[window]', err));
  };
  async function closeWindow(w: AppWindow) {
    if (!shell.windows.includes(w)) return;
    if (shell.windows.length > 1) return w.tabs.length ? closeTasks(w, [...w.tabs], { window: true }) : dropWindow(w);
    // macOS: hidden, as Mac apps' last window, its agents going on; the Dock shows it again (app.ts, activate). ⌘Q quits.
    if (process.platform === 'darwin') return w.win.hide();
    return quit(w);
  }
  // Quitting Kulisa (the last window's ×, ☰ → Exit, ⌘Q on macOS): every window and task comes back at the next start,
  // so it asks only when an agent works; w: the window to ask in, shown first when hidden (macOS).
  async function quit(w: AppWindow | null) {
    log.info('[kulisa] quit asked');
    const tasks = allTasks().filter((t) => t.window);
    if (w && !w.win.isVisible() && tasks.some((t) => t.working)) w.focus();
    if (await askClosing(w, tasks, { quit: true })) app.quit();
  }
  function dropWindow(w: AppWindow) { log.info(`[window] dropped wc=${w.win.webContents.id}`); shell.windows.splice(shell.windows.indexOf(w), 1); w.destroy(); }
  // A new task of a project (the bar's +, New Task: projects.ts), with its default agent, at the end of window w's
  // bar, then shown. Without git it would work in the folder another open task works in: the human is told first.
  async function createTask(project: Project | null | undefined, w: AppWindow | null): Promise<Result<{ id: string; key: string }>> {
    if (!project || !w) return { error: 'the project is not open' };
    await project.checkGit();
    if (project.sharesFolder() && !await shell.ask({ message: `Another task of ${project.name} works in its folder`, ok: 'Create Anyway',
      detail: `Without git, tasks have no copies of their own: both agents would work in ${project.folder}, and may get in each other's way.` }, w)) {
      return { error: 'the human said no' };
    }
    const task = await project.createTask();
    if (refused(task)) { log.info(`[task] not created in ${project.id}: ${task.error}`); return task; }
    log.info(`[task] created ${task.key} (${project.name}) in ${tilde(task.folder)} wc=${w.win.webContents.id}`);
    w.add(task);
    await showTask(task);
    return { id: task.id, key: task.key };
  }
  // A task shown, in its window (brought to the front when the ask came from another).
  async function showTask(task: Task) {
    const win = task.window!;
    win.focus();
    await win.show(task);
  }
  // × on a task's tab: its agent stops, its tabs close, all else stays (projects.ts, closeTask); asked first only when
  // its agent is working.
  async function closeTask(task: Task): Promise<Result<{ keys: string[] }>> {
    const w = task.window;
    if (!w) return { error: 'the task is not open' };
    const r = await closeTasks(w, [task]);
    task.project.checkMerged().then((found) => found && sendProjects()).catch(() => {});
    return r;
  }
  // Delete in a task's menu (open or closed), after the human says yes: everything of it goes (projects.ts). An open
  // one leaves its window first.
  async function deleteTask(task: Task): Promise<Result<{ id: string }>> {
    const project = task.project, w = task.window;
    if (!await project.askDeleteTask(task)) return { error: 'the human said no' };
    log.info(`[task] deleting ${task.key}`);
    if (w) await w.leave(task);
    await project.deleteTask(task);
    if (w) {
      w.drop(task);
      if (!w.tabs.length && shell.windows.length > 1) dropWindow(w);
    }
    unloadIdle();
    shell.saveWindows();
    sendProjects();
    return { id: task.id };
  }
  // Delete Merged Tasks… (a project's menu, from window w): its closed tasks whose PR is merged, after one question naming them;
  // nothing of them is lost (projects.ts, checkMerged).
  async function deleteMerged(project: Project, w: AppWindow | null) {
    const list = project.closedTasks().filter((t) => t.entry.merged);
    if (!list.length) return { error: 'no closed task of it is merged' };
    if (!await shell.ask({ message: `Delete ${list.length === 1 ? `the task ${list[0]!.name}` : `${list.length} merged tasks`}?`, ok: 'Delete', danger: true,
      detail: `Merged on the remote, nothing uncommitted: ${list.map((t) => `${t.name} (${t.branch})`).join(', ')}. Their folders, branches, profiles' copies and agents' conversations go.` }, w)) {
      return { error: 'the human said no' };
    }
    for (const t of list) await project.deleteTask(t);
    sendProjects();
    return { deleted: list.map((t) => t.id) };
  }
  // Removing a project, from wherever a window asks for it (w): the human confirms, then its open tasks are closed
  // in every window, and its data deleted (projects.ts).
  async function deleteProject(id: string, w: AppWindow | null) {
    const p = store.projects().find((x) => x.id === id);
    if (!p) return { error: `no project ${id}` };
    const open = shell.open.get(id);
    if (!await askDeleteProject(shell, p, w || open?.window || null)) return { error: 'the human said no' };
    if (open) for (const win of [...shell.windows]) await closeTasks(win, openTasksOf(open, win), { asked: true });
    await deleteProjectData(shell, p);
    sendProjects();
    return { id };
  }
  return { serial, newWindow, loadProject, unloadIdle, openTasksOf, openProject, closeTasks, askClosing, moveTask, moveAll, dropTask, dragOut, quit, createTask, showTask, closeTask, deleteTask, deleteMerged, deleteProject };
}
export type OpenTasks = ReturnType<typeof openTasks>;

// A task's name among tasks: with its project's when they are of several.
const nameAmong = (tasks: Task[]) => {
  const several = new Set(tasks.map((t) => t.project)).size > 1;
  return (task: Task) => (several ? `${task.project.name}: ${task.name}` : task.name);
};
// The sentence of a question before doing (closing, quitting, restarting) what stops the agents still working among
// tasks, ending in a space; nothing when none works.
export function stillWorking(tasks: Task[], doing: string) {
  const working = tasks.filter((task) => task.working).map(nameAmong(tasks));
  if (!working.length) return '';
  return `${working.length > 1 ? 'Agents are' : 'An agent is'} still working (${working.join(', ')}): ${doing} stops ${working.length > 1 ? 'them' : 'it'}. `;
}
