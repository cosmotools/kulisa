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
    if (process.platform === 'darwin') {
      // The menu is in the system bar: Edit for Cmd+C/V, no View (its Cmd+R would reload Kulisa's own page).
      const roles = (items) => items.flatMap((i) => [i.role, ...(i.submenu ? roles(i.submenu.items) : [])]).filter(Boolean).map((r) => r.toLowerCase());
      const all = roles(require('electron').Menu.getApplicationMenu().items);
      assert.ok(['copy', 'paste', 'selectall', 'quit'].every((r) => all.includes(r)), all.join(' '));
      assert.ok(!['reload', 'forcereload', 'toggledevtools'].some((r) => all.includes(r)), all.join(' '));
    } else assert.equal(shell.win.isMenuBarVisible(), false);
    assert.equal(await ui(`navigator.windowControlsOverlay.visible`), true);
    const bar = await ui(`(() => { const r = document.getElementById('topbar').getBoundingClientRect(); return { top: r.top, height: r.height, right: r.right }; })()`);
    const controls = await ui(`(() => { const r = navigator.windowControlsOverlay.getTitlebarAreaRect(); return { x: r.x, width: r.width }; })()`);
    assert.equal(bar.top, 0);
    assert.equal(bar.height, 44);
    assert.ok(bar.right <= controls.x + controls.width, 'the bar ends where the window buttons begin');
  });
  test('UI text is not selectable by dragging, as in a desktop app; fields are', async ({ ui }) => {
    const sel = await ui(`(() => { const us = (q) => getComputedStyle(document.querySelector(q)).userSelect;
      return { button: us('#openProjects'), name: us('#projectName'), tab: us('.tab .title'), header: us('.ptab'), field: us('.addr') }; })()`);
    assert.deepEqual(sel, { button: 'none', name: 'none', tab: 'none', header: 'none', field: 'text' });
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
};
