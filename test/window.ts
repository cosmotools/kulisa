// The window: the terminal, the app icon, the top bar, screenshots.
import { nativeTheme } from 'electron';
import fs from 'fs';
import path from 'path';
import { assert, root, userData, sleep, waitFor, menuRows, choose, manageProfiles, menuOpen, rightClick, box, viewOn, closeMenu } from './helpers.ts';
import forge from '../forge.config.ts';
import type { Test } from './run.ts';
import type { TaskTerminal } from '../src/main/tasks.ts';

export default (test: Test) => {
  test('the agent starts at the terminal\'s real size, not a default one', async ({ shell, ui }) => {
    // Claude Code draws its prompt for the size it starts with and does not fully redraw on the first resize.
    const first = await ui(`window.__ptySizes[0]`);
    assert.deepEqual(shell.pty.spawnSize, first);
    assert.ok(first.rows >= 10 && first.cols >= 80, `a real size: ${JSON.stringify(first)}`);
  });
  test('terminal: Unicode 11 widths (cursor stays put after emoji), bundled font, GPU renderer, the rows in the middle', async ({ ui }) => {
    // Claude Code draws ✅, ⏵, ✻…; with Unicode 6 widths xterm puts the cursor one cell off after each wide one.
    const x = await ui(`new Promise((r) => window.__term.write('\\r\\n✅🙂x', () => r(window.__term.buffer.active.cursorX)))`);
    assert.equal(x, 5);
    assert.equal(await ui(`document.fonts.check(window.__term.options.fontSize + 'px "JetBrains Mono"')`), true);
    assert.equal(await ui(`window.__term.options.fontSize`), await ui(`parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font'))`), 'the terminal uses the UI text size');
    assert.equal(await ui(`window.__term.options.fontFamily.startsWith('"JetBrains Mono"')`), true);
    assert.equal(await ui(`window.__termRenderer`), 'webgl');
    // What is left under a whole row is shared above and below the rows.
    const { above, below } = await ui(`(() => { const h = document.querySelector('.xterm-host:not([hidden])').getBoundingClientRect(),
      r = document.querySelector('.xterm-host:not([hidden]) .xterm-screen').getBoundingClientRect();
      return { above: r.top - h.top, below: h.bottom - r.bottom }; })()`);
    assert.ok(Math.abs(above - below) <= 1, `the rows in the middle: ${above} above, ${below} below`);
  });
  test("terminal: dictation where the agent has its own: its language and a microphone in the header; held, or from a click to the next, the agent's key is held; another language chosen there", async ({ ui, termText }) => {
    await waitFor(() => ui(`!document.querySelector('.dictation').hidden`));
    assert.equal(await ui(`document.querySelector('.dictation .lang').textContent`), 'EN');
    assert.equal(await ui(`document.querySelector('.dictation .lang').title`), 'Dictation in English: the language you speak. it answers in it too',
      "what the agent's entry says of it");
    const keys = async () => ((await termText()).match(/<v>/g) || []).length;
    const press = (type: string) => ui(`document.querySelector('.dictation .mic').dispatchEvent(new PointerEvent('${type}', { bubbles: true, button: 0, pointerId: 1 }))`);
    const lit = () => ui(`document.querySelector('.dictation .mic').ariaPressed`);
    const still = async () => { const n = await keys(); await sleep(300); return n === await keys(); }; // that no more come
    // A click starts: the key repeats, as a held one does, and the button is lit until the next click.
    let n = await keys();
    await press('pointerdown'); await press('pointerup');
    await waitFor(async () => (await keys()) >= n + 5); // repeated while it records
    assert.equal(await lit(), 'true');
    await press('pointerdown'); await press('pointerup');
    await waitFor(still, 3000); // stopped by the second click (the keys sent before it still echo a moment)
    assert.equal(await lit(), 'false');
    // Held: it records until let go.
    n = await keys();
    await press('pointerdown');
    await sleep(600); // held longer than a click (400 ms, lib/voice.ts): that is what makes it a hold
    assert.ok((await keys()) >= n + 5, 'repeated while held');
    assert.equal(await lit(), 'true');
    await press('pointerup');
    await waitFor(still, 3000); // held, then let go
    assert.equal(await lit(), 'false');
    assert.equal(await ui(`document.activeElement.closest('.xterm') !== null`), true, 'the keyboard back in the terminal, to send it');
    // The languages it understands; another one chosen is the agent's.
    await ui(`document.querySelector('.dictation .lang').click()`);
    assert.equal((await menuRows(ui))[0], '# Dictation language');
    await choose(ui, 'русский');
    await waitFor(async () => (await ui(`document.querySelector('.dictation .lang').textContent`)) === 'RU');
  });
  test("terminals next to the agent's: + opens the human's shell in front; the agent runs what keeps running in its own, behind, reads it, stops it, closes it; × and a shell's exit close one", async ({ shell, ui, call, instructions }) => {
    const task = shell.task, group = (id: string) => ui(`window.__dock.getPanel(${JSON.stringify(id)})?.group.id === window.__dock.getPanel('terminal').group.id`);
    const active = (id: string) => ui(`window.__dock.getPanel(${JSON.stringify(id)})?.api.isActive === true`);
    assert.match(await instructions(), /terminal_run, not in your own shell.*This is the Kulisa task "task-1", working right in the project's folder .* the app under test runs on its usual ports\. Name the task with task_rename/s);
    await ui(`document.querySelector('.ptab .add').click()`);
    await waitFor(() => task.terminals.size === 1);
    const [human] = task.terminalsInfo();
    assert.deepEqual([human.name, human.by], ['Terminal 2', 'human']);
    await waitFor(() => active(`term:${human.id}`));
    assert.ok(await group(`term:${human.id}`), "a tab next to the agent's terminal");

    // The agent's: its environment (the port offset), behind (the human watches the agent), read back as plain text.
    assert.match((await call('terminal_run', { name: 'dev server', command: 'echo "ready at offset $KULISA_PORT_OFFSET"; sleep 30' })).text, /^Started in terminal "dev server"/);
    const dev = task.terminal('dev server') as TaskTerminal;
    await waitFor(async () => (await call('terminal_read', { name: 'dev server' })).text.includes('ready at offset 0'));
    assert.ok(await group(`term:${dev.id}`));
    assert.equal(await active(`term:${dev.id}`), false, 'behind');
    // Laid out below the grid while behind (dockview), it does not make the window scrollable: the agent's state on its
    // tab (the tasks' bar brings its tab into view) had moved the grid up by a window's height.
    await ui(`document.querySelector('#projectTabs > *').scrollIntoView()`);
    assert.deepEqual(await ui(`[document.documentElement.scrollTop, document.documentElement.scrollHeight <= innerHeight]`), [0, true]);
    assert.equal(await active(`term:${human.id}`), true, "the human's stays in front");
    assert.equal((await call('terminal_read', {})).text, `"Terminal 2" (the human's)\n"dev server" (yours): echo "ready at offset $KULISA_PORT_OFFSET"; sleep 30`);
    await assert.rejects(call('terminal_stop', { name: 'nope' }), /no terminal "nope"; open now: "Terminal 2", "dev server"/);
    // Stopped: Ctrl+C, the shell stays; the same name again types into it.
    await call('terminal_stop', { name: 'dev server' });
    await waitFor(async () => (await call('terminal_read', { name: 'dev server', lines: 3 })).text.includes('^C'));
    assert.match((await call('terminal_run', { name: 'Dev Server', command: 'echo again' })).text, /^Typed into terminal "dev server"/);
    await waitFor(async () => /^again$/m.test((await call('terminal_read', { name: 'dev server' })).text));
    // Closed by the agent: its panel and its process go.
    const pid = dev.pty.pid;
    await call('terminal_stop', { name: 'dev server', close: true });
    await waitFor(async () => !(await ui(`!!window.__dock.getPanel('term:${dev.id}')`)));
    await waitFor(() => { try { process.kill(pid, 0); return false; } catch { return true; } });
    // A shell that exits closes its terminal; × closes the human's.
    await call('terminal_run', { name: 'once', command: 'exit' });
    await waitFor(() => !(task.terminal('once') as TaskTerminal).id && task.terminals.size === 1);
    await ui(`[...document.querySelectorAll('.ptab')].find((t) => t.querySelector('b')?.textContent === 'Terminal 2').querySelector('.close').click()`);
    await waitFor(() => task.terminals.size === 0);
    await waitFor(async () => (await ui(`window.__dock.panels.filter((p) => p.id.startsWith('term:')).length`)) === 0);
    assert.equal(await active('terminal'), true, "the agent's in front again");
  });
  test('icons: each from the sprite (docs/ui.md), drawn there once and in lines of the text\'s color; icon buttons have a name', async ({ ui }) => {
    const r = await ui(`(() => {
      const every = (q) => [...document.querySelectorAll(q), ...[...document.querySelectorAll('template')].flatMap((t) => [...t.content.querySelectorAll(q)])];
      const ids = [...document.querySelectorAll('svg.sprite > symbol')].map((s) => s.id);
      const icons = every('svg').filter((s) => !s.closest('svg.sprite, .arrange')); // pictures, not icons
      const add = document.querySelector('.pane .add svg');
      return { ids: ids.length === new Set(ids).size, drawnInPlace: icons.filter((s) => !s.querySelector(':scope > use')).length,
        unknown: icons.map((s) => s.querySelector('use')?.getAttribute('href')).filter((h) => h && !ids.includes(h.slice(1))),
        unnamed: every('.icon').filter((b) => !b.getAttribute('aria-label') && !b.title).map((b) => b.className),
        lines: [getComputedStyle(add).fill, getComputedStyle(add).stroke === getComputedStyle(add.closest('button')).color],
        sprite: document.querySelector('svg.sprite').getBoundingClientRect().height }; // takes no room
    })()`);
    assert.deepEqual(r, { ids: true, drawnInPlace: 0, unknown: [], unnamed: [], lines: ['none', true], sprite: 0 });
  });
  test('the app icon: in the top bar, and every file the window and the installers use', async ({ ui }) => {
    const img = await ui(`(() => { const i = document.querySelector('#topbar svg.logo'); const r = i?.getBoundingClientRect(); return i && { w: r.width, h: r.height, drawn: !!i.querySelector('use[href="#i-logo"]'),
      drape: getComputedStyle(i).color, project: getComputedStyle(document.documentElement).getPropertyValue('--project') }; })()`);
    assert.ok(img && img.drawn && img.w >= 16 && img.h >= 16, JSON.stringify(img));
    assert.equal(img.drape, 'rgb(74, 123, 208)', "the curtain is in the project's color (#4a7bd0, the first one)");
    const files = [forge.packagerConfig.icon + '.png', forge.packagerConfig.icon + '.ico', forge.packagerConfig.icon + '.icns',
      ...(forge.makers as { config?: { setupIcon?: string; icon?: string; options?: { icon?: string } } }[]).flatMap((m) => [m.config?.setupIcon, m.config?.icon, m.config?.options?.icon]).filter(Boolean)];
    for (const f of files) assert.ok(fs.statSync(path.join(import.meta.dirname, '..', f)).size > 1000, f);
    assert.equal(files.length, 6);
  });
  test('one row on top: no menu bar, OS window buttons over the top bar', async ({ shell, ui }) => {
    assert.equal(shell.win.isMenuBarVisible(), false);
    assert.equal(await ui(`navigator.windowControlsOverlay.visible`), true);
    const bar = await ui(`(() => { const r = document.getElementById('topbar').getBoundingClientRect(); return { top: r.top, height: r.height, right: r.right }; })()`);
    const controls = await ui(`(() => { const r = navigator.windowControlsOverlay.getTitlebarAreaRect(); return { x: r.x, width: r.width }; })()`);
    assert.equal(bar.top, 0);
    assert.equal(bar.height, 44);
    assert.ok(bar.right <= controls.x + controls.width, 'the bar ends where the window buttons begin');
  });
  test('UI text is not selectable by dragging, as in a desktop app; fields are; the arrow over buttons', async ({ ui }) => {
    const sel = await ui(`(() => { const us = (q) => getComputedStyle(document.querySelector(q)).userSelect;
      return { button: us('#newTask'), name: us('.plabel .name'), tab: us('.tab .title'), header: us('.ptab'), field: us('.addr') }; })()`);
    assert.deepEqual(sel, { button: 'none', name: 'none', tab: 'none', header: 'none', field: 'text' });
    // The arrow over buttons and tabs, as in Chrome, not a web page's hand.
    assert.deepEqual(await ui(`['#newTask', '.plabel', '.tab', '.tabs .add', '.bar .back', '.ptab .close', '#windowMenu'].map((q) => getComputedStyle(document.querySelector(q)).cursor)`),
      ['default', 'default', 'default', 'default', 'default', 'default', 'default']);
  });
  test('screenshot of the whole window, profile views included', async ({ shell, ui }) => {
    const view = () => [...shell.profiles.values()][0].get().view.getVisible();
    await manageProfiles(ui);
    await waitFor(() => !view());
    await shell.screenshot(path.join(root, 'editor.png'));
    await ui(`document.querySelector('#projects .x').click()`);
    await waitFor(view);
    const file = path.join(root, 'window.png');
    await shell.screenshot(file);
    const png = fs.readFileSync(file);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.ok(png.length > 10000, `${png.length} bytes`);
  });
  test('theme: Dark by default, Light or System in ☰; the window, the terminal and the OS buttons follow, the pages keep the OS\'s; saved', async ({ shell, ui }) => {
    // What is shown: a panel's color, the terminal's; the controls' own scheme (color-scheme).
    const DARK = 'rgb(30, 31, 34)', LIGHT = 'rgb(255, 255, 255)';
    const look = () => ui(`(() => { const panel = getComputedStyle(document.querySelector('.dv-groupview')).backgroundColor;
      return { shade: panel === '${DARK}' ? 'dark' : panel === '${LIGHT}' ? 'light' : panel, term: window.__term.options.theme.background,
        scheme: getComputedStyle(document.querySelector('.omnibox input, input')).colorScheme,
        chosen: [...document.querySelectorAll('.menu[data-state="open"] .themerow [data-state="checked"]')].map((b) => b.dataset.theme),
        onAccent: (() => { const b = document.body.appendChild(Object.assign(document.createElement('button'), { className: 'primary' }));
          const c = getComputedStyle(b).color; b.remove(); return c; })() }; })()`); // a main button, as a dialog has (none in the page while closed)
    const page = shell.profiles.values().next().value.get().wc;
    const pageDark = () => page.executeJavaScript(`matchMedia('(prefers-color-scheme: dark)').matches`);
    const osDark = await pageDark();
    const settings = () => JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8')).theme;
    await ui(`document.getElementById('windowMenu').click()`);
    assert.deepEqual((await menuRows(ui)).slice(0, 3), ['zoom', 'theme', 'bar']);
    assert.deepEqual(await look(), { shade: 'dark', term: DARK, scheme: 'dark', chosen: ['dark'], onAccent: LIGHT });
    const choose = async (t: string, shade: string) => {
      await ui(`document.querySelector('.menu[data-state="open"] .themerow [data-theme="${t}"]').click()`);
      await waitFor(async () => { const l = await look(); return l.shade === shade && l.term === (shade === 'dark' ? DARK : LIGHT) && l.chosen[0] === t; });
      assert.equal(await menuOpen(ui), true, 'the menu stays open: the next one can be tried');
      assert.equal(settings(), t, 'saved');
    };
    await choose('light', 'light');
    assert.deepEqual(await look(), { shade: 'light', term: LIGHT, scheme: 'light', chosen: ['light'], onAccent: LIGHT });
    assert.equal(await pageDark(), osDark, "a site under test keeps the OS's scheme");
    await shell.screenshot(path.join(root, 'light.png'));
    await choose('system', nativeTheme.shouldUseDarkColors ? 'dark' : 'light'); // the OS's, as the pages'
    assert.equal((await look()).scheme, 'light dark');
    await choose('dark', 'dark');
    await shell.screenshot(path.join(root, 'dark.png'));
    assert.equal(await pageDark(), osDark);
    await closeMenu(ui);
  });
  test('the projects\' bar: under the grid by default, over it when chosen in ☰; the grid and its pages take the room left; saved', async ({ shell, ui }) => {
    const id = shell.profiles.keys().next().value;
    const where = () => ui(`(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(), bar = r('taskbar'), grid = r('dock');
      return { bar: bar.bottom <= grid.top ? 'top' : bar.top >= grid.bottom ? 'bottom' : 'over the grid', under: bar.top >= r('topbar').bottom,
        chosen: [...document.querySelectorAll('.menu[data-state="open"] .barrow [data-state="checked"]')].map((b) => b.dataset.bar) }; })()`);
    const saved = () => JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8')).bar;
    assert.equal((await where()).bar, 'bottom');
    for (const bar of ['top', 'bottom']) {
      await ui(`document.getElementById('windowMenu').click()`);
      await menuRows(ui);
      await ui(`document.querySelector('.menu[data-state="open"] .barrow [data-bar="${bar}"]').click()`);
      await waitFor(async () => (await where()).bar === bar && saved() === bar);
      assert.deepEqual(await where(), { bar, under: true, chosen: [bar] }, 'under the title bar either way');
      assert.equal(await menuOpen(ui), true, 'the menu stays open: the other one can be tried');
      await closeMenu(ui);
      await waitFor(() => viewOn(shell, ui, id), 3000); // the pages follow the grid
    }
  });
  test('dialogs: one look (title and ×, content, buttons at the bottom right, the main one last), in the page only while open; a question is asked in it', async (ctx) => {
    const { shell, ui } = ctx;
    // Each opened as the human opens it, looked at, closed: a closed one leaves nothing in the page (no memory kept).
    const isOpen = (id: string) => ui(`document.getElementById('${id}')?.dataset.state === 'open'`);
    const fromMenu = async (row: string, at?: string) => { await (at ? rightClick(ui, at) : ui(`document.getElementById('windowMenu').click()`)); await menuRows(ui); await choose(ui, row); };
    const openers = {
      projects: () => ui(`document.getElementById('manageProjects').click()`),
      taskrename: () => fromMenu('Rename…', '#tasklist .tasktab .name'),
      agentpick: () => fromMenu('Change agent…', '#term'),
      shortcuts: () => fromMenu('Keyboard Shortcuts'),
    };
    assert.equal(await ui(`document.querySelectorAll('.dialog').length`), 0, 'none in the page while closed');
    for (const [id, open] of Object.entries(openers)) {
      await open();
      await waitFor(() => isOpen(id), 20000);
      const l = await ui(`(() => { const d = document.getElementById('${id}'); return { id: '${id}', title: !!d.querySelector('header h2'),
        body: !!d.querySelector('.body'), footer: !!d.querySelector('footer'), last: d.querySelector('footer > button:last-child')?.className }; })()`);
      // A dialog whose parts are saved as they change (a project's page) has no buttons at the bottom.
      assert.ok(l.title && l.body && (id === 'projects' ? !l.footer : /primary|ok/.test(l.last)), JSON.stringify(l));
      await ui(`document.querySelector('${id === 'agentpick' ? '#agentcancel' : `#${id} .x`}').click()`); // the agent's choice: Cancel, no ×
      await waitFor(async () => !(await isOpen(id)));
    }
    await waitFor(() => ui(`document.querySelectorAll('.dialog').length === 0`));

    // A question before deleting: the title, what goes line by line, Cancel (focused) and a red Delete at the right.
    ctx.answer = null; // the test answers
    const view = () => [...shell.profiles.values()][0].get().view.getVisible();
    const open = () => ui(`(document.getElementById('ask')?.dataset.state === 'open')`);
    let answer = shell.ask({ message: 'Delete the thing?', ok: 'Delete', danger: true, detail: 'Deleted for good:\n• a\n• b' });
    await waitFor(open);
    const q = await ui(`(() => { const d = document.getElementById('ask'), r = (q) => d.querySelector(q).getBoundingClientRect(), ok = d.querySelector('.ok');
      return { title: d.querySelector('h2').textContent, lines: d.querySelector('.detail').innerText.split('\\n').length, ok: ok.textContent,
        order: r('header').bottom <= r('.body').top && r('.body').bottom <= r('footer').top, right: Math.round(r('footer').right - ok.getBoundingClientRect().right),
        focused: document.activeElement.textContent }; })()`);
    assert.deepEqual(q, { title: 'Delete the thing?', lines: 3, ok: 'Delete', order: true, right: 16, focused: 'Cancel' });
    assert.equal(await ui(`getComputedStyle(document.querySelector('#ask .ok')).backgroundColor`), 'rgb(201, 79, 79)', 'red');
    // Its buttons answer the hand: lit under the pointer, another color while pressed (they looked dead, the author, 2026-10-11).
    const wc = shell.win.webContents, z = wc.getZoomFactor();
    const bg = (sel: string) => ui(`getComputedStyle(document.querySelector('${sel}')).backgroundColor`);
    for (const sel of ['#ask footer button:not(.ok)', '#ask .ok']) {
      const b = await box(ui, sel), at = { x: Math.round((b.x + b.width / 2) * z), y: Math.round((b.y + b.height / 2) * z) };
      const still = await bg(sel);
      wc.sendInputEvent({ type: 'mouseMove', ...at });
      await waitFor(async () => (await bg(sel)) !== still);
      const lit = await bg(sel);
      wc.sendInputEvent({ type: 'mouseDown', ...at, button: 'left', clickCount: 1 });
      await waitFor(async () => ![still, lit].includes(await bg(sel)));
      wc.sendInputEvent({ type: 'mouseMove', x: 1, y: Math.round(at.y), modifiers: ['leftbuttondown'] }); // let go away from it: nothing chosen
      wc.sendInputEvent({ type: 'mouseUp', x: 1, y: Math.round(at.y), button: 'left', clickCount: 1 });
      await waitFor(async () => (await bg(sel)) === still);
    }
    assert.equal(await open(), true, 'still asking');
    assert.equal(view(), false, 'pages hidden under the dialog');
    shell.win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    assert.equal(await answer, false, 'Esc says no');
    await waitFor(view);

    // Two at once: the second waits for the first. Not deleting: the main button is blue.
    answer = shell.ask({ message: 'Initialize it?', ok: 'Initialize' });
    const second = shell.ask({ message: 'Delete the other?', ok: 'Delete', danger: true });
    await waitFor(open);
    assert.equal(await ui(`document.querySelector('#ask h2').textContent`), 'Initialize it?');
    assert.equal(await ui(`getComputedStyle(document.querySelector('#ask .ok')).backgroundColor`), 'rgb(53, 116, 240)', 'blue');
    await ui(`document.querySelector('#ask .ok').click()`);
    assert.equal(await answer, true);
    await waitFor(async () => (await open()) && (await ui(`document.querySelector('#ask h2').textContent`)) === 'Delete the other?');
    await ui(`document.querySelector('#ask .cancel').click()`);
    assert.equal(await second, false, 'Cancel says no');
    ctx.answer = true;
  });
};
