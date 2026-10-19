// Renaming and deleting profiles; DevTools.
import electron from 'electron';
import fs from 'fs';
import path from 'path';
import { assert, userData, pfile, SITE, sleep, waitFor, who, menuRows, choose, manageProfiles, closeSettings, chooseProfile, setProfileField, rightClick, menuOpen, closeMenu, press, CMD, MENU, SUBMENU, panel } from './helpers.ts';
import type { Test } from './run.ts';

export default (test: Test) => {
  test('rename keeps the profile and the sign-in', async (ctx) => {
    const r = await ctx.ui(`kulisa.invoke('profiles:rename', { profile: 'sam-seller', name: 'Sam.admin' })`);
    assert.equal(r.id, 'sam-admin');
    assert.equal(await who(ctx, 'sam-admin'), 'Signed in as sam');
    await waitFor(async () => JSON.stringify(await ctx.ui(`[...document.querySelectorAll('.pname')].map((e) => e.textContent)`)) === '["Sam.admin","Elon.buyer"]');
  });
  test('names: typed, pasted, from the agent, checked where they are made (the rule itself: unit/names.test.ts)', async (ctx) => {
    const { shell, ui, sui, call } = ctx;
    // The field leaves other characters out, typed or pasted.
    await manageProfiles(ctx);
    await sui(`document.getElementById('profilenew').click()`);
    await waitFor(() => sui(`document.activeElement?.id === 'profilenewname'`));
    void shell.settings.win.webContents.insertText('ann admin·@shop.com');
    await waitFor(async () => (await sui(`document.getElementById('profilenewname').value`)) === 'annadmin@shop.com');
    await closeSettings(ctx);
    // Checked again where names are made: the agent, a rename, a project, a task.
    await assert.rejects(call('profile_create', { name: 'Ann admin' }), /letters, digits and @ \. _ \+ - only/);
    await assert.rejects(call('profile_create', { name: '@' }), /starting with a letter or a digit/);
    assert.match((await ui(`kulisa.invoke('profiles:rename', { profile: 'sam-admin', name: 'Sam admin' })`)).error, /only/);
    assert.match((await ui(`kulisa.invoke('project:new', { name: '..' })`)).error, /starting with a letter or a digit/);
    assert.match((await ui(`kulisa.invoke('task:rename', { key: tasks.current, name: '@' })`)).error, /starting with a letter or a digit/);
    assert.match((await ui(`kulisa.invoke('task:rename', { key: tasks.current, name: 'a b' })`)).error, /only/);
    assert.ok(shell.profiles.has('sam-admin') && !shell.profiles.has('ann-admin-2'));
  });
  test("delete a profile in Settings (its page's ⋯, its row's right-click): sign-ins and data gone, everywhere; a new one of the same name starts clean", async (ctx) => {
    const { shell, ui, sui, call } = ctx;
    await shell.task.createProfile('Temp'); // in the project, open in its task (the agent's profile_create; Settings: tested above)
    const temp = shell.profiles.get('temp');
    assert.equal(temp.folder, 'Profile 4'); // after Sam, Elon and Ann (the profile_create test)
    await call('browser_navigate', { profile: 'temp', url: `${SITE}/app/login?name=tim` });
    assert.equal(await who(ctx, 'temp'), 'Signed in as tim');
    await shell.sessionCookies.save(temp);
    assert.ok(fs.existsSync(shell.sessionCookies.file(temp)));

    await manageProfiles(ctx);
    await chooseProfile(sui, 'temp');
    ctx.answer = false; // Cancel
    await sui(`document.getElementById('profilemore').click()`); // ⋯ at its page's top
    await menuRows(sui);
    await choose(sui, 'Delete Profile…');
    await waitFor(() => ctx.asked.length);
    const q = ctx.asked.pop();
    assert.equal(q.message, 'Delete the profile Temp?');
    assert.match(q.detail, /removed for good, here and in every task\. The projects .* let go of it\./);
    await sleep(100); // nothing to wait for: that nothing happens
    assert.ok(shell.profiles.has('temp'), 'nothing is deleted without the confirmation');
    ctx.answer = true;
    const deleted = new Promise((r) => temp.once('deleted', r));
    await rightClick(sui, '#pjlist [data-profile="temp"] .label');
    await menuRows(sui);
    await choose(sui, 'Delete Profile…');
    await deleted;
    ctx.asked.length = 0;
    await waitFor(() => sui(`!document.querySelector('#pjlist [data-profile="temp"]') && !!document.querySelector('#pjlist [data-profile][aria-selected="true"]')`));
    await closeSettings(ctx);

    assert.deepEqual([...shell.profiles.keys()], ['sam-admin', 'elon-buyer']);
    assert.equal(temp.tabs.length, 0);
    assert.deepEqual(await temp.session.cookies.get({}), []);
    assert.ok(!fs.existsSync(shell.sessionCookies.file(temp)));
    const savedIds = () => JSON.parse(fs.readFileSync(pfile('profiles.json'), 'utf8')).map((p: { id: string }) => p.id).join();
    await waitFor(() => savedIds() === 'sam-admin,elon-buyer');
    assert.equal(shell.profileStore.get('temp'), null, 'gone from the store');
    // Profile 3: Ann, the profile_create test; each its task's copy and its master.
    const master = (f: string) => path.join(userData, 'profiles', f);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(userData, 'deleted-folders.json'), 'utf8')), [pfile('Profile 3'), master('Profile 3'), pfile('Profile 4'), master('Profile 4')]);
    await assert.rejects(call('browser_snapshot', { profile: 'temp' }), /No profile "temp"/);
    await waitFor(async () => (await ui(`document.querySelectorAll('.pane').length`)) === 2);

    // Same name again: a new folder (the old one goes at the next start), signed out.
    await shell.task.createProfile('Temp');
    assert.equal(shell.profiles.get('temp').folder, 'Profile 5');
    await call('browser_navigate', { profile: 'temp', url: `${SITE}/app` });
    assert.equal(await who(ctx, 'temp'), 'Signed out');
    await ui(`kulisa.invoke('profiles:delete', { profile: 'temp' })`);
    await waitFor(() => !shell.profileStore.get('temp'));
    ctx.asked.length = 0;
  });
  test('rename in Settings → Profiles: typed, and Enter or leaving the field saves it; the panes follow', async (ctx) => {
    const { shell, ui, sui } = ctx;
    await manageProfiles(ctx);
    await chooseProfile(sui, 'elon-buyer');
    const wc = shell.settings.win.webContents;
    shell.settings.win.focus(); wc.focus(); // the keyboard in Settings' window, as the human's hands
    await sui(`(() => { const f = document.getElementById('profilename'); f.focus(); f.select(); })()`);
    await wc.insertText('Elon.shopper');
    for (const type of ['keyDown', 'char', 'keyUp'] as const) wc.sendInputEvent({ type, keyCode: type === 'char' ? '\r' : 'Enter' });
    await waitFor(() => shell.profiles.has('elon-shopper'));
    await waitFor(async () => (await ui(`[...document.querySelectorAll('.pname')].map((e) => e.textContent).join()`)) === 'Sam.admin,Elon.shopper');
    await setProfileField(sui, 'profilename', 'Elon.buyer');
    await waitFor(() => shell.profiles.has('elon-buyer'));
    await closeSettings(ctx);
  });
  test('a page never makes a region that drags the window (Teams declared one, and it took every click over the panes)', async ({ shell }) => {
    const wc = shell.profiles.get('sam-admin').get().wc;
    const back = wc.getURL();
    await wc.loadURL(`${SITE}/drag`);
    await waitFor(async () => (await wc.executeJavaScript("getComputedStyle(bar).getPropertyValue('app-region')")) === 'no-drag');
    await wc.loadURL(back);
  });
  test("F12 opens and closes DevTools: a tab's, or Kulisa's own outside the pages", async ({ shell }) => {
    for (const wc of [shell.profiles.get('sam-admin').get().wc, shell.win.webContents]) {
      const press = () => { wc.focus(); wc.sendInputEvent({ type: 'keyDown', keyCode: 'F12' }); wc.sendInputEvent({ type: 'keyUp', keyCode: 'F12' }); };
      press();
      await waitFor(() => wc.isDevToolsOpened());
      press();
      await waitFor(() => !wc.isDevToolsOpened());
    }
  });
  test("DevTools in a pane's ⋮ menu opens and closes the DevTools of its active tab", async ({ shell, ui }) => {
    const wc = shell.profiles.get('sam-admin').get().wc;
    // ⋮ as tall as the bar's other buttons, its dots upright, its menu open or not: the Details' trigger's rule (then
    // .more) took its height and turned its dots until its menu opened (2026-10-15).
    const looks = () => ui(`[...document.querySelectorAll('.pane[data-profile="sam-admin"] .bar .icon')].map((b) => [Math.round(b.getBoundingClientRect().height), getComputedStyle(b.querySelector('svg')).rotate])`);
    const closed = await looks();
    assert.deepEqual(closed, closed.map(() => [closed[0][0], 'none']), 'its menu closed');
    const click = async () => {
      // Opened again when Kulisa's window lost the focus meanwhile (below), as a human opens it again.
      for (let i = 0; !(await menuOpen(ui)) && i < 5; i++) {
        await ui(`document.querySelector('.pane[data-profile="sam-admin"] .more').click()`);
        await waitFor(() => menuOpen(ui), 1500).catch(() => {});
      }
      assert.deepEqual(await menuRows(ui), ['Screenshot', 'DevTools']);
      // As Chrome's ⋮: under the button, its right edge at the button's, so it stays over its own pane.
      const [m, b] = await ui(`[document.querySelector('.menu[data-state="open"]'), document.querySelector('.pane[data-profile="sam-admin"] .more')].map((e) => e.getBoundingClientRect().toJSON())`);
      assert.ok(Math.abs(m.right - b.right) < 1 && m.top >= b.bottom, JSON.stringify({ m, b }));
      // Back, forward, reload, Pick and ⋮ are icon buttons, as Chrome's: no border, no text, a name for screen readers.
      assert.deepEqual(await ui(`[...document.querySelectorAll('.pane[data-profile="sam-admin"] .bar .icon')].map((b) =>
        [b.className, b.textContent.trim(), !!b.querySelector('svg'), !!b.ariaLabel, getComputedStyle(b).borderTopWidth])`),
      ['back', 'fwd', 'reload', 'pick', 'more'].map((c) => [`${c} icon`, '', true, true, '0px']));
      assert.deepEqual(await looks(), closed, 'its menu open');
      // The same inset from the island's edges for the controls in it; the page reaches its edges (the author's choice, 2026-10-08).
      const inset = await ui(`(() => {
        const pane = document.querySelector('.pane[data-profile="sam-admin"]'), island = pane.closest('.dv-groupview').getBoundingClientRect();
        const header = document.querySelector('.ptab[data-panel="' + pane.closest('.dv-groupview').querySelector('.ptab').dataset.panel + '"]');
        const r = (e) => e.getBoundingClientRect();
        const left = (e) => Math.round(r(e).left - island.left), right = (e) => Math.round(island.right - r(e).right);
        return { avatar: left(header.querySelector('.avatar')), tab: left(pane.querySelector('.tab')), back: left(pane.querySelector('.back')),
          page: left(pane.querySelector('.content')), close: right(header.querySelector('.close')), more: right(pane.querySelector('.more')),
          pageRight: right(pane.querySelector('.content')), pageBottom: Math.round(island.bottom - r(pane.querySelector('.content')).bottom) };
      })()`);
      assert.deepEqual(inset, { avatar: 8, tab: 8, back: 8, page: 0, close: 8, more: 8, pageRight: 0, pageBottom: 0 });
      await choose(ui, 'DevTools');
    };
    await click();
    await waitFor(() => wc.isDevToolsOpened());
    // Its window takes the focus a moment later, and Kulisa's window losing it closes a menu opened meanwhile (lib/views.ts).
    // A human comes to ⋮ again after that; the test too, and again when the focus went later still (under load). (A window
    // manager may leave the focus with Kulisa, and may not give it back when asked.)
    await waitFor(() => !shell.win.isFocused(), 3000).catch(() => {});
    await click();
    await waitFor(() => !wc.isDevToolsOpened());
  });

  // The human's pictures (src/screenshots): on the clipboard and in the OS's folder of screenshots (the group's folder
  // here: KULISA_SCREENSHOTS), at the screen's density, an element chosen as Pick chooses; not the agent's action.
  test("a pane's ⋮ → Screenshot takes an element, the visible part or the whole page, to the clipboard and the folder of screenshots", async ({ shell, ui }) => {
    const dir = process.env.KULISA_SCREENSHOTS, admin = shell.profiles.get('sam-admin'), wc = () => admin.get().wc;
    fs.rmSync(dir, { recursive: true, force: true });
    const files = () => (fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []);
    const page = await admin.page(), was = page.url();
    await page.goto(`${SITE}/tall`);
    const dpr = await page.evaluate(() => devicePixelRatio);
    const actions: string[] = [];
    const watch = (a: { caption: string }) => { actions.push(a.caption); };
    shell.bus.on('agent-action', watch);
    const caption = () => ui(`document.querySelector('.ptab[data-panel="${panel(shell, 'sam-admin')}"] .caption').textContent`);
    const fromMenu = async (label: string) => {
      for (let i = 0; !(await menuOpen(ui)) && i < 5; i++) {
        await ui(`document.querySelector('.pane[data-profile="sam-admin"] .more').click()`);
        await waitFor(() => menuOpen(ui), 1500).catch(() => {});
      }
      await ui(`${MENU}.querySelector('.item[aria-haspopup]').click()`);
      await waitFor(async () => (await ui(`document.querySelectorAll('.menu[data-state="open"]').length`)) === 2);
      assert.deepEqual(await menuRows(ui, SUBMENU), ['Element', 'Visible Part', 'Full Page']);
      await choose(ui, label, SUBMENU);
    };
    await fromMenu('Full Page');
    await waitFor(() => files().length === 1);
    const [full] = files();
    assert.match(full, /^Kulisa Sam\.admin \d{4}-\d\d-\d\d \d\d\.\d\d\.\d\d\.png$/);
    const fullImage = electron.nativeImage.createFromPath(path.join(dir, full));
    assert.ok(fullImage.getSize().height > 3000 * dpr - 1, `the whole page (${fullImage.getSize().height})`);
    const [item] = await electron.clipboard.read();
    assert.ok(item.types.includes('image/png'), `on the clipboard too (${item.types})`);
    await waitFor(async () => (await caption()) === 'Screenshot copied and saved');
    // The element: its key, then a click on it in the page, as Pick (which reaches the page a moment after it starts:
    // clicked again until it comes, as in Pick's test).
    press(wc(), 'S', CMD, 'shift');
    await waitFor(() => shell.windows[0].picking.has('sam-admin'));
    const b = await page.locator('#box').boundingBox();
    const x = Math.round(b.x + b.width / 2), y = Math.round(b.y + b.height / 2);
    for (let i = 0; files().length < 2 && i < 20; i++) {
      wc().sendInputEvent({ type: 'mouseMove', x, y });
      wc().sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
      wc().sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
      await waitFor(() => files().length === 2, 500).catch(() => {});
    }
    const element = electron.nativeImage.createFromPath(path.join(dir, files().find((f) => f !== full)));
    assert.deepEqual(element.getSize(), { width: Math.round(200 * dpr), height: Math.round(120 * dpr) }, 'the element alone, at the screen\'s density');
    // Esc while choosing: nothing taken.
    press(wc(), 'S', CMD, 'shift');
    await waitFor(() => shell.windows[0].picking.has('sam-admin'));
    press(wc(), 'Escape');
    await waitFor(() => !shell.windows[0].picking.has('sam-admin'));
    await fromMenu('Visible Part');
    await waitFor(() => files().length === 3);
    shell.bus.off('agent-action', watch);
    assert.ok(!actions.includes('screenshot'), `not captioned as the agent's (${actions})`);
    // An empty tab: nothing to take, its rows off.
    const blank = admin.newTab('about:blank').id;
    await waitFor(() => ui(`document.querySelector('.pane[data-profile="sam-admin"] .pick').disabled`)); // the window knows it: Pick off too
    await assert.rejects(admin.screenshot(admin.get(), { scale: 'device', type: 'png', by: 'human' }), /is empty/);
    await ui(`document.querySelector('.pane[data-profile="sam-admin"] .more').click()`);
    await waitFor(() => menuOpen(ui));
    await ui(`${MENU}.querySelector('.item[aria-haspopup]').click()`);
    await waitFor(async () => (await ui(`document.querySelectorAll('.menu[data-state="open"]').length`)) === 2);
    assert.deepEqual(await menuRows(ui, SUBMENU), ['Element (off)', 'Visible Part (off)', 'Full Page (off)']);
    await closeMenu(ui);
    admin.closeTab(blank);
    await page.goto(was); // as later files expect it
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // The thumbnail (src/screenshots, The thumbnail): what the OS would do with the file is stubbed (a file manager, an
  // app, the trash: outside the tests' folder).
  test('a screenshot shows its thumbnail in its pane\'s corner: a click opens it, it drags out, its menu shows, copies, sends it to the agent, deletes; it goes by itself unless the pointer is over it', async ({ shell, ui, ptyOutput }) => {
    const dir = process.env.KULISA_SCREENSHOTS, admin = shell.profiles.get('sam-admin'), w = shell.windows[0];
    const page = await admin.page(), was = page.url();
    await page.goto(`${SITE}/tall`);
    const did: string[] = [];
    const os = electron.shell, real = { openPath: os.openPath, showItemInFolder: os.showItemInFolder, trashItem: os.trashItem };
    os.openPath = async (f) => { did.push(`open ${f}`); return ''; };
    os.showItemInFolder = (f) => { did.push(`show ${f}`); };
    os.trashItem = async (f) => { did.push(`trash ${f}`); fs.rmSync(f); };
    try {
      const take = async () => {
        assert.equal((await ui(`act('tab:screenshot', { profile: 'sam-admin', kind: 'visible' })`)).error, undefined);
        await waitFor(() => w.thumbnails.bounds);
        return { file: w.thumbnails.file, view: w.thumbnails.view, bounds: w.thumbnails.bounds };
      };
      const t = await take(), file = t.file, wc = t.view.webContents;
      // In the pane's bottom right corner, the picture shown in its page, and drawn by the window too.
      const p = admin.bounds, b = t.bounds;
      assert.ok(b.x > p.x && b.y > p.y && b.x + b.width < p.x + p.width && b.y + b.height < p.y + p.height && p.x + p.width - (b.x + b.width) < 40 && p.y + p.height - (b.y + b.height) < 40, JSON.stringify({ p, b }));
      await waitFor(() => wc.executeJavaScript(`document.querySelector('img').src.startsWith('data:image/png')`));
      await waitFor(() => ui(`!!document.getElementById('shotthumb')`));
      await wc.executeJavaScript(`document.querySelector('img').click()`);
      await waitFor(() => did.includes(`open ${file}`));
      let dragged: Electron.Item | undefined;
      wc.startDrag = (item) => { dragged = item; };
      await wc.executeJavaScript(`document.querySelector('img').dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true })); 0`);
      await waitFor(() => dragged?.file === file);
      // Its menu, the window's, where it was right-clicked; the thumbnail stays while it is open.
      const menu = async (label: string) => {
        await wc.executeJavaScript(`document.dispatchEvent(new MouseEvent('contextmenu', { clientX: 20, clientY: 10, bubbles: true, cancelable: true })); 0`);
        assert.deepEqual(await menuRows(ui), ['Show in Folder', 'Copy', 'Send to Agent', '-', 'Delete', 'Close']);
        await choose(ui, label);
        await waitFor(async () => !(await menuOpen(ui)));
      };
      await menu('Show in Folder');
      await waitFor(() => did.includes(`show ${file}`));
      await electron.clipboard.writeText('something else');
      await menu('Copy');
      await waitFor(async () => (await electron.clipboard.read())[0]?.types.includes('image/png'));
      await menu('Send to Agent');
      await waitFor(() => ptyOutput().includes(`'${file}' `));
      shell.pty.write('\x15'); // Ctrl+U: clear the line for the next tests
      await menu('Delete');
      await waitFor(() => did.includes(`trash ${file}`) && !w.thumbnails.file && wc.isDestroyed());
      await waitFor(async () => !(await ui(`!!document.getElementById('shotthumb')`)));
      // It goes by itself after 5 s (the time macOS gives one), and stays while the pointer is over it: the test waits
      // that long, twice.
      const held = await take();
      await held.view.webContents.executeJavaScript(`document.documentElement.dispatchEvent(new MouseEvent('mouseenter')); 0`);
      await sleep(5500);
      assert.equal(w.thumbnails.view, held.view, 'held while the pointer is over it');
      await held.view.webContents.executeJavaScript(`document.documentElement.dispatchEvent(new MouseEvent('mouseleave')); 0`);
      await waitFor(() => !w.thumbnails.file, 7000);
    } finally {
      Object.assign(os, real);
      await page.goto(was); // as later files expect it
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
};
