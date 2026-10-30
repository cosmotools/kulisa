// The testing stage owns profile layout and visibility independently of development panels.
import { test, expect } from './fixtures.ts';
import { notLoading } from './helpers.ts';

test('the stage hides when empty and hides browser views when stacked behind a development panel', async ({ core, ui, call }) => {
  await notLoading(ui);
  await expect(ui.getByTestId('stage')).toHaveCount(0);
  await call('profile_create', { name: 'Stage.browser' });
  await expect(ui.getByTestId('stage')).toBeVisible();
  await expect.poll(() => core((k) => k.profile('Stage.browser').get().view.getVisible())).toBe(true);
  // Dockview's API performs the same move as dropping the outer stage header onto the terminal's group.
  await ui.evaluate(() => {
    const api = (window as any).__dock;
    api.getPanel('stage').api.moveTo({ group: api.getPanel('terminal').group, position: 'center' });
    api.getPanel('terminal').api.setActive();
  });
  await expect.poll(() => core((k) => k.profile('Stage.browser').get().view.getVisible())).toBe(false);
  await ui.locator('[data-panel="stage"]').click();
  await expect.poll(() => core((k) => k.profile('Stage.browser').get().view.getVisible())).toBe(true);
  await call('profile_close', { profile: 'Stage.browser' });
  await expect(ui.getByTestId('stage')).toHaveCount(0);
});

test('flat saved layouts restore browser panes inside the stage and development panels outside it', async ({ core, ui, call, restart }) => {
  await call('profile_create', { name: 'Layout.browser' });
  await expect(ui.locator('[data-panel^="profile:"]')).toHaveCount(1);
  const legacy = await ui.evaluate(() => {
    const w = (window as any).__dock.toJSON(), s = (window as any).__stage.toJSON();
    const replace = (n: any): any => n.type === 'branch' ? { ...n, data: n.data.map(replace) } : n.data.views.includes('stage') ? { ...s.grid.root, size: n.size } : n;
    const panels = { ...w.panels, ...s.panels }; delete panels.stage;
    return { grid: { ...w.grid, root: replace(w.grid.root) }, panels };
  });
  await expect.poll(() => core((k) => (k.shell.task.store.layout() as { version?: number })?.version)).toBe(2);
  await core((k, saved) => k.shell.task.store.saveLayout(saved), legacy);
  const next = await restart();
  await notLoading(next);
  await expect(next.getByTestId('stage').locator('[data-panel^="profile:"]')).toHaveCount(1);
  expect(await next.evaluate(() => (window as any).__dock.panels.map((p: any) => p.id).sort())).toEqual(['resources', 'stage', 'terminal']);
  expect(await next.evaluate(() => (window as any).__stage.panels.every((p: any) => p.id.startsWith('profile:')))).toBe(true);
  await expect.poll(() => core((k) => k.profile('Layout.browser').get().view.getVisible())).toBe(true);
});

