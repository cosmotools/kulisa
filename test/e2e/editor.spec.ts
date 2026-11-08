// The human edits project files while agents can write them independently (src/editor/README.md).
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from './fixtures.ts';
import { showResources, rightClick, menu, closeMenu, focusWindow, invoke, answer, frames, ipcSettled } from './helpers.ts';
import { newTask, showTask, taskTab } from './tasks-helpers.ts';
const CMD = process.platform === 'darwin' ? 'Meta' : 'Control';

test('Close All saves pending edits and stops when discarding a conflicting draft is cancelled', async ({ ui, core }) => {
  const folder = await core((k) => k.shell.task.folder), first = path.join(folder, 'editor-close-first.txt'), second = path.join(folder, 'editor-close-second.txt');
  fs.writeFileSync(first, 'first'); fs.writeFileSync(second, 'second');
  await showResources(ui, 'Project'); await focusWindow(core, ui);
  const open = async (name: string, file: string) => {
    await ui.getByRole('treeitem', { name, exact: true }).dblclick();
    await expect(ui.getByRole('textbox', { name: file, exact: true })).toBeVisible();
  };
  const closeAll = async () => {
    await rightClick(ui, ui.getByRole('tab', { name: 'editor-close-first.txt', exact: true }));
    await menu(ui).getByRole('menuitem', { name: 'Close All', exact: true }).click();
  };
  await open('editor-close-first.txt', first); await open('editor-close-second.txt', second);
  await core((k) => k.clock.hold(600));
  try {
    const code = ui.getByRole('textbox', { name: second, exact: true });
    await code.press(`${CMD}+a`); await ui.keyboard.insertText('saved by Close All');
    await closeAll();
    await expect(ui.getByRole('tablist', { name: 'Open files', exact: true })).toHaveCount(0);
    expect(fs.readFileSync(second, 'utf8')).toBe('saved by Close All');
    expect(fs.readFileSync(first, 'utf8')).toBe('first');
    await open('editor-close-first.txt', first); await open('editor-close-second.txt', second);
    await ui.getByRole('tab', { name: 'editor-close-first.txt', exact: true }).click();
    const draft = ui.getByRole('textbox', { name: first, exact: true });
    await draft.press(`${CMD}+a`); await ui.keyboard.insertText('conflicting draft');
    await expect.poll(() => core(async (k) => { const state = await k.shell.task.editor.execute({ type: 'list' }); return 'document' in state && state.document?.text; })).toBe('conflicting draft');
    fs.writeFileSync(first, 'agent changes');
    await closeAll();
    expect((await answer(ui, false)).message).toBe('Discard unsaved changes?');
    await frames(ui); await ipcSettled(ui);
    await expect(ui.getByRole('tablist', { name: 'Open files', exact: true }).getByRole('tab')).toHaveCount(2);
    await expect(draft).toContainText('conflicting draft');
    expect(fs.readFileSync(first, 'utf8')).toBe('agent changes');
    await closeAll();
    await answer(ui, 'Discard changes');
    await expect(ui.getByRole('tablist', { name: 'Open files', exact: true })).toHaveCount(0);
    expect(fs.readFileSync(first, 'utf8')).toBe('agent changes');
  } finally { await core((k) => k.clock.release()); }
});

test('text files open on double-click, autosave Unicode and CRLF, retain undo across files and follow external writes', async ({ ui, core }) => {
  const folder = await core((k) => k.shell.task.folder), file = path.join(folder, 'editor-code.ts'), other = path.join(folder, 'editor-other.txt');
  fs.writeFileSync(file, '\uFEFFconst value = 1;\r\n'); fs.writeFileSync(other, 'other file');
  await showResources(ui, 'Project'); await focusWindow(core, ui);
  await ui.getByRole('treeitem', { name: 'editor-code.ts', exact: true }).dblclick();
  const code = ui.getByRole('textbox', { name: file, exact: true });
  await expect(code).toContainText('const value = 1;');
  await code.press(`${CMD}+End`); await code.press('ArrowUp'); await code.press('End');
  await ui.keyboard.insertText(' // Привет');
  await expect.poll(() => fs.readFileSync(file, 'utf8')).toContain('Привет');
  expect(fs.readFileSync(file, 'utf8')).toContain('\uFEFF');
  expect(fs.readFileSync(file, 'utf8')).toContain('\r\n');
  await ui.getByRole('treeitem', { name: 'editor-other.txt', exact: true }).dblclick();
  await expect(ui.getByRole('textbox', { name: other, exact: true })).toContainText('other file');
  await ui.getByRole('tab', { name: 'editor-code.ts', exact: true }).click();
  await expect(code).toContainText('Привет');
  await code.press(`${CMD}+z`);
  await expect.poll(() => fs.readFileSync(file, 'utf8')).not.toContain('Привет');
  // Undo leaves a real redo entry; replacing the source must make it unreachable.
  fs.writeFileSync(file, 'const agent = true;\n');
  await expect(code).toContainText('const agent = true;');
  await code.press(`${CMD}+Shift+z`); await frames(ui); await ipcSettled(ui);
  await expect(code).toContainText('const agent = true;');
  expect(fs.readFileSync(file, 'utf8')).toBe('const agent = true;\n');
  await showResources(ui, 'Agents'); await showResources(ui, 'Project');
  await expect(code).toContainText('const agent = true;');
});

test('JetBrains shortcuts replace text, insert below and move lines without losing autosave', async ({ ui, core }, testInfo) => {
  const folder = await core((k) => k.shell.task.folder), file = path.join(folder, 'editor-keys.ts');
  fs.writeFileSync(file, 'const first = 1;\nconst second = 2;\n');
  await showResources(ui, 'Project'); await focusWindow(core, ui);
  await ui.getByRole('treeitem', { name: 'editor-keys.ts', exact: true }).dblclick();
  const code = ui.getByRole('textbox', { name: file, exact: true });
  await expect(code).toContainText('const first = 1;');
  await code.press(`${CMD}+Home`); await code.press('Shift+Alt+ArrowDown');
  await expect.poll(() => fs.readFileSync(file, 'utf8')).toBe('const second = 2;\nconst first = 1;\n');
  await code.press('Shift+Enter'); await ui.keyboard.insertText('// below');
  await expect.poll(() => fs.readFileSync(file, 'utf8')).toContain('const first = 1;\n// below\n');
  await code.press(`${CMD}+r`);
  await ui.getByPlaceholder('Search', { exact: true }).fill('first');
  await ui.getByPlaceholder('Replace', { exact: true }).fill('renamed');
  await ui.getByRole('button', { name: 'Replace All', exact: true }).click();
  await expect.poll(() => fs.readFileSync(file, 'utf8')).toContain('const renamed = 1;');
  await ui.getByRole('region', { name: 'Code editor', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
  const theme = await core((k) => k.electron.nativeTheme.themeSource);
  try {
    for (const shade of ['light', 'dark'] as const) {
      await invoke(ui, 'theme:set', shade);
      if (shade === 'dark') await expect(ui.locator('html')).toHaveClass(/\bdark\b/);
      else await expect(ui.locator('html')).not.toHaveClass(/\bdark\b/);
      await code.click();
      // Root theme delivery precedes Pierre's asynchronous theme render; wait for its surface too.
      await expect.poll(() => code.evaluate((node) => getComputedStyle((node.getRootNode() as ShadowRoot).host).backgroundColor))
        .toBe(shade === 'dark' ? 'rgb(30, 31, 34)' : 'rgb(255, 255, 255)');
      // The live tokenizer must use real colors, rather than interpreting CSS-palette indices as transparent RGBA.
      await expect.poll(() => code.locator('[data-line]').first().locator('span').first().evaluate((token) => {
        const context = new OffscreenCanvas(1, 1).getContext('2d');
        context.fillStyle = getComputedStyle(token).color; context.fillRect(0, 0, 1, 1);
        return context.getImageData(0, 0, 1, 1).data[3];
      })).toBe(255);
      await testInfo.attach(`editor-${shade}`, { body: await ui.getByRole('region', { name: 'Code editor', exact: true }).screenshot(), contentType: 'image/png' });
    }
  } finally { await invoke(ui, 'theme:set', theme); }
});

test('conflicting writes pause autosave, compare both versions and recover the draft after restart', async ({ ui, core, restart }) => {
  const folder = await core((k) => k.shell.task.folder), file = path.join(folder, 'editor-conflict.txt');
  fs.writeFileSync(file, 'original');
  await showResources(ui, 'Project'); await focusWindow(core, ui);
  await ui.getByRole('treeitem', { name: 'editor-conflict.txt', exact: true }).dblclick();
  await core((k) => k.clock.hold(600));
  try {
    const code = ui.getByRole('textbox', { name: file, exact: true });
    await code.press(`${CMD}+a`); await ui.keyboard.insertText('my unfinished changes');
    await expect.poll(() => core(async (k) => { const state = await k.shell.task.editor.execute({ type: 'list' }); return !state.error && 'document' in state && state.document?.dirty; })).toBe(true);
    fs.writeFileSync(file, 'agent changes');
    await core((k) => k.clock.advance(600));
    await expect(ui.getByRole('button', { name: 'Compare versions', exact: true })).toBeVisible();
    expect(fs.readFileSync(file, 'utf8')).toBe('agent changes');
    await ui.getByRole('button', { name: 'Compare versions', exact: true }).click();
    await expect(ui.getByLabel('Conflicting versions')).toContainText('agent changes');
    await expect(ui.getByLabel('Conflicting versions')).toContainText('my unfinished changes');
  } finally { await core((k) => k.clock.release()); }
  const next = await restart();
  await expect(next.getByRole('textbox', { name: file, exact: true })).toContainText('my unfinished changes');
  await expect(next.getByRole('button', { name: 'Keep my changes', exact: true })).toBeVisible();
  expect(fs.readFileSync(file, 'utf8')).toBe('agent changes');
  await next.getByRole('button', { name: 'Keep my changes', exact: true }).click();
  await expect.poll(() => fs.readFileSync(file, 'utf8')).toBe('my unfinished changes');
  await expect(next.getByRole('status', { name: 'File status' })).toContainText('Saved automatically');
  await next.getByRole('button', { name: 'Close editor-conflict.txt', exact: true }).click();
  await expect(next.getByRole('tab', { name: 'editor-conflict.txt', exact: true })).toHaveCount(0);
});

test('binary fallback and explicit system opening preserve desktop actions', async ({ ui, core }) => {
  const folder = await core((k) => k.shell.task.folder), binary = path.join(folder, 'editor-binary.bin'), text = path.join(folder, 'editor-system.txt');
  fs.writeFileSync(binary, Buffer.from([0, 1, 2])); fs.writeFileSync(text, 'open externally');
  await showResources(ui, 'Project');
  await core((k) => {
    k.stash.editorOpenPath = k.electron.shell.openPath; k.stash.editorOpened = [];
    k.electron.shell.openPath = async (file: string) => { k.stash.editorOpened.push(file); return ''; };
  });
  try {
    await ui.getByRole('treeitem', { name: 'editor-binary.bin', exact: true }).dblclick();
    await expect.poll(() => core((k) => k.stash.editorOpened)).toEqual([binary]);
    await rightClick(ui, ui.getByRole('treeitem', { name: 'editor-system.txt', exact: true }));
    await menu(ui).getByRole('menuitem', { name: 'Open in System Application', exact: true }).click();
    await expect.poll(() => core((k) => k.stash.editorOpened)).toEqual([binary, text]);
    await ui.getByRole('treeitem', { name: 'editor-system.txt', exact: true }).dblclick();
    await rightClick(ui, ui.getByRole('tab', { name: 'editor-system.txt', exact: true }));
    await menu(ui).getByRole('menuitem', { name: 'Open in System Application', exact: true }).click();
    await expect.poll(() => core((k) => k.stash.editorOpened)).toEqual([binary, text, text]);
  } finally { await closeMenu(ui); await core((k) => { k.electron.shell.openPath = k.stash.editorOpenPath; }); }
});

test('a large file renders a bounded viewport and restores scroll when switching files', async ({ ui, core }) => {
  const folder = await core((k) => k.shell.task.folder), file = path.join(folder, 'editor-large.ts'), other = path.join(folder, 'editor-small.txt');
  fs.writeFileSync(file, Array.from({ length: 23000 }, (_, i) => `export const value${i} = ${i};\n`).join(''));
  fs.writeFileSync(other, 'small document');
  await showResources(ui, 'Project'); await focusWindow(core, ui);
  await ui.getByRole('treeitem', { name: 'editor-large.ts', exact: true }).dblclick();
  // First TypeScript grammar/editor setup for 23,000 lines exceeded five seconds with four concurrent Kulisas.
  await expect(ui.getByRole('region', { name: `Editor document: ${file}`, exact: true })).toHaveAttribute('aria-busy', 'false', { timeout: 15000 });
  const code = ui.getByRole('textbox', { name: file, exact: true });
  await expect(code).toContainText('value0');
  // Virtualized code lives in Pierre's shadow root; its DOM must stay proportional to the viewport.
  await expect.poll(() => code.evaluate((node) => node.textContent.length)).toBeLessThan(40000);
  await code.hover(); await ui.mouse.wheel(0, 12000);
  await expect(code).not.toContainText('value0');
  // Remember a visible line independently of the caret, without requiring identical pixel offsets.
  const region = ui.getByRole('region', { name: `Editor document: ${file}`, exact: true });
  const box = await region.boundingBox();
  const line = await code.locator('[data-line]').evaluateAll((rows, middle) => rows.find((row) => {
    const rect = row.getBoundingClientRect(); return rect.top <= middle && rect.bottom > middle;
  })?.getAttribute('data-line'), box.y + box.height / 2);
  expect(line, 'a code line at the middle of the editor viewport').toBeTruthy();
  await ui.getByRole('treeitem', { name: 'editor-small.txt', exact: true }).dblclick();
  await expect(ui.getByRole('textbox', { name: other, exact: true })).toBeVisible();
  await ui.getByRole('tab', { name: 'editor-large.ts', exact: true }).click();
  await expect(ui.getByRole('region', { name: `Editor document: ${file}`, exact: true })).toHaveAttribute('aria-busy', 'false');
  await expect(code.locator(`[data-line="${line}"]`)).toBeInViewport();
  await code.press(`${CMD}+End`);
  await expect(code).toContainText('value22999');
  await ui.getByRole('treeitem', { name: 'editor-small.txt', exact: true }).dblclick();
  await expect(ui.getByRole('textbox', { name: other, exact: true })).toBeVisible();
  await ui.getByRole('tab', { name: 'editor-large.ts', exact: true }).click();
  await expect(code).toContainText('value22999');
  await expect(code).toBeFocused();
  await ui.keyboard.insertText('// edited');
  await expect.poll(() => fs.readFileSync(file, 'utf8').includes('// edited')).toBe(true);
  await expect.poll(() => code.evaluate((node) => node.textContent.length)).toBeLessThan(40000);
});

test('the same file in two tasks has independent drafts and closing one task preserves the other undo history', async ({ ui, core }) => {
  const first = await core((k) => k.shell.task.key), folder = await core((k) => k.shell.task.folder), file = path.join(folder, 'editor-shared.txt');
  fs.writeFileSync(file, 'base');
  await showResources(ui, 'Project'); await focusWindow(core, ui);
  await ui.getByRole('treeitem', { name: 'editor-shared.txt', exact: true }).dblclick();
  const code = ui.getByRole('textbox', { name: file, exact: true });
  await expect(code).toBeFocused();
  await core((k) => k.clock.hold(600));
  let second: string | undefined;
  try {
    await code.press('End'); await ui.keyboard.insertText(' first draft');
    await expect.poll(() => core(async (k) => { const state = await k.shell.task.editor.execute({ type: 'list' }); return 'document' in state && state.document?.text; })).toBe('base first draft');
    second = await newTask(core, ui);
    await showResources(ui, 'Project'); await focusWindow(core, ui);
    await ui.getByRole('treeitem', { name: 'editor-shared.txt', exact: true }).dblclick();
    await expect(code).toHaveText('base');
    await taskTab(ui, second).getByRole('button', { name: 'Close', exact: true }).click();
    await expect(taskTab(ui, second)).toHaveCount(0);
    await showTask(core, ui, first);
    await showResources(ui, 'Project'); await focusWindow(core, ui);
    await expect(code).toContainText('base first draft');
    await code.press(`${CMD}+z`);
    await expect.poll(() => core(async (k) => { const state = await k.shell.task.editor.execute({ type: 'list' }); return 'document' in state && state.document?.text; })).toBe('base');
    expect(fs.readFileSync(file, 'utf8')).toBe('base');
  } finally {
    await core((k) => k.clock.release());
    if (second) await invoke(ui, 'task:close', second);
    await showTask(core, ui, first);
  }
});

test('a delayed edit reply cannot strand newer input when the task closes', async ({ ui, core }) => {
  const folder = await core((k) => k.shell.task.folder), file = path.join(folder, 'editor-closing.txt');
  fs.writeFileSync(file, '');
  await showResources(ui, 'Project'); await focusWindow(core, ui);
  await ui.getByRole('treeitem', { name: 'editor-closing.txt', exact: true }).dblclick();
  const code = ui.getByRole('textbox', { name: file, exact: true });
  await expect(code).toBeFocused();
  await core((k) => {
    const editor = k.shell.task.editor, original = editor.execute.bind(editor);
    let held = false;
    const gate = new Promise<void>((resolve) => { k.stash.editorRelease = resolve; });
    editor.execute = async (action) => {
      const result = await original(action);
      if (action.type === 'edit' && !held) { held = true; await gate; }
      return result;
    };
  });
  try {
    await ui.keyboard.insertText('first');
    await expect.poll(() => core(async (k) => { const state = await k.shell.task.editor.execute({ type: 'list' }); return 'document' in state && state.document?.text; })).toBe('first');
    await ui.keyboard.insertText(' second');
    await ui.getByRole('tablist', { name: 'Open tasks', exact: true }).getByRole('tab', { selected: true }).getByRole('button', { name: 'Close', exact: true }).click();
    await expect.poll(() => fs.readFileSync(file, 'utf8')).toBe('first second');
  } finally { await core((k) => { k.stash.editorRelease(); }); }
});
