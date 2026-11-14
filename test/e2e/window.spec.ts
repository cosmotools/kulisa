import { taskPage, menuPage, inputPage } from './pages.ts';
// The window: the terminal and its panel, dictation, one Kulisa per data folder, the app icon, the top bar, the theme,
// the tasks' bar, dialogs, About, a new version installed, screenshots (docs/window.md).
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createPackage } from '@electron/asar';
import electronPath from 'electron';
import type { Locator, Page } from '@playwright/test';
import type { DevelopmentTerminal } from '../../src/main/tasks.ts';
import type { Question } from '../../src/shared/types.ts';
import { test, expect } from './fixtures.ts';
import type { Core } from './fixtures.ts';
import { showResources, terminalRows, SITE, CHECKOUT, MAC, WIN, echoed, holdPointer, ipcSettled, menu, choose, closeMenu, rightClick, viewOn, focusWindow, closeSettings, termText, invoke, answer, removed, termKeys, navRow, shortcutsDialog, shortcutKeys, windowSubmenu, arrange } from './helpers.ts';

const NO_SHOT = 'macOS: the app that started the tests (the terminal) may not record the screen';

const sam = (core: Core) => core(async (k, url) => (await k.ensureProfile('Sam', url)).id, `${SITE}/app`);
// The terminal named so, once its shell runs: its id and key.
const terminal = async (core: Core, name: string) => {
  await expect.poll(() => core((k, n) => !!(k.shell.task.terminal(n) as DevelopmentTerminal)?.pty, name)).toBe(true);
  return core((k, n) => { const t = k.shell.task.terminal(n) as DevelopmentTerminal; return { id: t.id, key: t.key }; }, name);
};
const developmentTerminals = (core: Core) => core((k) => k.shell.task.developmentTerminals.size);
// The Resources terminal list’s +.
const termAdd = async (ui: Page) => (await taskPage(ui)).getByRole('region', { name: 'Agents', exact: true }).getByRole('button', { name: 'New terminal', exact: true });
const term = async (ui: Page) => (await taskPage(ui)).evaluate(() => {
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
  let err = ''; p.stderr.on('data', (d) => { err = (err + d).slice(-20000); });
  return { p, out: () => out, err: () => err, code: new Promise<number>((r) => p.on('close', r)) };
};

test("the agent starts at the terminal's real size, not a default one", async ({ core, ui }) => {
  await showResources(ui, 'Agents');
  // Claude Code draws its prompt for the size it starts with and does not fully redraw on the first resize.
  const shown = await (await taskPage(ui)).evaluate(() => { const t = (window as any).__term; return { cols: t.cols, rows: t.rows }; });
  expect(await core((k) => k.shell.pty.spawnSize)).toEqual(shown);
  expect(shown.rows >= 10 && shown.cols >= 80, `a real size: ${JSON.stringify(shown)}`).toBe(true);
});

test('terminal: Unicode 11 widths (cursor stays put after emoji), bundled font, the rows in the middle', async ({ ui }) => {
  // Claude Code draws ✅, ⏵, ✻…; with Unicode 6 widths xterm puts the cursor one cell off after each wide one.
  const x = await (await taskPage(ui)).evaluate(() => new Promise((r) => (window as any).__term.write('\r\n✅🙂x', () => r((window as any).__term.buffer.active.cursorX))));
  expect(x).toBe(5);
  const font = await (await taskPage(ui)).evaluate(() => {
    const t = (window as any).__term;
    return { bundled: document.fonts.check(t.options.fontSize + 'px "JetBrains Mono"'), size: t.options.fontSize,
      ui: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--text-sm')) * parseFloat(getComputedStyle(document.documentElement).fontSize),
      family: t.options.fontFamily.startsWith('"JetBrains Mono"') };
  });
  expect(font.bundled).toBe(true);
  expect(font.size, "the terminal uses the window's body text size (Tailwind's text-sm)").toBe(font.ui);
  expect(font.family).toBe(true);
  // What is left under a whole row is shared above and below the rows.
  const h = await (await taskPage(ui)).locator('[data-testid="terminal"] .xterm-host').boundingBox(), r = await (await taskPage(ui)).locator('[data-testid="terminal"] .xterm-screen').boundingBox();
  const above = r.y - h.y, below = h.y + h.height - (r.y + r.height);
  expect(Math.abs(above - below) <= 1, `the rows in the middle: ${above} above, ${below} below`).toBe(true);
});

test('terminal: one xterm shows the terminal in front; another shown and back keeps its text, its scroll and the modes serializing leaves out, with no frame empty between', async ({ core, ui }) => {
  // An xterm each cost its renderer and a WebGL context, of which Chromium keeps 16 a page: the 17th takes the
  // oldest terminal's, which then draws slower for good, silently (src/terminal/README.md).
  await showResources(ui, 'Agents');
  const agent = await core((k) => [...k.shell.task.developmentTerminals.values()][0].id);
  // Opened as the terminals' + does, without its menu: a menu's pictures of the pages, put back late on a slow machine,
  // took the keyboard from the page the next test had put it in.
  await (await taskPage(ui)).evaluate(() => (window as any).act('development-terminal:open'));
  const sh = await terminal(core, 'Terminal');
  await expect((await taskPage(ui)).locator('.xterm'), 'one xterm for both terminals').toHaveCount(1);
  // The mouse in SGR and the cursor hidden, as Claude Code's fullscreen has them: serializing leaves both out.
  const cmd = `node '${path.join(CHECKOUT, 'test', 'fixtures', 'modes.mjs')}'\r`;
  await ui.evaluate((a) => (window as any).kulisa.send('pty:in', a), { task: sh.key, data: cmd });
  const modes = async () => (await taskPage(ui)).evaluate(() => {
    const t = (window as any).__term, c = t._core;
    return { mouse: t.modes.mouseTrackingMode, encoding: c.coreMouseService.activeEncoding, hidden: c.coreService.isCursorHidden };
  });
  const set = { mouse: 'vt200', encoding: 'SGR', hidden: true };
  await expect.poll(async () => (await termText(ui)).includes('shell-marker') && JSON.stringify(await modes()) === JSON.stringify(set)).toBe(true);
  await (await taskPage(ui)).evaluate(() => (window as any).__term.scrollToLine(5));
  // No frame without text between the two: the one shown stays until the other is put in. Its buffer read between
  // any two of the page's tasks, where a frame may be drawn (WebGL draws no text in the DOM): read only in frames, the
  // gap was caught now and then.
  await (await taskPage(ui)).evaluate(() => {
    const w = window as any, tick = new MessageChannel();
    w.__blank = 0; w.__watching = true;
    tick.port1.onmessage = () => {
      const b = w.__term?.buffer.active;
      if (!b || !Array.from({ length: b.length }, (_, i) => b.getLine(i).translateToString(true)).join('').trim()) w.__blank++;
      if (w.__watching) tick.port2.postMessage(0);
    };
    tick.port2.postMessage(0);
  });
  await (await taskPage(ui)).evaluate((id) => (window as any).act('development-terminal:show', { id }), agent);
  await expect.poll(async () => { const t = await termText(ui); return t.includes('agent: rc of') && !t.includes('shell-marker'); }).toBe(true);
  expect(await (await taskPage(ui)).evaluate(() => { const w = window as any; w.__watching = false; return w.__blank; }), 'turns with no text').toBe(0);
  expect(await modes(), "the agent's own, not the shell's").toEqual({ mouse: 'none', encoding: 'DEFAULT', hidden: false });
  await (await taskPage(ui)).evaluate((id) => (window as any).act('development-terminal:show', { id }), sh.id);
  await expect.poll(() => termText(ui)).toContain('shell-marker');
  await expect.poll(async () => (await taskPage(ui)).evaluate(() => (window as any).__term.buffer.active.viewportY)).toBe(5);
  expect(await modes(), 'the modes are back').toEqual(set);
  await (await taskPage(ui)).locator(`[data-task-view][data-active] [data-resources] [data-terminal="${sh.id}"] [title^="Close"]`).click();
  await expect.poll(() => developmentTerminals(core)).toBe(1);
});

test('terminal: one opened in a hidden window starts at once, at its room: a hidden page draws no frames (Windows hides a window others cover)', async ({ core, ui }) => {
  await showResources(ui, 'Agents');
  await core((k) => k.shell.win.minimize()); // hidden as covered: shown again, Windows would leave a hidden window behind the others
  try {
    await expect.poll(() => ui.evaluate(() => document.hidden)).toBe(true);
    await (await taskPage(ui)).evaluate(() => (window as any).act('development-terminal:open'));
    const sh = await terminal(core, 'Terminal');
    expect(await core((k) => { const p = (k.shell.task.terminal('Terminal') as DevelopmentTerminal).pty; return { cols: p.cols, rows: p.rows }; })).toEqual(await term(ui));
    // A click event, not a click: Playwright's click waits for frames, which a hidden page does not draw.
    await (await taskPage(ui)).locator(`[data-task-view][data-active] [data-resources] [data-terminal="${sh.id}"] [title^="Close"]`).dispatchEvent('click');
    await expect.poll(() => developmentTerminals(core)).toBe(1);
  } finally { await core((k) => k.shell.win.restore()); }
  await expect.poll(() => ui.evaluate(() => document.hidden)).toBe(false);
  await focusWindow(core, ui);
});

test("terminal: dictation where the agent has its own: the right Ctrl held anywhere records, let go stops, pressed once it records until the next; the microphone in the Resources bar shows it and does the same by the mouse; with a shell in front the agent comes to the front; the key is the human's to change in Keyboard Shortcuts", async ({ core, ui, files }) => {
  await sam(core);
  await showResources(ui, 'Agents');
  // The key as Kulisa ships it, whatever an earlier run of this test changed it to.
  await invoke(ui, 'keys:set', { id: 'voice.hold', code: MAC ? 'MetaRight' : 'ControlRight' });
  const mic = (await taskPage(ui)).locator('[aria-label="Speak to the agent"]');
  await expect(mic).toBeEnabled();
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
  // Native profile pages receive input through Electron, not Playwright attached to them.
  const ctrl = (where: 'page' | 'win', type: 'keyDown' | 'keyUp') => core((k, a) => {
    const wc = a.where === 'page' ? k.profile('Sam').get().wc : k.shell.windows[0].focusUi, mac = process.platform === 'darwin';
    wc.sendInputEvent({ type: a.type, keyCode: mac ? 'Meta' : 'Control', modifiers: [mac ? 'meta' : 'control', 'right'] });
  }, { where, type });
  const tap = async (where: 'page' | 'win') => { await ctrl(where, 'keyDown'); await ctrl(where, 'keyUp'); };
  const pageFocused = () => core((k) => k.profile('Sam').get().wc.isFocused());
  // The key in a profile's page, where every other key is the site's: held, it records until let go, and the keyboard
  // stays in the page. The page is given the keyboard as for the human (a bare
  // focus is the page's own, given back after 150 ms: page-focus.ts).
  await core((k) => { const sam = k.profile('Sam'); sam.focusTab(sam.get()); });
  await expect.poll(pageFocused).toBe(true);
  let n = await keys();
  await ctrl('page', 'keyDown');
  await recording(n);
  // Held longer than a press (HOLD, src/dictation/main/dictation.ts) is what makes it a hold: its press dated back a
  // minute, as a clock moved on.
  await core((k) => { k.shell.dictation.of(k.shell.task.key).held -= 60_000; });
  expect(await lit()).toBe('true');
  await ctrl('page', 'keyUp');
  await stopped('held in the page');
  expect(await pageFocused(), 'the keyboard stays where it was').toBe(true);
  // In the window too (the terminal has the keyboard); the window losing the keyboard lets go.
  await (await termKeys(ui)).focus();
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
  await expect((await taskPage(ui)).locator('.xterm:focus-within'), 'the keyboard back in the terminal, to send it').toHaveCount(1);
  // With a shell in front (the button disabled: the dictation is the agent's), the key brings the agent the prompt
  // goes to in front, and records.
  await (await termAdd(ui)).click();
  await choose(ui, 'Terminal');
  await expect(mic).toBeDisabled();
  n = await keys();
  await tap('page');
  await recording(n);
  await expect((await taskPage(ui)).locator('[data-task-view][data-active] [data-resources] [data-terminal] [aria-current="true"]')).toHaveAccessibleName('bash');
  await tap('page');
  await stopped('shell in front');
  const human = await terminal(core, 'Terminal');
  await (await taskPage(ui)).locator(`[data-task-view][data-active] [data-resources] [data-terminal="${human.id}"] [title^="Close"]`).click();
  await expect.poll(() => developmentTerminals(core)).toBe(1);
  // Key validation is unit-tested; here the chosen binding must reach the UI, disk and profile page.
  await ui.locator('#windowMenu').click();
  await choose(ui, 'Keyboard Shortcuts');
  const shortcuts = shortcutsDialog(ui);
  await expect(shortcuts).toBeVisible();
  const label = 'Speak to the agent: hold, or press once and again', hold = shortcutKeys(ui, label);
  const change = shortcuts.getByRole('row').filter({ has: ui.getByRole('cell', { name: label, exact: true }) }).getByRole('button', { name: 'Change' });
  await expect(hold).toHaveText([name]);
  await change.click();
  await expect(hold).toHaveText(['Press a key…']);
  await core((k) => k.press(k.shell.windows[0].focusUi, 'F9'));
  await expect(hold).toHaveText(['F9']);
  expect(files.json('settings.json').keys).toEqual({ 'voice.hold': 'F9' });
  await shortcuts.getByRole('button', { name: 'Close' }).click();
  await expect(mic).toHaveAttribute('title', /hold F9 anywhere/);
  n = await keys();
  await core((k) => { const sam = k.profile('Sam'); sam.focusTab(sam.get()); });
  await expect.poll(pageFocused).toBe(true);
  await core((k) => k.press(k.profile('Sam').get().wc, 'F9'));
  await recording(n);
  await core((k) => k.press(k.profile('Sam').get().wc, 'F9'));
  await stopped('F9');
});

test("the terminals' panel: its terminals selected in Resources, one shown, flat as a profile's pane; + opens the human's shell in front; the agent runs what keeps running in a shell of its own, behind, reads it, stops it, closes it, never in an agent's tab; × and a shell's exit close one", async ({ core, ui, call, mcp }) => {
  // Named for the instructions to say it, before the agent first connects (the instructions come at its start).
  await core((k) => k.shell.task.rename('task-1'));
  await sam(core);
  await showResources(ui, 'Agents');
  const tabs = () => terminalRows(ui);
  const shown = async () => (await taskPage(ui)).locator('[data-testid="terminal"] .xterm:visible').count();
  expect((await mcp()).getInstructions()).toMatch(/shell_run, not in your own shell.*This is the Kulisa task "task-1", working right in the project's folder .* \(no git, so no worktree of its own\)\. Run the app under test on a free port you pick \(Kulisa assigns none\).*Name the task with task_rename once you know what it is about, silently: never ask the human for a name or mention it\. These notes are for you/s);
  expect(await tabs(), "the agent's tab, named after its agent").toEqual(['bash *']);
  // Resources owns the terminal’s creation and switching controls.
  await (await termAdd(ui)).click();
  await expect((await menu(ui))).toMatchAriaSnapshot(`
    - menu:
      - menuitem "Terminal"`);
  await choose(ui, 'Terminal');
  await expect.poll(tabs).toEqual(['bash', 'Terminal *']);
  const human = await terminal(core, 'Terminal');
  expect(await core((k) => (k.shell.task.terminal('Terminal') as DevelopmentTerminal).by)).toBe('human');
  // A shell in front: no dictation (it is the shown agent's), the bar kept, its microphone disabled saying why; a pick
  // still goes to the agent shown last.
  const mic = (await taskPage(ui)).locator('[aria-label="Speak to the agent"]');
  await expect(mic).toBeDisabled();
  expect(await mic.getAttribute('title')).toBe("Dictation is the agent's: a shell is in front");
  expect(await core((k) => k.shell.task.promptTarget().agent.cli)).toBe('bash');
  await expect.poll(shown).toBe(1);
  await expect((await taskPage(ui)).locator('.xterm:focus-within')).toHaveCount(1);

  // The agent's: its environment (KULISA_TASK), behind (the human watches what is in front), read back as plain text.
  const ready = WIN ? 'echo "ready in $env:KULISA_TASK"; sleep 30' : 'echo "ready in $KULISA_TASK"; sleep 30';
  expect((await call('shell_run', { name: 'dev server', command: ready })).text).toMatch(/^Started in terminal "dev server"/);
  const dev = await terminal(core, 'dev server');
  await expect.poll(async () => (await call('shell_read', { name: 'dev server' })).text).toContain('ready in task-1');
  expect(await tabs(), 'behind').toEqual(['bash', 'Terminal *', 'dev server']);
  expect(await shown()).toBe(1);
  // Laid out while behind, it does not make the window scrollable: the agent's state on its tab (the tasks' bar brings
  // its tab into view) had moved the grid up by a window's height.
  // As the bar brings a tab into view (scrollIntoView, which scrolls whatever can): Playwright's scrollIntoViewIfNeeded
  // leaves a tab already in view.
  await ui.locator('#taskTabs [role="tab"]').first().evaluate((t) => t.scrollIntoView());
  expect(await ui.evaluate(() => [document.documentElement.scrollTop, document.documentElement.scrollHeight <= innerHeight])).toEqual([0, true]);
  expect((await call('shell_read', {})).text).toBe(`"Terminal" (the human's)\n"dev server" (an agent's): ${ready}`);
  await expect(call('shell_stop', { name: 'nope' })).rejects.toThrow(/no terminal "nope"; open now: "Terminal", "dev server"/);
  // An agent's tab is no terminal to run in, read or stop: a command there would be a message to that agent.
  for (const [tool, args] of [['shell_run', { command: 'hi' }], ['shell_read', {}], ['shell_stop', { close: true }]] as const) {
    await expect(call(tool, { name: 'bash', ...args })).rejects.toThrow(/"bash" is an agent's tab, not a terminal to run in: read what it did in task_history/);
  }
  expect(await tabs()).toEqual(['bash', 'Terminal *', 'dev server']);

  // Stopped: Ctrl+C, the shell stays; the same name again types into it (PowerShell shows no ^C: its answer at once,
  // not after the sleep, says the command stopped).
  await call('shell_stop', { name: 'dev server' });
  if (!WIN) await expect.poll(async () => (await call('shell_read', { name: 'dev server', lines: 3 })).text).toContain('^C');
  expect((await call('shell_run', { name: 'Dev Server', command: 'echo again' })).text).toMatch(/^Typed into terminal "dev server"/);
  await expect.poll(async () => (await call('shell_read', { name: 'dev server' })).text).toMatch(/^again$/m);
  // Read as the screen shows it: lines a program redraws in place (a progress, a container's state) are what they
  // became. Read from the output with its codes left out, every frame was there, and filled the lines asked for.
  await call('shell_run', { name: 'dev server', command: WIN ? 'Write-Host "bundle 30%`nwrite`n$([char]27)[2A$([char]27)[2Kbundle done`n$([char]27)[2Kwritten"'
    : String.raw`printf 'bundle 30%%\nwrite\n\033[2A\033[2Kbundle done\n\033[2Kwritten\n'` });
  await expect.poll(async () => (await call('shell_read', { name: 'dev server' })).text).toMatch(/^written$/m);
  expect((await call('shell_read', { name: 'dev server' })).text).not.toMatch(/^(bundle 30%|write)$/m);
  // A click on a tab brings it to the front.
  await (await taskPage(ui)).locator(`[data-task-view][data-active] [data-resources] [data-terminal="${dev.id}"]`).getByRole('button', { name: 'dev server', exact: true }).click();
  await expect.poll(tabs).toEqual(['bash', 'Terminal', 'dev server *']);
  // Closed by the agent: its tab and its process go; the tab next to it comes to the front.
  const pid = await core((k) => (k.shell.task.terminal('dev server') as DevelopmentTerminal).pty.pid);
  await call('shell_stop', { name: 'dev server', close: true });
  await expect.poll(tabs).toEqual(['bash', 'Terminal *']);
  await expect.poll(() => { try { process.kill(pid, 0); return false; } catch { return true; } }).toBe(true);
  // A shell that exits closes its terminal; × closes the human's.
  await call('shell_run', { name: 'once', command: 'exit' });
  await expect.poll(() => core((k) => !!(k.shell.task.terminal('once') as DevelopmentTerminal).error && k.shell.task.developmentTerminals.size === 2)).toBe(true);
  await (await taskPage(ui)).locator(`[data-task-view][data-active] [data-resources] [data-terminal="${human.id}"] [title^="Close"]`).click();
  await expect.poll(() => developmentTerminals(core)).toBe(1);
  await expect.poll(tabs).toEqual(['bash *']);
  expect(await core((k) => k.shell.task.promptTarget().pty === k.shell.pty), "the agent's in front again, still running").toBe(true);
  await expect(mic).toBeEnabled();
});

test("the window's page is sandboxed (no Node in it), its bridge to the main process works", async ({ core, ui }) => {
  expect(await core((k) => k.noNode(k.shell.windows[0].focusUi))).toBe(true);
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
    // The empty window can finish shutdown before the lock request returns; the saved log below proves notification.
    expect(quit.out(), `first process: ${first.out()}\n${first.err()}`).toMatch(/asked the one running with .* to quit|none running with/);
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

test('icon buttons have a name', async ({ core, ui }) => {
  await sam(core);
  for (const page of [ui, await taskPage(ui)]) for (const button of await page.getByRole('button').all()) await expect(button).toHaveAccessibleName(/\S/);
});

test("the app icon: in the top bar (not on macOS: the Dock's)", async ({ ui }) => {
  const logo = ui.getByTestId('title-logo');
  if (MAC) await expect(logo, 'macOS apps show their icon in the Dock, not by the window buttons').toHaveCount(0);
  else {
    const drawn = logo.locator('svg[data-logo]');
    await expect(drawn).toHaveCount(1);
  }
});

test("one row on top: no menu bar, OS window buttons over the top bar; on macOS the system's, Settings… (⌘,) in it", async ({ core, ui, sui }) => {
  // macOS: the menu bar is the system's, at the screen's top, always there: Kulisa's own there (app.ts), Settings… in
  // its app menu as Mac apps have it.
  if (MAC) {
    expect(await core((k) => {
      const m = k.electron.Menu.getApplicationMenu(), item = m.items[0].submenu.items.find((i) => i.label === 'Settings…');
      return { roles: m.items.map((i) => i.role), accelerator: item?.accelerator };
    })).toEqual({ roles: ['appmenu', 'editmenu', 'windowmenu'], accelerator: 'Command+,' });
    try {
      await core((k) => k.electron.Menu.getApplicationMenu().items[0].submenu.items.find((i) => i.label === 'Settings…').click(undefined, k.shell.win, undefined));
      await expect((await sui()).getByRole('navigation', { name: 'Settings' })).toBeAttached();
    } finally { await closeSettings(core, ui, sui); }
  } else expect(await core((k) => k.shell.win.isMenuBarVisible())).toBe(false);
  expect(await ui.evaluate(() => (navigator as any).windowControlsOverlay.visible)).toBe(true);
  const b = await ui.locator('#topbar').boundingBox(), bar = { top: b.y, height: b.height, right: b.x + b.width };
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

test('screenshot of the whole window, profile views included', async ({ core, files }) => {
  test.skip(!await core((k) => k.canShoot()), NO_SHOT);
  await core(async (k, url) => { await k.ensureProfile('Sam', url); }, `${SITE}/tall`);
  await expect.poll(() => core((k) => k.profile('Sam').view.getVisible())).toBe(true);
  const file = path.join(files.root, 'window.png');
  // capturePage can return a valid PNG while omitting native profile views. Sample the red fixture inside one;
  // the desktop capture may arrive before the page paints, and its pixels can be scaled relative to the window.
  await expect.poll(() => core(async (k, f) => {
    const profile = k.profile('Sam'), tab = profile.get(), parent = profile.view.getBounds(), child = tab.view.getBounds();
    const bounds = { x: parent.x + child.x, y: parent.y + child.y };
    const box = await tab.wc.executeJavaScript('(() => { const b = document.getElementById("box").getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()') as { x: number; y: number };
    await k.shell.screenshot(f);
    const image = k.electron.nativeImage.createFromPath(f), size = image.getSize();
    const [width, height] = k.shell.win.getContentSize(), zoom = tab.wc.getZoomFactor();
    const x = Math.round((bounds.x + box.x * zoom) * size.width / width), y = Math.round((bounds.y + box.y * zoom) * size.height / height);
    const [b, g, r] = image.crop({ x, y, width: 1, height: 1 }).toBitmap();
    return { red: r > 180 && g < 60 && b < 60, pixel: [r, g, b] };
  }, file), { message: 'the screenshot includes the red block in the native profile page' }).toMatchObject({ red: true });
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
  await expect(shortcutsDialog(ui)).toBeVisible();
  let dimmed = plain; // the screen catches up with the page a frame later
  await expect.poll(async () => { dimmed = await pixels('buttons-dialog.png'); return dimmed.bar[0] < plain.bar[0]; }).toBe(true);
  expect(near(dimmed), `dimmed as the bar: ${JSON.stringify(dimmed)}`).toBe(true);
  await shortcutsDialog(ui).getByRole('button', { name: 'Close' }).click();
  await expect(shortcutsDialog(ui)).toHaveCount(0);
});

test("theme: Dark by default, Light or System in ☰; the window, the terminal, the OS buttons and an empty tab follow, the pages keep the OS's; saved", async ({ core, ui, files }) => {
  await sam(core);
  await core((k) => k.profile('Sam').newTab(null).ready); // an empty tab, in front
  // The theme's panels' color (--card, src/ui/theme.css) as a canvas draws it, the terminal's (xterm's own option: it
  // draws on a canvas), the one chosen in ☰, the controls' own scheme (color-scheme).
  const BACKGROUND = { dark: 'rgba(23, 23, 23, 1)', light: 'rgba(255, 255, 255, 1)' };
  const background = () => ui.evaluate(() => {
    const c = new OffscreenCanvas(1, 1).getContext('2d');
    c.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--card');
    c.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = c.getImageData(0, 0, 1, 1).data;
    return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
  });
  const looks = async (shade: 'dark' | 'light', chosen: string, scheme: string = shade) => {
    await expect.poll(background).toBe(BACKGROUND[shade]);
    await expect.poll(async () => (await taskPage(ui)).evaluate(() => (window as any).__term.options.theme.background)).toBe(BACKGROUND[shade]);
    const theme = (await menuPage(ui)).getByRole('menu', { name: 'Theme', exact: true });
    await expect(theme.getByRole('menuitemradio', { checked: true })).toHaveCount(1);
    await expect(theme.locator(`[data-theme="${chosen}"]`)).toHaveAttribute('aria-checked', 'true');
    await expect(ui.locator('#topbar')).toHaveCSS('color-scheme', scheme);
    await expect.poll(() => core((k) => k.profile('Sam').get().wc.executeJavaScript('getComputedStyle(document.documentElement).backgroundColor')), 'the empty tab: the pane under it')
      .toBe(BACKGROUND[shade].replace(/^rgba\((.*), 1\)$/, 'rgb($1)'));
  };
  const pageDark = () => core((k) => k.profile('Sam').get().wc.executeJavaScript(`matchMedia('(prefers-color-scheme: dark)').matches`) as Promise<boolean>);
  const osDark = await pageDark();
  const saved = () => files.json('settings.json').theme;
  const themes = await windowSubmenu(ui, 'Theme');
  await looks('dark', 'dark');
  const pick = async (t: string, shade: 'dark' | 'light', scheme: string = shade) => {
    await themes.locator(`[data-theme="${t}"]`).click();
    await looks(shade, t, scheme);
    await expect(themes, 'the menu stays open: the next one can be tried').toBeVisible();
    expect(saved(), 'saved').toBe(t);
  };
  await pick('light', 'light');
  expect(await pageDark(), "a site under test keeps the OS's scheme").toBe(osDark);
  await pick('system', await core((k) => k.electron.nativeTheme.shouldUseDarkColors) ? 'dark' : 'light', 'light dark'); // the OS's, as the pages'
  await pick('dark', 'dark');
  expect(await pageDark()).toBe(osDark);
  await (await inputPage(ui)).keyboard.press('Escape');
  await closeMenu(ui);
});

test("the tasks' bar stays below the grid after restoring an obsolete Top preference", async ({ core, files, restart }) => {
  const settings = path.join(files.userData, 'settings.json');
  fs.writeFileSync(settings, JSON.stringify({ ...files.json('settings.json'), bar: 'top' }));
  const ui = await restart();
  await sam(core);
  await expect.poll(() => ui.evaluate(() => {
    const bar = document.querySelector('#taskbar').getBoundingClientRect();
    const workspace = document.querySelector('#workspace').getBoundingClientRect();
    const title = document.querySelector('#topbar').getBoundingClientRect();
    return { belowGrid: Math.round(bar.top - workspace.bottom), bottom: Math.round(innerHeight - bar.bottom),
      belowTitle: Math.round(workspace.top - title.bottom), titleHeight: Math.round(title.height) };
  })).toEqual({ belowGrid: 0, bottom: 0, belowTitle: 0, titleHeight: 44 });
  await expect.poll(() => viewOn(core, ui, files, 'Sam')).toBe(true);
  await ui.locator('#windowMenu').click();
  await expect((await menu(ui)).getByRole('menuitem', { name: 'Tasks bar', exact: true })).toHaveCount(0);
  await closeMenu(ui);
});

test('Settings hides shell controls without resizing the task workspace', async ({ core, ui, sui }) => {
  await sam(core);
  const bounds = () => ui.evaluate(() => ['#workspace', '#taskbar'].map((selector) =>
    document.querySelector(selector).getBoundingClientRect().toJSON()));
  const before = await bounds(), native = await core((k) => k.shell.task.view.group.getBounds());
  await ui.locator('#settingsButton').click();
  try {
    await expect((await sui()).getByRole('navigation', { name: 'Settings' })).toBeVisible();
    await expect(ui.locator('#workspace')).toHaveCSS('visibility', 'hidden');
    await expect(ui.locator('#taskbar')).toHaveCSS('visibility', 'hidden');
    await expect.poll(() => ui.locator('#taskbar button').evaluateAll((buttons) =>
      buttons.filter((button) => button.checkVisibility({ visibilityProperty: true })).length)).toBe(0);
    expect(await bounds()).toEqual(before);
    expect(await core((k) => k.shell.task.view.group.getBounds())).toEqual(native);
    await expect(ui.locator('#topbar')).toBeVisible();
  } finally { await closeSettings(core, ui, sui); }
  await expect(ui.locator('#newTask')).toBeVisible();
  await expect.poll(bounds).toEqual(before);
});

test("dialogs: shadcn's, in the shell only while open, above live pages; a question is asked in one", async ({ core, ui }) => {
  await sam(core);
  // Each opened as the human opens it, looked at, closed: a closed one leaves nothing in the page (no memory kept).
  const view = () => core((k) => k.profile('Sam').view.getVisible());
  const covered = () => core((k) => { const w = k.shell.windows[0]; return w.shellCovered && w.win.contentView.children.at(-1) === w.shellView && k.profile('Sam').view.getVisible(); });
  const fromMenu = async (row: string, at?: string) => {
    if (at) await rightClick(ui, at); else await ui.locator('#windowMenu').click();
    await expect((await menu(ui))).toBeVisible();
    await choose(ui, row);
  };
  const openers: [string, () => Promise<void>][] = [
    ['Rename Task', () => fromMenu('Rename…', '#taskTabs [role="tab"]')],
    ['Keyboard Shortcuts', () => fromMenu('Keyboard Shortcuts')],
  ];
  await expect(ui.locator('[role="dialog"], [role="alertdialog"]'), 'none in the page while closed').toHaveCount(0);
  for (const [name, open] of openers) {
    await open();
    const d = ui.getByRole('dialog', { name });
    await expect(d).toBeVisible();
    await expect(d.getByRole('heading', { name })).toBeVisible();
    await expect.poll(covered, `${name}: the shell covers live pages`).toBe(true);
    await (await inputPage(ui)).keyboard.press('Escape');
    await expect(d).toHaveCount(0);
    await expect.poll(view).toBe(true);
  }
  await expect(ui.locator('[role="dialog"], [role="alertdialog"]')).toHaveCount(0);

  // A question before deleting: the title, what goes line by line, Cancel (focused) and Delete.
  const ask = ui.getByRole('alertdialog');
  // The question's answer kept in the main process, to be read once given.
  const asking = (q: Question) => core((k, a) => { k.stash.answer = k.shell.ask(a); }, q);
  const answered = () => core((k) => k.stash.answer as Promise<boolean | 'other'>);
  await asking({ message: 'Delete the thing?', ok: 'Delete', danger: true, detail: 'Deleted for good:\n• a\n• b' });
  await expect(ask).toBeVisible();
  await expect(ask.getByRole('heading')).toHaveText('Delete the thing?');
  expect(await ask.locator(`#${await ask.getAttribute('aria-describedby')}`).innerText(), 'line by line').toBe('Deleted for good:\n• a\n• b');
  await expect(ask.getByRole('button').last()).toHaveText('Delete');
  await expect(ask.getByRole('button', { name: 'Cancel' })).toBeFocused();
  expect(await covered(), 'the shell covers live pages').toBe(true);
  await core((k) => k.press(k.shell.windows[0].focusUi, 'Escape'));
  expect(await answered(), 'Esc says no').toBe(false);
  await expect.poll(view).toBe(true);

  // Two at once: the second waits for the first.
  await asking({ message: 'Initialize it?', ok: 'Initialize' });
  await core((k) => { k.stash.second = k.shell.ask({ message: 'Delete the other?', ok: 'Delete', danger: true }); });
  await expect(ask.getByRole('heading')).toHaveText('Initialize it?');
  await ask.getByRole('button', { name: 'Initialize' }).click();
  expect(await answered()).toBe(true);
  await expect(ask.getByRole('heading')).toHaveText('Delete the other?');
  await ask.getByRole('button', { name: 'Cancel' }).click();
  expect(await core((k) => k.stash.second as Promise<boolean | 'other'>), 'Cancel says no').toBe(false);
});

test("About Kulisa (☰) is a page of Settings: the versions, and the folders Kulisa writes in on this computer, each shown in the file manager, one not made yet told so", async ({ core, ui, sui, files }) => {
  const pkg = JSON.parse(fs.readFileSync(path.join(CHECKOUT, 'package.json'), 'utf8'));
  await ui.locator('#windowMenu').click();
  await choose(ui, 'About Kulisa');
  const shown = async () => {
    const s = await sui();
    await expect(navRow(s, 'about')).toHaveAttribute('aria-current', 'page');
    await expect(s.getByRole('heading', { name: /^Kulisa / })).toBeVisible();
    return s;
  };
  const s = await shown();
  await expect(s.getByRole('heading', { name: /^Kulisa / })).toHaveText(`Kulisa ${pkg.version}`);
  const versions = await core(() => ({ electron: process.versions.electron, chrome: process.versions.chrome }));
  await expect(s.getByText(`Agentic IDE · Electron ${versions.electron} · Chromium ${versions.chrome} · kulisa.app · GPL-3.0-or-later`, { exact: true })).toBeVisible();
  // Each folder: its path, and its button to show it, told so and off when it is not made yet.
  const projectsHome = path.join(files.root, 'KulisaProjects'), made = fs.existsSync(projectsHome);
  const folders = s.locator('[data-folder]');
  await expect(folders).toHaveCount(3);
  for (const [i, [id, dir, there]] of ([['data', files.userData, true], ['projects', projectsHome, made], ['program', CHECKOUT, true]] as const).entries()) {
    await expect(folders.nth(i)).toHaveAttribute('data-folder', id);
    await expect(folders.nth(i).getByRole('textbox')).toHaveValue(dir);
    await expect(folders.nth(i).getByRole('textbox')).toBeEnabled({ enabled: there });
    const show = folders.nth(i).getByRole('button');
    await expect(show).toHaveAccessibleName(there ? 'Show in your file manager' : 'Not made yet');
    await expect(show).toBeEnabled({ enabled: there });
  }
  // Show: the folder in the file manager, by its id (the window names no path).
  await core((k) => {
    const g = k.stash;
    g.openPath = k.electron.shell.openPath; g.shownDirs = [];
    k.electron.shell.openPath = async (dir: string) => { g.shownDirs.push(dir); return ''; };
  });
  try {
    await s.locator('[data-folder="data"]').getByRole('button', { name: 'Show in your file manager' }).click();
    await expect.poll(() => core((k) => k.stash.shownDirs.length)).toBe(1);
  } finally { await core((k) => { k.electron.shell.openPath = k.stash.openPath; }); }
  expect(await core((k) => k.stash.shownDirs)).toEqual([files.userData]);
  await closeSettings(core, ui, sui);
  if (MAC) {
    expect(await core((k) => k.electron.Menu.getApplicationMenu().items[0].submenu.items[0].label), 'first in the app menu, where Mac apps have it').toBe('About Kulisa');
    try {
      await core((k) => k.electron.Menu.getApplicationMenu().items[0].submenu.items[0].click(undefined, k.shell.win, undefined));
      await shown();
    } finally { await closeSettings(core, ui, sui); }
  }
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
    const asked = ui.getByRole('alertdialog');
    await install('9.9.9');
    await expect(asked).toBeVisible({ timeout: 10000 }); // the archive's change, noticed
    await expect(asked.getByRole('button')).toHaveText(['Later', 'Restart']);
    const q = await answer(ui, false);
    expect(q.message).toBe('Kulisa 9.9.9 is ready');
    expect(q.detail).toMatch(/Restart to use it: the windows, their tasks and conversations come back\. Later: the next start is 9\.9\.9\.$/);
    expect(await restarted(), 'Later: nothing').toBeNull();
    // Prime the cache for Linux's in-place updates; Windows locks an archive cached by Electron.
    if (process.platform === 'linux') {
      expect(await core(async (_k, archive) => {
        const fs = await import('node:fs');
        return JSON.parse(fs.readFileSync(`${archive}/package.json`, 'utf8')).version;
      }, asar)).toBe('9.9.9');
    }
    // Restart: the way to quit that keeps everything, then the new version.
    await install('9.9.10');
    await expect(asked).toBeVisible({ timeout: 10000 });
    expect((await answer(ui)).message).toBe('Kulisa 9.9.10 is ready');
    await expect.poll(restarted).toBe('relaunch');
  } finally {
    await core((k) => { k.shell.restart = k.stash.restart; });
    await removed(src);
  }
});

test("tooltips of the title bar and the tasks' bar open beside their buttons, never over the pages, which would cover them", async ({ core, ui, files }) => {
  await sam(core);
  await arrange(ui, 'left'); // the page down to the tasks' bar
  await invoke(ui, 'zoom:ui', 1); // the zoom's reset shown
  await expect(ui.locator('#zoomReset')).toBeVisible();
  const over = async (button: Locator) => {
    await button.hover();
    const t = ui.getByRole('tooltip');
    await expect(t).toBeVisible();
    const b = await t.boundingBox();
    await ui.mouse.move(0, 300);
    await expect(t).toHaveCount(0);
    // The page's bounds are the window's (DIP); the tooltip's, the Kulisa-zoomed page's.
    await expect.poll(() => viewOn(core, ui, files, 'Sam'), { timeout: 3000 }).toBe(true);
    const page = await core((k) => k.shell.task.view.group.getBounds()), z = await invoke(ui, 'zoom:get') as number;
    return b.x * z < page.x + page.width && (b.x + b.width) * z > page.x && b.y * z < page.y + page.height && (b.y + b.height) * z > page.y;
  };
  // The sidebar's tooltip omits the key, which is shown in the sidebar's heading.
  const sidebarButton = ui.locator('#taskbar').getByRole('button', { name: 'Projects and tasks' });
  await sidebarButton.hover();
  await expect(ui.getByRole('tooltip')).toHaveText('Projects and tasks');
  await ui.mouse.move(0, 300);
  await expect(ui.getByRole('tooltip')).toHaveCount(0);
  for (const button of [ui.locator('#newTask'), ui.locator('#zoomReset'), ui.locator('#settingsButton'), sidebarButton])
    expect(await over(button), `${button}`).toBe(false);
  await invoke(ui, 'zoom:ui', 0);
});
