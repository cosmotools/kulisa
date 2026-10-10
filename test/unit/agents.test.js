// The agents (agents.js): Claude Code's trust and dictation language, what a deleted task leaves in each agent's data, which hook sends which event.
// Plain Node (npm run test:unit), no Electron: logic that needs no window, in a temporary folder of its own.
const { test, after } = require('node:test');
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { trustLikeProject, claudeConfigOf } = require('../../src/main/agents');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kulisa-unit-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));

test("tasks: Claude Code trusts a task's folder as it trusts the project's; its config as the session tells it", async () => {
  assert.equal(claudeConfigOf('/home/u/.claude-work/projects/-x/1.jsonl'), '/home/u/.claude-work/.claude.json');
  assert.equal(claudeConfigOf(path.join(os.homedir(), '.claude', 'projects', '-x', '1.jsonl')), path.join(os.homedir(), '.claude.json'));
  const file = path.join(root, 'claude.json');
  const write = (projects) => fs.writeFileSync(file, JSON.stringify({ userID: 'u', projects }));
  const read = () => JSON.parse(fs.readFileSync(file, 'utf8'));
  write({ '/p': { hasTrustDialogAccepted: true, allowedTools: ['x'] } });
  assert.equal(trustLikeProject(file, '/p', '/p@f'), true);
  assert.deepEqual(read().projects['/p@f'], { allowedTools: [], mcpContextUris: [], mcpServers: {}, enabledMcpjsonServers: [], disabledMcpjsonServers: [],
    hasClaudeMdExternalIncludesApproved: false, hasClaudeMdExternalIncludesWarningShown: false, hasTrustDialogAccepted: true });
  assert.equal(read().userID, 'u', 'the rest stays');
  write({ '/p': { hasTrustDialogAccepted: false } });
  assert.equal(trustLikeProject(file, '/p', '/p@f'), false, 'own not trusted: nothing');
  assert.equal(read().projects['/p@f'], undefined);
  fs.writeFileSync(file, '{"projects": [');
  assert.equal(trustLikeProject(file, '/p', '/p@f'), false, 'not as expected: nothing');
  assert.equal(fs.readFileSync(file, 'utf8'), '{"projects": [');
});
test("agents: Claude Code's dictation is on in its sessions only; its language read and set in its settings, the rest kept", async () => {
  const { AGENTS, claudeLanguage } = require('../../src/main/agents');
  const claude = AGENTS.find((a) => a.id === 'claude');
  assert.deepEqual(claude.args({ plugin: '/p' }), ['--plugin-dir', '/p'], 'dictation is its voice entry\'s');
  assert.deepEqual(JSON.parse(claude.voice.args.at(-1)), { voice: { enabled: true, mode: 'hold', autoSubmit: false } });
  assert.deepEqual(['ru', 'Russian', 'русский', 'pt-BR', 'Klingon', '', undefined].map(claudeLanguage), ['ru', 'ru', 'ru', 'pt', 'en', 'en', 'en'],
    'as Claude Code reads it: anything else is English');
  // The settings of the config dir its session reported (as claudeConfigOf).
  const dir = path.join(root, 'claude-voice'), settings = path.join(dir, 'settings.json');
  const saved = { transcript: path.join(dir, 'projects', '-x', '1.jsonl') };
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(settings, JSON.stringify({ model: 'opus', language: 'German' }));
  assert.equal(claude.voice.language(saved), 'de');
  assert.deepEqual(claude.voice.setLanguage(saved, 'ru'), { language: 'ru' });
  assert.deepEqual(JSON.parse(fs.readFileSync(settings, 'utf8')), { model: 'opus', language: 'Russian' }, 'as its /config writes it');
  assert.equal(claude.voice.language(saved), 'ru');
  assert.ok(claude.voice.setLanguage(saved, 'xx').error, 'only one it understands');
  fs.writeFileSync(settings, '{ "model": ');
  assert.ok(claude.voice.setLanguage(saved, 'en').error, 'not JSON: not touched');
  assert.equal(fs.readFileSync(settings, 'utf8'), '{ "model": ');
  fs.rmSync(dir, { recursive: true });
});
test("tasks: a deleted task leaves nothing in Claude Code's and Codex's data; the project folder's and others' stay", async () => {
  const { AGENTS } = require('../../src/main/agents');
  const agent = (id) => AGENTS.find((a) => a.id === id);
  const put = (f, text = '') => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
  // Claude: a config dir as Claude Code lays it out, with the task's things and the project folder's.
  const cfg = path.join(root, 'claude-config'), copy = '/p@f', own = '/p';
  const conv = path.join(cfg, 'projects', '-p-f'), ownConv = path.join(cfg, 'projects', '-p');
  const transcript = (cwd) => `{"type":"summary"}\n${JSON.stringify({ type: 'user', cwd })}\n`;
  put(path.join(conv, 's1.jsonl'), transcript(copy)); put(path.join(conv, 's2.jsonl'), transcript(copy)); put(path.join(conv, 's1', 'subagents', 'a.jsonl'));
  put(path.join(conv, 'o1.jsonl'), transcript('/p-f')); // another folder Claude names the same (-p-f)
  put(path.join(ownConv, 'm1.jsonl'));
  for (const id of ['s1', 's2', 'm1']) {
    put(path.join(cfg, 'file-history', id, 'x')); put(path.join(cfg, 'session-env', id, 'x'));
    put(path.join(cfg, 'debug', `${id}.txt`)); put(path.join(cfg, 'todos', `${id}-agent-${id}.json`));
  }
  put(path.join(cfg, 'history.jsonl'), [{ display: 'a', project: copy }, { display: 'b', project: own }, { display: 'c', project: copy }].map((l) => JSON.stringify(l)).join('\n') + '\n');
  put(path.join(cfg, '.claude.json'), JSON.stringify({ userID: 'u', projects: { [own]: { hasTrustDialogAccepted: true }, [copy]: { hasTrustDialogAccepted: true } } }));
  const ctx = { folder: copy, saved: { sessionId: 's1', transcript: path.join(conv, 's1.jsonl') }, project: { folder: own, transcript: path.join(ownConv, 'm1.jsonl') } };
  assert.equal(agent('claude').forget({ ...ctx, folder: own }), false, "never the project's folder");
  assert.equal(agent('claude').forget({ ...ctx, saved: { transcript: path.join(root, 'elsewhere', 'x.jsonl') }, project: {} }), false, "not a Claude transcript's path");
  assert.equal(agent('claude').forget({ ...ctx, saved: {} }), true, "no session reported: another task's config dir");
  assert.deepEqual(fs.readdirSync(conv), ['o1.jsonl'], "the task's conversations; another folder's of the same name stay");
  for (const id of ['s1', 's2']) {
    assert.ok(!fs.existsSync(path.join(cfg, 'file-history', id)) && !fs.existsSync(path.join(cfg, 'session-env', id)) &&
      !fs.existsSync(path.join(cfg, 'debug', `${id}.txt`)) && !fs.existsSync(path.join(cfg, 'todos', `${id}-agent-${id}.json`)), `session ${id}`);
  }
  assert.ok(fs.existsSync(path.join(ownConv, 'm1.jsonl')) && fs.existsSync(path.join(cfg, 'file-history', 'm1')) && fs.existsSync(path.join(cfg, 'todos', 'm1-agent-m1.json')), "the project folder's stay");
  assert.deepEqual(fs.readFileSync(path.join(cfg, 'history.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l).display), ['b']);
  const config = JSON.parse(fs.readFileSync(path.join(cfg, '.claude.json'), 'utf8'));
  assert.deepEqual(Object.keys(config.projects), [own]);
  assert.equal(config.userID, 'u');

  // Which of each agent's hooks tells Kulisa which of its events (agent-hooks.js). Claude Code: waiting only for what
  // needs the human, not idle_prompt (a minute after an answer); a turn ended by an API error waits for them too.
  const claudeHooks = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'agent', 'claude-plugin', 'hooks', 'hooks.json'), 'utf8')).hooks;
  const sends = (h) => h[0].hooks[0].command.match(/hooks\/([\w-]+)/)[1];
  assert.deepEqual(Object.fromEntries(Object.entries(claudeHooks).map(([e, h]) => [e, sends(h)])), { SessionStart: 'session-start',
    UserPromptSubmit: 'prompt', Notification: 'waiting', Stop: 'stop', StopFailure: 'waiting', SessionEnd: 'session-end' });
  const needsYou = new RegExp(`^(${claudeHooks.Notification[0].matcher})$`);
  assert.deepEqual(['permission_prompt', 'elicitation_dialog', 'idle_prompt', 'auth_success'].map((t) => needsYou.test(t)), [true, true, false, false]);
  // Codex: its hooks as a config override, the same command line for every task (trusted once); resuming the
  // session its SessionStart reported.
  const codexArgs = (url) => agent('codex').args({ env: { KULISA_MCP_URL: url } });
  const hooks = codexArgs('http://127.0.0.1:1/task/a/1/mcp')[3];
  assert.equal(hooks, codexArgs('http://127.0.0.1:2/task/b/2/mcp')[3]);
  assert.deepEqual([...hooks.matchAll(/(\w+)=\[\{hooks=\[\{[^}]*hooks\/([\w-]+)/g)].map((m) => `${m[1]} ${m[2]}`),
    ['SessionStart session-start', 'UserPromptSubmit prompt', 'PermissionRequest waiting', 'Stop stop', 'Interrupt interrupt', 'SessionEnd session-end']);
  assert.deepEqual(agent('codex').resume({ started: true, sessionId: 's9' }), ['resume', 's9']);
  assert.deepEqual(agent('codex').resume({ started: true }), ['resume', '--last']);

  // Codex: its sessions in the task's folder and its trust of the folder.
  const home = path.join(root, 'codex-home');
  const session = (f, cwd) => put(path.join(home, f), `${JSON.stringify({ type: 'session_meta', payload: { id: 'x', cwd } })}\n{"more":1}\n`);
  session('sessions/2026/10/06/rollout-a.jsonl', copy); session('archived_sessions/rollout-b.jsonl', copy); session('sessions/2026/10/06/rollout-c.jsonl', own);
  put(path.join(home, 'config.toml'), `model = "x"\n\n[projects."${copy}"]\ntrust_level = "trusted"\n\n[projects."${own}"]\ntrust_level = "trusted"\n`);
  const before = process.env.CODEX_HOME;
  process.env.CODEX_HOME = home;
  try { assert.equal(agent('codex').forget({ folder: copy, saved: {}, project: { folder: own } }), true); } finally {
    if (before === undefined) delete process.env.CODEX_HOME; else process.env.CODEX_HOME = before;
  }
  assert.ok(!fs.existsSync(path.join(home, 'sessions/2026/10/06/rollout-a.jsonl')) && !fs.existsSync(path.join(home, 'archived_sessions/rollout-b.jsonl')));
  assert.ok(fs.existsSync(path.join(home, 'sessions/2026/10/06/rollout-c.jsonl')), "the project folder's session stays");
  assert.equal(fs.readFileSync(path.join(home, 'config.toml'), 'utf8'), `model = "x"\n\n[projects."${own}"]\ntrust_level = "trusted"\n`);
});

test("agents: a task's other folders go to Claude Code and Codex as --add-dir (Claude reads their CLAUDE.md too); one added later is typed as /add-dir", () => {
  const { AGENTS } = require('../../src/main/agents');
  const agent = (id) => AGENTS.find((a) => a.id === id);
  assert.deepEqual(agent('claude').dirs(['/k/a@task-2/web', '/k/docs']), { args: ['--add-dir', '/k/a@task-2/web', '--add-dir', '/k/docs'], env: { CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD: '1' } });
  assert.deepEqual(agent('codex').dirs(['/k/web']), { args: ['--add-dir', '/k/web'] });
  assert.equal(agent('claude').addDir('/k/web'), '/add-dir /k/web');
  assert.equal(agent('codex').addDir, undefined, 'others: a line saying so (tasks.js)');
});

test('accounts: the agent itself (the human\'s own folder) first, then those added; an added one has a folder of its own, gone when removed; the own one stays', () => {
  const { Accounts } = require('../../src/main/accounts');
  const data = path.join(root, 'accounts-data'), mine = path.join(root, 'my-claude');
  fs.mkdirSync(mine, { recursive: true });
  const defs = [{ id: 'claude', name: 'Claude Code', config: { env: 'CLAUDE_CONFIG_DIR', home: () => mine } }, { id: 'shell', name: 'Terminal only' }];
  const marked = [];
  const accounts = new Accounts(data, defs, (d) => marked.push(d));
  assert.deepEqual(accounts.all().map((a) => [a.id, a.name, a.dir, a.own]), [['claude', 'Claude Code', mine, true], ['shell', 'Terminal only', null, true]]);
  const work = accounts.add('claude', 'work');
  assert.deepEqual([work.id, work.name, work.dir, work.own], ['claude-work', 'Claude Code · work', path.join(data, 'agents', 'claude-work'), false]);
  assert.ok(fs.existsSync(work.dir));
  assert.match(accounts.add('claude', 'Work').error, /already/);
  assert.match(accounts.add('shell', 'x').error, /has no accounts/);
  assert.match(accounts.add('claude', 'a b').error, /only/);
  assert.deepEqual(new Accounts(data, defs).all().map((a) => a.id), ['claude', 'claude-work', 'shell'], 'kept');
  assert.match(accounts.remove('claude').error, /your own account stays/);
  assert.deepEqual(accounts.remove('claude-work'), { id: 'claude-work' });
  assert.ok(!fs.existsSync(work.dir) && marked.includes(work.dir) && fs.existsSync(mine), "its folder gone, the human's own kept");
});
