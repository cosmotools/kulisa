// A project of several repositories (docs/tasks.md, Several repositories): a task's worktree made on demand, another
// repository added to a task and removed from it, by the human and by the agent, and the project's folders.
import fs from 'fs';
import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.ts';
import type { Core } from './fixtures.ts';
import { menu, choose, rightClick, closeSettings, termText, termDump, invoke, answer, projectMenu, pageOf, onRow, removed, group, listRows, listRow } from './helpers.ts';
import { git, committed, hook, newTask, showTask, openFolder, projectShown } from './tasks-helpers.ts';

// What the agent is told at a session's start (its SessionStart hook, as its plugin sends it: agent-hooks.ts).
const sessionContext = async (core: Core, task: string) => (await hook(core, task, 'session-start')).hookSpecificOutput.additionalContext as string;
// The task's agent's state, as its hooks report it.
const setState = (core: Core, task: string, state: string) => core((k, a) => { const t = k.shell.taskByKey(a.task); t.setState(t.agentTerminals()[0], a.state as never); }, { task, state });
// The terminal shows text n times (typed, then echoed by the agent: cat).
const shownTimes = async (ui: Page, text: string, n: number) => {
  try { await expect.poll(async () => (await termText(ui)).split(text).length - 1).toBe(n); } catch (e) {
    throw new Error(`the terminal does not show ${JSON.stringify(text)} ${n} times: ${JSON.stringify(await termDump(ui))}`, { cause: e });
  }
};

test('projects: several repositories: a task works in the main tree until it makes its worktree (task_worktree); another repository is added when it needs it (the human on its tab, the agent with task_add_repository), on its branch, its agent told; a repository tasks have a worktree of is not removed', async ({ core, ui, sui, call, files }) => {
  test.slow(); // git's work: worktrees made and removed, two clones
  const root = files.root;
  await removed(...['api', 'web', 'docs', 'notes', 'docs.git', 'notes.git', 'plain'].map((d) => path.join(root, d)));
  const repo = (name: string) => committed(path.join(root, name), 'a.txt', name, name);
  const api = repo('api'), web = repo('web');
  await openFolder(core, ui, api);
  const pid = files.pid('api'), first = await core((k) => k.shell.task.key), firstId = first.split('/')[1];
  const of = (key: string) => core((k, t) => { const x = k.shell.taskByKey(t); return { folder: x.folder, worktrees: x.worktrees.map((c) => ({ repo: c.repo, folder: c.folder, branch: c.branch })), addable: x.addable(), dirs: x.dirs() }; }, key);
  // The Resources panel (Resources.tsx): each row its label, its branch line (or 'main working tree'), and whether it
  // can be removed (an added repository's worktree can; the main tree and the task's own worktree cannot).
  const resources = ui.locator('#resources').getByRole('list', { name: 'Folders' }).getByRole('listitem');
  const rows = async (want: [string, string, boolean][]) => {
    await expect(resources).toHaveCount(want.length);
    for (const [i, [label, line, removable]] of want.entries()) {
      await expect(resources.nth(i).getByRole('button', { name: label, exact: true })).toHaveText(label + line);
      await expect(resources.nth(i).getByRole('button', { name: 'Remove Repository' })).toHaveCount(removable ? 1 : 0);
    }
  };
  const copyOf = async (name: string) => (await of(first)).worktrees.find((c) => path.basename(c.repo) === name).folder;
  // At open: the project's main working tree (the human's folder), no worktree of its own yet (worktree-on-demand).
  let f = await of(first);
  expect(f.folder, 'the main working tree until it makes its own').toBe(api);
  expect(f.worktrees.length, 'no worktree yet').toBe(0);
  await rows([['api', 'main working tree', false]]); // one row: the main working tree
  expect(f.addable, 'no copies yet: nothing to add').toEqual([]);
  // The agent makes its worktree: the row becomes the worktree on its branch; still one repository, nothing to tell.
  const b1 = `task-${firstId}`, own = `${api}@${b1}`; // its branch while it is unnamed: task-<its id>
  expect((await call('task_worktree', {})).text).toMatch(new RegExp(`works in its own worktree ${RegExp.escape(own)}, on branch ${b1}`));
  f = await of(first);
  expect(f.folder).toBe(own);
  expect(f.worktrees.length).toBe(1);
  await rows([['api', `branch ${b1}`, false]]);
  expect(f.addable).toEqual([]);
  // A second repository added to the project (Project Settings…, project:folder-add): the task may add it, not copied
  // yet; its agent told it is there to read, to ask before changing it.
  const added = await invoke(ui, 'project:folder-add', { id: pid, folder: web });
  expect(added.folders.map((r: { folder: string }) => r.folder)).toEqual([api, web]);
  f = await of(first);
  expect([f.dirs, f.addable]).toEqual([[], [web]]);
  // Its agent is told of the other repository live, at a session's start (the MCP server's instructions are frozen at
  // open, before the project had it): to read it there and ask before changing it.
  const toldOfWeb = new RegExp(`repositories, not in this task: ${RegExp.escape(web)}\\. Read them there freely.*first ask the human.*task_add_repository`);
  expect(await sessionContext(core, first)).toMatch(toldOfWeb);
  await rows([['api', `branch ${b1}`, false]]); // still only its own worktree until it adds one
  // Add Repository on its tab: a copy on its branch, into the task's folder of copies; its agent given it (an agent
  // without /add-dir: a line saying so, sent; Claude Code's question after /add-dir: checked by hand), not while it
  // waits for the human (Enter would answer the question), once it no longer does.
  await setState(core, first, 'waiting');
  await rightClick(ui, `#taskTabs [data-task="${first}"]`);
  await expect(menu(ui)).toMatchAriaSnapshot(`
    - /children: contain
    - text: Add Repository
    - menuitem "web"
    - menuitem "Rename…"
  `);
  await choose(ui, 'web');
  await expect.poll(async () => (await of(first)).worktrees.length).toBe(2);
  const webCopy = await copyOf('web');
  expect(git(webCopy, 'rev-parse', '--abbrev-ref', 'HEAD'), "on the task's branch").toBe(b1);
  // Resources shows the added worktree too, removable; its own worktree and the main tree are not.
  await rows([['api', `branch ${b1}`, false], ['web', `branch ${b1}`, true]]);
  f = await of(first);
  expect([f.dirs, f.addable]).toEqual([[webCopy], []]);
  expect(await termText(ui), 'not while it waits for the human').not.toContain(`Kulisa added ${webCopy}`);
  await setState(core, first, 'done');
  // Sent, not left in its prompt: shown as typed, then again as the agent (cat) read the line on Enter.
  await shownTimes(ui, `Kulisa added ${webCopy} to this task`, 2);
  // A new task: the main working tree again (no copy); once it makes its own worktree it is told of the other
  // repository, to read it there and ask before adding it.
  const second = await newTask(core, ui, undefined, pid);
  let t = await of(second);
  expect(t.folder, 'a new task opens in the main working tree too').toBe(api);
  expect([t.worktrees, t.addable]).toEqual([[], []]);
  await call('task_worktree', {});
  const home = path.join(await core((k) => k.shell.projectsHome), 'api@task-2');
  t = await of(second);
  expect(t.folder).toBe(path.join(home, 'api'));
  expect([t.dirs, fs.existsSync(path.join(home, 'web'))]).toEqual([[], false]);
  expect(await sessionContext(core, second)).toMatch(toldOfWeb);
  // The agent adds it in its turn, once the human agreed: a copy on its branch, given to it in the turn by an agent's
  // own command (Claude Code's /add-dir: it runs at once); the same refused again.
  await core((k, key) => { k.shell.taskByKey(key).agentTerminals()[0].agent.addDir = { command: (folder: string) => `/add-dir ${folder}` }; }, second);
  await setState(core, second, 'working');
  expect((await call('task_add_repository', { repository: 'web' })).text).toMatch(/Added: .*api@task-2[\\/]web, on branch task-2/);
  expect((await of(second)).dirs).toEqual([path.join(home, 'web')]);
  await shownTimes(ui, `/add-dir ${path.join(home, 'web')}`, 2);
  await core((k, key) => { delete k.shell.taskByKey(key).agentTerminals()[0].agent.addDir; }, second);
  await setState(core, second, 'done');
  await expect(call('task_add_repository', { repository: 'web' })).rejects.toThrow(/has .*web already/);
  // Its agent names it: the branch of each copy.
  await call('task_rename', { name: 'Checkout' });
  for (const r of ['api', 'web']) expect(git(path.join(home, r), 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('checkout');
  // Project Settings… shows them, the default first; removing one tasks have a worktree of is refused, naming them.
  await choose(ui, 'Project Settings…', await projectMenu(ui, `#taskTabs [data-project="${pid}"]`));
  const s = await sui();
  await pageOf(s, 'api');
  await expect(listRows(s, 'Folders')).toHaveCount(2);
  for (const [i, [label, isDefault]] of ([['api', true], ['web', false]] as const).entries()) {
    const row = listRows(s, 'Folders').nth(i);
    await expect(row).toHaveAttribute('aria-label', label);
    await expect(row.getByText('Default', { exact: true })).toHaveCount(isDefault ? 1 : 0);
  }
  await expect(listRow(s, 'Folders', 'web')).toHaveAttribute('data-folder', web);
  await onRow(s, listRow(s, 'Folders', 'web'), 'Remove from the Project');
  await expect(group(s, 'Folders').getByText(/Tasks work in it: New Task, Checkout/)).toBeVisible();
  await closeSettings(core, ui, sui);
  // Removed again by its agent once the human agreed: nothing of its own in it, so not asked; its folder and branch
  // gone, the agent told once its turn is over. Its own folder is refused.
  await expect(call('task_remove_repository', { repository: 'api' })).rejects.toThrow(/task's own folder/);
  await setState(core, second, 'working');
  expect((await call('task_remove_repository', { repository: 'web' })).text).toMatch(new RegExp(`Removed: ${RegExp.escape(path.join(home, 'web'))}`));
  t = await of(second);
  expect([fs.existsSync(path.join(home, 'web')), git(web, 'branch', '--list', 'checkout'), t.dirs, t.addable]).toEqual([false, '', [], [web]]);
  expect(await termText(ui), 'not while it works').not.toContain('Kulisa removed');
  await setState(core, second, 'done');
  await shownTimes(ui, `Kulisa removed ${path.join(home, 'web')}`, 2);
  // Deleting the task: both copies, both branches and its folder go.
  const deleted = invoke(ui, 'task:delete', second);
  await answer(ui);
  await deleted;
  await expect.poll(() => fs.existsSync(home)).toBe(false);
  expect(git(web, 'branch', '--list', 'checkout') + git(api, 'branch', '--list', 'checkout')).toBe('');
  // Back on the first, shown again: the human removes its web by the Resources panel's 🗑 (nothing uncommitted in
  // it: not asked); its own worktree's row has no Remove.
  await showTask(core, ui, first);
  await expect(resources).toHaveCount(2);
  await resources.filter({ has: ui.getByRole('button', { name: 'web', exact: true }) }).getByRole('button', { name: 'Remove Repository' }).click();
  await expect.poll(() => fs.existsSync(webCopy)).toBe(false);
  await rows([['api', `branch ${b1}`, false]]);
  await expect(ui.getByRole('alertdialog'), 'nothing of its own: not asked').toHaveCount(0);
  // Cloned from a URL (a local one here) next to the project's folder, offered to the first; made the default.
  const bare = path.join(root, 'docs.git');
  git(root, 'clone', '-q', '--bare', web, bare);
  const cloned = await invoke(ui, 'project:folder-clone', { id: pid, url: bare });
  expect(cloned.folders.map((r: { folder: string }) => r.folder)).toEqual([api, web, path.join(root, 'docs')]);
  expect((await of(first)).addable, 'web is addable again, and the clone').toEqual([web, path.join(root, 'docs')]);
  const inMain = await newTask(core, ui, undefined, pid); // in the main tree, api's, when web becomes the default: it stays there
  expect((await invoke(ui, 'project:folder-default', { id: pid, folder: web })).folders[0].folder).toBe(web);
  expect((await of(inMain)).folder, 'where it opened, though the default is web now').toBe(api);
  // The human adds web back on its tab, then removes it with a file not committed there: asked first, told what goes.
  await rightClick(ui, `#taskTabs [data-task="${first}"]`);
  await choose(ui, 'web');
  await expect.poll(async () => (await of(first)).worktrees.length).toBe(2);
  const webCopy2 = await copyOf('web');
  fs.writeFileSync(path.join(webCopy2, 'b.txt'), 'work');
  const removeWeb = async (yes: boolean) => {
    await rightClick(ui, `#taskTabs [data-task="${first}"]`);
    await expect(menu(ui)).toMatchAriaSnapshot(`
      - /children: contain
      - text: Remove Repository
      - menuitem "web"
      - menuitem "Rename…"
    `);
    await choose(ui, 'web');
    return answer(ui, yes);
  };
  const q = await removeWeb(false);
  expect(q.message).toBe('Remove web from the task New Task?');
  expect(q.detail).toMatch(new RegExp(`its folder ${RegExp.escape(webCopy2)}, its branch ${b1}.*1 uncommitted file`, 's'));
  expect(fs.existsSync(webCopy2), 'kept when the human says no').toBe(true);
  await removeWeb(true);
  await expect.poll(() => !fs.existsSync(webCopy2) && git(web, 'branch', '--list', b1) === '').toBe(true); // the folder goes first, then the branch
  await invoke(ui, 'project:close-tasks', { id: pid });
  await expect.poll(() => core((k, i) => !k.shell.open.has(i), pid)).toBe(true);
  // A project without git, closed, getting repositories: its folder stays one of its folders, the default; a clone
  // goes next to it, not inside it.
  const plain = path.join(root, 'plain'), docs = path.join(root, 'docs'), notes = path.join(root, 'notes');
  fs.mkdirSync(plain);
  const plainId = await core((k, d) => { const p = k.shell.store.projectFor(d); k.shell.sendProjects(); return p.id; }, plain);
  await invoke(ui, 'project:folder-add', { id: plainId, folder: docs });
  git(root, 'clone', '-q', '--bare', web, `${notes}.git`);
  const site = await invoke(ui, 'project:folder-clone', { id: plainId, url: `${notes}.git` });
  expect(site.folders.map((r: { folder: string; git: string }) => `${r.folder} ${r.git}`)).toEqual([`${plain} none`, `${docs} ok`, `${notes} ok`]);
  // Its task, working in that folder, adds a repository: a copy on a branch of its own, the task staying where it works.
  await invoke(ui, 'project:open', { folder: plain });
  await projectShown(core, plainId);
  const inPlain = await core((k) => k.shell.task.key);
  expect((await of(inPlain)).folder).toBe(plain);
  expect((await of(inPlain)).addable).toEqual([docs, notes]);
  expect((await call('task_add_repository', { repository: 'docs' })).text).toMatch(/Added: .*plain@task-\w+[\\/]docs, on branch task-\w+/);
  const p = await of(inPlain);
  expect([p.folder, p.worktrees.map((c) => c.repo), p.addable]).toEqual([plain, [docs], [notes]]);
  expect(git(docs, 'branch', '--list', p.worktrees[0].branch), 'its branch in docs').toBeTruthy();
  await invoke(ui, 'project:close-tasks', { id: plainId });
  await expect.poll(() => core((k, i) => !k.shell.open.has(i), plainId)).toBe(true);
  // What it made gone, for a test after it: the projects with their tasks' copies, then the folders.
  for (const id of [pid, plainId]) {
    const deleted = invoke(ui, 'project:delete', { id });
    await answer(ui);
    await deleted;
  }
  await removed(...['api', 'web', 'docs', 'notes', 'docs.git', 'notes.git', 'plain'].map((d) => path.join(root, d)));
});
