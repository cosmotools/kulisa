// The shown task's files and their desktop opening action (docs/tasks.md, The Resources panel).
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from './fixtures.ts';
import { invoke } from './helpers.ts';
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
