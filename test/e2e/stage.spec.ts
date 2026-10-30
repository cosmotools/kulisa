// The testing stage owns profile layout and visibility independently of development panels.
import { test, expect } from './fixtures.ts';
import { notLoading, SITE, rightClick, closeMenu, frames, ipcSettled } from './helpers.ts';

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
  await ui.locator('[data-panel="stage"]').getByText('Stage', { exact: true }).click();
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
  await call('profile_close', { profile: 'Layout.browser' });
});


test('stage arrangements are shared by human and agent and independent of workspace arrangements', async ({ core, ui, call, restart }) => {
  await call('profile_create', { name: 'Arrange.first' });
  await call('profile_create', { name: 'Arrange.second' });
  const shape = (which: '__dock' | '__stage') => ui.evaluate((key) => {
    const strip = (n: any): any => n.type === 'branch' ? { type: n.type, data: n.data.map(strip) } : { type: n.type, data: n.data };
    return strip((window as any)[key].toJSON().grid.root);
  }, which);
  const workspace = await shape('__dock');
  const positions = () => ui.getByTestId('stage').getByTestId('page').evaluateAll((pages) => pages.map((p) => {
    const r = p.getBoundingClientRect(); return { x: r.x, y: r.y };
  }));
  for (const name of ['Horizontal stack', 'Vertical stack']) {
    await ui.getByRole('button', { name: 'Arrange stage', exact: true }).click();
    await ui.getByRole('menuitem', { name, exact: true }).click();
    await expect.poll(async () => {
      const p = await positions();
      return p.length === 2 && (name === 'Horizontal stack' ? p[0].x < p[1].x && p[0].y === p[1].y : p[0].y < p[1].y && p[0].x === p[1].x);
    }).toBe(true);
    expect(await shape('__dock')).toEqual(workspace);
  }
  await ui.getByRole('button', { name: 'Arrange stage', exact: true }).click();
  await ui.getByRole('menuitem', { name: 'Tabs', exact: true }).click();
  await expect.poll(() => ui.evaluate(() => (window as any).__stage.groups.length)).toBe(1);
  expect(await shape('__dock')).toEqual(workspace);
  const stage = await shape('__stage');
  await ui.locator('#windowMenu').click();
  await ui.getByRole('menuitem', { name: 'Stage beside', exact: true }).click();
  await expect.poll(() => shape('__stage')).toEqual(stage);
  for (const layout of ['vertical', 'horizontal', 'tabs']) {
    await call('stage_arrange', { layout });
    await expect.poll(() => ui.evaluate(() => (window as any).__stage.groups.length)).toBe(layout === 'tabs' ? 1 : 2);
  }
  await call('stage_arrange', { overflow: true });
  await ui.getByRole('button', { name: 'Arrange stage', exact: true }).click();
  await expect(ui.getByRole('menuitemcheckbox', { name: 'Allow overflow', exact: true })).toHaveCount(0);
  await closeMenu(ui);
  await rightClick(ui, '[data-panel="stage"]');
  await ui.getByRole('menuitem', { name: 'Tabs', exact: true }).click();
  await expect.poll(() => core((k) => (k.shell.task.store.layout() as any)?.stageLayout)).toBe('tabs');
  const next = await restart();
  await notLoading(next);
  await expect.poll(() => next.evaluate(() => (window as any).__stage.groups.length)).toBe(1);
  expect(await core((k) => (k.shell.task.store.layout() as any).stageOverflow)).toBe(true);
  await call('stage_arrange', { layout: 'horizontal' });
  await expect.poll(() => next.locator('[data-stage-viewport]').evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await call('stage_arrange', { overflow: false });
  await expect.poll(() => next.locator('[data-stage-viewport]').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await call('profile_close', { profile: 'Arrange.first' });
  await call('profile_close', { profile: 'Arrange.second' });
  await expect(call('stage_arrange', { layout: 'vertical' })).rejects.toThrow(/open.*environment/i);
});


test('a horizontal stack scrolls, clips native pages, and preserves their viewport widths', async ({ core, ui, call }, info) => {
  for (const name of ['Row.first', 'Row.second', 'Row.third']) {
    await call('profile_create', { name });
    await call('browser_navigate', { profile: name, url: `${SITE}/app` });
  }
  await call('stage_arrange', { layout: 'vertical' });
  const pageBoxes = () => ui.getByTestId('stage').getByTestId('page').evaluateAll((pages) => pages.map((p) => { const r = p.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width }; }));
  await expect.poll(async () => { const b = await pageBoxes(); return b.length === 3 && b[0].x === b[1].x && b[1].y > b[0].y && b[2].y > b[1].y; }).toBe(true);
  await ui.locator('#windowMenu').click();
  await ui.getByRole('menuitem', { name: 'Stage beside', exact: true }).click();
  await call('stage_arrange', { layout: 'horizontal', overflow: false });
  const viewport = ui.locator('[data-stage-viewport]');
  await expect.poll(() => viewport.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await ui.getByRole('button', { name: 'Arrange stage', exact: true }).click();
  await ui.getByRole('menuitemcheckbox', { name: 'Allow overflow', exact: true }).click();
  await closeMenu(ui);
  await expect.poll(() => viewport.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await expect.poll(() => core((k) => { const w = k.profile('Row.first').bounds.width; return w > 590 && w < 610; })).toBe(true);
  await frames(ui);
  await ipcSettled(ui);
  await expect.poll(async () => {
    const page = await ui.getByTestId('stage').getByTestId('page').first().boundingBox();
    return Math.round(page.width) === await core((k) => k.profile('Row.first').bounds.width);
  }).toBe(true);
  const firstWidth = await core((k) => k.profile('Row.first').bounds.width);
  // DOM scrolling has no Playwright action; native page bounds must follow the scroll event.
  await viewport.evaluate((el) => { el.scrollLeft = 350; });
  await expect.poll(() => core((k) => !!k.profile('Row.first').clipView)).toBe(true);
  const frame = await viewport.boundingBox();
  const clipped = await core((k) => { const p = k.profile('Row.first'); return { clip: p.clipView.getBounds(), page: p.get().view.getBounds() }; });
  expect(clipped.clip.x).toBeGreaterThanOrEqual(Math.round(frame.x));
  expect(clipped.page.x).toBeLessThan(0);
  expect(clipped.page.width).toBe(firstWidth);
  await viewport.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await expect.poll(() => core((k) => !k.profile('Row.first').get().view.getVisible() && k.profile('Row.third').get().view.getVisible())).toBe(true);
  expect(await core((k) => k.profile('Row.first').bounds.width)).toBe(firstWidth);
  expect(await core((k) => { const p = k.profile('Row.third'); return (p.clip?.width ?? p.bounds.width) === p.bounds.width; }), 'the last pane is fully reachable horizontally').toBe(true);
  await core((k, file) => k.shot(file), info.outputPath('stage-row.png'));
  await call('stage_arrange', { layout: 'tabs' });
  await expect.poll(() => core((k) => !k.profile('Row.first').clipView && k.profile('Row.first').get().view.getVisible())).toBe(true);
  for (const name of ['Row.first', 'Row.second', 'Row.third']) await call('profile_close', { profile: name });
});


test('a vertical stack scrolls without rebuilding panes and clips native pages', async ({ core, ui, call }) => {
  for (const name of ['Column.first', 'Column.second', 'Column.third']) await call('profile_create', { name });
  await ui.locator('#windowMenu').click();
  await ui.getByRole('menuitem', { name: 'Stage above', exact: true }).click();
  await call('stage_arrange', { layout: 'vertical', overflow: false });
  const viewport = ui.locator('[data-stage-viewport]');
  await expect.poll(() => viewport.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
  const groups = await ui.evaluate(() => (window as any).__stage.groups.map((g: any) => g.id));
  await call('stage_arrange', { overflow: true });
  await expect.poll(() => viewport.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  expect(await ui.evaluate(() => (window as any).__stage.groups.map((g: any) => g.id))).toEqual(groups);
  // Scroll position has no Playwright action; the native view must follow the DOM scroll.
  await viewport.evaluate((el) => { el.scrollTop = 200; });
  await expect.poll(() => core((k) => !!k.profile('Column.first').clipView && k.profile('Column.first').get().view.getBounds().y < 0)).toBe(true);
  await call('stage_arrange', { overflow: false });
  await expect.poll(() => viewport.evaluate((el) => el.scrollHeight <= el.clientHeight && el.scrollTop === 0)).toBe(true);
  await expect.poll(() => core((k) => !k.profile('Column.first').clipView && k.profile('Column.first').get().view.getVisible())).toBe(true);
  for (const name of ['Column.first', 'Column.second', 'Column.third']) await call('profile_close', { profile: name });
});
