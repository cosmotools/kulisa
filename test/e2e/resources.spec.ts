// The shown task's files and their desktop opening action (docs/tasks.md, The Resources panel).
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from './fixtures.ts';
import { invoke, windowSubmenu, choose, closeMenu, frames } from './helpers.ts';
import { openFolder, showTask } from './tasks-helpers.ts';

test('Resources starts with Project, expands folders, opens files and follows projects', async ({ core, ui, files }) => {
  const first = await core((k) => ({ key: k.shell.task.key, folder: k.shell.task.folder }));
  const directory = path.join(first.folder, 'tree-example');
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'readme.txt');
  fs.writeFileSync(file, 'project file');
  await expect(ui.getByRole('tab', { name: 'Project', exact: true })).toHaveAttribute('aria-selected', 'true');
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
  await ui.getByRole('tab', { name: 'Artifacts', exact: true }).click();
  await expect(row).toHaveCount(0);
  const other = path.join(files.root, 'tree-other-project');
  fs.mkdirSync(other, { recursive: true });
  fs.writeFileSync(path.join(other, 'other.txt'), 'other project');
  await openFolder(core, ui, other);
  await expect(ui.getByRole('tab', { name: 'Project', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(ui.locator('#resources').getByRole('button', { name: 'other.txt', exact: true })).toBeVisible();
  await expect(ui.locator('#resources').getByRole('button', { name: 'tree-example', exact: true })).toHaveCount(0);
  expect((await invoke(ui, 'task:files', { key: await core((k) => k.shell.task.key), folder: first.folder })).error).toBeTruthy();
  await showTask(core, ui, first.key);
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
  await expect(icon('src')).toHaveCSS('background-image', /\/folder-src-[^/]+\.svg/);
  await row('src').click();
  await expect(icon('src')).toHaveCSS('background-image', /\/folder-src-open-[^/]+\.svg/);
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
