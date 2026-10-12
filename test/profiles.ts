// Renaming and deleting profiles; DevTools.
import fs from 'fs';
import path from 'path';
import { assert, userData, pfile, SITE, sleep, waitFor, who, menuRows, choose, manageProfiles, closeSettings, chooseProfile, setProfileField, rightClick, menuOpen } from './helpers.ts';
import type { Test } from './run.ts';

export default (test: Test) => {
  test('rename keeps the profile and the sign-in', async (ctx) => {
    const r = await ctx.ui(`kulisa.invoke('profiles:rename', { profile: 'sam-seller', name: 'Sam.admin' })`);
    assert.equal(r.id, 'sam-admin');
    assert.equal(await who(ctx, 'sam-admin'), 'Signed in as sam');
    await waitFor(async () => JSON.stringify(await ctx.ui(`[...document.querySelectorAll('.pname')].map((e) => e.textContent)`)) === '["Sam.admin","Elon.buyer"]');
  });
  test('names: typed, pasted, from the agent, checked where they are made (the rule itself: unit/names.test.ts)', async (ctx) => {
    const { shell, ui, call } = ctx;
    // The field leaves other characters out, typed or pasted.
    await manageProfiles(ui);
    await ui(`document.getElementById('profilenew').click()`);
    await waitFor(() => ui(`document.activeElement?.id === 'profilenewname'`));
    void shell.win.webContents.insertText('ann admin·@shop.com');
    await waitFor(async () => (await ui(`document.getElementById('profilenewname').value`)) === 'annadmin@shop.com');
    await closeSettings(ui);
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
    const { shell, ui, call } = ctx;
    await shell.task.createProfile('Temp'); // in the project, open in its task (the agent's profile_create; Settings: tested above)
    const temp = shell.profiles.get('temp');
    assert.equal(temp.folder, 'Profile 4'); // after Sam, Elon and Ann (the profile_create test)
    await call('browser_navigate', { profile: 'temp', url: `${SITE}/app/login?name=tim` });
    assert.equal(await who(ctx, 'temp'), 'Signed in as tim');
    await shell.sessionCookies.save(temp);
    assert.ok(fs.existsSync(shell.sessionCookies.file(temp)));

    await manageProfiles(ui);
    await chooseProfile(ui, 'temp');
    ctx.answer = false; // Cancel
    await ui(`document.getElementById('profilemore').click()`); // ⋯ at its page's top
    await menuRows(ui);
    await choose(ui, 'Delete Profile…');
    await waitFor(() => ctx.asked.length);
    const q = ctx.asked.pop();
    assert.equal(q.message, 'Delete the profile Temp?');
    assert.match(q.detail, /removed for good, here and in every task\. The projects .* let go of it\./);
    await sleep(100); // nothing to wait for: that nothing happens
    assert.ok(shell.profiles.has('temp'), 'nothing is deleted without the confirmation');
    ctx.answer = true;
    const deleted = new Promise((r) => temp.once('deleted', r));
    await rightClick(ui, '#pjlist [data-profile="temp"] .label');
    await menuRows(ui);
    await choose(ui, 'Delete Profile…');
    await deleted;
    ctx.asked.length = 0;
    await waitFor(() => ui(`!document.querySelector('#pjlist [data-profile="temp"]') && !!document.querySelector('#pjlist [data-profile][aria-selected="true"]')`));
    await closeSettings(ui);

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
  test('rename in Settings → Profiles: typed, and Enter or leaving the field saves it; the panes follow', async ({ shell, ui }) => {
    await manageProfiles(ui);
    await chooseProfile(ui, 'elon-buyer');
    const wc = shell.win.webContents;
    shell.win.focus(); wc.focus(); // the keyboard in the window, as the human's hands
    await ui(`(() => { const f = document.getElementById('profilename'); f.focus(); f.select(); })()`);
    await wc.insertText('Elon.shopper');
    for (const type of ['keyDown', 'char', 'keyUp'] as const) wc.sendInputEvent({ type, keyCode: type === 'char' ? '\r' : 'Enter' });
    await waitFor(() => shell.profiles.has('elon-shopper'));
    await waitFor(async () => (await ui(`[...document.querySelectorAll('.pname')].map((e) => e.textContent).join()`)) === 'Sam.admin,Elon.shopper');
    await setProfileField(ui, 'profilename', 'Elon.buyer');
    await waitFor(() => shell.profiles.has('elon-buyer'));
    await closeSettings(ui);
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
    const click = async () => {
      // Opened again when Kulisa's window lost the focus meanwhile (below), as a human opens it again.
      for (let i = 0; !(await menuOpen(ui)) && i < 5; i++) {
        await ui(`document.querySelector('.pane[data-profile="sam-admin"] .more').click()`);
        await waitFor(() => menuOpen(ui), 1500).catch(() => {});
      }
      assert.deepEqual(await menuRows(ui), ['DevTools']);
      // As Chrome's ⋮: under the button, its right edge at the button's, so it stays over its own pane.
      const [m, b] = await ui(`[document.querySelector('.menu[data-state="open"]'), document.querySelector('.pane[data-profile="sam-admin"] .more')].map((e) => e.getBoundingClientRect().toJSON())`);
      assert.ok(Math.abs(m.right - b.right) < 1 && m.top >= b.bottom, JSON.stringify({ m, b }));
      // Back, forward, reload, Pick and ⋮ are icon buttons, as Chrome's: no border, no text, a name for screen readers.
      assert.deepEqual(await ui(`[...document.querySelectorAll('.pane[data-profile="sam-admin"] .bar .icon')].map((b) =>
        [b.className, b.textContent.trim(), !!b.querySelector('svg'), !!b.ariaLabel, getComputedStyle(b).borderTopWidth])`),
      ['back', 'fwd', 'reload', 'pick', 'more'].map((c) => [`${c} icon`, '', true, true, '0px']));
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
};
