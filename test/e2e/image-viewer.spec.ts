import { taskPage } from './pages.ts';
// Ordinary image results use Chromium without a native view and release their object URLs (src/file-viewer/README.md).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test, expect } from './fixtures.ts';
import { showResources, invoke, SITE, frames, ipcSettled } from './helpers.ts';
import { viewerImages } from '../fixtures/viewer-images.ts';

test('Chromium displays PNG, JPEG, WebP, AVIF, BMP, ICO, animated GIF and inert SVG results', async ({ ui, call, core }) => {
  const { artifacts } = JSON.parse((await call('task_files')).text);
  for (const [extension, fixture] of Object.entries(viewerImages)) fs.writeFileSync(path.join(artifacts, `sample.${extension}`), Buffer.from(fixture.data, 'base64'));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="60" height="80" fill="red"/>
    <script>fetch('${SITE}/artifact-script-must-not-run')</script><image href="${SITE}/artifact-resource-must-not-load" width="20" height="20"/></svg>`;
  fs.writeFileSync(path.join(artifacts, 'sample.svg'), svg);
  const requests: string[] = [];
  const observed = (request: { url(): string }) => { if (request.url().startsWith(`${SITE}/artifact-`)) requests.push(request.url()); };
  ui.on('request', observed);
  try {
    await showResources(ui, 'Artifacts');
    const preview = (await taskPage(ui)).getByRole('region', { name: 'Artifact preview', exact: true });
    for (const [extension, fixture] of [...Object.entries(viewerImages), ['svg', { width: 120, height: 80 }] as const]) {
      await (await taskPage(ui)).getByRole('treeitem', { name: `sample.${extension}`, exact: true }).click();
      await expect(preview.getByRole('img', { name: `sample.${extension}`, exact: true })).toBeVisible();
      await expect(preview.getByRole('radio', { name: '100%', exact: true })).toBeEnabled();
      await expect(preview.getByLabel('Image dimensions')).toHaveText(`${fixture.width} × ${fixture.height}`);
      if (extension === 'gif') {
        // Canvas uses the first animation frame. Sample the painted center: fractional placement can put background at screenshot edges.
        const pixel = async () => {
          const png = await preview.getByRole('img', { name: 'sample.gif', exact: true }).screenshot({ animations: 'allow' });
          return core((k, data) => {
            const image = k.electron.nativeImage.createFromBuffer(Buffer.from(data, 'base64')), { width, height } = image.getSize();
            const offset = (Math.floor(height / 2) * width + Math.floor(width / 2)) * 4;
            return [...image.toBitmap().subarray(offset, offset + 4)];
          }, png.toString('base64'));
        };
        const first = await pixel(); await expect.poll(pixel).not.toEqual(first);
      }
    }
    await frames(ui);
    expect(requests).toEqual([]);
  } finally { ui.off('request', observed); }
});

test('a tall screenshot supports fit, width, actual size, zoom and scrolling; switching releases URLs without extra views', async ({ ui, call, core }) => {
  const { artifacts } = JSON.parse((await call('task_files')).text);
  const data = await core((k) => k.electron.nativeImage.createFromBitmap(Buffer.alloc(1000 * 6000 * 4, 160), { width: 1000, height: 6000 }).toPNG().toString('base64'));
  fs.writeFileSync(path.join(artifacts, 'tall.png'), Buffer.from(data, 'base64'));
  const before = await core((k) => k.webContents());
  const rendererRss = async () => process.platform === 'linux'
    ? Number(execFileSync('ps', ['-o', 'rss=', '-p', String(await core((k) => k.shell.windows[0].focusUi.getOSProcessId()))], { encoding: 'utf8' }).trim()) : null;
  const memory = [{ state: 'before', rssKiB: await rendererRss() }];
  await (await taskPage(ui)).evaluate(() => {
    const create = URL.createObjectURL, revoke = URL.revokeObjectURL;
    const state = { revoked: [] as string[], restore: () => { URL.createObjectURL = create; URL.revokeObjectURL = revoke; } };
    (window as any).__imageUrls = state;
    URL.revokeObjectURL = (url) => { state.revoked.push(url); revoke.call(URL, url); };
  });
  try {
    await showResources(ui, 'Artifacts');
    await (await taskPage(ui)).getByRole('treeitem', { name: 'tall.png', exact: true }).click();
    const preview = (await taskPage(ui)).getByRole('region', { name: 'Artifact preview', exact: true });
    const image = preview.getByRole('img', { name: 'tall.png', exact: true });
    await expect(preview.getByRole('radio', { name: '100%', exact: true })).toBeEnabled();
    const url = await image.getAttribute('src'); expect(url).toMatch(/^blob:/);
    const viewport = preview.getByLabel('Image viewport');
    // DOM geometry is the observable scroll/scale result; no semantic locator API exposes it.
    const metrics = () => viewport.evaluate((el) => ({ width: el.clientWidth, height: el.clientHeight, scrollWidth: el.scrollWidth, scrollHeight: el.scrollHeight }));
    const fit = await metrics(); expect(fit.scrollHeight).toBeLessThanOrEqual(fit.height + 1);
    await preview.getByRole('radio', { name: '100%', exact: true }).click();
    await expect(preview.getByLabel('Image zoom')).toHaveText('100%');
    expect((await metrics()).scrollHeight).toBeGreaterThan(6000);
    await viewport.focus(); await viewport.press('End');
    await expect.poll(() => viewport.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await preview.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect(preview.getByLabel('Image zoom')).toHaveText('125%');
    await preview.getByRole('button', { name: 'Zoom out', exact: true }).click();
    await expect(preview.getByLabel('Image zoom')).toHaveText('100%');
    await preview.getByRole('radio', { name: 'Fit width', exact: true }).click();
    const width = await metrics(); expect(width.scrollWidth).toBeLessThanOrEqual(width.width + 1);
    memory.push({ state: 'open', rssKiB: await rendererRss() });
    await preview.getByRole('radio', { name: 'Fit', exact: true }).click();
    await ui.screenshot({ path: '/tmp/fv393-image-preview.png' });
    const retainedImage = await image.elementHandle();
    await showResources(ui, 'Project');
    await expect.poll(() => retainedImage.getAttribute('src')).toBeNull(); await retainedImage.dispose();
    await expect.poll(async () => (await taskPage(ui)).evaluate((url) => (window as any).__imageUrls.revoked.includes(url), url)).toBe(true);
    expect(await core((k) => k.webContents())).toBe(before);
    memory.push({ state: 'closed', rssKiB: await rendererRss() });
    await showResources(ui, 'Artifacts');
    await expect(preview.getByRole('radio', { name: '100%', exact: true })).toBeEnabled();
    expect(await image.getAttribute('src')).not.toBe(url);
    for (let iteration = 0; iteration < 4; iteration++) {
      await showResources(ui, 'Project'); await showResources(ui, 'Artifacts');
      await expect(preview.getByRole('radio', { name: '100%', exact: true })).toBeEnabled();
      memory.push({ state: `reopen-${iteration + 1}`, rssKiB: await rendererRss() });
    }
    await preview.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect((await taskPage(ui)).getByText('Artifact is no longer available', { exact: true })).toBeVisible();
    await test.info().attach('image-renderer-rss', { body: JSON.stringify(memory), contentType: 'application/json' });
  } finally { await (await taskPage(ui)).evaluate(() => { (window as any).__imageUrls.restore(); delete (window as any).__imageUrls; }); }
});

test('oversized, malformed, unsupported and huge-dimension images have a system-opening fallback', async ({ ui, call, core, files }) => {
  const { artifacts } = JSON.parse((await call('task_files')).text);
  fs.writeFileSync(path.join(artifacts, 'damaged.png'), 'not an image');
  fs.writeFileSync(path.join(artifacts, 'unsupported.psd'), Buffer.alloc(30));
  const huge = Buffer.alloc(24); huge.set([137, 80, 78, 71, 13, 10, 26, 10]); huge.write('IHDR', 12);
  huge.writeUInt32BE(100000, 16); huge.writeUInt32BE(100000, 20); fs.writeFileSync(path.join(artifacts, 'huge.png'), huge);
  const large = path.join(artifacts, 'large.png'), fd = fs.openSync(large, 'w'); fs.ftruncateSync(fd, 16 * 1024 * 1024 + 1); fs.closeSync(fd);
  await showResources(ui, 'Artifacts');
  const preview = (await taskPage(ui)).getByRole('region', { name: 'Artifact preview', exact: true });
  for (const [name, message] of [['damaged.png', /damaged|not supported/], ['unsupported.psd', /not supported/],
    ['huge.png', /16 million pixels/], ['large.png', /16 MiB/]] as const) {
    await (await taskPage(ui)).getByRole('treeitem', { name, exact: true }).click();
    await expect(preview.getByRole('alert')).toHaveText(message);
    await expect(preview.getByRole('img')).toHaveCount(0);
    await expect(preview.getByRole('button', { name: 'Open in System Application' })).toBeVisible();
  }
  const key = await core((k) => k.shell.task.key);
  expect(await invoke(ui, 'task:artifact:view', { key, file: path.join(files.root, 'package.json') })).toHaveProperty('error');
});

test('the latest artifact selection wins when an earlier ownership check finishes late', async ({ core, call, ui }) => {
  const { artifacts } = JSON.parse((await call('task_files')).text);
  const old = path.join(artifacts, 'slow.png'), current = path.join(artifacts, 'latest.png');
  for (const file of [old, current]) fs.writeFileSync(file, Buffer.from(viewerImages.png.data, 'base64'));
  await core((k, old) => {
    const task = k.shell.task, find = task.findArtifact;
    let release: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    k.stash.slowArtifact = { task, find, started: false, release: () => release() };
    task.findArtifact = async (file) => {
      const result = await find.call(task, file);
      if (file === old) { k.stash.slowArtifact.started = true; await gate; }
      return result;
    };
  }, old);
  try {
    await showResources(ui, 'Artifacts');
    await (await taskPage(ui)).getByRole('treeitem', { name: 'slow.png', exact: true }).click();
    await expect.poll(() => core((k) => k.stash.slowArtifact.started)).toBe(true);
    await (await taskPage(ui)).getByRole('treeitem', { name: 'latest.png', exact: true }).click();
    const image = (await taskPage(ui)).getByRole('region', { name: 'Artifact preview', exact: true }).getByRole('img', { name: 'latest.png', exact: true });
    await expect(image).toBeVisible();
    await core((k) => k.stash.slowArtifact.release()); await ipcSettled(ui);
    await expect(image).toBeVisible();
  } finally {
    await core((k) => { const { task, find, release } = k.stash.slowArtifact; release(); task.findArtifact = find; delete k.stash.slowArtifact; });
  }
});
