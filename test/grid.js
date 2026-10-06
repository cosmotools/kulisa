// The grid of panels, projects, layouts, menus.
const fs = require('fs');
const path = require('path');
const { assert, root, userData, project, pfile, savedTabs, panel, SITE, sleep, waitFor, who, menuRows, choose, manageProfiles, menuOpen, rightClick,
  box, pageBox, viewOn, dock, ctrl, near } = require('./helpers');

module.exports = (test) => {
  test('grid: a pane moved next to the terminal takes its page along', async ({ shell, ui }) => {
    await dock(ui, `api.getPanel('profile:Profile 1').api.moveTo({ group: api.getPanel('terminal').group, position: 'right' })`);
    await waitFor(() => viewOn(shell, ui, 'sam-admin'));
    await waitFor(() => viewOn(shell, ui, 'elon-buyer'));
    const sam = await pageBox(ui, 'sam-admin'), term = await box(ui, '#term');
    assert.ok(sam.x > term.x + term.width - 1 && sam.y + sam.height > term.y, 'Sam is right of the terminal');
  });
  test('grid: a pane stacked behind another as a tab hides its page until chosen', async ({ shell, ui }) => {
    const sam = shell.profiles.get('sam-admin'), elon = shell.profiles.get('elon-buyer');
    await dock(ui, `api.getPanel('profile:Profile 1').api.moveTo({ group: api.getPanel('profile:Profile 2').group, position: 'center' })`);
    await waitFor(() => viewOn(shell, ui, 'sam-admin'));
    assert.equal(elon.get().view.getVisible(), false);
    await dock(ui, `api.getPanel('profile:Profile 2').api.setActive()`);
    await waitFor(() => viewOn(shell, ui, 'elon-buyer'));
    assert.equal(sam.get().view.getVisible(), false);
  });
  test('grid: while a pane is dragged, pages are pictures (drop targets are HTML), live again after the drop', async ({ shell, ui }) => {
    await dock(ui, `api.fromJSON(api.toJSON())`); // fresh, nothing stacked
    await ui(`window.__layoutPreset('columns')`);
    await waitFor(() => viewOn(shell, ui, 'sam-admin'));
    await ui(`document.querySelector('.ptab[data-panel="profile:Profile 2"]').dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: new DataTransfer() }))`);
    await waitFor(() => [...shell.profiles.values()].every((p) => !p.get().view.getVisible()));
    await waitFor(async () => (await ui(`document.querySelectorAll('.pane .content img.snapshot').length`)) === 2);
    await ui(`document.querySelector('.ptab[data-panel="profile:Profile 2"]').dispatchEvent(new DragEvent('dragend', { bubbles: true }))`);
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
    assert.equal(await ui(`document.querySelectorAll('.pane .content img.snapshot').length`), 0);
  });
  test('projects: another folder has its own profiles and agent; the first comes back as it was, its agent resumed', async (ctx) => {
    const { shell, ui } = ctx;
    const other = path.join(root, 'other');
    fs.mkdirSync(other, { recursive: true });
    const sam = shell.profiles.get('sam-admin');
    const firstPty = shell.pty;
    await ui(`kulisa.invoke('project:open', { folder: ${JSON.stringify(other)} })`);
    await waitFor(() => shell.project === other && shell.pty && shell.pty !== firstPty);
    ctx.watchPty(shell.pty);
    await waitFor(async () => (await ctx.termText()).includes(`agent: rc of ${other}`)); // started by the shell, in the project
    assert.equal((await ctx.termText()).split('exec cat -v').length - 1, 1, 'the command that starts the agent shows once');
    assert.equal(shell.profiles.size, 0);
    assert.ok(sam.tabs.every((t) => t.wc.isDestroyed()), "the first project's tabs are closed");
    assert.equal(shell.win.getTitle(), 'other — Kulisa');
    assert.equal(shell.resumedSession, null, 'a new project has no conversation to resume');
    await waitFor(async () => (await ui(`document.getElementById('projectName').textContent`)) === 'other' && ui(`!!window.__dock.getPanel('terminal')`));
    assert.equal(await ui(`document.querySelectorAll('.pane').length`), 0);
    await ui(`kulisa.invoke('profile:new', { name: 'Sam.seller' })`); // the same name as in the first project
    assert.equal(shell.profiles.get('sam-seller').dir, path.join(userData, 'projects', 'other', '1', 'Profile 1'), "profiles are in their project's data");
    await ctx.call('browser_navigate', { profile: 'sam-seller', url: `${SITE}/app` });
    assert.equal(await who(ctx, 'sam-seller'), 'Signed out', "the first project's sign-ins stay there");

    // The project button: a menu of the projects (this one not choosable), Open Folder, and the dialog for the rest.
    await ui(`document.getElementById('openProjects').click()`);
    assert.deepEqual(await menuRows(ui), ['project', 'other', '-', 'Open Folder…', 'Manage Projects…', '-', 'Close Project', 'Remove Project…']);
    const rows = await ui(`[...document.querySelectorAll('#menu .item')].slice(0, 2).map((b) => ({ dot: getComputedStyle(b.querySelector('.dot')).backgroundColor,
      folder: b.querySelector('small').textContent, check: b.querySelector('kbd').textContent }))`);
    assert.deepEqual(rows.map((r) => r.folder), [project, other], 'each with its folder');
    assert.equal(rows[1].check, '✓', 'the open one is marked');
    assert.equal(rows[0].dot, 'rgb(74, 123, 208)', "a dot in the project's color");
    const under = await ui(`(() => { const b = document.getElementById('openProjects').getBoundingClientRect(), m = document.getElementById('menu').getBoundingClientRect();
      return m.top >= b.bottom && m.top < b.bottom + 10 && Math.abs(m.left - b.left) < 2; })()`);
    assert.ok(under, 'under the button');
    await ui(`document.getElementById('openProjects').click()`); // again: closes it
    await waitFor(async () => !(await menuOpen(ui)));
    await ui(`document.getElementById('openProjects').click()`);
    await menuRows(ui);
    await choose(ui, 'Manage Projects…');
    await waitFor(() => ui(`document.getElementById('projects').open && !!document.querySelector('#projlist .projrow[data-project="project"] .open')`));
    assert.equal(await ui(`document.querySelector('#projlist .projrow[data-project="other"] .here').textContent`), 'open now');
    await ui(`document.getElementById('closeProjects').click()`);
    // While the window loads again, no page shows before it has its place in the grid (nothing jumps).
    const jumps = [];
    const watch = setInterval(() => {
      for (const p of shell.profiles.values()) {
        const v = p.get()?.view;
        if (v && !v.webContents.isDestroyed() && v.getVisible() && !v.getBounds().width) jumps.push(p.id);
      }
    }, 5);
    await ui(`document.getElementById('openProjects').click()`);
    await menuRows(ui);
    await choose(ui, 'project');
    await waitFor(() => shell.project === project && shell.profiles.has('elon-buyer') && shell.pty);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    clearInterval(watch);
    assert.deepEqual(jumps, [], 'pages shown before the grid placed them');
    assert.equal(await ui(`document.getElementById('projectName').textContent`), 'project');
    ctx.watchPty(shell.pty);
    await waitFor(async () => (await ctx.termText()).includes(`agent: rc of ${project}\n`));
    assert.deepEqual([...shell.profiles.keys()], ['sam-admin', 'elon-buyer']);
    assert.equal(shell.resumedSession, 'session-1', "the agent continues the project's conversation");
    assert.equal(await who(ctx, 'sam-admin'), 'Signed in as sam');
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(userData, 'projects.json'), 'utf8')).map((p) => p.folder), [project, other]);
  });
  test('projects: at first start none is opened; each gets its own color', async () => {
    const { Store } = require('../src/main/store');
    const store = new Store(path.join(root, 'fresh-data'));
    assert.equal(store.lastProject(), null);
    const shop = store.projectFor('/work/shop'), blog = store.projectFor('/work/blog');
    assert.notEqual(shop.color, blog.color);
    await store.openProject(shop);
    assert.equal(new Store(path.join(root, 'fresh-data')).lastProject().id, 'shop', 'later: the project opened last');
  });
  test('store: a write cut short leaves the file as it was', async () => {
    const { Store } = require('../src/main/store');
    const store = new Store(path.join(root, 'fresh-data'));
    store.openProject(store.projectFor('/work/shop'));
    const ws = store.workspace(1);
    ws.saveProfiles([{ folder: 'Profile 1', id: 'sam', name: 'Sam', color: '#fff' }]);
    const writeFileSync = fs.writeFileSync;
    fs.writeFileSync = (f, data, ...rest) => { writeFileSync(f, String(data).slice(0, 10), ...rest); throw new Error('the computer went off'); };
    try { ws.saveProfiles([{ folder: 'Profile 2', id: 'ann', name: 'Ann', color: '#000' }]); } finally { fs.writeFileSync = writeFileSync; }
    assert.deepEqual(ws.profiles().map((p) => p.id), ['sam']);
    assert.deepEqual(fs.readdirSync(ws.dir).filter((f) => f.endsWith('.tmp')), [], 'no half-written file left');
  });
  test('project profiles: closing and opening keeps a profile\'s place; ids and colors stay unique with closed ones', async () => {
    const { ProjectProfiles } = require('../src/main/project-profiles');
    let saved = [{ id: 'ann', name: 'Ann', color: '#e5534b', folder: 'Profile 1' }, { id: 'bob', name: 'Bob', color: '#57ab5a', folder: 'Profile 2', closed: true },
      { id: 'cid', name: 'Cid', color: '#539bf5', folder: 'Profile 3' }];
    const store = { profiles: () => saved, tabs: (f) => (f === 'Profile 2' ? ['https://b/'] : []), saveProfiles: (l) => { saved = l; }, saveTabs() {},
      profileDir: (f) => `/data/${f}`, freeFolder: (taken) => `Profile ${taken.length + 1}`, markDeleted() {} };
    const fake = (cfg) => ({ ...cfg, siteZoom: cfg.zoom, urls: [] });
    const list = new ProjectProfiles(store, { make: fake, start: async (p, urls) => { p.urls = urls; }, unload: async () => {}, urlsOf: (p) => p.urls,
      renamed() {}, remove: async () => {}, changed() {} });
    await list.load();
    assert.deepEqual([...list.profiles.keys()], ['ann', 'cid']);
    assert.deepEqual([...list.closed.keys()], ['bob']);
    await list.close('ann');
    await list.open('bob');
    assert.deepEqual(list.profiles.get('bob').urls, ['https://b/'], 'its tabs come back');
    assert.deepEqual(saved.map((p) => `${p.id}${p.closed ? ' (closed)' : ''}`), ['ann (closed)', 'bob', 'cid'], 'each keeps its place');
    assert.equal((await list.create('Ann')).id, 'ann-2', 'a closed profile keeps its id');
    assert.equal(saved.at(-1).folder, 'Profile 4');
    assert.ok(!['#e5534b', '#57ab5a', '#539bf5'].includes(saved.at(-1).color), 'and its color');
    assert.equal(list.rename('ann', 'Bob').id, 'bob-2');
  });
  test('grid presets: columns, grid, focus', async ({ shell, ui }) => {
    const at = async () => ({ sam: await pageBox(ui, 'sam-admin'), elon: await pageBox(ui, 'elon-buyer'), term: await box(ui, '#term') });
    await ui(`window.__layoutPreset('columns')`);
    await waitFor(() => viewOn(shell, ui, 'elon-buyer'));
    let b = await at();
    assert.ok(b.sam.x < b.elon.x && b.sam.y === b.elon.y && b.term.y > b.sam.y + b.sam.height - 1, 'profiles side by side, terminal below');
    await ui(`window.__layoutPreset('focus')`);
    await waitFor(() => viewOn(shell, ui, 'sam-admin'));
    b = await at();
    assert.equal(b.elon, null, 'Elon is a tab behind Sam');
    assert.ok(b.term.y > b.sam.y + b.sam.height - 1);
    // Left in this layout for the restart phase.
    await ui(`window.__layoutPreset('grid')`);
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
    b = await at();
    assert.ok(b.sam.x < b.elon.x && b.term.x > b.elon.x + b.elon.width - 1, 'profiles in a row of two, terminal on the right');
    await waitFor(() => fs.existsSync(pfile('layout.json')));
  });

  test('context menus: a pane\'s header, a tab, the terminal; pages are pictures while a menu is open; Arrange panels in ⋮', async ({ shell, ui }) => {
    const elon = shell.profiles.get('elon-buyer');
    const header = '.ptab[data-panel="profile:Profile 2"]';
    await rightClick(ui, header);
    assert.deepEqual(await menuRows(ui), ['New tab', 'Rename', 'Close profile', '-', 'Delete profile…']);
    const at = await ui(`(() => { const h = document.querySelector('${header}').getBoundingClientRect(), m = document.getElementById('menu').getBoundingClientRect();
      return Math.abs(m.left - (h.x + h.width / 2)) < 2 && Math.abs(m.top - (h.y + h.height / 2) - 4) < 2; })()`);
    assert.ok(at, 'at the pointer');
    // The pages are native views above the menu: pictures of them stand in meanwhile.
    assert.equal(elon.get().view.getVisible(), false);
    assert.ok(await ui(`!!document.querySelector('.pane[data-profile="elon-buyer"] .content img.snapshot')`));
    // Another menu right from this one: the pages stay pictures.
    await ui(`document.getElementById('windowMenu').click()`);
    await sleep(300);
    assert.equal(await menuOpen(ui), true);
    assert.equal(elon.get().view.getVisible(), false, 'a page over the second menu');
    await rightClick(ui, header);
    await sleep(300);
    assert.deepEqual(await menuRows(ui), ['New tab', 'Rename', 'Close profile', '-', 'Delete profile…']);
    assert.equal(elon.get().view.getVisible(), false, 'a page over the third menu');
    const n = elon.tabs.length;
    await choose(ui, 'New tab');
    await waitFor(() => elon.tabs.length === n + 1);
    await waitFor(() => elon.get().view.getVisible());
    assert.equal(await ui(`document.querySelectorAll('img.snapshot').length`), 0);
    await rightClick(ui, header);
    await menuRows(ui);
    await choose(ui, 'Rename');
    await waitFor(() => ui(`document.activeElement === document.querySelector('${header} input')`));
    await ui(`document.activeElement.blur()`); // nothing renamed

    await waitFor(() => ui(`document.querySelectorAll('.pane[data-profile="elon-buyer"] .tabs .tab').length === ${n + 1}`));
    await rightClick(ui, '.pane[data-profile="elon-buyer"] .tabs .tab');
    assert.deepEqual(await menuRows(ui), ['Reload', 'Duplicate', '-', 'Close tab', 'Close other tabs']);
    const first = elon.tabs[0];
    await choose(ui, 'Close other tabs');
    await waitFor(() => elon.tabs.length === 1 && elon.tabs[0] === first);

    await ui(`window.__term.clearSelection()`);
    // A real right-click (press, release): the menu stays after the button is released. On Linux it opens on the
    // press, just below the pointer, so the release is outside it.
    const t = await box(ui, '#term'), z = shell.win.webContents.getZoomFactor();
    const x = Math.round((t.x + t.width / 2) * z), y = Math.round((t.y + t.height / 2) * z);
    shell.win.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'right', clickCount: 1 });
    await sleep(100);
    shell.win.webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'right', clickCount: 1 });
    await sleep(400);
    assert.equal(await menuOpen(ui), true, 'open after the release');
    shell.win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' }); shell.win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
    await waitFor(async () => !(await menuOpen(ui)));
    // A press anywhere else closes it.
    await rightClick(ui, '#term .xterm-screen');
    await menuRows(ui);
    const bar = await box(ui, '#topbar');
    shell.win.webContents.sendInputEvent({ type: 'mouseDown', x: Math.round((bar.x + bar.width / 2) * z), y: Math.round((bar.y + bar.height / 2) * z), button: 'left', clickCount: 1 });
    shell.win.webContents.sendInputEvent({ type: 'mouseUp', x: Math.round((bar.x + bar.width / 2) * z), y: Math.round((bar.y + bar.height / 2) * z), button: 'left', clickCount: 1 });
    await waitFor(async () => !(await menuOpen(ui)));
    await rightClick(ui, '#term .xterm-screen');
    assert.deepEqual(await menuRows(ui), ['Copy (off)', 'Paste', 'Select all', '-', 'Clear', '-', 'Change agent…'], 'nothing selected to copy');
    await ui(`document.getElementById('menu').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))`);
    assert.equal(await ui(`document.activeElement.querySelector('.label')?.textContent`), 'Paste', 'arrows move over the enabled rows');
    await choose(ui, 'Select all');
    await waitFor(() => ui(`window.__term.hasSelection()`));
    // The Edit menu's Copy (Cmd+C on macOS) copies the terminal's selection.
    const { clipboard } = require('electron');
    const users = await clipboard.readText();
    await clipboard.writeText('');
    await ui(`document.querySelector('#term textarea').focus()`);
    shell.win.webContents.copy();
    await waitFor(async () => (await clipboard.readText()).length > 0);
    assert.equal((await clipboard.readText()).trim(), (await ui(`window.__term.getSelection()`)).trim());
    await clipboard.writeText(users);
    await ui(`window.__term.clearSelection()`);

    await ui(`document.getElementById('windowMenu').click()`);
    assert.deepEqual((await menuRows(ui)).slice(2), ['# Arrange panels', 'Profiles in columns, terminal below', 'Profiles two by two, terminal right', 'One profile at a time, terminal below']);
    await choose(ui, 'One profile at a time, terminal below');
    await waitFor(async () => (await pageBox(ui, 'elon-buyer')) === null && viewOn(shell, ui, 'sam-admin'));
    await ui(`window.__layoutPreset('grid')`); // as the grid presets test left it, for the restart phase
  });
};
