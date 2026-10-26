// The agent's side of Kulisa: the MCP server and its local-only checks, the Claude Code plugin, the session-start hook,
// one core under the window and the agent, task_history, @playwright/mcp through the CDP proxy
// (src/main/kulisa-plugin/CLAUDE.md, docs/profiles.md, docs/transcripts.md).
import { spawnSync, spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import WebSocket from 'ws';
import { test, expect } from './fixtures.ts';
import { SITE, act, invoke } from './helpers.ts';
import { hookCommand } from '../../src/main/agents/agent.ts';
import { profiles, signIn, opened } from './agent-helpers.ts';

test('web pages cannot reach the MCP server, its hooks or the CDP proxy (Host and Origin checks)', async ({ core, files }) => {
  const { sam } = await profiles(core);
  const status = (url: string, headers: Record<string, string>, method = 'GET', body = '{}') => new Promise((resolve) => {
    const r = http.request(url, { method, headers }, (res) => { res.resume(); resolve(res.statusCode); });
    r.on('error', () => resolve('error')); r.end(method === 'POST' ? body : undefined);
  });
  const { url, hooks, base, endpoint } = await core((k, id) => ({ url: k.shell.task.env().KULISA_MCP_URL, hooks: `${k.shell.task.env().KULISA_URL}/hooks`, base: k.shell.mcp.base, endpoint: k.shell.profiles.get(id).endpoint }), sam);
  const mcp = new URL(url), proxy = new URL(endpoint);
  const json = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
  // DNS rebinding: a page on evil.example resolving to 127.0.0.1 sends its own Host.
  expect(await status(url, { ...json, host: `evil.example:${mcp.port}` }, 'POST')).toBe(403);
  expect(await status(`${hooks}/session-start`, { host: `evil.example:${mcp.port}` })).toBe(403);
  expect(await status(`${proxy.href}/json/version`, { host: `evil.example:${proxy.port}` })).toBe(403);
  // A page's own requests carry Origin.
  expect(await status(url, { ...json, origin: 'https://evil.example' }, 'POST')).toBe(403);
  const task = (origin?: string) => new Promise((resolve) => {
    const s = new WebSocket(`ws://127.0.0.1:${proxy.port}/${files.tkey('project', 1)}/${sam}`, origin ? { origin } : {});
    s.on('open', () => { s.close(); resolve('open'); }); s.on('error', () => resolve('refused'));
  });
  expect(await task('https://evil.example')).toBe('refused');
  expect(await task()).toBe('open'); // Playwright and other local tools send no Origin
  expect(await status(`${hooks}/session-start`, {})).toBe(200);
  expect(await status(`${base}/task/${files.pid('project')}/nosuch/hooks/session-start`, {}), 'no such task').toBe(404);
  // The MCP SDK's transport reads the body: a malformed one is refused, and one over its limit (4 MB) is not kept.
  expect(await status(url, json, 'POST', '{not json')).toBe(400);
  expect(await status(url, json, 'POST', 'x'.repeat(5 << 20))).toBe(413);
});

test('agent bridge: the Claude Code plugin is valid and points at this MCP server', async ({ core, files }) => {
  const { packages, url, base } = await core((k) => ({ packages: k.shell.packages, url: k.shell.task.env().KULISA_MCP_URL, base: k.shell.mcp.base }));
  const plugin = path.join(packages, 'claude-plugin');
  expect(fs.existsSync(path.join(plugin, '.claude-plugin', 'plugin.json'))).toBe(true);
  expect(fs.existsSync(path.join(packages, 'skills', 'profiles', 'SKILL.md')), "the profiles skill, every agent's").toBe(true);
  const mcp = JSON.parse(fs.readFileSync(path.join(plugin, '.mcp.json'), 'utf8'));
  expect(mcp.mcpServers.kulisa.url).toBe('${KULISA_MCP_URL}');
  expect(url).toBe(`${base}/task/${files.tkey('project', 1)}/mcp`);
  // With Claude Code installed, check the plugin the way it loads it.
  const v = spawnSync('claude', ['plugin', 'validate', plugin], { encoding: 'utf8' });
  if (!v.error) expect(v.status, v.stdout + v.stderr).toBe(0);
});

test('the window and the agent act on one core: an address read the same way, the same refusals', async ({ core, call, ui, files }) => {
  const { sam } = await profiles(core);
  const url = () => core((k) => k.profile('Sam.seller').get().wc.getURL());
  const host = SITE.replace('http://', ''); // 127.0.0.1:<port>, a host and a port (not a scheme)
  await act(ui, 'tab:navigate', { profile: sam, tab: await core((k) => k.profile('Sam.seller').active), url: `${host}/app?by=human` });
  await expect.poll(url).toBe(`${SITE}/app?by=human`);
  await call('browser_navigate', { profile: 'Sam.seller', url: `${host}/app?by=agent` });
  expect(await url()).toBe(`${SITE}/app?by=agent`);
  const id = opened(await call('browser_tab_new', { profile: 'Sam.seller', url: `${host}/app?tab` }));
  expect(await core((k, t) => k.profile('Sam.seller').get(t).wc.getURL(), id)).toBe(`${SITE}/app?tab`);
  await act(ui, 'tab:close', { profile: sam, tab: id });
  await expect.poll(() => core((k, t) => !k.profile('Sam.seller').get(t), id)).toBe(true);

  expect((await act(ui, 'tab:reload', { profile: 'nobody' })).error).toMatch(/No profile "nobody"/);
  await expect(call('browser_snapshot', { profile: 'nobody' })).rejects.toThrow(/No profile "nobody"/);
  expect((await act(ui, 'tab:close', { profile: sam, tab: 'k999' })).error).toMatch(/No tab k999 in Sam\.seller/);
  await expect(call('browser_tab_close', { profile: 'sam.SELLER', tab: 'k999' }), 'its name in any case').rejects.toThrow(/No tab k999 in Sam\.seller/);
  // An action of the window names its task: one sent for a task no longer shown (the human just switched)
  // is refused, not done in the one shown now.
  const tabs = () => core((k) => k.profile('Sam.seller').tabs.length), before = await tabs();
  expect((await invoke(ui, 'tab:new', { task: `${files.pid('project')}/2`, profile: sam })).error).toMatch(/not on screen/);
  expect((await invoke(ui, 'tab:new', { profile: sam })).error).toMatch(/not on screen/);
  expect(await tabs()).toBe(before);
});

test('agent bridge: at session start the plugin hook tells the agent which profiles are open, and Kulisa notes the session', async ({ core, mcp, files }) => {
  await profiles(core);
  const command = hookCommand('session-start'); // what every agent's SessionStart hook runs (agents/agent.ts)
  // Run it the way Claude Code does (bash): Kulisa answers it from its process. Claude Code passes the hook its input
  // as JSON on stdin.
  const transcript = path.join(files.project, 'transcript.jsonl');
  fs.writeFileSync(transcript, '');
  const input = JSON.stringify({ hook_event_name: 'SessionStart', session_id: 'session-1', transcript_path: transcript, source: 'startup' });
  const run = (env: Record<string, string>) => new Promise<{ code: number; out: string }>((resolve) => {
    const c = spawn('bash', ['-c', command], { env: { ...process.env, KULISA_URL: '', ...env } });
    let out = ''; c.stdout.on('data', (d) => (out += d)); c.on('close', (code) => resolve({ code, out }));
    c.stdin.end(input);
  });
  // The agent's terminal's own environment: its conversation's.
  const { env, terminal } = await core((k) => { const agent = k.shell.task.promptTarget(); return { env: k.shell.task.env(agent), terminal: agent.id }; });
  const inKulisa = await run(env);
  expect(files.json(files.pfile('agent.json')).conversations.map(({ from, ...c }: { from: number }) => c))
    .toEqual([{ agent: 'custom', started: true, terminal, sessionId: 'session-1', transcript }]);
  expect(inKulisa.code).toBe(0);
  const context = JSON.parse(inKulisa.out).hookSpecificOutput.additionalContext;
  expect(context).toMatch(/- Sam\.seller: seller in the test shop/);
  expect(context).toMatch(/- Elon\.buyer: who it is is not said/);
  expect(context).toMatch(/tab k\d+ \(active\)/);
  // Another browser's tools may sit next to Kulisa's with the same names (cast's browser_click, Playwright MCP's):
  // every agent is told which browser is the human's, Claude Code again next to the profiles.
  const only = /Kulisa profiles are the only browser here.*Do not use another browser's tools/s;
  expect(context).toMatch(only);
  expect((await mcp()).getInstructions()).toMatch(only);
  expect(await run({}), 'without its URL the hook does nothing and fails nothing').toEqual({ code: 0, out: '' });
});

// task_history (history.ts): the task's runs read from their transcripts, for an agent taking the task over or one
// whose context lost the details. The test agent reads transcripts as Claude Code's (app.ts).
test("agent: task_history gives where the task stands and its conversations, each with its tab, when and what it was about; then one whole, the latest chapter first, in parts", async ({ core, call, files }) => {
  await profiles(core);
  const transcript = (name: string, records: object[]) => {
    const file = path.join(files.root, 'transcripts', name, 's.jsonl');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, records.map((r) => JSON.stringify(r)).join('\n'));
    return file;
  };
  const said = (who: 'user' | 'assistant', text: string, more = {}) => ({ type: who, message: { role: who, content: who === 'user' ? text : [{ type: 'text', text }] }, ...more });
  const earlier = transcript('earlier', [said('user', 'Start the checkout feature'), said('assistant', 'Checkout started in cart.ts')]);
  // The open one: compacted once, then a long tool output, then the human unanswered.
  const current = transcript('current', [
    said('user', 'Old request before the summary'),
    said('user', 'This session is being continued from a previous conversation. Summary: checkout half done.', { isCompactSummary: true }),
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'npm test' } }] } },
    { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'x'.repeat(200_000), is_error: true }] } },
    said('user', 'Finish the pay step'),
  ]);
  // The closed one first, as it was had; the open one is the agent's tab's.
  const saved = await core((k, a) => {
    const task = k.shell.task, was = task.store.agent(), open = task.promptTarget();
    task.store.saveAgent({ ...was, conversations: [
      { agent: 'custom', transcript: a.earlier, sessionId: 'before', from: Date.UTC(2026, 9, 1, 9), to: Date.UTC(2026, 9, 1, 10), title: 'Checkout start' },
      { ...was.conversations[open.conversation], transcript: a.current, sessionId: 'now' }] });
    open.conversation = 1;
    return was;
  }, { earlier, current });
  try {
    const list = (await call('task_history', {})).text;
    expect(list).toMatch(/^Part 1 of 1\. The last one\.\n\n# Where the task stands \(from Kulisa\)\n\nThe task "[^"]+", in /);
    expect(list).toMatch(/## Profiles\nOpen: .*Closed: /);
    expect(list).toMatch(/# Its conversations, oldest first\n\n1\. "Checkout start": bash, closed, from 2026-10-01 09:00 to 2026-10-01 10:00\.\n {3}First request: "Start the checkout feature"\n {3}How its last turn ended: as usual\.\n2\. "bash": bash, open in its tab, from [^\n]+\n {3}First request: "Old request before the summary"\n {3}Last request: "Finish the pay step"\n {3}How its last turn ended: the human's last message got no answer\./);
    const first = (await call('task_history', { conversation: 2 })).text;
    const total = Number(first.match(/^Part 1 of (\d+)\. Then task_history with conversation 2 and part 2\./)[1]);
    expect(total, 'a 200 KB error, kept whole, takes several parts').toBeGreaterThan(2);
    const whole = [first, ...await Promise.all(Array.from({ length: total - 1 }, async (_, i) => (await call('task_history', { conversation: 2, part: i + 2 })).text))].join('\n');
    const at = (s: string) => { const i = whole.indexOf(s); expect(i, `has ${s}`).toBeGreaterThanOrEqual(0); return i; };
    // The order: its last chapter (its summary on), then its first.
    expect(at('Summary: checkout half done') < at('Finish the pay step') && at('Finish the pay step') < at('Old request before the summary')).toBe(true);
    expect(whole).toMatch(/# Conversation 2, "bash", bash, from [^,]+, chapter 2 of 2/);
    expect(whole.includes('Start the checkout feature'), 'that conversation alone').toBe(false);
    expect(whole.split('').filter((ch) => ch === 'x').length, 'the error whole, across parts').toBeGreaterThanOrEqual(200_000);
    expect((await call('task_history', { conversation: 2, part: total })).text).toMatch(new RegExp(`^Part ${total} of ${total}\\. The last one\\.`));
    await expect(call('task_history', { conversation: 2, part: total + 1 })).rejects.toThrow(new RegExp(`There are ${total} parts`));
    await expect(call('task_history', { conversation: 3 })).rejects.toThrow(/There are 2 conversations/);
  } finally {
    await core((k, was) => {
      const task = k.shell.task, open = task.promptTarget();
      task.store.saveAgent(was);
      open.conversation = was.conversations.findIndex((c) => c.terminal === open.id);
    }, saved);
  }
});

test('@playwright/mcp works through the CDP proxy', async ({ core, call, files }) => {
  await profiles(core);
  await signIn(call, 'Sam.seller', 'sam');
  const endpoint = await core((k) => k.profile('Sam.seller').endpoint);
  const cli = path.join(path.dirname(fileURLToPath(import.meta.resolve('@playwright/mcp/package.json'))), 'cli.js');
  const c = new Client({ name: 'kulisa-test', version: '0' });
  await c.connect(new StdioClientTransport({ command: 'node', args: [cli, '--cdp-endpoint', endpoint, '--output-dir', path.join(files.root, 'pw-mcp')], stderr: 'ignore' }));
  try {
    const nav = await c.callTool({ name: 'browser_navigate', arguments: { url: `${SITE}/app` } });
    expect(nav.isError, JSON.stringify(nav.content)).toBeFalsy();
    const snap = await c.callTool({ name: 'browser_snapshot', arguments: {} });
    expect((snap.content as { text: string }[])[0].text).toMatch(/Signed in as/);
    const click = await c.callTool({ name: 'browser_click', arguments: { element: 'Checkout', target: "getByRole('button', { name: 'Checkout' })" } });
    expect(click.isError, JSON.stringify(click.content)).toBeFalsy();
  } finally { await c.close(); }
});
