// Artifact previews, resource limits and native PDF lifecycle (src/file-viewer/README.md).
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from './fixtures.ts';
import { showResources, invoke, rightClick, menu, closeMenu, notLoading, ipcSettled } from './helpers.ts';
import { newTask, openFolder, showTask } from './tasks-helpers.ts';

test('ordinary nested text results are read-only, searchable and follow live changes without unrelated reloads', async ({ core, ui, call }) => {
  const { artifacts } = JSON.parse((await call('task_files')).text);
  fs.mkdirSync(path.join(artifacts, 'text-report'));
  const file = path.join(artifacts, 'text-report', 'report.yml');
  fs.writeFileSync(file, `${'item: ordinary\n'.repeat(5000)}unique-last-line: found\n`);
  await showResources(ui, 'Artifacts');
  await ui.getByRole('treeitem', { name: 'text-report', exact: true }).click();
  const row = ui.getByRole('treeitem', { name: path.basename(file), exact: true });
  await row.click();
  const preview = ui.getByRole('region', { name: 'Artifact preview', exact: true });
  const search = preview.getByRole('searchbox', { name: 'Find in file' });
  await expect(search).toBeVisible();
  await expect(preview.getByText('unique-last-line: found', { exact: true })).toHaveCount(0);
  await search.fill('unique-last-line');
  await expect(preview.getByRole('status', { name: 'Search results' })).toHaveText('1 / 1');
  await expect(preview.locator('[data-line="5001"]')).toBeInViewport();
  await expect(preview.locator('[data-line="5001"]')).toContainText('unique-last-line: found');
  await expect(preview.getByRole('textbox')).toHaveCount(0);
  await preview.getByRole('button', { name: 'Wrap', exact: true }).click();
  await expect(preview.getByRole('button', { name: 'Wrap', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await showResources(ui, 'Project');
  await showResources(ui, 'Artifacts');
  await expect(preview.getByRole('searchbox')).toBeVisible();
  expect(await core(async (k) => { const state = await k.shell.task.editor.execute({ type: 'list' }); return 'tabs' in state ? state.tabs.length : -1; })).toBe(0);
  await search.fill('unique-last-line');
  fs.writeFileSync(path.join(artifacts, 'other.txt'), 'another result');
  await expect(ui.getByRole('treeitem', { name: 'other.txt', exact: true })).toBeVisible();
  await expect(search).toHaveValue('unique-last-line');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('found', 'other'));
  await expect(search).toHaveValue('');
  await search.fill('unique-last-line: other');
  await expect(preview.getByRole('status', { name: 'Search results' })).toHaveText('1 / 1');
  await ui.getByRole('treeitem', { name: 'text-report', exact: true }).click();
  await row.click();
  await expect(search).toHaveValue('');
});

test('binary and oversized artifacts have explicit fallback; reads reject foreign paths and deletion clears the preview', async ({ core, ui, files }) => {
  const created = await core(async (k) => {
    const source = { kind: 'profile' as const, id: 'viewer', tab: 't1' };
    return { key: k.shell.task.key,
      binary: await k.shell.task.saveArtifact(source, 'response.bin', Buffer.from([0, 1, 2, 255])),
      large: await k.shell.task.saveArtifact(source, 'request.txt', 'x'.repeat(4 * 1024 * 1024 + 1)) };
  });
  await showResources(ui, 'Artifacts');
  const row = (file: string) => ui.getByRole('treeitem', { name: path.basename(file), exact: true });
  await row(created.binary).click();
  const preview = ui.getByRole('region', { name: 'Artifact preview', exact: true });
  await expect(preview.getByRole('status')).toHaveText('No viewer is available for this file.');
  await expect(preview.getByRole('button', { name: 'Open in System Application' })).toBeVisible();
  await row(created.large).click();
  await expect(preview.getByRole('alert')).toHaveText('Text preview is limited to 4 MiB.');
  expect((await invoke(ui, 'task:artifact:read', { key: created.key, file: path.join(files.root, 'package.json'), offset: 0, length: 20 })).error).toMatch(/outside the results folder/);
  await preview.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(ui.getByText('Artifact is no longer available', { exact: true })).toBeVisible();
  await expect(row(created.large)).toHaveCount(0);
});

function pdf() {
  const content = 'BT /F1 24 Tf 50 700 Td (Artifact PDF preview needle needle needle) Tj ET\n';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${content.length} >>\nstream\n${content}endstream`];
  let value = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) { offsets.push(value.length); value += `${index + 1} 0 obj\n${object}\nendobj\n`; }
  const xref = value.length;
  return `${value}xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
}

test('built-in PDF uses an isolated native viewer, survives menus, and releases on view/task change or deletion', async ({ core, ui, files, call }) => {
  const before = await core((k) => k.webContents());
  const { artifacts } = JSON.parse((await call('task_files')).text);
  const folder = path.join(artifacts, 'pdf-report'); fs.mkdirSync(folder);
  const file = path.join(folder, 'result.pdf'); fs.writeFileSync(file, pdf());
  await showResources(ui, 'Artifacts');
  await ui.getByRole('treeitem', { name: 'pdf-report', exact: true }).click();
  const row = ui.getByRole('treeitem', { name: path.basename(file), exact: true });
  await row.click();
  const current = () => core((k) => k.shell.windows[0].artifactPdf.native.contents?.id ?? null);
  await expect.poll(current).not.toBeNull();
  const first = await current();
  // Chromium's PDF UI lives in an internal extension frame, outside the Workbench DOM/CDP locators.
  await expect.poll(() => core(async (k) => {
    const wc = k.shell.windows[0].artifactPdf.native.contents;
    const frame = wc?.mainFrame.framesInSubtree.find((f) => f.url.startsWith('chrome-extension:'));
    return frame ? frame.executeJavaScript("document.querySelector('pdf-viewer')?.documentDimensions?.pageDimensions?.length ?? 0") : 0;
  })).toBe(1);
  expect(await core((k) => {
    const wc = k.shell.windows[0].artifactPdf.native.contents, preferences = (wc as typeof wc & { getLastWebPreferences(): Electron.WebPreferences }).getLastWebPreferences();
    return { session: wc.session === k.shell.win.webContents.session, preload: preferences.preload ?? null, node: preferences.nodeIntegration, sandbox: preferences.sandbox };
  })).toEqual({ session: false, preload: null, node: false, sandbox: true });
  const preview = ui.getByRole('region', { name: 'Artifact preview', exact: true });
  await preview.getByRole('searchbox', { name: 'Find in file' }).fill('Artifact PDF');
  await expect(preview.getByRole('status', { name: 'Search results' })).toHaveText('1 / 1');
  await preview.getByRole('searchbox', { name: 'Find in file' }).fill('needle');
  await expect(preview.getByRole('status', { name: 'Search results' })).toHaveText('1 / 3');
  await preview.getByRole('button', { name: 'Next match', exact: true }).click();
  await expect(preview.getByRole('status', { name: 'Search results' })).toHaveText('2 / 3');
  await preview.getByRole('button', { name: 'Previous match', exact: true }).click();
  await expect(preview.getByRole('status', { name: 'Search results' })).toHaveText('1 / 3');
  // Input in the native view cannot be sent through Workbench's DOM.
  await core((k) => k.press(k.shell.windows[0].artifactPdf.native.contents, 'f', k.CMD));
  await expect(preview.getByRole('searchbox', { name: 'Find in file' })).toBeFocused();
  await rightClick(ui, row);
  await expect(menu(ui).getByRole('menuitem', { name: 'Open in System Application' })).toBeVisible();
  await closeMenu(ui);
  expect(await current()).toBe(first);
  await showResources(ui, 'Project');
  await expect.poll(current).toBeNull();
  await expect.poll(() => core((k) => k.webContents())).toBe(before);
  await showResources(ui, 'Artifacts');
  await expect.poll(current).not.toBeNull();
  const previousTask = await core((k) => k.shell.task.key);
  const other = path.join(files.root, 'pdf-other-project'); fs.mkdirSync(other);
  await openFolder(core, ui, other);
  await expect.poll(current).toBeNull();
  await showTask(core, ui, previousTask);
  await expect.poll(current).not.toBeNull();
  await call('task_artifacts_delete', { files: [folder] });
  await expect.poll(current).toBeNull();
  await expect(ui.getByText('Artifact is no longer available', { exact: true })).toBeVisible();
});

test('a caught task rendering failure releases its native PDF and refuses a stale reopen', async ({ core, ui }) => {
  const original = await core((k) => k.shell.task.key);
  const key = await newTask(core, ui, 'pdf-failed-screen');
  await notLoading(ui);
  await core((k) => k.ensureProfile('PDF.failure', 'about:blank'));
  const file = await core((k, content) => k.shell.task.saveArtifact({ kind: 'profile', id: 'viewer', tab: 't1' }, 'failure.pdf', content), pdf());
  await showResources(ui, 'Artifacts');
  await ui.getByRole('treeitem', { name: path.basename(file), exact: true }).click();
  await expect.poll(() => core((k) => k.shell.task.window.artifactPdf.native.contents?.id ?? null)).not.toBeNull();
  // Malformed tab data exercises the real React boundary while the core profile remains valid.
  await core((k) => {
    const t = k.shell.task, p = [...t.profiles.values()][0], data = p.info();
    t.window.send('profile:state', { task: t.key, list: [{ ...data,
      tabs: data.tabs.map((tab, i) => i ? tab : { ...tab, title: {} as unknown as string }) }] });
  });
  try {
    await expect(ui.locator(`[data-task-view="${key}"] [role="alert"]`)).toContainText('This task’s screen could not be displayed');
    await expect.poll(() => core((k) => ({ failed: k.shell.task.viewFailed, pdf: k.shell.task.window.artifactPdf.native.contents?.id ?? null }))).toEqual({ failed: true, pdf: null });
    expect(await invoke(ui, 'task:artifact:pdf:open', { key, file, request: 'stale-after-failure', box: { x: 0, y: 0, width: 100, height: 100 } })).toHaveProperty('error');
    expect(await core((k) => k.shell.task.window.artifactPdf.native.contents?.id ?? null)).toBeNull();
  } finally {
    await showTask(core, ui, original);
    await invoke(ui, 'task:close', key);
  }
});

test('leaving a PDF during loading stops subsequent file reads', async ({ core, ui, call, files }) => {
  const { artifacts } = JSON.parse((await call('task_files')).text), file = path.join(artifacts, 'cancel-loading.pdf');
  const bytes = Buffer.alloc(8 * 1024 * 1024 + 1); bytes.write('%PDF-1.7'); fs.writeFileSync(file, bytes);
  // Hold a real ranged read so leaving the pane happens before the remaining PDF chunks are requested.
  await core((k, file) => {
    const task = k.shell.task, read = task.readArtifact, load = task.readArtifactPdf;
    let release: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const state = k.stash.pdfRead = { task, read, load, release: () => release(), offsets: [] as number[], finished: false };
    task.readArtifact = async (path, offset, length) => {
      if (path === file && length > 1024) { state.offsets.push(offset); if (!offset) await gate; }
      return read.call(task, path, offset, length);
    };
    task.readArtifactPdf = async (...args) => { try { return await load.apply(task, args); } finally { state.finished = true; } };
  }, file);
  try {
    await showResources(ui, 'Artifacts');
    await ui.getByRole('treeitem', { name: 'cancel-loading.pdf', exact: true }).click();
    await expect.poll(() => core((k) => k.stash.pdfRead.offsets)).toEqual([0]);
    const before = files.log().length;
    await showResources(ui, 'Project');
    await expect.poll(() => files.log().slice(before)).toContain('[ipc] task:artifact:pdf:close');
    await ipcSettled(ui);
    await core((k) => k.stash.pdfRead.release());
    await expect.poll(() => core((k) => k.stash.pdfRead.finished)).toBe(true);
    expect(await core((k) => k.stash.pdfRead.offsets)).toEqual([0]);
    expect(await core((k) => k.shell.windows[0].artifactPdf.native.contents)).toBeNull();
  } finally {
    await core((k) => { const s = k.stash.pdfRead; s.release(); s.task.readArtifact = s.read; s.task.readArtifactPdf = s.load; delete k.stash.pdfRead; });
  }
});
