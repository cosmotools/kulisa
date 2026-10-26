// The window: the terminal and its island, dictation, one Kulisa per data folder, the app icon, the top bar, the theme,
// the tasks' bar, dialogs, About, a new version installed, screenshots (docs/window.md).
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createPackage } from '@electron/asar';
import electronPath from 'electron';
import type { Page } from '@playwright/test';
import forge from '../../forge.config.ts';
import type { TaskTerminal } from '../../src/main/tasks.ts';
import type { Question } from '../../src/shared/types.ts';
import { test, expect } from './fixtures.ts';
import type { Core } from './fixtures.ts';
import { termTabs, SITE, CHECKOUT, MAC, WIN, echoed, holdPointer, ipcSettled, menu, menuRows, choose, closeMenu, rightClick, box, viewOn, focusWindow, closeSettings, termText, invoke, removed } from './helpers.ts';

const NO_SHOT = 'macOS: the app that started the tests (the terminal) may not record the screen';

const sam = (core: Core) => core(async (k, url) => (await k.ensureProfile('Sam', url)).id, `${SITE}/app`);
// The terminal named so, once its shell runs: its id and key.
const terminal = async (core: Core, name: string) => {
  await expect.poll(() => core((k, n) => !!(k.shell.task.terminal(n) as TaskTerminal)?.pty, name)).toBe(true);
  return core((k, n) => { const t = k.shell.task.terminal(n) as TaskTerminal; return { id: t.id, key: t.key }; }, name);
};
const terminals = (core: Core) => core((k) => k.shell.task.terminals.size);
const term = (ui: Page) => ui.evaluate(() => {
  const t = (window as any).__term;
  return t && { cols: t.cols as number, rows: t.rows as number };
});
// A second Kulisa (src/main/index.ts) started on a data folder, in the environment of the test's (its screen).
const start = async (core: Core, data: string, env: Record<string, string> = {}) => {
  const base = await core(() => ({ ...process.env }));
  const p = spawn(electronPath as unknown as string, [...(process.platform === 'linux' ? ['--no-sandbox'] : []), path.join(CHECKOUT, 'src', 'main', 'index.ts')],
    { env: { ...base, KULISA_DATA: data, KULISA_MCP_PORT: '0', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  p.stdout.on('data', (d) => (out += d));
  return { p, out: () => out, code: new Promise<number>((r) => p.on('close', r)) };
};

test("the agent starts at the terminal's real size, not a default one", async ({ core, ui }) => {
  // Claude Code draws its prompt for the size it starts with and does not fully redraw on the first resize.
  const shown = await ui.evaluate(() => { const t = (window as any).__term; return { cols: t.cols, rows: t.rows }; });
  expect(await core((k) => k.shell.pty.spawnSize)).toEqual(shown);
  expect(shown.rows >= 10 && shown.cols >= 80, `a real size: ${JSON.stringify(shown)}`).toBe(true);
});

test('terminal: Unicode 11 widths (cursor stays put after emoji), bundled font, GPU renderer, the rows in the middle', async ({ ui }) => {
  // Claude Code draws ✅, ⏵, ✻…; with Unicode 6 widths xterm puts the cursor one cell off after each wide one.
  const x = await ui.evaluate(() => new Promise((r) => (window as any).__term.write('\r\n✅🙂x', () => r((window as any).__term.buffer.active.cursorX))));
  expect(x).toBe(5);
  const font = await ui.evaluate(() => {
    const t = (window as any).__term;
    return { bundled: document.fonts.check(t.options.fontSize + 'px "JetBrains Mono"'), size: t.options.fontSize, ui: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font')),
      family: t.options.fontFamily.startsWith('"JetBrains Mono"'), renderer: (window as any).__termRenderer };
  });
  expect(font.bundled).toBe(true);
  expect(font.size, 'the terminal uses the UI text size').toBe(font.ui);
  expect(font.family).toBe(true);
  expect(font.renderer).toBe('webgl');
  // What is left under a whole row is shared above and below the rows.
  const { above, below } = await ui.evaluate(() => {
    const h = document.querySelector('[data-testid="terminal"] .xterm-host').getBoundingClientRect(), r = document.querySelector('[data-testid="terminal"] .xterm-screen').getBoundingClientRect();
    return { above: r.top - h.top, below: h.bottom - r.bottom };
  });
  expect(Math.abs(above - below) <= 1, `the rows in the middle: ${above} above, ${below} below`).toBe(true);
});

test('terminal: one xterm shows the terminal in front; another shown and back keeps its text, its scroll and the modes serializing leaves out', async ({ core, ui }) => {
  // An xterm each cost its renderer and a WebGL context, of which Chromium keeps 16 a page: the 17th takes the
  // oldest terminal's, which then draws slower for good, silently (src/terminal/README.md).
  const agent = await core((k) => [...k.shell.task.terminals.values()][0].id);
  // Opened as the island's + does, without its menu: a menu's pictures of the pages, put back late on a slow machine,
  // took the keyboard from the page the next test had put it in.
  await ui.evaluate(() => (window as any).act('terminal:open'));
  const sh = await terminal(core, 'Terminal');
  await expect(ui.locator('.xterm'), 'one xterm for both terminals').toHaveCount(1);
  // The mouse in SGR and the cursor hidden, as Claude Code's fullscreen has them: serializing leaves both out.
  const cmd = `node '${path.join(CHECKOUT, 'test', 'fixtures', 'modes.mjs')}'\r`;
  await ui.evaluate((a) => (window as any).kulisa.send('pty:in', a), { task: sh.key, data: cmd });
  const modes = () => ui.evaluate(() => {
    const t = (window as any).__term, c = t._core;
    return { mouse: t.modes.mouseTrackingMode, encoding: c.coreMouseService.activeEncoding, hidden: c.coreService.isCursorHidden };
  });
  const set = { mouse: 'vt200', encoding: 'SGR', hidden: true };
  await expect.poll(async () => (await termText(ui)).includes('shell-marker') && JSON.stringify(await modes()) === JSON.stringify(set)).toBe(true);
  await ui.evaluate(() => (window as any).__term.scrollToLine(5));
  await ui.evaluate((id) => (window as any).act('terminal:show', { id }), agent);
  await expect.poll(async () => { const t = await termText(ui); return t.includes('agent: rc of') && !t.includes('shell-marker'); }).toBe(true);
  expect(await modes(), "the agent's own, not the shell's").toEqual({ mouse: 'none', encoding: 'DEFAULT', hidden: false });
  await ui.evaluate((id) => (window as any).act('terminal:show', { id }), sh.id);
  await expect.poll(() => termText(ui)).toContain('shell-marker');
  await expect.poll(() => ui.evaluate(() => (window as any).__term.buffer.active.viewportY)).toBe(5);
  expect(await modes(), 'the modes are back').toEqual(set);
  await ui.locator(`nav[aria-label="Terminals"] [data-id="${sh.id}"] [title^="Close"]`).click();
  await expect.poll(() => terminals(core)).toBe(1);
});

test('terminal: one opened in a hidden window starts at once, at its room: a hidden page draws no frames (Windows hides a window others cover)', async ({ core, ui }) => {
  await core((k) => k.shell.win.minimize()); // hidden as covered: shown again, Windows would leave a hidden window behind the others
  try {
    await expect.poll(() => ui.evaluate(() => document.hidden)).toBe(true);
    await ui.evaluate(() => (window as any).act('terminal:open'));
    const sh = await terminal(core, 'Terminal');
    expect(await core((k) => { const p = (k.shell.task.terminal('Terminal') as TaskTerminal).pty; return { cols: p.cols, rows: p.rows }; })).toEqual(await term(ui));
    // A DOM click: Playwright's waits for frames, which a hidden page does not draw.
    await ui.evaluate((id) => document.querySelector<HTMLElement>(`nav[aria-label="Terminals"] [data-id="${id}"] [title^="Close"]`).click(), sh.id);
    await expect.poll(() => terminals(core)).toBe(1);
  } finally { await core((k) => k.shell.win.restore()); }
  await expect.poll(() => ui.evaluate(() => document.hidden)).toBe(false);
  await focusWindow(core, ui);
});

test("terminal: dictation where the agent has its own: the right Ctrl held anywhere records, let go stops, pressed once it records until the next; the microphone at the end of the terminals' row shows it and does the same by the mouse; with a shell in front the agent comes to the front; the key is the human's to change in Keyboard Shortcuts", async ({ core, ui, files }) => {
  await sam(core);
  // The key as Kulisa ships it, whatever an earlier run of this test changed it to.
  await invoke(ui, 'keys:set', { id: 'voice.hold', code: MAC ? 'MetaRight' : 'ControlRight' });
  const mic = ui.locator('[aria-label="Speak to the agent"]');
  await expect(mic).toBeEnabled();
  // At the row's end, after + and the task's repositories, inside the row: no row of its own.
  const { row, add, m } = await ui.evaluate(() => {
    const r = (s: string) => document.querySelector(s).getBoundingClientRect().toJSON();
    return { row: r('[data-testid="terminal-tabs"]'), add: r('#termAdd'), m: r('[aria-label="Speak to the agent"]') };
  });
  expect(m.left > add.right && row.right - m.right <= 12, `at the row's end: ${JSON.stringify({ row, add, m })}`).toBe(true);
  expect(m.top >= row.top && m.bottom <= row.bottom, 'in the row').toBe(true);
  const name = MAC ? 'Right ⌘' : 'Right Ctrl'; // Apple keyboards have no right Ctrl
  expect(await mic.getAttribute('title'), "in Kulisa's language (☰ → Language), with the key")
    .toBe(`Speak to the agent in English: hold ${name} anywhere, or press it once and again; or this button the same way`);
  const keys = async () => ((await termText(ui)).match(/<v>/g) || []).length;
  const lit = () => mic.getAttribute('aria-pressed');
  // Whether the shown task records (src/dictation): its key decided as it is pressed or let go (the main process sees
  // a key as it is sent).
  const recordingNow = () => core((k) => k.shell.dictation.recording(k.shell.task.key));
  const recording = async (n: number, what = '') => { // repeated while it records
    await expect.poll(keys, { message: `not recording: ${what}` }).toBeGreaterThanOrEqual(n + 5);
    expect(await lit(), what).toBe('true');
  };
  // Stopped: no more keys typed, those typed before all on the screen (echoed in order), the microphone told.
  const stopped = async (what = '') => {
    await expect.poll(recordingNow, { message: `not stopped: ${what}` }).toBe(false);
    await echoed(core, { shows: () => termText(ui) });
    await ipcSettled(ui);
    expect(await lit(), what).toBe('false');
  };
  // The modifier pressed or let go in Sam's page or the window, as the keyboard sends it: its side, a repeat while held.
  const ctrl = (where: 'page' | 'win', type: 'keyDown' | 'keyUp', side: 'left' | 'right' = 'right', repeat = false) => core((k, a) => {
    const wc = a.where === 'page' ? k.profile('Sam').get().wc : k.shell.win.webContents, mac = process.platform === 'darwin';
    wc.sendInputEvent({ type: a.type, keyCode: mac ? 'Meta' : 'Control', modifiers: [mac ? 'meta' : 'control', a.side, ...(a.repeat ? ['isautorepeat' as const] : [])] });
  }, { where, type, side, repeat });
  const tap = async (where: 'page' | 'win', side: 'left' | 'right' = 'right') => { await ctrl(where, 'keyDown', side); await ctrl(where, 'keyUp', side); };
  const pageFocused = () => core((k) => k.profile('Sam').get().wc.isFocused());
  // The key in a profile's page, where every other key is the site's: held, it records until let go, and the keyboard
  // stays in the page; its repeats while held are no presses. The page given the keyboard as for the human (a bare
  // focus is the page's own, given back after 150 ms: page-focus.ts).
  await core((k) => { const sam = k.profile('Sam'); sam.focusTab(sam.get()); });
  await expect.poll(pageFocused).toBe(true);
  let n = await keys();
  await ctrl('page', 'keyDown');
  await recording(n);
  await ctrl('page', 'keyDown', 'right', true);
  // Held longer than a press (HOLD, src/dictation/main/dictation.ts) is what makes it a hold: its press dated back a
  // minute, as a clock moved on.
  await core((k) => { k.shell.dictation.of(k.shell.task.key).held -= 60_000; });
  expect(await lit()).toBe('true');
  await ctrl('page', 'keyUp');
  await stopped('held in the page');
  expect(await pageFocused(), 'the keyboard stays where it was').toBe(true);
  // Pressed once: until the next press. The left Ctrl is the usual Ctrl.
  n = await keys();
  await tap('page', 'left');
  expect(await recordingNow(), 'the left one records nothing').toBe(false);
  await tap('page');
  await recording(n);
  expect(await recordingNow(), 'a press records until the next: still on once let go').toBe(true);
  await tap('page');
  await stopped('tap in the page');
  // In the window too (the terminal has the keyboard); the window losing the keyboard lets go.
  await ui.evaluate(() => document.querySelector<HTMLElement>('[data-testid="terminal"] .xterm-helper-textarea').focus());
  n = await keys();
  await ctrl('win', 'keyDown');
  await recording(n);
  await core((k) => k.shell.win.emit('blur'));
  await stopped('blur');
  // The button does the same by the mouse: a click starts, the next stops; held, until let go.
  n = await keys();
  await mic.click({ force: true }); // it pulses while it records: never still
  await recording(n);
  expect(await mic.getAttribute('title')).toBe(`Recording: let go of ${name}, or click to stop`);
  await mic.click({ force: true }); // it pulses while it records: never still
  await stopped('click');
  n = await keys();
  const letGo = await holdPointer(ui, mic); // pressed longer ago than a press lasts
  await recording(n, 'repeated while held');
  await letGo();
  await stopped('button held');
  expect(await ui.evaluate(() => document.activeElement.closest('.xterm') !== null), 'the keyboard back in the terminal, to send it').toBe(true);
  // With a shell in front (the button disabled: the dictation is the agent's), the key brings the agent the prompt
  // goes to in front, and records.
  await ui.locator('#termAdd').click();
  await choose(ui, 'Terminal');
  await expect(mic).toBeDisabled();
  n = await keys();
  await tap('page');
  await recording(n);
  await expect(ui.locator('nav[aria-label="Terminals"] [role="tab"][aria-selected="true"]')).toHaveText('bash');
  await tap('page');
  await stopped('shell in front');
  const human = await terminal(core, 'Terminal');
  await ui.locator(`nav[aria-label="Terminals"] [data-id="${human.id}"] [title^="Close"]`).click();
  await expect.poll(() => terminals(core)).toBe(1);
  // The human's own key instead (Keyboard Shortcuts: Change, then the key): one that types is refused, saying so; the
  // row, the tooltip and settings.json have the new one, which works at once; the old one is the usual key again.
  await ui.locator('#windowMenu').click();
  await choose(ui, 'Keyboard Shortcuts');
  const shortcuts = ui.locator('#shortcuts');
  await expect(shortcuts).toHaveAttribute('data-state', 'open');
  const hold = shortcuts.locator('dt', { hasText: /^Speak to the agent: hold, or press once and again$/ }).locator('+ dd');
  await expect(hold.locator('kbd')).toHaveText([name]);
  await hold.getByRole('button', { name: 'Change' }).click();
  await expect(hold.locator('kbd')).toHaveText(['Press a key…']);
  await core((k) => k.press(k.shell.win.webContents, 'A'));
  await expect(shortcuts.getByRole('alert')).toHaveText(/^Press a key that types nothing/);
  await expect(hold.locator('kbd')).toHaveText([name]);
  await hold.getByRole('button', { name: 'Change' }).click();
  await core((k) => k.press(k.shell.win.webContents, 'F9'));
  await expect(hold.locator('kbd')).toHaveText(['F9']);
  expect(files.json('settings.json').keys).toEqual({ 'voice.hold': 'F9' });
  await shortcuts.locator('header').getByRole('button', { name: 'Close' }).click();
  await expect(mic).toHaveAttribute('title', /hold F9 anywhere/);
  n = await keys();
  await core((k) => { const sam = k.profile('Sam'); sam.focusTab(sam.get()); });
  await expect.poll(pageFocused).toBe(true);
  await core((k) => k.press(k.profile('Sam').get().wc, 'F9'));
  await recording(n);
  await core((k) => k.press(k.profile('Sam').get().wc, 'F9'));
  await stopped('F9');
  await tap('page');
  expect(await recordingNow(), `the ${name} is a modifier again`).toBe(false);
});

test("the island: its terminals in tabs over them, one shown, the row apart; + opens the human's shell in front; the agent runs what keeps running in a shell of its own, behind, reads it, stops it, closes it, never in an agent's tab; × and a shell's exit close one", async ({ core, ui, call, mcp }) => {
  // Named for the instructions to say it, before the agent first connects (the instructions come at its start).
  await core((k) => k.shell.task.rename('task-1'));
  await sam(core);
  const tabs = () => termTabs(ui);
  const shown = () => ui.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-testid="terminal"] .xterm')].filter((t) => t.checkVisibility()).length);
  const color = (sel: string) => ui.evaluate((s) => getComputedStyle(document.querySelector(s)).backgroundColor, sel);
  expect((await mcp()).getInstructions()).toMatch(/terminal_run, not in your own shell.*This is the Kulisa task "task-1", working right in the project's folder .* \(no git, so no worktree of its own\)\. Run the app under test on a free port you pick \(Kulisa assigns none\).*Name the task with task_rename once you know what it is about, silently: never ask the human for a name or mention it\. These notes are for you/s);
  expect(await tabs(), "the agent's tab, named after its agent").toEqual(['bash *']);
  // The row is apart from the terminal, as a pane's tabs from its toolbar: the row in a pane's tabs' color, the tab in
  // front in the terminal's, as a pane's active tab in its toolbar's.
  const row = '.dv-groupview:has([data-testid="terminal-tabs"]) .dv-tabs-and-actions-container';
  expect(await color(row)).not.toBe(await color('[data-testid="terminals"]'));
  expect(await color('nav[aria-label="Terminals"] [role="tab"][aria-selected="true"]')).toBe(await color('[data-testid="terminals"]'));
  expect([await color(row), await color('nav[aria-label="Terminals"] [role="tab"][aria-selected="true"]')]).toEqual([await color('[role="region"][data-profile] nav[aria-label="Tabs"]'), await color('[role="region"][data-profile] [role="tab"][aria-selected="true"]')]);
  // + is the island's, not a tab's: its menu has the project's agents (none here) and Terminal.
  await ui.evaluate(() => {
    (window as any).__grew = [];
    new MutationObserver((m) => (window as any).__grew.push(...m.map((x) => (x.target as HTMLElement).dataset.id)))
      .observe(document.querySelector('nav[aria-label="Terminals"]'), { subtree: true, attributeFilter: ['data-opening'] });
  });
  await ui.locator('#termAdd').click();
  expect(await menuRows(ui)).toEqual(['Terminal']);
  await choose(ui, 'Terminal');
  await expect.poll(tabs).toEqual(['bash', 'Terminal *']);
  // The new tab grows in, as a pane's (lib/strip.ts), and is left grown.
  await expect.poll(() => ui.evaluate(() => (window as any).__grew.length === 2 && !document.querySelector('[role="tab"][data-opening]'))).toBe(true);
  const human = await terminal(core, 'Terminal');
  expect(await core((k) => (k.shell.task.terminal('Terminal') as TaskTerminal).by)).toBe('human');
  // A shell in front: no dictation (it is the shown agent's), the bar kept, its microphone disabled saying why; a pick
  // still goes to the agent shown last.
  const mic = ui.locator('[aria-label="Speak to the agent"]');
  await expect(mic).toBeDisabled();
  expect(await mic.getAttribute('title')).toBe("Dictation is the agent's: a shell is in front");
  expect(await core((k) => k.shell.task.promptTarget().agent.cli)).toBe('bash');
  await expect.poll(async () => (await shown()) === 1 && ui.evaluate(() => document.activeElement.closest('.xterm') !== null)).toBe(true);

  // The agent's: its environment (KULISA_TASK), behind (the human watches what is in front), read back as plain text.
  const ready = WIN ? 'echo "ready in $env:KULISA_TASK"; sleep 30' : 'echo "ready in $KULISA_TASK"; sleep 30';
  expect((await call('terminal_run', { name: 'dev server', command: ready })).text).toMatch(/^Started in terminal "dev server"/);
  const dev = await terminal(core, 'dev server');
  await expect.poll(async () => (await call('terminal_read', { name: 'dev server' })).text).toContain('ready in task-1');
  expect(await tabs(), 'behind').toEqual(['bash', 'Terminal *', 'dev server']);
  expect(await shown()).toBe(1);
  // Laid out while behind, it does not make the window scrollable: the agent's state on its tab (the tasks' bar brings
  // its tab into view) had moved the grid up by a window's height.
  await ui.evaluate(() => document.querySelector('#projectTabs > *').scrollIntoView());
  expect(await ui.evaluate(() => [document.documentElement.scrollTop, document.documentElement.scrollHeight <= innerHeight])).toEqual([0, true]);
  expect((await call('terminal_read', {})).text).toBe(`"Terminal" (the human's)\n"dev server" (an agent's): ${ready}`);
  await expect(call('terminal_stop', { name: 'nope' })).rejects.toThrow(/no terminal "nope"; open now: "Terminal", "dev server"/);
  // An agent's tab is no terminal to run in, read or stop: a command there would be a message to that agent.
  for (const [tool, args] of [['terminal_run', { command: 'hi' }], ['terminal_read', {}], ['terminal_stop', { close: true }]] as const) {
    await expect(call(tool, { name: 'bash', ...args })).rejects.toThrow(/"bash" is an agent's tab, not a terminal to run in: read what it did in task_history/);
  }
  expect(await tabs()).toEqual(['bash', 'Terminal *', 'dev server']);
  // More than fit (36 terminals): the row scrolls, its end faded; each tab its name whole; + and the microphone at its
  // end stay in the island, not cut off past it; its tabs do not shrink to no name.
  await ui.evaluate(() => { const n = document.querySelector('nav[aria-label="Terminals"]'); for (let i = 0; i < 40; i++) n.append(n.querySelector('[role="tab"]').cloneNode(true)); });
  await expect(ui.locator('nav[aria-label="Terminals"][data-past-start], nav[aria-label="Terminals"][data-past-end]')).toHaveCount(1);
  expect(await ui.evaluate(() => {
    const n = document.querySelector('nav[aria-label="Terminals"]'), island = n.closest('.dv-groupview').getBoundingClientRect(), r = (q: string) => document.querySelector(q).getBoundingClientRect();
    return [n.scrollWidth > n.clientWidth, [...n.querySelectorAll('[role="tab"] [id]')].every((x) => x.scrollWidth <= x.clientWidth), r('#termAdd').right <= island.right, r('[aria-label="Speak to the agent"]').right <= island.right];
  })).toEqual([true, true, true, true]);
  await ui.evaluate(() => document.querySelectorAll('nav[aria-label="Terminals"] [role="tab"]').forEach((t, i) => { if (i >= 3) t.remove(); }));
  // Stopped: Ctrl+C, the shell stays; the same name again types into it (PowerShell shows no ^C: its answer at once,
  // not after the sleep, says the command stopped).
  await call('terminal_stop', { name: 'dev server' });
  if (!WIN) await expect.poll(async () => (await call('terminal_read', { name: 'dev server', lines: 3 })).text).toContain('^C');
  expect((await call('terminal_run', { name: 'Dev Server', command: 'echo again' })).text).toMatch(/^Typed into terminal "dev server"/);
  await expect.poll(async () => (await call('terminal_read', { name: 'dev server' })).text).toMatch(/^again$/m);
  // Read as the screen shows it: lines a program redraws in place (a progress, a container's state) are what they
  // became. Read from the output with its codes left out, every frame was there, and filled the lines asked for.
  await call('terminal_run', { name: 'dev server', command: WIN ? 'Write-Host "bundle 30%`nwrite`n$([char]27)[2A$([char]27)[2Kbundle done`n$([char]27)[2Kwritten"'
    : String.raw`printf 'bundle 30%%\nwrite\n\033[2A\033[2Kbundle done\n\033[2Kwritten\n'` });
  await expect.poll(async () => (await call('terminal_read', { name: 'dev server' })).text).toMatch(/^written$/m);
  expect((await call('terminal_read', { name: 'dev server' })).text).not.toMatch(/^(bundle 30%|write)$/m);
  // A click on a tab brings it to the front.
  await ui.locator(`nav[aria-label="Terminals"] [data-id="${dev.id}"]`).click();
  await expect.poll(tabs).toEqual(['bash', 'Terminal', 'dev server *']);
  // Closed by the agent: its tab and its process go; the tab next to it comes to the front.
  const pid = await core((k) => (k.shell.task.terminal('dev server') as TaskTerminal).pty.pid);
  await call('terminal_stop', { name: 'dev server', close: true });
  await expect.poll(tabs).toEqual(['bash', 'Terminal *']);
  await expect.poll(() => { try { process.kill(pid, 0); return false; } catch { return true; } }).toBe(true);
  // A shell that exits closes its terminal; × closes the human's.
  await call('terminal_run', { name: 'once', command: 'exit' });
  await expect.poll(() => core((k) => !!(k.shell.task.terminal('once') as TaskTerminal).error && k.shell.task.terminals.size === 2)).toBe(true);
  await ui.locator(`nav[aria-label="Terminals"] [data-id="${human.id}"] [title^="Close"]`).click();
  await expect.poll(() => terminals(core)).toBe(1);
  await expect.poll(tabs).toEqual(['bash *']);
  expect(await core((k) => k.shell.task.promptTarget().pty === k.shell.pty), "the agent's in front again, still running").toBe(true);
  await expect(mic).toBeEnabled();
});

test("the window's page is sandboxed (no Node in it), its bridge to the main process works", async ({ core, ui }) => {
  expect(await core((k) => k.noNode(k.shell.win.webContents))).toBe(true);
  expect(await ui.evaluate(() => (window as any).kulisa.platform)).toBe(process.platform);
});

test("one Kulisa per data folder: a second one started on the same data shows the first one's window and goes", async ({ core, files }) => {
  // The tests' Kulisas run side by side, each on a folder of its own: another folder is no second one.
  await core((k) => k.shell.windows[0].win.minimize());
  await expect.poll(() => core((k) => k.shell.windows[0].win.isMinimized())).toBe(true);
  const second = await start(core, files.userData);
  const timer = setTimeout(() => second.p.kill('SIGINT'), 10000); // one that stays is stopped, not left behind
  const code = await second.code;
  clearTimeout(timer);
  expect(code).toBe(0);
  expect(second.out()).toMatch(/already running with .*: its window is shown/);
  await expect.poll(() => core((k) => k.shell.windows[0].win.isMinimized())).toBe(false);
});

test('KULISA_QUIT: a second start asks the Kulisa running on the same data to quit, saved as at SIGINT, and leaves no start in its log', async ({ core, ui, files }) => {
  test.setTimeout(60000); // a whole Kulisa started and quit, besides the test's
  const data = path.join(files.root, 'quit');
  await removed(data);
  const first = await start(core, data);
  const timer = setTimeout(() => first.p.kill('SIGINT'), 30000); // one that stays is stopped, not left behind
  try {
    await expect.poll(first.out, { timeout: 20000 }).toContain('MCP server');
    const quit = await start(core, data, { KULISA_QUIT: '1' });
    expect(await quit.code).toBe(0);
    expect(quit.out()).toMatch(/asked the one running with .* to quit/);
    expect(await first.code).toBe(0);
  } finally { clearTimeout(timer); }
  const none = await start(core, data, { KULISA_QUIT: '1' });
  expect(await none.code).toBe(0);
  expect(none.out()).toMatch(/none running with/);
  const log = fs.readFileSync(path.join(data, 'logs', 'kulisa.log'), 'utf8');
  expect(log).toMatch(/asked to quit by another start[^\n]*\n[^\n]*\[kulisa\] quitting/);
  expect(log.lastIndexOf('[kulisa] start') < log.lastIndexOf('[kulisa] quitting'), 'the next start does not take it for a crash').toBe(true);
  await removed(data);
  await focusWindow(core, ui); // the other Kulisa's window took it (macOS: the front app's), as a click would give it back
});

test("icons: each from the sprite (docs/ui.md), drawn there once and in lines of the text's color; icon buttons have a name", async ({ core, ui }) => {
  await sam(core);
  const r = await ui.evaluate(() => {
    const every = (q: string) => [...document.querySelectorAll(q), ...[...document.querySelectorAll('template')].flatMap((t) => [...t.content.querySelectorAll(q)])];
    const ids = [...document.querySelectorAll('#sprite > symbol')].map((s) => s.id);
    const icons = every('svg').filter((s) => !s.closest('#sprite, [data-testid="arrange-row"]')); // pictures, not icons
    const add = document.querySelector('[aria-label="New tab"] svg');
    return { ids: ids.length === new Set(ids).size, drawnInPlace: icons.filter((s) => !s.querySelector(':scope > use')).length,
      unknown: icons.map((s) => s.querySelector('use')?.getAttribute('href')).filter((h) => h && !ids.includes(h.slice(1))),
      unnamed: every('button, [role="button"]').filter((b) => !b.textContent.trim() && !b.getAttribute('aria-label') && !b.getAttribute('aria-labelledby') && !(b as HTMLElement).title).map((b) => b.outerHTML.slice(0, 80)),
      lines: [getComputedStyle(add).fill, getComputedStyle(add).stroke === getComputedStyle(add.closest('button')).color],
      sprite: document.getElementById('sprite').getBoundingClientRect().height }; // takes no room
  });
  expect(r).toEqual({ ids: true, drawnInPlace: 0, unknown: [], unnamed: [], lines: ['none', true], sprite: 0 });
});

test("the app icon: in the top bar (not on macOS: the Dock's), and every file the window and the installers use", async ({ ui }) => {
  const img = await ui.evaluate(() => {
    const i = document.querySelector('[data-testid="title-logo"]'), r = i?.getBoundingClientRect();
    return i && { w: r.width, h: r.height, drawn: !!i.querySelector('use[href="#i-logo"]'), drape: getComputedStyle(i).color, project: getComputedStyle(document.documentElement).getPropertyValue('--project') };
  });
  if (MAC) expect(img, 'macOS apps show their icon in the Dock, not by the window buttons').toBeNull();
  else {
    expect(img && img.drawn && img.w >= 16 && img.h >= 16, JSON.stringify(img)).toBe(true);
    expect(img.drape, "the curtain is in the project's color (#4a7bd0, the first one)").toBe('rgb(74, 123, 208)');
  }
  const icons = [forge.packagerConfig.icon + '.png', forge.packagerConfig.icon + '.ico', forge.packagerConfig.icon + '.icns',
    ...(forge.makers as { config?: { setupIcon?: string; icon?: string; options?: { icon?: string } } }[]).flatMap((m) => [m.config?.setupIcon, m.config?.icon, m.config?.options?.icon]).filter(Boolean)];
  for (const f of icons) expect(fs.statSync(path.join(CHECKOUT, f)).size > 1000, f).toBe(true);
  expect(icons).toHaveLength(7); // the .rpm's too
});

test("one row on top: no menu bar, OS window buttons over the top bar; on macOS the system's, Settings… (⌘,) in it", async ({ core, ui, sui }) => {
  // macOS: the menu bar is the system's, at the screen's top, always there: Kulisa's own there (app.ts), Settings… in
  // its app menu as Mac apps have it.
  if (MAC) {
    expect(await core((k) => {
      const m = k.electron.Menu.getApplicationMenu(), item = m.items[0].submenu.items.find((i) => i.label === 'Settings…');
      return { roles: m.items.map((i) => i.role), accelerator: item?.accelerator };
    })).toEqual({ roles: ['appmenu', 'editmenu', 'windowmenu'], accelerator: 'Command+,' });
    await core((k) => k.electron.Menu.getApplicationMenu().items[0].submenu.items.find((i) => i.label === 'Settings…').click(undefined, k.shell.win, undefined));
    await expect((await sui()).locator('#pjlist')).toBeAttached();
    await closeSettings(core, ui, sui);
  } else expect(await core((k) => k.shell.win.isMenuBarVisible())).toBe(false);
  expect(await ui.evaluate(() => (navigator as any).windowControlsOverlay.visible)).toBe(true);
  const bar = await ui.evaluate(() => { const r = document.getElementById('topbar').getBoundingClientRect(); return { top: r.top, height: r.height, right: r.right }; });
  const controls = await ui.evaluate(() => { const r = (navigator as any).windowControlsOverlay.getTitlebarAreaRect(); return { x: r.x as number, width: r.width as number }; });
  expect(bar.top).toBe(0);
  expect(bar.height).toBe(44);
  expect(bar.right <= controls.x + controls.width, 'the bar ends where the window buttons begin').toBe(true);
});

test("a right-click on the title bar opens no window menu on Linux: GNOME's froze the desktop", async ({ core }) => {
  test.skip(process.platform !== 'linux', 'Linux only');
  expect(await core((k) => {
    const e = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    k.shell.win.emit('system-context-menu', e, { x: 10, y: 10 });
    return e.defaultPrevented;
  })).toBe(true);
});

test('UI text is not selectable by dragging, as in a desktop app; fields are; the arrow over buttons', async ({ core, ui }) => {
  await sam(core);
  const sel = await ui.evaluate(() => {
    const us = (q: string) => getComputedStyle(document.querySelector(q)).userSelect;
    return { button: us('#newTask'), name: us('#projectTabs [role="tab"] [id]'), tab: us('[data-tab] [id]'), header: us('[data-panel^="profile:"]'), field: us('[aria-label="Address"]') };
  });
  expect(sel).toEqual({ button: 'none', name: 'none', tab: 'none', header: 'none', field: 'text' });
  // The arrow over buttons and tabs, as in Chrome, not a web page's hand.
  expect(await ui.evaluate(() => ['#newTask', '#projectTabs [role="tab"]', '[data-tab]', '[aria-label="New tab"]', '[aria-label="Back"]', '[aria-label="Close profile"]', '#windowMenu'].map((q) => getComputedStyle(document.querySelector(q)).cursor)))
    .toEqual(['default', 'default', 'default', 'default', 'default', 'default', 'default']);
});

test('screenshot of the whole window, profile views included', async ({ core, files }) => {
  test.skip(!await core((k) => k.canShoot()), NO_SHOT);
  await sam(core);
  await expect.poll(() => core((k) => k.profile('Sam').get().view.getVisible())).toBe(true);
  const file = path.join(files.root, 'window.png');
  await core((k, f) => k.shell.screenshot(f), file);
  const png = fs.readFileSync(file);
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.length, `${png.length} bytes`).toBeGreaterThan(10000);
});

test("the OS buttons' strip shows the top bar under it: dimmed with it under a dialog", async ({ core, ui, files }) => {
  test.skip(MAC, 'macOS draws no strip under its buttons');
  test.skip(!await core((k) => k.canShoot()), NO_SHOT);
  // The strip's first pixel and the top bar's just left of it, in the screenshot (the strip is the OS's, not the page's).
  const { x, y } = await ui.evaluate(() => { const r = (navigator as any).windowControlsOverlay.getTitlebarAreaRect(); return { x: r.right * devicePixelRatio, y: 2 * devicePixelRatio }; });
  const pixels = (name: string) => core(async (k, a) => {
    await k.shell.screenshot(a.file);
    const img = k.electron.nativeImage.createFromPath(a.file), { width } = img.getSize(), bgra = img.toBitmap();
    const at = (px: number) => [...bgra.subarray((a.y * width + px) * 4, (a.y * width + px) * 4 + 3)];
    return { bar: at(Math.round(a.x) - 3), strip: at(Math.round(a.x) + 3) };
  }, { file: path.join(files.root, name), x, y });
  const near = ({ bar, strip }: { bar: number[]; strip: number[] }) => bar.every((c, i) => Math.abs(c - strip[i]) <= 2);
  const plain = await pixels('buttons.png');
  expect(near(plain), `the strip as the bar: ${JSON.stringify(plain)}`).toBe(true);
  await ui.locator('#windowMenu').click();
  await choose(ui, 'Keyboard Shortcuts');
  await expect(ui.locator('#shortcuts')).toHaveAttribute('data-state', 'open');
  let dimmed = plain; // the screen catches up with the page a frame later
  await expect.poll(async () => { dimmed = await pixels('buttons-dialog.png'); return dimmed.bar[0] < plain.bar[0]; }).toBe(true);
  expect(near(dimmed), `dimmed as the bar: ${JSON.stringify(dimmed)}`).toBe(true);
  await ui.locator('#shortcuts').locator('header').getByRole('button', { name: 'Close' }).click();
  await expect(ui.locator('#shortcuts')).toHaveCount(0);
});

test("theme: Dark by default, Light or System in ☰; the window, the terminal and the OS buttons follow, the pages keep the OS's; saved", async ({ core, ui, files }) => {
  await sam(core);
  // What is shown: a panel's color, the terminal's (a pane's toolbar's); the controls' own scheme (color-scheme).
  const DARK = 'rgb(30, 31, 34)', LIGHT = 'rgb(255, 255, 255)', TERM = { dark: 'rgb(47, 49, 53)', light: 'rgb(242, 243, 245)' };
  const look = () => ui.evaluate(([dark, light]) => {
    const panel = getComputedStyle(document.querySelector('.dv-groupview')).backgroundColor;
    // A main button's text, as a dialog has (none in the page while closed).
    const b = document.body.appendChild(document.createElement('i'));
    b.style.color = 'var(--on-accent)';
    const onAccent = getComputedStyle(b).color;
    b.remove();
    return { shade: panel === dark ? 'dark' : panel === light ? 'light' : panel, term: (window as any).__term.options.theme.background as string,
      scheme: getComputedStyle(document.querySelector('input')).colorScheme,
      chosen: [...document.querySelectorAll<HTMLElement>('[role="menu"][data-state="open"] [data-testid="theme-row"] [data-state="checked"]')].map((x) => x.dataset.theme), onAccent };
  }, [DARK, LIGHT]);
  const pageDark = () => core((k) => k.profile('Sam').get().wc.executeJavaScript(`matchMedia('(prefers-color-scheme: dark)').matches`) as Promise<boolean>);
  const osDark = await pageDark();
  const saved = () => files.json('settings.json').theme;
  const shot = async (name: string) => {
    const file = path.join(files.root, name);
    await core((k, f) => k.shot(f), file);
    await test.info().attach(name, { path: file, contentType: 'image/png' });
  };
  await ui.locator('#windowMenu').click();
  expect((await menuRows(ui)).slice(0, 3)).toEqual(['zoom', 'theme', 'bar']);
  expect(await look()).toEqual({ shade: 'dark', term: TERM.dark, scheme: 'dark', chosen: ['dark'], onAccent: LIGHT });
  const pick = async (t: string, shade: 'dark' | 'light') => {
    await ui.locator(`[role="menu"][data-state="open"] [data-theme="${t}"]`).click();
    await expect.poll(async () => { const l = await look(); return { shade: l.shade, term: l.term, chosen: l.chosen[0] }; }).toEqual({ shade, term: TERM[shade], chosen: t });
    await expect(menu(ui), 'the menu stays open: the next one can be tried').toBeVisible();
    expect(saved(), 'saved').toBe(t);
  };
  await pick('light', 'light');
  expect(await look()).toEqual({ shade: 'light', term: TERM.light, scheme: 'light', chosen: ['light'], onAccent: LIGHT });
  expect(await pageDark(), "a site under test keeps the OS's scheme").toBe(osDark);
  await shot('light.png');
  await pick('system', await core((k) => k.electron.nativeTheme.shouldUseDarkColors) ? 'dark' : 'light'); // the OS's, as the pages'
  expect((await look()).scheme).toBe('light dark');
  await pick('dark', 'dark');
  await shot('dark.png');
  expect(await pageDark()).toBe(osDark);
  await closeMenu(ui);
});

test("the tasks' bar: under the grid by default; in the title bar, after the logo, when Top is chosen in ☰; the grid and its pages take the room left; saved", async ({ core, ui, files }) => {
  await sam(core);
  // Where the bar is: in the title bar's row between the logo and Settings (top), or under the grid (bottom).
  const where = () => ui.evaluate(() => {
    const r = (q: string) => document.querySelector(q).getBoundingClientRect(), bar = r('#taskbar'), grid = r('#dock'), top = r('#topbar');
    const inTitle = bar.top >= top.top && bar.bottom <= top.bottom && bar.left >= (document.querySelector('[data-testid="title-logo"]') ? r('[data-testid="title-logo"]').right : top.left) && bar.right <= r('#manageProjects').left;
    const area = (navigator as any).windowControlsOverlay.getTitlebarAreaRect();
    return { bar: inTitle ? 'top' : bar.top >= grid.bottom ? 'bottom' : 'elsewhere', drag: (getComputedStyle(document.querySelector('#projectTabs [role="tab"]')) as any).appRegion,
      above: Math.round(r('.dv-groupview').top - (inTitle ? r('#projectTabs [role="tab"]') : r('#manageProjects')).bottom), // from the title bar's buttons to the panels; from a tab in it, what the bar's 44 px leave under a 36 px tab
      edge: Math.round(grid.top - top.bottom), // the grid starts at the title bar's edge: it holds the gap itself
      over: inTitle ? Math.round(r('#projectTabs [role="tab"]').top - top.top) : 8, // from the window's top to a tab: as under it
      // ☰ a gap from the title bar area's end (the OS buttons, or the window's edge on macOS, where the area starts after them)
      end: Math.round(area.x + area.width - r('#windowMenu').right),
      title: Math.round(top.height), tall: Math.round(r('#projectTabs [role="tab"]').height), // the title bar keeps its height, a tab its own
      below: Math.round(innerHeight - (inTitle ? grid : bar).bottom), between: inTitle ? 8 : Math.round(bar.top - grid.bottom), // the window's rows --gap apart (App.vue)
      rows: getComputedStyle(document.body).gridTemplateRows.split(' ').map((px, i) => (i === 1 ? 'grid' : Math.round(parseFloat(px)))), // no row but the title bar, the grid and the bar (a tab and its gap from the grid)
      // The logo, the buttons and the tabs in the middle of its height
      level: !inTitle || !document.querySelector('[data-testid="title-logo"]') || Math.abs((r('[data-testid="title-logo"]').top + r('[data-testid="title-logo"]').bottom) - (r('#projectTabs [role="tab"]').top + r('#projectTabs [role="tab"]').bottom)) < 2,
      chosen: [...document.querySelectorAll<HTMLElement>('[role="menu"][data-state="open"] [data-testid="bar-row"] [data-state="checked"]')].map((b) => b.dataset.bar) };
  });
  const saved = () => files.json('settings.json').bar;
  expect((await where()).bar).toBe('bottom');
  for (const bar of ['top', 'bottom']) {
    await ui.locator('#windowMenu').click();
    await menuRows(ui);
    await ui.locator(`[role="menu"][data-state="open"] [data-bar="${bar}"]`).click();
    await expect.poll(async () => (await where()).bar === bar && saved() === bar).toBe(true);
    expect(await where(), 'one gap: over what is in the title bar and from it to the panels, from the grid to the bar and under it; in the title bar the tabs do not drag the window')
      .toEqual({ bar, drag: bar === 'top' ? 'no-drag' : 'none', above: bar === 'top' ? 4 : 8, over: bar === 'top' ? 4 : 8, end: 8, title: 44, below: 8, between: 8, edge: 0, rows: bar === 'top' ? [44, 'grid', 0] : [44, 'grid', 36 + 8], level: true, tall: 36, chosen: [bar] });
    await expect(menu(ui), 'the menu stays open: the other one can be tried').toBeVisible();
    await closeMenu(ui);
    await expect.poll(() => viewOn(core, ui, files, 'Sam'), { timeout: 3000 }).toBe(true); // the pages follow the grid
  }
});

test('dialogs: one look (title and ×, content, buttons at the bottom right, the main one last), in the page only while open; a question is asked in it', async ({ core, ui }) => {
  await sam(core);
  // Each opened as the human opens it, looked at, closed: a closed one leaves nothing in the page (no memory kept).
  const dialog = (id: string) => ui.locator(`#${id}`);
  const fromMenu = async (row: string, at?: string) => {
    if (at) await rightClick(ui, at); else await ui.locator('#windowMenu').click();
    await menuRows(ui);
    await choose(ui, row);
  };
  const openers = {
    taskrename: () => fromMenu('Rename…', '#projectTabs [role="tab"]'),
    agentpick: () => core((k) => { void k.shell.chooseAgent(k.shell.task, null); }), // asked when a task's agent is not there
    shortcuts: () => fromMenu('Keyboard Shortcuts'),
  };

  await expect(ui.locator('[role="dialog"], [role="alertdialog"]'), 'none in the page while closed').toHaveCount(0);
  for (const [id, open] of Object.entries(openers)) {
    await open();
    await expect(dialog(id)).toHaveAttribute('data-state', 'open', { timeout: 20000 });
    const l = await dialog(id).evaluate((d, i) => ({ id: i, title: !!d.querySelector('header h2'), body: !!d.querySelector(':scope > header ~ :not(footer)'), footer: !!d.querySelector('footer'),
      last: (() => { const b = d.querySelector('footer > button:last-child'), i = d.appendChild(document.createElement('i')); i.style.color = 'var(--accent)';
        const accent = getComputedStyle(i).color; i.remove(); return !!b && getComputedStyle(b).backgroundColor === accent; })() }), id);
    expect(l.title && l.body && l.last, `the main button last, in the accent: ${JSON.stringify(l)}`).toBe(true);
    await (id === 'agentpick' ? ui.locator('#agentcancel') : ui.locator(`#${id}`).locator('header').getByRole('button', { name: 'Close' })).click(); // the agent's choice: Cancel, no ×
    await expect(ui.locator(`#${id}[data-state="open"]`)).toHaveCount(0);
  }
  await expect(ui.locator('[role="dialog"], [role="alertdialog"]')).toHaveCount(0);

  // A question before deleting: the title, what goes line by line, Cancel (focused) and a red Delete at the right.
  await core((k) => { k.answer = null; }); // the test answers
  const view = () => core((k) => k.profile('Sam').get().view.getVisible());
  const ask = ui.locator('#ask');
  // The question's answer kept in the main process, to be read once given.
  const asking = (q: Question) => core((k, a) => { k.stash.answer = k.shell.ask(a); }, q);
  const answer = () => core((k) => k.stash.answer as Promise<boolean | 'other'>);
  await asking({ message: 'Delete the thing?', ok: 'Delete', danger: true, detail: 'Deleted for good:\n• a\n• b' });
  await expect(ask).toHaveAttribute('data-state', 'open');
  const q = await ask.evaluate((d) => {
    const r = (s: string) => d.querySelector(s).getBoundingClientRect(), ok = d.querySelector('footer > button:last-child'), body = document.getElementById(d.getAttribute('aria-describedby'));
    return { title: d.querySelector('h2').textContent, lines: body.innerText.split('\n').length, ok: ok.textContent,
      order: r('header').bottom <= body.parentElement.getBoundingClientRect().top && body.parentElement.getBoundingClientRect().bottom <= r('footer').top, right: Math.round(r('footer').right - ok.getBoundingClientRect().right),
      focused: document.activeElement.textContent };
  });
  expect(q).toEqual({ title: 'Delete the thing?', lines: 3, ok: 'Delete', order: true, right: 16, focused: 'Cancel' });
  await expect(ask.locator('footer > button:last-child'), 'red').toHaveCSS('background-color', 'rgb(201, 79, 79)');
  // Its buttons answer the hand: lit under the pointer, another color while pressed (still, they look dead).
  const bg = (sel: string) => ui.locator(sel).evaluate((e) => getComputedStyle(e).backgroundColor);
  for (const sel of ['#ask footer > button:first-child', '#ask footer > button:last-child']) {
    const b = await box(ui, sel), at = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    const still = await bg(sel);
    await ui.mouse.move(at.x, at.y);
    await expect.poll(() => bg(sel)).not.toBe(still);
    const lit = await bg(sel);
    await ui.mouse.down();
    await expect.poll(async () => [still, lit].includes(await bg(sel))).toBe(false);
    await ui.mouse.move(1, at.y); // let go away from it: nothing chosen
    await ui.mouse.up();
    await expect.poll(() => bg(sel)).toBe(still);
  }
  await expect(ask, 'still asking').toHaveAttribute('data-state', 'open');
  expect(await view(), 'pages hidden under the dialog').toBe(false);
  await core((k) => k.press(k.shell.win.webContents, 'Escape'));
  expect(await answer(), 'Esc says no').toBe(false);
  await expect.poll(view).toBe(true);

  // Two at once: the second waits for the first. Not deleting: the main button is blue.
  await asking({ message: 'Initialize it?', ok: 'Initialize' });
  await core((k) => { k.stash.second = k.shell.ask({ message: 'Delete the other?', ok: 'Delete', danger: true }); });
  await expect(ask).toHaveAttribute('data-state', 'open');
  await expect(ask.locator('h2')).toHaveText('Initialize it?');
  await expect(ask.locator('footer > button:last-child'), 'blue').toHaveCSS('background-color', 'rgb(53, 116, 240)');
  await ask.locator('footer > button:last-child').click();
  expect(await answer()).toBe(true);
  await expect(ask).toHaveAttribute('data-state', 'open');
  await expect(ask.locator('h2')).toHaveText('Delete the other?');
  await ask.getByRole('button', { name: 'Cancel' }).click();
  expect(await core((k) => k.stash.second as Promise<boolean | 'other'>), 'Cancel says no').toBe(false);
});

test("About Kulisa (☰; on macOS the app menu's) is a page of Settings: the versions, and the folders Kulisa writes in on this computer, each shown in the file manager, one not made yet told so", async ({ core, ui, sui, files }) => {
  const pkg = JSON.parse(fs.readFileSync(path.join(CHECKOUT, 'package.json'), 'utf8'));
  if (MAC) {
    expect(await core((k) => k.electron.Menu.getApplicationMenu().items[0].submenu.items[0].label), 'first in the app menu, where Mac apps have it').toBe('About Kulisa');
    await core((k) => k.electron.Menu.getApplicationMenu().items[0].submenu.items[0].click(undefined, k.shell.win, undefined));
  } else {
    await ui.locator('#windowMenu').click();
    await menuRows(ui);
    await choose(ui, 'About Kulisa');
  }
  const shown = async () => {
    const s = await sui();
    await expect(s.locator('#pjlist [data-page="about"]')).toHaveAttribute('aria-selected', 'true');
    await expect(s.locator('#abconfig')).toBeVisible();
    await expect(s.locator('#aboutpage h3').first()).toBeAttached();
    return s;
  };
  const s = await shown();
  expect(await core((k) => k.shell.settings.win.getTitle()), "a page of Settings, as Chrome's About").toBe('Settings — Kulisa');
  const a = await s.locator('#aboutpage').evaluate((d) => ({ title: d.querySelector('h3').textContent, line: [...d.querySelector('h3').parentElement.querySelectorAll('p')].map((p) => p.textContent).join(' / '),
    folders: [...d.querySelectorAll<HTMLElement>('dd[data-folder]')].map((dd) => ({ id: dd.dataset.folder, path: dd.firstElementChild.textContent, missing: dd.hasAttribute('data-missing'), disabled: dd.querySelector<HTMLButtonElement>('[aria-label="Show"]').disabled })) }));
  expect(a.title).toBe(`Kulisa ${pkg.version}`);
  const versions = await core(() => ({ electron: process.versions.electron, chrome: process.versions.chrome }));
  expect(a.line).toBe(`Electron ${versions.electron} · Chromium ${versions.chrome} / kulisa.app · GPL-3.0-or-later`);
  const projectsHome = path.join(files.root, 'KulisaProjects'), made = fs.existsSync(projectsHome);
  expect(a.folders).toEqual([{ id: 'data', path: files.userData, missing: false, disabled: false }, { id: 'projects', path: projectsHome, missing: !made, disabled: !made },
    { id: 'program', path: CHECKOUT, missing: false, disabled: false }]);
  // Show: the folder in the file manager, by its id (the window names no path).
  await core((k) => {
    const g = k.stash;
    g.openPath = k.electron.shell.openPath; g.shownDirs = [];
    k.electron.shell.openPath = async (dir: string) => { g.shownDirs.push(dir); return ''; };
  });
  try {
    await s.locator('#aboutpage dd[data-folder="data"]').getByRole('button', { name: 'Show' }).click();
    await expect.poll(() => core((k) => k.stash.shownDirs.length)).toBe(1);
  } finally { await core((k) => { k.electron.shell.openPath = k.stash.openPath; }); }
  expect(await core((k) => k.stash.shownDirs)).toEqual([files.userData]);
  await closeSettings(core, ui, sui);
  // The main process opens it too (macOS's menu, whichever OS): the same window at that page.
  await core((k) => k.shell.openSettings({ section: 'about', id: null }));
  await shown();
  await closeSettings(core, ui, sui);
});

// The app archive the test's Kulisa watches (app.ts, installed) replaced as apt does: a new one written beside and
// renamed over. The archive made as Forge packs it (@electron/asar).
test('a new version installed while Kulisa runs is offered once, in its own dialog: Later leaves it to the next start, Restart saves everything and starts it', async ({ core, ui, files }) => {
  const asar = path.join(files.root, 'installed', 'app.asar'), src = path.join(files.root, 'installed-src');
  const install = async (version: string) => {
    fs.mkdirSync(src, { recursive: true }); fs.mkdirSync(path.dirname(asar), { recursive: true });
    fs.writeFileSync(path.join(src, 'package.json'), JSON.stringify({ name: 'kulisa', version }));
    await createPackage(src, `${asar}.dpkg-new`);
    fs.renameSync(`${asar}.dpkg-new`, asar);
  };
  const restarted = () => core((k) => k.stash.restarted as string | null);
  // The test's Kulisa stays: its restart a stub that notes how it would restart.
  await core((k) => {
    const g = k.stash;
    g.restart = k.shell.restart; g.restarted = null;
    k.shell.restart = async (apply) => { g.restarted = apply ? 'squirrel' : 'relaunch'; };
  });
  try {
    await core((k) => { k.answer = false; }); // Later
    await install('9.9.9');
    await expect.poll(() => core((k) => k.asked.some((q) => q.message === 'Kulisa 9.9.9 is ready')), { timeout: 10000 }).toBe(true);
    const q = await core((k) => k.asked.pop());
    expect(q.ok).toBe('Restart'); expect(q.cancel).toBe('Later');
    expect(q.detail).toMatch(/Restart to use it: the windows, their tasks and conversations come back\. Later: the next start is 9\.9\.9\.$/);
    await expect(ui.locator('#ask[data-state="open"]')).toHaveCount(0);
    expect(await restarted(), 'Later: nothing').toBeNull();
    // Restart: the way to quit that keeps everything, then the new version.
    await core((k) => { k.answer = true; });
    await install('9.9.10');
    await expect.poll(restarted, { timeout: 10000 }).not.toBeNull();
    expect(await restarted()).toBe('relaunch');
    expect((await core((k) => k.asked.pop())).message).toBe('Kulisa 9.9.10 is ready');
  } finally {
    await core((k) => { k.shell.restart = k.stash.restart; k.answer = true; });
    await removed(src);
  }
});
