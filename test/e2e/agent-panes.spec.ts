// A profile's pane as the human uses it next to the agent: where the keyboard stays, the tab strip, the toolbar and the
// address, Chrome's menu in a page, point and tell (docs/profiles.md, docs/window.md).
import fs from 'fs';
import path from 'path';
import { test, expect } from './fixtures.ts';
import type { Core } from './fixtures.ts';
import { SITE, sleep, focusWindow, box, pageBox, termText, termShows, act, invoke } from './helpers.ts';
import { profiles, opened } from './agent-helpers.ts';

test('the keyboard stays where the human put it: a tab the agent opens, its page loading, does not take it', async ({ core, ui, call }) => {
  await profiles(core);
  // The human typing to the agent in the terminal: on macOS a tab the agent opens takes the keyboard as its page
  // loads, and the next keys go to the site, unless kept (page-focus.ts).
  await focusWindow(core, ui);
  await ui.evaluate(() => (window as any).__term.focus());
  await expect.poll(() => core((k) => k.shell.windows[0].keyZone)).toBe('terminal');
  const id = opened(await call('browser_tab_new', { profile: 'Elon.buyer', url: 'data:text/html,<input autofocus>' }));
  await core((k, t) => k.profile('Elon.buyer').get(t).ready, id);
  await sleep(500); // nothing to wait for: that the keyboard is not taken (page-focus.ts gives it back after 150 ms)
  expect(await ui.evaluate(() => [document.hasFocus(), !!document.activeElement.closest('.term')]), 'still in the terminal').toEqual([true, true]);
  await call('browser_tab_close', { profile: 'Elon.buyer', tab: id });
  await expect.poll(() => core((k) => k.profile('Elon.buyer').tabs.length)).toBe(1);
});

test('tab strip: + opens a tab with the focus in its empty address, a click on a tab makes it active, × closes it', async ({ core, ui }) => {
  const { elon } = await profiles(core);
  const state = () => core((k) => { const e = k.profile('Elon.buyer'); return { active: e.active, tabs: e.tabs.length }; });
  const pane = ui.locator(`.pane[data-profile="${elon}"]`), strip = pane.locator('.tabs');
  const { active: first, tabs: n } = await state();
  await strip.locator(`.tab[data-tab="${first}"]`).evaluate((t) => { (window as any).__firstTab = t; });
  await strip.locator('.add').click();
  await expect.poll(async () => { const s = await state(); return s.tabs === n + 1 && s.active !== first; }).toBe(true);
  // The strip keeps its tabs' elements; the new one grows in (data-opening, until its animation ends), as Chrome's.
  const added = (await state()).active;
  await expect(strip.locator(`.tab[data-tab="${added}"]`)).toHaveCount(1);
  expect(await strip.locator(`.tab[data-tab="${first}"]`).evaluate((t) => t === (window as any).__firstTab), 'the first tab\'s element stays').toBe(true);
  await expect(strip.locator('.tab[data-opening]')).toHaveCount(0);
  await expect(pane.locator('.addr')).toBeFocused();
  await expect(pane.locator('.addr')).toHaveValue('');
  // The keys go there, not to the new tab's page (a native view that would take the focus as it loads). Where the
  // keys go inside the window; when another app on the desktop is active (it may take the focus while the tests
  // run), no view has them, and Kulisa rightly leaves it so.
  const keys = () => core((k, id) => {
    const page = k.profile('Elon.buyer').get(id).wc, win = k.shell.win;
    return !win.isFocused() ? 'another app' : win.webContents.isFocused() ? 'window' : page.isFocused() ? 'page' : 'none';
  }, added);
  await core((k, id) => k.profile('Elon.buyer').get(id).ready, added);
  await sleep(500); // nothing to wait for: that the page does not take them
  expect(['window', 'another app'], 'the window has the focus, not the page').toContain(await keys());
  // A click into the page gives it the keys, and they stay there.
  await core((k, id) => {
    const page = k.profile('Elon.buyer').get(id).wc;
    page.sendInputEvent({ type: 'mouseDown', x: 20, y: 20, button: 'left', clickCount: 1 }); page.sendInputEvent({ type: 'mouseUp', x: 20, y: 20, button: 'left', clickCount: 1 });
    page.focus();
  }, added);
  await sleep(300); // nothing to wait for: that they stay
  expect(['page', 'another app'], 'the page keeps the focus once clicked').toContain(await keys());
  await ui.evaluate(() => (document.activeElement as HTMLElement).blur());
  await expect(strip.locator('.tab')).toHaveCount(n + 1);
  await strip.locator(`.tab[data-tab="${first}"] .title`).click();
  await expect.poll(async () => (await state()).active).toBe(first);
  await strip.locator('.tab:last-of-type .x').click();
  await expect.poll(async () => (await state()).tabs).toBe(n);
  // With reduced motion (the OS's setting, emulated) it does not grow, and is not left growing: no animation ends
  // there, and the tab would stay opening.
  await ui.emulateMedia({ reducedMotion: 'reduce' });
  try {
    await strip.locator('.add').click();
    await expect.poll(async () => (await state()).tabs).toBe(n + 1);
    await expect(strip.locator(`.tab[data-tab="${(await state()).active}"]`)).toHaveCount(1);
    await sleep(300); // nothing to wait for: that it is not left growing
    await expect(strip.locator('.tab[data-opening]')).toHaveCount(0);
    await core((k) => { const e = k.profile('Elon.buyer'); e.closeTab(e.active); });
    await expect.poll(async () => (await state()).tabs).toBe(n);
  } finally { await ui.emulateMedia({ reducedMotion: null }); }
});

test('many tabs: they shrink as in Chrome; the strip, the toolbar and the page stay inside the pane', async ({ core, ui, files }) => {
  const { sam, elon } = await profiles(core);
  const n = await core((k) => k.profile('Elon.buyer').tabs.length);
  const pane = `.pane[data-profile="${elon}"]`;
  const before = await pageBox(ui, files, 'Elon.buyer');
  // A lone tab has its full width (220px, as Chrome's), not shrunk while there is room.
  expect(await ui.locator(`.pane[data-profile="${sam}"] .tabs .tab`).evaluate((t) => Math.round(t.getBoundingClientRect().width))).toBe(220);
  for (let i = 0; i < 24; i++) await act(ui, 'tab:new', { profile: elon });
  await expect(ui.locator(`${pane} .tabs .tab`)).toHaveCount(n + 24);
  await expect(ui.locator(`${pane} .tabs .tab[data-opening]`)).toHaveCount(0); // grown in
  const fit = await ui.locator(pane).evaluate((p) => {
    const r = (q: string) => p.querySelector(q).getBoundingClientRect(), pr = p.getBoundingClientRect(), g = p.closest('.dv-groupview');
    return { pane: p.scrollWidth <= p.clientWidth, tabs: r('.tabs').right <= pr.right, add: r('.tabs .add').right <= pr.right, more: r('.more').right <= pr.right,
      group: g.scrollWidth <= g.clientWidth };
  });
  expect(fit).toEqual({ pane: true, tabs: true, add: true, more: true, group: true });
  // The active one (the last opened) in sight; every one its icon and × (not the active one alone, as Chrome's: the
  // author's choice).
  const strip = await ui.locator(`${pane} .tabs`).evaluate((s) => {
    const r = s.getBoundingClientRect(), a = s.querySelector('.tab.active').getBoundingClientRect();
    const other = s.querySelector('.tab:not(.active)'), shown = (e: Element) => getComputedStyle(e).display !== 'none';
    return { activeInSight: a.left >= r.left && a.right <= s.querySelector('.add').getBoundingClientRect().left,
      nothingUnderAdd: s.querySelector('.strip').getBoundingClientRect().right <= s.querySelector('.add').getBoundingClientRect().left,
      activeX: shown(s.querySelector('.tab.active .x')), otherIcon: shown(other.querySelector('.globe')) || shown(other.querySelector('img')), otherTitle: shown(other.querySelector('.title')),
      otherX: shown(other.querySelector('.x')) };
  });
  // + and a tab's × are the same icon size.
  expect(await ui.locator(`${pane} .tabs`).evaluate((s) => ['.tab.active .x svg', '.add svg'].map((q) => s.querySelector(q).getBoundingClientRect().width))).toEqual([14, 14]);
  expect(strip).toEqual({ activeInSight: true, nothingUnderAdd: true, activeX: true, otherIcon: true, otherTitle: false, otherX: true });
  expect(await pageBox(ui, files, 'Elon.buyer'), 'the page keeps its place and size').toEqual(before);
  // Past that the strip scrolls (lib/strip.ts): the edge with tabs past it fades; a mouse's wheel scrolls it; a tab
  // not shown that changes (its page loads, its title) leaves it where the human scrolled it, not back at the active
  // one.
  const s = ui.locator(`${pane} .strip`);
  const at = () => s.evaluate((e) => [Math.round(e.scrollLeft), e.scrollWidth - e.clientWidth, ['past-start', 'past-end'].filter((c) => e.classList.contains(c)).join(' ')] as [number, number, string]);
  await expect.poll(async () => { const [left, max, faded] = await at(); return max > 0 && left === max && faded === 'past-start'; }).toBe(true); // scrolled to the active one at the end, the start faded
  const b = await box(ui, `${pane} .strip`);
  await core((k, r) => { // up: to the start
    const z = k.shell.win.webContents.getZoomFactor();
    k.shell.win.webContents.sendInputEvent({ type: 'mouseWheel', x: Math.round((r.x + r.width / 2) * z), y: Math.round((r.y + r.height / 2) * z), deltaX: 0, deltaY: 100000 });
  }, b);
  await expect.poll(async () => (await at())[0]).toBe(0);
  await expect.poll(async () => (await at())[2]).toBe('past-end');
  const changed = await core((k, a) => { const e = k.profile('Elon.buyer'), id = e.tabs[a.n].id; e.navigate(id, a.url); return id; }, { n, url: `${SITE}/app?n=strip` });
  await expect(s.locator(`.tab[data-tab="${changed}"]`)).toHaveAttribute('title', /n=strip/);
  await sleep(200); // nothing to wait for: that it stays
  expect((await at())[0], 'stays where the wheel took it').toBe(0);
  await core((k, from) => { const e = k.profile('Elon.buyer'); for (const t of e.tabs.slice(from)) e.closeTab(t.id); }, n);
  await expect.poll(() => core((k) => k.profile('Elon.buyer').tabs.length)).toBe(n);
});

test('back and forward buttons are enabled only when there is somewhere to go', async ({ core, call, ui }) => {
  const { sam } = await profiles(core);
  const pane = ui.locator(`.pane[data-profile="${sam}"]`);
  const buttons = () => pane.locator('.back, .fwd').evaluateAll((bs) => bs.map((b) => (b as HTMLButtonElement).disabled));
  await call('browser_navigate', { profile: 'Sam.seller', url: `${SITE}/app?n=1` });
  await call('browser_navigate', { profile: 'Sam.seller', url: `${SITE}/app?n=2` });
  await expect.poll(buttons).toEqual([false, true]);
  await pane.locator('.back').click();
  await expect.poll(buttons).toEqual([false, false]);
  // The buttons change as the back navigation starts; it lands after, in the tab and in the pane (on a slow machine the
  // pane may show n=2 while the tab is on n=1).
  await expect.poll(() => core((k) => k.profile('Sam.seller').get().url)).toMatch(/n=1$/);
  await expect(pane.locator('.addr')).toHaveValue(/n=1$/);
});

test('the address as in Chrome: shown without http(s)://, a click shows all of it selected; a second click places the caret', async ({ core, ui }) => {
  const { sam } = await profiles(core);
  const addr = ui.locator(`.pane[data-profile="${sam}"] .addr`);
  const b = await addr.boundingBox();
  await core((k) => k.shell.win.webContents.focus()); // not in a page
  const click = () => addr.click({ position: { x: Math.round(b.width / 3), y: Math.round(b.height / 2) } });
  const sel = () => addr.evaluate((a: HTMLInputElement) => [document.activeElement === a, a.selectionStart, a.selectionEnd, a.value.length] as [boolean, number, number, number]);
  const full = await core((k) => k.profile('Sam.seller').get().wc.getURL());
  expect(full.startsWith('http://'), full).toBe(true);
  await expect(addr).toHaveValue(full.replace('http://', ''));
  await click();
  await expect.poll(async () => { const [focused, start, end, n] = await sel(); return focused && start === 0 && end === n && n > 0; }).toBe(true);
  await expect(addr).toHaveValue(full);
  await sleep(400); // not a double-click
  await click();
  await expect.poll(async () => { const [focused, start, end] = await sel(); return focused && start === end; }).toBe(true);
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
  const menuAt = (sel: string) => expect(async () => { await rightClick(sel); await sleep(250); expect(await shown()).toBe(true); }).toPass();
  const rows = () => inMenus(core, (m) => m.shownMenu().rows.map((r) => ('id' in r ? r.id : 'role' in r ? r.role : '-')));
  const close = async () => { await inMenus(core, (m, _p, _wc, k) => m.shownMenu().menu.closePopup(k.shell.win)); await expect.poll(shown).toBe(false); };
  const choose = (label: string) => inMenus(core, (m, _p, _wc, _k, l) => { m.shownMenu().menu.items.find((i) => i.label === l).click(); }, label);
  const elon = () => core((k) => { const e = k.profile('Elon.buyer'); return { tabs: e.tabs.map((t) => ({ id: t.id, url: t.url })), active: e.active }; });

  // A menu left open holds the main process's events on macOS (its menu's own loop): every later test failed with it.
  try {
    await menuAt('#link');
    // macOS selects the word under a right-click, and a selection has its Copy, as in Chrome there.
    const selected = await inMenus(core, (_m, page) => page.evaluate(() => !!getSelection().toString()));
    expect(await rows()).toEqual(['link.open', 'link.copy', '-', ...(selected ? ['copy', '-'] : []), 'pick', 'screenshot', '-', 'inspect']);
    const was = await elon();
    await choose('Open Link in New Tab'); // the row's action, as its click: the menu itself stays until closed
    await close();
    await expect.poll(async () => (await elon()).tabs.length).toBe(was.tabs.length + 1);
    const now = await elon(), added = now.tabs.at(-1).id;
    expect(now.active, 'opened behind, as Chrome does').toBe(was.active);
    await expect.poll(async () => (await elon()).tabs.at(-1).url).toBe(`${SITE}/app`);
    await core((k, id) => k.profile('Elon.buyer').closeTab(id), added);

    await menuAt('#field');
    expect(await rows()).toEqual(['undo', 'redo', '-', 'cut', 'copy', 'paste', 'selectAll', '-', 'pick', 'screenshot', '-', 'inspect']);
    await close();

    await menuAt('#blank');
    expect(await rows()).toEqual(['tab.back', 'tab.forward', 'tab.reload', '-', 'pick', 'screenshot', '-', 'inspect']);
    expect(await inMenus(core, (m) => m.shownMenu().menu.items.slice(0, 2).map((i) => i.enabled)), 'Back after a page, no Forward').toEqual([true, false]);
    await close();

    // A site with a menu of its own (Teams, Google Docs) keeps it: Chromium asks for none.
    await rightClick('#own');
    await expect.poll(() => inMenus(core, (_m, page) => page.locator('#own').textContent())).toBe('its own menu');
    await sleep(300); // nothing to wait for: that no menu comes
    expect(await shown(), 'none over a site\'s own menu').toBe(false);

    // The agent's right-click (Playwright, as its own scripts may do) opens nothing that would hold the human's pointer.
    await inMenus(core, (_m, page) => page.locator('#link').click({ button: 'right' }));
    await sleep(300); // nothing to wait for: that no menu comes
    expect(await shown(), 'none for the agent').toBe(false);
  } finally { await inMenus(core, (m, _p, _wc, k) => m.shownMenu()?.menu.closePopup(k.shell.win)); }
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
  let pick: { locator: string; tab: string } | undefined;
  void pending.then((r) => { pick = r; });
  for (let i = 0; !pick && i < 20; i++) {
    await core((k, { x, y }) => {
      const wc = k.profile('Elon.buyer').get().wc;
      wc.sendInputEvent({ type: 'mouseMove', x, y });
      wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
      wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
    }, at);
    await Promise.race([pending, sleep(500)]);
  }
  expect(pick, 'picked').toBeTruthy();
  expect(pick.locator).toBe("getByRole('button', { name: 'Pay now' })");
  expect(pick.tab).toBe(await core((k) => k.profile('Elon.buyer').active));
  expect(fs.existsSync(path.join(files.project, '.kulisa')), 'nothing is written into the project').toBe(false);
  const ref = `[kulisa pick: Elon.buyer tab ${pick.tab} getByRole('button', { name: 'Pay now' })]`;
  await termShows(ui, ref);
  await sleep(300); // nothing to wait for: that it is not sent (cat would print it again)
  // The agent here is `cat`: the terminal echoes typed input, and cat prints it again only after Enter. Once
  // means it waits in the prompt for the human to write about it. The screen's text, not the output: Windows' ConPTY
  // sends a line again as it redraws it, and the paste's marks in the middle of its echo.
  const text = await termText(ui);
  expect(text.split(ref).length - 1, text).toBe(1);
  expect(await ui.evaluate(() => document.activeElement.classList.contains('xterm-helper-textarea')), 'the terminal has focus').toBe(true);
  await core((k) => k.shell.pty.write('\x15')); // Ctrl+U: the line cleared, nothing sent
});

test('point and tell: Pick again or Esc in the page cancels it; nothing goes to the prompt', async ({ core, ui }) => {
  const { elon } = await profiles(core);
  const button = ui.locator(`.pane[data-profile="${elon}"] .pick`);
  const picking = () => core((k, id) => k.shell.windows[0].picking.has(id), elon);
  const before = (await core((k) => k.ptyOutput())).length;
  for (const cancel of ['button', 'esc']) {
    await button.click();
    await expect(button).toHaveAttribute('data-state', 'on');
    await expect.poll(picking).toBe(true);
    if (cancel === 'button') await button.click();
    else await core((k) => { const wc = k.profile('Elon.buyer').get().wc; wc.focus(); k.press(wc, 'Escape'); });
    await expect(button).not.toHaveAttribute('data-state', 'on');
    await expect.poll(picking).toBe(false);
    await expect(ui.locator(`.ptab[data-panel="profile:${elon}"] .caption`), cancel).toHaveText('');
  }
  await sleep(300); // nothing to wait for: that nothing comes
  expect((await core((k) => k.ptyOutput())).slice(before).includes('kulisa pick')).toBe(false);
});

test('point and tell: Pick is off on an empty tab (about:blank)', async ({ core, ui }) => {
  const { elon } = await profiles(core);
  const button = ui.locator(`.pane[data-profile="${elon}"] .pick`);
  await expect(button).toBeEnabled();
  const tab = await act(ui, 'tab:new', { profile: elon });
  await expect.poll(() => core((k) => k.profile('Elon.buyer').active)).toBe(tab);
  await expect(button).toBeDisabled();
  await core((k, id) => k.profile('Elon.buyer').closeTab(id), tab);
  await expect(button).toBeEnabled();
});
