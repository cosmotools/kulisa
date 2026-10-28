// The state the e2e tests start from and reach through the core: the test project and its tasks, other projects and
// repositories, the profiles in them (docs/tasks.md, docs/profiles.md). Made through the core, git and the window's
// channels: making each is tested elsewhere.
import { execFileSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Core, Call } from './fixtures.ts';
import type { Files } from './data.ts';
import { SITE, answer, invoke, notLoading, viewOn, arrange } from './helpers.ts';

export const SAM = 'Sam.admin', ELON = 'Elon.buyer';
export const rand = () => crypto.randomBytes(3).toString('hex');
export const hasDirenv = (() => { try { execFileSync('direnv', ['version']); return true; } catch { return false; } })();
export const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=Kulisa test', '-c', 'user.email=test@example.invalid', ...args], { cwd, encoding: 'utf8' }).trim();
// A folder made a git repository with one commit (of file, made with text); the folder made when it is not there.
export function committed(dir: string, file = 'a.txt', text = 'a', message = 'a') {
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q');
  fs.writeFileSync(path.join(dir, file), text);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', message);
  return dir;
}
// The project made a git repository as the human sets it up: committed, with what a task's copy takes along or not (an
// .env, an .envrc direnv allowed, a file .worktreeinclude names, an agent's local settings, a file not committed).
function gitProject(project: string) {
  git(project, 'init', '-q');
  fs.writeFileSync(path.join(project, '.gitignore'), '.env*\nconfig/local.json\ntranscript.jsonl\n.claude/settings.local.json\n');
  fs.writeFileSync(path.join(project, '.worktreeinclude'), 'config/local.json\n');
  fs.writeFileSync(path.join(project, 'README.md'), '# shop\n');
  git(project, 'add', '-A');
  git(project, 'commit', '-qm', 'first');
  fs.writeFileSync(path.join(project, '.env'), 'SECRET=1\n');
  fs.writeFileSync(path.join(project, '.envrc'), 'export FROM_ENVRC="envrc of $PWD"\n');
  if (hasDirenv) execFileSync('direnv', ['allow', project]);
  fs.mkdirSync(path.join(project, 'config'), { recursive: true });
  fs.writeFileSync(path.join(project, 'config', 'local.json'), '{"db":"local"}');
  fs.mkdirSync(path.join(project, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(project, '.claude', 'settings.local.json'), '{"model":"x"}');
  fs.writeFileSync(path.join(project, 'wip.txt'), 'not committed');
}

// The shown project's task by its place (from 1), as made; whether the shown task is that one, the window done showing it.
export const keyAt = (core: Core, n: number) => core((k, i) => [...k.shell.current.tasks.values()][i - 1]?.key, n);
export const isNth = (core: Core, n: number) => core((k, i) => { const t = k.shell.task; return !!t && [...t.project.tasks.values()][i - 1] === t; }, n);
export const nthShown = (core: Core, n: number, timeout = 5000) => expect.poll(async () => (await isNth(core, n)) && core((k) => k.settled()), { timeout }).toBe(true);
// A task's tab in the bar by its key; the shown task's project's tabs, each its task's name, the shown one with ' *'.
export const taskTab = (ui: Page, key: string) => ui.locator(`#taskTabs [data-task="${key}"]`);
export const taskTabs = (ui: Page) => ui.evaluate(() => {
  const project = document.querySelector<HTMLElement>('#taskTabs [aria-selected="true"]').dataset.project;
  return [...document.querySelectorAll(`#taskTabs [data-project="${project}"]`)].map((t) => t.textContent + (t.ariaSelected === 'true' ? ' *' : ''));
});
// One of the agent's hooks of a task, as its plugin sends it (agent-hooks.ts); its answer.
export async function hook(core: Core, task: string, event: string, input = {}) {
  const url = await core((k, key) => k.hooksOf(k.shell.taskByKey(key)), task);
  const text = await (await fetch(`${url}/${event}`, { method: 'POST', body: JSON.stringify(input) })).text();
  return JSON.parse(text || '{}');
}

// The session a task's agent reports at its start (its SessionStart hook, as Claude Code sends it): Kulisa resumes it.
export const reportSession = (core: Core, task: string, id: string, transcript: string) => hook(core, task, 'session-start', { hook_event_name: 'SessionStart', session_id: id, transcript_path: transcript, source: 'startup' });

// A task of the window's project shown by its key, once its agent started: an open one shown (task:show), another
// opened (project:open: a closed one again, one of a project not loaded).
export async function showTask(core: Core, ui: Page, key: string) {
  const [id, task] = key.split('/');
  if (await core((k, t) => k.shell.task?.key !== t, key)) {
    if (await core((k, t) => { const x = k.shell.taskByKey(t); return !!x?.loaded && !x.entry.closed; }, key)) await invoke(ui, 'task:show', key);
    else await invoke(ui, 'project:open', { id, task });
  }
  await taskShown(core, key);
}
// A task shown, by its key, once its agent started and the window is done showing it.
export const taskShown = (core: Core, key: string) => expect.poll(() => core((k, t) => k.shell.task?.key === t && k.settled(true), key), { timeout: 20000 }).toBe(true);
// A new task (a project's + in the sidebar or the bar's +: task:new; the menu itself is tested elsewhere) of a project, the shown one
// by default, shown once its agent started; named task-<its place among its project's tasks> for the test to refer to
// it by, unless name is null (left "New Task"). A project without git whose folder a task works in asks first: answered
// yes. Its key.
export async function newTask(core: Core, ui: Page, name?: string | null, project?: string) {
  const before = await core((k) => k.shell.task?.key ?? null), id = project ?? await core((k) => k.shell.current.id);
  const shares = await core(async (k, i) => { const p = k.shell.open.get(i); await p.checkGit(); return p.sharesFolder(); }, id);
  const made = invoke(ui, 'task:new', { project: id });
  if (shares) await answer(ui, 'Create Anyway');
  await made;
  await expect.poll(() => core((k, b) => { const t = k.shell.task; return !!t && t.key !== b && [...t.terminals.values()].some((x) => !!x.pty) && k.settled(); }, before), { timeout: 20000 }).toBe(true);
  return core(async (k, n) => {
    const t = k.shell.task;
    if (n !== null) await t.rename(n ?? `task-${[...t.project.tasks.values()].indexOf(t) + 1}`);
    if (k.shell.pty) k.watchPty(k.shell.pty);
    return t.key;
  }, name);
}
// A project opened from its folder (Open Folder…, project:open; the folder made), its first task shown once its agent
// started, its output watched.
export async function openFolder(core: Core, ui: Page, folder: string) {
  fs.mkdirSync(folder, { recursive: true });
  await invoke(ui, 'project:open', { folder });
  await expect.poll(() => core((k, f) => k.shell.current?.folder === f && k.settled(true), folder), { timeout: 10000 }).toBe(true);
  await core((k) => k.watchPty(k.shell.pty));
  await notLoading(ui);
}
// A project the window shows (its id), its task loaded and the window done showing it.
export const projectShown = (core: Core, id: string) => expect.poll(() => core((k, p) => k.shell.current?.id === p && k.settled(), id), { timeout: 20000 }).toBe(true);

// Sam's and Elon's pages each on its pane (driver.ts, viewOn).
export const bothOn = (core: Core, ui: Page, files: Files) => expect.poll(async () => (await viewOn(core, ui, files, SAM)) && viewOn(core, ui, files, ELON)).toBe(true);

type Begin = {
  // Sam and Elon side by side (the Columns preset), each page on its pane.
  columns?: boolean;
  // Feature-X, the project's second task, open beside task-1: in the project's folder (true), or, given the agent's
  // tools, in a worktree of its own as its agent makes one (task_worktree), with Sam and Elon open there too.
  featureX?: boolean | Call;
  // The tasks' tests' project: a git repository (gitProject), the only project open, no task of it but task-1 and
  // Feature-X (a task another test left is deleted), Dora closed.
  only?: boolean;
  // The task shown at the end, by its place.
  shown?: 1 | 2;
};
// The test project's task-1 shown, named so, with Sam.admin (the fox, "seller in the test shop") signed in to the test
// site and Elon.buyer (the owl) signed out open in it (a closed one opened again, a missing one made), laid out, the
// agent's output watched. Sam's and Elon's ids.
export async function begin(core: Core, ui: Page, files: Files, { columns = false, featureX = false, only = false, shown = 1 }: Begin = {}) {
  const pid = files.pid('project'), call = typeof featureX === 'function' ? featureX : null;
  if ((only || call) && !fs.existsSync(path.join(files.project, '.git'))) gitProject(files.project);
  if (only) for (const id of await core((k, p) => [...k.shell.open.keys()].filter((x) => x !== p), pid)) await invoke(ui, 'project:close-tasks', { id });
  const first = files.tkey('project', 1);
  await showTask(core, ui, first);
  if (only) {
    for (const key of await core((k, keep) => [...k.shell.current.tasks.values()].slice(1).filter((t) => !keep || t.name !== 'Feature-X').map((t) => t.key), !!featureX)) {
      const deleted = invoke(ui, 'task:delete', key);
      await answer(ui);
      await deleted;
    }
  }
  await core(async (k, dora) => {
    const task = k.shell.task;
    if (task.name !== 'task-1') await task.rename('task-1');
    await k.openProfile('Sam.admin', { description: 'seller in the test shop', avatar: 'fox' });
    await k.openProfile('Elon.buyer', { avatar: 'owl' });
    if (dora) {
      const named = (p: { name: string }) => p.name === 'Dora';
      if (![...k.shell.profiles.values()].some(named) && ![...task.closed.values()].some((c) => named(c.cfg))) await task.createProfile('Dora');
      const open = [...k.shell.profiles.values()].find(named);
      if (open) await task.closeProfile(open.id);
    }
    k.watchPty(k.shell.pty);
  }, only);
  if (columns) await expect(ui.locator('[data-panel^="profile:"]')).toHaveCount(2); // a pane stacked behind another has no .pane drawn
  await notLoading(ui);
  // Columns first: a page stacked behind another's tab is never laid out, and ensureProfile waits for that.
  if (columns) await arrange(ui, 'columns');
  const ids = await core(async (k, site) => ({
    sam: (await k.ensureProfile('Sam.admin', `${site}/app/login?name=sam`)).id,
    elon: (await k.ensureProfile('Elon.buyer', `${site}/app`)).id,
  }), SITE);
  if (columns) await bothOn(core, ui, files);
  if (featureX) {
    let fx = await core((k) => [...k.shell.current.tasks.values()].find((t) => t.name === 'Feature-X')?.key);
    if (!fx) {
      fx = await newTask(core, ui, call ? null : 'Feature-X', pid);
      if (call) await call('task_worktree', { name: 'Feature-X' }, { task: fx });
    } else await showTask(core, ui, fx);
    for (const profile of call ? [SAM, ELON] : []) {
      if (await core((k, a) => [...k.shell.taskByKey(a.fx).closed.values()].some((c) => c.cfg.name === a.profile), { fx, profile })) await call('profile_open', { profile }, { task: fx });
    }
    await showTask(core, ui, shown === 1 ? first : fx);
  }
  await notLoading(ui);
  return ids;
}

// A profile's id by its name: the shown task's, open or closed, else one in no task shown (profiles.json keeps a profile
// its project let go, and a test may make one of a name again); or null.
export const profileId = (core: Core, name: string) => core((k, n) => {
  const named = (p: { name: string }) => p.name.toLowerCase() === n.toLowerCase();
  return [...k.shell.profiles.values(), ...[...k.shell.closed.values()].map((c) => c.cfg)].find(named)?.id
    ?? k.shell.profileStore.all().find(named)?.id ?? null;
}, name);
// A profile deleted for good (Settings → Profiles' Delete, as the window sends it), when there is one of that name:
// what a test made goes, and the file's other tests (and its own next run) find it gone.
export async function deleteProfile(core: Core, ui: Page, name: string) {
  const id = await profileId(core, name);
  if (!id) return;
  const deleted = invoke(ui, 'profiles:delete', { profile: id });
  await answer(ui);
  await deleted;
  await expect.poll(() => core((k, p) => !k.shell.profileStore.get(p), id)).toBe(true);
}
