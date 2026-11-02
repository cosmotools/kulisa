// The working area stays on one task while the incoming grid prepares.
import { test, expect } from './fixtures.ts';
import { invoke, notLoading, frames } from './helpers.ts';
import { newTask, showTask } from './tasks-helpers.ts';

test('task switching retains the outgoing grid and page pictures until the next grid is ready', async ({ core, ui, call }) => {
  await notLoading(ui);
  const first = await core((k) => k.shell.task.key);
  await call('profile_create', { name: 'Paint.first' });
  await call('profile_create', { name: 'Paint.second' });
  await expect.poll(() => core((k) => [...k.shell.profiles.values()].filter((p) => p.visible() && p.bounds.height > 0).length)).toBe(2);
  await core(async (k) => {
    for (const p of k.shell.profiles.values()) await p.get().wc.executeJavaScript("document.body.style.backgroundColor = '#b000b0'");
  });
  await frames(ui);
  const second = await newTask(core, ui);
  await notLoading(ui);
  await showTask(core, ui, first);
  await notLoading(ui);
  // Renderer screenshots omit native views; inspect the cover and its images through Electron's View API.
  const grid = await ui.locator('#dock').boundingBox();
  const cover = () => core((k, grid) => {
    const children = k.shell.win.contentView.children;
    const view = children.find((v) => v.children.some((child) => child instanceof k.electron.ImageView));
    if (!view) return null;
    const count = (v: Electron.View): number => Number(v instanceof k.electron.ImageView) + v.children.reduce((n, child) => n + count(child), 0);
    const bounds = view.getBounds(), zoom = k.shell.win.webContents.getZoomFactor();
    return { images: count(view), topmost: children.at(-1) === view,
      fillsGrid: (['x', 'y', 'width', 'height'] as const).every((key) => bounds[key] === Math.round(grid[key] * zoom)) };
  }, grid);
  for (const [target, images] of [[second, 3], [first, 1]] as const) {
    await core(async (k) => {
      const window = k.shell.windows[0], reveal = window.revealGrid.bind(window);
      // The desktop capturer includes native pages and ImageViews; a renderer screenshot excludes both.
      const capture = async () => {
        const { width, height } = window.win.getContentBounds();
        const sources = await k.electron.desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width, height } });
        return sources.find((source) => source.id === window.win.getMediaSourceId()).thumbnail.toBitmap();
      };
      const before = k.canShoot() ? await capture() : null;
      let release: () => void;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      k.stash.paintGrid = { window, reveal, capture, before, release: () => release(), requested: false };
      window.revealGrid = async (task, hidden) => {
        k.stash.paintGrid.requested = true;
        await gate;
        return reveal(task, hidden);
      };
    });
    try {
      await invoke(ui, 'task:show', target);
      await expect.poll(() => core((k) => k.stash.paintGrid.requested)).toBe(true);
      await expect.poll(cover).toEqual({ images, topmost: true, fillsGrid: true });
      await expect(ui.locator('#dock')).toHaveAttribute('aria-busy', 'true');
      await expect(ui.locator('#dock')).toHaveAttribute('inert', '');
      if (await core((k) => k.canShoot())) {
        const changed = await core(async (k) => {
          const { before, capture } = k.stash.paintGrid, after = await capture();
          if (before.length !== after.length) return 1;
          let different = 0;
          for (let i = 0; i < before.length; i += 4) {
            if (Math.max(...[0, 1, 2].map((c) => Math.abs(before[i + c] - after[i + c]))) > 30) different++;
          }
          return different / (before.length / 4);
        });
        expect(changed, 'the prepared incoming grid stays behind the outgoing picture').toBeLessThan(0.02);
      }
      await core((k) => k.stash.paintGrid.release());
      await notLoading(ui);
      await expect.poll(cover).toBeNull();
      await expect(ui.locator('#dock')).not.toHaveAttribute('inert');
      await expect.poll(() => core((k) => [...k.shell.profiles.values()].filter((p) => p.visible()).length)).toBe(target === first ? 2 : 0);
    } finally {
      await core((k) => {
        const held = k.stash.paintGrid;
        held.window.revealGrid = held.reveal; held.release(); delete k.stash.paintGrid;
      });
    }
  }
});

for (const failure of ['rejected', 'stalled'] as const) test(`a ${failure} window capture cannot block task switching`, async ({ core, ui }) => {
  await notLoading(ui);
  const first = await core((k) => k.shell.task.key);
  await newTask(core, ui);
  await notLoading(ui);
  await core((k, failure) => {
    const wc = k.shell.win.webContents, capture = wc.capturePage.bind(wc);
    let release: () => void;
    const pending = new Promise<Electron.NativeImage>((resolve) => { release = () => resolve(k.electron.nativeImage.createEmpty()); });
    k.stash.captureFailure = { wc, capture, release: () => release(), requested: false };
    wc.capturePage = () => {
      k.stash.captureFailure.requested = true;
      return failure === 'rejected' ? Promise.reject(new Error('test capture unavailable')) : pending;
    };
    k.clock.hold(500);
  }, failure);
  const switched = invoke(ui, 'task:show', first);
  try {
    await expect.poll(() => core((k) => k.stash.captureFailure.requested)).toBe(true);
    await core((k) => k.clock.advance(500));
    await expect.poll(() => core((k) => k.shell.task.key)).toBe(first);
    await switched;
    await notLoading(ui);
  } finally {
    await core((k) => {
      const held = k.stash.captureFailure;
      held.wc.capturePage = held.capture; held.release(); k.clock.release(); delete k.stash.captureFailure;
    });
    await switched;
  }
});

test('a preparing task can be resized and superseded from the tasks bar', async ({ core, ui }) => {
  await notLoading(ui);
  const first = await core((k) => k.shell.task.key), second = await newTask(core, ui);
  await notLoading(ui);
  await core((k) => {
    const window = k.shell.windows[0], reveal = window.revealGrid.bind(window);
    let release: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    k.stash.preparing = { window, reveal, release: () => release(), requested: false, size: window.win.getSize() };
    window.revealGrid = async (task, hidden) => {
      if (!k.stash.preparing.requested) {
        k.stash.preparing.requested = true;
        await gate;
      }
      return reveal(task, hidden);
    };
  });
  const cover = () => core((k) => k.shell.win.contentView.children.some((view) => view.children.some((child) => child instanceof k.electron.ImageView)));
  try {
    await invoke(ui, 'task:show', first);
    await expect.poll(() => core((k) => k.stash.preparing.requested)).toBe(true);
    await expect.poll(cover).toBe(true);
    await core((k) => {
      const [width, height] = k.stash.preparing.size;
      k.shell.win.setSize(width - 80, height - 60);
    });
    await expect.poll(cover).toBe(false);
    await ui.locator(`[data-task="${second}"]`).click();
    await notLoading(ui);
    await core((k) => k.stash.preparing.release());
    await frames(ui);
    await expect.poll(() => core((k) => k.shell.task.key)).toBe(second);
    await expect.poll(cover).toBe(false);
  } finally {
    await core((k) => {
      const held = k.stash.preparing;
      held.window.revealGrid = held.reveal; held.release(); held.window.win.setSize(...held.size); delete k.stash.preparing;
    });
  }
});
