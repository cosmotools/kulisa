import { taskPage } from './pages.ts';
// Results from ordinary filesystem writes and independent agent contexts (docs/tasks.md, Artifacts and temporary files).
import fs from 'node:fs';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { test, expect } from './fixtures.ts';
import { showResources, rightClick, choose, invoke, answer, menu, submenu } from './helpers.ts';
import { profiles } from './agent-helpers.ts';
import { newTask, showTask } from './tasks-helpers.ts';

test('ordinary nested results update live, including empty folders, moves and deletion; temporary work stays hidden', async ({ call, ui }) => {
  const { artifacts, tmp } = JSON.parse((await call('task_files')).text);
  await call('task_artifacts_delete', { all: true });
  await showResources(ui, 'Artifacts');
  fs.mkdirSync(path.join(artifacts, 'html', 'assets'), { recursive: true });
  fs.writeFileSync(path.join(artifacts, 'html', 'index.html'), '<h1>Ready</h1>');
  fs.writeFileSync(path.join(tmp, 'scratch.txt'), 'working');
  expect(JSON.parse((await call('task_artifacts', { area: 'temporary' })).text).entries.some((a: { file: string }) => a.file === path.join(tmp, 'scratch.txt'))).toBe(true);
  const folder = (await taskPage(ui)).getByRole('treeitem', { name: 'html', exact: true });
  await expect(folder).toBeVisible(); await folder.click();
  await expect((await taskPage(ui)).getByRole('treeitem', { name: 'assets', exact: true })).toBeVisible();
  const index = (await taskPage(ui)).getByRole('treeitem', { name: 'index.html', exact: true });
  await expect(index).toContainText('1 KB');
  fs.writeFileSync(path.join(artifacts, 'html', 'index.html'), 'x'.repeat(2048));
  await expect(index).toContainText('2 KB');
  fs.renameSync(path.join(artifacts, 'html', 'index.html'), path.join(artifacts, 'html', 'report.html'));
  await expect(index).toHaveCount(0);
  await expect((await taskPage(ui)).getByRole('treeitem', { name: 'report.html', exact: true })).toBeVisible();
  await expect((await taskPage(ui)).getByRole('treeitem', { name: 'scratch.txt', exact: true })).toHaveCount(0);
  await rightClick(ui, folder); await choose(ui, 'Delete'); await expect(folder).toHaveCount(0);
  expect(fs.existsSync(path.join(artifacts, 'html'))).toBe(false);
  expect(fs.existsSync(path.join(tmp, 'scratch.txt'))).toBe(true);
});

test('external clients explicitly create stable contexts; screenshots and cleanup stay with their owner', async ({ core, mcp }) => {
  await profiles(core);
  const unbound = await mcp({ unbound: true });
  const read = (r: Awaited<ReturnType<Client['callTool']>>) => JSON.parse((r.content as { text: string }[])[0].text);
  expect(read(await unbound.callTool({ name: 'task_files', arguments: {} })).tmp).toBeNull();
  expect((await unbound.callTool({ name: 'browser_screenshot', arguments: { profile: 'Elon.buyer' } })).isError).toBe(true);
  const first = read(await unbound.callTool({ name: 'task_files', arguments: { newContext: true } }));
  const second = read(await unbound.callTool({ name: 'task_files', arguments: { newContext: true } }));
  expect(path.dirname(first.tmp)).toBe(path.join(path.dirname(first.artifacts), 'tmp'));
  expect(path.basename(first.tmp)).toBe(`agent-${first.session}`); expect(first.tmp).not.toBe(second.tmp);
  const client = new Client({ name: 'resumable-test-agent', version: '0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(first.mcp)));
  try {
    expect(client.getInstructions()).toContain(first.tmp);
    const shot = await client.callTool({ name: 'browser_screenshot', arguments: { profile: 'Elon.buyer' } });
    const file = (shot.content as { text: string }[])[0].text.match(/^Saved as (.+)$/)[1];
    expect(path.dirname(file)).toBe(first.tmp); expect(fs.existsSync(file)).toBe(true);
    const other = path.join(second.tmp, 'working.txt'); fs.writeFileSync(other, 'keep');
    expect((await client.callTool({ name: 'task_artifacts_delete', arguments: { area: 'temporary', files: [other] } })).isError).toBe(true);
    await client.callTool({ name: 'task_artifacts_delete', arguments: { area: 'temporary', all: true } });
    expect(fs.existsSync(file)).toBe(false); expect(fs.existsSync(other)).toBe(true);
  } finally { await client.close(); }
  const resumed = new Client({ name: 'resumable-test-agent', version: '0' });
  await resumed.connect(new StreamableHTTPClientTransport(new URL(first.mcp)));
  try { expect(read(await resumed.callTool({ name: 'task_files', arguments: {} })).tmp).toBe(first.tmp); }
  finally { await resumed.close(); }
});

test('artifacts sort folders first and newest modified first, updating live without losing selection or expansion', async ({ call, ui }) => {
  const { artifacts } = JSON.parse((await call('task_files')).text);
  await call('task_artifacts_delete', { all: true });
  const stamp = (name: string, seconds: number) => fs.utimesSync(path.join(artifacts, name), seconds, seconds);
  for (const folder of ['a-folder', 'z-folder']) fs.mkdirSync(path.join(artifacts, folder));
  fs.mkdirSync(path.join(artifacts, 'a-folder', 'nested'));
  for (const name of ['a-old.txt', 'z-new.txt', 'a-folder/2.txt', 'a-folder/10.txt', 'a-folder/nested/deep.txt']) {
    fs.writeFileSync(path.join(artifacts, name), name);
    stamp(name, 1000);
  }
  stamp('z-new.txt', 2000); stamp('a-folder', 1000); stamp('z-folder', 2000); stamp('a-folder/nested', 5000);
  await showResources(ui, 'Artifacts');
  const rows = (await taskPage(ui)).locator('[data-task-view][data-active] [data-resources]').getByRole('treeitem');
  const order = async () => Promise.all((await rows.all()).map((row) => row.getAttribute('data-item-path')));
  await expect.poll(order).toEqual(['z-folder/', 'a-folder/', 'z-new.txt', 'a-old.txt']);
  await (await taskPage(ui)).getByRole('treeitem', { name: 'a-folder', exact: true }).click();
  await (await taskPage(ui)).getByRole('treeitem', { name: '10.txt', exact: true }).click();
  await expect.poll(order).toEqual(['z-folder/', 'a-folder/', 'a-folder/nested/', 'a-folder/2.txt', 'a-folder/10.txt', 'z-new.txt', 'a-old.txt']);
  fs.writeFileSync(path.join(artifacts, 'a-folder/10.txt'), 'updated nested result');
  stamp('a-folder/10.txt', 3000);
  fs.writeFileSync(path.join(artifacts, 'a-old.txt'), 'updated result'); stamp('a-old.txt', 3000);
  await expect.poll(order).toEqual(['z-folder/', 'a-folder/', 'a-folder/nested/', 'a-folder/10.txt', 'a-folder/2.txt', 'a-old.txt', 'z-new.txt']);
  await expect((await taskPage(ui)).getByRole('treeitem', { name: '10.txt', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('conversation IDs determine temporary paths across task closure and app restart; a new conversation gets a new folder', async ({ core, ui, call, restart }) => {
  const terminal = await core((k) => k.shell.task.promptTarget().id);
  const first = JSON.parse((await call('task_files', {}, { terminal })).text);
  const key = await core((k) => k.shell.task.key);
  expect(first.tmp).toBe(path.join(path.dirname(first.artifacts), 'tmp', `agent-${first.session}`));
  fs.writeFileSync(path.join(first.tmp, 'continue.txt'), 'continue');
  fs.writeFileSync(path.join(first.artifacts, 'result.txt'), 'keep result');
  const env = await core((k, id) => k.shell.task.env(k.shell.task.developmentTerminals.get(id)), terminal);
  expect(env.KULISA_TMP_DIR).toBe(first.tmp); expect(env.KULISA_ARTIFACTS_DIR).toBe(first.artifacts);
  await invoke(ui, 'task:close', key);
  const previous = path.join(path.dirname(first.artifacts), `tmp-agent-${first.session}`);
  fs.renameSync(first.tmp, previous);
  await showTask(core, ui, key);
  expect(fs.existsSync(previous)).toBe(false);
  expect(JSON.parse((await call('task_files', {}, { terminal })).text).tmp).toBe(first.tmp);
  const nextUI = await restart();
  expect(JSON.parse((await call('task_files', {}, { terminal })).text).tmp).toBe(first.tmp);
  expect(fs.readFileSync(path.join(first.tmp, 'continue.txt'), 'utf8')).toBe('continue');
  await invoke(nextUI, 'agent:new-conversation', { task: key, id: terminal });
  const nextTerminal = await core((k) => k.shell.task.promptTarget().id);
  expect(nextTerminal).not.toBe(terminal);
  expect(JSON.parse((await call('task_files', {}, { terminal: nextTerminal })).text).tmp).not.toBe(first.tmp);
  expect(JSON.parse((await call('task_files', {}, { terminal })).text).tmp).toBe(first.tmp);
  expect(fs.readFileSync(path.join(first.artifacts, 'result.txt'), 'utf8')).toBe('keep result');
});

test('task deletion removes results and every temporary owner', async ({ core, ui, call }) => {
  const original = await core((k) => k.shell.task.key);
  const key = await newTask(core, ui, 'file-cleanup');
  const { artifacts, tmp } = JSON.parse((await call('task_files')).text);
  fs.writeFileSync(path.join(artifacts, 'result.txt'), 'done'); fs.writeFileSync(path.join(tmp, 'working.txt'), 'work');
  const deletion = invoke(ui, 'task:delete', key); await answer(ui, 'Delete'); await deletion;
  await expect.poll(() => fs.existsSync(artifacts)).toBe(false); expect(fs.existsSync(tmp)).toBe(false);
  await showTask(core, ui, original);
});

test('changed image contents refresh previews and duplicate basenames keep generic icons', async ({ core, call, ui }) => {
  const { artifacts } = JSON.parse((await call('task_files')).text);
  await call('task_artifacts_delete', { all: true });
  const pictures = await core((k) => [0, 255].map((value) => k.electron.nativeImage.createFromBitmap(Buffer.from([value, 0, 0, 255]), { width: 1, height: 1 }).toPNG().toString('base64')));
  const file = path.join(artifacts, 'preview.png'); fs.writeFileSync(file, Buffer.from(pictures[0], 'base64'));
  await showResources(ui, 'Artifacts');
  const row = (await taskPage(ui)).getByRole('treeitem', { name: 'preview.png', exact: true });
  await expect(row.locator('[data-item-section=icon] use')).toHaveAttribute('href', /^#artifact-thumbnail-/);
  const symbol = await row.locator('[data-item-section=icon] use').getAttribute('href');
  const picture = (await taskPage(ui)).locator(`${symbol} image`), before = await picture.getAttribute('href');
  fs.writeFileSync(file, Buffer.from(pictures[1], 'base64'));
  await expect(picture).not.toHaveAttribute('href', before);
  for (const folder of ['before', 'after']) {
    fs.mkdirSync(path.join(artifacts, folder)); fs.copyFileSync(file, path.join(artifacts, folder, 'comparison.png'));
  }
  for (const folder of ['before', 'after']) {
    await (await taskPage(ui)).getByRole('treeitem', { name: folder, exact: true }).click();
  }
  const copies = (await taskPage(ui)).getByRole('treeitem', { name: 'comparison.png', exact: true });
  await expect(copies).toHaveCount(2);
  for (const copy of await copies.all()) await expect(copy.locator('[data-item-section=icon] use')).not.toHaveAttribute('href', /^#artifact-thumbnail-/);
});

test('a large results folder keeps DOM rows and MCP response pages bounded', async ({ call, ui }) => {
  const { artifacts } = JSON.parse((await call('task_files')).text);
  await call('task_artifacts_delete', { all: true });
  await showResources(ui, 'Artifacts');
  const folder = path.join(artifacts, 'many'); fs.mkdirSync(folder);
  for (let i = 0; i < 5000; i++) {
    const file = path.join(folder, `file-${String(i).padStart(4, '0')}.txt`);
    fs.writeFileSync(file, 'result'); fs.utimesSync(file, 1000, 1000);
  }
  await (await taskPage(ui)).getByRole('treeitem', { name: 'many', exact: true }).click();
  await expect((await taskPage(ui)).getByRole('treeitem', { name: 'file-0000.txt', exact: true })).toBeVisible();
  expect(await (await taskPage(ui)).getByRole('treeitem').count()).toBeLessThan(80);
  const page = JSON.parse((await call('task_artifacts', { offset: 4999, limit: 2 })).text);
  expect(page.total).toBe(5001); expect(page.entries).toHaveLength(2);
  await expect(call('task_artifacts', { limit: 201 })).rejects.toThrow();
});

test('File Folders opens the shared tmp parent in the file manager', async ({ core, call, ui }) => {
  const { tmp } = JSON.parse((await call('task_files')).text);
  await showResources(ui, 'Artifacts');
  await core((k) => {
    // The desktop file manager is outside CDP; observe the path given to the OS.
    k.stash.openPath = k.electron.shell.openPath; k.stash.opened = [];
    k.electron.shell.openPath = async (file: string) => { k.stash.opened.push(file); return ''; };
  });
  try {
    await (await taskPage(ui)).getByRole('button', { name: 'File Folders', exact: true }).click();
    await (await menu(ui)).getByRole('menuitem', { name: 'Temporary Files', exact: true }).hover();
    await choose(ui, 'All Temporary Files', (await submenu(ui)));
    await expect.poll(() => core((k) => k.stash.opened)).toEqual([path.dirname(tmp)]);
  } finally { await core((k) => { k.electron.shell.openPath = k.stash.openPath; }); }
});
