// Tasks: forks of main with their own branch and folder (git worktrees), copies of the profiles, their own agent;
// the projects' bar, switching, closing, the window with no project.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { assert, root, userData, project, pfile, savedTabs, panel, SITE, sleep, waitFor, who, menuRows, choose, manageProfiles, menuOpen, rightClick,
  box, pageBox, viewOn, dock, press, ctrl, near, projectTabs, projectTab, showProject, savedWindows } = require('./helpers');
const { withOffset } = require('../src/main/tasks');
const hasDirenv = (() => { try { execFileSync('direnv', ['version']); return true; } catch { return false; } })();

const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=Kulisa test', '-c', 'user.email=test@example.invalid', ...args], { cwd, encoding: 'utf8' }).trim();
const tabs = (ui) => ui(`[...document.querySelectorAll('#tasklist .tasktab')].map((t) => t.querySelector('.name').textContent + (t.classList.contains('active') ? ' *' : ''))`);
const taskTab = (n) => `document.querySelector('#tasklist .tasktab[data-task$="/${n}"]')`;
// + and the name in the dialog; resolves once the new task is shown, its agent started.
async function fork(ctx, name) {
  const { shell, ui } = ctx;
  const before = shell.task;
  await ui(`document.getElementById('taskadd').click()`);
  await waitFor(() => ui(`document.getElementById('tasknew').open`));
  await ui(`document.getElementById('taskname').value = ${JSON.stringify(name)}; document.getElementById('taskform').requestSubmit()`);
  await waitFor(() => shell.task !== before && shell.task.name === name && shell.task.loaded && shell.pty, 20000);
  ctx.watchPty(shell.pty);
  return shell.task;
}

module.exports = (test) => {
  test('tasks: a port offset moves local addresses only', async () => {
    assert.equal(withOffset('http://localhost:3000/cart?x=1', 100), 'http://localhost:3100/cart?x=1');
    assert.equal(withOffset('http://127.0.0.1:4417/app', 200), 'http://127.0.0.1:4617/app');
    assert.equal(withOffset('http://shop.localhost:8080/', 100), 'http://shop.localhost:8180/');
    assert.equal(withOffset('http://localhost/', 100), 'http://localhost/', 'no port: left alone');
    assert.equal(withOffset('https://example.com:8443/', 100), 'https://example.com:8443/', 'not local');
    assert.equal(withOffset('http://localhost:3000/', 0), 'http://localhost:3000/');
  });

  test('tasks: without git, or before a first commit, a project has main only and no +; its room kept', async (ctx) => {
    const { ui } = ctx;
    await waitFor(async () => JSON.stringify(await tabs(ui)) === '["main *"]');
    const add = () => ui(`(() => { const b = document.getElementById('taskadd'); return { shown: getComputedStyle(b).visibility, width: b.offsetWidth }; })()`);
    assert.deepEqual(await add(), { shown: 'hidden', width: 28 });
    // The human sets git up in the terminal and commits; the bar notices when the pointer comes to it.
    git(project, 'init', '-q');
    await ui(`document.getElementById('tasks').dispatchEvent(new PointerEvent('pointerenter'))`);
    await sleep(300); // nothing to wait for: that + does not come
    assert.equal((await add()).shown, 'hidden', 'not before a first commit');
    fs.writeFileSync(path.join(project, '.gitignore'), '.env*\nconfig/local.json\ntranscript.jsonl\n');
    fs.writeFileSync(path.join(project, '.worktreeinclude'), 'config/local.json\n');
    fs.writeFileSync(path.join(project, 'README.md'), '# shop\n');
    git(project, 'add', '-A');
    git(project, 'commit', '-qm', 'first');
    fs.writeFileSync(path.join(project, '.env'), 'SECRET=1\n');
    fs.writeFileSync(path.join(project, '.envrc'), 'export FROM_ENVRC="envrc of $PWD"\n');
    if (hasDirenv) execFileSync('direnv', ['allow', project]); // the human allowed it in main
    fs.mkdirSync(path.join(project, 'config'), { recursive: true });
    fs.writeFileSync(path.join(project, 'config', 'local.json'), '{"db":"local"}');
    fs.writeFileSync(path.join(project, 'wip.txt'), 'not committed');
    await ui(`document.getElementById('tasks').dispatchEvent(new PointerEvent('pointerenter'))`);
    await waitFor(async () => (await add()).shown === 'visible');
  });

  test('tasks: + makes a fork of main: its branch and folder, files outside git, copies of the profiles signed in, its own agent and ports', async (ctx) => {
    const { shell, ui, call } = ctx;
    const main = shell.task;
    await call('browser_navigate', { profile: 'sam-admin', url: `${SITE}/app?fork` });
    const mainSam = main.profiles.get('sam-admin');
    const task = await fork(ctx, 'Feature-X');
    const wt = `${project}@feature-x`;
    assert.equal(task.n, 2);
    assert.equal(task.folder, wt);
    assert.equal(git(wt, 'rev-parse', '--abbrev-ref', 'HEAD'), 'feature-x');
    assert.equal(git(wt, 'rev-parse', 'HEAD'), git(project, 'rev-parse', 'HEAD'), 'from HEAD (no remote here)');
    assert.equal(fs.readFileSync(path.join(wt, '.env'), 'utf8'), 'SECRET=1\n');
    assert.equal(fs.readFileSync(path.join(wt, 'config', 'local.json'), 'utf8'), '{"db":"local"}', '.worktreeinclude');
    assert.ok(fs.existsSync(path.join(wt, 'README.md')) && !fs.existsSync(path.join(wt, 'wip.txt')), 'uncommitted changes are not carried');
    assert.ok(!fs.existsSync(path.join(wt, '.kulisa')), 'nothing of Kulisa in the folder');
    if (hasDirenv) { // main's .envrc is allowed, so the copy in the fork is too: the project's environment is there
      assert.equal(execFileSync('direnv', ['exec', wt, 'sh', '-c', 'echo $FROM_ENVRC'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(), `envrc of ${wt}`);
    }
    await waitFor(async () => (await ctx.termText()).includes(`agent: rc of ${wt}`)); // its agent, in its folder
    assert.deepEqual(task.env(), { KULISA_MCP_URL: `${shell.mcp.base}/task/project/2/mcp`, KULISA_URL: `${shell.mcp.base}/task/project/2`, KULISA_TASK: 'Feature-X', KULISA_PORT_OFFSET: '100' });
    assert.equal(shell.resumedSession, null, 'a new conversation');
    assert.match(await ctx.instructions(task), /This is task "Feature-X", .* usual ports plus 100 \(3000 → 3100; \$KULISA_PORT_OFFSET\)/, 'its ports, told to any agent');

    // Profiles: the same, the closed ones closed, each open one with its active tab moved to the fork's ports.
    assert.deepEqual([...shell.profiles.keys()], ['sam-admin', 'elon-buyer']);
    assert.deepEqual([...shell.closed.keys()], ['dora']);
    assert.deepEqual(['sam-admin', 'elon-buyer'].map((id) => [shell.profiles.get(id).avatar, shell.profiles.get(id).description]),
      [['fox', 'seller in the test shop'], ['owl', '']], 'with their pictures and who they are');
    assert.deepEqual(savedTabs('sam-admin', 2), ['http://127.0.0.1:4517/app?fork']);
    assert.equal(shell.profiles.get('sam-admin').tabs.length, 1);
    assert.ok(shell.profiles.get('sam-admin').dir.startsWith(path.join(userData, 'projects', 'project', '2')));
    await call('browser_navigate', { profile: 'sam-admin', url: `${SITE}/app` });
    assert.equal(await who(ctx, 'sam-admin'), 'Signed in as sam', 'the copy is signed in');
    // Main's profiles keep running, hidden; its agent sees its own.
    assert.ok(mainSam.tabs.every((t) => !t.wc.isDestroyed()) && !mainSam.get().view.getVisible());
    assert.equal(mainSam.get().wc.getURL(), `${SITE}/app?fork`, "the fork's agent acts in the fork's copy");
    assert.match((await call('browser_snapshot', { profile: 'sam-admin' }, main)).text, /URL: .*\/app\?fork/);
    assert.ok(main.pty && main.pty !== shell.pty);

    // The window: the fork's grid with its panes; the bar shows it.
    await waitFor(async () => JSON.stringify(await tabs(ui)) === '["main","Feature-X *"]');
    await waitFor(() => viewOn(shell, ui, 'sam-admin'));
    assert.equal(await ui(`document.querySelectorAll('.pane').length`), 2);
    assert.match(await ui(`${taskTab(2)}.title`), /branch feature-x in .*project@feature-x; the app's ports \+ 100/);
    await shell.screenshot(path.join(root, 'task.png'));
  });

  test('tasks: switching shows the other grid and terminal; the one left keeps running; the agent\'s state shows on its tab', async (ctx) => {
    const { shell, ui } = ctx;
    const fork = shell.task, sam = fork.profiles.get('sam-admin');
    // Every task's tab says how many of its profiles are open; the shown one's is a button with a menu of them.
    const chip = () => ui(`(() => { const b = document.getElementById('openProfiles'); return b.closest('.tasktab')?.dataset.task + ' ' + b.textContent + ' ' + document.querySelectorAll('#projectbar #openProfiles').length; })()`);
    const counts = () => ui(`[...document.querySelectorAll('#tasklist .tasktab')].map((t) => t.querySelector('.chip').textContent)`);
    const widths = () => ui(`[...document.querySelectorAll('#tasklist .tasktab')].map((t) => t.getBoundingClientRect().width)`);
    assert.equal(await chip(), `${fork.key} 2 1`);
    assert.deepEqual(await counts(), [String(shell.taskOf('project', 1).profiles.size), '2']);
    const before = await widths();
    assert.match(await ui(`document.getElementById('openProfiles').title`), /^Profiles of this task: 2 open/);
    // A tab's right-click menu: the shown one's has its profiles too, as the chip's; another's only its folder. Show
    // Folder opens the fork's worktree in the file manager.
    await rightClick(ui, `#tasklist .tasktab[data-task$="/1"] .name`);
    assert.deepEqual(await menuRows(ui), ['Show Folder']);
    await ui(`document.getElementById('menu').hidePopover()`);
    const electron = require('electron'), openPath = electron.shell.openPath, shown = [];
    electron.shell.openPath = async (dir) => { shown.push(dir); return ''; };
    try {
      await rightClick(ui, `#projectTabs .tasktab[data-task="${fork.key}"] .name`);
      const rows = await menuRows(ui);
      assert.deepEqual([rows[0], ...rows.slice(-4)], ['# Profiles', '-', 'Manage Profiles…', '-', 'Show Folder']);
      assert.deepEqual(rows.slice(1, -4).toSorted(), ['Dora', 'Elon.buyer', 'Sam.admin'], 'its open and closed profiles');
      await choose(ui, 'Show Folder');
      await waitFor(() => shown.length === 1);
    } finally { electron.shell.openPath = openPath; }
    assert.equal(shown[0], fork.folder);
    assert.notEqual(fork.folder, project, "the fork's own, not main's");
    await ui(`${taskTab(1)}.click()`);
    await waitFor(() => shell.task.n === 1);
    await waitFor(async () => (await chip()) === `${shell.task.key} ${await ui(`document.querySelectorAll('.pane').length`)} 1`); // the button goes with it
    assert.deepEqual(await widths(), before, 'the tabs keep their widths');
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
    assert.equal(sam.get().view.getVisible(), false, "the fork's pages are hidden");
    assert.ok(sam.tabs.every((t) => !t.wc.isDestroyed()) && fork.pty, 'and alive, its agent too');
    await waitFor(async () => (await ctx.termText()).includes(`agent: rc of ${project}\n`), 3000);
    assert.equal(JSON.parse(fs.readFileSync(path.join(userData, 'projects', 'project', 'tasks.json'), 'utf8')).current, 1);
    // What the fork's agent does reaches its tab (Claude Code's hooks); its captions do not show on main's panes.
    const http = require('http');
    const post = (event, input = {}) => new Promise((r) => http.request(`${fork.env().KULISA_URL}/hooks/${event}`, { method: 'POST' },
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
    const esc = () => ui(`kulisa.send('pty:in', { task: '${fork.key}', data: '\\x1b' })`);
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
    fork.caption('sam-admin', 'from the fork');
    await sleep(200); // nothing to wait for: that it does not show
    assert.equal(await ui(`document.querySelector('.ptab[data-panel="${panel(shell, 'sam-admin')}"] .caption').textContent`), '');
    // Done says "come and see" until the human sees that task.
    await post('stop');
    await waitFor(async () => (await state()) === 'done #i-done true');
    await ui(`${taskTab(2)}.click()`);
    await waitFor(async () => shell.task === fork && (await state()) === ' #i-done false');
    assert.equal(fork.state, 'done', 'the agent is still done: only its tab says nothing');
    await ui(`${taskTab(1)}.click()`);
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
    await ui(`${taskTab(1)}.click()`);
    await shown(1);
  });
  test('tasks: closing a fork asks first, saying what goes and any work not in main; it is deleted with its branch, folder and profiles', async (ctx) => {
    const { shell, ui } = ctx;
    const empty = await fork(ctx, 'Empty');
    assert.equal(empty.n, 3);
    assert.equal(empty.offset, 200);
    const transcript = path.join(root, 'empty-transcript.jsonl');
    fs.writeFileSync(transcript, '');
    const { sessionStart } = require('../src/main/agent-hooks');
    const context = sessionStart(empty, { session_id: 's-empty', transcript_path: transcript }).hookSpecificOutput.additionalContext;
    assert.match(context, /task "Empty".*branch empty.*plus 200/s);
    const dir = path.join(userData, 'projects', 'project', '3');
    await ui(`${taskTab(3)}.querySelector('.close').click()`);
    await waitFor(() => !shell.current.tasks.has(3) && shell.task.n === 1);
    const asked = ctx.asked.pop();
    assert.equal(asked.message, 'Delete the task Empty?', 'asked also without changes');
    assert.ok(asked.detail.startsWith('Deleted for good:') && asked.detail.includes(`${project}@empty`) && asked.detail.includes('its branch empty'));
    assert.ok(!asked.detail.includes('not in main'));
    await waitFor(() => !fs.existsSync(`${project}@empty`) && !fs.existsSync(dir));
    // direnv's permission for its .envrc: no record of the fork's folder left.
    const allow = path.join(process.env.XDG_DATA_HOME, 'direnv', 'allow');
    if (hasDirenv) assert.ok(!(fs.existsSync(allow) ? fs.readdirSync(allow) : []).some((f) => fs.readFileSync(path.join(allow, f), 'utf8').includes(`${project}@empty`)));
    assert.ok(fs.existsSync(transcript), "the test's own agent: Kulisa knows only Claude Code's conversations (agents.js)");
    assert.equal(git(project, 'branch', '--list', 'empty'), '');
    await waitFor(async () => JSON.stringify(await tabs(ui)) === '["main *","Feature-X"]');

    const spike = await fork(ctx, 'Spike');
    fs.writeFileSync(path.join(spike.folder, 'idea.txt'), 'x');
    git(spike.folder, 'add', '-A'); git(spike.folder, 'commit', '-qm', 'idea');
    fs.writeFileSync(path.join(spike.folder, 'more.txt'), 'y');
    ctx.answer = false;
    await ui(`${taskTab(spike.n)}.querySelector('.close').click()`);
    await waitFor(() => ctx.asked.length);
    const q = ctx.asked.pop();
    assert.equal(q.message, 'Delete the task Spike?');
    assert.match(q.detail, /Work not in main, deleted with it:\n• 1 commit of its own and 1 uncommitted file/);
    assert.ok(shell.current.tasks.has(spike.n) && fs.existsSync(spike.folder), 'kept when the human says no');
    ctx.answer = true;
    await ui(`${taskTab(spike.n)}.querySelector('.close').click()`);
    await waitFor(() => !shell.current.tasks.has(spike.n) && shell.task.n === 1);
    ctx.asked.length = 0;
    // The folder goes first (git worktree remove), then the branch.
    await waitFor(() => !fs.existsSync(spike.folder) && git(project, 'branch', '--list', 'spike') === '');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(userData, 'projects', 'project', 'tasks.json'), 'utf8')).list.map((w) => w.name), ['main', 'Feature-X']);
  });

  // ☰ → Agents…: the agents dialog with nothing to choose; it closes as any dialog.
  const openAgents = async (ui) => {
    await ui(`document.getElementById('windowMenu').click()`);
    await menuRows(ui);
    await choose(ui, 'Agents…');
    // It opens with the agents in it, not with a line that flips to them.
    await waitFor(() => ui(`document.getElementById('agents').open`), 20000);
    assert.equal(await ui(`document.querySelectorAll('#agents .agentrow').length`), 3);
  };
  const agentRow = (id, q) => `document.querySelector('#agents [data-agent="${id}"] ${q}')`;
  test('agents: ☰ → Agents… shows what is installed and installs the others; nothing is chosen or started', async (ctx) => {
    const { shell, ui } = ctx;
    const pty = shell.task.pty;
    await openAgents(ui);
    assert.equal(await ui(`document.querySelector('#agents h2').textContent`), 'Agents');
    assert.equal(await ui(`document.querySelectorAll('#agents input').length`), 0, 'no choice to make');
    assert.equal(await ui(agentRow('fake', '.status') + '.textContent'), 'Not installed');
    assert.equal(await ui(agentRow('fake', '.install') + '.hidden'), false);
    assert.match(await ui(agentRow('fake', '.install-line') + '.textContent'), /^Install runs Kulisa tests's installer/);
    assert.equal(await ui(agentRow('shell', '.install') + '.hidden'), true);
    assert.equal(shell.task.profiles.values().next().value.get().view.getVisible(), false, 'pages hidden under the dialog');
    await ui(`document.querySelector('#agents header .x').click()`);
    await waitFor(async () => !(await ui(`document.getElementById('agents').open`)));
    assert.equal(shell.task.pty, pty, 'the agent goes on');
  });

  test('tasks: a fork with another agent; one not installed is installed from the window, then started', async (ctx) => {
    const { shell, ui } = ctx;
    await ui(`document.getElementById('taskadd').click()`);
    await waitFor(async () => (await ui(`[...document.getElementById('taskagent').options].map((o) => o.value + (o.selected ? ' *' : '')).join()`)) === 'custom *,fake,shell');
    await ui(`document.getElementById('taskagent').value = 'fake'; document.getElementById('taskname').value = 'Agent-pick'; document.getElementById('taskform').requestSubmit()`);
    // Not installed: the window asks, the chosen one preselected, with what Install runs.
    await waitFor(() => ui(`document.getElementById('agentpick').open && document.querySelectorAll('#agentpick .agentrow').length === 3`), 20000);
    const task = shell.task;
    assert.equal(task.name, 'Agent-pick');
    assert.equal(task.pty, null, 'no agent before the human chooses');
    const row = `document.querySelector('#agentpick .agentrow:has(input[value="fake"])')`;
    assert.equal(await ui(`${row}.querySelector('input').checked`), true);
    assert.equal(await ui(`${row}.querySelector('.status').textContent`), 'Not installed');
    assert.match(await ui(`${row}.querySelector('.install-line').textContent`), /^Install runs Kulisa tests's installer: echo "installing the fake agent"/);
    assert.equal(await ui(`document.getElementById('agentstart').disabled`), true);
    assert.equal(task.profiles.get('sam-admin').get().view.getVisible(), false, 'pages hidden under the dialog');
    await ui(`${row}.querySelector('.install').click()`);
    await waitFor(async () => (await ui(`${row}.querySelector('.status').textContent`)) === 'Installed', 10000);
    assert.equal(await ui(`document.querySelector('#agentpick .progress').textContent`), 'Fake agent is installed. Start it; it asks you to sign in.');
    assert.equal(await ui(`document.querySelector('#agentpick details').open`), false, "the installer's own output only under Details");
    assert.match(await ui(`document.querySelector('#agentpick pre').textContent`), /installing the fake agent\s+done/);
    assert.doesNotMatch(await ui(`document.querySelector('#agentpick pre').textContent`), /\x1b/, 'no terminal codes: colors, links');
    await ui(`document.getElementById('agentstart').click()`);
    await waitFor(() => task.pty);
    ctx.watchPty(task.pty);
    await waitFor(async () => (await ctx.termText()).includes(`fake agent in ${task.folder}, ports + ${task.offset}`));
    assert.equal(JSON.parse(fs.readFileSync(pfile('agent.json', task.n), 'utf8')).agent, 'fake');
    assert.equal(await ui(`document.getElementById('agentpick').open`), false);

    // A wrong choice is not a trap: the terminal's menu changes the agent; Cancel leaves it as it is.
    const changeAgent = async () => {
      await rightClick(ui, '#term');
      await menuRows(ui);
      await choose(ui, 'Change agent…');
      await waitFor(() => ui(`document.getElementById('agentpick').open && document.querySelectorAll('#agentpick .agentrow').length === 3`), 20000);
    };
    const fakePty = task.pty;
    await changeAgent();
    assert.equal(await ui(`document.getElementById('agentcancel').hidden`), false);
    assert.equal(await ui(`document.querySelector('#agentpick input:checked').value`), 'fake', 'the current one chosen');
    await ui(`document.getElementById('agentcancel').click()`);
    await waitFor(async () => !(await ui(`document.getElementById('agentpick').open`)));
    await sleep(300); // nothing to wait for: that no other agent starts
    assert.equal(task.pty, fakePty, 'Cancel: the agent goes on');
    await changeAgent();
    await ui(`document.querySelector('#agentpick input[value="shell"]').click()`);
    await ui(`document.getElementById('agentstart').click()`);
    await waitFor(() => task.pty && task.pty !== fakePty);
    assert.deepEqual(JSON.parse(fs.readFileSync(pfile('agent.json', task.n), 'utf8')), { agent: 'shell', started: true }, 'a new conversation');
    assert.equal(task.agent.id, 'shell');
    await ui(`${taskTab(task.n)}.querySelector('.close').click()`);
    await waitFor(() => !shell.current.tasks.has(task.n) && shell.task.n === 1);
    ctx.asked.length = 0;
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
    await waitFor(async () => !(await ui(`document.getElementById('agents').open`)));
  });

  // Last in phase 1: main is shown and Feature-X waits in the bar for the restart phase.
  test('tasks: × on main closes the project; the window offers projects to open', async (ctx) => {
    const { shell, ui } = ctx;
    const fork = shell.current.tasks.get(2);
    assert.equal(await ui(`${taskTab(1)}.querySelector('.close').title`), 'Close the project (asks first)');
    await ui(`${taskTab(1)}.querySelector('.close').click()`);
    await waitFor(() => shell.task === null && !shell.current);
    assert.ok(fork.profiles.size === 0 && !fork.pty, 'every task of the project stopped');
    await waitFor(() => ui(`document.documentElement.classList.contains('noproject')`));
    assert.equal(await ui(`getComputedStyle(document.getElementById('welcome')).display`), 'grid');
    assert.ok(await ui(`document.querySelector('#welcome .applogo').naturalWidth > 0`), 'the app logo loaded');
    // On an island in the grid's place, filling it (not on the project's glow).
    assert.ok(await ui(`(() => { const w = document.getElementById('welcome'), s = getComputedStyle(w);
      return w.getBoundingClientRect().height > innerHeight * 0.8 && s.backgroundColor === getComputedStyle(document.querySelector('dialog[id]')).backgroundColor; })()`));
    assert.equal(await ui(`getComputedStyle(document.getElementById('tasks')).display`), 'none');
    assert.deepEqual(await projectTabs(ui), [], 'no project tab');
    assert.equal(await ui(`document.documentElement.style.getPropertyValue('--project')`), '', "no project's color");
    assert.equal(shell.win.getTitle(), 'Kulisa');
    assert.deepEqual(savedWindows(), [{ tabs: [], shown: null }], 'the window opens so next time');
    await ui(`[...document.querySelectorAll('#welcome-list .item')].find((b) => b.querySelector('.label').textContent === 'project').click()`);
    await waitFor(() => shell.task?.n === 1 && shell.task.loaded && shell.pty);
    ctx.watchPty(shell.pty);
    await waitFor(() => ui(`!document.documentElement.classList.contains('noproject') && !document.documentElement.classList.contains('loading')`));
    await waitFor(async () => JSON.stringify(await tabs(ui)) === '["main *","Feature-X"]');
    assert.equal(shell.current.tasks.get(2).loaded, false, 'a task loads when it is shown');
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
  });

  test('welcome screen: Close Project in the project menu; links open in the browser; New Project… asks where its folder goes', async (ctx) => {
    const { shell, ui } = ctx;
    await ui(`document.getElementById('openProjects').click()`);
    assert.deepEqual((await menuRows(ui)).slice(-3), ['-', 'Close Project', 'Remove Project…']);
    await choose(ui, 'Close Project');
    await waitFor(() => shell.task === null && !shell.current);
    await waitFor(() => ui(`document.documentElement.classList.contains('noproject')`));
    await ui(`document.getElementById('openProjects').click()`);
    assert.ok(!(await menuRows(ui)).includes('Close Project'), 'nothing to close');
    await ui(`document.getElementById('menu').hidePopover()`);
    assert.deepEqual(await ui(`[...document.querySelectorAll('#welcome .links a')].map((a) => a.textContent)`),
      ['Documentation', 'GitHub', 'Report an issue']);
    assert.equal(await ui(`document.getElementById('version').textContent`), `Kulisa ${require('../package.json').version}`);
    const electron = require('electron'), openExternal = electron.shell.openExternal, opened = [];
    electron.shell.openExternal = async (url) => { opened.push(url); };
    try {
      await ui(`document.querySelector('#welcome .links a').click()`);
      await waitFor(() => opened.length === 1);
    } finally { electron.shell.openExternal = openExternal; }
    assert.equal(opened[0], 'https://github.com/cosmotools/kulisa#readme');
    assert.ok(await ui(`location.protocol === 'file:' && !!document.getElementById('welcome')`), 'the window stays on its page');

    // New Project…: a name and where its folder goes, the home folder unless another is chosen; git on by default.
    await ui(`document.getElementById('welcome-new').click()`);
    await waitFor(() => ui(`document.getElementById('newproject').open`));
    assert.equal(await ui(`document.getElementById('nplocation').value`), require('os').homedir());
    assert.equal(await ui(`document.getElementById('npgit').checked`), true);
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
    await named('Taken');
    await ui(`document.getElementById('npform').requestSubmit()`);
    await waitFor(async () => /already there and not empty/.test(await ui(`document.querySelector('#newproject .error').textContent`)));
    assert.ok(!shell.store.projects().some((p) => p.id === 'taken'), 'a folder with files in it is not taken');
    await named('Shop');
    assert.equal(await ui(`document.getElementById('npwhere').textContent`), `The project will be created in ${path.join(made, 'Shop')}`);
    await ui(`document.getElementById('npform').requestSubmit()`);
    await waitFor(() => shell.current?.folder === path.join(made, 'Shop') && shell.task?.loaded && shell.pty);
    assert.ok(fs.existsSync(path.join(made, 'Shop', '.git')), 'git init in it');
    assert.equal(await ui(`document.getElementById('newproject').open`), false);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    await ui(`document.getElementById('openProjects').click()`);
    await menuRows(ui);
    await choose(ui, 'project');
    await waitFor(() => shell.current?.folder === project && shell.task?.n === 1 && shell.task.loaded && shell.pty);
    ctx.watchPty(shell.pty);
    await waitFor(() => ui(`!document.documentElement.classList.contains('noproject') && !document.documentElement.classList.contains('loading')`));
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
    assert.deepEqual(await projectTabs(ui), ['Shop', 'project *']);
    // Another project's task, in its island: a click shows that project with it.
    await ui(`${projectTab('shop')}.querySelector('.tasktab[data-task="shop/1"]').click()`);
    await waitFor(() => shell.current?.id === 'shop' && shell.task?.key === 'shop/1' && shell.task.loaded && !shell.windows[0].switching);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    assert.deepEqual(await projectTabs(ui), ['Shop *', 'project']);
    await showProject(ui, 'project');
    await waitFor(() => shell.current?.id === 'project' && shell.task.loaded);
    // Its tabs have their × too, in its island while another project is shown: main's closes it.
    await ui(`${projectTab('shop')}.querySelector('.tasktab[data-task="shop/1"] .close').click()`);
    await waitFor(() => !shell.open.has('shop'));
    assert.equal(shell.current?.id, 'project', 'the shown project stays');
    ctx.asked.length = 0;
  });

  test('projects: Remove Project… (× in the menu, Remove for the open one, the Welcome screen) asks, closes the project when open, deletes its data and forks, never its folder', async (ctx) => {
    const { shell, ui } = ctx;
    const projects = () => shell.store.projects().map((p) => p.id);
    // A project that is not open, with a fork that has a commit of its own, as Kulisa lays them out.
    const spare = path.join(root, 'spare');
    fs.mkdirSync(spare);
    git(spare, 'init', '-q'); fs.writeFileSync(path.join(spare, 'a.txt'), 'a'); git(spare, 'add', '-A'); git(spare, 'commit', '-qm', 'a');
    const p = shell.store.projectFor(spare);
    const wt = await require('../src/main/worktrees').createWorktree(spare, 'Idea');
    fs.writeFileSync(path.join(wt.folder, 'b.txt'), 'b'); git(wt.folder, 'add', '-A'); git(wt.folder, 'commit', '-qm', 'b');
    const data = path.join(userData, 'projects', p.id);
    fs.mkdirSync(path.join(data, '1', 'Profile 1'), { recursive: true });
    fs.writeFileSync(path.join(data, 'tasks.json'), JSON.stringify({ next: 3, current: 1, list: [{ n: 1, name: 'main' }, { n: 2, name: 'Idea', ...wt, offset: 100 }] }));

    // From the project menu, its row's ×: the human is told what goes, says no, then yes.
    const removeRow = async () => {
      await ui(`document.getElementById('openProjects').click()`);
      await menuRows(ui);
      await ui(`[...document.querySelectorAll('#menu .removable')].find((r) => r.querySelector('.label').textContent === 'spare').querySelector('.remove').click()`);
    };
    ctx.answer = false;
    await removeRow();
    await waitFor(() => ctx.asked.length);
    const q = ctx.asked.pop();
    assert.equal(q.message, 'Remove the project spare?');
    assert.match(q.detail, /sign-ins/);
    assert.ok(q.detail.includes(wt.worktree) && q.detail.includes('Idea: 1 commit of its own') && q.detail.includes(`${spare} stays as it is`));
    assert.ok(projects().includes(p.id) && fs.existsSync(data) && fs.existsSync(wt.worktree), 'kept when the human says no');
    ctx.answer = true;
    await removeRow();
    await waitFor(() => !projects().includes(p.id));
    ctx.asked.length = 0;
    await waitFor(() => !fs.existsSync(data) && !fs.existsSync(wt.worktree));
    assert.equal(git(spare, 'branch', '--list', wt.branch), '', "the fork's branch");
    assert.equal(fs.readFileSync(path.join(spare, 'a.txt'), 'utf8'), 'a', "the project's own folder stays");
    assert.equal(shell.task?.n, 1, 'another project: the open one stays open');
    await ui(`document.getElementById('openProjects').click()`);
    assert.ok(!(await menuRows(ui)).includes('spare'), 'gone from the menu');
    await ui(`document.getElementById('menu').hidePopover()`);

    // The open project, from the project button's menu: closed first, then removed; the Welcome screen.
    const gone = path.join(root, 'gone');
    fs.mkdirSync(gone);
    await ui(`kulisa.invoke('project:open', { folder: ${JSON.stringify(gone)} })`);
    await waitFor(() => shell.current?.folder === gone && shell.task?.loaded && shell.pty);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    await ui(`document.getElementById('openProjects').click()`);
    assert.deepEqual((await menuRows(ui)).slice(-3), ['-', 'Close Project', 'Remove Project…']);
    await choose(ui, 'Remove Project…');
    await waitFor(() => !projects().includes('gone'));
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

    // A recent project's × on the Welcome screen: the same question.
    ctx.answer = false;
    await ui(`document.querySelector('#welcome-list [data-project="project"] .remove').click()`);
    await waitFor(() => ctx.asked.length);
    assert.equal(ctx.asked.pop().message, 'Remove the project project?');
    ctx.answer = true;
    assert.ok(projects().includes('project'), 'kept when the human says no');
    // A recent project's right-click menu on the Welcome screen.
    await ui(`document.querySelector('#welcome-list [data-project="project"]').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 300, clientY: 300 }))`);
    assert.deepEqual(await menuRows(ui), ['Open', '-', 'Remove Project…']);
    await choose(ui, 'Open');
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
