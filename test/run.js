// Kulisa tests: start the real app (Electron) against a local test site, drive it like the human (IPC, input
// events) and like the agent (MCP), and check the results. Two phases share a temporary user-data folder:
//   electron test/run.js            everything up to and including a rename
//   electron test/run.js --restart  after a restart: profiles, sign-ins and tabs are still there
// `npm test` runs both.
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert/strict');
const { start, CLAUDE_PLUGIN } = require('../src/main/app');
const { ensureSite } = require('./fixtures/site');

const restart = process.argv.includes('--restart');
const root = path.join(os.tmpdir(), 'kulisa-test');
if (!restart) fs.rmSync(root, { recursive: true, force: true });
const userData = path.join(root, 'data');
const project = path.join(root, 'project');
fs.mkdirSync(project, { recursive: true });
// The agent: cat, typed into a bash started as a terminal would start the user's shell, in the project's folder;
// its startup file sets an environment of the project, as direnv's .envrc does.
const bashrc = path.join(root, 'bashrc');
fs.writeFileSync(bashrc, `PS1='$ '\nexport FROM_RC="rc of $PWD"\n`);
const agent = { command: 'bash', args: ['-c', 'echo "agent: $FROM_RC"; exec cat -v'], resume: () => [], shell: { command: 'bash', args: ['--rcfile', bashrc, '-i'] } };
// A file of the test project's own data (store.js; the project's id is its folder's name).
const pfile = (f) => path.join(userData, 'projects', 'project', f);
const SITE = 'http://127.0.0.1:4417';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const sitePromise = ensureSite();
// The restart phase runs as a packaged build would as to DevTools: Kulisa's own are off (appDevTools).
start({ userData, project, agent, mcpPort: 0, signinHosts: ['localhost'], appDevTools: !restart })
  .then(async (shell) => {
    await sitePromise;
    const ctx = await setup(shell);
    let failed = 0;
    for (const t of tests) {
      const t0 = Date.now();
      try {
        await Promise.race([t.fn(ctx), sleep(30000).then(() => { throw new Error('timeout 30 s'); })]);
        console.log(`  ✓ ${t.name} (${Date.now() - t0} ms)`);
      } catch (e) {
        failed++;
        console.log(`  ✗ ${t.name}\n      ${(e.code === 'ERR_ASSERTION' ? e.message : String(e.stack || e).split('\n').slice(0, 4).join('\n')).replace(/\n/g, '\n      ')}`);
      }
    }
    console.log(failed ? `\n${failed} of ${tests.length} failed` : `\nall ${tests.length} passed`);
    // Quit the way a user closes the window (before-quit saves session cookies, kills the pty), then set the code.
    app.on('will-quit', (e) => {
      e.preventDefault();
      if (restart && !failed) fs.rmSync(root, { recursive: true, force: true });
      app.exit(failed ? 1 : 0);
    });
    app.quit();
  })
  .catch((e) => { console.error(e); app.exit(1); });

async function setup(shell) {
  const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
  const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
  const mcp = new Client({ name: 'kulisa-test', version: '0' });
  await mcp.connect(new StreamableHTTPClientTransport(new URL(shell.mcp.url)));
  const call = async (name, args) => {
    const r = await mcp.callTool({ name, arguments: args });
    const text = r.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    if (r.isError) throw new Error(`${name}: ${text}`);
    return { ...r, text };
  };
  const ui = (js) => shell.win.webContents.executeJavaScript(js);
  let pty = '';
  const watchPty = (p) => p.onData((d) => (pty += d)); // again for the agent of another project
  watchPty(shell.pty);
  // What the terminal in the window shows.
  const termText = () => ui(`(() => { const b = window.__term.buffer.active; return Array.from({ length: b.length }, (_, i) => b.getLine(i).translateToString(true)).join('\\n'); })()`);
  await waitFor(async () => (await termText()).includes('agent: rc of')); // the agent runs
  // Native questions (deleting a profile) are not shown on screen: the test answers them with ctx.answer.
  const { dialog } = require('electron');
  const asked = [];
  const ctx = { shell, call, ui, ptyOutput: () => pty, watchPty, termText, asked, answer: true };
  dialog.showMessageBox = async (_win, o) => { asked.push(o); return { response: ctx.answer ? 0 : 1 }; };
  return ctx;
}
// Kulisa's menus (menu.js): wait for the open one and get its rows ('-' a line, '# …' a heading,
// 'zoom' the zoom row; an item: its label, '(off)' when disabled); choose one by its label.
const menuRows = async (ui) => {
  await waitFor(() => ui(`document.getElementById('menu').matches(':popover-open')`));
  return ui(`[...document.getElementById('menu').children].map((r) => r.matches('hr') ? '-' : r.matches('.heading') ? '# ' + r.textContent
    : r.matches('.zoomrow') ? 'zoom' : r.querySelector('.label').textContent + (r.disabled ? ' (off)' : ''))`);
};
const choose = (ui, label) => ui(`[...document.querySelectorAll('#menu .item')].find((b) => b.querySelector('.label').textContent === ${JSON.stringify(label)}).click()`);
// The profile editor: Profiles ▾, then Manage Profiles….
const manageProfiles = async (ui) => {
  await ui(`document.getElementById('openProfiles').click()`);
  await menuRows(ui);
  await choose(ui, 'Manage Profiles…');
};
const menuOpen = (ui) => ui(`document.getElementById('menu').matches(':popover-open')`);
// A right-click on an element of the window, at its middle.
const rightClick = (ui, sel) => ui(`(() => { const e = document.querySelector(${JSON.stringify(sel)}), r = e.getBoundingClientRect();
  e.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 })); })()`);

async function waitFor(cond, ms = 5000) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(50)) if (await cond()) return;
  throw new Error(`waitFor timed out: ${cond}`);
}

const who = async (ctx, profile) => (await ctx.call('browser_snapshot', { profile })).text.match(/Signed (in as \w+|out)/)?.[0];

if (!restart) {
  test('create profiles in the profile editor; views are hidden while it is open', async ({ shell, ui }) => {
    await manageProfiles(ui);
    for (const name of ['Sam · seller', 'Elon · buyer']) {
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
    const mcp = new URL(shell.mcp.url), proxy = new URL(shell.proxy.endpoint('sam-seller'));
    const json = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
    // DNS rebinding: a page on evil.example resolving to 127.0.0.1 sends its own Host.
    assert.equal(await status(shell.mcp.url, { ...json, host: `evil.example:${mcp.port}` }, 'POST'), 403);
    assert.equal(await status(`${shell.mcp.base}/hooks/session-start`, { host: `evil.example:${mcp.port}` }), 403);
    assert.equal(await status(`${proxy.href}/json/version`, { host: `evil.example:${proxy.port}` }), 403);
    // A page's own requests carry Origin.
    assert.equal(await status(shell.mcp.url, { ...json, origin: 'https://evil.example' }, 'POST'), 403);
    const ws = (origin) => new Promise((resolve) => {
      const s = new WebSocket(`ws://127.0.0.1:${proxy.port}/sam-seller`, origin ? { origin } : {});
      s.on('open', () => { s.close(); resolve('open'); }); s.on('error', () => resolve('refused'));
    });
    assert.equal(await ws('https://evil.example'), 'refused');
    assert.equal(await ws(), 'open'); // Playwright and other local tools send no Origin
    assert.equal(await status(`${shell.mcp.base}/hooks/session-start`, {}), 200);
  });
  test('agent bridge: the Claude Code plugin is valid and points at this MCP server', async ({ shell }) => {
    assert.ok(fs.existsSync(path.join(CLAUDE_PLUGIN, '.claude-plugin', 'plugin.json')));
    assert.ok(fs.existsSync(path.join(CLAUDE_PLUGIN, 'skills', 'profiles', 'SKILL.md')));
    const mcp = JSON.parse(fs.readFileSync(path.join(CLAUDE_PLUGIN, '.mcp.json'), 'utf8'));
    assert.equal(mcp.mcpServers.kulisa.url, '${KULISA_MCP_URL}');
    assert.equal(shell.agent.env.KULISA_MCP_URL, shell.mcp.url);
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
    const inKulisa = await run(shell.agent.env);
    assert.deepEqual(JSON.parse(fs.readFileSync(pfile('agent.json'), 'utf8')), { sessionId: 'session-1', transcript });
    assert.equal(inKulisa.code, 0);
    const context = JSON.parse(inKulisa.out).hookSpecificOutput.additionalContext;
    assert.match(context, /- sam-seller \("Sam · seller"\)/);
    assert.match(context, /- elon-buyer \("Elon · buyer"\)/);
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
      assert.equal(highlights.has('sam-seller'), true);
      const wc = sam.get().wc; wc.focus();
      for (const e of input) wc.sendInputEvent(e);
      await waitFor(() => !highlights.has('sam-seller'));
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
    const r = await call('profile_create', { name: 'Ann · admin' });
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
    const note = fs.readFileSync(path.join(shell.notesDir, pick.id, 'note.md'), 'utf8');
    const screenshot = note.match(/Screenshot \(element outlined\): (.+)/)[1];
    assert.ok(fs.existsSync(screenshot));
    assert.match(note, /- error: PaymentError/); // from Playwright's page.consoleMessages()
    assert.match(note, /- POST http:\/\/127\.0\.0\.1:4417\/api\/pay → 500/); // page.requests()
    await sleep(500);
    const ref = `[kulisa pick: elon-buyer getByRole('button', { name: 'Pay now' }) · details: .kulisa/notes/${pick.id}/note.md]`;
    // The agent here is `cat`: the terminal echoes typed input, and cat prints it again only after Enter. Once
    // means it waits in the prompt for the human to write about it.
    assert.equal(ptyOutput().split(ref).length - 1, 1, ptyOutput());
    assert.equal(await ui(`document.activeElement.classList.contains('xterm-helper-textarea')`), true, 'the terminal has focus');
    shell.pty.write('\x15'); // Ctrl+U: clear the line for the next tests
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
      assert.equal(await ui(`document.querySelector('.ptab[data-panel="profile:persist:elon-buyer"] .caption').textContent`), '', cancel);
    }
    await sleep(300);
    assert.equal(ptyOutput().slice(before).includes('kulisa pick'), false);
  });

  test('@playwright/mcp works through the CDP proxy', async ({ shell }) => {
    const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
    const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
    const cli = path.join(path.dirname(require.resolve('@playwright/mcp/package.json')), 'cli.js');
    const c = new Client({ name: 'kulisa-test', version: '0' });
    await c.connect(new StdioClientTransport({ command: 'node', args: [cli, '--cdp-endpoint', shell.proxy.endpoint('sam-seller'), '--output-dir', path.join(root, 'pw-mcp')], stderr: 'ignore' }));
    try {
      const nav = await c.callTool({ name: 'browser_navigate', arguments: { url: `${SITE}/app` } });
      assert.ok(!nav.isError, JSON.stringify(nav.content));
      const snap = await c.callTool({ name: 'browser_snapshot', arguments: {} });
      assert.match(snap.content[0].text, /Signed in as/);
      const click = await c.callTool({ name: 'browser_click', arguments: { element: 'Checkout', target: "getByRole('button', { name: 'Checkout' })" } });
      assert.ok(!click.isError, JSON.stringify(click.content));
    } finally { await c.close(); }
  });

  test('rename keeps the profile and the sign-in', async (ctx) => {
    const r = await ctx.ui(`kulisa.invoke('profile:rename', { profile: 'sam-seller', name: 'Sam · admin' })`);
    assert.equal(r.id, 'sam-admin');
    assert.equal(await who(ctx, 'sam-admin'), 'Signed in as sam');
    await sleep(200); // the window re-renders after the state update
    assert.deepEqual(await ctx.ui(`[...document.querySelectorAll('.pname')].map((e) => e.textContent)`), ['Sam · admin', 'Elon · buyer']);
  });
  test('delete a profile in the editor: sign-ins and data gone, a new one of the same name starts clean', async (ctx) => {
    const { shell, ui, call } = ctx;
    await ui(`kulisa.invoke('profile:new', { name: 'Temp' })`);
    const temp = shell.profiles.get('temp');
    assert.equal(temp.partition, 'persist:temp');
    await call('browser_navigate', { profile: 'temp', url: `${SITE}/app/login?name=tim` });
    assert.equal(await who(ctx, 'temp'), 'Signed in as tim');
    await shell.sessionCookies.save(temp);
    assert.ok(fs.existsSync(shell.sessionCookies.file(temp)));

    await manageProfiles(ui);
    await waitFor(async () => (await ui(`document.querySelectorAll('#plist .prow').length`)) === 3);
    const row = `[...document.querySelectorAll('#plist .prow')].find((r) => r.querySelector('.pid').textContent === 'temp')`;
    ctx.answer = false; // Cancel
    await ui(`${row}.querySelector('.del').click()`);
    await waitFor(() => ctx.asked.length);
    assert.equal(ctx.asked.pop().message, 'Delete the profile Temp?');
    await sleep(100);
    assert.ok(shell.profiles.has('temp'), 'nothing is deleted without the confirmation');
    ctx.answer = true;
    const deleted = new Promise((r) => temp.once('deleted', r));
    await ui(`${row}.querySelector('.del').click()`);
    await deleted;
    ctx.asked.length = 0;
    await ui(`document.getElementById('closeProfiles').click()`);

    assert.deepEqual([...shell.profiles.keys()], ['sam-admin', 'elon-buyer']);
    assert.equal(temp.tabs.length, 0);
    assert.deepEqual(await temp.session.cookies.get({}), []);
    assert.ok(!fs.existsSync(shell.sessionCookies.file(temp)));
    const savedIds = () => JSON.parse(fs.readFileSync(pfile('profiles.json'), 'utf8')).map((p) => p.id).join();
    await waitFor(() => savedIds() === 'sam-admin,elon-buyer');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(userData, 'deleted-partitions.json'), 'utf8')), ['persist:ann-admin', 'persist:temp']); // ann-admin: the profile_create test
    await assert.rejects(call('browser_snapshot', { profile: 'temp' }), /No profile "temp"/);
    await waitFor(async () => (await ui(`document.querySelectorAll('.pane').length`)) === 2);

    // Same name again: a new partition (the old folder goes at the next start), signed out.
    await ui(`kulisa.invoke('profile:new', { name: 'Temp' })`);
    assert.equal(shell.profiles.get('temp').partition, 'persist:temp-2');
    await call('browser_navigate', { profile: 'temp', url: `${SITE}/app` });
    assert.equal(await who(ctx, 'temp'), 'Signed out');
    await ui(`kulisa.invoke('profile:delete', { profile: 'temp' })`);
  });
  test('rename in the profile editor', async ({ shell, ui }) => {
    await manageProfiles(ui);
    const name = `[...document.querySelectorAll('#plist .prow')].find((r) => r.querySelector('.pid').textContent === 'elon-buyer').querySelector('.name')`;
    await ui(`(() => { const n = ${name}; n.value = 'Elon · shopper'; n.dispatchEvent(new Event('change')); })()`);
    await waitFor(() => shell.profiles.has('elon-shopper'));
    await ui(`(() => { const n = [...document.querySelectorAll('#plist .prow')].find((r) => r.querySelector('.pid').textContent === 'elon-shopper').querySelector('.name'); n.value = 'Elon · buyer'; n.dispatchEvent(new Event('change')); })()`);
    await waitFor(() => shell.profiles.has('elon-buyer'));
    await ui(`document.getElementById('closeProfiles').click()`);
  });
  test("F12 opens and closes DevTools: a tab's, or Kulisa's own outside the pages", async ({ shell }) => {
    for (const wc of [shell.profiles.get('sam-admin').get().wc, shell.win.webContents]) {
      const press = () => { wc.focus(); wc.sendInputEvent({ type: 'keyDown', keyCode: 'F12' }); wc.sendInputEvent({ type: 'keyUp', keyCode: 'F12' }); };
      press();
      await waitFor(() => wc.isDevToolsOpened());
      press();
      await waitFor(() => !wc.isDevToolsOpened());
    }
  });
  test('the DevTools button of a pane opens and closes the DevTools of its active tab', async ({ shell, ui }) => {
    const wc = shell.profiles.get('sam-admin').get().wc;
    const click = () => ui(`document.querySelector('.pane[data-profile="sam-admin"] .devtools').click()`);
    await click();
    await waitFor(() => wc.isDevToolsOpened());
    await click();
    await waitFor(() => !wc.isDevToolsOpened());
  });
  test('the agent starts at the terminal\'s real size, not a default one', async ({ shell, ui }) => {
    // Claude Code draws its prompt for the size it starts with and does not fully redraw on the first resize.
    const first = await ui(`window.__ptySizes[0]`);
    assert.deepEqual(shell.pty.spawnSize, first);
    assert.ok(first.rows >= 10 && first.cols >= 80, `a real size: ${JSON.stringify(first)}`);
  });
  test('terminal: Unicode 11 widths (cursor stays put after emoji), bundled font, GPU renderer', async ({ ui }) => {
    // Claude Code draws ✅, ⏵, ✻…; with Unicode 6 widths xterm puts the cursor one cell off after each wide one.
    const x = await ui(`new Promise((r) => window.__term.write('\\r\\n✅🙂x', () => r(window.__term.buffer.active.cursorX)))`);
    assert.equal(x, 5);
    assert.equal(await ui(`document.fonts.check(window.__term.options.fontSize + 'px "JetBrains Mono"')`), true);
    assert.equal(await ui(`window.__term.options.fontSize`), await ui(`parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font'))`), 'the terminal uses the UI text size');
    assert.equal(await ui(`window.__term.options.fontFamily.startsWith('"JetBrains Mono"')`), true);
    assert.equal(await ui(`window.__termRenderer`), 'webgl');
  });
  test('the app icon: in the top bar, and every file the window and the installers use', async ({ ui }) => {
    const img = await ui(`(() => { const i = document.querySelector('#topbar svg.logo'); return i && { w: i.viewBox.baseVal.width, h: i.getBoundingClientRect().height,
      drape: getComputedStyle(i.querySelector('stop.lit')).stopColor, project: getComputedStyle(document.documentElement).getPropertyValue('--project') }; })()`);
    assert.ok(img && img.w > 0 && img.h >= 16, JSON.stringify(img));
    assert.equal(img.drape, 'rgb(74, 123, 208)', "the curtain is in the project's color (#4a7bd0, the first one)");
    const forge = require('../forge.config.js');
    const files = [forge.packagerConfig.icon + '.png', forge.packagerConfig.icon + '.ico', forge.packagerConfig.icon + '.icns',
      ...forge.makers.flatMap((m) => [m.config?.setupIcon, m.config?.icon, m.config?.options?.icon]).filter(Boolean)];
    for (const f of files) assert.ok(fs.statSync(path.join(__dirname, '..', f)).size > 1000, f);
    assert.equal(files.length, 6);
  });
  test('one row on top: no menu bar, OS window buttons over the top bar', async ({ shell, ui }) => {
    assert.equal(shell.win.isMenuBarVisible(), false);
    assert.equal(await ui(`navigator.windowControlsOverlay.visible`), true);
    const bar = await ui(`(() => { const r = document.getElementById('topbar').getBoundingClientRect(); return { top: r.top, height: r.height, right: r.right }; })()`);
    const controls = await ui(`(() => { const r = navigator.windowControlsOverlay.getTitlebarAreaRect(); return { x: r.x, width: r.width }; })()`);
    assert.equal(bar.top, 0);
    assert.equal(bar.height, 44);
    assert.ok(bar.right <= controls.x + controls.width, 'the bar ends where the window buttons begin');
  });
  test('UI text is not selectable by dragging, as in a desktop app; fields are', async ({ ui }) => {
    const sel = await ui(`(() => { const us = (q) => getComputedStyle(document.querySelector(q)).userSelect;
      return { button: us('#openProjects'), name: us('#projectName'), tab: us('.tab .title'), header: us('.ptab'), field: us('.addr') }; })()`);
    assert.deepEqual(sel, { button: 'none', name: 'none', tab: 'none', header: 'none', field: 'text' });
  });
  test('screenshot of the whole window, profile views included', async ({ shell, ui }) => {
    await manageProfiles(ui);
    await sleep(300);
    await shell.screenshot(path.join(root, 'editor.png'));
    await ui(`document.getElementById('closeProfiles').click()`);
    await sleep(300);
    const file = path.join(root, 'window.png');
    await shell.screenshot(file);
    const png = fs.readFileSync(file);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.ok(png.length > 10000, `${png.length} bytes`);
  });

  // The window is a grid of peer panels (dockview): a pane per profile and the terminal. A profile's page is a
  // native view laid over its pane's .content box, so after any change in the grid it must follow the box.
  const box = (ui, sel) => ui(`(() => { const e = document.querySelector(${JSON.stringify(sel)});
    if (!e || !e.isConnected || !e.offsetWidth) return null;
    const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }; })()`);
  const pageBox = (ui, id) => box(ui, `.pane[data-profile="${id}"] .content`);
  // The box is in CSS pixels of the window's page; the view is placed in window pixels (times the Kulisa zoom).
  const viewOn = async (shell, ui, id) => {
    const t = shell.profiles.get(id).get();
    const b = await pageBox(ui, id);
    const z = shell.win.webContents.getZoomFactor();
    const scaled = b && Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round(v * z)]));
    return !!b && t.view.getVisible() && JSON.stringify(t.view.getBounds()) === JSON.stringify(scaled);
  };
  const dock = (ui, js) => ui(`(() => { const api = window.__dock; ${js} })()`);
  test('grid: a pane moved next to the terminal takes its page along', async ({ shell, ui }) => {
    await dock(ui, `api.getPanel('profile:persist:sam-seller').api.moveTo({ group: api.getPanel('terminal').group, position: 'right' })`);
    await waitFor(() => viewOn(shell, ui, 'sam-admin'));
    await waitFor(() => viewOn(shell, ui, 'elon-buyer'));
    const sam = await pageBox(ui, 'sam-admin'), term = await box(ui, '#term');
    assert.ok(sam.x > term.x + term.width - 1 && sam.y + sam.height > term.y, 'Sam is right of the terminal');
  });
  test('grid: a pane stacked behind another as a tab hides its page until chosen', async ({ shell, ui }) => {
    const sam = shell.profiles.get('sam-admin'), elon = shell.profiles.get('elon-buyer');
    await dock(ui, `api.getPanel('profile:persist:sam-seller').api.moveTo({ group: api.getPanel('profile:persist:elon-buyer').group, position: 'center' })`);
    await waitFor(() => viewOn(shell, ui, 'sam-admin'));
    assert.equal(elon.get().view.getVisible(), false);
    await dock(ui, `api.getPanel('profile:persist:elon-buyer').api.setActive()`);
    await waitFor(() => viewOn(shell, ui, 'elon-buyer'));
    assert.equal(sam.get().view.getVisible(), false);
  });
  test('grid: while a pane is dragged, pages are pictures (drop targets are HTML), live again after the drop', async ({ shell, ui }) => {
    await dock(ui, `api.fromJSON(api.toJSON())`); // fresh, nothing stacked
    await ui(`window.__layoutPreset('columns')`);
    await waitFor(() => viewOn(shell, ui, 'sam-admin'));
    await ui(`document.querySelector('.ptab[data-panel="profile:persist:elon-buyer"]').dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: new DataTransfer() }))`);
    await waitFor(() => [...shell.profiles.values()].every((p) => !p.get().view.getVisible()));
    await waitFor(async () => (await ui(`document.querySelectorAll('.pane .content img.snapshot').length`)) === 2);
    await ui(`document.querySelector('.ptab[data-panel="profile:persist:elon-buyer"]').dispatchEvent(new DragEvent('dragend', { bubbles: true }))`);
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
    assert.equal(await ui(`document.querySelectorAll('.pane .content img.snapshot').length`), 0);
  });
  test('projects: another folder has its own profiles and agent; the first comes back as it was, its agent resumed', async (ctx) => {
    const { shell, ui } = ctx;
    const other = path.join(root, 'other');
    fs.mkdirSync(other, { recursive: true });
    const sam = shell.profiles.get('sam-admin');
    const firstPty = shell.pty;
    await ui(`kulisa.invoke('project:open', { folder: ${JSON.stringify(other)} })`);
    await waitFor(() => shell.project === other && shell.pty && shell.pty !== firstPty);
    await waitFor(async () => (await ctx.termText()).includes(`agent: rc of ${other}`)); // started by the shell, in the project
    assert.equal((await ctx.termText()).split('exec cat -v').length - 1, 1, 'the command that starts the agent shows once');
    assert.equal(shell.profiles.size, 0);
    assert.ok(sam.tabs.every((t) => t.wc.isDestroyed()), "the first project's tabs are closed");
    assert.equal(shell.win.getTitle(), 'other — Kulisa');
    assert.equal(shell.resumedSession, null, 'a new project has no conversation to resume');
    await waitFor(async () => (await ui(`document.getElementById('projectName').textContent`)) === 'other' && ui(`!!window.__dock.getPanel('terminal')`));
    assert.equal(await ui(`document.querySelectorAll('.pane').length`), 0);
    await ui(`kulisa.invoke('profile:new', { name: 'Sam · seller' })`); // the same name as in the first project
    assert.equal(shell.profiles.get('sam-seller').partition, 'persist:sam-seller-2', 'partitions are unique across projects');
    await ctx.call('browser_navigate', { profile: 'sam-seller', url: `${SITE}/app` });
    assert.equal(await who(ctx, 'sam-seller'), 'Signed out', "the first project's sign-ins stay there");

    // The project button: a menu of the projects (this one not choosable), Open Folder, and the dialog for the rest.
    await ui(`document.getElementById('openProjects').click()`);
    assert.deepEqual(await menuRows(ui), ['project', 'other', '-', 'Open Folder…', 'Manage Projects…']);
    const rows = await ui(`[...document.querySelectorAll('#menu .item')].slice(0, 2).map((b) => ({ dot: getComputedStyle(b.querySelector('.dot')).backgroundColor,
      folder: b.querySelector('small').textContent, check: b.querySelector('kbd').textContent }))`);
    assert.deepEqual(rows.map((r) => r.folder), [project, other], 'each with its folder');
    assert.equal(rows[1].check, '✓', 'the open one is marked');
    assert.equal(rows[0].dot, 'rgb(74, 123, 208)', "a dot in the project's color");
    const under = await ui(`(() => { const b = document.getElementById('openProjects').getBoundingClientRect(), m = document.getElementById('menu').getBoundingClientRect();
      return m.top >= b.bottom && m.top < b.bottom + 10 && Math.abs(m.left - b.left) < 2; })()`);
    assert.ok(under, 'under the button');
    await ui(`document.getElementById('openProjects').click()`); // again: closes it
    await waitFor(async () => !(await menuOpen(ui)));
    await ui(`document.getElementById('openProjects').click()`);
    await menuRows(ui);
    await choose(ui, 'Manage Projects…');
    await waitFor(() => ui(`document.getElementById('projects').open && !!document.querySelector('#projlist .projrow[data-project="project"] .open')`));
    assert.equal(await ui(`document.querySelector('#projlist .projrow[data-project="other"] .here').textContent`), 'open now');
    await ui(`document.getElementById('closeProjects').click()`);
    // While the window loads again, no page shows before it has its place in the grid (nothing jumps).
    const jumps = [];
    const watch = setInterval(() => {
      for (const p of shell.profiles.values()) {
        const v = p.get()?.view;
        if (v && !v.webContents.isDestroyed() && v.getVisible() && !v.getBounds().width) jumps.push(p.id);
      }
    }, 5);
    await ui(`document.getElementById('openProjects').click()`);
    await menuRows(ui);
    await choose(ui, 'project');
    await waitFor(() => shell.project === project && shell.profiles.has('elon-buyer') && shell.pty);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    clearInterval(watch);
    assert.deepEqual(jumps, [], 'pages shown before the grid placed them');
    assert.equal(await ui(`document.getElementById('projectName').textContent`), 'project');
    ctx.watchPty(shell.pty);
    await waitFor(async () => (await ctx.termText()).includes(`agent: rc of ${project}\n`));
    assert.deepEqual([...shell.profiles.keys()], ['sam-admin', 'elon-buyer']);
    assert.equal(shell.resumedSession, 'session-1', "the agent continues the project's conversation");
    assert.equal(await who(ctx, 'sam-admin'), 'Signed in as sam');
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(userData, 'projects.json'), 'utf8')).map((p) => p.folder), [project, other]);
  });
  test('projects: the data of Kulisa before projects becomes the first project (copied)', async () => {
    const { Store } = require('../src/main/store');
    const dir = path.join(root, 'old-data');
    fs.mkdirSync(path.join(dir, 'Partitions', 'ann'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'profiles.json'), JSON.stringify([{ id: 'ann', name: 'Ann' }]));
    fs.writeFileSync(path.join(dir, 'layout.json'), '{"grid":1}');
    const store = new Store(dir, { defaultFolder: '/work/shop' });
    assert.deepEqual(store.projects(), [{ id: 'shop', name: 'shop', folder: '/work/shop', color: '#4a7bd0' }]);
    assert.notEqual(store.projectFor('/work/blog').color, '#4a7bd0', 'each project its own color');
    store.openProject(store.projects()[0]);
    assert.deepEqual(store.profiles().map((p) => p.partition), ['persist:ann']);
    assert.deepEqual(store.layout(), { grid: 1 });
    assert.ok(fs.existsSync(path.join(dir, 'profiles.json')), 'the originals stay');
    assert.equal(store.freePartition('ann'), 'persist:ann-2');
    new Store(dir, { defaultFolder: '/elsewhere' }); // once only
    assert.equal(store.projects().length, 2);
  });
  test('grid presets: columns, grid, focus', async ({ shell, ui }) => {
    const at = async () => ({ sam: await pageBox(ui, 'sam-admin'), elon: await pageBox(ui, 'elon-buyer'), term: await box(ui, '#term') });
    await ui(`window.__layoutPreset('columns')`);
    await waitFor(() => viewOn(shell, ui, 'elon-buyer'));
    let b = await at();
    assert.ok(b.sam.x < b.elon.x && b.sam.y === b.elon.y && b.term.y > b.sam.y + b.sam.height - 1, 'profiles side by side, terminal below');
    await ui(`window.__layoutPreset('focus')`);
    await waitFor(() => viewOn(shell, ui, 'sam-admin'));
    b = await at();
    assert.equal(b.elon, null, 'Elon is a tab behind Sam');
    assert.ok(b.term.y > b.sam.y + b.sam.height - 1);
    // Left in this layout for the restart phase.
    await ui(`window.__layoutPreset('grid')`);
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
    b = await at();
    assert.ok(b.sam.x < b.elon.x && b.term.x > b.elon.x + b.elon.width - 1, 'profiles in a row of two, terminal on the right');
    await waitFor(() => fs.existsSync(pfile('layout.json')));
  });

  test('context menus: a pane\'s header, a tab, the terminal; pages are pictures while a menu is open; Arrange panels in ⋮', async ({ shell, ui }) => {
    const elon = shell.profiles.get('elon-buyer');
    const header = '.ptab[data-panel="profile:persist:elon-buyer"]';
    await rightClick(ui, header);
    assert.deepEqual(await menuRows(ui), ['New tab', 'Rename', 'Close profile', '-', 'Delete profile…']);
    const at = await ui(`(() => { const h = document.querySelector('${header}').getBoundingClientRect(), m = document.getElementById('menu').getBoundingClientRect();
      return Math.abs(m.left - (h.x + h.width / 2)) < 2 && Math.abs(m.top - (h.y + h.height / 2) - 4) < 2; })()`);
    assert.ok(at, 'at the pointer');
    // The pages are native views above the menu: pictures of them stand in meanwhile.
    assert.equal(elon.get().view.getVisible(), false);
    assert.ok(await ui(`!!document.querySelector('.pane[data-profile="elon-buyer"] .content img.snapshot')`));
    // Another menu right from this one: the pages stay pictures.
    await ui(`document.getElementById('windowMenu').click()`);
    await sleep(300);
    assert.equal(await menuOpen(ui), true);
    assert.equal(elon.get().view.getVisible(), false, 'a page over the second menu');
    await rightClick(ui, header);
    await sleep(300);
    assert.deepEqual(await menuRows(ui), ['New tab', 'Rename', 'Close profile', '-', 'Delete profile…']);
    assert.equal(elon.get().view.getVisible(), false, 'a page over the third menu');
    const n = elon.tabs.length;
    await choose(ui, 'New tab');
    await waitFor(() => elon.tabs.length === n + 1);
    await waitFor(() => elon.get().view.getVisible());
    assert.equal(await ui(`document.querySelectorAll('img.snapshot').length`), 0);
    await rightClick(ui, header);
    await menuRows(ui);
    await choose(ui, 'Rename');
    await waitFor(() => ui(`document.activeElement === document.querySelector('${header} input')`));
    await ui(`document.activeElement.blur()`); // nothing renamed

    await waitFor(() => ui(`document.querySelectorAll('.pane[data-profile="elon-buyer"] .tabs .tab').length === ${n + 1}`));
    await rightClick(ui, '.pane[data-profile="elon-buyer"] .tabs .tab');
    assert.deepEqual(await menuRows(ui), ['Reload', 'Duplicate', '-', 'Close tab', 'Close other tabs']);
    const first = elon.tabs[0];
    await choose(ui, 'Close other tabs');
    await waitFor(() => elon.tabs.length === 1 && elon.tabs[0] === first);

    await ui(`window.__term.clearSelection()`);
    await rightClick(ui, '#term .xterm-screen');
    assert.deepEqual(await menuRows(ui), ['Copy (off)', 'Paste', 'Select all', '-', 'Clear'], 'nothing selected to copy');
    await ui(`document.getElementById('menu').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))`);
    assert.equal(await ui(`document.activeElement.querySelector('.label')?.textContent`), 'Paste', 'arrows move over the enabled rows');
    await choose(ui, 'Select all');
    await waitFor(() => ui(`window.__term.hasSelection()`));
    await ui(`window.__term.clearSelection()`);

    await ui(`document.getElementById('windowMenu').click()`);
    assert.deepEqual((await menuRows(ui)).slice(2), ['# Arrange panels', 'Profiles in columns, terminal below', 'Profiles two by two, terminal right', 'One profile at a time, terminal below']);
    await choose(ui, 'One profile at a time, terminal below');
    await waitFor(async () => (await pageBox(ui, 'elon-buyer')) === null && viewOn(shell, ui, 'sam-admin'));
    await ui(`window.__layoutPreset('grid')`); // as the grid presets test left it, for the restart phase
  });
  const ctrl = (wc, keyCode) => {
    wc.focus();
    for (const type of ['keyDown', 'keyUp']) wc.sendInputEvent({ type, keyCode, modifiers: ['control'] });
  };
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  test('Kulisa zoom: Ctrl+= outside the pages scales the whole UI, pages follow, panes still fit; saved', async ({ shell, ui }) => {
    const win = shell.win.webContents;
    const sam = shell.profiles.get('sam-admin').get().wc;
    assert.equal(await ui(`document.getElementById('zoomReset').hidden`), true, 'at 100% the top bar shows no zoom');
    ctrl(win, '=');
    await waitFor(() => near(win.getZoomFactor(), 1.1));
    await waitFor(() => near(sam.getZoomFactor(), 1.1));
    await waitFor(() => viewOn(shell, ui, 'sam-admin'));
    assert.equal(await ui(`document.getElementById('zoomReset').textContent`), '110%');
    assert.equal(await ui(`document.getElementById('zoomReset').hidden`), false);
    await ui(`document.getElementById('windowMenu').click()`);
    assert.deepEqual((await menuRows(ui)).slice(0, 3), ['zoom', '-', '# Arrange panels']);
    assert.equal(await ui(`document.querySelector('#menu .zoomrow output').textContent`), '110%');
    await ui(`document.querySelector('#menu .zoomrow .in').click()`); // − 110% + in the menu, as in Chrome
    await waitFor(() => near(win.getZoomFactor(), 1.25));
    await waitFor(async () => (await ui(`document.querySelector('#menu .zoomrow output').textContent`)) === '125%');
    assert.equal(await menuOpen(ui), true, 'the menu stays open for more clicks');
    await ui(`document.getElementById('menu').hidePopover()`);
    await waitFor(() => viewOn(shell, ui, 'sam-admin'));
    await waitFor(async () => (await ui(`({ cols: window.__term.cols })`)).cols < 200, 3000); // the terminal refits
    await waitFor(() => JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8')).uiZoom === 1.25);
  });
  test('page zoom: Ctrl+= in a page zooms that site in that profile only, shows on the pane, is saved', async ({ shell, ui }) => {
    const sam = shell.profiles.get('sam-admin');
    const tab = sam.get();
    await tab.wc.loadURL(`${SITE}/app?zoom`);
    ctrl(tab.wc, '=');
    await waitFor(() => near(tab.wc.getZoomFactor(), 1.25 * 1.1));
    const other = sam.newTab(`${SITE}/app?zoom2`);
    await other.ready;
    await waitFor(() => near(other.wc.getZoomFactor(), 1.25 * 1.1), 3000); // the same site in the same profile
    other.wc.close();
    for (const t of shell.profiles.get('elon-buyer').tabs) assert.ok(near(t.wc.getZoomFactor(), 1.25), 'other profiles keep the Kulisa zoom');
    await waitFor(async () => (await ui(`document.querySelector('.pane[data-profile="sam-admin"] .zoom').textContent`)) === '110%');
    const saved = JSON.parse(fs.readFileSync(pfile('profiles.json'), 'utf8')).find((p) => p.id === 'sam-admin');
    assert.deepEqual(saved.zoom, { '127.0.0.1:4417': 1.1 });
    ctrl(tab.wc, '0');
    await waitFor(() => near(tab.wc.getZoomFactor(), 1.25));
    await waitFor(() => ui(`document.querySelector('.pane[data-profile="sam-admin"] .zoom').hidden`));
    ctrl(tab.wc, '='); // left zoomed for the restart phase
    await waitFor(() => near(tab.wc.getZoomFactor(), 1.25 * 1.1));
  });

  // Last in phase 1: it leaves Elon on sign-in pages (paused).
  test('tabs on sign-in pages are saved as where the sign-in started', async ({ shell }) => {
    const elon = shell.profiles.get('elon-buyer');
    const back = encodeURIComponent(`${SITE}/app?n=9`);
    const viaHistory = elon.newTab(`${SITE}/app?n=5`);
    await viaHistory.ready;
    await viaHistory.wc.loadURL('http://localhost:4417/app?login=1'); // localhost is a sign-in host in this test
    await elon.newTab(`http://localhost:4417/headers?redirect_uri=${back}`).ready; // opened directly on sign-in
    await elon.newTab('http://localhost:4417/headers').ready; // nothing to come back to
    await sleep(300);
    const saved = JSON.parse(fs.readFileSync(pfile('tabs.json'), 'utf8'))['elon-buyer'];
    assert.deepEqual(saved, [`${SITE}/errors`, `${SITE}/app?n=5`, `${SITE}/`]);
  });
  test('close a profile (its × or the agent) and open it again (the editor or the agent): signed in, same tabs; the agent deletes only what the human confirms', async (ctx) => {
    const { shell, ui, call } = ctx;
    const header = '.ptab[data-panel="profile:persist:cleo"]';
    const saved = (f) => JSON.parse(fs.readFileSync(pfile(f), 'utf8'));
    await call('profile_create', { name: 'Cleo' });
    await call('browser_navigate', { profile: 'cleo', url: `${SITE}/app/login?name=cleo` }); // a session cookie
    await call('browser_tab_new', { profile: 'cleo', url: `${SITE}/app?second` });
    const tabs = shell.profiles.get('cleo').tabs.map((t) => t.wc);
    await waitFor(() => ui(`!!document.querySelector('${header} .close')`));

    await ui(`document.querySelector('${header} .close').click()`);
    await waitFor(() => !shell.profiles.has('cleo') && tabs.every((wc) => wc.isDestroyed()));
    await waitFor(() => ui(`!document.querySelector('${header}')`));
    assert.equal(saved('profiles.json').find((p) => p.id === 'cleo').closed, true);
    await waitFor(() => saved('tabs.json').cleo?.length === 2);
    const listed = JSON.parse((await call('browser_profiles', {})).text).find((p) => p.id === 'cleo');
    assert.deepEqual(listed, { id: 'cleo', name: 'Cleo', closed: true, tabs: 2 });
    await assert.rejects(call('browser_snapshot', { profile: 'cleo' }), /closed.*profile_open/);

    // Open again in the editor.
    await manageProfiles(ui);
    const row = `[...document.querySelectorAll('#plist .prow')].find((r) => r.querySelector('.pid').textContent === 'cleo')`;
    await waitFor(() => ui(`!!${row}`));
    assert.equal(await ui(`${row}.querySelector('.ntabs').textContent`), 'closed · 2 tabs');
    await ui(`${row}.querySelector('.open').click()`);
    await waitFor(() => shell.profiles.has('cleo'));
    await waitFor(() => ui(`${row}.querySelector('.open').hidden`));
    await ui(`document.getElementById('closeProfiles').click()`);
    assert.deepEqual(shell.profiles.get('cleo').tabs.map((t) => t.url), [`${SITE}/app`, `${SITE}/app?second`]);
    assert.equal(await who(ctx, 'cleo'), 'Signed in as cleo');
    await waitFor(() => ui(`!!document.querySelector('${header}')`));

    // The agent closes it; Profiles ▾ lists it as closed and opens it.
    await call('profile_close', { profile: 'cleo' });
    assert.ok(!shell.profiles.has('cleo') && shell.closed.has('cleo'));
    await ui(`document.getElementById('openProfiles').click()`);
    assert.deepEqual(await menuRows(ui), ['Sam · admin', 'Elon · buyer', 'Cleo', '-', 'Manage Profiles…']);
    assert.deepEqual(await ui(`[...document.querySelectorAll('#menu .item small')].map((e) => e.textContent).slice(2, 3)`), ['closed · click to open']);
    await choose(ui, 'Cleo');
    await waitFor(() => shell.profiles.has('cleo'));
    // And the agent closes and opens it.
    await call('profile_close', { profile: 'cleo' });
    await call('profile_open', { profile: 'cleo' });
    assert.equal(await who(ctx, 'cleo'), 'Signed in as cleo');

    // The agent deletes: the human is asked; no keeps it, yes deletes it (closed ones too).
    ctx.answer = false;
    await assert.rejects(call('profile_delete', { profile: 'cleo' }), /said no/);
    assert.equal(ctx.asked.pop().message, 'The agent asks to delete the profile Cleo.');
    assert.ok(shell.profiles.has('cleo'));
    await call('profile_close', { profile: 'cleo' });
    ctx.answer = true;
    await call('profile_delete', { profile: 'cleo' });
    ctx.asked.length = 0;
    assert.ok(!shell.profiles.has('cleo') && !shell.closed.has('cleo'));
    assert.ok(!saved('profiles.json').some((p) => p.id === 'cleo'));
    assert.ok(JSON.parse(fs.readFileSync(path.join(userData, 'deleted-partitions.json'), 'utf8')).includes('persist:cleo'));

    // Left closed for the restart phase.
    await call('profile_create', { name: 'Dora' });
    await call('browser_navigate', { profile: 'dora', url: `${SITE}/app/login?name=dora` });
    await call('profile_close', { profile: 'dora' });
  });
} else {
  test('after a restart: profiles, sign-ins and tabs are back', async (ctx) => {
    assert.deepEqual([...ctx.shell.profiles.keys()], ['sam-admin', 'elon-buyer']);
    for (const dir of ['temp', 'temp-2']) assert.ok(!fs.existsSync(path.join(userData, 'Partitions', dir)), `Partitions/${dir} removed`);
    assert.ok(fs.existsSync(path.join(userData, 'Partitions', 'sam-seller')), 'live profiles keep their folders');
    assert.ok(!fs.existsSync(path.join(userData, 'deleted-partitions.json')));
    assert.equal(await who(ctx, 'sam-admin'), 'Signed in as sam');
    const elon = ctx.shell.profiles.get('elon-buyer');
    assert.deepEqual(elon.tabs.map((t) => t.wc.getURL()), [`${SITE}/errors`, `${SITE}/app?n=5`, `${SITE}/`]);
    assert.equal(elon.signinMode, false);
  });
  test('after a restart: a closed profile is still closed, and opens signed in', async (ctx) => {
    assert.ok(ctx.shell.closed.has('dora') && !ctx.shell.profiles.has('dora'));
    await ctx.call('profile_open', { profile: 'dora' });
    assert.equal(await who(ctx, 'dora'), 'Signed in as dora');
    await ctx.call('profile_delete', { profile: 'dora' });
  });
  test("a packaged build (appDevTools off): no DevTools for Kulisa's own UI, a tab's still open", async ({ shell }) => {
    const press = (wc) => { wc.focus(); wc.sendInputEvent({ type: 'keyDown', keyCode: 'F12' }); wc.sendInputEvent({ type: 'keyUp', keyCode: 'F12' }); };
    press(shell.win.webContents);
    shell.win.webContents.openDevTools({ mode: 'detach' });
    await sleep(500);
    assert.equal(shell.win.webContents.isDevToolsOpened(), false);
    const tab = shell.profiles.get('sam-admin').get().wc;
    press(tab);
    await waitFor(() => tab.isDevToolsOpened());
    tab.closeDevTools();
  });
  test('after a restart: the Kulisa zoom and a site\'s page zoom are as they were left', async ({ shell }) => {
    const near = (a, b) => Math.abs(a - b) < 1e-6;
    await waitFor(() => near(shell.win.webContents.getZoomFactor(), 1.25));
    const tab = shell.profiles.get('sam-admin').newTab(`${SITE}/app?after-restart`);
    await tab.ready;
    await waitFor(() => near(tab.wc.getZoomFactor(), 1.25 * 1.1), 3000);
    tab.wc.close();
  });
  test('after a restart: the grid is as it was left (preset "grid")', async ({ ui }) => {
    const box = (sel) => ui(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.x, width: r.width }; })()`);
    await waitFor(async () => (await ui(`document.querySelectorAll('.pane').length`)) === 2);
    const sam = await box('.pane[data-profile="sam-admin"] .content'), elon = await box('.pane[data-profile="elon-buyer"] .content');
    const term = await box('#term');
    assert.ok(sam.x < elon.x && term.x > elon.x + elon.width - 1);
  });
}
