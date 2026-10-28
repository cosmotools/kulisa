// Tasks deleted: Delete Task…, merged tasks, from the sidebar (docs/tasks.md).
import fs from 'fs';
import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.ts';
import type { Core, Call } from './fixtures.ts';
import type { Files } from './data.ts';
import { WIN, choose, rightClick, fromSidebar, sidebar, taskRow, rowButton, invoke, notLoading, answer, projectMenu, removed } from './helpers.ts';
import { git, rand, hasDirenv, isNth, nthShown, taskTab, taskTabs, reportSession, newTask, openFolder, begin } from './tasks-helpers.ts';

// A repository with a remote, as a clone of one is, opened as a project (its folder named name-<random>); its first
// task in a worktree of its own named task-1, then a second one, task-2, in its own (task_worktree). Their keys.
async function remoteProject(core: Core, ui: Page, files: Files, call: Call, name: string) {
  const dir = path.join(files.root, `${name}-${rand()}`), origin = `${dir}-origin.git`;
  git(files.root, 'init', '-q', '--bare', '-b', 'main', origin);
  fs.mkdirSync(dir); git(dir, 'init', '-q', '-b', 'main'); fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
  git(dir, 'add', '-A'); git(dir, 'commit', '-qm', 'a'); git(dir, 'remote', 'add', 'origin', origin);
  git(dir, 'push', '-q', 'origin', 'main'); git(dir, 'remote', 'set-head', 'origin', 'main');
  await openFolder(core, ui, dir);
  const id = files.pid(path.basename(dir));
  const first = await core((k) => k.shell.task.key);
  await call('task_worktree', { name: 'task-1' }, { task: first }); // its own worktree and branch to push and merge
  const second = await newTask(core, ui);
  await call('task_worktree', {}, { task: second }); // branch task-2
  return { id, dir, origin, first, second };
}
// The project deleted (its data; never its folder) and its folders after it, once its tasks' shells have left them:
// Windows does not remove a process's folder.
async function dropProject(core: Core, ui: Page, id: string, folders: string[]) {
  const deleted = invoke(ui, 'project:delete', { id });
  await answer(ui);
  await deleted;
  await expect.poll(() => core((k, p) => !k.shell.open.has(p) && !k.shell.store.projects().some((x) => x.id === p), id)).toBe(true);
  await removed(...folders);
}

test('tasks: Delete Task… asks first, saying what goes and any work not in main and not pushed; it goes with its branch, folder and profiles', async ({ core, ui, files, call }) => {
  await begin(core, ui, files, { only: true, columns: true, featureX: call });
  const project = files.project;
  // A task with its own worktree and its agent's session (a transcript of its own), nothing changed in it.
  const empty = await newTask(core, ui);
  await call('task_worktree', {}, { task: empty });
  const transcript = path.join(files.root, 'task-3-transcript.jsonl');
  fs.writeFileSync(transcript, '');
  await reportSession(core, empty, 's-3', transcript);
  const dir = path.join(files.userData, 'projects', files.pid('project'), empty.split('/')[1]);
  await rightClick(ui, taskTab(ui, empty));
  await choose(ui, 'Delete Task…');
  const q0 = await answer(ui);
  await expect.poll(async () => (await core((k, key) => !k.shell.current.tasks.has(key.split('/')[1]), empty)) && isNth(core, 2)).toBe(true);
  expect(q0.message, 'asked also without changes').toBe('Delete the task task-3?');
  expect(q0.detail.startsWith('Deleted for good:') && q0.detail.includes(`${project}@task-3`) && q0.detail.includes('its branch task-3'), q0.detail).toBe(true);
  expect(q0.detail).not.toContain('not in main');
  // Its data marked for the next start too: its profiles' sessions keep files open until Kulisa quits, which Windows
  // does not delete (Linux does).
  const deleted = path.join(files.userData, 'deleted-folders.json');
  const marked = () => fs.existsSync(deleted) && JSON.parse(fs.readFileSync(deleted, 'utf8')).includes(dir);
  await expect.poll(() => !fs.existsSync(`${project}@task-3`) && marked() && (WIN || !fs.existsSync(dir))).toBe(true);
  // direnv's permission for its .envrc: no record of the task's folder left.
  const allow = path.join(files.root, 'xdg-data', 'direnv', 'allow');
  if (hasDirenv) expect((fs.existsSync(allow) ? fs.readdirSync(allow) : []).some((f) => fs.readFileSync(path.join(allow, f), 'utf8').includes(`${project}@task-3`))).toBe(false);
  expect(fs.existsSync(transcript), "the test's own agent: Kulisa knows only Claude Code's conversations (agents/)").toBe(true);
  expect(git(project, 'branch', '--list', 'task-3')).toBe('');
  await expect.poll(() => taskTabs(ui)).toEqual(['task-1', 'Feature-X *']);

  // Renamed by the human (Rename… in its tab's menu), with a commit of its own and a file not committed.
  const spike = await newTask(core, ui), was = await core((k, key) => k.shell.taskByKey(key).name, spike);
  await call('task_worktree', {}, { task: spike }); // its own worktree, to commit in and to delete with it
  await rightClick(ui, taskTab(ui, spike));
  await choose(ui, 'Rename…');
  const renaming = ui.getByRole('dialog', { name: 'Rename Task' }), field = renaming.getByRole('textbox', { name: 'Name' });
  await expect(renaming).toBeVisible();
  await expect(field).toHaveValue(was);
  await expect(field).toBeFocused();
  // Typed, and Enter (with its character, as a keyboard sends it: the form is sent on it): the dialog's form is sent.
  await field.fill('Spike');
  await field.press('Enter');
  await expect.poll(() => core((k, key) => k.shell.taskByKey(key).name, spike)).toBe('Spike');
  await expect(renaming).toHaveCount(0);
  const { branch, folder } = await core((k, key) => { const t = k.shell.taskByKey(key); return { branch: t.branch, folder: t.folder }; }, spike);
  expect(branch).toBe('spike');
  expect(folder, 'the folder stays').toBe(`${project}@${was}`);
  fs.writeFileSync(path.join(folder, 'idea.txt'), 'x');
  git(folder, 'add', '-A'); git(folder, 'commit', '-qm', 'idea');
  fs.writeFileSync(path.join(folder, 'more.txt'), 'y');
  const remove = async (yes: boolean) => {
    const done = invoke(ui, 'task:delete', spike), q = await answer(ui, yes);
    await done;
    return q;
  };
  let q = await remove(false);
  expect(q.message).toBe('Delete the task Spike?');
  expect(q.detail).toMatch(/Work not in main and not pushed, deleted with it:\n• 1 commit of its own and 1 uncommitted file/);
  expect(await core((k, key) => k.shell.current.tasks.has(key.split('/')[1]), spike) && fs.existsSync(folder), 'kept when the human says no').toBe(true);
  // Pushed, its commit is on the remote: only the file not committed is lost.
  const remote = path.join(files.root, `remote-${rand()}.git`);
  git(files.root, 'init', '-q', '--bare', remote);
  git(project, 'remote', 'add', 'backup', remote);
  git(folder, 'push', '-q', 'backup', 'spike');
  q = await remove(false);
  expect(q.detail).toMatch(/not pushed, deleted with it:\n• 1 uncommitted file$/);
  git(project, 'remote', 'remove', 'backup');
  await remove(true);
  await expect.poll(async () => (await core((k, key) => !k.shell.current.tasks.has(key.split('/')[1]), spike)) && isNth(core, 2)).toBe(true);
  // The folder goes first (git worktree remove), then the branch.
  await expect.poll(() => !fs.existsSync(folder) && git(project, 'branch', '--list', 'spike') === '').toBe(true);
  expect(files.tasksOf(files.pid('project')).map((e) => e.name)).toEqual(['task-1', 'Feature-X']);
  await removed(remote);
});

test("tasks: a closed task whose PR is merged on the remote is marked in its group's menu; Delete Merged Tasks… deletes it after one question", async ({ core, ui, files, call }) => {
  await begin(core, ui, files, { only: true, columns: true, featureX: call });
  const { id, dir, origin, first, second } = await remoteProject(core, ui, files, call, 'merge');
  const folders = await core((k, keys) => keys.map((key) => { const t = k.shell.taskByKey(key); return { folder: t.folder, branch: t.branch }; }), [first, second]);
  // task-1's work pushed, and merged into main on the remote; task-2 has a commit not merged.
  fs.writeFileSync(path.join(folders[0].folder, 'b.txt'), 'b'); git(folders[0].folder, 'add', '-A'); git(folders[0].folder, 'commit', '-qm', 'b');
  git(folders[0].folder, 'push', '-q', 'origin', `${folders[0].branch}:main`);
  fs.writeFileSync(path.join(folders[1].folder, 'c.txt'), 'c'); git(folders[1].folder, 'add', '-A'); git(folders[1].folder, 'commit', '-qm', 'c');
  await taskTab(ui, first).getByRole('button', { name: 'Close' }).click();
  await expect.poll(() => core((k, key) => { const t = k.shell.taskByKey(key); return !!t.entry.closed && !!t.entry.merged; }, first), { timeout: 10000 }).toBe(true); // a fetch from the remote
  await choose(ui, 'Delete Merged Tasks…', await projectMenu(ui));
  expect((await answer(ui)).message).toBe('Delete the task task-1?');
  await expect.poll(async () => !(await core((k, key) => k.shell.current.tasks.has(key.split('/')[1]), first)) && !fs.existsSync(folders[0].folder)).toBe(true);
  expect(await core((k, key) => k.shell.current.tasks.has(key.split('/')[1]) && !k.shell.taskByKey(key).entry.merged, second), 'one not merged stays').toBe(true);
  await invoke(ui, 'project:close-tasks', { id });
  await expect.poll(() => core((k, p) => !k.shell.open.has(p), id)).toBe(true);
  await dropProject(core, ui, id, [dir, origin]);
});

test("tasks: a closed task is deleted from its row, 🗑 or Delete, in the sidebar, its project loaded or not, after the question Delete Task… asks", async ({ core, ui, files, call }) => {
  // About 2 s: git's work (worktrees made and removed).
  await begin(core, ui, files, { only: true, columns: true, featureX: call });
  // A project not loaded, its one task closed, with a commit not merged.
  const { id, dir, origin, first, second } = await remoteProject(core, ui, files, call, 'gone');
  const deleted = invoke(ui, 'task:delete', first);
  await answer(ui);
  await deleted;
  await expect.poll(() => core((k, key) => !k.shell.current.tasks.has(key.split('/')[1]), first)).toBe(true);
  const made = await core((k, key) => k.shell.taskByKey(key).folder, second);
  fs.writeFileSync(path.join(made, 'c.txt'), 'c'); git(made, 'add', '-A'); git(made, 'commit', '-qm', 'c');
  await invoke(ui, 'project:close-tasks', { id });
  await expect.poll(() => core((k, p) => !k.shell.open.has(p), id)).toBe(true);
  const entry = (name: string) => core((k, a) => k.shell.store.tasksOf(k.shell.store.projects().find((x) => x.id === a.id)).list.find((e) => e.name === a.name) ?? null, { id, name });
  // A task's row under its project in the sidebar.
  const project: string = await core((k, i) => k.shell.store.projects().find((p) => p.id === i).name, id);
  const row = (name: string) => taskRow(ui, project, name);
  const folder = (await entry('task-2')).resources[0].folder;
  // The sidebar docked, the empty window's: close the open tasks to get there.
  for (const open of await core((k) => [...k.shell.open.keys()])) await invoke(ui, 'project:close-tasks', { id: open });
  await expect.poll(() => core((k) => k.shell.open.size)).toBe(0);
  await expect(ui.locator('html')).toHaveAttribute('data-page', /^(sidebar|welcome)$/);
  await expect(sidebar(ui)).toBeVisible();
  await expect(row('task-2').getByRole('button', { name: 'Delete Task…' }), 'shown on the row the pointer or the keyboard is on').toHaveCount(0);
  await row('task-2').press('Delete');
  const q = await answer(ui, false);
  expect(q.message).toBe('Delete the task task-2?');
  expect(q.detail, 'its work not in main, as Delete Task… says').toMatch(/1 commit of its own/);
  expect(!!(await entry('task-2')) && fs.existsSync(folder), 'Cancel keeps it').toBe(true);
  await (await rowButton(row('task-2'), 'Delete Task…')).click();
  await answer(ui);
  await expect.poll(async () => !(await entry('task-2')) && !fs.existsSync(folder)).toBe(true);
  expect(await core((k, p) => k.shell.open.has(p), id), 'not opened for it').toBe(false);
  await expect(sidebar(ui).locator(`[data-project="${id}"] [data-task]`), 'it has no closed task left in the sidebar').toHaveCount(0);

  // Back to project's task-1 and Feature-X.
  await taskRow(ui, 'project', 'task-1').click();
  await nthShown(core, 1);
  await expect.poll(() => core((k) => k.shell.task.loaded && !!k.shell.pty)).toBe(true);
  await notLoading(ui);
  await fromSidebar(ui, 'project', 'Feature-X');
  await nthShown(core, 2);
  await expect.poll(() => core((k) => k.shell.task.loaded && !!k.shell.pty)).toBe(true);
  await taskTab(ui, files.tkey('project', 1)).click();
  await nthShown(core, 1);
  await core((k) => k.watchPty(k.shell.pty));
  await dropProject(core, ui, id, [dir, origin]);
});
