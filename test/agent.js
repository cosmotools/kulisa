// Profiles and the agent: the editor, the MCP server and the plugin, tabs, isolation, the Chrome identity, the
// sign-in pause, the agent's cursor, point and tell, @playwright/mcp.
const fs = require('fs');
const path = require('path');
const { assert, root, userData, project, pfile, savedTabs, panel, SITE, sleep, waitFor, who, menuRows, choose, manageProfiles, menuOpen, rightClick,
  box, pageBox, viewOn, dock, ctrl, near } = require('./helpers');
const { app } = require('electron');
const { CLAUDE_PLUGIN } = require('../src/main/app');

module.exports = (test) => {
  test('create profiles in the profile editor, each with its own picture and, if the human says, who it is; views are hidden while it is open', async ({ shell, ui }) => {
    await manageProfiles(ui);
    assert.match(await ui(`document.querySelector('#padd .hint').textContent`), /agent reads this .* You can skip it/s);
    // The new profile's picture: the next free one, unless the human picks another (Elon: the penguin).
    const shownNew = () => ui(`(() => { const b = document.querySelectorAll('#padd .pics [aria-pressed="true"]');
      return b.length === 1 ? b[0].dataset.avatar : [...b].length; })()`);
    assert.equal(await ui(`document.querySelectorAll('#padd .pics button').length`), 16, 'all of them to choose from, at once');
    for (const [name, about, shown] of [['Sam.seller', ' seller in the test shop ', 'fox'], ['Elon.buyer', '', 'frog']]) {
      await waitFor(async () => (await shownNew()) === shown);
      if (name.startsWith('Elon')) {
        await ui(`document.querySelector('#padd .pics [data-avatar="penguin"]').click()`);
        assert.equal(await shownNew(), 'penguin');
      }
      // Enter in the description adds the profile too (Shift+Enter: a new line).
      await ui(`document.getElementById('newProfile').value = ${JSON.stringify(name)}; document.getElementById('newAbout').value = ${JSON.stringify(about)};
        ${name.startsWith('Sam') ? `document.getElementById('padd').requestSubmit()`
    : `document.getElementById('newAbout').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`}`);
      await waitFor(() => shell.profiles.size === (name.startsWith('Sam') ? 1 : 2));
    }
    assert.deepEqual([...shell.profiles.keys()], ['sam-seller', 'elon-buyer']);
    assert.equal(await ui(`document.getElementById('newAbout').value`), '', 'the fields are emptied for the next one');
    const read = () => { try { return JSON.parse(fs.readFileSync(pfile('profiles.json'), 'utf8')); } catch { return []; } };
    await waitFor(() => read().length === 2); // written once the profile's tabs are open
    const saved = read();
    assert.deepEqual(saved.map(({ id, avatar, description, color }) => ({ id, avatar, description, color })),
      [{ id: 'sam-seller', avatar: 'fox', description: 'seller in the test shop', color: undefined },
        { id: 'elon-buyer', avatar: 'penguin', description: undefined, color: undefined }], 'pictures, not colors; who it is when said');
    await waitFor(async () => (await shownNew()) === 'frog'); // the next one's, the pick forgotten
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
      const s = new WebSocket(`ws://127.0.0.1:${proxy.port}/project/1/sam-seller`, origin ? { origin } : {});
      s.on('open', () => { s.close(); resolve('open'); }); s.on('error', () => resolve('refused'));
    });
    assert.equal(await ws('https://evil.example'), 'refused');
    assert.equal(await ws(), 'open'); // Playwright and other local tools send no Origin
    assert.equal(await status(`${shell.ws.env().KULISA_URL}/hooks/session-start`, {}), 200);
    assert.equal(await status(`${shell.mcp.base}/ws/project/9/hooks/session-start`, {}), 404, 'no such workspace');
  });
  test('agent bridge: the Claude Code plugin is valid and points at this MCP server', async ({ shell }) => {
    assert.ok(fs.existsSync(path.join(CLAUDE_PLUGIN, '.claude-plugin', 'plugin.json')));
    assert.ok(fs.existsSync(path.join(CLAUDE_PLUGIN, 'skills', 'profiles', 'SKILL.md')));
    const mcp = JSON.parse(fs.readFileSync(path.join(CLAUDE_PLUGIN, '.mcp.json'), 'utf8'));
    assert.equal(mcp.mcpServers.kulisa.url, '${KULISA_MCP_URL}');
    assert.equal(shell.ws.env().KULISA_MCP_URL, `${shell.mcp.base}/ws/project/1/mcp`);
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
  test('the window and the agent act on one core: an address read the same way, the same refusals', async ({ shell, call, ui }) => {
    const sam = shell.profiles.get('sam-seller');
    const host = SITE.replace('http://', ''); // 127.0.0.1:4417, a host and a port (not a scheme)
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
    // An action of the window names its workspace: one sent for a workspace no longer shown (the human just switched)
    // is refused, not done in the one shown now.
    const tabs = sam.tabs.length;
    assert.match((await ui(`kulisa.invoke('tab:new', { ws: 'project/2', profile: 'sam-seller' })`)).error, /not on screen/);
    assert.match((await ui(`kulisa.invoke('tab:new', { profile: 'sam-seller' })`)).error, /not on screen/);
    assert.equal(sam.tabs.length, tabs);
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
    assert.match(context, /- sam-seller \("Sam.seller"\): seller in the test shop/);
    assert.match(context, /- elon-buyer \("Elon.buyer"\): who it is is not said/);
    assert.match(context, /tab k\d+ \(active\)/);
    const outside = await run({});
    assert.deepEqual(outside, { code: 0, out: '' }, 'outside Kulisa the hook does nothing');
  });
  test('agent: highlight elements for the human (also on Trusted Types pages), then clear', async ({ shell, call }) => {
    const sam = shell.profiles.get('sam-seller');
    // Pixels of the agent's marks' color in the tab's own rendering: the outline and label are really drawn.
    const { MARK } = require('../src/main/ghost');
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
      assert.equal(highlights.has('project/1/sam-seller'), true);
      const wc = sam.get().wc; wc.focus();
      for (const e of input) wc.sendInputEvent(e);
      await waitFor(() => !highlights.has('project/1/sam-seller'));
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
    const r = await call('profile_create', { name: 'Ann.admin', description: 'the shop\'s admin' });
    assert.match(r.text, /Created profile ann-admin/);
    assert.ok(shell.profiles.has('ann-admin'));
    const list = JSON.parse((await call('browser_profiles', {})).text);
    assert.deepEqual(list.map((p) => p.id), ['sam-seller', 'elon-buyer', 'ann-admin']);
    assert.deepEqual(list.map((p) => [p.avatar, p.description]), [['fox', 'seller in the test shop'], ['penguin', null], ['frog', 'the shop\'s admin']]);
    await waitFor(async () => (await ui(`document.querySelectorAll('.pane').length`)) === 3);
    await ui(`act('profile:delete', { profile: 'ann-admin' })`);
  });
  test('who a profile is: the agent is told to choose by it and to ask; it saves the human\'s answer, the editor shows it', async ({ shell, call, ui }) => {
    const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
    const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
    const c = new Client({ name: 'kulisa-test', version: '0' });
    await c.connect(new StreamableHTTPClientTransport(new URL(shell.ws.env().KULISA_MCP_URL)));
    assert.match(c.getInstructions(), /by its description .* ask the human once .* profile_describe/s, 'every agent, also without the skill');
    await c.close();
    const elon = shell.profiles.get('elon-buyer');
    assert.match((await call('profile_describe', { profile: 'elon-buyer', description: 'buyer; pays by card' })).text, /Saved/);
    assert.equal(elon.description, 'buyer; pays by card');
    await assert.rejects(call('profile_describe', { profile: 'elon-buyer', description: 'x'.repeat(501) }), /at most 500/);
    // The editor shows it and the human changes it there; the pane's name tells it on hover, the profiles' chip's menu under the name.
    const header = `[...document.querySelectorAll('.ptab')].find((t) => t.querySelector('.pname')?.textContent === 'Elon.buyer')`;
    await waitFor(async () => (await ui(`${header}.querySelector('.pname').title`)).startsWith('buyer; pays by card'));
    await waitFor(() => ui(`(() => { const i = ${header}.querySelector('.avatar'); return i.complete && i.naturalWidth > 0; })()`)); // the picture is drawn
    await ui(`document.getElementById('openProfiles').click()`);
    assert.deepEqual(await ui(`[...document.querySelectorAll('#menu .item')].slice(0, 2).map((b) => [b.querySelector('small').textContent,
      b.querySelector('.avatar').getAttribute('src')])`),
    [['seller in the test shop', 'avatars/fox.svg'], ['buyer; pays by card', 'avatars/penguin.svg']]);
    await ui(`document.getElementById('openProfiles').click()`);
    await manageProfiles(ui);
    const row = `[...document.querySelectorAll('#plist .prow')].find((r) => r.querySelector('.pid').textContent === 'elon-buyer')`;
    await waitFor(async () => (await ui(`${row}.querySelector('.about').value`)) === 'buyer; pays by card');
    assert.deepEqual(await ui(`[${row}.querySelector('.about').localName, ${row}.querySelector('.about').rows, getComputedStyle(${row}.querySelector('.about')).resize]`),
      ['textarea', 2, 'vertical'], 'two lines, made taller by hand');
    await ui(`(() => { const a = ${row}.querySelector('.about'); a.value = ''; a.dispatchEvent(new Event('change')); })()`);
    await waitFor(() => elon.description === '');
    // The picture: a click on it shows the others; one chosen, they go.
    await ui(`${row}.querySelector('.pic').click()`);
    assert.equal(await ui(`${row}.querySelectorAll('.pics button').length`), 16);
    await ui(`${row}.querySelector('.pics [data-avatar="owl"]').click()`);
    await waitFor(() => elon.avatar === 'owl');
    assert.equal(await ui(`${row}.querySelector('.pics').hidden`), true);
    await waitFor(async () => (await ui(`${row}.querySelector('.pic .avatar').getAttribute('src')`)) === 'avatars/owl.svg');
    assert.match((await ui(`act('profile:avatar', { profile: 'elon-buyer', avatar: 'dragon' })`)).error, /no picture/);
    await ui(`document.getElementById('closeProfiles').click()`);
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

  test('agent: keys, hover, select, files, waiting, evaluate, back and forward; dialogs answered as asked, the human\'s left', async ({ shell, call }) => {
    const p = { profile: 'sam-seller' };
    const out = async () => JSON.parse((await call('browser_evaluate', { ...p, function: '() => out.textContent' })).text);
    await call('browser_navigate', { ...p, url: `${SITE}/form` });
    const del = { ...p, locator: "getByRole('button', { name: 'Delete' })" };
    // Answered in the page: no dialog opens (Electron's box would stay on screen after an answer over CDP).
    const page = await shell.profiles.get('sam-seller').page();
    let opened = 0; const count = () => opened++;
    page.on('dialog', count);
    assert.match((await call('browser_click', del)).text, /asked: confirm "Delete the draft\?"; dismissed/);
    assert.equal(await out(), 'kept');
    assert.match((await call('browser_click', { ...del, dialog: 'accept' })).text, /accepted/);
    assert.equal(await out(), 'deleted');
    page.off('dialog', count);
    assert.equal(opened, 0);
    assert.equal(JSON.parse((await call('browser_evaluate', { ...p, function: "() => String(confirm).includes('native code')" })).text), true, 'the page\'s own confirm is back');
    // A dialog the agent did not open is the human's: Playwright does not dismiss it (Profile.connect).
    await call('browser_evaluate', { ...p, function: "() => { setTimeout(() => out.textContent = String(confirm('Yours?'))); }" });
    await sleep(500);
    // Still open (handling no dialog would throw); the human clicks OK.
    await shell.profiles.get('sam-seller').get().wc.debugger.sendCommand('Page.handleJavaScriptDialog', { accept: true });
    assert.equal(await out(), 'true');
    await call('browser_select_option', { ...p, locator: "getByLabel('Size')", values: ['L'] });
    assert.equal(await out(), 'size L');
    assert.equal(JSON.parse((await call('browser_evaluate', { ...p, locator: "getByLabel('Size')", function: '(el) => el.value' })).text), 'L');
    await call('browser_file_upload', { ...p, locator: "getByLabel('Attachment')", paths: [path.join(__dirname, '..', 'package.json')] });
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
    elon.get().wc.loadURL(back); // the human signs in and lands elsewhere
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
    await elon.get(elon.active).ready; await sleep(500);
    assert.ok(['window', 'another app'].includes(keys()), `the window has the focus, not the page: ${keys()}`);
    // A click into the page gives it the keys, and they stay there.
    page.sendInputEvent({ type: 'mouseDown', x: 20, y: 20, button: 'left', clickCount: 1 }); page.sendInputEvent({ type: 'mouseUp', x: 20, y: 20, button: 'left', clickCount: 1 });
    page.focus();
    await sleep(300);
    assert.ok(['page', 'another app'].includes(keys()), `the page keeps the focus once clicked: ${keys()}`);
    await ui(`document.activeElement.blur()`);
    await waitFor(async () => (await ui(`${strip}.querySelectorAll('.tab').length`)) === n + 1);
    await ui(`${strip}.querySelector('.tab[data-tab="${first}"] .title').click()`);
    await waitFor(() => elon.active === first);
    await ui(`${strip}.querySelector('.tab:last-of-type .x').click()`);
    await waitFor(() => elon.tabs.length === n);
  });
  test('many tabs: they shrink as in Chrome; the strip, the toolbar and the page stay inside the pane', async ({ shell, ui }) => {
    const elon = shell.profiles.get('elon-buyer'), n = elon.tabs.length;
    const pane = '.pane[data-profile="elon-buyer"]';
    const before = await pageBox(ui, 'elon-buyer');
    // A lone tab has its full width (220px, as Chrome's), not shrunk while there is room.
    assert.equal(await ui(`Math.round(document.querySelector('.pane[data-profile="sam-seller"] .tabs .tab').getBoundingClientRect().width)`), 220);
    for (let i = 0; i < 24; i++) await ui(`act('tab:new', { profile: 'elon-buyer' })`);
    await waitFor(async () => (await ui(`document.querySelectorAll('${pane} .tabs .tab').length`)) === n + 24);
    await sleep(300);
    const fit = await ui(`(() => { const p = document.querySelector('${pane}'), r = (q) => p.querySelector(q).getBoundingClientRect(), pr = p.getBoundingClientRect();
      return { pane: p.scrollWidth <= p.clientWidth, tabs: r('.tabs').right <= pr.right, add: r('.tabs .add').right <= pr.right, more: r('.more').right <= pr.right,
        group: p.closest('.dv-groupview').scrollWidth <= p.closest('.dv-groupview').clientWidth }; })()`);
    assert.deepEqual(fit, { pane: true, tabs: true, add: true, more: true, group: true });
    // The active one (the last opened) in sight, with its ×; the others their icon alone.
    const strip = await ui(`(() => { const s = document.querySelector('${pane} .tabs'), r = s.getBoundingClientRect(), a = s.querySelector('.tab.active').getBoundingClientRect();
      const other = s.querySelector('.tab:not(.active)'), shown = (e) => getComputedStyle(e).display !== 'none';
      return { activeInSight: a.left >= r.left && a.right <= s.querySelector('.add').getBoundingClientRect().left,
        nothingUnderAdd: s.querySelector('.strip').getBoundingClientRect().right <= s.querySelector('.add').getBoundingClientRect().left,
        activeX: shown(s.querySelector('.tab.active .x')), otherIcon: shown(other.querySelector('.globe')) || shown(other.querySelector('img')), otherTitle: shown(other.querySelector('.title')) }; })()`);
    // + and a tab's × are the same icon size.
    assert.deepEqual(await ui(`['.tab.active .x svg', '.add svg'].map((q) => document.querySelector('${pane} .tabs ' + q).getBoundingClientRect().width)`), [14, 14]);
    assert.deepEqual(strip, { activeInSight: true, nothingUnderAdd: true, activeX: true, otherIcon: true, otherTitle: false });
    assert.deepEqual(await pageBox(ui, 'elon-buyer'), before, 'the page keeps its place and size');
    for (const t of elon.tabs.slice(n)) elon.closeTab(t.id);
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
  test('the address as in Chrome: shown without http(s)://, a click shows all of it selected; a second click places the caret', async ({ shell, ui }) => {
    const addr = '.pane[data-profile="sam-seller"] .addr';
    const z = shell.win.webContents.getZoomFactor(), b = await box(ui, addr);
    shell.win.webContents.focus(); // the last test left the focus in a page
    const click = () => {
      const x = Math.round((b.x + b.width / 3) * z), y = Math.round((b.y + b.height / 2) * z);
      for (const type of ['mouseDown', 'mouseUp']) shell.win.webContents.sendInputEvent({ type, x, y, button: 'left', clickCount: 1 });
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
      await waitFor(async () => (await ui(`${button}.classList.contains('active')`)) && shell.windows[0].picking.has('elon-buyer'));
      await sleep(300);
      if (cancel === 'button') await ui(`${button}.click()`);
      else {
        const wc = elon.get().wc;
        wc.focus();
        wc.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); wc.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
      }
      await waitFor(async () => !(await ui(`${button}.classList.contains('active')`)) && !shell.windows[0].picking.has('elon-buyer'));
      assert.equal(await ui(`document.querySelector('.ptab[data-panel="profile:Profile 2"] .caption').textContent`), '', cancel);
    }
    await sleep(300);
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
