// The grid of panels, projects, layouts, menus.
const fs = require('fs');
const path = require('path');
const { assert, root, userData, project, pfile, savedTabs, panel, SITE, sleep, waitFor, who, menuRows, choose, manageProfiles, menuOpen, rightClick,
  box, pageBox, viewOn, dock, ctrl, near, projectTabs, projectTab, savedWindows } = require('./helpers');

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
  test('projects: another folder opens in a tab of its own, with its own profiles and agent; the first keeps running', async (ctx) => {
    const { shell, ui } = ctx;
    const other = path.join(root, 'other');
    fs.mkdirSync(other, { recursive: true });
    const sam = shell.profiles.get('sam-admin');
    const firstPty = shell.pty;
    await ui(`kulisa.invoke('project:open', { folder: ${JSON.stringify(other)} })`);
    await waitFor(() => shell.current?.folder === other && shell.pty && shell.pty !== firstPty);
    ctx.watchPty(shell.pty);
    await waitFor(async () => (await ctx.termText()).includes(`agent: rc of ${other}`)); // started by the shell, in the project
    assert.equal((await ctx.termText()).split('exec cat -v').length - 1, 1, 'the command that starts the agent shows once');
    assert.equal(shell.profiles.size, 0);
    assert.ok(sam.tabs.every((t) => !t.wc.isDestroyed()) && !sam.get().view.getVisible(), "the first project's pages keep running, hidden");
    assert.equal(shell.open.get('project').workspaces.get(1).pty, firstPty, "and its agent");
    assert.equal(shell.win.getTitle(), 'other — Kulisa');
    assert.equal(shell.resumedSession, null, 'a new project has no conversation to resume');
    await waitFor(async () => JSON.stringify(await projectTabs(ui)) === '["project","other *"]' && ui(`!!window.__dock.getPanel('terminal')`));
    assert.equal(await ui(`document.querySelectorAll('.pane').length`), 0);
    assert.equal(await ui(`getComputedStyle(${projectTab('other')}).backgroundColor !== getComputedStyle(${projectTab('project')}).backgroundColor`), true, 'the shown tab on its plate');
    // Not in another weight: a tab shown would change its width, and the tabs after it would jump.
    const widths = () => ui(`[...document.querySelectorAll('#projectTabs .projecttab')].map((t) => t.getBoundingClientRect().width)`);
    const before = await widths();
    assert.equal(await ui(`getComputedStyle(${projectTab('other')}).fontWeight === getComputedStyle(${projectTab('project')}).fontWeight`), true);
    await ui(`kulisa.invoke('profile:new', { name: 'Sam.seller' })`); // the same name as in the first project
    const seller = shell.profiles.get('sam-seller');
    assert.equal(seller.dir, path.join(userData, 'projects', 'other', '1', 'Profile 1'), "profiles are in their project's data");
    assert.equal(seller.endpoint.endsWith('/other/1/sam-seller'), true, 'the CDP proxy knows it by its project too');
    await ctx.call('browser_navigate', { profile: 'sam-seller', url: `${SITE}/app` });
    assert.equal(await who(ctx, 'sam-seller'), 'Signed out', "the first project's sign-ins stay there");

    // +: a menu of the projects (the open ones marked), Open Folder, and the dialog for the rest.
    await ui(`document.getElementById('openProjects').click()`);
    assert.deepEqual(await menuRows(ui), ['project', 'other', '-', 'New Project…', 'Open Folder…', '-', 'Close Project', 'Remove Project…']);
    const rows = await ui(`[...document.querySelectorAll('#menu .item')].slice(0, 2).map((b) => ({ dot: getComputedStyle(b.querySelector('.dot')).backgroundColor,
      folder: b.querySelector('small').textContent, check: b.querySelector('kbd').textContent }))`);
    assert.deepEqual(rows.map((r) => r.folder), [project, other], 'each with its folder');
    assert.deepEqual(rows.map((r) => r.check), ['✓', '✓'], 'the open ones are marked');
    assert.equal(rows[0].dot, 'rgb(74, 123, 208)', "a dot in the project's color");
    const under = await ui(`(() => { const b = document.getElementById('openProjects').getBoundingClientRect(), m = document.getElementById('menu').getBoundingClientRect();
      return m.top >= b.bottom && m.top < b.bottom + 10 && Math.abs(m.left - b.left) < 2; })()`);
    assert.ok(under, 'under the button');
    await ui(`document.getElementById('openProjects').click()`); // again: closes it
    await waitFor(async () => !(await menuOpen(ui)));
    // Each project's row has a × at its end, shown on hover (Remove project…), as in JetBrains.
    await ui(`document.getElementById('openProjects').click()`);
    await menuRows(ui);
    const x = await ui(`(() => { const rows = [...document.querySelectorAll('#menu .removable')], x = rows[0].querySelector('.remove');
      return { rows: rows.length, title: x.title, shown: getComputedStyle(x).visibility }; })()`);
    assert.deepEqual(x, { rows: 2, title: 'Remove project…', shown: 'hidden' });
    await rightClick(ui, '#menu .removable .item');
    assert.ok(await menuOpen(ui) && (await menuRows(ui)).includes('New Project…'), 'a right-click in the menu opens no other menu');
    await ui(`document.getElementById('menu').hidePopover()`);
    // A tab's right-click menu.
    await rightClick(ui, '#projectTabs [data-project="other"] .name');
    assert.deepEqual(await menuRows(ui), ['Close Project', 'Move to New Window', '-', 'Remove Project…']);
    await ui(`document.getElementById('menu').hidePopover()`);

    // A click on the first project's tab: it comes back as it was left, its agent the same; no page shows before it
    // has its place in the grid (nothing jumps).
    const jumps = [];
    const watch = setInterval(() => {
      for (const p of shell.profiles.values()) {
        const v = p.get()?.view;
        if (v && !v.webContents.isDestroyed() && v.getVisible() && !v.getBounds().width) jumps.push(p.id);
      }
    }, 5);
    await ui(`${projectTab('project')}.click()`);
    await waitFor(() => shell.current?.folder === project && shell.profiles.get('sam-admin') === sam);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
    clearInterval(watch);
    assert.deepEqual(jumps, [], 'pages shown before the grid placed them');
    assert.equal(shell.pty, firstPty, 'the same agent');
    assert.equal(seller.get().view.getVisible(), false, "the other project's pages hidden");
    assert.deepEqual(await projectTabs(ui), ['project *', 'other']);
    assert.deepEqual(await widths(), before, 'the tabs keep their widths: nothing jumps');
    assert.equal(shell.win.getTitle(), 'project — Kulisa');

    // × on the shown tab asks first; Cancel keeps it open.
    ctx.asked.length = 0;
    ctx.answer = false;
    await ui(`${projectTab('project')}.querySelector('.close').click()`);
    await waitFor(() => ctx.asked.length && ui(`!document.getElementById('ask').open`));
    assert.equal(ctx.asked.pop().message, 'Close the project project?');
    assert.ok(shell.open.has('project') && shell.current?.folder === project, 'still open when the human says no');
    ctx.answer = true;
    // Close: the project closes (tabs and sign-ins kept), the tab next to it is shown.
    await ui(`${projectTab('project')}.querySelector('.close').click()`);
    await waitFor(() => shell.current?.folder === other && !shell.open.has('project'));
    ctx.asked.length = 0;
    assert.ok(sam.tabs.every((t) => t.wc.isDestroyed()), "the closed project's tabs are closed");
    assert.deepEqual(await projectTabs(ui), ['other *']);
    // Opened again from the menu: the conversation goes on, the profiles signed in.
    await ui(`document.getElementById('openProjects').click()`);
    await menuRows(ui);
    await choose(ui, 'project');
    await waitFor(() => shell.current?.folder === project && shell.profiles.has('elon-buyer') && shell.pty);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    ctx.watchPty(shell.pty);
    await waitFor(async () => (await ctx.termText()).includes(`agent: rc of ${project}\n`));
    assert.deepEqual([...shell.profiles.keys()], ['sam-admin', 'elon-buyer']);
    assert.equal(shell.resumedSession, 'session-1', "the agent continues the project's conversation");
    assert.equal(await who(ctx, 'sam-admin'), 'Signed in as sam');
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
    assert.deepEqual(await projectTabs(ui), ['other', 'project *'], 'a tab opens at the end');
    // × on a tab in the background: that project closes, the one on screen stays.
    await ui(`${projectTab('other')}.querySelector('.close').click()`);
    await waitFor(() => !shell.open.has('other'));
    ctx.asked.length = 0;
    assert.ok(seller.tabs.every((t) => t.wc.isDestroyed()));
    assert.deepEqual(await projectTabs(ui), ['project *']);
    assert.equal(await viewOn(shell, ui, 'sam-admin'), true);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(userData, 'projects.json'), 'utf8')).map((p) => p.folder), [project, other]);
    assert.deepEqual(savedWindows(), [{ tabs: ['project'], shown: 'project' }]);
  });
  test('projects: Move to New Window puts a project in a window of its own, still running; closing that window closes it', async (ctx) => {
    const { shell, ui } = ctx;
    const other = path.join(root, 'other');
    await ui(`kulisa.invoke('project:open', { folder: ${JSON.stringify(other)} })`);
    await waitFor(() => shell.current?.id === 'other' && shell.ws.loaded && shell.pty);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    const moved = shell.current, ws = moved.ws, pty = ws.pty, seller = ws.profiles.get('sam-seller');
    await waitFor(async () => (await ctx.termText()).includes(`agent: rc of ${other}`));
    const first = shell.windows[0];
    // A line as wide as an agent's prompt box (Claude Code's), and the size the agent has.
    const LINE = '='.repeat(150);
    pty.write(`${LINE}\r`);
    await waitFor(async () => (await ctx.termText()).includes(LINE));
    const size = { cols: pty.cols, rows: pty.rows };
    assert.ok(size.cols > 150, 'the terminal is wide enough for it');
    await rightClick(ui, '#projectTabs [data-project="other"] .name');
    await menuRows(ui);
    await choose(ui, 'Move to New Window');
    await waitFor(() => shell.windows.length === 2 && shell.windows[1].current === moved && !shell.windows[1].switching);
    const second = shell.windows[1];
    const ui2 = (js) => second.win.webContents.executeJavaScript(js);

    // The first window keeps its other tab; the new one has the project, as it was: the same agent, the same pages
    // (moved into it, not loaded again), what the terminal showed.
    await waitFor(() => shell.current?.id === 'project' && shell.ws.loaded);
    assert.deepEqual(await projectTabs(ui), ['project *']);
    assert.equal(moved.window, second);
    await waitFor(async () => JSON.stringify(await projectTabs(ui2)) === '["other *"]');
    assert.equal(second.win.getTitle(), 'other — Kulisa');
    assert.equal(ws.pty, pty, 'the same agent');
    assert.equal(ws.profiles.get('sam-seller'), seller, 'the same profile');
    const view = seller.get().view;
    assert.ok(second.win.contentView.children.includes(view) && !first.win.contentView.children.includes(view), 'its page moved');
    await waitFor(async () => {
      const b = await ui2(`(() => { const r = document.querySelector('.pane[data-profile="sam-seller"] .content')?.getBoundingClientRect(); return r?.width ? { width: r.width } : null; })()`);
      return b && view.getVisible() && Math.abs(view.getBounds().width - Math.round(b.width * second.win.webContents.getZoomFactor())) <= 1;
    });
    const termText2 = () => ui2(`(() => { const b = window.__term?.buffer.active; if (!b) return '';
      return Array.from({ length: b.length }, (_, i) => b.getLine(i)).map((l, i) => (i && !l.isWrapped ? '\\n' : '') + l.translateToString(true)).join(''); })()`);
    await waitFor(async () => (await termText2()).includes(`agent: rc of ${other}`));
    // What it showed comes as it was, not cut at a default width; the agent never gets another width meanwhile (it
    // would draw its prompt again for it, leaving the old one behind).
    const lines = await ui2(`(() => { const b = window.__term.buffer.active;
      return Array.from({ length: b.length }, (_, i) => b.getLine(i)).filter((l) => l.translateToString(true).includes('===')).map((l) => [l.translateToString(true).length, l.isWrapped]); })()`);
    assert.deepEqual(lines.filter(([n, wrapped]) => n !== 150 || wrapped), [], `whole lines: ${JSON.stringify(lines)}`);
    assert.deepEqual(await ui2('window.__ptySizes.filter((s) => s.cols < 100)'), [], 'no default size sent to the agent');
    assert.deepEqual({ cols: pty.cols, rows: pty.rows }, size, 'the same size: the window is the same size');
    // The agent's output and its tools go on there.
    pty.write('moved along\r');
    await waitFor(async () => (await termText2()).includes('moved along'));
    await second.screenshot(path.join(root, 'second-window.png'));
    await ctx.call('browser_navigate', { profile: 'sam-seller', url: `${SITE}/app?moved` }, ws);
    assert.match(seller.get().wc.getURL(), /\?moved$/);
    // Each window's + menu marks the projects open in either.
    await ui(`document.getElementById('openProjects').click()`);
    await menuRows(ui);
    assert.deepEqual(await ui(`[...document.querySelectorAll('#menu .item kbd')].slice(0, 2).map((k) => k.textContent)`), ['✓', '✓']);
    await ui(`document.getElementById('menu').hidePopover()`);
    // Questions about its project are asked in its window.
    ctx.answer = false;
    await ui2(`kulisa.invoke('profile:delete', { profile: 'sam-seller' })`);
    ctx.answer = true;
    assert.ok(ws.profiles.has('sam-seller'), 'kept: the human said no');
    assert.deepEqual(savedWindows(), [{ tabs: ['project'], shown: 'project' }, { tabs: ['other'], shown: 'other' }]);

    // Back into the first window (Move to Window, as a browser moves a tab): the only tab of the second, so it closes.
    await rightClick(ui2, '#projectTabs [data-project="other"] .name');
    assert.deepEqual(await menuRows(ui2), ['Close Project', 'Move to New Window (off)', 'Move to Window: project', '-', 'Remove Project…']);
    await choose(ui2, 'Move to Window: project');
    await waitFor(() => shell.windows.length === 1 && shell.current === moved && !first.switching);
    assert.ok(second.win.isDestroyed());
    assert.equal(ws.pty, pty, 'the same agent');
    assert.ok(first.win.contentView.children.includes(view), 'its page back');
    await waitFor(async () => (await viewOn(shell, ui, 'sam-seller')) && (await ctx.termText()).includes('moved along'));
    assert.deepEqual(await projectTabs(ui), ['project', 'other *']);
    assert.deepEqual(savedWindows(), [{ tabs: ['project', 'other'], shown: 'other' }]);
    await ui(`${projectTab('other')}.querySelector('.close').click()`);
    await waitFor(() => !shell.open.has('other') && shell.current?.id === 'project' && !first.switching);

    // Opening a project in a window with projects open asks where: This Window (a tab, as above), New Window, Cancel.
    ctx.asked.length = 0;
    ctx.answer = null;
    await ui(`kulisa.invoke('project:open', { folder: ${JSON.stringify(other)} })`);
    await waitFor(() => ctx.asked.length && ui(`document.getElementById('ask').open`));
    assert.deepEqual([ctx.asked[0].message, ctx.asked[0].ok, ctx.asked[0].other], ['Where to open the project other?', 'This Window', 'New Window']);
    assert.deepEqual(await ui(`[...document.querySelectorAll('#ask footer button:not([hidden])')].map((b) => b.textContent)`), ['Cancel', 'New Window', 'This Window']);
    await sleep(700); // the window's picture follows the screen a moment later
    await shell.screenshot(path.join(root, 'open-where.png'));
    await ui(`document.querySelector('#ask button[value=""]').click()`);
    await sleep(300);
    assert.ok(!shell.open.has('other'), 'Cancel: not opened');
    ctx.answer = 'other';
    await ui(`kulisa.invoke('project:open', { folder: ${JSON.stringify(other)} })`);
    await waitFor(() => shell.windows.length === 2 && shell.windows[1].current?.id === 'other' && !shell.windows[1].switching);
    ctx.answer = true;
    const third = shell.windows[1], reopened = third.current;
    await waitFor(() => reopened.ws.pty);
    assert.deepEqual(await projectTabs(ui), ['project *'], 'nothing new in the first window');

    // Closing the window (the OS's ×) closes its project, as closing its tab would, after one question in that window
    // (the function that closes a tab); Kulisa goes on in the first.
    ctx.asked.length = 0;
    ctx.answer = false;
    third.win.close();
    await waitFor(() => ctx.asked.length && third.win.webContents.executeJavaScript(`!document.getElementById('ask').open`));
    const q = ctx.asked.pop();
    assert.equal(q.message, 'Close the window?');
    assert.match(q.detail, /Its projects close: other\./);
    assert.ok(!third.win.isDestroyed() && shell.open.has('other'), 'still open when the human says no');
    ctx.answer = true;
    third.win.close();
    await waitFor(() => shell.windows.length === 1 && !shell.open.has('other'));
    ctx.asked.length = 0;
    assert.ok(third.win.isDestroyed() && reopened.ws.profiles.size === 0 && reopened.ws.pty === null);
    assert.deepEqual(savedWindows(), [{ tabs: ['project'], shown: 'project' }]);
    assert.equal(await viewOn(shell, ui, 'sam-admin'), true);

    // The last window's × quits Kulisa (its projects come back at the next start): asked only when an agent works.
    shell.ws.state = 'working';
    ctx.answer = false;
    shell.win.close();
    await waitFor(() => ctx.asked.length && ui(`!document.getElementById('ask').open`));
    const quit = ctx.asked.pop();
    assert.equal(quit.message, 'Quit Kulisa?');
    assert.match(quit.detail, /^An agent is still working \(main\): quitting stops it\./);
    assert.ok(!shell.win.isDestroyed() && shell.open.has('project'), 'Kulisa goes on when the human says no');
    shell.ws.state = null;
    ctx.answer = true;
  });
  test('projects: a tab dragged changes the order, goes out into a new window and back into the first', async (ctx) => {
    const { shell, ui } = ctx;
    const other = path.join(root, 'other'), DRAG = 'application/x-kulisa-project';
    await ui(`kulisa.invoke('project:open', { folder: ${JSON.stringify(other)} })`); // This Window (ctx.answer)
    await waitFor(() => shell.current?.id === 'other' && shell.ws.loaded && shell.pty && !shell.windows[0].switching);
    ctx.asked.length = 0;
    const moved = shell.current, pty = moved.ws.pty;
    // Synthetic drag events, as the human's mouse would send them; a drop gets what the drag carried.
    const dragStart = (u, id) => u(`(() => { window.__dt = new DataTransfer();
      ${projectTab(id)}.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: window.__dt })); return window.__dt.getData('${DRAG}'); })()`);
    const dragEnd = (u, id, effect) => u(`(() => { window.__dt.dropEffect = '${effect}';
      ${projectTab(id)}.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: window.__dt })); })()`);
    const dropOn = (u, id, side, data) => u(`(() => { const dt = new DataTransfer(); dt.setData('${DRAG}', ${JSON.stringify(data)});
      const t = ${projectTab(id)}, r = t.getBoundingClientRect();
      const o = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.x + (${side === 'before'} ? 3 : r.width - 3), clientY: r.y + r.height / 2 };
      t.dispatchEvent(new DragEvent('dragover', o)); const shown = t.classList.contains('drop-${side}');
      t.dispatchEvent(new DragEvent('drop', o)); return shown; })()`);

    // The pointer where a test says (dragend's dropEffect of synthetic events is 'none': taken for let go outside).
    const b = shell.win.getBounds(), pointer = shell.pointer;
    shell.pointer = () => ({ x: b.x + 10, y: b.y + 10 });

    // Within the tabs: another order, kept.
    let data = await dragStart(ui, 'other');
    assert.equal(JSON.parse(data).id, 'other');
    assert.ok(await ui(`${projectTab('other')}.classList.contains('dragging')`));
    assert.ok(await dropOn(ui, 'project', 'before', data), 'where it would go is marked');
    await dragEnd(ui, 'other', 'move');
    await waitFor(async () => JSON.stringify(await projectTabs(ui)) === '["other *","project"]');
    assert.deepEqual(savedWindows(), [{ tabs: ['other', 'project'], shown: 'other' }]);

    // Let go outside every window: a new window there. Inside one (or cancelled): nothing.
    await dragStart(ui, 'other');
    await dragEnd(ui, 'other', 'none');
    await sleep(300);
    assert.equal(shell.windows.length, 1);
    shell.pointer = () => ({ x: b.x + b.width + 300, y: b.y + 200 });
    await dragStart(ui, 'other');
    await dragEnd(ui, 'other', 'none');
    await waitFor(() => shell.windows.length === 2 && shell.windows[1].current === moved && !shell.windows[1].switching);
    shell.pointer = pointer;
    const second = shell.windows[1], ui2 = (js) => second.win.webContents.executeJavaScript(js);
    const nb = second.win.getBounds();
    assert.ok(nb.x > b.x + 32, 'towards the pointer (the OS keeps it on the screen), not next to the first window');
    assert.deepEqual(await projectTabs(ui), ['project *']);
    assert.equal(moved.ws.pty, pty, 'the same agent');

    // Onto the first window's tabs: back there, where it was let go; the second window, left empty, closes.
    data = await dragStart(ui2, 'other');
    assert.ok(await dropOn(ui, 'project', 'after', data));
    shell.pointer = pointer; // its window closes with it: no dragend there
    await waitFor(() => shell.windows.length === 1 && shell.current === moved && !shell.windows[0].switching);
    assert.ok(second.win.isDestroyed());
    assert.deepEqual(await projectTabs(ui), ['project', 'other *']);
    assert.equal(moved.ws.pty, pty);
    await ui(`${projectTab('other')}.querySelector('.close').click()`);
    await waitFor(() => !shell.open.has('other') && shell.current?.id === 'project' && !shell.windows[0].switching);
    ctx.asked.length = 0;
  });
  test('projects: at first start none is opened; each gets its own color', async () => {
    const { Store } = require('../src/main/store');
    const store = new Store(path.join(root, 'fresh-data'));
    assert.deepEqual(store.windows(), []);
    const shop = store.projectFor('/work/shop'), blog = store.projectFor('/work/blog');
    assert.notEqual(shop.color, blog.color);
    const bounds = { x: 10, y: 20, width: 900, height: 700 };
    store.saveWindows([{ tabs: [blog.id, shop.id], shown: shop.id, bounds }, { tabs: ['gone'], shown: 'gone' }]);
    const later = new Store(path.join(root, 'fresh-data'));
    const [w, gone] = later.windows();
    assert.deepEqual(w.tabs.map((p) => p.id), ['blog', 'shop'], 'later: the tabs open last');
    assert.deepEqual([w.shown.id, w.bounds], ['shop', bounds], 'the one shown, where the window was');
    assert.deepEqual([gone.tabs, gone.shown], [[], null], 'projects no longer there are left out');
    // Before there were several windows: one window's tabs.
    later.saveSettings({ uiZoom: 1, openProjects: [shop.id], lastProject: shop.id });
    assert.deepEqual(later.windows().map((x) => [x.tabs.map((p) => p.id), x.shown.id]), [[['shop'], 'shop']]);
    later.saveWindows([]);
    assert.deepEqual(later.settings(), { uiZoom: 1, windows: [] });
  });
  test('store: a write cut short leaves the file as it was', async () => {
    const { Store } = require('../src/main/store');
    const store = new Store(path.join(root, 'fresh-data'));
    const ws = store.workspaceOf(store.projectFor('/work/shop'), 1);
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
  test('grid presets: columns, grid, focus; each fits the window, nothing cut off', async ({ shell, ui }) => {
    const at = async () => ({ sam: await pageBox(ui, 'sam-admin'), elon: await pageBox(ui, 'elon-buyer'), term: await box(ui, '#term') });
    // Every panel inside the grid's room (#dock less its padding): none cut off at the right or the bottom.
    const fits = async () => assert.deepEqual(await ui(`(() => { const d = document.getElementById('dock'), r = d.getBoundingClientRect(), s = getComputedStyle(d);
      const right = r.right - parseFloat(s.paddingRight), bottom = r.bottom - parseFloat(s.paddingBottom);
      return [...d.querySelectorAll('.dv-groupview')].map((g) => g.getBoundingClientRect()).filter((g) => g.right > right + 1 || g.bottom > bottom + 1)
        .map((g) => ({ right: g.right - right, bottom: g.bottom - bottom })); })()`), [], 'panels cut off');
    await ui(`window.__layoutPreset('columns')`);
    await waitFor(() => viewOn(shell, ui, 'elon-buyer'));
    await fits();
    let b = await at();
    assert.ok(b.sam.x < b.elon.x && b.sam.y === b.elon.y && b.term.y > b.sam.y + b.sam.height - 1, 'profiles side by side, terminal below');
    await ui(`window.__layoutPreset('focus')`);
    await waitFor(() => viewOn(shell, ui, 'sam-admin'));
    await fits();
    b = await at();
    assert.equal(b.elon, null, 'Elon is a tab behind Sam');
    assert.ok(b.term.y > b.sam.y + b.sam.height - 1);
    // Left in this layout for the restart phase.
    await ui(`window.__layoutPreset('grid')`);
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
    await fits();
    b = await at();
    assert.ok(b.sam.x < b.elon.x && b.term.x > b.elon.x + b.elon.width - 1, 'profiles in a row of two, terminal on the right');
    await waitFor(() => fs.existsSync(pfile('layout.json')));
  });

  test('context menus: a pane\'s header, a tab, the terminal; pages are pictures while a menu is open; Arrange panels in ⋮; Exit', async (ctx) => {
    const { shell, ui } = ctx;
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
    await waitFor(() => menuOpen(ui)); // once the pages' pictures are there (menuCover): slower under load
    await sleep(300);
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
    await ui(`window.__term.clearSelection()`);

    await ui(`document.getElementById('windowMenu').click()`);
    // The arrangements as pictures, a short name under each, the full words in the tooltip.
    assert.deepEqual((await menuRows(ui)).slice(3), ['# Arrange panels', 'arrange: Columns, Two by two, One at a time', '-', 'Agents…', '-', 'Exit']);
    assert.deepEqual(await ui(`[...document.querySelectorAll('#menu svg:not([hidden]) > use')].map((u) => u.getAttribute('href'))`),
      ['#i-zoom', '#i-theme', '#i-arrange', '#i-agent', '#i-exit'], 'each row with its icon');
    const pics = await ui(`[...document.querySelectorAll('#menu .arrange button')].map((b) => ({ title: b.title,
      panes: b.querySelectorAll('svg .a-page').length, term: b.querySelectorAll('svg .a-term').length, w: b.querySelector('svg').getBoundingClientRect().width }))`);
    assert.deepEqual(pics.map((p) => [p.panes, p.term]), [[3, 1], [4, 1], [1, 1]]);
    assert.ok(pics.every((p) => p.title && p.w >= 40), JSON.stringify(pics));
    await ui(`document.querySelector('#menu .arrange [data-preset="focus"]').click()`);
    assert.equal(await menuOpen(ui), false, 'a choice closes the menu');
    await waitFor(async () => (await pageBox(ui, 'elon-buyer')) === null && viewOn(shell, ui, 'sam-admin'));
    await ui(`window.__layoutPreset('grid')`); // as the grid presets test left it, for the restart phase

    // Exit quits as the last window's × does: asked only when an agent works.
    shell.ws.state = 'working';
    ctx.answer = false;
    await ui(`document.getElementById('windowMenu').click()`);
    await menuRows(ui);
    await choose(ui, 'Exit');
    await waitFor(() => ctx.asked.length && ui(`!document.getElementById('ask').open`));
    assert.equal(ctx.asked.pop().message, 'Quit Kulisa?');
    assert.ok(!shell.win.isDestroyed() && shell.open.size, 'Kulisa goes on when the human says no');
    shell.ws.state = null;
    ctx.answer = true;
  });
};
