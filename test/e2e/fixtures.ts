// The e2e tests' fixtures (docs/testing.md, End to end on Playwright Test): a screen of its own per worker on Linux, one
// Kulisa per test file in a folder of its own, its core (core), its window's page (ui), Settings' (sui), the agent's MCP
// tools (call), a restart in the same folder, and what a failed test leaves to read: the window's picture, Playwright's
// trace, Kulisa's log. Kulisa's uncaught errors fail the test.
import { test as base, expect, _electron } from '@playwright/test';
import type { ElectronApplication, Page, TestInfo } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
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
import { data } from './data.ts';

// A function run in Kulisa's main process with its driver and one argument; only data crosses (Playwright serializes
// both ways), so it names what it needs by the argument, never by a closure.
type Core = <A, R>(fn: (k: Kulisa, arg: A) => R | Promise<R>, arg?: A) => Promise<R>;
// The agent's tools, as the agent of a task (its key; the window's task by default) in one of its terminals calls them.
type Where = { task?: string; terminal?: number };
type CallResult = { content: { type: string; text?: string; data?: string; mimeType?: string }[]; text: string; isError?: boolean; structuredContent?: unknown };
type Call = (name: string, args?: Record<string, unknown>, where?: Where) => Promise<CallResult>;
type Running = { file: string; app: ElectronApplication; root: string; core: Core; ui: Page; errors: string[]; clients: Map<string, Client> };

// The checkout's own folder for the tests' Kulisas: worktrees run their tests at once (CLAUDE.md, Worktrees).
const repo = path.join(import.meta.dirname, '..', '..');
const base_ = path.join(fs.realpathSync.native(os.tmpdir()), `kulisa-e2e-${path.basename(repo)}-${crypto.createHash('sha1').update(repo).digest('hex').slice(0, 6)}`);
const hidden = process.platform === 'linux' && !process.env.KULISA_VISIBLE;
const own = (p: Page) => p.url().startsWith('file:'); // Kulisa's own pages (dist/renderer), not a profile's

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

// restart: the folder of the Kulisa quit, started again in it (KULISA_RESTART, app.ts).
async function launch(file: string, display: string | null, restart?: string): Promise<Running> {
  const root = restart ?? path.join(base_, `${path.basename(file, '.spec.ts')}-${crypto.randomBytes(3).toString('hex')}`);
  fs.mkdirSync(root, { recursive: true });
  const env: Record<string, string> = { ...process.env as Record<string, string>, KULISA_TEST_ROOT: root, KULISA_SCREENSHOTS: path.join(root, 'screenshots') };
  if (restart) env.KULISA_RESTART = '1';
  // On Xvfb, X11's: Electron takes Wayland wherever WAYLAND_DISPLAY is set, and would open on the human's screen.
  if (display) { env.DISPLAY = display; delete env.WAYLAND_DISPLAY; env.XDG_SESSION_TYPE = 'x11'; }
  // executablePath: without Playwright's loader, which would give Kulisa Chromium's switches of a test browser
  // (no throttling of background and covered windows): the tests run Kulisa as the human does. No GPU on Xvfb: WebGL on
  // Chromium's software renderer, as the terminal uses it on a real one.
  const app = await _electron.launch({ executablePath: electronPath as unknown as string, args: [...(display ? ['--ignore-gpu-blocklist'] : []), path.join(import.meta.dirname, 'app.ts')], env, timeout: 60000 });
  const errors: string[] = [];
  // Playwright attaches to every page, profiles' too, and makes each think it has the focus
  // (Emulation.setFocusEmulationEnabled), which also keeps it visible and unthrottled behind others (CLAUDE.md, Hard-won
  // facts): each gets the OS's focus and visibility back, as the human's Kulisa has them. Kulisa's own pages' uncaught
  // errors fail the test (a site's are the site's).
  const attach = async (p: Page) => {
    if (own(p)) p.on('pageerror', (e) => errors.push(`${path.basename(new URL(p.url()).pathname)}: ${e.stack ?? e.message}`));
    // A page closing as it comes (a tab closed at once) has no target left to send to.
    await app.context().newCDPSession(p).then((c) => c.send('Emulation.setFocusEmulationEnabled', { enabled: false })).catch(() => {});
  };
  app.on('window', (p) => void attach(p));
  for (const p of app.windows()) await attach(p);
  const core: Core = (fn, arg) => app.evaluate((_electron, [src, a]) => (0, eval)(`(${src})`)(globalThis.__kulisa, a), [fn.toString(), arg] as const);
  await expect.poll(() => app.evaluate(() => !!globalThis.__kulisa?.shell.task?.loaded && !!globalThis.__kulisa.shell.pty), { timeout: 30000 }).toBe(true);
  await core((k) => k.watchPty(k.shell.pty));
  const ui = app.windows().find((p) => p.url().includes('/index.html')) ?? await app.waitForEvent('window', (p) => p.url().includes('/index.html'));
  await app.context().tracing.start({ screenshots: true, snapshots: true });
  return { file, app, root, core, ui, errors, clients: new Map() };
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

// Quit as the human does (Playwright's close is app.quit: before-quit saves the session cookies).
async function quit(k: Running) {
  for (const c of k.clients.values()) await c.close().catch(() => {});
  await k.app.close().catch(() => {});
}
async function close(k: Running) {
  await quit(k);
  try { removeTree(k.root); } catch {} // Windows: a file still held; the next run's folder is another
}

type Fixtures = {
  kulisa: Running; core: Core; ui: Page; call: Call;
  // Settings' window's page, once it is open and loaded (settings-window.ts).
  sui: () => Promise<Page>;
  // The test's Kulisa quit as the human quits it and started again in the same folder (KULISA_RESTART, app.ts): its
  // window's page given back; core, call, sui and mcp reach the new Kulisa.
  restart: () => Promise<Page>;
  // The MCP client of the agent of a task, as it gets the server's instructions and tools.
  mcp: (where?: Where) => Promise<Client>;
  // The test's folders and what Kulisa saved there (data.ts).
  files: ReturnType<typeof data>;
};

export const test = base.extend<Fixtures, { display: string | null; running: { current: Running | null } }>({
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
    await k.core((d) => d.reset());
    await use(k);
    const now = running.current; // a restart's Kulisa
    const errors = [...now.errors, ...await now.core((d) => d.errors).catch(() => [] as string[])];
    if (info.status !== info.expectedStatus || errors.length) await leave(now, info);
    else await now.app.context().tracing.stopChunk().catch(() => {});
    // Started again (restart), it is not as a file's tests begin: the next test gets a new one.
    if (now !== k) { await close(now); running.current = null; }
    expect(errors, 'uncaught errors in Kulisa while the test ran').toEqual([]);
  }, { timeout: 90000 }],
  core: async ({ kulisa, running }, use) => { void kulisa; await use((fn, arg) => running.current.core(fn, arg)); },
  ui: async ({ kulisa }, use) => { await use(kulisa.ui); },
  mcp: async ({ kulisa, running }, use) => {
    void kulisa;
    await use(async ({ task, terminal } = {}) => {
      const k = running.current;
      const url = await k.core((d, a) => {
        const t = a.task ? d.shell.taskByKey(a.task) : d.shell.task;
        return t.env(a.terminal === undefined ? undefined : t.terminals.get(a.terminal)).KULISA_MCP_URL;
      }, { task, terminal });
      let c = k.clients.get(url);
      if (!c) {
        c = new Client({ name: 'kulisa-test', version: '0' });
        await c.connect(new StreamableHTTPClientTransport(new URL(url)));
        k.clients.set(url, c);
      }
      return c;
    });
  },
  call: async ({ mcp }, use) => {
    await use(async (name, args = {}, where) => {
      const r = await (await mcp(where)).callTool({ name, arguments: args });
      const content = r.content as CallResult['content'];
      const text = content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
      if (r.isError) throw new Error(`${name}: ${text}`);
      return { ...r, content, text };
    });
  },
  sui: async ({ kulisa, running }, use) => {
    void kulisa;
    await use(async () => {
      const app = running.current.app, isSettings = (p: Page) => p.url().includes('settings.html') && !p.isClosed();
      const p = app.windows().find(isSettings) ?? await app.waitForEvent('window', isSettings);
      await p.waitForLoadState();
      return p;
    });
  },
  restart: async ({ kulisa, running, display }, use, info) => {
    void kulisa;
    await use(async () => {
      const old = running.current;
      await old.app.context().tracing.stopChunk().catch(() => {});
      await quit(old);
      running.current = await launch(old.file, display, old.root);
      await running.current.app.context().tracing.startChunk({ title: `${info.title} (after the restart)` });
      await running.current.core((d) => d.reset());
      return running.current.ui;
    });
  },
  files: async ({ kulisa }, use) => { await use(data(kulisa.root)); },
});

export { expect };
export type { Core, Call, Where };
