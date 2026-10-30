// The window's menus: a pane's header, a tab, the terminal (its copy and paste, its links), ☰; with the mouse and the
// keyboard as the OS's menus (docs/window.md, Menus; docs/ui.md, Menus).
import fs from 'fs';
import os from 'os';
import path from 'path';
import url from 'url';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures.ts';
import type { Core } from './fixtures.ts';
import { SITE, MAC, WIN, frames, seen, ipcSettled, echoed, menu, anyMenu, item, choose, closeMenu, rightClick, focusWindow, answer, removed, termKeys, termText, shortcutsDialog } from './helpers.ts';
import { ELON, begin, bothOn } from './tasks-helpers.ts';

const menuOpen = (ui: Page) => menu(ui).isVisible();
// The middle of an element, where the hand presses it with Playwright's mouse (a press and a release apart, which a
// locator's click does not give).
const center = async (l: Locator) => { const b = await l.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
// Everything the window would have sent its agent's terminal by now is there, echoed: a paste reads the clipboard first
// (navigator.clipboard: answered in order), so a mark sent after a read of it comes after anything a paste sent; the
// mark then rubbed out.
async function sentAll(core: Core, ui: Page) {
  const task = await core((k) => k.shell.task.promptTarget().key);
  await echoed(core, { send: (mark) => ui.evaluate(async ([t, m]) => { await navigator.clipboard.readText().catch(() => ''); (window as any).kulisa.send('pty:in', { task: t, data: m }); }, [task, mark]) });
}

test('context menus: a pane\'s header, a tab, the terminal; pages are pictures while a menu is open; Arrange workspace in ☰; Exit', async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  const elonId = files.idOf(ELON), header = `[data-panel="${files.panel(ELON)}"]`;
  const elonVisible = () => core((k) => k.profile('Elon.buyer').get().view.getVisible());
  const headerMenu = `
    - menu:
      - menuitem "New tab"
      - menuitem "About this profile…"
      - menuitem "Sign In to Master…"
      - menuitem "Close profile"
      - menuitem "Remove from Project…"`;
  await rightClick(ui, header);
  await expect(menu(ui)).toMatchAriaSnapshot(headerMenu);
  const h = await ui.locator(header).boundingBox(), m = await menu(ui).boundingBox();
  // Its list inset by the menu's padding and ring.
  expect(Math.abs(m.x - (h.x + h.width / 2)) <= 8 && Math.abs(m.y - (h.y + h.height / 2)) <= 8, 'at the pointer').toBe(true);
  // The pages are native views above the menu: pictures of them stand in meanwhile.
  expect(await elonVisible()).toBe(false);
  await expect(ui.locator(`[role="region"][data-profile="${elonId}"] [data-testid="page"] [data-testid="snapshot"]`)).toHaveCount(1);
  // Another menu right from this one: the pages stay pictures.
  await ui.locator('#windowMenu').click();
  await expect(menu(ui).getByTestId('zoom-row')).toBeVisible();
  expect(await elonVisible(), 'a page over the second menu').toBe(false);
  // At the header's start: ☰'s menu may lie over its middle.
  await ui.locator(header).click({ button: 'right', position: { x: 8, y: 8 } });
  await expect(menu(ui)).toMatchAriaSnapshot(headerMenu);
  expect(await elonVisible(), 'a page over the third menu').toBe(false);
  const n = await core((k) => k.profile('Elon.buyer').tabs.length);
  await choose(ui, 'New tab');
  await expect.poll(() => core((k) => k.profile('Elon.buyer').tabs.length)).toBe(n + 1);
  await expect.poll(elonVisible).toBe(true);
  await expect(ui.locator('[data-testid="snapshot"]')).toHaveCount(0);

  const tabs = ui.locator(`[role="region"][data-profile="${elonId}"] [role="tab"]`);
  await expect(tabs).toHaveCount(n + 1);
  await rightClick(ui, tabs);
  await expect(menu(ui)).toMatchAriaSnapshot(`
    - menu:
      - menuitem "Reload"
      - menuitem "Duplicate"
      - menuitem "Close tab"
      - menuitem "Close other tabs"`);
  await core((k) => { k.stash.firstTab = k.profile('Elon.buyer').tabs[0]; });
  await choose(ui, 'Close other tabs');
  await expect.poll(() => core((k) => { const e = k.profile('Elon.buyer'); return e.tabs.length === 1 && e.tabs[0] === k.stash.firstTab; })).toBe(true);

  await ui.evaluate(() => (window as any).__term.clearSelection());
  // A real right-click (press, release): the menu stays after the button is released. On Linux it opens on the
  // press, just below the pointer, so the release is outside it; on Windows on the release.
  const term = await center(ui.getByTestId('terminal'));
  await ui.mouse.move(term.x, term.y);
  await ui.mouse.down({ button: 'right' });
  if (WIN) await ui.mouse.up({ button: 'right' });
  await expect(menu(ui)).toBeVisible(); // once the pages' pictures are there (menuCover): slower under load
  if (!WIN) await seen(ui, 'mouseup', () => ui.mouse.up({ button: 'right' }));
  expect(await menuOpen(ui), 'open after the release').toBe(true);
  await core((k) => k.press(k.shell.win.webContents, 'Escape'));
  await expect(menu(ui)).toHaveCount(0);
  // A press anywhere else closes it.
  await rightClick(ui, '[data-testid="terminal"] .xterm-screen');
  await expect(menu(ui)).toBeVisible();
  const bar = await center(ui.locator('#topbar'));
  await ui.mouse.move(bar.x, bar.y);
  await ui.mouse.down();
  await ui.mouse.up();
  await expect(menu(ui)).toHaveCount(0);
  await rightClick(ui, '[data-testid="terminal"] .xterm-screen');
  await expect(menu(ui), 'nothing selected to copy').toMatchAriaSnapshot(`
    - menu:
      - menuitem "Copy" [disabled]
      - menuitem "Paste"
      - menuitem "Select all"
      - menuitem "Clear"
      - menuitem "Change agent…"
      - menuitem "New Conversation"
      - menuitem "Close"`);
  await anyMenu(ui).first().press('ArrowDown');
  await expect(item(ui, 'Paste'), 'arrows move over the enabled rows').toBeFocused();
  await choose(ui, 'Select all');
  await expect.poll(() => ui.evaluate(() => (window as any).__term.hasSelection())).toBe(true);
  await ui.evaluate(() => (window as any).__term.clearSelection());
  // Copy and paste as the OS's own terminal: Linux's Ctrl+Shift+C / V, Windows' Ctrl+C / V (Windows Terminal's); a
  // paste lands once (Chromium's own paste and Kulisa's both pasted it); on Linux Ctrl+V and Ctrl+C go to the agent.
  // Every OS's keys, and the menu's.
  const keys = (keyCode: string, modifiers: ('control' | 'shift')[]) => core((k, a) => k.press(k.shell.win.webContents, a.keyCode, ...a.modifiers), { keyCode, modifiers });
  // macOS: ⌘V and ⌘C are the Edit menu's (its roles' keys, app.ts), which a key sent into the page does not reach.
  // The system runs those roles itself (Electron's MenuItem.click does not there): its row is there, and what it does
  // to the focused page is done.
  const edit = async (role: 'copy' | 'paste') => {
    expect(await core((k, r) => {
      const has = k.electron.Menu.getApplicationMenu().items.flatMap((i) => i.submenu?.items ?? []).some((i) => i.role === r);
      k.shell.win.webContents[r]();
      return has;
    }, role), `the Edit menu's ${role}`).toBe(true);
  };
  const copyKeys: ('control' | 'shift')[] = WIN ? ['control'] : ['control', 'shift'];
  const paste = () => (MAC ? edit('paste') : keys('V', copyKeys)), copy = () => (MAC ? edit('copy') : keys('C', copyKeys));
  const clipboard = { write: (t: string) => core((k, text) => k.electron.clipboard.writeText(text), t), read: () => core((k) => k.electron.clipboard.readText()) };
  const output = () => core((k) => k.ptyOutput());
  await clipboard.write('kulisa-paste');
  const before = (await output()).length;
  // Pressed again while nothing is pasted: the page reads the clipboard only while it has the focus, and on a loaded
  // machine the window manager's focus, coming late after another window went, may take it away for a moment; a read
  // refused pastes nothing, so a second press cannot paste twice.
  await expect(async () => {
    await focusWindow(core, ui); await termKeys(ui).focus();
    await paste();
    await expect.poll(async () => (await output()).slice(before).includes('kulisa-paste'), { timeout: 2000 }).toBe(true);
  }).toPass({ timeout: 12000 });
  await sentAll(core, ui);
  expect((await output()).slice(before).split('kulisa-paste').length - 1, 'pasted once').toBe(1);
  await clipboard.write('');
  await ui.evaluate(() => (window as any).__term.selectAll());
  await copy();
  await expect.poll(clipboard.read).toContain('kulisa-paste');
  await ui.evaluate(() => (window as any).__term.clearSelection());
  if (!WIN) { // Windows' Ctrl+C with nothing selected interrupts the agent (clipboardKey, below)
    // The key handled (macOS: the Edit menu's role, a copy event), and read where the page would write (one pipe).
    await seen(ui, MAC ? 'copy' : 'keydown', copy);
    expect(await ui.evaluate(() => navigator.clipboard.readText()), 'nothing selected: the clipboard is kept').toContain('kulisa-paste');
  }
  await keys('U', ['control']); // the agent's line emptied
  const key = (code: string, mods = {}) => ({ code, ctrlKey: true, ...mods });
  expect(await ui.evaluate((cases) => cases.map(([o, e, selected]) => (window as any).clipboardKey(e, o, selected)), [
    ['linux', key('KeyV', { shiftKey: true })], ['linux', key('KeyC', { shiftKey: true }), true], ['linux', key('KeyV')], ['linux', key('KeyC'), true],
    ['win32', key('KeyV')], ['win32', key('KeyC'), true], ['win32', key('KeyC'), false], ['win32', key('KeyV', { shiftKey: true })],
    ['darwin', key('KeyV')], ['darwin', key('KeyV', { ctrlKey: false, metaKey: true })],
    ['linux', { code: '', keyCode: 86, ctrlKey: true, shiftKey: true }]] as [string, object, boolean?][]), 'the keys of each OS; by keyCode when code is left out (ibus, Cyrillic)')
    .toEqual(['paste', 'copy', null, null, 'paste', 'copy', null, 'paste', null, null, 'paste']);
  expect(await ui.evaluate(() => [(window as any).keyText('terminal.copy'), (window as any).keyText('terminal.paste')]), "the menu's keys for this OS (main/keys.ts)")
    .toEqual(MAC ? ['⌘C', '⌘V'] : WIN ? ['Ctrl+C', 'Ctrl+V'] : ['Ctrl+Shift+C', 'Ctrl+Shift+V']);

  // Links in the terminal, marked by the agent (OSC 8) or in plain text: Ctrl+click asks where, at the pointer: a tab of
  // one of the open profiles, or the user's browser. A plain click, or an address that is not http(s), does nothing.
  const write = (text: string) => ui.evaluate((t) => new Promise((r) => (window as any).__term.write(t, r)), text);
  const osc8 = (uri: string, text: string) => `\x1b]8;;${uri}\x07${text}\x1b]8;;\x07`;
  await write(`\r\n${osc8(`${SITE}/app`, 'the app')} and ${osc8('https://example.com/docs', 'the docs')} ${osc8('javascript:alert(1)', 'a script')}\r\n`);
  expect(await ui.evaluate(() => (window as any).__term.options.linkHandler === (window as any).termLinks), "the agent's links (OSC 8) are Kulisa's").toBe(true);
  // Where a text starts on the screen (in a line as written, its wrapped rows joined; at the cell's middle, a row
  // lower with below): its cell from xterm's buffer (drawn on a canvas, no element per cell), on the screen's box.
  const spot = async (text: string, below = 0) => {
    const s = await ui.locator('[data-testid="terminal"] .xterm:visible .xterm-screen').boundingBox();
    const c = await ui.evaluate(([t0, bl]) => {
      const t = (window as any).__term, b = t.buffer.active;
      for (let row = t.rows - 1; row >= 0; row--) {
        if (b.getLine(b.viewportY + row).isWrapped) continue;
        let line = '', r = row;
        do line += b.getLine(b.viewportY + r).translateToString(); while (b.getLine(b.viewportY + ++r)?.isWrapped);
        const i = line.indexOf(t0);
        if (i >= 0) return { col: i % t.cols + 1.5, row: row + Math.floor(i / t.cols) + bl + 0.5, cols: t.cols, rows: t.rows };
      }
      return null;
    }, [text, below] as const);
    return { x: s.x + c.col * s.width / c.cols, y: s.y + c.row * s.height / c.rows };
  };
  // A path is a link once the main process says it exists (asked as the pointer comes over its line): its full path
  // shown on hover. An agent's link (OSC 8) is one at once: its address shown. With Ctrl (⌘) held, as a Ctrl+click
  // comes; let go after.
  const linkShown = ui.locator('[data-testid="terminal"] [title]:not([title=""])');
  const hoverAt = async (text: string, below: number, shown: string) => {
    const p = await spot(text, below);
    await ui.mouse.move(p.x, p.y);
    await expect(linkShown).toHaveAttribute('title', shown);
    return p;
  };
  const ctrlClick = async () => {
    await ui.keyboard.down('ControlOrMeta');
    await ui.mouse.down();
    await ui.mouse.up();
    await ui.keyboard.up('ControlOrMeta');
  };
  // Ctrl+click on a text once its link shows what it is.
  const pressAt = async (text: string, shown: string, below = 0) => {
    await hoverAt(text, below, shown);
    await frames(ui);
    await ctrlClick();
  };
  await hoverAt('the app', 0, `${SITE}/app`);
  await ui.mouse.down();
  await ui.mouse.up();
  await pressAt('a script', 'javascript:alert(1)');
  await frames(ui); // the link handler decides as it is called; a menu it opened would be drawn by now
  expect(await anyMenu(ui).count(), 'a plain click, or not http(s): nothing').toBe(0);
  const names: string[] = await ui.evaluate(() => (window as any).state.map((p: { name: string }) => p.name));
  await pressAt('the app', `${SITE}/app`);
  await expect(menu(ui)).toMatchAriaSnapshot(`
    - menu:
      - text: ${JSON.stringify(`${SITE}/app`)}
${names.map((x) => `      - menuitem ${JSON.stringify(`Open in ${x}`)}`).join('\n')}
      - menuitem "Open in your browser"`);
  // The keyboard moving within the window (its page getting it back puts it on the terminal) leaves the menu open.
  await termKeys(ui).focus();
  await frames(ui); // the focus's events handled as it moved; a menu closing would be gone by now
  expect(await menuOpen(ui), 'the keyboard moved within the window: the menu stays').toBe(true);
  const linked: string = await ui.evaluate(() => (window as any).state[0].id);
  const had = await core((k, id) => k.shell.profiles.get(id).tabs.length, linked);
  await choose(ui, `Open in ${names[0]}`);
  await expect.poll(() => core((k, a) => { const p = k.shell.profiles.get(a.linked); return p.tabs.length === a.had + 1 && p.get().url.startsWith(`${a.site}/app`); }, { linked, had, site: SITE })).toBe(true);
  await core((k, id) => { const p = k.shell.profiles.get(id); p.closeTab(p.get().id); }, linked);
  const opened = () => core((k) => [...k.openedExternally]); // app.ts: the user's browser, noted
  const wasOpened = (await opened()).length;
  await pressAt('the docs', 'https://example.com/docs');
  await expect(menu(ui)).toBeVisible();
  await choose(ui, 'Open in your browser');
  await expect.poll(async () => (await opened()).slice(wasOpened)).toEqual(['https://example.com/docs']);

  // A path that exists is a link too: absolute or relative to the task's folder, with :line, a folder, one wrapped
  // over two rows. Ctrl+click asks: Open (the OS's app) or Show in Folder; what would run when opened, only shown.
  const dir = path.join(await core((k) => k.shell.task.folder), 'kl-links'), long = `${'x'.repeat(await ui.evaluate(() => (window as any).__term.cols))}.txt`;
  fs.mkdirSync(dir);
  for (const f of ['a.txt', long]) fs.writeFileSync(path.join(dir, f), '');
  const run = path.join(dir, process.platform === 'win32' ? 'run.cmd' : 'run.sh'); // Windows: by its extension
  fs.writeFileSync(run, '#!/bin/sh\n', { mode: 0o755 });
  // A path that does not exist beside one that does: one answer for the line's paths (a link, shown on hover, says it came).
  const lines = ['see kl-links/a.txt:12.', run, 'kl-links/missing.txt or kl-links/a.txt', `${dir} here`, `kl-links/${long}`];
  await write(`\r\n${lines.join('\r\n')}\r\n`);
  const a = path.join(dir, 'a.txt');
  await core((k) => {
    const e = k.electron, g: any = k.stash.links = { openPath: e.shell.openPath, showItemInFolder: e.shell.showItemInFolder, files: [] };
    e.shell.openPath = async (p: string) => { g.files.push(`open ${p}`); return ''; };
    e.shell.showItemInFolder = (p: string) => { g.files.push(`show ${p}`); };
  });
  const handed = () => core((k): string[] => k.stash.links.files);
  const fileMenu = `
    - menu:
      - menuitem "Open"
      - menuitem "Show in Folder"`;
  try {
    // The menu has no heading: the path is in the terminal. Which file a link is, by what the OS is handed.
    const chooseFile = async (row: string) => { const n0 = (await handed()).length; await choose(ui, row); await expect.poll(async () => (await handed()).length).toBe(n0 + 1); };
    await pressAt('a.txt:12', a);
    await expect(menu(ui), 'relative, with :line').toMatchAriaSnapshot(fileMenu);
    await chooseFile('Open');
    await pressAt(run, run);
    await expect(menu(ui), 'it would run: shown only').toMatchAriaSnapshot(`
      - menu:
        - menuitem "Show in Folder"`);
    await chooseFile('Show in Folder');
    await pressAt(`${dir} here`, dir);
    await expect(menu(ui), 'a folder').toMatchAriaSnapshot(fileMenu);
    await chooseFile('Show in Folder');
    await pressAt(`kl-links/${long.slice(0, 10)}`, path.join(dir, long), 1);
    await expect(menu(ui), 'wrapped over two rows: one link').toMatchAriaSnapshot(fileMenu);
    await chooseFile('Show in Folder');
    // A file an agent marks as a link (OSC 8): Claude Code gives its path as it is, others a file:// address, with no
    // host or this computer's; another host's is no file here (below).
    const fileUrl = (host: string) => `file://${host}${url.pathToFileURL(path.join(dir, 'a.txt')).pathname}`;
    for (const uri of [path.join(dir, 'a.txt'), fileUrl(''), fileUrl(os.hostname())]) {
      await write(`${osc8(uri, 'marked-file')}\r\n`);
      await pressAt('marked-file', uri);
      await expect(menu(ui), uri).toMatchAriaSnapshot(fileMenu);
      await chooseFile('Show in Folder');
    }
    await hoverAt('kl-links/a.txt', 0, a); // its line's answer in (the lowest a.txt on the screen)
    const missing = await spot('kl-links/missing.txt');
    await ui.mouse.move(missing.x, missing.y);
    await frames(ui);
    await expect(linkShown, 'a path that does not exist is no link').toHaveCount(0);
    await ctrlClick();
    await frames(ui); // a menu the press opened would be drawn by now
    expect(await anyMenu(ui).count(), 'a path that does not exist is no link').toBe(0);
    await write(`${osc8(fileUrl('elsewhere.example'), 'other-host')}\r\n`);
    await hoverAt('other-host', 0, fileUrl('elsewhere.example'));
    await frames(ui);
    // The click asks the main process, which answers another host's file at once (no disk read): a question after
    // it is answered after it.
    await seen(ui, 'mouseup', ctrlClick);
    await ipcSettled(ui);
    await frames(ui);
    expect(await anyMenu(ui).count(), "another computer's file is not opened here").toBe(0);
    expect(await handed()).toEqual([`open ${a}`, `show ${run}`, `show ${dir}`, `show ${path.join(dir, long)}`, `show ${a}`, `show ${a}`, `show ${a}`]);
  } finally {
    await core((k) => { const g = k.stash.links; Object.assign(k.electron.shell, { openPath: g.openPath, showItemInFolder: g.showItemInFolder }); });
    await removed(dir);
  }

  await ui.locator('#windowMenu').click();
  // Theme, Tasks bar and Language each a menu beside its row (helpers.ts, windowSubmenu); the arrangements a row each,
  // the full words in the tooltip. No Exit on macOS: ⌘Q and the app menu's Quit there (components/TopBar.tsx).
  await expect(menu(ui)).toMatchAriaSnapshot(`
    - menu:
      - group "Zoom":
        - text: Zoom
        - menuitem "Zoom out"
        - text: 100%
        - menuitem "Zoom in"
      - menuitem "Theme"
      - menuitem "Tasks bar"
      - menuitem "Language"
      - text: Arrange workspace
      - menuitem "Stage above"
      - menuitem "Stage beside"
      - menuitem "Keyboard Shortcuts"
      - menuitem "Documentation"
      - menuitem "GitHub"
      - menuitem "Report a Problem…"
      - menuitem "About Kulisa"${MAC ? '' : `
      - menuitem "Exit"`}`);
  expect(await menu(ui).getByRole('menuitem').evaluateAll((rs) => rs.filter((r) => !r.querySelector('svg')).map((r) => r.ariaLabel || r.textContent)), 'each row with its icon').toEqual([]);
  const presets = menu(ui).locator('[data-preset]');
  expect(await presets.evaluateAll((bs) => bs.map((b) => !!(b as HTMLElement).title && !!b.querySelector('svg'))), 'a tooltip and an icon each').toEqual([true, true]);
  await anyMenu(ui).locator('[data-preset="columns"]').click();
  await expect(anyMenu(ui), 'a choice closes the menu').toHaveCount(0);
  await bothOn(core, ui, files);
  // ☰'s links open in the user's browser.
  await ui.locator('#windowMenu').click();
  await expect(menu(ui)).toBeVisible();
  await choose(ui, 'GitHub');
  await expect.poll(async () => (await opened()).slice(wasOpened)).toEqual(['https://example.com/docs', 'https://github.com/cosmotools/kulisa']);

  // Exit quits as the last window's × does: asked only when an agent works. On macOS the app menu's Quit (⌘Q) does
  // (no Exit there: above), its hidden window shown for the question.
  await core((k) => { k.shell.task.promptTarget().state = 'working'; });
  if (MAC) {
    await core((k) => {
      k.shell.win.hide();
      k.electron.Menu.getApplicationMenu().items[0].submenu.items.find((i) => i.accelerator === 'Command+Q').click();
    });
    await expect.poll(() => core((k) => k.shell.win.isVisible())).toBe(true);
  } else {
    await ui.locator('#windowMenu').click();
    await expect(menu(ui)).toBeVisible();
    await choose(ui, 'Exit');
  }
  expect((await answer(ui, false)).message).toBe('Quit Kulisa?');
  expect(await core((k) => !k.shell.win.isDestroyed() && k.shell.open.size > 0), 'Kulisa goes on when the human says no').toBe(true);
  await core((k) => { k.shell.task.promptTarget().state = null; });
});

test("menus with the mouse and the keyboard, as the OS's: a press on ☰, a drag to a row and the release there chooses it; a click opens, the next closes; a right-click's release over a row chooses nothing; Enter and the arrows; the keyboard back where it was; leaving the window closes it", async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  const rowAt = (label: string) => center(item(ui, label));
  const shortcuts = shortcutsDialog(ui);
  const press = (keyCode: string) => core((k, c) => k.press(k.shell.win.webContents, c), keyCode);
  const output = () => core((k) => k.ptyOutput());

  // Pressed on ☰, dragged to Keyboard Shortcuts, let go there: chosen.
  const menuButton = await center(ui.locator('#windowMenu'));
  const clickMenuButton = async () => { await ui.mouse.move(menuButton.x, menuButton.y); await ui.mouse.down(); await ui.mouse.up(); };
  await ui.mouse.move(menuButton.x, menuButton.y);
  await ui.mouse.down();
  await expect(menu(ui)).toBeVisible();
  const to = await rowAt('Keyboard Shortcuts');
  await ui.mouse.move(to.x, to.y);
  await ui.mouse.up();
  await expect(shortcuts).toBeVisible();
  await shortcuts.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(shortcuts).toHaveCount(0);

  // A click opens it (the click after the press is not a second toggle); a click on the same button closes it.
  await seen(ui, 'pointerup', clickMenuButton); // the press's mouse events are the menu's (Menus.tsx: preventDefault)
  await expect(menu(ui)).toBeVisible();
  expect(await anyMenu(ui).count(), 'open after the click').toBeGreaterThan(0);
  await clickMenuButton();
  await expect(anyMenu(ui)).toHaveCount(0);

  // The keyboard: Enter on ☰ opens it on its first row, ↓ goes to the next, Esc closes it, ☰ has the keyboard again.
  await ui.locator('#windowMenu').focus();
  await ui.keyboard.press('Enter'); // a key's whole sequence: a button acts on Enter's keypress, which press() sends none of
  await expect(menu(ui)).toBeVisible();
  await expect(ui.locator('[role="menu"][data-ready][data-state="open"]:focus-within')).toHaveCount(1);
  const first = await ui.locator(':focus').getAttribute('aria-label');
  await press('Down');
  await expect(ui.locator(':focus')).not.toHaveAccessibleName(first);
  await press('Escape');
  await expect(anyMenu(ui)).toHaveCount(0);
  await expect(ui.locator('#windowMenu')).toBeFocused();

  // A right-click in the terminal: on Linux the menu opens on the press, and letting go over a row chooses nothing; on
  // Windows it opens on the release, which chooses nothing either. Esc closes it, and the keyboard is back in the
  // terminal.
  await termKeys(ui).focus();
  await core((k) => k.electron.clipboard.writeText('kl-not-pasted'));
  const at = await center(ui.locator('[data-testid="terminal"] .xterm:visible .xterm-screen'));
  await ui.mouse.move(at.x, at.y);
  await ui.mouse.down({ button: 'right' });
  if (WIN) await ui.mouse.up({ button: 'right' });
  await expect(menu(ui)).toBeVisible();
  const before = (await output()).length;
  if (!WIN) {
    const paste = await rowAt('Paste');
    await ui.mouse.move(paste.x, paste.y);
    await seen(ui, 'mouseup', () => ui.mouse.up({ button: 'right' }));
  }
  expect(await anyMenu(ui).count(), 'still open').toBeGreaterThan(0);
  await sentAll(core, ui);
  expect((await output()).slice(before), 'nothing pasted').not.toContain('kl-not-pasted');
  await press('Escape');
  await expect(anyMenu(ui)).toHaveCount(0);
  await expect(ui.locator('[data-testid="terminal"]:focus-within'), 'the keyboard back in the terminal').toHaveCount(1);

  // A profile's page in the window taking the keyboard (as one loading did on macOS) leaves a menu open: the window is
  // not left, and the page's blur would close the menu under the hand.
  await focusWindow(core, ui);
  await clickMenuButton();
  await expect(menu(ui)).toBeVisible();
  // The window's page has lost the keyboard only for a moment when it is looked at (page-focus.ts gives it back): its
  // blur noted.
  await ui.evaluate(() => { const w = window as any; w.__blurred = false; addEventListener('blur', () => { w.__blurred = true; }, { once: true }); });
  expect(await core((k) => {
    const page = k.shell.profiles.values().next().value.get().wc, decided = k.focusDecided(page);
    page.focus();
    return decided;
  })).toBe('given back to the window');
  await expect.poll(() => ui.evaluate(() => (window as any).__blurred)).toBe(true);
  await frames(ui);
  expect(await menuOpen(ui), "the menu stays: the window's keyboard went to a page of its own").toBe(true);
  await closeMenu(ui);
  await focusWindow(core, ui);

  // Leaving the window (another one takes the focus) closes a menu, as the OS's own menus close.
  await clickMenuButton();
  await expect(menu(ui)).toBeVisible();
  try {
    await core((k) => {
      const e = k.electron, other = k.stash.otherWindow = new e.BrowserWindow({ width: 300, height: 200, show: false });
      // macOS makes a window key only in the active app, and the tests run while another one (the terminal) may be.
      if (process.platform === 'darwin') e.app.focus({ steal: true });
      other.show(); other.focus();
    });
    await expect(anyMenu(ui)).toHaveCount(0);
  } finally { await core((k) => { k.stash.otherWindow?.destroy(); }); }
  // The window has the keyboard again before the tests after: a menu opened while it has not closes at once. The
  // OS's focus waited for too: the page had it at once and the window manager's came later, its blur closing the
  // menu the next test opens (on a loaded machine).
  await core((k) => k.shell.win.focus());
  await expect.poll(() => core((k) => k.shell.win.isFocused())).toBe(true);
  await focusWindow(core, ui);
});

test('files dropped onto a terminal paste their disk paths once without sending the prompt', async ({ core, ui, files }) => {
  await begin(core, ui, files);
  const paths = ['plain.png', "image with spaces & 'quote'.png"].map((name) => path.join(files.project, name));
  for (const file of paths) fs.writeFileSync(file, 'image');
  const before = await core((k) => k.ptyOutput()), pageUrl = ui.url();
  const at = await center(ui.getByTestId('terminal'));
  // Native disk-backed Files are required by webUtils; a JavaScript File has no disk path.
  const cdp = await ui.context().newCDPSession(ui);
  try {
    for (const type of ['dragEnter', 'dragOver', 'drop'] as const) {
      await cdp.send('Input.dispatchDragEvent', { type, ...at, data: { items: [], files: paths, dragOperationsMask: 1 } });
    }
    // The fake agent runs in bash on every OS; Windows paths need quotes around their backslashes too.
    const expected = `${WIN ? `'${paths[0]}'` : paths[0]} '${paths[1].replace(/'/g, `'\\''`)}'`;
    await expect.poll(() => termText(ui)).toContain(expected);
    await sentAll(core, ui);
    const typed = await termText(ui);
    for (const p of paths) expect(typed.split(path.basename(p).split("'")[0]).length - 1, 'each path pasted once').toBe(1);
    if (!WIN) {
      const output = (await core((k) => k.ptyOutput())).slice(before.length);
      expect(output, 'the prompt is not submitted').not.toContain('\r');
      expect(output, 'the prompt is not submitted').not.toContain('\n');
    }
    expect(ui.url()).toBe(pageUrl);
    await expect(termKeys(ui)).toBeFocused();
  } finally { await cdp.detach(); }
});
