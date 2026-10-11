// Tasks: each with its own copy of the code (a git worktree on a branch of its own; without git, the project's
// folder), copies of the profiles, its own agent; closing, opening again, renaming and deleting them; the projects'
// bar as tab groups, switching, the window with no project.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { assert, root, userData, project, pfile, savedTabs, panel, SITE, sleep, waitFor, who, menuRows, choose, manageProfiles, menuOpen, rightClick,
  box, pageBox, viewOn, dock, press, ctrl, near, projectTabs, projectTab, showProject, savedWindows, closeMenu, chosen, select, selectValues, click, plusMenu, PORT } = require('./helpers');
const { withOffset } = require('../src/main/tasks');
const hasDirenv = (() => { try { execFileSync('direnv', ['version']); return true; } catch { return false; } })();

const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=Kulisa test', '-c', 'user.email=test@example.invalid', ...args], { cwd, encoding: 'utf8' }).trim();
const tabs = (ui) => ui(`[...document.querySelectorAll('#tasklist .tasktab')].map((t) => t.querySelector('.name').textContent + (t.classList.contains('active') ? ' *' : ''))`);
const taskTab = (n) => `document.querySelector('#tasklist .tasktab[data-task$="/${n}"]')`;
const tasksFile = () => JSON.parse(fs.readFileSync(path.join(userData, 'projects', 'project', 'tasks.json'), 'utf8'));
// The bar's +, the shown project in its menu; resolves once the new task is shown, its agent started.
async function newTask(ctx) {
  const { shell, ui } = ctx;
  const before = shell.task;
  await plusMenu(ui, shell.current.name);
  await waitFor(() => shell.task !== before && shell.task.loaded && shell.pty, 20000);
  ctx.watchPty(shell.pty);
  return shell.task;
}
// A row of the shown project's group menu (its label's right-click), chosen.
async function groupMenu(ui, label) {
  await rightClick(ui, '#projectTabs .pisland.active .plabel');
  const rows = await menuRows(ui);
  if (label) await choose(ui, label);
  else await closeMenu(ui);
  return rows;
}
// One of the agent's hooks, as its plugin sends it (agent-hooks.js).
const hook = (task, event, input = {}) => new Promise((resolve) => require('http').request(`${task.env().KULISA_URL}/hooks/${event}`, { method: 'POST' },
  (res) => { res.resume(); res.on('end', resolve); }).end(JSON.stringify(input)));
// The session an agent reports at its start (its SessionStart hook, as Claude Code sends it): Kulisa resumes it.
const reportSession = (task, id, transcript) => hook(task, 'session-start', { hook_event_name: 'SessionStart', session_id: id, transcript_path: transcript, source: 'startup' });

module.exports = (test) => {
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
    assert.equal(shell.task.entry.worktree, undefined);
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
    fs.writeFileSync(path.join(project, '.gitignore'), '.env*\nconfig/local.json\ntranscript.jsonl\n');
    fs.writeFileSync(path.join(project, '.worktreeinclude'), 'config/local.json\n');
    fs.writeFileSync(path.join(project, 'README.md'), '# shop\n');
    git(project, 'add', '-A');
    git(project, 'commit', '-qm', 'first');
    fs.writeFileSync(path.join(project, '.env'), 'SECRET=1\n');
    fs.writeFileSync(path.join(project, '.envrc'), 'export FROM_ENVRC="envrc of $PWD"\n');
    if (hasDirenv) execFileSync('direnv', ['allow', project]); // the human allowed it in the project's folder
    fs.mkdirSync(path.join(project, 'config'), { recursive: true });
    fs.writeFileSync(path.join(project, 'config', 'local.json'), '{"db":"local"}');
    fs.writeFileSync(path.join(project, 'wip.txt'), 'not committed');
  });

  test('tasks: + makes task-<n> from the project\'s configuration: its worktree and branch, files outside git, its profiles closed until opened (each a copy of its master), its ports; the agent renames it', async (ctx) => {
    const { shell, ui, call } = ctx;
    const first = shell.task;
    await call('browser_navigate', { profile: 'sam-admin', url: `${SITE}/app?task` });
    const firstSam = first.profiles.get('sam-admin');
    const task = await newTask(ctx);
    const wt = `${project}@task-2`;
    assert.equal(task.n, 2);
    assert.equal(task.name, 'task-2');
    assert.equal(task.folder, wt);
    assert.equal(git(wt, 'rev-parse', '--abbrev-ref', 'HEAD'), 'task-2');
    assert.equal(git(wt, 'rev-parse', 'HEAD'), git(project, 'rev-parse', 'HEAD'), 'from HEAD (no remote here)');
    assert.equal(fs.readFileSync(path.join(wt, '.env'), 'utf8'), 'SECRET=1\n');
    assert.equal(fs.readFileSync(path.join(wt, 'config', 'local.json'), 'utf8'), '{"db":"local"}', '.worktreeinclude');
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
    // Signed in in this task's copy: there only (restart-tasks.js: it stays).
    await call('browser_navigate', { profile: 'sam-admin', url: `${SITE}/app/login?name=sam` });
    assert.equal(await who(ctx, 'sam-admin'), 'Signed in as sam');
    assert.equal(await who({ call: (n, a) => call(n, a, first) }, 'sam-admin'), 'Signed in as sam', "the first task's own sign-in");
    // The first task's profiles keep running, hidden; its agent sees its own.
    assert.ok(firstSam.tabs.every((t) => !t.wc.isDestroyed()) && !firstSam.get().view.getVisible());
    assert.equal(firstSam.get().wc.getURL(), `${SITE}/app?task`, "the new task's agent acts in its own copy");
    assert.match((await call('browser_snapshot', { profile: 'sam-admin' }, first)).text, /URL: .*\/app\?task/);
    assert.ok(first.pty && first.pty !== shell.pty);
    assert.equal(JSON.parse(fs.readFileSync(pfile('agent.json', 2), 'utf8')).agent, 'custom', "no agent in the project: the one there is (the tests' own)");

    // The window: the task's grid with its panes; the bar shows it.
    await waitFor(async () => JSON.stringify(await tabs(ui)) === '["task-1","task-2 *"]');
    await waitFor(() => viewOn(shell, ui, 'sam-admin'));
    assert.equal(await ui(`document.querySelectorAll('.pane').length`), 2);
    assert.match(await ui(`${taskTab(2)}.title`), /branch task-2 in .*project@task-2; the app's ports \+ 100/);

    // Its agent names it once it knows what it is about: the tab and the branch; the folder stays.
    await assert.rejects(call('task_rename', { name: 'a b' }), /only/);
    assert.match((await call('task_rename', { name: 'Feature-X' })).text, /now "Feature-X", on branch feature-x/);
    await waitFor(async () => JSON.stringify(await tabs(ui)) === '["task-1","Feature-X *"]');
    assert.equal(git(wt, 'rev-parse', '--abbrev-ref', 'HEAD'), 'feature-x');
    assert.equal(task.folder, wt);
    assert.deepEqual(tasksFile().list.map((e) => [e.name, e.branch]), [['task-1', undefined], ['Feature-X', 'feature-x']]);
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

  test('profiles: About this profile… opens Settings → Profiles at it; its Sign In… opens the same master window, once', async (ctx) => {
    const { shell, ui } = ctx;
    await rightClick(ui, `.ptab[data-panel="${panel(shell, 'sam-admin')}"] b`);
    await menuRows(ui);
    await choose(ui, 'About this profile…');
    await waitFor(() => ui(`document.getElementById('projects')?.dataset.state === 'open' && document.querySelector('#pjlist [data-tab="profiles"]').ariaSelected === 'true'
      && document.querySelector('#profilestab [data-profile="sam-admin"]')?.ariaSelected === 'true' && document.getElementById('profilename').value === 'Sam.admin'`));
    assert.ok(shell.profiles.has('sam-admin') && !shell.task.profiles.get('sam-admin').get().view.getVisible(), 'pages hidden under Settings');
    for (let i = 0; i < 2; i++) await ui(`document.getElementById('profilesignin').click()`);
    await waitFor(() => shell.masters.size === 1 && shell.masters.values().next().value.profile.get());
    assert.equal(shell.masters.values().next().value.profile.dir, path.join(userData, 'profiles', shell.profileStore.get('sam-admin').folder));
    shell.masters.values().next().value.win.close();
    await waitFor(() => !shell.masters.size);
    await ui(`document.querySelector('#projects .x').click()`);
    await waitFor(async () => !(await ui(`document.getElementById('projects')?.dataset.state === 'open'`)));
  });

  test("profiles: a real account's sign-in kept in step: signed in to a site (not local) in one task, it is in the others and the master; signed out, out everywhere; a local app's stays each task's", async (ctx) => {
    const { shell, call } = ctx;
    const first = shell.taskOf('project', 1), shop = `http://shop.example:${PORT}`;
    const inFirst = { call: (n, a) => call(n, a, first) };
    await call('browser_navigate', { profile: 'sam-admin', url: `${shop}/app/login?name=real` });
    assert.equal(await who(ctx, 'sam-admin'), 'Signed in as real');
    await waitFor(async () => (await first.profiles.get('sam-admin').session.cookies.get({ domain: 'shop.example' })).some((c) => c.value === 'real'));
    await call('browser_navigate', { profile: 'sam-admin', url: `${shop}/app` }, first);
    assert.equal(await who(inFirst, 'sam-admin'), 'Signed in as real', 'in the other task too');
    const master = require('electron').session.fromPath(shell.profileStore.masterDir(shell.profileStore.get('sam-admin').folder));
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
    // The shown task's tab has the profiles' button (👥, a menu of them), the others its room only; no number on any
    // (profiles are the agent's hands: how many are open says nothing).
    const chip = () => ui(`(() => { const b = document.getElementById('openProfiles'); return b.closest('.tasktab')?.dataset.task + ' ' + b.textContent.trim() + ' ' + document.querySelectorAll('#taskbar #openProfiles').length; })()`);
    const widths = () => ui(`[...document.querySelectorAll('#tasklist .tasktab')].map((t) => t.getBoundingClientRect().width)`);
    assert.equal(await chip(), `${second.key}  1`);
    assert.deepEqual(await ui(`[...document.querySelectorAll('#tasklist .tasktab .chip')].map((c) => [c.textContent.trim(), getComputedStyle(c).visibility])`),
      [['', 'hidden'], ['', 'visible']]);
    const before = await widths();
    // A tab's right-click menu: the shown one's has its profiles too, as the chip's; then renaming, its folder,
    // deleting. Show Folder opens the task's worktree in the file manager.
    await rightClick(ui, `#tasklist .tasktab[data-task$="/1"] .name`);
    assert.deepEqual(await menuRows(ui), ['Rename…', 'Show Folder', '-', 'Delete Task…']);
    await closeMenu(ui);
    const electron = require('electron'), openPath = electron.shell.openPath, shown = [];
    electron.shell.openPath = async (dir) => { shown.push(dir); return ''; };
    try {
      await rightClick(ui, `#projectTabs .tasktab[data-task="${second.key}"] .name`);
      const rows = await menuRows(ui);
      assert.deepEqual([rows[0], ...rows.slice(-7)], ['# Profiles', '-', 'Manage Profiles…', '-', 'Rename…', 'Show Folder', '-', 'Delete Task…']);
      assert.deepEqual(rows.slice(1, -7).toSorted(), ['Dora', 'Elon.buyer', 'Sam.admin'], 'its open and closed profiles');
      await choose(ui, 'Show Folder');
      await waitFor(() => shown.length === 1);
    } finally { electron.shell.openPath = openPath; }
    assert.equal(shown[0], second.folder);
    assert.notEqual(second.folder, project, "the task's own, not the project's");
    await click(ui, taskTab(1));
    await waitFor(() => shell.task.n === 1);
    await waitFor(async () => (await chip()) === `${shell.task.key}  1`); // the button goes with it
    assert.deepEqual(await widths(), before, 'the tabs keep their widths');
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
    assert.equal(sam.get().view.getVisible(), false, "the second task's pages are hidden");
    assert.ok(sam.tabs.every((t) => !t.wc.isDestroyed()) && second.pty, 'and alive, its agent too');
    await waitFor(async () => (await ctx.termText()).includes(`agent: rc of ${project}\n`), 3000);
    assert.equal(JSON.parse(fs.readFileSync(path.join(userData, 'projects', 'project', 'tasks.json'), 'utf8')).current, 1);
    // What the second task's agent does reaches its tab (Claude Code's hooks); its captions do not show on the first's panes.
    const http = require('http');
    const post = (event, input = {}) => new Promise((r) => http.request(`${second.env().KULISA_URL}/hooks/${event}`, { method: 'POST' },
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
    const esc = () => ui(`kulisa.send('pty:in', { task: '${second.key}', data: '\\x1b' })`);
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
    assert.equal(second.state, 'done', 'the agent is still done: only its tab says nothing');
    await click(ui, taskTab(1));
    await waitFor(async () => shell.task.n === 1 && (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer')
      && ui(`!document.documentElement.matches(':active-view-transition')`)); // its slide over before the next test watches one
  });

  test('tasks: switching replaces the grid at once (a view transition with no animation: the pages come with the terminal); then the pages are live again', async ({ shell, ui }) => {
    // The transition's types, and its animations once it runs: none, Chromium's own for its groups included (they
    // kept the pages, shown when it ends, 250 ms behind the terminal, in its place at once).
    const swap = (n) => ui(`(async () => {
      const start = document.startViewTransition.bind(document); let seen;
      document.startViewTransition = (o) => { const t = start(o); t.ready.then(() => { seen = { types: [...t.types],
        animations: document.getAnimations().filter((a) => a.effect?.pseudoElement?.startsWith('::view-transition')).length }; }); return t; };
      await kulisa.invoke('task:show', 'project/${n}');
      await new Promise((r) => setTimeout(r, 800));
      delete document.startViewTransition; // the document's own again
      return seen;
    })()`);
    const live = async () => (await ui(`document.querySelectorAll('img.snapshot').length`)) === 0 && viewOn(shell, ui, 'sam-admin');
    assert.deepEqual(await swap(2), { types: ['task', 'next'], animations: 0 });
    await waitFor(live);
    assert.deepEqual(await swap(1), { types: ['task', 'previous'], animations: 0 });
    await waitFor(live);
  });
  test('tasks: Ctrl+Shift+2 shows the second, Ctrl+Shift+PgUp and PgDn the one before and after, from the terminal too', async ({ shell, ui }) => {
    const win = shell.win.webContents;
    const shown = async (n) => { await waitFor(async () => shell.task.n === n && !shell.windows[0].switching && (await ui(`!document.documentElement.classList.contains('loading')`))); };
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
  test('tasks: × closes a task: its agent stops and its tabs close, all else stays; asked first only while its agent works; its group\'s menu opens it again, its conversation resumed', async (ctx) => {
    const { shell, ui, call } = ctx;
    const task = await newTask(ctx);
    assert.equal(task.n, 3);
    assert.equal(task.offset, 200);
    const transcript = path.join(root, 'task-3-transcript.jsonl');
    fs.writeFileSync(transcript, '');
    await reportSession(task, 's-3', transcript);
    const { sessionStart } = require('../src/main/agent-hooks');
    assert.match(sessionStart(task, { session_id: 's-3', transcript_path: transcript }).hookSpecificOutput.additionalContext,
      /task "task-3".*branch task-3.*plus 200/s, 'where it works, at the session start too');
    // Working: the human is asked, and may keep it.
    await hook(task, 'prompt');
    await waitFor(() => task.state === 'working');
    ctx.answer = false;
    await ui(`${taskTab(3)}.querySelector('.close').click()`);
    await waitFor(() => ctx.asked.length);
    assert.equal(ctx.asked.pop().message, 'Close the task task-3?');
    assert.ok(task.loaded && shell.task === task, 'kept open when the human says no');
    ctx.answer = true;
    await hook(task, 'stop'); // its turn over: closing asks nothing
    await waitFor(() => task.state === 'done');
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
    // Its project's group menu lists it; opening it shows it again, its agent resuming the conversation.
    const rows = await groupMenu(ui);
    assert.deepEqual(rows.slice(0, 4), ['New Task', '-', '# Closed tasks', 'task-3']);
    await groupMenu(ui, 'task-3');
    await waitFor(() => shell.task === task && task.loaded && shell.pty);
    ctx.watchPty(shell.pty);
    assert.equal(shell.resumedSession, 's-3');
    await waitFor(async () => JSON.stringify(await tabs(ui)) === '["task-1","Feature-X","task-3 *"]');
    assert.equal(tasksFile().list.find((e) => e.n === 3).closed, undefined);
  });

  test('tasks: Delete Task… asks first, saying what goes and any work not in main and not pushed; it goes with its branch, folder and profiles', async (ctx) => {
    const { shell, ui } = ctx;
    const empty = shell.task;
    const dir = path.join(userData, 'projects', 'project', '3');
    await rightClick(ui, `#tasklist .tasktab[data-task="${empty.key}"] .name`);
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
    assert.ok(fs.existsSync(path.join(root, 'task-3-transcript.jsonl')), "the test's own agent: Kulisa knows only Claude Code's conversations (agents.js)");
    assert.equal(git(project, 'branch', '--list', 'task-3'), '');
    await waitFor(async () => JSON.stringify(await tabs(ui)) === '["task-1","Feature-X *"]');

    // Renamed by the human (Rename… in its tab's menu), with a commit of its own and a file not committed.
    const spike = await newTask(ctx);
    await rightClick(ui, `#tasklist .tasktab[data-task="${spike.key}"] .name`);
    await menuRows(ui);
    await choose(ui, 'Rename…');
    await waitFor(() => ui(`(document.getElementById('taskrename')?.dataset.state === 'open') && document.getElementById('taskname').value === '${spike.name}'
      && document.activeElement.id === 'taskname'`));
    // Typed, and Enter (with its character, as a keyboard sends it: the form is sent on it): the dialog's form is sent.
    const wc = shell.win.webContents;
    await wc.insertText('Spike');
    for (const type of ['keyDown', 'char', 'keyUp']) wc.sendInputEvent({ type, keyCode: type === 'char' ? '\r' : 'Enter' });
    await waitFor(async () => spike.name === 'Spike' && !(await ui(`(document.getElementById('taskrename')?.dataset.state === 'open')`)));
    assert.equal(spike.entry.branch, 'spike');
    assert.equal(spike.folder, `${project}@task-${spike.n}`, 'the folder stays');
    fs.writeFileSync(path.join(spike.folder, 'idea.txt'), 'x');
    git(spike.folder, 'add', '-A'); git(spike.folder, 'commit', '-qm', 'idea');
    fs.writeFileSync(path.join(spike.folder, 'more.txt'), 'y');
    const remove = async (answer) => {
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

  // ☰ → Agents…: Settings on its Agents tab, nothing to choose; it closes as any dialog.
  const openAgents = async (ui, rows = 2) => {
    await ui(`document.getElementById('windowMenu').click()`);
    await menuRows(ui);
    await choose(ui, 'Agents…');
    // It opens with the agents in it, not with a line that flips to them.
    await waitFor(() => ui(`(document.getElementById('projects')?.dataset.state === 'open') && document.querySelector('#projects [data-tab="agents"]').ariaSelected === 'true'
      && document.querySelectorAll('#projects .agtab .agentrow').length === ${rows}`), 20000);
  };
  const closeAgents = async (ui) => {
    await ui(`document.querySelector('#projects header .x').click()`);
    await waitFor(async () => !(await ui(`(document.getElementById('projects')?.dataset.state === 'open')`)));
  };
  const agentRow = (id, q) => `document.querySelector('#projects .agtab [data-agent="${id}"] ${q}')`;
  test('agents: ☰ → Agents… is Settings → Agents: shows the agents (not the terminal only), what is installed and installs the others; nothing is chosen or started', async (ctx) => {
    const { shell, ui } = ctx;
    const pty = shell.task.pty;
    await openAgents(ui);
    assert.equal(await ui(`document.querySelector('#projects h2').textContent`), 'Settings');
    assert.equal(await ui(`document.getElementById('pjconfig').checkVisibility()`), false, "a project's page behind it");
    assert.equal(await ui(`document.querySelectorAll('#projects .agtab .agentrow [role="radio"]').length`), 0, 'no choice to make');
    // The agents' marks (the terminal only's shown in choosing a task's agent).
    assert.ok(await ui(`!!document.querySelector('.sprite #i-agent-shell') && !!document.querySelector('.sprite #i-agent-claude') && !!document.querySelector('.sprite #i-agent-codex')`));
    assert.equal(await ui(`!!${agentRow('shell', '')}`), false, 'not the terminal only: nothing of it to set up');
    assert.equal(await ui(`document.querySelector('#projects .agtab [data-accounts="fake"] .empty')?.textContent`), 'No accounts yet.');
    assert.equal(await ui(`document.querySelector('#projects .agtab [data-accounts="fake"] .accountnew').disabled`), true, 'not installed: no account yet');
    assert.equal(await ui(agentRow('fake', '.status') + '.textContent'), 'Not installed');
    assert.equal(await ui(agentRow('fake', '.install') + '.hidden'), false);
    assert.match(await ui(agentRow('fake', '.install-line') + '.textContent'), /^Install runs Kulisa tests's installer: echo "installing the fake agent"/);
    assert.equal(shell.task.profiles.values().next().value.get().view.getVisible(), false, 'pages hidden under the dialog');
    // Installed with its maker's installer; what it said only under Details.
    await ui(agentRow('fake', '.install') + '.click()');
    await waitFor(async () => (await ui(agentRow('fake', '.status') + '.textContent')) === 'Installed', 10000);
    assert.match(await ui(`document.querySelector('#projects .agtab .progress').textContent`), /^Fake agent is installed\. Make an account of it below/);
    assert.equal(await ui(`document.querySelector('#projects .agtab .details .more').dataset.state`), 'closed', "the installer's own output only under Details");
    assert.match(await ui(`document.querySelector('#projects .agtab pre').textContent`), /installing the fake agent\s+done/);
    assert.doesNotMatch(await ui(`document.querySelector('#projects .agtab pre').textContent`), /\x1b/, 'no terminal codes: colors, links');
    assert.equal(await ui(`document.querySelector('#projects .agtab [data-accounts="fake"] .accountnew').disabled`), false);
    await closeAgents(ui);
    assert.equal(shell.task.pty, pty, 'the agent goes on');
  });

  test("tasks: another agent for a task (Change agent…): the project's accounts and the terminal alone; Cancel leaves it as it is", async (ctx) => {
    const { shell, ui } = ctx;
    // The new task runs the project's default agent (none here: the one there is); Change agent… (the terminal's menu)
    // picks another: an agent itself only when it has no accounts (the terminal only), else one of the project's
    // accounts (none here yet).
    const task = await newTask(ctx);
    await ctx.call('profile_open', { profile: 'sam-admin' });
    const changeAgent = async () => {
      await rightClick(ui, '#term');
      await menuRows(ui);
      await choose(ui, 'Change agent…');
      await waitFor(() => ui(`(document.getElementById('agentpick')?.dataset.state === 'open') && document.querySelectorAll('#agentpick .agentrow').length === 2`), 20000);
    };
    const customPty = task.pty;
    await changeAgent();
    assert.equal(await ui(`!!document.querySelector('#agentpick [role="radio"][value="fake"]')`), false, 'an agent with accounts: one of its accounts');
    assert.equal(await ui(`document.querySelector('#agentpick [data-agent="shell"] .logo use').getAttribute('href')`), '#i-agent-shell');
    assert.equal(task.profiles.get('sam-admin').get().view.getVisible(), false, 'pages hidden under the dialog');
    // A wrong choice is not a trap: Cancel leaves it as it is.
    assert.equal(await ui(`document.getElementById('agentcancel').hidden`), false);
    await ui(`document.getElementById('agentcancel').click()`);
    await waitFor(async () => !(await ui(`(document.getElementById('agentpick')?.dataset.state === 'open')`)));
    await sleep(300); // nothing to wait for: that no other agent starts
    assert.equal(task.pty, customPty, 'Cancel: the agent goes on');
    await changeAgent();
    await ui(`document.querySelector('#agentpick [role="radio"][value="shell"]').click()`);
    await ui(`document.getElementById('agentstart').click()`);
    await waitFor(() => task.pty && task.pty !== customPty);
    assert.deepEqual(JSON.parse(fs.readFileSync(pfile('agent.json', task.n), 'utf8')), { agent: 'shell', started: true }, 'a new conversation');
    assert.equal(task.agent.id, 'shell');
    // Left closed for the restart phase (restart-tasks.js).
    await ui(`${taskTab(task.n)}.querySelector('.close').click()`);
    await waitFor(() => task.entry.closed && !task.loaded && shell.task.n === 2);
    assert.equal(ctx.asked.length, 0);
  });

  test('agents: once installed, the Agents window shows its version and where it is', async (ctx) => {
    const { ui } = ctx;
    await openAgents(ui);
    assert.equal(await ui(agentRow('fake', '.status') + '.textContent'), 'Installed');
    assert.equal(await ui(agentRow('fake', '.install') + '.hidden'), true);
    assert.equal(await ui(agentRow('fake', '.where') + '.textContent'),
      `1.2.3 · ${path.join(root, 'bin', 'kulisa-fake-agent')} · not on your PATH: Kulisa runs it from here`);
    assert.equal(await ui(agentRow('fake', '.install-line') + '.textContent'), '');
    await ctx.shell.screenshot(path.join(root, 'agents.png'));
    await closeAgents(ui);
  });
  test('agents: the list comes at once with what the last look found, then looks again: an agent removed meanwhile shows so', async (ctx) => {
    const { ui } = ctx;
    const bin = path.join(root, 'bin', 'kulisa-fake-agent'), away = `${bin}.away`;
    const fake = (cached) => ui(`kulisa.invoke('agents:list', { details: true, cached: ${cached} }).then((r) => r.list?.find((a) => a.id === 'fake'))`);
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

  // The project's settings (Project Settings… in its label's menu), with its agents.
  const projectSettings = async (ui, id = 'project') => {
    await rightClick(ui, `#projectTabs [data-project="${id}"] .name`);
    await menuRows(ui);
    await choose(ui, 'Project Settings…');
    await waitFor(() => ui(`(document.getElementById('projects')?.dataset.state === 'open') && !!document.getElementById('npagentsrow')`));
  };
  // A new profile on a project's page: + → New Profile…, its name typed in place, Create.
  const newProfileHere = async (ui, name) => {
    await ui(`document.getElementById('npprofileadd').click()`);
    await choose(ui, 'New Profile…');
    await waitFor(() => ui(`document.activeElement?.id === 'npnewprofile'`));
    await ui(`(() => { const n = document.getElementById('npnewprofile'); n.value = ${JSON.stringify(name)}; n.dispatchEvent(new Event('input')); document.getElementById('npprofilenew').click(); })()`);
  };
  // The look's panel, from the icon at a project's page's top: its colors and icons.
  const openLook = async (ui) => {
    await ui(`document.getElementById('pjlook').click()`);
    await waitFor(() => ui(`!!document.querySelector('.pjlookpanel.ready #npicons')`));
  };
  // A list's row selected (a click), then a button of its toolbar acting on it (− removes, ★ makes it the default).
  const onRow = async (ui, row, button, buttonAt = `#${button}`) => {
    await ui(`document.querySelector(${JSON.stringify(row)}).click()`);
    await waitFor(() => ui(`document.querySelector(${JSON.stringify(row)})?.ariaSelected === 'true' && !document.querySelector(${JSON.stringify(buttonAt)}).disabled`));
    await ui(`document.querySelector(${JSON.stringify(buttonAt)}).click()`);
  };
  // The page shown: its name in place at its top.
  const pageOf = (name) => `(document.getElementById('npname')?.value === ${JSON.stringify(name)} && !!document.getElementById('pjhead'))`;
  const closeSettings = async (ui) => {
    await ui(`document.querySelector('#projects .x').click()`);
    await waitFor(async () => !(await ui(`(document.getElementById('projects')?.dataset.state === 'open')`)));
  };
  // New Account… of the fake agent: its own sign-in starts at once; resolves with its terminal's pty (the sign-in
  // waiting for the human), once its page is open in Kulisa's clean browser.
  const signIn = async (ctx) => {
    const { shell, ui } = ctx;
    shell.signins.clear();
    await ui(`document.getElementById('npagentadd').click()`);
    assert.deepEqual((await menuRows(ui)).slice(-2), ['# New Account', 'Fake agent…'], 'the agents that have accounts, after the ones to add');
    await choose(ui, 'Fake agent…');
    await waitFor(() => shell.signins.size);
    const p = [...shell.signins.values()][0];
    await waitFor(() => p.tail.includes('Sign in as?') && [...shell.signinWindows][0]?.profile.get()?.wc.getURL() === `${SITE}/app?signin`);
    return p;
  };
  const accountDir = (id) => path.join(userData, 'agents', id);
  const logouts = () => { try { return fs.readFileSync(path.join(root, 'logouts'), 'utf8').trim().split('\n'); } catch { return []; } };
  test("agents: a new account is made in the project's settings: the agent's own sign-in at once, in a terminal there (under Details), its page in a clean browser of Kulisa's (its site alone over it); named by the email it signed in to; a task runs it with its folder", async (ctx) => {
    const { shell, ui } = ctx;
    await projectSettings(ui);
    let p = await signIn(ctx);
    const dir = accountDir('fake-1');
    assert.ok(fs.existsSync(dir), 'its folder, a fixed id: never renamed');
    assert.ok(await ui(`!!document.querySelector('#npsigninterm .xterm') && !document.getElementById('npsigninterm').checkVisibility()`),
      'the sign-in in a terminal of the dialog, under Details: what it says the window shows');
    // The page it opens is in a clean browser of Kulisa's, not the user's: a session in memory, no sign-in of theirs.
    const clean = [...shell.signinWindows][0];
    assert.equal(clean.profile.session.isPersistent(), false, 'nothing of it on disk');
    // Its bar as an OAuth popup's: the site it is on, nothing to go elsewhere.
    const bar = () => clean.win.webContents.executeJavaScript(`[document.getElementById('site')?.textContent.trim(), !!document.querySelector('#address, #back, #forward, #reload')]`);
    await waitFor(async () => (await bar())[0] === `Not secure · ${new URL(SITE).host}`);
    assert.equal((await bar())[1], false);
    assert.deepEqual(await clean.profile.session.cookies.get({ url: SITE }), []);
    p.write('Work@Shop.com\r');
    await waitFor(() => ui(`!!document.querySelector('#npagents [data-agent="fake-1"]') && !document.getElementById('npsignin')`));
    await waitFor(() => !shell.signinWindows.size && clean.win.isDestroyed(), 5000); // closed once the sign-in ended
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
    // Its clean browser closed by the human: no sign-in, nothing kept.
    p = await signIn(ctx);
    [...shell.signinWindows][0].win.close();
    await waitFor(async () => !shell.signins.size && !shell.signinWindows.size && !fs.existsSync(accountDir('fake-3')) && !(await ui(`document.getElementById('npsigninerror').textContent`)));
    // Cancelled: nothing kept; + adds again (not while a sign-in is shown).
    assert.equal(await ui(`document.getElementById('npagentadd').disabled`), true);
    await ui(`document.getElementById('npsignincancel').click()`);
    await waitFor(() => ui(`!document.getElementById('npsignin') && !document.getElementById('npagentadd').disabled`));
    p = await signIn(ctx);
    await ui(`document.getElementById('npsignincancel').click()`);
    await waitFor(async () => !fs.existsSync(accountDir('fake-4')) && !shell.signinWindows.size && !(await ui(`!!document.getElementById('npsignin')`)));
    // Not signed in (the agent's sign-in ended without it): said so, Try Again.
    p = await signIn(ctx);
    p.write('\r');
    await waitFor(async () => /Not signed in/.test(await ui(`document.getElementById('npsigninerror').textContent`)));
    assert.equal(await ui(`document.getElementById('npsigninstart').hidden`), false);
    assert.ok(await ui(`document.getElementById('npsigninterm').checkVisibility() && !!document.querySelector('#npsigninterm .xterm')`),
      'its Details open by itself, with what the agent said');
    assert.ok(!fs.existsSync(accountDir('fake-5')));
    await ui(`document.getElementById('npsignincancel').click()`);
    await closeSettings(ui);
    // A task runs it: the agent with its folder in its variable. Choosing a task's agent lists the project's accounts.
    const task = await newTask(ctx);
    await waitFor(() => task.agent?.id === 'fake-1', 20000); // the project's default: its one account
    ctx.watchPty(task.pty);
    await waitFor(async () => (await ctx.termText()).includes(`config [${dir}]`));
    // Its shell gets none of direnv's state from where Kulisa was started: the user's direnv hook took the task's folder
    // for a folder left, undid that .envrc's changes and with them the account's variable, and the agent ran with the
    // user's own sign-in (2026-10-11, Kulisa started from the repository's folder).
    if (process.platform === 'linux') {
      assert.deepEqual(fs.readFileSync(`/proc/${task.pty.pid}/environ`, 'utf8').split('\0').filter((v) => v.startsWith('DIRENV_')), []);
    }
    await rightClick(ui, '#term');
    await menuRows(ui);
    await choose(ui, 'Change agent…');
    await waitFor(() => ui(`(document.getElementById('agentpick')?.dataset.state === 'open') && !!document.querySelector('#agentpick [role="radio"][value="fake-1"]')`), 20000);
    await ui(`document.getElementById('agentcancel').click()`);
    await waitFor(async () => !(await ui(`(document.getElementById('agentpick')?.dataset.state === 'open')`)));
  });

  test("agents: an account lives until deleted in Settings → Agents: let go by its project at once, kept; not deleted while a task runs it; deleted after a question, signed out, with its folder; one made there is in no project", async (ctx) => {
    const { shell, ui } = ctx;
    const task = shell.task, dir = accountDir('fake-1');
    const row = (id) => `document.querySelector('#projects .agtab [data-account="${id}"]')`;
    // An account deleted: its row selected, then − over its list.
    const deleteAccount = (id) => onRow(ui, `#projects .agtab [data-account="${id}"]`, null, `#projects .agtab .list:has([data-account="${id}"]) .accountdel`);
    // × in the project lets go of it at once, nothing asked; the account stays, and the task running it keeps it.
    await projectSettings(ui);
    await onRow(ui, '#npagents [data-agent="fake-1"]', 'npagentdel');
    await waitFor(() => ui(`!document.querySelector('#npagents [data-agent="fake-1"]')`));
    assert.equal(ctx.asked.length, 0);
    assert.deepEqual(shell.accounts.find('fake-1').projects, [], 'kept, in no project');
    assert.equal(task.agent.id, 'fake-1');
    assert.ok(fs.existsSync(dir));
    // Its tab: the account in no project; Delete refused while a task runs it.
    await click(ui, `document.querySelector('#projects [data-tab="agents"]')`);
    await waitFor(() => ui(`!!${row('fake-1')}`));
    assert.equal(await ui(`${row('fake-1')}.querySelector('small').textContent`), 'in no project');
    await deleteAccount('fake-1');
    const said = () => ui(`document.getElementById('agentstaberror').textContent`);
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
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(userData, 'agents.json'), 'utf8')), { next: 6, list: [] });
    ctx.asked.length = 0;
    // New Account… there: signed in in the tab, in no project; a project's Add Agent… takes it.
    shell.signins.clear();
    await ui(`document.querySelector('#projects .agtab [data-accounts="fake"] .accountnew').click()`);
    await waitFor(() => shell.signins.size);
    const p = [...shell.signins.values()][0];
    await waitFor(() => p.tail.includes('Sign in as?'));
    p.write('home@shop.com\r');
    await waitFor(() => ui(`!!${row('fake-6')} && !document.getElementById('npsignin')`));
    assert.equal(await ui(`${row('fake-6')}.querySelector('.label').textContent`), 'home@shop.com');
    assert.deepEqual(shell.accounts.find('fake-6').projects, []);
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
    await click(ui, `document.querySelector('#projects [data-tab="agents"]')`);
    await waitFor(() => ui(`!!${row('fake-6')}`));
    await deleteAccount('fake-6');
    await waitFor(() => !fs.existsSync(accountDir('fake-6')) && !shell.accounts.find('fake-6'));
    ctx.asked.length = 0;
    await closeAgents(ui);
  });

  // Last in phase 1: task-1 is shown, Feature-X waits in the bar and task-5 is closed, for the restart phase.
  test('tasks: × on the last open task closes its group, as Chrome\'s tab group goes with its last tab, nothing asked; a task opens it again', async (ctx) => {
    const { shell, ui } = ctx;
    const first = shell.current.tasks.get(1), second = shell.current.tasks.get(2);
    await ui(`${taskTab(1)}.querySelector('.close').click()`);
    await waitFor(() => first.entry.closed && !first.loaded && shell.task === second);
    await waitFor(async () => JSON.stringify(await tabs(ui)) === '["Feature-X *"]');
    assert.equal(ctx.asked.length, 0);
    await ui(`${taskTab(2)}.querySelector('.close').click()`);
    await waitFor(() => shell.task === null && !shell.current);
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
    assert.equal(await ui(`document.getElementById('tasks')?.checkVisibility() ?? false`), false, 'no tasks shown');
    assert.deepEqual(await projectTabs(ui), [], 'no project tab');
    assert.equal(await ui(`document.documentElement.style.getPropertyValue('--project')`), '', "no project's color");
    assert.equal(shell.win.getTitle(), 'Kulisa');
    assert.deepEqual(savedWindows(), [{ tabs: [], shown: null }], 'the window opens so next time');
    // The empty window's New Task opens the bar's + menu: every project with its icon in its color, as on its label in
    // the bar, and its closed tasks set in under it, the one closed last first (all are closed here); New Project… last.
    await ui(`document.getElementById('emptynewtask').click()`);
    const rows = await menuRows(ui);
    assert.deepEqual(await ui(`[...document.querySelectorAll('.menu[data-state="open"] .item:not(.inset) .picon')].map((i) => i.querySelector('use')?.getAttribute('href') ?? null)`),
      shell.store.projects().map((p) => (p.icon === 'favicon' ? null : p.icon && p.icon !== 'logo' ? `#i-p-${p.icon}` : '#i-logo')));
    const byClosing = tasksFile().list.filter((e) => e.closed).sort((a, b) => b.closedAt - a.closedAt).map((e) => `  ${e.name}`);
    assert.deepEqual(rows.slice(rows.indexOf('project') + 1, rows.indexOf('project') + 1 + byClosing.length), byClosing);
    assert.equal(byClosing[0], '  Feature-X');
    assert.deepEqual(rows.slice(0, 1).concat(rows.slice(-2)), ['# New Task of', '-', 'New Project…']);
    await closeMenu(ui);
    // A closed task of it opens its group again, on that task; the others wait in its group's menu.
    await plusMenu(ui, 'project', 'Feature-X');
    await waitFor(() => shell.task?.n === 2 && shell.task.loaded && shell.pty);
    ctx.watchPty(shell.pty);
    await waitFor(() => ui(`!document.documentElement.classList.contains('noproject') && !document.documentElement.classList.contains('loading')`));
    await waitFor(async () => JSON.stringify(await tabs(ui)) === '["Feature-X *"]');
    assert.deepEqual((await groupMenu(ui)).slice(0, 5), ['New Task', '-', '# Closed tasks', 'task-1', 'task-5'], 'the one closed last first');
    await groupMenu(ui, 'task-1');
    await waitFor(() => shell.task?.n === 1 && shell.task.loaded && shell.pty);
    ctx.watchPty(shell.pty);
    await waitFor(async () => JSON.stringify(await tabs(ui)) === '["task-1 *","Feature-X"]');
    assert.equal(shell.current.tasks.get(2).loaded, true, 'the other open one stays loaded');
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
  });

  test('tasks: a click on a group\'s label folds it to the tab of the task it shows, as Chrome\'s tab groups; kept', async (ctx) => {
    const { shell, ui } = ctx;
    const shown = () => ui(`[...document.querySelectorAll('#projectTabs .pisland.active .tasktab')].filter((t) => t.checkVisibility()).map((t) => t.querySelector('.name').textContent)`);
    await ui(`document.querySelector('#projectTabs .pisland.active .plabel').click()`);
    await waitFor(async () => JSON.stringify(await shown()) === '["task-1"]');
    assert.equal(tasksFile().collapsed, true);
    assert.equal(shell.current.collapsed, true);
    await ui(`document.querySelector('#projectTabs .pisland.active .plabel').click()`);
    await waitFor(async () => JSON.stringify(await shown()) === '["task-1","Feature-X"]');
    assert.equal(tasksFile().collapsed, undefined);
  });

  test('the empty window: Close Group in the group\'s panel; links in ☰ open in the browser; at the first start the manager on New Project; New Project… asks where its folder goes', async (ctx) => {
    const { shell, ui } = ctx;
    assert.deepEqual((await groupMenu(ui, 'Close Group')).slice(-2), ['-', 'Close Group']);
    await waitFor(() => shell.task === null && !shell.current);
    await waitFor(() => ui(`document.documentElement.classList.contains('noproject')`));
    await ui(`document.getElementById('windowMenu').click()`);
    const links = await menuRows(ui);
    assert.deepEqual(links.slice(links.indexOf('Documentation'), links.indexOf('Documentation') + 3), ['Documentation', 'GitHub', 'Report an issue']);
    const electron = require('electron'), openExternal = electron.shell.openExternal, opened = [];
    electron.shell.openExternal = async (url) => { opened.push(url); };
    try {
      await choose(ui, 'Documentation');
      await waitFor(() => opened.length === 1);
    } finally { electron.shell.openExternal = openExternal; }
    assert.equal(opened[0], 'https://github.com/cosmotools/kulisa#readme');
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
    // Not its color or icon (the next free color, the curtain; changed on its page), no agent: its accounts are made
    // on its page, which Create goes on to.
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
    const named = (n) => ui(`(() => { const i = document.getElementById('npname'); i.value = ${JSON.stringify(n)}; i.dispatchEvent(new Event('input')); })()`);
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
    // Created, no task is made: Settings shows its page, and New Task makes one (no question where).
    assert.equal(await ui(`document.getElementById('npwhere').textContent`), `The project will be created in ${path.join(made, 'Shop')}`);
    ctx.asked.length = 0;
    await ui(`document.getElementById('npform').requestSubmit()`);
    await waitFor(() => ui(`${pageOf('Shop')} && !!document.getElementById('npagentsrow')
      && !document.getElementById('npnewtask').hidden && document.querySelector('#pjlist [data-project="shop"]')?.ariaSelected === 'true'`));
    assert.ok(!shell.current && !shell.open.has('shop'), 'made, no task');
    assert.equal(ctx.asked.length, 0, 'nothing asked');
    assert.deepEqual([shell.store.projects().find((p) => p.id === 'shop').color, shell.store.projects().find((p) => p.id === 'shop').icon], [color, 'logo']);
    // Another color and icon: the icon at its top opens them; each saved as it is chosen, the panel left open.
    await openLook(ui);
    assert.deepEqual(await ui(`[...document.querySelectorAll('#npcolors [aria-selected="true"], #npicons [aria-pressed="true"]')].map((b) => b.dataset.value)`), [color, 'logo']);
    await ui(`document.querySelectorAll('#npcolors [role="option"]')[3].click(); document.querySelector('#npicons [data-value="rocket"]').click()`);
    await waitFor(() => shell.store.projects().find((p) => p.id === 'shop').icon === 'rocket');
    assert.equal(await ui(`document.querySelector('#pjlook use').getAttribute('href')`), '#i-p-rocket');
    await closeMenu(ui);
    await waitFor(() => ui(`!document.querySelector('.pjlookpanel') && document.getElementById('projects')?.dataset.state === 'open'`));
    await ui(`document.getElementById('npnewtask').click()`);
    await waitFor(() => shell.current?.folder === path.join(made, 'Shop') && shell.task?.loaded && shell.pty);
    assert.ok(fs.existsSync(path.join(made, 'Shop', '.git')), 'git init in it');
    const shop = shell.store.projects().find((p) => p.id === 'shop');
    assert.deepEqual([shop.color, shop.icon, shop.agents], [require('../src/main/store').PROJECT_COLORS[3], 'rocket', undefined]);
    assert.equal(await ui(`${projectTab('shop')}.querySelector('.plabel use').getAttribute('href')`), '#i-p-rocket');
    assert.equal(git(path.join(made, 'Shop'), 'log', '--format=%s'), 'Initial commit', 'an empty first commit');
    assert.equal(shell.task.folder, path.join(made, 'Shop@task-1'), 'so its first task has a copy of its own');
    assert.equal(await ui(`(document.getElementById('projects')?.dataset.state === 'open')`), false);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    await plusMenu(ui, 'project', 'task-1'); // a closed task in the bar's +: its group opens again on it
    await waitFor(() => shell.current?.folder === project && shell.task?.n === 1 && shell.task.loaded && shell.pty);
    ctx.watchPty(shell.pty);
    await waitFor(() => ui(`!document.documentElement.classList.contains('noproject') && !document.documentElement.classList.contains('loading')`));
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
    // Feature-X, closed with its group, opened again from the group's menu (the tests after and the restart expect it).
    await groupMenu(ui, 'Feature-X');
    await waitFor(() => shell.task?.n === 2 && shell.task.loaded && !shell.windows[0].switching);
    await click(ui, taskTab(1));
    await waitFor(() => shell.task?.n === 1 && shell.task.loaded && !shell.windows[0].switching);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    assert.deepEqual(await projectTabs(ui), ['Shop', 'project *']);
    // Another project's task, in its island: a click shows that project with it.
    await click(ui, `${projectTab('shop')}.querySelector('.tasktab[data-task="shop/1"]')`);
    await waitFor(() => shell.current?.id === 'shop' && shell.task?.key === 'shop/1' && shell.task.loaded && !shell.windows[0].switching);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    assert.deepEqual(await projectTabs(ui), ['Shop *', 'project']);
    await showProject(ui, 'project');
    await waitFor(() => shell.current?.id === 'project' && shell.task.loaded);
    // Its tabs have their × too, in its group while another project is shown: its last one closes it.
    await ui(`${projectTab('shop')}.querySelector('.tasktab[data-task="shop/1"] .close').click()`);
    await waitFor(() => !shell.open.has('shop'));
    assert.equal(shell.current?.id, 'project', 'the shown project stays');
    ctx.asked.length = 0;
  });

  test('projects: the projects\' manager (Project Settings…) changes its name, color, icon and agents, the default one + runs; a folder with a favicon gets it as its icon', async (ctx) => {
    const { shell, ui } = ctx;
    const site = path.join(root, 'site');
    fs.mkdirSync(path.join(site, 'public'), { recursive: true });
    fs.writeFileSync(path.join(site, 'public', 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="red"/></svg>');
    await ui(`kulisa.invoke('project:open', { folder: ${JSON.stringify(site)} })`);
    await waitFor(() => shell.current?.id === 'site' && shell.task?.loaded && shell.pty);
    ctx.watchPty(shell.pty);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    assert.equal(shell.store.projects().find((p) => p.id === 'site').icon, 'favicon');
    await waitFor(() => ui(`${projectTab('site')}.querySelector('.favicon').src.startsWith('data:image/svg+xml;base64,')`));
    // Its settings: the favicon among the icons to choose from, the folder shown and not changed.
    await rightClick(ui, `#projectTabs [data-project="site"] .name`);
    await menuRows(ui);
    await choose(ui, 'Project Settings…');
    await waitFor(() => ui(`(document.getElementById('projects')?.dataset.state === 'open') && ${pageOf('site')}`));
    // The manager lists every project, this one chosen (none marked open: a project is no thing to open).
    assert.ok(await ui(`document.querySelector('#pjlist [data-project="site"]').ariaSelected === 'true' && !document.querySelector('#pjlist kbd')`));
    assert.equal(await ui(`document.querySelector('#pjlook .picon').matches('.favicon')`), true);
    assert.equal(await ui(`document.querySelector('#nprepos [data-folder] small').textContent`), site, 'its folder, as its code');
    assert.equal(await ui(`!!document.getElementById('nplocationrow')`), false);
    // A page, no Save: its top (New Task, ⋯), each part saved as it changes; the dialog stays open.
    assert.equal(await ui(`!!document.getElementById('npcreate') || !!document.querySelector('#projects footer')`), false, 'no Save, no Cancel');
    assert.equal(await ui(`[...document.querySelectorAll('#pjconfig .titled, #pjconfig .field > label')].map((h) => h.textContent).join(', ')`),
      'Name:, Code, Agents, Profiles, Local addresses:');
    await openLook(ui);
    assert.equal(await ui(`document.querySelector('#npicons [aria-pressed="true"]').dataset.value`), 'favicon');
    const entryOf = () => shell.store.projects().find((p) => p.id === 'site');
    await ui(`(() => { document.querySelectorAll('#npcolors [role="option"]')[5].click(); document.querySelector('#npicons [data-value="globe"]').click(); })()`);
    await waitFor(() => entryOf().color === require('../src/main/store').PROJECT_COLORS[5] && entryOf().icon === 'globe');
    await closeMenu(ui);
    await ui(`(() => { const l = document.getElementById('nplocal'); l.value = 'abc.ngrok.app *.Shop.dev'; l.dispatchEvent(new Event('input')); l.dispatchEvent(new Event('change')); })()`);
    await waitFor(() => entryOf().local?.length === 2);
    // The name typed and the manager closed with ×: kept.
    await ui(`(() => { const n = document.getElementById('npname'); n.value = 'Site-2'; n.dispatchEvent(new Event('input')); })()`);
    assert.equal(entryOf().name, 'site', 'not yet: on Enter or leaving it');
    await closeSettings(ui);
    await waitFor(() => entryOf().name === 'Site-2');
    const entry = entryOf();
    assert.deepEqual([entry.name, entry.color, entry.icon, entry.folder], ['Site-2', require('../src/main/store').PROJECT_COLORS[5], 'globe', site]);
    assert.deepEqual(entry.local, ['abc.ngrok.app', 'shop.dev'], "its own local addresses, where test users' pairs may be typed (local.js)");
    await waitFor(async () => (await projectTabs(ui)).includes('Site-2 *') && shell.win.getTitle() === 'Site-2 — Kulisa');
    assert.equal(await ui(`${projectTab('site')}.querySelector('.plabel use').getAttribute('href')`), '#i-p-globe');
    // Its profiles: a new one; one of another project, the same person (its master, its sign-ins); × lets go of one.
    await rightClick(ui, `#projectTabs [data-project="site"] .name`);
    await menuRows(ui);
    await choose(ui, 'Project Settings…');
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
    const ann = shell.accounts.create('project', shell.accounts.prepare('fake').id, 'fake', 'ann@shop.com');
    await rightClick(ui, `#projectTabs [data-project="site"] .name`);
    await menuRows(ui);
    await choose(ui, 'Project Settings…');
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
    await waitFor(() => shell.task.agent?.id === ann.id);
    assert.equal(shell.task.profiles.size, 0, 'no profile opens by itself');
    // Let go of at once, an account as an agent without accounts: its tasks keep it, and the account stays in the store.
    await ui(`kulisa.invoke('project:agent-remove', { id: 'site', agent: '${ann.id}' })`);
    await ui(`kulisa.invoke('project:agent-remove', { id: 'site', agent: 'shell' })`);
    assert.equal(shell.store.projects().find((p) => p.id === 'site').agents, undefined, 'none left');
    assert.deepEqual(shell.accounts.find(ann.id).projects, ['project']);
    assert.equal(shell.task.agent.id, ann.id);
    assert.equal(before.agent.id, 'shell');
    await ui(`kulisa.invoke('project:close', { id: 'site' })`);
    await waitFor(() => !shell.open.has('site'));
    ctx.asked.length = 0;
  });

  test('projects: several repositories: a task gets a copy of each on one branch, in one folder; one added while a task runs is copied and its agent told; one with copies is not removed', async (ctx) => {
    const { shell, ui, call } = ctx;
    const repo = (name) => {
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
    // Added in Project Settings… while task-1 runs: copied for it into its folder of copies, its agent told.
    const added = await ui(`kulisa.invoke('project:repo-add', { id: 'api', folder: ${JSON.stringify(web)} })`);
    assert.deepEqual(added.repos.map((r) => r.folder), [api, web]);
    const webCopy = path.join(root, 'Kulisa', 'api@task-1', 'web');
    await waitFor(() => first.entry.copies.length === 2);
    assert.equal(git(webCopy, 'rev-parse', '--abbrev-ref', 'HEAD'), 'task-1');
    await waitFor(async () => (await ctx.termText()).includes(`Kulisa added ${webCopy} to this task`));
    assert.deepEqual(first.dirs(), [webCopy]);
    // A new task: a copy of each in one folder, on one branch; its agent told of the other.
    const task = await newTask(ctx);
    const home = path.join(root, 'Kulisa', 'api@task-2');
    assert.equal(task.folder, path.join(home, 'api'));
    assert.deepEqual(task.dirs(), [path.join(home, 'web')]);
    for (const r of ['api', 'web']) assert.equal(git(path.join(home, r), 'rev-parse', '--abbrev-ref', 'HEAD'), 'task-2');
    assert.match(await ctx.instructions(task), /The task's other folders: .*api@task-2\/web \(a worktree of .*\/web, branch task-2\)/);
    // Its agent names it: the branch of each copy.
    await call('task_rename', { name: 'Checkout' });
    for (const r of ['api', 'web']) assert.equal(git(path.join(home, r), 'rev-parse', '--abbrev-ref', 'HEAD'), 'checkout');
    // Project Settings… shows them, the default first; × on one tasks have copies of is refused, naming them.
    await rightClick(ui, `#projectTabs [data-project="api"] .name`);
    await menuRows(ui);
    await choose(ui, 'Project Settings…');
    await waitFor(() => ui(`document.querySelectorAll('#nprepos .item').length === 2`));
    assert.deepEqual(await ui(`[...document.querySelectorAll('#nprepos .item')].map((r) => r.querySelector('.label').textContent + ' ' + !!r.querySelector('.default'))`), ['api true', 'web false']);
    await onRow(ui, `#nprepos [data-folder="${web}"]`, 'nprepodel');
    await waitFor(async () => /Tasks work in it: task-1, Checkout/.test(await ui(`document.getElementById('npcodeerror').textContent`)));
    await ui(`document.querySelector('#projects .x').click()`);
    // Deleting the task: both copies, both branches and its folder go.
    await ui(`kulisa.invoke('task:delete', '${task.key}')`);
    await waitFor(() => !fs.existsSync(home));
    assert.equal(git(web, 'branch', '--list', 'checkout') + git(api, 'branch', '--list', 'checkout'), '');
    ctx.asked.length = 0;
    // Cloned from a URL (a local one here) next to the project's folder, and copied for task-1; made the default.
    const bare = path.join(root, 'docs.git');
    git(root, 'clone', '-q', '--bare', web, bare);
    const cloned = await ui(`kulisa.invoke('project:repo-clone', { id: 'api', url: ${JSON.stringify(bare)} })`);
    assert.deepEqual(cloned.repos.map((r) => r.folder), [api, web, path.join(root, 'docs')]);
    await waitFor(() => first.entry.copies.length === 3);
    assert.equal((await ui(`kulisa.invoke('project:repo-default', { id: 'api', folder: ${JSON.stringify(web)} })`)).repos[0].folder, web);
    await ui(`kulisa.invoke('project:close', { id: 'api' })`);
    await waitFor(() => !shell.open.has('api'));
    ctx.asked.length = 0;
    // A project without git (Site-2, closed) getting a repository: its folder is a former one, shown in its settings.
    await ui(`kulisa.invoke('project:repo-add', { id: 'site', folder: ${JSON.stringify(path.join(root, 'docs'))} })`);
    const site = await ui(`kulisa.invoke('project:settings-get', { id: 'site' })`);
    assert.deepEqual([site.repos.map((r) => r.folder), site.former], [[path.join(root, 'docs')], path.join(root, 'site')]);
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
    await ui(`kulisa.invoke('project:close', { id: 'merge' })`);
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
    const wt = await require('../src/main/worktrees').createWorktree(spare, 'idea');
    fs.writeFileSync(path.join(wt.folder, 'b.txt'), 'b'); git(wt.folder, 'add', '-A'); git(wt.folder, 'commit', '-qm', 'b');
    const data = path.join(userData, 'projects', p.id);
    // A profile of its own (in no other project): its master goes with it.
    const own = shell.profileStore.create(p.id, { name: 'Spare-user', avatar: 'fox' });
    fs.mkdirSync(path.join(data, '1', own.folder), { recursive: true });
    // An agent's account in no other project: it stays, let go of (Settings → Agents deletes one).
    const account = shell.accounts.create(p.id, shell.accounts.prepare('fake').id, 'fake', 'spare@shop.com');
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
    assert.equal(shell.task?.n, 1, 'another project: the open one stays open');
    await waitFor(() => ui(`!document.querySelector('#pjlist [data-project="spare"]')`));
    await closeSettings(ui);

    // New Project… asks for its code first (the author, 2026-10-11: a folder made in ~/Kulisa was in the way of code
    // already on the disk). Folder on disk, a repository: taken as it is, its files and its history kept, no git init,
    // nothing made; named after its folder; made, not opened, as any new project; New Task opens it.
    const gone = path.join(root, 'gone');
    fs.mkdirSync(gone); git(gone, 'init', '-q'); fs.writeFileSync(path.join(gone, 'a.txt'), 'a'); git(gone, 'add', '-A'); git(gone, 'commit', '-qm', 'mine');
    const fill = (id, v) => ui(`(() => { const i = document.getElementById('${id}'); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input')); })()`);
    const newProject = async (from) => {
      if (!await ui(`document.getElementById('projects')?.dataset.state === 'open'`)) await ui(`document.getElementById('manageProjects').click()`);
      await waitFor(() => ui(`document.getElementById('projects')?.dataset.state === 'open'`));
      await ui(`document.getElementById('pjnew').click()`);
      await waitFor(() => ui(`!!document.querySelector('#newproject #npfrom [data-value="${from}"]')`));
      await ui(`document.querySelector('#npfrom [data-value="${from}"]').click()`);
      await waitFor(() => ui(`document.querySelector('#npfrom [data-value="${from}"]').ariaSelected === 'true'`));
    };
    await newProject('folder');
    assert.equal(await ui(`!!document.getElementById('nplocationrow')`), false, 'no location: nothing is made');
    const add = async (v) => { await fill('npsource', v); await ui(`document.getElementById('npaddsource').click()`); };
    await add(path.join(root, 'nowhere'));
    await waitFor(async () => (await ui(`document.getElementById('nperror').textContent`)) === `${path.join(root, 'nowhere')} is not there`);
    assert.equal(await ui(`document.querySelectorAll('#npsources .item').length`), 0, 'not in the list');
    assert.ok(!fs.existsSync(path.join(root, 'nowhere')), 'not made');
    const showOpenDialog = require('electron').dialog.showOpenDialog;
    require('electron').dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [gone] });
    try {
      await fill('npsource', '');
      await fill('npname', ''); // typed by the human: kept; emptied, it follows the first folder again
      await ui(`document.getElementById('npbrowsesource').click()`);
      await waitFor(async () => (await ui(`document.getElementById('npname').value`)) === 'gone');
    } finally { require('electron').dialog.showOpenDialog = showOpenDialog; }
    assert.equal(await ui(`document.querySelector('#npsources .item kbd').textContent`), 'git');
    assert.equal(await ui(`document.getElementById('npgitrow').hidden`), true, 'no Create Git repository: it is one');
    await ui(`document.getElementById('npform').requestSubmit()`);
    await waitFor(() => ui(`${pageOf('gone')} && !document.getElementById('npnewtask').hidden`));
    assert.ok(projects().includes('gone') && !shell.open.has('gone'), 'made, no task');
    assert.equal(git(gone, 'log', '--format=%s'), 'mine', 'its history as it was');
    assert.equal(fs.readFileSync(path.join(gone, 'a.txt'), 'utf8'), 'a');
    ctx.asked.length = 0;
    await ui(`document.getElementById('npnewtask').click()`);
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
    assert.deepEqual(await projectTabs(ui), ['project *'], 'the tab next to it shown');
    assert.ok(fs.existsSync(gone) && !fs.existsSync(path.join(userData, 'projects', 'gone')));
    assert.deepEqual(savedWindows(), [{ tabs: ['project'], shown: 'project' }]);

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

    // Close Group in its menu: the last group, so the empty window; its tasks closed.
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    await rightClick(ui, '#projectTabs [data-project="project"] .name');
    await menuRows(ui); // it opens once the window has the list of windows
    await choose(ui, 'Close Group');
    await waitFor(() => shell.task === null && shell.open.size === 0);
    ctx.asked.length = 0;
    await waitFor(() => ui(`document.documentElement.classList.contains('noproject')`));
    assert.ok(shell.store.tasksOf({ id: 'project' }).list.every((e) => e.closed), 'its tasks closed');

    // A closed task in the bar's +: its group again, on that task, opened again; another one of it goes into that
    // group. Back on task-1 with Feature-X, as the tests after and the restart phase expect.
    await plusMenu(ui, 'project', 'Feature-X');
    await waitFor(() => shell.task?.n === 2 && shell.task.loaded && shell.pty && !shell.windows[0].switching);
    assert.ok(!shell.task.entry.closed, 'open again');
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    await plusMenu(ui, 'project', 'task-1');
    await waitFor(() => shell.task?.n === 1 && shell.task.loaded && shell.pty && !shell.windows[0].switching);
    assert.deepEqual(await projectTabs(ui), ['project *'], 'one group');
    assert.deepEqual(await tabs(ui), ['task-1 *', 'Feature-X']);
    ctx.watchPty(shell.pty);
    await waitFor(() => ui(`!document.documentElement.classList.contains('noproject') && !document.documentElement.classList.contains('loading')`));
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
  });
  test('the CDP proxy takes ids in any letters (percent-encoded in its URLs)', async ({ shell }) => {
    // Last: a profile made and deleted here would take a folder number the tests before count on.
    const { id } = await shell.task.createProfile('Анна');
    const p = shell.profiles.get(id);
    await waitFor(() => p.browser);
    assert.ok(p.endpoint.endsWith(`/project/1/${encodeURIComponent(id)}`));
    await p.newTab('about:blank').ready;
    assert.equal((await p.page()).url(), 'about:blank', 'Playwright reached its tab');
    await shell.task.deleteProfile(id);
  });
  // Last in phase 1: the tabs the restart phase finds (restart-tasks.js).
  test('projects: another tab left in the background, with a terminal its agent ran something in', async ({ shell, ui, call }) => {
    await ui(`kulisa.invoke('project:open', { folder: ${JSON.stringify(path.join(root, 'other'))}, task: 1 })`);
    await waitFor(() => shell.current?.id === 'other' && shell.task.loaded);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    await call('terminal_run', { name: 'dev server', command: 'echo "served before"; sleep 60' });
    await waitFor(async () => /^served before$/m.test((await call('terminal_read', { name: 'dev server' })).text));
    await showProject(ui, 'project');
    await waitFor(() => shell.current?.id === 'project' && shell.task.loaded);
    assert.deepEqual(await projectTabs(ui), ['project *', 'other']);
  });
  test('projects: one left in a window of its own (restart-tasks.js: the windows come back)', async ({ shell, ui }) => {
    const third = path.join(root, 'third');
    fs.mkdirSync(third, { recursive: true });
    await ui(`kulisa.invoke('project:open', { folder: ${JSON.stringify(third)} })`);
    await waitFor(() => shell.current?.id === 'third' && shell.task.loaded);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    await ui(`kulisa.invoke('project:move', { id: 'third', terminals: {} })`);
    await waitFor(() => shell.windows[1]?.current?.id === 'third' && !shell.windows[1].switching);
    // Smaller than the window's minimum (setBounds passes below it, the human's drag does not): it comes back at it.
    shell.windows[1].win.setBounds({ x: 40, y: 50, width: 10, height: 10 });
    await showProject(ui, 'project');
    await waitFor(() => shell.current?.id === 'project' && shell.task.loaded);
    assert.deepEqual(await projectTabs(ui), ['project *', 'other']);
  });
};
