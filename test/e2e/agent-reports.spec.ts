// What the agent reads of a page besides its look: its console and requests, parts of a snapshot, what is too large for
// an answer, and the artifacts this leaves, in Resources and for the agent (docs/profiles.md, The agent's tools).
import fs from 'fs';
import path from 'path';
import { sizeText } from '../../src/shared/bytes.ts';
import { test, expect } from './fixtures.ts';
import { resourcesGroup, showResources, SITE, PORT, upTo, choose, rightClick, invoke, termText, termKeys, WIN } from './helpers.ts';
import { profiles, opened } from './agent-helpers.ts';

test("agent: the picked tab's console and requests, and tools on a tab other than the active one", async ({ core, call }) => {
  await profiles(core);
  // A tab on a page whose Pay now failed: its error logged, its request answered 500.
  await call('browser_navigate', { profile: 'Elon.buyer', url: `${SITE}/errors` });
  await call('browser_click', { profile: 'Elon.buyer', locator: "getByRole('button', { name: 'Pay now' })" });
  await call('browser_wait_for', { profile: 'Elon.buyer', text: 'HTTP 500' });
  const active = () => core((k) => k.profile('Elon.buyer').active);
  const picked = await active();
  const other = opened(await call('browser_tab_new', { profile: 'Elon.buyer', url: `${SITE}/app` }));
  expect(await active()).toBe(other);
  const errors = (await call('browser_console_messages', { profile: 'Elon.buyer', tab: picked, level: 'error' })).text;
  expect(errors).toMatch(/error: .*PaymentError/); // Playwright's page.consoleMessages()
  const failed = (await call('browser_network_requests', { profile: 'Elon.buyer', tab: picked, onlyFailed: true })).text;
  expect(failed).toMatch(new RegExp(`#\\d+ POST http://127\\.0\\.0\\.1:${PORT}/api/pay → 500`)); // page.requests()
  expect(failed, 'only failed ones').not.toMatch(/GET .*\/errors /);
  expect((await call('browser_snapshot', { profile: 'Elon.buyer', tab: picked })).text).toMatch(/URL: .*\/errors/);
  expect((await call('browser_snapshot', { profile: 'Elon.buyer' })).text, 'default: the active tab').toMatch(/URL: .*\/app/);
  await call('browser_highlight', { profile: 'Elon.buyer', tab: picked, elements: [{ locator: "getByRole('button', { name: 'Pay now' })" }] });
  await call('browser_highlight', { profile: 'Elon.buyer', tab: picked, elements: [] });
  await call('browser_tab_close', { profile: 'Elon.buyer', tab: other });
  await expect.poll(active).toBe(picked);
});

test("agent: what a page reported: the console by level, requests without static files, by address, since the last action or the page's load; one request whole, its credentials hidden; an action's answer counts the errors", async ({ core, call }) => {
  await profiles(core);
  const active = () => core((k) => k.profile('Elon.buyer').active), before = await active();
  const tab = opened(await call('browser_tab_new', { profile: 'Elon.buyer', url: `${SITE}/report` }));
  const read = async (tool: string, args = {}) => (await call(tool, { profile: 'Elon.buyer', tab, ...args })).text;
  // Loaded again: what a new tab asked for before Playwright came to it is not in its requests (its console is).
  await call('browser_navigate', { profile: 'Elon.buyer', go: 'reload' });
  await expect.poll(() => read('browser_console_messages')).toContain('slow config');
  const all = await read('browser_console_messages');
  for (const m of ['info: app loaded', 'debug: debug detail', 'warning: slow config']) expect(all).toContain(m);
  const warnings = await read('browser_console_messages', { level: 'warning' });
  expect(warnings).toMatch(/warning: slow config/);
  expect(warnings, 'a level and the more severe ones only').not.toMatch(/app loaded|debug detail/);
  expect(await read('browser_network_requests'), 'a script that loaded is left out').not.toMatch(/app\.js/);
  expect(await read('browser_network_requests', { static: true })).toMatch(/GET .*\/static\/app\.js → 200/);

  // The answer counts what the action brought; since action, only that.
  const clicked = (await call('browser_click', { profile: 'Elon.buyer', tab, locator: "getByRole('button', { name: 'Pay' })" })).text;
  // The page's error, and Chromium's for the 500 when it came back before the answer.
  expect(clicked).toMatch(/Since: [12] console errors?/);
  await expect.poll(() => read('browser_network_requests', { since: 'action' })).toContain('→ 500');
  const since = await read('browser_console_messages', { since: 'action' });
  expect(since).toMatch(/PaymentError/);
  expect(since).not.toMatch(/app loaded/);
  const failed = await read('browser_network_requests', { filter: '/api/' });
  expect(failed, 'by address').not.toMatch(/\/report/);
  const n = Number(failed.match(/#(\d+) POST .*\/api\/pay → 500/)[1]);
  expect(Number((await read('browser_network_requests', { onlyFailed: true })).match(/#(\d+) POST/)[1]), 'a request keeps its number').toBe(n);
  const one = await read('browser_network_request', { number: n });
  expect(one).toMatch(/POST .*\/api\/pay → 500/);
  expect(one).toMatch(/authorization: \(hidden\)/);
  expect(one, 'credentials never reach the agent').not.toMatch(/secret-token/);
  expect(one).toMatch(/Request body \(15 bytes, application\/json\):\n\{"card":"4242"\}/);
  expect(one).toMatch(/Response body \(24 bytes, application\/json\):\n\{"error":"stub failure"\}/);
  await expect(read('browser_network_request', { number: 99999 })).rejects.toThrow(/No request #99999.*browser_network_requests/);

  // Since the page's load: what came before it is left out.
  expect((await call('browser_navigate', { profile: 'Elon.buyer', url: `${SITE}/report` })).text, 'nothing to count').not.toMatch(/Since:/);
  await expect.poll(() => read('browser_console_messages', { since: 'navigation' })).toContain('slow config');
  expect(await read('browser_console_messages', { since: 'navigation' })).not.toMatch(/PaymentError/);
  expect(await read('browser_network_requests', { since: 'navigation' })).not.toMatch(/api\/pay/);
  expect((await read('browser_console_messages')).split('app loaded').length - 1, 'all that is kept: every load').toBeGreaterThanOrEqual(2);
  await call('browser_tab_close', { profile: 'Elon.buyer', tab });
  await expect.poll(active).toBe(before);
});

test('agent: a part of a snapshot: an element, a depth, what matches under its ancestors; its refs act', async ({ core, call }) => {
  await profiles(core);
  const active = () => core((k) => k.profile('Elon.buyer').active), before = await active();
  const tab = opened(await call('browser_tab_new', { profile: 'Elon.buyer', url: `${SITE}/form` }));
  const snap = async (args = {}) => (await call('browser_snapshot', { profile: 'Elon.buyer', tab, ...args })).text;
  const whole = await snap();
  const select = await snap({ locator: "getByRole('combobox', { name: 'Size' })" });
  expect(select).toMatch(/option "M"/);
  expect(select, 'that element only').not.toMatch(/Delete/);
  expect(await snap({ depth: 1 }), 'to a depth').not.toMatch(/option "M"/);
  expect(whole).toContain('option "M"');
  const delButton = await snap({ find: 'delete' });
  expect(delButton).toMatch(/button "Delete" \[ref=\w+\]/);
  expect(delButton, 'only what matches').not.toMatch(/Later|option/);
  expect(await snap({ find: 'no such thing' })).toMatch(/Nothing matches no such thing\./);
  // A ref from a part is the page's: the action finds it.
  const ref = select.match(/combobox "Size" \[ref=(\w+)\]/)[1];
  await call('browser_select_option', { profile: 'Elon.buyer', tab, ref, values: ['L'] });
  await call('browser_navigate', { profile: 'Elon.buyer', url: `${SITE}/app` });
  // Its ancestors: where on the page it is.
  const checkout = (await snap({ find: 'checkout' })).split('\n\n')[1];
  expect(checkout, 'the matching button keeps its ancestors').toMatch(/^- (?!button "Checkout")/);
  const checkoutRef = checkout.match(/ +- button "Checkout" \[ref=(\w+)\]/)[1];
  await call('browser_click', { profile: 'Elon.buyer', tab, ref: checkoutRef });
  expect(await snap()).toContain('Checked out ✓');
  await call('browser_tab_close', { profile: 'Elon.buyer', tab });
  await expect.poll(active).toBe(before);
});

test("agent: a snapshot or a body too large for an answer goes to a file of the task's, each its own, the answer its path and outline", async ({ core, call }) => {
  await profiles(core);
  const artifacts = JSON.parse((await call('task_files')).text).tmp;
  const active = () => core((k) => k.profile('Elon.buyer').active), before = await active();
  const tab = opened(await call('browser_tab_new', { profile: 'Elon.buyer', url: `${SITE}/large` }));
  const answer = (await call('browser_snapshot', { profile: 'Elon.buyer', tab })).text;
  const file = answer.match(/, in (.+-snapshot\.yml)\. Read/)[1];
  expect(path.dirname(file), "the task's, never the project's").toBe(artifacts);
  expect(answer.length, `the answer stays small: ${answer.length}`).toBeLessThan(6000);
  expect(answer).toMatch(/- URL: .*\/large\n- Title: large\n- Snapshot: \d+ characters \(about \d+k tokens\)/);
  expect(answer, 'its top levels').toMatch(/main \[ref=\w+\]:[\s\S]*navigation "Index"/);
  expect(answer).not.toMatch(/Item 1499/);
  expect(fs.readFileSync(file, 'utf8'), 'the whole snapshot in the file').toMatch(/link "Item 1499 with a longer name"/);
  expect((await call('browser_snapshot', { profile: 'Elon.buyer', tab, find: 'find me' })).text, 'a part fits: in the answer').toMatch(/button "Find me" \[ref=\w+\]$/);
  const again = (await call('browser_snapshot', { profile: 'Elon.buyer', tab })).text.match(/, in (.+-snapshot\.yml)\. Read/)[1];
  expect(again !== file && fs.existsSync(file), 'the next one a file of its own: the first kept, to compare').toBe(true);
  // Loaded again: the body of what a new tab loaded before Playwright came to it is not kept.
  await call('browser_navigate', { profile: 'Elon.buyer', go: 'reload' });
  const n = [...(await call('browser_network_requests', { profile: 'Elon.buyer', tab, filter: '/large$' })).text.matchAll(/#(\d+) GET/g)].at(-1)[1];
  const body = (await call('browser_network_request', { profile: 'Elon.buyer', tab, number: Number(n) })).text;
  const html = body.match(/Response body \(\d+ bytes, text\/html; charset=utf-8\): in (.+-response\.txt)$/m)?.[1];
  expect(html, body).toBeTruthy();
  expect(path.dirname(html)).toBe(artifacts);
  expect(fs.readFileSync(html, 'utf8')).toMatch(/Item 1499/);
  await call('browser_tab_close', { profile: 'Elon.buyer', tab });
  await expect.poll(active).toBe(before);
});

test('Artifacts tree shows ordinary results with metadata and screenshot previews; opens, sends and deletes files', async ({ core, ui, call, files }) => {
  await profiles(core);
  const { artifacts } = JSON.parse((await call('task_files')).text);
  const note = path.join(artifacts, 'notes.txt'); fs.writeFileSync(note, 'A completed result');
  const shot = (await call('browser_screenshot', { profile: 'Elon.buyer', purpose: 'artifact' })).text.match(/^Saved as (.+\.jpg)$/)[1];
  await showResources(ui, 'Artifacts');
  const row = (file: string) => ui.getByRole('treeitem', { name: path.basename(file), exact: true });
  await expect(row(note)).toContainText(sizeText(fs.statSync(note).size));
  await expect(row(shot)).toContainText('Screenshot · Elon.buyer');
  await expect(row(shot).locator('[data-item-section="icon"] use')).toHaveAttribute('href', /^#artifact-thumbnail-/);
  await core((k) => {
    k.stash.openPath = k.electron.shell.openPath; k.stash.opened = [];
    k.electron.shell.openPath = async (file: string) => { k.stash.opened.push(file); return ''; };
  });
  try {
    await row(note).click();
    await expect.poll(() => core((k) => k.stash.opened)).toEqual([note]);
  } finally { await core((k) => { k.electron.shell.openPath = k.stash.openPath; }); }
  await rightClick(ui, row(shot)); await choose(ui, 'Send to Agent');
  await expect.poll(() => termText(ui)).toContain(shot);
  await expect(termKeys(ui)).toBeFocused();
  await core((k) => k.shell.pty.write('\x15'));
  await showResources(ui, 'Artifacts'); await rightClick(ui, row(shot)); await choose(ui, 'Delete');
  await expect(row(shot)).toHaveCount(0); expect(fs.existsSync(shot)).toBe(false);
  await rightClick(ui, row(note)); await choose(ui, 'Delete'); await expect(row(note)).toHaveCount(0);
  expect((await invoke(ui, 'task:artifact:delete', { key: await core((k) => k.shell.task.key), files: [path.join(files.root, 'package.json')] })).error).toMatch(/not an artifact/);
});

test('screenshots from the agent show the same thumbnail, copy JPEG as PNG, and close when deleted from Resources', async ({ core, ui, call }) => {
  await profiles(core);
  const file = (await call('browser_screenshot', { profile: 'Elon.buyer', purpose: 'artifact' })).text.match(/^Saved as (.+\.jpg)$/)[1];
  await expect.poll(() => core((k) => k.shell.windows[0].thumbnails.file)).toBe(file);
  await expect(ui.locator('#shotthumb')).toHaveCount(1);
  await invoke(ui, 'thumbnail:act', { action: 'copy' });
  const image = await core(async (k) => {
    const item = (await k.electron.clipboard.read())[0];
    const png = Buffer.from(await (await item.getType('image/png')).arrayBuffer());
    return k.electron.nativeImage.createFromBuffer(png).getSize();
  });
  expect(image.width).toBeGreaterThan(0);
  expect(image.height).toBeGreaterThan(0);
  await showResources(ui, 'Artifacts');
  await rightClick(ui, ui.getByRole('treeitem', { name: path.basename(file), exact: true }));
  await choose(ui, 'Delete');
  await expect.poll(() => core((k) => k.shell.windows[0].thumbnails.file)).toBeNull();
  await expect(ui.locator('#shotthumb')).toHaveCount(0);
  expect(fs.existsSync(file)).toBe(false);
});

test('Artifacts drag as disk files and Send to Agent inserts their paths without submitting the prompt', async ({ core, ui, call, files }) => {
  await profiles(core);
  const screenshot = (await call('browser_screenshot', { profile: 'Elon.buyer', purpose: 'artifact' })).text.match(/^Saved as (.+\.jpg)$/)[1];
  await showResources(ui, 'Artifacts');
  const snapshot = path.join(JSON.parse((await call('task_files')).text).artifacts, 'snapshot.yml');
  fs.writeFileSync(snapshot, 'A completed snapshot');
  await core((k) => {
    const wc = k.shell.windows[0].win.webContents;
    k.stash.startDrag = wc.startDrag;
    k.stash.dragged = [];
    // Native OS dragging is outside CDP; observe the file handed to the desktop without moving a real file.
    wc.startDrag = (item) => { k.stash.dragged.push({ file: item.file, icon: typeof item.icon === 'string' ? !item.icon : item.icon.isEmpty() }); };
  });
  try {
    for (const file of [screenshot, snapshot]) {
      const before = await core((k) => k.ptyOutput());
      await showResources(ui, 'Artifacts');
      const row = ui.getByRole('treeitem', { name: path.basename(file), exact: true });
      await row.dragTo(resourcesGroup(ui).getByRole('tab', { name: 'Artifacts', exact: true }));
      await expect.poll(() => core((k) => k.stash.dragged.at(-1))).toEqual({ file, icon: false });
      await rightClick(ui, row);
      await choose(ui, 'Send to Agent');
      await expect.poll(() => termText(ui)).toContain(file);
      await expect(termKeys(ui)).toBeFocused();
      if (!WIN) expect((await core((k) => k.ptyOutput())).slice(before.length), 'the prompt is not submitted').not.toMatch(/[\r\n]/);
      await core((k) => k.shell.pty.write('\x15'));
    }
    const key = await core((k) => k.shell.task.key);
    for (const channel of ['task:artifact:drag', 'task:artifact:send'] as const) {
      expect((await invoke(ui, channel, { key, file: path.join(files.project, 'package.json') })).error).toMatch(/not an artifact/);
    }
  } finally {
    await core((k) => { k.shell.windows[0].win.webContents.startDrag = k.stash.startDrag; });
  }
});

test('Artifacts sizes separate results and temporary files; Delete All preserves temporary work', async ({ ui, call }) => {
  const { artifacts, tmp } = JSON.parse((await call('task_files')).text);
  await call('task_artifacts_delete', { all: true });
  const result = path.join(artifacts, 'summary.txt'); fs.writeFileSync(result, 'A finished result');
  fs.writeFileSync(path.join(tmp, 'working.txt'), 'Keep working');
  const listed = JSON.parse((await call('task_artifacts')).text);
  await showResources(ui, 'Artifacts');
  await expect(ui.getByTestId('artifacts-size')).toHaveText(sizeText(listed.bytes));
  expect(JSON.parse((await call('task_artifacts', { area: 'all' })).text).bytes).toBeGreaterThan(listed.bytes);
  expect((await call('task_artifacts_delete', { files: [result] })).text).toMatch(/^Deleted 1 entries/);
  fs.writeFileSync(result, 'Another result');
  await expect(ui.getByTestId('artifacts-size')).not.toHaveText('0 KB');
  await ui.getByRole('button', { name: 'Delete All Artifacts' }).click();
  await expect(ui.getByTestId('artifacts-size')).toHaveText('0 KB');
  expect(fs.readdirSync(artifacts)).toEqual([]);
  expect(fs.readFileSync(path.join(tmp, 'working.txt'), 'utf8')).toBe('Keep working');
});

test('agent: a request with no answer yet is listed as pending at once', async ({ core, call }) => {
  await profiles(core);
  const active = () => core((k) => k.profile('Elon.buyer').active), before = await active();
  const tab = opened(await call('browser_tab_new', { profile: 'Elon.buyer', url: `${SITE}/pending` }));
  try {
    // Loaded again: what a new tab asks for before Playwright is attached to it is not listed (docs/profiles.md).
    await call('browser_navigate', { profile: 'Elon.buyer', tab, url: `${SITE}/pending` });
    // The request to /hang never gets an answer: listing it must not wait for one (it held the agent's turn for minutes).
    await expect.poll(async () => {
      const r = await upTo(call('browser_network_requests', { profile: 'Elon.buyer', tab }), 5000);
      expect(r, 'answered within 5 s').toBeTruthy();
      return /GET .*\/hang → pending/.test(r.text);
    }).toBe(true);
  } finally { await call('browser_tab_close', { profile: 'Elon.buyer', tab }); }
  await expect.poll(active).toBe(before);
});
