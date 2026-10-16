// Tabs asleep: a page automation is not using knows when it is hidden; the agent's first command wakes it, and it
// sleeps again once its profile has been left alone (profiles.ts: wake, sleep; discard.ts: the rule and the sweep;
// docs/profiles.md, "Tabs asleep"). Run after profiles.ts: Sam's tabs as they left them, and left so (discard.ts counts on them).
import { assert, SITE, waitFor } from './helpers.ts';
import { AWAKE_FOR } from '../src/main/discard.ts';
import type { Test } from './run.ts';
import type { Tab } from '../src/main/profiles.ts';

const visibility = (tab: Tab) => tab.wc.executeJavaScript('document.visibilityState') as Promise<string>;
// Frames the page draws in a quarter of a second: a hidden page draws none.
const frames = (tab: Tab) => tab.wc.executeJavaScript(`new Promise((r) => {
  let n = 0, on = true; requestAnimationFrame(function g() { n++; if (on) requestAnimationFrame(g); });
  setTimeout(() => { on = false; r(n); }, 250);
})`) as Promise<number>;

export default (test: Test) => {
  test("a tab behind the active one is hidden to its page once automation leaves its profile alone; the agent's tool wakes it and works there; alone again, it sleeps", async (ctx) => {
    const { shell, call } = ctx;
    const sam = shell.profiles.get('sam-admin');
    const board = sam.newTab(`${SITE}/board`), form = sam.newTab(`${SITE}/form`); // form is the active one; board behind it
    await Promise.all([board.ready, form.ready]);
    await waitFor(() => !board.loading && !form.loading);
    // Just opened: awake, Playwright attached and sent its first commands; the page behind believes it is looked at.
    assert.ok(board.awake && form.awake);
    assert.equal(await visibility(board), 'visible');
    // The time without a command to the profile (the sweep's clock is minutes): both asleep; the one behind is
    // hidden to its page, which stops drawing; the active one is seen as before.
    const alone = () => { sam.busyAt = Date.now() - AWAKE_FOR; shell.discard.sweep(); };
    alone();
    assert.ok(!board.awake && !form.awake);
    await waitFor(async () => (await visibility(board)) === 'hidden');
    assert.equal(await frames(board), 0);
    assert.equal(await visibility(form), 'visible');
    assert.ok((await frames(form)) > 0);
    // The agent's tool on the tab behind: its first command wakes it, only it, and an action that needs the page to
    // draw (a highlight scrolls its element into view and waits for it to be stable) works without showing the tab.
    assert.match((await call('browser_snapshot', { profile: 'sam-admin', tab: board.id })).text, /Title: board/);
    assert.ok(board.awake && !form.awake);
    await waitFor(async () => (await visibility(board)) === 'visible');
    await call('browser_highlight', { profile: 'sam-admin', tab: board.id, elements: [{ locator: "getByRole('button', { name: 'Post' })" }] });
    await call('browser_highlight', { profile: 'sam-admin', tab: board.id, elements: [] });
    assert.equal(sam.active, form.id, 'the human\'s tab stays');
    // Alone again: back to sleep.
    alone();
    await waitFor(async () => (await visibility(board)) === 'hidden');
    sam.closeTab(board.id); sam.closeTab(form.id);
    await waitFor(() => !sam.tabs.includes(board) && !sam.tabs.includes(form));
  });
};
