// Native task isolation and live ownership across shell/task pages (#392).
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from './fixtures.ts';
import { taskPage, shellPage } from './pages.ts';
import { newTask, taskTab } from './tasks-helpers.ts';
import { invoke, notLoading, menu } from './helpers.ts';

test('independent task renderers keep shell navigation live during a finite stall and move without replay', async ({ core, ui, call }) => {
  await notLoading(ui);
  const first = await core((k) => k.shell.task.key);
  const firstPage = await taskPage(ui);
  const second = await newTask(core, ui);
  const secondPage = await taskPage(ui);
  const ids = await core((k, keys) => keys.map((key) => {
    const task = k.shell.taskByKey(key);
    return { wc: task.view.ui.id, pid: task.view.ui.getOSProcessId(), pty: task.pty.pid };
  }), [first, second]);
  expect(new Set(ids.map((i) => i.pid)).size).toBe(2);
  expect(await core((k) => k.shell.windows[0].ui.getOSProcessId())).not.toBe(ids[0].pid);
  await taskTab(ui, first).click(); await notLoading(ui);
  // A real renderer JS stall; shell input must complete while it is still blocked.
  await firstPage.evaluate(() => { setTimeout(() => { const end = Date.now() + 2000; while (Date.now() < end) {} }, 10); });
  await taskTab(ui, second).click();
  await expect.poll(() => core((k) => k.shell.task.key)).toBe(second);
  await ui.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect((await menu(ui))).toBeVisible();
  await ui.keyboard.press('Escape');
  await invoke(ui, 'task:move', { key: second });
  const moved = await core((k, key) => {
    const task = k.shell.taskByKey(key);
    return { wc: task.view.ui.id, pid: task.view.ui.getOSProcessId(), pty: task.pty.pid, attached: k.viewIn(task.view.group, task.window.win) };
  }, second);
  expect(moved).toEqual({ ...ids[1], attached: true });
  expect(await taskPage(firstPage, second)).toBe(secondPage);
  await call('terminal_run', { name: 'hidden', command: 'node -e "console.log(\'hidden-progress\'); setInterval(()=>{},1000)"' }, { task: first });
  await call('terminal_close', { name: 'hidden' }, { task: first });
  void invoke(await shellPage(secondPage), 'task:close', second).catch(() => {});
  await expect.poll(() => secondPage.isClosed()).toBe(true);
  expect(firstPage.isClosed()).toBe(false);
});

test('a hidden task answers native terminal color queries with default throttling', async ({ core, ui, files, call }) => {
  await notLoading(ui);
  const first = await core((k) => k.shell.task.key);
  fs.writeFileSync(path.join(files.project, 'color-probe.cjs'), `
process.stdin.setRawMode(true); process.stdin.resume();
let replies=0;
process.stdin.on('data', d=>{if(d.includes(Buffer.from('rgb:')))console.log('color-reply-'+(++replies));});
setInterval(()=>process.stdout.write('\\x1b]11;?\\x07'), 250);
`);
  await call('terminal_run', { name: 'colors', command: 'node color-probe.cjs' });
  await expect.poll(async () => JSON.parse((await call('terminal_read', { name: 'colors' })).text).text).toContain('color-reply-1');
  const second = await newTask(core, ui);
  const hidden = await taskPage(ui, first);
  await expect.poll(() => hidden.evaluate(() => document.hidden)).toBe(true);
  await expect.poll(async () => JSON.parse((await call('terminal_read', { name: 'colors' }, { task: first })).text).text).toContain('color-reply-8');
  await call('terminal_resize', { name: 'colors', size: { cols: 77, rows: 17 } }, { task: first });
  await taskTab(ui, first).click(); await notLoading(ui);
  expect(JSON.parse((await call('terminal_read', { name: 'colors' })).text).terminal.size).toEqual({ cols: 77, rows: 17 });
  await call('terminal_close', { name: 'colors' });
  await invoke(ui, 'task:close', second);
});

test('a finite task UI stall delivers a bounded raw terminal burst in order while shell navigation works', async ({ core, ui, files, call }) => {
  await notLoading(ui);
  const first = await core((k) => k.shell.task.key), screen = await taskPage(ui);
  const script = path.join(files.project, 'burst.cjs'), gate = path.join(files.project, 'burst-go');
  fs.writeFileSync(script, `const fs=require('node:fs'); console.log('burst-ready');
const timer=setInterval(()=>{if(!fs.existsSync(${JSON.stringify(gate)}))return;clearInterval(timer);
process.stdout.write('BURST-BEGIN\\r\\n');
for(let n=0;n<4096;n++)process.stdout.write('B'+String(n).padStart(5,'0')+':'+('x'.repeat(112))+'\\r\\n');
process.stdout.write('BURST-END\\r\\n');},10);`);
  await call('terminal_run', { name: 'Burst', command: 'node burst.cjs' });
  const read = async () => JSON.parse((await call('terminal_read', { name: 'Burst' }, { task: first })).text).text;
  await expect.poll(read).toContain('burst-ready');
  const terminal = await core((k) => k.shell.task.stageTerminals.info().find((t) => t.name === 'Burst').key);
  const second = await newTask(core, ui);
  await invoke(ui, 'task:show', first); await notLoading(ui);
  await core((k) => { k.stash.burstStarted = 0; k.electron.ipcMain.once('test:burst:stall', () => { k.stash.burstStarted = Date.now(); }); });
  await screen.evaluate((terminal) => {
    const probe = { phase: 'waiting', pending: '', lines: 0, invalid: false, stalled: false, done: false };
    (window as any).__burst = probe;
    (window as any).kulisa.on('pty:out', ({ task, data }: { task: string; data: string }) => {
      if (task !== terminal) return;
      probe.pending += data;
      let newline: number;
      while ((newline = probe.pending.indexOf('\n')) >= 0) {
        const line = probe.pending.slice(0, newline).replace(/\r+$/, '');
        probe.pending = probe.pending.slice(newline + 1);
        if (line === 'BURST-BEGIN') { probe.phase = 'running'; continue; }
        if (line === 'BURST-END') { probe.done = true; probe.phase = 'done'; continue; }
        if (probe.phase === 'running') {
          if (line !== 'B' + String(probe.lines).padStart(5, '0') + ':' + 'x'.repeat(112)) probe.invalid = true;
          probe.lines++;
        }
      }
    });
    setTimeout(() => { (window as any).kulisa.send('test:burst:stall', null); probe.stalled = true; const until = Date.now() + 2000; while (Date.now() < until) {} }, 10);
  }, terminal);
  // This one-off test observation runs in main while the task's JavaScript is blocked.
  await expect.poll(() => core((k) => k.stash.burstStarted > 0)).toBe(true);
  fs.writeFileSync(gate, 'go');
  await taskTab(ui, second).click();
  expect(await core((k) => Date.now() - k.stash.burstStarted)).toBeLessThan(2000);
  await expect.poll(() => screen.evaluate(() => ({ lines: (window as any).__burst.lines, invalid: (window as any).__burst.invalid, done: (window as any).__burst.done })))
    .toEqual({ lines: 4096, invalid: false, done: true });
  await expect.poll(read).toContain('BURST-END');
  await call('terminal_close', { name: 'Burst' }, { task: first });
  await invoke(ui, 'task:show', first); await notLoading(ui);
  await invoke(ui, 'task:close', second);
});
for (const failure of ['crashed', 'hung'] as const) test(`reloading a ${failure} task screen keeps PTYs, browser identities and accepted Editor input`, async ({ core, ui, call, files }) => {
  await notLoading(ui);
  const key = await newTask(core, ui);
  const profileName = `Recovery.${failure}`;
  await call('profile_create', { name: profileName });
  const file = path.join(files.project, 'crash-edits.txt');
  fs.writeFileSync(file, 'before');
  const before = await core(async (k, file) => {
    const task = k.shell.task;
    await task.editor.execute({ type: 'open', path: file });
    await task.editor.execute({ type: 'edit', path: file, text: 'accepted before process loss' });
    return { wc: task.view.ui.id, renderer: task.view.ui.getOSProcessId(), pid: task.pty.pid, profile: [...task.profiles.values()][0].get().wc.id };
  }, file);
  const screen = await taskPage(ui);
  await core((k, failure) => {
    const wc = k.shell.task.view.ui;
    setImmediate(() => {
      if (failure === 'crashed') wc.forcefullyCrashRenderer();
      else void wc.executeJavaScript('while (true) {}').catch(() => {});
    });
  }, failure);
  if (failure === 'crashed') await expect(ui.getByRole('button', { name: 'Reload task screen', exact: true })).toBeVisible();
  await ui.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(ui.getByRole('menu')).toBeVisible();
  await ui.keyboard.press('Escape');
  // Chromium's unresponsive signal is conditional; recovery stays reachable from the healthy shell.
  await ui.getByRole('tab', { name: await core((k) => k.shell.task.displayName), exact: true }).click({ button: 'right' });
  await ui.getByRole('menuitem', { name: 'Reload task screen', exact: true }).click();
  await expect(ui.getByRole('button', { name: 'Reload task screen', exact: true })).toHaveCount(0);
  // Wait in main first: probing the old hung JS context can leave an executeJavaScript promise pending across reload.
  await expect.poll(() => core((k, previous) => {
    const view = k.shell.task.view;
    return view.ready && view.ui.getOSProcessId() > 0 && view.ui.getOSProcessId() !== previous;
  }, before.renderer)).toBe(true);
  // Playwright keeps a crashed-target latch on this Page. Observe the rebuilt DOM through Electron.
  await expect.poll(() => core(async (k) => {
    const view = k.shell.task.view;
    return view.ready && await view.ui.executeJavaScript('!!document.querySelector("[data-task-screen]:not([aria-busy])")');
  })).toBe(true);
  expect(await taskPage(ui)).toBe(screen);
  expect(await core((k) => ({ wc: k.shell.task.view.ui.id, pid: k.shell.task.pty.pid, profile: [...k.shell.task.profiles.values()][0].get().wc.id })))
    .toEqual({ wc: before.wc, pid: before.pid, profile: before.profile });
  expect(await core(async (k) => {
    const state = await k.shell.task.editor.execute({ type: 'list' });
    return 'document' in state ? state.document?.text : null;
  })).toBe('accepted before process loss');
  await call('profile_close', { profile: profileName }, { task: key });
  await invoke(ui, 'task:close', key);
});

test('a task becoming responsive clears its fallback and restores native layout without reloading', async ({ core, ui, call }) => {
  const key = await newTask(core, ui);
  await call('profile_create', { name: 'Responsive.browser' });
  const screen = await taskPage(ui);
  const identity = () => core((k) => ({ wc: k.shell.task.view.ui.id, pid: k.shell.task.view.ui.getOSProcessId(), pty: k.shell.task.pty.pid }));
  const before = await identity();
  const placed = () => core((k) => !k.shell.task.window.viewsHidden && [...k.shell.task.profiles.values()].every((p) => p.view.getVisible()));
  await expect.poll(placed).toBe(true);
  try {
    // Chromium's hang signal is conditional; exercise its handler deterministically, including a committed fallback.
    await core((k) => { k.shell.task.view.ui.emit('unresponsive'); });
    await expect(ui.getByRole('button', { name: 'Reload task screen', exact: true })).toBeVisible();
    await expect(screen.getByRole('alert')).toContainText('This task’s screen could not be displayed');
    await core((k) => { k.shell.task.view.ui.emit('responsive'); });
    await expect(screen.getByRole('alert')).toHaveCount(0);
    await expect(screen.locator('[data-task-screen]')).toBeVisible();
    await expect.poll(placed).toBe(true);
    // Recovery can also arrive before React commits the failure; native placement must still resume.
    await core((k) => { const wc = k.shell.task.view.ui; wc.emit('unresponsive'); wc.emit('responsive'); });
    await expect(screen.getByRole('alert')).toHaveCount(0);
    await expect.poll(placed).toBe(true);
    await expect(ui.getByRole('button', { name: 'Reload task screen', exact: true })).toHaveCount(0);
    expect(await identity()).toEqual(before);
  } finally { await invoke(ui, 'task:close', key); }
});

test('reloading a task screen refreshes theme, following and shortcut labels from current preferences', async ({ core, ui, call }) => {
  const original = await core((k) => ({ theme: k.shell.theme, follow: k.shell.stageFollow,
    hold: k.shell.store.settings().keys?.['voice.hold'] ?? (process.platform === 'darwin' ? 'MetaRight' : 'ControlRight') }));
  let key: string | undefined;
  try {
    await invoke(ui, 'stage:follow:set', false);
    await invoke(ui, 'keys:set', { id: 'voice.hold', code: 'F9' });
    key = await newTask(core, ui);
    await call('terminal_run', { name: 'Preferences.first', command: 'echo first' });
    await call('terminal_run', { name: 'Preferences.second', command: 'echo second' });
    await call('stage_arrange', { layout: 'tabs' });
    const theme = original.theme === 'light' ? 'dark' : 'light';
    await invoke(ui, 'theme:set', theme);
    await invoke(ui, 'stage:follow:set', true);
    await invoke(ui, 'keys:set', { id: 'voice.hold', code: 'F8' });
    const pid = await core((k) => k.shell.task.view.ui.getOSProcessId());
    await taskTab(ui, key).click({ button: 'right' });
    await ui.getByRole('menuitem', { name: 'Reload task screen', exact: true }).click();
    await expect.poll(() => core((k, previous) => k.shell.task.view.ready && k.shell.task.view.ui.getOSProcessId() !== previous, pid)).toBe(true);
    // Playwright keeps a crashed-target latch; read the reconstructed UI through its native contents.
    await expect.poll(() => core((k) => k.shell.task.view.ui.executeJavaScript(`({
      ready: !!document.querySelector('[data-task-screen]:not([aria-busy])'),
      dark: document.documentElement.classList.contains('dark'), hold: window.keyText('voice.hold')
    })`))).toEqual({ ready: true, dark: theme === 'dark', hold: 'F8' });
    const other = await core(async (k) => {
      const active = await k.shell.task.view.ui.executeJavaScript('window.__stage.activePanel.id');
      return k.shell.task.stageTerminals.info().find((t) => `stage-terminal:${t.id}` !== active);
    });
    await call('terminal_read', { name: other.name });
    await expect.poll(() => core((k) => k.shell.task.view.ui.executeJavaScript('window.__stage.activePanel.id'))).toBe(`stage-terminal:${other.id}`);
  } finally {
    if (key) await invoke(ui, 'task:close', key);
    await invoke(ui, 'theme:set', original.theme);
    await invoke(ui, 'stage:follow:set', original.follow);
    await invoke(ui, 'keys:set', { id: 'voice.hold', code: original.hold });
  }
});

test('task UI actions reject another task identity and unregistered native pages', async ({ core, ui }) => {
  await notLoading(ui);
  const first = await core((k) => k.shell.task.key), screen = await taskPage(ui);
  const second = await newTask(core, ui);
  const denied = { error: 'This UI no longer owns that action.' };
  for (const [channel, value] of [
    ['task:editor', { key: second, action: { type: 'list' } }],
    ['task:reload', second], ['voice:get', second], ['shell:cover', true],
    ['pty:quote-paths', { task: `${second}#1`, paths: ['probe.txt'] }],
  ] as const) {
    expect(await screen.evaluate(([channel, value]) => (window as any).kulisa.invoke(channel, value), [channel, value]), channel).toEqual(denied);
  }
  const result = await core(async (k, { key, preload }) => {
    const page = new k.electron.WebContentsView({ webPreferences: {
      sandbox: true, preload,
    } });
    try {
      await page.webContents.loadURL('about:blank');
      return await page.webContents.executeJavaScript(`kulisa.invoke('task:editor', ${JSON.stringify({ key, action: { type: 'list' } })})`);
    } finally { page.webContents.close(); }
  }, { key: first, preload: path.resolve(import.meta.dirname, '../../src/preload/index.cjs') });
  expect(result).toEqual(denied);
  expect(await core((k) => k.shell.task.key)).toBe(second);
  await invoke(ui, 'task:close', second);
});


