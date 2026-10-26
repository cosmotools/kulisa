// Renaming and deleting profiles, DevTools, the human's screenshots; what profiles keep across a restart (docs/profiles.md).
import fs from 'fs';
import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.ts';
import { removeTree } from '../../src/main/remove.ts';
import { SITE, PORT, sleep, who, menu, submenu, item, menuRows, choose, closeMenu, rightClick, manageProfiles, closeSettings, chooseProfile, setProfileField, termText, invoke } from './helpers.ts';
import { profileId, deleteProfile } from './tasks-helpers.ts';

// A PNG's size in pixels, from its header.
const pngSize = (file: string) => { const b = fs.readFileSync(file); return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }; };
// A pane's ⋮ opened as the human clicks it: again when Kulisa's window lost the focus meanwhile (a DevTools window
// taking it closes a menu just opened: lib/views.ts), as a human opens it again.
async function openMore(ui: Page, id: string) {
  await expect(async () => {
    if (!(await menu(ui).isVisible())) await ui.locator(`.pane[data-profile="${id}"] .more`).click();
    await expect(menu(ui)).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 10000 });
}
// Its submenu (the ⋮ menu's Screenshot) opened as the pointer opens it, on its row: again when it closed meanwhile (the
// pointer passing where the submenu is still being placed closes it).
async function openSub(ui: Page) {
  await expect(async () => {
    if ((await ui.locator('.menu[data-state="open"]').count()) < 2) await menu(ui).locator('.item[aria-haspopup]').hover();
    await expect(ui.locator('.menu[data-state="open"]')).toHaveCount(2, { timeout: 1000 });
  }).toPass({ timeout: 10000 });
}

test('rename keeps the profile, its id, pane and sign-in', async ({ core, ui, call, files }) => {
  await deleteProfile(core, ui, 'Ren.admin');
  const id = await core(async (k, url) => (await k.ensureProfile('Ren.seller', url)).id, `${SITE}/app`);
  await call('browser_navigate', { profile: 'Ren.seller', url: `${SITE}/app/login?name=sam` });
  const dir = await core((k, p) => k.shell.profiles.get(p).dir, id);
  const r = await invoke(ui, 'profiles:rename', { profile: id, name: 'Ren.admin' });
  expect(r.id).toBe(id);
  expect(await profileId(core, 'Ren.admin'), 'only its name changed').toBe(id);
  expect(await core((k, p) => k.shell.profiles.get(p).dir, id), 'its copy too').toBe(dir);
  await expect(ui.locator(`.pane[data-profile="${id}"]`), 'its pane too').toHaveCount(1);
  // Its id beside its new name, so the lines before and after it go together.
  await expect.poll(() => files.log()).toMatch(new RegExp(`\\[profiles\\] ${id} renamed: Ren\\.admin$`, 'm'));
  expect(await who(call, 'Ren.admin')).toBe('Signed in as sam');
  await expect(ui.locator('.pname', { hasText: /^Ren\.admin$/ })).toHaveCount(1);
  await expect(ui.locator('.pname', { hasText: /^Ren\.seller$/ })).toHaveCount(0);
  await deleteProfile(core, ui, 'Ren.admin');
});

test('names: typed, pasted, from the agent, checked where they are made (the rule itself: unit/names.test.ts)', async ({ core, ui, sui, call }) => {
  const id = await core(async (k, url) => (await k.ensureProfile('Sam.admin', url)).id, `${SITE}/app`);
  const names = () => core((k) => [...k.shell.profiles.values()].map((p) => p.name));
  const before = await names();
  // The field leaves other characters out, typed or pasted.
  const s = await manageProfiles(ui, sui);
  await s.locator('#profilenew').click();
  await expect(s.locator('#profilenewname')).toBeFocused();
  await core((k) => k.shell.settings.win.webContents.insertText('ann admin·@shop.com'));
  await expect(s.locator('#profilenewname')).toHaveValue('annadmin@shop.com');
  await s.locator('#profilenewname').press('Escape'); // put away, nothing made
  await expect(s.locator('#profilenewname')).toHaveCount(0);
  await closeSettings(core, ui, sui);
  // Checked again where names are made: the agent, a rename, a project, a task.
  await expect(call('profile_create', { name: 'Ann admin' })).rejects.toThrow(/letters, digits and @ \. _ \+ - only/);
  await expect(call('profile_create', { name: '@' })).rejects.toThrow(/starting with a letter or a digit/);
  const current = await ui.evaluate(() => (window as any).tasks.current);
  expect((await invoke(ui, 'profiles:rename', { profile: id, name: 'Sam admin' })).error).toMatch(/only/);
  expect((await invoke(ui, 'project:new', { name: '..' })).error).toMatch(/starting with a letter or a digit/);
  expect((await invoke(ui, 'task:rename', { key: current, name: '@' })).error).toMatch(/a letter or a digit/);
  expect((await invoke(ui, 'task:rename', { key: current, name: 'a\nb' })).error).toMatch(/one line/);
  expect(await names(), 'none made').toEqual(before);
});

test("delete a profile in Settings (its page's ⋯, its row's right-click): sign-ins and data gone, everywhere; a new one of the same name starts clean", async ({ core, ui, sui, call, files }) => {
  await deleteProfile(core, ui, 'Temp');
  await core(async (k, url) => { await k.ensureProfile('Sam.admin', url); }, `${SITE}/app`); // the one chosen once Temp goes
  // In the project, open in its task (the agent's profile_create; Settings: tested above).
  const tempId = await core(async (k) => { const r = await k.shell.task.createProfile('Temp'); if ('error' in r) throw new Error(r.error); return r.id; });
  const others = await core((k, p) => [...k.shell.profiles.keys()].filter((x) => x !== p), tempId);
  await call('browser_navigate', { profile: 'Temp', url: `${SITE}/app/login?name=tim` });
  expect(await who(call, 'Temp')).toBe('Signed in as tim');
  // The profile kept to look at after it is gone.
  const cookiesFile = await core(async (k) => {
    const temp = k.profile('Temp');
    k.stash.temp = temp;
    await k.shell.sessionCookies.save(temp);
    return k.shell.sessionCookies.file(temp);
  });
  expect(fs.existsSync(cookiesFile)).toBe(true);

  const s = await manageProfiles(ui, sui);
  await chooseProfile(s, files, 'Temp');
  await core((k) => { k.answer = false; }); // Cancel
  await s.locator('#profilemore').click(); // ⋯ at its page's top
  await menuRows(s);
  await choose(s, 'Delete Profile…');
  await expect.poll(() => core((k) => k.asked.length)).toBe(1);
  const q = await core((k) => k.asked.pop());
  expect(q.message).toBe('Delete the profile Temp?');
  expect(q.detail).toMatch(/removed for good, here and in every task\. The projects .* let go of it\./);
  await sleep(100); // nothing to wait for: that nothing happens
  expect(await core((k, p) => k.shell.profiles.has(p), tempId), 'nothing is deleted without the confirmation').toBe(true);
  await core((k) => { k.answer = true; });
  await rightClick(s, `#pjlist [data-profile="${tempId}"] .label`);
  await menuRows(s);
  await choose(s, 'Delete Profile…');
  await expect.poll(() => core((k, p) => !k.shell.profiles.has(p) && !k.shell.profileStore.get(p), tempId)).toBe(true);
  await expect(s.locator(`#pjlist [data-profile="${tempId}"]`)).toHaveCount(0);
  await expect(s.locator('#pjlist [data-profile][aria-selected="true"]')).toHaveCount(1);
  await closeSettings(core, ui, sui);

  expect(await core((k) => [...k.shell.profiles.keys()])).toEqual(others);
  expect(await core(async (k) => {
    const temp = k.stash.temp;
    return { tabs: temp.tabs.length, cookies: await temp.session.cookies.get({}) };
  })).toEqual({ tabs: 0, cookies: [] });
  expect(fs.existsSync(cookiesFile)).toBe(false);
  const savedIds = () => JSON.parse(fs.readFileSync(files.pfile('profiles.json'), 'utf8')).map((p: { id: string }) => p.id);
  await expect.poll(savedIds).toEqual(others);
  expect(await core((k, p) => k.shell.profileStore.get(p), tempId), 'gone from the store').toBeNull();
  // Its task's copy and its master.
  const marked = JSON.parse(fs.readFileSync(path.join(files.userData, 'deleted-folders.json'), 'utf8'));
  expect(marked.slice(-2)).toEqual([files.pfile(tempId), path.join(files.userData, 'profiles', tempId)]);
  await expect(call('browser_snapshot', { profile: 'Temp' })).rejects.toThrow(/No profile "Temp"/);
  await expect(ui.locator(`.pane[data-profile="${tempId}"]`)).toHaveCount(0);

  // Same name again: a new id and folder (the old one goes at the next start), signed out.
  const again = await core(async (k) => { const r = await k.shell.task.createProfile('Temp'); if ('error' in r) throw new Error(r.error); return r.id; });
  expect(again).not.toBe(tempId);
  await call('browser_navigate', { profile: 'Temp', url: `${SITE}/app` });
  expect(await who(call, 'Temp')).toBe('Signed out');
  await deleteProfile(core, ui, 'Temp');
});

test('rename in Settings → Profiles: typed, and Enter or leaving the field saves it; the panes follow', async ({ core, ui, sui, files }) => {
  const elon = await core(async (k, url) => (await k.ensureProfile('Elon.buyer', url)).id, `${SITE}/app`);
  const s = await manageProfiles(ui, sui);
  await chooseProfile(s, files, 'Elon.buyer');
  await core((k) => k.focus(k.shell.settings.win)); // the keyboard in Settings' window, as the human's hands
  await s.locator('#profilename').evaluate((f: HTMLInputElement) => { f.focus(); f.select(); });
  await core(async (k) => {
    const wc = k.shell.settings.win.webContents;
    await wc.insertText('Elon.shopper');
    for (const type of ['keyDown', 'char', 'keyUp'] as const) wc.sendInputEvent({ type, keyCode: type === 'char' ? '\r' : 'Enter' });
  });
  await expect.poll(() => core((k, p) => k.shell.profiles.get(p).name, elon)).toBe('Elon.shopper');
  await expect(ui.locator('.pname', { hasText: /^Elon\.shopper$/ })).toHaveCount(1);
  await expect(ui.locator('.pname', { hasText: /^Elon\.buyer$/ })).toHaveCount(0);
  await setProfileField(s, 'profilename', 'Elon.buyer');
  await expect.poll(() => core((k, p) => k.shell.profiles.get(p).name, elon)).toBe('Elon.buyer');
  await closeSettings(core, ui, sui);
});

test('a page never makes a region that drags the window (Teams declared one, and it took every click over the panes)', async ({ core }) => {
  await core(async (k, url) => { await k.ensureProfile('Sam.admin', url); }, `${SITE}/app`);
  const back = await core(async (k, url) => { const wc = k.profile('Sam.admin').get().wc, was = wc.getURL(); await wc.loadURL(url); return was; }, `${SITE}/drag`);
  await expect.poll(() => core((k) => k.profile('Sam.admin').get().wc.executeJavaScript("getComputedStyle(bar).getPropertyValue('app-region')"))).toBe('no-drag');
  await core((k, url) => k.profile('Sam.admin').get().wc.loadURL(url), back);
});

test("F12 opens and closes DevTools: a tab's, or Kulisa's own outside the pages", async ({ core }) => {
  await core(async (k, url) => { await k.ensureProfile('Sam.admin', url); }, `${SITE}/app`);
  for (const which of ['tab', 'window'] as const) {
    const press = () => core((k, w) => { const wc = w === 'tab' ? k.profile('Sam.admin').get().wc : k.shell.win.webContents; wc.focus(); k.press(wc, 'F12'); }, which);
    const opened = () => core((k, w) => (w === 'tab' ? k.profile('Sam.admin').get().wc : k.shell.win.webContents).isDevToolsOpened(), which);
    await press();
    await expect.poll(opened).toBe(true);
    await press();
    await expect.poll(opened).toBe(false);
  }
});

test("DevTools in a pane's ⋮ menu opens and closes the DevTools of its active tab", async ({ core, ui }) => {
  const id = await core(async (k, url) => (await k.ensureProfile('Sam.admin', url)).id, `${SITE}/app`);
  const pane = ui.locator(`.pane[data-profile="${id}"]`);
  const opened = () => core((k) => k.profile('Sam.admin').get().wc.isDevToolsOpened());
  // ⋮ as tall as the bar's other buttons, its dots upright, its menu open or not: the Details' trigger's rule must
  // not take its height or turn its dots.
  const looks = () => pane.locator('.bar .icon').evaluateAll((bs) => bs.map((b) => [Math.round(b.getBoundingClientRect().height), getComputedStyle(b.querySelector('svg')).rotate]));
  const closed = await looks();
  expect(closed, 'its menu closed').toEqual(closed.map(() => [closed[0][0], 'none']));
  const click = async () => {
    await openMore(ui, id);
    expect(await menuRows(ui)).toEqual(['Screenshot', 'DevTools']);
    // As Chrome's ⋮: under the button, its right edge at the button's, so it stays over its own pane.
    const m = await menu(ui).boundingBox(), b = await pane.locator('.more').boundingBox();
    expect(Math.abs(m.x + m.width - (b.x + b.width)) < 1 && m.y >= b.y + b.height, JSON.stringify({ m, b })).toBe(true);
    // Back, forward, reload, Pick and ⋮ are icon buttons, as Chrome's: no border, no text, a name for screen readers.
    expect(await pane.locator('.bar .icon').evaluateAll((bs) => bs.map((b) => [b.className, b.textContent.trim(), !!b.querySelector('svg'), !!b.ariaLabel, getComputedStyle(b).borderTopWidth])))
      .toEqual(['back', 'fwd', 'reload', 'pick', 'more'].map((c) => [`${c} icon`, '', true, true, '0px']));
    expect(await looks(), 'its menu open').toEqual(closed);
    // The same inset from the island's edges for the controls in it; the page reaches its edges (the author's choice).
    const inset = await pane.evaluate((p) => {
      const group = p.closest('.dv-groupview'), island = group.getBoundingClientRect();
      const header = document.querySelector(`.ptab[data-panel="${group.querySelector<HTMLElement>('.ptab').dataset.panel}"]`);
      const r = (e: Element) => e.getBoundingClientRect();
      const left = (e: Element) => Math.round(r(e).left - island.left), right = (e: Element) => Math.round(island.right - r(e).right);
      return { avatar: left(header.querySelector('.avatar')), tab: left(p.querySelector('.tab')), back: left(p.querySelector('.back')),
        page: left(p.querySelector('.content')), close: right(header.querySelector('.close')), more: right(p.querySelector('.more')),
        pageRight: right(p.querySelector('.content')), pageBottom: Math.round(island.bottom - r(p.querySelector('.content')).bottom) };
    });
    expect(inset).toEqual({ avatar: 8, tab: 8, back: 8, page: 0, close: 8, more: 8, pageRight: 0, pageBottom: 0 });
    await choose(ui, 'DevTools');
  };
  await click();
  await expect.poll(opened).toBe(true);
  // Its window takes the focus a moment later, and Kulisa's window losing it closes a menu opened meanwhile (lib/views.ts).
  // A human comes to ⋮ again after that; the test too, and again when the focus went later still (under load). (A window
  // manager may leave the focus with Kulisa, and may not give it back when asked.)
  await expect.poll(() => core((k) => !k.shell.win.isFocused()), { timeout: 3000 }).toBe(true).catch(() => {});
  await click();
  await expect.poll(opened).toBe(false);
});

// The human's pictures (src/screenshots): on the clipboard and in the OS's folder of screenshots (the test's folder
// here: KULISA_SCREENSHOTS), at the screen's density, an element chosen as Pick chooses; not the agent's action.
test("a pane's ⋮ → Screenshot takes an element, the visible part or the whole page, to the clipboard and the folder of screenshots", async ({ core, ui, files }) => {
  const id = await core(async (k, url) => (await k.ensureProfile('Sam.admin', url)).id, `${SITE}/app`);
  const dir = path.join(files.root, 'screenshots');
  removeTree(dir);
  const shots = () => (fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []);
  const { was, dpr, tall } = await core(async (k, url) => {
    const page = await k.profile('Sam.admin').page(), was = page.url();
    await page.goto(url);
    // What the agent's actions caption, watched: the human's screenshot is none of them.
    const g = k.stash;
    g.actions = [];
    g.watch = (a: { caption: string }) => { g.actions.push(a.caption); };
    k.shell.bus.on('agent-action', g.watch);
    return { was, dpr: await page.evaluate(() => devicePixelRatio), tall: k.profile('Sam.admin').active };
  }, `${SITE}/tall`);
  const picking = () => core((k, p) => k.shell.windows[0].picking.has(p), id);
  const fromMenu = async (label: string) => {
    await openMore(ui, id);
    await openSub(ui);
    expect(await menuRows(ui, submenu(ui))).toEqual(['Element', 'Visible Part', 'Full Page']);
    // The pointer taken to its row as the hand takes it, through what lies between: a jump straight there leaves the
    // submenu's trigger toward nowhere its grace area knows, and the submenu closes.
    const row = item(ui, label, submenu(ui)), b = await row.boundingBox();
    await ui.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
    await row.click();
  };
  await fromMenu('Full Page');
  await expect.poll(() => shots().length).toBe(1);
  const [full] = shots();
  expect(full).toMatch(/^Kulisa Sam\.admin \d{4}-\d\d-\d\d \d\d\.\d\d\.\d\d\.png$/);
  const fullSize = pngSize(path.join(dir, full));
  expect(fullSize.height > 3000 * dpr - 1, `the whole page (${fullSize.height})`).toBe(true);
  const types = await core(async (k) => (await k.electron.clipboard.read())[0]?.types ?? []);
  expect(types, 'on the clipboard too').toContain('image/png');
  await expect(ui.locator(`.ptab[data-panel="profile:${id}"] .caption`)).toHaveText('Screenshot copied and saved');
  // The element: its key, then a click on it in the page, as Pick (which reaches the page a moment after it starts:
  // clicked again until it comes, as in Pick's test).
  await core((k) => k.press(k.profile('Sam.admin').get().wc, 'S', k.CMD, 'shift'));
  await expect.poll(picking).toBe(true);
  const at = await core(async (k) => {
    const b = await (await k.profile('Sam.admin').page()).locator('#box').boundingBox();
    return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
  });
  await expect(async () => {
    if (shots().length < 2) {
      await core((k, p) => {
        const wc = k.profile('Sam.admin').get().wc;
        wc.sendInputEvent({ type: 'mouseMove', ...p });
        wc.sendInputEvent({ type: 'mouseDown', ...p, button: 'left', clickCount: 1 });
        wc.sendInputEvent({ type: 'mouseUp', ...p, button: 'left', clickCount: 1 });
      }, at);
    }
    await expect.poll(() => shots().length, { timeout: 500 }).toBe(2);
  }).toPass({ timeout: 10000 });
  expect(pngSize(path.join(dir, shots().find((f) => f !== full))), 'the element alone, at the screen\'s density').toEqual({ width: Math.round(200 * dpr), height: Math.round(120 * dpr) });
  // Esc while choosing: nothing taken.
  await core((k) => k.press(k.profile('Sam.admin').get().wc, 'S', k.CMD, 'shift'));
  await expect.poll(picking).toBe(true);
  await core((k) => k.press(k.profile('Sam.admin').get().wc, 'Escape'));
  await expect.poll(picking).toBe(false);
  await fromMenu('Visible Part');
  await expect.poll(() => shots().length).toBe(3);
  const actions = await core((k) => { const g = k.stash; k.shell.bus.off('agent-action', g.watch); return g.actions as string[]; });
  expect(actions, 'not captioned as the agent\'s').not.toContain('screenshot');
  // An empty tab: nothing to take, its rows off.
  const blank = await core((k) => k.profile('Sam.admin').newTab('about:blank').id);
  await expect(ui.locator(`.pane[data-profile="${id}"] .pick`)).toBeDisabled(); // the window knows it: Pick off too
  expect(await core((k) => { const p = k.profile('Sam.admin'); return p.screenshot(p.get(), { scale: 'device', type: 'png', by: 'human' }).then(() => 'taken', (e: Error) => e.message); })).toMatch(/is empty/);
  await openMore(ui, id);
  await openSub(ui);
  expect(await menuRows(ui, submenu(ui))).toEqual(['Element (off)', 'Visible Part (off)', 'Full Page (off)']);
  await closeMenu(ui);
  // Back by the tab's own page: Profile.page() would look among the pages while the closed tab's is still going.
  await core(async (k, a) => { const p = k.profile('Sam.admin'); p.closeTab(a.blank); await p.get(a.tall).wc.loadURL(a.was); }, { blank, was, tall });
  removeTree(dir);
});

// The thumbnail (src/screenshots, The thumbnail): what the OS would do with the file is stubbed (a file manager, an
// app, the trash: outside the tests' folder).
test('a screenshot shows its thumbnail in its pane\'s corner: a click opens it, it drags out, its menu shows, copies, sends it to the agent, deletes; its × closes it; it fades in and out; it goes by itself unless the pointer is over it', async ({ core, ui, files }) => {
  test.setTimeout(60000); // it waits for the thumbnail to go by itself, twice its 5 s
  const id = await core(async (k, url) => (await k.ensureProfile('Sam.admin', url)).id, `${SITE}/app`);
  const dir = path.join(files.root, 'screenshots');
  const was = await core(async (k, url) => { const page = await k.profile('Sam.admin').page(), w = page.url(); await page.goto(url); return w; }, `${SITE}/tall`);
  await core((k) => {
    const g = k.stash, shell = k.electron.shell, fs = process.getBuiltinModule('fs');
    g.did = [];
    g.real = { openPath: shell.openPath, showItemInFolder: shell.showItemInFolder, trashItem: shell.trashItem };
    shell.openPath = async (f) => { g.did.push(`open ${f}`); return ''; };
    shell.showItemInFolder = (f) => { g.did.push(`show ${f}`); };
    shell.trashItem = async (f) => { g.did.push(`trash ${f}`); fs.rmSync(f); };
  });
  const did = () => core((k) => k.stash.did as string[]);
  // The thumbnail's page, by the view of the screenshot taken last.
  const thumb = <R>(js: string) => core((k, s) => k.stash.thumbWc.executeJavaScript(s) as Promise<R>, js);
  const thumbGone = () => core((k) => k.stash.thumbWc.isDestroyed());
  const shown = ui.locator('#shotthumb');
  try {
    const take = async () => {
      expect((await ui.evaluate((p) => (window as any).act('tab:screenshot', { profile: p, kind: 'visible' }), id)).error).toBeUndefined();
      await expect.poll(() => core((k) => !!k.shell.windows[0].thumbnails.bounds)).toBe(true);
      return core((k) => { const t = k.shell.windows[0].thumbnails; Object.assign(k.stash, { thumb: t.view, thumbWc: t.view.webContents }); return { file: t.file, bounds: t.bounds }; });
    };
    const t = await take(), file = t.file;
    // In the pane's bottom right corner, the picture shown in its page, and drawn by the window too.
    const p = await core((k) => k.profile('Sam.admin').bounds), b = t.bounds;
    expect(b.x > p.x && b.y > p.y && b.x + b.width < p.x + p.width && b.y + b.height < p.y + p.height && p.x + p.width - (b.x + b.width) < 40 && p.y + p.height - (b.y + b.height) < 40, JSON.stringify({ p, b })).toBe(true);
    await expect.poll(() => thumb(`document.querySelector('img').src.startsWith('data:image/png') && document.body.classList.contains('in')`)).toBe(true);
    await expect(shown).toHaveCount(1);
    await thumb(`document.querySelector('img').click()`);
    await expect.poll(did).toContain(`open ${file}`);
    await core((k) => { const wc = k.stash.thumbWc; wc.startDrag = (item: { file: string }) => { k.stash.dragged = item.file; }; });
    await thumb(`document.querySelector('img').dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true })); 0`);
    await expect.poll(() => core((k) => k.stash.dragged)).toBe(file);
    // Its menu, the window's, where it was right-clicked; the thumbnail stays while it is open.
    const thumbMenu = async (label: string) => {
      await thumb(`document.dispatchEvent(new MouseEvent('contextmenu', { clientX: 20, clientY: 10, bubbles: true, cancelable: true })); 0`);
      expect(await menuRows(ui)).toEqual(['Show in Folder', 'Copy', 'Send to Agent', '-', 'Delete', 'Close']);
      await choose(ui, label);
      await expect(ui.locator('.menu[data-state="open"]')).toHaveCount(0);
    };
    await thumbMenu('Show in Folder');
    await expect.poll(did).toContain(`show ${file}`);
    await core((k) => k.electron.clipboard.writeText('something else'));
    await thumbMenu('Copy');
    await expect.poll(() => core(async (k) => (await k.electron.clipboard.read())[0]?.types ?? [])).toContain('image/png');
    await thumbMenu('Send to Agent');
    // The screen's text, not the output: Windows' ConPTY sends a line again as it redraws it (point and tell).
    await expect.poll(() => termText(ui)).toContain(`'${file}'`);
    await core((k) => k.shell.pty.write('\x15')); // Ctrl+U: the line cleared
    await thumbMenu('Delete');
    await expect.poll(async () => (await did()).includes(`trash ${file}`) && await core((k) => !k.shell.windows[0].thumbnails.file) && await thumbGone()).toBe(true);
    await expect(shown).toHaveCount(0);
    // Its ×: it fades out first, then goes.
    await take();
    await expect.poll(() => thumb(`document.body.classList.contains('in')`)).toBe(true);
    await thumb(`document.querySelector('button').click()`);
    await expect.poll(async () => await thumbGone() || await thumb(`document.body.classList.contains('out')`)).toBe(true);
    await expect.poll(async () => await core((k) => !k.shell.windows[0].thumbnails.file) && await thumbGone()).toBe(true);
    // It goes by itself after 5 s (the time macOS gives one), and stays while the pointer is over it: the test waits
    // that long, twice.
    await take();
    await thumb(`document.documentElement.dispatchEvent(new MouseEvent('mouseenter')); 0`);
    await sleep(5500);
    expect(await core((k) => k.shell.windows[0].thumbnails.view === k.stash.thumb), 'held while the pointer is over it').toBe(true);
    await thumb(`document.documentElement.dispatchEvent(new MouseEvent('mouseleave')); 0`);
    await expect.poll(() => core((k) => !k.shell.windows[0].thumbnails.file), { timeout: 7000 }).toBe(true);
  } finally {
    await core((k) => { Object.assign(k.electron.shell, k.stash.real); });
    await core(async (k, url) => { await (await k.profile('Sam.admin').page()).goto(url); }, was);
    removeTree(dir);
  }
});

// What a profile keeps across a restart: the profiles with their pictures and words, sign-ins, tabs and the one in
// front; a deleted one's folders gone at the next start.
test('after a restart: profiles, sign-ins and tabs are back, the one in front in front', async ({ core, ui, call, restart, files }) => {
  test.setTimeout(60000); // a restart
  await deleteProfile(core, ui, 'Rhea.admin'); await deleteProfile(core, ui, 'Rob.buyer'); await deleteProfile(core, ui, 'Gone');
  await core(async (k) => {
    await k.shell.task.createProfile('Rhea.admin', 'seller in the test shop', 'fox');
    await k.shell.task.createProfile('Rob.buyer', '', 'owl');
  });
  await call('browser_navigate', { profile: 'Rhea.admin', url: `${SITE}/app/login?name=sam` });
  expect(await who(call, 'Rhea.admin')).toBe('Signed in as sam');
  // Rob's tabs, one on a sign-in page (saved as where its sign-in started: zoom-and-closing.spec.ts), the second in front.
  await call('browser_navigate', { profile: 'Rob.buyer', url: `${SITE}/errors` });
  await core(async (k, a) => {
    const rob = k.profile('Rob.buyer'), viaHistory = rob.newTab(`${a.site}/app?n=5`);
    await viaHistory.ready;
    await viaHistory.wc.loadURL(`http://localhost:${a.port}/app?login=1`); // localhost is a sign-in host in the tests
    await rob.newTab(`http://localhost:${a.port}/headers?redirect_uri=${encodeURIComponent(`${a.site}/app?n=9`)}`).ready; // opened directly on sign-in
    await rob.newTab(`http://localhost:${a.port}/headers`).ready; // nothing to come back to
    rob.activate(viaHistory.id);
  }, { site: SITE, port: PORT });
  await expect.poll(() => files.savedTabs('Rob.buyer')).toEqual([`${SITE}/errors`, `${SITE}/app?n=5`, `${SITE}/`]);
  await expect.poll(() => files.savedActive('Rob.buyer')).toBe(1);
  // One deleted: its copy and master go at the next start.
  await core(async (k) => { await k.shell.task.createProfile('Gone'); });
  await deleteProfile(core, ui, 'Gone');
  expect(fs.existsSync(path.join(files.userData, 'deleted-folders.json'))).toBe(true);
  const profiles = () => core((k) => [...k.shell.profiles.values()].map((p) => [p.id, p.avatar, p.description]));
  const before = await profiles();

  await restart();
  await expect.poll(profiles).toEqual(before);
  expect(await core((k) => ['Rhea.admin', 'Rob.buyer'].map((n) => { const p = k.profile(n); return [p.avatar, p.description]; }))).toEqual([['fox', 'seller in the test shop'], ['owl', '']]);
  // The deleted ones' copies and masters removed; the live ones keep their folders (beside the task's artifacts).
  const live = [...await core((k) => k.shell.profileStore.all().map((p) => p.id)), 'artifacts'];
  const dirs = (d: string) => fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  expect([dirs(files.pfile('')).filter((f) => !live.includes(f)), dirs(path.join(files.userData, 'profiles')).filter((f) => !live.includes(f))]).toEqual([[], []]);
  expect(fs.existsSync(files.pfile(files.idOf('Rhea.admin')))).toBe(true);
  expect(fs.existsSync(path.join(files.userData, 'deleted-folders.json'))).toBe(false);
  expect(await who(call, 'Rhea.admin')).toBe('Signed in as sam');
  const rob = () => core((k) => { const r = k.profile('Rob.buyer'); return { urls: r.tabs.map((t) => t.wc.getURL()), front: r.tabs.findIndex((t) => t.id === r.active), signinMode: r.signinMode }; });
  await expect.poll(async () => (await rob()).urls).toEqual([`${SITE}/errors`, `${SITE}/app?n=5`, `${SITE}/`]);
  expect(await rob()).toMatchObject({ front: 1, signinMode: false }); // the tab in front as it was left
});

test('after a restart: a closed profile is still closed, and opens signed in', async ({ core, ui, call, restart }) => {
  test.setTimeout(60000); // a restart
  await deleteProfile(core, ui, 'Dora');
  await call('profile_create', { name: 'Dora' });
  await call('browser_navigate', { profile: 'Dora', url: `${SITE}/app/login?name=dora` });
  await call('profile_close', { profile: 'Dora' });
  const dora = await profileId(core, 'Dora');
  await restart();
  expect(await core((k, p) => k.shell.closed.has(p) && !k.shell.profiles.has(p), dora)).toBe(true);
  await call('profile_open', { profile: 'Dora' });
  expect(await who(call, 'Dora')).toBe('Signed in as dora');
  await call('profile_delete', { profile: 'Dora' });
});

test("a packaged build (appDevTools off): no DevTools for Kulisa's own UI, a tab's still open", async ({ core, restart }) => {
  test.setTimeout(60000); // a restart
  await core(async (k, url) => { await k.ensureProfile('Sam.admin', url); }, `${SITE}/app`);
  await restart(); // started again as a packaged build would as to DevTools
  await core((k) => { const wc = k.shell.win.webContents; wc.focus(); k.press(wc, 'F12'); wc.openDevTools({ mode: 'detach' }); });
  await sleep(500); // nothing to wait for: that they do not open
  expect(await core((k) => k.shell.win.webContents.isDevToolsOpened())).toBe(false);
  await expect.poll(() => core((k) => !![...k.shell.profiles.values()].find((p) => p.name === 'Sam.admin')?.get())).toBe(true);
  await core(async (k) => { await k.profile('Sam.admin').get().ready; });
  await core((k) => { const wc = k.profile('Sam.admin').get().wc; wc.focus(); k.press(wc, 'F12'); });
  await expect.poll(() => core((k) => k.profile('Sam.admin').get().wc.isDevToolsOpened())).toBe(true);
  await core((k) => k.profile('Sam.admin').get().wc.closeDevTools());
});
