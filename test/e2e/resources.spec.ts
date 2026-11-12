import { taskPage, inputPage } from './pages.ts';
// Workbench navigation, Side bar items and desktop opening (docs/tasks.md, The Workbench).
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from './fixtures.ts';
import { showResources, resourcesGroup, developmentBox, terminalRows, termKeys, act, dock, invoke, windowSubmenu, choose, closeMenu, frames, ipcSettled, rightClick, menu } from './helpers.ts';
import { committed, git, openFolder, showTask } from './tasks-helpers.ts';

test('Workbench starts with Agents, Project expands folders and opens files, and selections follow tasks', async ({ core, ui, files }) => {
  const first = await core((k) => ({ key: k.shell.task.key, folder: k.shell.task.folder }));
  const directory = path.join(first.folder, 'tree-example');
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'readme.txt');
  fs.writeFileSync(file, 'project file');
  fs.writeFileSync(path.join(first.folder, 'tree-selection.txt'), 'another file');
  await expect((await taskPage(ui)).getByRole('tab', { name: 'Agents', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect((await taskPage(ui)).getByTestId('development-terminals')).toBeVisible();
  await showResources(ui, 'Project');
  await (await taskPage(ui)).locator('[data-task-view][data-active] [data-resources]').getByRole('treeitem', { name: 'tree-example', exact: true }).click();
  const row = (await taskPage(ui)).locator('[data-task-view][data-active] [data-resources]').getByRole('treeitem', { name: 'readme.txt', exact: true });
  await expect(row).toBeVisible();
  await row.click();
  await expect(row).toHaveAttribute('aria-selected', 'true');
  await frames(ui);
  await ipcSettled(ui);
  expect(await core(async (k) => { const state = await k.shell.task.editor.execute({ type: 'list' }); return 'tabs' in state ? state.tabs : state; })).toEqual([]);
  await expect((await taskPage(ui)).getByRole('textbox', { name: file, exact: true })).toHaveCount(0);
  const otherRow = (await taskPage(ui)).locator('[data-task-view][data-active] [data-resources]').getByRole('treeitem', { name: 'tree-selection.txt', exact: true });
  await otherRow.click();
  await expect(otherRow).toHaveAttribute('aria-selected', 'true');
  await expect(row).toHaveAttribute('aria-selected', 'false');
  await otherRow.press('ControlOrMeta+a');
  await expect((await resourcesGroup(ui)).getByRole('treeitem', { selected: true })).toHaveCount(1);
  await otherRow.click();
  await otherRow.press('ArrowUp');
  await expect(row).toBeFocused();
  await expect(row).toHaveCSS('background-color', await otherRow.evaluate((element) => getComputedStyle(element).backgroundColor));
  await (await taskPage(ui)).getByRole('button', { name: 'Options', exact: true }).press('Enter');
  await expect((await menu(ui)).getByRole('menuitem', { name: 'Open', exact: true })).toBeVisible();
  await ipcSettled(ui);
  expect(await core(async (k) => { const state = await k.shell.task.editor.execute({ type: 'list' }); return 'tabs' in state ? state.tabs : state; })).toEqual([]);
  await closeMenu(ui);
  await row.dblclick();
  await expect(row).toHaveAttribute('aria-selected', 'true');
  await expect(otherRow).toHaveAttribute('aria-selected', 'false');
  await expect((await taskPage(ui)).getByRole('textbox', { name: file, exact: true })).toContainText('project file');
  await otherRow.press('Enter');
  await expect((await taskPage(ui)).getByRole('textbox', { name: path.join(first.folder, 'tree-selection.txt'), exact: true })).toContainText('another file');
  await row.press('Enter');
  await expect((await taskPage(ui)).getByRole('textbox', { name: file, exact: true })).toContainText('project file');
  await expect((await taskPage(ui)).getByRole('tablist', { name: 'Open files' }).getByRole('tab')).toHaveCount(2);
  await showResources(ui, 'Artifacts');
  await expect(row).toHaveCount(0);
  const other = path.join(files.root, 'tree-other-project');
  fs.mkdirSync(other, { recursive: true });
  fs.writeFileSync(path.join(other, 'other.txt'), 'other project');
  await openFolder(core, ui, other);
  await expect((await taskPage(ui)).getByRole('tab', { name: 'Agents', exact: true })).toHaveAttribute('aria-selected', 'true');
  await showResources(ui, 'Project');
  await expect((await taskPage(ui)).locator('[data-task-view][data-active] [data-resources]').getByRole('treeitem', { name: 'other.txt', exact: true })).toBeVisible();
  await expect((await taskPage(ui)).locator('[data-task-view][data-active] [data-resources]').getByRole('treeitem', { name: 'tree-example', exact: true })).toHaveCount(0);
  expect((await invoke(ui, 'task:file:list', { key: await core((k) => k.shell.task.key), folder: first.folder })).error).toBeTruthy();
  await showTask(core, ui, first.key);
  await expect((await taskPage(ui)).getByRole('tab', { name: 'Artifacts', exact: true })).toHaveAttribute('aria-selected', 'true');
  await showResources(ui, 'Project');
  await expect((await taskPage(ui)).locator('[data-task-view][data-active] [data-resources]').getByRole('treeitem', { name: 'tree-example', exact: true })).toBeVisible();
});

test('Project icons identify files and folders and follow the window theme', async ({ core, ui, files }) => {
  const folder = await core((k) => k.shell.task.folder);
  const directory = path.join(folder, 'icon-example');
  fs.mkdirSync(path.join(directory, 'src'), { recursive: true });
  const examples = ['index.ts', 'data.json', 'unknown.extension'];
  for (const name of examples) fs.writeFileSync(path.join(directory, name), '');
  await (await taskPage(ui)).locator('[data-task-view][data-active] [data-resources]').getByRole('treeitem', { name: 'icon-example', exact: true }).click();
  const row = async (name: string) => (await taskPage(ui)).locator('[data-task-view][data-active] [data-resources]').getByRole('treeitem', { name, exact: true });
  const icon = async (name: string) => (await row(name)).locator('[data-item-section="icon"] svg');
  for (const name of examples) {
    // Resolve the SVG reference too: a <use> alone does not prove its packaged symbol exists.
    await expect((await icon(name))).toBeVisible();
    expect(await (await icon(name)).evaluate((svg) => {
      const href = svg.querySelector('use').getAttribute('href');
      const root = svg.getRootNode();
      return root instanceof ShadowRoot && !!root.querySelector(href)?.querySelector('path');
    })).toBe(true);
  }
  const color = async (name: string) => (await icon(name)).evaluate((e) => getComputedStyle(e).color);
  const fallbackColor = await color('unknown.extension');
  expect(await color('index.ts')).not.toBe(fallbackColor);
  expect(await color('data.json')).not.toBe(fallbackColor);
  expect(await color('index.ts')).not.toBe(await color('data.json'));
  const darkIcon = await color('data.json');
  await choose(ui, 'Light', await windowSubmenu(ui, 'Theme'));
  await expect((await icon('data.json'))).not.toHaveCSS('color', darkIcon);
  await (await inputPage(ui)).keyboard.press('Escape');
  await closeMenu(ui);
  await frames(ui);
  const screenshot = path.join(files.root, 'project-icons.png');
  await core((k, file) => k.shot(file), screenshot);
  await test.info().attach('Project icons', { path: screenshot, contentType: 'image/png' });
  await choose(ui, 'Dark', await windowSubmenu(ui, 'Theme'));
  await expect((await icon('data.json'))).toHaveCSS('color', darkIcon);
  await (await inputPage(ui)).keyboard.press('Escape');
  await closeMenu(ui);
});

test('Project shows native working-tree Git statuses and refreshes after staging and restoring', async ({ core, ui, files }) => {
  fs.mkdirSync(path.join(files.root, 'project-git', 'src'), { recursive: true });
  const repo = committed(path.join(files.root, 'project-git'), 'src/file.ts', 'export const value = 1;\n');
  fs.writeFileSync(path.join(repo, '.gitignore'), 'ignored/\n');
  git(repo, 'add', '.'); git(repo, 'commit', '-m', 'Ignore build output');
  await openFolder(core, ui, repo);
  const folder = await core(async (k) => { const result = await k.shell.task.makeWorktree(); if (!('folder' in result)) throw new Error(result.error); return result.folder; });
  fs.writeFileSync(path.join(folder, 'src', 'file.ts'), 'export const value = 2;\n');
  fs.writeFileSync(path.join(folder, 'src', 'new.ts'), 'export const added = true;\n');
  fs.mkdirSync(path.join(folder, 'ignored')); fs.writeFileSync(path.join(folder, 'ignored', 'build.js'), 'output');
  await showResources(ui, 'Project');
  const tree = (await resourcesGroup(ui)).getByLabel('Project file tree', { exact: true });
  await tree.getByRole('treeitem', { name: 'src', exact: true }).click();
  const file = tree.getByRole('treeitem', { name: 'file.ts', exact: true }), added = tree.getByRole('treeitem', { name: 'new.ts', exact: true });
  await expect(file).toHaveAttribute('data-item-git-status', 'modified');
  await expect(added).toHaveAttribute('data-item-git-status', 'untracked');
  await expect(tree.getByRole('treeitem', { name: 'src', exact: true })).toHaveAttribute('data-item-contains-git-change', 'true');
  const ignored = tree.getByRole('treeitem', { name: 'ignored', exact: true });
  await expect(ignored).toHaveAttribute('data-item-git-status', 'ignored');
  await ignored.click();
  await expect(tree.getByRole('treeitem', { name: 'build.js', exact: true })).toHaveAttribute('data-item-git-status', 'ignored');
  await file.click();
  git(folder, 'add', 'src/new.ts'); git(folder, 'restore', 'src/file.ts');
  await expect(added).toHaveAttribute('data-item-git-status', 'added');
  await expect(file).not.toHaveAttribute('data-item-git-status');
  await expect(file).toHaveAttribute('aria-selected', 'true');
  expect((await invoke(ui, 'task:file:status', { key: await core((k) => k.shell.task.key), folder: repo })).error).toBeTruthy();
});

test('Resources places its icon tabs, enforces its configured minimum and keeps collapse across task switches', async ({ ui, core, files }) => {
  await showResources(ui, 'Project');
  const resources = (await resourcesGroup(ui)), project = resources.getByRole('tab', { name: 'Project', exact: true });
  const artifacts = resources.getByRole('tab', { name: 'Artifacts', exact: true });
  const t = await resources.getByRole('tab', { name: 'Agents', exact: true }).boundingBox();
  const p = await project.boundingBox(), a = await artifacts.boundingBox();
  expect(t.x).toBe(p.x); expect(t.y).toBeLessThan(p.y);
  expect(a.x).toBe(p.x); expect(a.y).toBeGreaterThan(p.y);
  await dock(ui, (api) => api.getEdgeGroup('left').setSize({ width: 10 }));
  await expect.poll(async () => (await resources.boundingBox()).width).toBe(300);
  await project.click();
  await expect(resources.locator(':scope.dv-edge-collapsed')).toBeVisible();
  await expect((await taskPage(ui)).locator('[data-task-view][data-active] [data-resources]')).toHaveCount(0);
  await expect.poll(async () => (await resources.boundingBox()).width).toBe(40);
  const original = await core((k) => k.shell.task.key), other = path.join(files.root, 'collapsed-resources-project');
  fs.mkdirSync(other);
  await openFolder(core, ui, other); await showTask(core, ui, original);
  await expect(resources.locator(':scope.dv-edge-collapsed')).toBeVisible();
  await project.click();
  await expect((await taskPage(ui)).getByRole('region', { name: 'Project', exact: true })).toBeVisible();
});

test('Resources restores its native collapsed group and selected section after restart', async ({ ui, core, restart }) => {
  await showResources(ui, 'Artifacts');
  await dock(ui, (api) => api.getEdgeGroup('left').setSize({ width: 420 }));
  const width = (await (await resourcesGroup(ui)).boundingBox()).width;
  await (await resourcesGroup(ui)).getByRole('tab', { name: 'Artifacts', exact: true }).click();
  await expect.poll(() => core((k) => (k.shell.task.store.layout() as any)?.workspace.edgeGroups.left)).toMatchObject({ collapsed: true, size: width });
  const next = await restart(), resources = (await resourcesGroup(next));
  await expect(resources.locator(':scope.dv-edge-collapsed')).toBeVisible();
  await expect(resources.getByRole('tab')).toHaveCount(4);
  await expect(resources.getByRole('button', { name: /^Close/ })).toHaveCount(0);
  await resources.getByRole('tab', { name: 'Artifacts', exact: true }).click();
  await expect((await taskPage(next)).getByRole('region', { name: 'Artifacts', exact: true })).toBeVisible();
  await expect.poll(async () => (await resources.boundingBox()).width).toBe(width);
});

test('the Resources tabs and microphone stay reachable at minimum development height', async ({ ui, call }) => {
  await showResources(ui, 'Project');
  await call('profile_create', { name: 'Resources.height' });
  try {
    const stage = await (await taskPage(ui)).locator('[data-task-view][data-active]').getByTestId('stage').boundingBox();
    await (await taskPage(ui)).mouse.move(stage.x + stage.width / 2, stage.y + stage.height);
    await (await taskPage(ui)).mouse.down();
    await (await taskPage(ui)).mouse.move(stage.x + stage.width / 2, stage.y + stage.height + 500, { steps: 5 });
    await (await taskPage(ui)).mouse.up();
    const resources = (await resourcesGroup(ui));
    await expect.poll(async () => (await resources.boundingBox()).height).toBe(204);
    const bounds = await resources.boundingBox();
    for (const control of [...await resources.getByRole('tab').all(), resources.getByRole('button', { name: 'Speak to the agent', exact: true })]) {
      const rect = await control.boundingBox();
      expect(rect.y).toBeGreaterThanOrEqual(bounds.y);
      expect(rect.y + rect.height).toBeLessThanOrEqual(bounds.y + bounds.height);
    }
    await resources.getByRole('tab', { name: 'Artifacts', exact: true }).click();
    await expect((await taskPage(ui)).getByRole('region', { name: 'Artifacts', exact: true })).toBeVisible();
  } finally { await (await taskPage(ui)).mouse.up(); await call('profile_close', { profile: 'Resources.height' }); }
});

test('The Agents section lists agents and shells, selects and focuses them, and keeps its section across tasks and restart', async ({ ui, core, call, files, restart }) => {
  await showResources(ui, 'Agents');
  const section = (await taskPage(ui)).getByRole('region', { name: 'Agents', exact: true });
  const row = async (name: string) => section.locator('[data-terminal]').filter({ has: (await taskPage(ui)).getByRole('button', { name, exact: true }) });
  await expect.poll(() => terminalRows(ui)).toEqual(['bash *']);
  await expect((await taskPage(ui)).getByTestId('terminal-header')).toHaveCount(0);
  const display = (await taskPage(ui)).locator('[data-task-view][data-active]').getByTestId('development-terminals');
  const terminal = await display.boundingBox(), group = await developmentBox(ui);
  expect(Math.abs(terminal.y - group.y), 'the terminal fills its pane without a header').toBeLessThanOrEqual(1);
  await call('shell_run', { name: 'dev server', command: 'echo resources-command' });
  await expect((await row('dev server'))).toContainText('echo resources-command');
  await expect.poll(() => terminalRows(ui)).toEqual(['bash *', 'dev server']);
  await (await row('dev server')).getByRole('button', { name: 'dev server', exact: true }).click();
  await expect.poll(() => terminalRows(ui)).toEqual(['bash', 'dev server *']);
  await expect((await termKeys(ui))).toBeFocused();
  // Selecting the current row returns the keyboard too.
  await (await row('dev server')).getByRole('button', { name: 'dev server', exact: true }).click();
  await expect((await termKeys(ui))).toBeFocused();
  await rightClick(ui, (await row('bash')));
  await expect((await menu(ui))).toMatchAriaSnapshot(`
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
  await expect((await taskPage(next)).getByRole('region', { name: 'Agents', exact: true })).toBeVisible();
  await expect.poll(() => terminalRows(next)).toEqual(['bash', 'dev server *']);
  await (await taskPage(next)).locator('[data-task-view][data-active] [data-resources] [data-terminal]').filter({ has: (await taskPage(next)).getByRole('button', { name: 'dev server', exact: true }) }).getByRole('button', { name: 'Close dev server', exact: true }).click();
  await expect.poll(() => terminalRows(next)).toEqual(['bash *']);
});

test('a long terminal list scrolls within Resources and selection focuses its terminal', async ({ ui, core, call }) => {
  await showResources(ui, 'Agents');
  const bounds = await core((k) => { const before = k.shell.win.getBounds(); k.shell.win.setBounds({ ...before, height: 600 }); return before; });
  await call('profile_create', { name: 'Resources.scroll' });
  try {
    const section = (await taskPage(ui)).getByRole('region', { name: 'Agents', exact: true });
    for (let i = 0; i < 8; i++) await act(ui, 'development-terminal:open', {});
    await expect(section.locator('[data-terminal]')).toHaveCount(9);
    const last = section.locator('[data-terminal]').last(), name = await last.getAttribute('aria-label');
    await last.getByRole('button', { name, exact: true }).click();
    await expect((await termKeys(ui))).toBeFocused();
    // Scroll positions have no Playwright assertion.
    await expect.poll(() => section.locator('[data-sidebar="content"]').evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    for (const id of await core((k) => [...k.shell.task.developmentTerminals.values()].filter((t) => !t.agent).map((t) => t.id))) await act(ui, 'development-terminal:close', { id });
  } finally { await call('profile_close', { profile: 'Resources.scroll' }); await core((k, bounds) => k.shell.win.setBounds(bounds), bounds); }
});
