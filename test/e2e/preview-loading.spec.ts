// Local preview latency and partial readiness (src/file-viewer/README.md).
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from './fixtures.ts';
import { showResources, frames } from './helpers.ts';
import { viewerImages } from '../fixtures/viewer-images.ts';

test('small files reuse recognition bytes; only a real wait shows progress while controls stay available', async ({ ui, core, call }) => {
  const { artifacts } = JSON.parse((await call('task_files')).text);
  const small = { 'instant.txt': Buffer.from('Local text\n'), 'instant.md': Buffer.from('# Local Markdown\n'),
    'instant.png': Buffer.from(viewerImages.png.data, 'base64') };
  for (const [name, bytes] of Object.entries(small)) fs.writeFileSync(path.join(artifacts, name), bytes);
  fs.writeFileSync(path.join(artifacts, 'waiting.txt'), `${'ordinary line\n'.repeat(6000)}held-marker\n`);
  await core((k) => {
    const task = k.shell.task, read = task.readArtifact;
    let release = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const state = k.stash.previewRead = { task, read, release: () => release(), reads: [] as { name: string; length: number }[] };
    task.readArtifact = async (file, offset, length) => {
      const name = file.split(/[\\/]/).at(-1);
      state.reads.push({ name, length });
      if (name === 'waiting.txt' && length > 1024) await gate;
      return read.call(task, file, offset, length);
    };
  });
  await showResources(ui, 'Artifacts');
  // Mutation timing observes transient states that locator polling and final screenshots can miss.
  await ui.evaluate(() => {
    const timing = { clicked: Infinity, shown: [] as number[] };
    const clicked = (event: MouseEvent) => {
      if (event.composedPath().some(node => node instanceof Element && node.getAttribute('role') === 'treeitem')) timing.clicked = performance.now();
    };
    document.addEventListener('click', clicked, { capture: true });
    const observer = new MutationObserver(() => {
      if ([...document.querySelectorAll('[aria-label="Artifact preview"] [role="status"]')].some(x => x.textContent === 'Loading…'))
        timing.shown.push(performance.now() - timing.clicked);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    (window as any).__previewWait = { timing, stop: () => { observer.disconnect(); document.removeEventListener('click', clicked, { capture: true }); } };
  });
  try {
    const preview = ui.getByRole('region', { name: 'Artifact preview', exact: true });
    for (const [name, bytes] of Object.entries(small)) {
      await ui.getByRole('treeitem', { name, exact: true }).click();
      if (name.endsWith('.png')) await expect(preview.getByRole('radio', { name: '100%', exact: true })).toBeEnabled();
      else if (name.endsWith('.md')) await expect(preview.getByRole('heading', { name: 'Local Markdown' })).toBeVisible();
      else await expect(preview.locator('[data-line="1"]').first()).toContainText('Local text');
      expect(await core((k, name) => {
        const reads: { name: string; length: number }[] = k.stash.previewRead.reads;
        return reads.filter(r => r.name === name).map(r => r.length);
      }, name)).toEqual([bytes.length]);
    }
    await ui.getByRole('treeitem', { name: 'waiting.txt', exact: true }).click();
    const search = preview.getByRole('searchbox', { name: 'Find in file' });
    await expect(search).toBeVisible();
    await search.fill('held-marker');
    await expect(preview.getByRole('status', { name: '', exact: true })).toHaveText('Loading…');
    await core((k) => k.stash.previewRead.release());
    await expect(preview.getByRole('status', { name: 'Search results' })).toHaveText('1 / 1');
    await expect(preview.getByRole('status', { name: '', exact: true })).toHaveCount(0);
    await frames(ui);
    const shown = await ui.evaluate(() => (window as any).__previewWait.timing.shown as number[]);
    expect(shown.length).toBeGreaterThan(0);
    expect(Math.min(...shown)).toBeGreaterThanOrEqual(200);
  } finally {
    await core((k) => { const s = k.stash.previewRead; s.release(); s.task.readArtifact = s.read; delete k.stash.previewRead; });
    await ui.evaluate(() => { (window as any).__previewWait.stop(); delete (window as any).__previewWait; });
  }
});
