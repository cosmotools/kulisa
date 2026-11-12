import { taskPage, menuPage } from './pages.ts';
// The testing stage owns profile layout and visibility independently of development panels.
import { test, expect } from './fixtures.ts';
import { notLoading, SITE, arrange, closeMenu, frames, ipcSettled } from './helpers.ts';

test('Stage has fixed positions, keeps development panels together and stays hidden when empty', async ({ core, ui, call, restart }) => {
  await notLoading(ui);
  await expect((await taskPage(ui)).locator('[data-task-view][data-active]').getByTestId('stage')).toBeHidden();
  await arrange(ui, 'right');
  await call('profile_create', { name: 'Stage.browser' });
  const stage = (await taskPage(ui)).locator('[data-task-view][data-active]').getByTestId('stage'), development = (await taskPage(ui)).locator('[data-task-view][data-active] [data-development-grid]');
  await expect(stage).toBeVisible();
  await expect((await taskPage(ui)).locator('[data-panel="stage"]')).toHaveCount(0);
  const panels = await (await taskPage(ui)).evaluate(() => (window as any).__dock.panels.map((p: any) => p.id).sort());
  expect(panels).toEqual(['resources:artifacts', 'resources:diff', 'resources:project', 'resources:terminals', 'terminal']);
  const identity = await (await taskPage(ui)).evaluateHandle(() => (window as any).__dock.getPanel('terminal'));
  for (const position of ['left', 'right', 'above'] as const) {
    await arrange(ui, position);
    await expect.poll(async () => {
      const s = await stage.boundingBox(), d = await development.boundingBox();
      return position === 'left' ? s.x + s.width <= d.x + 1 : position === 'right' ? d.x + d.width <= s.x + 1 : s.y + s.height <= d.y + 1;
    }).toBe(true);
    expect(await (await taskPage(ui)).evaluate((panel) => panel === (window as any).__dock.getPanel('terminal'), identity), 'moving Stage retains the development terminal panel').toBe(true);
    await expect.poll(() => core((k) => k.profile('Stage.browser').view.getVisible())).toBe(true);
  }
  await arrange(ui, 'right');
  const before = await stage.boundingBox();
  await (await taskPage(ui)).mouse.move(before.x, before.y + 18);
  await (await taskPage(ui)).mouse.down();
  await (await taskPage(ui)).mouse.move(before.x - 100, before.y + 18, { steps: 8 });
  await (await taskPage(ui)).mouse.up();
  await expect.poll(async () => (await stage.boundingBox()).width).toBeGreaterThan(before.width + 90);
  const resizedWidth = (await stage.boundingBox()).width;
  await expect.poll(() => core((k) => (k.shell.task.store.layout() as any)?.split?.grid.root.data.find((node: any) => node.data.id === 'stage')?.size)).toBeCloseTo(resizedWidth, 0);
  const next = await restart();
  await notLoading(next);
  await expect.poll(async () => {
    const s = await (await taskPage(next)).locator('[data-task-view][data-active]').getByTestId('stage').boundingBox(), d = await (await taskPage(next)).locator('[data-task-view][data-active] [data-development-grid]').boundingBox();
    return d.x + d.width <= s.x + 1;
  }).toBe(true);
  expect(Math.abs((await (await taskPage(next)).locator('[data-task-view][data-active]').getByTestId('stage').boundingBox()).width - resizedWidth)).toBeLessThanOrEqual(3);
  await call('profile_close', { profile: 'Stage.browser' });
  await expect((await taskPage(next)).locator('[data-task-view][data-active]').getByTestId('stage')).toBeHidden();
});

test('flat saved layouts restore browser panes inside the stage and development panels outside it', async ({ core, ui, call, restart }) => {
  await call('profile_create', { name: 'Layout.browser' });
  await expect((await taskPage(ui)).locator('[data-task-view][data-active] [data-panel^="profile:"]')).toHaveCount(1);
  const legacy = await (await taskPage(ui)).evaluate(() => {
    const w = (window as any).__dock.toJSON(), s = (window as any).__stage.toJSON();
    return { grid: { ...w.grid, orientation: 'VERTICAL', root: { type: 'branch', data: [s.grid.root, w.grid.root] } }, panels: { ...w.panels, ...s.panels } };
  });
  await expect.poll(() => core((k) => (k.shell.task.store.layout() as { version?: number })?.version)).toBe(3);
  await core((k, saved) => k.shell.task.store.saveLayout(saved), legacy);
  const next = await restart();
  await notLoading(next);
  await expect((await taskPage(next)).locator('[data-task-view][data-active]').getByTestId('stage').locator('[data-panel^="profile:"]')).toHaveCount(1);
  expect(await (await taskPage(next)).evaluate(() => (window as any).__dock.panels.map((p: any) => p.id).sort())).toEqual(['resources:artifacts', 'resources:diff', 'resources:project', 'resources:terminals', 'terminal']);
  expect(await (await taskPage(next)).evaluate(() => (window as any).__stage.panels.every((p: any) => p.id.startsWith('profile:')))).toBe(true);
  await expect.poll(() => core((k) => k.profile('Layout.browser').view.getVisible())).toBe(true);
  await call('profile_close', { profile: 'Layout.browser' });
});


test('restored Stage headers stay visible when the saved layout hides them', async ({ core, ui, call, restart }) => {
  await call('profile_create', { name: 'Header.browser' });
  await expect.poll(() => core((k) => Object.keys((k.shell.task.store.layout() as any)?.stage?.panels ?? {}).length)).toBe(1);
  const stage = await (await taskPage(ui)).evaluate(() => {
    const saved = (window as any).__stage.toJSON();
    const hide = (node: any) => {
      if (node.type === 'leaf') node.data.hideHeader = true;
      else node.data.forEach(hide);
    };
    hide(saved.grid.root);
    return saved;
  });
  await core((k, stage) => {
    const saved = k.shell.task.store.layout() as { stage: unknown };
    k.shell.task.store.saveLayout({ ...saved, stage });
  }, stage);
  const next = await restart();
  await notLoading(next);
  await expect((await taskPage(next)).locator('[data-profile-notch]')).toBeVisible();
  await expect((await taskPage(next)).getByRole('button', { name: 'Close profile', exact: true })).toBeVisible();
  await call('profile_close', { profile: 'Header.browser' });
});

test('stage arrangements are shared by human and agent and independent of workspace arrangements', async ({ core, ui, call, restart }) => {
  await call('profile_create', { name: 'Arrange.first' });
  await call('profile_create', { name: 'Arrange.second' });
  const shape = async (which: '__dock' | '__stage') => (await taskPage(ui)).evaluate((key) => {
    const strip = (n: any): any => n.type === 'branch' ? { type: n.type, data: n.data.map(strip) } : { type: n.type, data: n.data };
    return strip((window as any)[key].toJSON().grid.root);
  }, which);
  const workspace = await shape('__dock');
  const positions = async () => (await taskPage(ui)).locator('[data-task-view][data-active]').getByTestId('stage').getByTestId('page').evaluateAll((pages) => pages.map((p) => {
    const r = p.getBoundingClientRect(); return { x: r.x, y: r.y };
  }));
  for (const name of ['Horizontal stack', 'Vertical stack']) {
    await ui.getByRole('button', { name: 'Stage', exact: true }).click();
    await (await menuPage(ui)).getByRole('menuitemradio', { name, exact: true }).click();
    await expect.poll(async () => {
      const p = await positions();
      return p.length === 2 && (name === 'Horizontal stack' ? p[0].x < p[1].x && p[0].y === p[1].y : p[0].y < p[1].y && p[0].x === p[1].x);
    }).toBe(true);
    expect(await shape('__dock')).toEqual(workspace);
  }
  await ui.getByRole('button', { name: 'Stage', exact: true }).click();
  await (await menuPage(ui)).getByRole('menuitemradio', { name: 'Tabs', exact: true }).click();
  await expect.poll(async () => (await taskPage(ui)).evaluate(() => (window as any).__stage.groups.length)).toBe(1);
  expect(await shape('__dock')).toEqual(workspace);
  const stage = await shape('__stage');
  await arrange(ui, 'left');
  await expect.poll(() => shape('__stage')).toEqual(stage);
  for (const layout of ['vertical', 'horizontal', 'tabs']) {
    await call('stage_arrange', { layout });
    await expect.poll(async () => (await taskPage(ui)).evaluate(() => (window as any).__stage.groups.length)).toBe(layout === 'tabs' ? 1 : 2);
  }
  await call('stage_arrange', { overflow: true });
  await ui.getByRole('button', { name: 'Stage', exact: true }).click();
  await expect((await menuPage(ui)).getByRole('menuitemcheckbox', { name: 'Allow overflow', exact: true })).toHaveCount(0);
  await closeMenu(ui);
  await ui.getByRole('button', { name: 'Stage', exact: true }).click();
  await (await menuPage(ui)).getByRole('menuitemradio', { name: 'Tabs', exact: true }).click();
  await expect.poll(() => core((k) => (k.shell.task.store.layout() as any)?.stageLayout)).toBe('tabs');
  const next = await restart();
  await notLoading(next);
  await expect.poll(async () => (await taskPage(next)).evaluate(() => (window as any).__stage.groups.length)).toBe(1);
  expect(await core((k) => (k.shell.task.store.layout() as any).stageOverflow)).toBe(true);
  await call('stage_arrange', { layout: 'horizontal' });
  await expect.poll(async () => (await taskPage(next)).locator('[data-task-view][data-active] [data-stage-viewport]').evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await call('stage_arrange', { overflow: false });
  await expect.poll(async () => (await taskPage(next)).locator('[data-task-view][data-active] [data-stage-viewport]').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await call('profile_close', { profile: 'Arrange.first' });
  await call('profile_close', { profile: 'Arrange.second' });
  await call('stage_arrange', { layout: 'vertical', position: 'above' });
  await expect((await taskPage(next)).locator('[data-task-view][data-active]').getByTestId('stage')).toBeHidden();
});


test('a horizontal stack scrolls, clips native pages, and preserves their viewport widths', async ({ core, ui, call }, info) => {
  for (const name of ['Row.first', 'Row.second', 'Row.third']) {
    await call('profile_create', { name });
    await call('browser_navigate', { profile: name, url: `${SITE}/app` });
  }
  await call('stage_arrange', { layout: 'vertical' });
  const pageBoxes = async () => (await taskPage(ui)).locator('[data-task-view][data-active]').getByTestId('stage').getByTestId('page').evaluateAll((pages) => pages.map((p) => { const r = p.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width }; }));
  await expect.poll(async () => { const b = await pageBoxes(); return b.length === 3 && b[0].x === b[1].x && b[1].y > b[0].y && b[2].y > b[1].y; }).toBe(true);
  await arrange(ui, 'left');
  await call('stage_arrange', { layout: 'horizontal', overflow: false });
  const viewport = (await taskPage(ui)).locator('[data-task-view][data-active] [data-stage-viewport]');
  await expect.poll(() => viewport.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await ui.getByRole('button', { name: 'Stage', exact: true }).click();
  await (await menuPage(ui)).getByRole('menuitemcheckbox', { name: 'Allow overflow', exact: true }).click();
  await closeMenu(ui);
  await expect.poll(() => viewport.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await expect.poll(() => core((k) => { const w = k.profile('Row.first').bounds.width; return w > 590 && w < 610; })).toBe(true);
  await frames(ui);
  await ipcSettled(ui);
  await expect.poll(async () => {
    const page = await (await taskPage(ui)).locator('[data-task-view][data-active]').getByTestId('stage').getByTestId('page').first().boundingBox();
    return Math.round(page.width) === await core((k) => k.profile('Row.first').bounds.width);
  }).toBe(true);
  const firstWidth = await core((k) => k.profile('Row.first').bounds.width);
  // DOM scrolling has no Playwright action; native page bounds must follow the scroll event.
  await viewport.evaluate((el) => { el.scrollLeft = 350; });
  await expect.poll(() => core((k) => !!k.profile('Row.first').clip)).toBe(true);
  const frame = await viewport.boundingBox();
  const clipped = await core((k) => { const p = k.profile('Row.first'); return { clip: p.view.getBounds(), page: p.get().view.getBounds() }; });
  expect(clipped.clip.x).toBeGreaterThanOrEqual(Math.round(frame.x));
  expect(clipped.page.x).toBeLessThan(0);
  expect(clipped.page.width).toBe(firstWidth);
  await viewport.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await expect.poll(() => core((k) => !k.profile('Row.first').view.getVisible() && k.profile('Row.third').view.getVisible())).toBe(true);
  expect(await core((k) => k.profile('Row.first').bounds.width)).toBe(firstWidth);
  expect(await core((k) => { const p = k.profile('Row.third'); return (p.clip?.width ?? p.bounds.width) === p.bounds.width; }), 'the last pane is fully reachable horizontally').toBe(true);
  await core((k, file) => k.shot(file), info.outputPath('stage-row.png'));
  await call('stage_arrange', { layout: 'tabs' });
  await expect.poll(() => core((k) => !k.profile('Row.first').clip && k.profile('Row.first').view.getVisible())).toBe(true);
  for (const name of ['Row.first', 'Row.second', 'Row.third']) await call('profile_close', { profile: name });
});


test('a vertical stack scrolls without rebuilding panes and clips native pages', async ({ core, ui, call }) => {
  for (const name of ['Column.first', 'Column.second', 'Column.third']) await call('profile_create', { name });
  await arrange(ui, 'above');
  await call('stage_arrange', { layout: 'vertical', overflow: false });
  const viewport = (await taskPage(ui)).locator('[data-task-view][data-active] [data-stage-viewport]');
  await expect.poll(() => viewport.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
  const groups = await (await taskPage(ui)).evaluate(() => (window as any).__stage.groups.map((g: any) => g.id));
  await call('stage_arrange', { overflow: true });
  await expect.poll(() => viewport.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  expect(await (await taskPage(ui)).evaluate(() => (window as any).__stage.groups.map((g: any) => g.id))).toEqual(groups);
  // Scroll position has no Playwright action; the native view must follow the DOM scroll.
  await viewport.evaluate((el) => { el.scrollTop = 200; });
  await expect.poll(() => core((k) => !!k.profile('Column.first').clip && k.profile('Column.first').get().view.getBounds().y < 0)).toBe(true);
  await call('stage_arrange', { overflow: false });
  await expect.poll(() => viewport.evaluate((el) => el.scrollHeight <= el.clientHeight && el.scrollTop === 0)).toBe(true);
  // Fitting the container must resize every pane, not collapse one against its peers' old minimums.
  await expect.poll(async () => (await taskPage(ui)).evaluate(() => {
    const grid = (window as any).__stage;
    return grid.groups.every((g: any) => g.api.height > grid.height / 4);
  })).toBe(true);
  await expect.poll(() => core((k) => !k.profile('Column.first').clip && k.profile('Column.first').view.getVisible())).toBe(true);
  for (const name of ['Column.first', 'Column.second', 'Column.third']) await call('profile_close', { profile: name });
});
