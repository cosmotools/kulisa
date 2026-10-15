// Tasks: each with its own copy of the code (a git worktree on a branch of its own; without git, the project's
// folder), copies of the profiles, its own agent; closing, opening again, renaming and deleting them; the projects'
// bar as tab groups, switching, the window with no project.
import { execFileSync } from 'child_process';
import electron from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { assert, root, userData, project, pfile, panel, SITE, sleep, waitFor, who, menuRows, choose, rightClick, viewOn, press, projectTabs, projectTab, showProject, savedWindows, closeMenu, click, plusMenu, PORT, hooksOf, MENU, SUBMENU, menuOpen, noNode, focusWindow } from './helpers.ts';
import { withOffset } from '../src/main/tasks.ts';
import { createWorktree } from '../src/main/worktrees.ts';
import { sessionStart } from '../src/main/agent-hooks.ts';
import { refused } from '../src/shared/result.ts';
import type { Test, Ctx } from './run.ts';
import type { UI } from './helpers.ts';
import type { TaskTerminal } from '../src/main/tasks.ts';
import type { Task } from '../src/main/tasks.ts';
import type { TasksFile } from '../src/main/store.ts';
const hasDirenv = (() => { try { execFileSync('direnv', ['version']); return true; } catch { return false; } })();

const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=Kulisa test', '-c', 'user.email=test@example.invalid', ...args], { cwd, encoding: 'utf8' }).trim();
// The shown task's project's tabs in the bar, the shown one with ' *'; its task n's tab.
const ACTIVE_PROJECT = `document.querySelector('#projectTabs .tasktab.active').dataset.project`;
const tabs = (ui: UI) => ui(`[...document.querySelectorAll('#projectTabs .tasktab[data-project="' + ${ACTIVE_PROJECT} + '"]')].map((t) => t.querySelector('.name').textContent + (t.classList.contains('active') ? ' *' : ''))`);
const taskTab = (n: number) => `document.querySelector('#projectTabs .tasktab[data-task="' + ${ACTIVE_PROJECT} + '/${n}"]')`;
const tasksFile = (): TasksFile => JSON.parse(fs.readFileSync(path.join(userData, 'projects', 'project', 'tasks.json'), 'utf8'));
// The bar's +, the shown project in its menu; resolves once the new task is shown, its agent started.
async function newTask(ctx: Ctx) {
  const { shell, ui } = ctx;
  const before = shell.task;
  await plusMenu(ui, shell.current.name);
  await waitFor(() => shell.task !== before && shell.task.loaded && [...shell.task.terminals.values()].some((t) => t.pty), 20000);
  if (shell.pty) ctx.watchPty(shell.pty);
  return shell.task;
}
// A project's submenu (a tab's right-click, then the row of the project's name, the one row opening a menu): its
// rows, a row of it chosen. tab: the tab to open it on (the shown task's).
async function projectMenu(ui: UI, label?: string, tab = '#projectTabs .tasktab.active .name') {
  await rightClick(ui, tab);
  await menuRows(ui);
  await ui(`${MENU}.querySelector('.item[aria-haspopup]').click()`);
  await waitFor(async () => (await ui(`document.querySelectorAll('.menu[data-state="open"]').length`)) === 2);
  const rows = await menuRows(ui, SUBMENU);
  if (label) await choose(ui, label, SUBMENU);
  else await closeMenu(ui);
  return rows;
}
const groupMenu = (ui: UI, label?: string) => projectMenu(ui, label);
// One of the agent's hooks, as its plugin sends it (agent-hooks.ts); its answer.
const hook = (task: Task, event: string, input = {}) => new Promise<any>((resolve) => http.request(`${hooksOf(task)}/${event}`, { method: 'POST' },
  (res) => { let body = ''; res.on('data', (d) => (body += d)); res.on('end', () => resolve(JSON.parse(body || '{}'))); }).end(JSON.stringify(input)));
// The session an agent reports at its start (its SessionStart hook, as Claude Code sends it): Kulisa resumes it.
const reportSession = (task: Task, id: string, transcript: string) => hook(task, 'session-start', { hook_event_name: 'SessionStart', session_id: id, transcript_path: transcript, source: 'startup' });

export default (test: Test) => {
  test('tasks: a port offset moves local addresses only, either way', async () => {
    assert.equal(withOffset('http://localhost:3000/cart?x=1', 100), 'http://localhost:3100/cart?x=1');
    assert.equal(withOffset('http://127.0.0.1:4417/app', 200), 'http://127.0.0.1:4617/app');
    assert.equal(withOffset('http://localhost:3200/', -100), 'http://localhost:3100/', "from a task with a greater offset");
    assert.equal(withOffset('http://shop.localhost:8080/', 100), 'http://shop.localhost:8180/');
    assert.equal(withOffset('http://localhost/', 100), 'http://localhost/', 'no port: left alone');
    assert.equal(withOffset('https://example.com:8443/', 100), 'https://example.com:8443/', 'not local');
    assert.equal(withOffset('http://localhost:3000/', 0), 'http://localhost:3000/');
  });

  test('tasks: without git a task works in the project\'s folder, and a second one there is asked about first', async (ctx) => {
    const { shell, ui } = ctx;
    await waitFor(async () => JSON.stringify(await tabs(ui)) === '["task-1 *"]');
    assert.equal(shell.task.folder, project);
    assert.equal((shell.task.entry as { worktree?: string }).worktree, undefined);
    assert.match(await ui(`${taskTab(1)}.title`), /in the project's folder .*no git/);
    ctx.answer = false;
    await plusMenu(ui, shell.current.name);
    await waitFor(() => ctx.asked.length);
    const q = ctx.asked.pop();
    assert.equal(q.message, 'Another task of project works in its folder');
    assert.match(q.detail, /may get in each other's way/);
    ctx.answer = true;
    assert.equal(shell.current.tasks.size, 1, 'none made when the human says no');
    // The human sets git up in the terminal and commits: the next task gets a copy of its own.
    git(project, 'init', '-q');
    fs.writeFileSync(path.join(project, '.gitignore'), '.env*\nconfig/local.json\ntranscript.jsonl\n.claude/settings.local.json\n');
    fs.writeFileSync(path.join(project, '.worktreeinclude'), 'config/local.json\n');
    fs.writeFileSync(path.join(project, 'README.md'), '# shop\n');
    git(project, 'add', '-A');
    git(project, 'commit', '-qm', 'first');
    fs.writeFileSync(path.join(project, '.env'), 'SECRET=1\n');
    fs.writeFileSync(path.join(project, '.envrc'), 'export FROM_ENVRC="envrc of $PWD"\n');
    if (hasDirenv) execFileSync('direnv', ['allow', project]); // the human allowed it in the project's folder
    fs.mkdirSync(path.join(project, 'config'), { recursive: true });
    fs.writeFileSync(path.join(project, 'config', 'local.json'), '{"db":"local"}');
    fs.mkdirSync(path.join(project, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(project, '.claude', 'settings.local.json'), '{"model":"x"}');
    fs.writeFileSync(path.join(project, 'wip.txt'), 'not committed');
  });

  test('tasks: + makes task-<n> from the project\'s configuration: its worktree and branch, files outside git, its profiles closed until opened (each a copy of its master), its ports; the agent renames it', async (ctx) => {
    const { shell, ui, call } = ctx;
    const first = shell.task;
    await call('browser_navigate', { profile: 'sam-admin', url: `${SITE}/app?task` });
    const firstSam = first.profiles.get('sam-admin');
    // The island's buttons are for a task with nothing open: a task opening shows its agent's tab at once, starting,
    // not them for the second its agent is looked for (they did, 2026-10-15).
    await ui(`window.__launch = false; window.__starting = ''; new MutationObserver(() => { window.__launch ||= !!document.querySelector('#dock .launch');
      window.__starting ||= document.querySelector('#dock .starting')?.textContent; })
      .observe(document.body, { childList: true, subtree: true })`);
    const find = shell.findAgent; // looking for it takes the user's login shell, slower on the human's computer than here
    shell.findAgent = async (...a) => { await sleep(1000); return find(...a); };
    const task = await newTask(ctx);
    shell.findAgent = find;
    assert.equal(await ui('window.__launch'), false, "no island's buttons while its agent starts");
    assert.match(await ui('window.__starting'), /^Starting .+…$/, 'its tab, starting');
    await waitFor(async () => !(await ui(`!!document.querySelector('.terminals .starting')`))); // then its terminal
    const wt = `${project}@task-2`;
    assert.equal(task.n, 2);
    assert.equal(task.name, 'task-2');
    assert.equal(task.folder, wt);
    assert.equal(git(wt, 'rev-parse', '--abbrev-ref', 'HEAD'), 'task-2');
    assert.equal(git(wt, 'rev-parse', 'HEAD'), git(project, 'rev-parse', 'HEAD'), 'from HEAD (no remote here)');
    assert.equal(fs.readFileSync(path.join(wt, '.env'), 'utf8'), 'SECRET=1\n');
    assert.equal(fs.readFileSync(path.join(wt, 'config', 'local.json'), 'utf8'), '{"db":"local"}', '.worktreeinclude');
    assert.equal(fs.readFileSync(path.join(wt, '.claude', 'settings.local.json'), 'utf8'), '{"model":"x"}', "an agent's local settings (its localFiles)");
    assert.ok(fs.existsSync(path.join(wt, 'README.md')) && !fs.existsSync(path.join(wt, 'wip.txt')), 'uncommitted changes are not carried');
    assert.ok(!fs.existsSync(path.join(wt, '.kulisa')), 'nothing of Kulisa in the folder');
    if (hasDirenv) { // the project's .envrc is allowed, so the copy in the task is too: the project's environment is there
      assert.equal(execFileSync('direnv', ['exec', wt, 'sh', '-c', 'echo $FROM_ENVRC'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(), `envrc of ${wt}`);
    }
    await waitFor(async () => (await ctx.termText()).includes(`agent: rc of ${wt}`)); // its agent, in its folder
    assert.deepEqual(task.env(), { KULISA_MCP_URL: `${shell.mcp.base}/task/project/2/mcp`, KULISA_URL: `${shell.mcp.base}/task/project/2`, KULISA_TASK: 'task-2', KULISA_PORT_OFFSET: '100' });
    assert.equal(shell.resumedSession, null, 'a new conversation');
    const told = await ctx.instructions(task);
    assert.match(told, /This is the Kulisa task "task-2": a git worktree of its own, .*project@task-2, on branch task-2/, 'where it works, told to any agent');
    assert.match(told, /folder .*project is the human's: never change it on your own\. Asked to merge your work into main there, first check for the human's uncommitted changes/);
    assert.match(told, /usual ports plus 100 \(3000 → 3100; \$KULISA_PORT_OFFSET\)/);

    // Profiles: none opens by itself, nothing taken from the task on screen; the agent opens those it needs, each a copy
    // of its master (not of the first task's copy: what was signed in there stays there; a master's sign-ins come with it).
    assert.deepEqual([...shell.profiles.keys()], []);
    assert.deepEqual([...shell.closed.keys()], ['sam-admin', 'elon-buyer', 'dora']);
    assert.ok(!fs.existsSync(pfile('Profile 1', 2)), 'no copy before it is opened');
    await call('profile_open', { profile: 'sam-admin' });
    await call('profile_open', { profile: 'elon-buyer' });
    await waitFor(() => shell.profiles.has('sam-admin') && shell.profiles.has('elon-buyer'));
    assert.deepEqual(['sam-admin', 'elon-buyer'].map((id) => [shell.profiles.get(id).avatar, shell.profiles.get(id).description]),
      [['fox', 'seller in the test shop'], ['owl', '']], 'with their pictures and who they are');
    assert.ok(shell.profiles.get('sam-admin').dir.startsWith(path.join(userData, 'projects', 'project', '2')));
    assert.ok(!fs.existsSync(pfile('Profile 3', 2)), 'a closed one is copied when it is first opened');
    await call('browser_navigate', { profile: 'sam-admin', url: `${SITE}/app` });
    assert.equal(await who(ctx, 'sam-admin'), 'Signed out', 'its master was never signed in');
    // Signed in in this task's copy: there only (restart-tasks.ts: it stays).
    await call('browser_navigate', { profile: 'sam-admin', url: `${SITE}/app/login?name=sam` });
    assert.equal(await who(ctx, 'sam-admin'), 'Signed in as sam');
    assert.equal(await who({ call: (n, a) => call(n, a, first) }, 'sam-admin'), 'Signed in as sam', "the first task's own sign-in");
    // The first task's profiles keep running, hidden; its agent sees its own.
    assert.ok(firstSam.tabs.every((t) => !t.wc.isDestroyed()) && !firstSam.get().view.getVisible());
    assert.equal(firstSam.get().wc.getURL(), `${SITE}/app?task`, "the new task's agent acts in its own copy");
    assert.match((await call('browser_snapshot', { profile: 'sam-admin' }, first)).text, /URL: .*\/app\?task/);
    assert.ok(first.pty && first.pty !== shell.pty);
    assert.equal(JSON.parse(fs.readFileSync(pfile('agent.json', 2), 'utf8')).conversations[0].agent, 'custom', "no agent in the project: the one there is (the tests' own)");

    // The window: the task's grid with its panes; the bar shows it.
    await waitFor(async () => JSON.stringify(await tabs(ui)) === '["task-1","task-2 *"]');
    await waitFor(() => viewOn(shell, ui, 'sam-admin'));
    assert.equal(await ui(`document.querySelectorAll('.pane').length`), 2);
    assert.match(await ui(`${taskTab(2)}.title`), /branch task-2 in .*project@task-2; the app's ports \+ 100/);

    // Until named, its agent is told to name it itself at the human's every prompt and in every tool's result: told only
    // at session start, it forgot (7 of the author's 8 tasks stayed task-<n>).
    const prompt = (text = '') => new Promise<string>((r) => http.request(`${task.env().KULISA_URL}/hooks/prompt`, { method: 'POST' }, (res) => {
      let body = ''; res.on('data', (d) => { body += d; }); res.on('end', () => r(body));
    }).end(JSON.stringify({ prompt: text })));
    const nameIt = /no name yet \(task-2\)\. When the human's request says what the task is about, name it with task_rename .* Silently: never ask the human for a name or mention naming it\./;
    assert.match(JSON.parse(await prompt()).hookSpecificOutput.additionalContext, nameIt);
    assert.match((await call('browser_profiles', {})).note, nameIt);
    // The naming tools load with Claude Code's session, not behind its tool search: there the agent never named it.
    assert.deepEqual((await ctx.tools(task)).filter((t) => t._meta?.['anthropic/alwaysLoad']).map((t) => t.name), ['task_rename']);
    // Until then its first prompt's first line says what it is about, over its tab.
    await prompt('\n  Sellers see their payouts  \nwith dates');
    await prompt('Another request');
    await waitFor(async () => (await ui(`${taskTab(2)}.title`)).startsWith('project\n“Sellers see their payouts”\nbranch task-2 in '));
    // Its agent names it: the tab and the branch; the folder stays.
    await assert.rejects(call('task_rename', { name: 'a b' }), /only/);
    assert.match((await call('task_rename', { name: 'Feature-X' })).text, /now "Feature-X", on branch feature-x/);
    await waitFor(async () => JSON.stringify(await tabs(ui)) === '["task-1","Feature-X *"]');
    assert.equal(git(wt, 'rev-parse', '--abbrev-ref', 'HEAD'), 'feature-x');
    assert.equal(task.folder, wt);
    assert.deepEqual(tasksFile().list.map((e) => [e.name, e.branch]), [['task-1', undefined], ['Feature-X', 'feature-x']]);
    assert.equal(await prompt(), '{}', 'named: not told again');
    await waitFor(async () => (await ui(`${taskTab(2)}.title`)).startsWith('project\nbranch feature-x'));
    assert.equal(tasksFile().list[1].about, undefined, 'its name says what it is about now');
    assert.equal((await call('browser_profiles', {})).note, undefined);
    await shell.screenshot(path.join(root, 'task.png'));
  });

  test("profiles: Sign In to Master… opens its master in a window of its own, nothing automated on it; Refresh from Master… brings its sign-ins to this task's copy", async (ctx) => {
    const { shell, ui, call } = ctx;
    await rightClick(ui, `.ptab[data-panel="${panel(shell, 'sam-admin')}"] b`);
    const rows = await menuRows(ui);
    assert.ok(rows.includes('Sign In to Master…') && rows.includes('Refresh from Master…'));
    await choose(ui, 'Sign In to Master…');
    await waitFor(() => shell.masters.size === 1 && shell.masters.values().next().value.profile.get());
    const m = shell.masters.values().next().value;
    assert.equal(m.profile.dir, path.join(userData, 'profiles', shell.profileStore.get('sam-admin').folder));
    assert.ok(![...shell.proxy.profiles.keys()].some((k) => k.startsWith('master/')), 'no CDP proxy for it: nothing automated reaches it');
    assert.equal(await noNode(m.win.webContents), true, 'its page sandboxed, as the window\'s');
    // The human signs in there, by hand (here: its bar's address).
    await m.win.webContents.executeJavaScript(`kulisa.invoke('master:go', '${SITE}/app/login?name=master')`);
    await waitFor(() => m.profile.get().wc.getURL().endsWith('/app'));
    await waitFor(async () => (await m.win.webContents.executeJavaScript(`document.getElementById('address').value`)).endsWith('/app'), 3000);
    m.win.close();
    await waitFor(() => !shell.masters.size);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(m.profile.dir, 'Kulisa Tabs.json'), 'utf8')), [`${SITE}/app`], 'its tabs kept');
    // This task's copy was made before: still its own sign-in, until Refresh from Master… (asked first).
    assert.equal(await who(ctx, 'sam-admin'), 'Signed in as sam');
    await ui(`act('profile:refresh', { profile: 'sam-admin' })`);
    assert.match(ctx.asked.pop().message, /^Bring the sign-ins of Sam.admin's master to this task\?/);
    // Its tabs reload with them: once that is over (a navigation now would be cut by the reload).
    await waitFor(() => !shell.task.profiles.get('sam-admin').get().wc.isLoading());
    await call('browser_navigate', { profile: 'sam-admin', url: `${SITE}/app` });
    assert.equal(await who(ctx, 'sam-admin'), 'Signed in as master');
  });

  test('profiles: About this profile… opens Settings at it; its Sign In… opens the same master window, once', async (ctx) => {
    const { shell, ui } = ctx;
    await rightClick(ui, `.ptab[data-panel="${panel(shell, 'sam-admin')}"] b`);
    await menuRows(ui);
    await choose(ui, 'About this profile…');
    await waitFor(() => ui(`document.getElementById('projects')?.dataset.state === 'open' && document.querySelector('#pjlist [data-profile="sam-admin"]')?.ariaSelected === 'true' && document.getElementById('profilename').value === 'Sam.admin'`));
    assert.ok(shell.profiles.has('sam-admin') && !shell.task.profiles.get('sam-admin').get().view.getVisible(), 'pages hidden under Settings');
    for (let i = 0; i < 2; i++) await ui(`document.getElementById('profilesignin').click()`);
    await waitFor(() => shell.masters.size === 1 && shell.masters.values().next().value.profile.get());
    assert.equal(shell.masters.values().next().value.profile.dir, path.join(userData, 'profiles', shell.profileStore.get('sam-admin').folder));
    shell.masters.values().next().value.win.close();
    await waitFor(() => !shell.masters.size);
    await ui(`document.querySelector('#projects .x').click()`);
    await waitFor(async () => !(await ui(`document.getElementById('projects')?.dataset.state === 'open'`)));
  });

  // About 5 s: its tab waits for a site that never answers, by design (profiles.ts).
  test("profiles: a master's window closed while its page still loads (a slow sign-in) goes cleanly, Sign In… answering without an error", async (ctx) => {
    const { shell, ui } = ctx;
    const { folder } = shell.profileStore.get('sam-admin');
    const tabs = path.join(userData, 'profiles', folder, 'Kulisa Tabs.json'), before = fs.readFileSync(tabs, 'utf8');
    fs.writeFileSync(tabs, JSON.stringify([`${SITE}/hang`]));
    const answer = ui(`kulisa.invoke('profiles:master', { profile: 'sam-admin' })`);
    await waitFor(() => shell.masters.size === 1 && shell.masters.values().next().value.profile.get());
    shell.masters.values().next().value.win.close();
    await waitFor(() => !shell.masters.size);
    // It laid out its page in the window closed meanwhile: "Object has been destroyed".
    assert.deepEqual(await answer, { folder });
    fs.writeFileSync(tabs, before);
  });

  test("profiles: a real account's sign-in kept in step: signed in to a site (not local) in one task, it is in the others and the master; signed out, out everywhere; a local app's stays each task's", async (ctx) => {
    const { shell, call } = ctx;
    const first = shell.taskOf('project', 1), shop = `http://shop.example:${PORT}`;
    const inFirst = { call: (n: string, a: Record<string, unknown>) => call(n, a, first) };
    await call('browser_navigate', { profile: 'sam-admin', url: `${shop}/app/login?name=real` });
    assert.equal(await who(ctx, 'sam-admin'), 'Signed in as real');
    await waitFor(async () => (await first.profiles.get('sam-admin').session.cookies.get({ domain: 'shop.example' })).some((c) => c.value === 'real'));
    await call('browser_navigate', { profile: 'sam-admin', url: `${shop}/app` }, first);
    assert.equal(await who(inFirst, 'sam-admin'), 'Signed in as real', 'in the other task too');
    const master = electron.session.fromPath(shell.profileStore.masterDir(shell.profileStore.get('sam-admin').folder));
    assert.ok((await master.cookies.get({ domain: 'shop.example' })).some((c) => c.value === 'real'), 'and in its master');
    // Signed out in the first task: out in this one too.
    await call('browser_navigate', { profile: 'sam-admin', url: `${shop}/app/logout` }, first);
    await waitFor(async () => !(await shell.task.profiles.get('sam-admin').session.cookies.get({ domain: 'shop.example' })).length);
    await call('browser_navigate', { profile: 'sam-admin', url: `${shop}/app` });
    assert.equal(await who(ctx, 'sam-admin'), 'Signed out');
    // A local app (127.0.0.1): each task's own sign-in, as before.
    await call('browser_navigate', { profile: 'sam-admin', url: `${SITE}/app` });
    assert.equal(await who(ctx, 'sam-admin'), 'Signed in as master');
    await call('browser_navigate', { profile: 'sam-admin', url: `${SITE}/app` }, first);
    assert.equal(await who(inFirst, 'sam-admin'), 'Signed in as sam');
  });

  test('tasks: switching shows the other grid and terminal; the one left keeps running; the agent\'s state shows on its tab', async (ctx) => {
    const { shell, ui } = ctx;
    const second = shell.task, sam = second.profiles.get('sam-admin');
    // No profiles' button on a task's tab, its right-click menu has them; the × on every tab, as Chrome's, not only
    // the shown one's (the author, 2026-10-12).
    assert.deepEqual(await ui(`[...document.querySelectorAll('#projectTabs .tasktab')].map((t) => [...t.querySelectorAll('button')].map((b) => b.ariaLabel + ' ' + getComputedStyle(b).visibility))`),
      [['Close visible'], ['Close visible']]);
    const widths = () => ui(`[...document.querySelectorAll('#projectTabs .tasktab')].map((t) => t.getBoundingClientRect().width)`);
    const before = await widths();
    // A tab's right-click menu: the shown one's has its profiles; then renaming, its folder, moving to another window,
    // closing, deleting, and its project's submenu. Show Folder opens the task's worktree in the file manager.
    await rightClick(ui, `#projectTabs .tasktab[data-task$="/1"] .name`);
    assert.deepEqual(await menuRows(ui), ['Rename…', 'Show Folder', '-', 'Move to New Window', '-', 'Close', 'Delete Task…', '-', 'project']);
    await closeMenu(ui);
    const openPath = electron.shell.openPath, shown: string[] = [];
    electron.shell.openPath = async (dir) => { shown.push(dir); return ''; };
    try {
      await rightClick(ui, `#projectTabs .tasktab[data-task="${second.key}"] .name`);
      const rows = await menuRows(ui);
      assert.deepEqual([rows[0], ...rows.slice(-12)], ['# Profiles', '-', 'Manage Profiles…', '-', 'Rename…', 'Show Folder', '-', 'Move to New Window', '-', 'Close', 'Delete Task…', '-', 'project']);
      assert.deepEqual(rows.slice(1, -12).toSorted(), ['Dora', 'Elon.buyer', 'Sam.admin'], 'its open and closed profiles');
      await choose(ui, 'Show Folder');
      await waitFor(() => shown.length === 1);
    } finally { electron.shell.openPath = openPath; }
    assert.equal(shown[0], second.folder);
    assert.notEqual(second.folder, project, "the task's own, not the project's");
    await click(ui, taskTab(1));
    await waitFor(() => shell.task.n === 1);
    assert.deepEqual(await widths(), before, 'the tabs keep their widths');
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
    assert.equal(sam.get().view.getVisible(), false, "the second task's pages are hidden");
    assert.ok(sam.tabs.every((t) => !t.wc.isDestroyed()) && second.pty, 'and alive, its agent too');
    await waitFor(async () => (await ctx.termText()).includes(`agent: rc of ${project}\n`), 3000);
    assert.equal(savedWindows()[0].shown, 'project/1', 'the shown task kept for the next start');
    // What the second task's agent does reaches its tab (Claude Code's hooks); its captions do not show on the first's panes.
    const post = (event: string, input = {}) => new Promise((r) => http.request(`${hooksOf(second)}/${event}`, { method: 'POST' },
      (res) => { res.resume(); res.on('end', r); }).end(JSON.stringify(input)));
    const state = () => ui(`(() => { const s = ${taskTab(2)}.querySelector('.state'); return s.dataset.state + ' ' + s.querySelector('use').getAttribute('href') + ' ' + s.checkVisibility(); })()`);
    assert.equal(await state(), ' #i-done false', 'unknown: no icon');
    await post('prompt');
    await waitFor(async () => (await state()) === 'working #i-working true');
    await post('stop');
    await waitFor(async () => (await state()) === 'done #i-done true');
    // A permission the agent asks for: waiting.
    await post('waiting');
    await waitFor(async () => (await state()) === 'waiting #i-waiting true');
    assert.equal(await ui(`${taskTab(2)}.querySelector('.state').title`), 'The agent waits for you');
    // Interrupted by the human (Codex's Interrupt), or its session ended: unknown again; but a session ending after a
    // done turn (Codex: 30 minutes idle) leaves "come and see".
    await post('prompt');
    await post('interrupt');
    await waitFor(async () => (await state()) === ' #i-done false');
    // Esc in its terminal: Claude Code stops the turn and runs no hook, so working was shown on and on (found trying
    // voice commands, 2026-10-09). A done one stays done.
    const esc = () => ui(`kulisa.send('pty:in', { task: '${second.promptTarget().key}', data: '\\x1b' })`); // its agent's terminal
    for (const s of ['prompt', 'waiting']) {
      await post(s);
      await waitFor(async () => (await state()).startsWith(s === 'prompt' ? 'working' : 'waiting'));
      await esc();
      await waitFor(async () => (await state()) === ' #i-done false');
    }
    await post('stop');
    await esc();
    await sleep(300); // nothing to wait for: that it stays
    assert.equal(await state(), 'done #i-done true');
    await post('prompt');
    await post('session-end');
    await waitFor(async () => (await state()) === ' #i-done false');
    await post('stop');
    await post('session-end');
    await sleep(300); // nothing to wait for: that it stays
    assert.equal(await state(), 'done #i-done true');
    second.caption('sam-admin', 'from the second task');
    await sleep(200); // nothing to wait for: that it does not show
    assert.equal(await ui(`document.querySelector('.ptab[data-panel="${panel(shell, 'sam-admin')}"] .caption').textContent`), '');
    // Done says "come and see" until the human sees that task.
    await post('stop');
    await waitFor(async () => (await state()) === 'done #i-done true');
    await click(ui, taskTab(2));
    await waitFor(async () => shell.task === second && (await state()) === ' #i-done false');
    assert.equal(second.promptTarget().state, 'done', 'the agent is still done: only its tab says nothing');
    await click(ui, taskTab(1));
    await waitFor(async () => shell.task.n === 1 && (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer')
      && ui(`!document.documentElement.matches(':active-view-transition')`)); // its slide over before the next test watches one
  });

  test('tasks: switching slides the grid towards the other tab (a view transition); then the pages are live again', async ({ shell, ui }) => {
    // The transition's types (which way), and the grid's own slide as it runs: an animation of 0 s, as the CSS minifier
    // once made it, left the two grids' pictures one over the other; out past the window's margin, not lingering at its
    // edge (Grid.vue).
    const swap = (n: number) => ui(`(async () => {
      const start = document.startViewTransition.bind(document); let seen;
      document.startViewTransition = (o) => { const t = start(o); t.ready.then(() => { seen = { types: [...t.types],
        animations: document.getAnimations().filter((a) => ['::view-transition-old(grid)', '::view-transition-new(grid)'].includes(a.effect?.pseudoElement) && a.effect.getTiming().duration > 0)
          .map((a) => { const [from, to] = a.effect.getKeyframes(); return [a.animationName, from.translate === 'none' ? to.translate : from.translate, from.easing].join(' '); }).sort() }; }); return t; };
      await kulisa.invoke('task:show', 'project/${n}');
      await new Promise((r) => setTimeout(r, 800));
      delete document.startViewTransition; // the document's own again
      return seen;
    })()`);
    const live = async () => (await ui(`document.querySelectorAll('img.snapshot').length`)) === 0 && viewOn(shell, ui, 'sam-admin');
    let seen = await swap(2);
    assert.deepEqual(seen.types, ['next']); assert.deepEqual(seen.animations, ['grid-from-right calc(100% + 8px) cubic-bezier(0.4, 0, 0.2, 1)', 'grid-to-left calc(-100% - 8px) cubic-bezier(0.4, 0, 0.2, 1)'], 'it slides');
    await waitFor(live);
    // A page that draws no frame (busy, covered) holds the slide's start for a tenth of a second at most, its pane then
    // empty: half a second was felt after each click (2026-10-15).
    const tab = shell.profiles.get('sam-admin').get(), capture = tab.wc.capturePage;
    tab.wc.capturePage = () => new Promise(() => {});
    const t0 = Date.now(), pics = await shell.windows[0].pictures();
    tab.wc.capturePage = capture;
    assert.ok(Date.now() - t0 < 300, `pictures in ${Date.now() - t0} ms`);
    assert.ok(!pics['sam-admin'] && pics['elon-buyer'], 'the others taken');
    seen = await swap(1);
    assert.deepEqual(seen.types, ['previous']); assert.deepEqual(seen.animations, ['grid-from-left calc(-100% - 8px) cubic-bezier(0.4, 0, 0.2, 1)', 'grid-to-right calc(100% + 8px) cubic-bezier(0.4, 0, 0.2, 1)']);
    await waitFor(live);
    // A menu opened while the grid still slides keeps the pages under it pictures: the slide's end showed them over it.
    const sliding = () => ui(`document.documentElement.matches(':active-view-transition')`);
    await ui(`void kulisa.invoke('task:show', 'project/2')`);
    await waitFor(sliding);
    await ui(`document.getElementById('windowMenu').click()`);
    await waitFor(() => menuOpen(ui));
    await waitFor(async () => !(await sliding()));
    await sleep(100); // what the slide's end did, which must not show them
    assert.ok([...shell.profiles.values()].every((p) => !p.get().view.getVisible()), 'the pages stay under the menu');
    await closeMenu(ui);
    await waitFor(live);
    await swap(1);
    await waitFor(live);
  });
  test('tasks: Ctrl+Shift+2 shows the second, Ctrl+Shift+PgUp and PgDn the one before and after, from the terminal too', async ({ shell, ui }) => {
    const win = shell.win.webContents;
    const shown = async (n: number) => { await waitFor(async () => shell.task.n === n && !shell.windows[0].switching && (await ui(`!document.documentElement.classList.contains('loading')`))); };
    win.focus();
    await ui(`window.__term.focus()`);
    await waitFor(() => shell.windows[0].keyZone === 'terminal');
    press(win, '2', 'control', 'shift');
    await shown(2);
    press(win, 'PageUp', 'control', 'shift');
    await shown(1);
    press(win, 'PageDown', 'control', 'shift');
    await shown(2);
    await click(ui, taskTab(1));
    await shown(1);
  });
  test("tasks: more tabs than the bar holds: each keeps its name readable, a mouse's wheel scrolls them, a faded edge says some are past it, the shown one stays in sight; in the title bar the window is still dragged after +", async ({ shell, ui }) => {
    // Two tabs, the bar narrowed to less than they take: as thirty tabs in a window (found with 30 tasks, 2026-10-15:
    // every tab read "task…", the wheel did nothing, nothing said 17 were out of sight).
    const strip = `document.querySelector('#projectTabs')`;
    const bar = () => ui(`(() => { const s = ${strip}, a = s.querySelector('.active').getBoundingClientRect(), b = s.getBoundingClientRect();
      return { left: Math.round(s.scrollLeft), max: s.scrollWidth - s.clientWidth, fade: ['past-start', 'past-end'].filter((e) => s.classList.contains(e)).join(' '), inSight: a.left >= b.left && a.right <= b.right }; })()`);
    const frame = () => ui(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))`);
    assert.equal((await bar()).fade, '', 'all fit: no edge fades');
    await click(ui, taskTab(2));
    await waitFor(() => shell.task.n === 2 && !shell.windows[0].switching);
    await ui(`document.querySelector('#taskbar').style.maxWidth = '300px'`);
    await waitFor(async () => (await bar()).max > 0 && (await bar()).inSight);
    assert.deepEqual(await ui(`[...document.querySelectorAll('#projectTabs .tasktab')].map((t) => { const n = t.querySelector('.name'); return [t.getBoundingClientRect().width, n.scrollWidth <= n.clientWidth]; })`),
      [[160, true], [160, true]], 'at their narrowest, the names whole');
    let now = await bar();
    assert.deepEqual([now.left, now.fade], [now.max, 'past-start'], 'brought into view when the bar narrowed; only the edge with a tab past it fades');
    // The wheel turns up and down; the bar scrolls sideways.
    await waitFor(() => ui(`!document.documentElement.matches(':active-view-transition')`)); // the slide's pictures over the window take every event
    const b = await ui(`${strip}.getBoundingClientRect().toJSON()`), z = shell.win.webContents.getZoomFactor();
    const at = { x: Math.round((b.x + b.width / 2) * z), y: Math.round((b.y + b.height / 2) * z) };
    shell.win.webContents.sendInputEvent({ type: 'mouseWheel', ...at, deltaX: 0, deltaY: 400 }); // up: towards the start
    await waitFor(async () => (await bar()).left === 0);
    await waitFor(async () => (await bar()).fade === 'past-end'); // scrolled to the start: the other edge fades
    assert.equal((await bar()).inSight, false, 'the bar stays where the wheel took it');
    // In the title bar: the tabs give way before the space after + that drags the window (Chrome's), however many. The
    // tabs scrolled past the bar's edges are no-drag over the logo and that space too (Chromium does not clip them to
    // the bar) and the last region in the page wins: so both come after the bar, the logo shown first all the same (a
    // window not dragged by either, 2026-10-15: a real drag of the window is the OS's, out of a test's reach).
    await ui(`kulisa.invoke('bar:set', 'top')`);
    await waitFor(() => ui(`!!document.querySelector('#topbar #projectTabs')`));
    await ui(`document.querySelectorAll('#projectTabs .tasktab').forEach((t) => { t.style.minWidth = t.style.maxWidth = '1000px'; })`); // the bar drawn anew: tabs as wide as many
    await frame();
    assert.deepEqual(await ui(`(() => { const q = (s) => document.querySelector(s), r = (s) => q(s).getBoundingClientRect(), s = ${strip};
      const after = (s) => !!(q('#taskbar').compareDocumentPosition(q(s)) & Node.DOCUMENT_POSITION_FOLLOWING) && getComputedStyle(q(s)).appRegion;
      return [s.scrollWidth > s.clientWidth, r('#topbar .drag').width >= 40, r('#manageProjects').left - r('#newTask').right >= 40, after('#topbar .logo'), after('#topbar .drag'), r('.logo').right <= r('#taskbar').left]; })()`),
      [true, true, true, 'drag', 'drag', true], 'the tabs overflow, 40 px left to drag by; it and the logo after the bar in the page, the logo before it on screen');
    assert.ok((await bar()).inSight, 'the shown one in sight, the bar drawn anew there');
    await ui(`kulisa.invoke('bar:set', 'bottom')`);
    await waitFor(() => ui(`!document.querySelector('#topbar #projectTabs') && !!document.querySelector('#projectTabs')`));
    await click(ui, taskTab(1));
    await waitFor(() => shell.task.n === 1 && !shell.windows[0].switching);
  });
  test("tasks: a press on a tab not shown chooses it at once, as Chrome's; its task is shown when the button is let go or the tab starts being dragged, so it can be dragged", async ({ shell, ui }) => {
    // The slide that showing a task starts made Chromium drop a drag about to begin: a tab not shown could not be
    // dragged, its press only showed it (2026-10-15). One begun goes on through the slide.
    const wc = shell.win.webContents, z = wc.getZoomFactor();
    const press = async (type: 'mouseDown' | 'mouseUp', n: number) => {
      const b = await ui(`${taskTab(n)}.querySelector('.name').getBoundingClientRect().toJSON()`);
      wc.sendInputEvent({ type, x: Math.round((b.x + b.width / 2) * z), y: Math.round((b.y + b.height / 2) * z), button: 'left', clickCount: 1 });
    };
    const chosen = () => ui(`document.querySelector('#projectTabs .tasktab.active').dataset.task.split('/').pop()`);
    await waitFor(() => ui(`!document.documentElement.matches(':active-view-transition')`)); // the slide's pictures over the window take every event
    await press('mouseDown', 2);
    await waitFor(async () => (await chosen()) === '2');
    await sleep(200); // nothing to wait for: that it is not shown yet
    assert.equal(shell.task.n, 1, 'not shown while the button is down');
    await press('mouseUp', 2);
    await waitFor(() => shell.task.n === 2 && !shell.windows[0].switching);
    await waitFor(() => ui(`!document.documentElement.matches(':active-view-transition')`));
    // A drag begins: Chromium cancels the pointer (a real drag of a tab is the OS's, out of a test's reach).
    await press('mouseDown', 1);
    await waitFor(async () => (await chosen()) === '1');
    await ui(`dispatchEvent(new PointerEvent('pointercancel', { pointerType: 'mouse' }))`);
    await waitFor(() => shell.task.n === 1 && !shell.windows[0].switching);
    await press('mouseUp', 1);
    await ui(`document.activeElement.blur()`); // a real press leaves the keyboard on the tab (Reka's); the next tests' dialogs take it from nothing
  });
  test('tasks: × closes a task: its agent stops and its tabs close, all else stays; asked first only while its agent works; its group\'s menu opens it again, its conversation resumed', async (ctx) => {
    const { shell, ui, call } = ctx;
    const task = await newTask(ctx);
    assert.equal(task.n, 3);
    assert.equal(task.offset, 200);
    const transcript = path.join(root, 'task-3-transcript.jsonl');
    fs.writeFileSync(transcript, '');
    await reportSession(task, 's-3', transcript);
    assert.match(sessionStart(task, task.promptTarget(), { session_id: 's-3', transcript_path: transcript }).hookSpecificOutput.additionalContext,
      /task "task-3".*branch task-3.*plus 200/s, 'where it works, at the session start too');
    // Working: the human is asked, and may keep it.
    await hook(task, 'prompt');
    await waitFor(() => task.promptTarget()?.state === 'working');
    ctx.answer = false;
    await ui(`${taskTab(3)}.querySelector('.close').click()`);
    await waitFor(() => ctx.asked.length);
    assert.equal(ctx.asked.pop().message, 'Close the task task-3?');
    assert.ok(task.loaded && shell.task === task, 'kept open when the human says no');
    ctx.answer = true;
    await hook(task, 'stop'); // its turn over: closing asks nothing
    await waitFor(() => task.promptTarget()?.state === 'done');
    await call('profile_open', { profile: 'sam-admin' }); // a new task opens none by itself
    const sam = task.profiles.get('sam-admin');
    // A copy of the master made after it was signed in to: signed in.
    await call('browser_navigate', { profile: 'sam-admin', url: `${SITE}/app` });
    assert.equal(await who(ctx, 'sam-admin'), 'Signed in as master');
    await ui(`${taskTab(3)}.querySelector('.close').click()`);
    // Its agent and tabs gone.
    await waitFor(() => task.entry.closed && !task.pty && sam.tabs.every((t) => t.wc.isDestroyed()) && shell.task?.n === 2);
    assert.equal(ctx.asked.length, 0, 'not asked: nothing is lost');
    assert.ok(fs.existsSync(task.folder) && git(project, 'branch', '--list', 'task-3') && fs.existsSync(path.join(userData, 'projects', 'project', '3')), 'its code and data stay');
    assert.equal(tasksFile().list.find((e) => e.n === 3).closed, true);
    await waitFor(async () => JSON.stringify(await tabs(ui)) === '["task-1","Feature-X *"]');
    // The bar's + lists it under its project; opening it shows it again, its agent resuming the conversation.
    const rows = await plusMenu(ui);
    assert.deepEqual(rows.slice(rows.indexOf('project'), rows.indexOf('project') + 2), ['project', '  task-3']);
    await closeMenu(ui);
    // Its grid comes before its profiles have started (their cookies, tabs, automation: a site's answer away), its agent
    // after them, as it finds them ready; the window waited for them all, one after another (2026-10-15).
    const restore = shell.sessionCookies.restore;
    let started = false;
    shell.sessionCookies.restore = async (p) => { await sleep(1500); const n = await restore.call(shell.sessionCookies, p); started = true; return n; };
    try {
      await plusMenu(ui, 'project', 'task-3');
      await waitFor(() => shell.task === task && !shell.windows[0].switching); // its state sent to the window
      assert.equal(started, false, 'the grid before its profiles started');
      await waitFor(() => ui(`!!document.querySelector('.pane[data-profile="sam-admin"]') && !document.documentElement.classList.contains('loading')`));
      await waitFor(() => task.loaded && shell.pty, 10000);
      assert.equal(started, true, 'its agent after them');
    } finally { shell.sessionCookies.restore = restore; }
    ctx.watchPty(shell.pty);
    assert.equal(shell.resumedSession, 's-3');
    await waitFor(async () => JSON.stringify(await tabs(ui)) === '["task-1","Feature-X","task-3 *"]');
    assert.equal(tasksFile().list.find((e) => e.n === 3).closed, undefined);
  });

  test('tasks: Delete Task… asks first, saying what goes and any work not in main and not pushed; it goes with its branch, folder and profiles', async (ctx) => {
    const { shell, ui } = ctx;
    const empty = shell.task;
    const dir = path.join(userData, 'projects', 'project', '3');
    await rightClick(ui, `#projectTabs .tasktab[data-task="${empty.key}"] .name`);
    await menuRows(ui);
    await choose(ui, 'Delete Task…');
    await waitFor(() => !shell.current.tasks.has(3) && shell.task?.n === 2);
    const asked = ctx.asked.pop();
    assert.equal(asked.message, 'Delete the task task-3?', 'asked also without changes');
    assert.ok(asked.detail.startsWith('Deleted for good:') && asked.detail.includes(`${project}@task-3`) && asked.detail.includes('its branch task-3'));
    assert.ok(!asked.detail.includes('not in main'));
    await waitFor(() => !fs.existsSync(`${project}@task-3`) && !fs.existsSync(dir));
    // direnv's permission for its .envrc: no record of the task's folder left.
    const allow = path.join(process.env.XDG_DATA_HOME, 'direnv', 'allow');
    if (hasDirenv) assert.ok(!(fs.existsSync(allow) ? fs.readdirSync(allow) : []).some((f) => fs.readFileSync(path.join(allow, f), 'utf8').includes(`${project}@task-3`)));
    assert.ok(fs.existsSync(path.join(root, 'task-3-transcript.jsonl')), "the test's own agent: Kulisa knows only Claude Code's conversations (agents/)");
    assert.equal(git(project, 'branch', '--list', 'task-3'), '');
    await waitFor(async () => JSON.stringify(await tabs(ui)) === '["task-1","Feature-X *"]');

    // Renamed by the human (Rename… in its tab's menu), with a commit of its own and a file not committed.
    const spike = await newTask(ctx);
    await rightClick(ui, `#projectTabs .tasktab[data-task="${spike.key}"] .name`);
    await menuRows(ui);
    await choose(ui, 'Rename…');
    await waitFor(() => ui(`(document.getElementById('taskrename')?.dataset.state === 'open') && document.getElementById('taskname').value === '${spike.name}'
      && document.activeElement.id === 'taskname'`));
    // Typed, and Enter (with its character, as a keyboard sends it: the form is sent on it): the dialog's form is sent.
    const wc = shell.win.webContents;
    await wc.insertText('Spike');
    for (const type of ['keyDown', 'char', 'keyUp'] as const) wc.sendInputEvent({ type, keyCode: type === 'char' ? '\r' : 'Enter' });
    await waitFor(async () => spike.name === 'Spike' && !(await ui(`(document.getElementById('taskrename')?.dataset.state === 'open')`)));
    assert.equal(spike.entry.branch, 'spike');
    assert.equal(spike.folder, `${project}@task-${spike.n}`, 'the folder stays');
    fs.writeFileSync(path.join(spike.folder, 'idea.txt'), 'x');
    git(spike.folder, 'add', '-A'); git(spike.folder, 'commit', '-qm', 'idea');
    fs.writeFileSync(path.join(spike.folder, 'more.txt'), 'y');
    const remove = async (answer: boolean) => {
      ctx.answer = answer;
      await ui(`kulisa.invoke('task:delete', '${spike.key}')`);
      await waitFor(() => ctx.asked.length);
      return ctx.asked.pop();
    };
    let q = await remove(false);
    assert.equal(q.message, 'Delete the task Spike?');
    assert.match(q.detail, /Work not in main and not pushed, deleted with it:\n• 1 commit of its own and 1 uncommitted file/);
    assert.ok(shell.current.tasks.has(spike.n) && fs.existsSync(spike.folder), 'kept when the human says no');
    // Pushed, its commit is on the remote: only the file not committed is lost.
    const remote = path.join(root, 'remote.git');
    git(root, 'init', '-q', '--bare', remote);
    git(project, 'remote', 'add', 'backup', remote);
    git(spike.folder, 'push', '-q', 'backup', 'spike');
    q = await remove(false);
    assert.match(q.detail, /not pushed, deleted with it:\n• 1 uncommitted file$/);
    git(project, 'remote', 'remove', 'backup');
    await remove(true);
    await waitFor(() => !shell.current.tasks.has(spike.n) && shell.task?.n === 2);
    // The folder goes first (git worktree remove), then the branch.
    await waitFor(() => !fs.existsSync(spike.folder) && git(project, 'branch', '--list', 'spike') === '');
    assert.deepEqual(tasksFile().list.map((e) => e.name), ['task-1', 'Feature-X']);
  });

  // Settings (the title bar's gear) at the first agent: the agents in its tree (☰ had an Agents… row to them until
  // 2026-10-14: the author, agents are set up in Settings); it closes as any dialog.
  const openAgents = async (ui: UI, rows = 2) => {
    await ui(`document.getElementById('manageProjects').click()`);
    await waitFor(() => ui(`(document.getElementById('projects')?.dataset.state === 'open') && document.querySelectorAll('#pjlist [data-agent]').length === ${rows}`), 20000);
    await ui(`document.querySelector('#pjlist [data-agent]').click()`);
    await waitFor(() => ui(`!!document.querySelector('#pjlist [data-agent][aria-selected="true"]') && document.getElementById('agconfig').checkVisibility()`));
  };
  // An agent chosen in the tree, its page shown.
  const showAgent = async (ui: UI, id: string) => {
    await ui(`document.querySelector('#pjlist [data-agent="${id}"]').click()`);
    await waitFor(() => ui(`document.querySelector('#pjlist [data-agent="${id}"]').ariaSelected === 'true' && document.getElementById('agconfig').checkVisibility()`));
  };
  const closeAgents = async (ui: UI) => {
    await ui(`document.querySelector('#projects header .x').click()`);
    await waitFor(async () => !(await ui(`(document.getElementById('projects')?.dataset.state === 'open')`)));
  };
  const agentRow = (id: string, q: string) => `document.querySelector('#agentpage [data-agent="${id}"] ${q}')`;
  test('agents: Settings → Agents (not the terminal only): what is installed, installs the others; nothing is chosen or started', async (ctx) => {
    const { shell, ui } = ctx;
    const pty = shell.task.pty;
    await openAgents(ui);
    assert.equal(await ui(`document.querySelector('#pjlist [data-agent="fake"] kbd').textContent`), 'not installed');
    await showAgent(ui, 'fake');
    assert.equal(await ui(`document.querySelector('#agconfig .crumbs b').textContent`), 'Fake agent');
    assert.equal(await ui(`document.querySelector('#projects h2').textContent`), 'Settings');
    assert.equal(await ui(`document.getElementById('pjconfig').checkVisibility()`), false, "a project's page behind it");
    assert.equal(await ui(`document.querySelectorAll('#agentpage [role="radio"]').length`), 0, 'no choice to make');
    // The agents' marks (the terminal only's shown in choosing a task's agent).
    assert.ok(await ui(`!!document.querySelector('.sprite #i-agent-shell') && !!document.querySelector('.sprite #i-agent-claude') && !!document.querySelector('.sprite #i-agent-codex')`));
    assert.equal(await ui(`!!${agentRow('shell', '')}`), false, 'not the terminal only: nothing of it to set up');
    assert.equal(await ui(`document.querySelector('#agentpage [data-accounts="fake"] .empty')?.textContent`), 'No accounts yet.');
    assert.equal(await ui(`document.querySelector('#agentpage [data-accounts="fake"] .accountnew').disabled`), true, 'not installed: no account yet');
    assert.equal(await ui(agentRow('fake', '.status') + '.textContent'), 'Not installed');
    assert.equal(await ui(agentRow('fake', '.install') + '.hidden'), false);
    assert.match(await ui(agentRow('fake', '.install-line') + '.textContent'), /^Install runs Kulisa tests's installer: echo "installing the fake agent"/);
    assert.equal(shell.task.profiles.values().next().value.get().view.getVisible(), false, 'pages hidden under the dialog');
    // Installed with its maker's installer; what it said only under Details.
    await ui(agentRow('fake', '.install') + '.click()');
    await waitFor(async () => (await ui(agentRow('fake', '.status') + '.textContent')) === 'Installed', 10000);
    assert.match(await ui(`document.querySelector('#agentpage .progress').textContent`), /^Fake agent is installed\. Make an account of it below/);
    assert.equal(await ui(`document.querySelector('#agentpage .details .disclose').dataset.state`), 'closed', "the installer's own output only under Details");
    assert.match(await ui(`document.querySelector('#agentpage pre').textContent`), /installing the fake agent\s+done/);
    assert.doesNotMatch(await ui(`document.querySelector('#agentpage pre').textContent`), /\x1b/, 'no terminal codes: colors, links');
    assert.equal(await ui(`document.querySelector('#agentpage [data-accounts="fake"] .accountnew').disabled`), false);
    await closeAgents(ui);
    assert.equal(shell.task.pty, pty, 'the agent goes on');
  });

  test("tasks: an agent's tab closes after a question, always (Cancel keeps it); the last terminal closed folds the island to its +, which opens one again; Ctrl+` there opens the task's agent, a new conversation", async (ctx) => {
    const { shell, ui } = ctx;
    const task = await newTask(ctx), agent = task.promptTarget();
    const folded = () => ui(`!!document.querySelector('.terminals.folded') && document.querySelector('.termtabs').hidden`);
    // The island's group (its content is laid over it: dockview's renderer 'always').
    const island = () => ui(`(() => { const r = document.querySelector('.termtabs').closest('.dv-groupview').getBoundingClientRect(); return { width: Math.round(r.width), height: Math.round(r.height) }; })()`);
    const saved = () => JSON.parse(fs.readFileSync(pfile('terminals.json', task.n), 'utf8'));
    const conversations = () => JSON.parse(fs.readFileSync(pfile('agent.json', task.n), 'utf8')).conversations;
    await waitFor(() => ui(`!!document.querySelector('.termtab')`));
    const before = await island();
    // × on an agent's tab asks, whatever it is doing; Cancel keeps it.
    ctx.answer = false;
    await ui(`document.querySelector('.termtab .close').click()`);
    await waitFor(() => ctx.asked.length);
    const q = ctx.asked.pop();
    assert.equal(q.message, 'Close bash?');
    assert.match(q.detail, /^bash stops\. Its conversation stays in the task's history, where any agent of the task can read it\.$/);
    assert.equal(task.terminals.get(agent.id), agent, 'kept when the human says no');
    ctx.answer = true;
    await ui(`document.querySelector('.termtab .close').click()`);
    await waitFor(() => task.terminals.size === 0);
    ctx.asked.length = 0;
    // Alone in the grid (no profile open): the +'s rows as big buttons in its middle, whatever the arrangement.
    await waitFor(folded);
    assert.deepEqual(saved(), { front: null, list: [] });
    assert.equal(conversations()[0].terminal, undefined);
    assert.ok(conversations()[0].to, 'its conversation closed, kept for the history');
    // Its + from the middle of the island (x), and from where a strip's middle would be.
    const plus = () => ui(`(() => { const b = document.getElementById('termUnfold').getBoundingClientRect(), r = document.querySelector('.terminals').getBoundingClientRect();
      return { x: Math.round(b.x + b.width / 2 - (r.x + r.width / 2)), middle: Math.round(b.y + b.height / 2 - (r.y + r.height / 2)) }; })()`);
    const middle = async () => { const p = await plus(); return Math.abs(p.x) <= 1 && Math.abs(p.middle) <= 1; };
    const PROFILES = ['Sam.admin', 'Elon.buyer', 'Dora']; // the project's, all closed
    // The island alone fills the grid: dockview's room, the closed profiles' tiles no longer over it.
    const room = () => ui(`(() => { const r = document.getElementById('grid').getBoundingClientRect(); return { width: Math.round(r.width), height: Math.round(r.height) }; })()`);
    const launch = () => ui(`(() => { const l = document.querySelector('.terminals .launch'), r = document.querySelector('.terminals').getBoundingClientRect();
      if (!l) return null; const b = l.getBoundingClientRect(), ys = [...l.querySelectorAll('.agents .launcher')].map((x) => Math.round(x.getBoundingClientRect().y));
      return { labels: [...l.querySelectorAll('.agents .name')].map((x) => x.textContent), oneLine: new Set(ys).size === 1,
        profiles: [...l.querySelectorAll('.profiles .name')].map((x) => x.textContent),
        middle: Math.abs(b.y + b.height / 2 - (r.y + r.height / 2)) <= 1, strip: !!document.querySelector('.terminals .strip'),
        empty: getComputedStyle(document.querySelector('.termtabs').closest('.dv-groupview').querySelector('.dv-content-container')).backgroundColor }; })()`);
    for (const preset of ['grid', 'focus', 'columns']) {
      await ui(`window.__layoutPreset('${preset}')`);
      await waitFor(async () => JSON.stringify(await island()) === JSON.stringify(await room()) && (await launch())?.middle, 3000);
      assert.deepEqual(await launch(), { labels: ['Terminal'], oneLine: true, profiles: PROFILES, middle: true, strip: false, empty: 'rgba(0, 0, 0, 0)' });
    }
    // One opens what its row in + does: a terminal; closed, the buttons are back.
    await ui(`document.querySelector('.launcher').click()`);
    await waitFor(async () => task.terminals.size === 1 && !(await folded()));
    // A terminal and no profile: the profiles' room a row of tiles over it, one for each; one opens its profile, and
    // the row goes.
    const tiles = () => ui(`(() => { const s = document.getElementById('closedprofiles');
      return s && { names: [...s.querySelectorAll('.name')].map((x) => x.textContent),
        above: s.getBoundingClientRect().bottom <= document.querySelector('.terminals').getBoundingClientRect().top }; })()`);
    await waitFor(tiles);
    assert.deepEqual(await tiles(), { names: PROFILES, above: true });
    await ui(`document.querySelector('#closedprofiles [data-profile="sam-admin"]').click()`);
    await waitFor(async () => task.profiles.has('sam-admin') && !(await tiles()));
    await ctx.call('profile_close', { profile: 'sam-admin' });
    await waitFor(tiles);
    await ui(`document.querySelector('.termtab .close').click()`);
    await waitFor(async () => task.terminals.size === 0 && !!(await launch()) && !(await tiles()));
    // With a profile open (its tile among the big buttons): folded to a strip of its +, along the grid's height (the
    // island is under the grid); kept so.
    await ui(`document.querySelector('.launch .profiles [data-profile="sam-admin"]').click()`);
    await waitFor(async () => (await island()).height <= 40 && (await middle()));
    assert.equal((await island()).width, before.width);
    // Its + opens a terminal: the island unfolds.
    await ui(`document.getElementById('termUnfold').click()`);
    assert.deepEqual(await menuRows(ui), ['Terminal']);
    await choose(ui, 'Terminal');
    await waitFor(async () => task.terminals.size === 1 && !(await folded()) && (await island()).height >= 150);
    // A shell closes without a question; folded again.
    await ui(`document.querySelector('.termtab .close').click()`);
    await waitFor(async () => task.terminals.size === 0 && (await folded()) && (await island()).height <= 40);
    assert.equal(ctx.asked.length, 0);
    // Ctrl+` there: the task's agent, a new conversation.
    await focusWindow(shell.win, ui);
    press(shell.win.webContents, '`', 'control');
    await waitFor(() => task.promptTarget()?.pty, 20000);
    assert.equal(conversations().length, 2);
    assert.deepEqual([conversations()[1].agent, conversations()[1].terminal], ['custom', task.promptTarget().id]);
    // Left closed for the restart phase (restart-tasks.ts).
    await ui(`${taskTab(task.n)}.querySelector('.close').click()`);
    await waitFor(() => task.entry.closed && !task.loaded && shell.task.n === 2);
    assert.equal(ctx.asked.length, 0);
  });

  test('agents: once installed, the Agents window shows its version and where it is', async (ctx) => {
    const { ui } = ctx;
    await openAgents(ui);
    assert.equal(await ui(agentRow('fake', '.status') + '.textContent'), 'Installed');
    assert.equal(await ui(agentRow('fake', '.install') + '.hidden'), true);
    // Shown as the human's home folder shortened to ~, as a test folder inside it is (the CI's runner.temp).
    const bin = path.join(root, 'bin', 'kulisa-fake-agent'), home = os.homedir() + path.sep;
    assert.equal(await ui(agentRow('fake', '.where') + '.textContent'),
      `1.2.3 · ${bin.startsWith(home) ? '~' + bin.slice(home.length - 1) : bin} · not on your PATH: Kulisa runs it from here`);
    assert.equal(await ui(agentRow('fake', '.install-line') + '.textContent'), '');
    await showAgent(ui, 'fake');
    // A click on the row already shown keeps it chosen: Reka's Tree toggled it off, its page still shown (seen on
    // GitHub's runner, 2026-10-12, where the tests reach this row already chosen).
    await showAgent(ui, 'fake');
    await ctx.shell.screenshot(path.join(root, 'agents.png'));
    await closeAgents(ui);
  });
  test('agents: the list comes at once with what the last look found, then looks again: an agent removed meanwhile shows so', async (ctx) => {
    const { ui } = ctx;
    const bin = path.join(root, 'bin', 'kulisa-fake-agent'), away = `${bin}.away`;
    const fake = (cached: boolean) => ui(`kulisa.invoke('agents:list', { details: true, cached: ${cached} }).then((r) => r.list?.find((a) => a.id === 'fake'))`);
    assert.equal((await fake(true)).version, '1.2.3', "the last look's, nothing run");
    fs.renameSync(bin, away);
    try {
      assert.equal((await fake(true)).installed, true, 'not looked for again yet');
      await openAgents(ui);
      await waitFor(() => ui(agentRow('fake', '.status') + `.textContent === 'Not installed'`));
      assert.equal((await fake(true)).installed, false, 'what the window looked for again is kept');
      await closeAgents(ui);
    } finally {
      fs.renameSync(away, bin);
      await fake(false);
    }
  });

  // The project's settings (Project Settings… in its submenu), with its agents.
  const projectSettings = async (ui: UI, id = 'project') => {
    await projectMenu(ui, 'Project Settings…', `#projectTabs [data-project="${id}"] .name`);
    await waitFor(() => ui(`(document.getElementById('projects')?.dataset.state === 'open') && !!document.getElementById('npagentsrow')`));
  };
  // A new profile on a project's page: + → New Profile…, its name typed in place, Create.
  const newProfileHere = async (ui: UI, name: string) => {
    await ui(`document.getElementById('npprofileadd').click()`);
    await choose(ui, 'New Profile…');
    await waitFor(() => ui(`document.activeElement?.id === 'npnewprofile'`));
    await ui(`(() => { const n = document.getElementById('npnewprofile'); n.value = ${JSON.stringify(name)}; n.dispatchEvent(new Event('input')); document.getElementById('npprofilenew').click(); })()`);
  };
  // A list's row selected (a click), then a button of its toolbar acting on it (− removes, ★ makes it the default).
  const onRow = async (ui: UI, row: string, button: string | null, buttonAt = `#${button}`) => {
    await ui(`document.querySelector(${JSON.stringify(row)}).click()`);
    await waitFor(() => ui(`document.querySelector(${JSON.stringify(row)})?.ariaSelected === 'true' && !document.querySelector(${JSON.stringify(buttonAt)}).disabled`));
    await ui(`document.querySelector(${JSON.stringify(buttonAt)}).click()`);
  };
  // The page shown: its name in place at its top.
  const pageOf = (name: string) => `(document.getElementById('pjname')?.value === ${JSON.stringify(name)} && !!document.getElementById('pjhead'))`;
  const closeSettings = async (ui: UI) => {
    await ui(`document.querySelector('#projects .x').click()`);
    await waitFor(async () => !(await ui(`(document.getElementById('projects')?.dataset.state === 'open')`)));
  };
  // New Account… of the fake agent: its own sign-in starts at once; resolves with its terminal's pty (the sign-in
  // waiting for the human), once its page is open in the user's browser.
  const signIn = async (ctx: Ctx) => {
    const { shell, ui } = ctx;
    shell.signins.clear();
    await ui(`document.getElementById('npagentadd').click()`);
    assert.deepEqual((await menuRows(ui)).slice(-2), ['# New Account', 'Fake agent…'], 'the agents that have accounts, after the ones to add');
    await choose(ui, 'Fake agent…');
    await waitFor(() => shell.signins.size);
    const p = [...shell.signins.values()][0];
    // Its page opened: it waits for the email (a pty keeps what is typed until the agent reads it).
    const want = ++opens;
    await waitFor(() => opened().length === want);
    assert.equal(opened().at(-1), `${SITE}/app?signin`);
    return p;
  };
  let opens = 0;
  const opened = () => { try { return fs.readFileSync(path.join(root, 'opened'), 'utf8').trim().split('\n'); } catch { return []; } };
  const accountDir = (id: string) => path.join(userData, 'agents', id);
  const logouts = () => { try { return fs.readFileSync(path.join(root, 'logouts'), 'utf8').trim().split('\n'); } catch { return []; } };
  test("agents: a new account is made in the project's settings: the agent's own sign-in at once, in a terminal there (under Details), its page in the user's own browser (Google refuses an embedded one); named by the email it signed in to; a task runs it with its folder, over a folder the project's environment sets", async (ctx) => {
    const { ui } = ctx;
    await projectSettings(ui);
    const windows = electron.BrowserWindow.getAllWindows().length;
    let p = await signIn(ctx);
    const dir = accountDir('fake-1');
    assert.ok(fs.existsSync(dir), 'its folder, a fixed id: never renamed');
    assert.ok(await ui(`!!document.querySelector('#npsigninterm .xterm') && !document.getElementById('npsigninterm').checkVisibility()`),
      'the sign-in in a terminal of the dialog, under Details: what it says the window shows');
    // Its page in the user's browser (the BROWSER Kulisa was started with), not a window of Kulisa's.
    assert.equal(electron.BrowserWindow.getAllWindows().length, windows, 'no window of its own');
    p.write('Work@Shop.com\r');
    await waitFor(() => ui(`!!document.querySelector('#npagents [data-agent="fake-1"]') && !document.getElementById('npsignin')`));
    assert.equal(await ui(`document.querySelector('#npagents [data-agent="fake-1"] .label').textContent`), 'Fake agent · work@shop.com');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(userData, 'agents.json'), 'utf8')),
      { next: 2, list: [{ id: 'fake-1', agent: 'fake', email: 'work@shop.com', folder: 'fake-1', projects: ['project'] }] });
    // Signed in to an email it has already: that account, the new folder signed out and gone.
    p = await signIn(ctx);
    p.write('work@shop.com\r');
    await waitFor(async () => /is in the project already/.test(await ui(`document.getElementById('npsigninerror').textContent`)));
    assert.ok(!fs.existsSync(accountDir('fake-2')) && logouts().includes(accountDir('fake-2')));
    await ui(`document.getElementById('npsignincancel').click()`);
    await waitFor(() => ui(`!document.getElementById('npsignin')`));
    // Cancelled: nothing kept; + adds again (not while a sign-in is shown).
    p = await signIn(ctx);
    assert.equal(await ui(`document.getElementById('npagentadd').disabled`), true);
    await ui(`document.getElementById('npsignincancel').click()`);
    await waitFor(async () => !fs.existsSync(accountDir('fake-3')) && !(await ui(`!!document.getElementById('npsignin') || document.getElementById('npagentadd').disabled`)));
    // Not signed in (the agent's sign-in ended without it): said so, Try Again.
    p = await signIn(ctx);
    p.write('\r');
    await waitFor(async () => /Not signed in/.test(await ui(`document.getElementById('npsigninerror').textContent`)));
    assert.equal(await ui(`document.getElementById('npsigninstart').hidden`), false);
    assert.ok(await ui(`document.getElementById('npsigninterm').checkVisibility() && !!document.querySelector('#npsigninterm .xterm')`),
      'its Details open by itself, with what the agent said');
    assert.ok(!fs.existsSync(accountDir('fake-4')));
    await ui(`document.getElementById('npsignincancel').click()`);
    await closeSettings(ui);
    // A task runs it: the agent with its folder in its variable, though the project's environment set it to another
    // (run.ts: its shell's startup, as a project's .envrc). Choosing a task's agent lists the project's accounts.
    const task = await newTask(ctx);
    await waitFor(() => task.promptTarget()?.agent.id === 'fake-1', 20000); // the project's default: its one account
    ctx.watchPty(task.pty);
    await waitFor(async () => (await ctx.termText()).includes(`config [${dir}]`));
    // Its shell gets none of direnv's state from where Kulisa was started: the user's direnv hook took the task's folder
    // for a folder left, undid that .envrc's changes and with them the account's variable, and the agent ran with the
    // user's own sign-in (2026-10-11, Kulisa started from the repository's folder).
    if (process.platform === 'linux') {
      assert.deepEqual(fs.readFileSync(`/proc/${task.pty.pid}/environ`, 'utf8').split('\0').filter((v) => v.startsWith('DIRENV_')), []);
    }
    // Change agent… (the terminal's menu) hands the task to one of the project's accounts.
    await rightClick(ui, '.term:not([hidden])');
    await menuRows(ui);
    await choose(ui, 'Change agent…');
    await waitFor(async () => JSON.stringify(await ui(`[...document.querySelectorAll('#handover .choose .label')].map((e) => e.textContent)`)) === '["Fake agent · work@shop.com"]');
    await ui(`document.querySelector('#handover .x').click()`);
    await waitFor(() => ui(`!document.getElementById('handover')`));
  });
  test("language: one for every agent (☰ → Language): written into the agents' own setting in each account's folder, at an agent's start and when chosen, never into the human's own", async ({ ui, shell }) => {
    const own = (id: string) => path.join(accountDir(id), 'settings.json');
    const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
    assert.deepEqual(read(own('fake-1')), { language: 'English' }, 'at its start (the test before): English, the default');
    await ui(`document.getElementById('windowMenu').click()`);
    assert.ok((await menuRows(ui)).includes('Language'));
    const row = `${MENU}.querySelector('.languagerow')`;
    assert.equal(await ui(`${row}.querySelector('.value').textContent`), 'English');
    assert.match(await ui(`${row}.title`), /^The language you speak with the agents\. Fake agent dictates and answers in it, and may write code comments in it too: your project's CLAUDE\.md or AGENTS\.md decides that\./);
    await ui(`${row}.click()`);
    await waitFor(() => ui(`!!document.querySelector('.menu.languages[data-state="open"]')`));
    const system = await ui(`navigator.language.split('-')[0]`);
    assert.equal(await ui(`document.querySelector('.menu.languages [data-language]').dataset.language`), system, "the system's first");
    await ui(`document.querySelector('.menu.languages [data-language="ru"]').click()`);
    await waitFor(() => read(path.join(userData, 'settings.json')).language === 'ru');
    await waitFor(() => read(own('fake-1')).language === 'Russian');
    assert.ok(!fs.existsSync(path.join(root, 'fake-config', 'settings.json')), "the human's own folder untouched");
    await closeMenu(ui);
    assert.ok(refused(shell.setLanguage('xx')), 'only one an agent takes');
    shell.setLanguage('en');
    assert.equal(read(own('fake-1')).language, 'English');
  });

  test("agents: an account lives until deleted in Settings → Agents: let go by its project at once, kept; not deleted while a task runs it; deleted after a question, signed out, with its folder; one made there is in no project", async (ctx) => {
    const { shell, ui } = ctx;
    const task = shell.task, dir = accountDir('fake-1');
    const row = (id: string) => `document.querySelector('#agentpage [data-account="${id}"]')`;
    // An account deleted: its row selected, then − over its list.
    const deleteAccount = (id: string) => onRow(ui, `#agentpage [data-account="${id}"]`, null, `#agentpage .list:has([data-account="${id}"]) .accountdel`);
    // × in the project lets go of it at once, nothing asked; the account stays, and the task running it keeps it.
    await projectSettings(ui);
    await onRow(ui, '#npagents [data-agent="fake-1"]', 'npagentdel');
    await waitFor(() => ui(`!document.querySelector('#npagents [data-agent="fake-1"]')`));
    assert.equal(ctx.asked.length, 0);
    assert.deepEqual(shell.accounts.find('fake-1').projects, [], 'kept, in no project');
    assert.equal(task.promptTarget().agent.id, 'fake-1');
    assert.ok(fs.existsSync(dir));
    // Its agent's page: the account in no project; Delete refused while a task runs it.
    await showAgent(ui, 'fake');
    await waitFor(() => ui(`!!${row('fake-1')}`));
    assert.equal(await ui(`${row('fake-1')}.querySelector('small').textContent`), 'in no project');
    await deleteAccount('fake-1');
    const said = () => ui(`document.getElementById('agentpageerror').textContent`);
    await waitFor(async () => !!(await said()));
    assert.match(await said(), new RegExp(`^Tasks run it: ${task.entry.name} \\(project\\)`));
    assert.equal(ctx.asked.length, 0);
    await closeSettings(ui);
    await ui(`kulisa.invoke('task:delete', '${task.key}')`);
    await waitFor(() => !shell.current.tasks.has(task.n) && shell.task?.n === 2);
    ctx.asked.length = 0;
    // Deleted after a question; no: kept.
    await openAgents(ui);
    await waitFor(() => ui(`!!${row('fake-1')}`));
    ctx.answer = false;
    await deleteAccount('fake-1');
    await waitFor(() => ctx.asked.length);
    assert.equal(ctx.asked.pop().message, 'Delete the account Fake agent · work@shop.com?');
    assert.ok(fs.existsSync(dir), 'kept when the human says no');
    ctx.answer = true;
    await deleteAccount('fake-1');
    await waitFor(async () => !fs.existsSync(dir) && !(await ui(`!!${row('fake-1')}`)));
    assert.ok(logouts().includes(dir), 'signed out first, with its agent\'s own command');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(userData, 'agents.json'), 'utf8')), { next: 5, list: [] });
    ctx.asked.length = 0;
    // New Account… there (the + beside Agents in the tree, an agent): signed in on its page, in no project; a project's
    // Add Agent… takes it.
    shell.signins.clear();
    await click(ui, `document.querySelector('#pjlist [data-agent]:not([data-agent="fake"])')`); // another agent's page shown first
    await click(ui, `document.getElementById('agentnew')`);
    await menuRows(ui);
    await choose(ui, 'Fake agent…');
    await waitFor(() => ui(`document.querySelector('#pjlist [data-agent="fake"]').ariaSelected === 'true'`));
    await waitFor(() => shell.signins.size);
    const p = [...shell.signins.values()][0];
    p.write('home@shop.com\r'); // kept by the pty until the agent reads it
    await waitFor(() => ui(`!!${row('fake-5')} && !document.getElementById('npsignin')`));
    assert.equal(await ui(`${row('fake-5')}.querySelector('.label').textContent`), 'home@shop.com');
    assert.deepEqual(shell.accounts.find('fake-5').projects, []);
    await click(ui, `document.querySelector('#pjlist [data-project="project"]')`);
    await waitFor(() => ui(`document.getElementById('pjconfig').checkVisibility() && !document.getElementById('npagentadd').disabled`));
    // The accounts to add are asked for again as the tab is shown: the menu may open before they come.
    await waitFor(async () => {
      await ui(`document.getElementById('npagentadd').click()`);
      const rows = await menuRows(ui);
      await closeMenu(ui);
      return rows.includes('Fake agent · home@shop.com');
    });
    // In no project and no task: deleted at once after the question.
    await showAgent(ui, 'fake');
    await waitFor(() => ui(`!!${row('fake-5')}`));
    await deleteAccount('fake-5');
    await waitFor(() => !fs.existsSync(accountDir('fake-5')) && !shell.accounts.find('fake-5'));
    ctx.asked.length = 0;
    await closeAgents(ui);
  });

  // Last in phase 1: task-1 is shown, Feature-X waits in the bar and task-5 is closed, for the restart phase.
  test('tasks: × on the last open task of a project lets the project go, nothing asked: the empty window; a task of it opens it again', async (ctx) => {
    const { shell, ui } = ctx;
    const first = shell.current.tasks.get(1), second = shell.current.tasks.get(2);
    await ui(`${taskTab(1)}.querySelector('.close').click()`);
    await waitFor(() => first.entry.closed && !first.loaded && shell.task === second);
    await waitFor(async () => JSON.stringify(await tabs(ui)) === '["Feature-X *"]');
    assert.equal(ctx.asked.length, 0);
    await ui(`${taskTab(2)}.querySelector('.close').click()`);
    // The project goes once its task is unloaded: its agent stopped, each profile's sign-ins written out and its
    // tabs closed. On the runner, with the other project running beside it, that took over 5 s now and then (2026-10-12).
    await waitFor(() => shell.task === null && !shell.current && !shell.open.has('project'), 15000);
    assert.equal(ctx.asked.length, 0, 'no agent works: nothing asked');
    assert.ok(second.profiles.size === 0 && !second.pty, 'every task of the project stopped');
    assert.deepEqual(tasksFile().list.map((e) => [e.n, !!e.closed]), [[1, true], [2, true], [5, true]]);
    await waitFor(() => ui(`document.documentElement.classList.contains('noproject')`));
    // The empty window: an empty island in the grid's place with New Task and New Project…; the bar with no islands but +.
    assert.equal(await ui(`getComputedStyle(document.getElementById('empty')).display`), 'grid');
    assert.equal(await ui(`document.querySelector('#empty h2').textContent`), 'No task is open');
    assert.ok(await ui(`(() => { const w = document.getElementById('empty'), s = getComputedStyle(w);
      return w.getBoundingClientRect().height > innerHeight * 0.7 && s.backgroundColor === (() => { const i = document.body.appendChild(document.createElement('i')); i.style.background = 'var(--island)';
        const c = getComputedStyle(i).backgroundColor; i.remove(); return c; })(); })() // an island's, as the dialogs'`));
    assert.equal(await ui(`document.getElementById('newTask').checkVisibility()`), true, '+ there');
    assert.deepEqual(await projectTabs(ui), [], 'no tab');
    assert.equal(await ui(`document.documentElement.style.getPropertyValue('--project')`), '', "no project's color");
    assert.equal(shell.win.getTitle(), 'Kulisa');
    assert.deepEqual(savedWindows(), [{ tabs: [], shown: null }], 'the window opens so next time');
    // The empty window's New Task opens the bar's + menu: every project with its icon in its color, as on its tasks'
    // tabs in the bar, and its closed tasks set in under it, the one closed last first (all are closed here); New Project… last.
    await ui(`document.getElementById('emptynewtask').click()`);
    const rows = await menuRows(ui);
    assert.deepEqual(await ui(`[...document.querySelectorAll('.menu[data-state="open"] .item:not(.inset) .picon')].map((i) => i.querySelector('use')?.getAttribute('href') ?? null)`),
      shell.projects().map((p) => (p.favicon ? null : '#i-logo')), 'its favicon, else the curtain');
    const byClosing = tasksFile().list.filter((e) => e.closed).sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0)).map((e) => `  ${e.name}`);
    assert.deepEqual(rows.slice(rows.indexOf('project') + 1, rows.indexOf('project') + 1 + byClosing.length), byClosing);
    assert.equal(byClosing[0], '  Feature-X');
    assert.deepEqual(rows.slice(0, 1).concat(rows.slice(-2)), ['# New Task of', '-', 'New Project…']);
    await closeMenu(ui);
    // A closed task of it opens it again, as that task's tab; the others wait in the +, the one closed last first.
    await plusMenu(ui, 'project', 'Feature-X');
    await waitFor(() => shell.task?.n === 2 && shell.task.loaded && shell.pty);
    ctx.watchPty(shell.pty);
    await waitFor(() => ui(`!document.documentElement.classList.contains('noproject') && !document.documentElement.classList.contains('loading')`));
    await waitFor(async () => JSON.stringify(await tabs(ui)) === '["Feature-X *"]');
    const plus = await plusMenu(ui);
    assert.deepEqual(plus.slice(plus.indexOf('project'), plus.indexOf('project') + 3), ['project', '  task-1', '  task-5'], 'the one closed last first');
    await closeMenu(ui);
    await plusMenu(ui, 'project', 'task-1');
    await waitFor(() => shell.task?.n === 1 && shell.task.loaded && shell.pty);
    ctx.watchPty(shell.pty);
    await waitFor(async () => JSON.stringify(await tabs(ui)) === '["Feature-X","task-1 *"]'); // a tab opens at the end
    assert.equal(shell.current.tasks.get(2).loaded, true, 'the other open one stays loaded');
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
  });

  test('tasks: a double click on a task\'s tab is its Rename…', async (ctx) => {
    const { ui } = ctx;
    const tab = `document.querySelector('#projectTabs .tasktab:not(.active) .name')`;
    const name = await ui(`${tab}.textContent`);
    await ui(`${tab}.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`);
    await waitFor(() => ui(`(document.getElementById('taskrename')?.dataset.state === 'open') && document.getElementById('taskname').value === ${JSON.stringify(name)}`));
    press(ctx.shell.win.webContents, 'Escape');
    await waitFor(async () => !(await ui(`document.getElementById('taskrename')?.dataset.state === 'open'`)));
  });

  test('the empty window: Close All Tasks in the project\'s submenu; links in ☰ open in the browser; at the first start the manager on New Project; New Project… asks where its folder goes', async (ctx) => {
    const { shell, ui } = ctx;
    assert.deepEqual((await groupMenu(ui, 'Close All Tasks')).slice(-2), ['-', 'Close All Tasks']);
    await waitFor(() => shell.task === null && !shell.current);
    await waitFor(() => ui(`document.documentElement.classList.contains('noproject')`));
    await ui(`document.getElementById('windowMenu').click()`);
    const links = await menuRows(ui);
    assert.deepEqual(links.slice(links.indexOf('Documentation'), links.indexOf('Documentation') + 3), ['Documentation', 'GitHub', 'Report an issue']);
    const openExternal = electron.shell.openExternal, opened: string[] = [];
    electron.shell.openExternal = async (url) => { opened.push(url); };
    try {
      await choose(ui, 'Documentation');
      await waitFor(() => opened.length === 1);
    } finally { electron.shell.openExternal = openExternal; }
    assert.equal(opened[0], 'https://kulisa.app/docs', 'the user guide on the website');
    assert.ok(await ui(`location.protocol === 'file:' && !!document.getElementById('empty')`), 'the window stays on its page');
    // The first start (no project yet): New Project opens by itself; not with projects there.
    shell.firstStart(shell.windows[0]);
    assert.equal(await ui(`document.getElementById('newproject')?.dataset.state === 'open'`), false, 'projects there: nothing opens');
    const projectsOf = shell.store.projects;
    shell.store.projects = () => [];
    try { shell.firstStart(shell.windows[0]); } finally { shell.store.projects = projectsOf; }
    await waitFor(() => ui(`document.getElementById('newproject')?.dataset.state === 'open' && !!document.getElementById('nplocationrow')`));
    await ui(`document.querySelector('#newproject .x').click()`);
    await waitFor(async () => !(await ui(`(document.getElementById('newproject')?.dataset.state === 'open')`)));
    assert.equal(await ui(`document.getElementById('projects')?.dataset.state === 'open'`), false, 'not from Settings: nothing after it');

    // New Project…: a name and where its folder goes, the home folder unless another is chosen; git on by default.
    await ui(`document.getElementById('emptynew').click()`);
    await waitFor(() => ui(`(document.getElementById('newproject')?.dataset.state === 'open')`));
    assert.equal(await ui(`document.getElementById('nplocation').value`), path.join(root, 'Kulisa'), "every new project's place (~/Kulisa; the tests' own here)");
    // Not its color or icon (its site's favicon and its hue, else the curtain in the next free color: nothing to
    // choose, the author, 2026-10-12), no agent: its accounts are made on its page, which Create goes on to.
    assert.equal(await ui(`!!document.getElementById('npcolors') || !!document.getElementById('npicons')`), false);
    const color = shell.store.nextColor();
    assert.equal(await ui(`!!document.getElementById('npagent')`), false);
    assert.equal(await ui(`document.getElementById('npgit').getAttribute('aria-checked')`), 'true');
    const made = path.join(root, 'made');
    fs.mkdirSync(path.join(made, 'Taken'), { recursive: true });
    fs.writeFileSync(path.join(made, 'Taken', 'notes.txt'), '');
    const showOpenDialog = electron.dialog.showOpenDialog;
    electron.dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [made] });
    try {
      await ui(`document.getElementById('npbrowse').click()`);
      await waitFor(async () => (await ui(`document.getElementById('nplocation').value`)) === made);
    } finally { electron.dialog.showOpenDialog = showOpenDialog; }
    const named = (n: string) => ui(`(() => { const i = document.getElementById('npname'); i.value = ${JSON.stringify(n)}; i.dispatchEvent(new Event('input')); })()`);
    // A folder there already would be taken as it is (the form says so as it is typed); a file is refused.
    await named('Taken');
    await waitFor(async () => (await ui(`document.getElementById('npwhere').textContent`)) === `${path.join(made, 'Taken')} is there already: the project takes it as it is, its files kept`);
    assert.equal(await ui(`document.getElementById('npgitrow').hidden`), false, 'Create Git repository: it is none');
    fs.writeFileSync(path.join(made, 'note'), '');
    await named('note');
    await ui(`document.getElementById('npform').requestSubmit()`);
    await waitFor(async () => /is a file, not a folder/.test(await ui(`document.getElementById('nperror').textContent`)));
    // An error is text to copy and search for: it can be selected (the window's other words cannot).
    assert.deepEqual(await ui(`(() => { const e = document.getElementById('nperror'); getSelection().selectAllChildren(e);
      return [getComputedStyle(e).userSelect, getSelection().toString() === e.textContent, getComputedStyle(document.querySelector('#newproject header h2')).userSelect]; })()`),
      ['text', true, 'none']);
    assert.ok(!shell.store.projects().some((p) => p.id === 'note'), 'a file is not taken');
    await named('Shop');
    // Created, no task is made: Settings shows its page; the bar's + makes one (no question where), Settings has no
    // New Task (the author, 2026-10-12).
    assert.equal(await ui(`document.getElementById('npwhere').textContent`), `The project will be created in ${path.join(made, 'Shop')}`);
    ctx.asked.length = 0;
    await ui(`document.getElementById('npform').requestSubmit()`);
    await waitFor(() => ui(`${pageOf('Shop')} && !!document.getElementById('npagentsrow')
      && document.querySelector('#pjlist [data-project="shop"]')?.ariaSelected === 'true'`));
    assert.equal(await ui(`[...document.querySelectorAll('#projects button')].some((b) => b.textContent.trim() === 'New Task')`), false);
    assert.ok(!shell.current && !shell.open.has('shop'), 'made, no task');
    assert.equal(ctx.asked.length, 0, 'nothing asked');
    assert.equal(await ui(`!!document.getElementById('pjlook')`), false, 'nothing of its look to choose on its page either');
    await closeSettings(ui);
    await plusMenu(ui, 'Shop');
    await waitFor(() => shell.current?.folder === path.join(made, 'Shop') && shell.task?.loaded && shell.pty);
    assert.ok(fs.existsSync(path.join(made, 'Shop', '.git')), 'git init in it');
    const shop = shell.store.projects().find((p) => p.id === 'shop');
    assert.deepEqual([shop.color, shop.agents], [color, undefined]);
    // No favicon in its code: the curtain, in the next free color, the window's too.
    assert.equal(await ui(`${projectTab('shop')}.querySelector('.picon use').getAttribute('href')`), '#i-logo');
    assert.equal(await ui(`document.documentElement.style.getPropertyValue('--project')`), color);
    assert.equal(git(path.join(made, 'Shop'), 'log', '--format=%s'), 'Initial commit', 'an empty first commit');
    assert.equal(shell.task.folder, path.join(made, 'Shop@task-1'), 'so its first task has a copy of its own');
    assert.equal(await ui(`(document.getElementById('projects')?.dataset.state === 'open')`), false);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    await plusMenu(ui, 'project', 'task-1'); // a closed task in the bar's +: its group opens again on it
    await waitFor(() => shell.current?.folder === project && shell.task?.n === 1 && shell.task.loaded && shell.pty);
    ctx.watchPty(shell.pty);
    await waitFor(() => ui(`!document.documentElement.classList.contains('noproject') && !document.documentElement.classList.contains('loading')`));
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
    // Feature-X, closed with the others, opened again from the + (the tests after and the restart expect it).
    await plusMenu(ui, 'project', 'Feature-X');
    await waitFor(() => shell.task?.n === 2 && shell.task.loaded && !shell.windows[0].switching);
    await click(ui, taskTab(1));
    await waitFor(() => shell.task?.n === 1 && shell.task.loaded && !shell.windows[0].switching);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    assert.deepEqual(await projectTabs(ui), ['shop', 'project *', 'project']);
    // Another project's task: a click shows it.
    await click(ui, `document.querySelector('#projectTabs .tasktab[data-task="shop/1"]')`);
    await waitFor(() => shell.current?.id === 'shop' && shell.task?.key === 'shop/1' && shell.task.loaded && !shell.windows[0].switching);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    assert.deepEqual(await projectTabs(ui), ['shop *', 'project', 'project']);
    await showProject(ui, 'project');
    await waitFor(() => shell.current?.id === 'project' && shell.task.loaded);
    // A tab in the background has its × too: the last one of its project lets the project go.
    await ui(`document.querySelector('#projectTabs .tasktab[data-task="shop/1"] .close').click()`);
    await waitFor(() => !shell.open.has('shop'));
    assert.equal(shell.current?.id, 'project', 'the shown project stays');
    ctx.asked.length = 0;
  });

  test('projects: the projects\' manager (Project Settings…) changes its name and agents, the default one + runs, none the default: a new task starts nothing, the island\'s buttons instead; a folder with a favicon gets it as its icon, and its hue as its color', async (ctx) => {
    const { shell, ui, call } = ctx;
    const site = path.join(root, 'site');
    fs.mkdirSync(path.join(site, 'public'), { recursive: true });
    fs.writeFileSync(path.join(site, 'public', 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="red"/></svg>');
    await ui(`kulisa.invoke('project:open', { folder: ${JSON.stringify(site)} })`);
    await waitFor(() => shell.current?.id === 'site' && shell.task?.loaded && shell.pty);
    ctx.watchPty(shell.pty);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    await waitFor(() => ui(`${projectTab('site')}.querySelector('.favicon').src.startsWith('data:image/svg+xml;base64,')`));
    // Its color: its favicon's hue (red: 29°; a few degrees off where its edges blend) in the lightness and chroma of
    // Kulisa's own colors; the window's and its island's. What projects.json keeps (the next free color) is for a
    // project with none.
    const shown = (hue: number | string) => ui(`(() => { const c = document.documentElement.style.getPropertyValue('--project'), h = /^oklch\\(0\\.61 0\\.12 (\\d+)\\)$/.exec(c)?.[1];
      return ${projectTab('site')}.style.getPropertyValue('--color') === c && (${typeof hue === 'number'} ? Math.abs(h - ${JSON.stringify(hue)}) <= 4 : c === ${JSON.stringify(hue)}); })()`);
    await waitFor(() => shown(29));
    // Its settings: its favicon in the list, the folder shown and not changed.
    await projectMenu(ui, 'Project Settings…', `#projectTabs [data-project="site"] .name`);
    await waitFor(() => ui(`(document.getElementById('projects')?.dataset.state === 'open') && ${pageOf('site')}`));
    // The manager lists every project, this one chosen (none marked open: a project is no thing to open).
    assert.ok(await ui(`document.querySelector('#pjlist [data-project="site"]').ariaSelected === 'true' && !document.querySelector('#pjlist kbd')`));
    assert.equal(await ui(`document.querySelector('#pjlist [data-project="site"] .picon').matches('.favicon')`), true);
    assert.equal(await ui(`document.querySelector('#nprepos [data-folder] small').textContent`), site, 'its folder, as its code');
    assert.equal(await ui(`!!document.getElementById('nplocationrow')`), false);
    // A page, no Save: its top (New Task, ⋯), each part saved as it changes; the dialog stays open.
    assert.equal(await ui(`!!document.getElementById('npcreate') || !!document.querySelector('#projects footer')`), false, 'no Save, no Cancel');
    assert.equal(await ui(`[...document.querySelectorAll('#pjconfig .titled, #pjconfig .field > label')].map((h) => h.textContent).join(', ')`),
      'Name:, Code, Agents, Profiles, Local addresses:');
    const entryOf = () => shell.store.projects().find((p) => p.id === 'site');
    // Its favicon changed: read again as its settings open. Mostly blue with a red dot: the hue of the most (264°).
    const favicon = (svg: string) => fs.writeFileSync(path.join(site, 'public', 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">${svg}</svg>`);
    const reopen = async () => {
      await closeSettings(ui);
      await projectMenu(ui, 'Project Settings…', `#projectTabs [data-project="site"] .name`);
      await waitFor(() => ui(`(document.getElementById('projects')?.dataset.state === 'open') && ${pageOf('site')}`));
    };
    favicon('<rect width="16" height="16" fill="#00f"/><circle cx="8" cy="8" r="2" fill="red"/>');
    await reopen();
    await waitFor(() => shown(264));
    // A black mark (GitHub's, an SVG in currentColor) has no hue: the color it was given.
    favicon('<path d="M2 2h12v12H2z" fill="#000"/>');
    await reopen();
    await waitFor(() => shown(entryOf().color));
    await ui(`(() => { const l = document.getElementById('nplocal'); l.value = 'abc.ngrok.app *.Shop.dev'; l.dispatchEvent(new Event('input')); l.dispatchEvent(new Event('change')); })()`);
    await waitFor(() => entryOf().local?.length === 2);
    // The name typed and the manager closed with ×: kept.
    await ui(`(() => { const n = document.getElementById('pjname'); n.value = 'Site-2'; n.dispatchEvent(new Event('input')); })()`);
    assert.equal(entryOf().name, 'site', 'not yet: on Enter or leaving it');
    await closeSettings(ui);
    await waitFor(() => entryOf().name === 'Site-2');
    const entry = entryOf();
    assert.deepEqual([entry.name, entry.folder], ['Site-2', site]);
    assert.deepEqual(entry.local, ['abc.ngrok.app', 'shop.dev'], "its own local addresses, where test users' pairs may be typed (local.ts)");
    await waitFor(async () => (await projectTabs(ui)).includes('site *') && shell.win.getTitle() === `${shell.task.name} · Site-2 — Kulisa`);
    // Its profiles: a new one; one of another project, the same person (its master, its sign-ins); × lets go of one.
    await projectMenu(ui, 'Project Settings…', `#projectTabs [data-project="site"] .name`);
    await waitFor(() => ui(`(document.getElementById('projects')?.dataset.state === 'open')`));
    assert.equal(await ui(`document.querySelectorAll('#npprofiles .item').length`), 0);
    await newProfileHere(ui, 'Site-user');
    await waitFor(() => ui(`!!document.querySelector('#npprofiles [data-profile="site-user"]')`));
    await ui(`document.getElementById('npprofileadd').click()`);
    assert.ok((await menuRows(ui)).join('|').includes('# Other Profiles|Sam.admin'));
    await choose(ui, 'Sam.admin');
    await waitFor(async () => (await ui(`document.querySelector('#npprofiles [data-profile="sam-admin"] small')?.textContent`)) === 'seller in the test shop · also in project');
    await waitFor(() => shell.closed.has('sam-admin') && shell.closed.has('site-user')); // its task lists them, closed
    await onRow(ui, '#npprofiles [data-profile="site-user"]', 'npprofiledel');
    await waitFor(() => ctx.asked.length);
    assert.equal(ctx.asked.pop().message, 'Remove the profile Site-user from Site-2?');
    await waitFor(() => !shell.closed.has('site-user'));
    assert.deepEqual(shell.profileStore.get('site-user').projects, [], 'in no other project: kept all the same, until deleted in Settings → Profiles');
    shell.profileStore.delete('site-user'); // not needed by later tests
    await ui(`document.querySelector('#projects .x').click()`);
    // Opened in this task: a copy of its master, here.
    await ui(`act('profile:open', { profile: 'sam-admin' })`);
    await waitFor(() => shell.profiles.has('sam-admin'));
    assert.equal(shell.profiles.get('sam-admin').dir, path.join(userData, 'projects', 'site', '1', shell.profileStore.get('sam-admin').folder));
    // Let go here: it stays in project, with its master.
    ctx.answer = true;
    await ui(`act('profile:delete', { profile: 'sam-admin' })`);
    assert.equal(ctx.asked.pop().message, 'Remove the profile Sam.admin from Site-2?');
    await waitFor(() => !shell.profiles.has('sam-admin'));
    assert.deepEqual(shell.profileStore.get('sam-admin').projects, ['project']);
    // Its agents: a list, added from the agents without accounts and the accounts other projects have (one made in
    // project, as New Account… makes it), one the default (a radio); at once, not on Save.
    const ann = shell.accounts.create('project', (shell.accounts.prepare('fake') as { id: string }).id, 'fake', 'ann@shop.com');
    await projectMenu(ui, 'Project Settings…', `#projectTabs [data-project="site"] .name`);
    await waitFor(() => ui(`(document.getElementById('projects')?.dataset.state === 'open') && !!document.getElementById('npagentsrow')`));
    await ui(`document.getElementById('npagentadd').click()`);
    assert.ok(!(await menuRows(ui)).includes('Fake agent'), 'an agent with accounts: one of its accounts');
    await closeMenu(ui);
    for (const name of ['Terminal only', 'Fake agent · ann@shop.com']) {
      await ui(`document.getElementById('npagentadd').click()`);
      await menuRows(ui);
      await choose(ui, name);
      await waitFor(async () => (await ui(`[...document.querySelectorAll('#npagents .label')].map((l) => l.textContent)`)).includes(name));
    }
    // The default marked, Make Default on the others.
    const agentRows = () => ui(`[...document.querySelectorAll('#npagents .item')].map((r) => r.querySelector('.label').textContent + ' ' + !!r.querySelector('.default'))`);
    assert.deepEqual(await agentRows(), ['Terminal only true', 'Fake agent · ann@shop.com false'], 'the first added, the default');
    assert.deepEqual(shell.store.projects().find((p) => p.id === 'site').agents, ['shell', ann.id]);
    assert.deepEqual(shell.accounts.find(ann.id).projects, ['project', 'site'], 'the account lists the projects it is in');
    await onRow(ui, `#npagents [data-agent="${ann.id}"]`, 'npagentdefault');
    await waitFor(async () => JSON.stringify(await agentRows()) === '["Fake agent · ann@shop.com true","Terminal only false"]');
    // Its right-click has the same: Make Default.
    await rightClick(ui, '#npagents [data-agent="shell"] .label');
    assert.deepEqual(await menuRows(ui), ['Make Default', 'Remove from the Project']);
    await choose(ui, 'Make Default');
    await waitFor(async () => JSON.stringify(await agentRows()) === '["Terminal only true","Fake agent · ann@shop.com false"]');
    // None the default: No Default on the default one's right-click, or its ★; ★ on it again makes it the default.
    await rightClick(ui, '#npagents [data-agent="shell"] .label');
    assert.deepEqual(await menuRows(ui), ['No Default', 'Remove from the Project']);
    await choose(ui, 'No Default');
    await waitFor(async () => JSON.stringify(await agentRows()) === '["Terminal only false","Fake agent · ann@shop.com false"]');
    assert.equal(shell.store.projects().find((p) => p.id === 'site').noDefaultAgent, true);
    await onRow(ui, `#npagents [data-agent="shell"]`, 'npagentdefault');
    await waitFor(async () => JSON.stringify(await agentRows()) === '["Terminal only true","Fake agent · ann@shop.com false"]');
    assert.equal(shell.store.projects().find((p) => p.id === 'site').noDefaultAgent, undefined);
    await onRow(ui, `#npagents [data-agent="shell"]`, 'npagentdefault');
    await waitFor(async () => JSON.stringify(await agentRows()) === '["Terminal only false","Fake agent · ann@shop.com false"]');
    await onRow(ui, `#npagents [data-agent="shell"]`, 'npagentdefault');
    await waitFor(async () => JSON.stringify(await agentRows()) === '["Terminal only true","Fake agent · ann@shop.com false"]');
    await ui(`document.querySelector('#projects .x').click()`);
    // + makes a task with the default one (the first kept the one it started with).
    ctx.answer = true; // no git: a second task in the folder, after the question
    const task = await newTask(ctx);
    ctx.asked.length = 0;
    assert.equal(JSON.parse(fs.readFileSync(path.join(userData, 'projects', 'site', String(task.n), 'agent.json'), 'utf8')).agent, 'shell');
    // Another agent: made the default on the project's page (Make Default), + runs it.
    await ui(`kulisa.invoke('project:agent-default', { id: 'site', agent: '${ann.id}' })`);
    const before = shell.task;
    await newTask(ctx);
    ctx.asked.length = 0;
    await waitFor(() => shell.task.promptTarget()?.agent.id === ann.id);
    assert.equal(shell.task.profiles.size, 0, 'no profile opens by itself');
    const annTask = shell.task;
    // None the default: a new task starts nothing, the island's buttons instead; Ctrl+` there gives them the keyboard.
    await ui(`kulisa.invoke('project:agent-default', { id: 'site', agent: null })`);
    await plusMenu(ui, shell.current.name);
    // Shown, not only loaded: a key while the window still switches acts for the task before (docs/testing.md; on a
    // loaded machine, as GitHub's runner, Ctrl+` below did nothing now and then, 2026-10-12).
    await waitFor(async () => shell.task !== annTask && shell.task.loaded && !shell.windows[0].switching
      && (await ui(`!document.documentElement.classList.contains('loading')`)));
    const bare = shell.task;
    ctx.asked.length = 0;
    await waitFor(() => ui(`[...document.querySelectorAll('.launch .agents .name')].map((n) => n.textContent).join()`).then((t) => t === 'Fake agent,Terminal'));
    // A project with no profiles: one tile, Add Profile…, its page in Settings.
    assert.deepEqual(await ui(`[...document.querySelectorAll('.launch .profiles .name')].map((n) => n.textContent)`), ['Add Profile…']);
    await ui(`document.querySelector('.launch .profiles .launcher').click()`);
    await waitFor(() => ui(`document.getElementById('projects')?.dataset.state === 'open' && document.querySelector('#pjlist [data-project="site"]')?.ariaSelected === 'true'`));
    await ui(`document.querySelector('#projects header .x').click()`);
    await waitFor(async () => !(await ui(`document.getElementById('projects')?.dataset.state === 'open'`)));
    assert.equal(bare.terminals.size, 0);
    assert.equal(JSON.parse(fs.readFileSync(path.join(userData, 'projects', 'site', String(bare.n), 'agent.json'), 'utf8')).agent, null);
    await ui(`document.activeElement.blur()`);
    await focusWindow(shell.win, ui);
    // Once more until the launcher has it: on GitHub's runner the + menu, closed just before, gave the keyboard back
    // where it was after Ctrl+` had given it to the launcher, now and then (2026-10-12). Opens nothing: no agent.
    const onLauncher = () => ui(`document.activeElement === document.querySelector('.launcher')`);
    for (let i = 0; i < 3 && !(await onLauncher()); i++) {
      press(shell.win.webContents, '`', 'control');
      await waitFor(onLauncher, 1500).catch(() => {});
    }
    assert.ok(await onLauncher(), 'Ctrl+` gives the launcher the keyboard');
    assert.equal(bare.terminals.size, 0, 'nothing opened');
    // With a profile open, the island is a strip: Ctrl+` opens its +.
    await call('profile_create', { name: 'Bo.bare' }, bare);
    await waitFor(() => ui(`!!document.getElementById('termUnfold') && !document.querySelector('.launch')`));
    await focusWindow(shell.win, ui);
    press(shell.win.webContents, '`', 'control');
    assert.deepEqual(await menuRows(ui), ['Fake agent · ann@shop.com', '-', 'Terminal']);
    await closeMenu(ui);
    assert.equal(bare.terminals.size, 0, 'nothing opened');
    await ui(`act('profile:delete', { profile: 'bo-bare' })`);
    await waitFor(() => !bare.profiles.has('bo-bare'));
    shell.profileStore.delete(shell.profileStore.get('bo-bare').id);
    ctx.asked.length = 0;
    // Let go of at once, an account as an agent without accounts: its tasks keep it, and the account stays in the store.
    await ui(`kulisa.invoke('project:agent-remove', { id: 'site', agent: '${ann.id}' })`);
    await ui(`kulisa.invoke('project:agent-remove', { id: 'site', agent: 'shell' })`);
    assert.equal(shell.store.projects().find((p) => p.id === 'site').agents, undefined, 'none left');
    assert.deepEqual(shell.accounts.find(ann.id).projects, ['project']);
    assert.equal(annTask.promptTarget().agent.id, ann.id);
    assert.deepEqual([...before.terminals.values()].map((t) => [t.name, !!t.agent]), [['Terminal', false]], 'the terminal only: a shell');
    await ui(`kulisa.invoke('project:close-tasks', { id: 'site' })`);
    await waitFor(() => !shell.open.has('site'));
    ctx.asked.length = 0;
  });

  test('projects: several repositories: a task gets a copy of the default one, another added when it needs it (the human on its tab, the agent with task_add_repository), on its branch, its agent told; one with copies is not removed', async (ctx) => {
    const { shell, ui, call } = ctx;
    const repo = (name: string) => {
      const d = path.join(root, name);
      fs.mkdirSync(d); git(d, 'init', '-q'); fs.writeFileSync(path.join(d, 'a.txt'), name); git(d, 'add', '-A'); git(d, 'commit', '-qm', name);
      return d;
    };
    const api = repo('api'), web = repo('web');
    await ui(`kulisa.invoke('project:open', { folder: ${JSON.stringify(api)} })`);
    await waitFor(() => shell.current?.id === 'api' && shell.task?.loaded && shell.pty);
    ctx.watchPty(shell.pty);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    const first = shell.task;
    assert.equal(first.folder, `${api}@task-1`, 'one repository: its copy next to it');
    const chips = () => ui(`[...document.querySelectorAll('.taskrepos .chip')].map((c) => c.textContent + (c.classList.contains('fresh') ? ' fresh' : ''))`);
    assert.deepEqual(await chips(), [], 'one repository: nothing to tell');
    // Added in Project Settings… while task-1 runs: no copy, only offered on its tab.
    const added = await ui(`kulisa.invoke('project:repo-add', { id: 'api', folder: ${JSON.stringify(web)} })`);
    assert.deepEqual(added.repos.map((r: { folder: string }) => r.folder), [api, web]);
    assert.equal(first.entry.copies.length, 1);
    assert.deepEqual([first.dirs(), first.addable()], [[], [web]]);
    // The terminals' row names its repositories once the project has several; one added comes in lit.
    await waitFor(async () => (await chips()).length === 1);
    assert.deepEqual(await chips(), ['api']);
    // Add Repository on its tab: a copy into its folder of copies, on its branch; its agent given it (an agent without
    // /add-dir: a line saying so, sent; Claude Code's question after /add-dir: checked by hand), not while it waits for
    // the human (Enter would answer the question), once it no longer does.
    const firstAgent = first.agentTerminals()[0];
    first.setState(firstAgent, 'waiting');
    await rightClick(ui, `#projectTabs .tasktab[data-task="${first.key}"] .name`);
    const rows = await menuRows(ui);
    assert.deepEqual(rows.slice(rows.indexOf('# Add Repository'), rows.indexOf('Rename…')), ['# Add Repository', 'web', '-']);
    await choose(ui, 'web');
    const webCopy = path.join(root, 'Kulisa', 'api@task-1', 'web');
    await waitFor(() => first.entry.copies.length === 2);
    await waitFor(async () => (await chips()).length === 2);
    assert.deepEqual(await chips(), ['api', 'web fresh']);
    assert.equal(git(webCopy, 'rev-parse', '--abbrev-ref', 'HEAD'), 'task-1');
    assert.ok(!(await ctx.termText()).includes('Kulisa added'), 'not while it waits for the human');
    first.setState(firstAgent, 'done');
    // Sent, not left in its prompt: shown as typed, then again as the agent (cat) read the line on Enter.
    await waitFor(async () => (await ctx.termText()).split(`Kulisa added ${webCopy} to this task`).length === 3);
    assert.deepEqual([first.dirs(), first.addable()], [[webCopy], []]);
    // A new task: a copy of the default one alone, in a folder for them all; the agent told of the other, to read it
    // there and ask before adding it.
    const task = await newTask(ctx);
    const home = path.join(root, 'Kulisa', 'api@task-2');
    assert.equal(task.folder, path.join(home, 'api'));
    assert.deepEqual([task.dirs(), fs.existsSync(path.join(home, 'web'))], [[], false]);
    assert.match(await ctx.instructions(task), new RegExp(`repositories, not in this task: ${web}\\. .*first ask the human.*task_add_repository`));
    // The agent adds it in its turn, once the human agreed: a copy on its branch, given to it in the turn by an agent's
    // own command (Claude Code's /add-dir: it runs at once); the same refused again.
    const agent = task.agentTerminals()[0];
    agent.agent.addDir = { command: (f: string) => `/add-dir ${f}` };
    task.setState(agent, 'working');
    assert.match((await call('task_add_repository', { repository: 'web' })).text, /Added: .*api@task-2\/web, on branch task-2/);
    assert.deepEqual(task.dirs(), [path.join(home, 'web')]);
    await waitFor(async () => (await ctx.termText()).split(`/add-dir ${path.join(home, 'web')}`).length === 3);
    delete agent.agent.addDir;
    task.setState(agent, 'done');
    await assert.rejects(call('task_add_repository', { repository: 'web' }), /has .*web already/);
    // Its agent names it: the branch of each copy.
    await call('task_rename', { name: 'Checkout' });
    for (const r of ['api', 'web']) assert.equal(git(path.join(home, r), 'rev-parse', '--abbrev-ref', 'HEAD'), 'checkout');
    // Project Settings… shows them, the default first; × on one tasks have copies of is refused, naming them.
    await projectMenu(ui, 'Project Settings…', `#projectTabs [data-project="api"] .name`);
    await waitFor(() => ui(`document.querySelectorAll('#nprepos .item').length === 2`));
    assert.deepEqual(await ui(`[...document.querySelectorAll('#nprepos .item')].map((r) => r.querySelector('.label').textContent + ' ' + !!r.querySelector('.default'))`), ['api true', 'web false']);
    await onRow(ui, `#nprepos [data-folder="${web}"]`, 'nprepodel');
    await waitFor(async () => /Tasks work in it: task-1, Checkout/.test(await ui(`document.getElementById('npcodeerror').textContent`)));
    await ui(`document.querySelector('#projects .x').click()`);
    // Removed again by its agent once the human agreed: nothing of its own in it, so not asked; its folder and branch
    // gone, the agent told once its turn is over. Its own folder is refused.
    await assert.rejects(call('task_remove_repository', { repository: 'api' }), /task's own folder/);
    task.setState(agent, 'working');
    assert.match((await call('task_remove_repository', { repository: 'web' })).text, new RegExp(`Removed: ${path.join(home, 'web')}`));
    assert.deepEqual([fs.existsSync(path.join(home, 'web')), git(web, 'branch', '--list', 'checkout'), task.dirs(), task.addable()], [false, '', [], [web]]);
    assert.ok(!(await ctx.termText()).includes('Kulisa removed'), 'not while it works');
    task.setState(agent, 'done');
    await waitFor(async () => (await ctx.termText()).split(`Kulisa removed ${path.join(home, 'web')}`).length === 3);
    await waitFor(async () => (await chips()).length === 1);
    // Added again, it comes in lit; the human removes it by its chip's menu.
    await call('task_add_repository', { repository: 'web' });
    await waitFor(async () => (await chips()).length === 2);
    assert.deepEqual(await chips(), ['api', 'web fresh']);
    await rightClick(ui, `.taskrepos .chip[data-folder="${path.join(home, 'web')}"]`);
    assert.deepEqual(await menuRows(ui), ['Remove Repository']);
    await choose(ui, 'Remove Repository');
    await waitFor(() => !fs.existsSync(path.join(home, 'web')));
    await waitFor(async () => (await chips()).length === 1);
    assert.equal(ctx.asked.length, 0, 'nothing of its own: not asked');
    // Deleting the task: both copies, both branches and its folder go.
    await ui(`kulisa.invoke('task:delete', '${task.key}')`);
    await waitFor(() => !fs.existsSync(home));
    assert.equal(git(web, 'branch', '--list', 'checkout') + git(api, 'branch', '--list', 'checkout'), '');
    ctx.asked.length = 0;
    // Cloned from a URL (a local one here) next to the project's folder, offered to task-1; made the default.
    const bare = path.join(root, 'docs.git');
    git(root, 'clone', '-q', '--bare', web, bare);
    const cloned = await ui(`kulisa.invoke('project:repo-clone', { id: 'api', url: ${JSON.stringify(bare)} })`);
    assert.deepEqual(cloned.repos.map((r: { folder: string }) => r.folder), [api, web, path.join(root, 'docs')]);
    assert.deepEqual(first.addable(), [path.join(root, 'docs')]);
    assert.equal((await ui(`kulisa.invoke('project:repo-default', { id: 'api', folder: ${JSON.stringify(web)} })`)).repos[0].folder, web);
    // The human removes task-1's web on its tab, a file not committed there: asked first, told what goes with it.
    fs.writeFileSync(path.join(webCopy, 'b.txt'), 'work');
    const removeWeb = async () => {
      await rightClick(ui, `#projectTabs .tasktab[data-task="${first.key}"] .name`);
      const rows = await menuRows(ui);
      assert.deepEqual(rows.slice(rows.indexOf('# Remove Repository'), rows.indexOf('Rename…')), ['# Remove Repository', 'web', '-']);
      await choose(ui, 'web');
      await waitFor(() => ctx.asked.length);
      return ctx.asked.pop();
    };
    ctx.answer = false;
    const q = await removeWeb();
    assert.equal(q.message, 'Remove web from the task task-1?');
    assert.match(q.detail, new RegExp(`its folder ${webCopy}, its branch task-1.*1 uncommitted file`, 's'));
    assert.ok(fs.existsSync(webCopy), 'kept when the human says no');
    ctx.answer = true;
    await removeWeb();
    await waitFor(() => !fs.existsSync(webCopy) && git(web, 'branch', '--list', 'task-1') === ''); // the folder goes first, then the branch
    await ui(`kulisa.invoke('project:close-tasks', { id: 'api' })`);
    await waitFor(() => !shell.open.has('api'));
    ctx.asked.length = 0;
    // A project without git (Site-2, closed) getting a repository: its folder is a former one, shown in its settings.
    await ui(`kulisa.invoke('project:repo-add', { id: 'site', folder: ${JSON.stringify(path.join(root, 'docs'))} })`);
    const site = await ui(`kulisa.invoke('project:settings-get', { id: 'site' })`);
    assert.deepEqual([site.repos.map((r: { folder: string }) => r.folder), site.former], [[path.join(root, 'docs')], path.join(root, 'site')]);
  });

  test("projects: the title bar's Projects opens the manager at the shown project; another one, not open, is configured there too; + New Project", async (ctx) => {
    const { shell, ui } = ctx;
    await ui(`document.getElementById('manageProjects').click()`);
    await waitFor(() => ui(`(document.getElementById('projects')?.dataset.state === 'open') && ${pageOf(shell.current.name)}`));
    assert.equal(await ui(`document.querySelector('#pjlist [aria-selected="true"]').dataset.project`), shell.current.id);
    assert.equal(shell.task.profiles.get('sam-admin').get().view.getVisible(), false, 'pages hidden under the dialog');
    // Site-2 is closed: its configuration all the same; a profile made and let go there (asked first).
    await ui(`document.querySelector('#pjlist [data-project="site"]').click()`);
    await waitFor(() => ui(pageOf('Site-2')));
    assert.ok(!shell.open.has('site'));
    await newProfileHere(ui, 'Closed-one');
    await waitFor(() => ui(`!!document.querySelector('#npprofiles [data-profile="closed-one"]')`));
    ctx.answer = true;
    await onRow(ui, '#npprofiles [data-profile="closed-one"]', 'npprofiledel');
    await waitFor(() => ctx.asked.length && !shell.profileStore.get('closed-one')?.projects.length);
    assert.equal(ctx.asked.pop().message, 'Remove the profile Closed-one from Site-2?');
    shell.profileStore.delete('closed-one'); // not needed by later tests
    await waitFor(() => ui(`!document.querySelector('#npprofiles [data-profile="closed-one"]')`));
    assert.equal(await ui(`document.getElementById('npprofileerror').textContent`), '');
    await shell.screenshot(path.join(root, 'projects.png'));
    // + New Project: a dialog of its own in Settings' place; cancelled, Settings again.
    await ui(`document.getElementById('pjnew').click()`);
    await waitFor(() => ui(`document.getElementById('newproject')?.dataset.state === 'open' && !!document.getElementById('nplocationrow')
      && document.getElementById('projects')?.dataset.state !== 'open'`));
    await shell.screenshot(path.join(root, 'newproject.png'));
    await ui(`document.querySelector('#newproject .x').click()`);
    await waitFor(() => ui(`document.getElementById('projects')?.dataset.state === 'open' && document.getElementById('newproject')?.dataset.state !== 'open'`));
    await ui(`document.querySelector('#projects .x').click()`);
    ctx.asked.length = 0;
  });

  test("tasks: a closed task whose PR is merged on the remote is marked in its group's menu; Delete Merged Tasks… deletes it after one question", async (ctx) => {
    const { shell, ui } = ctx;
    // A repository with a remote, as a clone of one is.
    const origin = path.join(root, 'merge-origin.git'), dir = path.join(root, 'merge');
    git(root, 'init', '-q', '--bare', '-b', 'main', origin);
    fs.mkdirSync(dir); git(dir, 'init', '-q', '-b', 'main'); fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
    git(dir, 'add', '-A'); git(dir, 'commit', '-qm', 'a'); git(dir, 'remote', 'add', 'origin', origin);
    git(dir, 'push', '-q', 'origin', 'main'); git(dir, 'remote', 'set-head', 'origin', 'main');
    await ui(`kulisa.invoke('project:open', { folder: ${JSON.stringify(dir)} })`);
    await waitFor(() => shell.current?.id === 'merge' && shell.task?.loaded && shell.pty);
    ctx.watchPty(shell.pty);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    const first = shell.task;
    const second = await newTask(ctx);
    // task-1's work pushed, and merged into main on the remote; task-2 has a commit not merged.
    fs.writeFileSync(path.join(first.folder, 'b.txt'), 'b'); git(first.folder, 'add', '-A'); git(first.folder, 'commit', '-qm', 'b');
    git(first.folder, 'push', '-q', 'origin', `${first.entry.branch}:main`);
    fs.writeFileSync(path.join(second.folder, 'c.txt'), 'c'); git(second.folder, 'add', '-A'); git(second.folder, 'commit', '-qm', 'c');
    await ui(`${taskTab(1)}.querySelector('.close').click()`);
    await waitFor(() => first.entry.closed && first.entry.merged, 10000); // a fetch from the remote
    const rows = await groupMenu(ui);
    assert.ok(rows.includes('Delete Merged Tasks…'));
    ctx.asked.length = 0;
    await groupMenu(ui, 'Delete Merged Tasks…');
    await waitFor(() => ctx.asked.length);
    assert.equal(ctx.asked.pop().message, 'Delete the task task-1?');
    await waitFor(() => !shell.current.tasks.has(1) && !fs.existsSync(first.folder));
    assert.ok(shell.current.tasks.has(second.n) && !second.entry.merged, 'one not merged stays');
    await ui(`kulisa.invoke('project:close-tasks', { id: 'merge' })`);
    await waitFor(() => !shell.open.has('merge'));
    ctx.asked.length = 0;
  });

  test("menus: one longer than the window has stays in it and scrolls, as the bar's + with thirty closed tasks", async ({ ui }) => {
    // It ran past the window's edge: under the grid its project's row, the new task, out of reach above (2026-10-15).
    await plusMenu(ui);
    await ui(`(() => { const m = ${MENU}, row = m.querySelector('.item'); for (let i = 0; i < 60; i++) m.append(row.cloneNode(true)); })()`); // as many rows as thirty closed tasks and more
    assert.deepEqual(await ui(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => { const m = ${MENU}, b = m.getBoundingClientRect();
      r([b.top >= 0, b.bottom <= innerHeight, m.scrollHeight > m.clientHeight]); })))`), [true, true, true]);
    await closeMenu(ui);
  });
  test("tasks: a closed task is deleted from its row, 🗑 or Delete, in the bar's +, its project loaded or not, after the question Delete Task… asks", async (ctx) => {
    // About 2 s: git's work (worktrees made and removed).
    const { shell, ui } = ctx;
    const p = shell.store.projects().find((x) => x.id === 'merge');
    const entry = (n: number) => shell.store.tasksOf(p).list.find((e) => e.n === n);
    // The open menu's closed task of that name, after the row of its project in the bar's +: its row.
    const row = (name: string, after = '') => `(() => { const items = [...${MENU}.querySelectorAll('.item')], label = (r) => r.querySelector('.label').textContent;
      return items.slice(items.findIndex((r) => !${JSON.stringify(after)} || label(r) === ${JSON.stringify(after)})).find((r) => label(r) === ${JSON.stringify(name)}); })()`;
    // merge (above) is not loaded now; its task-2 is closed, with a commit not merged.
    const folder = entry(2).folder;
    await plusMenu(ui);
    assert.equal(await ui(`getComputedStyle(${row('task-2', 'merge')}.querySelector('.remove')).visibility`), 'hidden', 'shown on the row the pointer or the keyboard is on');
    ctx.answer = false;
    await ui(`${row('task-2', 'merge')}.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))`);
    await waitFor(() => ctx.asked.length);
    const q = ctx.asked.pop();
    assert.equal(q.message, 'Delete the task task-2?');
    assert.match(q.detail, /1 commit of its own/, 'its work not in main, as Delete Task… says');
    await waitFor(async () => !(await menuOpen(ui)) && !(await ui(`document.getElementById('ask')?.dataset.state === 'open'`)));
    assert.ok(entry(2) && fs.existsSync(folder), 'Cancel keeps it');
    ctx.answer = true;
    await plusMenu(ui);
    await click(ui, `${row('task-2', 'merge')}.querySelector('.remove')`);
    await waitFor(() => !entry(2) && !fs.existsSync(folder));
    assert.ok(!shell.open.has('merge'), 'not opened for it');
    const rows: string[] = await plusMenu(ui), after = rows.slice(rows.indexOf('merge') + 1);
    assert.ok(!after[0].startsWith('  '), 'merge has no closed task left');
    await closeMenu(ui);

    // A task of it open: the same row in the +.
    await ui(`kulisa.invoke('project:open', { id: 'merge' })`);
    await waitFor(() => shell.current?.id === 'merge' && shell.task?.loaded && shell.pty);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    const closing = shell.task;
    await newTask(ctx);
    await ui(`document.querySelector('#projectTabs .tasktab[data-task="${closing.key}"] .close').click()`);
    await waitFor(() => closing.entry.closed);
    await plusMenu(ui);
    await click(ui, `${row(closing.name, 'merge')}.querySelector('.remove')`);
    await waitFor(() => !entry(closing.n) && !fs.existsSync(closing.folder));
    assert.ok(!shell.current.tasks.has(closing.n) && shell.task.loaded, 'the open one stays');
    await ui(`kulisa.invoke('project:close-tasks', { id: 'merge' })`);
    await waitFor(() => !shell.open.has('merge'));
    ctx.asked.length = 0;
  });

  test("projects: Delete Project… (the projects' manager alone) asks, closes the project when open, deletes its data and its tasks' copies, never its folder; New Project takes its code from folders on the disk or clones it from URLs, one or several, making no other folder", async (ctx) => {
    // About 3 s: git's work (a worktree, a clone) and closing an open project.
    const { shell, ui } = ctx;
    const projects = () => shell.store.projects().map((p) => p.id);
    // A project that is not open, with a task that has a commit of its own, as Kulisa lays them out.
    const spare = path.join(root, 'spare');
    fs.mkdirSync(spare);
    git(spare, 'init', '-q'); fs.writeFileSync(path.join(spare, 'a.txt'), 'a'); git(spare, 'add', '-A'); git(spare, 'commit', '-qm', 'a');
    const p = shell.store.projectFor(spare);
    const wt = await createWorktree(spare, 'idea', null, []);
    fs.writeFileSync(path.join(wt.folder, 'b.txt'), 'b'); git(wt.folder, 'add', '-A'); git(wt.folder, 'commit', '-qm', 'b');
    const data = path.join(userData, 'projects', p.id);
    // A profile of its own (in no other project): its master goes with it.
    const own = shell.profileStore.create(p.id, { name: 'Spare-user', avatar: 'fox' });
    fs.mkdirSync(path.join(data, '1', own.folder), { recursive: true });
    // An agent's account in no other project: it stays, let go of (Settings → Agents deletes one).
    const account = shell.accounts.create(p.id, (shell.accounts.prepare('fake') as { id: string }).id, 'fake', 'spare@shop.com');
    fs.mkdirSync(account.dir, { recursive: true });
    fs.writeFileSync(path.join(data, 'tasks.json'), JSON.stringify({ next: 3, current: 1, list: [{ n: 1, name: 'task-1', offset: 0, folder: spare }, { n: 2, name: 'Idea', branch: wt.branch, offset: 100, copies: [wt], folder: wt.folder }] }));
    shell.sendProjects(); // made behind the windows' back: they are told, as when a project is made

    // In the projects' manager, its Delete Project…: the human is told what goes, says no, then yes.
    const removeRow = async (id = 'spare') => {
      if (!await ui(`document.getElementById('projects')?.dataset.state === 'open'`)) await ui(`document.getElementById('manageProjects').click()`);
      await waitFor(() => ui(`!!document.querySelector('#pjlist [data-project="${id}"]')`));
      await ui(`document.querySelector('#pjlist [data-project="${id}"]').click()`);
      await waitFor(() => ui(`${pageOf(id)} && !!document.getElementById('pjmore')`));
      await ui(`document.getElementById('pjmore').click()`); // ⋯ at its top
      await menuRows(ui);
      await choose(ui, 'Delete Project…');
    };
    ctx.answer = false;
    await removeRow();
    await waitFor(() => ctx.asked.length);
    const q = ctx.asked.pop();
    assert.equal(q.message, 'Delete the project spare?');
    assert.doesNotMatch(q.detail, /Spare-user/);
    assert.match(q.detail, /Its profiles stay, with their sign-ins/);
    assert.doesNotMatch(q.detail, /accounts/, 'its accounts stay');
    assert.ok(q.detail.includes(wt.worktree) && q.detail.includes('Idea: 1 commit of its own') && q.detail.includes(`Its folders stay as they are: ${spare}.`));
    assert.ok(projects().includes(p.id) && fs.existsSync(data) && fs.existsSync(wt.worktree), 'kept when the human says no');
    ctx.answer = true;
    await removeRow();
    await waitFor(() => !projects().includes(p.id));
    ctx.asked.length = 0;
    await waitFor(() => !fs.existsSync(data) && !fs.existsSync(wt.worktree));
    assert.ok(fs.existsSync(shell.profileStore.masterDir(own.folder)) && shell.profileStore.get('spare-user').projects.length === 0,
      'its profile kept, with its sign-ins, in no project (as its account)');
    shell.profileStore.delete('spare-user'); // not needed by later tests
    assert.ok(fs.existsSync(account.dir) && !fs.readFileSync(path.join(root, 'logouts'), 'utf8').includes(account.dir), 'its account kept, signed in');
    assert.deepEqual(shell.accounts.find(account.id).projects, []);
    assert.equal(git(spare, 'branch', '--list', wt.branch), '', "the task's branch");
    assert.equal(fs.readFileSync(path.join(spare, 'a.txt'), 'utf8'), 'a', "the project's own folder stays");
    assert.ok(shell.task?.loaded && shell.current?.id === 'project', 'another project: the open one stays open');
    await waitFor(() => ui(`!document.querySelector('#pjlist [data-project="spare"]')`));
    await closeSettings(ui);

    // New Project… asks for its code first (the author, 2026-10-11: a folder made in ~/Kulisa was in the way of code
    // already on the disk). Folder on disk, a repository: taken as it is, its files and its history kept, no git init,
    // nothing made; named after its folder; made, not opened, as any new project; New Task opens it.
    const gone = path.join(root, 'gone');
    fs.mkdirSync(gone); git(gone, 'init', '-q'); fs.writeFileSync(path.join(gone, 'a.txt'), 'a'); git(gone, 'add', '-A'); git(gone, 'commit', '-qm', 'mine');
    const fill = (id: string, v: string) => ui(`(() => { const i = document.getElementById('${id}'); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input')); })()`);
    const newProject = async (from: string) => {
      if (!await ui(`document.getElementById('projects')?.dataset.state === 'open'`)) await ui(`document.getElementById('manageProjects').click()`);
      await waitFor(() => ui(`document.getElementById('projects')?.dataset.state === 'open'`));
      await ui(`document.getElementById('pjnew').click()`);
      await waitFor(() => ui(`!!document.querySelector('#newproject #npfrom [data-value="${from}"]')`));
      await ui(`document.querySelector('#npfrom [data-value="${from}"]').click()`);
      await waitFor(() => ui(`document.querySelector('#npfrom [data-value="${from}"]').ariaSelected === 'true'`));
      // Over Settings' project page: no id twice, or a field found by its id was the page's (its name was typed
      // into the project's own, renaming it, 2026-10-12).
      assert.deepEqual(await ui(`(() => { const ids = [...document.querySelectorAll('[id]')].map((e) => e.id); return ids.filter((id, i) => ids.indexOf(id) !== i); })()`), []);
    };
    await newProject('folder');
    assert.equal(await ui(`!!document.getElementById('nplocationrow')`), false, 'no location: nothing is made');
    const add = async (v: string) => { await fill('npsource', v); await ui(`document.getElementById('npaddsource').click()`); };
    await add(path.join(root, 'nowhere'));
    await waitFor(async () => (await ui(`document.getElementById('nperror').textContent`)) === `${path.join(root, 'nowhere')} is not there`);
    assert.equal(await ui(`document.querySelectorAll('#npsources .item').length`), 0, 'not in the list');
    assert.ok(!fs.existsSync(path.join(root, 'nowhere')), 'not made');
    const showOpenDialog = electron.dialog.showOpenDialog;
    electron.dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [gone] });
    try {
      await fill('npsource', '');
      await fill('npname', ''); // typed by the human: kept; emptied, it follows the first folder again
      await ui(`document.getElementById('npbrowsesource').click()`);
      await waitFor(async () => (await ui(`document.getElementById('npname').value`)) === 'gone');
    } finally { electron.dialog.showOpenDialog = showOpenDialog; }
    assert.equal(await ui(`document.querySelector('#npsources .item kbd').textContent`), 'git');
    assert.equal(await ui(`document.getElementById('npgitrow').hidden`), true, 'no Create Git repository: it is one');
    await ui(`document.getElementById('npform').requestSubmit()`);
    await waitFor(() => ui(pageOf('gone')));
    assert.ok(projects().includes('gone') && !shell.open.has('gone'), 'made, no task');
    assert.equal(git(gone, 'log', '--format=%s'), 'mine', 'its history as it was');
    assert.equal(fs.readFileSync(path.join(gone, 'a.txt'), 'utf8'), 'a');
    ctx.asked.length = 0;
    await closeSettings(ui);
    await plusMenu(ui, 'gone');
    await waitFor(() => shell.current?.folder === gone && shell.task?.loaded && shell.pty);
    assert.equal(ctx.asked.length, 0, 'its group in this window, nothing asked where');
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    // The open one: closed, then deleted; the tab next to it shown.
    await removeRow('gone');
    await waitFor(() => !projects().includes('gone'));
    // Its grid taken down closes the window's dialogs, the manager too (lib/views.ts, closeLayers).
    if (await ui(`document.getElementById('projects')?.dataset.state === 'open'`)) await closeSettings(ui);
    ctx.asked.length = 0;
    await waitFor(() => shell.current?.folder === project && shell.task?.loaded);
    assert.deepEqual(await projectTabs(ui), ['project', 'project *'], 'the tab next to it shown');
    assert.ok(fs.existsSync(gone) && !fs.existsSync(path.join(userData, 'projects', 'gone')));
    assert.deepEqual(savedWindows(), [{ tabs: ['project/1', 'project/2'], shown: 'project/2' }]);

    // Folder on disk, several (a frontend and a backend): taken as they are, the first the default and the project's
    // folder; Create Git repository in the one without git only.
    const back = path.join(root, 'back');
    fs.mkdirSync(back); fs.writeFileSync(path.join(back, 'b.txt'), 'b');
    await newProject('folder');
    await add(gone);
    await add(back);
    await waitFor(async () => (await ui(`[...document.querySelectorAll('#npsources .item')].map((r) => r.dataset.source + ' ' + r.querySelector('kbd').textContent + ' ' + !!r.querySelector('.default')).join()`))
      === `${gone} git true,${back} no git false`);
    assert.equal(await ui(`document.getElementById('npgitrow').hidden`), false, 'Create Git repository: for the one without');
    await ui(`document.getElementById('npform').requestSubmit()`);
    await waitFor(() => ui(`${pageOf('gone')} && document.querySelectorAll('#nprepos .item').length === 2`));
    const both = shell.store.projects().find((x) => x.id === 'gone');
    assert.deepEqual([both.folder, both.repos], [gone, [gone, back]]);
    assert.equal(git(back, 'log', '--format=%s'), 'Initial commit', 'git init in the one without');
    assert.equal(git(gone, 'log', '--format=%s'), 'mine', 'the repository as it was');
    await removeRow('gone');
    await waitFor(() => !projects().includes('gone'));

    // Clone from URL (a local one here): cloned into <location>/<name>, named after the repository, and that clone is
    // the project's folder: no empty one beside it, no git init. A folder with files there is refused.
    const bare = path.join(root, 'cloned.git'), backBare = path.join(root, 'back.git');
    git(root, 'clone', '-q', '--bare', gone, bare);
    git(root, 'clone', '-q', '--bare', back, backBare);
    await newProject('clone');
    assert.equal(await ui(`document.getElementById('npgitrow').hidden`), true, 'no Create Git repository: it is one');
    await fill('npsource', bare);
    await ui(`document.getElementById('npaddsource').click()`);
    await waitFor(async () => (await ui(`document.getElementById('npname').value`)) === 'cloned');
    const into = path.join(root, 'Kulisa', 'cloned');
    await waitFor(async () => (await ui(`document.getElementById('npwhere').textContent`)) === `The repository will be cloned into ${into}`);
    await fill('nplocation', root);
    await fill('npname', 'gone');
    await waitFor(async () => (await ui(`document.getElementById('npwhere').textContent`)) === `${gone} is there already: choose another name or location`);
    await fill('nplocation', path.join(root, 'Kulisa'));
    await fill('npname', 'cloned');
    await ui(`document.getElementById('npform').requestSubmit()`);
    await waitFor(() => ui(`${pageOf('cloned')} && document.querySelectorAll('#nprepos .item').length === 1`));
    const cloned = shell.store.projects().find((x) => x.id === 'cloned');
    assert.equal(cloned.folder, into);
    assert.equal(git(into, 'log', '--format=%s'), 'mine', 'its history');
    await removeRow('cloned');
    await waitFor(() => !projects().includes('cloned'));
    // Several: one folder of the project's, each repository cloned into it, the first the default; that folder is
    // no former one (it holds them). A URL typed and not yet added counts.
    await newProject('clone');
    await fill('npsource', bare);
    await ui(`document.getElementById('npaddsource').click()`);
    await fill('npname', 'fullstack');
    await fill('npsource', backBare);
    const stack = path.join(root, 'Kulisa', 'fullstack');
    await ui(`document.getElementById('npform').requestSubmit()`);
    await waitFor(() => ui(`${pageOf('fullstack')} && document.querySelectorAll('#nprepos .item').length === 2`));
    const full = shell.store.projects().find((x) => x.id === 'fullstack');
    assert.deepEqual([full.folder, full.repos], [stack, [path.join(stack, 'cloned'), path.join(stack, 'back')]]);
    assert.equal((await ui(`kulisa.invoke('project:settings-get', { id: 'fullstack' })`)).former, null, 'it holds them: no former folder');
    assert.equal(await ui(`document.getElementById('npformer').hidden`), true);
    await removeRow('fullstack');
    await waitFor(() => !projects().includes('fullstack'));
    if (await ui(`document.getElementById('projects')?.dataset.state === 'open'`)) await closeSettings(ui);
    ctx.asked.length = 0;
    // A URL git cannot clone: git's own words, nothing left behind, the clones before it neither.
    assert.ok((await ui(`kulisa.invoke('project:new', { from: 'clone', name: 'bad', location: ${JSON.stringify(root)}, urls: [${JSON.stringify(bare)}, ${JSON.stringify(path.join(root, 'none.git'))}] })`)).error);
    assert.ok(!fs.existsSync(path.join(root, 'bad')) && !projects().includes('bad'));

    // Close All Tasks in its submenu: the last tasks, so the empty window; its tasks closed.
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    await projectMenu(ui, 'Close All Tasks', '#projectTabs [data-project="project"] .name');
    await waitFor(() => shell.task === null && shell.open.size === 0);
    ctx.asked.length = 0;
    await waitFor(() => ui(`document.documentElement.classList.contains('noproject')`));
    assert.ok(shell.store.tasksOf({ id: 'project' }).list.every((e) => e.closed), 'its tasks closed');

    // A closed task in the bar's +: opened again, a tab at the end; another one of it after it. Back on task-1 with
    // Feature-X, as the tests after and the restart phase expect.
    await plusMenu(ui, 'project', 'task-1');
    await waitFor(() => shell.task?.n === 1 && shell.task.loaded && shell.pty && !shell.windows[0].switching);
    assert.ok(!shell.task.entry.closed, 'open again');
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    await plusMenu(ui, 'project', 'Feature-X');
    await waitFor(() => shell.task?.n === 2 && shell.task.loaded && shell.pty && !shell.windows[0].switching);
    await click(ui, taskTab(1));
    await waitFor(() => shell.task?.n === 1 && shell.task.loaded && !shell.windows[0].switching);
    assert.deepEqual(await projectTabs(ui), ['project *', 'project'], 'a tab each');
    assert.deepEqual(await tabs(ui), ['task-1 *', 'Feature-X']);
    ctx.watchPty(shell.pty);
    await waitFor(() => ui(`!document.documentElement.classList.contains('noproject') && !document.documentElement.classList.contains('loading')`));
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
  });
  test('the CDP proxy takes ids in any letters (percent-encoded in its URLs); the grid changed just before its task is left is saved so', async ({ shell, ui }) => {
    // Last: a profile made and deleted here would take a folder number the tests before count on.
    const { id } = await shell.task.createProfile('Анна') as { id: string };
    const p = shell.profiles.get(id);
    await waitFor(() => p.browser);
    assert.ok(p.endpoint.endsWith(`/${shell.task.key}/${encodeURIComponent(id)}`));
    await p.newTab('about:blank').ready;
    assert.equal((await p.page()).url(), 'about:blank', 'Playwright reached its tab');
    await shell.task.deleteProfile(id);
    // The grid changed, and the task left at once: the change is in its saved grid (its save waits 300 ms, and leaving
    // dropped it: a pane of a profile deleted just before stayed there, and a saved grid naming a profile no longer
    // there is not restored at all). The grid's shape, its sizes aside.
    const task = shell.task, other = [...shell.current.tasks.values()].find((t) => t !== task && !t.entry.closed);
    const shape = (root: unknown) => JSON.stringify(root, (k, v) => (k === 'size' ? undefined : v));
    const saved = () => shape((task.store.layout() as { grid: { root: unknown } }).grid.root);
    // Left two frames after the change (dockview tells of it on a frame), well within the 300 ms.
    const columns = await ui(`window.__layoutPreset('columns'); new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => {
      r(JSON.stringify(window.__dock.toJSON().grid.root)); void kulisa.invoke('task:show', ${JSON.stringify(other.key)}); })))`);
    await waitFor(() => shell.task === other && other.loaded);
    await waitFor(() => saved() === shape(JSON.parse(columns))); // saved as it was left: it comes as the grid is taken down
    // Back: built again as it was left; then as the grid presets test left it, for the restart phase.
    await ui(`kulisa.invoke('task:show', ${JSON.stringify(task.key)})`);
    await waitFor(async () => shell.task === task && (await ui(`!document.documentElement.classList.contains('loading') && JSON.stringify(window.__dock.toJSON().grid.root)`)) &&
      shape(JSON.parse(await ui(`JSON.stringify(window.__dock.toJSON().grid.root)`))) === shape(JSON.parse(columns)));
    await ui(`window.__layoutPreset('grid')`);
    await waitFor(() => saved() !== shape(JSON.parse(columns)));
  });
  // Several agents in a task (tasks.ts; docs/tasks.md, "Several agents"): a tab and a conversation each; the task handed
  // from one to another. The test agent (custom) and the fake one (two accounts) are two CLIs, their transcripts both in
  // Claude Code's format (run.ts).
  test("agents: + opens any of the project's accounts, a new conversation in a tab of its own; each reports its own state, the task's tab the most urgent, and names its own tab; the task handed to another agent by its icon or Change agent…: a new tab told to go on with that conversation, the old one stays; New Conversation; deleting the task forgets every conversation", async (ctx) => {
    const { shell, ui, call } = ctx;
    const shown = shell.task; // shown again at the end: the restart phase finds it so
    const task = await newTask(ctx);
    const [a, b] = ['a', 'b'].map((x) => {
      const r = shell.accounts.prepare('fake');
      if (refused(r)) throw new Error(r.error);
      shell.accounts.create('project', r.id, 'fake', `${x}@switch.test`);
      return { id: r.id, dir: r.dir };
    });
    for (const x of [a, b]) await ui(`kulisa.invoke('project:agent-add', { id: 'project', agent: '${x.id}' })`);
    const tabs = () => ui(`[...document.querySelectorAll('.termtab')].map((t) => t.querySelector('.name').textContent + (t.classList.contains('active') ? ' *' : ''))`);
    const tabState = (id: number) => ui(`document.querySelector('.termtab[data-id="${id}"] .state').dataset.state`);
    const taskState = () => ui(`${taskTab(task.n)}.querySelector('.state').dataset.state`);
    const conversations = () => JSON.parse(fs.readFileSync(pfile('agent.json', task.n), 'utf8')).conversations;
    const newest = () => [...task.terminals.values()].at(-1);
    await waitFor(async () => JSON.stringify(await tabs()) === '["bash *"]');
    const bash = task.promptTarget();
    // The human trusted the project's code in another task's copy (a's config, as Claude Code keeps it): an agent of
    // that account opened here finds this copy trusted too, and does not ask (agents/, extendTrust).
    const copy = task.entry.copies[0], other = shell.store.tasksOf(task.project.entry).list.find((e) => e.n !== task.n && e.copies?.length).copies[0];
    fs.writeFileSync(path.join(a.dir, '.claude.json'), JSON.stringify({ projects: { [other.folder]: { hasTrustDialogAccepted: true } } }));

    // +: the project's accounts, then Terminal; one chosen opens in a tab of its own, in front, a new conversation.
    await ui(`document.getElementById('termAdd').click()`);
    const rows = await menuRows(ui);
    assert.deepEqual(rows.slice(-4), ['Fake agent · a@switch.test', 'Fake agent · b@switch.test', '-', 'Terminal']);
    await choose(ui, 'Fake agent · a@switch.test');
    await waitFor(async () => JSON.stringify(await tabs()) === '["bash","Fake agent *"]' && newest().pty, 20000);
    assert.equal(JSON.parse(fs.readFileSync(path.join(a.dir, '.claude.json'), 'utf8')).projects[copy.folder]?.hasTrustDialogAccepted, true);
    assert.ok(fs.existsSync(path.join(a.dir, 'skills', 'kulisa-profiles', 'SKILL.md')), "Kulisa's skill in the account's folder");
    const fake = newest();
    assert.equal(await ui(`document.querySelector('.termtab[data-id="${fake.id}"] .handover use').getAttribute('href')`), '#i-agent', "an agent without a mark of its own: the generic one");
    assert.deepEqual(conversations().map((c: { agent: string; terminal: number }) => [c.agent, c.terminal]), [['custom', bash.id], [a.id, fake.id]]);
    assert.equal(task.promptTarget(), fake, 'a pick goes to the agent shown');

    // Each its own state, from its own hooks; the task's tab shows the most urgent: waiting, then working.
    const hook = (t: TaskTerminal, event: string) => new Promise((r) => http.request(`${task.env(t).KULISA_URL}/hooks/${event}`, { method: 'POST' }, (res) => { res.resume(); res.on('end', r); }).end('{}'));
    await hook(fake, 'prompt');
    await waitFor(async () => (await tabState(fake.id)) === 'working' && (await taskState()) === 'working');
    assert.equal(await tabState(bash.id), '');
    await hook(bash, 'waiting');
    await waitFor(async () => (await tabState(bash.id)) === 'waiting' && (await taskState()) === 'waiting');
    // A tool finished: the human answered, it works again (no agent says so itself); one working or done stays so.
    await hook(bash, 'tool-done');
    await waitFor(async () => (await tabState(bash.id)) === 'working' && (await taskState()) === 'working');
    await hook(bash, 'waiting');
    await waitFor(async () => (await tabState(bash.id)) === 'waiting');
    await hook(bash, 'stop'); await hook(fake, 'stop');
    // Done in a tab behind: shown until the human brings it to the front.
    await waitFor(async () => (await tabState(bash.id)) === 'done' && (await tabState(fake.id)) === '');
    await hook(bash, 'tool-done');
    assert.equal(bash.state, 'done', 'a tool finished after the turn ended changes nothing');
    await click(ui, `document.querySelector('.termtab[data-id="${bash.id}"]')`);
    await waitFor(async () => (await tabState(bash.id)) === '' && (await taskState()) === '');
    assert.equal(task.promptTarget(), bash);

    // Each names its own tab, in 1 to 3 words; at the task's own URL there is no tab to name.
    assert.match((await call('conversation_rename', { name: ' Pay   with cards ' }, task, fake)).text, /^Your conversation is now "Pay with cards"\.$/);
    await waitFor(async () => JSON.stringify(await tabs()) === '["bash *","Pay with cards"]');
    await assert.rejects(call('conversation_rename', { name: 'one two three four' }, task, fake), /1 to 3 words/);
    await assert.rejects(call('conversation_rename', { name: 'x' }, task), /conversation_rename/);
    // Its conversation as Claude Code keeps it, reported at its session's start: read by the others in task_history.
    const folder = task.folder.replace(/[^A-Za-z0-9]/g, '-'), file = path.join(a.dir, 'projects', folder, 'f-1.jsonl');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, [{ type: 'user', message: { role: 'user', content: 'Pay with cards' } },
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'On it' }] } }].map((r) => JSON.stringify(r)).join('\n'));
    await new Promise((r) => http.request(`${task.env(fake).KULISA_URL}/hooks/session-start`, { method: 'POST' }, (res) => { res.resume(); res.on('end', r); })
      .end(JSON.stringify({ session_id: 'f-1', transcript_path: file })));
    await waitFor(() => conversations()[1].sessionId === 'f-1');
    assert.match((await call('task_history', {}, task, bash)).text, /2\. "Pay with cards": Fake agent · a@switch\.test, open in its tab, from [^\n]+\n {3}First request: "Pay with cards"/);

    // Its icon (Change Agent) hands the task to an agent of the project (this one too): what goes along shown, and the
    // one chosen opens in a new tab, told to go on with this conversation. The dialog stays over it while it reads,
    // and goes once it has read the last part of it.
    const dialogOpen = () => ui(`!!document.getElementById('handover')`);
    const progress = () => ui(`document.querySelector('#handover .progress').textContent`);
    await ui(`document.querySelector('.termtab[data-id="${fake.id}"] .handover').click()`);
    await waitFor(() => ui(`!!document.querySelector('#handover .choose .label')`));
    assert.deepEqual(await ui(`[...document.querySelectorAll('#handover .choose .label')].map((e) => e.textContent)`), rows.slice(0, -2));
    assert.match(await ui(`document.querySelector('#handover .baton').textContent`), /^task-\d+.*the whole conversation$/s);
    await ui(`document.querySelector('#handover [data-agent="${b.id}"] [role="radio"]').click()`);
    await ui(`document.getElementById('handoverstart').click()`);
    await waitFor(async () => JSON.stringify(await tabs()) === '["bash","Pay with cards","Fake agent *"]' && newest().pty, 20000);
    const handed = newest();
    // In front under the dialog from its start, as + opens one: a tab behind has no size, and its xterm laid out what
    // the agent drew for the island's size in 80 columns (broken, 2026-10-12).
    await waitFor(async () => (await ui('window.__term?.cols')) === handed.pty.spawnSize.cols);
    assert.equal(handed.agent.id, b.id);
    assert.equal(handed.pty.spawnArgs.at(-1), 'Go on with the work of conversation 2 of this task ("Pay with cards"). Read it whole with the kulisa task_history tool (conversation 2) before anything else. Then tell me in a few lines what is done and what is next, and go on with it.');
    await waitFor(async () => (await progress()) === 'Fake agent is starting…');
    await call('task_history', {}, task, handed);
    assert.ok(await dialogOpen(), 'the overview is not the conversation');
    await call('task_history', { conversation: 2 }, task, handed);
    await waitFor(async () => !(await dialogOpen()) && JSON.stringify(await tabs()) === '["bash","Pay with cards","Fake agent *"]');
    assert.ok(task.terminals.get(fake.id)?.pty, 'the tab it came from stays');
    // Change agent… (a tab's or a terminal's menu) opens it too. An agent that waits for the human (its hooks: a
    // permission, a sign-in, a limit) is shown at once; Show now shows it before it has read.
    ctx.answer = true; // closing an agent's tab asks
    for (const how of ['waiting', 'show']) {
      await rightClick(ui, `.termtab[data-id="${fake.id}"] .name`);
      assert.deepEqual(await menuRows(ui), ['Change agent…', 'New Conversation', '-', 'Close']);
      await choose(ui, 'Change agent…');
      await waitFor(() => ui(`!!document.querySelector('#handover .choose .label')`));
      await ui(`document.querySelector('#handover [data-agent="${b.id}"] [role="radio"]').click()`);
      await ui(`document.getElementById('handoverstart').click()`);
      await waitFor(async () => (await tabs()).length === 4 && newest().pty && (await progress()) !== '', 20000);
      const next = newest();
      if (how === 'waiting') await hook(next, 'waiting'); else await ui(`document.getElementById('handovershow').click()`);
      await waitFor(async () => !(await dialogOpen()) && (await tabs()).at(-1).endsWith(' *'));
      await ui(`act('terminal:close', { id: ${next.id} })`);
      await waitFor(async () => (await tabs()).length === 3);
    }
    // New Conversation: the same agent from nothing, in a tab of its own.
    await rightClick(ui, `.termtab[data-id="${bash.id}"] .name`);
    await menuRows(ui);
    await choose(ui, 'New Conversation');
    await waitFor(async () => JSON.stringify(await tabs()) === '["bash","Pay with cards","Fake agent","bash 2 *"]' && newest().pty, 20000);
    assert.deepEqual(conversations().map((c: { agent: string }) => c.agent), ['custom', a.id, b.id, b.id, b.id, 'custom']);
    // Its program not found: its tab came at once, starting, and the human is asked for another; none chosen, it goes.
    const bin = path.join(root, 'bin', 'kulisa-fake-agent');
    fs.renameSync(bin, `${bin}.away`);
    try {
      await ui(`void act('terminal:open', { agent: '${a.id}' })`); // it answers once the human has chosen
      await waitFor(() => ui(`document.querySelector('.terminals .starting')?.textContent === 'Starting Fake agent 2…'`)); // numbered: a's other tab is open
      await waitFor(() => ui(`!!document.getElementById('agentcancel')?.checkVisibility()`));
      await ui(`document.getElementById('agentcancel').click()`);
      await waitFor(async () => JSON.stringify(await tabs()) === '["bash","Pay with cards","Fake agent","bash 2 *"]' && !(await ui(`!!document.querySelector('.terminals .starting')`)));
    } finally { fs.renameSync(`${bin}.away`, bin); }

    // All closed, no profile open: the big buttons, an account's email under its agent's name, no keys; the first has
    // the keyboard, Tab moves to the next, Enter opens it.
    for (const t of [...task.terminals.values()]) await ui(`act('terminal:close', { id: ${t.id} })`);
    await waitFor(() => ui(`document.querySelectorAll('.launch .agents .launcher').length === 3`));
    assert.deepEqual(await ui(`[...document.querySelectorAll('.launch .agents .launcher')].map((l) => [l.querySelector('.name').textContent, l.querySelector('small')?.textContent ?? '', l.title])`),
      [['Fake agent', 'a@switch.test', 'Fake agent · a@switch.test'], ['Fake agent', 'b@switch.test', 'Fake agent · b@switch.test'], ['Terminal', '', 'Terminal']]);
    // Under them the project's profiles, a tile each.
    assert.deepEqual(await ui(`[...document.querySelectorAll('.launch .profiles .name')].map((n) => n.textContent)`), ['Sam.admin', 'Elon.buyer', 'Dora']);
    await waitFor(() => ui(`document.activeElement === document.querySelector('.launcher')`));
    await focusWindow(shell.win, ui);
    press(shell.win.webContents, 'Tab');
    await waitFor(() => ui(`document.activeElement === document.querySelectorAll('.launcher')[1]`));
    for (const type of ['keyDown', 'char', 'keyUp'] as const) shell.win.webContents.sendInputEvent({ type, keyCode: type === 'char' ? '\r' : 'Enter' });
    await waitFor(() => task.terminals.size === 1 && newest().agent?.id === b.id, 20000);

    // Deleting the task forgets every conversation, each in its account's folder.
    ctx.answer = true;
    await ui(`kulisa.invoke('task:delete', '${task.key}')`);
    await waitFor(() => !shell.current.tasks.has(task.n));
    assert.ok(!fs.existsSync(file), "the fake agent's, in its account");
    ctx.asked.length = 0;
    for (const x of [a, b]) {
      await ui(`kulisa.invoke('project:agent-remove', { id: 'project', agent: '${x.id}' })`);
      shell.accounts.drop(x.id); fs.rmSync(x.dir, { recursive: true, force: true });
    }
    await waitFor(() => !shell.windows[0].switching && ui(`!document.documentElement.classList.contains('loading')`));
    await click(ui, `document.querySelector('#projectTabs .tasktab[data-task="${shown.key}"]')`);
    await waitFor(() => shell.task === shown && shown.loaded);
  });

  // Last in phase 1: the tabs the restart phase finds (restart-tasks.ts).
  test('projects: another tab left in the background, with a terminal its agent ran something in', async ({ shell, ui, call }) => {
    await ui(`kulisa.invoke('project:open', { folder: ${JSON.stringify(path.join(root, 'other'))}, task: 1 })`);
    await waitFor(() => shell.current?.id === 'other' && shell.task.loaded);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    await call('terminal_run', { name: 'dev server', command: 'echo "served before"; sleep 60' });
    await waitFor(async () => /^served before$/m.test((await call('terminal_read', { name: 'dev server' })).text));
    await showProject(ui, 'project');
    await waitFor(() => shell.current?.id === 'project' && shell.task.loaded);
    assert.deepEqual(await projectTabs(ui), ['project *', 'project', 'other']);
  });
  test('projects: one left in a window of its own (restart-tasks.ts: the windows come back)', async ({ shell, ui }) => {
    const third = path.join(root, 'third');
    fs.mkdirSync(third, { recursive: true });
    await ui(`kulisa.invoke('project:open', { folder: ${JSON.stringify(third)} })`);
    await waitFor(() => shell.current?.id === 'third' && shell.task.loaded);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    await ui(`kulisa.invoke('task:move', { key: 'third/1', terminals: {} })`);
    await waitFor(() => shell.windows[1]?.current?.key === 'third/1' && !shell.windows[1].switching);
    // Smaller than the window's minimum (setBounds passes below it, the human's drag does not): it comes back at it.
    shell.windows[1].win.setBounds({ x: 40, y: 50, width: 10, height: 10 });
    await showProject(ui, 'project');
    await waitFor(() => shell.current?.id === 'project' && shell.task.loaded);
    assert.deepEqual(await projectTabs(ui), ['project *', 'project', 'other']);
  });
};
