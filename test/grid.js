// The grid of panels, projects, layouts, menus.
const fs = require('fs');
const path = require('path');
const { clipboard } = require('electron');
const { assert, root, userData, project, pfile, savedTabs, panel, SITE, sleep, waitFor, who, menuRows, choose, manageProfiles, menuOpen, rightClick,
  box, pageBox, viewOn, dock, press, ctrl, near, projectTabs, projectTab, showProject, closeProject, savedWindows, closeMenu, searchTasks } = require('./helpers');

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
    assert.equal(shell.open.get('project').tasks.get(1).pty, firstPty, "and its agent");
    assert.equal(shell.win.getTitle(), 'other — Kulisa');
    assert.equal(shell.resumedSession, null, 'a new project has no conversation to resume');
    await waitFor(async () => JSON.stringify(await projectTabs(ui)) === '["project","other *"]' && ui(`!!window.__dock.getPanel('terminal')`));
    assert.equal(await ui(`document.querySelectorAll('.pane').length`), 0);
    // Each project's island with its tasks, the one each shows marked.
    assert.deepEqual(await ui(`[...document.querySelectorAll('#projectTabs .pisland')].map((g) => [...g.querySelectorAll('.tasktab')]
      .map((t) => t.querySelector('.name').textContent + (t.classList.contains('selected') ? ' *' : '')))`), [['task-1 *'], ['task-1 *']]);
    // Every island keeps its place and width whichever project is shown, also while it switches: nothing jumps.
    const islands = () => ui(`[...document.querySelectorAll('#projectTabs .pisland')].map((t) => { const r = t.getBoundingClientRect(); return [r.x, r.width]; })`);
    const before = await islands();
    await ui(`window.__islands = new Set(); { const tick = () => { __islands.add(JSON.stringify([...document.querySelectorAll('#projectTabs .pisland')]
      .map((t) => { const r = t.getBoundingClientRect(); return [r.x, r.width]; }))); if (window.__islands) requestAnimationFrame(tick); }; tick(); }`);
    await ui(`act('profile:new', { name: 'Sam.seller' })`); // the same name as in the first project
    const seller = shell.profiles.get('sam-seller');
    // A copy in the task's data, of its master in the store of profiles, numbered as every profile is (Sam, Elon, Dora
    // came first).
    assert.equal(seller.dir, path.join(userData, 'projects', 'other', '1', 'Profile 4'), "a task's copy is in its task's data");
    assert.ok(fs.existsSync(path.join(userData, 'profiles', 'Profile 4')), 'its master');
    assert.equal(seller.endpoint.endsWith('/other/1/sam-seller'), true, 'the CDP proxy knows it by its project too');
    await ctx.call('browser_navigate', { profile: 'sam-seller', url: `${SITE}/app` });
    assert.equal(await who(ctx, 'sam-seller'), 'Signed out', "the first project's sign-ins stay there");

    // The button after the islands: Search Tasks, as Chrome's Search tabs: every project's tasks, grouped by project.
    const rows = await searchTasks(ui);
    assert.deepEqual(rows.filter((r) => r.startsWith('# ')), shell.store.projects().map((p) => `# ${p.name}`), 'every project, open or not');
    assert.deepEqual(rows.slice(rows.indexOf('# other') + 1, rows.indexOf('# other') + 2), ['task-1'], 'its tasks under it');
    const over = await ui(`(() => { const b = document.getElementById('searchTasks').getBoundingClientRect(), m = document.querySelector('.tasksearch[data-state="open"]').getBoundingClientRect();
      return m.bottom <= b.top && m.bottom > b.top - 10 && Math.abs(m.right - b.right) < 2; })()`);
    assert.ok(over, 'over the button, its end at the bar\'s: the bar is at the bottom of the window');
    assert.equal(await ui(`document.activeElement.classList.contains('tlsearch')`), true, 'the keyboard in its search field');
    // The search: a project by its name (all its tasks), a task by its name or branch.
    shell.win.webContents.insertText('oth');
    await waitFor(async () => JSON.stringify(await ui(`[...document.querySelectorAll('.tasksearch .tlgroup')].map((g) => g.dataset.project)`)) === '["other"]');
    await ui(`(() => { const i = document.querySelector('.tasksearch .tlsearch'); i.select(); })()`);
    shell.win.webContents.insertText('nothing like it');
    await waitFor(async () => (await ui(`document.querySelector('.tasksearch .tlnone')?.textContent`)) === 'No task or project has that name');
    await ui(`document.getElementById('searchTasks').click()`); // again: closes it
    await waitFor(async () => !(await menuOpen(ui)));
    // Ctrl+Shift+A opens it too, from anywhere (Chrome's key), the search field empty again; Enter opens the first row:
    // a project open here shown.
    press(shell.win.webContents, 'A', 'control', 'shift');
    await waitFor(() => ui(`!!document.querySelector('.tasksearch[data-state="open"].ready')`));
    assert.equal(await ui(`document.querySelector('.tasksearch .tlsearch').value`), '');
    shell.win.webContents.insertText('other');
    await waitFor(async () => (await ui(`document.querySelectorAll('.tasksearch .tlgroup').length`)) === 1);
    press(shell.win.webContents, 'Return');
    await waitFor(async () => !(await menuOpen(ui)));
    assert.equal(shell.current?.folder, other);
    // The label's right-click: its group's panel, as Chrome's (its name, color and icon: below); under them its actions.
    await rightClick(ui, '#projectTabs [data-project="other"] .name');
    assert.deepEqual(await menuRows(ui), ['New Task', '-', 'Move to New Window', '-', 'Project Settings…', 'Show Data Folder', '-', 'Close Group']);
    // Show Data Folder: Kulisa's folder of that project, in the file manager.
    const electron = require('electron'), openPath = electron.shell.openPath, shown = [];
    electron.shell.openPath = async (dir) => { shown.push(dir); return ''; };
    try {
      await choose(ui, 'Show Data Folder');
      await waitFor(() => shown.length === 1);
    } finally { electron.shell.openPath = openPath; }
    assert.equal(shown[0], path.join(userData, 'projects', 'other'));

    // A click on the label folds its group and shows no project: its tasks are what is clicked (tasks.js tests the
    // folding).
    await ui(`${projectTab('project')}.querySelector('.plabel').click()`);
    await waitFor(() => shell.open.get('project').collapsed);
    assert.equal(shell.current?.folder, other);
    await ui(`${projectTab('project')}.querySelector('.plabel').click()`);
    await waitFor(() => !shell.open.get('project').collapsed);
    // A click on the first project's task: it comes back as it was left, its agent the same; no page shows before
    // it has its place in the grid (nothing jumps).
    const jumps = [];
    const watch = setInterval(() => {
      for (const p of shell.profiles.values()) {
        const v = p.get()?.view;
        if (v && !v.webContents.isDestroyed() && v.getVisible() && !v.getBounds().width) jumps.push(p.id);
      }
    }, 5);
    await showProject(ui, 'project');
    await waitFor(() => shell.current?.folder === project && shell.profiles.get('sam-admin') === sam);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    await waitFor(async () => (await viewOn(shell, ui, 'sam-admin')) && viewOn(shell, ui, 'elon-buyer'));
    clearInterval(watch);
    assert.deepEqual(jumps, [], 'pages shown before the grid placed them');
    assert.equal(shell.pty, firstPty, 'the same agent');
    assert.equal(seller.get().view.getVisible(), false, "the other project's pages hidden");
    assert.deepEqual(await projectTabs(ui), ['project *', 'other']);
    const seen = await ui(`(() => { const s = [...__islands]; window.__islands = null; return s; })()`);
    assert.deepEqual(seen, [JSON.stringify(before)], 'the islands keep their places, also while switching');
    // The group's panel: its name, color and icon edited in place at its top, the keyboard in the name.
    await rightClick(ui, '#projectTabs [data-project="other"] .name');
    await menuRows(ui);
    const entry = () => shell.store.projects().find((p) => p.id === 'other');
    await waitFor(() => ui(`document.activeElement?.id === 'gpname' && document.activeElement.value === 'other'`));
    const look = { color: entry().color, icon: entry().icon };
    const pick = shell.store.nextColor();
    await ui(`document.querySelector('#gpcolors [data-value="${pick}"]').click(); document.querySelector('#gpicons [data-value="rocket"]').click()`);
    await waitFor(() => entry().color === pick && entry().icon === 'rocket');
    await waitFor(() => ui(`${projectTab('other')}.querySelector('.plabel use').getAttribute('href') === '#i-p-rocket'`));
    assert.ok(await menuOpen(ui), 'it stays open while they are chosen');
    // A name typed (a menu would take its letters for its rows), Enter: renamed, the panel closed.
    const wc = shell.win.webContents;
    await ui(`document.getElementById('gpname').select()`);
    await wc.insertText('other-two');
    for (const type of ['keyDown', 'char', 'keyUp']) wc.sendInputEvent({ type, keyCode: type === 'char' ? '\r' : 'Enter' });
    await waitFor(async () => entry().name === 'other-two' && !(await menuOpen(ui)));
    assert.deepEqual(await projectTabs(ui), ['project *', 'other-two']);
    // Put back, from the panel again: Esc closes it, the name typed kept.
    await rightClick(ui, '#projectTabs [data-project="other"] .name');
    await menuRows(ui);
    await waitFor(() => ui(`document.activeElement?.id === 'gpname'`));
    await ui(`document.getElementById('gpname').select()`);
    await wc.insertText('other');
    await ui(`document.querySelector('#gpcolors [data-value="${look.color}"]').click(); document.querySelector('#gpicons [data-value="${look.icon || 'logo'}"]').click()`);
    await waitFor(() => entry().color === look.color && (entry().icon || 'logo') === (look.icon || 'logo'));
    await closeMenu(ui);
    await waitFor(() => entry().name === 'other');
    assert.equal(shell.win.getTitle(), 'project — Kulisa');

    // Closing the group (the middle button on its label) asks first when an agent works; Cancel keeps it open.
    ctx.asked.length = 0;
    ctx.answer = false;
    const working = shell.task;
    working.state = 'working';
    await closeProject(ui, 'project');
    await waitFor(() => ctx.asked.length && ui(`!(document.getElementById('ask')?.dataset.state === 'open')`));
    assert.equal(ctx.asked.pop().message, 'Close the group project?');
    assert.ok(shell.open.has('project') && shell.current?.folder === project, 'still open when the human says no');
    ctx.answer = true;
    working.state = null;
    // Close: no agent works, no question; its tasks close (tabs and sign-ins kept), the group next to it is shown.
    await closeProject(ui, 'project');
    await waitFor(() => shell.current?.folder === other && !shell.open.has('project'));
    assert.equal(ctx.asked.length, 0, 'nothing asked');
    assert.ok(shell.store.tasksOf({ id: 'project' }).list.every((e) => e.closed), 'its tasks closed');
    assert.ok(sam.tabs.every((t) => t.wc.isDestroyed()), "the closed project's tabs are closed");
    assert.deepEqual(await projectTabs(ui), ['other *']);
    // Opened again from Search Tasks, on its task: the conversation goes on, the profiles signed in.
    await searchTasks(ui, 'project', 1);
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
    await closeProject(ui, 'other');
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
    await ui(`kulisa.invoke('project:open', { folder: ${JSON.stringify(other)}, task: 1 })`);
    await waitFor(() => shell.current?.id === 'other' && shell.task.loaded && shell.pty);
    await waitFor(() => ui(`!document.documentElement.classList.contains('loading')`));
    const moved = shell.current, task = moved.task, pty = task.pty, seller = task.profiles.get('sam-seller');
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
    await waitFor(() => shell.current?.id === 'project' && shell.task.loaded);
    assert.deepEqual(await projectTabs(ui), ['project *']);
    assert.equal(moved.window, second);
    await waitFor(async () => JSON.stringify(await projectTabs(ui2)) === '["other *"]');
    assert.equal(second.win.getTitle(), 'other — Kulisa');
    assert.equal(task.pty, pty, 'the same agent');
    assert.equal(task.profiles.get('sam-seller'), seller, 'the same profile');
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
    await ctx.call('browser_navigate', { profile: 'sam-seller', url: `${SITE}/app?moved` }, task);
    assert.match(seller.get().wc.getURL(), /\?moved$/);
    // Search Tasks in either window lists every project; a task of one open in the other window: shown there, not
    // moved, nothing asked.
    const asked = ctx.asked.length;
    await searchTasks(ui2, 'project', 1);
    await waitFor(() => first.current?.id === 'project' && first.task?.n === 1);
    assert.ok(shell.open.get('project').window === first && second.current?.id === 'other' && ctx.asked.length === asked);
    // Questions about its project are asked in its window.
    ctx.answer = false;
    await ui2(`act('profile:delete', { profile: 'sam-seller' })`);
    ctx.answer = true;
    assert.ok(task.profiles.has('sam-seller'), 'kept: the human said no');
    assert.deepEqual(savedWindows(), [{ tabs: ['project'], shown: 'project' }, { tabs: ['other'], shown: 'other' }]);

    // Back into the first window (Move to Window, as a browser moves a tab): the only tab of the second, so it closes.
    await rightClick(ui2, '#projectTabs [data-project="other"] .name');
    assert.deepEqual(await menuRows(ui2), ['New Task', '-', 'Move to New Window (off)', 'Move to Window: project', '-', 'Project Settings…', 'Show Data Folder', '-', 'Close Group']);
    await choose(ui2, 'Move to Window: project');
    await waitFor(() => shell.windows.length === 1 && shell.current === moved && !first.switching);
    assert.ok(second.win.isDestroyed());
    assert.equal(task.pty, pty, 'the same agent');
    assert.ok(first.win.contentView.children.includes(view), 'its page back');
    await waitFor(async () => (await viewOn(shell, ui, 'sam-seller')) && (await ctx.termText()).includes('moved along'));
    assert.deepEqual(await projectTabs(ui), ['project', 'other *']);
    assert.deepEqual(savedWindows(), [{ tabs: ['project', 'other'], shown: 'other' }]);
    await closeProject(ui, 'other');
    await waitFor(() => !shell.open.has('other') && shell.current?.id === 'project' && !first.switching);

    // A task of a project with no group: a group of its own in this window, nothing asked where; Move to New Window
    // takes it away.
    ctx.asked.length = 0;
    await searchTasks(ui, 'other', 1);
    await waitFor(() => shell.current?.id === 'other' && shell.task?.n === 1 && shell.task.pty && !first.switching);
    assert.equal(ctx.asked.length, 0, 'no question where');
    assert.deepEqual(await projectTabs(ui), ['project', 'other *']);
    await rightClick(ui, '#projectTabs [data-project="other"] .name');
    await menuRows(ui);
    await choose(ui, 'Move to New Window');
    await waitFor(() => shell.windows.length === 2 && shell.windows[1].current?.id === 'other' && !shell.windows[1].switching);
    const third = shell.windows[1], reopened = third.current;
    await waitFor(() => reopened.task.pty);
    const reopenedTask = reopened.task;
    assert.deepEqual(await projectTabs(ui), ['project *'], 'nothing else in the first window');

    // Closing the window (the OS's ×) closes its group, as Close Group would, after one question in that window
    // (the function that closes a tab); Kulisa goes on in the first.
    ctx.asked.length = 0;
    ctx.answer = false;
    third.win.close();
    await waitFor(() => ctx.asked.length && third.win.webContents.executeJavaScript(`!(document.getElementById('ask')?.dataset.state === 'open')`));
    const q = ctx.asked.pop();
    assert.equal(q.message, 'Close the window?');
    assert.match(q.detail, /Its tasks close: other\./);
    assert.ok(!third.win.isDestroyed() && shell.open.has('other'), 'still open when the human says no');
    ctx.answer = true;
    third.win.close();
    await waitFor(() => shell.windows.length === 1 && !shell.open.has('other'));
    ctx.asked.length = 0;
    assert.ok(third.win.isDestroyed() && reopenedTask.profiles.size === 0 && reopenedTask.pty === null);
    assert.deepEqual(savedWindows(), [{ tabs: ['project'], shown: 'project' }]);
    assert.equal(await viewOn(shell, ui, 'sam-admin'), true);

    // The last window's × quits Kulisa (its projects come back at the next start): asked only when an agent works.
    shell.task.state = 'working';
    ctx.answer = false;
    shell.win.close();
    await waitFor(() => ctx.asked.length && ui(`!(document.getElementById('ask')?.dataset.state === 'open')`));
    const quit = ctx.asked.pop();
    assert.equal(quit.message, 'Quit Kulisa?');
    assert.match(quit.detail, /^An agent is still working \(task-1\): quitting stops it\./);
    assert.ok(!shell.win.isDestroyed() && shell.open.has('project'), 'Kulisa goes on when the human says no');
    shell.task.state = null;
    ctx.answer = true;
  });
  test('projects: a tab dragged changes the order, goes out into a new window and back into the first', async (ctx) => {
    const { shell, ui } = ctx;
    const other = path.join(root, 'other'), DRAG = 'application/x-kulisa-project';
    await ui(`kulisa.invoke('project:open', { folder: ${JSON.stringify(other)}, task: 1 })`);
    await waitFor(() => shell.current?.id === 'other' && shell.task.loaded && shell.pty && !shell.windows[0].switching);
    ctx.asked.length = 0;
    const moved = shell.current, pty = moved.task.pty;
    // Synthetic drag events, as the human's mouse would send them; a drop gets what the drag carried.
    const dragStart = (u, id) => u(`(() => { window.__dt = new DataTransfer();
      ${projectTab(id)}.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: window.__dt })); return window.__dt.getData('${DRAG}'); })()`);
    const dragEnd = (u, id, effect) => u(`(() => { window.__dt.dropEffect = '${effect}';
      ${projectTab(id)}.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: window.__dt })); })()`);
    // The mark is drawn with the window's next update (Vue), before the next frame.
    const dropOn = (u, id, side, data) => u(`(async () => { const dt = new DataTransfer(); dt.setData('${DRAG}', ${JSON.stringify(data)});
      const t = ${projectTab(id)}, r = t.getBoundingClientRect();
      const o = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.x + (${side === 'before'} ? 3 : r.width - 3), clientY: r.y + r.height / 2 };
      t.dispatchEvent(new DragEvent('dragover', o)); await new Promise(requestAnimationFrame); const shown = t.classList.contains('drop-${side}');
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
    await sleep(300); // nothing to wait for: that no window comes
    assert.equal(shell.windows.length, 1);
    // Let go beside the window, on the side with more room on the screen: where the window manager put the test's
    // window varies, and a point off the screen gives a window the OS pulls back next to the first one.
    const area = require('electron').screen.getDisplayMatching(b).workArea;
    const right = area.x + area.width - (b.x + b.width) >= b.x - area.x;
    shell.pointer = () => ({ x: right ? Math.min(b.x + b.width + 300, area.x + area.width - 10) : Math.max(b.x - 300, area.x + 10), y: b.y + 200 });
    await dragStart(ui, 'other');
    await dragEnd(ui, 'other', 'none');
    await waitFor(() => shell.windows.length === 2 && shell.windows[1].current === moved && !shell.windows[1].switching);
    shell.pointer = pointer;
    const second = shell.windows[1], ui2 = (js) => second.win.webContents.executeJavaScript(js);
    const nb = second.win.getBounds();
    assert.ok(right ? nb.x > b.x + 32 : nb.x < b.x - 32, `towards the pointer, not next to the first window: ${JSON.stringify({ b, nb, right })}`);
    assert.deepEqual(await projectTabs(ui), ['project *']);
    assert.equal(moved.task.pty, pty, 'the same agent');

    // Onto the first window's tabs: back there, where it was let go; the second window, left empty, closes.
    data = await dragStart(ui2, 'other');
    assert.ok(await dropOn(ui, 'project', 'after', data));
    shell.pointer = pointer; // its window closes with it: no dragend there
    await waitFor(() => shell.windows.length === 1 && shell.current === moved && !shell.windows[0].switching);
    assert.ok(second.win.isDestroyed());
    assert.deepEqual(await projectTabs(ui), ['project', 'other *']);
    assert.equal(moved.task.pty, pty);
    await closeProject(ui, 'other');
    await waitFor(() => !shell.open.has('other') && shell.current?.id === 'project' && !shell.windows[0].switching);
    ctx.asked.length = 0;
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

  test('a menu opens even when a page gives no picture (a page that draws no frames: covered, the monitor off, busy)', async ({ shell, ui }) => {
    const wc = shell.profiles.get('elon-buyer').get().wc;
    wc.capturePage = () => new Promise(() => {}); // never
    try {
      await rightClick(ui, '.ptab[data-panel="profile:Profile 2"]');
      await waitFor(() => menuOpen(ui), 2000);
      assert.equal(await ui(`!!document.querySelector('.pane[data-profile="elon-buyer"] .content img.snapshot')`), false, 'no picture, the pane is empty meanwhile');
      await closeMenu(ui);
      await waitFor(async () => !(await menuOpen(ui)));
    } finally { delete wc.capturePage; }
  });
  test('context menus: a pane\'s header, a tab, the terminal; pages are pictures while a menu is open; Arrange panels in ☰; Exit', async (ctx) => {
    const { shell, ui } = ctx;
    const elon = shell.profiles.get('elon-buyer');
    const header = '.ptab[data-panel="profile:Profile 2"]';
    await rightClick(ui, header);
    assert.deepEqual(await menuRows(ui), ['New tab', 'About this profile…', 'Sign In to Master…', 'Refresh from Master…', 'Close profile', '-', 'Delete profile…']);
    const at = await ui(`(() => { const h = document.querySelector('${header}').getBoundingClientRect(), m = document.querySelector('.menu[data-state="open"]').getBoundingClientRect();
      return Math.abs(m.left - (h.x + h.width / 2)) <= 4 && Math.abs(m.top - (h.y + h.height / 2)) <= 4; })()`);
    assert.ok(at, 'at the pointer');
    // The pages are native views above the menu: pictures of them stand in meanwhile.
    assert.equal(elon.get().view.getVisible(), false);
    assert.ok(await ui(`!!document.querySelector('.pane[data-profile="elon-buyer"] .content img.snapshot')`));
    // Another menu right from this one: the pages stay pictures.
    await ui(`document.getElementById('windowMenu').click()`);
    await waitFor(async () => (await menuRows(ui))[0] === 'zoom');
    assert.equal(elon.get().view.getVisible(), false, 'a page over the second menu');
    await rightClick(ui, header);
    await waitFor(async () => (await menuRows(ui))[0] === 'New tab');
    assert.deepEqual(await menuRows(ui), ['New tab', 'About this profile…', 'Sign In to Master…', 'Refresh from Master…', 'Close profile', '-', 'Delete profile…']);
    assert.equal(elon.get().view.getVisible(), false, 'a page over the third menu');
    const n = elon.tabs.length;
    await choose(ui, 'New tab');
    await waitFor(() => elon.tabs.length === n + 1);
    await waitFor(() => elon.get().view.getVisible());
    assert.equal(await ui(`document.querySelectorAll('img.snapshot').length`), 0);

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
    await waitFor(() => menuOpen(ui)); // once the pages' pictures are there (menuCover): slower under load
    shell.win.webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'right', clickCount: 1 });
    await sleep(300); // nothing to wait for: that the release does not close it
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
    await ui(`document.querySelector('.menu[data-state="open"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))`);
    assert.equal(await ui(`document.activeElement.querySelector('.label')?.textContent`), 'Paste', 'arrows move over the enabled rows');
    await choose(ui, 'Select all');
    await waitFor(() => ui(`window.__term.hasSelection()`));
    await ui(`window.__term.clearSelection()`);
    // Copy and paste as the OS's own terminal: here Linux's Ctrl+Shift+C / V; a paste lands once (Chromium's own
    // paste and Kulisa's both pasted it); Ctrl+V and Ctrl+C go to the agent. Windows' and macOS' keys, and the menu's.
    const keys = (keyCode, modifiers) => press(shell.win.webContents, keyCode, ...modifiers);
    await clipboard.writeText('kulisa-paste');
    shell.win.focus(); await ui(`window.__term.focus()`);
    const before = ctx.ptyOutput().length;
    keys('V', ['control', 'shift']);
    await waitFor(() => ctx.ptyOutput().slice(before).includes('kulisa-paste'));
    await sleep(300); // nothing to wait for: that it is not pasted twice
    assert.equal(ctx.ptyOutput().slice(before).split('kulisa-paste').length - 1, 1, 'pasted once');
    await clipboard.writeText('');
    await ui(`window.__term.selectAll()`);
    keys('C', ['control', 'shift']);
    await waitFor(async () => (await clipboard.readText()).includes('kulisa-paste'));
    await ui(`window.__term.clearSelection()`);
    keys('C', ['control', 'shift']);
    await sleep(300); // nothing to wait for: that the clipboard is not emptied
    assert.ok((await clipboard.readText()).includes('kulisa-paste'), 'nothing selected: the clipboard is kept');
    keys('U', ['control']); // the agent's line emptied
    const key = (code, mods = {}) => JSON.stringify({ code, ctrlKey: true, ...mods });
    assert.deepEqual(await ui(`[
      ['linux', ${key('KeyV', { shiftKey: true })}], ['linux', ${key('KeyC', { shiftKey: true })}, true], ['linux', ${key('KeyV')}], ['linux', ${key('KeyC')}, true],
      ['win32', ${key('KeyV')}], ['win32', ${key('KeyC')}, true], ['win32', ${key('KeyC')}, false], ['win32', ${key('KeyV', { shiftKey: true })}],
      ['darwin', ${key('KeyV')}], ['darwin', ${key('KeyV', { ctrlKey: false, metaKey: true })}],
      ['linux', ${JSON.stringify({ code: '', keyCode: 86, ctrlKey: true, shiftKey: true })}]].map(([os, e, selected]) => clipboardKey(e, os, selected))`),
    ['paste', 'copy', null, null, 'paste', 'copy', null, 'paste', null, null, 'paste'], 'the keys of each OS; by keyCode when code is left out (ibus, Cyrillic)');
    assert.deepEqual(await ui(`[keyText('terminal.copy'), keyText('terminal.paste')]`), ['Ctrl+Shift+C', 'Ctrl+Shift+V'], "the menu's keys for Linux (main/keys.js)");

    // Links in the terminal, marked by the agent (OSC 8) or in plain text: Ctrl+click asks where, at the pointer: a tab of
    // one of the open profiles, or the user's browser. A plain click, or an address that is not http(s), does nothing.
    await ui(`new Promise((r) => window.__term.write('\\r\\n\\x1b]8;;${SITE}/app\\x07the app\\x1b]8;;\\x07 and https://example.com/docs\\r\\n', r))`);
    assert.equal(await ui(`window.__term.options.linkHandler === termLinks`), true, "the agent's links (OSC 8) are Kulisa's");
    const click = (uri, mods) => ui(`termLinks.activate(new MouseEvent('click', { clientX: 120, clientY: 600, ...${JSON.stringify(mods)} }), ${JSON.stringify(uri)})`);
    await click(`${SITE}/app`, {});
    await click('javascript:alert(1)', { ctrlKey: true });
    await sleep(200); // nothing to wait for: that no menu opens
    assert.equal(await menuOpen(ui), false, 'a plain click, or not http(s): nothing');
    const names = await ui(`state.map((p) => p.name)`);
    await click(`${SITE}/app`, { ctrlKey: true });
    assert.deepEqual(await menuRows(ui), [`# ${SITE}/app`, ...names.map((n) => `Open in ${n}`), '-', 'Open in your browser']);
    const linked = shell.profiles.get(await ui(`state[0].id`)), had = linked.tabs.length;
    await choose(ui, `Open in ${names[0]}`);
    await waitFor(() => linked.tabs.length === had + 1 && linked.get().url.startsWith(`${SITE}/app`));
    await linked.closeTab(linked.get().id);
    const electron = require('electron'), openExternal = electron.shell.openExternal, opened = [];
    electron.shell.openExternal = async (url) => { opened.push(url); };
    try {
      await click('https://example.com/docs', { ctrlKey: true });
      await menuRows(ui);
      await choose(ui, 'Open in your browser');
      await waitFor(() => opened.length === 1);
      assert.deepEqual(opened, ['https://example.com/docs']);
    } finally { electron.shell.openExternal = openExternal; }

    await ui(`document.getElementById('windowMenu').click()`);
    // The arrangements as pictures, a short name under each, the full words in the tooltip.
    assert.deepEqual((await menuRows(ui)).slice(4), ['# Arrange panels', 'arrange: Columns, Two by two, One at a time', '-', 'Agents…', 'Keyboard Shortcuts', '-',
      'Documentation', 'GitHub', 'Report an issue', '-', 'Exit', `~ Kulisa ${require('../package.json').version}`], "Kulisa's version a note under the rows, not one of them");
    assert.deepEqual(await ui(`[...document.querySelectorAll('.menu[data-state="open"] svg:not([hidden]) > use')].map((u) => u.getAttribute('href'))`),
      ['#i-zoom', '#i-theme', '#i-projects', '#i-arrange', '#i-agent', '#i-keyboard', '#i-docs', '#i-github', '#i-bug', '#i-exit'], 'each row with its icon');
    const pics = await ui(`[...document.querySelectorAll('.menu[data-state="open"] .arrange [role="menuitem"]')].map((b) => ({ title: b.title,
      panes: b.querySelectorAll('svg .a-page').length, term: b.querySelectorAll('svg .a-term').length, w: b.querySelector('svg').getBoundingClientRect().width }))`);
    assert.deepEqual(pics.map((p) => [p.panes, p.term]), [[3, 1], [4, 1], [1, 1]]);
    assert.ok(pics.every((p) => p.title && p.w >= 40), JSON.stringify(pics));
    await ui(`document.querySelector('.menu[data-state="open"] .arrange [data-preset="focus"]').click()`);
    assert.equal(await menuOpen(ui), false, 'a choice closes the menu');
    await waitFor(async () => (await pageBox(ui, 'elon-buyer')) === null && viewOn(shell, ui, 'sam-admin'));
    await ui(`window.__layoutPreset('grid')`); // as the grid presets test left it, for the restart phase
    // ☰'s links open in the user's browser.
    electron.shell.openExternal = async (url) => { opened.push(url); };
    try {
      await ui(`document.getElementById('windowMenu').click()`);
      await menuRows(ui);
      await choose(ui, 'GitHub');
      await waitFor(() => opened.length === 2);
    } finally { electron.shell.openExternal = openExternal; }
    assert.equal(opened[1], 'https://github.com/cosmotools/kulisa');

    // Exit quits as the last window's × does: asked only when an agent works.
    shell.task.state = 'working';
    ctx.answer = false;
    await ui(`document.getElementById('windowMenu').click()`);
    await menuRows(ui);
    await choose(ui, 'Exit');
    await waitFor(() => ctx.asked.length && ui(`!(document.getElementById('ask')?.dataset.state === 'open')`));
    assert.equal(ctx.asked.pop().message, 'Quit Kulisa?');
    assert.ok(!shell.win.isDestroyed() && shell.open.size, 'Kulisa goes on when the human says no');
    shell.task.state = null;
    ctx.answer = true;
  });
  test("menus with the mouse and the keyboard, as the OS's: a press on ☰, a drag to a row and the release there chooses it; a click opens, the next closes; a right-click's release over a row chooses nothing; Enter and the arrows; the keyboard back where it was; leaving the window closes it", async (ctx) => {
    const { shell, ui } = ctx, wc = shell.win.webContents, z = wc.getZoomFactor();
    const scaled = ({ x, y }) => ({ x: Math.round(x * z), y: Math.round(y * z) });
    const mid = async (sel) => { const b = await box(ui, sel); return scaled({ x: b.x + b.width / 2, y: b.y + b.height / 2 }); };
    const rowAt = async (label) => scaled(await ui(`(() => { const r = [...document.querySelectorAll('.menu[data-state="open"] .item')]
      .find((e) => e.querySelector('.label').textContent === ${JSON.stringify(label)}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`));
    const mouse = (type, at, button = 'left', modifiers = []) => wc.sendInputEvent({ type, ...at, button, clickCount: 1, modifiers });
    const anyMenu = () => ui(`!!document.querySelector('.menu[data-state="open"]')`);
    const shortcuts = () => ui(`document.getElementById('shortcuts')?.dataset.state === 'open'`);

    // Pressed on ☰, dragged to Keyboard Shortcuts, let go there: chosen.
    const menuButton = await mid('#windowMenu');
    mouse('mouseDown', menuButton);
    await waitFor(() => menuOpen(ui));
    const to = await rowAt('Keyboard Shortcuts');
    mouse('mouseMove', to, 'left', ['leftButtonDown']);
    mouse('mouseUp', to);
    await waitFor(shortcuts);
    await ui(`document.querySelector('#shortcuts .x').click()`);
    await waitFor(async () => !(await shortcuts()));

    // A click opens it (the click after the press is not a second toggle); a click on the same button closes it.
    mouse('mouseDown', menuButton); mouse('mouseUp', menuButton);
    await waitFor(() => menuOpen(ui));
    await sleep(200); // nothing to wait for: that it stays open
    assert.equal(await anyMenu(), true, 'open after the click');
    mouse('mouseDown', menuButton); mouse('mouseUp', menuButton);
    await waitFor(async () => !(await anyMenu()));

    // The keyboard: Enter on ☰ opens it on its first row, ↓ goes to the next, Esc closes it, ☰ has the keyboard again.
    await ui(`document.getElementById('windowMenu').focus()`);
    press(wc, 'Enter');
    await waitFor(() => menuOpen(ui));
    await waitFor(() => ui(`!!document.activeElement.closest('.menu[data-state="open"]')`));
    const first = await ui(`document.activeElement.textContent`);
    press(wc, 'Down');
    await waitFor(async () => (await ui(`document.activeElement.textContent`)) !== first);
    press(wc, 'Escape');
    await waitFor(async () => !(await anyMenu()));
    assert.equal(await ui(`document.activeElement.id`), 'windowMenu');

    // A right-click in the terminal: on Linux the menu opens on the press, and letting go over a row chooses nothing.
    // Esc closes it, and the keyboard is back in the terminal.
    await ui(`window.__term.focus()`);
    const at = await mid('#term .xterm-screen');
    mouse('mouseDown', at, 'right');
    await waitFor(() => menuOpen(ui));
    const paste = await rowAt('Paste'), before = ctx.ptyOutput().length;
    mouse('mouseMove', paste, 'right', ['rightButtonDown']);
    mouse('mouseUp', paste, 'right');
    await sleep(300); // nothing to wait for: that nothing is chosen
    assert.equal(await anyMenu(), true, 'still open');
    assert.equal(ctx.ptyOutput().length, before, 'nothing pasted');
    press(wc, 'Escape');
    await waitFor(async () => !(await anyMenu()));
    assert.ok(await ui(`!!document.activeElement.closest('#term')`), 'the keyboard back in the terminal');

    // Leaving the window (another one takes the focus) closes a menu, as the OS's own menus close.
    mouse('mouseDown', menuButton); mouse('mouseUp', menuButton);
    await waitFor(() => menuOpen(ui));
    const other = new (require('electron').BrowserWindow)({ width: 300, height: 200, show: false });
    try {
      other.show(); other.focus();
      await waitFor(async () => !(await anyMenu()));
    } finally { other.destroy(); }
    shell.win.focus();
  });
};
