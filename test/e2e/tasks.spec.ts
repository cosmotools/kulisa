// Tasks: each with its own copy of the code (a git worktree on a branch of its own; without git, the project's folder),
// copies of the profiles, its own agent; closing and opening them again (docs/tasks.md).
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures.ts';
import type { Core } from './fixtures.ts';
import type { Files } from './data.ts';
import { SITE, menu, choose, openSidebar, closeSidebar, fromSidebar, sidebar, taskRow, rowButton, sidebarTasks, focusWindow, viewOn, who, invoke, notLoading, answer, removed, arrange } from './helpers.ts';
import { git, rand, hasDirenv, keyAt, isNth, taskTab, taskTabs, hook, reportSession, newTask, projectShown, begin, bothOn, deleteProfile } from './tasks-helpers.ts';

// No question of Kulisa's asked in the window.
const noQuestion = (ui: Page, message?: string) => expect(ui.getByRole('alertdialog'), message).toHaveCount(0);

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

// The project deleted (its data; never its folder) and its folders after it, once its tasks' shells have left them:
// Windows does not remove a process's folder.
async function dropProject(core: Core, ui: Page, id: string, folders: string[]) {
  const deleted = invoke(ui, 'project:delete', { id });
  await answer(ui);
  await deleted;
  await expect.poll(() => core((k, p) => !k.shell.open.has(p) && !k.shell.store.projects().some((x) => x.id === p), id)).toBe(true);
  await removed(...folders);
}

test("tasks: without git a task works in the project's folder, and a second one there is asked about first", async ({ core, ui, files }) => {
  // A project of its own, its folder without git (the tests' project is made a git repository by the others).
  const dir = path.join(files.root, `nogit-${rand()}`);
  fs.mkdirSync(dir);
  const made = await invoke(ui, 'project:new', { from: 'folder', folders: [dir], name: 'nogit' });
  expect(made.id, JSON.stringify(made)).toBeTruthy();
  await invoke(ui, 'task:new', { project: made.id });
  await projectShown(core, made.id);
  const key = await core(async (k) => { await k.shell.task.rename('task-1'); return k.shell.task.key; }); // named for the test to refer to it by
  await expect.poll(() => taskTabs(ui)).toEqual(['task-1 *']);
  expect(await core((k) => [k.shell.task.folder, (k.shell.task.entry as { worktree?: string }).worktree ?? null])).toEqual([dir, null]);
  await expect(taskTab(ui, key)).toHaveAttribute('title', /in the project's folder .*no git/);
  await fromSidebar(ui, 'nogit');
  const q = await answer(ui, false);
  expect(q.message).toBe('Another task of nogit works in its folder');
  expect(q.detail).toMatch(/may get in each other's way/);
  expect(await core((k) => k.shell.current.tasks.size), 'none made when the human says no').toBe(1);
  await dropProject(core, ui, made.id, [dir]);
});

test('tasks: + opens a task in the project\'s main working tree ("New Task", no worktree, no port offset); its profiles closed until opened (each a copy of its master); the agent makes its worktree and names it with task_worktree', async ({ core, ui, files, call, mcp }) => {
  test.slow(); // the terminals' panel held back 6 s by design, then git's work
  await begin(core, ui, files, { only: true, columns: true });
  await master(core, files, false);
  const project = files.project, SAM = files.idOf('Sam.admin'), ELON = files.idOf('Elon.buyer'), DORA = files.idOf('Dora');
  const first = await core((k) => k.shell.task.key);
  await call('browser_navigate', { profile: 'Sam.admin', url: `${SITE}/app?task` });
  // The terminals' buttons are for a task with nothing open: a task opening shows its agent's tab at once, starting,
  // not them for the second its agent is looked for. Each noted as it comes: an assertion sees only the state when it
  // looks.
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
  // Its agent waits for its terminal's size however late the window lays the terminals' panel out: not at a default one after
  // 5 s, which a loaded machine reaches. The terminals' panel hidden while the main process's clock goes 6 s on after the agent
  // is found (driver.ts, clock: its timers of a second or more).
  const latePanel = await ui.addStyleTag({ content: '[data-testid="terminal"] { display: none !important; }' });
  await core((k) => k.clock.hold(1000));
  const late = (async () => {
    await expect.poll(() => ui.evaluate(() => (window as any).__starting)).toBeTruthy();
    await core((k) => k.stash.look());
    await expect.poll(() => core((k) => k.stash.found), { timeout: 10000 }).toBe(true);
    await core((k) => k.clock.advance(6000));
    await latePanel.evaluate((e) => (e as Element).remove());
  })();
  const task = await newTask(core, ui, null); // left "New Task": this test names it with task_worktree below
  await late;
  await core((k) => { k.clock.release(); Object.assign(k.shell, { findAgent: k.stash.find }); });
  // The terminal's size as xterm has it (its canvas has no text to read).
  const shown = () => ui.evaluate(() => { const t = (window as any).__term; return t && { cols: t.cols, rows: t.rows }; });
  await expect.poll(async () => JSON.stringify(await core((k, key) => k.shell.taskByKey(key).pty?.spawnSize, task)) === JSON.stringify(await shown()), 'at its real size').toBe(true);
  expect(await ui.evaluate(() => (window as any).__launch), "no terminals' panel's buttons while its agent starts").toBe(false);
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
  // The Resources panel: the main working tree until it has its own worktree, then the worktree on its branch.
  const resources = ui.locator('#resources').getByRole('list', { name: 'Folders' }).getByRole('listitem');
  await expect(resources).toHaveText([`${path.basename(project)}main working tree`]);
  // Two of its agents at once (each a call) get the one worktree, not one each.
  const wt = `${project}@feature-x`, trees = () => git(project, 'worktree', 'list').split('\n').length, before = trees();
  // The second sent once the first is at work (named: making the worktree): the first to arrive makes the folder, named
  // after the task as it is then, and the two calls' order over HTTP is the OS's.
  const naming = call('task_worktree', { name: 'Feature-X' }, { task });
  await expect.poll(() => core((k, key) => !!k.shell.taskByKey(key).entry.named, task)).toBe(true);
  const both = await Promise.all([naming, call('task_worktree', {}, { task })]);
  for (const r of both) expect(r.text).toMatch(new RegExp(`works in its own worktree .*${RegExp.escape(path.basename(project))}@feature-x, on branch feature-x`));
  expect(trees(), 'one worktree').toBe(before + 1);
  await expect(resources).toHaveText([`${path.basename(project)}branch feature-x`]);
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
    return k.agentHooks.sessionStart(k.taskAccess(t), k.terminalAccess(t, t.promptTarget()), { session_id: 's-3', transcript_path: a.transcript }).hookSpecificOutput.additionalContext;
  }, { task, transcript }), 'where it works, at the session start too').toMatch(/task "task-3": a git worktree of its own, .*project@task-3, on branch task-3.*free port you pick/s);
  // Working: the human is asked, and may keep it.
  const state = () => core((k, key) => k.shell.taskByKey(key).promptTarget()?.state, task);
  await hook(core, task, 'prompt');
  await expect.poll(state).toBe('working');
  await taskTab(ui, task).getByRole('button', { name: 'Close' }).click();
  expect((await answer(ui, false)).message).toBe('Close the task task-3?');
  expect(await core((k, key) => { const t = k.shell.taskByKey(key); return t.loaded && k.shell.task === t; }, task), 'kept open when the human says no').toBe(true);
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
  await noQuestion(ui, 'not asked: nothing is lost');
  const { folder, id } = await core((k, key) => { const t = k.shell.taskByKey(key); return { folder: t.folder, id: t.id }; }, task);
  expect(fs.existsSync(folder) && !!git(files.project, 'branch', '--list', 'task-3') && fs.existsSync(path.join(files.userData, 'projects', files.pid('project'), id)), 'its code and data stay').toBe(true);
  expect(files.tasksOf(files.pid('project')).find((e) => e.id === id).closed).toBe(true);
  await expect.poll(() => taskTabs(ui)).toEqual(['task-1', 'Feature-X *']);
  // The sidebar lists it under its project, after the open ones; opening it shows it again, its agent resuming the
  // conversation.
  await openSidebar(ui);
  expect(await sidebarTasks(ui, 'project')).toEqual(['task-1', 'Feature-X', 'task-3']);
  await closeSidebar(ui);
  // Its grid comes before its profiles have started (their cookies, tabs, automation: a site's answer away), its agent
  // after them, as it finds them ready; the window does not wait for them all. They start once the test has seen the grid.
  await core((k) => {
    const g = k.stash, s = k.shell.sessionCookies, restore = s.restore;
    g.restore = restore; g.started = false;
    const answered = new Promise((r) => { g.answer = r; });
    s.restore = async (p) => { await answered; const n = await restore.call(s, p); g.started = true; return n; };
  });
  try {
    await fromSidebar(ui, 'project', 'task-3');
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

test("tasks: an agent's tab closes after a question, always (Cancel keeps it); the last terminal closed folds the terminals' panel to its +, which opens one again; Ctrl+` there opens the task's agent, a new conversation", async ({ core, ui, files, call }) => {
  await begin(core, ui, files, { only: true, columns: true, featureX: call });
  const SAM = files.idOf('Sam.admin');
  const task = await newTask(core, ui), agent = await core((k, key) => k.shell.taskByKey(key).promptTarget().id, task);
  const terminals = () => core((k, key) => k.shell.taskByKey(key).terminals.size, task);
  const panel = ui.getByTestId('terminals'), strip = ui.getByTestId('terminal-tabs');
  const folded = async (yes: boolean) => {
    await (yes ? expect(panel).toHaveAttribute('data-folded') : expect(panel).not.toHaveAttribute('data-folded'));
    await (yes ? expect(strip).toBeHidden() : expect(strip).toBeVisible());
  };
  // The terminals' panel's group (its content is laid over it: dockview's renderer 'always').
  const group = ui.locator('.dv-groupview', { has: strip });
  const size = async (l: Locator) => { const b = await l.boundingBox(); return { width: Math.round(b.width), height: Math.round(b.height) }; };
  const saved = () => files.json(files.pfile('terminals.json', task.split('/')[1]));
  const conversations = () => files.json(files.pfile('agent.json', task.split('/')[1])).conversations;
  const closeTab = () => ui.locator('nav[aria-label="Terminals"] [role="tab"]').first().getByTitle(/^Close/).click();
  await expect(ui.locator('nav[aria-label="Terminals"] [role="tab"]')).not.toHaveCount(0);
  const before = await size(group);
  // × on an agent's tab asks, whatever it is doing; Cancel keeps it.
  await closeTab();
  const q = await answer(ui, false);
  expect(q.message).toBe('Close bash?');
  expect(q.detail).toMatch(/^bash stops\. Its conversation stays in the task's history, where any agent of the task can read it\.$/);
  expect(await core((k, a) => k.shell.taskByKey(a.task).terminals.has(a.agent), { task, agent }), 'kept when the human says no').toBe(true);
  await closeTab();
  await answer(ui);
  await expect.poll(terminals).toBe(0);
  // No profile open: the +'s rows as big buttons in its middle, whatever the arrangement.
  await folded(true);
  expect(saved()).toEqual({ front: null, list: [] });
  expect(conversations()[0].terminal).toBe(undefined);
  expect(conversations()[0].to, 'its conversation closed, kept for the history').toBeTruthy();
  // One box's middle on another's, to a pixel.
  const centred = async (inner: Locator, outer: Locator) => {
    const b = await inner.boundingBox(), r = await outer.boundingBox();
    return Math.abs(Math.round(b.x + b.width / 2 - (r.x + r.width / 2))) <= 1 && Math.abs(Math.round(b.y + b.height / 2 - (r.y + r.height / 2))) <= 1;
  };
  // Its + from the middle of the terminals' panel (x), and from where a strip's middle would be.
  const unfold = panel.getByRole('button', { name: 'New terminal' }), middle = () => centred(unfold, panel);
  // The project's profiles, all closed: Sam.admin, Elon.buyer, Dora.
  // The terminals' panel and the Resources panel beside or under it fill the grid: dockview's room, the closed profiles' tiles no
  // longer over it.
  const resources = ui.locator('.dv-groupview', { has: ui.locator('#resources') });
  const fills = async () => {
    const g = await ui.locator('#grid').boundingBox(), t = await group.boundingBox(), r = await resources.boundingBox(), near = (x: number, y: number) => Math.abs(x - y) <= 1;
    return near(Math.min(t.x, r.x), g.x) && near(Math.max(t.x + t.width, r.x + r.width), g.x + g.width) && near(Math.min(t.y, r.y), g.y)
      && near(Math.max(t.y + t.height, r.y + r.height), g.y + g.height) && (r.x >= t.x + t.width || r.y >= t.y + t.height);
  };
  const launchers = ui.getByTestId('launchers'), newTerminal = launchers.getByRole('navigation', { name: 'New terminal' }).getByRole('button');
  for (const preset of ['grid', 'focus', 'columns'] as const) {
    await arrange(ui, preset);
    await expect.poll(async () => (await launchers.count()) > 0 && (await fills()) && centred(launchers, panel), { timeout: 3000 }).toBe(true);
    await expect(launchers).toMatchAriaSnapshot(`
      - navigation "New terminal":
        - button "Terminal"
      - navigation "Open a profile":
        - button "Sam.admin"
        - button "Elon.buyer"
        - button "Dora"
    `);
    const ys = new Set(await Promise.all((await newTerminal.all()).map(async (x) => Math.round((await x.boundingBox()).y))));
    expect(ys.size, 'in one line').toBe(1);
    await expect(unfold).toHaveCount(0);
  }
  // One opens what its row in + does: a terminal; closed, the buttons are back.
  await newTerminal.first().click();
  await expect.poll(terminals).toBe(1);
  await folded(false);
  // A terminal and no profile: the profiles' room a row of buttons over it, one for each; one opens its profile, and
  // the row goes.
  const tiles = ui.getByTestId('closed-profiles');
  await expect(tiles).toMatchAriaSnapshot(`
    - button "Sam.admin"
    - button "Elon.buyer"
    - button "Dora"
  `);
  expect((await tiles.boundingBox()).y + (await tiles.boundingBox()).height, 'above the terminals').toBeLessThanOrEqual((await panel.boundingBox()).y);
  // A button: the profile's picture, its name and the +; a long name cut with … in one row, the + still inside it; who
  // it is only in the tooltip. A profile of such a name, closed.
  const LONG = 'orudzhali.very.long.name@insvgna.org';
  const long = await core(async (k, n) => { const t = k.shell.task, p = await t.createProfile(n) as { id: string }; await t.closeProfile(p.id); return p.id; }, LONG);
  try {
    const tile = tiles.locator(`[data-profile="${long}"]`), name = tile.getByText(LONG, { exact: true });
    await expect(tile.locator('img')).toHaveCount(1);
    await expect(name).toHaveCSS('white-space', 'nowrap');
    await expect(name).toHaveCSS('text-overflow', 'ellipsis');
    // Cut: Playwright reads no overflow.
    expect(await name.evaluate((n) => n.scrollWidth > n.clientWidth), 'cut').toBe(true);
    const r = await tile.boundingBox(), plus = await tile.locator('svg').last().boundingBox();
    expect(r.width, 'wider than a short name').toBeGreaterThan((await tiles.locator(`[data-profile="${SAM}"]`).boundingBox()).width);
    expect(plus.x + plus.width, 'the + inside it').toBeLessThanOrEqual(r.x + r.width);
    await expect(tiles.locator(`[data-profile="${SAM}"]`)).toHaveAttribute('title', /^Open Sam\.admin: ./);
    // More than fit (19 profiles): the row scrolls, its end faded, the window as wide as before, not its column, the
    // terminal and the tasks' bar stretched past its edge, the last profiles out of reach. Its tiles copied: sixteen
    // profiles more would take seconds to make and delete, and the row's scroll is its CSS's whatever the tiles are (the
    // narrowest window is no way: the grid's own minimum is wider, and the row with it).
    await tiles.evaluate((s) => { for (let i = 0; i < 20; i++) s.append(s.querySelector('button').cloneNode(true)); });
    await expect(tiles).toHaveAttribute('data-past-end');
    // Scrolled, the page not wider than the window: Playwright reads no scroll.
    expect(await tiles.evaluate((t) => t.scrollWidth > t.clientWidth), 'the row scrolls').toBe(true);
    expect(await ui.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'the window not wider').toBe(true);
    const width = await ui.evaluate(() => innerWidth), t = await tiles.boundingBox(), i = await panel.boundingBox();
    expect([t.x + t.width <= width, i.x + i.width <= width]).toEqual([true, true]);
    await tiles.evaluate((s, n) => s.querySelectorAll('button').forEach((b, j) => { if (j >= n) b.remove(); }), 4);
  } finally { await deleteProfile(core, ui, LONG); }
  await tiles.locator(`[data-profile="${SAM}"]`).click();
  await expect.poll(() => core((k, a) => k.shell.taskByKey(a.task).profiles.has(a.SAM), { task, SAM })).toBe(true);
  await expect(tiles).toHaveCount(0);
  await call('profile_close', { profile: 'Sam.admin' }, { task });
  await expect(tiles).toHaveCount(1);
  await closeTab();
  await expect.poll(terminals).toBe(0);
  await expect(launchers).toHaveCount(1);
  await expect(tiles).toHaveCount(0);
  // With a profile open (its tile among the big buttons): folded to a strip of its +, along the grid's height (the
  // terminals are under the grid); kept so.
  await launchers.locator(`[data-profile="${SAM}"]`).click();
  await expect.poll(async () => (await size(group)).height <= 40 && (await middle())).toBe(true);
  expect(Math.abs((await size(group)).width - before.width), 'as wide as before (Resources beside it takes its share as the grid changes)').toBeLessThanOrEqual(5);
  // Its + opens a terminal: the terminals' panel unfolds.
  await unfold.click();
  await expect(menu(ui)).toMatchAriaSnapshot(`
    - menu:
      - menuitem "Terminal"
  `);
  await choose(ui, 'Terminal');
  await expect.poll(terminals).toBe(1);
  await folded(false);
  await expect.poll(async () => (await size(group)).height).toBeGreaterThanOrEqual(150);
  // A shell closes without a question; folded again.
  await closeTab();
  await expect.poll(terminals).toBe(0);
  await folded(true);
  await expect.poll(async () => (await size(group)).height).toBeLessThanOrEqual(40);
  await noQuestion(ui);
  // The preset "grid": right of the profiles, Resources under it in its column: folded along its height, a strip of its
  // + over Resources.
  await arrange(ui, 'grid');
  await expect.poll(async () => (await size(group)).height <= 40 && (await middle()) && (await size(resources)).height > 300).toBe(true);
  await unfold.click();
  await choose(ui, 'Terminal');
  await expect.poll(terminals).toBe(1);
  await folded(false);
  await expect.poll(async () => (await size(group)).height).toBeGreaterThanOrEqual(150);
  // As tall as the grid (Resources moved under the pages): folded along the grid's width instead, a strip of its + as
  // tall as the grid; its + unfolds it to a width of its own, and the last terminal closed folds it again. Moved by
  // dockview's API: a drag of a panel between groups is the OS's drag and drop.
  await ui.evaluate((id) => { const d = (window as any).__dock; d.getPanel('resources').api.moveTo({ group: d.getPanel(`profile:${id}`).group, position: 'bottom' }); }, SAM);
  await closeTab();
  await expect.poll(async () => { const r = await size(group); return (await terminals()) === 0 && r.width <= 40 && r.height > 100 && (await middle()); }).toBe(true);
  await unfold.click();
  await choose(ui, 'Terminal');
  await expect.poll(terminals).toBe(1);
  await folded(false);
  await expect.poll(async () => (await size(group)).width).toBeGreaterThanOrEqual(200);
  await closeTab();
  await expect.poll(terminals).toBe(0);
  await folded(true);
  await expect.poll(async () => (await size(group)).width).toBeLessThanOrEqual(40);
  await arrange(ui, 'columns');
  await expect.poll(async () => (await size(group)).height <= 40 && (await middle())).toBe(true);
  // Ctrl+` there: the task's agent, a new conversation.
  await focusWindow(core, ui);
  await core((k) => k.press(k.shell.win.webContents, '`', 'control'));
  await expect.poll(() => core((k, key) => !!k.shell.taskByKey(key).promptTarget()?.pty, task), { timeout: 20000 }).toBe(true);
  expect(conversations()).toHaveLength(2);
  expect([conversations()[1].agent, conversations()[1].terminal]).toEqual(['custom', await core((k, key) => k.shell.taskByKey(key).promptTarget().id, task)]);
  // Its × closes it without a question: nothing works in it.
  await taskTab(ui, task).getByRole('button', { name: 'Close' }).click();
  await expect.poll(async () => (await core((k, key) => { const t = k.shell.taskByKey(key); return !!t.entry.closed && !t.loaded; }, task)) && isNth(core, 2)).toBe(true);
  await noQuestion(ui);
});

test('tasks: × on the last open task of a project lets the project go, nothing asked: the empty window; a task of it opens it again', async ({ core, ui, files, call }) => {
  await begin(core, ui, files, { only: true, columns: true, featureX: call });
  // A third task, closed (the sidebar lists it with the others).
  const third = await newTask(core, ui);
  await invoke(ui, 'task:close', third);
  await expect.poll(() => core((k, key) => !!k.shell.taskByKey(key).entry.closed, third)).toBe(true);
  const pid = files.pid('project'), first = await keyAt(core, 1), second = await keyAt(core, 2);
  await expect.poll(() => taskTabs(ui)).toEqual(['task-1', 'Feature-X *']);
  await taskTab(ui, first).getByRole('button', { name: 'Close' }).click();
  await expect.poll(() => core((k, a) => { const f = k.shell.taskByKey(a.first); return !!f.entry.closed && !f.loaded && k.shell.task?.key === a.second; }, { first, second })).toBe(true);
  await expect.poll(() => taskTabs(ui)).toEqual(['Feature-X *']);
  await noQuestion(ui);
  await core((k, key) => { k.stash.second = k.shell.taskByKey(key); }, second);
  await taskTab(ui, second).getByRole('button', { name: 'Close' }).click();
  // The project goes once its task is unloaded: its agent stopped, each profile's sign-ins written out and its
  // tabs closed. On a loaded machine, with another project running beside it, that takes over 5 s now and then.
  await expect.poll(() => core((k, p) => k.shell.task === null && !k.shell.current && !k.shell.open.has(p), pid), { timeout: 15000 }).toBe(true);
  await noQuestion(ui, 'no agent works: nothing asked');
  expect(await core((k) => { const s = k.stash.second; return s.profiles.size === 0 && !s.pty; }), 'every task of the project stopped').toBe(true);
  expect(files.tasksOf(files.pid('project')).map((e) => [e.name, !!e.closed])).toEqual([['task-1', true], ['Feature-X', true], ['task-3', true]]);
  await expect(ui.locator('html')).toHaveAttribute('data-page', /^(sidebar|welcome)$/);
  // The empty window, projects there: the sidebar docked, every project with its tasks; no tasks' bar.
  await expect(ui.locator('html')).toHaveAttribute('data-page', 'sidebar');
  await expect(sidebar(ui)).toBeVisible();
  await expect(ui.locator('#taskbar'), "no tasks' bar: no tab").toHaveCount(0);
  await expect(ui.locator('html'), "no project's color").not.toHaveAttribute('style', /--project/);
  expect(await core((k) => k.shell.win.getTitle())).toBe('Kulisa');
  expect(files.savedWindows(), 'the window opens so next time').toEqual([{ tabs: [], shown: null }]);
  // Each project: its icon, its name, + (a new task of it) under the pointer; its tasks, the one closed last first (all
  // are closed here), each when it was closed. The project worked in last first.
  const byClosing = files.tasksOf(files.pid('project')).filter((e) => e.closed).sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0)).map((e) => e.name);
  await expect(sidebar(ui).locator('[data-project]').first(), 'worked in last').toHaveAccessibleName('project');
  expect(await sidebarTasks(ui, 'project')).toEqual(byClosing);
  expect(byClosing[0]).toBe('Feature-X');
  // Each project's icon: its favicon, else Kulisa's logo in its color.
  const ids = await sidebar(ui).locator('[data-project]').evaluateAll((ss) => ss.map((x) => (x as HTMLElement).dataset.project));
  for (const [id, favicon] of await core((k, all) => all.map((i) => [i, !!k.shell.projects().find((p) => p.id === i).favicon] as const), ids)) {
    const icon = sidebar(ui).locator(`[data-project="${id}"]`).getByTestId('project-icon').first();
    if (favicon) await expect(icon).toHaveJSProperty('tagName', 'IMG'); else await expect(icon).toHaveAttribute('data-logo', '');
  }
  await expect(taskRow(ui, 'project', 'Feature-X')).toContainText(/ago|just now/);
  // A closed task's 🗑 asks as Delete Task… does (Cancel keeps it).
  // Shown on the row the pointer is on.
  await (await rowButton(taskRow(ui, 'project', 'task-3'), 'Delete Task…')).click();
  expect((await answer(ui, false)).message).toBe('Delete the task task-3?');
  expect(files.tasksOf(files.pid('project')).some((e) => e.name === 'task-3'), 'Cancel keeps it').toBe(true);
  // A closed task in the sidebar opens it again, as that task's tab.
  await taskRow(ui, 'project', 'Feature-X').click();
  await expect.poll(() => core((k, key) => k.shell.task?.key === key && k.shell.task.loaded && !!k.shell.pty, second)).toBe(true);
  await core((k) => k.watchPty(k.shell.pty));
  await expect(ui.locator('html')).toHaveAttribute('data-page', 'task');
  await notLoading(ui);
  await expect.poll(() => taskTabs(ui)).toEqual(['Feature-X *']);
  // Now a task is shown: the sidebar over the grid lists the project's tasks (the open one to switch to, the closed ones to reopen).
  await openSidebar(ui);
  expect(await sidebarTasks(ui, 'project')).toEqual(['Feature-X', 'task-1', 'task-3']);
  await expect(taskRow(ui, 'project', 'Feature-X')).toHaveAttribute('aria-current', 'true');
  await closeSidebar(ui);
  await fromSidebar(ui, 'project', 'task-1');
  await expect.poll(() => core((k, key) => k.shell.task?.key === key && k.shell.task.loaded && !!k.shell.pty, first)).toBe(true);
  await core((k) => k.watchPty(k.shell.pty));
  await expect.poll(() => taskTabs(ui)).toEqual(['Feature-X', 'task-1 *']); // a tab opens at the end
  expect(await core((k, key) => k.shell.taskByKey(key).loaded, second), 'the other open one stays loaded').toBe(true);
  await bothOn(core, ui, files);
});

test('the CDP proxy takes ids in any letters (percent-encoded in its URLs); the grid changed just before its task is left is saved so', async ({ core, ui, files, call }) => {
  await begin(core, ui, files, { only: true, columns: true, featureX: call });
  const id = await core(async (k) => (await k.shell.task.createProfile('Анна') as { id: string }).id);
  await expect.poll(() => core((k, p) => !!k.shell.profiles.get(p).browser, id)).toBe(true);
  expect(await core((k, p) => k.shell.profiles.get(p).endpoint.endsWith(`/${k.shell.task.key}/${encodeURIComponent(p)}`), id)).toBe(true);
  expect(await core(async (k, p) => { const pr = k.shell.profiles.get(p); await pr.newTab('about:blank').ready; return (await pr.page()).url(); }, id), 'Playwright reached its tab').toBe('about:blank');
  const gone = core((k, p) => k.shell.task.deleteProfile(p), id);
  await answer(ui);
  await gone;
  // The grid changed, and the task left at once: the change is in its saved grid (its save waits 300 ms, and leaving
  // must not drop it: a pane of a profile deleted just before would stay there, and a saved grid naming a profile no
  // longer there is not restored at all). The grid's shape, its sizes aside.
  const task = await core((k) => k.shell.task.key), other = await keyAt(core, 2);
  const shape = (root: unknown) => JSON.stringify(root, (key, v) => (key === 'size' ? undefined : v));
  const saved = async () => shape(await core((k, key) => (k.shell.taskByKey(key).store.layout() as { grid: { root: unknown } }).grid.root, task));
  // Left two frames after the change (dockview tells of it on a frame), well within the 300 ms.
  // Applied and left by a script: from the test, the two frames would be over before the task is left. dockview's API
  // gives the grid's shape.
  const columns = await ui.evaluate((o) => { (window as any).__layoutPreset('columns'); return new Promise<string>((r) => requestAnimationFrame(() => requestAnimationFrame(() => {
    r(JSON.stringify((window as any).__dock.toJSON().grid.root)); void (window as any).kulisa.invoke('task:show', o);
  }))); }, other);
  await expect.poll(() => core((k, key) => k.shell.task?.key === key && k.shell.task.loaded, other)).toBe(true);
  await expect.poll(saved).toBe(shape(JSON.parse(columns))); // saved as it was left: it comes as the grid is taken down
  // Back: built again as it was left.
  await invoke(ui, 'task:show', task);
  await expect.poll(() => core((k, key) => k.shell.task?.key === key, task)).toBe(true);
  await notLoading(ui);
  await expect.poll(async () => shape(JSON.parse(await ui.evaluate(() => JSON.stringify((window as any).__dock.toJSON().grid.root))))).toBe(shape(JSON.parse(columns)));
  await arrange(ui, 'grid');
  await expect.poll(saved).not.toBe(shape(JSON.parse(columns)));
});
