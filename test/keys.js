// Keyboard shortcuts (main/keys.js, docs/window.md "Keys"): Chrome's keys in a profile's page act on its pane, the
// terminal keeps the agent's keys, Kulisa's own work everywhere, Keyboard Shortcuts lists them. Keys are sent as input
// events into the page or the window, where the human's keyboard would put them.
const { assert, SITE, sleep, waitFor, menuRows, choose, press } = require('./helpers');

module.exports = (test) => {
  test("keys in a profile's page are Chrome's, for its pane: Ctrl+T a tab with the address to type in, Ctrl+W, Ctrl+Shift+T, Ctrl+1 and Ctrl+Tab; the site never gets them", async ({ shell, ui }) => {
    const sam = shell.profiles.get('sam-admin'), w = shell.windows[0];
    const first = sam.get();
    await first.ready;
    // What the site sees: keys with Ctrl.
    await first.wc.executeJavaScript(`window.__ctrlKeys = 0; addEventListener('keydown', (e) => { if (e.ctrlKey) __ctrlKeys++; }, true)`);
    first.wc.focus();
    press(first.wc, 'T', 'control');
    await waitFor(() => sam.tabs.length === 2);
    await waitFor(async () => w.keyZone === 'pane:sam-admin' && (await ui(`document.activeElement === document.querySelector('.pane[data-profile="sam-admin"] .addr')`)));
    assert.equal(await first.wc.executeJavaScript('__ctrlKeys'), 0, 'the site did not get Ctrl+T');
    // From the address bar: Ctrl+W closes the new tab (empty: nothing to open again).
    press(shell.win.webContents, 'W', 'control');
    await waitFor(() => sam.tabs.length === 1);

    // A tab with a page, closed from its page: the keyboard goes to the page shown next; Ctrl+Shift+T brings it back.
    const second = sam.newTab(`${SITE}/app?second`);
    await second.ready;
    second.wc.focus();
    press(second.wc, 'W', 'control');
    await waitFor(() => sam.tabs.length === 1 && first.wc.isFocused());
    press(first.wc, 'T', 'control', 'shift');
    await waitFor(() => sam.tabs.length === 2 && sam.get().wc.getURL().endsWith('?second'));
    await sam.get().ready;
    // Ctrl+1 the first tab, Ctrl+Tab the next; the keyboard stays in the pages.
    sam.get().wc.focus();
    press(sam.get().wc, '1', 'control');
    await waitFor(() => sam.active === first.id && first.wc.isFocused());
    press(first.wc, 'Tab', 'control');
    await waitFor(() => sam.active !== first.id && sam.get().wc.isFocused());
    assert.equal(await first.wc.executeJavaScript('__ctrlKeys'), 0, 'nor any other of them');
    sam.closeTab(sam.active); // as the test found it: one tab
    await waitFor(() => sam.tabs.length === 1);
  });

  test("keys in the terminal are the agent's, but Kulisa's own: Ctrl+T reaches the agent; Ctrl+` goes to the page used last and back; Ctrl+Shift+/ lists the keys", async ({ shell, ui, termText }) => {
    const w = shell.windows[0], win = shell.win.webContents, sam = shell.profiles.get('sam-admin');
    win.focus();
    await ui(`window.__term.focus()`);
    await waitFor(() => w.keyZone === 'terminal');
    press(win, 'T', 'control');
    await waitFor(async () => (await termText()).includes('^T'), 3000); // the fake agent (cat -v) shows what it got
    assert.equal(sam.tabs.length, 1, 'no tab opened');
    // Ctrl+`: to the page used last (Sam's, in the test before), and from there back to the terminal.
    press(win, '`', 'control');
    await waitFor(() => sam.get().wc.isFocused());
    press(sam.get().wc, '`', 'control');
    await waitFor(() => w.keyZone === 'terminal');

    // Keyboard Shortcuts: from the terminal too, every group with this OS's keys; also in ☰ with its key.
    press(win, '/', 'control', 'shift');
    await waitFor(() => ui(`(document.getElementById('shortcuts')?.dataset.state === 'open')`));
    assert.deepEqual(await ui(`[...document.querySelectorAll('#shortcuts h3')].map((h) => h.textContent)`), ['Everywhere', 'In a profile\'s page', 'In the terminal']);
    const row = (label) => ui(`(() => { const dt = [...document.querySelectorAll('#shortcuts dt')].find((d) => d.textContent === ${JSON.stringify(label)});
      return [...dt.nextElementSibling.querySelectorAll('kbd')].map((k) => k.textContent); })()`);
    assert.deepEqual(await row('New tab'), ['Ctrl+T']);
    assert.deepEqual(await row('Tab 1 to 8'), ['Ctrl+1…8']);
    assert.deepEqual(await row('Copy'), ['Ctrl+Shift+C']);
    // In a dialog the keys are the dialog's: Ctrl+Shift+N makes no task.
    await waitFor(() => w.keyZone === 'dialog');
    press(win, 'N', 'control', 'shift');
    await sleep(200); // that nothing is made: nothing to wait for
    assert.equal(shell.current.tasks.size, 1);
    await ui(`document.querySelector('#shortcuts .x').click()`);
    await ui(`document.getElementById('windowMenu').click()`);
    assert.ok((await menuRows(ui)).includes('Keyboard Shortcuts'));
    assert.equal(await ui(`[...document.querySelectorAll('.menu[data-state="open"] .item')].find((b) => b.querySelector('.label').textContent === 'Keyboard Shortcuts').querySelector('kbd').textContent`), 'Ctrl+Shift+/');
    await choose(ui, 'Keyboard Shortcuts');
    await waitFor(() => ui(`(document.getElementById('shortcuts')?.dataset.state === 'open')`));
    await ui(`document.querySelector('#shortcuts .x').click()`);
    // The buttons say their keys, as Chrome's toolbar does; the menus too.
    assert.equal(await ui(`document.querySelector('.pane[data-profile="sam-admin"] .reload').title`), 'Reload (Ctrl+R)');
    assert.match(await ui(`document.querySelector('.pane[data-profile="sam-admin"] .pick').title`), /\(Ctrl\+Shift\+C\)$/);
  });
};
