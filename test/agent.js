// Profiles and the agent: the editor, the MCP server and the plugin, tabs, isolation, the Chrome identity, the
// sign-in pause, the agent's cursor, point and tell, @playwright/mcp.
const fs = require('fs');
const path = require('path');
const { assert, root, userData, project, pfile, savedTabs, panel, SITE, sleep, waitFor, who, menuRows, choose, manageProfiles, menuOpen, rightClick,
  box, pageBox, viewOn, dock, ctrl, near } = require('./helpers');
const { app } = require('electron');
const { CLAUDE_PLUGIN } = require('../src/main/app');

module.exports = (test) => {
  test('create profiles in the profile editor; views are hidden while it is open', async ({ shell, ui }) => {
    await manageProfiles(ui);
    for (const name of ['Sam.seller', 'Elon.buyer']) {
      await ui(`document.getElementById('newProfile').value = ${JSON.stringify(name)}; document.getElementById('padd').requestSubmit()`);
      await waitFor(() => shell.profiles.size === (name.startsWith('Sam') ? 1 : 2));
    }
    assert.deepEqual([...shell.profiles.keys()], ['sam-seller', 'elon-buyer']);
    assert.equal(shell.profiles.get('elon-buyer').get().view.getVisible(), false);
    await waitFor(async () => (await ui(`document.querySelectorAll('#plist .prow').length`)) === 2);
    await ui(`document.getElementById('closeProfiles').click()`);
    await waitFor(() => shell.profiles.get('elon-buyer').get().view.getVisible());
    assert.equal(await ui(`document.querySelectorAll('.pane').length`), 2);
  });

  test('web pages cannot reach the MCP server, its hooks or the CDP proxy (Host and Origin checks)', async ({ shell }) => {
    const http = require('http');
    const WebSocket = require('ws');
    const status = (url, headers, method = 'GET') => new Promise((resolve) => {
      const r = http.request(url, { method, headers }, (res) => { res.resume(); resolve(res.statusCode); });
      r.on('error', () => resolve('error')); r.end(method === 'POST' ? '{}' : undefined);
    });
    const url = shell.ws.env().KULISA_MCP_URL;
    const mcp = new URL(url), proxy = new URL(shell.profiles.get('sam-seller').endpoint);
    const json = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
    // DNS rebinding: a page on evil.example resolving to 127.0.0.1 sends its own Host.
    assert.equal(await status(url, { ...json, host: `evil.example:${mcp.port}` }, 'POST'), 403);
    assert.equal(await status(`${shell.ws.env().KULISA_URL}/hooks/session-start`, { host: `evil.example:${mcp.port}` }), 403);
    assert.equal(await status(`${proxy.href}/json/version`, { host: `evil.example:${proxy.port}` }), 403);
    // A page's own requests carry Origin.
    assert.equal(await status(url, { ...json, origin: 'https://evil.example' }, 'POST'), 403);
    const ws = (origin) => new Promise((resolve) => {
      const s = new WebSocket(`ws://127.0.0.1:${proxy.port}/1/sam-seller`, origin ? { origin } : {});
      s.on('open', () => { s.close(); resolve('open'); }); s.on('error', () => resolve('refused'));
    });
    assert.equal(await ws('https://evil.example'), 'refused');
    assert.equal(await ws(), 'open'); // Playwright and other local tools send no Origin
    assert.equal(await status(`${shell.ws.env().KULISA_URL}/hooks/session-start`, {}), 200);
    assert.equal(await status(`${shell.mcp.base}/ws/9/hooks/session-start`, {}), 404, 'no such workspace');
  });
  test('agent bridge: the Claude Code plugin is valid and points at this MCP server', async ({ shell }) => {
    assert.ok(fs.existsSync(path.join(CLAUDE_PLUGIN, '.claude-plugin', 'plugin.json')));
    assert.ok(fs.existsSync(path.join(CLAUDE_PLUGIN, 'skills', 'profiles', 'SKILL.md')));
    const mcp = JSON.parse(fs.readFileSync(path.join(CLAUDE_PLUGIN, '.mcp.json'), 'utf8'));
    assert.equal(mcp.mcpServers.kulisa.url, '${KULISA_MCP_URL}');
    assert.equal(shell.ws.env().KULISA_MCP_URL, `${shell.mcp.base}/ws/1/mcp`);
    // With Claude Code installed, check the plugin the way it loads it.
    const { spawnSync } = require('child_process');
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
  test('agent bridge: at session start the plugin hook tells the agent which profiles are open, and Kulisa notes the session', async ({ shell }) => {
    const hooks = JSON.parse(fs.readFileSync(path.join(CLAUDE_PLUGIN, 'hooks', 'hooks.json'), 'utf8'));
    const command = hooks.hooks.SessionStart[0].hooks[0].command;
    const { spawn } = require('child_process');
    // Run it the way Claude Code does (bash), in the background: Kulisa answers it from this process.
    // Claude Code passes the hook its input as JSON on stdin.
    const transcript = path.join(project, 'transcript.jsonl');
    fs.writeFileSync(transcript, '');
    const input = JSON.stringify({ hook_event_name: 'SessionStart', session_id: 'session-1', transcript_path: transcript, source: 'startup' });
    const run = (env) => new Promise((resolve) => {
      const c = spawn('bash', ['-c', command], { env: { ...process.env, KULISA_URL: '', ...env } });
      let out = ''; c.stdout.on('data', (d) => (out += d)); c.on('close', (code) => resolve({ code, out }));
      c.stdin.end(input);
    });
    const inKulisa = await run(shell.ws.env());
    assert.deepEqual(JSON.parse(fs.readFileSync(pfile('agent.json'), 'utf8')), { agent: 'custom', started: true, sessionId: 'session-1', transcript });
    assert.equal(inKulisa.code, 0);
    const context = JSON.parse(inKulisa.out).hookSpecificOutput.additionalContext;
    assert.match(context, /- sam-seller \("Sam.seller"\)/);
    assert.match(context, /- elon-buyer \("Elon.buyer"\)/);
    assert.match(context, /tab k\d+ \(active\)/);
    const outside = await run({});
    assert.deepEqual(outside, { code: 0, out: '' }, 'outside Kulisa the hook does nothing');
  });
  test('agent: highlight elements for the human (also on Trusted Types pages), then clear', async ({ shell, call }) => {
    const sam = shell.profiles.get('sam-seller');
    // Pixels of the profile's color in the tab's own rendering: the outline and label are really drawn.
    const colored = async () => {
      const img = await sam.get().wc.capturePage(); const px = img.toBitmap(); // BGRA
      const [r, g, b] = sam.color.match(/\w\w/g).map((h) => parseInt(h, 16));
      let n = 0; for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i + 2] - r) < 8 && Math.abs(px[i + 1] - g) < 8 && Math.abs(px[i] - b) < 8) n++;
      return n;
    };
    for (const url of [`${SITE}/app`, `${SITE}/strict`]) {
      await call('browser_navigate', { profile: 'sam-seller', url });
      const r = await call('browser_highlight', { profile: 'sam-seller', elements: [
        { locator: "getByRole('button', { name: 'Sign in' })", label: 'Sign in is here' },
        { locator: 'locator("a").first()' }] });
      assert.match(r.text, /Highlighted 2 element/);
      await sleep(300);
      assert.ok(await colored() > 300, `${url}: outline and label visible (${await colored()} px)`);
      if (url.endsWith('/app')) await shell.screenshot(path.join(root, 'highlight.png'));
      await call('browser_highlight', { profile: 'sam-seller', elements: [] });
      await sleep(300);
      assert.ok(await colored() < 50, `${url}: cleared (${await colored()} px)`);
    }
  });
  test('highlights go away when the human clicks or types in the page', async ({ shell, call }) => {
    const { highlights } = require('../src/main/mcp-server');
    const sam = shell.profiles.get('sam-seller');
    await call('browser_navigate', { profile: 'sam-seller', url: `${SITE}/app` });
    for (const input of [[{ type: 'mouseDown', x: 300, y: 300, button: 'left', clickCount: 1 }, { type: 'mouseUp', x: 300, y: 300, button: 'left', clickCount: 1 }],
      [{ type: 'keyDown', keyCode: 'Shift' }, { type: 'keyUp', keyCode: 'Shift' }]]) {
      await call('browser_highlight', { profile: 'sam-seller', elements: [{ locator: "getByRole('button', { name: 'Sign in' })", label: 'here' }] });
      assert.equal(highlights.has('1/sam-seller'), true);
      const wc = sam.get().wc; wc.focus();
      for (const e of input) wc.sendInputEvent(e);
      await waitFor(() => !highlights.has('1/sam-seller'));
    }
  });
  test('agent: an element that is not there fails fast, with what to do instead', async ({ call }) => {
    await call('browser_navigate', { profile: 'sam-seller', url: `${SITE}/app` });
    for (const [tool, args] of [['browser_highlight', { elements: [{ locator: "getByRole('button', { name: 'New chat' })" }] }],
      ['browser_click', { locator: "getByRole('button', { name: 'New chat' })" }], ['browser_type', { locator: "getByRole('textbox', { name: 'Nope' })", text: 'x' }]]) {
      const t0 = Date.now();
      await assert.rejects(call(tool, { profile: 'sam-seller', ...args }), /No element matches .* browser_snapshot/);
      assert.ok(Date.now() - t0 < 2500, `${tool} took ${Date.now() - t0} ms`);
    }
  });
  test('agent: create a profile with profile_create', async ({ shell, call, ui }) => {
    const r = await call('profile_create', { name: 'Ann.admin' });
    assert.match(r.text, /Created profile ann-admin/);
    assert.ok(shell.profiles.has('ann-admin'));
    const list = JSON.parse((await call('browser_profiles', {})).text);
    assert.deepEqual(list.map((p) => p.id), ['sam-seller', 'elon-buyer', 'ann-admin']);
    await waitFor(async () => (await ui(`document.querySelectorAll('.pane').length`)) === 3);
    await ui(`kulisa.invoke('profile:delete', { profile: 'ann-admin' })`);
  });
  test('agent: navigate, snapshot, type by ref, click by locator, screenshot', async ({ call }) => {
    await call('browser_navigate', { profile: 'sam-seller', url: `${SITE}/app` });
    const snap = await call('browser_snapshot', { profile: 'sam-seller' });
    const ref = snap.text.match(/textbox "Name"[^\n]*\[ref=(\w+)\]/)[1];
    await call('browser_type', { profile: 'sam-seller', ref, text: 'sam', submit: true });
    await sleep(300);
    await call('browser_click', { profile: 'sam-seller', locator: "getByRole('button', { name: 'Checkout' })" });
    const shot = await call('browser_screenshot', { profile: 'sam-seller' });
    assert.equal(shot.content[0].type, 'image');
  });

  test('tab strip: + opens a tab, a click on a tab makes it active, × closes it', async ({ shell, ui }) => {
    const elon = shell.profiles.get('elon-buyer');
    const strip = `document.querySelector('.pane[data-profile="elon-buyer"] .tabs')`;
    const first = elon.active, n = elon.tabs.length;
    await ui(`${strip}.querySelector('.add').click()`);
    await waitFor(() => elon.tabs.length === n + 1 && elon.active !== first);
    await waitFor(async () => (await ui(`${strip}.querySelectorAll('.tab').length`)) === n + 1);
    await ui(`${strip}.querySelector('.tab[data-tab="${first}"] .title').click()`);
    await waitFor(() => elon.active === first);
    await ui(`${strip}.querySelector('.tab:last-of-type .x').click()`);
    await waitFor(() => elon.tabs.length === n);
  });
  test('back and forward buttons are enabled only when there is somewhere to go', async ({ call, ui }) => {
    const buttons = () => ui(`[...document.querySelectorAll('.pane')][0].querySelectorAll('.back, .fwd').values().map((b) => b.disabled).toArray()`);
    await call('browser_navigate', { profile: 'sam-seller', url: `${SITE}/app?n=1` });
    await call('browser_navigate', { profile: 'sam-seller', url: `${SITE}/app?n=2` });
    await waitFor(async () => JSON.stringify(await buttons()) === '[false,true]');
    await ui(`[...document.querySelectorAll('.pane')][0].querySelector('.back').click()`);
    await waitFor(async () => JSON.stringify(await buttons()) === '[false,false]');
  });
  test('profiles are isolated', async (ctx) => {
    await ctx.call('browser_navigate', { profile: 'elon-buyer', url: `${SITE}/app` });
    assert.equal(await who(ctx, 'sam-seller'), 'Signed in as sam');
    assert.equal(await who(ctx, 'elon-buyer'), 'Signed out');
  });

  test('target=_blank and window.open open tabs of the same profile', async ({ shell, call }) => {
    const sam = shell.profiles.get('sam-seller');
    const before = sam.tabs.length;
    const waitTabs = async (n) => { for (let i = 0; i < 50 && sam.tabs.length < n; i++) await sleep(100); assert.equal(sam.tabs.length, n); };
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
    for (let i = 0; i < 50 && sam.tabs.length > 1; i++) await sleep(100);
  });

  test('profiles present themselves as Google Chrome (UA, UA-CH headers, userAgentData, popups)', async ({ shell }) => {
    const elon = shell.profiles.get('elon-buyer');
    const page = await elon.page();
    await page.goto(`${SITE}/headers`); await page.reload(); // second load: Accept-CH hints are known
    const nav = JSON.parse(await page.locator('body').innerText());
    assert.match(nav['user-agent'], /Chrome\/\d+\.0\.0\.0 Safari/);
    assert.doesNotMatch(nav['user-agent'], /Electron/);
    assert.match(nav['sec-ch-ua'], /"Google Chrome";v="\d+"/);
    assert.match(nav['sec-ch-ua-full-version-list'], /"Google Chrome";v="[\d.]+"/);
    // The machine part is what Chromium itself reports (the shell window has no override), as real Chrome would.
    const hints = ['platform', 'platformVersion', 'architecture', 'bitness', 'wow64'];
    const native = await shell.win.webContents.executeJavaScript(`navigator.userAgentData.getHighEntropyValues(${JSON.stringify(hints)})`);
    const mimicked = await page.evaluate((h) => navigator.userAgentData.getHighEntropyValues(h), hints);
    for (const h of hints) assert.deepEqual(mimicked[h], native[h], h);
    assert.equal(nav['sec-ch-ua-platform'], `"${native.platform}"`);
    assert.equal(nav['user-agent'].match(/\(([^)]+)\)/)[1], app.userAgentFallback.match(/\(([^)]+)\)/)[1]);
    const js = await page.evaluate(async () => ({
      brands: navigator.userAgentData.brands.map((b) => b.brand), webdriver: navigator.webdriver,
      fetch: await fetch('/headers').then((r) => r.json()),
    }));
    assert.ok(js.brands.includes('Google Chrome'));
    assert.equal(js.webdriver, false);
    assert.match(js.fetch['sec-ch-ua'], /Google Chrome/);
    const [popup] = await Promise.all([page.context().waitForEvent('page'), page.evaluate((u) => window.open(u), `${SITE}/headers`)]);
    await popup.waitForLoadState();
    assert.match(JSON.parse(await popup.locator('body').innerText())['sec-ch-ua'], /Google Chrome/);
    await popup.close();
  });

  test('the agent pauses on sign-in pages and comes back after', async ({ shell, call }) => {
    const elon = shell.profiles.get('elon-buyer');
    const wc = elon.get().wc;
    await wc.loadURL('http://localhost:4417/app'); // localhost is a sign-in host in this test
    for (let i = 0; i < 50 && !elon.signinMode; i++) await sleep(100);
    assert.equal(elon.signinMode, true);
    await assert.rejects(call('browser_snapshot', { profile: 'elon-buyer' }), /sign-in mode/);
    assert.equal(await wc.executeJavaScript('navigator.webdriver'), false);
    await wc.loadURL(`${SITE}/app`);
    for (let i = 0; i < 50 && elon.signinMode; i++) await sleep(100);
    assert.equal(elon.signinMode, false);
    assert.equal(await who({ call }, 'elon-buyer'), 'Signed out');
  });

  test('ghost cursor: agent clicks are seen with coordinates', async ({ shell, call }) => {
    const actions = [];
    const on = (a) => actions.push(a);
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
    await sleep(300);
    const pending = ui(`kulisa.invoke('pick:start', { profile: 'elon-buyer' })`);
    await sleep(800);
    const b = await page.locator('#pay').boundingBox();
    const x = Math.round(b.x + b.width / 2), y = Math.round(b.y + b.height / 2);
    const wc = elon.get().wc;
    wc.sendInputEvent({ type: 'mouseMove', x, y }); await sleep(100);
    wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
    wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
    const pick = await pending;
    assert.equal(pick.locator, "getByRole('button', { name: 'Pay now' })");
    assert.equal(pick.tab, elon.active);
    assert.ok(!fs.existsSync(path.join(project, '.kulisa')), 'nothing is written into the project');
    await sleep(500);
    const ref = `[kulisa pick: elon-buyer tab ${pick.tab} getByRole('button', { name: 'Pay now' })]`;
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
    assert.match(failed, /POST http:\/\/127\.0\.0\.1:4417\/api\/pay → 500/); // page.requests()
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
      await waitFor(async () => (await ui(`${button}.classList.contains('active')`)) && shell.picking?.has('elon-buyer'));
      await sleep(300);
      if (cancel === 'button') await ui(`${button}.click()`);
      else {
        const wc = elon.get().wc;
        wc.focus();
        wc.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); wc.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
      }
      await waitFor(async () => !(await ui(`${button}.classList.contains('active')`)) && !shell.picking.has('elon-buyer'));
      assert.equal(await ui(`document.querySelector('.ptab[data-panel="profile:Profile 2"] .caption').textContent`), '', cancel);
    }
    await sleep(300);
    assert.equal(ptyOutput().slice(before).includes('kulisa pick'), false);
  });

  test('@playwright/mcp works through the CDP proxy', async ({ shell }) => {
    const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
    const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
    const cli = path.join(path.dirname(require.resolve('@playwright/mcp/package.json')), 'cli.js');
    const c = new Client({ name: 'kulisa-test', version: '0' });
    await c.connect(new StdioClientTransport({ command: 'node', args: [cli, '--cdp-endpoint', shell.profiles.get('sam-seller').endpoint, '--output-dir', path.join(root, 'pw-mcp')], stderr: 'ignore' }));
    try {
      const nav = await c.callTool({ name: 'browser_navigate', arguments: { url: `${SITE}/app` } });
      assert.ok(!nav.isError, JSON.stringify(nav.content));
      const snap = await c.callTool({ name: 'browser_snapshot', arguments: {} });
      assert.match(snap.content[0].text, /Signed in as/);
      const click = await c.callTool({ name: 'browser_click', arguments: { element: 'Checkout', target: "getByRole('button', { name: 'Checkout' })" } });
      assert.ok(!click.isError, JSON.stringify(click.content));
    } finally { await c.close(); }
  });
};
