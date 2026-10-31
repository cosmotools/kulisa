// Human and agent operate the same interactive CLI in Stage.
import fs from 'fs';
import path from 'path';
import { sizeText } from '../../src/shared/bytes.ts';
import { test, expect } from './fixtures.ts';
import { newTask } from './tasks-helpers.ts';
import { invoke, answer, choose, frames, notLoading, focusWindow } from './helpers.ts';

const tui = `
process.stdin.setRawMode(true);
process.stdin.resume();
let choice = 1;
process.stdout.write('\\x1b[?1049h\\x1b[?2004h');
function draw() { process.stdout.write('\\x1b[H\\x1b[2JChoice ' + choice + '\\r\\nSize ' + process.stdout.columns + 'x' + process.stdout.rows + '\\r\\nPID ' + process.pid); }
process.stdin.on('data', d => {
  const s = d.toString();
  if (s === '\\x1b[B') choice++;
  if (s === '\\x1b[A') choice--;
  if (s === '\\r') process.exit(7);
  if (s.includes('hello')) choice = 42;
  draw();
});
process.stdout.on('resize', draw);
draw();
`;

test('a CLI task needs no browser: human and agent see, operate, resize and restart a Stage terminal', async ({ core, ui, files, call }, info) => {
  await notLoading(ui);
  expect(await core((k) => k.shell.task.profiles.size)).toBe(0);
  await expect(ui.getByTestId('stage')).toHaveCount(0);
  const agent = await core((k) => k.shell.task.front);
  fs.writeFileSync(path.join(files.project, 'terminal-tui.cjs'), tui);
  await focusWindow(core, ui);
  await ui.getByRole('button', { name: 'Stage Terminal', exact: true }).click();
  const pane = ui.locator('[data-stage-terminal]');
  await expect(ui.getByTestId('stage')).toBeVisible();
  await expect(pane).toHaveAttribute('data-state', 'running');
  await expect(pane.locator('.xterm-helper-textarea')).toBeFocused();
  await pane.locator('.xterm-helper-textarea').pressSequentially('echo stage-shell-ready');
  await pane.locator('.xterm-helper-textarea').press('Enter');
  await expect.poll(async () => JSON.parse((await call('terminal_read', { name: 'Terminal 1' })).text).text).toMatch(/(^|\n)stage-shell-ready(\r?\n|$)/);
  await ui.getByRole('button', { name: 'Terminal menu' }).click();
  await choose(ui, 'Settings…');
  const settings = ui.getByRole('dialog', { name: 'Terminal Settings' });
  await settings.getByRole('textbox', { name: 'Launch command' }).fill('node terminal-tui.cjs');
  await settings.getByRole('button', { name: 'Save', exact: true }).click();
  await ui.getByRole('button', { name: 'Terminal menu' }).click();
  await choose(ui, 'Run app');
  await expect(pane.locator('.xterm-helper-textarea')).toBeFocused();
  const screen = async () => JSON.parse((await call('terminal_read', { name: 'Terminal 1' })).text);
  await expect.poll(async () => (await screen()).text).toContain('Choice 1');
  await expect(ui.getByRole('button', { name: 'Restart app', exact: true })).toBeVisible();
  await call('terminal_input', { name: 'Terminal 1', key: 'ArrowDown' });
  await expect.poll(async () => (await screen()).text).toContain('Choice 2');
  await pane.locator('.xterm-helper-textarea').press('ArrowUp');
  await expect.poll(async () => (await screen()).text).toContain('Choice 1');
  await call('terminal_input', { name: 'Terminal 1', text: 'hello', paste: true });
  await expect.poll(async () => (await screen()).text).toContain('Choice 42');
  await call('terminal_resize', { name: 'Terminal 1', size: { cols: 60, rows: 12 } });
  await expect.poll(async () => (await screen()).text).toContain('Size 60x12');
  await ui.getByRole('button', { name: 'Terminal menu' }).click();
  await choose(ui, 'Settings…');
  await expect(settings.getByRole('spinbutton', { name: 'Columns', exact: true })).toHaveValue('60');
  await expect(settings.getByRole('spinbutton', { name: 'Rows', exact: true })).toHaveValue('12');
  await settings.getByRole('button', { name: 'Cancel', exact: true }).click();
  const screenHeight = async () => (await pane.locator('.xterm-screen').boundingBox()).height;
  const twelveRows = await screenHeight();
  await call('terminal_resize', { name: 'Terminal 1', size: { cols: 60, rows: 24 } });
  await expect.poll(screenHeight).toBeCloseTo(twelveRows * 2, 0);
  await call('terminal_resize', { name: 'Terminal 1', size: { cols: 60, rows: 12 } });
  await expect.poll(screenHeight).toBeCloseTo(twelveRows, 0);
  await frames(ui);
  const shot = info.outputPath('terminal-stage.png');
  await core((k, file) => k.shot(file), shot);
  await info.attach('terminal stage', { path: shot, contentType: 'image/png' });
  await call('terminal_stop', { name: 'Terminal 1' });
  expect((await screen()).terminal.status).toBe('stopped');
  expect((await screen()).text).toContain('Choice 42');
  await call('terminal_run', { name: 'Terminal 1', command: 'node terminal-tui.cjs' });
  await expect.poll(async () => (await screen()).text).toContain('Choice 1');
  await call('terminal_input', { name: 'Terminal 1', key: 'Enter' });
  await expect.poll(async () => (await screen()).terminal.exitCode).toBe(7);
  await expect(ui.locator('[data-panel^="stage-terminal:"]').getByRole('status')).toHaveText('Exited (7)');
  expect(await core((k) => k.shell.task.front), 'development terminal stays selected').toBe(agent);
  await call('terminal_close', { name: 'Terminal 1' });
  await expect(ui.getByTestId('stage')).toHaveCount(0);
});

test('selected Stage output is pasted into the agent draft with its terminal name and without submitting', async ({ core, ui, call }) => {
  await notLoading(ui);
  await call('terminal_run', { name: 'Evidence', command: 'node -e "console.log(\'traceback-marker\')"' });
  await expect.poll(async () => JSON.parse((await call('terminal_read', { name: 'Evidence' })).text).terminal.status).toBe('exited');
  await core(async (k) => {
    const pty = k.shell.task.promptTarget().pty;
    await pty.typed;
    k.stash.selectionWrites = [];
    k.stash.selectionWrite = pty.write;
    pty.write = (text) => { k.stash.selectionWrites.push(text); };
  });
  try {
    const pane = ui.locator('[data-stage-terminal]');
    await pane.click({ button: 'right' });
    await choose(ui, 'Select all');
    await pane.click({ button: 'right' });
    await choose(ui, 'Send selection to agent');
    const pasted = await core((k) => k.stash.selectionWrites.filter((s: string) => s.startsWith('\x1b[200~')));
    expect(pasted).toHaveLength(1);
    expect(pasted[0]).toContain('[kulisa selection: terminal "Evidence"]');
    expect(pasted[0]).toContain('> traceback-marker');
    expect(pasted[0]).toMatch(/\x1b\[201~$/);
  } finally {
    await core((k) => { k.shell.task.promptTarget().pty.write = k.stash.selectionWrite; });
    await call('terminal_close', { name: 'Evidence' });
  }
});

test('a manually opened Stage shell comes back ready for commands after restarting Kulisa', async ({ ui, call, restart }) => {
  await notLoading(ui);
  await ui.getByRole('button', { name: 'Stage Terminal', exact: true }).click();
  await expect(ui.locator('[data-stage-terminal]')).toHaveAttribute('data-state', 'running');
  const next = await restart();
  await notLoading(next);
  await expect(next.locator('[data-stage-terminal]')).toHaveAttribute('data-state', 'running');
  const read = async () => JSON.parse((await call('terminal_read', { name: 'Terminal 1' })).text);
  await expect.poll(async () => (await read()).text.trim()).not.toBe('');
  await call('terminal_input', { name: 'Terminal 1', text: 'node -e "console.log(6*7)"' });
  await call('terminal_input', { name: 'Terminal 1', key: 'Enter' });
  await expect.poll(async () => (await read()).text).toMatch(/(^|\n)42(\r?\n|$)/);
  await call('terminal_close', { name: 'Terminal 1' });
});

test('reopening restores launch setup and fixed size without running the CLI', async ({ files, call, restart }) => {
  fs.writeFileSync(path.join(files.project, 'terminal-once.cjs'), `require('fs').appendFileSync('terminal-starts.txt', 'start\\n'); console.log('finished'); process.exit(9);`);
  await call('terminal_run', { name: 'Once', command: 'node terminal-once.cjs', size: { cols: 72, rows: 18 } });
  await expect.poll(async () => JSON.parse((await call('terminal_read', { name: 'Once' })).text).terminal.exitCode).toBe(9);
  const next = await restart();
  await notLoading(next);
  await expect(next.locator('[data-stage-terminal]')).toHaveAttribute('data-state', 'running');
  const list = JSON.parse((await call('terminal_read')).text);
  expect(list).toHaveLength(1);
  expect(list[0]).toMatchObject({ name: 'Once', command: 'node terminal-once.cjs', size: { cols: 72, rows: 18 }, status: 'running', exitCode: null, session: 'shell' });
  expect(fs.readFileSync(path.join(files.project, 'terminal-starts.txt'), 'utf8')).toBe('start\n');
  await call('terminal_input', { name: 'Once', text: 'node -e "console.log(6*7)"' });
  await call('terminal_input', { name: 'Once', key: 'Enter' });
  await expect.poll(async () => JSON.parse((await call('terminal_read', { name: 'Once' })).text).text).toMatch(/(^|\n)42(\r?\n|$)/);
  await next.getByRole('button', { name: 'Terminal menu' }).click();
  await choose(next, 'Run app');
  await expect.poll(async () => JSON.parse((await call('terminal_read', { name: 'Once' })).text).terminal.exitCode).toBe(9);
  expect(fs.readFileSync(path.join(files.project, 'terminal-starts.txt'), 'utf8')).toBe('start\nstart\n');
  await call('terminal_close', { name: 'Once' });
});

test('screen parsing keeps redraws, bounds scrollback, and refuses input into development terminals', async ({ core, files, call }) => {
  fs.writeFileSync(path.join(files.project, 'terminal-output.cjs'), `for (let i=0; i<800; i++) console.log('line ' + i); process.stdout.write('old progress\\rnew progress');`);
  await call('terminal_run', { name: 'Output', command: 'node terminal-output.cjs' });
  const read = async () => JSON.parse((await call('terminal_read', { name: 'Output', scrollback: true, lines: 500 })).text);
  await expect.poll(async () => (await read()).terminal.status).toBe('exited');
  const r = await read();
  expect(r.text).toContain('line 799');
  expect(r.text).toContain('new progress');
  expect(r.text).not.toContain('old progress');
  expect(r.text).not.toMatch(/^line 0$/m);
  expect(r.text.split('\n').length).toBeLessThanOrEqual(500);
  const own = await core((k) => k.shell.task.label(k.shell.task.promptTarget()));
  await expect(call('terminal_input', { name: own, text: 'wrong target' })).rejects.toThrow(/No Stage terminal/);
  await expect(call('terminal_resize', { name: 'Output', size: { cols: 10000, rows: 30 } })).rejects.toThrow(/Terminal size/);
  await expect(call('terminal_input', { name: 'Output', key: 'Enter' })).rejects.toThrow(/not running/);
  await call('terminal_close', { name: 'Output' });
});

test('closing a terminal stops its process and removes its saved configuration and buffers', async ({ core, ui, files, call }) => {
  fs.writeFileSync(path.join(files.project, 'terminal-process.cjs'), `console.log('PID ' + process.pid); setInterval(() => {}, 1000);`);
  await call('terminal_run', { name: 'Process', command: 'node terminal-process.cjs' });
  let pid = 0;
  await expect.poll(async () => { pid = Number(JSON.parse((await call('terminal_read', { name: 'Process' })).text).text.match(/PID (\d+)/)?.[1]); return pid > 0; }).toBe(true);
  await call('terminal_close', { name: 'Process' });
  await expect.poll(() => { try { process.kill(pid, 0); return true; } catch { return false; } }).toBe(false);
  expect(await core((k) => k.shell.task.store.stageTerminals().list)).toEqual([]);
  await expect(ui.getByTestId('stage')).toHaveCount(0);
});

test('Stop is repeatable and a stopped terminal keeps its screen until closed', async ({ call }) => {
  await call('terminal_run', { name: 'Stop twice', command: 'node -e "console.log(\'still readable\'); process.stdin.resume()"' });
  const read = async () => JSON.parse((await call('terminal_read', { name: 'Stop twice' })).text);
  await expect.poll(async () => (await read()).text).toContain('still readable');
  await call('terminal_stop', { name: 'Stop twice' });
  await call('terminal_stop', { name: 'Stop twice' });
  expect((await read()).terminal.status).toBe('stopped');
  expect((await read()).text).toContain('still readable');
  await call('terminal_close', { name: 'Stop twice' });
  expect(JSON.parse((await call('terminal_read')).text)).toEqual([]);
});

test('browser and terminal environments share Stage positions and tabs without restarting the CLI', async ({ core, ui, files, call }) => {
  fs.writeFileSync(path.join(files.project, 'terminal-stage.cjs'), tui);
  await call('terminal_run', { name: 'Alongside browser', command: 'node terminal-stage.cjs' });
  await call('profile_create', { name: 'Stage.browser' });
  await expect(ui.locator('[data-panel^="profile:"]')).toHaveCount(1);
  await expect.poll(() => core((k) => k.profile('Stage.browser').get().view.getVisible())).toBe(true);
  const read = async () => JSON.parse((await call('terminal_read', { name: 'Alongside browser' })).text);
  await expect.poll(async () => (await read()).text).toMatch(/PID \d+/);
  const pid = (await read()).text.match(/PID \d+/)![0];
  for (const position of ['left', 'right', 'above']) {
    await call('stage_arrange', { position });
    await expect.poll(() => core((k) => k.profile('Stage.browser').get().view.getVisible())).toBe(true);
    const stage = await ui.getByTestId('stage').boundingBox(), terminal = await ui.getByTestId('terminal').boundingBox();
    expect(stage).toBeTruthy(); expect(terminal).toBeTruthy();
    expect(position === 'above' ? stage.y < terminal.y : position === 'left' ? stage.x < terminal.x : stage.x > terminal.x).toBe(true);
  }
  await call('stage_arrange', { layout: 'tabs' });
  await expect.poll(() => ui.evaluate(() => (window as any).__stage.groups.length)).toBe(1);
  await ui.locator('[data-panel^="stage-terminal:"]').getByText('Alongside browser', { exact: true }).click();
  await expect.poll(() => core((k) => k.profile('Stage.browser').get().view.getVisible())).toBe(false);
  expect((await read()).terminal.status).toBe('running');
  expect((await read()).text).toContain(pid);
  await ui.locator('[data-panel^="profile:"]').getByText('Stage.browser', { exact: true }).click();
  await expect.poll(() => core((k) => k.profile('Stage.browser').get().view.getVisible())).toBe(true);
  await call('terminal_close', { name: 'Alongside browser' });
  await expect(ui.getByTestId('stage')).toBeVisible();
  await call('profile_close', { profile: 'Stage.browser' });
  await expect(ui.getByTestId('stage')).toHaveCount(0);
});

test('input follows terminal modes and large reads become bounded task artifacts', async ({ core, ui, files, call }) => {
  fs.writeFileSync(path.join(files.project, 'terminal-keys.cjs'), `
    process.stdin.setRawMode(true); process.stdin.resume();
    process.stdout.write('\\x1b[?1hREADY');
    process.stdin.on('data', d => console.log('key:' + d.toString('hex')));
  `);
  await call('terminal_run', { name: 'Keys', command: 'node terminal-keys.cjs' });
  const read = async () => JSON.parse((await call('terminal_read', { name: 'Keys' })).text);
  await expect.poll(async () => (await read()).text).toContain('READY');
  await call('terminal_input', { name: 'Keys', key: 'ArrowDown' });
  await expect.poll(async () => (await read()).text).toContain('key:1b4f42');
  await call('terminal_input', { name: 'Keys', key: 'Ctrl+R' });
  await expect.poll(async () => (await read()).text).toContain('key:12');
  await call('terminal_input', { name: 'Keys', key: 'F2' });
  await expect.poll(async () => (await read()).text).toContain('key:1b4f51');
  expect((await read()).cursor).toMatchObject({ column: expect.any(Number), row: expect.any(Number) });
  await call('terminal_close', { name: 'Keys' });
  fs.writeFileSync(path.join(files.project, 'terminal-large.cjs'), `for(let i=0;i<500;i++) console.log('row ' + i + ': ' + 'x'.repeat(190));`);
  await call('terminal_run', { name: 'Large', command: 'node terminal-large.cjs', size: { cols: 220, rows: 24 } });
  await expect.poll(async () => JSON.parse((await call('terminal_read', { name: 'Large' })).text).terminal.status).toBe('exited');
  const result = JSON.parse((await call('terminal_read', { name: 'Large', scrollback: true, lines: 500 })).text);
  expect(result.file).toBeTruthy();
  expect(result.text.length).toBeLessThanOrEqual(2000);
  expect(fs.readFileSync(result.file, 'utf8')).toContain('row 499:');
  const source = await core(async (k, file) => (await k.shell.task.findArtifact(file) as { artifact: { source: unknown } }).artifact.source, result.file);
  expect(source).toMatchObject({ kind: 'stage-terminal' });
  const artifact = ui.locator('#resources').getByRole('button', { name: 'Terminal screen', exact: true });
  await expect(artifact).toBeVisible();
  await expect(artifact).toContainText('Large');
  await expect(artifact).toContainText(sizeText(fs.statSync(result.file).size));
  await artifact.hover();
  await ui.locator('#resources').getByRole('button', { name: 'Delete Terminal screen', exact: true }).click();
  await expect.poll(() => fs.existsSync(result.file)).toBe(false);
  await call('terminal_close', { name: 'Large' });
});

test('deleting a task stops its Stage terminals and removes their configuration', async ({ core, ui, files, call }) => {
  const key = await newTask(core, ui, 'terminal-cleanup');
  fs.writeFileSync(path.join(files.project, 'terminal-cleanup.cjs'), `console.log('PID ' + process.pid); setInterval(() => {}, 1000);`);
  await call('terminal_run', { name: 'Owned process', command: 'node terminal-cleanup.cjs' });
  let pid = 0;
  await expect.poll(async () => { pid = Number(JSON.parse((await call('terminal_read', { name: 'Owned process' })).text).text.match(/PID (\d+)/)?.[1]); return pid > 0; }).toBe(true);
  const config = await core((k) => k.shell.task.store.file('task.json'));
  expect(fs.existsSync(config)).toBe(true);
  const deletion = invoke(ui, 'task:delete', key);
  await answer(ui);
  await deletion;
  await expect.poll(() => fs.existsSync(config)).toBe(false);
  await expect.poll(() => { try { process.kill(pid, 0); return true; } catch { return false; } }).toBe(false);
});

test('a background terminal answers device queries and keeps Unicode cursor widths when shown', async ({ core, ui, files, call }) => {
  const first = await core((k) => k.shell.task.key);
  fs.writeFileSync(path.join(files.project, 'terminal-query.cjs'), `
    process.stdin.setRawMode(true); process.stdin.resume(); let replies = 0, colors = 0;
    process.stdin.on('data', d => {
      const s = d.toString();
      if (s.includes('ask')) process.stdout.write('\\x1b[5n\\x1b]11;?\\x07');
      else if (s.includes('finished')) { console.log('final replies ' + replies + ', colors ' + colors); process.exit(0); }
      else {
        if (s.includes('\\x1b[0n')) { replies++; console.log('reply ' + replies); }
        if (s.includes('\\x1b]11;')) { colors++; console.log('color ' + colors); }
      }
    });
    process.stdout.write('\\x1b[5n\\x1b]11;?\\x07');
  `);
  await newTask(core, ui, 'other-task');
  await call('terminal_run', { name: 'Query', command: 'node terminal-query.cjs' }, { task: first });
  const read = async () => JSON.parse((await call('terminal_read', { name: 'Query' }, { task: first })).text);
  await expect.poll(async () => (await read()).text).toContain('reply 1');
  await expect.poll(async () => (await read()).text).toContain('color 1');
  await invoke(ui, 'task:show', first);
  await expect(ui.locator('[data-stage-terminal]')).toHaveCount(1);
  await call('terminal_input', { name: 'Query', text: 'ask' });
  await expect.poll(async () => (await read()).text).toContain('reply 2');
  await expect.poll(async () => (await read()).text).toContain('color 2');
  await call('terminal_input', { name: 'Query', text: 'finished' });
  await expect.poll(async () => (await read()).terminal.status).toBe('exited');
  expect((await read()).text).toContain('final replies 2, colors 2');
  fs.writeFileSync(path.join(files.project, 'terminal-unicode.cjs'), `process.stdout.write('\\x1b[H\\x1b[2J✅⏵✻'); process.stdin.resume();`);
  await call('terminal_run', { name: 'Query', command: 'node terminal-unicode.cjs' });
  await expect.poll(async () => (await read()).text).toContain('✅⏵✻');
  const visible = await ui.locator('[data-stage-terminal]').getAttribute('data-stage-terminal');
  expect(visible).toBeTruthy();
  const r = await read();
  expect(r.cursor.column).toBe(5);
  await call('terminal_close', { name: 'Query' });
});


test('the agent arranges terminal-only environments as vertical stacks, tabs or scrolling horizontal stacks', async ({ core, ui, call }) => {
  expect(await core((k) => k.shell.task.profiles.size)).toBe(0);
  await call('terminal_run', { name: 'Layout first', command: 'node --version' });
  await call('terminal_run', { name: 'Layout second', command: 'node --version' });
  await call('stage_arrange', { layout: 'vertical' });
  await expect.poll(() => ui.evaluate(() => (window as any).__stage.groups.length)).toBe(2);
  await call('stage_arrange', { layout: 'tabs' });
  await expect.poll(() => ui.evaluate(() => (window as any).__stage.groups.length)).toBe(1);
  await ui.getByRole('button', { name: 'Stage', exact: true }).click();
  await ui.getByRole('menuitemradio', { name: 'Left', exact: true }).click();
  await call('stage_arrange', { layout: 'horizontal', overflow: true });
  await expect.poll(() => ui.locator('[data-stage-viewport]').evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await call('stage_arrange', { overflow: false });
  await expect.poll(() => ui.locator('[data-stage-viewport]').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await core((k) => k.shell.task.profiles.size)).toBe(0);
  await call('terminal_close', { name: 'Layout first' });
  await call('terminal_close', { name: 'Layout second' });
});

test('run creates or reuses a named terminal and validates before replacing its process', async ({ ui, files, call }) => {
  fs.writeFileSync(path.join(files.project, 'terminal-rerun.cjs'), `console.log('PID ' + process.pid + ' ' + process.argv[2]); process.stdin.resume();`);
  await expect(call('terminal_run', { name: 'Rerun', command: '   ' })).rejects.toThrow(/Supply a command/);
  await expect(call('terminal_run', { name: 'Rerun', command: 'node terminal-rerun.cjs old', size: { cols: 1, rows: 10 } })).rejects.toThrow(/Terminal size/);
  expect(JSON.parse((await call('terminal_read')).text)).toEqual([]);
  const first = JSON.parse((await call('terminal_run', { name: 'Rerun', command: 'node terminal-rerun.cjs old', size: { cols: 64, rows: 12 } })).text);
  const read = async () => JSON.parse((await call('terminal_read', { name: 'Rerun' })).text);
  await expect.poll(async () => (await read()).text).toMatch(/PID \d+ old/);
  const pid = Number((await read()).text.match(/PID (\d+) old/)![1]);
  await expect(call('terminal_run', { name: 'Rerun', command: '   ' })).rejects.toThrow(/Supply a command/);
  await expect(call('terminal_run', { name: 'Rerun', command: 'node terminal-rerun.cjs new', size: { cols: 1, rows: 10 } })).rejects.toThrow(/Terminal size/);
  expect((await read()).terminal).toMatchObject({ command: 'node terminal-rerun.cjs old', status: 'running' });
  expect((await read()).text).toContain(`PID ${pid} old`);
  const second = JSON.parse((await call('terminal_run', { name: 'rerun', command: 'node terminal-rerun.cjs new' })).text);
  expect(second).toMatchObject({ id: first.id, size: { cols: 64, rows: 12 } });
  await expect(ui.locator('[data-stage-terminal]')).toHaveCount(1);
  await expect.poll(async () => (await read()).text).toMatch(/PID \d+ new/);
  expect((await read()).text).not.toContain(`PID ${pid} old`);
  await expect.poll(() => { try { process.kill(pid, 0); return true; } catch { return false; } }).toBe(false);
  await call('terminal_resize', { name: 'Rerun', size: null });
  expect((await read()).terminal.size).toBe(null);
  await call('terminal_close', { name: 'Rerun' });
});


test('Stop cancels a restart waiting for shell startup', async ({ core, call }) => {
  // Keep these requests in one main-process turn so even a fast shell is still starting at Stop.
  const results = await core(async (k) => {
    const terminals = k.shell.task.stageTerminals;
    const first = terminals.run('Cancelled restart', 'echo first-launch');
    const restart = terminals.run('Cancelled restart', 'echo unwanted-restart');
    terminals.stop('Cancelled restart');
    return Promise.all([first, restart]);
  });
  expect(results[0]).toHaveProperty('error');
  expect(results[1]).toHaveProperty('error');
  const result = JSON.parse((await call('terminal_read', { name: 'Cancelled restart' })).text);
  expect(result.terminal.status).toBe('stopped');
  expect(result.text).not.toContain('unwanted-restart');
  await call('terminal_close', { name: 'Cancelled restart' });
});
