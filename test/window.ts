// The window: the terminal, the app icon, the top bar, screenshots.
import electron, { Menu, nativeTheme } from 'electron';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { closeSettings, canShoot, NO_SHOT, shot, assert, root, userData, sleep, waitFor, menuRows, choose, menuOpen, rightClick, box, viewOn, closeMenu, click, noNode, press } from './helpers.ts';
import { createPackage } from '@electron/asar';
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
    const { above, below } = await ui(`(() => { const h = document.querySelector('.term:not([hidden]) .xterm-host').getBoundingClientRect(),
      r = document.querySelector('.term:not([hidden]) .xterm-screen').getBoundingClientRect();
      return { above: r.top - h.top, below: h.bottom - r.bottom }; })()`);
    assert.ok(Math.abs(above - below) <= 1, `the rows in the middle: ${above} above, ${below} below`);
  });
  test('terminal: one xterm shows the terminal in front; another shown and back keeps its text, its scroll and the modes serializing leaves out', async ({ shell, ui, termText }) => {
    // An xterm each cost its renderer and a WebGL context, of which Chromium keeps 16 a page: the 17th takes the
    // oldest terminal's, which then draws slower for good, silently (src/terminal/README.md).
    const agent = [...shell.task.terminals.values()][0];
    // Opened as the island's + does, without its menu: a menu's pictures of the pages, put back late on a slow machine,
    // took the keyboard from the page the next test had put it in.
    await ui(`act('terminal:open')`);
    await waitFor(() => (shell.task.terminal('Terminal') as TaskTerminal)?.pty);
    const sh = shell.task.terminal('Terminal') as TaskTerminal;
    assert.equal(await ui(`document.querySelectorAll('.xterm').length`), 1, 'one xterm for both terminals');
    // The mouse in SGR and the cursor hidden, as Claude Code's fullscreen has them: serializing leaves both out.
    const cmd = "printf '%s-%s\\n' shell marker; seq 300; printf '\\033[?1000h\\033[?1006h\\033[?25l'\r";
    await ui(`kulisa.send('pty:in', ${JSON.stringify({ task: sh.key, data: cmd })})`);
    const modes = () => ui(`(() => { const t = window.__term, c = t._core;
      return { mouse: t.modes.mouseTrackingMode, encoding: c.coreMouseService.activeEncoding, hidden: c.coreService.isCursorHidden }; })()`);
    const set = { mouse: 'vt200', encoding: 'SGR', hidden: true };
    await waitFor(async () => (await termText()).includes('shell-marker') && JSON.stringify(await modes()) === JSON.stringify(set));
    await ui(`window.__term.scrollToLine(5)`);
    await ui(`act('terminal:show', { id: ${agent.id} })`);
    await waitFor(async () => (await termText()).includes('agent: rc of') && !(await termText()).includes('shell-marker'));
    assert.deepEqual(await modes(), { mouse: 'none', encoding: 'DEFAULT', hidden: false }, "the agent's own, not the shell's");
    await ui(`act('terminal:show', { id: ${sh.id} })`);
    await waitFor(async () => (await termText()).includes('shell-marker'));
    await waitFor(() => ui(`window.__term.buffer.active.viewportY === 5`));
    assert.deepEqual(await modes(), set, 'the modes are back');
    await ui(`document.querySelector('.termtab[data-id="${sh.id}"] .x').click()`);
    await waitFor(() => shell.task.terminals.size === 1);
  });
  test("terminal: dictation where the agent has its own: the right Ctrl held anywhere records, let go stops, pressed once it records until the next; the microphone at the end of the terminals' row shows it and does the same by the mouse; with a shell in front the agent comes to the front; the key is the human's to change in Keyboard Shortcuts", async ({ shell, ui, termText }) => {
    await waitFor(() => ui(`!document.querySelector('.dictation .mic').disabled`));
    // At the row's end, after + and the task's repositories, inside the row: no row of its own.
    const { row, add, mic } = await ui(`(() => { const r = (s) => document.querySelector(s).getBoundingClientRect().toJSON();
      return { row: r('.termtabs'), add: r('#termAdd'), mic: r('.dictation .mic') }; })()`);
    assert.ok(mic.left > add.right && row.right - mic.right <= 12, `at the row's end: ${JSON.stringify({ row, add, mic })}`);
    assert.ok(mic.top >= row.top && mic.bottom <= row.bottom, 'in the row');
    const mac = process.platform === 'darwin', name = mac ? 'Right ⌘' : 'Right Ctrl'; // Apple keyboards have no right Ctrl
    assert.equal(await ui(`document.querySelector('.dictation .mic').title`), `Speak to the agent in English: hold ${name} anywhere, or press it once and again; or this button the same way`,
      "in Kulisa's language (☰ → Language), with the key");
    const keys = async () => ((await termText()).match(/<v>/g) || []).length;
    const lit = () => ui(`document.querySelector('.dictation .mic').ariaPressed`);
    const still = async () => { const n = await keys(); await sleep(300); return n === await keys(); }; // that no more come
    const recording = async (n: number, what = '') => { try { await waitFor(async () => (await keys()) >= n + 5); } catch (e) { throw new Error(`not recording: ${what}`, { cause: e }); } assert.equal(await lit(), 'true', what); }; // repeated while it records
    const stopped = async (what = '') => { try { await waitFor(still, 3000); } catch (e) { throw new Error(`not stopped: ${what}`, { cause: e }); } assert.equal(await lit(), 'false', what); }; // the keys sent before still echo a moment
    // The key in a profile's page, where every other key is the site's: held, it records until let go, and the keyboard
    // stays in the page; its repeats while held are no presses.
    const page = shell.profiles.values().next().value.get().wc;
    const ctrl = (wc: Electron.WebContents, type: 'keyDown' | 'keyUp', repeat = false) => wc.sendInputEvent({ type, keyCode: mac ? 'Meta' : 'Control', modifiers: [mac ? 'meta' : 'control', 'right', ...(repeat ? ['isautorepeat' as const] : [])] });
    page.focus();
    await waitFor(() => page.isFocused());
    let n = await keys();
    ctrl(page, 'keyDown');
    await recording(n);
    ctrl(page, 'keyDown', true);
    await sleep(600); // held longer than a press (400 ms, HOLD in tasks.ts): that is what makes it a hold
    assert.equal(await lit(), 'true');
    ctrl(page, 'keyUp');
    await stopped('held in the page');
    assert.ok(page.isFocused(), 'the keyboard stays where it was');
    // Pressed once: until the next press. The left Ctrl is the usual Ctrl.
    n = await keys();
    page.sendInputEvent({ type: 'keyDown', keyCode: mac ? 'Meta' : 'Control', modifiers: [mac ? 'meta' : 'control', 'left'] }); page.sendInputEvent({ type: 'keyUp', keyCode: mac ? 'Meta' : 'Control', modifiers: [mac ? 'meta' : 'control', 'left'] });
    await sleep(200);
    assert.equal(await keys(), n);
    ctrl(page, 'keyDown'); ctrl(page, 'keyUp');
    await recording(n);
    await sleep(500);
    assert.equal(await lit(), 'true', 'still on');
    ctrl(page, 'keyDown'); ctrl(page, 'keyUp');
    await stopped('tap in the page');
    // In the window too (the terminal has the keyboard); the window losing the keyboard lets go.
    const win = shell.win.webContents;
    await ui(`document.querySelector('.term:not([hidden]) .xterm-helper-textarea').focus()`);
    n = await keys();
    ctrl(win, 'keyDown');
    await recording(n);
    shell.win.emit('blur');
    await stopped('blur');
    // The button does the same by the mouse: a click starts, the next stops; held, until let go.
    const mouse = (type: string) => ui(`document.querySelector('.dictation .mic').dispatchEvent(new PointerEvent('${type}', { bubbles: true, button: 0, pointerId: 1 }))`);
    n = await keys();
    await mouse('pointerdown'); await mouse('pointerup');
    await recording(n);
    assert.equal(await ui(`document.querySelector('.dictation .mic').title`), `Recording: let go of ${name}, or click to stop`);
    await mouse('pointerdown'); await mouse('pointerup');
    await stopped('click');
    n = await keys();
    await mouse('pointerdown');
    await sleep(600);
    assert.ok((await keys()) >= n + 5, 'repeated while held');
    await mouse('pointerup');
    await stopped('button held');
    assert.equal(await ui(`document.activeElement.closest('.xterm') !== null`), true, 'the keyboard back in the terminal, to send it');
    // With a shell in front (the button disabled: the dictation is the agent's), the key brings the agent the prompt
    // goes to in front, and records.
    await ui(`document.getElementById('termAdd').click()`); await choose(ui, 'Terminal');
    await waitFor(() => ui(`document.querySelector('.dictation .mic').disabled`));
    n = await keys();
    ctrl(page, 'keyDown'); ctrl(page, 'keyUp');
    await recording(n);
    assert.equal(await ui(`document.querySelector('.termtab.active .title').textContent`), 'bash');
    ctrl(page, 'keyDown'); ctrl(page, 'keyUp');
    await stopped('shell in front');
    const human = shell.task.terminal('Terminal') as TaskTerminal;
    await ui(`document.querySelector('.termtab[data-id="${human.id}"] .x').click()`);
    await waitFor(() => shell.task.terminals.size === 1);
    // The human's own key instead (Keyboard Shortcuts: Change, then the key): one that types is refused, saying so; the
    // row, the tooltip and settings.json have the new one, which works at once; the old one is the usual key again.
    await ui(`document.getElementById('windowMenu').click()`); await choose(ui, 'Keyboard Shortcuts');
    await waitFor(() => ui(`(document.getElementById('shortcuts')?.dataset.state === 'open')`));
    const hold = `[...document.querySelectorAll('#shortcuts dt')].find((d) => d.textContent === 'Speak to the agent: hold, or press once and again').nextElementSibling`;
    const shown = () => ui(`[...${hold}.querySelectorAll('kbd')].map((k) => k.textContent)`);
    assert.deepEqual(await shown(), [name]);
    await ui(`${hold}.querySelector('.change').click()`);
    assert.deepEqual(await shown(), ['Press a key…']);
    press(win, 'A');
    await waitFor(() => ui(`!!document.querySelector('#shortcuts .error')`));
    assert.match(await ui(`document.querySelector('#shortcuts .error').textContent`), /^Press a key that types nothing/);
    assert.deepEqual(await shown(), [name]);
    await ui(`${hold}.querySelector('.change').click()`);
    press(win, 'F9');
    await waitFor(async () => JSON.stringify(await shown()) === '["F9"]');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8')).keys, { 'voice.hold': 'F9' });
    await ui(`document.querySelector('#shortcuts .x').click()`);
    await waitFor(() => ui(`document.querySelector('.dictation .mic').title.includes('hold F9 anywhere')`));
    n = await keys();
    page.focus();
    await waitFor(() => page.isFocused());
    press(page, 'F9');
    await recording(n);
    press(page, 'F9');
    await stopped('F9');
    ctrl(page, 'keyDown'); ctrl(page, 'keyUp');
    await sleep(200);
    assert.equal(await lit(), 'false', `the ${name} is a modifier again`);
  });
  test("the island: its terminals in tabs over them, one shown, the row apart; + opens the human's shell in front; the agent runs what keeps running in a shell of its own, behind, reads it, stops it, closes it, never in an agent's tab; × and a shell's exit close one", async ({ shell, ui, call, instructions }) => {
    const task = shell.task;
    const tabs = () => ui(`[...document.querySelectorAll('.termtab')].map((t) => t.querySelector('.title').textContent + (t.classList.contains('active') ? ' *' : ''))`);
    const shown = () => ui(`[...document.querySelectorAll('.terminals .term')].filter((t) => !t.hidden).length`);
    const color = (sel: string) => ui(`getComputedStyle(document.querySelector(${JSON.stringify(sel)})).backgroundColor`);
    assert.match(await instructions(), /terminal_run, not in your own shell.*This is the Kulisa task "task-1", working right in the project's folder .* \(no git, so no worktree of its own\)\. Run the app under test on a free port you pick \(Kulisa assigns none\).*Name the task with task_rename once you know what it is about, silently: never ask the human for a name or mention it\. These notes are for you/s);
    assert.deepEqual(await tabs(), ['bash *'], "the agent's tab, named after its agent");
    // The row is apart from the terminal, as a pane's tabs from its toolbar: the row in a pane's tabs' color, the tab in
    // front in the terminal's, as a pane's active tab in its toolbar's.
    const row = '.dv-groupview:has(.termtabs) .dv-tabs-and-actions-container';
    assert.notEqual(await color(row), await color('.terminals'));
    assert.equal(await color('.termtab.active'), await color('.terminals'));
    assert.deepEqual([await color(row), await color('.termtab.active')], [await color('.pane .tabs'), await color('.pane .tab.active')]);
    // + is the island's, not a tab's: its menu has the project's agents (none here) and Terminal.
    await ui(`window.__grew = []; new MutationObserver((m) => window.__grew.push(...m.map((x) => x.target.dataset.id)))
      .observe(document.querySelector('.termtabs nav'), { subtree: true, attributeFilter: ['data-opening'] })`);
    await ui(`document.getElementById('termAdd').click()`);
    assert.deepEqual(await menuRows(ui), ['Terminal']);
    await choose(ui, 'Terminal');
    await waitFor(async () => JSON.stringify(await tabs()) === '["bash","Terminal *"]');
    // The new tab grows in, as a pane's (lib/strip.ts), and is left grown.
    await waitFor(() => ui(`window.__grew.length === 2 && !document.querySelector('.termtab[data-opening]')`));
    const human = task.terminal('Terminal') as TaskTerminal;
    assert.equal(human.by, 'human');
    // A shell in front: no dictation (it is the shown agent's), the bar kept, its microphone disabled saying why; a pick
    // still goes to the agent shown last.
    await waitFor(() => ui(`document.querySelector('.dictation .mic').disabled`));
    assert.equal(await ui(`document.querySelector('.dictation .mic').title`), "Dictation is the agent's: a shell is in front");
    assert.equal(task.promptTarget().agent.cli, 'bash');
    await waitFor(async () => (await shown()) === 1 && ui(`window.__term === window.__term && document.activeElement.closest('.term') !== null`));

    // The agent's: its environment (KULISA_TASK), behind (the human watches what is in front), read back as plain text.
    assert.match((await call('terminal_run', { name: 'dev server', command: 'echo "ready in $KULISA_TASK"; sleep 30' })).text, /^Started in terminal "dev server"/);
    const dev = task.terminal('dev server') as TaskTerminal;
    await waitFor(async () => (await call('terminal_read', { name: 'dev server' })).text.includes('ready in task-1'));
    assert.deepEqual(await tabs(), ['bash', 'Terminal *', 'dev server'], 'behind');
    assert.equal(await shown(), 1);
    // Laid out while behind, it does not make the window scrollable: the agent's state on its tab (the tasks' bar brings
    // its tab into view) had moved the grid up by a window's height.
    await ui(`document.querySelector('#projectTabs > *').scrollIntoView()`);
    assert.deepEqual(await ui(`[document.documentElement.scrollTop, document.documentElement.scrollHeight <= innerHeight]`), [0, true]);
    assert.equal((await call('terminal_read', {})).text, `"Terminal" (the human's)\n"dev server" (an agent's): echo "ready in $KULISA_TASK"; sleep 30`);
    await assert.rejects(call('terminal_stop', { name: 'nope' }), /no terminal "nope"; open now: "Terminal", "dev server"/);
    // An agent's tab is no terminal to run in, read or stop: a command there would be a message to that agent.
    for (const [tool, args] of [['terminal_run', { command: 'hi' }], ['terminal_read', {}], ['terminal_stop', { close: true }]] as const) {
      await assert.rejects(call(tool, { name: 'bash', ...args }), /"bash" is an agent's tab, not a terminal to run in: read what it did in task_history/);
    }
    assert.deepEqual(await tabs(), ['bash', 'Terminal *', 'dev server']);
    // More than fit (36 terminals): the row scrolls, its end faded; each tab its name whole; + and the microphone at its
    // end stay in the island, not cut off past it; its tabs do not shrink to no name.
    await ui(`(() => { const n = document.querySelector('.termtabs nav'); for (let i = 0; i < 40; i++) n.append(n.querySelector('.termtab').cloneNode(true)); })()`);
    await waitFor(() => ui(`document.querySelector('.termtabs nav').matches('.past-start, .past-end')`));
    assert.deepEqual(await ui(`(() => { const n = document.querySelector('.termtabs nav'), island = n.closest('.dv-groupview').getBoundingClientRect(), r = (q) => document.querySelector(q).getBoundingClientRect();
      return [n.scrollWidth > n.clientWidth, [...n.querySelectorAll('.name')].every((x) => x.scrollWidth <= x.clientWidth), r('#termAdd').right <= island.right, r('.termtabs .dictation').right <= island.right]; })()`),
      [true, true, true, true]);
    await ui(`document.querySelectorAll('.termtabs .termtab').forEach((t, i) => { if (i >= 3) t.remove(); })`);
    // Stopped: Ctrl+C, the shell stays; the same name again types into it.
    await call('terminal_stop', { name: 'dev server' });
    await waitFor(async () => (await call('terminal_read', { name: 'dev server', lines: 3 })).text.includes('^C'));
    assert.match((await call('terminal_run', { name: 'Dev Server', command: 'echo again' })).text, /^Typed into terminal "dev server"/);
    await waitFor(async () => /^again$/m.test((await call('terminal_read', { name: 'dev server' })).text));
    // Read as the screen shows it: lines a program redraws in place (a progress, a container's state) are what they
    // became. Read from the output with its codes left out, every frame was there, and filled the lines asked for.
    await call('terminal_run', { name: 'dev server', command: String.raw`printf 'bundle 30%%\nwrite\n\033[2A\033[2Kbundle done\n\033[2Kwritten\n'` });
    await waitFor(async () => /^written$/m.test((await call('terminal_read', { name: 'dev server' })).text));
    assert.doesNotMatch((await call('terminal_read', { name: 'dev server' })).text, /^(bundle 30%|write)$/m);
    // A click on a tab brings it to the front.
    await click(ui, `document.querySelector('.termtab[data-id="${dev.id}"]')`);
    await waitFor(async () => JSON.stringify(await tabs()) === '["bash","Terminal","dev server *"]');
    // Closed by the agent: its tab and its process go; the tab next to it comes to the front.
    const pid = dev.pty.pid;
    await call('terminal_stop', { name: 'dev server', close: true });
    await waitFor(async () => JSON.stringify(await tabs()) === '["bash","Terminal *"]');
    await waitFor(() => { try { process.kill(pid, 0); return false; } catch { return true; } });
    // A shell that exits closes its terminal; × closes the human's.
    await call('terminal_run', { name: 'once', command: 'exit' });
    await waitFor(() => !!task.terminal('once').error && task.terminals.size === 2);
    await ui(`document.querySelector('.termtab[data-id="${human.id}"] .x').click()`);
    await waitFor(async () => task.terminals.size === 1 && JSON.stringify(await tabs()) === '["bash *"]');
    assert.equal(task.promptTarget().pty, shell.pty, "the agent's in front again, still running");
    await waitFor(() => ui(`!document.querySelector('.dictation .mic').disabled`));
  });
  test("the window's page is sandboxed (no Node in it), its bridge to the main process works", async ({ shell, ui }) => {
    assert.equal(await noNode(shell.win.webContents), true);
    assert.equal(await ui('kulisa.platform'), process.platform);
  });
  test('one Kulisa per data folder: a second one started on the same data shows the first one\'s window and goes', async ({ shell }) => {
    // The groups' apps run side by side, each on a folder of its own: another folder is no second one.
    const win = shell.windows[0].win;
    win.minimize();
    await waitFor(() => win.isMinimized());
    const second = spawn(process.execPath, [...(process.platform === 'linux' ? ['--no-sandbox'] : []), path.join(import.meta.dirname, '..', 'src', 'main', 'index.ts')],
      { env: { ...process.env, KULISA_DATA: userData, KULISA_MCP_PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    second.stdout.on('data', (d) => (out += d));
    const timer = setTimeout(() => second.kill('SIGINT'), 10000); // one that stays is stopped, not left behind
    const code = await new Promise((r) => second.on('close', r));
    clearTimeout(timer);
    assert.equal(code, 0);
    assert.match(out, /already running with .*: its window is shown/);
    await waitFor(() => !win.isMinimized());
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
  test('the app icon: in the top bar (not on macOS: the Dock\'s), and every file the window and the installers use', async ({ ui }) => {
    const img = await ui(`(() => { const i = document.querySelector('#topbar svg.logo'); const r = i?.getBoundingClientRect(); return i && { w: r.width, h: r.height, drawn: !!i.querySelector('use[href="#i-logo"]'),
      drape: getComputedStyle(i).color, project: getComputedStyle(document.documentElement).getPropertyValue('--project') }; })()`);
    if (process.platform === 'darwin') assert.equal(img, null, 'macOS apps show their icon in the Dock, not by the window buttons');
    else {
      assert.ok(img && img.drawn && img.w >= 16 && img.h >= 16, JSON.stringify(img));
      assert.equal(img.drape, 'rgb(74, 123, 208)', "the curtain is in the project's color (#4a7bd0, the first one)");
    }
    const files = [forge.packagerConfig.icon + '.png', forge.packagerConfig.icon + '.ico', forge.packagerConfig.icon + '.icns',
      ...(forge.makers as { config?: { setupIcon?: string; icon?: string; options?: { icon?: string } } }[]).flatMap((m) => [m.config?.setupIcon, m.config?.icon, m.config?.options?.icon]).filter(Boolean)];
    for (const f of files) assert.ok(fs.statSync(path.join(import.meta.dirname, '..', f)).size > 1000, f);
    assert.equal(files.length, 7); // the .rpm's too
  });
  test('one row on top: no menu bar, OS window buttons over the top bar; on macOS the system\'s, Settings… (⌘,) in it', async (ctx) => {
    const { shell, ui } = ctx;
    // macOS: the menu bar is the system's, at the screen's top, always there: Kulisa's own there (app.ts), Settings… in
    // its app menu as Mac apps have it.
    if (process.platform === 'darwin') {
      const menu = Menu.getApplicationMenu();
      assert.deepEqual(menu.items.map((i) => i.role), ['appmenu', 'editmenu', 'windowmenu']);
      const item = menu.items[0].submenu.items.find((i) => i.label === 'Settings…');
      assert.equal(item?.accelerator, 'Command+,');
      item.click(undefined, shell.win);
      await waitFor(() => ctx.sui(`!!document.getElementById('pjlist')`));
      await closeSettings(ctx);
    } else assert.equal(shell.win.isMenuBarVisible(), false);
    assert.equal(await ui(`navigator.windowControlsOverlay.visible`), true);
    const bar = await ui(`(() => { const r = document.getElementById('topbar').getBoundingClientRect(); return { top: r.top, height: r.height, right: r.right }; })()`);
    const controls = await ui(`(() => { const r = navigator.windowControlsOverlay.getTitlebarAreaRect(); return { x: r.x, width: r.width }; })()`);
    assert.equal(bar.top, 0);
    assert.equal(bar.height, 44);
    assert.ok(bar.right <= controls.x + controls.width, 'the bar ends where the window buttons begin');
  });
  test("a right-click on the title bar opens no window menu on Linux: GNOME's froze the desktop", async ({ shell }) => {
    if (process.platform !== 'linux') return;
    const e = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    shell.win.emit('system-context-menu', e, { x: 10, y: 10 });
    assert.equal(e.defaultPrevented, true);
  });
  test('UI text is not selectable by dragging, as in a desktop app; fields are; the arrow over buttons', async ({ ui }) => {
    const sel = await ui(`(() => { const us = (q) => getComputedStyle(document.querySelector(q)).userSelect;
      return { button: us('#newTask'), name: us('.tasktab .name'), tab: us('.tab .title'), header: us('.ptab'), field: us('.addr') }; })()`);
    assert.deepEqual(sel, { button: 'none', name: 'none', tab: 'none', header: 'none', field: 'text' });
    // The arrow over buttons and tabs, as in Chrome, not a web page's hand.
    assert.deepEqual(await ui(`['#newTask', '.tasktab', '.tab', '.tabs .add', '.bar .back', '.ptab .close', '#windowMenu'].map((q) => getComputedStyle(document.querySelector(q)).cursor)`),
      ['default', 'default', 'default', 'default', 'default', 'default', 'default']);
  });
  test('screenshot of the whole window, profile views included', async ({ shell }) => {
    if (!canShoot()) return console.log(`      (skipped: ${NO_SHOT})`);
    await waitFor(() => [...shell.profiles.values()][0].get().view.getVisible());
    const file = path.join(root, 'window.png');
    await shell.screenshot(file);
    const png = fs.readFileSync(file);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.ok(png.length > 10000, `${png.length} bytes`);
  });
  test('the OS buttons\' strip shows the top bar under it: dimmed with it under a dialog', async ({ shell, ui }) => {
    if (process.platform === 'darwin') return console.log('      (skipped: macOS draws no strip under its buttons)');
    if (!canShoot()) return console.log(`      (skipped: ${NO_SHOT})`);
    // The strip's first pixel and the top bar's just left of it, in the screenshot (the strip is the OS's, not the page's).
    const { x, y } = await ui(`(() => { const r = navigator.windowControlsOverlay.getTitlebarAreaRect(); return { x: r.right * devicePixelRatio, y: 2 * devicePixelRatio }; })()`);
    const pixels = async (name: string) => {
      const file = path.join(root, name);
      await shell.screenshot(file);
      const img = electron.nativeImage.createFromPath(file), { width } = img.getSize(), bgra = img.toBitmap();
      const at = (px: number) => [...bgra.subarray((y * width + px) * 4, (y * width + px) * 4 + 3)];
      return { bar: at(Math.round(x) - 3), strip: at(Math.round(x) + 3) };
    };
    const near = ({ bar, strip }: { bar: number[]; strip: number[] }) => bar.every((c, i) => Math.abs(c - strip[i]) <= 2);
    const plain = await pixels('buttons.png');
    assert.ok(near(plain), `the strip as the bar: ${JSON.stringify(plain)}`);
    await ui(`document.getElementById('windowMenu').click()`); await choose(ui, 'Keyboard Shortcuts');
    await waitFor(() => ui(`(document.getElementById('shortcuts')?.dataset.state === 'open')`));
    let dimmed = plain; // the screen catches up with the page a frame later
    await waitFor(async () => { dimmed = await pixels('buttons-dialog.png'); return dimmed.bar[0] < plain.bar[0]; });
    assert.ok(near(dimmed), `dimmed as the bar: ${JSON.stringify(dimmed)}`);
    await ui(`document.querySelector('#shortcuts .x').click()`);
    await waitFor(() => ui(`!document.getElementById('shortcuts')`));
  });
  test('theme: Dark by default, Light or System in ☰; the window, the terminal and the OS buttons follow, the pages keep the OS\'s; saved', async ({ shell, ui }) => {
    // What is shown: a panel's color, the terminal's (a pane's toolbar's); the controls' own scheme (color-scheme).
    const DARK = 'rgb(30, 31, 34)', LIGHT = 'rgb(255, 255, 255)', TERM = { dark: 'rgb(47, 49, 53)', light: 'rgb(242, 243, 245)' };
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
    assert.deepEqual(await look(), { shade: 'dark', term: TERM.dark, scheme: 'dark', chosen: ['dark'], onAccent: LIGHT });
    const choose = async (t: string, shade: string) => {
      await ui(`document.querySelector('.menu[data-state="open"] .themerow [data-theme="${t}"]').click()`);
      await waitFor(async () => { const l = await look(); return l.shade === shade && l.term === TERM[shade as 'dark' | 'light'] && l.chosen[0] === t; });
      assert.equal(await menuOpen(ui), true, 'the menu stays open: the next one can be tried');
      assert.equal(settings(), t, 'saved');
    };
    await choose('light', 'light');
    assert.deepEqual(await look(), { shade: 'light', term: TERM.light, scheme: 'light', chosen: ['light'], onAccent: LIGHT });
    assert.equal(await pageDark(), osDark, "a site under test keeps the OS's scheme");
    await shot(shell, path.join(root, 'light.png'));
    await choose('system', nativeTheme.shouldUseDarkColors ? 'dark' : 'light'); // the OS's, as the pages'
    assert.equal((await look()).scheme, 'light dark');
    await choose('dark', 'dark');
    await shot(shell, path.join(root, 'dark.png'));
    assert.equal(await pageDark(), osDark);
    await closeMenu(ui);
  });
  test('the tasks\' bar: under the grid by default; in the title bar, after the logo, when Top is chosen in ☰; the grid and its pages take the room left; saved', async ({ shell, ui }) => {
    const name = shell.profiles.values().next().value.name;
    // Where the bar is: in the title bar's row between the logo and Settings (top), or under the grid (bottom).
    const where = () => ui(`(() => { const r = (q) => document.querySelector(q).getBoundingClientRect(), bar = r('#taskbar'), grid = r('#dock'), top = r('#topbar');
      const inTitle = bar.top >= top.top && bar.bottom <= top.bottom && bar.left >= (document.querySelector('#topbar .logo') ? r('#topbar .logo').right : top.left) && bar.right <= r('#manageProjects').left;
      return { bar: inTitle ? 'top' : bar.top >= grid.bottom ? 'bottom' : 'elsewhere', drag: getComputedStyle(document.querySelector('#taskbar .tasktab')).appRegion,
        above: Math.round(r('.dv-groupview').top - (inTitle ? r('#taskbar .tasktab') : r('#manageProjects')).bottom), // from the title bar's buttons to the panels; from a tab in it, what the bar's 44 px leave under a 36 px tab
        edge: Math.round(grid.top - top.bottom), // the grid starts at the title bar's edge: it holds the gap itself
        over: inTitle ? Math.round(r('#taskbar .tasktab').top - top.top) : 8, // from the window's top to a tab: as under it
        // ☰ a gap from the title bar area's end (the OS buttons, or the window's edge on macOS, where the area starts after them)
        end: (({ x, width }) => Math.round(x + width - r('#windowMenu').right))(navigator.windowControlsOverlay.getTitlebarAreaRect()),
        title: Math.round(top.height), tall: Math.round(r('#taskbar .tasktab').height), // the title bar keeps its height, a tab its own
        below: Math.round(innerHeight - (inTitle ? grid : bar).bottom), between: inTitle ? 8 : Math.round(bar.top - grid.bottom), // the window's rows --gap apart (App.vue)
        rows: getComputedStyle(document.body).gridTemplateRows.split(' ').map((px, i) => (i === 1 ? 'grid' : Math.round(parseFloat(px)))), // no row but the title bar, the grid and the bar (a tab and its gap from the grid)
        // The logo, the buttons and the tabs in the middle of its height
        level: !inTitle || !document.querySelector('#topbar .logo') || Math.abs((r('#topbar .logo').top + r('#topbar .logo').bottom) - (r('#taskbar .tasktab').top + r('#taskbar .tasktab').bottom)) < 2,
        chosen: [...document.querySelectorAll('.menu[data-state="open"] .barrow [data-state="checked"]')].map((b) => b.dataset.bar) }; })()`);
    const saved = () => JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8')).bar;
    assert.equal((await where()).bar, 'bottom');
    for (const bar of ['top', 'bottom']) {
      await ui(`document.getElementById('windowMenu').click()`);
      await menuRows(ui);
      await ui(`document.querySelector('.menu[data-state="open"] .barrow [data-bar="${bar}"]').click()`);
      await waitFor(async () => (await where()).bar === bar && saved() === bar);
      assert.deepEqual(await where(), { bar, drag: bar === 'top' ? 'no-drag' : 'none', above: bar === 'top' ? 4 : 8, over: bar === 'top' ? 4 : 8, end: 8, title: 44, below: 8, between: 8, edge: 0, rows: bar === 'top' ? [44, 'grid', 0] : [44, 'grid', 36 + 8], level: true, tall: 36, chosen: [bar] }, 'one gap: over what is in the title bar and from it to the panels, from the grid to the bar and under it; in the title bar the tabs do not drag the window');
      assert.equal(await menuOpen(ui), true, 'the menu stays open: the other one can be tried');
      await closeMenu(ui);
      await waitFor(() => viewOn(shell, ui, name), 3000); // the pages follow the grid
    }
  });
  test('dialogs: one look (title and ×, content, buttons at the bottom right, the main one last), in the page only while open; a question is asked in it', async (ctx) => {
    const { shell, ui } = ctx;
    // Each opened as the human opens it, looked at, closed: a closed one leaves nothing in the page (no memory kept).
    const isOpen = (id: string) => ui(`document.getElementById('${id}')?.dataset.state === 'open'`);
    const fromMenu = async (row: string, at?: string) => { await (at ? rightClick(ui, at) : ui(`document.getElementById('windowMenu').click()`)); await menuRows(ui); await choose(ui, row); };
    const openers = {
      taskrename: () => fromMenu('Rename…', '#projectTabs .tasktab .name'),
      agentpick: async () => { void shell.chooseAgent(shell.task, null); }, // asked when a task's agent is not there
      shortcuts: () => fromMenu('Keyboard Shortcuts'),
    };

    assert.equal(await ui(`document.querySelectorAll('.dialog').length`), 0, 'none in the page while closed');
    for (const [id, open] of Object.entries(openers)) {
      await open();
      await waitFor(() => isOpen(id), 20000);
      const l = await ui(`(() => { const d = document.getElementById('${id}'); return { id: '${id}', title: !!d.querySelector('header h2'),
        body: !!d.querySelector('.body'), footer: !!d.querySelector('footer'), last: d.querySelector('footer > button:last-child')?.className }; })()`);
      assert.ok(l.title && l.body && /primary|ok/.test(l.last), JSON.stringify(l));
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
    // Its buttons answer the hand: lit under the pointer, another color while pressed (still, they look dead).
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
  test("About Kulisa (☰; on macOS the app menu's) is a page of Settings: the versions, and the folders Kulisa writes in on this computer, each shown in the file manager, one not made yet told so", async (ctx) => {
    const { shell, ui, sui } = ctx;
    const pkg = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'package.json'), 'utf8'));
    if (process.platform === 'darwin') {
      const item = Menu.getApplicationMenu().items[0].submenu.items[0];
      assert.equal(item.label, 'About Kulisa', "first in the app menu, where Mac apps have it");
      item.click(undefined, shell.win);
    } else {
      await ui(`document.getElementById('windowMenu').click()`);
      await menuRows(ui);
      await choose(ui, 'About Kulisa');
    }
    const shown = () => sui(`document.querySelector('#pjlist [data-page="about"]')?.ariaSelected === 'true' && document.getElementById('abconfig').checkVisibility() && !!document.querySelector('#aboutpage .who')`);
    await waitFor(shown);
    assert.equal(shell.settings.win.getTitle(), 'Settings — Kulisa', 'a page of Settings, as Chrome\'s About');
    const a = await sui(`(() => { const d = document.getElementById('aboutpage'); return { title: d.querySelector('.who h3').textContent, line: [...d.querySelectorAll('.who .hint')].map((p) => p.textContent).join(' / '),
      folders: [...d.querySelectorAll('.paths dd')].map((dd) => ({ id: dd.dataset.folder, path: dd.querySelector('.path').textContent, missing: dd.classList.contains('missing'), disabled: dd.querySelector('.show').disabled })) }; })()`);
    assert.equal(a.title, `Kulisa ${pkg.version}`);
    assert.equal(a.line, `Electron ${process.versions.electron} · Chromium ${process.versions.chrome} / kulisa.app · GPL-3.0-or-later`);
    const projectsHome = path.join(root, 'KulisaProjects'), made = fs.existsSync(projectsHome);
    assert.deepEqual(a.folders, [{ id: 'data', path: userData, missing: false, disabled: false }, { id: 'projects', path: projectsHome, missing: !made, disabled: !made },
      { id: 'program', path: path.join(import.meta.dirname, '..'), missing: false, disabled: false }]);
    // Show: the folder in the file manager, by its id (the window names no path).
    const openPath = electron.shell.openPath, shownDirs: string[] = [];
    electron.shell.openPath = async (dir) => { shownDirs.push(dir); return ''; };
    try {
      await sui(`document.querySelector('#aboutpage dd[data-folder="data"] .show').click()`);
      await waitFor(() => shownDirs.length === 1);
    } finally { electron.shell.openPath = openPath; }
    assert.deepEqual(shownDirs, [userData]);
    await closeSettings(ctx);
    // The main process opens it too (macOS's menu, whichever OS): the same window at that page.
    shell.openSettings({ section: 'about', id: null });
    await waitFor(shown);
    await closeSettings(ctx);
  });
  // The app archive the test's Kulisa watches (run.ts, installed) replaced as apt does: a new one written beside and
  // renamed over. The archive made as Forge packs it (@electron/asar).
  test('a new version installed while Kulisa runs is offered once, in its own dialog: Later leaves it to the next start, Restart saves everything and starts it', async (ctx) => {
    const { shell, ui } = ctx;
    const asar = path.join(root, 'installed', 'app.asar'), src = path.join(root, 'installed-src');
    const install = async (version: string) => {
      fs.mkdirSync(src, { recursive: true }); fs.mkdirSync(path.dirname(asar), { recursive: true });
      fs.writeFileSync(path.join(src, 'package.json'), JSON.stringify({ name: 'kulisa', version }));
      await createPackage(src, `${asar}.dpkg-new`);
      fs.renameSync(`${asar}.dpkg-new`, asar);
    };
    const open = () => ui(`document.getElementById('ask')?.dataset.state === 'open'`);
    const restart = shell.restart;
    let restarted: string | null = null;
    shell.restart = async (apply) => { restarted = apply ? 'squirrel' : 'relaunch'; };
    try {
      ctx.answer = false; // Later
      await install('9.9.9');
      await waitFor(() => ctx.asked.some((q) => q.message === 'Kulisa 9.9.9 is ready'), 10000);
      const q = ctx.asked.pop();
      assert.equal(q.ok, 'Restart'); assert.equal(q.cancel, 'Later');
      assert.match(q.detail, /Restart to use it: the windows, their tasks and conversations come back\. Later: the next start is 9\.9\.9\.$/);
      await waitFor(async () => !(await open()));
      assert.equal(restarted, null, 'Later: nothing');
      // Restart: the way to quit that keeps everything, then the new version (the test's Kulisa stays: a stub).
      ctx.answer = true;
      await install('9.9.10');
      await waitFor(() => restarted, 10000);
      assert.equal(restarted, 'relaunch');
      assert.equal(ctx.asked.pop().message, 'Kulisa 9.9.10 is ready');
    } finally {
      shell.restart = restart; ctx.answer = true;
      fs.rmSync(src, { recursive: true, force: true });
    }
  });
};
