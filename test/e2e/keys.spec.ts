// Keyboard shortcuts (main/keys.ts, docs/window.md "Keys"): Chrome's keys in a profile's page act on its pane, the
// terminal keeps the agent's keys, Kulisa's own work everywhere, Keyboard Shortcuts lists them. Keys are sent as input
// events into the page or the window, where the human's keyboard would put them.
import { test, expect } from './fixtures.ts';
import { SITE, MAC, WIN, termText, ipcSettled, item, termKeys } from './helpers.ts';

test("keys in a profile's page are Chrome's, for its pane: Ctrl+T a tab with the address to type in, Ctrl+W, Ctrl+Shift+T, Ctrl+1 and Ctrl+Tab; the site never gets them", async ({ core, ui }) => {
  // What the site sees: keys with Ctrl (⌘ on macOS).
  const id = await core(async (k, url) => {
    const sam = await k.ensureProfile('Sam', url), first = sam.get();
    await first.wc.executeJavaScript(`window.__ctrlKeys = 0; addEventListener('keydown', (e) => { if (e.ctrlKey || e.metaKey) __ctrlKeys++; }, true)`);
    first.wc.focus();
    k.press(first.wc, 'T', k.CMD);
    return sam.id;
  }, `${SITE}/app`);
  const tabs = () => core((k) => k.profile('Sam').tabs.length);
  await expect.poll(tabs).toBe(2);
  await expect.poll(() => core((k) => k.shell.windows[0].keyZone)).toBe(`pane:${id}`);
  await expect(ui.locator(`[role="region"][data-profile="${id}"] [aria-label="Address"]`)).toBeFocused();
  const siteGotKeys = () => core((k) => k.profile('Sam').tabs[0].wc.executeJavaScript('__ctrlKeys'));
  expect(await siteGotKeys(), 'the site did not get Ctrl+T').toBe(0);
  // From the address bar: Ctrl+W closes the new tab (empty: nothing to open again).
  await core((k) => k.press(k.shell.win.webContents, 'W', k.CMD));
  await expect.poll(tabs).toBe(1);

  // A tab with a page, closed from its page: the keyboard goes to the page shown next; Ctrl+Shift+T brings it back.
  await core(async (k, url) => {
    const second = k.profile('Sam').newTab(url);
    await second.ready;
    second.wc.focus();
    k.press(second.wc, 'W', k.CMD);
  }, `${SITE}/app?second`);
  const firstFocused = () => core((k) => k.profile('Sam').tabs[0].wc.isFocused());
  await expect.poll(async () => (await tabs()) === 1 && await firstFocused()).toBe(true);
  await core((k) => k.press(k.profile('Sam').tabs[0].wc, 'T', k.CMD, 'shift'));
  await expect.poll(() => core((k) => { const sam = k.profile('Sam'); return sam.tabs.length === 2 && sam.get().wc.getURL().endsWith('?second'); })).toBe(true);
  // Ctrl+1 the first tab, Ctrl+Tab the next; the keyboard stays in the pages.
  await core(async (k) => { const t = k.profile('Sam').get(); await t.ready; t.wc.focus(); k.press(t.wc, '1', k.CMD); });
  await expect.poll(() => core((k) => { const sam = k.profile('Sam'); return sam.active === sam.tabs[0].id && sam.tabs[0].wc.isFocused(); })).toBe(true);
  await core((k) => k.press(k.profile('Sam').tabs[0].wc, 'Tab', 'control'));
  await expect.poll(() => core((k) => { const sam = k.profile('Sam'); return sam.active !== sam.tabs[0].id && sam.get().wc.isFocused(); })).toBe(true);
  expect(await siteGotKeys(), 'nor any other of them').toBe(0);
});

test("keys in the terminal are the agent's, but Kulisa's own: Ctrl+T reaches the agent; Ctrl+` goes to the page used last and back; Ctrl+Shift+/ lists the keys", async ({ core, ui }) => {
  // Sam's pane used last (its address bar: the window knows only its own focus): Ctrl+` goes back to its page.
  const id = await core(async (k, url) => (await k.ensureProfile('Sam', url)).id, `${SITE}/app`);
  await core((k) => k.shell.win.webContents.focus());
  await ui.locator(`[role="region"][data-profile="${id}"] [aria-label="Address"]`).focus();
  await expect.poll(() => core((k) => k.shell.windows[0].keyZone)).toBe(`pane:${id}`);
  const tabsBefore = await core((k) => k.profile('Sam').tabs.length);
  await termKeys(ui).focus();
  await expect.poll(() => core((k) => k.shell.windows[0].keyZone)).toBe('terminal');
  await core((k) => { k.press(k.shell.win.webContents, 'T', 'control'); k.press(k.shell.win.webContents, 'Enter'); });
  // The fake agent (cat -v) shows what it got once its line is sent (Windows' console echoes a control key as it is,
  // which draws nothing); on macOS the terminal's own line discipline takes Ctrl+T first (BSD's status key, SIGINFO)
  // and prints the load: it reached the terminal all the same.
  await expect.poll(() => termText(ui)).toContain(MAC ? 'load: ' : '^T');
  expect(await core((k) => k.profile('Sam').tabs.length), 'no tab opened').toBe(tabsBefore);
  // Ctrl+`: to the page used last, and from there back to the terminal.
  await core((k) => k.press(k.shell.win.webContents, '`', 'control'));
  await expect.poll(() => core((k) => k.profile('Sam').get().wc.isFocused())).toBe(true);
  await core((k) => k.press(k.profile('Sam').get().wc, '`', 'control'));
  await expect.poll(() => core((k) => k.shell.windows[0].keyZone)).toBe('terminal');

  // Keyboard Shortcuts: from the terminal too, every group with this OS's keys; also in ☰ with its key.
  const shortcuts = ui.locator('#shortcuts');
  await core((k) => k.press(k.shell.win.webContents, '/', k.CMD, 'shift'));
  await expect(shortcuts).toHaveAttribute('data-state', 'open');
  await expect(shortcuts.locator('h3')).toHaveText(['Everywhere', 'In a profile\'s page', 'In the terminal']);
  const keysOf = (label: string) => shortcuts.locator('dt', { hasText: new RegExp(`^${RegExp.escape(label)}$`) }).locator('+ dd kbd');
  await expect(keysOf('New tab')).toHaveText([MAC ? '⌘T' : 'Ctrl+T']);
  await expect(keysOf('Tab 1 to 8')).toHaveText([MAC ? '⌘1…8' : 'Ctrl+1…8']);
  await expect(keysOf('Copy')).toHaveText([MAC ? '⌘C' : WIN ? 'Ctrl+C' : 'Ctrl+Shift+C']);
  // In a dialog the keys are the dialog's: Ctrl+Shift+N makes no task.
  await expect.poll(() => core((k) => k.shell.windows[0].keyZone)).toBe('dialog');
  const from = await core((k) => k.logged.length);
  await core((k) => k.press(k.shell.win.webContents, 'N', k.CMD, 'shift'));
  // Taken, the key is logged as it is pressed ([key]), and the window then asks for the task (task:new): both done once
  // the window's channel has gone there and back twice (the key's command to it, its ask back).
  await ipcSettled(ui); await ipcSettled(ui);
  expect(await core((k, i) => k.logged.slice(i).filter((l) => /\[key\]|task:new/.test(l)), from), 'nothing is made').toEqual([]);
  expect(await core((k) => k.shell.current.tasks.size)).toBe(1);
  await shortcuts.locator('header').getByRole('button', { name: 'Close' }).click();
  await ui.locator('#windowMenu').click();
  const row = item(ui, 'Keyboard Shortcuts');
  await expect(row.locator('kbd')).toHaveText(MAC ? '⇧⌘/' : 'Ctrl+Shift+/');
  await row.click();
  await expect(shortcuts).toHaveAttribute('data-state', 'open');
  await shortcuts.locator('header').getByRole('button', { name: 'Close' }).click();
  // The buttons say their keys, as Chrome's toolbar does; the menus too.
  await expect(ui.locator(`[role="region"][data-profile="${id}"] [aria-label="Reload"]`)).toHaveAttribute('title', MAC ? 'Reload (⌘R)' : 'Reload (Ctrl+R)');
  await expect(ui.locator(`[role="region"][data-profile="${id}"] [aria-label="Pick an element"]`)).toHaveAttribute('title', MAC ? /\(⇧⌘C\)$/ : /\(Ctrl\+Shift\+C\)$/);
});

test('a page that took the keyboard by itself, then given it for the human within the moment it would give it back, keeps it', async ({ core }) => {
  // Loading pages take the keyboard (page-focus.ts gives it back to where the human left it): Ctrl+` to such a page,
  // or a tab chosen by a key, at once after it loaded.
  expect(await core(async (k, url) => {
    const sam = await k.ensureProfile('Sam', url), t = sam.get();
    k.shell.win.webContents.focus();
    const decided = k.focusDecided(t.wc, true);
    t.wc.focus(); // the page's own
    sam.focusTab(t); // Kulisa's, for the human
    return decided;
  }, `${SITE}/app`)).toBe('left (a later focus)');
  expect(await core((k) => k.profile('Sam').get().wc.isFocused())).toBe(true);
});
