// Renaming and deleting profiles, DevTools, the human's screenshots; what profiles keep across a restart (docs/profiles.md).
import fs from 'fs';
import path from 'path';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures.ts';
import { SITE, PORT, logged, ipcSettled, who, menu, choose, closeMenu, rightClick, manageProfiles, closeSettings, chooseProfile, navRow, shownRow, settingsMenu, termText, invoke, answer, typeIn, removed } from './helpers.ts';
import { profileId, deleteProfile } from './tasks-helpers.ts';

// A PNG's size in pixels, from its header.
const pngSize = (file: string) => { const b = fs.readFileSync(file); return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }; };
// A pane's ⋮ opened as the human clicks it: again when Kulisa's window lost the focus meanwhile (a DevTools window
// taking it closes a menu just opened: lib/views.ts), as a human opens it again.
async function openMore(ui: Page, id: string) {
  await expect(async () => {
    if (!(await menu(ui).isVisible())) await ui.locator(`[role="region"][data-profile="${id}"] [aria-label="More"]`).click();
    await expect(menu(ui)).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 10000 });
}

test('names: typed, pasted, from the agent, checked where they are made (the rule itself: unit/names.test.ts)', async ({ core, ui, sui, call }) => {
  const id = await core(async (k, url) => (await k.ensureProfile('Sam.admin', url)).id, `${SITE}/app`);
  const names = () => core((k) => [...k.shell.profiles.values()].map((p) => p.name));
  const before = await names();
  // The field leaves other characters out, typed or pasted.
  const s = await manageProfiles(ui, sui);
  const field = s.getByRole('textbox', { name: 'New profile' });
  await s.getByRole('button', { name: 'New Profile…' }).click();
  await expect(field).toBeFocused();
  await core((k) => k.shell.settings.win.webContents.insertText('ann admin·@shop.com'));
  await expect(field).toHaveValue('annadmin@shop.com');
  await field.press('Escape'); // put away, nothing made
  await expect(field).toHaveCount(0);
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
  await s.getByRole('button', { name: 'More' }).click(); // ⋯ at its page's top
  await choose(s, 'Delete Profile…', settingsMenu(s));
  const q = await answer(s, false);
  expect(q.message).toBe('Delete the profile Temp?');
  expect(q.detail).toMatch(/removed for good, here and in every task\. The projects .* let go of it\./);
  // Cancel's answer reaches the main process before anything Settings sends after it, and the deleting would go on as
  // it comes.
  await ipcSettled(s);
  expect(await core((k, p) => k.shell.profiles.has(p), tempId), 'nothing is deleted without the confirmation').toBe(true);
  await rightClick(s, navRow(s, `f:${tempId}`));
  await choose(s, 'Delete Profile…', settingsMenu(s));
  await answer(s);
  await expect.poll(() => core((k, p) => !k.shell.profiles.has(p) && !k.shell.profileStore.get(p), tempId)).toBe(true);
  await expect(navRow(s, `f:${tempId}`)).toHaveCount(0);
  await expect(shownRow(s), 'another profile shown').toHaveAttribute('data-key', /^f:/);
  await closeSettings(core, ui, sui);

  expect(await core((k) => [...k.shell.profiles.keys()])).toEqual(others);
  expect(await core(async (k) => {
    const temp = k.stash.temp;
    return { tabs: temp.tabs.length, cookies: await temp.session.cookies.get({}) };
  })).toEqual({ tabs: 0, cookies: [] });
  expect(fs.existsSync(cookiesFile)).toBe(false);
  const savedIds = () => files.json(files.pfile('profiles.json')).map((p: { id: string }) => p.id);
  await expect.poll(savedIds).toEqual(others);
  expect(await core((k, p) => k.shell.profileStore.get(p), tempId), 'gone from the store').toBeNull();
  // Its task's copy and its master.
  const marked = files.json('deleted-folders.json');
  expect(marked.slice(-2)).toEqual([files.pfile(tempId), path.join(files.userData, 'profiles', tempId)]);
  await expect(call('browser_snapshot', { profile: 'Temp' })).rejects.toThrow(/No profile "Temp"/);
  await expect(ui.locator(`[role="region"][data-profile="${tempId}"]`)).toHaveCount(0);

  // Same name again: a new id and folder (the old one goes at the next start), signed out.
  const again = await core(async (k) => { const r = await k.shell.task.createProfile('Temp'); if ('error' in r) throw new Error(r.error); return r.id; });
  expect(again).not.toBe(tempId);
  await call('browser_navigate', { profile: 'Temp', url: `${SITE}/app` });
  expect(await who(call, 'Temp')).toBe('Signed out');
  await deleteProfile(core, ui, 'Temp');
});

// Only its name changes: its id, folder, pane and sign-in are the profile's.
test('rename in Settings → Profiles: typed, and Enter or leaving the field saves it; the panes follow; the profile keeps its folder and sign-in', async ({ core, ui, sui, call, files }) => {
  await deleteProfile(core, ui, 'Ren.admin'); await deleteProfile(core, ui, 'Ren.seller');
  const id = await core(async (k, url) => (await k.ensureProfile('Ren.seller', url)).id, `${SITE}/app`);
  await call('browser_navigate', { profile: 'Ren.seller', url: `${SITE}/app/login?name=sam` });
  const dir = await core((k, p) => k.shell.profiles.get(p).dir, id);
  const s = await manageProfiles(ui, sui);
  await chooseProfile(s, files, 'Ren.seller');
  await core((k) => k.focus(k.shell.settings.win)); // the keyboard in Settings' window, as the human's hands
  await s.getByRole('textbox', { name: 'Name', exact: true }).selectText();
  await core(async (k) => {
    const wc = k.shell.settings.win.webContents;
    await wc.insertText('Ren.admin');
    for (const type of ['keyDown', 'char', 'keyUp'] as const) wc.sendInputEvent({ type, keyCode: type === 'char' ? '\r' : 'Enter' });
  });
  await expect.poll(() => core((k, p) => k.shell.profiles.get(p).name, id)).toBe('Ren.admin');
  expect(await profileId(core, 'Ren.admin'), 'only its name changed').toBe(id);
  expect(await core((k, p) => k.shell.profiles.get(p).dir, id), 'its copy too').toBe(dir);
  await expect(ui.locator(`[role="region"][data-profile="${id}"]`), 'its pane too').toHaveCount(1);
  await expect(ui.getByTestId('profile-name').filter({ hasText: /^Ren\.admin$/ })).toHaveCount(1);
  await expect(ui.getByTestId('profile-name').filter({ hasText: /^Ren\.seller$/ })).toHaveCount(0);
  // Its id beside its new name, so the lines before and after it go together.
  await expect.poll(() => logged(core, new RegExp(`\\[profiles\\] ${id} renamed: Ren\\.admin$`))).toBeGreaterThan(0);
  expect(await who(call, 'Ren.admin')).toBe('Signed in as sam');
  await typeIn(s, s.getByRole('textbox', { name: 'Name', exact: true }), 'Ren.seller', true);
  await expect.poll(() => core((k, p) => k.shell.profiles.get(p).name, id)).toBe('Ren.seller');
  await closeSettings(core, ui, sui);
  await deleteProfile(core, ui, 'Ren.seller');
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
  const pane = ui.locator(`[role="region"][data-profile="${id}"]`);
  const opened = () => core((k) => k.profile('Sam.admin').get().wc.isDevToolsOpened());
  // ⋮ as tall as the bar's other buttons, its dots upright, its menu open or not: the Details' trigger's rule must
  // not take its height or turn its dots.
  const buttons = pane.locator('[role="toolbar"] button:not([hidden])');
  const looks = async (what: string) => {
    for (const svg of await buttons.locator('svg').all()) await expect(svg, what).toHaveCSS('rotate', 'none');
    return Promise.all((await buttons.all()).map(async (b) => Math.round((await b.boundingBox()).height)));
  };
  const closed = await looks('its menu closed');
  expect(closed, 'its menu closed').toEqual(closed.map(() => closed[0]));
  const click = async () => {
    await openMore(ui, id);
    await expect(menu(ui)).toMatchAriaSnapshot(`
      - menu:
        - text: Screenshot
        - menuitem /^Element/
        - menuitem "Visible Part"
        - menuitem "Full Page"
        - menuitem /^DevTools/
    `);
    // As Chrome's ⋮: under the button, its right edge at the button's (within its popover's padding), so it stays over
    // its own pane.
    const m = await menu(ui).boundingBox(), b = await pane.locator('[aria-label="More"]').boundingBox();
    expect(m.x + m.width <= b.x + b.width && b.x + b.width - (m.x + m.width) < 8 && m.y > b.y + b.height - 1, JSON.stringify({ m, b })).toBe(true);
    // Back, forward, reload, Pick and ⋮ are icon buttons, as Chrome's: no border, no text, a name for screen readers.
    const names = ['Back', 'Forward', 'Reload', 'Pick an element', 'More'];
    await expect(buttons).toHaveCount(names.length);
    for (const [i, name] of names.entries()) {
      const b = buttons.nth(i);
      await expect(b).toHaveAccessibleName(name);
      await expect(b).toHaveText('');
      await expect(b.locator('svg')).toHaveCount(1);
      await expect(b).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)'); // none seen
    }
    expect(await looks('its menu open'), 'its menu open').toEqual(closed);
    // The same inset from the island's edges for the controls in it; the page reaches its edges (the author's choice).
    // The island: dockview's group of the pane; its header the panel's tab there.
    const island = await ui.locator('.dv-groupview').filter({ has: pane }).boundingBox(), header = ui.locator(`[data-panel="profile:${id}"]`).first();
    const left = async (l: Locator) => Math.round((await l.boundingBox()).x - island.x);
    const right = async (l: Locator) => { const r = await l.boundingBox(); return Math.round(island.x + island.width - (r.x + r.width)); };
    const page = pane.getByTestId('page'), pageBox = await page.boundingBox();
    const inset = { avatar: await left(header.locator('img')), tab: await left(pane.getByRole('tab').first()), back: await left(pane.locator('[aria-label="Back"]')),
      page: await left(page), close: await right(header.locator('[aria-label="Close profile"]')), more: await right(pane.locator('[aria-label="More"]')),
      pageRight: await right(page), pageBottom: Math.round(island.y + island.height - (pageBox.y + pageBox.height)) };
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
  await removed(dir);
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
    await expect(menu(ui)).toMatchAriaSnapshot(`
      - menu:
        - text: Screenshot
        - menuitem /^Element/
        - menuitem "Visible Part"
        - menuitem "Full Page"
        - menuitem /^DevTools/
    `);
    await menu(ui).getByRole('menuitem', { name: new RegExp(`^${label}`) }).click();
  };
  await fromMenu('Full Page');
  await expect.poll(() => shots().length).toBe(1);
  const [full] = shots();
  expect(full).toMatch(/^Kulisa Sam\.admin \d{4}-\d\d-\d\d \d\d\.\d\d\.\d\d\.png$/);
  const fullSize = pngSize(path.join(dir, full));
  expect(fullSize.height > 3000 * dpr - 1, `the whole page (${fullSize.height})`).toBe(true);
  const types = await core(async (k) => (await k.electron.clipboard.read())[0]?.types ?? []);
  expect(types, 'on the clipboard too').toContain('image/png');
  await expect(ui.locator(`[data-panel="profile:${id}"] [role="status"]`)).toHaveText('Screenshot copied and saved');
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
  await expect(ui.locator(`[role="region"][data-profile="${id}"] [aria-label="Pick an element"]`)).toBeDisabled(); // the window knows it: Pick off too
  expect(await core((k) => { const p = k.profile('Sam.admin'); return p.screenshot(p.get(), { scale: 'device', type: 'png', by: 'human' }).then(() => 'taken', (e: Error) => e.message); })).toMatch(/is empty/);
  await openMore(ui, id);
  await expect(menu(ui)).toMatchAriaSnapshot(`
    - menu:
      - text: Screenshot
      - menuitem /^Element/ [disabled]
      - menuitem "Visible Part" [disabled]
      - menuitem "Full Page" [disabled]
      - menuitem /^DevTools/
  `);
  await closeMenu(ui);
  // Back by the tab's own page: Profile.page() would look among the pages while the closed tab's is still going.
  await core(async (k, a) => { const p = k.profile('Sam.admin'); p.closeTab(a.blank); await p.get(a.tall).wc.loadURL(a.was); }, { blank, was, tall });
  await expect(ui.locator(`[role="region"][data-profile="${id}"] [aria-label="Pick an element"]`), 'a page again: Pick on').toBeEnabled();
  await removed(dir);
});

// The thumbnail (src/screenshots, The thumbnail): what the OS would do with the file is stubbed (a file manager, an
// app, the trash: outside the tests' folder).
test('a screenshot shows its thumbnail in its pane\'s corner: a click opens it, it drags out, its menu shows, copies, sends it to the agent, deletes; its × closes it; it fades in and out; it goes by itself unless the pointer is over it', async ({ core, ui, files }) => {
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
  // The thumbnail's page (one at a time: the last one gone before the next is taken), once Playwright has it.
  let tp: Page;
  const thumbGone = () => core((k) => k.stash.thumbWc.isDestroyed());
  const shown = ui.locator('#shotthumb');
  try {
    const take = async () => {
      expect((await ui.evaluate((p) => (window as any).act('tab:screenshot', { profile: p, kind: 'visible' }), id)).error).toBeUndefined();
      await expect.poll(() => core((k) => !!k.shell.windows[0].thumbnails.bounds)).toBe(true);
      const t = await core((k) => { const t = k.shell.windows[0].thumbnails; Object.assign(k.stash, { thumb: t.view, thumbWc: t.view.webContents }); return { file: t.file, bounds: t.bounds }; });
      await expect.poll(() => { tp = ui.context().pages().find((x) => x.url().includes('thumbnail.html') && !x.isClosed()); return !!tp; }).toBe(true);
      return t;
    };
    const state = (s: string) => expect(tp.locator('body')).toHaveAttribute('data-state', s);
    const t = await take(), file = t.file;
    // In the pane's bottom right corner, the picture shown in its page, and drawn by the window too.
    const p = await core((k) => k.profile('Sam.admin').bounds), b = t.bounds;
    expect(b.x > p.x && b.y > p.y && b.x + b.width < p.x + p.width && b.y + b.height < p.y + p.height && p.x + p.width - (b.x + b.width) < 40 && p.y + p.height - (b.y + b.height) < 40, JSON.stringify({ p, b })).toBe(true);
    await expect(tp.locator('img')).toHaveAttribute('src', /^data:image\/png/);
    await state('in');
    await expect(shown).toHaveCount(1);
    await tp.locator('img').click();
    await expect.poll(did).toContain(`open ${file}`);
    await core((k) => { const wc = k.stash.thumbWc; wc.startDrag = (item: { file: string }) => { k.stash.dragged = item.file; }; });
    // Dragged out as the hand drags it: pressed, then moved.
    const img = await tp.locator('img').boundingBox();
    await tp.mouse.move(img.x + img.width / 2, img.y + img.height / 2);
    await tp.mouse.down();
    await tp.mouse.move(img.x + img.width / 2 + 30, img.y + img.height / 2 + 30, { steps: 5 });
    await tp.mouse.up();
    await expect.poll(() => core((k) => k.stash.dragged)).toBe(file);
    // Its menu, the window's, where it was right-clicked; the thumbnail stays while it is open.
    const thumbMenu = async (label: string) => {
      await tp.mouse.click(20, 10, { button: 'right' });
      await expect(menu(ui)).toMatchAriaSnapshot(`
        - menu:
          - menuitem "Show in Folder"
          - menuitem "Copy"
          - menuitem "Send to Agent"
          - menuitem "Delete"
          - menuitem "Close"
      `);
      await choose(ui, label);
      await expect(ui.locator('[role="menu"][data-state="open"]')).toHaveCount(0);
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
    await state('in');
    await tp.getByRole('button').click();
    await expect.poll(async (): Promise<boolean> => tp.isClosed() || await tp.locator('body').getAttribute('data-state').catch((): null => null) === 'out').toBe(true);
    await expect.poll(async () => await core((k) => !k.shell.windows[0].thumbnails.file) && await thumbGone()).toBe(true);
    // It goes by itself after 5 s (the time macOS gives one), fading out first, and stays while the pointer is over it:
    // the main process's clock moved on by the test for its timers of those lengths (driver.ts, clock).
    const STAYS = 5000, FADE = 200; // src/screenshots/main/thumbnail.ts
    await core((k, ms) => k.clock.hold(ms), FADE);
    await take();
    const from = await core((k) => k.logged.length);
    await tp.mouse.move(20, 10);
    await expect.poll(() => core((k, i) => k.logged.slice(i).some((l) => l.includes('thumbnail:hover')), from)).toBe(true); // heard
    await core((k, ms) => k.clock.advance(ms), STAYS + FADE);
    expect(await core((k) => k.shell.windows[0].thumbnails.view === k.stash.thumb), 'held while the pointer is over it').toBe(true);
    await tp.mouse.move(-1, -1); // out of its page
    await expect.poll(() => core((k, i) => k.logged.slice(i).filter((l) => l.includes('thumbnail:hover')).length, from)).toBe(2);
    await core((k, ms) => k.clock.advance(ms), STAYS + FADE);
    expect(await core((k) => !k.shell.windows[0].thumbnails.file), 'gone once its time is over').toBe(true);
    await core((k) => k.clock.release());
  } finally {
    await core((k) => { Object.assign(k.electron.shell, k.stash.real); });
    await core(async (k, url) => { await (await k.profile('Sam.admin').page()).goto(url); }, was);
    await removed(dir);
  }
});

// What a profile keeps across a restart: the profiles with their pictures and words, sign-ins, tabs and the one in
// front; a closed one closed; a deleted one's folders gone at the next start.
test('after a restart: profiles, sign-ins and tabs are back, the one in front in front; a closed profile is still closed, and opens signed in', async ({ core, ui, call, restart, files }) => {
  test.setTimeout(60000); // a restart
  await deleteProfile(core, ui, 'Rhea.admin'); await deleteProfile(core, ui, 'Rob.buyer'); await deleteProfile(core, ui, 'Gone'); await deleteProfile(core, ui, 'Dora');
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
  await call('profile_create', { name: 'Dora' });
  await call('browser_navigate', { profile: 'Dora', url: `${SITE}/app/login?name=dora` });
  await call('profile_close', { profile: 'Dora' });
  const dora = await profileId(core, 'Dora');
  // One deleted: its copy and master go at the next start.
  await core(async (k) => { await k.shell.task.createProfile('Gone'); });
  await deleteProfile(core, ui, 'Gone');
  expect(fs.existsSync(path.join(files.userData, 'deleted-folders.json'))).toBe(true);
  const profiles = () => core((k) => [...k.shell.profiles.values()].map((p) => [p.id, p.avatar, p.description]));
  const before = await profiles();

  const ui2 = await restart();
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
  expect(await core((k, p) => k.shell.closed.has(p) && !k.shell.profiles.has(p), dora)).toBe(true);
  await call('profile_open', { profile: 'Dora' });
  expect(await who(call, 'Dora')).toBe('Signed in as dora');
  const deleted = call('profile_delete', { profile: 'Dora' });
  await answer(ui2);
  await deleted;
});

test("a packaged build (appDevTools off): no DevTools for Kulisa's own UI, a tab's still open", async ({ core, restart }) => {
  test.setTimeout(60000); // a restart
  await core(async (k, url) => { await k.ensureProfile('Sam.admin', url); }, `${SITE}/app`);
  await restart(); // started again as a packaged build would as to DevTools
  // Both refused as they are asked (keys.ts sees the key as it is sent; the window was made without DevTools).
  await core((k) => { const wc = k.shell.win.webContents; wc.focus(); k.press(wc, 'F12'); wc.openDevTools({ mode: 'detach' }); });
  expect(await core((k) => k.shell.win.webContents.isDevToolsOpened())).toBe(false);
  await expect.poll(() => core((k) => !![...k.shell.profiles.values()].find((p) => p.name === 'Sam.admin')?.get())).toBe(true);
  await core(async (k) => { await k.profile('Sam.admin').get().ready; });
  await core((k) => { const wc = k.profile('Sam.admin').get().wc; wc.focus(); k.press(wc, 'F12'); });
  await expect.poll(() => core((k) => k.profile('Sam.admin').get().wc.isDevToolsOpened())).toBe(true);
  await core((k) => k.profile('Sam.admin').get().wc.closeDevTools());
});
