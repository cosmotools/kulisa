// A profile's pane as the human uses it next to the agent: where the keyboard stays, the tab strip, the toolbar and the
// address, Chrome's menu in a page, point and tell (docs/profiles.md, docs/window.md).
import fs from 'fs';
import path from 'path';
import { test, expect } from './fixtures.ts';
import type { Core } from './fixtures.ts';
import type { Locator } from '@playwright/test';
import { SITE, upTo, frames, echoed, focusWindow, pageBox, termText, termShows, act, invoke, termKeys } from './helpers.ts';
import { profiles, opened } from './agent-helpers.ts';

// The shown terminal's keyboard (xterm's own field).

test('the keyboard stays where the human put it: a tab the agent opens, its page loading, does not take it', async ({ core, ui, call }) => {
  await profiles(core);
  // The human typing to the agent in the terminal: on macOS a tab the agent opens takes the keyboard as its page
  // loads, and the next keys go to the site, unless kept (page-focus.ts).
  await focusWindow(core, ui);
  await termKeys(ui).focus();
  await expect.poll(() => core((k) => k.shell.windows[0].keyZone)).toBe('terminal');
  const id = opened(await call('browser_tab_new', { profile: 'Elon.buyer', url: 'data:text/html,<input autofocus>' }));
  // The page taking the keyboard by itself, as one loading does on macOS: given back (page-focus.ts).
  expect(await core(async (k, t) => {
    const tab = k.profile('Elon.buyer').get(t);
    await tab.ready;
    const decided = k.focusDecided(tab.wc);
    tab.wc.focus();
    return decided;
  }, id)).toBe('given back to the window');
  await expect(termKeys(ui), 'still in the terminal').toBeFocused();
  expect(await ui.evaluate(() => document.hasFocus()), 'the window has the keyboard (Playwright reads no window focus)').toBe(true);
  await call('browser_tab_close', { profile: 'Elon.buyer', tab: id });
  await expect.poll(() => core((k) => k.profile('Elon.buyer').tabs.length)).toBe(1);
});

test('tab strip: + opens a tab with the focus in its empty address, a click on a tab makes it active, × closes it', async ({ core, ui }) => {
  const { elon } = await profiles(core);
  const state = () => core((k) => { const e = k.profile('Elon.buyer'); return { active: e.active, tabs: e.tabs.length }; });
  const pane = ui.locator(`[role="region"][data-profile="${elon}"]`), strip = pane.getByRole('navigation', { name: 'Tabs' });
  const { active: first, tabs: n } = await state();
  // Its element kept in the page, to tell it is the same one after (Playwright tells no element from another).
  await strip.locator(`[data-tab="${first}"]`).evaluate((t) => { (window as any).__firstTab = t; });
  await strip.getByRole('button', { name: 'New tab' }).click();
  await expect.poll(async () => { const s = await state(); return s.tabs === n + 1 && s.active !== first; }).toBe(true);
  // The strip keeps its tabs' elements; the new one grows in (data-opening, until its animation ends), as Chrome's.
  const added = (await state()).active;
  await expect(strip.locator(`[data-tab="${added}"]`)).toHaveCount(1);
  expect(await strip.locator(`[data-tab="${first}"]`).evaluate((t) => t === (window as any).__firstTab), 'the first tab\'s element stays').toBe(true);
  await expect(strip.locator('[role="tab"][data-opening]')).toHaveCount(0);
  await expect(pane.locator('[aria-label="Address"]')).toBeFocused();
  await expect(pane.locator('[aria-label="Address"]')).toHaveValue('');
  await expect(pane.locator('[aria-label="Address"]'), 'what to type there').toHaveAttribute('placeholder', 'Search Google or type a URL');
  // The keys go there, not to the new tab's page (a native view that would take the focus as it loads). Where the
  // keys go inside the window; when another app on the desktop is active (it may take the focus while the tests
  // run), no view has them, and Kulisa rightly leaves it so.
  const keys = () => core((k, id) => {
    const page = k.profile('Elon.buyer').get(id).wc, win = k.shell.win;
    return !win.isFocused() ? 'another app' : win.webContents.isFocused() ? 'window' : page.isFocused() ? 'page' : 'none';
  }, added);
  // The page taking the keyboard by itself, as one loading does on macOS: given back (page-focus.ts).
  expect(await core(async (k, id) => {
    const tab = k.profile('Elon.buyer').get(id);
    await tab.ready;
    const decided = k.focusDecided(tab.wc);
    tab.wc.focus();
    return decided;
  }, added)).toBe('given back to the window');
  expect(['window', 'another app'], 'the window has the focus, not the page').toContain(await keys());
  // A click into the page gives it the keys, and they stay there.
  expect(await core((k, id) => {
    const page = k.profile('Elon.buyer').get(id).wc, decided = k.focusDecided(page);
    page.sendInputEvent({ type: 'mouseDown', x: 20, y: 20, button: 'left', clickCount: 1 }); page.sendInputEvent({ type: 'mouseUp', x: 20, y: 20, button: 'left', clickCount: 1 });
    page.focus();
    return decided;
  }, added)).toBe("left (the human's)");
  expect(['page', 'another app'], 'the page keeps the focus once clicked').toContain(await keys());
  await pane.locator('[aria-label="Address"]').blur();
  await expect(strip.getByRole('tab')).toHaveCount(n + 1);
  await strip.locator(`[data-tab="${first}"]`).click();
  await expect.poll(async () => (await state()).active).toBe(first);
  await strip.getByRole('tab').last().getByTitle('Close tab').click();
  await expect.poll(async () => (await state()).tabs).toBe(n);
  // With reduced motion (the OS's setting, emulated) it does not grow, and is not left growing: no animation ends
  // there, and the tab would stay opening.
  await ui.emulateMedia({ reducedMotion: 'reduce' });
  try {
    await strip.getByRole('button', { name: 'New tab' }).click();
    await expect.poll(async () => (await state()).tabs).toBe(n + 1);
    await expect(strip.locator(`[data-tab="${(await state()).active}"]`)).toHaveCount(1);
    // Marked growing as it is added (lib/strip.ts: a MutationObserver's, before anything else runs), unmarked when an
    // animation ends: none ends here.
    expect(await strip.locator('[role="tab"][data-opening]').count(), 'not growing').toBe(0);
    await core((k) => { const e = k.profile('Elon.buyer'); e.closeTab(e.active); });
    await expect.poll(async () => (await state()).tabs).toBe(n);
  } finally { await ui.emulateMedia({ reducedMotion: null }); }
});

test('many tabs: they shrink as in Chrome; the strip, the toolbar and the page stay inside the pane', async ({ core, ui, files }) => {
  const { sam, elon } = await profiles(core);
  const n = await core((k) => k.profile('Elon.buyer').tabs.length);
  const pane = `[role="region"][data-profile="${elon}"]`;
  const before = await pageBox(ui, files, 'Elon.buyer');
  // A lone tab has its full width (220px, as Chrome's), not shrunk while there is room.
  expect(Math.round((await ui.locator(`[role="region"][data-profile="${sam}"] [role="tab"]`).boundingBox()).width)).toBe(220);
  for (let i = 0; i < 24; i++) await act(ui, 'tab:new', { profile: elon });
  await expect(ui.locator(`${pane} [role="tab"]`)).toHaveCount(n + 24);
  await expect(ui.locator(`${pane} [role="tab"][data-opening]`)).toHaveCount(0); // grown in
  // Nothing past the pane's right edge, nor scrolling it or its group (Playwright reads no scroll).
  const right = async (l: Locator) => { const r = await l.boundingBox(); return r.x + r.width; };
  const edge = await right(ui.locator(pane)), nav = ui.locator(`${pane} nav[aria-label="Tabs"]`), add = nav.getByRole('button', { name: 'New tab' });
  for (const l of [nav, add, ui.locator(`${pane} [aria-label="More"]`)]) expect(await right(l)).toBeLessThanOrEqual(edge);
  expect(await ui.locator(pane).evaluate((p) => [p.scrollWidth <= p.clientWidth, p.closest('.dv-groupview').scrollWidth <= p.closest('.dv-groupview').clientWidth])).toEqual([true, true]);
  // The active one (the last opened) in sight; every one its icon and × (not the active one alone, as Chrome's: the
  // author's choice).
  const active = nav.locator('[role="tab"][aria-selected="true"]'), other = nav.locator('[role="tab"]:not([aria-selected="true"])').first();
  const a = await active.boundingBox(), r = await nav.boundingBox(), plus = await add.boundingBox();
  expect(a.x >= r.x && a.x + a.width <= plus.x, 'the active one in sight').toBe(true);
  expect(await right(nav.getByRole('tablist')), 'nothing under +').toBeLessThanOrEqual(plus.x);
  await expect(active.getByTitle('Close tab')).toBeVisible();
  await expect(other.getByTestId('tab-icon'), 'its icon').toBeVisible();
  const title = other.getByText(await other.getAttribute('aria-label'), { exact: true });
  await expect(title).toHaveCount(1);
  await expect(title, 'no title').toBeHidden();
  await expect(other.getByTitle('Close tab')).toBeVisible();
  expect(await pageBox(ui, files, 'Elon.buyer'), 'the page keeps its place and size').toEqual(before);
  // Past that the strip scrolls (lib/strip.ts): the edge with tabs past it fades; a mouse's wheel scrolls it; a tab
  // not shown that changes (its page loads, its title) leaves it where the human scrolled it, not back at the active
  // one. Where it is scrolled to, and how far it can be: Playwright reads no scroll.
  const s = ui.locator(`${pane} [role="tablist"]`);
  const at = () => s.evaluate((e) => [Math.round(e.scrollLeft), e.scrollWidth - e.clientWidth] as [number, number]);
  // Scrolled to the active one at the end, the start faded.
  await expect.poll(async () => { const [left, max] = await at(); return max > 0 && left === max; }).toBe(true);
  await expect(s).toHaveAttribute('data-past-start');
  await expect(s).not.toHaveAttribute('data-past-end');
  await s.hover();
  await ui.mouse.wheel(0, -100000); // up: to the start
  await expect.poll(async () => (await at())[0]).toBe(0);
  await expect(s).toHaveAttribute('data-past-end');
  await expect(s).not.toHaveAttribute('data-past-start');
  const changed = await core((k, a) => { const e = k.profile('Elon.buyer'), id = e.tabs[a.n].id; e.navigate(id, a.url); return id; }, { n, url: `${SITE}/app?n=strip` });
  await expect(s.locator(`[data-tab="${changed}"]`)).toHaveAttribute('title', /n=strip/);
  await frames(ui); // what a change brings it into sight by (a resize's observer, the next update) has run
  expect((await at())[0], 'stays where the wheel took it').toBe(0);
  await core((k, from) => { const e = k.profile('Elon.buyer'); for (const t of e.tabs.slice(from)) e.closeTab(t.id); }, n);
  await expect.poll(() => core((k) => k.profile('Elon.buyer').tabs.length)).toBe(n);
});

test('back and forward buttons are enabled only when there is somewhere to go', async ({ core, call, ui }) => {
  const { sam } = await profiles(core);
  const pane = ui.locator(`[role="region"][data-profile="${sam}"]`);
  const back = pane.locator('[aria-label="Back"]'), forward = pane.locator('[aria-label="Forward"]');
  await call('browser_navigate', { profile: 'Sam.seller', url: `${SITE}/app?n=1` });
  await call('browser_navigate', { profile: 'Sam.seller', url: `${SITE}/app?n=2` });
  await expect(back).toBeEnabled();
  await expect(forward).toBeDisabled();
  await back.click();
  await expect(back).toBeEnabled();
  await expect(forward).toBeEnabled();
  // The buttons change as the back navigation starts; it lands after, in the tab and in the pane (on a slow machine the
  // pane may show n=2 while the tab is on n=1).
  await expect.poll(() => core((k) => k.profile('Sam.seller').get().url)).toMatch(/n=1$/);
  await expect(pane.locator('[aria-label="Address"]')).toHaveValue(/n=1$/);
});

test('the address as in Chrome: shown without http(s)://, a click shows all of it selected; a second click places the caret', async ({ core, ui }) => {
  const { sam } = await profiles(core);
  const addr = ui.locator(`[role="region"][data-profile="${sam}"] [aria-label="Address"]`);
  const b = await addr.boundingBox();
  await core((k) => k.shell.win.webContents.focus()); // not in a page
  const click = () => addr.click({ position: { x: Math.round(b.width / 3), y: Math.round(b.height / 2) } });
  // What is selected in it: Playwright reads no selection.
  const sel = () => addr.evaluate((a: HTMLInputElement) => [a.selectionStart, a.selectionEnd, a.value.length] as [number, number, number]);
  const full = await core((k) => k.profile('Sam.seller').get().wc.getURL());
  expect(full.startsWith('http://'), full).toBe(true);
  await expect(addr).toHaveValue(full.replace('http://', ''));
  await click();
  await expect(addr).toBeFocused();
  await expect.poll(async () => { const [start, end, n] = await sel(); return start === 0 && end === n && n > 0; }).toBe(true);
  await expect(addr).toHaveValue(full);
  await click(); // a click of its own, not the second of a double-click: Playwright's clicks each say clickCount 1
  await expect(addr).toBeFocused();
  await expect.poll(async () => { const [start, end] = await sel(); return start === end; }).toBe(true);
  await addr.blur();
  await expect(addr).toHaveValue(full.replace('http://', ''));
});

// A function run in the main process with page-menu.ts's module, Elon's page (Kulisa's own Playwright on it) and its
// tab's webContents; only data crosses.
type Menus = { shownMenu: () => { rows: object[]; menu: Electron.Menu } | null };
const inMenus = <A, R>(core: Core, fn: (m: Menus, page: any, wc: Electron.WebContents, k: any, a: A) => R | Promise<R>, arg?: A) => core(async (k, x) => {
  const m = k.pageMenu;
  const elon = k.profile('Elon.buyer');
  return (0, eval)(`(${x.src})`)(m, await elon.page(), elon.get().wc, k, x.arg);
}, { src: fn.toString(), arg }) as Promise<R>;

test("a right-click in a page shows Chrome's menu for what is under it; a site's own menu stays the site's; the agent's right-click opens none", async ({ core }) => {
  await profiles(core);
  await inMenus(core, (_m, page, _wc, _k, url) => page.goto(url), `${SITE}/menu`);
  // The human's right-click: as the mouse sends it, through the window.
  const rightClick = (sel: string) => inMenus(core, async (_m, page, wc, _k, s) => {
    const b = await page.locator(s).boundingBox(), x = Math.round(b.x + b.width / 2), y = Math.round(b.y + b.height / 2);
    wc.sendInputEvent({ type: 'mouseMove', x, y });
    wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'right', clickCount: 1 });
    wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'right', clickCount: 1 });
  }, sel);
  const shown = () => inMenus(core, (m) => !!m.shownMenu());
  // On macOS a menu asked for while the last one is still closing is not shown: right-clicked again until one is.
  const menuAt = (sel: string) => expect(async () => { await rightClick(sel); await expect.poll(shown, { timeout: 1000 }).toBe(true); }).toPass();
  const rows = () => inMenus(core, (m) => m.shownMenu().rows.map((r) => ('id' in r ? r.id : 'role' in r ? r.role : '-')));
  const close = async () => { await inMenus(core, (m, _p, _wc, k) => m.shownMenu().menu.closePopup(k.shell.win)); await expect.poll(shown).toBe(false); };
  const choose = (label: string) => inMenus(core, (m, _p, _wc, _k, l) => { m.shownMenu().menu.items.find((i) => i.label === l).click(); }, label);
  const elon = () => core((k) => { const e = k.profile('Elon.buyer'); return { tabs: e.tabs.map((t) => ({ id: t.id, url: t.url })), active: e.active }; });

  // A menu left open holds the main process's events on macOS (its menu's own loop): every later test failed with it.
  try {
    await menuAt('#link');
    // macOS selects the word under a right-click, and a selection has its Copy, as in Chrome there.
    const selected = await inMenus(core, (_m, page) => page.evaluate(() => !!getSelection().toString()));
    expect(await rows()).toEqual(['link.open', 'link.copy', '-', ...(selected ? ['copy', 'selection.send', '-'] : []), 'pick', 'screenshot', '-', 'inspect']);
    const was = await elon();
    await choose('Open Link in New Tab'); // the row's action, as its click: the menu itself stays until closed
    await close();
    await expect.poll(async () => (await elon()).tabs.length).toBe(was.tabs.length + 1);
    const now = await elon(), added = now.tabs.at(-1).id;
    expect(now.active, 'opened behind, as Chrome does').toBe(was.active);
    await expect.poll(async () => (await elon()).tabs.at(-1).url).toBe(`${SITE}/app`);
    await core((k, id) => k.profile('Elon.buyer').closeTab(id), added);

    await menuAt('#field');
    const fieldSelected = await inMenus(core, (_m, page) => page.locator('#field').evaluate((e: HTMLInputElement) => e.selectionStart !== e.selectionEnd));
    expect(await rows()).toEqual(['undo', 'redo', '-', 'cut', 'copy', 'paste', 'selectAll', ...(fieldSelected ? ['selection.send'] : []), '-', 'pick', 'screenshot', '-', 'inspect']);
    await close();

    await menuAt('#blank');
    expect(await rows()).toEqual(['tab.back', 'tab.forward', 'tab.reload', '-', 'pick', 'screenshot', '-', 'inspect']);
    expect(await inMenus(core, (m) => m.shownMenu().menu.items.slice(0, 2).map((i) => i.enabled)), 'Back after a page, no Forward').toEqual([true, false]);
    await close();

    // A site with a menu of its own (Teams, Google Docs) keeps it: Chromium asks for none. What the page asked for
    // (context-menu, heard after Kulisa's own listener) is known once a right-click after it has asked: the page
    // handles its input in order.
    await core((k) => {
      const g = k.stash, Menu = k.electron.Menu.prototype;
      g.asked = []; g.popups = 0; g.popup = Menu.popup;
      Menu.popup = function (this: Electron.Menu, ...a: unknown[]) { g.popups++; return g.popup.apply(this, a); };
      k.profile('Elon.buyer').get().wc.on('context-menu', g.heard = (_e: unknown, p: { linkURL: string }) => { g.asked.push(p.linkURL); });
    });
    const asked = () => core((k): string[] => k.stash.asked);
    await rightClick('#own');
    await expect.poll(() => inMenus(core, (_m, page) => page.locator('#own').textContent())).toBe('its own menu');
    await menuAt('#link');
    expect(await asked(), "none over a site's own menu: every one asked is the link's").toEqual(expect.arrayContaining([`${SITE}/app`]));
    expect((await asked()).every((u) => u === `${SITE}/app`), JSON.stringify(await asked())).toBe(true);
    await close();

    // The agent's right-click (Playwright, as its own scripts may do) opens nothing that would hold the human's pointer:
    // its menu asked for, Kulisa decides in its listener, before the test's hears it.
    await core((k) => { k.stash.asked = []; k.stash.popups = 0; });
    await inMenus(core, (_m, page) => page.locator('#link').click({ button: 'right' }));
    await expect.poll(async () => (await asked()).length).toBe(1);
    expect(await core((k) => k.stash.popups), 'none for the agent').toBe(0);
    expect(await shown()).toBe(false);
  } finally {
    await inMenus(core, (m, _p, _wc, k) => m.shownMenu()?.menu.closePopup(k.shell.win));
    await core((k) => {
      const g = k.stash;
      if (g.popup) k.electron.Menu.prototype.popup = g.popup;
      if (g.heard) k.profile('Elon.buyer').get().wc.off('context-menu', g.heard);
    });
  }
});

test('point and tell: a pick puts a reference into the agent\'s prompt, not sent', async ({ core, ui, files }) => {
  const { elon } = await profiles(core);
  // Pay now clicked: its error logged, its request failed.
  const b = await core(async (k, url) => {
    const page = await k.profile('Elon.buyer').page();
    await page.goto(url);
    await page.locator('#pay').click();
    await page.getByText('HTTP 500').waitFor();
    return page.locator('#pay').boundingBox();
  }, `${SITE}/errors`);
  const pending = invoke(ui, 'pick:start', { profile: elon }) as Promise<{ locator: string; tab: string }>;
  await expect.poll(() => core((k, id) => k.shell.windows[0].picking.has(id), elon)).toBe(true);
  const at = { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
  // Pick mode reaches the page a moment after it starts (Playwright's recorder in the page learns it by a message, or
  // by polling once a second), and says nothing when: a click before goes to the page (Pay now again), so it clicks
  // again, as the human would, until the pick comes.
  let pick: { locator: string; tab: string } | null = null;
  await expect(async () => {
    await core((k, { x, y }) => {
      const wc = k.profile('Elon.buyer').get().wc;
      wc.sendInputEvent({ type: 'mouseMove', x, y });
      wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
      wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
    }, at);
    pick = await upTo(pending, 500);
    expect(pick, 'picked').toBeTruthy();
  }).toPass({ timeout: 10000 });
  expect(pick.locator).toBe("getByRole('button', { name: 'Pay now' })");
  expect(pick.tab).toBe(await core((k) => k.profile('Elon.buyer').active));
  expect(fs.existsSync(path.join(files.project, '.kulisa')), 'nothing is written into the project').toBe(false);
  const ref = `[kulisa pick: Elon.buyer tab ${pick.tab} getByRole('button', { name: 'Pay now' })]`;
  await termShows(ui, ref);
  // The agent here is `cat`: the terminal echoes typed input, and cat prints it again only after Enter. Once
  // means it waits in the prompt for the human to write about it. Not sent: a mark typed after it is echoed on its line
  // (the terminal echoes in the order it is typed, an Enter too). The screen's text, not the
  // output: Windows' ConPTY sends a line again as it redraws it, and the paste's marks in the middle of its echo.
  const mark = 'klmark';
  await core((k, m) => k.shell.pty.write(m), mark);
  await termShows(ui, mark);
  const text = await termText(ui);
  const after = text.slice(text.lastIndexOf(ref)).trimEnd(); // the paste's end mark (^[[201~) between
  expect(!after.includes('\n') && after.endsWith(mark), text).toBe(true);
  expect(text.split(ref).length - 1, text).toBe(1);
  await expect(termKeys(ui), 'the terminal has focus').toBeFocused();
  await core((k) => k.shell.pty.write('\x15')); // Ctrl+U: the line cleared, nothing sent
});

test('point and tell: Pick again or Esc in the page cancels it; nothing goes to the prompt', async ({ core, ui }) => {
  const { elon } = await profiles(core);
  const button = ui.locator(`[role="region"][data-profile="${elon}"] [aria-label="Pick an element"]`);
  const picking = () => core((k, id) => k.shell.windows[0].picking.has(id), elon);
  const before = (await core((k) => k.ptyOutput())).length;
  for (const cancel of ['button', 'esc']) {
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(picking).toBe(true);
    if (cancel === 'button') await button.click();
    else await core((k) => { const wc = k.profile('Elon.buyer').get().wc; wc.focus(); k.press(wc, 'Escape'); });
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(picking).toBe(false);
    await expect(ui.locator(`[data-panel="profile:${elon}"] [role="status"]`), cancel).toHaveText('');
  }
  // A pick types its reference as it ends (picker.ts), before Kulisa says it no longer picks: echoed before what is
  // typed after.
  await echoed(core);
  expect((await core((k) => k.ptyOutput())).slice(before).includes('kulisa pick')).toBe(false);
});

