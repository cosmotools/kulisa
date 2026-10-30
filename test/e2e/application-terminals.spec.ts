// Human and agent operate the same interactive application in the testing stage.
import fs from 'fs';
import path from 'path';
import { test, expect } from './fixtures.ts';
import { newTask } from './tasks-helpers.ts';
import { invoke, answer, frames, notLoading } from './helpers.ts';

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

test('a CLI task needs no browser: human and agent see, operate, resize and restart an application terminal', async ({ core, ui, files, call }, info) => {
  await notLoading(ui);
  expect(await core((k) => k.shell.task.profiles.size)).toBe(0);
  await expect(ui.getByTestId('stage')).toHaveCount(0);
  const agent = await core((k) => k.shell.task.front);
  fs.writeFileSync(path.join(files.project, 'application-tui.cjs'), tui);
  await ui.getByRole('button', { name: 'Application Terminal', exact: true }).click();
  const pane = ui.locator('[data-application]').filter({ has: ui.getByRole('textbox', { name: 'Application name' }) });
  await expect(ui.getByTestId('stage')).toBeVisible();
  await expect(pane).toHaveAttribute('data-state', 'stopped');
  await pane.getByRole('textbox', { name: 'Launch command' }).fill('node application-tui.cjs');
  await pane.getByRole('button', { name: 'Start application', exact: true }).click();
  const screen = async () => JSON.parse((await call('application_read', { name: 'Application 1' })).text);
  await expect.poll(async () => (await screen()).text).toContain('Choice 1');
  await call('application_input', { name: 'Application 1', key: 'ArrowDown' });
  await expect.poll(async () => (await screen()).text).toContain('Choice 2');
  await pane.locator('.xterm-helper-textarea').press('ArrowUp');
  await expect.poll(async () => (await screen()).text).toContain('Choice 1');
  await call('application_input', { name: 'Application 1', text: 'hello', paste: true });
  await expect.poll(async () => (await screen()).text).toContain('Choice 42');
  await pane.getByRole('spinbutton', { name: 'Terminal columns' }).fill('10000');
  await pane.getByRole('button', { name: 'Resize', exact: true }).click();
  await expect(pane.getByRole('alert')).toHaveText('Terminal size must be 2–500 columns and 2–200 rows.');
  await call('application_configure', { name: 'Application 1', size: { cols: 60, rows: 12 } });
  await expect.poll(async () => (await screen()).text).toContain('Size 60x12');
  await expect(pane.getByRole('spinbutton', { name: 'Terminal columns' })).toHaveValue('60');
  await expect(pane.getByRole('alert')).toHaveCount(0);
  await expect(pane.locator('.xterm-rows > div')).toHaveCount(12);
  await frames(ui);
  const shot = info.outputPath('application-stage.png');
  await core((k, file) => k.shot(file), shot);
  await info.attach('application stage', { path: shot, contentType: 'image/png' });
  await call('application_stop', { name: 'Application 1' });
  expect((await screen()).terminal.status).toBe('stopped');
  expect((await screen()).text).toContain('Choice 42');
  await call('application_restart', { name: 'Application 1' });
  await expect.poll(async () => (await screen()).text).toContain('Choice 1');
  await call('application_input', { name: 'Application 1', key: 'Enter' });
  await expect.poll(async () => (await screen()).terminal.exitCode).toBe(7);
  await expect(pane.getByRole('status')).toHaveText('Exited (7)');
  expect(await core((k) => k.shell.task.front), 'development terminal stays selected').toBe(agent);
  await call('application_close', { name: 'Application 1' });
  await expect(ui.getByTestId('stage')).toHaveCount(0);
});

test('reopening restores launch setup and fixed size without running the application', async ({ files, call, restart }) => {
  fs.writeFileSync(path.join(files.project, 'application-once.cjs'), `require('fs').appendFileSync('application-starts.txt', 'start\\n'); console.log('finished'); process.exit(9);`);
  await call('application_create', { name: 'Once', command: 'node application-once.cjs' });
  await call('application_configure', { name: 'Once', size: { cols: 72, rows: 18 } });
  await call('application_start', { name: 'Once' });
  await expect.poll(async () => JSON.parse((await call('application_read', { name: 'Once' })).text).terminal.exitCode).toBe(9);
  const next = await restart();
  await notLoading(next);
  await expect(next.locator('[data-application]')).toHaveAttribute('data-state', 'stopped');
  const list = JSON.parse((await call('application_read')).text);
  expect(list).toHaveLength(1);
  expect(list[0]).toMatchObject({ name: 'Once', command: 'node application-once.cjs', size: { cols: 72, rows: 18 }, status: 'stopped', exitCode: null });
  expect(fs.readFileSync(path.join(files.project, 'application-starts.txt'), 'utf8')).toBe('start\n');
  await next.getByRole('button', { name: 'Start application', exact: true }).click();
  await expect.poll(async () => JSON.parse((await call('application_read', { name: 'Once' })).text).terminal.exitCode).toBe(9);
  expect(fs.readFileSync(path.join(files.project, 'application-starts.txt'), 'utf8')).toBe('start\nstart\n');
  await call('application_close', { name: 'Once' });
});

test('screen parsing keeps redraws, bounds scrollback, and refuses input into development terminals', async ({ core, files, call }) => {
  fs.writeFileSync(path.join(files.project, 'application-output.cjs'), `for (let i=0; i<800; i++) console.log('line ' + i); process.stdout.write('old progress\\rnew progress');`);
  await call('application_create', { name: 'Output', command: 'node application-output.cjs' });
  await call('application_start', { name: 'Output' });
  const read = async () => JSON.parse((await call('application_read', { name: 'Output', scrollback: true, lines: 500 })).text);
  await expect.poll(async () => (await read()).terminal.status).toBe('exited');
  const r = await read();
  expect(r.text).toContain('line 799');
  expect(r.text).toContain('new progress');
  expect(r.text).not.toContain('old progress');
  expect(r.text).not.toMatch(/^line 0$/m);
  expect(r.text.split('\n').length).toBeLessThanOrEqual(500);
  const own = await core((k) => k.shell.task.label(k.shell.task.promptTarget()));
  await expect(call('application_input', { name: own, text: 'wrong target' })).rejects.toThrow(/No application terminal/);
  await expect(call('application_configure', { name: 'Output', size: { cols: 10000, rows: 30 } })).rejects.toThrow(/Terminal size/);
  await expect(call('application_input', { name: 'Output', key: 'Enter' })).rejects.toThrow(/not running/);
  await call('application_close', { name: 'Output' });
});

test('closing a terminal stops its process and removes its saved configuration and buffers', async ({ core, ui, files, call }) => {
  fs.writeFileSync(path.join(files.project, 'application-process.cjs'), `console.log('PID ' + process.pid); setInterval(() => {}, 1000);`);
  await call('application_create', { name: 'Process', command: 'node application-process.cjs' });
  await call('application_start', { name: 'Process' });
  let pid = 0;
  await expect.poll(async () => { pid = Number(JSON.parse((await call('application_read', { name: 'Process' })).text).text.match(/PID (\d+)/)?.[1]); return pid > 0; }).toBe(true);
  await call('application_close', { name: 'Process' });
  await expect.poll(() => { try { process.kill(pid, 0); return true; } catch { return false; } }).toBe(false);
  expect(await core((k) => k.shell.task.store.applications().list)).toEqual([]);
  await expect(ui.getByTestId('stage')).toHaveCount(0);
});

test('browser and terminal environments share the stage; hiding the outer stage hides native browser views', async ({ core, ui, files, call }) => {
  fs.writeFileSync(path.join(files.project, 'application-stage.cjs'), tui);
  await call('application_create', { name: 'Alongside browser', command: 'node application-stage.cjs' });
  await call('application_start', { name: 'Alongside browser' });
  await call('profile_create', { name: 'Stage.browser' });
  await expect(ui.locator('[data-panel^="profile:"]')).toHaveCount(1);
  await expect.poll(() => core((k) => k.profile('Stage.browser').get().view.getVisible())).toBe(true);
  // Dockview's API moves the outer panel as a header drop would; its nested grid stays independent.
  await ui.evaluate(() => {
    const api = (window as any).__dock;
    api.getPanel('stage').api.moveTo({ group: api.getPanel('terminal').group, position: 'center' });
    api.getPanel('terminal').api.setActive();
  });
  await expect.poll(() => core((k) => k.profile('Stage.browser').get().view.getVisible())).toBe(false);
  expect(JSON.parse((await call('application_read', { name: 'Alongside browser' })).text).terminal.status).toBe('running');
  await ui.locator('[data-panel="stage"]').getByText('Stage', { exact: true }).click();
  await expect.poll(() => core((k) => k.profile('Stage.browser').get().view.getVisible())).toBe(true);
  await call('application_close', { name: 'Alongside browser' });
  await expect(ui.getByTestId('stage')).toBeVisible();
  await call('profile_close', { profile: 'Stage.browser' });
  await expect(ui.getByTestId('stage')).toHaveCount(0);
});

test('input follows terminal modes and large reads become bounded task artifacts', async ({ core, ui, files, call }) => {
  fs.writeFileSync(path.join(files.project, 'application-keys.cjs'), `
    process.stdin.setRawMode(true); process.stdin.resume();
    process.stdout.write('\\x1b[?1hREADY');
    process.stdin.on('data', d => console.log('key:' + d.toString('hex')));
  `);
  await call('application_create', { name: 'Keys', command: 'node application-keys.cjs' });
  await call('application_start', { name: 'Keys' });
  const read = async () => JSON.parse((await call('application_read', { name: 'Keys' })).text);
  await expect.poll(async () => (await read()).text).toContain('READY');
  await call('application_input', { name: 'Keys', key: 'ArrowDown' });
  await expect.poll(async () => (await read()).text).toContain('key:1b4f42');
  await call('application_input', { name: 'Keys', key: 'Ctrl+R' });
  await expect.poll(async () => (await read()).text).toContain('key:12');
  await call('application_input', { name: 'Keys', key: 'F2' });
  await expect.poll(async () => (await read()).text).toContain('key:1b4f51');
  expect((await read()).cursor).toMatchObject({ column: expect.any(Number), row: expect.any(Number) });
  await call('application_close', { name: 'Keys' });
  fs.writeFileSync(path.join(files.project, 'application-large.cjs'), `for(let i=0;i<500;i++) console.log('row ' + i + ': ' + 'x'.repeat(190));`);
  await call('application_create', { name: 'Large', command: 'node application-large.cjs' });
  await call('application_configure', { name: 'Large', size: { cols: 220, rows: 24 } });
  await call('application_start', { name: 'Large' });
  await expect.poll(async () => JSON.parse((await call('application_read', { name: 'Large' })).text).terminal.status).toBe('exited');
  const result = JSON.parse((await call('application_read', { name: 'Large', scrollback: true, lines: 500 })).text);
  expect(result.file).toBeTruthy();
  expect(result.text.length).toBeLessThanOrEqual(2000);
  expect(fs.readFileSync(result.file, 'utf8')).toContain('row 499:');
  const source = await core(async (k, file) => (await k.shell.task.findArtifact(file) as { artifact: { source: unknown } }).artifact.source, result.file);
  expect(source).toMatchObject({ kind: 'application' });
  await expect(ui.locator('#resources').getByRole('button', { name: 'Terminal screen', exact: true })).toBeVisible();
  await call('task_artifacts_delete', { files: [result.file] });
  expect(fs.existsSync(result.file)).toBe(false);
  await call('application_close', { name: 'Large' });
});

test('deleting a task stops its applications and removes their configuration', async ({ core, ui, files, call }) => {
  const key = await newTask(core, ui, 'application-cleanup');
  fs.writeFileSync(path.join(files.project, 'application-cleanup.cjs'), `console.log('PID ' + process.pid); setInterval(() => {}, 1000);`);
  await call('application_create', { name: 'Owned process', command: 'node application-cleanup.cjs' });
  await call('application_start', { name: 'Owned process' });
  let pid = 0;
  await expect.poll(async () => { pid = Number(JSON.parse((await call('application_read', { name: 'Owned process' })).text).text.match(/PID (\d+)/)?.[1]); return pid > 0; }).toBe(true);
  const config = await core((k) => k.shell.task.store.file('applications.json'));
  expect(fs.existsSync(config)).toBe(true);
  const deletion = invoke(ui, 'task:delete', key);
  await answer(ui);
  await deletion;
  await expect.poll(() => fs.existsSync(config)).toBe(false);
  await expect.poll(() => { try { process.kill(pid, 0); return true; } catch { return false; } }).toBe(false);
});

test('a background terminal answers device queries and keeps Unicode cursor widths when shown', async ({ core, ui, files, call }) => {
  const first = await core((k) => k.shell.task.key);
  fs.writeFileSync(path.join(files.project, 'application-query.cjs'), `
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
  await call('application_create', { name: 'Query', command: 'node application-query.cjs' });
  await newTask(core, ui, 'other-task');
  await call('application_start', { name: 'Query' }, { task: first });
  const read = async () => JSON.parse((await call('application_read', { name: 'Query' }, { task: first })).text);
  await expect.poll(async () => (await read()).text).toContain('reply 1');
  await expect.poll(async () => (await read()).text).toContain('color 1');
  await invoke(ui, 'task:show', first);
  await expect(ui.locator('[data-application]')).toHaveCount(1);
  await call('application_input', { name: 'Query', text: 'ask' });
  await expect.poll(async () => (await read()).text).toContain('reply 2');
  await expect.poll(async () => (await read()).text).toContain('color 2');
  await call('application_input', { name: 'Query', text: 'finished' });
  await expect.poll(async () => (await read()).terminal.status).toBe('exited');
  expect((await read()).text).toContain('final replies 2, colors 2');
  fs.writeFileSync(path.join(files.project, 'application-unicode.cjs'), `process.stdout.write('\\x1b[H\\x1b[2J✅⏵✻'); process.stdin.resume();`);
  await call('application_restart', { name: 'Query', command: 'node application-unicode.cjs' });
  await expect.poll(async () => (await read()).text).toContain('✅⏵✻');
  const visible = await ui.locator('[data-application]').getAttribute('data-application');
  expect(visible).toBeTruthy();
  const r = await read();
  expect(r.cursor.column).toBe(5);
  await call('application_close', { name: 'Query' });
});


test('the agent arranges terminal-only environments as a column, tabs or a scrolling row', async ({ core, ui, call }) => {
  expect(await core((k) => k.shell.task.profiles.size)).toBe(0);
  await call('application_create', { name: 'Layout first' });
  await call('application_create', { name: 'Layout second' });
  await call('stage_arrange', { layout: 'vertical' });
  await expect.poll(() => ui.evaluate(() => (window as any).__stage.groups.length)).toBe(2);
  await call('stage_arrange', { layout: 'tabs' });
  await expect.poll(() => ui.evaluate(() => (window as any).__stage.groups.length)).toBe(1);
  await ui.locator('#windowMenu').click();
  await ui.getByRole('menuitem', { name: 'Stage beside', exact: true }).click();
  await call('stage_arrange', { layout: 'horizontal', overflow: true });
  await expect.poll(() => ui.locator('[data-stage-viewport]').evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await call('stage_arrange', { overflow: false });
  await expect.poll(() => ui.locator('[data-stage-viewport]').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await core((k) => k.shell.task.profiles.size)).toBe(0);
  await call('application_close', { name: 'Layout first' });
  await call('application_close', { name: 'Layout second' });
});
