// Renaming and deleting profiles; DevTools.
const fs = require('fs');
const path = require('path');
const { assert, root, userData, project, pfile, savedTabs, panel, SITE, sleep, waitFor, who, menuRows, choose, manageProfiles, menuOpen, rightClick,
  box, pageBox, viewOn, dock, ctrl, near } = require('./helpers');

module.exports = (test) => {
  test('rename keeps the profile and the sign-in', async (ctx) => {
    const r = await ctx.ui(`kulisa.invoke('profile:rename', { profile: 'sam-seller', name: 'Sam.admin' })`);
    assert.equal(r.id, 'sam-admin');
    assert.equal(await who(ctx, 'sam-admin'), 'Signed in as sam');
    await sleep(200); // the window re-renders after the state update
    assert.deepEqual(await ctx.ui(`[...document.querySelectorAll('.pname')].map((e) => e.textContent)`), ['Sam.admin', 'Elon.buyer']);
  });
  test('names: the characters of an email address, letters of any language; typed, pasted, from the agent', async (ctx) => {
    const { shell, ui, call } = ctx;
    const { nameError, slugOf } = require('../src/main/names');
    for (const ok of ['ann+test@shop.com', 'ann_lee.admin', 'Анна', '花子', 'x'.repeat(64)]) assert.equal(nameError(ok), null, ok);
    for (const bad of ['', '@', '-', '_x', '-x', '.x', 'Ann admin', 'Sam · seller', 'a/b', '..', '.', 'x'.repeat(65)]) assert.ok(nameError(bad), bad);
    assert.equal(slugOf('花子@Shop.com', 'p'), '花子-shop-com');
    // The field leaves other characters out, typed or pasted.
    await manageProfiles(ui);
    await ui(`document.getElementById('newProfile').focus()`);
    shell.win.webContents.insertText('ann admin·@shop.com');
    await waitFor(async () => (await ui(`document.getElementById('newProfile').value`)) === 'annadmin@shop.com');
    await ui(`document.getElementById('newProfile').value = ''; document.getElementById('profiles').close()`);
    // Checked again where names are made: the agent, a rename, a project, a workspace.
    await assert.rejects(call('profile_create', { name: 'Ann admin' }), /letters, digits and @ \. _ \+ - only/);
    await assert.rejects(call('profile_create', { name: '@' }), /starting with a letter or a digit/);
    assert.match((await ui(`kulisa.invoke('profile:rename', { profile: 'sam-admin', name: 'Sam admin' })`)).error, /only/);
    assert.match((await ui(`kulisa.invoke('project:new', { name: '..' })`)).error, /starting with a letter or a digit/);
    assert.match((await ui(`kulisa.invoke('ws:new', { name: '@' })`)).error, /starting with a letter or a digit/);
    assert.match((await ui(`kulisa.invoke('ws:new', { name: 'a b' })`)).error, /only/);
    assert.ok(shell.profiles.has('sam-admin') && !shell.profiles.has('ann-admin-2'));
  });
  test('delete a profile in the editor: sign-ins and data gone, a new one of the same name starts clean', async (ctx) => {
    const { shell, ui, call } = ctx;
    await ui(`kulisa.invoke('profile:new', { name: 'Temp' })`);
    const temp = shell.profiles.get('temp');
    assert.equal(temp.folder, 'Profile 4'); // after Sam, Elon and Ann (the profile_create test)
    await call('browser_navigate', { profile: 'temp', url: `${SITE}/app/login?name=tim` });
    assert.equal(await who(ctx, 'temp'), 'Signed in as tim');
    await shell.sessionCookies.save(temp);
    assert.ok(fs.existsSync(shell.sessionCookies.file(temp)));

    await manageProfiles(ui);
    await waitFor(async () => (await ui(`document.querySelectorAll('#plist .prow').length`)) === 3);
    const row = `[...document.querySelectorAll('#plist .prow')].find((r) => r.querySelector('.pid').textContent === 'temp')`;
    ctx.answer = false; // Cancel
    await ui(`${row}.querySelector('.del').click()`);
    await waitFor(() => ctx.asked.length);
    assert.equal(ctx.asked.pop().message, 'Delete the profile Temp?');
    await sleep(100);
    assert.ok(shell.profiles.has('temp'), 'nothing is deleted without the confirmation');
    ctx.answer = true;
    const deleted = new Promise((r) => temp.once('deleted', r));
    await ui(`${row}.querySelector('.del').click()`);
    await deleted;
    ctx.asked.length = 0;
    await ui(`document.getElementById('closeProfiles').click()`);

    assert.deepEqual([...shell.profiles.keys()], ['sam-admin', 'elon-buyer']);
    assert.equal(temp.tabs.length, 0);
    assert.deepEqual(await temp.session.cookies.get({}), []);
    assert.ok(!fs.existsSync(shell.sessionCookies.file(temp)));
    const savedIds = () => JSON.parse(fs.readFileSync(pfile('profiles.json'), 'utf8')).map((p) => p.id).join();
    await waitFor(() => savedIds() === 'sam-admin,elon-buyer');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(userData, 'deleted-folders.json'), 'utf8')), [pfile('Profile 3'), pfile('Profile 4')]); // Profile 3: Ann, the profile_create test
    await assert.rejects(call('browser_snapshot', { profile: 'temp' }), /No profile "temp"/);
    await waitFor(async () => (await ui(`document.querySelectorAll('.pane').length`)) === 2);

    // Same name again: a new folder (the old one goes at the next start), signed out.
    await ui(`kulisa.invoke('profile:new', { name: 'Temp' })`);
    assert.equal(shell.profiles.get('temp').folder, 'Profile 5');
    await call('browser_navigate', { profile: 'temp', url: `${SITE}/app` });
    assert.equal(await who(ctx, 'temp'), 'Signed out');
    await ui(`kulisa.invoke('profile:delete', { profile: 'temp' })`);
  });
  test('rename in the profile editor', async ({ shell, ui }) => {
    await manageProfiles(ui);
    const name = `[...document.querySelectorAll('#plist .prow')].find((r) => r.querySelector('.pid').textContent === 'elon-buyer').querySelector('.name')`;
    await ui(`(() => { const n = ${name}; n.value = 'Elon.shopper'; n.dispatchEvent(new Event('change')); })()`);
    await waitFor(() => shell.profiles.has('elon-shopper'));
    await ui(`(() => { const n = [...document.querySelectorAll('#plist .prow')].find((r) => r.querySelector('.pid').textContent === 'elon-shopper').querySelector('.name'); n.value = 'Elon.buyer'; n.dispatchEvent(new Event('change')); })()`);
    await waitFor(() => shell.profiles.has('elon-buyer'));
    await ui(`document.getElementById('closeProfiles').click()`);
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
      await ui(`document.querySelector('.pane[data-profile="sam-admin"] .more').click()`);
      assert.deepEqual(await menuRows(ui), ['DevTools']);
      // As Chrome's ⋮: under the button, its right edge at the button's, so it stays over its own pane.
      const [m, b] = await ui(`[document.getElementById('menu'), document.querySelector('.pane[data-profile="sam-admin"] .more')].map((e) => e.getBoundingClientRect().toJSON())`);
      assert.ok(Math.abs(m.right - b.right) < 1 && m.top >= b.bottom, JSON.stringify({ m, b }));
      // Back, forward, reload, Pick and ⋮ are icon buttons, as Chrome's: no border, no text, a name for screen readers.
      assert.deepEqual(await ui(`[...document.querySelectorAll('.pane[data-profile="sam-admin"] .bar .icon')].map((b) =>
        [b.className, b.textContent.trim(), !!b.querySelector('svg'), !!b.ariaLabel, getComputedStyle(b).borderTopWidth])`),
      ['back', 'fwd', 'reload', 'pick', 'more'].map((c) => [`${c} icon`, '', true, true, '0px']));
      // The same inset from the island's edges for everything in it, left, right and below.
      const inset = await ui(`(() => {
        const pane = document.querySelector('.pane[data-profile="sam-admin"]'), island = pane.closest('.dv-groupview').getBoundingClientRect();
        const header = document.querySelector('.ptab[data-panel="' + pane.closest('.dv-groupview').querySelector('.ptab').dataset.panel + '"]');
        const r = (e) => e.getBoundingClientRect();
        const left = (e) => Math.round(r(e).left - island.left), right = (e) => Math.round(island.right - r(e).right);
        return { dot: left(header.querySelector('.dot')), tab: left(pane.querySelector('.tab')), back: left(pane.querySelector('.back')),
          page: left(pane.querySelector('.content')), close: right(header.querySelector('.close')), more: right(pane.querySelector('.more')),
          pageRight: right(pane.querySelector('.content')), pageBottom: Math.round(island.bottom - r(pane.querySelector('.content')).bottom) };
      })()`);
      assert.deepEqual(inset, { dot: 8, tab: 8, back: 8, page: 8, close: 8, more: 8, pageRight: 8, pageBottom: 8 });
      await choose(ui, 'DevTools');
    };
    await click();
    await waitFor(() => wc.isDevToolsOpened());
    await click();
    await waitFor(() => !wc.isDevToolsOpened());
  });
};
