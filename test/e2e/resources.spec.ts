// The shown task's files and their desktop opening action (docs/tasks.md, The Resources panel).
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from './fixtures.ts';
import { showResources, resourcesGroup, developmentBox, terminalRows, termKeys, act, dock, invoke, windowSubmenu, choose, closeMenu, frames, rightClick, menu } from './helpers.ts';
import { openFolder, showTask } from './tasks-helpers.ts';

test('Resources starts with Project, expands folders, opens files and follows projects', async ({ core, ui, files }) => {
  const first = await core((k) => ({ key: k.shell.task.key, folder: k.shell.task.folder }));
  const directory = path.join(first.folder, 'tree-example');
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'readme.txt');
  fs.writeFileSync(file, 'project file');
  await expect(ui.getByRole('tab', { name: 'Project', exact: true })).toHaveAttribute('aria-selected', 'true');
  await ui.locator('[data-task-view][data-active] [data-resources]').getByRole('button', { name: 'tree-example', exact: true }).click();
  const row = ui.locator('[data-task-view][data-active] [data-resources]').getByRole('button', { name: 'readme.txt', exact: true });
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
  await expect(ui.getByRole('tab', { name: 'Project', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(ui.locator('[data-task-view][data-active] [data-resources]').getByRole('button', { name: 'other.txt', exact: true })).toBeVisible();
  await expect(ui.locator('[data-task-view][data-active] [data-resources]').getByRole('button', { name: 'tree-example', exact: true })).toHaveCount(0);
  expect((await invoke(ui, 'task:file:list', { key: await core((k) => k.shell.task.key), folder: first.folder })).error).toBeTruthy();
  await showTask(core, ui, first.key);
  await expect(ui.getByRole('tab', { name: 'Artifacts', exact: true })).toHaveAttribute('aria-selected', 'true');
  await showResources(ui, 'Project');
  await expect(ui.locator('[data-task-view][data-active] [data-resources]').getByRole('button', { name: 'tree-example', exact: true })).toBeVisible();
});

test('Project icons identify files and folders and follow the window theme', async ({ core, ui, files }) => {
  const folder = await core((k) => k.shell.task.folder);
  const directory = path.join(folder, 'icon-example');
  fs.mkdirSync(path.join(directory, 'src'), { recursive: true });
  const examples = ['index.ts', 'deno.json'];
  for (const name of examples) fs.writeFileSync(path.join(directory, name), '');
  await ui.locator('[data-task-view][data-active] [data-resources]').getByRole('button', { name: 'icon-example', exact: true }).click();
  const row = (name: string) => ui.locator('[data-task-view][data-active] [data-resources]').getByRole('button', { name, exact: true });
  const icon = (name: string) => row(name).locator('span[aria-hidden="true"]');
  for (const name of examples) {
    // A CSS URL alone does not prove the packaged local asset can be decoded by Chromium.
    expect(await icon(name).evaluate((element) => new Promise<boolean>((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image.naturalWidth > 0);
      image.onerror = () => resolve(false);
      image.src = getComputedStyle(element).backgroundImage.slice(5, -2);
    }))).toBe(true);
  }
  const darkIcon = await icon('deno.json').evaluate((e) => getComputedStyle(e).backgroundImage);
  await choose(ui, 'Light', await windowSubmenu(ui, 'Theme'));
  await expect(icon('deno.json')).not.toHaveCSS('background-image', darkIcon);
  await ui.keyboard.press('Escape');
  await closeMenu(ui);
  await frames(ui);
  const screenshot = path.join(files.root, 'project-icons.png');
  await core((k, file) => k.shot(file), screenshot);
  await test.info().attach('Project icons', { path: screenshot, contentType: 'image/png' });
  await choose(ui, 'Dark', await windowSubmenu(ui, 'Theme'));
  await expect(icon('deno.json')).toHaveCSS('background-image', darkIcon);
  await ui.keyboard.press('Escape');
  await closeMenu(ui);
});

test('Resources places its icon tabs, enforces its configured minimum and keeps collapse across task switches', async ({ ui, core, files }) => {
  await showResources(ui, 'Project');
  const resources = resourcesGroup(ui), project = resources.getByRole('tab', { name: 'Project', exact: true });
  const artifacts = resources.getByRole('tab', { name: 'Artifacts', exact: true });
  const t = await resources.getByRole('tab', { name: 'Agents', exact: true }).boundingBox();
  const p = await project.boundingBox(), a = await artifacts.boundingBox();
  expect(t.x).toBe(p.x); expect(t.y).toBeLessThan(p.y);
  expect(a.x).toBe(p.x); expect(a.y).toBeGreaterThan(p.y);
  await dock(ui, (api) => api.getEdgeGroup('left').setSize({ width: 10 }));
  await expect.poll(async () => (await resources.boundingBox()).width).toBe(300);
  await project.click();
  await expect(resources.locator(':scope.dv-edge-collapsed')).toBeVisible();
  await expect(ui.locator('[data-task-view][data-active] [data-resources]')).toHaveCount(0);
  await expect.poll(async () => (await resources.boundingBox()).width).toBe(40);
  const original = await core((k) => k.shell.task.key), other = path.join(files.root, 'collapsed-resources-project');
  fs.mkdirSync(other);
  await openFolder(core, ui, other); await showTask(core, ui, original);
  await expect(resources.locator(':scope.dv-edge-collapsed')).toBeVisible();
  await project.click();
  await expect(ui.getByRole('region', { name: 'Project', exact: true })).toBeVisible();
});

test('Resources restores its native collapsed group and selected section after restart', async ({ ui, core, restart }) => {
  await showResources(ui, 'Artifacts');
  await dock(ui, (api) => api.getEdgeGroup('left').setSize({ width: 420 }));
  const width = (await resourcesGroup(ui).boundingBox()).width;
  await resourcesGroup(ui).getByRole('tab', { name: 'Artifacts', exact: true }).click();
  await expect.poll(() => core((k) => (k.shell.task.store.layout() as any)?.workspace.edgeGroups.left)).toMatchObject({ collapsed: true, size: width });
  const next = await restart(), resources = resourcesGroup(next);
  await expect(resources.locator(':scope.dv-edge-collapsed')).toBeVisible();
  await expect(resources.getByRole('tab')).toHaveCount(4);
  await expect(resources.getByRole('button', { name: /^Close/ })).toHaveCount(0);
  await resources.getByRole('tab', { name: 'Artifacts', exact: true }).click();
  await expect(next.getByRole('region', { name: 'Artifacts', exact: true })).toBeVisible();
  await expect.poll(async () => (await resources.boundingBox()).width).toBe(width);
});

test('the Resources tabs and microphone stay reachable at minimum development height', async ({ ui, call }) => {
  await showResources(ui, 'Project');
  await call('profile_create', { name: 'Resources.height' });
  try {
    const stage = await ui.locator('[data-task-view][data-active]').getByTestId('stage').boundingBox();
    await ui.mouse.move(stage.x + stage.width / 2, stage.y + stage.height);
    await ui.mouse.down();
    await ui.mouse.move(stage.x + stage.width / 2, stage.y + stage.height + 500, { steps: 5 });
    await ui.mouse.up();
    const resources = resourcesGroup(ui);
    await expect.poll(async () => (await resources.boundingBox()).height).toBe(204);
    const bounds = await resources.boundingBox();
    for (const control of [...await resources.getByRole('tab').all(), resources.getByRole('button', { name: 'Speak to the agent', exact: true })]) {
      const rect = await control.boundingBox();
      expect(rect.y).toBeGreaterThanOrEqual(bounds.y);
      expect(rect.y + rect.height).toBeLessThanOrEqual(bounds.y + bounds.height);
    }
    await resources.getByRole('tab', { name: 'Artifacts', exact: true }).click();
    await expect(ui.getByRole('region', { name: 'Artifacts', exact: true })).toBeVisible();
  } finally { await ui.mouse.up(); await call('profile_close', { profile: 'Resources.height' }); }
});

test('The Agents section lists agents and shells, selects and focuses them, and keeps its section across tasks and restart', async ({ ui, core, call, files, restart }) => {
  await showResources(ui, 'Agents');
  const section = ui.getByRole('region', { name: 'Agents', exact: true });
  const row = (name: string) => section.locator('[data-terminal]').filter({ has: ui.getByRole('button', { name, exact: true }) });
  await expect.poll(() => terminalRows(ui)).toEqual(['bash *']);
  await expect(ui.getByTestId('terminal-header')).toHaveCount(0);
  const display = ui.locator('[data-task-view][data-active]').getByTestId('development-terminals');
  const terminal = await display.boundingBox(), group = await developmentBox(ui);
  expect(Math.abs(terminal.y - group.y), 'the terminal fills its pane without a header').toBeLessThanOrEqual(1);
  await call('shell_run', { name: 'dev server', command: 'echo resources-command' });
  await expect(row('dev server')).toContainText('echo resources-command');
  await expect.poll(() => terminalRows(ui)).toEqual(['bash *', 'dev server']);
  await row('dev server').getByRole('button', { name: 'dev server', exact: true }).click();
  await expect.poll(() => terminalRows(ui)).toEqual(['bash', 'dev server *']);
  await expect(termKeys(ui)).toBeFocused();
  // Selecting the current row returns the keyboard too.
  await row('dev server').getByRole('button', { name: 'dev server', exact: true }).click();
  await expect(termKeys(ui)).toBeFocused();
  await rightClick(ui, row('bash'));
  await expect(menu(ui)).toMatchAriaSnapshot(`
    - menu:
      - menuitem "Change agent…"
      - menuitem "New Conversation"
      - menuitem "Close"
  `);
  await closeMenu(ui);
  await showResources(ui, 'Project');
  await showResources(ui, 'Agents');
  await expect.poll(() => terminalRows(ui)).toEqual(['bash', 'dev server *']);
  const original = await core((k) => k.shell.task.key);
  const other = path.join(files.root, 'terminal-list-project');
  fs.mkdirSync(other);
  await openFolder(core, ui, other);
  await showTask(core, ui, original);
  await expect(section).toBeVisible();
  await expect.poll(() => terminalRows(ui)).toEqual(['bash', 'dev server *']);
  const next = await restart();
  await expect(next.getByRole('region', { name: 'Agents', exact: true })).toBeVisible();
  await expect.poll(() => terminalRows(next)).toEqual(['bash', 'dev server *']);
  await next.locator('[data-task-view][data-active] [data-resources] [data-terminal]').filter({ has: next.getByRole('button', { name: 'dev server', exact: true }) }).getByRole('button', { name: 'Close dev server', exact: true }).click();
  await expect.poll(() => terminalRows(next)).toEqual(['bash *']);
});

test('a long terminal list scrolls within Resources and selection focuses its terminal', async ({ ui, core, call }) => {
  await showResources(ui, 'Agents');
  const bounds = await core((k) => { const before = k.shell.win.getBounds(); k.shell.win.setBounds({ height: 600 }); return before; });
  await call('profile_create', { name: 'Resources.scroll' });
  try {
    const section = ui.getByRole('region', { name: 'Agents', exact: true });
    for (let i = 0; i < 8; i++) await act(ui, 'development-terminal:open', {});
    await expect(section.locator('[data-terminal]')).toHaveCount(9);
    const last = section.locator('[data-terminal]').last(), name = await last.getAttribute('aria-label');
    await last.getByRole('button', { name, exact: true }).click();
    await expect(termKeys(ui)).toBeFocused();
    // Scroll positions have no Playwright assertion.
    await expect.poll(() => section.locator('[data-sidebar="content"]').evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    for (const id of await core((k) => [...k.shell.task.developmentTerminals.values()].filter((t) => !t.agent).map((t) => t.id))) await act(ui, 'development-terminal:close', { id });
  } finally { await call('profile_close', { profile: 'Resources.scroll' }); await core((k, bounds) => k.shell.win.setBounds(bounds), bounds); }
});
