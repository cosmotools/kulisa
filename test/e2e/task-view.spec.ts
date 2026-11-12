import { taskPage } from './pages.ts';
// Task geometry, initial layout restoration and delayed native-menu coverage.
import { test, expect } from './fixtures.ts';
import { invoke, notLoading, ipcSettled, frames } from './helpers.ts';
import { newTask } from './tasks-helpers.ts';

test('a hidden task receives resized bounds and fits its grid when shown', async ({ core, ui }) => {
  await notLoading(ui);
  const first = await core((k) => k.shell.task.key), retained = await taskPage(ui);
  const width = await retained.evaluate(() => (window as any).__dock.width as number);
  const second = await newTask(core, ui);
  const size = await core((k) => k.shell.win.getSize());
  const nativeWidth = await core((k, key) => k.shell.taskByKey(key).view.group.getBounds().width, first);
  try {
    await core((k, size) => k.shell.win.setSize(size[0] - 100, size[1]), size);
    await expect.poll(() => core((k, key) => k.shell.taskByKey(key).view.group.getBounds().width, first)).toBe(nativeWidth - 100);
    await invoke(ui, 'task:show', first); await notLoading(ui);
    await expect.poll(() => retained.evaluate(() => (window as any).__dock.width)).toBe(width - 100);
  } finally {
    await core((k, size) => k.shell.win.setSize(size[0], size[1]), size);
    await invoke(ui, 'task:show', first); await notLoading(ui);
    await invoke(ui, 'task:close', second);
  }
});

test('Stage arrangement during initial layout loading survives restoration', async ({ core, ui, call }) => {
  await notLoading(ui);
  const original = await core((k) => k.shell.task.key);
  const first = await newTask(core, ui);
  await call('profile_create', { name: 'Retained.arrange' });
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
    await invoke(ui, 'stage:arrange', { task: first, position: 'right' });
    await invoke(ui, 'stage:arrange', { task: first, layout: 'tabs' });
    await core((k) => k.stash.taskViewLoad.release());
    await ipcSettled(ui);
    await notLoading(ui);
    await frames(ui);
    const stage = await (await taskPage(ui)).getByTestId('stage').boundingBox(), development = await (await taskPage(ui)).locator('[data-development-grid]').boundingBox();
    expect(stage.x).toBeGreaterThanOrEqual(development.x + development.width - 1);
  } finally {
    await core((k) => {
      const pending = k.stash.taskViewLoad;
      pending.store.layout = pending.read; pending.release(); delete k.stash.taskViewLoad;
    });
    await invoke(ui, 'task:show', original); await notLoading(ui);
    await invoke(ui, 'task:close', first);
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
  await (await taskPage(ui)).locator('[data-profile]').first().getByRole('button', { name: 'More', exact: true }).click();
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
