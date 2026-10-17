// Profiles and the agent: the editor, the MCP server and the plugin, tabs, isolation, the Chrome identity, the
// sign-in pause, the agent's cursor, point and tell, @playwright/mcp.
import { app } from 'electron';
import { spawnSync, spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import WebSocket from 'ws';
import { focusWindow, shot, assert, root, project, pfile, panel, SITE, sleep, waitFor, who, menuRows, choose, manageProfiles, closeSettings, chooseProfile, setProfileField, closeMenu, taskMenu, box, pageBox, click, PORT } from './helpers.ts';
import { AGENT_PACKAGES } from '../src/main/app.ts';
const CLAUDE_PLUGIN = path.join(AGENT_PACKAGES, 'claude-plugin');
import { MARK } from '../src/main/ghost.ts';
import { hookCommand } from '../src/main/agents/agent.ts';
import { highlights } from '../src/main/mcp-server.ts';
import type { Test } from './run.ts';
import type { StoredProfile } from '../src/main/profile-store.ts';

// What the agent's ghost shows of an action (ghost.ts).
type Action = { caption: string; x?: number; y?: number };

export default (test: Test) => {
  test('profiles are made in Settings (Profiles\' + in its tree), each with its own picture and, if the human says, who it is; added to the project on its page, opened in its task; the pages stay on screen under Settings\' window', async (ctx) => {
    const { shell, ui, sui } = ctx;
    await manageProfiles(ctx);
    assert.equal(await sui(`document.querySelector('#prconfig .empty').textContent`), 'No profiles yet.');
    // + beside Profiles: its name typed in place under the tree, Enter; then it is chosen, its page shown (the picture:
    // the next free one, unless the human picks another).
    const make = async (name: string) => {
      await sui(`document.getElementById('profilenew').click()`);
      await waitFor(() => sui(`document.activeElement?.id === 'profilenewname'`));
      await setProfileField(sui, 'profilenewname', name);
      await sui(`document.getElementById('profilenewname').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`);
      await waitFor(() => sui(`document.getElementById('profilename')?.value === ${JSON.stringify(name)} && !document.getElementById('profilenewname')
        && document.querySelector('#pjlist [aria-selected="true"] .label')?.textContent === ${JSON.stringify(name)}`));
    };
    await make('Sam.seller');
    await setProfileField(sui, 'profileabout', ' seller in the test shop ');
    await waitFor(() => shell.profileStore.get('sam-seller')?.description === 'seller in the test shop');
    await make('Elon.buyer');
    assert.equal(shell.profileStore.get('elon-buyer').avatar, 'frog', 'the next picture free');
    // Its picture's button looks as a field to choose from (.select): the chosen one, a chevron, the fields' background.
    assert.deepEqual(await sui(`(() => { const b = getComputedStyle(document.getElementById('profilepic')), f = document.body.appendChild(document.createElement('i'));
      f.style.background = 'var(--field)'; const field = getComputedStyle(f).backgroundColor; f.remove(); return [b.display, b.backgroundColor === field]; })()`), ['flex', true]);
    await sui(`document.getElementById('profilepic').click()`);
    await waitFor(() => sui(`!!document.querySelector('.profilepics.ready')`));
    assert.equal(await sui(`document.querySelectorAll('.profilepics [data-avatar]').length`), 16, 'all of them to choose from, at once');
    await sui(`document.querySelector('.profilepics [data-avatar="penguin"]').click()`);
    await waitFor(() => shell.profileStore.get('elon-buyer').avatar === 'penguin');
    // Who they are: in the store of profiles (profile-store.ts), the same in every task; in no project yet.
    assert.deepEqual(shell.profileStore.all().map(({ id, avatar, description, projects, color }: StoredProfile & { color?: string }) => ({ id, avatar, description, projects, color })),
      [{ id: 'sam-seller', avatar: 'fox', description: 'seller in the test shop', projects: [], color: undefined },
        { id: 'elon-buyer', avatar: 'penguin', description: undefined, projects: [], color: undefined }], 'pictures, not colors; who it is when said');
    assert.equal(await sui(`document.querySelector('#profilepage .projects').textContent`), "none: add it on a project's page");
    // Added on the project's page (+ → its other profiles), closed in its task; opened there (👥).
    await waitFor(() => sui(`!!document.querySelector('#pjlist [data-project="${shell.current.id}"]')`)); // the projects come as it opens
    await click(sui, `document.querySelector('#pjlist [data-project="${shell.current.id}"]')`);
    for (const name of ['Sam.seller', 'Elon.buyer']) {
      // The profiles to add are asked for again as the page is shown: the menu may open before they come.
      await waitFor(async () => {
        await sui(`document.getElementById('npprofileadd').click()`);
        if ((await menuRows(sui)).includes(name)) return true;
        await closeMenu(sui);
        return false;
      });
      await choose(sui, name);
      await waitFor(async () => (await sui(`[...document.querySelectorAll('#npprofiles .label')].map((l) => l.textContent)`)).includes(name));
      // A row cuts its name and description: the whole in its tooltip.
      assert.equal((await sui(`[...document.querySelectorAll('#npprofiles .item')].find((r) => r.querySelector('.label').textContent === ${JSON.stringify(name)}).title`)).split('\n')[0], name);
    }
    await waitFor(() => shell.closed.has('sam-seller') && shell.closed.has('elon-buyer'));
    await ui(`act('profile:open', { profile: 'sam-seller' })`);
    await ui(`act('profile:open', { profile: 'elon-buyer' })`);
    assert.deepEqual([...shell.profiles.keys()], ['sam-seller', 'elon-buyer']);
    await waitFor(() => shell.profiles.get('elon-buyer').get()); // its first tab comes after it is opened
    // Settings is a window of its own: the task's pages stay on screen and live (a dialog had hidden them).
    await waitFor(() => shell.profiles.get('elon-buyer').get().view.getVisible());
    await closeSettings(ctx);
    assert.equal(await ui(`document.querySelectorAll('.pane').length`), 2);
    // The first page over the terminal alone took half the grid (dockview's split); the terminal keeps its share.
    const share = await ui(`__dock.getPanel('terminal').group.api.height / __dock.height`);
    assert.ok(Math.abs(share - 0.35) < 0.03, `the terminal's share: ${share}`);
  });

  test('web pages cannot reach the MCP server, its hooks or the CDP proxy (Host and Origin checks)', async ({ shell }) => {
    const status = (url: string, headers: Record<string, string>, method = 'GET', body = '{}') => new Promise((resolve) => {
      const r = http.request(url, { method, headers }, (res) => { res.resume(); resolve(res.statusCode); });
      r.on('error', () => resolve('error')); r.end(method === 'POST' ? body : undefined);
    });
    const url = shell.task.env().KULISA_MCP_URL;
    const mcp = new URL(url), proxy = new URL(shell.profiles.get('sam-seller').endpoint);
    const json = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
    // DNS rebinding: a page on evil.example resolving to 127.0.0.1 sends its own Host.
    assert.equal(await status(url, { ...json, host: `evil.example:${mcp.port}` }, 'POST'), 403);
    assert.equal(await status(`${shell.task.env().KULISA_URL}/hooks/session-start`, { host: `evil.example:${mcp.port}` }), 403);
    assert.equal(await status(`${proxy.href}/json/version`, { host: `evil.example:${proxy.port}` }), 403);
    // A page's own requests carry Origin.
    assert.equal(await status(url, { ...json, origin: 'https://evil.example' }, 'POST'), 403);
    const task = (origin?: string) => new Promise((resolve) => {
      const s = new WebSocket(`ws://127.0.0.1:${proxy.port}/project/1/sam-seller`, origin ? { origin } : {});
      s.on('open', () => { s.close(); resolve('open'); }); s.on('error', () => resolve('refused'));
    });
    assert.equal(await task('https://evil.example'), 'refused');
    assert.equal(await task(), 'open'); // Playwright and other local tools send no Origin
    assert.equal(await status(`${shell.task.env().KULISA_URL}/hooks/session-start`, {}), 200);
    assert.equal(await status(`${shell.mcp.base}/task/project/9/hooks/session-start`, {}), 404, 'no such task');
    // The MCP SDK's transport reads the body: a malformed one is refused, and one over its limit (4 MB) is not kept.
    assert.equal(await status(url, json, 'POST', '{not json'), 400);
    assert.equal(await status(url, json, 'POST', 'x'.repeat(5 << 20)), 413);
  });
  test('agent bridge: the Claude Code plugin is valid and points at this MCP server', async ({ shell }) => {
    assert.ok(fs.existsSync(path.join(CLAUDE_PLUGIN, '.claude-plugin', 'plugin.json')));
    assert.ok(fs.existsSync(path.join(AGENT_PACKAGES, 'skills', 'profiles', 'SKILL.md')), "the profiles skill, every agent's");
    const mcp = JSON.parse(fs.readFileSync(path.join(CLAUDE_PLUGIN, '.mcp.json'), 'utf8'));
    assert.equal(mcp.mcpServers.kulisa.url, '${KULISA_MCP_URL}');
    assert.equal(shell.task.env().KULISA_MCP_URL, `${shell.mcp.base}/task/project/1/mcp`);
    // With Claude Code installed, check the plugin the way it loads it.
    const v = spawnSync('claude', ['plugin', 'validate', CLAUDE_PLUGIN], { encoding: 'utf8' });
    if (!v.error) assert.equal(v.status, 0, v.stdout + v.stderr);
  });
  test('agent: open, switch and close tabs', async ({ shell, call }) => {
    const elon = shell.profiles.get('elon-buyer');
    const first = elon.active;
    const r = await call('browser_tab_new', { profile: 'elon-buyer', url: `${SITE}/app` });
    const id = r.text.match(/Opened tab (\w+)/)[1];
    assert.equal(elon.active, id);
    assert.equal(elon.tabs.length, 2);
    assert.match((await call('browser_snapshot', { profile: 'elon-buyer' })).text, /Signed/);
    await call('browser_tab_select', { profile: 'elon-buyer', tab: first });
    assert.equal(elon.active, first);
    await call('browser_tab_close', { profile: 'elon-buyer', tab: id });
    await waitFor(() => elon.tabs.length === 1);
  });
  test('the keyboard stays where the human put it: a tab the agent opens, its page loading, does not take it', async ({ shell, ui, call }) => {
    // The human typing to the agent in the terminal: on macOS each tab the agent opened took the keyboard as its page
    // loaded, and the next keys went to the site (2026-10-16; page-focus.ts).
    const elon = shell.profiles.get('elon-buyer');
    await focusWindow(shell.win, ui);
    await ui(`window.__term.focus()`);
    await waitFor(() => shell.windows[0].keyZone === 'terminal');
    const id = (await call('browser_tab_new', { profile: 'elon-buyer', url: 'data:text/html,<input autofocus>' })).text.match(/Opened tab (\w+)/)[1];
    await elon.get(id).ready;
    await sleep(500); // nothing to wait for: that the keyboard is not taken (page-focus.ts gives it back after 150 ms)
    assert.deepEqual([await ui(`document.hasFocus()`), await ui(`!!document.activeElement.closest('.term')`)], [true, true], 'still in the terminal');
    await call('browser_tab_close', { profile: 'elon-buyer', tab: id });
    await waitFor(() => elon.tabs.length === 1);
  });
  test('the window and the agent act on one core: an address read the same way, the same refusals', async ({ shell, call, ui }) => {
    const sam = shell.profiles.get('sam-seller');
    const host = SITE.replace('http://', ''); // 127.0.0.1:<port>, a host and a port (not a scheme)
    await ui(`act('tab:navigate', { profile: 'sam-seller', tab: '${sam.active}', url: '${host}/app?by=human' })`);
    await waitFor(() => sam.get().wc.getURL() === `${SITE}/app?by=human`);
    await call('browser_navigate', { profile: 'sam-seller', url: `${host}/app?by=agent` });
    assert.equal(sam.get().wc.getURL(), `${SITE}/app?by=agent`);
    const id = (await call('browser_tab_new', { profile: 'sam-seller', url: `${host}/app?tab` })).text.match(/Opened tab (\w+)/)[1];
    assert.equal(sam.get(id).wc.getURL(), `${SITE}/app?tab`);
    await ui(`act('tab:close', { profile: 'sam-seller', tab: '${id}' })`);
    await waitFor(() => !sam.get(id));

    assert.match((await ui(`act('tab:reload', { profile: 'nobody' })`)).error, /No profile "nobody"/);
    await assert.rejects(call('browser_snapshot', { profile: 'nobody' }), /No profile "nobody"/);
    assert.match((await ui(`act('tab:close', { profile: 'sam-seller', tab: 'k999' })`)).error, /No tab k999 in sam-seller/);
    await assert.rejects(call('browser_tab_close', { profile: 'sam-seller', tab: 'k999' }), /No tab k999 in sam-seller/);
    // An action of the window names its task: one sent for a task no longer shown (the human just switched)
    // is refused, not done in the one shown now.
    const tabs = sam.tabs.length;
    assert.match((await ui(`kulisa.invoke('tab:new', { task: 'project/2', profile: 'sam-seller' })`)).error, /not on screen/);
    assert.match((await ui(`kulisa.invoke('tab:new', { profile: 'sam-seller' })`)).error, /not on screen/);
    assert.equal(sam.tabs.length, tabs);
  });
  test('agent bridge: at session start the plugin hook tells the agent which profiles are open, and Kulisa notes the session', async ({ shell, instructions }) => {
    const command = hookCommand('session-start'); // what every agent's SessionStart hook runs (agents/agent.ts)
    // Run it the way Claude Code does (bash), in the background: Kulisa answers it from this process.
    // Claude Code passes the hook its input as JSON on stdin.
    const transcript = path.join(project, 'transcript.jsonl');
    fs.writeFileSync(transcript, '');
    const input = JSON.stringify({ hook_event_name: 'SessionStart', session_id: 'session-1', transcript_path: transcript, source: 'startup' });
    const run = (env: Record<string, string>) => new Promise<{ code: number; out: string }>((resolve) => {
      const c = spawn('bash', ['-c', command], { env: { ...process.env, KULISA_URL: '', ...env } });
      let out = ''; c.stdout.on('data', (d) => (out += d)); c.on('close', (code) => resolve({ code, out }));
      c.stdin.end(input);
    });
    const agent = shell.task.promptTarget();
    const inKulisa = await run(shell.task.env(agent)); // the agent's terminal's own: its conversation's
    assert.deepEqual(JSON.parse(fs.readFileSync(pfile('agent.json'), 'utf8')).conversations.map(({ from, ...c }: { from: number }) => c),
      [{ agent: 'custom', started: true, terminal: agent.id, sessionId: 'session-1', transcript }]);
    assert.equal(inKulisa.code, 0);
    const context = JSON.parse(inKulisa.out).hookSpecificOutput.additionalContext;
    assert.match(context, /- sam-seller \("Sam.seller"\): seller in the test shop/);
    assert.match(context, /- elon-buyer \("Elon.buyer"\): who it is is not said/);
    assert.match(context, /tab k\d+ \(active\)/);
    // Another browser's tools may sit next to Kulisa's with the same names (cast's browser_click, Playwright MCP's):
    // every agent is told which browser is the human's, Claude Code again next to the profiles.
    const only = /Kulisa profiles are the only browser here.*Do not use another browser's tools/s;
    assert.match(context, only);
    assert.match(await instructions(), only);
    const outside = await run({});
    assert.deepEqual(outside, { code: 0, out: '' }, 'without its URL the hook does nothing and fails nothing');
  });
  test('agent: highlight elements for the human (also on Trusted Types pages), then clear', async ({ shell, call }) => {
    const sam = shell.profiles.get('sam-seller');
    // Pixels of the agent's marks' color in the tab's own rendering: the outline and label are really drawn.
    const colored = async () => {
      const img = await sam.get().wc.capturePage(); const px = img.toBitmap(); // BGRA
      const [r, g, b] = MARK.match(/\w\w/g).map((h) => parseInt(h, 16));
      let n = 0; for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i + 2] - r) < 8 && Math.abs(px[i + 1] - g) < 8 && Math.abs(px[i] - b) < 8) n++;
      return n;
    };
    for (const url of [`${SITE}/app`, `${SITE}/strict`]) {
      await call('browser_navigate', { profile: 'sam-seller', url });
      const r = await call('browser_highlight', { profile: 'sam-seller', elements: [
        { locator: "getByRole('button', { name: 'Sign in' })", label: 'Sign in is here' },
        { locator: 'locator("a").first()' }] });
      assert.match(r.text, /Highlighted 2 element/);
      await waitFor(async () => (await colored()) > 300).catch(() => {});
      assert.ok(await colored() > 300, `${url}: outline and label visible (${await colored()} px)`);
      if (url.endsWith('/app')) await shot(shell, path.join(root, 'highlight.png'));
      await call('browser_highlight', { profile: 'sam-seller', elements: [] });
      await waitFor(async () => (await colored()) < 50).catch(() => {});
      assert.ok(await colored() < 50, `${url}: cleared (${await colored()} px)`);
    }
  });
  test('highlights go away when the human clicks or types in the page', async ({ shell, call }) => {
    const sam = shell.profiles.get('sam-seller');
    await call('browser_navigate', { profile: 'sam-seller', url: `${SITE}/app` });
    for (const input of [[{ type: 'mouseDown', x: 300, y: 300, button: 'left', clickCount: 1 }, { type: 'mouseUp', x: 300, y: 300, button: 'left', clickCount: 1 }],
      [{ type: 'keyDown', keyCode: 'Shift' }, { type: 'keyUp', keyCode: 'Shift' }]] as (Electron.MouseInputEvent | Electron.KeyboardInputEvent)[][]) {
      await call('browser_highlight', { profile: 'sam-seller', elements: [{ locator: "getByRole('button', { name: 'Sign in' })", label: 'here' }] });
      assert.equal(highlights.has('project/1/sam-seller'), true);
      const wc = sam.get().wc; wc.focus();
      for (const e of input) wc.sendInputEvent(e);
      await waitFor(() => !highlights.has('project/1/sam-seller'));
    }
  });
  // 1 s each: how long a tool looks for an element before it says there is none (by design).
  test('agent: an element that is not there fails fast, with what to do instead', async ({ call }) => {
    await call('browser_navigate', { profile: 'sam-seller', url: `${SITE}/app` });
    for (const [tool, args] of [['browser_highlight', { elements: [{ locator: "getByRole('button', { name: 'New chat' })" }] }],
      ['browser_click', { locator: "getByRole('button', { name: 'New chat' })" }], ['browser_type', { locator: "getByRole('textbox', { name: 'Nope' })", text: 'x' }]] as [string, object][]) {
      const t0 = Date.now();
      await assert.rejects(call(tool, { profile: 'sam-seller', ...args }), /No element matches .* browser_snapshot/);
      assert.ok(Date.now() - t0 < 2500, `${tool} took ${Date.now() - t0} ms`);
    }
  });
  test('agent: create a profile with profile_create; removed from the project, it stays in Settings → Profiles until deleted there', async (ctx) => {
    const { shell, call, ui } = ctx;
    const r = await call('profile_create', { name: 'Ann.admin', description: 'the shop\'s admin' });
    assert.match(r.text, /Created profile ann-admin/);
    assert.ok(shell.profiles.has('ann-admin'));
    const list: { id: string; avatar: string; description: string | null }[] = JSON.parse((await call('browser_profiles', {})).text);
    assert.deepEqual(list.map((p) => p.id), ['sam-seller', 'elon-buyer', 'ann-admin']);
    assert.deepEqual(list.map((p) => [p.avatar, p.description]), [['fox', 'seller in the test shop'], ['penguin', null], ['frog', 'the shop\'s admin']]);
    await waitFor(async () => (await ui(`document.querySelectorAll('.pane').length`)) === 3);
    ctx.answer = true;
    await ui(`act('profile:delete', { profile: 'ann-admin' })`); // Remove from Project… in its pane's menu
    assert.match(ctx.asked.pop().message, /^Remove the profile Ann\.admin from /);
    await waitFor(() => !shell.profiles.has('ann-admin'));
    assert.deepEqual(shell.profileStore.get('ann-admin').projects, [], 'kept, in no project');
    await ui(`kulisa.invoke('profiles:delete', { profile: 'ann-admin' })`);
    assert.equal(ctx.asked.pop().message, 'Delete the profile Ann.admin?');
    await waitFor(() => !shell.profileStore.get('ann-admin'));
  });
  test('who a profile is: the agent is told to choose by it and to ask; it saves the human\'s answer, Settings → Profiles shows it', async (ctx) => {
    const { shell, call, ui, sui } = ctx;
    const c = new Client({ name: 'kulisa-test', version: '0' });
    await c.connect(new StreamableHTTPClientTransport(new URL(shell.task.env().KULISA_MCP_URL)));
    assert.match(c.getInstructions(), /by its description .* ask the human once .* profile_describe/s, 'every agent, also without the skill');
    await c.close();
    const elon = shell.profiles.get('elon-buyer');
    assert.match((await call('profile_describe', { profile: 'elon-buyer', description: 'buyer; pays by card' })).text, /Saved/);
    assert.equal(elon.description, 'buyer; pays by card');
    await assert.rejects(call('profile_describe', { profile: 'elon-buyer', description: 'x'.repeat(501) }), /at most 500/);
    // The editor shows it and the human changes it there; the pane's name tells it on hover (under the whole name, which a
    // narrow pane cuts), the task's tab's menu under the name.
    const header = `[...document.querySelectorAll('.ptab')].find((t) => t.querySelector('.pname')?.textContent === 'Elon.buyer')`;
    await waitFor(async () => (await ui(`${header}.querySelector('.pname').title`)).startsWith('Elon.buyer\nbuyer; pays by card'));
    await waitFor(() => ui(`(() => { const i = ${header}.querySelector('.avatar'); return i.complete && i.naturalWidth > 0; })()`)); // the picture is drawn
    await taskMenu(ui);
    assert.deepEqual(await ui(`[...document.querySelectorAll('.menu[data-state="open"] .item')].slice(0, 2).map((b) => [b.querySelector('small').textContent,
      b.querySelector('.avatar').getAttribute('src')])`),
    [['seller in the test shop', 'avatars/fox.svg'], ['buyer; pays by card', 'avatars/penguin.svg']]);
    await closeMenu(ui);
    // Settings → Profiles shows it and the human changes it there.
    await manageProfiles(ctx);
    await chooseProfile(sui, 'elon-buyer');
    await waitFor(async () => (await sui(`document.getElementById('profileabout').value`)) === 'buyer; pays by card');
    assert.deepEqual(await sui(`(() => { const a = document.getElementById('profileabout'); return [a.localName, a.rows, getComputedStyle(a).resize]; })()`),
      ['textarea', 2, 'vertical'], 'two lines, made taller by hand');
    await setProfileField(sui, 'profileabout', '');
    await waitFor(() => elon.description === '');
    // The picture: a panel of them from the button beside it; one chosen, it goes.
    await sui(`document.getElementById('profilepic').click()`);
    await waitFor(() => sui(`!!document.querySelector('.profilepics.ready')`));
    await sui(`document.querySelector('.profilepics [data-avatar="owl"]').click()`);
    await waitFor(() => elon.avatar === 'owl');
    await waitFor(() => sui(`!document.querySelector('.profilepics')`));
    await waitFor(async () => (await sui(`document.querySelector('#profilepic .avatar').getAttribute('src')`)) === 'avatars/owl.svg');
    assert.match((await sui(`kulisa.invoke('profiles:avatar', { profile: 'elon-buyer', avatar: 'dragon' })`)).error, /no picture/);
    await closeSettings(ctx);
  });
  // Each action of the agent waits while it is shown in the page (0.5 s, ghost.ts): the agent's tests take seconds.
  test('agent: navigate, snapshot, type by ref, click by locator, screenshot', async ({ call }) => {
    await call('browser_navigate', { profile: 'sam-seller', url: `${SITE}/app` });
    const snap = await call('browser_snapshot', { profile: 'sam-seller' });
    const ref = snap.text.match(/textbox "Name"[^\n]*\[ref=(\w+)\]/)[1];
    await call('browser_type', { profile: 'sam-seller', ref, text: 'sam', submit: true });
    await call('browser_wait_for', { profile: 'sam-seller', text: 'Signed in as sam' });
    await call('browser_click', { profile: 'sam-seller', locator: "getByRole('button', { name: 'Checkout' })" });
    const shot = await call('browser_screenshot', { profile: 'sam-seller' });
    assert.equal(shot.content[0].type, 'image');
  });

  test('agent: typing goes key by key, as a person types, replacing what the field held; a long text at once', async ({ call }) => {
    const p = { profile: 'sam-seller', locator: "getByLabel('Name')" };
    await call('browser_navigate', { profile: 'sam-seller', url: `${SITE}/app` });
    // Each change of the field: one for each key typed, one for a fill (clearing it first is one too).
    const typed = async (text: string) => {
      await call('browser_evaluate', { ...p, function: "(el) => { el.value = 'old'; window.keys = 0; el.oninput = () => window.keys++; }" });
      const t0 = Date.now();
      await call('browser_type', { ...p, text });
      return { ...JSON.parse((await call('browser_evaluate', { ...p, function: '(el) => ({ value: el.value, keys: window.keys })' })).text), ms: Date.now() - t0 };
    };
    const word = await typed('Анна');
    assert.deepEqual([word.value, word.keys], ['Анна', 1 + 4], 'an input for each letter, any language (not on a US keyboard: as typed text, without key codes)');
    const long = await typed('x'.repeat(400));
    assert.deepEqual([long.value.length, long.keys], [400, 1], 'filled at once');
    const most = await typed('y'.repeat(300));
    assert.equal(most.keys, 1 + 300);
    assert.ok(most.ms < 5000, `300 keys in ${most.ms} ms`);
  });
  test('agent: keys, hover, select, files, waiting, evaluate, back and forward; dialogs answered as asked, the human\'s left in the pane', async ({ shell, ui, call }) => {
    const p = { profile: 'sam-seller' };
    const out = async () => JSON.parse((await call('browser_evaluate', { ...p, function: '() => out.textContent' })).text);
    await call('browser_navigate', { ...p, url: `${SITE}/form` });
    const del = { ...p, locator: "getByRole('button', { name: 'Delete' })" };
    // The agent's action answers its own dialog: none is shown.
    const view = () => shell.profiles.get('sam-seller').get().view.getVisible();
    const paneDialog = `document.querySelector('.pane[data-profile="sam-seller"] .pagedialog')`;
    assert.match((await call('browser_click', del)).text, /asked: confirm "Delete the draft\?"; dismissed/);
    assert.equal(await out(), 'kept');
    assert.match((await call('browser_click', { ...del, dialog: 'accept' })).text, /accepted/);
    assert.equal(await out(), 'deleted');
    assert.equal(await ui(`${paneDialog}?.dataset.state === 'open'`), false);
    // A dialog the agent did not open is the human's, in its pane over a picture of the page (not Electron's message
    // box in the middle of the window, which said nothing of where it came from); the human answers there.
    const ask = async (js: string) => {
      await call('browser_evaluate', { ...p, function: `() => { setTimeout(() => out.textContent = String(${js})); }` });
      await waitFor(() => ui(`${paneDialog}?.dataset.state === 'open'`));
    };
    await ask("confirm('Yours?\\nReally.')");
    assert.deepEqual(await ui(`[${paneDialog}.querySelector('h2').textContent, ${paneDialog}.querySelector('.message').textContent, !${paneDialog}.querySelector('.cancel')]`),
      [`127.0.0.1:${PORT} says`, 'Yours?\nReally.', false]);
    assert.equal(view(), false, 'the page drawn as a picture under its dialog');
    // The page does nothing until it is answered: the agent's tools say so at once rather than wait.
    await assert.rejects(call('browser_snapshot', p), /shows a confirm \("Yours\?\nReally\."\) for the human to answer/);
    assert.match(await ui(`document.querySelector('.pane[data-profile="sam-seller"] .content').style.getPropertyValue('--picture')`), /^url\("data:image\/jpeg/);
    // Gone from the pane, and the answer in the main process (it goes there after the pane has closed it).
    const closed = () => waitFor(async () => !(await ui(`${paneDialog}?.dataset.state === 'open'`)) && !shell.profiles.get('sam-seller').get().dialog);
    await ui(`${paneDialog}.querySelector('.primary').click()`);
    await closed();
    assert.equal(await out(), 'true');
    assert.equal(view(), true);
    await ask("confirm('No?')");
    await ui(`${paneDialog}.querySelector('.cancel').click()`);
    await closed();
    assert.equal(await out(), 'false');
    // An alert has OK only. Reloading while a dialog is open dismisses it, as in Chrome (Chromium holds the
    // navigation until then).
    await ask("alert('Saved')");
    assert.equal(await ui(`!${paneDialog}.querySelector('.cancel')`), true);
    await ui(`document.querySelector('.pane[data-profile="sam-seller"] .reload').click()`);
    await closed();
    await waitFor(async () => (await out()) === 'nothing yet');
    assert.equal(view(), true);
    // Answered over CDP by another client (an agent's own script): the pane's dialog goes too.
    await ask("confirm('Script?')");
    await shell.profiles.get('sam-seller').get().wc.debugger.sendCommand('Page.handleJavaScriptDialog', { accept: true });
    await closed();
    assert.equal(await out(), 'true');
    await call('browser_select_option', { ...p, locator: "getByLabel('Size')", values: ['L'] });
    assert.equal(await out(), 'size L');
    assert.equal(JSON.parse((await call('browser_evaluate', { ...p, locator: "getByLabel('Size')", function: '(el) => el.value' })).text), 'L');
    await call('browser_file_upload', { ...p, locator: "getByLabel('Attachment')", paths: [path.join(import.meta.dirname, '..', 'package.json')] });
    assert.equal(await out(), 'file package.json');
    await call('browser_hover', { ...p, locator: "getByText('Help')" });
    await call('browser_wait_for', { ...p, text: 'Hint shown', seconds: 2 });
    await call('browser_press_key', { ...p, key: 'Escape' });
    assert.equal(await out(), 'Escape pressed');
    await call('browser_click', { ...p, locator: "getByRole('button', { name: 'Later' })" });
    await assert.rejects(call('browser_wait_for', { ...p, text: 'done later', seconds: 0.3 }), /After 0.3 s, "done later" is not there/);
    await call('browser_wait_for', { ...p, text: 'done later', seconds: 5 });
    await call('browser_wait_for', { ...p, textGone: 'Escape pressed', seconds: 1 });
    assert.match((await call('browser_navigate', { ...p, go: 'back' })).text, /Went back: .*\/app/);
    assert.match((await call('browser_navigate', { ...p, go: 'forward' })).text, /Went forward: .*\/form/);
    assert.match((await call('browser_navigate', { ...p, go: 'forward' })).text, /Nowhere to go forward/);
    assert.match((await call('browser_navigate', { ...p, go: 'reload' })).text, /Went reload: .*\/form/);
    await call('browser_navigate', { ...p, go: 'back' });
  });
  test('agent: one profile acts, another waits to see it; several profiles read in one call', async ({ call }) => {
    const tab = (await call('browser_tab_new', { profile: 'elon-buyer', url: `${SITE}/board` })).text.match(/Opened tab (\w+)/)[1];
    const mine = (await call('browser_tab_new', { profile: 'sam-seller', url: `${SITE}/board` })).text.match(/Opened tab (\w+)/)[1];
    await call('browser_type', { profile: 'sam-seller', locator: "getByLabel('Message')", text: 'hello elon', submit: true });
    await call('browser_wait_for', { profile: 'elon-buyer', text: 'hello elon', seconds: 5 });
    // The poster's page too: reloaded by the post, it shows the board at its next poll (the snapshot came before).
    await call('browser_wait_for', { profile: 'sam-seller', text: 'hello elon', seconds: 5 });
    const both = (await call('browser_snapshot', { profile: 'sam-seller', also: ['elon-buyer', 'nobody'] })).text;
    assert.match(both, /Profile: sam-seller[\s\S]*hello elon[\s\S]*Profile: elon-buyer[\s\S]*hello elon[\s\S]*Profile: nobody\n- No profile "nobody"/);
    await call('browser_tab_close', { profile: 'sam-seller', tab: mine });
    await call('browser_tab_close', { profile: 'elon-buyer', tab });
  });
  test('agent: rename a profile; ask the human to sign one in and wait until they are through', async ({ shell, call, ui }) => {
    const name = shell.profiles.get('elon-buyer').name;
    assert.match((await call('profile_rename', { profile: 'elon-buyer', name: 'elon.payer' })).text, /id is now elon-payer/);
    assert.ok(shell.profiles.has('elon-payer'));
    await call('profile_rename', { profile: 'elon-payer', name });
    const elon = shell.profiles.get('elon-buyer');
    const back = elon.get().wc.getURL();
    const asking = call('profile_ask_signin', { profile: 'elon-buyer', url: `${SITE}/form`, why: 'as Elon' });
    const cap = `document.querySelector('.ptab[data-panel="${panel(shell, 'elon-buyer')}"] .caption').textContent`;
    await waitFor(async () => (await ui(cap)).includes('sign in, please: as Elon'));
    assert.match(elon.get().wc.getURL(), /\/form$/, 'the sign-in page opened');
    void elon.get().wc.loadURL(back); // the human signs in and lands elsewhere
    assert.match((await asking).text, /The human is through/);
    await waitFor(async () => (await ui(cap)) === '');
  });

  test('a page that does not load says why, as Chrome\'s error page (Electron leaves it blank); the agent reads it too', async ({ shell, call, ui }) => {
    const sam = shell.profiles.get('sam-seller'), wc = sam.get().wc, back = wc.getURL();
    await ui(`act('tab:navigate', { profile: 'sam-seller', tab: '${sam.active}', url: 'http://127.0.0.1:4419/' })`); // nothing listens there
    await waitFor(async () => /refused to connect/.test(await wc.executeJavaScript('document.body?.innerText || ""')));
    assert.equal(wc.getURL(), 'http://127.0.0.1:4419/', 'the address stays the one that failed');
    assert.match((await call('browser_snapshot', { profile: 'sam-seller' })).text, /This site can’t be reached[\s\S]*ERR_CONNECTION_REFUSED/);
    await wc.loadURL(back);
  });
  test('tab strip: + opens a tab with the focus in its empty address, a click on a tab makes it active, × closes it', async ({ shell, ui }) => {
    const elon = shell.profiles.get('elon-buyer');
    const strip = `document.querySelector('.pane[data-profile="elon-buyer"] .tabs')`;
    const first = elon.active, n = elon.tabs.length;
    await ui(`window.__firstTab = ${strip}.querySelector('.tab[data-tab="${first}"]')`);
    await ui(`${strip}.querySelector('.add').click()`);
    await waitFor(() => elon.tabs.length === n + 1 && elon.active !== first);
    // The strip keeps its tabs' elements; the new one grows in (.opening, until its animation ends), as Chrome's.
    await waitFor(() => ui(`!!${strip}.querySelector('.tab[data-tab="${elon.active}"]')`));
    assert.equal(await ui(`${strip}.querySelector('.tab[data-tab="${first}"]') === window.__firstTab`), true, 'the first tab\'s element stays');
    await waitFor(() => ui(`!${strip}.querySelector('.tab.opening')`));
    await waitFor(() => ui(`(() => { const a = document.querySelector('.pane[data-profile="elon-buyer"] .addr'); return document.activeElement === a && a.value === ''; })()`));
    // The keys go there, not to the new tab's page (a native view that would take the focus as it loads). Where the
    // keys go inside the window; when another app on the desktop is active (it took the focus while the tests ran:
    // seen 2 times in 15), no view has them, and Kulisa rightly leaves it so.
    const page = elon.get(elon.active).wc;
    const keys = () => (!shell.win.isFocused() ? 'another app' : shell.win.webContents.isFocused() ? 'window' : page.isFocused() ? 'page' : 'none');
    await elon.get(elon.active).ready; await sleep(500); // nothing to wait for: that the page does not take them
    assert.ok(['window', 'another app'].includes(keys()), `the window has the focus, not the page: ${keys()}`);
    // A click into the page gives it the keys, and they stay there.
    page.sendInputEvent({ type: 'mouseDown', x: 20, y: 20, button: 'left', clickCount: 1 }); page.sendInputEvent({ type: 'mouseUp', x: 20, y: 20, button: 'left', clickCount: 1 });
    page.focus();
    await sleep(300); // nothing to wait for: that they stay
    assert.ok(['page', 'another app'].includes(keys()), `the page keeps the focus once clicked: ${keys()}`);
    await ui(`document.activeElement.blur()`);
    await waitFor(async () => (await ui(`${strip}.querySelectorAll('.tab').length`)) === n + 1);
    await click(ui, `${strip}.querySelector('.tab[data-tab="${first}"] .title')`);
    await waitFor(() => elon.active === first);
    await ui(`${strip}.querySelector('.tab:last-of-type .x').click()`);
    await waitFor(() => elon.tabs.length === n);
    // With reduced motion (the OS's setting, emulated) it does not grow, and is not left growing: no animation ends
    // there, and the tab stayed .opening (GitHub's macOS runner, 2026-10-16).
    const dbg = shell.win.webContents.debugger;
    dbg.attach();
    try {
      await dbg.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
      await ui(`${strip}.querySelector('.add').click()`);
      await waitFor(() => elon.tabs.length === n + 1);
      await waitFor(() => ui(`!!${strip}.querySelector('.tab[data-tab="${elon.active}"]')`));
      await sleep(300); // nothing to wait for: that it is not left growing
      assert.equal(await ui(`!!${strip}.querySelector('.tab.opening')`), false);
      elon.closeTab(elon.active);
      await waitFor(() => elon.tabs.length === n);
    } finally { dbg.detach(); }
  });
  test('many tabs: they shrink as in Chrome; the strip, the toolbar and the page stay inside the pane', async ({ shell, ui }) => {
    const elon = shell.profiles.get('elon-buyer'), n = elon.tabs.length;
    const pane = '.pane[data-profile="elon-buyer"]';
    const before = await pageBox(ui, 'elon-buyer');
    // A lone tab has its full width (220px, as Chrome's), not shrunk while there is room.
    assert.equal(await ui(`Math.round(document.querySelector('.pane[data-profile="sam-seller"] .tabs .tab').getBoundingClientRect().width)`), 220);
    for (let i = 0; i < 24; i++) await ui(`act('tab:new', { profile: 'elon-buyer' })`);
    await waitFor(async () => (await ui(`document.querySelectorAll('${pane} .tabs .tab').length`)) === n + 24);
    await waitFor(() => ui(`!document.querySelector('${pane} .tabs .tab.opening')`)); // grown in
    const fit = await ui(`(() => { const p = document.querySelector('${pane}'), r = (q) => p.querySelector(q).getBoundingClientRect(), pr = p.getBoundingClientRect();
      return { pane: p.scrollWidth <= p.clientWidth, tabs: r('.tabs').right <= pr.right, add: r('.tabs .add').right <= pr.right, more: r('.more').right <= pr.right,
        group: p.closest('.dv-groupview').scrollWidth <= p.closest('.dv-groupview').clientWidth }; })()`);
    assert.deepEqual(fit, { pane: true, tabs: true, add: true, more: true, group: true });
    // The active one (the last opened) in sight; every one its icon and × (not the active one alone, as Chrome's: the
    // author, 2026-10-15).
    const strip = await ui(`(() => { const s = document.querySelector('${pane} .tabs'), r = s.getBoundingClientRect(), a = s.querySelector('.tab.active').getBoundingClientRect();
      const other = s.querySelector('.tab:not(.active)'), shown = (e) => getComputedStyle(e).display !== 'none';
      return { activeInSight: a.left >= r.left && a.right <= s.querySelector('.add').getBoundingClientRect().left,
        nothingUnderAdd: s.querySelector('.strip').getBoundingClientRect().right <= s.querySelector('.add').getBoundingClientRect().left,
        activeX: shown(s.querySelector('.tab.active .x')), otherIcon: shown(other.querySelector('.globe')) || shown(other.querySelector('img')), otherTitle: shown(other.querySelector('.title')),
        otherX: shown(other.querySelector('.x')) }; })()`);
    // + and a tab's × are the same icon size.
    assert.deepEqual(await ui(`['.tab.active .x svg', '.add svg'].map((q) => document.querySelector('${pane} .tabs ' + q).getBoundingClientRect().width)`), [14, 14]);
    assert.deepEqual(strip, { activeInSight: true, nothingUnderAdd: true, activeX: true, otherIcon: true, otherTitle: false, otherX: true });
    assert.deepEqual(await pageBox(ui, 'elon-buyer'), before, 'the page keeps its place and size');
    // Past that the strip scrolls (lib/strip.ts): the edge with tabs past it fades; a mouse's wheel scrolls it; a tab
    // not shown that changes (its page loads, its title) leaves it where the human scrolled it: on every update it went
    // back to the active one, 2026-10-15.
    const s = `document.querySelector('${pane} .strip')`;
    const at = () => ui(`(() => { const e = ${s}; return [Math.round(e.scrollLeft), e.scrollWidth - e.clientWidth, ['past-start', 'past-end'].filter((c) => e.classList.contains(c)).join(' ')]; })()`);
    await waitFor(async () => { const [left, max, faded] = await at(); return max > 0 && left === max && faded === 'past-start'; }); // scrolled to the active one at the end, the start faded
    const b = await ui(`${s}.getBoundingClientRect().toJSON()`), z = shell.win.webContents.getZoomFactor();
    shell.win.webContents.sendInputEvent({ type: 'mouseWheel', x: Math.round((b.x + b.width / 2) * z), y: Math.round((b.y + b.height / 2) * z), deltaX: 0, deltaY: 100000 }); // up: to the start
    await waitFor(async () => (await at())[0] === 0);
    await waitFor(async () => (await at())[2] === 'past-end');
    elon.navigate(elon.tabs[n].id, `${SITE}/app?n=strip`);
    await waitFor(() => ui(`${s}.querySelector('.tab[data-tab="${elon.tabs[n].id}"]').title.includes('n=strip')`));
    await sleep(200); // nothing to wait for: that it stays
    assert.equal((await at())[0], 0, 'stays where the wheel took it');
    for (const t of elon.tabs.slice(n)) elon.closeTab(t.id);
    await waitFor(() => elon.tabs.length === n);
  });
  test('back and forward buttons are enabled only when there is somewhere to go', async ({ call, ui, shell }) => {
    const buttons = () => ui(`[...document.querySelectorAll('.pane')][0].querySelectorAll('.back, .fwd').values().map((b) => b.disabled).toArray()`);
    await call('browser_navigate', { profile: 'sam-seller', url: `${SITE}/app?n=1` });
    await call('browser_navigate', { profile: 'sam-seller', url: `${SITE}/app?n=2` });
    await waitFor(async () => JSON.stringify(await buttons()) === '[false,true]');
    await ui(`[...document.querySelectorAll('.pane')][0].querySelector('.back').click()`);
    await waitFor(async () => JSON.stringify(await buttons()) === '[false,false]');
    // The buttons change as the back navigation starts; the next test reads the address, so wait until it has
    // landed, in the tab and in the pane (on a slow runner the pane showed n=2 while the tab was on n=1).
    await waitFor(async () => shell.profiles.get('sam-seller').get().url.endsWith('n=1')
      && (await ui(`document.querySelector('.pane[data-profile="sam-seller"] .addr').value`)).endsWith('n=1'));
  });
  test('the address as in Chrome: shown without http(s)://, a click shows all of it selected; a second click places the caret', async ({ shell, ui }) => {
    const addr = '.pane[data-profile="sam-seller"] .addr';
    const z = shell.win.webContents.getZoomFactor(), b = await box(ui, addr);
    shell.win.webContents.focus(); // the last test left the focus in a page
    const click = () => {
      const x = Math.round((b.x + b.width / 3) * z), y = Math.round((b.y + b.height / 2) * z);
      for (const type of ['mouseDown', 'mouseUp'] as const) shell.win.webContents.sendInputEvent({ type, x, y, button: 'left', clickCount: 1 });
    };
    const sel = () => ui(`(() => { const a = document.querySelector('${addr}'); return [document.activeElement === a, a.selectionStart, a.selectionEnd, a.value.length]; })()`);
    const value = () => ui(`document.querySelector('${addr}').value`);
    const full = shell.profiles.get('sam-seller').get().wc.getURL();
    assert.ok(full.startsWith('http://'), full);
    assert.equal(await value(), full.replace('http://', ''));
    click();
    await waitFor(async () => { const [focused, start, end, n] = await sel(); return focused && start === 0 && end === n && n > 0; });
    assert.equal(await value(), full);
    await sleep(400); // not a double-click
    click();
    await waitFor(async () => { const [focused, start, end] = await sel(); return focused && start === end; });
    await ui(`document.querySelector('${addr}').blur()`);
    assert.equal(await value(), full.replace('http://', ''));
  });
  test('profiles are isolated', async (ctx) => {
    await ctx.call('browser_navigate', { profile: 'elon-buyer', url: `${SITE}/app` });
    assert.equal(await who(ctx, 'sam-seller'), 'Signed in as sam');
    assert.equal(await who(ctx, 'elon-buyer'), 'Signed out');
  });

  test('target=_blank and window.open open tabs of the same profile', async ({ shell, call }) => {
    const sam = shell.profiles.get('sam-seller');
    const before = sam.tabs.length;
    const waitTabs = async (n: number) => { await waitFor(() => sam.tabs.length >= n).catch(() => {}); assert.equal(sam.tabs.length, n); };
    await call('browser_click', { profile: 'sam-seller', locator: "getByRole('link', { name: 'target=_blank link' })" });
    await waitTabs(before + 1);
    // the new tab is now the active one; it has the same buttons
    await call('browser_click', { profile: 'sam-seller', locator: "getByRole('button', { name: 'window.open()' })" });
    await waitTabs(before + 2);
    const popup = await sam.page(sam.tabs.at(-1).id);
    await popup.waitForLoadState();
    assert.match(await popup.locator('#who').textContent(), /Signed in as sam/);
    assert.equal(await popup.evaluate(() => !!window.opener), true);
    for (const t of sam.tabs.slice(1)) sam.closeTab(t.id);
    await waitFor(() => sam.tabs.length === 1);
  });

  // Not presenting as Google Chrome: Google refused to sign in a browser that did and was not (docs/profiles.md, What
  // sites see), and let Electron's own Chromium in. Without Electron's word: Teams took a Mac's or Windows' Electron
  // for its own retired app and showed "Classic Teams is no longer available" (2026-10-16).
  test('profiles present themselves as what they are, Kulisa on Chromium, in pages and popups alike', async ({ shell }) => {
    const elon = shell.profiles.get('elon-buyer');
    const page = await elon.page();
    await page.goto(`${SITE}/headers`);
    assert.equal(JSON.parse(await page.locator('body').innerText())['user-agent'], app.userAgentFallback);
    assert.match(app.userAgentFallback, / Chrome\/\d/);
    assert.doesNotMatch(app.userAgentFallback, /Electron/);
    assert.equal(await page.evaluate(() => navigator.userAgent), app.userAgentFallback);
    assert.ok(!(await page.evaluate(() => (navigator as unknown as { userAgentData: { brands: { brand: string }[] } }).userAgentData.brands.map((b) => b.brand))).includes('Google Chrome'));
    assert.equal(await page.evaluate(() => navigator.webdriver), false);
    const [popup] = await Promise.all([page.context().waitForEvent('page'), page.evaluate((u) => window.open(u), `${SITE}/headers`)]);
    await popup.waitForLoadState();
    assert.equal(JSON.parse(await popup.locator('body').innerText())['user-agent'], app.userAgentFallback);
    await popup.close();
  });

  test('the agent pauses on sign-in pages and comes back after', async ({ shell, call }) => {
    const elon = shell.profiles.get('elon-buyer');
    const wc = elon.get().wc;
    await wc.loadURL(`http://localhost:${PORT}/app`); // localhost is a sign-in host in this test
    await waitFor(() => elon.signinMode);
    await assert.rejects(call('browser_snapshot', { profile: 'elon-buyer' }), /sign-in mode/);
    assert.equal(await wc.executeJavaScript('navigator.webdriver'), false);
    await wc.loadURL(`${SITE}/app`);
    await waitFor(() => !elon.signinMode);
    assert.equal(await who({ call }, 'elon-buyer'), 'Signed out');
  });

  test('ghost cursor: agent clicks are seen with coordinates', async ({ shell, call }) => {
    const actions: Action[] = [];
    const on = (a: Action) => { actions.push(a); };
    shell.bus.on('agent-action', on);
    await call('browser_click', { profile: 'sam-seller', locator: "getByRole('button', { name: /Checkout|Checked/ })" });
    shell.bus.off('agent-action', on);
    const click = actions.find((a) => a.caption === 'click');
    assert.ok(click && click.x > 0 && click.y > 0, JSON.stringify(actions));
  });

  test('point and tell: a pick puts a reference into the agent\'s prompt, not sent', async ({ shell, ui, ptyOutput }) => {
    const elon = shell.profiles.get('elon-buyer');
    const page = await elon.page();
    await page.goto(`${SITE}/errors`);
    await page.locator('#pay').click();
    await page.getByText('HTTP 500').waitFor(); // its error logged, its request failed: for the next test
    const pending = ui(`kulisa.invoke('pick:start', { profile: 'elon-buyer' })`);
    await waitFor(() => shell.windows[0].picking.has('elon-buyer'));
    const b = await page.locator('#pay').boundingBox();
    const x = Math.round(b.x + b.width / 2), y = Math.round(b.y + b.height / 2);
    const wc = elon.get().wc;
    // Pick mode reaches the page a moment after it starts (Playwright's recorder in the page learns it by a message, or
    // by polling once a second), and says nothing when: a click before goes to the page (Pay now again), so it clicks
    // again, as the human would, until the pick comes (the test once waited 30 s for a click that came too early).
    let pick: { locator: string; tab: string } | undefined;
    void pending.then((r: typeof pick) => { pick = r; });
    for (let i = 0; !pick && i < 20; i++) {
      wc.sendInputEvent({ type: 'mouseMove', x, y });
      wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
      wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
      await Promise.race([pending, sleep(500)]);
    }
    assert.ok(pick, 'picked');
    assert.equal(pick.locator, "getByRole('button', { name: 'Pay now' })");
    assert.equal(pick.tab, elon.active);
    assert.ok(!fs.existsSync(path.join(project, '.kulisa')), 'nothing is written into the project');
    const ref = `[kulisa pick: elon-buyer tab ${pick.tab} getByRole('button', { name: 'Pay now' })]`;
    await waitFor(() => ptyOutput().includes(ref));
    await sleep(300); // nothing to wait for: that it is not sent (cat would print it again)
    // The agent here is `cat`: the terminal echoes typed input, and cat prints it again only after Enter. Once
    // means it waits in the prompt for the human to write about it.
    assert.equal(ptyOutput().split(ref).length - 1, 1, ptyOutput());
    assert.equal(await ui(`document.activeElement.classList.contains('xterm-helper-textarea')`), true, 'the terminal has focus');
    shell.pty.write('\x15'); // Ctrl+U: clear the line for the next tests
  });

  test("agent: the picked tab's console and requests, and tools on a tab other than the active one", async ({ shell, call }) => {
    const elon = shell.profiles.get('elon-buyer');
    const picked = elon.active; // the /errors page, after a click on Pay now
    const other = (await call('browser_tab_new', { profile: 'elon-buyer', url: `${SITE}/app` })).text.match(/Opened tab (\w+)/)[1];
    assert.equal(elon.active, other);
    const errors = (await call('browser_console_messages', { profile: 'elon-buyer', tab: picked, onlyErrors: true })).text;
    assert.match(errors, /error: .*PaymentError/); // Playwright's page.consoleMessages()
    const failed = (await call('browser_network_requests', { profile: 'elon-buyer', tab: picked, onlyFailed: true })).text;
    assert.match(failed, new RegExp(`POST http://127\\.0\\.0\\.1:${PORT}/api/pay → 500`)); // page.requests()
    assert.doesNotMatch(failed, /GET .*\/errors /, 'only failed ones');
    assert.match((await call('browser_snapshot', { profile: 'elon-buyer', tab: picked })).text, /URL: .*\/errors/);
    assert.match((await call('browser_snapshot', { profile: 'elon-buyer' })).text, /URL: .*\/app/, 'default: the active tab');
    await call('browser_highlight', { profile: 'elon-buyer', tab: picked, elements: [{ locator: "getByRole('button', { name: 'Pay now' })" }] });
    await call('browser_highlight', { profile: 'elon-buyer', tab: picked, elements: [] });
    await call('browser_tab_close', { profile: 'elon-buyer', tab: other });
    await waitFor(() => elon.active === picked);
  });

  test('point and tell: Pick again or Esc in the page cancels it; nothing goes to the prompt', async ({ shell, ui, ptyOutput }) => {
    const elon = shell.profiles.get('elon-buyer');
    const button = `document.querySelector('.pane[data-profile="elon-buyer"] .pick')`;
    const before = ptyOutput().length;
    for (const cancel of ['button', 'esc']) {
      await ui(`${button}.click()`);
      await waitFor(async () => (await ui(`${button}.dataset.state === 'on'`)) && shell.windows[0].picking.has('elon-buyer'));
      if (cancel === 'button') await ui(`${button}.click()`);
      else {
        const wc = elon.get().wc;
        wc.focus();
        wc.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); wc.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
      }
      await waitFor(async () => !(await ui(`${button}.dataset.state === 'on'`)) && !shell.windows[0].picking.has('elon-buyer'));
      assert.equal(await ui(`document.querySelector('.ptab[data-panel="profile:Profile 2"] .caption').textContent`), '', cancel);
    }
    await sleep(300); // nothing to wait for: that nothing comes
    assert.equal(ptyOutput().slice(before).includes('kulisa pick'), false);
  });

  test('point and tell: Pick is off on an empty tab (about:blank)', async ({ shell, ui }) => {
    const elon = shell.profiles.get('elon-buyer');
    const disabled = () => ui(`document.querySelector('.pane[data-profile="elon-buyer"] .pick').disabled`);
    assert.equal(await disabled(), false);
    const tab = await ui(`act('tab:new', { profile: 'elon-buyer' })`);
    await waitFor(async () => elon.active === tab && (await disabled()));
    elon.closeTab(tab);
    await waitFor(async () => !(await disabled()));
  });

  // task_history (history.ts): the task's runs read from their transcripts, for an agent taking the task over or one
  // whose context lost the details. The test agent reads transcripts as Claude Code's (run.ts).
  test("agent: task_history gives where the task stands and its conversations, each with its tab, when and what it was about; then one whole, the latest chapter first, in parts", async ({ shell, call }) => {
    const task = shell.task, saved = task.store.agent(), open = task.promptTarget();
    const transcript = (name: string, records: object[]) => {
      const file = path.join(root, 'transcripts', name, 's.jsonl');
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
    try {
      // The closed one first, as it was had; the open one is the agent's tab's.
      task.store.saveAgent({ ...saved, conversations: [
        { agent: 'custom', transcript: earlier, sessionId: 'before', from: Date.UTC(2026, 9, 1, 9), to: Date.UTC(2026, 9, 1, 10), title: 'Checkout start' },
        { ...saved.conversations[open.conversation], transcript: current, sessionId: 'now' }] });
      open.conversation = 1;
      const list = (await call('task_history', {})).text;
      assert.match(list, /^Part 1 of 1\. The last one\.\n\n# Where the task stands \(from Kulisa\)\n\nThe task "[^"]+", in /);
      assert.match(list, /## Profiles\nOpen: .*Closed: /);
      assert.match(list, /# Its conversations, oldest first\n\n1\. "Checkout start": bash, closed, from 2026-10-01 09:00 to 2026-10-01 10:00\.\n {3}First request: "Start the checkout feature"\n {3}How its last turn ended: as usual\.\n2\. "bash": bash, open in its tab, from [^\n]+\n {3}First request: "Old request before the summary"\n {3}Last request: "Finish the pay step"\n {3}How its last turn ended: the human's last message got no answer\./);
      const first = (await call('task_history', { conversation: 2 })).text;
      const total = Number(first.match(/^Part 1 of (\d+)\. Then task_history with conversation 2 and part 2\./)[1]);
      assert.ok(total > 2, 'a 200 KB error, kept whole, takes several parts');
      const whole = [first, ...await Promise.all(Array.from({ length: total - 1 }, async (_, i) => (await call('task_history', { conversation: 2, part: i + 2 })).text))].join('\n');
      const at = (s: string) => { const i = whole.indexOf(s); assert.ok(i >= 0, `has ${s}`); return i; };
      // The order: its last chapter (its summary on), then its first.
      assert.ok(at('Summary: checkout half done') < at('Finish the pay step') && at('Finish the pay step') < at('Old request before the summary'));
      assert.match(whole, /# Conversation 2, "bash", bash, from [^,]+, chapter 2 of 2/);
      assert.ok(!whole.includes('Start the checkout feature'), 'that conversation alone');
      assert.ok(whole.split('').filter((ch) => ch === 'x').length >= 200_000, 'the error whole, across parts');
      assert.match((await call('task_history', { conversation: 2, part: total })).text, new RegExp(`^Part ${total} of ${total}\\. The last one\\.`));
      await assert.rejects(call('task_history', { conversation: 2, part: total + 1 }), new RegExp(`There are ${total} parts`));
      await assert.rejects(call('task_history', { conversation: 3 }), /There are 2 conversations/);
    } finally { task.store.saveAgent(saved); open.conversation = saved.conversations.findIndex((c) => c.terminal === open.id); }
  });

  test('@playwright/mcp works through the CDP proxy', async ({ shell }) => {
    const cli = path.join(path.dirname(fileURLToPath(import.meta.resolve('@playwright/mcp/package.json'))), 'cli.js');
    const c = new Client({ name: 'kulisa-test', version: '0' });
    await c.connect(new StdioClientTransport({ command: 'node', args: [cli, '--cdp-endpoint', shell.profiles.get('sam-seller').endpoint, '--output-dir', path.join(root, 'pw-mcp')], stderr: 'ignore' }));
    try {
      const nav = await c.callTool({ name: 'browser_navigate', arguments: { url: `${SITE}/app` } });
      assert.ok(!nav.isError, JSON.stringify(nav.content));
      const snap = await c.callTool({ name: 'browser_snapshot', arguments: {} });
      assert.match((snap.content as { text: string }[])[0].text, /Signed in as/);
      const click = await c.callTool({ name: 'browser_click', arguments: { element: 'Checkout', target: "getByRole('button', { name: 'Checkout' })" } });
      assert.ok(!click.isError, JSON.stringify(click.content));
    } finally { await c.close(); }
  });
};
