// The agents (agents/): Claude Code's trust and dictation language, what a deleted task leaves in each agent's data, which hook sends which event.
// Plain Node (npm run test:unit), no Electron: logic that needs no window, in a temporary folder of its own.
import { test, after } from 'node:test';
import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { extendTrust, AGENTS, findAgent, agentVersion, accountEmail, signOut } from '../../src/main/agents/index.ts';
import { claudeConfigOf } from '../../src/main/agents/claude.ts';
import { codex } from '../../src/main/agents/codex.ts';
import { CAPABILITIES } from '../../src/main/agents/agent.ts';
import { installSkill } from '../../src/main/agents/files.ts';
import { Accounts } from '../../src/main/accounts.ts';
import { shortEmail } from '../../src/main/log.ts';
import { drawing } from './drawing.ts';
import type { Agent } from '../../src/main/agents/index.ts';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kulisa-unit-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));

// Every agent the same Kulisa: what it cannot do is said, with why, never left out silently (agents/agent.ts, lacks).
// A new agent fails here until each of Kulisa's capabilities is either its own or a gap it names.
test("agents: each can do every capability Kulisa has, or says why not", () => {
  for (const a of AGENTS.filter((x) => x.command)) {
    for (const c of CAPABILITIES) {
      const has = a[c] !== undefined, why = a.lacks?.[c];
      assert.ok(has !== !!why, `${a.name}: ${c} ${has ? 'is there and said to be lacking' : 'is missing and not said why'}`);
      if (why) assert.match(why, /\w{3,} .{20,}/, `${a.name}: why it lacks ${c}, in words`);
    }
  }
  assert.deepEqual(Object.keys(AGENTS.find((a) => a.id === 'codex').lacks).sort(), ['addDir', 'language', 'voice']);
  assert.equal(AGENTS.find((a) => a.id === 'claude').lacks, undefined);
});

// Every agent gets Kulisa's profiles skill in its account's folder, where it reads its own skills: one text, written
// again only when it changed.
test("agents: Claude Code's and Codex's accounts get the profiles skill, one text", () => {
  const packages = path.join(import.meta.dirname, '..', '..', 'src', 'agent');
  const source = fs.readFileSync(path.join(packages, 'skills', 'profiles', 'SKILL.md'), 'utf8');
  assert.match(source, /^---\nname: kulisa-profiles\n/, "a name of Kulisa's, apart from the human's own skills");
  for (const id of ['claude', 'codex']) {
    const skills = path.join(root, `${id}-skill`, AGENTS.find((a) => a.id === id).skills);
    installSkill(packages, skills);
    const file = path.join(skills, 'kulisa-profiles', 'SKILL.md');
    assert.equal(fs.readFileSync(file, 'utf8'), source, id);
    const at = fs.statSync(file).mtimeMs;
    installSkill(packages, skills);
    assert.equal(fs.statSync(file).mtimeMs, at, 'the same text: not written again');
  }
});
test("tasks: a task's copy is trusted as the human trusted the project's code, in its folder or another task's copy, by Claude Code and Codex alike", async () => {
  const work = path.join(path.sep, 'home', 'u', '.claude-work'); // the OS's own separators: Windows' too
  assert.equal(claudeConfigOf(path.join(work, 'projects', '-x', '1.jsonl')), path.join(work, '.claude.json'));
  assert.equal(claudeConfigOf(path.join(os.homedir(), '.claude', 'projects', '-x', '1.jsonl')), path.join(os.homedir(), '.claude.json'));
  const agent = (id: string) => AGENTS.find((a) => a.id === id);
  // Claude Code: projects[<folder>].hasTrustDialogAccepted in its config file, the rest kept.
  const claude = agent('claude'), cdir = path.join(root, 'claude-trust'), file = path.join(cdir, '.claude.json'), where = { configDir: cdir };
  fs.mkdirSync(cdir, { recursive: true });
  const write = (projects: object) => fs.writeFileSync(file, JSON.stringify({ userID: 'u', projects }));
  const read = () => JSON.parse(fs.readFileSync(file, 'utf8'));
  write({ '/p': { hasTrustDialogAccepted: true, allowedTools: ['x'] } });
  assert.equal(extendTrust(claude, where, '/p@task-2', ['/p']), true);
  assert.deepEqual(read().projects['/p@task-2'], { allowedTools: [], mcpContextUris: [], mcpServers: {}, enabledMcpjsonServers: [], disabledMcpjsonServers: [],
    hasClaudeMdExternalIncludesApproved: false, hasClaudeMdExternalIncludesWarningShown: false, hasTrustDialogAccepted: true });
  assert.equal(read().userID, 'u', 'the rest stays');
  write({ '/p': { hasTrustDialogAccepted: false }, '/p@task-1': { hasTrustDialogAccepted: true } });
  assert.equal(extendTrust(claude, where, '/p@task-2', ['/p', '/p@task-1']), true, "trusted in another task's copy: once a project");
  write({ '/p': { hasTrustDialogAccepted: false } });
  assert.equal(extendTrust(claude, where, '/p@task-2', ['/p']), false, 'trusted nowhere: nothing, the agent asks');
  assert.equal(read().projects['/p@task-2'], undefined);
  fs.writeFileSync(file, '{"projects": [');
  assert.equal(extendTrust(claude, where, '/p@task-2', ['/p']), false, 'not as expected: nothing');
  assert.equal(fs.readFileSync(file, 'utf8'), '{"projects": [');
  // Codex: [projects."<folder>"] trust_level = "trusted" in its config.toml; the human's no is never carried or overwritten.
  const codex = agent('codex'), home = path.join(root, 'codex-trust'), toml = path.join(home, 'config.toml'), at = { configDir: home };
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(toml, 'model = "x"\n\n[projects."/p"]\ntrust_level = "trusted"\n');
  assert.equal(extendTrust(codex, at, '/p@task-2', ['/p']), true);
  assert.equal(fs.readFileSync(toml, 'utf8'), 'model = "x"\n\n[projects."/p"]\ntrust_level = "trusted"\n\n[projects."/p@task-2"]\ntrust_level = "trusted"\n');
  assert.equal(extendTrust(codex, at, '/p@task-2', ['/p']), false, 'trusted already: written once');
  fs.writeFileSync(toml, '[projects."/p"]\ntrust_level = "untrusted"\n\n[projects."/p@task-1"]\ntrust_level = "trusted"\n\n[projects."/p@task-3"]\ntrust_level = "untrusted"\n');
  assert.equal(extendTrust(codex, at, '/p@task-2', ['/p', '/p@task-1']), true, "trusted in another task's copy");
  assert.equal(extendTrust(codex, at, '/p@task-3', ['/p', '/p@task-1']), false, 'its own no stays');
  assert.equal(extendTrust(codex, at, '/q@task-1', ['/q']), false, 'trusted nowhere: nothing');
  assert.equal(extendTrust(codex, { configDir: path.join(root, 'codex-none') }, '/p@task-2', ['/p']), false, 'no config yet: nothing');
});
test("agents: Claude Code's dictation is on in its sessions only, Kulisa's tools allowed there but two, and reading what Kulisa keeps of its pages; its language read and set in its settings, the rest kept", async () => {
  const claude = AGENTS.find((a) => a.id === 'claude');
  const args = claude.args({ packages: '/k', env: {}, artifacts: '/data/projects/*/*/artifacts' });
  assert.deepEqual(args.slice(0, 3), ['--plugin-dir', path.join('/k', 'claude-plugin'), '--settings']);
  const { hooks, ...given } = JSON.parse(args[3]); // its hooks: below
  // With an account, the same settings as a file in its folder: the command typed into the terminal stays short.
  const account = path.join(root, 'claude-account'), withAccount = claude.args({ packages: '/k', env: {}, account, artifacts: '/data/projects/*/*/artifacts' });
  assert.equal(withAccount[3], path.join(account, 'kulisa-settings.json'));
  assert.deepEqual(JSON.parse(fs.readFileSync(withAccount[3], 'utf8')), JSON.parse(args[3]));
  assert.ok(hooks);
  assert.deepEqual(given, { voiceEnabled: true, voice: { enabled: true, mode: 'hold', autoSubmit: false }, permissions: {
    allow: ['mcp__plugin_kulisa_kulisa', 'Read(//data/projects/*/*/artifacts/**)'], ask: ['mcp__plugin_kulisa_kulisa__terminal_run', 'mcp__plugin_kulisa_kulisa__browser_file_upload'] } });
  // Its language setting in an account's folder, as its /config writes it; the rest of the file kept.
  const dir = path.join(root, 'claude-language'), settings = path.join(dir, 'settings.json');
  assert.deepEqual(claude.language.set(dir, 'de'), {});
  assert.deepEqual(JSON.parse(fs.readFileSync(settings, 'utf8')), { language: 'German' }, 'made when there is none');
  fs.writeFileSync(settings, JSON.stringify({ model: 'opus', language: 'German' }));
  assert.deepEqual(claude.language.set(dir, 'ru'), {});
  assert.deepEqual(JSON.parse(fs.readFileSync(settings, 'utf8')), { model: 'opus', language: 'Russian' });
  fs.utimesSync(settings, new Date(0), new Date(0));
  assert.deepEqual(claude.language.set(dir, 'ru'), {});
  assert.equal(fs.statSync(settings).mtimeMs, 0, 'already so: not written again');
  assert.ok(claude.language.set(dir, 'xx').error, 'only one it takes');
  fs.writeFileSync(settings, '{ "model": ');
  assert.ok(claude.language.set(dir, 'en').error, 'not JSON: not touched');
  assert.equal(fs.readFileSync(settings, 'utf8'), '{ "model": ');
  fs.rmSync(dir, { recursive: true });
});
test("tasks: a deleted task leaves nothing in Claude Code's and Codex's data; the project folder's and others' stay", async () => {
  const agent = (id: string) => AGENTS.find((a) => a.id === id);
  const put = (f: string, text = '') => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
  // Claude: a config dir as Claude Code lays it out, with the task's things and the project folder's.
  const cfg = path.join(root, 'claude-config'), copy = '/p@f', own = '/p';
  const conv = path.join(cfg, 'projects', '-p-f'), ownConv = path.join(cfg, 'projects', '-p');
  const transcript = (cwd: string) => `{"type":"summary"}\n${JSON.stringify({ type: 'user', cwd })}\n`;
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

  // Which of each agent's hooks tells Kulisa which of its events (agent-hooks.ts), given at its start: for Claude Code
  // in --settings with the plugin, for Codex as a config override; the same command line for every task (Codex asks to
  // trust its hooks once). Claude Code: waiting only for what needs the human, not idle_prompt (a minute after an
  // answer); a turn ended by an API error waits for them too.
  const sends = (h: { hooks: { command: string }[] }[]) => h[0].hooks[0].command.match(/hooks\/([\w-]+)/)[1];
  const claudeArgs = (url: string) => agent('claude').args({ env: { KULISA_MCP_URL: url }, packages: '/k', artifacts: '/p' });
  const claudeHooks = JSON.parse(claudeArgs('http://x')[3]).hooks;
  assert.deepEqual(claudeArgs('http://x').slice(0, 2), ['--plugin-dir', path.join('/k', 'claude-plugin')]);
  assert.deepEqual(Object.fromEntries(Object.entries(claudeHooks as Record<string, Parameters<typeof sends>[0]>).map(([e, h]) => [e, sends(h)])), { SessionStart: 'session-start',
    UserPromptSubmit: 'prompt', Notification: 'waiting', PostToolUse: 'tool-done', Stop: 'stop', StopFailure: 'waiting', SessionEnd: 'session-end' });
  const needsYou = new RegExp(`^(${claudeHooks.Notification[0].matcher})$`);
  assert.deepEqual(['permission_prompt', 'elicitation_dialog', 'idle_prompt', 'auth_success'].map((t) => needsYou.test(t)), [true, true, false, false]);
  assert.equal(claudeHooks.Stop[0].hooks[0].command, 'curl -sf --max-time 3 --data-binary @- "$KULISA_URL/hooks/stop" || true');
  // Codex: its hooks as a config override; resuming the session its SessionStart reported.
  const codexArgs = (url: string) => agent('codex').args({ env: { KULISA_MCP_URL: url }, packages: '/k', artifacts: '/p' });
  const hooks = codexArgs('http://127.0.0.1:1/task/a/1/mcp')[3];
  // Kulisa's tools approved, but the two that keep its own approval.
  assert.deepEqual(codexArgs('http://x').slice(4), ['-c', 'mcp_servers.kulisa.default_tools_approval_mode="approve"',
    '-c', 'mcp_servers.kulisa.tools.terminal_run.approval_mode="prompt"', '-c', 'mcp_servers.kulisa.tools.browser_file_upload.approval_mode="prompt"']);
  assert.equal(hooks, codexArgs('http://127.0.0.1:2/task/b/2/mcp')[3]);
  assert.deepEqual([...hooks.matchAll(/(\w+)=\[\{hooks=\[\{[^}]*hooks\/([\w-]+)/g)].map((m) => `${m[1]} ${m[2]}`),
    ['SessionStart session-start', 'UserPromptSubmit prompt', 'PermissionRequest waiting', 'PostToolUse tool-done', 'Stop stop', 'Interrupt interrupt', 'SessionEnd session-end']);
  // Codex cuts an Interrupt or SessionEnd hook's timeout to 3 s, with a warning at every start.
  assert.deepEqual([...hooks.matchAll(/(Interrupt|SessionEnd)=\[\{hooks=\[\{type="command",timeout=(\d+)/g)].map((m) => +m[2] <= 3), [true, true]);
  const resume = agent('codex').resume as (saved: object) => string[];
  assert.deepEqual(resume({ started: true, sessionId: 's9' }), ['resume', 's9']);
  assert.deepEqual(resume({ started: true }), ['resume', '--last']);

  // Codex: its sessions in the task's folder and its trust of the folder.
  const home = path.join(root, 'codex-home');
  const session = (f: string, cwd: string, id: string) => put(path.join(home, f), `${JSON.stringify({ type: 'session_meta', payload: { id, cwd } })}\n{"more":1}\n`);
  session('sessions/2026/10/06/rollout-a.jsonl', copy, 'a'); session('archived_sessions/rollout-b.jsonl', copy, 'b'); session('sessions/2026/10/06/rollout-c.jsonl', own, 'c');
  const typed = (id: string) => JSON.stringify({ session_id: id, ts: 1, text: `typed in ${id}` });
  put(path.join(home, 'history.jsonl'), `${typed('a')}\n${typed('c')}\n${typed('b')}\n`);
  put(path.join(home, 'config.toml'), `model = "x"\n\n[projects."${copy}"]\ntrust_level = "trusted"\n\n[projects."${own}"]\ntrust_level = "trusted"\n`);
  const before = process.env.CODEX_HOME;
  process.env.CODEX_HOME = home;
  try { assert.equal(agent('codex').forget({ folder: copy, saved: {}, project: { folder: own } }), true); } finally {
    if (before === undefined) delete process.env.CODEX_HOME; else process.env.CODEX_HOME = before;
  }
  assert.ok(!fs.existsSync(path.join(home, 'sessions/2026/10/06/rollout-a.jsonl')) && !fs.existsSync(path.join(home, 'archived_sessions/rollout-b.jsonl')));
  assert.ok(fs.existsSync(path.join(home, 'sessions/2026/10/06/rollout-c.jsonl')), "the project folder's session stays");
  assert.equal(fs.readFileSync(path.join(home, 'history.jsonl'), 'utf8'), `${typed('c')}\n`, "the prompts typed in the task's sessions go");
  assert.equal(fs.readFileSync(path.join(home, 'config.toml'), 'utf8'), `model = "x"\n\n[projects."${own}"]\ntrust_level = "trusted"\n`);
});

test("agents: a task's other folders go to Claude Code and Codex as --add-dir (Claude reads their CLAUDE.md too); one added later is sent as /add-dir, its question answered", () => {
  const agent = (id: string) => AGENTS.find((a) => a.id === id);
  assert.deepEqual(agent('claude').dirs(['/k/a@task-2/web', '/k/docs']), { args: ['--add-dir', '/k/a@task-2/web', '--add-dir', '/k/docs'], env: { CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD: '1' } });
  assert.deepEqual(agent('codex').dirs(['/k/web']), { args: ['--add-dir', '/k/web'] });
  assert.equal(agent('claude').addDir.command('/k/web'), '/add-dir /k/web');
  assert.equal(agent('codex').addDir, undefined, 'others: a line saying so (tasks.ts)');
});

test("agents: one not installed is not found, so the window offers to install it", async () => {
  for (const a of AGENTS.filter((x) => x.command)) assert.equal(await findAgent({ ...a, command: 'kulisa-no-such-agent' }, root), null, a.name);
});

test("agents: one installed by npm on Windows is its .cmd, which runs: its version, its account's sign-in and sign-out", { skip: process.platform !== 'win32' ? "a .cmd is Windows' own" : false }, async (t) => {
  // npm puts three next to each other: a script for sh (no extension, which where.exe lists first), .cmd and .ps1.
  // Another install later in PATH is not the one the shell runs.
  const bin = path.join(fs.realpathSync.native(root), 'npm bin'), older = path.join(root, 'older bin'), log = path.join(root, 'npm-agent.log');
  fs.mkdirSync(bin); fs.mkdirSync(older);
  fs.writeFileSync(path.join(older, 'kulisa-npm-agent.bat'), '@echo kulisa-npm-agent 1.0.0\r\n');
  fs.writeFileSync(path.join(bin, 'kulisa-npm-agent'), '#!/bin/sh\necho sh\n');
  fs.writeFileSync(path.join(bin, 'kulisa-npm-agent.ps1'), 'echo ps1\n');
  fs.writeFileSync(path.join(bin, 'kulisa-npm-agent.cmd'), [
    '@echo off', `echo %*>>"${log}"`, 'if "%1"=="--version" echo kulisa-npm-agent 4.5.6',
    'if "%2"=="status" echo {"email":"Ann@Example.test"}', ''].join('\r\n'));
  const PATH = process.env.PATH;
  process.env.PATH = `${bin};${older};${PATH}`;
  t.after(() => { process.env.PATH = PATH; });
  const agent: Agent = { id: 'npm', name: 'npm agent', maker: '', needs: '', command: 'kulisa-npm-agent',
    config: { env: 'NPM_AGENT_DIR', home: () => root, login: () => [], status: ['auth', 'status'], email: (out) => JSON.parse(out).email, logout: ['auth', 'logout'] } };
  const found = await findAgent(agent, root);
  assert.deepEqual(found, { path: path.join(bin, 'kulisa-npm-agent.cmd'), onPath: true });
  assert.equal(await agentVersion(found), '4.5.6');
  assert.deepEqual(await accountEmail(agent, found, root), { email: 'ann@example.test' });
  await signOut(agent, found, root);
  assert.deepEqual(fs.readFileSync(log, 'utf8').split(/\r?\n/).filter(Boolean), ['--version', 'auth status', 'auth logout']);
  // One in the project's folder, not in PATH, is not the agent: a repository's own file is not run as it.
  const repo = path.join(root, 'repo');
  fs.mkdirSync(repo);
  fs.writeFileSync(path.join(repo, 'kulisa-repo-agent.cmd'), '@echo 6.6.6\r\n');
  assert.equal(await findAgent({ ...agent, command: 'kulisa-repo-agent' }, repo), null);
});

test("Codex: the email is its auth.json id token's; none without one", () => {
  const dir = fs.mkdtempSync(path.join(root, 'codex-auth-')), email = codex.config.email;
  const jwt = (claims: object) => ['e30', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'sig'].join('.');
  assert.equal(email('Logged in using ChatGPT', dir), null, 'no auth.json');
  fs.writeFileSync(path.join(dir, 'auth.json'), JSON.stringify({ auth_mode: 'chatgpt', tokens: { id_token: jwt({ email: 'ann@shop.com' }) } }));
  assert.equal(email('Logged in using ChatGPT', dir), 'ann@shop.com');
  fs.writeFileSync(path.join(dir, 'auth.json'), JSON.stringify({ auth_mode: 'apikey', OPENAI_API_KEY: 'k' }));
  assert.equal(email('Logged in using an API key', dir), null, 'an API key: no email');
});

test("accounts: one store, kept until deleted; its folder a fixed id, random, the email kept; an agent with accounts is no account itself", () => {
  const data = path.join(root, 'accounts-data');
  const defs = [{ id: 'claude', name: 'Claude Code', config: { env: 'CLAUDE_CONFIG_DIR', home: () => '/nowhere', login: (): string[] => [] } }, { id: 'shell', name: 'Terminal only' }] as Agent[];
  const marked: string[] = [];
  const accounts = new Accounts(data, defs, (d) => { marked.push(d); });
  assert.deepEqual(accounts.all().map((a) => [a.id, a.own, a.choosable]), [['claude', true, false], ['shell', true, true]], "the human's own ~/.claude is no account");
  assert.deepEqual(accounts.choosable().map((a) => a.id), ['shell']);
  const r = accounts.prepare('claude') as { id: string; dir: string };
  assert.match(r.id, /^[a-z0-9]{6}$/);
  assert.equal(r.dir, path.join(data, 'agents', `claude-${r.id}`), 'its folder its agent and its id');
  assert.ok(fs.existsSync(r.dir), 'its folder made before the sign-in');
  assert.match(accounts.prepare('shell').error, /has no accounts/);
  const ann = accounts.create(r.id, 'claude', 'ann@shop.com');
  assert.deepEqual([ann.id, ann.name, ann.dir, ann.own, ann.choosable], [r.id, 'Claude Code · ann@shop.com', r.dir, false, true]);
  assert.equal(accounts.byEmail('claude', 'ann@shop.com').id, r.id, 'an email it has already: that account');
  assert.equal(accounts.byEmail('claude', null), null);
  assert.deepEqual(new Accounts(data, defs).all().map((a) => a.id), ['claude', r.id, 'shell'], 'kept');
  const cy = accounts.create((accounts.prepare('claude') as { id: string }).id, 'claude', 'cy@shop.com');
  assert.notEqual(cy.id, r.id);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(data, 'agents.json'), 'utf8')).list, [{ id: r.id, agent: 'claude', email: 'ann@shop.com' }, { id: cy.id, agent: 'claude', email: 'cy@shop.com' }]);
  // Deleted, it goes (a sign-in is made again only by signing in again).
  accounts.drop(r.id);
  accounts.drop(cy.id);
  assert.equal(accounts.find(r.id), null);
  accounts.remove(r.dir);
  assert.ok(!fs.existsSync(r.dir) && marked.includes(r.dir), 'its folder gone');
  // Drawn again while an agent or an account has the id or its folder is there (a removed one's may wait for the next
  // start).
  accounts.create('aaaaaa', 'claude', 'dee@shop.com');
  fs.mkdirSync(path.join(data, 'agents', 'claude-bbbbbb'));
  const undraw = drawing('claude', 'aaaaaa', 'bbbbbb', 'cccccc');
  try { assert.equal((accounts.prepare('claude') as { id: string }).id, 'cccccc'); } finally { undraw(); }
  accounts.drop('aaaaaa');
  // At start: a sign-in that did not end, and the format before (accounts.json), go.
  fs.writeFileSync(path.join(data, 'accounts.json'), '[]');
  const bob = accounts.create((accounts.prepare('claude') as { id: string }).id, 'claude', 'bob@shop.com');
  new Accounts(data, defs, (d) => { marked.push(d); }).clean();
  assert.deepEqual(fs.readdirSync(path.join(data, 'agents')), [`claude-${bob.id}`]);
  assert.ok(!fs.existsSync(path.join(data, 'accounts.json')));
});

test('accounts: the log names an id by its agent and its email, shortened', () => {
  assert.equal(shortEmail('myqoop@gmail.com'), 'myq…@gmail.com');
  assert.equal(shortEmail('al@shop.com'), 'a…@shop.com', 'at most half of a short name');
  assert.equal(shortEmail('nobody'), '…');
  const accounts = new Accounts(path.join(root, 'labels-data'), [{ id: 'claude', name: 'Claude Code', config: { env: 'CLAUDE_CONFIG_DIR', home: () => '/nowhere', login: (): string[] => [] } }] as Agent[]);
  const ann = accounts.create((accounts.prepare('claude') as { id: string }).id, 'claude', 'ann@shop.com'), bob = accounts.create((accounts.prepare('claude') as { id: string }).id, 'claude', null);
  assert.equal(accounts.label(ann.id), `${ann.id} (Claude Code, an…@shop.com)`);
  assert.equal(accounts.label(bob.id), `${bob.id} (Claude Code)`);
  assert.equal(accounts.label('claude'), 'Claude Code', 'an agent itself');
  assert.equal(accounts.label('gone12'), 'gone12');
});
test("agents: Claude Code's dictation recognizes for an agent without one only with a Claude.ai sign-in, in hold mode with autoSubmit, its text posted by its hook, no plugins' servers, none of a parent session's variables; what it keeps of its folder goes by its account's folder", () => {
  const claude = AGENTS.find((a) => a.id === 'claude'), r = claude.recognizer;
  const dir = path.join(root, 'claude-recognizer'), folder = path.join(root, 'kulisa-data', 'dictation');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude.json'), JSON.stringify({ projects: {} }));
  assert.equal(r.available(dir), false, 'an API key: its voice mode is not offered');
  fs.writeFileSync(path.join(dir, '.claude.json'), JSON.stringify({ oauthAccount: { emailAddress: 'a@b.c' }, projects: {} }));
  assert.equal(r.available(dir), true);
  const args = r.args();
  assert.equal(args.at(-1), '--strict-mcp-config');
  const settings = JSON.parse(args[args.indexOf('--settings') + 1]);
  assert.deepEqual(settings.voice, { enabled: true, mode: 'hold', autoSubmit: true });
  assert.match(settings.hooks.UserPromptSubmit[0].hooks[0].command, /\$KULISA_URL\/hooks\/prompt/);
  assert.deepEqual(r.env({ CLAUDECODE: '1', CLAUDE_CODE_ENTRYPOINT: 'cli', HOME: '/h' }), { HOME: '/h' });
  assert.deepEqual({ key: r.key, clear: r.clear, submit: r.submit }, { key: ' ', clear: '\x05\x15', submit: '\r' });
  // Its session in Kulisa's folder: trusted, then forgotten by the account's folder (no conversation reported).
  assert.ok(claude.trust.set({ configDir: dir }, folder));
  const conv = path.join(dir, 'projects', folder.replace(/[^a-zA-Z0-9]/g, '-'));
  fs.mkdirSync(conv, { recursive: true });
  fs.writeFileSync(path.join(conv, 's.jsonl'), `${JSON.stringify({ type: 'system', cwd: folder, content: 'Original prompt: what was said' })}\n`);
  assert.equal(claude.forget({ folder, configDir: dir }), true);
  assert.ok(!fs.existsSync(conv), 'its conversation, holding what was said');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, '.claude.json'), 'utf8')).projects, {}, 'its trust');
});
