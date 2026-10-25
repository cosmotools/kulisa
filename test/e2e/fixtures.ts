// The e2e tests' fixtures (docs/testing.md, End to end on Playwright Test): a screen of its own per worker on Linux, one
// Kulisa per test file in a folder of its own, its core (core) and its window's page (ui), and what a failed test
// leaves to read: the window's picture, Playwright's trace, Kulisa's log. Kulisa's uncaught errors fail the test.
import { test as base, expect, _electron } from '@playwright/test';
import type { ElectronApplication, Page, TestInfo } from '@playwright/test';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';
import electronPath from 'electron';
import { removeTree } from '../../src/main/remove.ts';
import type { Kulisa } from './driver.ts';

// A function run in Kulisa's main process with its driver and one argument; only data crosses (Playwright serializes
// both ways), so it names what it needs by the argument, never by a closure.
type Core = <A, R>(fn: (k: Kulisa, arg: A) => R | Promise<R>, arg?: A) => Promise<R>;
type Running = { file: string; app: ElectronApplication; root: string; core: Core; ui: Page; errors: string[] };

// The checkout's own folder for the tests' Kulisas: worktrees run their tests at once (CLAUDE.md, Worktrees).
const repo = path.join(import.meta.dirname, '..', '..');
const base_ = path.join(fs.realpathSync.native(os.tmpdir()), `kulisa-e2e-${path.basename(repo)}-${crypto.createHash('sha1').update(repo).digest('hex').slice(0, 6)}`);
const hidden = process.platform === 'linux' && !process.env.KULISA_VISIBLE;

// Xvfb with openbox, its display number chosen by Xvfb (-displayfd): the windows never take the human's screen or focus,
// and a worker's windows never take another's. Without a window manager windows are not listed for screenshots and
// focus differs from a desktop.
async function screen(): Promise<{ display: string; stop: () => void }> {
  const xvfb = spawn('Xvfb', ['-displayfd', '1', '-screen', '0', '1920x1080x24', '-nolisten', 'tcp'], { stdio: ['ignore', 'pipe', 'ignore'] });
  const line = await new Promise<string>((resolve, reject) => {
    readline.createInterface({ input: xvfb.stdout }).once('line', resolve);
    xvfb.once('exit', (code) => reject(new Error(`Xvfb ended with ${code}: sudo apt install xvfb openbox`)));
  });
  const display = `:${line.trim()}`;
  const wm: ChildProcess = spawn('openbox', [], { env: { ...process.env, DISPLAY: display }, stdio: 'ignore' });
  return { display, stop: () => { wm.kill(); xvfb.kill(); } };
}

async function launch(file: string, display: string | null): Promise<Running> {
  const root = path.join(base_, `${path.basename(file, '.spec.ts')}-${crypto.randomBytes(3).toString('hex')}`);
  fs.mkdirSync(root, { recursive: true });
  const env: Record<string, string> = { ...process.env as Record<string, string>, KULISA_TEST_ROOT: root, KULISA_SCREENSHOTS: path.join(root, 'screenshots') };
  // On Xvfb, X11's: Electron takes Wayland wherever WAYLAND_DISPLAY is set, and would open on the human's screen.
  if (display) { env.DISPLAY = display; delete env.WAYLAND_DISPLAY; env.XDG_SESSION_TYPE = 'x11'; }
  // executablePath: without Playwright's loader, which would give Kulisa Chromium's switches of a test browser
  // (no throttling of background and covered windows): the tests run Kulisa as the human does. No GPU on Xvfb: WebGL on
  // Chromium's software renderer, as the terminal uses it on a real one.
  const app = await _electron.launch({ executablePath: electronPath as unknown as string, args: [...(display ? ['--ignore-gpu-blocklist'] : []), path.join(import.meta.dirname, 'app.ts')], env, timeout: 60000 });
  const core: Core = (fn, arg) => app.evaluate((_electron, [src, a]) => (0, eval)(`(${src})`)(globalThis.__kulisa, a), [fn.toString(), arg] as const);
  await expect.poll(() => app.evaluate(() => !!globalThis.__kulisa?.shell.task?.loaded && !!globalThis.__kulisa.shell.pty), { timeout: 30000 }).toBe(true);
  const ui = app.windows().find((p) => p.url().includes('/index.html')) ?? await app.waitForEvent('window', (p) => p.url().includes('/index.html'));
  // Playwright makes every page it attaches to think it has the focus (Emulation.setFocusEmulationEnabled): the
  // window's page gets the OS's focus back, which the tests of focus check.
  await (await app.context().newCDPSession(ui)).send('Emulation.setFocusEmulationEnabled', { enabled: false });
  const errors: string[] = [];
  ui.on('pageerror', (e) => errors.push(`window: ${e.stack ?? e.message}`));
  await app.context().tracing.start({ screenshots: true, snapshots: true });
  return { file, app, root, core, ui, errors };
}

// What a failed test leaves, as its attachments (the HTML report, the CI's artifact): the window as the screen shows it,
// the trace of its steps in the window's page, Kulisa's log.
async function leave(k: Running, info: TestInfo) {
  const png = info.outputPath('window.png');
  await k.core((d, f) => d.shot(f), png).then(() => info.attach('window', { path: png, contentType: 'image/png' }), () => {});
  const trace = info.outputPath('trace.zip');
  await k.app.context().tracing.stopChunk({ path: trace }).then(() => info.attach('trace', { path: trace, contentType: 'application/zip' }), () => {});
  const log = path.join(k.root, 'data', 'logs', 'kulisa.log');
  if (fs.existsSync(log)) await info.attach('kulisa.log', { path: log, contentType: 'text/plain' });
}

async function close(k: Running) {
  await k.app.close().catch(() => {});
  try { removeTree(k.root); } catch {} // Windows: a file still held; the next run's folder is another
}

export const test = base.extend<{ kulisa: Running; core: Core; ui: Page }, { display: string | null; running: { current: Running | null } }>({
  display: [async ({}, use) => {
    if (!hidden) return use(null);
    const s = await screen();
    await use(s.display);
    s.stop();
  }, { scope: 'worker' }],
  // The worker's Kulisa: one per test file, made again for the next file (a failed test's worker is replaced, and the
  // file's next tests get a new one).
  running: [async ({}, use) => {
    const holder: { current: Running | null } = { current: null };
    await use(holder);
    if (holder.current) await close(holder.current);
    try { fs.rmdirSync(base_); } catch {} // empty once every file's folder is gone
  }, { scope: 'worker' }],
  kulisa: [async ({ display, running }, use, info) => {
    if (running.current?.file !== info.file) {
      if (running.current) await close(running.current);
      running.current = await launch(info.file, display);
    }
    const k = running.current;
    await k.app.context().tracing.startChunk({ title: info.title });
    k.errors.length = 0;
    await k.core((d) => { d.errors.length = 0; });
    await use(k);
    const errors = [...k.errors, ...await k.core((d) => d.errors).catch(() => [] as string[])];
    if (info.status !== info.expectedStatus || errors.length) await leave(k, info);
    else await k.app.context().tracing.stopChunk();
    expect(errors, 'uncaught errors in Kulisa while the test ran').toEqual([]);
  }, { timeout: 90000 }],
  core: async ({ kulisa }, use) => { await use(kulisa.core); },
  ui: async ({ kulisa }, use) => { await use(kulisa.ui); },
});

export { expect };
