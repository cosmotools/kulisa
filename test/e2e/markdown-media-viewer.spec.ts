// Formatted Markdown and Chromium playback through real Artifacts controls (src/file-viewer/README.md).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test, expect } from './fixtures.ts';
import { showResources, invoke, ipcSettled, closeSettings } from './helpers.ts';
import { openFolder, showTask } from './tasks-helpers.ts';
import { viewerImages } from '../fixtures/viewer-images.ts';

test('Markdown renders GFM, confines local images and links, and keeps searchable source', async ({ call, ui, core }) => {
  const { artifacts } = JSON.parse((await call('task_files')).text);
  const folder = path.join(artifacts, 'markdown-report'); fs.mkdirSync(folder);
  fs.writeFileSync(path.join(folder, 'figure.png'), Buffer.from(viewerImages.png.data, 'base64'));
  fs.writeFileSync(path.join(artifacts, 'outside.png'), Buffer.from(viewerImages.png.data, 'base64'));
  fs.mkdirSync(path.join(folder, 'nested'));
  fs.writeFileSync(path.join(folder, 'nested', 'next #.txt'), 'Linked report opened');
  fs.writeFileSync(path.join(folder, 'report.md'), '# Result\n\n**Success** with ~~old text~~.\n\n| Check | Value |\n| --- | --- |\n| Passed | 42 |\n\n- [x] Done\n\n```js\nconst answer = 42;\n```\n\n![Local figure](figure.png)\n\n![Remote figure](https://example.invalid/figure.png)\n\n![Foreign file](../../../outside.png)\n\n[This report](report.md)\n\n[Outside](../../../outside.png)\n\n[Next report](nested/next%20%23.txt)\n\n[Website](https://example.invalid/)\n\n<script>window.markdownExecuted=true</script>\n\n<img src=x onerror="window.markdownExecuted=true">\n');
  await showResources(ui, 'Artifacts');
  await ui.getByRole('treeitem', { name: 'markdown-report', exact: true }).click();
  await ui.getByRole('treeitem', { name: 'report.md', exact: true }).click();
  const preview = ui.getByRole('region', { name: 'Artifact preview', exact: true });
  const article = preview.getByRole('article', { name: 'Formatted Markdown' });
  await expect(article.getByRole('heading', { name: 'Result', exact: true })).toBeVisible();
  await expect(article.getByRole('cell', { name: '42', exact: true })).toBeVisible();
  await expect(article.getByRole('checkbox')).toBeChecked();
  await expect(article.getByRole('img', { name: 'Local figure', exact: true })).toBeVisible();
  await expect.poll(() => article.getByRole('img').evaluateAll((images) => images.map((image) => (image as HTMLImageElement).naturalWidth))).toEqual([viewerImages.png.width]);
  await expect(article.getByText(/Remote figure — External images are not loaded/)).toBeVisible();
  await expect(article.getByText(/Foreign file —/)).toBeVisible();
  await expect(article.getByRole('link', { name: 'Website' })).toHaveAttribute('target', '_blank');
  expect(await ui.evaluate(() => (window as any).markdownExecuted)).toBeUndefined();
  expect(await core((k) => k.shell.task.editor.execute({ type: 'list' }))).toMatchObject({ tabs: [] });
  const image = await article.getByRole('img', { name: 'Local figure' }).elementHandle();
  const oldUrl = await image.getAttribute('src');
  await preview.getByRole('radio', { name: 'Source', exact: true }).click();
  await expect(preview.getByRole('searchbox', { name: 'Find in file' })).toBeVisible();
  await preview.getByRole('searchbox').fill('const answer');
  await expect(preview.getByRole('status', { name: 'Search results' })).toHaveText('1 / 1');
  await expect.poll(() => image.getAttribute('src')).toBeNull(); await image.dispose();
  // Revocation is observable through the browser's object-URL loader, outside locator APIs.
  expect(await ui.evaluate(async (url) => { try { await fetch(url); return true; } catch { return false; } }, oldUrl)).toBe(false);
  await preview.getByRole('radio', { name: 'Preview', exact: true }).click();
  await ui.getByRole('treeitem', { name: 'markdown-report', exact: true }).click();
  await article.getByRole('link', { name: 'This report', exact: true }).click();
  await expect(ui.getByRole('treeitem', { name: 'report.md', exact: true })).toHaveAttribute('aria-selected', 'true');
  const localUrl = await article.getByRole('img', { name: 'Local figure', exact: true }).getAttribute('src');
  await article.getByRole('link', { name: 'Outside', exact: true }).click();
  await expect(article.getByRole('status')).toHaveText('That link does not name an artifact of this task.');
  await expect(article.getByRole('img', { name: 'Local figure', exact: true })).toHaveAttribute('src', localUrl);
  await article.getByRole('link', { name: 'Next report', exact: true }).click();
  await expect(ui.getByRole('treeitem', { name: 'next #.txt', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(ui.getByRole('treeitem', { name: 'report.md', exact: true })).toHaveAttribute('aria-selected', 'false');
  await expect(preview.getByRole('searchbox')).toBeVisible();
  await preview.getByRole('searchbox').fill('Linked report opened');
  await expect(preview.getByRole('status', { name: 'Search results' })).toHaveText('1 / 1');
});

test('oversized formatted Markdown retains its source toggle and bounded source search', async ({ call, ui }) => {
  const { artifacts } = JSON.parse((await call('task_files')).text);
  fs.writeFileSync(path.join(artifacts, 'large.markdown'), `# Long report\n${'ordinary line\n'.repeat(21000)}last-marker\n`);
  await showResources(ui, 'Artifacts');
  await ui.getByRole('treeitem', { name: 'large.markdown', exact: true }).click();
  const preview = ui.getByRole('region', { name: 'Artifact preview', exact: true });
  await expect(preview.getByRole('status')).toHaveText(/Formatted Markdown is limited to 256 KiB/);
  await preview.getByRole('radio', { name: 'Source', exact: true }).click();
  await preview.getByRole('searchbox').fill('last-marker');
  await expect(preview.getByRole('status', { name: 'Search results' })).toHaveText('1 / 1');
});

function wave(seconds: number) {
  const sampleRate = 8000, length = seconds * sampleRate * 2, bytes = Buffer.alloc(44 + length);
  bytes.write('RIFF'); bytes.writeUInt32LE(36 + length, 4); bytes.write('WAVEfmt ', 8); bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22); bytes.writeUInt32LE(sampleRate, 24); bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(length, 40);
  return bytes;
}

test('audio streams and seeks, and revokes access on view/task changes and deletion', async ({ call, ui, core, files, sui }) => {
  const { artifacts } = JSON.parse((await call('task_files')).text);
  const file = path.join(artifacts, 'sample.wav'); fs.writeFileSync(file, wave(12));
  const before = await core((k) => k.webContents());
  await showResources(ui, 'Artifacts');
  await ui.getByRole('treeitem', { name: 'sample.wav', exact: true }).click();
  const preview = ui.getByRole('region', { name: 'Artifact preview', exact: true }), audio = preview.locator('audio');
  await expect.poll(() => audio.evaluate((audio: HTMLMediaElement) => audio.duration)).toBe(12);
  const url = await audio.getAttribute('src');
  await audio.press('Space');
  await expect.poll(() => audio.evaluate((audio: HTMLMediaElement) => ({ playing: !audio.paused, time: audio.currentTime > 0 }))).toEqual({ playing: true, time: true });
  // Chromium's timeline lives in closed native-controls shadow DOM. Exercise its seeking API and decoded result.
  await audio.evaluate((audio: HTMLMediaElement) => { audio.currentTime = 8; });
  await expect.poll(() => audio.evaluate((audio: HTMLMediaElement) => !audio.seeking && audio.currentTime >= 8)).toBe(true);
  expect(await core((k) => k.webContents())).toBe(before);
  const covered = await audio.elementHandle();
  await ui.getByRole('button', { name: 'Settings', exact: true }).click(); await sui();
  await expect.poll(() => covered.evaluate((audio) => ({ paused: (audio as HTMLMediaElement).paused, src: audio.getAttribute('src') }))).toEqual({ paused: true, src: null });
  await covered.dispose(); await closeSettings(core, ui, sui);
  await expect.poll(() => audio.evaluate((audio: HTMLMediaElement) => audio.duration)).toBe(12);
  await expect.poll(() => audio.evaluate((audio: HTMLMediaElement) => audio.paused)).toBe(true);
  const retained = await audio.elementHandle();
  await showResources(ui, 'Project');
  await expect.poll(() => retained.evaluate((audio) => ({ paused: (audio as HTMLMediaElement).paused, src: audio.getAttribute('src') }))).toEqual({ paused: true, src: null });
  await retained.dispose(); await ipcSettled(ui);
  // Custom schemes are served in the Workbench session; observe status there, not in a browser profile.
  const status = (url: string) => core(async (k, url) => (await k.shell.win.webContents.session.fetch(url)).status, url);
  expect(await status(url)).toBe(404);
  await showResources(ui, 'Artifacts'); await expect(audio).toBeVisible();
  await expect.poll(() => audio.evaluate((audio: HTMLMediaElement) => audio.duration)).toBe(12);
  expect(await audio.getAttribute('src')).not.toBe(url);
  const task = await core((k) => k.shell.task.key), secondUrl = await audio.getAttribute('src');
  const other = path.join(files.root, 'media-other'); fs.mkdirSync(other); await openFolder(core, ui, other);
  expect(await status(secondUrl)).toBe(404);
  await showTask(core, ui, task); await expect.poll(() => audio.evaluate((audio: HTMLMediaElement) => audio.duration)).toBe(12);
  const finalUrl = await audio.getAttribute('src');
  await preview.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(ui.getByText('Artifact is no longer available', { exact: true })).toBeVisible();
  expect(await status(finalUrl)).toBe(404);
});

test('video plays a Chromium-recorded WebM and unsupported media retains system opening', async ({ ui, call }) => {
  const { artifacts } = JSON.parse((await call('task_files')).text);
  // Generate a codec fixture with Chromium itself; no platform encoder or checked-in binary is needed.
  const bytes = await ui.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16;
    const context = canvas.getContext('2d'), stream = canvas.captureStream(10), chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
    const done = new Promise<Blob>((resolve) => { recorder.ondataavailable = (event) => chunks.push(event.data); recorder.onstop = () => resolve(new Blob(chunks)); });
    recorder.start();
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const draw = () => { context.fillStyle = performance.now() % 200 < 100 ? 'red' : 'blue'; context.fillRect(0, 0, 16, 16);
        if (performance.now() - start >= 1600) resolve(); else requestAnimationFrame(draw); };
      draw();
    });
    recorder.stop(); const blob = await done; stream.getTracks().forEach((track) => track.stop());
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  fs.writeFileSync(path.join(artifacts, 'sample.webm'), Buffer.from(bytes));
  fs.writeFileSync(path.join(artifacts, 'damaged.mp4'), 'not a supported video');
  await showResources(ui, 'Artifacts');
  await ui.getByRole('treeitem', { name: 'sample.webm', exact: true }).click();
  const preview = ui.getByRole('region', { name: 'Artifact preview', exact: true }), video = preview.locator('video');
  await expect.poll(() => video.evaluate((video: HTMLVideoElement) => video.videoWidth)).toBe(16);
  await video.press('Space');
  await expect.poll(() => video.evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThan(.1);
  await ui.getByRole('treeitem', { name: 'damaged.mp4', exact: true }).click();
  await expect(preview.getByRole('alert')).toHaveText(/could not play this file or codec/);
  await expect(preview.getByRole('button', { name: 'Open in System Application' })).toBeVisible();
});

test('large audio uses bounded ranges, rejects stale revisions and releases a held read on leaving Artifacts', async ({ ui, call, core }) => {
  const { artifacts } = JSON.parse((await call('task_files')).text), file = path.join(artifacts, 'large.wav');
  const size = 256 * 1024 * 1024, header = wave(1).subarray(0, 44);
  header.writeUInt32LE(size - 8, 4); header.writeUInt32LE(size - 44, 40);
  fs.writeFileSync(file, header); fs.truncateSync(file, size);
  const memory = async () => process.platform === 'linux' ? execFileSync('ps', ['-o', 'pid=,rss=', '-p',
    (await core((k) => [process.pid, k.shell.win.webContents.getOSProcessId()])).join(',')], { encoding: 'utf8' }) : null;
  const before = await memory();
  await showResources(ui, 'Artifacts'); await ui.getByRole('treeitem', { name: 'large.wav', exact: true }).click();
  const audio = ui.getByRole('region', { name: 'Artifact preview', exact: true }).locator('audio');
  await expect.poll(() => audio.evaluate((audio: HTMLMediaElement) => Number.isFinite(audio.duration))).toBe(true);
  const url = await audio.getAttribute('src'), key = await core((k) => k.shell.task.key);
  const opened = await memory();
  const response = await core(async (k, url) => {
    const response = await k.shell.win.webContents.session.fetch(url, { headers: { Range: 'bytes=-16' } });
    return { status: response.status, range: response.headers.get('content-range'), bytes: Array.from(new Uint8Array(await response.arrayBuffer())) };
  }, url);
  expect(response).toEqual({ status: 206, range: `bytes ${size - 16}-${size - 1}/${size}`, bytes: Array(16).fill(0) });
  expect(await invoke(ui, 'task:artifact:media:open', { key, file, revision: 'stale', request: 'stale-media' })).toHaveProperty('error');
  await showResources(ui, 'Project');
  // Hold the first decoder chunk, then leave the view before allowing the actual filesystem read to finish.
  await core((k, file) => {
    const task = k.shell.task, original = task.readArtifact;
    let release: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const state = k.stash.mediaRead = { task, original, release: () => release(), lengths: [] as number[], finished: false };
    task.readArtifact = async (name, offset, length) => {
      if (name === file && length > 1024) {
        state.lengths.push(length); await gate;
        try { return await original.call(task, name, offset, length); } finally { state.finished = true; }
      }
      return original.call(task, name, offset, length);
    };
  }, file);
  try {
    await showResources(ui, 'Artifacts');
    await expect.poll(() => core((k) => k.stash.mediaRead.lengths)).toEqual([256 * 1024]);
    const active = await audio.getAttribute('src');
    await showResources(ui, 'Project'); await ipcSettled(ui);
    await core((k) => k.stash.mediaRead.release());
    await expect.poll(() => core((k) => k.stash.mediaRead.finished)).toBe(true);
    expect(await core((k) => k.stash.mediaRead.lengths)).toEqual([256 * 1024]);
    expect(await core(async (k, url) => (await k.shell.win.webContents.session.fetch(url)).status, active)).toBe(404);
    await test.info().attach('large-media-rss', { body: JSON.stringify({ before, opened, closed: await memory(), sourceBytes: size }), contentType: 'application/json' });
  } finally {
    await core((k) => { const s = k.stash.mediaRead; s.release(); s.task.readArtifact = s.original; delete k.stash.mediaRead; });
  }
});
