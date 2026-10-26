// Tasks: each with its own copy of the code (a git worktree on a branch of its own; without git, the project's folder),
// copies of the profiles, its own agent; closing, opening again, renaming and deleting them (docs/tasks.md).
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.ts';
import type { Core, Call } from './fixtures.ts';
import type { Files } from './data.ts';
import { SITE, WIN, menuRows, choose, rightClick, plusMenu, plusRows, focusWindow, viewOn, who, invoke, notLoading, noSlide, asked, projectMenu, removed } from './helpers.ts';
import { git, rand, hasDirenv, keyAt, isNth, nthShown, taskTab, taskTabs, hook, reportSession, newTask, openFolder, projectShown, begin, bothOn } from './tasks-helpers.ts';

// Sam.admin's master signed in (as master, a lasting cookie too) or out in its own window, as the human does it there
// (tested in the profiles' tests); closed after.
async function master(core: Core, files: Files, signedIn: boolean) {
  await core((k, id) => k.shell.openMaster(id), files.idOf('Sam.admin'));
  await expect.poll(() => core((k) => !![...k.shell.masters.values()][0]?.profile.get())).toBe(true);
  await core(async (k, url) => {
    const m = [...k.shell.masters.values()][0], wc = m.profile.get().wc;
    const loaded = new Promise<void>((r) => wc.once('did-finish-load', () => r()));
    await m.win.webContents.executeJavaScript(`kulisa.invoke('master:go', ${JSON.stringify(url)})`);
    await loaded;
    m.win.close();
  }, `${SITE}/app/${signedIn ? 'login?name=master&kept' : 'logout'}`);
  await expect.poll(() => core((k) => k.shell.masters.size)).toBe(0);
}

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
  await core((k) => { k.answer = true; });
  await invoke(ui, 'project:delete', { id });
  await expect.poll(() => core((k, p) => !k.shell.open.has(p) && !k.shell.store.projects().some((x) => x.id === p), id)).toBe(true);
  await removed(...folders);
}

test("tasks: without git a task works in the project's folder, and a second one there is asked about first", async ({ core, ui, files }) => {
  // A project of its own, its folder without git (the tests' project is made a git repository by the others).
  const dir = path.join(files.root, `nogit-${rand()}`);
  fs.mkdirSync(dir);
  const made = await invoke(ui, 'project:new', { from: 'folder', folders: [dir], name: 'nogit' });
  expect(made.id, JSON.stringify(made)).toBeTruthy();
  await invoke(ui, 'project:open', { id: made.id });
  await projectShown(core, made.id);
  const key = await core(async (k) => { await k.shell.task.rename('task-1'); return k.shell.task.key; }); // named for the test to refer to it by
  await expect.poll(() => taskTabs(ui)).toEqual(['task-1 *']);
  expect(await core((k) => [k.shell.task.folder, (k.shell.task.entry as { worktree?: string }).worktree ?? null])).toEqual([dir, null]);
  await expect(taskTab(ui, key)).toHaveAttribute('title', /in the project's folder .*no git/);
  await core((k) => { k.answer = false; });
  await plusMenu(ui, 'nogit');
  const q = await asked(core);
  expect(q.message).toBe('Another task of nogit works in its folder');
  expect(q.detail).toMatch(/may get in each other's way/);
  await core((k) => { k.answer = true; });
  expect(await core((k) => k.shell.current.tasks.size), 'none made when the human says no').toBe(1);
  await dropProject(core, ui, made.id, [dir]);
});

test('tasks: + opens a task in the project\'s main working tree ("New Task", no worktree, no port offset); its profiles closed until opened (each a copy of its master); the agent makes its worktree and names it with task_worktree', async ({ core, ui, files, call, mcp }) => {
  test.slow(); // the island held back 6 s by design, then git's work
  await begin(core, ui, files, { only: true, columns: true });
  await master(core, files, false);
  const project = files.project, SAM = files.idOf('Sam.admin'), ELON = files.idOf('Elon.buyer'), DORA = files.idOf('Dora');
  const first = await core((k) => k.shell.task.key);
  await call('browser_navigate', { profile: 'Sam.admin', url: `${SITE}/app?task` });
  // The island's buttons are for a task with nothing open: a task opening shows its agent's tab at once, starting,
  // not them for the second its agent is looked for.
  await ui.evaluate(() => {
    const w = window as any;
    w.__launch = false; w.__starting = '';
    new MutationObserver(() => { w.__launch ||= !!document.querySelector('#dock [data-testid="launchers"]'); w.__starting ||= [...document.querySelectorAll('#dock [role="status"]')].find((s) => s.textContent.startsWith('Starting '))?.textContent; })
      .observe(document.body, { childList: true, subtree: true });
  });
  // Looking for it takes the user's login shell, slower on the human's computer than here: it waits until the test has
  // seen it starting.
  await core((k) => {
    const g = k.stash, find = k.shell.findAgent;
    g.find = find; g.found = false;
    Object.assign(k.shell, { findAgent: async (...a: Parameters<typeof find>) => { await new Promise((r) => { g.look = r; }); const r = await find(...a); g.found = true; return r; } });
  });
  // Its agent waits for its terminal's size however late the window lays the island out: not at a default one after
  // 5 s, which a loaded machine reaches. The island hidden while the main process's clock goes 6 s on after the agent
  // is found (driver.ts, clock: its timers of a second or more).
  await ui.evaluate(() => document.head.append(Object.assign(document.createElement('style'), { id: 'lateIsland', textContent: '[data-testid="terminal"] { display: none !important; }' })));
  const sent = await ui.evaluate(() => (window as any).__ptySizes.length);
  await core((k) => k.clock.hold(1000));
  const late = (async () => {
    await expect.poll(() => ui.evaluate(() => (window as any).__starting)).toBeTruthy();
    await core((k) => k.stash.look());
    await expect.poll(() => core((k) => k.stash.found), { timeout: 10000 }).toBe(true);
    await core((k) => k.clock.advance(6000));
    await ui.evaluate(() => document.getElementById('lateIsland').remove());
  })();
  const task = await newTask(core, ui, null); // left "New Task": this test names it with task_worktree below
  await late;
  await core((k) => { k.clock.release(); Object.assign(k.shell, { findAgent: k.stash.find }); });
  await expect.poll(() => ui.evaluate(() => (window as any).__ptySizes.length)).toBeGreaterThan(sent);
  expect(await core((k, key) => k.shell.taskByKey(key).pty.spawnSize, task), 'at its real size').toEqual(await ui.evaluate((n) => (window as any).__ptySizes[n], sent));
  expect(await ui.evaluate(() => (window as any).__launch), "no island's buttons while its agent starts").toBe(false);
  expect(await ui.evaluate(() => (window as any).__starting), 'its tab, starting').toMatch(/^Starting .+…$/);
  await expect(ui.getByRole('status').filter({ hasText: /^Starting / })).toHaveCount(0); // then its terminal
  // At open nothing is made: "New Task", the terminal in the project's main working tree (the human's folder), no
  // worktree, no branch, no port offset. The agent makes the worktree itself (below).
  const made = await core((k, key) => {
    const t = k.shell.taskByKey(key);
    return { nth: [...t.project.tasks.values()].indexOf(t) + 1, name: t.name, folder: t.folder, branch: t.branch, resources: t.entry.resources, env: t.env(), base: k.shell.mcp.base, resumed: k.shell.resumedSession };
  }, task);
  expect(made.nth).toBe(2);
  expect(task).toBe(files.tkey('project', 2));
  expect(made.name).toBe('New Task');
  expect(made.folder, 'the main working tree until it makes its own').toBe(project);
  expect(made.branch).toBe(null);
  expect(made.resources, 'the main tree, no worktree yet').toEqual([{ kind: 'maintree', folder: project }]);
  expect(made.env).toEqual({ KULISA_MCP_URL: `${made.base}/task/${task}/mcp`, KULISA_URL: `${made.base}/task/${task}`, KULISA_TASK: 'New Task' });
  expect(made.resumed, 'a new conversation').toBe(null);
  const told = (await mcp({ task })).getInstructions();
  expect(told, 'where it works, told to any agent').toMatch(new RegExp(`This is the Kulisa task "New Task"\\. Your terminal is in the project's folder .*${RegExp.escape(path.basename(project))}, which is the human's: do not change it on your own\\.`));
  expect(told).toMatch(/make the task its own git worktree with task_worktree .*pass its name to name the task at the same time if it is still "New Task"/);
  expect(told).toMatch(/Run the app under test on a free port you pick \(Kulisa assigns none\)/);
  expect(told).toMatch(/Name the task with task_rename once you know what it is about/);
  expect(told).not.toMatch(/KULISA_PORT_OFFSET|usual ports|plus 100/);

  // Profiles: none opens by itself, nothing taken from the task on screen; the agent opens those it needs, each a copy
  // of its master (not of the first task's copy: what was signed in there stays there; a master's sign-ins come with it).
  expect(await core((k) => [...k.shell.profiles.keys()])).toEqual([]);
  expect(await core((k) => [...k.shell.closed.keys()])).toEqual([SAM, ELON, DORA]);
  expect(fs.existsSync(files.pfile(SAM, 2)), 'no copy before it is opened').toBe(false);
  await call('profile_open', { profile: 'Sam.admin' }, { task });
  await call('profile_open', { profile: 'Elon.buyer' }, { task });
  await expect.poll(() => core((k, ids) => ids.every((id) => k.shell.profiles.has(id)), [SAM, ELON])).toBe(true);
  expect(await core((k, ids) => ids.map((id) => [k.shell.profiles.get(id).avatar, k.shell.profiles.get(id).description]), [SAM, ELON]), 'with their pictures and who they are')
    .toEqual([['fox', 'seller in the test shop'], ['owl', '']]);
  expect((await core((k, id) => k.shell.profiles.get(id).dir, SAM)).startsWith(path.join(files.userData, 'projects', files.pid('project'), task.split('/')[1]))).toBe(true);
  expect(fs.existsSync(files.pfile(DORA, 2)), 'a closed one is copied when it is first opened').toBe(false);
  await call('browser_navigate', { profile: 'Sam.admin', url: `${SITE}/app` }, { task });
  expect(await who((n, a) => call(n, a, { task }), 'Sam.admin'), 'its master was never signed in').toBe('Signed out');
  // Signed in in this task's copy: there only.
  await call('browser_navigate', { profile: 'Sam.admin', url: `${SITE}/app/login?name=sam` }, { task });
  expect(await who((n, a) => call(n, a, { task }), 'Sam.admin')).toBe('Signed in as sam');
  expect(await who((n, a) => call(n, a, { task: first }), 'Sam.admin'), "the first task's own sign-in").toBe('Signed in as sam');
  // The first task's profiles keep running, hidden; its agent sees its own.
  expect(await core((k, a) => {
    const s = k.shell.taskByKey(a.first).profiles.get(a.SAM);
    return [s.tabs.every((t) => !t.wc.isDestroyed()), s.get().view.getVisible(), s.get().wc.getURL()];
  }, { first, SAM })).toEqual([true, false, `${SITE}/app?task`]);
  expect((await call('browser_snapshot', { profile: 'Sam.admin' }, { task: first })).text).toMatch(/URL: .*\/app\?task/);
  expect(await core((k, key) => { const f = k.shell.taskByKey(key); return !!f.pty && f.pty !== k.shell.pty; }, first)).toBe(true);
  expect(files.json(files.pfile('agent.json', 2)).conversations[0].agent, "no agent in the project: the one there is (the tests' own)").toBe('custom');

  // The window: the task's grid with its panes; the bar shows it, "New Task" until it is named.
  await expect(taskTab(ui, task)).toHaveText('New Task');
  await expect(taskTab(ui, task)).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => viewOn(core, ui, files, 'Sam.admin')).toBe(true);
  await expect(ui.locator('[role="region"][data-profile]')).toHaveCount(2);

  // It makes its own worktree, naming the task in the same call (task_worktree's name, since it is still "New Task"):
  // the tab and the branch take the name, the folder becomes the worktree; the project's folder stays the human's.
  // The Resources island: the main working tree until it has its own worktree, then the worktree on its branch.
  const resources = () => ui.evaluate(() => [...document.querySelectorAll('#resources li > [role="button"]')].map((r) => r.textContent.trim()));
  expect(await resources()).toEqual([`${path.basename(project)}main working tree`]);
  // Two of its agents at once (each a call) get the one worktree, not one each.
  const wt = `${project}@feature-x`, trees = () => git(project, 'worktree', 'list').split('\n').length, before = trees();
  // The second sent once the first is at work (named: making the worktree): the first to arrive makes the folder, named
  // after the task as it is then, and the two calls' order over HTTP is the OS's.
  const naming = call('task_worktree', { name: 'Feature-X' }, { task });
  await expect.poll(() => core((k, key) => !!k.shell.taskByKey(key).entry.named, task)).toBe(true);
  const both = await Promise.all([naming, call('task_worktree', {}, { task })]);
  for (const r of both) expect(r.text).toMatch(new RegExp(`works in its own worktree .*${RegExp.escape(path.basename(project))}@feature-x, on branch feature-x`));
  expect(trees(), 'one worktree').toBe(before + 1);
  await expect.poll(resources).toEqual([`${path.basename(project)}branch feature-x`]);
  expect(await invoke(ui, 'task:open-folder', { key: task, folder: '/' }), 'only a folder of the task').toBe(undefined);
  await expect(taskTab(ui, task)).toHaveText('Feature-X');
  expect(await core((k, key) => { const t = k.shell.taskByKey(key); return [t.name, t.entry.named, t.folder]; }, task)).toEqual(['Feature-X', true, wt]);
  expect(git(wt, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('feature-x');
  expect(git(wt, 'rev-parse', 'HEAD'), 'from HEAD (no remote here)').toBe(git(project, 'rev-parse', 'HEAD'));
  expect(fs.readFileSync(path.join(wt, '.env'), 'utf8')).toBe('SECRET=1\n');
  expect(fs.readFileSync(path.join(wt, 'config', 'local.json'), 'utf8'), '.worktreeinclude').toBe('{"db":"local"}');
  expect(fs.readFileSync(path.join(wt, '.claude', 'settings.local.json'), 'utf8'), "an agent's local settings (its localFiles)").toBe('{"model":"x"}');
  expect(fs.existsSync(path.join(wt, 'README.md')) && !fs.existsSync(path.join(wt, 'wip.txt')), 'uncommitted changes are not carried').toBe(true);
  expect(fs.existsSync(path.join(wt, '.kulisa')), 'nothing of Kulisa in the folder').toBe(false);
  if (hasDirenv) expect(execFileSync('direnv', ['exec', wt, 'sh', '-c', 'echo $FROM_ENVRC'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()).toBe(`envrc of ${wt}`);
  expect([files.tasksOf(files.pid('project'))[1].name, files.tasksOf(files.pid('project'))[1].named]).toEqual(['Feature-X', true]);
  const png = test.info().outputPath('task.png');
  await core((k, f) => k.shot(f), png);
  await test.info().attach('task', { path: png, contentType: 'image/png' });
});

test("tasks: × closes a task: its agent stops and its tabs close, all else stays; asked first only while its agent works; its group's menu opens it again, its conversation resumed", async ({ core, ui, files, call }) => {
  await begin(core, ui, files, { only: true, columns: true, featureX: call });
  await master(core, files, true);
  const SAM = files.idOf('Sam.admin');
  const task = await newTask(core, ui);
  expect(await isNth(core, 3)).toBe(true);
  await call('task_worktree', {}, { task }); // its own worktree, so closing and deleting it have a folder and branch to keep or remove
  const transcript = path.join(files.root, 'task-3-transcript.jsonl');
  fs.writeFileSync(transcript, '');
  await reportSession(core, task, 's-3', transcript);
  expect(await core(async (k, a) => {
    const t = k.shell.taskByKey(a.task);
    return k.agentHooks.sessionStart(t, t.promptTarget(), { session_id: 's-3', transcript_path: a.transcript }).hookSpecificOutput.additionalContext;
  }, { task, transcript }), 'where it works, at the session start too').toMatch(/task "task-3": a git worktree of its own, .*project@task-3, on branch task-3.*free port you pick/s);
  // Working: the human is asked, and may keep it.
  const state = () => core((k, key) => k.shell.taskByKey(key).promptTarget()?.state, task);
  await hook(core, task, 'prompt');
  await expect.poll(state).toBe('working');
  await core((k) => { k.answer = false; });
  await taskTab(ui, task).getByRole('button', { name: 'Close' }).click();
  expect((await asked(core)).message).toBe('Close the task task-3?');
  expect(await core((k, key) => { const t = k.shell.taskByKey(key); return t.loaded && k.shell.task === t; }, task), 'kept open when the human says no').toBe(true);
  await core((k) => { k.answer = true; });
  await hook(core, task, 'stop'); // its turn over: closing asks nothing
  await expect.poll(state).toBe('done');
  await call('profile_open', { profile: 'Sam.admin' }, { task }); // a new task opens none by itself
  await core((k, a) => { k.stash.sam = k.shell.taskByKey(a.task).profiles.get(a.SAM); }, { task, SAM });
  // A copy of the master made after it was signed in to: signed in.
  await call('browser_navigate', { profile: 'Sam.admin', url: `${SITE}/app` }, { task });
  expect(await who((n, a) => call(n, a, { task }), 'Sam.admin')).toBe('Signed in as master');
  expect(await core(async (k) => (await k.stash.sam.session.cookies.get({ name: 'kept' })).map((c: { value: string }) => c.value)),
    "its lasting cookie too (Windows keeps the master's cookie database locked)").toEqual(['master']);
  expect(await core((k) => k.stash.sam.session.getCacheSize()), 'pages were cached').toBeGreaterThan(0);
  // What the agent's tools keep of its pages (a screenshot), in the task's data: kept while the task is closed, gone
  // when it is deleted.
  await call('browser_screenshot', { profile: 'Sam.admin' }, { task });
  const artifacts = await core((k, key) => k.shell.taskByKey(key).store.artifacts, task);
  expect(fs.readdirSync(artifacts)).toHaveLength(1);
  await taskTab(ui, task).getByRole('button', { name: 'Close' }).click();
  // Its agent and tabs gone.
  await expect.poll(async () => (await core((k, key) => { const t = k.shell.taskByKey(key); return !!t.entry.closed && !t.pty && k.stash.sam.tabs.every((x: { wc: { isDestroyed(): boolean } }) => x.wc.isDestroyed()); }, task)) && isNth(core, 2)).toBe(true);
  // Its profiles' caches cleared, as a profile closed alone (zoom-and-closing): kept, they stayed until it was deleted.
  await expect.poll(() => core((k) => k.stash.sam.session.getCacheSize())).toBe(0);
  expect(fs.readdirSync(artifacts), "the agent's screenshot kept").toHaveLength(1);
  expect(await core((k) => k.asked.length), 'not asked: nothing is lost').toBe(0);
  const { folder, id } = await core((k, key) => { const t = k.shell.taskByKey(key); return { folder: t.folder, id: t.id }; }, task);
  expect(fs.existsSync(folder) && !!git(files.project, 'branch', '--list', 'task-3') && fs.existsSync(path.join(files.userData, 'projects', files.pid('project'), id)), 'its code and data stay').toBe(true);
  expect(files.tasksOf(files.pid('project')).find((e) => e.id === id).closed).toBe(true);
  await expect.poll(() => taskTabs(ui)).toEqual(['task-1', 'Feature-X *']);
  // The bar's + (a new tab) lists it in its project's column, after the open ones; opening it shows it again, its
  // agent resuming the conversation.
  expect(await plusRows(ui, 'project')).toEqual(['task-1', 'Feature-X', 'task-3', 'New Task']);
  // Its grid comes before its profiles have started (their cookies, tabs, automation: a site's answer away), its agent
  // after them, as it finds them ready; the window does not wait for them all. They start once the test has seen the grid.
  await core((k) => {
    const g = k.stash, s = k.shell.sessionCookies, restore = s.restore;
    g.restore = restore; g.started = false;
    const answered = new Promise((r) => { g.answer = r; });
    s.restore = async (p) => { await answered; const n = await restore.call(s, p); g.started = true; return n; };
  });
  try {
    await plusMenu(ui, 'project', 'task-3');
    await expect.poll(() => core((k, key) => k.shell.task?.key === key && k.settled(), task)).toBe(true); // its state sent to the window
    expect(await core((k) => k.stash.started), 'the grid before its profiles started').toBe(false);
    await expect(ui.locator(`[role="region"][data-profile="${SAM}"]`)).toHaveCount(1);
    await notLoading(ui);
    await core((k) => k.stash.answer());
    await expect.poll(() => core((k, key) => k.shell.taskByKey(key).loaded && !!k.shell.pty, task), { timeout: 10000 }).toBe(true);
    expect(await core((k) => k.stash.started), 'its agent after them').toBe(true);
  } finally { await core((k) => { k.stash.answer(); k.shell.sessionCookies.restore = k.stash.restore; }); }
  await core((k) => k.watchPty(k.shell.pty));
  expect(await core((k) => k.shell.resumedSession)).toBe('s-3');
  await expect.poll(() => taskTabs(ui)).toEqual(['task-1', 'Feature-X', 'task-3 *']);
  expect(files.tasksOf(files.pid('project')).find((e) => e.id === id).closed).toBe(undefined);
});

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
  await menuRows(ui);
  await choose(ui, 'Delete Task…');
  const q0 = await asked(core);
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
  await menuRows(ui);
  await choose(ui, 'Rename…');
  await expect(ui.locator('#taskrename')).toHaveAttribute('data-state', 'open');
  await expect(ui.locator('#taskname')).toHaveValue(was);
  await expect(ui.locator('#taskname')).toBeFocused();
  // Typed, and Enter (with its character, as a keyboard sends it: the form is sent on it): the dialog's form is sent.
  await core(async (k) => {
    const wc = k.shell.win.webContents;
    await wc.insertText('Spike');
    for (const type of ['keyDown', 'char', 'keyUp'] as const) wc.sendInputEvent({ type, keyCode: type === 'char' ? '\r' : 'Enter' });
  });
  await expect.poll(() => core((k, key) => k.shell.taskByKey(key).name, spike)).toBe('Spike');
  await expect(ui.locator('#taskrename[data-state="open"]')).toHaveCount(0);
  const { branch, folder } = await core((k, key) => { const t = k.shell.taskByKey(key); return { branch: t.branch, folder: t.folder }; }, spike);
  expect(branch).toBe('spike');
  expect(folder, 'the folder stays').toBe(`${project}@${was}`);
  fs.writeFileSync(path.join(folder, 'idea.txt'), 'x');
  git(folder, 'add', '-A'); git(folder, 'commit', '-qm', 'idea');
  fs.writeFileSync(path.join(folder, 'more.txt'), 'y');
  const remove = async (answer: boolean) => {
    await core((k, a) => { k.answer = a; }, answer);
    await invoke(ui, 'task:delete', spike);
    return asked(core);
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

test("tasks: an agent's tab closes after a question, always (Cancel keeps it); the last terminal closed folds the island to its +, which opens one again; Ctrl+` there opens the task's agent, a new conversation", async ({ core, ui, files, call }) => {
  await begin(core, ui, files, { only: true, columns: true, featureX: call });
  const SAM = files.idOf('Sam.admin');
  const task = await newTask(core, ui), agent = await core((k, key) => k.shell.taskByKey(key).promptTarget().id, task);
  const terminals = () => core((k, key) => k.shell.taskByKey(key).terminals.size, task);
  const folded = () => ui.evaluate(() => !!document.querySelector('[data-testid="terminals"][data-folded]') && document.querySelector<HTMLElement>('[data-testid="terminal-tabs"]').hidden);
  // The island's group (its content is laid over it: dockview's renderer 'always').
  const island = () => ui.evaluate(() => { const r = document.querySelector('[data-testid="terminal-tabs"]').closest('.dv-groupview').getBoundingClientRect(); return { width: Math.round(r.width), height: Math.round(r.height) }; });
  const saved = () => files.json(files.pfile('terminals.json', task.split('/')[1]));
  const conversations = () => files.json(files.pfile('agent.json', task.split('/')[1])).conversations;
  const closeTab = () => ui.locator('nav[aria-label="Terminals"] [role="tab"]').first().getByTitle(/^Close/).click();
  await expect(ui.locator('nav[aria-label="Terminals"] [role="tab"]')).not.toHaveCount(0);
  const before = await island();
  // × on an agent's tab asks, whatever it is doing; Cancel keeps it.
  await core((k) => { k.answer = false; });
  await closeTab();
  const q = await asked(core);
  expect(q.message).toBe('Close bash?');
  expect(q.detail).toMatch(/^bash stops\. Its conversation stays in the task's history, where any agent of the task can read it\.$/);
  expect(await core((k, a) => k.shell.taskByKey(a.task).terminals.has(a.agent), { task, agent }), 'kept when the human says no').toBe(true);
  await core((k) => { k.answer = true; });
  await closeTab();
  await expect.poll(terminals).toBe(0);
  await core((k) => { k.asked.length = 0; });
  // No profile open: the +'s rows as big buttons in its middle, whatever the arrangement.
  await expect.poll(folded).toBe(true);
  expect(saved()).toEqual({ front: null, list: [] });
  expect(conversations()[0].terminal).toBe(undefined);
  expect(conversations()[0].to, 'its conversation closed, kept for the history').toBeTruthy();
  // Its + from the middle of the island (x), and from where a strip's middle would be.
  const middle = () => ui.evaluate(() => {
    const b = document.getElementById('termUnfold').getBoundingClientRect(), r = document.querySelector('[data-testid="terminals"]').getBoundingClientRect();
    return Math.abs(Math.round(b.x + b.width / 2 - (r.x + r.width / 2))) <= 1 && Math.abs(Math.round(b.y + b.height / 2 - (r.y + r.height / 2))) <= 1;
  });
  const PROFILES = ['Sam.admin', 'Elon.buyer', 'Dora']; // the project's, all closed
  // The island and the Resources island beside or under it fill the grid: dockview's room, the closed profiles' tiles no
  // longer over it.
  const fills = () => ui.evaluate(() => {
    const g = document.getElementById('grid').getBoundingClientRect(), b = (e: Element) => e.closest('.dv-groupview').getBoundingClientRect();
    const t = b(document.querySelector('[data-testid="terminal-tabs"]')), r = b(document.getElementById('resources')), near = (a: number, c: number) => Math.abs(a - c) <= 1;
    return near(Math.min(t.left, r.left), g.left) && near(Math.max(t.right, r.right), g.right) && near(Math.min(t.top, r.top), g.top)
      && near(Math.max(t.bottom, r.bottom), g.bottom) && (r.left > t.right || r.top > t.bottom);
  });
  const launch = () => ui.evaluate(() => {
    const l = document.querySelector('[data-testid="launchers"]'), r = document.querySelector('[data-testid="terminals"]').getBoundingClientRect();
    if (!l) return null;
    const b = l.getBoundingClientRect(), ys = [...l.querySelectorAll('nav[aria-label="New terminal"] button')].map((x) => Math.round(x.getBoundingClientRect().y));
    return { labels: [...l.querySelectorAll('nav[aria-label="New terminal"] button')].map((x) => document.getElementById(x.getAttribute('aria-labelledby')).textContent), oneLine: new Set(ys).size === 1,
      profiles: [...l.querySelectorAll('nav[aria-label="Open a profile"] button')].map((x) => x.textContent),
      middle: Math.abs(b.y + b.height / 2 - (r.y + r.height / 2)) <= 1, strip: !!document.getElementById('termUnfold'),
      empty: getComputedStyle(document.querySelector('[data-testid="terminal-tabs"]').closest('.dv-groupview').querySelector('.dv-content-container')).backgroundColor };
  });
  for (const preset of ['grid', 'focus', 'columns']) {
    await ui.evaluate((p) => (window as any).__layoutPreset(p), preset);
    await expect.poll(async () => (await fills()) && (await launch())?.middle, { timeout: 3000 }).toBe(true);
    expect(await launch()).toEqual({ labels: ['Terminal'], oneLine: true, profiles: PROFILES, middle: true, strip: false, empty: 'rgba(0, 0, 0, 0)' });
  }
  // One opens what its row in + does: a terminal; closed, the buttons are back.
  await ui.locator('[data-testid="launchers"] button').first().click();
  await expect.poll(async () => (await terminals()) === 1 && !(await folded())).toBe(true);
  // A terminal and no profile: the profiles' room a row of buttons over it, one for each; one opens its profile, and
  // the row goes.
  const tiles = () => ui.evaluate(() => {
    const s = document.getElementById('closedprofiles');
    return s && { names: [...s.querySelectorAll('button')].map((x) => document.getElementById(x.getAttribute('aria-labelledby')).textContent),
      above: s.getBoundingClientRect().bottom <= document.querySelector('[data-testid="terminals"]').getBoundingClientRect().top };
  });
  await expect.poll(tiles).toEqual({ names: PROFILES, above: true });
  // A button: the profile's picture, its name and the +; a long name cut with … in one row, the button no wider than
  // before and the + still inside it; who it is only in the tooltip.
  expect(await ui.evaluate(() => {
    const t = document.querySelector('#closedprofiles button'), n = document.getElementById(t.getAttribute('aria-labelledby')), was = n.textContent;
    const w = t.getBoundingClientRect().width;
    n.textContent = 'orudzhali.very.long.name@insvgna.org';
    const s = getComputedStyle(n), r = t.getBoundingClientRect(), plus = t.querySelector('svg').getBoundingClientRect(),
      res = [!!t.querySelector('img'), s.whiteSpace, s.textOverflow, n.scrollWidth > n.clientWidth, r.width > w, plus.right <= r.right];
    n.textContent = was;
    return res;
  })).toEqual([true, 'nowrap', 'ellipsis', true, true, true]);
  await expect(ui.locator(`#closedprofiles [data-profile="${SAM}"]`)).toHaveAttribute('title', /^Open Sam\.admin: ./);
  // More than fit (19 profiles): the row scrolls, its end faded, the window as wide as before, not its column, the
  // terminal and the tasks' bar stretched past its edge, the last profiles out of reach.
  await ui.evaluate(() => { const s = document.getElementById('closedprofiles'); for (let i = 0; i < 20; i++) s.append(s.querySelector('button').cloneNode(true)); });
  await expect(ui.locator('#closedprofiles')).toHaveAttribute('data-past-end');
  expect(await ui.evaluate(() => {
    const s = document.getElementById('closedprofiles'), r = (e: Element) => e.getBoundingClientRect();
    return [s.scrollWidth > s.clientWidth, r(s).right <= innerWidth, r(document.querySelector('[data-testid="terminals"]')).right <= innerWidth, document.documentElement.scrollWidth <= innerWidth];
  })).toEqual([true, true, true, true]);
  await ui.evaluate((n) => document.querySelectorAll('#closedprofiles button').forEach((t, i) => { if (i >= n) t.remove(); }), PROFILES.length);
  await ui.locator(`#closedprofiles [data-profile="${SAM}"]`).click();
  await expect.poll(async () => (await core((k, a) => k.shell.taskByKey(a.task).profiles.has(a.SAM), { task, SAM })) && !(await tiles())).toBe(true);
  await call('profile_close', { profile: 'Sam.admin' }, { task });
  await expect.poll(async () => !!(await tiles())).toBe(true);
  await closeTab();
  await expect.poll(async () => (await terminals()) === 0 && !!(await launch()) && !(await tiles())).toBe(true);
  // With a profile open (its tile among the big buttons): folded to a strip of its +, along the grid's height (the
  // island is under the grid); kept so.
  await ui.locator(`[data-testid="launchers"] [data-profile="${SAM}"]`).click();
  await expect.poll(async () => (await island()).height <= 40 && (await middle())).toBe(true);
  expect(Math.abs((await island()).width - before.width), 'as wide as before (Resources beside it takes its share as the grid changes)').toBeLessThanOrEqual(5);
  // Its + opens a terminal: the island unfolds.
  await ui.locator('#termUnfold').click();
  expect(await menuRows(ui)).toEqual(['Terminal']);
  await choose(ui, 'Terminal');
  await expect.poll(async () => (await terminals()) === 1 && !(await folded()) && (await island()).height >= 150).toBe(true);
  // A shell closes without a question; folded again.
  await closeTab();
  await expect.poll(async () => (await terminals()) === 0 && (await folded()) && (await island()).height <= 40).toBe(true);
  expect(await core((k) => k.asked.length)).toBe(0);
  // The preset "grid": right of the profiles, Resources under it in its column: folded along its height, a strip of its
  // + over Resources.
  await ui.evaluate(() => (window as any).__layoutPreset('grid'));
  const resources = () => ui.evaluate(() => document.getElementById('resources').closest('.dv-groupview').getBoundingClientRect().height);
  await expect.poll(async () => (await island()).height <= 40 && (await middle()) && (await resources()) > 300).toBe(true);
  await ui.locator('#termUnfold').click();
  await choose(ui, 'Terminal');
  await expect.poll(async () => (await terminals()) === 1 && !(await folded()) && (await island()).height >= 150).toBe(true);
  // As tall as the grid (Resources moved under the pages): folded along the grid's width instead, a strip of its + as
  // tall as the grid; its + unfolds it to a width of its own, and the last terminal closed folds it again.
  await ui.evaluate((id) => { const d = (window as any).__dock; d.getPanel('resources').api.moveTo({ group: d.getPanel(`profile:${id}`).group, position: 'bottom' }); }, SAM);
  await closeTab();
  await expect.poll(async () => { const r = await island(); return (await terminals()) === 0 && r.width <= 40 && r.height > 100 && (await middle()); }).toBe(true);
  await ui.locator('#termUnfold').click();
  await choose(ui, 'Terminal');
  await expect.poll(async () => (await terminals()) === 1 && !(await folded()) && (await island()).width >= 200).toBe(true);
  await closeTab();
  await expect.poll(async () => (await terminals()) === 0 && (await folded()) && (await island()).width <= 40).toBe(true);
  await ui.evaluate(() => (window as any).__layoutPreset('columns'));
  await expect.poll(async () => (await island()).height <= 40 && (await middle())).toBe(true);
  // Ctrl+` there: the task's agent, a new conversation.
  await focusWindow(core, ui);
  await core((k) => k.press(k.shell.win.webContents, '`', 'control'));
  await expect.poll(() => core((k, key) => !!k.shell.taskByKey(key).promptTarget()?.pty, task), { timeout: 20000 }).toBe(true);
  expect(conversations()).toHaveLength(2);
  expect([conversations()[1].agent, conversations()[1].terminal]).toEqual(['custom', await core((k, key) => k.shell.taskByKey(key).promptTarget().id, task)]);
  // Its × closes it without a question: nothing works in it.
  await taskTab(ui, task).getByRole('button', { name: 'Close' }).click();
  await expect.poll(async () => (await core((k, key) => { const t = k.shell.taskByKey(key); return !!t.entry.closed && !t.loaded; }, task)) && isNth(core, 2)).toBe(true);
  expect(await core((k) => k.asked.length)).toBe(0);
});

test('tasks: × on the last open task of a project lets the project go, nothing asked: the empty window; a task of it opens it again', async ({ core, ui, files, call }) => {
  await begin(core, ui, files, { only: true, columns: true, featureX: call });
  // A third task, closed (the board lists it with the others).
  const third = await newTask(core, ui);
  await invoke(ui, 'task:close', third);
  await expect.poll(() => core((k, key) => !!k.shell.taskByKey(key).entry.closed, third)).toBe(true);
  const pid = files.pid('project'), first = await keyAt(core, 1), second = await keyAt(core, 2);
  await expect.poll(() => taskTabs(ui)).toEqual(['task-1', 'Feature-X *']);
  await taskTab(ui, first).getByRole('button', { name: 'Close' }).click();
  await expect.poll(() => core((k, a) => { const f = k.shell.taskByKey(a.first); return !!f.entry.closed && !f.loaded && k.shell.task?.key === a.second; }, { first, second })).toBe(true);
  await expect.poll(() => taskTabs(ui)).toEqual(['Feature-X *']);
  expect(await core((k) => k.asked.length)).toBe(0);
  await core((k, key) => { k.stash.second = k.shell.taskByKey(key); }, second);
  await taskTab(ui, second).getByRole('button', { name: 'Close' }).click();
  // The project goes once its task is unloaded: its agent stopped, each profile's sign-ins written out and its
  // tabs closed. On a loaded machine, with another project running beside it, that takes over 5 s now and then.
  await expect.poll(() => core((k, p) => k.shell.task === null && !k.shell.current && !k.shell.open.has(p), pid), { timeout: 15000 }).toBe(true);
  expect(await core((k) => k.asked.length), 'no agent works: nothing asked').toBe(0);
  expect(await core((k) => { const s = k.stash.second; return s.profiles.size === 0 && !s.pty; }), 'every task of the project stopped').toBe(true);
  expect(files.tasksOf(files.pid('project')).map((e) => [e.name, !!e.closed])).toEqual([['task-1', true], ['Feature-X', true], ['task-3', true]]);
  await expect(ui.locator('html')).toHaveAttribute('data-noproject');
  // The empty window, projects there: every project with its tasks, a column each, as a new tab shows them; no tasks' bar.
  await expect(ui.locator('html')).toHaveAttribute('data-page', 'board');
  await expect(ui.locator('#empty')).toHaveCSS('display', 'grid');
  await expect(ui.locator('#newtabtab'), 'no new tab: the window is it').toHaveCount(0);
  await expect(ui.locator('#taskbar'), "no tasks' bar: no tab, and + would show the board it shows").toHaveCount(0);
  expect(await ui.evaluate(() => document.documentElement.style.getPropertyValue('--project')), "no project's color").toBe('');
  // Its glow goes softly (App.vue): faded out, not cut.
  await expect(ui.locator('#glow')).toHaveCSS('opacity', '0');
  expect(await core((k) => k.shell.win.getTitle())).toBe('Kulisa');
  expect(files.savedWindows(), 'the window opens so next time').toEqual([{ tabs: [], shown: null }]);
  // Each column: its project's icon in its color, as on its tasks' tabs, its name, + (a new task of it); its tasks,
  // the one closed last first (all are closed here), each when it was closed; New Project… after the columns. The
  // project worked in last first.
  const byClosing = files.tasksOf(files.pid('project')).filter((e) => e.closed).sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0)).map((e) => e.name);
  await expect(ui.locator('#board section').first(), 'worked in last').toHaveAccessibleName('project');
  expect(await ui.locator(`#board section[data-project="${pid}"] [data-task]`).evaluateAll((xs) => xs.map((x) => document.getElementById(x.getAttribute('aria-labelledby')).textContent))).toEqual(byClosing);
  expect(byClosing[0]).toBe('Feature-X');
  const icons = await ui.evaluate(() => [...document.querySelectorAll('#board section [data-testid="project-icon"]')].map((i) => [i.closest<HTMLElement>('section').dataset.project, i.querySelector('use')?.getAttribute('href') ?? null]));
  expect(icons, 'its favicon, else the curtain').toEqual(await core((k, ids) => ids.map((id) => [id, k.shell.projects().find((p) => p.id === id).favicon ? null : '#i-logo']), icons.map(([id]) => id)));
  await expect(ui.locator(`#board section[data-project="${pid}"] [data-task] small`).first()).toHaveText(/ago|just now/);
  // A closed task's 🗑 asks as Delete Task… does (Cancel keeps it).
  await core((k) => { k.answer = false; });
  await ui.locator(`#board [data-task="${third}"] [aria-label="Delete Task…"]`).evaluate((b: HTMLElement) => b.click());
  expect((await asked(core)).message).toBe('Delete the task task-3?');
  await expect(ui.locator('#ask[data-state="open"]')).toHaveCount(0);
  await core((k) => { k.answer = true; });
  expect(files.tasksOf(files.pid('project')).some((e) => e.name === 'task-3'), 'Cancel keeps it').toBe(true);
  // A closed task in the board opens it again, as that task's tab.
  await ui.locator(`#board [data-task="${second}"]`).click();
  await expect.poll(() => core((k, key) => k.shell.task?.key === key && k.shell.task.loaded && !!k.shell.pty, second)).toBe(true);
  await core((k) => k.watchPty(k.shell.pty));
  await expect(ui.locator('html')).not.toHaveAttribute('data-noproject');
  await notLoading(ui);
  await expect.poll(() => taskTabs(ui)).toEqual(['Feature-X *']);
  // Now a task is shown: the bar's + lists the project's tasks (the open one to switch to, the closed ones to reopen), then New Task.
  expect(await plusRows(ui, 'project')).toEqual(['Feature-X', 'task-1', 'task-3', 'New Task']);
  await plusMenu(ui, 'project', 'task-1');
  await expect.poll(() => core((k, key) => k.shell.task?.key === key && k.shell.task.loaded && !!k.shell.pty, first)).toBe(true);
  await core((k) => k.watchPty(k.shell.pty));
  await expect.poll(() => taskTabs(ui)).toEqual(['Feature-X', 'task-1 *']); // a tab opens at the end
  expect(await core((k, key) => k.shell.taskByKey(key).loaded, second), 'the other open one stays loaded').toBe(true);
  await bothOn(core, ui, files);
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
  expect(await projectMenu(ui)).toContain('Delete Merged Tasks…');
  await core((k) => { k.asked.length = 0; });
  await projectMenu(ui, 'Delete Merged Tasks…');
  expect((await asked(core)).message).toBe('Delete the task task-1?');
  await expect.poll(async () => !(await core((k, key) => k.shell.current.tasks.has(key.split('/')[1]), first)) && !fs.existsSync(folders[0].folder)).toBe(true);
  expect(await core((k, key) => k.shell.current.tasks.has(key.split('/')[1]) && !k.shell.taskByKey(key).entry.merged, second), 'one not merged stays').toBe(true);
  await invoke(ui, 'project:close-tasks', { id });
  await expect.poll(() => core((k, p) => !k.shell.open.has(p), id)).toBe(true);
  await core((k) => { k.asked.length = 0; });
  await dropProject(core, ui, id, [dir, origin]);
});

test("tasks: a closed task is deleted from its row, 🗑 or Delete, in the board (the bar's +), its project loaded or not, after the question Delete Task… asks", async ({ core, ui, files, call }) => {
  // About 2 s: git's work (worktrees made and removed).
  await begin(core, ui, files, { only: true, columns: true, featureX: call });
  // A project not loaded, its one task closed, with a commit not merged.
  const { id, dir, origin, first, second } = await remoteProject(core, ui, files, call, 'gone');
  await invoke(ui, 'task:delete', first);
  await expect.poll(() => core((k, key) => !k.shell.current.tasks.has(key.split('/')[1]), first)).toBe(true);
  await core((k) => { k.asked.length = 0; }); // its question, answered yes
  const made = await core((k, key) => k.shell.taskByKey(key).folder, second);
  fs.writeFileSync(path.join(made, 'c.txt'), 'c'); git(made, 'add', '-A'); git(made, 'commit', '-qm', 'c');
  await invoke(ui, 'project:close-tasks', { id });
  await expect.poll(() => core((k, p) => !k.shell.open.has(p), id)).toBe(true);
  const entry = (name: string) => core((k, a) => k.shell.store.tasksOf(k.shell.store.projects().find((x) => x.id === a.id)).list.find((e) => e.name === a.name) ?? null, { id, name });
  // A task's row in its project's column of the board (a new tab, the bar's +; the empty window).
  const row = (name: string) => ui.locator(`#board section[data-project="${id}"]`).getByRole('button', { name, exact: true }).and(ui.locator('[data-task]'));
  const folder = (await entry('task-2')).resources[0].folder;
  // The board is the empty window's (not a menu over a task): close the open tasks to get there.
  for (const open of await core((k) => [...k.shell.open.keys()])) await invoke(ui, 'project:close-tasks', { id: open });
  await expect.poll(() => core((k) => k.shell.open.size)).toBe(0);
  await expect(ui.locator('html')).toHaveAttribute('data-noproject');
  await expect(ui.locator('#board')).toHaveCount(1);
  await expect(row('task-2').locator('[aria-label="Delete Task…"]'), 'shown on the row the pointer or the keyboard is on').toHaveCSS('visibility', 'hidden');
  await core((k) => { k.answer = false; });
  await row('task-2').dispatchEvent('keydown', { key: 'Delete', bubbles: true });
  const q = await asked(core);
  expect(q.message).toBe('Delete the task task-2?');
  expect(q.detail, 'its work not in main, as Delete Task… says').toMatch(/1 commit of its own/);
  await expect(ui.locator('#ask[data-state="open"]')).toHaveCount(0);
  expect(!!(await entry('task-2')) && fs.existsSync(folder), 'Cancel keeps it').toBe(true);
  await core((k) => { k.answer = true; });
  await row('task-2').hover();
  await row('task-2').locator('[aria-label="Delete Task…"]').click();
  await expect.poll(async () => !(await entry('task-2')) && !fs.existsSync(folder)).toBe(true);
  expect(await core((k, p) => k.shell.open.has(p), id), 'not opened for it').toBe(false);
  expect(await ui.locator(`#board section[data-project="${id}"] [data-task]`).allTextContents(), 'it has no closed task left in the board').toEqual([]);

  // Back to project's task-1 and Feature-X.
  await ui.locator(`#board [data-task="${files.tkey('project', 1)}"]`).click();
  await nthShown(core, 1);
  await expect.poll(() => core((k) => k.shell.task.loaded && !!k.shell.pty)).toBe(true);
  await notLoading(ui);
  await plusMenu(ui, 'project', 'Feature-X');
  await nthShown(core, 2);
  await expect.poll(() => core((k) => k.shell.task.loaded && !!k.shell.pty)).toBe(true);
  await taskTab(ui, files.tkey('project', 1)).click();
  await nthShown(core, 1);
  await core((k) => { k.watchPty(k.shell.pty); k.asked.length = 0; });
  await dropProject(core, ui, id, [dir, origin]);
});

test('the CDP proxy takes ids in any letters (percent-encoded in its URLs); the grid changed just before its task is left is saved so', async ({ core, ui, files, call }) => {
  await begin(core, ui, files, { only: true, columns: true, featureX: call });
  const id = await core(async (k) => (await k.shell.task.createProfile('Анна') as { id: string }).id);
  await expect.poll(() => core((k, p) => !!k.shell.profiles.get(p).browser, id)).toBe(true);
  expect(await core((k, p) => k.shell.profiles.get(p).endpoint.endsWith(`/${k.shell.task.key}/${encodeURIComponent(p)}`), id)).toBe(true);
  expect(await core(async (k, p) => { const pr = k.shell.profiles.get(p); await pr.newTab('about:blank').ready; return (await pr.page()).url(); }, id), 'Playwright reached its tab').toBe('about:blank');
  await core((k, p) => k.shell.task.deleteProfile(p), id);
  // The grid changed, and the task left at once: the change is in its saved grid (its save waits 300 ms, and leaving
  // must not drop it: a pane of a profile deleted just before would stay there, and a saved grid naming a profile no
  // longer there is not restored at all). The grid's shape, its sizes aside.
  const task = await core((k) => k.shell.task.key), other = await keyAt(core, 2);
  const shape = (root: unknown) => JSON.stringify(root, (key, v) => (key === 'size' ? undefined : v));
  const saved = async () => shape(await core((k, key) => (k.shell.taskByKey(key).store.layout() as { grid: { root: unknown } }).grid.root, task));
  // Left two frames after the change (dockview tells of it on a frame), well within the 300 ms.
  const columns = await ui.evaluate((o) => { (window as any).__layoutPreset('columns'); return new Promise<string>((r) => requestAnimationFrame(() => requestAnimationFrame(() => {
    r(JSON.stringify((window as any).__dock.toJSON().grid.root)); void (window as any).kulisa.invoke('task:show', o);
  }))); }, other);
  await expect.poll(() => core((k, key) => k.shell.task?.key === key && k.shell.task.loaded, other)).toBe(true);
  await expect.poll(saved).toBe(shape(JSON.parse(columns))); // saved as it was left: it comes as the grid is taken down
  // Back: built again as it was left.
  await invoke(ui, 'task:show', task);
  await expect.poll(async () => (await core((k, key) => k.shell.task?.key === key, task)) && !(await ui.evaluate(() => document.documentElement.hasAttribute('aria-busy')))
    && shape(JSON.parse(await ui.evaluate(() => JSON.stringify((window as any).__dock.toJSON().grid.root)))) === shape(JSON.parse(columns))).toBe(true);
  await ui.evaluate(() => (window as any).__layoutPreset('grid'));
  await expect.poll(saved).not.toBe(shape(JSON.parse(columns)));
  await noSlide(ui);
});
