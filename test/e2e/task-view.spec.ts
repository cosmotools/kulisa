// Task screens retain their grids and local UI while another task is shown.
import { test, expect } from './fixtures.ts';
import fs from 'node:fs';
import path from 'node:path';
import { invoke, showResources, notLoading, ipcSettled, frames } from './helpers.ts';
import { begin, keyAt, newTask } from './tasks-helpers.ts';

test('returning to a task keeps its grid instance and expanded Project folders', async ({ core, ui, files, call }) => {
  await begin(core, ui, files, { only: true, columns: true, featureX: call });
  await showResources(ui, 'Project');
  const first = await keyAt(core, 1), second = await keyAt(core, 2);
  fs.mkdirSync(path.join(files.project, 'retained-folder'));
  fs.writeFileSync(path.join(files.project, 'retained-folder', 'kept.txt'), 'retained');
  await ui.getByRole('treeitem', { name: 'retained-folder', exact: true }).click();
  await expect(ui.getByRole('treeitem', { name: 'kept.txt', exact: true })).toBeVisible();
  const original = await ui.evaluate(() => {
    const w = window as any;
    w.__firstGrid = w.__dock;
    w.__firstStage = w.__stage;
    return !!w.__firstGrid && !!w.__firstStage;
  });
  expect(original).toBe(true);
  await invoke(ui, 'task:show', second);
  await notLoading(ui);
  expect(await ui.evaluate(() => (window as any).__dock !== (window as any).__firstGrid), 'tasks own independent live grids').toBe(true);
  const size = await core((k) => k.shell.win.getSize());
  const width = await ui.evaluate(() => (window as any).__firstGrid.width as number);
  try {
    await core((k, size) => k.shell.win.setSize(size[0] - 100, size[1]), size);
    await expect.poll(() => ui.evaluate(() => (window as any).__firstGrid.width), {
      message: 'the outer task host observes resizing even while its contents are skipped',
    }).toBe(width - 100);
  } finally {
    await core((k, size) => k.shell.win.setSize(size[0], size[1]), size);
    await expect.poll(() => ui.evaluate(() => (window as any).__firstGrid.width)).toBe(width);
  }
  await invoke(ui, 'task:show', first);
  await notLoading(ui);
  expect(await ui.evaluate(() => {
    const w = window as any;
    return w.__dock === w.__firstGrid && w.__stage === w.__firstStage;
  }), 'returning reveals the retained development and Stage grids').toBe(true);
  await expect(ui.getByRole('treeitem', { name: 'kept.txt', exact: true }), 'expanded Project folders survive switching').toBeVisible();
});

for (const boundary of ['switch', 'close', 'arrange'] as const) test(`a first layout delayed across ${boundary} belongs to its own task`, async ({ core, ui, call }) => {
  await notLoading(ui);
  const original = await core((k) => k.shell.task.key);
  const first = await newTask(core, ui);
  await call('profile_create', { name: `Retained.${boundary}` });
  const second = await newTask(core, ui);
  await invoke(ui, 'task:close', first);
  await core((k, key) => {
    const store = k.shell.taskByKey(key).store, read = store.layout.bind(store);
    let release: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    k.stash.taskViewLoad = { store, read, release: () => release(), requested: false };
    store.layout = () => { k.stash.taskViewLoad.requested = true; return gate.then(read); };
  }, first);
  try {
    const [id, task] = first.split('/');
    await invoke(ui, 'project:open', { id, task });
    await expect.poll(() => core((k) => k.stash.taskViewLoad.requested)).toBe(true);
    if (boundary === 'switch') await invoke(ui, 'task:show', second);
    else if (boundary === 'close') await invoke(ui, 'task:close', first);
    else {
      await invoke(ui, 'stage:arrange', { task: first, position: 'right' });
      await invoke(ui, 'stage:arrange', { task: first, layout: 'tabs' });
    }
    await core((k) => k.stash.taskViewLoad.release());
    await ipcSettled(ui);
    await notLoading(ui);
    await frames(ui);
    if (boundary === 'arrange') {
      const stage = await ui.locator('[data-task-view][data-active]').getByTestId('stage').boundingBox(), development = await ui.locator('[data-task-view][data-active] [data-development-grid]').boundingBox();
      expect(stage.x).toBeGreaterThanOrEqual(development.x + development.width - 1);
    } else {
      await expect(ui.locator('[data-task-view][data-active]').getByTestId('stage')).toBeHidden();
      expect(await core((k) => k.shell.task.key)).toBe(second);
      if (boundary === 'close') await expect(ui.locator(`[data-task-view="${first}"]`)).toHaveCount(0);
      if (boundary === 'switch') {
        await invoke(ui, 'task:show', first); await notLoading(ui); await frames(ui);
        await expect.poll(() => core((k) => !!k.shell.task.pty)).toBe(true);
      }
    }
  } finally {
    await core((k) => {
      const pending = k.stash.taskViewLoad;
      pending.store.layout = pending.read; pending.release(); delete k.stash.taskViewLoad;
    });
    await invoke(ui, 'task:show', original); await notLoading(ui);
    if (boundary !== 'close') await invoke(ui, 'task:close', first);
    await invoke(ui, 'task:close', second);
  }
});

test('an outgoing menu capture cannot hide a task after switching away and back', async ({ core, ui, call }) => {
  await notLoading(ui);
  const first = await core((k) => k.shell.task.key);
  await call('profile_create', { name: 'MenuCapture.browser' });
  const profile = await core((k) => [...k.shell.task.profiles.values()].find((p) => p.name === 'MenuCapture.browser').id);
  await invoke(ui, 'stage:arrange', { task: first, layout: 'horizontal', position: 'above' });
  const second = await newTask(core, ui);
  await invoke(ui, 'task:show', first); await notLoading(ui);
  await core((k) => {
    const window = k.shell.task.window, pictures = window.pictures;
    let release: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    k.stash.taskViewCapture = { window, pictures, release: () => release(), requested: false, completed: false };
    window.pictures = async () => {
      k.stash.taskViewCapture.requested = true; await gate; k.stash.taskViewCapture.completed = true; return {};
    };
  });
  await ui.locator('#windowMenu').click();
  try {
    await expect.poll(() => core((k) => k.stash.taskViewCapture.requested)).toBe(true);
    await invoke(ui, 'task:show', second);
    await notLoading(ui);
    await invoke(ui, 'task:show', first);
    await notLoading(ui);
    await expect.poll(() => core((k, id) => k.shell.task.profiles.get(id).view.getVisible(), profile)).toBe(true);
    await core((k) => k.stash.taskViewCapture.release());
    await expect.poll(() => core((k) => k.stash.taskViewCapture.completed)).toBe(true);
    await ipcSettled(ui);
    await frames(ui);
    expect(await core((k) => k.shell.task.window.viewsHidden)).toBe(false);
  } finally {
    await core((k) => { const p = k.stash.taskViewCapture; p.release(); p.window.pictures = p.pictures; delete k.stash.taskViewCapture; });
    await core((k, id) => k.shell.task.closeProfile(id), profile);
    await invoke(ui, 'task:close', second);
  }
});

test('a Stage terminal keeps its renderer, output and search state across task switches', async ({ core, ui, call }) => {
  await notLoading(ui);
  const first = await core((k) => k.shell.task.key);
  await call('terminal_run', { name: 'Retained.shell', command: 'node -e "console.log(\'retained-stage\'); setInterval(()=>{},1000)"' });
  const pane = ui.locator('[data-stage-terminal]');
  await pane.locator('.xterm-helper-textarea').focus();
  await pane.locator('.xterm-helper-textarea').press('Control+Shift+F');
  await pane.getByRole('textbox', { name: 'Find in terminal', exact: true }).fill('retained-stage');
  const renderer = await pane.locator('.xterm').elementHandle();
  const key = await core((k) => k.shell.task.stageTerminals.info()[0].key);
  const second = await newTask(core, ui);
  await expect(ui.locator(`[data-task-view="${first}"] .xterm`)).toHaveCount(1);
  expect(await renderer.evaluate((el) => el.isConnected), 'hiding a task keeps its terminal renderer attached').toBe(true);
  await invoke(ui, 'task:show', first);
  await notLoading(ui);
  await expect(pane.getByRole('textbox', { name: 'Find in terminal', exact: true })).toHaveValue('retained-stage');
  expect(await renderer.evaluate((el) => el === document.querySelector('[data-task-view][data-active] [data-stage-terminal] .xterm')),
    'showing a task uses the same terminal renderer').toBe(true);
  expect(await core((k) => k.shell.task.stageTerminals.info()[0].key)).toBe(key);
  expect(JSON.parse((await call('terminal_read', { name: 'Retained.shell' })).text).text).toContain('retained-stage');
  await call('terminal_close', { name: 'Retained.shell' });
  expect(await renderer.evaluate((el) => el.isConnected), 'closing the terminal releases its renderer').toBe(false);
  await renderer.dispose();
  await invoke(ui, 'task:close', second);
});

test('hidden task screens keep their own Resources section and release terminal renderers on close', async ({ core, ui, files, call }) => {
  await begin(core, ui, files, { only: true, columns: true, featureX: call });
  const first = await keyAt(core, 1), second = await keyAt(core, 2);
  await invoke(ui, 'task:show', second);
  await notLoading(ui);
  await showResources(ui, 'Project');
  await invoke(ui, 'task:show', first);
  await notLoading(ui);
  await showResources(ui, 'Agents');
  const original = await ui.getByRole('region', { name: 'Agents', exact: true }).elementHandle();
  await invoke(ui, 'task:show', second);
  await notLoading(ui);
  await expect(ui.getByRole('region', { name: 'Project', exact: true })).toBeVisible();
  await expect(ui.locator('[data-testid="terminal"] .xterm'), 'one development renderer per window').toHaveCount(1);
  await invoke(ui, 'task:show', first);
  await notLoading(ui);
  await expect(ui.getByRole('region', { name: 'Agents', exact: true })).toBeVisible();
  expect(await original.evaluate((el) => el.isConnected), 'the Resources content is retained').toBe(true);
  await invoke(ui, 'task:close', second);
  await expect(ui.locator('[data-task-view]')).toHaveCount(1);
  await original?.dispose();
});
