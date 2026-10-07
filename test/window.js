// The window: the terminal, the app icon, the top bar, screenshots.
const fs = require('fs');
const path = require('path');
const { assert, root, userData, project, pfile, savedTabs, panel, SITE, sleep, waitFor, who, menuRows, choose, manageProfiles, menuOpen, rightClick,
  box, pageBox, viewOn, dock, ctrl, near } = require('./helpers');

module.exports = (test) => {
  test('the agent starts at the terminal\'s real size, not a default one', async ({ shell, ui }) => {
    // Claude Code draws its prompt for the size it starts with and does not fully redraw on the first resize.
    const first = await ui(`window.__ptySizes[0]`);
    assert.deepEqual(shell.pty.spawnSize, first);
    assert.ok(first.rows >= 10 && first.cols >= 80, `a real size: ${JSON.stringify(first)}`);
  });
  test('terminal: Unicode 11 widths (cursor stays put after emoji), bundled font, GPU renderer', async ({ ui }) => {
    // Claude Code draws ✅, ⏵, ✻…; with Unicode 6 widths xterm puts the cursor one cell off after each wide one.
    const x = await ui(`new Promise((r) => window.__term.write('\\r\\n✅🙂x', () => r(window.__term.buffer.active.cursorX)))`);
    assert.equal(x, 5);
    assert.equal(await ui(`document.fonts.check(window.__term.options.fontSize + 'px "JetBrains Mono"')`), true);
    assert.equal(await ui(`window.__term.options.fontSize`), await ui(`parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font'))`), 'the terminal uses the UI text size');
    assert.equal(await ui(`window.__term.options.fontFamily.startsWith('"JetBrains Mono"')`), true);
    assert.equal(await ui(`window.__termRenderer`), 'webgl');
  });
  test('icons: each from the sprite (docs/ui.md), drawn there once and in lines of the text\'s color; icon buttons have a name', async ({ ui }) => {
    const r = await ui(`(() => {
      const every = (q) => [...document.querySelectorAll(q), ...[...document.querySelectorAll('template')].flatMap((t) => [...t.content.querySelectorAll(q)])];
      const ids = [...document.querySelectorAll('svg[hidden] > symbol')].map((s) => s.id);
      const icons = every('svg').filter((s) => !s.closest('svg[hidden], .arrange') && !s.matches('.logo')); // pictures, not icons
      const add = document.querySelector('.pane .add svg');
      return { ids: ids.length === new Set(ids).size, drawnInPlace: icons.filter((s) => !s.querySelector(':scope > use')).length,
        unknown: icons.map((s) => s.querySelector('use')?.getAttribute('href')).filter((h) => h && !ids.includes(h.slice(1))),
        unnamed: every('.icon').filter((b) => !b.getAttribute('aria-label') && !b.title).map((b) => b.className),
        lines: [getComputedStyle(add).fill, getComputedStyle(add).stroke === getComputedStyle(add.closest('button')).color],
        sprite: document.querySelector('svg[hidden]').getBoundingClientRect().height }; // takes no room
    })()`);
    assert.deepEqual(r, { ids: true, drawnInPlace: 0, unknown: [], unnamed: [], lines: ['none', true], sprite: 0 });
  });
  test('the app icon: in the top bar, and every file the window and the installers use', async ({ ui }) => {
    const img = await ui(`(() => { const i = document.querySelector('#topbar svg.logo'); return i && { w: i.viewBox.baseVal.width, h: i.getBoundingClientRect().height,
      drape: getComputedStyle(i.querySelector('stop.lit')).stopColor, project: getComputedStyle(document.documentElement).getPropertyValue('--project') }; })()`);
    assert.ok(img && img.w > 0 && img.h >= 16, JSON.stringify(img));
    assert.equal(img.drape, 'rgb(74, 123, 208)', "the curtain is in the project's color (#4a7bd0, the first one)");
    const forge = require('../forge.config.js');
    const files = [forge.packagerConfig.icon + '.png', forge.packagerConfig.icon + '.ico', forge.packagerConfig.icon + '.icns',
      ...forge.makers.flatMap((m) => [m.config?.setupIcon, m.config?.icon, m.config?.options?.icon]).filter(Boolean)];
    for (const f of files) assert.ok(fs.statSync(path.join(__dirname, '..', f)).size > 1000, f);
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
      return { button: us('#openProjects'), name: us('.projecttab .name'), tab: us('.tab .title'), header: us('.ptab'), field: us('.addr') }; })()`);
    assert.deepEqual(sel, { button: 'none', name: 'none', tab: 'none', header: 'none', field: 'text' });
    // The arrow over buttons and tabs, as in Chrome, not a web page's hand.
    assert.deepEqual(await ui(`['#openProjects', '.projecttab', '.tab', '.tabs .add', '.bar .back', '.ptab .close', '#windowMenu'].map((q) => getComputedStyle(document.querySelector(q)).cursor)`),
      ['default', 'default', 'default', 'default', 'default', 'default', 'default']);
  });
  test('screenshot of the whole window, profile views included', async ({ shell, ui }) => {
    await manageProfiles(ui);
    await sleep(300);
    await shell.screenshot(path.join(root, 'editor.png'));
    await ui(`document.getElementById('closeProfiles').click()`);
    await sleep(300);
    const file = path.join(root, 'window.png');
    await shell.screenshot(file);
    const png = fs.readFileSync(file);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.ok(png.length > 10000, `${png.length} bytes`);
  });
  test('theme: Dark by default, Light or System in ☰; the window, the terminal and the OS buttons follow, the pages keep the OS\'s; saved', async ({ shell, ui }) => {
    const { nativeTheme } = require('electron');
    // What is shown: a panel's color, the terminal's; the controls' own scheme (color-scheme).
    const DARK = 'rgb(30, 31, 34)', LIGHT = 'rgb(255, 255, 255)';
    const look = () => ui(`(() => { const panel = getComputedStyle(document.querySelector('.dv-groupview')).backgroundColor;
      return { shade: panel === '${DARK}' ? 'dark' : panel === '${LIGHT}' ? 'light' : panel, term: window.__term.options.theme.background,
        scheme: getComputedStyle(document.querySelector('.omnibox input, input')).colorScheme,
        chosen: [...document.querySelectorAll('#menu .themerow [aria-pressed="true"]')].map((b) => b.dataset.theme),
        onAccent: getComputedStyle(document.querySelector('button.primary')).color }; })()`);
    const page = shell.profiles.values().next().value.get().wc;
    const pageDark = () => page.executeJavaScript(`matchMedia('(prefers-color-scheme: dark)').matches`);
    const osDark = await pageDark();
    const settings = () => JSON.parse(fs.readFileSync(path.join(userData, 'settings.json'), 'utf8')).theme;
    await ui(`document.getElementById('windowMenu').click()`);
    assert.deepEqual((await menuRows(ui)).slice(0, 2), ['zoom', 'theme']);
    assert.deepEqual(await look(), { shade: 'dark', term: DARK, scheme: 'dark', chosen: ['dark'], onAccent: LIGHT });
    const choose = async (t, shade) => {
      await ui(`document.querySelector('#menu .themerow [data-theme="${t}"]').click()`);
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
    await ui(`document.getElementById('menu').hidePopover()`);
  });
  test('dialogs: one look (title and ×, content, buttons at the bottom right, the main one last); a question is asked in it', async (ctx) => {
    const { shell, ui } = ctx;
    const looks = await ui(`[...document.querySelectorAll('dialog')].map((d) => ({ id: d.id, title: !!d.querySelector('header h2'),
      body: !!d.querySelector('.body'), last: d.querySelector('footer > button:last-child')?.className }))`);
    assert.deepEqual(looks.map((l) => l.id), ['profiles', 'newproject', 'wsnew', 'agentpick', 'agents', 'ask']);
    for (const l of looks) assert.ok(l.title && l.body && /primary|ok/.test(l.last), JSON.stringify(l));

    // A question before deleting: the title, what goes line by line, Cancel (focused) and a red Delete at the right.
    ctx.answer = null; // the test answers
    const view = () => [...shell.profiles.values()][0].get().view.getVisible();
    const open = () => ui(`document.getElementById('ask').open`);
    let answer = shell.ask({ message: 'Delete the thing?', ok: 'Delete', danger: true, detail: 'Deleted for good:\n• a\n• b' });
    await waitFor(open);
    const q = await ui(`(() => { const d = document.getElementById('ask'), r = (q) => d.querySelector(q).getBoundingClientRect(), ok = d.querySelector('.ok');
      return { title: d.querySelector('h2').textContent, lines: d.querySelector('.detail').innerText.split('\\n').length, ok: ok.textContent,
        order: r('header').bottom <= r('.body').top && r('.body').bottom <= r('footer').top, right: Math.round(r('footer').right - ok.getBoundingClientRect().right),
        focused: document.activeElement.textContent }; })()`);
    assert.deepEqual(q, { title: 'Delete the thing?', lines: 3, ok: 'Delete', order: true, right: 18, focused: 'Cancel' });
    assert.equal(await ui(`getComputedStyle(document.querySelector('#ask .ok')).backgroundColor`), 'rgb(201, 79, 79)', 'red');
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
    await ui(`document.querySelector('#ask button[value=""]').click()`);
    assert.equal(await second, false, 'Cancel says no');
    ctx.answer = true;
  });
};
