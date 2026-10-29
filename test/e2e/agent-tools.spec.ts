// The agent's browser tools on the profiles' pages (src/main/kulisa-plugin/tools/, docs/profiles.md, The agent's
// tools): tabs, highlights, acting by ref and locator (the ghost showing where), screenshots, typing, dialogs,
// waiting, several profiles at once.
import fs from 'fs';
import path from 'path';
import { test, expect } from './fixtures.ts';
import type { Core } from './fixtures.ts';
import { SITE, PORT, CHECKOUT, act } from './helpers.ts';
import { MARK } from '../../src/main/kulisa-plugin/ghost.ts';
import { profiles, signIn, opened } from './agent-helpers.ts';


// A picture the agent got, as Electron reads it: its size, and the color of one pixel ([b, g, r, a]).
const image = (core: Core, data: string, at?: { x: number; y: number }) => core((k, a) => {
  const { nativeImage } = k.electron;
  const i = nativeImage.createFromBuffer(Buffer.from(a.data, 'base64'));
  return { size: i.getSize(), px: a.at && [...i.crop({ ...a.at, width: 1, height: 1 }).toBitmap()] as number[] };
}, { data, at });

test('agent: open, switch and close tabs', async ({ core, call }) => {
  await profiles(core);
  const elon = () => core((k) => { const e = k.profile('Elon.buyer'); return { active: e.active, tabs: e.tabs.length }; });
  const first = (await elon()).active;
  const id = opened(await call('browser_tab_new', { profile: 'Elon.buyer', url: `${SITE}/app` }));
  expect(await elon()).toEqual({ active: id, tabs: 2 });
  expect((await call('browser_snapshot', { profile: 'Elon.buyer' })).text).toMatch(/Signed/);
  await call('browser_tab_select', { profile: 'Elon.buyer', tab: first });
  expect((await elon()).active).toBe(first);
  await call('browser_tab_close', { profile: 'Elon.buyer', tab: id });
  await expect.poll(async () => (await elon()).tabs).toBe(1);
});

test('agent: highlight elements for the human (also on Trusted Types pages), then clear', async ({ core, call }) => {
  await profiles(core);
  // Pixels of the agent's marks' color in the tab's own rendering: the outline and label are really drawn.
  const colored = () => core(async (k, mark) => {
    const px = (await k.profile('Sam.seller').get().wc.capturePage()).toBitmap(); // BGRA
    const [r, g, b] = mark.match(/\w\w/g).map((h) => parseInt(h, 16));
    let n = 0; for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i + 2] - r) < 8 && Math.abs(px[i + 1] - g) < 8 && Math.abs(px[i] - b) < 8) n++;
    return n;
  }, MARK);
  for (const url of [`${SITE}/app`, `${SITE}/strict`]) {
    await call('browser_navigate', { profile: 'Sam.seller', url });
    const r = await call('browser_highlight', { profile: 'Sam.seller', elements: [
      { locator: "getByRole('button', { name: 'Sign in' })", label: 'Sign in is here' },
      { locator: 'locator("a").first()' }] });
    expect(r.text).toMatch(/Highlighted 2 element/);
    await expect.poll(colored, { message: `${url}: outline and label visible` }).toBeGreaterThan(300);
    if (url.endsWith('/app')) {
      const file = test.info().outputPath('highlight.png');
      await core((k, f) => k.shot(f), file);
      await test.info().attach('highlight', { path: file, contentType: 'image/png' });
    }
    await call('browser_highlight', { profile: 'Sam.seller', elements: [] });
    await expect.poll(colored, { message: `${url}: cleared` }).toBeLessThan(50);
  }
});

test('highlights go away when the human clicks or types in the page', async ({ core, call, files }) => {
  const { sam } = await profiles(core);
  const key = `${files.tkey('project', 1)}/${sam}`;
  const highlighted = () => core((k, a) => k.browserTools.highlights.has(a), key);
  await call('browser_navigate', { profile: 'Sam.seller', url: `${SITE}/app` });
  for (const input of [[{ type: 'mouseDown', x: 300, y: 300, button: 'left', clickCount: 1 }, { type: 'mouseUp', x: 300, y: 300, button: 'left', clickCount: 1 }],
    [{ type: 'keyDown', keyCode: 'Shift' }, { type: 'keyUp', keyCode: 'Shift' }]] as (Electron.MouseInputEvent | Electron.KeyboardInputEvent)[][]) {
    await call('browser_highlight', { profile: 'Sam.seller', elements: [{ locator: "getByRole('button', { name: 'Sign in' })", label: 'here' }] });
    expect(await highlighted()).toBe(true);
    await core((k, events) => { const wc = k.profile('Sam.seller').get().wc; wc.focus(); for (const e of events) wc.sendInputEvent(e); }, input);
    await expect.poll(highlighted).toBe(false);
  }
});

// 1 s each: how long a tool looks for an element before it says there is none (by design).
test('agent: an element that is not there fails fast, with what to do instead', async ({ core, call }) => {
  await profiles(core);
  await call('browser_navigate', { profile: 'Sam.seller', url: `${SITE}/app` });
  for (const [tool, args] of [['browser_highlight', { elements: [{ locator: "getByRole('button', { name: 'New chat' })" }] }],
    ['browser_click', { locator: "getByRole('button', { name: 'New chat' })" }], ['browser_type', { locator: "getByRole('textbox', { name: 'Nope' })", text: 'x' }]] as [string, object][]) {
    const t0 = Date.now();
    await expect(call(tool, { profile: 'Sam.seller', ...args })).rejects.toThrow(/No element matches .* browser_snapshot/);
    expect(Date.now() - t0, `${tool} took ${Date.now() - t0} ms`).toBeLessThan(2500);
  }
});

test('agent: a bare CSS selector explains how to pass the full Pick expression', async ({ core, call }) => {
  await profiles(core);
  await call('browser_navigate', { profile: 'Sam.seller', url: `${SITE}/app` });
  for (const tool of ['browser_snapshot', 'browser_screenshot']) {
    await expect(call(tool, { profile: 'Sam.seller', locator: 'button' }))
      .rejects.toThrow("locator('button')");
    const result = await call(tool, { profile: 'Sam.seller', locator: "locator('button').first()" });
    if (tool === 'browser_snapshot') expect(result.text).toContain('Sign in');
    else expect(result.content.some((c) => c.type === 'image')).toBe(true);
  }
});

// Each action of the agent waits while it is shown in the page (0.5 s, ghost.ts): the agent's tests take seconds.
test('agent: navigate, snapshot, type by ref, click by locator; the click shown where it went', async ({ core, call }) => {
  await profiles(core);
  await call('browser_navigate', { profile: 'Sam.seller', url: `${SITE}/app` });
  const snap = await call('browser_snapshot', { profile: 'Sam.seller' });
  const ref = snap.text.match(/textbox "Name"[^\n]*\[ref=(\w+)\]/)[1];
  await call('browser_type', { profile: 'Sam.seller', ref, text: 'sam', submit: true });
  await call('browser_wait_for', { profile: 'Sam.seller', text: 'Signed in as sam' });
  await core((k) => { const g = k.stash; g.actions = []; g.watch = (a: unknown) => g.actions.push(a); k.shell.bus.on('agent-action', g.watch); });
  try {
    await call('browser_click', { profile: 'Sam.seller', locator: "getByRole('button', { name: 'Checkout' })" });
  } finally {
    const actions = await core((k) => { const g = k.stash; k.shell.bus.off('agent-action', g.watch); return g.actions as { caption: string; x?: number; y?: number }[]; });
    const click = actions.find((a) => a.caption === 'click');
    expect(click && click.x > 0 && click.y > 0, JSON.stringify(actions)).toBe(true);
  }
});

// The agent's marks (its pointer, browser_highlight's outline) are Kulisa's, not the site's: not in the picture.
test('agent: screenshots of an element, the visible part and the whole page, at CSS pixels, without the agent\'s marks, each also a file of the task\'s; several profiles in one call', async ({ core, call }) => {
  await profiles(core);
  await call('browser_navigate', { profile: 'Sam.seller', url: `${SITE}/tall` });
  const box = { profile: 'Sam.seller', locator: "locator('#box')" };
  const first = await call('browser_screenshot', box);
  const file = first.text.match(/^Saved as (.+\.jpg)$/)[1];
  expect(path.dirname(file), "the task's, never the project's").toBe(await core((k) => k.shell.task.store.artifacts));
  expect(fs.readFileSync(file).toString('base64'), 'the picture the agent got').toBe(first.content[1].data);
  const el = await image(core, first.content[1].data, { x: 100, y: 60 });
  expect(el.size, 'the element alone, at its CSS size').toEqual({ width: 200, height: 120 });
  const [b, g, r] = el.px;
  expect(r > 180 && g < 60 && b < 60, `the element's own color (${[r, g, b]})`).toBe(true);
  const visible = (await call('browser_screenshot', { profile: 'Sam.seller' })).content[1];
  const inner = JSON.parse((await call('browser_evaluate', { profile: 'Sam.seller', function: '() => [innerWidth, innerHeight]' })).text);
  expect(Object.values((await image(core, visible.data)).size), 'the visible part, at CSS pixels').toEqual(inner);
  await call('browser_highlight', { profile: 'Sam.seller', elements: [{ locator: "locator('#box')" }] });
  expect((await call('browser_screenshot', { profile: 'Sam.seller' })).content[1].data, 'the outline is not in the picture').toBe(visible.data);
  await call('browser_highlight', { profile: 'Sam.seller', elements: [] });
  const full = await image(core, (await call('browser_screenshot', { profile: 'Sam.seller', fullPage: true })).content[1].data);
  expect(full.size.height, 'the whole page, down to its end').toBeGreaterThan(3000);
  await call('browser_navigate', { profile: 'Elon.buyer', url: `${SITE}/tall` });
  const both = (await call('browser_screenshot', { ...box, also: ['Elon.buyer'] })).content.slice(0, 4); // then an unnamed task's note
  expect(both.map((c) => c.text?.replace(/Saved as .*-screenshot\.jpg$/, 'Saved') || c.type))
    .toEqual(['- Profile: Sam.seller\n- Saved', 'image', '- Profile: Elon.buyer\n- Saved', 'image']);
  expect((await image(core, both[3].data)).size, 'the same element in the other profile').toEqual({ width: 200, height: 120 });
  await expect(call('browser_screenshot', { profile: 'Sam.seller', ref: 'e1', also: ['Elon.buyer'] })).rejects.toThrow(/pass a locator/);
});

test("agent: a screenshot waits for a pane just opened to be laid out; a pane never on screen, or a tab never in front, says so (no size to take)", async ({ core, call }) => {
  await profiles(core);
  // As a pane just opened, before the window lays it out: laid out once the screenshot waits for it.
  const bounds = await core((k) => {
    const sam = k.profile('Sam.seller'), b = sam.bounds;
    sam.bounds = { ...b, width: 0 };
    const laid = (e: string | symbol) => { if (e === 'laid-out') { sam.off('newListener', laid); setImmediate(() => sam.layout(b)); } };
    sam.on('newListener', laid);
    return b;
  });
  try {
    const shot = await call('browser_screenshot', { profile: 'Sam.seller' });
    expect((await image(core, shot.content[1].data)).size.width, 'taken once laid out').toBeGreaterThan(0);
    // A pane the window never lays out: the window's own layouts (it sends one whenever a profile's state comes) are
    // held meanwhile.
    await core((k) => { const sam = k.profile('Sam.seller'); sam.layout = () => {}; sam.bounds = { ...sam.bounds, width: 0 }; });
    await expect(call('browser_screenshot', { profile: 'Sam.seller' }), 'never laid out').rejects.toThrow(/Sam\.seller's pane has not been on screen yet/);
  } finally { await core((k, b) => { const sam = k.profile('Sam.seller'); delete sam.layout; sam.layout(b); }, bounds); }
  const back = await core(async (k, url) => { const t = k.profile('Sam.seller').newTab(url, { activate: false }); await t.ready; return t.id; }, `${SITE}/tall`);
  try {
    await expect(call('browser_screenshot', { profile: 'Sam.seller', tab: back }), 'never in front').rejects.toThrow(/Tab \w+ of Sam\.seller has not been in front yet/);
  } finally { await core((k, id) => k.profile('Sam.seller').closeTab(id), back); }
});

test('agent: typing goes key by key, as a person types, replacing what the field held; a long text at once', async ({ core, call }) => {
  await profiles(core);
  const p = { profile: 'Sam.seller', locator: "getByLabel('Name')" };
  await call('browser_navigate', { profile: 'Sam.seller', url: `${SITE}/app` });
  // Each change of the field: one for each key typed, one for a fill (clearing it first is one too).
  const typed = async (text: string) => {
    await call('browser_evaluate', { ...p, function: "(el) => { el.value = 'old'; window.keys = 0; el.oninput = () => window.keys++; }" });
    const t0 = Date.now();
    await call('browser_type', { ...p, text });
    return { ...JSON.parse((await call('browser_evaluate', { ...p, function: '(el) => ({ value: el.value, keys: window.keys })' })).text), ms: Date.now() - t0 };
  };
  const word = await typed('Анна');
  expect([word.value, word.keys], 'an input for each letter, any language (not on a US keyboard: as typed text, without key codes)').toEqual(['Анна', 1 + 4]);
  const long = await typed('x'.repeat(400));
  expect([long.value.length, long.keys], 'filled at once').toEqual([400, 1]);
  const most = await typed('y'.repeat(300));
  expect(most.keys).toBe(1 + 300);
  // Faster for a longer text: 40 ms a key would be 12 s. Not 5 s: a loaded machine takes 4.5 to 6.
  expect(most.ms, `300 keys in ${most.ms} ms`).toBeLessThan(9000);
});

test('agent: keys, hover, select, files, waiting, evaluate, back and forward; dialogs answered as asked, the human\'s left in the pane', async ({ core, call, ui }) => {
  const { sam } = await profiles(core);
  // The tests' Playwright, attached to every page of the app (fixtures.ts), dismisses a dialog no one listens to: the
  // pages' dialogs are left to Kulisa, as for the human.
  const leave = () => {};
  ui.context().on('dialog', leave);
  const p = { profile: 'Sam.seller' };
  const out = async () => JSON.parse((await call('browser_evaluate', { ...p, function: '() => out.textContent' })).text);
  await call('browser_navigate', { ...p, url: `${SITE}/form` });
  const del = { ...p, locator: "getByRole('button', { name: 'Delete' })" };
  // The agent's action answers its own dialog: none is shown.
  const view = () => core((k) => k.profile('Sam.seller').get().view.getVisible());
  const pane = ui.locator(`[role="region"][data-profile="${sam}"]`), paneDialog = pane.getByRole('alertdialog');
  const openDialog = paneDialog;
  expect((await call('browser_click', del)).text).toMatch(/asked: confirm "Delete the draft\?"; dismissed/);
  expect(await out()).toBe('kept');
  expect((await call('browser_click', { ...del, dialog: 'accept' })).text).toMatch(/accepted/);
  expect(await out()).toBe('deleted');
  await expect(openDialog).toHaveCount(0);
  // A dialog the agent did not open is the human's, in its pane over a picture of the page (not Electron's message
  // box in the middle of the window, which said nothing of where it came from); the human answers there.
  const ask = async (js: string) => {
    await call('browser_evaluate', { ...p, function: `() => { setTimeout(() => out.textContent = String(${js})); }` });
    await expect(openDialog).toHaveCount(1);
  };
  await ask("confirm('Yours?\\nReally.')");
  await expect(paneDialog).toHaveAccessibleName(`127.0.0.1:${PORT} says`);
  await expect(paneDialog.getByText(/^Yours\?/)).toHaveText('Yours?\nReally.');
  await expect(paneDialog.getByRole('button', { name: 'Cancel' })).toHaveCount(1); // a confirm has Cancel
  expect(await view(), 'the page drawn as a picture under its dialog').toBe(false);
  // The page does nothing until it is answered: the agent's tools say so at once rather than wait.
  await expect(call('browser_snapshot', p)).rejects.toThrow(/shows a confirm \("Yours\?\nReally\."\) for the human to answer/);
  await expect(pane.getByTestId('page')).toHaveCSS('--picture', /^url\("data:image\/jpeg/);
  // Gone from the pane, and the answer in the main process (it goes there after the pane has closed it).
  const closed = async () => {
    await expect(openDialog).toHaveCount(0);
    await expect.poll(() => core((k) => !k.profile('Sam.seller').get().dialog)).toBe(true);
  };
  await paneDialog.getByRole('button', { name: 'OK' }).click();
  await closed();
  expect(await out()).toBe('true');
  expect(await view()).toBe(true);
  await ask("confirm('No?')");
  await paneDialog.getByRole('button', { name: 'Cancel' }).click();
  await closed();
  expect(await out()).toBe('false');
  // An alert has OK only. Reloading while a dialog is open dismisses it, as in Chrome (Chromium holds the
  // navigation until then).
  await ask("alert('Saved')");
  await expect(paneDialog.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
  await pane.locator('[aria-label="Reload"]').click();
  await closed();
  await expect.poll(out).toBe('nothing yet');
  expect(await view()).toBe(true);
  // Answered over CDP by another client (an agent's own script): the pane's dialog goes too.
  await ask("confirm('Script?')");
  await core((k) => k.profile('Sam.seller').get().wc.debugger.sendCommand('Page.handleJavaScriptDialog', { accept: true }));
  await closed();
  expect(await out()).toBe('true');
  await call('browser_select_option', { ...p, locator: "getByLabel('Size')", values: ['L'] });
  expect(await out()).toBe('size L');
  expect(JSON.parse((await call('browser_evaluate', { ...p, locator: "getByLabel('Size')", function: '(el) => el.value' })).text)).toBe('L');
  await call('browser_file_upload', { ...p, locator: "getByLabel('Attachment')", paths: [path.join(CHECKOUT, 'package.json')] });
  expect(await out()).toBe('file package.json');
  await call('browser_hover', { ...p, locator: "getByText('Help')" });
  await call('browser_wait_for', { ...p, text: 'Hint shown', seconds: 2 });
  await call('browser_press_key', { ...p, key: 'Escape' });
  expect(await out()).toBe('Escape pressed');
  await call('browser_click', { ...p, locator: "getByRole('button', { name: 'Later' })" });
  await expect(call('browser_wait_for', { ...p, text: 'done later', seconds: 0.3 })).rejects.toThrow(/After 0.3 s, "done later" is not there/);
  await call('browser_wait_for', { ...p, text: 'done later', seconds: 5 });
  await call('browser_wait_for', { ...p, textGone: 'Escape pressed', seconds: 1 });
  expect((await call('browser_navigate', { ...p, go: 'back' })).text).toMatch(/Went back: .*\/app/);
  expect((await call('browser_navigate', { ...p, go: 'forward' })).text).toMatch(/Went forward: .*\/form/);
  expect((await call('browser_navigate', { ...p, go: 'forward' })).text).toMatch(/Nowhere to go forward/);
  expect((await call('browser_navigate', { ...p, go: 'reload' })).text).toMatch(/Went reload: .*\/form/);
  ui.context().off('dialog', leave);
});

test('agent: one profile acts, another waits to see it; several profiles read in one call', async ({ core, call }) => {
  await profiles(core);
  const tab = opened(await call('browser_tab_new', { profile: 'Elon.buyer', url: `${SITE}/board` }));
  const mine = opened(await call('browser_tab_new', { profile: 'Sam.seller', url: `${SITE}/board` }));
  await call('browser_type', { profile: 'Sam.seller', locator: "getByLabel('Message')", text: 'hello elon', submit: true });
  await call('browser_wait_for', { profile: 'Elon.buyer', text: 'hello elon', seconds: 5 });
  // The poster's page too: reloaded by the post, it shows the board at its next poll (the snapshot came before).
  await call('browser_wait_for', { profile: 'Sam.seller', text: 'hello elon', seconds: 5 });
  const both = (await call('browser_snapshot', { profile: 'Sam.seller', also: ['Elon.buyer', 'nobody'] })).text;
  expect(both).toMatch(/Profile: Sam\.seller[\s\S]*hello elon[\s\S]*Profile: Elon\.buyer[\s\S]*hello elon[\s\S]*Profile: nobody\n- No profile "nobody"/);
  await call('browser_tab_close', { profile: 'Sam.seller', tab: mine });
  await call('browser_tab_close', { profile: 'Elon.buyer', tab });
});

test('a page that does not load says why, as Chrome\'s error page (Electron leaves it blank); the agent reads it too', async ({ core, call, ui }) => {
  const { sam } = await profiles(core);
  const page = () => core((k) => { const wc = k.profile('Sam.seller').get().wc; return wc.executeJavaScript('document.body?.innerText || ""') as Promise<string>; });
  await act(ui, 'tab:navigate', { profile: sam, tab: await core((k) => k.profile('Sam.seller').active), url: 'http://127.0.0.1:4419/' }); // nothing listens there
  await expect.poll(page).toMatch(/refused to connect/);
  expect(await core((k) => k.profile('Sam.seller').get().wc.getURL()), 'the address stays the one that failed').toBe('http://127.0.0.1:4419/');
  expect((await call('browser_snapshot', { profile: 'Sam.seller' })).text).toMatch(/This site can’t be reached[\s\S]*ERR_CONNECTION_REFUSED/);
});

test('target=_blank and window.open open tabs of the same profile', async ({ core, call }) => {
  await profiles(core);
  await signIn(call, 'Sam.seller', 'sam');
  const tabs = () => core((k) => k.profile('Sam.seller').tabs.length);
  const before = await tabs();
  // As many as it should, and no more after a moment.
  const waitTabs = async (n: number) => { await expect.poll(tabs).toBeGreaterThanOrEqual(n); expect(await tabs()).toBe(n); };
  await call('browser_click', { profile: 'Sam.seller', locator: "getByRole('link', { name: 'target=_blank link' })" });
  await waitTabs(before + 1);
  // the new tab is now the active one; it has the same buttons
  await call('browser_click', { profile: 'Sam.seller', locator: "getByRole('button', { name: 'window.open()' })" });
  await waitTabs(before + 2);
  expect(await core(async (k) => {
    const sam = k.profile('Sam.seller'), popup = await sam.page(sam.tabs.at(-1).id);
    await popup.waitForLoadState();
    return [await popup.locator('#who').textContent(), await popup.evaluate(() => !!window.opener)];
  })).toEqual([expect.stringMatching(/Signed in as sam/), true]);
  await core((k) => { const sam = k.profile('Sam.seller'); for (const t of sam.tabs.slice(1)) sam.closeTab(t.id); });
  await expect.poll(tabs).toBe(1);
});

test('a tool on a tab right after another one closed finds its page (a page still closing has no target to ask)', async ({ core }) => {
  await profiles(core);
  const url = await core(async (k, site) => {
    const sam = k.profile('Sam.seller'), gone = sam.newTab(`${site}/form`), kept = sam.newTab(`${site}/board`);
    await Promise.all([gone.ready, kept.ready]);
    await sam.page(sam.tabs[0].id); // Playwright connected; the tab closing never asked for by the agent
    sam.closeTab(gone.id);
    const url = (await sam.page(kept.id)).url();
    sam.closeTab(kept.id);
    return url;
  }, SITE);
  expect(url).toBe(`${SITE}/board`);
});
