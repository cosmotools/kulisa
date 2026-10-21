// Tabs no one looks at lose their process and come back when looked at or used (profiles.ts: discard, load;
// discard.ts: the rule and the sweep; docs/profiles.md, "Tabs unloaded"). Run after profiles.ts: Sam's and Elon's tabs
// as they left them, and left so (restart-profiles.ts counts on Elon's).
import { webContents } from 'electron';
import { assert, savedTabs, SITE, waitFor, viewOn, click, hooksOf } from './helpers.ts';
import http from 'http';
import type { Test } from './run.ts';
import type { Tab } from '../src/main/profiles.ts';

const LONG_AGO = 10 * 60_000;
// A tab set as the sweep would find it after the time: off screen since long, its profile's last command long ago.
const aged = (tab: Tab) => { tab.offScreenSince = Date.now() - LONG_AGO; };

export default (test: Test) => {
  test('a tab no one looks at loses its process after the time; the strip and the saved tabs keep it; the agent and the human get it back where it was', async (ctx) => {
    const { shell, call, ui } = ctx;
    const sam = shell.profiles.get('sam-admin'), before = sam.tabs.map((t) => t.id);
    const board = sam.newTab(`${SITE}/board`), form = sam.newTab(`${SITE}/form`); // form is the active one, on screen
    await Promise.all([board.ready, form.ready]);
    await waitFor(() => board.title === 'board' && !board.loading && !board.pendingUrl); // a page still loading is kept
    await waitFor(() => !shell.task.agentTerminals().some((t) => t.state === 'working' || t.state === 'waiting')); // the tests before may leave the agent's last hook on its way
    const strip = () => ui(`[...document.querySelectorAll('.pane[data-profile="sam-admin"] .tabs .tab .title')].map((t) => t.textContent)`);
    const wcs = () => webContents.getAllWebContents().length;
    const n = wcs();
    // The sweep dates what is off screen; nothing goes before the time.
    assert.equal(shell.discard.sweep(), 0);
    assert.ok(board.offScreenSince && !form.offScreenSince, 'the inactive tab is dated, the active one not');
    // After the time (the tab and its profile aged by hand: the sweep's clock is minutes), the inactive tab alone.
    aged(board); sam.busyAt = Date.now() - LONG_AGO;
    assert.equal(shell.discard.sweep(), 1);
    await waitFor(() => board.discarded && board.wc.isDestroyed());
    assert.equal(wcs(), n - 1, 'its process is gone');
    assert.ok(!form.discarded && !sam.tabs.find((t) => t.id === before[0]).discarded, 'the active tab stays; the others were dated only now');
    assert.equal(board.url, `${SITE}/board`); assert.equal(board.title, 'board');
    await waitFor(async () => (await strip()).includes('board')); // the strip shows it as before, drawn after the tab's change
    await waitFor(() => savedTabs('sam-admin').includes(`${SITE}/board`)); // saved with the others, to come back after a restart
    // The agent: the tab listed as any, and a tool on it loads it first.
    const listed = JSON.parse((await call('profile_list', {})).text).find((p: { id: string }) => p.id === 'sam-admin').tabs;
    assert.deepEqual(listed.find((t: { id: string }) => t.id === board.id), { id: board.id, title: 'board', url: `${SITE}/board` });
    assert.match((await call('browser_snapshot', { profile: 'sam-admin', tab: board.id })).text, /Title: board/);
    assert.ok(!board.discarded && !board.wc.isDestroyed() && board.wc.getURL() === `${SITE}/board`, 'loaded again at its address');
    assert.equal(sam.active, form.id, 'the active tab is still the one the human had');
    // The human: a click on its tab in the strip brings it back on screen.
    aged(board); sam.busyAt = Date.now() - LONG_AGO;
    assert.equal(shell.discard.sweep(), 1);
    await waitFor(() => board.discarded);
    await click(ui, `document.querySelector('.pane[data-profile="sam-admin"] .tabs .tab[data-tab="${board.id}"]')`);
    await waitFor(() => sam.active === board.id && !board.discarded && !board.wc.isDestroyed());
    await waitFor(() => board.wc.getURL() === `${SITE}/board` && !board.wc.isLoading());
    await waitFor(async () => viewOn(shell, ui, 'sam-admin'));
    // Closed while discarded (the agent's or the human's ×): gone from the strip, nothing to close.
    sam.activate(form.id);
    aged(board); sam.busyAt = Date.now() - LONG_AGO;
    assert.equal(shell.discard.sweep(), 1);
    await waitFor(() => board.discarded);
    await call('browser_tab_close', { profile: 'sam-admin', tab: board.id });
    assert.ok(!sam.tabs.includes(board));
    await waitFor(async () => !(await strip()).includes('board'));
    sam.closeTab(form.id);
    await waitFor(() => sam.tabs.length === before.length && !sam.tabs.some((t) => t.discarded));
    sam.activate(before[0]);
  });

  test('not while an agent of the task works or waits, nor while automation drives the profile, nor a page holding its unload', async (ctx) => {
    const { shell, call } = ctx, task = shell.task;
    const sam = shell.profiles.get('sam-admin');
    const post = (event: string) => new Promise((r) => http.request(`${hooksOf(task)}/${event}`, { method: 'POST' }, (res) => { res.resume(); res.on('end', r); }).end('{}'));
    const idle = sam.newTab(`${SITE}/app`, { activate: false });
    await idle.ready;
    await waitFor(() => !idle.loading); // a page still loading is kept
    await post('prompt');
    aged(idle); sam.busyAt = Date.now() - LONG_AGO;
    assert.equal(shell.discard.sweep(), 0, 'the agent works: its tabs may be in use any moment');
    await post('waiting');
    assert.equal(shell.discard.sweep(), 0, 'waiting for the human: it goes on in them after');
    await post('stop');
    await waitFor(() => !task.agentTerminals().some((t) => t.state === 'working' || t.state === 'waiting'));
    sam.busyAt = Date.now();
    assert.equal(shell.discard.sweep(), 0, 'a command through the proxy a moment ago: an agent without hooks, or a script');
    sam.busyAt = Date.now() - LONG_AGO;
    assert.equal(shell.discard.sweep(), 1);
    await waitFor(() => idle.discarded);
    sam.closeTab(idle.id);
    // A page with unsaved changes says so (beforeunload, once the human has acted in it): it stays, as in Chrome.
    const draft = sam.newTab(`${SITE}/draft`);
    await draft.ready;
    await waitFor(() => !draft.loading);
    await call('browser_click', { profile: 'sam-admin', tab: draft.id, locator: "getByRole('button', { name: 'Draft' })" });
    sam.activate(sam.tabs[0].id);
    aged(draft); sam.busyAt = Date.now() - LONG_AGO;
    assert.equal(shell.discard.sweep(), 1, 'tried');
    await waitFor(() => draft.discarding === undefined);
    assert.ok(!draft.discarded && !draft.wc.isDestroyed(), 'kept: the page held its unload');
    draft.wc.removeAllListeners('will-prevent-unload'); // closing it for good: the test's own, as Chrome asks the human
    draft.wc.on('will-prevent-unload', (e) => e.preventDefault());
    sam.closeTab(draft.id);
    await waitFor(() => !sam.tabs.includes(draft));
  });
};
