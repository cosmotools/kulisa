// The whole native window stays on one task while the incoming grid prepares.
import { test, expect } from './fixtures.ts';
import { invoke, notLoading, frames } from './helpers.ts';
import { newTask, showTask } from './tasks-helpers.ts';

test('task switching retains the outgoing window and page pictures until the next grid is ready', async ({ core, ui, call }) => {
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
  const cover = () => core((k) => {
    const children = k.shell.win.contentView.children;
    const view = children.find((v) => v.children.some((child) => child instanceof k.electron.ImageView));
    if (!view) return null;
    const count = (v: Electron.View): number => Number(v instanceof k.electron.ImageView) + v.children.reduce((n, child) => n + count(child), 0);
    const { width, height } = k.shell.win.getContentBounds();
    const bounds = view.getBounds();
    return { images: count(view), topmost: children.at(-1) === view,
      fillsWindow: bounds.x === 0 && bounds.y === 0 && bounds.width === width && bounds.height === height };
  });
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
      await expect.poll(cover).toEqual({ images, topmost: true, fillsWindow: true });
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
