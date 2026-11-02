// A task's saved grid keeps its sizes while another task is shown.
import { test, expect } from './fixtures.ts';
import { arrange, dock, frames, invoke, ipcSettled, notLoading, stageDock } from './helpers.ts';
import { newTask, showTask } from './tasks-helpers.ts';

test('switching tasks preserves pane sizes and shows only completed layouts', async ({ core, ui, call }) => {
  test.slow(); // Thirty round trips cover both Resources axes and repeated restore rounding.
  await notLoading(ui);
  const first = await core((k) => k.shell.task.key);
  await call('profile_create', { name: 'Switch.browser' });
  await call('profile_create', { name: 'Switch.other' });
  const second = await newTask(core, ui);
  await notLoading(ui);
  const memory = () => core((k) => {
    const processes = k.electron.app.getAppMetrics();
    return { rssKiB: processes.reduce((sum: number, p: { memory: { workingSetSize: number } }) => sum + p.memory.workingSetSize, 0), processes: processes.length };
  });
  const initialMemory = await memory(), switches: number[] = [];
  // Read all boxes together: separate locator reads could straddle a layout frame.
  const observation = await ui.evaluateHandle(() => {
    const read = () => [...document.querySelectorAll('#grid, #resources, [data-stage-viewport], [data-stage-viewport] .dv-groupview')].map((element) => {
      const r = element.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height].map(Math.round);
    });
    const samples: ReturnType<typeof read>[] = [];
    let recording = false, stopped = false;
    const tick = () => {
      if (stopped) return;
      if (recording && !document.querySelector('#dock[aria-busy="true"]')) samples.push(read());
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return { read, start() { samples.length = 0; recording = true; }, finish() { recording = false; return samples; }, stop() { stopped = true; } };
  });
  try {
    const other = await observation.evaluate((o) => o.read());
    await showTask(core, ui, first);
    await notLoading(ui);
    for (const [position, side] of [['above', 'left'], ['left', 'left'], ['right', 'left'], ['above', 'bottom'], ['left', 'bottom']] as const) {
      await arrange(ui, position);
      await dock(ui, (api, side) => {
        const resources = api.getPanel('resources');
        resources.api.moveTo({ group: api.getPanel('terminal').group, position: side });
        resources.api.setSize(side === 'bottom' ? { height: 240 } : { width: 380 });
      }, side);
      await stageDock(ui, (api) => api.panels[0].api.setSize({ width: Math.round(api.width * 0.3) }));
      for (const collapsed of [false, true]) {
        if (collapsed) await ui.getByRole('navigation', { name: 'Resources', exact: true }).getByRole('button', { name: 'Project', exact: true }).click();
        await frames(ui);
        const before = await observation.evaluate((o) => o.read());
        const matches = (sample: number[][], expected: number[][]) => sample.length === expected.length
          && sample.every((rect, i) => rect.every((value, j) => Math.abs(value - expected[i][j]) <= 1));
        for (let repeat = 0; repeat < 3; repeat++) {
          await showTask(core, ui, second);
          await notLoading(ui);
          await frames(ui);
          await observation.evaluate((o) => o.start());
          const started = performance.now();
          await showTask(core, ui, first);
          await notLoading(ui);
          await frames(ui);
          switches.push(performance.now() - started);
          expect(matches(await observation.evaluate((o) => o.read()), before), `${position}, Resources ${side}, ${collapsed ? 'collapsed' : 'expanded'}: pane sizes survive repeated switches`).toBe(true);
          const samples = await observation.evaluate((o) => o.finish());
          expect(samples.length).toBeGreaterThan(0);
          expect(samples.filter((s) => !matches(s, before) && !matches(s, other)), 'every visible frame is a completed task layout').toEqual([]);
        }
        if (collapsed) await ui.getByRole('navigation', { name: 'Resources', exact: true }).getByRole('button', { name: 'Project', exact: true }).click();
      }
    }
    await showTask(core, ui, second);
    await test.info().attach('grid-metrics', { body: JSON.stringify({ switchesMs: switches, initialMemory, finalMemory: await memory() }), contentType: 'application/json' });
  } finally {
    await observation.evaluate((o) => o.stop());
    await observation.dispose();
  }
});

for (const boundary of ['switch', 'close', 'arrange'] as const) test(`a delayed layout load handles ${boundary} without losing task ownership`, async ({ core, ui, call }) => {
  await notLoading(ui);
  const first = await core((k) => k.shell.task.key);
  await call('profile_create', { name: `Delayed.${boundary}` });
  await arrange(ui, 'left');
  const second = await newTask(core, ui);
  await notLoading(ui);
  await core((k, task) => {
    const store = k.shell.taskByKey(task).store, read = store.layout.bind(store);
    let release: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    k.stash.delayedLayout = { store, read, release: () => release(), requested: false };
    store.layout = () => {
      const saved = read();
      k.stash.delayedLayout.requested = true;
      return gate.then(() => saved);
    };
  }, first);
  try {
    await invoke(ui, 'task:show', first);
    await expect.poll(() => core((k) => k.stash.delayedLayout.requested)).toBe(true);
    if (boundary === 'switch') {
      await showTask(core, ui, second);
      await notLoading(ui);
    } else if (boundary === 'close') {
      await invoke(ui, 'project:task:close-all', { id: first.split('/')[0] });
      await expect(ui.locator('#dock')).toHaveCount(0);
    } else {
      await invoke(ui, 'stage:arrange', { task: first, position: 'right' });
    }
    await expect(ui.getByTestId('stage')).toHaveCount(0);
    await core((k) => k.stash.delayedLayout.release());
    await ipcSettled(ui);
    await frames(ui);
    if (boundary === 'arrange') {
      await expect(ui.getByTestId('stage')).toBeVisible();
      await expect.poll(async () => {
        const stage = await ui.getByTestId('stage').boundingBox(), development = await ui.locator('#grid').boundingBox();
        return stage.x >= development.x + development.width - 1;
      }).toBe(true);
    } else await expect(ui.getByTestId('stage'), 'the previous task cannot publish its profiles or layout').toHaveCount(0);
    if (boundary === 'close') {
      await expect(ui.locator('#dock')).toHaveCount(0);
      await showTask(core, ui, second);
      await notLoading(ui);
      await expect(ui.getByTestId('stage')).toHaveCount(0);
    }
    await expect.poll(() => core((k) => k.shell.task.key)).toBe(boundary === 'arrange' ? first : second);
  } finally {
    await core((k) => {
      const delayed = k.stash.delayedLayout;
      delayed.store.layout = delayed.read;
      delayed.release();
      delete k.stash.delayedLayout;
    });
  }
});

test('a delayed menu snapshot cannot enter the next task', async ({ core, ui, call }) => {
  await notLoading(ui);
  const first = await core((k) => k.shell.task.key);
  await call('profile_create', { name: 'Snapshot.browser' });
  await newTask(core, ui);
  await call('profile_open', { profile: 'Snapshot.browser' });
  await notLoading(ui);
  const snapshots = await core(async (k) => {
    const window = k.shell.windows[0], pictures = window.pictures.bind(window), saved = await pictures();
    let release: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    k.stash.delayedPictures = { window, pictures, release: () => release(), requested: false };
    window.pictures = async () => {
      if (k.stash.delayedPictures.requested) return pictures();
      k.stash.delayedPictures.requested = true;
      await gate;
      return saved;
    };
    return Object.keys(saved).length;
  });
  try {
    expect(snapshots, 'a pending snapshot contains a page to discard').toBeGreaterThan(0);
    await ui.getByRole('button', { name: 'Stage', exact: true }).click();
    await expect.poll(() => core((k) => k.stash.delayedPictures.requested)).toBe(true);
    await showTask(core, ui, first);
    await notLoading(ui);
    await core((k) => k.stash.delayedPictures.release());
    await ipcSettled(ui);
    await frames(ui);
    await expect(ui.getByTestId('snapshot'), 'the new task keeps its live pages').toHaveCount(0);
  } finally {
    await core((k) => {
      const delayed = k.stash.delayedPictures;
      delayed.window.pictures = delayed.pictures;
      delayed.release();
      delete k.stash.delayedPictures;
    });
  }
});

test('task switching reuses development panels and restores each Resources section', async ({ core, ui }) => {
  await notLoading(ui);
  const first = await core((k) => k.shell.task.key);
  const second = await newTask(core, ui);
  await notLoading(ui);
  await ui.getByRole('navigation', { name: 'Resources', exact: true }).getByRole('button', { name: 'Artifacts', exact: true }).click();
  await showTask(core, ui, first);
  await notLoading(ui);
  const resources = await ui.locator('#resources').elementHandle();
  const terminal = await ui.getByTestId('development-terminals').elementHandle();
  try {
    for (const [target, section] of [[second, 'Artifacts'], [first, 'Project']] as const) {
      await showTask(core, ui, target);
      await notLoading(ui);
      expect(await resources.evaluate((element) => element === document.getElementById('resources'))).toBe(true);
      expect(await terminal.evaluate((element) => element.isConnected)).toBe(true);
      await expect(ui.getByRole('navigation', { name: 'Resources', exact: true }).getByRole('button', { name: section, exact: true })).toHaveAttribute('aria-expanded', 'true');
    }
  } finally {
    await resources.dispose(); await terminal.dispose();
  }
});

test('a failed layout load shows a usable default grid', async ({ core, ui }) => {
  await notLoading(ui);
  const first = await core((k) => k.shell.task.key);
  await newTask(core, ui);
  await notLoading(ui);
  await core((k, key) => {
    const store = k.shell.taskByKey(key).store, read = store.layout.bind(store);
    k.stash.failedLayout = { store, read };
    store.layout = () => { throw new Error('test layout unavailable'); };
  }, first);
  try {
    await invoke(ui, 'task:show', first);
    await notLoading(ui);
    await expect(ui.getByRole('navigation', { name: 'Resources', exact: true })).toBeVisible();
    await expect(ui.locator('#dock')).not.toHaveAttribute('inert');
  } finally {
    await core((k) => {
      const failed = k.stash.failedLayout;
      failed.store.layout = failed.read; delete k.stash.failedLayout;
    });
  }
});
