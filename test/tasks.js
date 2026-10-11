// Tasks: each with its own copy of the code (a git worktree on a branch of its own; without git, the project's
// folder), copies of the profiles, its own agent; closing, opening again, renaming and deleting them; the projects'
// bar as tab groups, switching, the window with no project.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { assert, root, userData, project, pfile, savedTabs, panel, SITE, sleep, waitFor, who, menuRows, choose, manageProfiles, menuOpen, rightClick,
  box, pageBox, viewOn, dock, press, ctrl, near, projectTabs, projectTab, showProject, savedWindows, closeMenu, chosen, select, selectValues, click, searchTasks } = require('./helpers');
const { withOffset } = require('../src/main/tasks');
const hasDirenv = (() => { try { execFileSync('direnv', ['version']); return true; } catch { return false; } })();

const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=Kulisa test', '-c', 'user.email=test@example.invalid', ...args], { cwd, encoding: 'utf8' }).trim();
const tabs = (ui) => ui(`[...document.querySelectorAll('#tasklist .tasktab')].map((t) => t.querySelector('.name').textContent + (t.classList.contains('active') ? ' *' : ''))`);
const taskTab = (n) => `document.querySelector('#tasklist .tasktab[data-task$="/${n}"]')`;
const tasksFile = () => JSON.parse(fs.readFileSync(path.join(userData, 'projects', 'project', 'tasks.json'), 'utf8'));
// + in the shown project's group; resolves once the new task is shown, its agent started.
async function newTask(ctx) {
  const { shell, ui } = ctx;
  const before = shell.task;
  await ui(`document.querySelector('#projectTabs .pisland.active .add').click()`);
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
    await ui(`document.querySelector('#projectTabs .pisland.active .add').click()`);
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

  test("profiles: a real account's sign-in kept in step: signed in to a site (not local) in one task, it is in the others and the master; signed out, out everywhere; a local app's stays each task's", async (ctx) => {
    const { shell, call } = ctx;
    const first = shell.taskOf('project', 1), shop = 'http://shop.example:4417';
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
    // Every task's tab says how many of its profiles are open; the shown one's is a button with a menu of them.
    const chip = () => ui(`(() => { const b = document.getElementById('openProfiles'); return b.closest('.tasktab')?.dataset.task + ' ' + b.textContent + ' ' + document.querySelectorAll('#projectbar #openProfiles').length; })()`);
    const counts = () => ui(`[...document.querySelectorAll('#tasklist .tasktab')].map((t) => t.querySelector('.chip').textContent)`);
    const widths = () => ui(`[...document.querySelectorAll('#tasklist .tasktab')].map((t) => t.getBoundingClientRect().width)`);
    assert.equal(await chip(), `${second.key} 2 1`);
    assert.deepEqual(await counts(), [String(shell.taskOf('project', 1).profiles.size), '2']);
    const before = await widths();
    assert.match(await ui(`document.getElementById('openProfiles').title`), /^Profiles of this task: 2 open/);
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
    await waitFor(async () => (await chip()) === `${shell.task.key} ${await ui(`document.querySelectorAll('.pane').length`)} 1`); // the button goes with it
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

  // ☰ → Agents…: the agents dialog with nothing to choose; it closes as any dialog.
  const openAgents = async (ui, rows = 3) => {
    await ui(`document.getElementById('windowMenu').click()`);
    await menuRows(ui);
    await choose(ui, 'Agents…');
    // It opens with the agents in it, not with a line that flips to them.
    await waitFor(() => ui(`(document.getElementById('agents')?.dataset.state === 'open')`), 20000);
    assert.equal(await ui(`document.querySelectorAll('#agents .agentrow').length`), rows);
  };
  const agentRow = (id, q) => `document.querySelector('#agents [data-agent="${id}"] ${q}')`;
  test('agents: ☰ → Agents… shows what is installed and installs the others; nothing is chosen or started', async (ctx) => {
    const { shell, ui } = ctx;
    const pty = shell.task.pty;
    await openAgents(ui);
    assert.equal(await ui(`document.querySelector('#agents h2').textContent`), 'Agents');
    assert.equal(await ui(`document.querySelectorAll('#agents .agentrow [role="radio"]').length`), 0, 'no choice to make');
    assert.equal(await ui(agentRow('fake', '.status') + '.textContent'), 'Not installed');
    assert.equal(await ui(agentRow('fake', '.install') + '.hidden'), false);
    assert.match(await ui(agentRow('fake', '.install-line') + '.textContent'), /^Install runs Kulisa tests's installer: echo "installing the fake agent"/);
    assert.equal(await ui(agentRow('shell', '.install') + '.hidden'), true);
    assert.equal(shell.task.profiles.values().next().value.get().view.getVisible(), false, 'pages hidden under the dialog');
    // Installed with its maker's installer; what it said only under Details.
    await ui(agentRow('fake', '.install') + '.click()');
    await waitFor(async () => (await ui(agentRow('fake', '.status') + '.textContent')) === 'Installed', 10000);
    assert.match(await ui(`document.querySelector('#agents .progress').textContent`), /^Fake agent is installed\. Make an account of it in a project's settings/);
    assert.equal(await ui(`document.querySelector('#agents .details .more').dataset.state`), 'closed', "the installer's own output only under Details");
    assert.match(await ui(`document.querySelector('#agents pre').textContent`), /installing the fake agent\s+done/);
    assert.doesNotMatch(await ui(`document.querySelector('#agents pre').textContent`), /\x1b/, 'no terminal codes: colors, links');
    await ui(`document.querySelector('#agents header .x').click()`);
    await waitFor(async () => !(await ui(`(document.getElementById('agents')?.dataset.state === 'open')`)));
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
    await ui(`document.querySelector('#agents footer button').click()`);
    await waitFor(async () => !(await ui(`(document.getElementById('agents')?.dataset.state === 'open')`)));
  });

  // The project's settings (Project Settings… in its label's menu), with its agents.
  const projectSettings = async (ui, id = 'project') => {
    await rightClick(ui, `#projectTabs [data-project="${id}"] .name`);
    await menuRows(ui);
    await choose(ui, 'Project Settings…');
    await waitFor(() => ui(`(document.getElementById('projects')?.dataset.state === 'open') && !document.getElementById('npagentsrow').hidden`));
  };
  const closeSettings = async (ui) => {
    await ui(`document.querySelector('#projects .x').click()`);
    await waitFor(async () => !(await ui(`(document.getElementById('projects')?.dataset.state === 'open')`)));
  };
  // New Account… of the fake agent: its own sign-in starts at once; resolves with its terminal's pty (the sign-in
  // waiting for the human), once its page is open in Kulisa's clean browser.
  const signIn = async (ctx) => {
    const { shell, ui } = ctx;
    shell.signins.clear();
    await ui(`document.getElementById('npaccountnew').click()`);
    assert.deepEqual(await menuRows(ui), ['Fake agent'], 'the agents that have accounts');
    await choose(ui, 'Fake agent');
    await waitFor(() => shell.signins.size);
    const p = [...shell.signins.values()][0];
    await waitFor(() => p.tail.includes('Sign in as?') && [...shell.signinWindows][0]?.profile.get()?.wc.getURL() === 'http://127.0.0.1:4417/app?signin');
    return p;
  };
  const accountDir = (id) => path.join(userData, 'agents', id);
  const logouts = () => { try { return fs.readFileSync(path.join(root, 'logouts'), 'utf8').trim().split('\n'); } catch { return []; } };
  test("agents: a new account is made in the project's settings: the agent's own sign-in at once, in a terminal there, its page in a clean browser of Kulisa's; named by the email it signed in to; a task runs it with its folder", async (ctx) => {
    const { shell, ui } = ctx;
    await projectSettings(ui);
    let p = await signIn(ctx);
    const dir = accountDir('fake-1');
    assert.ok(fs.existsSync(dir), 'its folder, a fixed id: never renamed');
    assert.ok(await ui(`!!document.querySelector('#npsigninterm .xterm')`), 'the sign-in in a terminal of the dialog');
    // The page it opens is in a clean browser of Kulisa's, not the user's: a session in memory, no sign-in of theirs.
    const clean = [...shell.signinWindows][0];
    assert.equal(clean.profile.session.isPersistent(), false, 'nothing of it on disk');
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
    // Cancelled: nothing kept.
    await ui(`document.getElementById('npsignincancel').click()`);
    await waitFor(() => ui(`!document.getElementById('npsignin') && !document.getElementById('npagentsadd').hidden`));
    p = await signIn(ctx);
    await ui(`document.getElementById('npsignincancel').click()`);
    await waitFor(async () => !fs.existsSync(accountDir('fake-4')) && !shell.signinWindows.size && !(await ui(`!!document.getElementById('npsignin')`)));
    // Not signed in (the agent's sign-in ended without it): said so, Try Again.
    p = await signIn(ctx);
    p.write('\r');
    await waitFor(async () => /Not signed in/.test(await ui(`document.getElementById('npsigninerror').textContent`)));
    assert.equal(await ui(`document.getElementById('npsigninstart').hidden`), false);
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

  test("agents: an account a task runs stays in its project; let go by its last project, it goes after a question, signed out, with its folder; the Agents window shows the agents alone", async (ctx) => {
    const { shell, ui } = ctx;
    const task = shell.task, dir = accountDir('fake-1');
    await projectSettings(ui);
    const remove = `document.querySelector('#npagents [data-agent="fake-1"] .remove').click()`;
    await ui(remove);
    await waitFor(async () => new RegExp(`Tasks run it: ${task.entry.name}`).test(await ui(`document.getElementById('npagenterror').textContent`)));
    await closeSettings(ui);
    await ui(`kulisa.invoke('task:delete', '${task.key}')`);
    await waitFor(() => !shell.current.tasks.has(task.n) && shell.task?.n === 2);
    ctx.asked.length = 0;
    await projectSettings(ui);
    ctx.answer = false;
    await ui(remove);
    await waitFor(() => ctx.asked.length);
    assert.equal(ctx.asked.pop().message, 'Delete the account Fake agent · work@shop.com?');
    assert.ok(fs.existsSync(dir), 'kept when the human says no');
    ctx.answer = true;
    await ui(remove);
    await waitFor(async () => !fs.existsSync(dir) && !(await ui(`!!document.querySelector('#npagents [data-agent="fake-1"]')`)));
    assert.ok(logouts().includes(dir), 'signed out first, with its agent\'s own command');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(userData, 'agents.json'), 'utf8')), { next: 6, list: [] });
    ctx.asked.length = 0;
    await closeSettings(ui);
    await openAgents(ui);
    assert.equal(await ui(`document.querySelectorAll('#agents .agentrow.account').length`), 0);
    await ui(`document.querySelector('#agents header .x').click()`);
    await waitFor(async () => !(await ui(`(document.getElementById('agents')?.dataset.state === 'open')`)));
  });

  // Last in phase 1: task-1 is shown, Feature-X waits in the bar and task-5 is closed, for the restart phase.
  test('tasks: × on the last open task closes the project, as Chrome closes a window with its last tab; it opens again on that task', async (ctx) => {
    const { shell, ui } = ctx;
    const first = shell.current.tasks.get(1), second = shell.current.tasks.get(2);
    await ui(`${taskTab(1)}.querySelector('.close').click()`);
    await waitFor(() => first.entry.closed && !first.loaded && shell.task === second);
    await waitFor(async () => JSON.stringify(await tabs(ui)) === '["Feature-X *"]');
    assert.equal(ctx.asked.length, 0);
    await ui(`${taskTab(2)}.querySelector('.close').click()`);
    await waitFor(() => shell.task === null && !shell.current);
    assert.equal(ctx.asked.pop().message, 'Close the project project?', "closing a project's question");
    assert.ok(second.profiles.size === 0 && !second.pty, 'every task of the project stopped');
    assert.deepEqual(tasksFile().list.map((e) => [e.n, !!e.closed]), [[1, true], [2, true], [5, true]]);
    await waitFor(() => ui(`document.documentElement.classList.contains('noproject')`));
    // The empty window: an empty island in the grid's place with New Project…; the bar with no islands but Search Tasks.
    assert.equal(await ui(`getComputedStyle(document.getElementById('empty')).display`), 'grid');
    assert.equal(await ui(`document.querySelector('#empty h2').textContent`), 'No project is open');
    assert.ok(await ui(`(() => { const w = document.getElementById('empty'), s = getComputedStyle(w);
      return w.getBoundingClientRect().height > innerHeight * 0.7 && s.backgroundColor === (() => { const i = document.body.appendChild(document.createElement('i')); i.style.background = 'var(--island)';
        const c = getComputedStyle(i).backgroundColor; i.remove(); return c; })(); })() // an island's, as the dialogs'`));
    assert.equal(await ui(`document.getElementById('searchTasks').checkVisibility()`), true, 'Search Tasks there');
    assert.equal(await ui(`document.getElementById('tasks')?.checkVisibility() ?? false`), false, 'no tasks shown');
    assert.deepEqual(await projectTabs(ui), [], 'no project tab');
    assert.equal(await ui(`document.documentElement.style.getPropertyValue('--project')`), '', "no project's color");
    assert.equal(shell.win.getTitle(), 'Kulisa');
    assert.deepEqual(savedWindows(), [{ tabs: [], shown: null }], 'the window opens so next time');
    // Search Tasks: each project's heading with its icon in its color, as on its label in the bar; its tasks under it,
    // the one closed last first (all are closed here).
    await searchTasks(ui);
    assert.deepEqual(await ui(`[...document.querySelectorAll('.tasksearch .tlproject')].map((b) => b.querySelector('.picon use')?.getAttribute('href') ?? null)`),
      shell.store.projects().map((p) => (p.icon === 'favicon' ? null : p.icon && p.icon !== 'logo' ? `#i-p-${p.icon}` : '#i-logo')));
    const byClosing = tasksFile().list.filter((e) => e.closed).sort((a, b) => b.closedAt - a.closedAt).map((e) => e.name);
    assert.deepEqual(await ui(`[...document.querySelectorAll('.tasksearch [data-project="project"] .tltask .label')].map((l) => l.textContent)`), byClosing);
    assert.equal(byClosing[0], 'Feature-X');
    await closeMenu(ui);
    // Its heading: opened again as it was left, on the task closed last; the others wait in its group's panel.
    await searchTasks(ui, 'project');
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

  test('the empty window: Close Project in the group\'s panel; links in ☰ open in the browser; at the first start the manager on New Project; New Project… asks where its folder goes', async (ctx) => {
    const { shell, ui } = ctx;
    assert.deepEqual((await groupMenu(ui, 'Close Project')).slice(-2), ['-', 'Close Project']);
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
    // The first start (no project yet): the manager opens by itself on New Project; not with projects there.
    shell.firstStart(shell.windows[0]);
    assert.equal(await ui(`document.getElementById('projects')?.dataset.state === 'open'`), false, 'projects there: nothing opens');
    const projectsOf = shell.store.projects;
    shell.store.projects = () => [];
    try { shell.firstStart(shell.windows[0]); } finally { shell.store.projects = projectsOf; }
    await waitFor(() => ui(`document.getElementById('projects')?.dataset.state === 'open' && !document.getElementById('nplocationrow').hidden`));
    await closeSettings(ui);

    // New Project…: a name and where its folder goes, the home folder unless another is chosen; git on by default.
    await ui(`document.getElementById('emptynew').click()`);
    await waitFor(() => ui(`(document.getElementById('projects')?.dataset.state === 'open')`));
    assert.equal(await ui(`document.getElementById('nplocation').value`), path.join(root, 'Kulisa'), "every new project's place (~/Kulisa; the tests' own here)");
    // Its color (the next free one chosen), its icon (the curtain); no agent here: its accounts are made in its
    // configuration, which Create goes on to.
    assert.deepEqual(await ui(`[...document.querySelectorAll('#npcolors [aria-selected="true"], #npicons [aria-pressed="true"]')].map((b) => b.dataset.value)`),
      [shell.store.nextColor(), 'logo']);
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
      return [getComputedStyle(e).userSelect, getSelection().toString() === e.textContent, getComputedStyle(document.getElementById('pjtitle')).userSelect]; })()`),
      ['text', true, 'none']);
    assert.ok(!shell.store.projects().some((p) => p.id === 'note'), 'a file is not taken');
    await named('Shop');
    // Another color and icon. Created, it is not opened: the manager shows its configuration, and Open opens it (no
    // question where: no project is open here).
    await ui(`document.querySelectorAll('#npcolors [role="option"]')[3].click(); document.querySelector('#npicons [data-value="rocket"]').click()`);
    assert.equal(await ui(`document.getElementById('npwhere').textContent`), `The project will be created in ${path.join(made, 'Shop')}`);
    ctx.asked.length = 0;
    await ui(`document.getElementById('npform').requestSubmit()`);
    await waitFor(() => ui(`document.getElementById('pjtitle')?.textContent === 'Shop' && !document.getElementById('npagentsrow').hidden
      && !document.getElementById('npopen').hidden && document.querySelector('#pjlist [data-project="shop"]')?.ariaSelected === 'true'`));
    assert.ok(!shell.current && !shell.open.has('shop'), 'made, not opened');
    assert.equal(ctx.asked.length, 0, 'no question where to open it');
    await ui(`document.getElementById('npopen').click()`);
    await waitFor(() => shell.current?.folder === path.join(made, 'Shop') && shell.task?.loaded && shell.pty);
    assert.ok(fs.existsSync(path.join(made, 'Shop', '.git')), 'git init in it');
    const shop = shell.store.projects().find((p) => p.id === 'shop');
    assert.deepEqual([shop.color, shop.icon, shop.agents], [require('../src/main/store').PROJECT_COLORS[3], 'rocket', undefined]);
    assert.equal(await ui(`${projectTab('shop')}.querySelector('.plabel use').getAttribute('href')`), '#i-p-rocket');
    assert.equal(git(path.join(made, 'Shop'), 'log', '--format=%s'), 'Initial commit', 'an empty first commit');
    assert.equal(shell.task.folder, path.join(made, 'Shop@task-1'), 'so its first task has a copy of its own');
    assert.equal(await ui(`(document.getElementById('projects')?.dataset.state === 'open')`), false);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    await searchTasks(ui, 'project'); // its heading in Search Tasks: a closed project opened as it was left
    await waitFor(() => shell.current?.folder === project && shell.task?.n === 1 && shell.task.loaded && shell.pty);
    ctx.watchPty(shell.pty);
    await waitFor(() => ui(`!document.documentElement.classList.contains('noproject') && !document.documentElement.classList.contains('loading')`));
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
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
    await waitFor(() => ui(`(document.getElementById('projects')?.dataset.state === 'open') && document.getElementById('pjtitle').textContent === 'site'`));
    // The manager lists every project, this one chosen, the open ones marked.
    assert.ok(await ui(`document.querySelector('#pjlist [data-project="site"]').ariaSelected === 'true' && document.querySelector('#pjlist [data-project="site"] kbd').textContent === 'open'`));
    assert.equal(await ui(`document.querySelector('#npicons [aria-pressed="true"]').dataset.value`), 'favicon');
    assert.equal(await ui(`document.querySelector('#nprepos [data-folder] small').textContent`), site, 'its folder, as its code');
    assert.equal(await ui(`document.getElementById('nplocationrow').checkVisibility()`), false);
    await ui(`(() => { const n = document.getElementById('npname'); n.value = 'Site-2'; n.dispatchEvent(new Event('input'));
      document.querySelectorAll('#npcolors [role="option"]')[5].click(); document.querySelector('#npicons [data-value="globe"]').click();
      const l = document.getElementById('nplocal'); l.value = 'abc.ngrok.app *.Shop.dev'; l.dispatchEvent(new Event('input'));
      document.getElementById('npform').requestSubmit(); })()`);
    await waitFor(async () => !(await ui(`(document.getElementById('projects')?.dataset.state === 'open')`)));
    const entry = shell.store.projects().find((p) => p.id === 'site');
    assert.deepEqual([entry.name, entry.color, entry.icon, entry.folder], ['Site-2', require('../src/main/store').PROJECT_COLORS[5], 'globe', site]);
    assert.deepEqual(entry.local, ['abc.ngrok.app', 'shop.dev'], "its own local addresses, where test users' pairs may be typed (local.js)");
    await waitFor(async () => (await projectTabs(ui)).includes('Site-2 *') && shell.win.getTitle() === 'Site-2 — Kulisa');
    assert.equal(await ui(`${projectTab('site')}.querySelector('.plabel use').getAttribute('href')`), '#i-p-globe');
    // Its profiles: a new one; one of another project, the same person (its master, its sign-ins); × lets go of one.
    await rightClick(ui, `#projectTabs [data-project="site"] .name`);
    await menuRows(ui);
    await choose(ui, 'Project Settings…');
    await waitFor(() => ui(`(document.getElementById('projects')?.dataset.state === 'open')`));
    assert.equal(await ui(`document.querySelectorAll('#npprofiles .removable').length`), 0);
    await ui(`(() => { const n = document.getElementById('npnewprofile'); n.value = 'Site-user'; n.dispatchEvent(new Event('input')); document.getElementById('npprofilenew').click(); })()`);
    await waitFor(() => ui(`!!document.querySelector('#npprofiles [data-profile="site-user"]')`));
    await ui(`document.getElementById('npprofilefrom').click()`);
    assert.ok((await menuRows(ui)).includes('Sam.admin'));
    await choose(ui, 'Sam.admin');
    await waitFor(async () => (await ui(`document.querySelector('#npprofiles [data-profile="sam-admin"] small')?.textContent`)) === 'seller in the test shop · also in project');
    await waitFor(() => shell.closed.has('sam-admin') && shell.closed.has('site-user')); // its task lists them, closed
    await ui(`document.querySelector('#npprofiles [data-profile="site-user"] .remove').click()`);
    await waitFor(() => ctx.asked.length);
    assert.equal(ctx.asked.pop().message, 'Delete the profile Site-user?', 'in no other project: it goes for good');
    await waitFor(() => !shell.closed.has('site-user') && !shell.profileStore.get('site-user'));
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
    await waitFor(() => ui(`(document.getElementById('projects')?.dataset.state === 'open') && !document.getElementById('npagentsrow').hidden`));
    await ui(`document.getElementById('npagentadd').click()`);
    assert.ok(!(await menuRows(ui)).includes('Fake agent'), 'an agent with accounts: one of its accounts');
    await closeMenu(ui);
    for (const name of ['Terminal only', 'Fake agent · ann@shop.com']) {
      await ui(`document.getElementById('npagentadd').click()`);
      await menuRows(ui);
      await choose(ui, name);
      await waitFor(async () => (await ui(`[...document.querySelectorAll('#npagents .label')].map((l) => l.textContent)`)).includes(name));
    }
    const agentRows = () => ui(`[...document.querySelectorAll('#npagents .removable')].map((r) => r.querySelector('.label').textContent + ' ' + r.querySelector('[role="radio"]').getAttribute('aria-checked'))`);
    assert.deepEqual(await agentRows(), ['Terminal only true', 'Fake agent · ann@shop.com false'], 'the first added, the default');
    assert.deepEqual(shell.store.projects().find((p) => p.id === 'site').agents, ['shell', ann.id]);
    assert.deepEqual(shell.accounts.find(ann.id).projects, ['project', 'site'], 'the account lists the projects it is in');
    await ui(`document.querySelector('#npagents [data-agent="${ann.id}"] [role="radio"]').click()`);
    await waitFor(async () => JSON.stringify(await agentRows()) === '["Fake agent · ann@shop.com true","Terminal only false"]');
    await ui(`document.querySelector('#npagents [data-agent="shell"] [role="radio"]').click()`);
    await waitFor(async () => JSON.stringify(await agentRows()) === '["Terminal only true","Fake agent · ann@shop.com false"]');
    await ui(`document.querySelector('#projects .x').click()`);
    // + makes a task with the default one (the first kept the one it started with).
    ctx.answer = true; // no git: a second task in the folder, after the question
    const task = await newTask(ctx);
    ctx.asked.length = 0;
    assert.equal(JSON.parse(fs.readFileSync(path.join(userData, 'projects', 'site', String(task.n), 'agent.json'), 'utf8')).agent, 'shell');
    // +'s right-click: New Task with one of its agents.
    await rightClick(ui, '#projectTabs .pisland.active .add');
    assert.deepEqual(await menuRows(ui), ['# New Task with', 'Terminal only', 'Fake agent · ann@shop.com']);
    const before = shell.task;
    await choose(ui, 'Fake agent · ann@shop.com');
    await waitFor(() => shell.task !== before && shell.task.loaded && shell.pty, 20000);
    ctx.watchPty(shell.pty);
    ctx.asked.length = 0;
    await waitFor(() => shell.task.agent?.id === ann.id);
    assert.equal(shell.task.profiles.size, 0, 'no profile opens by itself');
    // An account its tasks run is not removed; an agent without accounts is (its tasks keep it).
    assert.match((await ui(`kulisa.invoke('project:agent-remove', { id: 'site', agent: '${ann.id}' })`)).error, /^Tasks run it: /);
    await ui(`kulisa.invoke('project:agent-remove', { id: 'site', agent: 'shell' })`);
    assert.deepEqual(shell.store.projects().find((p) => p.id === 'site').agents, [ann.id]);
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
    await waitFor(() => ui(`document.querySelectorAll('#nprepos .removable').length === 2`));
    assert.deepEqual(await ui(`[...document.querySelectorAll('#nprepos .removable')].map((r) => r.querySelector('.label').textContent + ' ' + r.querySelector('[role="radio"]').getAttribute('aria-checked'))`), ['api true', 'web false']);
    await ui(`document.querySelector('#nprepos [data-folder="${web}"] .remove').click()`);
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
    await waitFor(() => ui(`(document.getElementById('projects')?.dataset.state === 'open') && document.getElementById('pjtitle').textContent === ${JSON.stringify(shell.current.name)}`));
    assert.equal(await ui(`document.querySelector('#pjlist [aria-selected="true"]').dataset.project`), shell.current.id);
    assert.equal(shell.task.profiles.get('sam-admin').get().view.getVisible(), false, 'pages hidden under the dialog');
    // Site-2 is closed: its configuration all the same; a profile made and let go there (asked first).
    await ui(`document.querySelector('#pjlist [data-project="site"]').click()`);
    await waitFor(() => ui(`document.getElementById('pjtitle').textContent === 'Site-2' && document.querySelector('#pjlist [data-project="site"] kbd').textContent === ''`));
    assert.ok(!shell.open.has('site'));
    await ui(`(() => { const n = document.getElementById('npnewprofile'); n.value = 'Closed-one'; n.dispatchEvent(new Event('input')); document.getElementById('npprofilenew').click(); })()`);
    await waitFor(() => ui(`!!document.querySelector('#npprofiles [data-profile="closed-one"]')`));
    ctx.answer = true;
    await ui(`document.querySelector('#npprofiles [data-profile="closed-one"] .remove').click()`);
    await waitFor(() => ctx.asked.length && !shell.profileStore.get('closed-one'));
    assert.equal(ctx.asked.pop().message, 'Delete the profile Closed-one?');
    await waitFor(() => ui(`!document.querySelector('#npprofiles [data-profile="closed-one"]')`));
    assert.equal(await ui(`document.getElementById('npprofileerror').textContent`), '');
    // + New Project: the new project's fields on the right, none chosen on the left.
    await ui(`document.getElementById('pjnew').click()`);
    await waitFor(() => ui(`document.getElementById('pjtitle').textContent === 'New Project' && !document.getElementById('nplocationrow').hidden && document.getElementById('npagentsrow').hidden`));
    assert.equal(await ui(`document.querySelectorAll('#pjlist [aria-selected="true"]').length`), 0);
    await shell.screenshot(path.join(root, 'projects.png'));
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

  test("projects: Delete Project… (the projects' manager alone) asks, closes the project when open, deletes its data and its tasks' copies, never its folder", async (ctx) => {
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
    // An agent's account of its own (in no other project): signed out, its folder gone with it.
    const account = shell.accounts.create(p.id, shell.accounts.prepare('fake').id, 'fake', 'spare@shop.com');
    fs.mkdirSync(account.dir, { recursive: true });
    fs.writeFileSync(path.join(data, 'tasks.json'), JSON.stringify({ next: 3, current: 1, list: [{ n: 1, name: 'task-1', offset: 0, folder: spare }, { n: 2, name: 'Idea', branch: wt.branch, offset: 100, copies: [wt], folder: wt.folder }] }));
    shell.sendProjects(); // made behind the windows' back: they are told, as when a project is made

    // In the projects' manager, its Delete Project…: the human is told what goes, says no, then yes.
    const removeRow = async (id = 'spare') => {
      if (!await ui(`document.getElementById('projects')?.dataset.state === 'open'`)) await ui(`document.getElementById('manageProjects').click()`);
      await waitFor(() => ui(`!!document.querySelector('#pjlist [data-project="${id}"]')`));
      await ui(`document.querySelector('#pjlist [data-project="${id}"]').click()`);
      await waitFor(() => ui(`document.getElementById('pjtitle').textContent === ${JSON.stringify(id)} && !document.getElementById('npdelete').hidden`));
      await ui(`document.getElementById('npdelete').click()`);
    };
    ctx.answer = false;
    await removeRow();
    await waitFor(() => ctx.asked.length);
    const q = ctx.asked.pop();
    assert.equal(q.message, 'Delete the project spare?');
    assert.match(q.detail, /its profiles Spare-user \(in no other project\) with their sign-ins/);
    assert.match(q.detail, /its agents' accounts Fake agent · spare@shop.com \(in no other project\) with their sign-ins and conversations/);
    assert.ok(q.detail.includes(wt.worktree) && q.detail.includes('Idea: 1 commit of its own') && q.detail.includes(`Its folders stay as they are: ${spare}.`));
    assert.ok(projects().includes(p.id) && fs.existsSync(data) && fs.existsSync(wt.worktree), 'kept when the human says no');
    ctx.answer = true;
    await removeRow();
    await waitFor(() => !projects().includes(p.id));
    ctx.asked.length = 0;
    await waitFor(() => !fs.existsSync(data) && !fs.existsSync(wt.worktree) && !fs.existsSync(shell.profileStore.masterDir(own.folder)));
    assert.equal(shell.profileStore.get('spare-user'), null);
    await waitFor(() => !fs.existsSync(account.dir) && fs.readFileSync(path.join(root, 'logouts'), 'utf8').includes(account.dir));
    assert.equal(shell.accounts.find(account.id), null);
    assert.equal(git(spare, 'branch', '--list', wt.branch), '', "the task's branch");
    assert.equal(fs.readFileSync(path.join(spare, 'a.txt'), 'utf8'), 'a', "the project's own folder stays");
    assert.equal(shell.task?.n, 1, 'another project: the open one stays open');
    await waitFor(() => ui(`!document.querySelector('#pjlist [data-project="spare"]')`));
    await closeSettings(ui);

    // New Project… on a repository there already (the one way in: Open Folder… is gone): taken as it is, its files
    // and its history kept, no git init; made, not opened, as any new project; Open opens it.
    const gone = path.join(root, 'gone');
    fs.mkdirSync(gone); git(gone, 'init', '-q'); fs.writeFileSync(path.join(gone, 'a.txt'), 'a'); git(gone, 'add', '-A'); git(gone, 'commit', '-qm', 'mine');
    await ui(`document.getElementById('manageProjects').click()`);
    await waitFor(() => ui(`document.getElementById('projects')?.dataset.state === 'open'`));
    await ui(`document.getElementById('pjnew').click()`);
    await waitFor(() => ui(`document.getElementById('projects')?.dataset.state === 'open' && !document.getElementById('nplocationrow').hidden`));
    await ui(`(() => { for (const [id, v] of [['npname', 'gone'], ['nplocation', ${JSON.stringify(root)}]]) {
      const i = document.getElementById(id); i.value = v; i.dispatchEvent(new Event('input')); } })()`);
    await waitFor(async () => (await ui(`document.getElementById('npwhere').textContent`)) === `${gone} is a git repository: the project takes it as it is`);
    assert.equal(await ui(`document.getElementById('npgitrow').hidden`), true, 'no Create Git repository: it is one');
    await ui(`document.getElementById('npform').requestSubmit()`);
    await waitFor(() => ui(`document.getElementById('pjtitle')?.textContent === 'gone' && !document.getElementById('npopen').hidden`));
    assert.ok(projects().includes('gone') && !shell.open.has('gone'), 'made, not opened');
    assert.equal(git(gone, 'log', '--format=%s'), 'mine', 'its history as it was');
    assert.equal(fs.readFileSync(path.join(gone, 'a.txt'), 'utf8'), 'a');
    ctx.asked.length = 0;
    await ui(`document.getElementById('npopen').click()`);
    await waitFor(() => shell.current?.folder === gone && shell.task?.loaded && shell.pty);
    assert.equal(ctx.asked.pop()?.message, 'Where to open the project gone?', 'opened, as any project not open');
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

    // Close Project in a tab's right-click menu: the last tab, so the Welcome screen.
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    await rightClick(ui, '#projectTabs [data-project="project"] .name');
    await menuRows(ui); // it opens once the window has the list of windows
    await choose(ui, 'Close Project');
    await waitFor(() => shell.task === null && shell.open.size === 0);
    ctx.asked.length = 0;
    await waitFor(() => ui(`document.documentElement.classList.contains('noproject')`));

    // A task in Search Tasks: the project opens on that task, a closed one opened again.
    const closed = shell.store.tasksOf({ id: 'project' }).list.find((e) => e.closed);
    assert.ok(closed && closed.n !== 1, 'a closed task to open');
    await searchTasks(ui, 'project', closed.n);
    await waitFor(() => shell.task?.n === closed.n && shell.task.loaded && shell.pty && !shell.windows[0].switching);
    assert.ok(!shell.task.entry.closed, 'open again');
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    // Closed again and back on task-1, as the tests after and the restart phase expect.
    await ui(`${taskTab(closed.n)}.querySelector('.close').click()`);
    await waitFor(() => shell.current.tasks.get(closed.n).entry.closed && !shell.windows[0].switching);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    if (shell.task?.n !== 1) await click(ui, taskTab(1));
    await waitFor(() => shell.task?.n === 1 && shell.task.loaded && shell.pty);
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
    await ui(`kulisa.invoke('project:open', { folder: ${JSON.stringify(path.join(root, 'other'))} })`);
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
