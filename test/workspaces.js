// Workspaces: forks of main with their own branch and folder (git worktrees), copies of the profiles, their own agent;
// the strip, switching, closing, the window with no project.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { assert, root, userData, project, pfile, savedTabs, panel, SITE, sleep, waitFor, who, menuRows, choose, manageProfiles, menuOpen, rightClick,
  box, pageBox, viewOn, dock, ctrl, near } = require('./helpers');
const { withOffset } = require('../src/main/workspaces');
const { trustLikeMain, claudeConfigOf } = require('../src/main/agents');
const hasDirenv = (() => { try { execFileSync('direnv', ['version']); return true; } catch { return false; } })();

const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=Kulisa test', '-c', 'user.email=test@example.invalid', ...args], { cwd, encoding: 'utf8' }).trim();
const tabs = (ui) => ui(`[...document.querySelectorAll('#wslist .wstab')].map((t) => t.querySelector('.name').textContent + (t.classList.contains('active') ? ' *' : ''))`);
const wsTab = (n) => `document.querySelector('#wslist .wstab[data-ws="${n}"]')`;
// + and the name in the dialog; resolves once the new workspace is shown, its agent started.
async function fork(ctx, name) {
  const { shell, ui } = ctx;
  const before = shell.ws;
  await ui(`document.getElementById('wsadd').click()`);
  await waitFor(() => ui(`document.getElementById('wsnew').open`));
  await ui(`document.getElementById('wsname').value = ${JSON.stringify(name)}; document.getElementById('wsform').requestSubmit()`);
  await waitFor(() => shell.ws !== before && shell.ws.name === name && shell.ws.loaded && shell.pty, 20000);
  ctx.watchPty(shell.pty);
  return shell.ws;
}

module.exports = (test) => {
  test('workspaces: a port offset moves local addresses only', async () => {
    assert.equal(withOffset('http://localhost:3000/cart?x=1', 100), 'http://localhost:3100/cart?x=1');
    assert.equal(withOffset('http://127.0.0.1:4417/app', 200), 'http://127.0.0.1:4617/app');
    assert.equal(withOffset('http://shop.localhost:8080/', 100), 'http://shop.localhost:8180/');
    assert.equal(withOffset('http://localhost/', 100), 'http://localhost/', 'no port: left alone');
    assert.equal(withOffset('https://example.com:8443/', 100), 'https://example.com:8443/', 'not local');
    assert.equal(withOffset('http://localhost:3000/', 0), 'http://localhost:3000/');
  });

  test('workspaces: a project reached through a symlink is placed right in its repository (macOS: /tmp, /var)', async () => {
    const { repoOf } = require('../src/main/worktrees');
    const repo = path.join(root, 'linked-repo'), link = path.join(root, 'linked');
    fs.mkdirSync(path.join(repo, 'app'), { recursive: true });
    git(repo, 'init', '-q');
    fs.symlinkSync(repo, link, 'junction');
    assert.equal((await repoOf(path.join(link, 'app'))).sub, 'app');
    assert.equal((await repoOf(link)).sub, '');
  });

  test("workspaces: Claude Code trusts a fork's folder as it trusts main; its config as the session tells it", async () => {
    const os = require('os');
    assert.equal(claudeConfigOf('/home/u/.claude-work/projects/-x/1.jsonl'), '/home/u/.claude-work/.claude.json');
    assert.equal(claudeConfigOf(path.join(os.homedir(), '.claude', 'projects', '-x', '1.jsonl')), path.join(os.homedir(), '.claude.json'));
    const file = path.join(root, 'claude.json');
    const write = (projects) => fs.writeFileSync(file, JSON.stringify({ userID: 'u', projects }));
    const read = () => JSON.parse(fs.readFileSync(file, 'utf8'));
    write({ '/p': { hasTrustDialogAccepted: true, allowedTools: ['x'] } });
    assert.equal(trustLikeMain(file, '/p', '/p@f'), true);
    assert.deepEqual(read().projects['/p@f'], { allowedTools: [], mcpContextUris: [], mcpServers: {}, enabledMcpjsonServers: [], disabledMcpjsonServers: [],
      hasClaudeMdExternalIncludesApproved: false, hasClaudeMdExternalIncludesWarningShown: false, hasTrustDialogAccepted: true });
    assert.equal(read().userID, 'u', 'the rest stays');
    write({ '/p': { hasTrustDialogAccepted: false } });
    assert.equal(trustLikeMain(file, '/p', '/p@f'), false, 'main not trusted: nothing');
    assert.equal(read().projects['/p@f'], undefined);
    fs.writeFileSync(file, '{"projects": [');
    assert.equal(trustLikeMain(file, '/p', '/p@f'), false, 'not as expected: nothing');
    assert.equal(fs.readFileSync(file, 'utf8'), '{"projects": [');
  });
  test("workspaces: a deleted fork leaves nothing in Claude Code's and Codex's data; main's and others' stay", async () => {
    const { AGENTS } = require('../src/main/agents');
    const agent = (id) => AGENTS.find((a) => a.id === id);
    const put = (f, text = '') => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
    // Claude: a config dir as Claude Code lays it out, with the fork's things and main's.
    const cfg = path.join(root, 'claude-config'), fork = '/p@f', main = '/p';
    const conv = path.join(cfg, 'projects', '-p-f'), mainConv = path.join(cfg, 'projects', '-p');
    const transcript = (cwd) => `{"type":"summary"}\n${JSON.stringify({ type: 'user', cwd })}\n`;
    put(path.join(conv, 's1.jsonl'), transcript(fork)); put(path.join(conv, 's2.jsonl'), transcript(fork)); put(path.join(conv, 's1', 'subagents', 'a.jsonl'));
    put(path.join(conv, 'o1.jsonl'), transcript('/p-f')); // another folder Claude names the same (-p-f)
    put(path.join(mainConv, 'm1.jsonl'));
    for (const id of ['s1', 's2', 'm1']) {
      put(path.join(cfg, 'file-history', id, 'x')); put(path.join(cfg, 'session-env', id, 'x'));
      put(path.join(cfg, 'debug', `${id}.txt`)); put(path.join(cfg, 'todos', `${id}-agent-${id}.json`));
    }
    put(path.join(cfg, 'history.jsonl'), [{ display: 'a', project: fork }, { display: 'b', project: main }, { display: 'c', project: fork }].map((l) => JSON.stringify(l)).join('\n') + '\n');
    put(path.join(cfg, '.claude.json'), JSON.stringify({ userID: 'u', projects: { [main]: { hasTrustDialogAccepted: true }, [fork]: { hasTrustDialogAccepted: true } } }));
    const ctx = { folder: fork, saved: { sessionId: 's1', transcript: path.join(conv, 's1.jsonl') }, main: { folder: main, transcript: path.join(mainConv, 'm1.jsonl') } };
    assert.equal(agent('claude').forget({ ...ctx, folder: main }), false, "never main's folder");
    assert.equal(agent('claude').forget({ ...ctx, saved: { transcript: path.join(root, 'elsewhere', 'x.jsonl') }, main: {} }), false, "not a Claude transcript's path");
    assert.equal(agent('claude').forget({ ...ctx, saved: {} }), true, "no session reported: main's config dir");
    assert.deepEqual(fs.readdirSync(conv), ['o1.jsonl'], "the fork's conversations; another folder's of the same name stay");
    for (const id of ['s1', 's2']) {
      assert.ok(!fs.existsSync(path.join(cfg, 'file-history', id)) && !fs.existsSync(path.join(cfg, 'session-env', id)) &&
        !fs.existsSync(path.join(cfg, 'debug', `${id}.txt`)) && !fs.existsSync(path.join(cfg, 'todos', `${id}-agent-${id}.json`)), `session ${id}`);
    }
    assert.ok(fs.existsSync(path.join(mainConv, 'm1.jsonl')) && fs.existsSync(path.join(cfg, 'file-history', 'm1')) && fs.existsSync(path.join(cfg, 'todos', 'm1-agent-m1.json')), "main's stay");
    assert.deepEqual(fs.readFileSync(path.join(cfg, 'history.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l).display), ['b']);
    const config = JSON.parse(fs.readFileSync(path.join(cfg, '.claude.json'), 'utf8'));
    assert.deepEqual(Object.keys(config.projects), [main]);
    assert.equal(config.userID, 'u');

    // Codex: its sessions in the fork's folder and its trust of the folder.
    const home = path.join(root, 'codex-home');
    const session = (f, cwd) => put(path.join(home, f), `${JSON.stringify({ type: 'session_meta', payload: { id: 'x', cwd } })}\n{"more":1}\n`);
    session('sessions/2026/10/06/rollout-a.jsonl', fork); session('archived_sessions/rollout-b.jsonl', fork); session('sessions/2026/10/06/rollout-c.jsonl', main);
    put(path.join(home, 'config.toml'), `model = "x"\n\n[projects."${fork}"]\ntrust_level = "trusted"\n\n[projects."${main}"]\ntrust_level = "trusted"\n`);
    const before = process.env.CODEX_HOME;
    process.env.CODEX_HOME = home;
    try { assert.equal(agent('codex').forget({ folder: fork, saved: {}, main: { folder: main } }), true); } finally {
      if (before === undefined) delete process.env.CODEX_HOME; else process.env.CODEX_HOME = before;
    }
    assert.ok(!fs.existsSync(path.join(home, 'sessions/2026/10/06/rollout-a.jsonl')) && !fs.existsSync(path.join(home, 'archived_sessions/rollout-b.jsonl')));
    assert.ok(fs.existsSync(path.join(home, 'sessions/2026/10/06/rollout-c.jsonl')), "main's session stays");
    assert.equal(fs.readFileSync(path.join(home, 'config.toml'), 'utf8'), `model = "x"\n\n[projects."${main}"]\ntrust_level = "trusted"\n`);
  });

  test('workspaces: without git a project has main only; Initialize git asks first; + waits for a first commit', async (ctx) => {
    const { ui } = ctx;
    await waitFor(async () => JSON.stringify(await tabs(ui)) === '["main *"]');
    assert.equal(await ui(`document.getElementById('wsadd').disabled`), true);
    assert.equal(await ui(`document.getElementById('wsinit').hidden`), false);
    ctx.answer = false;
    await ui(`document.getElementById('wsinit').click()`);
    await waitFor(() => ctx.asked.length);
    assert.match(ctx.asked.pop().message, /^Initialize git in .*project\?$/);
    await sleep(200);
    assert.ok(!fs.existsSync(path.join(project, '.git')), 'nothing without the confirmation');
    ctx.answer = true;
    await ui(`document.getElementById('wsinit').click()`);
    await waitFor(() => ui(`document.getElementById('wsinit').hidden`));
    ctx.asked.length = 0;
    assert.ok(fs.existsSync(path.join(project, '.git')));
    assert.equal(await ui(`document.getElementById('wsadd').title`), 'Workspaces need a first commit in git');
    // The human commits; the strip notices when the pointer comes to it.
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
    await ui(`document.getElementById('workspaces').dispatchEvent(new PointerEvent('pointerenter'))`);
    await waitFor(async () => !(await ui(`document.getElementById('wsadd').disabled`)));
  });

  test('workspaces: + makes a fork of main: its branch and folder, files outside git, copies of the profiles signed in, its own agent and ports', async (ctx) => {
    const { shell, ui, call } = ctx;
    const main = shell.ws;
    await call('browser_navigate', { profile: 'sam-admin', url: `${SITE}/app?fork` });
    const mainSam = main.profiles.get('sam-admin');
    const ws = await fork(ctx, 'Feature-X');
    const wt = `${fs.realpathSync(project)}@feature-x`; // next to the repository's real path (macOS: /var is /private/var)
    assert.equal(ws.n, 2);
    assert.equal(ws.folder, wt);
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
    assert.deepEqual(ws.env(), { KULISA_MCP_URL: `${shell.mcp.base}/ws/2/mcp`, KULISA_URL: `${shell.mcp.base}/ws/2`, KULISA_WORKSPACE: 'Feature-X', KULISA_PORT_OFFSET: '100' });
    assert.equal(shell.resumedSession, null, 'a new conversation');

    // Profiles: the same, the closed ones closed, each open one with its active tab moved to the fork's ports.
    assert.deepEqual([...shell.profiles.keys()], ['sam-admin', 'elon-buyer']);
    assert.deepEqual([...shell.closed.keys()], ['dora']);
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

    // The window: the fork's grid with its panes; the strip shows it.
    await waitFor(async () => JSON.stringify(await tabs(ui)) === '["main","Feature-X *"]');
    await waitFor(() => viewOn(shell, ui, 'sam-admin'));
    assert.equal(await ui(`document.querySelectorAll('.pane').length`), 2);
    assert.match(await ui(`${wsTab(2)}.title`), /branch feature-x in .*project@feature-x; the app's ports \+ 100/);
    await shell.screenshot(path.join(root, 'workspace.png'));
  });

  test('workspaces: switching shows the other grid and terminal; the one left keeps running; the agent\'s state shows on its tab', async (ctx) => {
    const { shell, ui } = ctx;
    const fork = shell.ws, sam = fork.profiles.get('sam-admin');
    await ui(`${wsTab(1)}.click()`);
    await waitFor(() => shell.ws.n === 1);
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
    assert.equal(sam.get().view.getVisible(), false, "the fork's pages are hidden");
    assert.ok(sam.tabs.every((t) => !t.wc.isDestroyed()) && fork.pty, 'and alive, its agent too');
    await waitFor(async () => (await ctx.termText()).includes(`agent: rc of ${project}\n`), 3000);
    assert.equal(JSON.parse(fs.readFileSync(path.join(userData, 'projects', 'project', 'workspaces.json'), 'utf8')).current, 1);
    // What the fork's agent does reaches its tab (Claude Code's hooks); its captions do not show on main's panes.
    const http = require('http');
    const post = (url) => new Promise((r) => http.request(url, { method: 'POST' }, (res) => { res.resume(); res.on('end', r); }).end('{}'));
    await post(`${fork.env().KULISA_URL}/hooks/prompt`);
    await waitFor(async () => (await ui(`${wsTab(2)}.querySelector('.state').dataset.state`)) === 'working');
    await post(`${fork.env().KULISA_URL}/hooks/stop`);
    await waitFor(async () => (await ui(`${wsTab(2)}.querySelector('.state').dataset.state`)) === 'done');
    fork.caption('sam-admin', 'from the fork');
    await sleep(200);
    assert.equal(await ui(`document.querySelector('.ptab[data-panel="${panel(shell, 'sam-admin')}"] .caption').textContent`), '');
  });

  test('workspaces: closing a fork asks first, saying what goes and any work not in main; it is deleted with its branch, folder and profiles', async (ctx) => {
    const { shell, ui } = ctx;
    const empty = await fork(ctx, 'Empty');
    assert.equal(empty.n, 3);
    assert.equal(empty.offset, 200);
    const transcript = path.join(root, 'empty-transcript.jsonl');
    fs.writeFileSync(transcript, '');
    const { sessionStart } = require('../src/main/agent-hooks');
    const context = sessionStart(empty, { session_id: 's-empty', transcript_path: transcript }).hookSpecificOutput.additionalContext;
    assert.match(context, /workspace "Empty".*branch empty.*plus 200/s);
    const dir = path.join(userData, 'projects', 'project', '3');
    await ui(`${wsTab(3)}.querySelector('.close').click()`);
    await waitFor(() => !shell.workspaces.has(3) && shell.ws.n === 1);
    const asked = ctx.asked.pop();
    assert.equal(asked.message, 'Delete the workspace Empty?', 'asked also without changes');
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
    await ui(`${wsTab(spike.n)}.querySelector('.close').click()`);
    await waitFor(() => ctx.asked.length);
    const q = ctx.asked.pop();
    assert.equal(q.message, 'Delete the workspace Spike?');
    assert.match(q.detail, /Work not in main, deleted with it:\n• 1 commit of its own and 1 uncommitted file/);
    assert.ok(shell.workspaces.has(spike.n) && fs.existsSync(spike.folder), 'kept when the human says no');
    ctx.answer = true;
    await ui(`${wsTab(spike.n)}.querySelector('.close').click()`);
    await waitFor(() => !shell.workspaces.has(spike.n) && shell.ws.n === 1);
    ctx.asked.length = 0;
    await waitFor(() => !fs.existsSync(spike.folder) && git(project, 'branch', '--list', 'spike') === '');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(userData, 'projects', 'project', 'workspaces.json'), 'utf8')).list.map((w) => w.name), ['main', 'Feature-X']);
  });

  test('workspaces: a fork with another agent; one not installed is installed from the window, then started', async (ctx) => {
    const { shell, ui } = ctx;
    await ui(`document.getElementById('wsadd').click()`);
    await waitFor(async () => (await ui(`[...document.getElementById('wsagent').options].map((o) => o.value + (o.selected ? ' *' : '')).join()`)) === 'custom *,fake,shell');
    await ui(`document.getElementById('wsagent').value = 'fake'; document.getElementById('wsname').value = 'Agent-pick'; document.getElementById('wsform').requestSubmit()`);
    // Not installed: the window asks, the chosen one preselected, with what Install runs.
    await waitFor(() => ui(`document.getElementById('agents').open && document.querySelectorAll('#agentlist .agentrow').length === 3`), 20000);
    const ws = shell.ws;
    assert.equal(ws.name, 'Agent-pick');
    assert.equal(ws.pty, null, 'no agent before the human chooses');
    const row = `document.querySelector('#agentlist .agentrow:has(input[value="fake"])')`;
    assert.equal(await ui(`${row}.querySelector('input').checked`), true);
    assert.equal(await ui(`${row}.querySelector('.status').textContent`), 'Not installed');
    assert.match(await ui(`${row}.querySelector('.install-line').textContent`), /^Install runs Kulisa tests's installer: echo "installing the fake agent"/);
    assert.equal(await ui(`document.getElementById('agentstart').disabled`), true);
    assert.equal(ws.profiles.get('sam-admin').get().view.getVisible(), false, 'pages hidden under the dialog');
    await ui(`${row}.querySelector('.install').click()`);
    await waitFor(async () => (await ui(`${row}.querySelector('.status').textContent`)) === 'Installed', 10000);
    assert.equal(await ui(`document.getElementById('agentprogress').textContent`), 'Fake agent is installed. Start it; it asks you to sign in.');
    assert.equal(await ui(`document.getElementById('agentdetails').open`), false, "the installer's own output only under Details");
    assert.match(await ui(`document.getElementById('agentlog').textContent`), /installing the fake agent\s+done/);
    await ui(`document.getElementById('agentstart').click()`);
    await waitFor(() => ws.pty);
    ctx.watchPty(ws.pty);
    await waitFor(async () => (await ctx.termText()).includes(`fake agent in ${ws.folder}, ports + ${ws.offset}`));
    assert.equal(JSON.parse(fs.readFileSync(pfile('agent.json', ws.n), 'utf8')).agent, 'fake');
    assert.equal(await ui(`document.getElementById('agents').open`), false);

    // A wrong choice is not a trap: the terminal's menu changes the agent; Cancel leaves it as it is.
    const changeAgent = async () => {
      await rightClick(ui, '#term');
      await menuRows(ui);
      await choose(ui, 'Change agent…');
      await waitFor(() => ui(`document.getElementById('agents').open && document.querySelectorAll('#agentlist .agentrow').length === 3`), 20000);
    };
    const fakePty = ws.pty;
    await changeAgent();
    assert.equal(await ui(`document.getElementById('agentcancel').hidden`), false);
    assert.equal(await ui(`document.querySelector('#agentlist input:checked').value`), 'fake', 'the current one chosen');
    await ui(`document.getElementById('agentcancel').click()`);
    await waitFor(async () => !(await ui(`document.getElementById('agents').open`)));
    await sleep(300);
    assert.equal(ws.pty, fakePty, 'Cancel: the agent goes on');
    await changeAgent();
    await ui(`document.querySelector('#agentlist input[value="shell"]').click()`);
    await ui(`document.getElementById('agentstart').click()`);
    await waitFor(() => ws.pty && ws.pty !== fakePty);
    assert.deepEqual(JSON.parse(fs.readFileSync(pfile('agent.json', ws.n), 'utf8')), { agent: 'shell', started: true }, 'a new conversation');
    assert.equal(ws.agent.id, 'shell');
    await ui(`${wsTab(ws.n)}.querySelector('.close').click()`);
    await waitFor(() => !shell.workspaces.has(ws.n) && shell.ws.n === 1);
    ctx.asked.length = 0;
  });

  test('workspaces: the project closed while the window still slides to another workspace; opened again, its pages show', async (ctx) => {
    const { shell, ui } = ctx;
    await ui(`${wsTab(2)}.click()`);
    await waitFor(() => shell.ws.n === 2 && shell.ws.loaded);
    // Back to main, and the project closed the moment main's state goes to the window, which is still sliding.
    const wc = shell.win.webContents, send = wc.send;
    let closed = null;
    wc.send = function (channel, ...args) { send.call(this, channel, ...args); if (channel === 'state') closed ??= shell.closeProject(); };
    try { await shell.showWorkspace(1); } finally { wc.send = send; }
    assert.ok(closed, 'closing was asked for during the switch');
    await closed;
    await waitFor(() => ui(`document.documentElement.classList.contains('noproject')`));
    await sleep(600); // the human looks at the Welcome screen a moment; the window has long finished sliding
    await ui(`[...document.querySelectorAll('#welcome-list .item')].find((b) => b.querySelector('.label').textContent === 'project').click()`);
    await waitFor(() => shell.ws?.n === 1 && shell.ws.loaded && shell.pty);
    ctx.watchPty(shell.pty);
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
  });

  // Last in phase 1: main is shown and Feature-X waits in the strip for the restart phase.
  test('workspaces: closing main closes the project; the window offers projects to open', async (ctx) => {
    const { shell, ui } = ctx;
    const fork = shell.workspaces.get(2);
    await ui(`${wsTab(1)}.querySelector('.close').click()`);
    await waitFor(() => shell.ws === null && shell.workspaces.size === 0);
    assert.ok(fork.profiles.size === 0 && !fork.pty, 'every workspace of the project stopped');
    await waitFor(() => ui(`document.documentElement.classList.contains('noproject')`));
    assert.equal(await ui(`getComputedStyle(document.getElementById('welcome')).display`), 'grid');
    assert.ok(await ui(`document.querySelector('#welcome .applogo').naturalWidth > 0`), 'the app logo loaded');
    // On an island in the grid's place, filling it (not on the project's glow).
    assert.ok(await ui(`(() => { const w = document.getElementById('welcome'), s = getComputedStyle(w);
      return w.getBoundingClientRect().height > innerHeight * 0.8 && s.backgroundColor === getComputedStyle(document.querySelector('dialog')).backgroundColor; })()`));
    assert.equal(await ui(`getComputedStyle(document.getElementById('workspaces')).display`), 'none');
    assert.equal(await ui(`document.getElementById('projectName').textContent`), 'No project');
    assert.equal(await ui(`document.documentElement.style.getPropertyValue('--project')`), '', "no project's color");
    assert.equal(shell.win.getTitle(), 'Kulisa');
    assert.equal(JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8')).lastProject, null);
    await ui(`[...document.querySelectorAll('#welcome-list .item')].find((b) => b.querySelector('.label').textContent === 'project').click()`);
    await waitFor(() => shell.ws?.n === 1 && shell.ws.loaded && shell.pty);
    ctx.watchPty(shell.pty);
    await waitFor(() => ui(`!document.documentElement.classList.contains('noproject') && !document.documentElement.classList.contains('loading')`));
    await waitFor(async () => JSON.stringify(await tabs(ui)) === '["main *","Feature-X"]');
    assert.equal(shell.workspaces.get(2).loaded, false, 'a workspace loads when it is shown');
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
  });

  test('welcome screen: Close Project in the project menu; links open in the browser', async (ctx) => {
    const { shell, ui } = ctx;
    await ui(`document.getElementById('openProjects').click()`);
    assert.deepEqual((await menuRows(ui)).slice(-3), ['-', 'Close Project', 'Remove Project…']);
    await choose(ui, 'Close Project');
    await waitFor(() => shell.ws === null && shell.workspaces.size === 0);
    await waitFor(() => ui(`document.documentElement.classList.contains('noproject')`));
    await ui(`document.getElementById('openProjects').click()`);
    assert.ok(!(await menuRows(ui)).includes('Close Project'), 'nothing to close');
    await ui(`document.getElementById('menu').hidePopover()`);
    assert.deepEqual(await ui(`[...document.querySelectorAll('#welcome .links a')].map((a) => a.textContent)`),
      ['kulisa.app', 'Documentation', 'GitHub', 'Report an issue']);
    assert.equal(await ui(`document.getElementById('version').textContent`), `Kulisa ${require('../package.json').version}`);
    const electron = require('electron'), openExternal = electron.shell.openExternal, opened = [];
    electron.shell.openExternal = async (url) => { opened.push(url); };
    try {
      await ui(`document.querySelector('#welcome .links a').click()`);
      await waitFor(() => opened.length === 1);
    } finally { electron.shell.openExternal = openExternal; }
    assert.equal(opened[0], 'https://kulisa.app/');
    assert.ok(await ui(`location.protocol === 'file:' && !!document.getElementById('welcome')`), 'the window stays on its page');
    await ui(`[...document.querySelectorAll('#welcome-list .item')].find((b) => b.querySelector('.label').textContent === 'project').click()`);
    await waitFor(() => shell.ws?.n === 1 && shell.ws.loaded && shell.pty);
    ctx.watchPty(shell.pty);
    await waitFor(() => ui(`!document.documentElement.classList.contains('noproject') && !document.documentElement.classList.contains('loading')`));
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
  });

  test('projects: Remove Project… asks, closes the project when open, deletes its data and forks, never its folder', async (ctx) => {
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
    fs.writeFileSync(path.join(data, 'workspaces.json'), JSON.stringify({ next: 3, current: 1, list: [{ n: 1, name: 'main' }, { n: 2, name: 'Idea', ...wt, offset: 100 }] }));

    // From Manage Projects…: the human is told what goes, says no, then yes.
    await ui(`document.getElementById('openProjects').click()`);
    await menuRows(ui);
    await choose(ui, 'Manage Projects…');
    await waitFor(() => ui(`!!document.querySelector('#projlist .projrow[data-project="${p.id}"]')`));
    const removeRow = `document.querySelector('#projlist .projrow[data-project="${p.id}"] .remove').click()`;
    ctx.answer = false;
    await ui(removeRow);
    await waitFor(() => ctx.asked.length);
    const q = ctx.asked.pop();
    assert.equal(q.message, 'Remove the project spare?');
    assert.match(q.detail, /sign-ins/);
    assert.ok(q.detail.includes(wt.worktree) && q.detail.includes('Idea: 1 commit of its own') && q.detail.includes(`${spare} stays as it is`));
    assert.ok(projects().includes(p.id) && fs.existsSync(data) && fs.existsSync(wt.worktree), 'kept when the human says no');
    ctx.answer = true;
    await ui(removeRow);
    await waitFor(() => !projects().includes(p.id));
    ctx.asked.length = 0;
    await waitFor(() => !fs.existsSync(data) && !fs.existsSync(wt.worktree));
    assert.equal(git(spare, 'branch', '--list', wt.branch), '', "the fork's branch");
    assert.equal(fs.readFileSync(path.join(spare, 'a.txt'), 'utf8'), 'a', "the project's own folder stays");
    await waitFor(() => ui(`!document.querySelector('#projlist .projrow[data-project="${p.id}"]')`));
    assert.equal(shell.ws?.n, 1, 'another project: the open one stays open');
    await ui(`document.getElementById('projects').close()`);

    // The open project, from the project button's menu: closed first, then removed; the Welcome screen.
    const gone = path.join(root, 'gone');
    fs.mkdirSync(gone);
    await ui(`kulisa.invoke('project:open', { folder: ${JSON.stringify(gone)} })`);
    await waitFor(() => shell.project === gone && shell.ws?.loaded && shell.pty);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    await ui(`document.getElementById('openProjects').click()`);
    assert.deepEqual((await menuRows(ui)).slice(-3), ['-', 'Close Project', 'Remove Project…']);
    await choose(ui, 'Remove Project…');
    await waitFor(() => !projects().includes('gone'));
    ctx.asked.length = 0;
    assert.equal(shell.ws, null);
    await waitFor(() => ui(`document.documentElement.classList.contains('noproject')`));
    assert.ok(fs.existsSync(gone) && !fs.existsSync(path.join(userData, 'projects', 'gone')));
    assert.equal(JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8')).lastProject, null);

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
    await waitFor(() => shell.ws?.n === 1 && shell.ws.loaded && shell.pty);
    ctx.watchPty(shell.pty);
    await waitFor(() => ui(`!document.documentElement.classList.contains('noproject') && !document.documentElement.classList.contains('loading')`));
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
  });
};
