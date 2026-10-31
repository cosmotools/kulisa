// The shown task's files and their desktop opening action (docs/tasks.md, The Resources panel).
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from './fixtures.ts';
import { showResources, dock, box, invoke, windowSubmenu, choose, closeMenu, frames } from './helpers.ts';
import { openFolder, showTask } from './tasks-helpers.ts';

test('Resources starts with Project, expands folders, opens files and follows projects', async ({ core, ui, files }) => {
  const first = await core((k) => ({ key: k.shell.task.key, folder: k.shell.task.folder }));
  const directory = path.join(first.folder, 'tree-example');
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'readme.txt');
  fs.writeFileSync(file, 'project file');
  await expect(ui.getByRole('button', { name: 'Project', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await ui.locator('#resources').getByRole('button', { name: 'tree-example', exact: true }).click();
  const row = ui.locator('#resources').getByRole('button', { name: 'readme.txt', exact: true });
  await expect(row).toBeVisible();
  await core((k) => {
    k.stash.openPath = k.electron.shell.openPath; k.stash.opened = [];
    k.electron.shell.openPath = async (file: string) => { k.stash.opened.push(file); return ''; };
  });
  try {
    await row.dblclick();
    await expect.poll(() => core((k) => k.stash.opened)).toEqual([file]);
    await row.press('Enter');
    await expect.poll(() => core((k) => k.stash.opened)).toEqual([file, file]);
  } finally { await core((k) => { k.electron.shell.openPath = k.stash.openPath; }); }
  await showResources(ui, 'Artifacts');
  await expect(row).toHaveCount(0);
  const other = path.join(files.root, 'tree-other-project');
  fs.mkdirSync(other, { recursive: true });
  fs.writeFileSync(path.join(other, 'other.txt'), 'other project');
  await openFolder(core, ui, other);
  await expect(ui.getByRole('button', { name: 'Project', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await expect(ui.locator('#resources').getByRole('button', { name: 'other.txt', exact: true })).toBeVisible();
  await expect(ui.locator('#resources').getByRole('button', { name: 'tree-example', exact: true })).toHaveCount(0);
  expect((await invoke(ui, 'task:files', { key: await core((k) => k.shell.task.key), folder: first.folder })).error).toBeTruthy();
  await showTask(core, ui, first.key);
  await expect(ui.getByRole('button', { name: 'Artifacts', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await showResources(ui, 'Project');
  await expect(ui.locator('#resources').getByRole('button', { name: 'tree-example', exact: true })).toBeVisible();
});

test('Project icons identify files and folders and follow the window theme', async ({ core, ui, files }) => {
  const folder = await core((k) => k.shell.task.folder);
  const directory = path.join(folder, 'icon-example');
  fs.mkdirSync(path.join(directory, 'src'), { recursive: true });
  const examples = [
    ['index.ts', 'typescript'], ['index.tsx', 'react_ts'], ['index.d.ts', 'typescript-def'],
    ['index.test.ts', 'test-ts'], ['package.json', 'nodejs'], ['Dockerfile', 'docker'],
    ['PKGBUILD', 'console'], ['unknown.extension', 'file'], ['__proto__', 'file'], ['deno.json', 'deno'],
  ] as const;
  for (const [name] of examples) fs.writeFileSync(path.join(directory, name), '');
  await ui.locator('#resources').getByRole('button', { name: 'icon-example', exact: true }).click();
  const row = (name: string) => ui.locator('#resources').getByRole('button', { name, exact: true });
  const icon = (name: string) => row(name).locator('span[aria-hidden="true"]');
  for (const [name, expected] of examples) {
    await expect(icon(name)).toHaveCSS('background-image', new RegExp(`/${expected}-[^/]+\\.svg`));
    // A CSS URL alone does not prove the packaged local asset can be decoded by Chromium.
    expect(await icon(name).evaluate((element) => new Promise<boolean>((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image.naturalWidth > 0);
      image.onerror = () => resolve(false);
      image.src = getComputedStyle(element).backgroundImage.slice(5, -2);
    }))).toBe(true);
  }
  await expect(row('src').locator('svg').last().locator('path')).toHaveAttribute('d', await row('icon-example').locator('svg').last().locator('path').getAttribute('d'));
  await row('src').click();
  await expect(row('src').locator('svg').last().locator('path')).toHaveAttribute('d', await row('icon-example').locator('svg').last().locator('path').getAttribute('d'));
  await choose(ui, 'Light', await windowSubmenu(ui, 'Theme'));
  await expect(icon('deno.json')).toHaveCSS('background-image', /\/deno_light-[^/]+\.svg/);
  await ui.keyboard.press('Escape');
  await closeMenu(ui);
  await frames(ui);
  const screenshot = path.join(files.root, 'project-icons.png');
  await core((k, file) => k.shot(file), screenshot);
  await test.info().attach('Project icons', { path: screenshot, contentType: 'image/png' });
  await choose(ui, 'Dark', await windowSubmenu(ui, 'Theme'));
  await expect(icon('deno.json')).toHaveCSS('background-image', /\/deno-[^/]+\.svg/);
  await ui.keyboard.press('Escape');
  await closeMenu(ui);
});

test('Resources icons toggle content, restore its width and enforce its minimum', async ({ ui, core, files }) => {
  await showResources(ui, 'Project');
  await expect(ui.getByRole('tab', { name: 'Resources', exact: true })).toHaveCount(0);
  const resources = ui.locator('#resources');
  const nav = ui.getByRole('navigation', { name: 'Resources', exact: true });
  const project = nav.getByRole('button', { name: 'Project', exact: true });
  const artifacts = nav.getByRole('button', { name: 'Artifacts', exact: true });
  const p = await project.boundingBox(), a = await artifacts.boundingBox();
  expect(a.x).toBe(p.x);
  expect(a.y).toBeGreaterThan(p.y);
  await dock(ui, (api) => api.getPanel('resources').api.setSize({ width: 10 }));
  await expect.poll(async () => (await resources.boundingBox()).width).toBe(300);
  await dock(ui, (api) => api.getPanel('resources').api.setSize({ width: 310 }));
  await expect.poll(async () => (await resources.boundingBox()).width).toBeGreaterThan(300);
  const expandedWidth = (await resources.boundingBox()).width;
  await artifacts.click();
  await expect.poll(async () => (await resources.boundingBox()).width).toBe(expandedWidth);
  await project.click();
  await expect.poll(async () => (await resources.boundingBox()).width).toBe(expandedWidth);
  const terminal = await box(ui, '[data-testid="terminal"]');
  for (const icon of [project, artifacts]) {
    if (await icon.getAttribute('aria-expanded') !== 'true') await icon.click();
    await icon.click();
    await expect(icon).toHaveAttribute('aria-expanded', 'false');
    await expect(resources.getByRole('region')).toHaveCount(0);
    await expect.poll(async () => (await resources.boundingBox()).width).toBe(40);
    await expect(ui.locator('#grid .dv-sash')).toBeHidden();
    const closed = await resources.boundingBox(), terminalBox = await box(ui, '[data-testid="terminal"]');
    const sash = (closed.x + closed.width + terminalBox.x) / 2;
    await ui.mouse.move(sash, closed.y + closed.height / 2);
    await ui.mouse.down();
    await ui.mouse.move(sash + 180, closed.y + closed.height / 2, { steps: 4 });
    await ui.mouse.up();
    await frames(ui);
    await dock(ui, (api) => api.getPanel('resources').api.setSize({ width: 500 }));
    await expect.poll(async () => (await resources.boundingBox()).width).toBe(40);
    await expect.poll(async () => (await box(ui, '[data-testid="terminal"]')).width).toBeGreaterThan(terminal.width);
    await icon.click();
    await expect(icon).toHaveAttribute('aria-expanded', 'true');
    await expect(resources.getByRole('region')).toBeVisible();
    await expect(ui.locator('#grid .dv-sash')).toBeVisible();
    await expect.poll(async () => (await resources.boundingBox()).width).toBe(expandedWidth);
  }
  await project.click();
  await project.press('Enter');
  await expect(resources.getByRole('region')).toHaveCount(0);
  const original = await core((k) => k.shell.task.key);
  const other = path.join(files.root, 'collapsed-resources-project');
  fs.mkdirSync(other);
  await openFolder(core, ui, other);
  await showTask(core, ui, original);
  await expect(project).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(async () => (await resources.boundingBox()).width).toBe(40);
  await expect(ui.locator('#grid .dv-sash')).toBeHidden();
  await frames(ui);
  const closedScreenshot = path.join(files.root, 'resources-closed.png');
  await core((k, file) => k.shot(file), closedScreenshot);
  await test.info().attach('Resources content closed', { path: closedScreenshot, contentType: 'image/png' });
  await project.press('Enter');
  await expect.poll(async () => (await resources.boundingBox()).width).toBe(expandedWidth);
  await frames(ui);
  const screenshot = path.join(files.root, 'resources-icons.png');
  await core((k, file) => k.shot(file), screenshot);
  await test.info().attach('Resources icons', { path: screenshot, contentType: 'image/png' });
  await showResources(ui, 'Project');
});

test('the Resources bar grip docks the panel while open, closed and sharing terminal tabs', async ({ ui, core, files }) => {
  await showResources(ui, 'Project');
  const grip = ui.getByRole('button', { name: 'Move Resources panel', exact: true });
  const resources = ui.locator('#resources');
  const terminal = ui.locator('#grid .dv-groupview').filter({ has: ui.locator('[data-panel="terminal"]') });
  const move = async (where: 'right' | 'bottom' | 'center') => {
    const target = await terminal.boundingBox();
    // Dockview's terminal overlay receives pointer events beside the group's DOM subtree.
    await grip.dragTo(terminal, { force: true, targetPosition: {
      x: where === 'right' ? target.width - 12 : target.width / 2,
      y: where === 'bottom' ? target.height - 12 : target.height / 2,
    } });
  };
  await move('right');
  await expect.poll(async () => (await resources.boundingBox()).x > (await terminal.boundingBox()).x + (await terminal.boundingBox()).width).toBe(true);
  await expect(resources).toHaveAttribute('data-bar-side', 'right');
  await expect.poll(async () => { const panel = await resources.boundingBox(), bar = await resources.getByRole('navigation', { name: 'Resources', exact: true }).boundingBox(); return bar.x + bar.width - panel.x - panel.width; }).toBe(0);
  await frames(ui);
  const screenshot = path.join(files.root, 'resources-right.png');
  await core((k, file) => k.shot(file), screenshot);
  await test.info().attach('Resources on the right', { path: screenshot, contentType: 'image/png' });
  const original = await core((k) => k.shell.task.key);
  const other = path.join(files.root, 'resources-drag-project');
  fs.mkdirSync(other);
  await openFolder(core, ui, other);
  await showTask(core, ui, original);
  await expect.poll(async () => (await resources.boundingBox()).x > (await terminal.boundingBox()).x + (await terminal.boundingBox()).width).toBe(true);
  await expect(resources).toHaveAttribute('data-bar-side', 'right');
  await ui.getByRole('navigation', { name: 'Resources', exact: true }).getByRole('button', { name: 'Project', exact: true }).click();
  await move('bottom');
  await expect.poll(async () => (await resources.boundingBox()).y >= (await terminal.boundingBox()).y + (await terminal.boundingBox()).height).toBe(true);
  await expect(resources.getByRole('region')).toHaveCount(0);
  await expect(resources).toHaveAttribute('data-bar-side', 'left');
  await dock(ui, (api) => api.getPanel('resources').api.setSize({ height: 400 }));
  await expect.poll(async () => (await resources.boundingBox()).height).toBe(120);
  await showResources(ui, 'Artifacts');
  await expect.poll(async () => (await resources.boundingBox()).height).toBeGreaterThan(120);
  await move('center');
  await expect.poll(() => dock(ui, (api) => api.getPanel('resources').group.id === api.getPanel('terminal').group.id)).toBe(true);
  await move('right');
  await expect.poll(() => dock(ui, (api) => api.getPanel('resources').group.id !== api.getPanel('terminal').group.id)).toBe(true);
  await expect(ui.getByRole('tab', { name: 'Resources', exact: true })).toHaveCount(0);
  await expect(resources.getByRole('region', { name: 'Artifacts', exact: true })).toBeVisible();
  await showResources(ui, 'Project');
});

test('Resources stays nonclosable when sharing terminal tabs, including after restart', async ({ ui, core, restart }) => {
  await dock(ui, (api) => api.getPanel('resources').api.moveTo({ group: api.getPanel('terminal').group, position: 'center' }));
  const tab = ui.getByRole('tab', { name: 'Resources', exact: true });
  await expect(tab).toBeVisible();
  await expect(ui.getByRole('button', { name: 'Close Resources', exact: true })).toHaveCount(0);
  // The terminal tab's middle contains its agent and close actions.
  await ui.getByRole('tab', { name: 'Terminal', exact: true }).click({ position: { x: 2, y: 2 } });
  await tab.click();
  await expect(ui.getByRole('button', { name: 'Project', exact: true })).toBeVisible();
  await ui.getByRole('tab', { name: 'Terminal', exact: true }).click({ position: { x: 2, y: 2 } });
  await expect.poll(() => core((k) => {
    const layout = k.shell.task.store.layout() as any;
    return layout?.workspace?.grid.root.data.map((g: any) => ({ views: g.data.views, active: g.data.activeView }));
  })).toEqual([{ views: ['terminal', 'resources'], active: 'terminal' }]);
  const next = await restart();
  await expect(next.getByRole('tab', { name: 'Resources', exact: true })).toBeVisible();
  await expect(next.getByRole('button', { name: 'Close Resources', exact: true })).toHaveCount(0);
  await next.getByRole('tab', { name: 'Resources', exact: true }).click();
  await expect(next.getByRole('button', { name: 'Project', exact: true })).toBeVisible();
});

test('the Resources bar keeps both sections and its grip reachable at minimum height', async ({ ui }) => {
  await showResources(ui, 'Project');
  await dock(ui, (api) => {
    api.getPanel('resources').api.moveTo({ group: api.getPanel('terminal').group, position: 'bottom' });
    api.getPanel('resources').api.setSize({ height: 10 });
  });
  const resources = ui.locator('#resources');
  await expect.poll(async () => (await resources.boundingBox()).height).toBeGreaterThanOrEqual(120);
  const bounds = await resources.boundingBox();
  for (const name of ['Project', 'Artifacts', 'Move Resources panel']) {
    const control = resources.getByRole('button', { name, exact: true });
    const rect = await control.boundingBox();
    expect(rect.y).toBeGreaterThanOrEqual(bounds.y);
    expect(rect.y + rect.height).toBeLessThanOrEqual(bounds.y + bounds.height);
  }
  await resources.getByRole('button', { name: 'Artifacts', exact: true }).click();
  await expect(resources.getByRole('region', { name: 'Artifacts', exact: true })).toBeVisible();
});
