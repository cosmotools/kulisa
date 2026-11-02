// The Resources review tree and CodeView share the development area independently of Stage.
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from './fixtures.ts';
import { act, arrange, box, invoke, showResources, termKeys, termText } from './helpers.ts';
import { committed, git, openFolder, showTask } from './tasks-helpers.ts';

test('Diff copies code and file paths in Unified and Split layouts while controls stay unselectable', async ({ core, ui, files }) => {
  const folder = path.join(files.root, 'review-copy'), file = 'src/file name.ts';
  fs.mkdirSync(path.join(folder, 'src'), { recursive: true });
  const repo = committed(folder, file, 'export const copyMarker = 1;\n');
  git(repo, 'branch', '-M', 'main');
  await openFolder(core, ui, repo);
  fs.writeFileSync(path.join(repo, file), 'export const copyMarker = 2;\n');
  await showResources(ui, 'Diff');
  const code = ui.getByLabel(`Code comparison: ${file}`, { exact: true });
  const heading = ui.getByRole('heading', { name: file, exact: true });
  const collapse = heading.getByRole('button', { name: `Collapse diff for ${file}`, exact: true });
  const copy = heading.getByRole('button', { name: `Copy path for ${file}`, exact: true });
  for (const layout of ['Unified', 'Split']) {
    await ui.getByRole('radio', { name: `${layout} diff`, exact: true }).click();
    await expect(code).toHaveCSS('user-select', 'text');
    await expect(code.locator('[data-column-number]').first()).toHaveCSS('user-select', 'none');
    await expect(heading).toHaveCSS('user-select', 'none');
    await expect(collapse).toHaveCSS('user-select', 'none');
    await expect(copy).toHaveCSS('user-select', 'none');
    await copy.click();
    await expect.poll(() => core((k) => k.electron.clipboard.readText())).toBe(file);
    await expect(collapse).toHaveAttribute('aria-expanded', 'true');
    await code.getByText('copyMarker', { exact: true }).last().dblclick();
    // Playwright has no selection getter; the native Copy action also covers shadow-root selections on macOS.
    await expect.poll(() => ui.evaluate(() => getSelection()?.toString())).toBe('copyMarker');
    await core((k) => k.electron.webContents.getFocusedWebContents().copy());
    await expect.poll(() => core((k) => k.electron.clipboard.readText())).toBe('copyMarker');
  }
  await collapse.click();
  await copy.click();
  await expect.poll(() => core((k) => k.electron.clipboard.readText())).toBe(file);
  await expect(heading.getByRole('button', { name: `Expand diff for ${file}`, exact: true })).toHaveAttribute('aria-expanded', 'false');
});

test('Diff groups files into folders and switches the development area without moving Stage or stopping terminals', async ({ core, ui, files }) => {
  const original = await core((k) => k.shell.task.key);
  const repo = committed(path.join(files.root, 'review-tree'), 'checkout.ts', 'export const label = "before-marker";\n');
  git(repo, 'branch', '-M', 'main');
  await openFolder(core, ui, repo);
  const copy = await core(async (k) => { const r = await k.shell.task.makeWorktree(); if (!("folder" in r)) throw new Error(r.error); return { folder: r.folder, key: k.shell.task.key, branch: r.branch, ids: [...k.shell.task.developmentTerminals.keys()] }; });
  fs.mkdirSync(path.join(copy.folder, 'src', 'orders'), { recursive: true });
  fs.mkdirSync(path.join(copy.folder, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(copy.folder, 'src', 'orders', 'stock.ts'), 'export const inStock = true;\n');
  fs.writeFileSync(path.join(copy.folder, 'docs', 'guide.md'), '# Guide\n');
  fs.writeFileSync(path.join(copy.folder, 'checkout.ts'), 'export const label = "after-marker";\n');
  await act(ui, 'stage-terminal:open', { name: 'Review environment' });
  await arrange(ui, 'above');
  const stageBefore = await box(ui, '[data-testid="stage"]');
  await showResources(ui, 'Diff');
  await expect(ui.locator('[role="treeitem"][data-item-path="docs/guide.md"]')).toHaveAttribute('data-item-git-status', 'added');
  await expect(ui.locator('[role="treeitem"][data-item-path="checkout.ts"]')).toHaveAttribute('data-item-git-status', 'modified');
  await expect(ui.getByRole('region', { name: 'Diff review', exact: true })).toBeVisible();
  await expect(ui.getByLabel('Code comparison: docs/guide.md', { exact: true })).toContainText('Guide', { timeout: 15000 });
  await expect(ui.getByRole('region', { name: 'Changed file diffs', exact: true })).toHaveJSProperty('scrollTop', 0);
  const nav = ui.getByRole('navigation', { name: 'Resources', exact: true });
  const icons = await nav.getByRole('button').evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label')).filter((s) => ['Agents', 'Project', 'Diff', 'Artifacts'].includes(s)));
  expect(icons).toEqual(['Agents', 'Project', 'Diff', 'Artifacts']);
  const tree = ui.getByRole('region', { name: 'Diff', exact: true });
  const stock = tree.locator('[role="treeitem"][data-item-path="src/orders/stock.ts"]');
  await expect(stock).toBeVisible();
  await expect(tree.getByRole('group', { name: 'From for review-tree' })).toContainText(copy.branch + ' (worktree)');
  await expect(tree.getByRole('combobox', { name: 'To for review-tree' })).toContainText('main');
  await expect(stock).toContainText('+1');
  await tree.locator('[role="treeitem"][data-item-path="src/"]').click();
  await expect(stock).toBeHidden();
  await tree.locator('[role="treeitem"][data-item-path="src/"]').click();
  await expect(stock).toBeVisible();
  await tree.getByRole('textbox', { name: 'Filter changed files' }).fill('checkout');
  await expect(stock).toBeHidden();
  await expect(ui.getByRole('article', { name: 'src/orders/stock.ts', exact: true })).toHaveCount(0);
  await expect(ui.getByRole('article', { name: 'checkout.ts', exact: true })).toBeVisible();
  await tree.locator('[role="treeitem"][data-item-path="checkout.ts"]').click();
  const diff = ui.getByRole('region', { name: 'Diff review', exact: true });
  await expect(diff).toBeVisible();
  await expect(ui.getByLabel('Code comparison: checkout.ts', { exact: true })).toContainText('after-marker', { timeout: 15000 });
  await expect(ui.locator('[data-testid="terminal"]')).toBeHidden();
  await expect(tree.locator('[role="treeitem"][data-item-path="checkout.ts"]')).toHaveAttribute('aria-selected', 'true');
  const stageAfter = await box(ui, '[data-testid="stage"]');
  for (const dimension of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(stageAfter[dimension] - stageBefore[dimension])).toBeLessThan(2);
  expect(await core((k) => [...k.shell.task.developmentTerminals.keys()])).toEqual(copy.ids);
  expect(await core((k) => [...k.shell.task.developmentTerminals.values()].every((t) => !!t.pty))).toBe(true);
  await core((k) => k.shell.pty.write('review-background-marker\r'));
  await tree.getByRole('textbox', { name: 'Filter changed files' }).fill('');
  await showResources(ui, 'Agents');
  await expect(diff).toHaveCount(0);
  await expect(termKeys(ui)).toBeFocused();
  await expect.poll(() => termText(ui)).toContain('review-background-marker');
  fs.writeFileSync(path.join(copy.folder, 'checkout.ts'), 'export const label = "fresh-marker";\n');
  await core((k) => {
    const g = k.stash, task = k.shell.task;
    g.reviewTask = task; g.reviewOriginal = task.review;
    g.reviewStarted = false;
    const pending = new Promise<void>((resolve) => { g.startReview = resolve; });
    const prepared = new Promise<void>((resolve) => { g.finishReview = resolve; });
    task.review = async (...args: Parameters<typeof task.review>) => {
      g.reviewStarted = true; await pending;
      const result = await g.reviewOriginal.apply(task, args);
      await prepared; return result;
    };
  });
  try {
    await showResources(ui, 'Diff');
    await expect.poll(() => core((k) => k.stash.reviewStarted)).toBe(true);
    // Reopening waits for fresh Git data and never displays a previous visit's snapshot.
    await expect(ui.getByLabel('Code comparison: checkout.ts', { exact: true })).toHaveCount(0);
    await expect(tree.locator('[role="treeitem"][data-item-path="src/orders/stock.ts"]')).toHaveCount(0);
    await expect(tree.getByRole('textbox', { name: 'Filter changed files' })).toBeVisible();
    await expect(tree.getByRole('group', { name: 'From for review-tree' })).toBeVisible();
    await expect(tree.getByRole('combobox', { name: 'To for review-tree' })).toBeVisible();
    await expect(tree.getByRole('combobox', { name: 'To for review-tree' })).toBeDisabled();
    await core((k) => k.stash.startReview());
    await expect(tree.locator('[role="treeitem"][data-item-path="src/orders/stock.ts"]')).toHaveCount(0);
    await expect(ui.getByLabel('Code comparison: checkout.ts', { exact: true })).toHaveCount(0);
    await expect(tree.getByRole('progressbar')).toHaveCount(0);
    await expect(diff.getByRole('progressbar', { name: 'Loading diff' })).toBeVisible();
  } finally {
    await core((k) => {
      const g = k.stash;
      g.reviewTask.review = g.reviewOriginal; g.startReview(); g.finishReview();
    });
  }
  await expect(ui.getByLabel('Code comparison: checkout.ts', { exact: true })).toContainText('fresh-marker');
  await expect(tree.locator('[role="treeitem"][data-item-path="src/orders/stock.ts"]')).toBeVisible();
  await showResources(ui, 'Agents');
  await showTask(core, ui, original);
  expect((await invoke(ui, 'task:diff:review', { key: original, folder: copy.folder, options: {} })).error).toContain('not a resource');
});

test('Review refreshes file contents, supports split view, and releases the diff when switching tasks', async ({ core, ui, files }) => {
  const original = await core((k) => k.shell.task.key);
  const repo = committed(path.join(files.root, 'review-live'), 'file.ts', 'export const value = "old-marker";\n');
  git(repo, 'branch', '-M', 'main');
  await openFolder(core, ui, repo);
  const copy = await core(async (k) => { const r = await k.shell.task.makeWorktree(); if (!("folder" in r)) throw new Error(r.error); return r.folder; });
  const file = path.join(copy, 'file.ts');
  fs.writeFileSync(file, 'export const value = "new-marker";\n');
  fs.writeFileSync(path.join(copy, 'image.bin'), Buffer.from([0, 1, 2]));
  await showResources(ui, 'Diff');
  const tree = ui.getByRole('region', { name: 'Diff', exact: true });
  await tree.getByRole('combobox', { name: 'To for review-live' }).click();
  await ui.getByRole('option', { name: 'main', exact: true }).click();
  await tree.locator('[role="treeitem"][data-item-path="file.ts"]').click();
  const code = ui.getByLabel('Code comparison: file.ts', { exact: true });
  await expect(code).toContainText('new-marker', { timeout: 15000 });
  await expect(ui.getByRole('group', { name: 'Change summary', exact: true })).toContainText('+1');
  await ui.getByRole('radio', { name: 'Split diff', exact: true }).click();
  await expect(ui.getByRole('radio', { name: 'Split diff', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(code).toContainText('old-marker');
  const originalCode = code.getByRole('code').first().locator('[data-line]').first();
  const modifiedCode = code.getByRole('code').last().locator('[data-line]').first();
  await expect(originalCode).toBeVisible(); await expect(modifiedCode).toBeVisible();
  expect((await modifiedCode.boundingBox()).x).toBeGreaterThan((await originalCode.boundingBox()).x);
  await ui.getByRole('button', { name: 'Collapse diff for file.ts', exact: true }).click();
  await expect(code).toHaveCount(0);
  fs.writeFileSync(file, 'export const value = "live-marker";\nexport const ready = true;\n');
  await expect(tree.locator('[role="treeitem"][data-item-path="file.ts"]')).toContainText('+2', { timeout: 10000 });
  await expect(code).toHaveCount(0);
  await ui.getByRole('button', { name: 'Expand diff for file.ts', exact: true }).click();
  await expect(code).toContainText('live-marker');
  await tree.locator('[role="treeitem"][data-item-path="image.bin"]').click();
  await expect(ui.getByRole('region', { name: 'Diff review', exact: true }).getByRole('alert')).toContainText('Binary or non-UTF-8');
  await expect(code).toContainText('live-marker');
  await expect(ui.getByRole('article', { name: 'image.bin', exact: true })).toBeVisible();
  await tree.locator('[role="treeitem"][data-item-path="file.ts"]').click();
  await expect(code).toContainText('live-marker');
  git(copy, 'add', 'file.ts'); git(copy, 'commit', '-qm', 'local change');
  git(copy, 'branch', 'review-snapshot');
  await tree.getByRole('combobox', { name: 'To for review-live' }).click();
  await ui.getByRole('option', { name: 'HEAD', exact: true }).click();
  await expect(code).toHaveCount(0);
  await expect(ui.getByRole('article', { name: 'image.bin', exact: true })).toBeVisible();
  await expect(tree.locator('[role="treeitem"][data-item-path="image.bin"]')).toHaveAttribute('aria-selected', 'true');
  await tree.getByRole('combobox', { name: 'To for review-live' }).click();
  await ui.getByRole('option', { name: 'main', exact: true }).click();
  await expect(tree.getByRole('combobox', { name: 'To for review-live' })).toContainText('main');
  await expect(code).toContainText('live-marker');
  fs.writeFileSync(file, 'export const value = "worktree-only-marker";\n');
  await expect(tree.getByRole('group', { name: 'From for review-live' })).toBeVisible();
  await tree.getByRole('combobox', { name: 'To for review-live' }).click();
  await ui.getByRole('option', { name: 'review-snapshot', exact: true }).click();
  await expect(code).toContainText('worktree-only-marker');
  git(copy, 'branch', '-D', 'review-snapshot');
  await expect(ui.getByRole('region', { name: 'Diff review', exact: true }).getByRole('alert').filter({ hasText: 'To branch is unavailable' })).toBeVisible({ timeout: 10000 });
  git(copy, 'branch', 'review-snapshot');
  await expect(code).toContainText('worktree-only-marker', { timeout: 10000 });
  await expect(ui.getByRole('region', { name: 'Diff review', exact: true }).getByRole('alert').filter({ hasText: 'To branch is unavailable' })).toHaveCount(0);
  await showTask(core, ui, original);
  await expect(code).toHaveCount(0);
  await expect(ui.getByRole('region', { name: 'Diff review' })).toHaveCount(0);
  await expect(termKeys(ui)).toBeVisible();
});

test('Changing another repository comparison opens that repository review immediately', async ({ core, ui, files }) => {
  const original = await core((k) => k.shell.task.key);
  const first = committed(path.join(files.root, 'review-primary'), 'first.ts', 'export const first = 0;\n');
  const second = committed(path.join(files.root, 'review-secondary'), 'second.ts', 'export const second = 0;\n');
  for (const repo of [first, second]) git(repo, 'branch', '-M', 'main');
  await openFolder(core, ui, first);
  const primary = await core(async (k) => {
    const copy = await k.shell.task.makeWorktree();
    if (!('folder' in copy)) throw new Error(copy.error);
    return copy.folder;
  });
  await invoke(ui, 'project:folder:add', { id: files.pid('review-primary'), folder: second });
  const secondary = await core(async (k, folder) => {
    const copy = await k.shell.task.addRepository(folder);
    if (!('folder' in copy)) throw new Error(copy.error);
    return copy.folder;
  }, second);
  fs.writeFileSync(path.join(primary, 'first.ts'), 'export const first = "primary-marker";\n');
  fs.writeFileSync(path.join(secondary, 'second.ts'), 'export const second = "secondary-marker";\n');
  await showResources(ui, 'Diff');
  await expect(ui.getByLabel('Code comparison: first.ts', { exact: true })).toContainText('primary-marker');
  await ui.getByRole('combobox', { name: 'To for review-secondary' }).click();
  await ui.getByRole('option', { name: 'HEAD', exact: true }).click();
  await expect(ui.getByLabel('Code comparison: second.ts', { exact: true })).toContainText('secondary-marker');
  await expect(ui.getByLabel('Code comparison: first.ts', { exact: true })).toHaveCount(0);
  await showTask(core, ui, original);
});

test('Continuous review defers large diffs and virtualizes their lines in one document', async ({ core, ui, files }) => {
  test.slow(); // Explicitly loading 20,000-line files exercises line virtualization and navigation.
  const original = await core((k) => k.shell.task.key);
  const baseline = Array.from({ length: 20000 }, (_, i) => `// context-line-${i}`).join('\n') + '\n';
  const repo = committed(path.join(files.root, 'review-document'), 'changed.ts', baseline);
  git(repo, 'branch', '-M', 'main');
  await openFolder(core, ui, repo);
  const folder = await core(async (k) => { const r = await k.shell.task.makeWorktree(); if (!("folder" in r)) throw new Error(r.error); return r.folder; });
  fs.writeFileSync(path.join(folder, 'changed.ts'), baseline.replace('context-line-15000\n', 'changed-context-marker\n'));
  for (let i = 0; i < 40; i++) {
    const number = String(i).padStart(2, '0');
    fs.writeFileSync(path.join(folder, `f${number}.ts`), `export const file${number} = ${i};\n`);
  }
  fs.writeFileSync(path.join(folder, 'zz-large.ts'), Array.from({ length: 20000 }, (_, i) => `// large-line-${i}`).join('\n') + '\n');
  await showResources(ui, 'Diff');
  const tree = ui.getByRole('region', { name: 'Diff', exact: true });
  const code = (file: string) => ui.getByLabel(`Code comparison: ${file}`, { exact: true });
  await tree.locator('[role="treeitem"][data-item-path="f00.ts"]').click();
  await expect(code('f00.ts')).toContainText('file00', { timeout: 15000 });
  const scroll = ui.getByRole('region', { name: 'Changed file diffs', exact: true });
  await expect(ui.getByRole('article', { name: 'f01.ts', exact: true })).toBeVisible();
  const initialBounds = await scroll.boundingBox();
  await ui.mouse.move(initialBounds.x + initialBounds.width / 2, initialBounds.y + initialBounds.height / 2);
  await ui.mouse.wheel(0, 400);
  await expect(ui.getByRole('article', { name: 'f00.ts', exact: true })).not.toBeInViewport();
  await expect(tree.locator('[role="treeitem"][data-item-path="f00.ts"]')).not.toHaveAttribute('aria-selected', 'true');
  await tree.getByRole('tree').press('End');
  await tree.locator('[role="treeitem"][data-item-path="zz-large.ts"]').press('ArrowUp');
  await tree.locator('[role="treeitem"][data-item-path="f39.ts"]').click();
  await ui.getByRole('button', { name: 'Load diff for f39.ts', exact: true }).click();
  await expect(code('f39.ts')).toContainText('file39', { timeout: 15000 });
  expect(await scroll.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
  await expect(code('f00.ts')).toHaveCount(0);
  await tree.locator('[role="treeitem"][data-item-path="f39.ts"]').press('Home');
  await tree.locator('[role="treeitem"][data-item-path="changed.ts"]').click();
  await expect(ui.getByRole('button', { name: 'Load diff for changed.ts', exact: true })).toBeVisible();
  await ui.getByRole('button', { name: 'Load diff for changed.ts', exact: true }).click();
  await expect(code('changed.ts')).toContainText('changed-context-marker', { timeout: 15000 });
  await expect.poll(async () => (await code('changed.ts').boundingBox()).height).toBeLessThan(5000);
  await tree.locator('[role="treeitem"][data-item-path="changed.ts"]').press('End');
  await tree.locator('[role="treeitem"][data-item-path="zz-large.ts"]').click();
  await expect(code('zz-large.ts')).not.toContainText('large-line-0');
  await ui.getByRole('button', { name: 'Load diff for zz-large.ts', exact: true }).click();
  await expect(code('zz-large.ts')).toContainText('large-line-0', { timeout: 15000 });
  expect(await code('zz-large.ts').locator('[data-line]').count()).toBeLessThan(2000);
  await scroll.evaluate((e) => { e.scrollTop = e.scrollHeight; });
  await expect(code('zz-large.ts')).toContainText('large-line-19999', { timeout: 15000 });
  expect(await ui.getByLabel(/^Code comparison: /).count()).toBeLessThanOrEqual(20);
  const before = await scroll.evaluate((e) => e.scrollTop), bounds = await scroll.boundingBox();
  await ui.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await ui.mouse.wheel(0, -500);
  await expect.poll(() => scroll.evaluate((e) => e.scrollTop)).toBeLessThan(before);
  await tree.locator('[role="treeitem"][data-item-path="zz-large.ts"]').press('Home');
  await tree.locator('[role="treeitem"][data-item-path="f00.ts"]').click();
  await expect(code('f00.ts')).toContainText('file00');
  await expect(ui.getByRole('article', { name: 'f01.ts', exact: true })).toBeVisible();
  await showTask(core, ui, original);
});

test('Leaving Diff clears its review settings and position, including across task switches and app restarts', async ({ core, ui, files, restart }) => {
  const original = await core((k) => k.shell.task.key);
  const repo = committed(path.join(files.root, 'review-restore'), 'file.ts', 'export const value = "before";\n');
  git(repo, 'branch', '-M', 'main');
  await openFolder(core, ui, repo);
  const copy = await core(async (k) => {
    const r = await k.shell.task.makeWorktree();
    if (!("folder" in r)) throw new Error(r.error);
    return { folder: r.folder, key: k.shell.task.key };
  });
  fs.writeFileSync(path.join(copy.folder, 'file.ts'), 'export const value = "restored-review-marker";\n');
  fs.writeFileSync(path.join(copy.folder, 'z-file.ts'), Array.from({ length: 120 }, (_, i) => `export const value${i} = ${i};\n`).join(''));
  await showResources(ui, 'Diff');
  const tree = ui.getByRole('region', { name: 'Diff', exact: true });
  const customize = async () => {
    await tree.getByRole('combobox', { name: 'To for review-restore' }).click();
    await ui.getByRole('option', { name: 'HEAD', exact: true }).click();
    await tree.getByRole('textbox', { name: 'Filter changed files' }).fill('file.ts');
    await tree.locator('[role="treeitem"][data-item-path="z-file.ts"]').click();
    await expect(ui.getByLabel('Code comparison: z-file.ts', { exact: true })).toContainText('value0');
    await ui.getByRole('radio', { name: 'Split diff', exact: true }).click();
    await expect.poll(() => ui.getByRole('region', { name: 'Changed file diffs', exact: true }).evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
  };
  const fresh = async (page = ui) => {
    await expect(page.getByLabel('Code comparison: file.ts', { exact: true })).toContainText('restored-review-marker');
    await expect(page.getByRole('textbox', { name: 'Filter changed files' })).toHaveValue('');
    await expect(page.getByRole('combobox', { name: 'To for review-restore' })).toContainText('main');
    await expect(page.getByRole('radio', { name: 'Unified diff', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('region', { name: 'Changed file diffs', exact: true })).toHaveJSProperty('scrollTop', 0);
  };
  for (const section of ['Project', 'Artifacts', 'Agents', null] as const) {
    await customize();
    if (section) await showResources(ui, section);
    else await ui.getByRole('navigation', { name: 'Resources', exact: true }).getByRole('button', { name: 'Diff', exact: true }).click();
    await expect(ui.getByRole('region', { name: 'Diff review', exact: true })).toHaveCount(0);
    await expect(termKeys(ui)).toBeVisible();
    await showResources(ui, 'Diff');
    await fresh();
  }
  await customize();
  await showTask(core, ui, original);
  await showTask(core, ui, copy.key);
  await fresh();
  await customize();
  const next = await restart();
  await expect(next.getByRole('region', { name: 'Diff review', exact: true })).toBeVisible();
  await fresh(next);
  await expect(next.getByTestId('terminal')).toBeHidden();
});
