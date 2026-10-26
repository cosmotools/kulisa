// What the agent reads of a page besides its look: its console and requests, parts of a snapshot, what is too large for
// an answer, and the artifacts this leaves, in Resources and for the agent (docs/profiles.md, The agent's tools).
import fs from 'fs';
import path from 'path';
import { test, expect } from './fixtures.ts';
import type { Call } from './fixtures.ts';
import { SITE, PORT, upTo, menuRows, choose, rightClick, invoke } from './helpers.ts';
import { profiles, opened } from './agent-helpers.ts';

// A snapshot and a response body too large for an answer, each a file of the task's, as an agent leaves them; the tab
// they came from closed.
async function largeFiles(call: Call) {
  const tab = opened(await call('browser_tab_new', { profile: 'Elon.buyer', url: `${SITE}/large` }));
  expect((await call('browser_snapshot', { profile: 'Elon.buyer', tab })).text).toMatch(/-snapshot\.yml\. Read/);
  // Loaded again: the body of what a new tab loaded before Playwright came to it is not kept.
  await call('browser_navigate', { profile: 'Elon.buyer', go: 'reload' });
  const n = [...(await call('browser_network_requests', { profile: 'Elon.buyer', tab, filter: '/large$' })).text.matchAll(/#(\d+) GET/g)].at(-1)[1];
  expect((await call('browser_network_request', { profile: 'Elon.buyer', tab, number: Number(n) })).text).toMatch(/-response\.txt$/m);
  await call('browser_tab_close', { profile: 'Elon.buyer', tab });
}

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
  expect(await snap({ find: 'checkout' })).toMatch(/- Title: .*\n\n- generic .*\n {2}- paragraph \[ref=\w+\]:\n {4}- button "Checkout" \[ref=\w+\]$/);
  await call('browser_tab_close', { profile: 'Elon.buyer', tab });
  await expect.poll(active).toBe(before);
});

test("agent: a snapshot or a body too large for an answer goes to a file of the task's, each its own, the answer its path and outline", async ({ core, call }) => {
  await profiles(core);
  const artifacts = await core((k) => k.shell.task.store.artifacts);
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

test("Resources: the agent's artifacts listed as it makes them, the newest first, a screenshot with its picture; a click opens one, Delete removes it and its row", async ({ core, ui, call, files }) => {
  await profiles(core);
  await largeFiles(call);
  const dir = await core((k) => k.shell.task.store.artifacts), number = (f: string) => Number(path.basename(f).split('-')[0]);
  const rows = () => ui.locator('#resources [data-file]').evaluateAll((rs) => rs.map((r) => [(r as HTMLElement).dataset.file, document.getElementById(r.getAttribute('aria-labelledby')).textContent, !!r.querySelector('img')] as [string, string, boolean]));
  const saved = () => fs.readdirSync(dir).map((f) => path.join(dir, f)).sort((a, b) => number(b) - number(a));
  const shot = (await call('browser_screenshot', { profile: 'Elon.buyer' })).text.match(/^Saved as (.+\.jpg)$/)[1];
  // Its picture comes a moment later (made in the background: Task.makeThumbs).
  await expect.poll(async () => { const r = await rows(); return JSON.stringify(r.map((x) => x[0])) === JSON.stringify(saved()) && r[0][2]; }).toBe(true);
  const all = await rows();
  expect(all[0], 'the one just made first, with its picture').toEqual([shot, 'Screenshot', true]);
  expect(all.find((r) => r[0].endsWith('-snapshot.yml')).slice(1)).toEqual(['Snapshot', false]);
  expect(all.find((r) => r[0].endsWith('-response.txt')).slice(1)).toEqual(['Response body', false]);
  await expect(ui.locator('#resources [data-file] small').first(), 'whose, and when').toHaveText(/^Elon\.buyer · /);
  // What the OS would open it with: noted, not opened.
  await core((k) => {
    const { shell } = k.electron;
    const g = k.stash;
    g.openPath = shell.openPath; g.opened = [];
    shell.openPath = async (file: string) => { g.opened.push(file); return ''; };
  });
  try {
    await ui.locator('#resources [data-file]').first().click();
    await expect.poll(() => core((k) => k.stash.opened)).toEqual([shot]);
  } finally {
    await core((k) => {
      const { shell } = k.electron;
      shell.openPath = k.stash.openPath;
    });
  }
  await rightClick(ui, '#resources [data-file]'); // the screenshot, first
  expect(await menuRows(ui)).toEqual(['Open', 'Show in Folder', '-', 'Delete']);
  await choose(ui, 'Delete');
  await expect.poll(async () => !fs.existsSync(shot) && !(await rows()).some((r) => r[0] === shot)).toBe(true);
  expect((await invoke(ui, 'task:artifacts-delete', { key: await core((k) => k.shell.task.key), files: [path.join(files.root, 'package.json')] })).error,
    'only a file of the task\'s own folder').toMatch(/not an artifact/);
});

test("artifacts: what they take, in Resources' heading and for the agent, which explains and deletes them as the human does with Delete All", async ({ core, ui, call, files }) => {
  await profiles(core);
  const dir = await core((k) => k.shell.task.store.artifacts);
  const total = () => fs.readdirSync(dir).reduce((sum, f) => sum + fs.statSync(path.join(dir, f)).size, 0);
  const heading = () => ui.getByTestId('artifacts-size').evaluateAll((s) => s[0]?.textContent ?? null);
  await largeFiles(call); // older ones, to list past a limit and to leave after one is deleted
  await call('browser_screenshot', { profile: 'Elon.buyer' });
  const listed = (await call('task_artifacts', {})).text;
  const size = listed.match(/^This task's artifacts: (\S+ [KMG]B) in (\d+) file\(s\)\./)[1];
  expect(Number(listed.match(/in (\d+) file/)[1]), listed).toBe(fs.readdirSync(dir).length);
  const shot = listed.match(/^- (.+\.jpg): screenshot, Elon\.buyer, \d{4}-\d\d-\d\d \d\d:\d\d, \S+ [KMG]B$/m)?.[1];
  expect(shot && fs.existsSync(shot), `each file with its path, kind, profile, time and size: ${listed}`).toBe(true);
  expect(total()).toBeGreaterThan(0);
  await expect.poll(heading).toBe(size);
  expect((await call('task_artifacts', { scope: 'all' })).text, "every task's total").toMatch(new RegExp(`^- .+ / .+ \\(this task\\): ${size}$`, 'm'));
  expect((await call('task_artifacts', { limit: 1 })).text).toMatch(/older not listed \(limit\)\.$/);
  // The agent deletes one, then the human all.
  expect((await call('task_artifacts_delete', { files: [shot] })).text).toMatch(/^Deleted 1 file\(s\), \S+ [KMG]B; \S+ [KMG]B left\.$/);
  expect(fs.existsSync(shot)).toBe(false);
  await expect(call('task_artifacts_delete', { files: [path.join(files.root, 'package.json')] })).rejects.toThrow(/not an artifact of this task/);
  await ui.locator('#resources [aria-label="Delete All Artifacts"]').click();
  await expect.poll(async () => !fs.readdirSync(dir).length && (await heading()) === null).toBe(true);
  expect((await call('task_artifacts', {})).text).toMatch(/^This task's artifacts: 0 KB in 0 file\(s\)\.$/);
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
