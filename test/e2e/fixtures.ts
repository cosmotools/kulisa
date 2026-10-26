// The e2e tests' fixtures (docs/testing.md, End to end): a screen of its own per worker on Linux, one
// Kulisa per test file in a folder of its own, its core (core), its window's page (ui), Settings' (sui), the agent's MCP
// tools (call), a restart in the same folder, and what a failed test leaves to read: the window's picture, Playwright's
// trace, Kulisa's log. Kulisa's uncaught errors fail the test.
import { test as base, expect, chromium } from '@playwright/test';
import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import readline from 'readline';
import electronPath from 'electron';
import { removeTree } from '../../src/main/remove.ts';
import type { Kulisa } from './driver.ts';
import { data } from './data.ts';
import { BASE } from './helpers.ts';

// A function run in Kulisa's main process with its driver and one argument; only data crosses (Playwright serializes
// both ways), so it names what it needs by the argument, never by a closure.
type Core = <A, R>(fn: (k: Kulisa, arg: A) => R | Promise<R>, arg?: A) => Promise<R>;
// The agent's tools, as the agent of a task (its key; the window's task by default) in one of its terminals calls them.
type Where = { task?: string; terminal?: number };
type CallResult = { content: { type: string; text?: string; data?: string; mimeType?: string }[]; text: string; isError?: boolean; structuredContent?: unknown };
type Call = (name: string, args?: Record<string, unknown>, where?: Where) => Promise<CallResult>;
type Running = { file: string; automation: boolean; restarted?: boolean; child: ChildProcess; exited: Promise<void>; output: () => string; browser: Browser; context: BrowserContext; root: string; core: Core; ui: Page; errors: string[]; clients: Map<string, Client> };

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
// automation false: no debugging port and no Playwright in the pages (only core() and the agent's tools), for what an open
// port changes in them (navigator.webdriver: docs/profiles.md, What sites see).
async function launch(file: string, display: string | null, automation: boolean, restart?: string): Promise<Running> {
  const root = restart ?? path.join(BASE, `${path.basename(file, '.spec.ts')}-${process.pid}-${crypto.randomBytes(3).toString('hex')}`);
  fs.mkdirSync(root, { recursive: true });
  const env: Record<string, string> = { ...process.env as Record<string, string>, KULISA_TEST_ROOT: root, KULISA_SCREENSHOTS: path.join(root, 'screenshots') };
  if (restart) env.KULISA_RESTART = '1';
  // On Xvfb, X11's: Electron takes Wayland wherever WAYLAND_DISPLAY is set, and would open on the human's screen.
  if (display) { env.DISPLAY = display; delete env.WAYLAND_DISPLAY; env.XDG_SESSION_TYPE = 'x11'; }
  // Started as the human starts it, with a debugging port of its own (127.0.0.1, a free one) and core() over a local
  // socket (below), not by Playwright's _electron: that one makes every page it attaches to think it has the focus (which keeps
  // it visible, a minimized window's too: CLAUDE.md, Hard-won facts) and light, and has no way to leave them as they
  // are; connected over CDP with noDefaults, Playwright changes nothing in the pages. Linux: no setuid sandbox in
  // node_modules (CLAUDE.md, Commands). No GPU on Xvfb: WebGL on Chromium's software renderer, as the terminal uses it
  // on a real one.
  const args = [...(process.platform === 'linux' ? ['--no-sandbox'] : []), ...(automation ? ['--remote-debugging-port=0'] : []), ...(display ? ['--ignore-gpu-blocklist'] : []), path.join(import.meta.dirname, 'app.ts')];
  // core(): a line of JSON each way on a socket the test listens on and Kulisa connects to (app.ts), a named pipe on
  // Windows. Not its stdin, which Electron's main process does not read on Windows; not Node's IPC channel, whose
  // NODE_CHANNEL_FD Chromium's processes inherit, and DevTools' page crashes on it.
  const name = `kulisa-core-${crypto.randomBytes(6).toString('hex')}`;
  env.KULISA_CORE = process.platform === 'win32' ? `\\\\.\\pipe\\${name}` : path.join(os.tmpdir(), `${name}.sock`);
  const server = net.createServer();
  await new Promise<void>((r) => server.listen(env.KULISA_CORE, r));
  const socket = new Promise<net.Socket>((r) => server.once('connection', r));
  const child = spawn(electronPath as unknown as string, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
  // What Electron printed, the last of it, for a failed test (leave).
  let output = '';
  const keep = (d: Buffer) => { output = (output + d.toString()).slice(-200_000); };
  child.stdout.on('data', keep);
  child.stderr.on('data', keep);
  let seq = 0;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  void socket.then((s) => readline.createInterface({ input: s }).on('line', (l) => {
    const { id, value, error } = JSON.parse(l) as { id: number; value?: unknown; error?: string };
    const p = pending.get(id);
    pending.delete(id);
    if (error !== undefined) p?.reject(new Error(`in Kulisa's main process: ${error}`)); else p?.resolve(value);
  }));
  const exited = new Promise<void>((r) => child.once('exit', () => { server.close(); r(); }));
  const endpoint = !automation ? null : await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Electron gave no debugging port in 60 s:\n${output}`)); }, 60000);
    readline.createInterface({ input: child.stderr }).on('line', (l) => { const m = /DevTools listening on (ws:\/\/\S+)/.exec(l); if (m) { clearTimeout(timer); resolve(m[1]); } });
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Electron ended with ${code}:\n${output}`)); });
  });
  void exited.then(() => { for (const p of pending.values()) p.reject(new Error('Kulisa ended')); pending.clear(); });
  const core: Core = (fn, arg) => new Promise((resolve, reject) => {
    if (child.exitCode !== null) return reject(new Error('Kulisa ended'));
    const id = ++seq;
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    void socket.then((s) => s.write(`${JSON.stringify({ id, src: fn.toString(), arg })}\n`));
  });
  // A Kulisa that never gets ready is stopped, not left running, and says why: its log and what Electron printed (a
  // fixture's failure leaves no attachments).
  try {
    return await ready({ file, automation, child, exited, output: () => output, root, core }, endpoint);
  } catch (e) {
    child.kill();
    const log = path.join(root, 'data', 'logs', 'kulisa.log');
    throw new Error(`${(e as Error).message}\nKulisa's log:\n${fs.existsSync(log) ? fs.readFileSync(log, 'utf8').slice(-8000) : '(none)'}\nElectron's output:\n${output.slice(-8000)}`);
  }
}
async function ready(k: Pick<Running, 'file' | 'automation' | 'child' | 'exited' | 'output' | 'root' | 'core'>, endpoint: string | null): Promise<Running> {
  const { core } = k;
  await expect.poll(() => core((d) => !!d?.shell.task?.loaded && !!d.shell.pty), { timeout: 30000 }).toBe(true);
  await core((d) => d.watchPty(d.shell.pty));
  const errors: string[] = [];
  if (!endpoint) return { ...k, browser: null, context: null, ui: null, errors, clients: new Map() };
  const browser = await chromium.connectOverCDP(endpoint, { noDefaults: true });
  const context = browser.contexts()[0];
  // Kulisa's own pages' uncaught errors fail the test (a site's are the site's); a DOMException's stack is ''.
  const attach = (p: Page) => { if (own(p)) p.on('pageerror', (e) => errors.push(`${path.basename(new URL(p.url()).pathname)}: ${e.stack || `${e.name}: ${e.message}`}`)); };
  context.on('page', attach);
  context.pages().forEach(attach);
  // A page's dialog (alert, confirm, beforeunload) left to Kulisa, which shows it in its pane: Playwright dismisses one
  // nobody listens to.
  context.on('dialog', () => {});
  // The first window's page (a restart may bring several back), known by its target.
  const first = async (p: Page) => {
    if (!p.url().includes('/index.html')) return false;
    const { targetInfo } = await (await context.newCDPSession(p)).send('Target.getTargetInfo');
    return core((k, id) => k.electron.webContents.fromDevToolsTargetId(id) === k.shell.windows[0].win.webContents, targetInfo.targetId);
  };
  let ui: Page | undefined;
  await expect.poll(async () => { for (const p of context.pages()) if (await first(p).catch(() => false)) ui = p; return !!ui; }, { timeout: 30000 }).toBe(true);
  await context.tracing.start({ screenshots: true, snapshots: true });
  return { ...k, browser, context, ui, errors, clients: new Map() };
}

// What a failed test leaves, as its attachments (the HTML report, the CI's artifact): the window as the screen shows it,
// the trace of its steps in the window's page, Kulisa's log, what Electron printed.
async function leave(k: Running, info: TestInfo) {
  const png = info.outputPath('window.png');
  await k.core((d, f) => d.shot(f), png).then(() => info.attach('window', { path: png, contentType: 'image/png' }), () => {});
  const trace = info.outputPath('trace.zip');
  if (k.context) await k.context.tracing.stopChunk({ path: trace }).then(() => info.attach('trace', { path: trace, contentType: 'application/zip' }), () => {});
  const log = path.join(k.root, 'data', 'logs', 'kulisa.log');
  if (fs.existsSync(log)) await info.attach('kulisa.log', { path: log, contentType: 'text/plain' });
  await info.attach('electron output', { body: k.output(), contentType: 'text/plain' });
}

// Quit as the human does (app.quit: before-quit saves the session cookies). One that does not end in 30 s is killed and
// fails the run: a Kulisa left running after quitting is a bug (ROADMAP, Open issues). Playwright's connection goes
// with it (its own close waits on a browser it did not start).
async function quit(k: Running) {
  for (const c of k.clients.values()) await c.close().catch(() => {});
  await k.core((d) => { setImmediate(() => d.electron.app.quit()); }).catch(() => {});
  let hung = false;
  const timer = setTimeout(() => { hung = true; k.child.kill(); }, 30000);
  await k.exited;
  clearTimeout(timer);
  if (hung) throw new Error(`Kulisa did not end in 30 s after quitting; its output:\n${k.output().slice(-4000)}`);
}
async function close(k: Running) {
  await quit(k);
  try { removeTree(k.root); } catch {} // Windows: a file still held; the next run's folder is another
}

type Fixtures = {
  // Kulisa started without a debugging port (test.use({ automation: false })): ui, sui and the trace are not there.
  automation: boolean;
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
  automation: [true, { option: true }],
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
    try { fs.rmdirSync(BASE); } catch {} // empty once every file's folder is gone
  }, { scope: 'worker' }],
  kulisa: [async ({ display, running, automation }, use, info) => {
    if (running.current?.file !== info.file || running.current.automation !== automation) {
      if (running.current) await close(running.current);
      running.current = await launch(info.file, display, automation);
    }
    const k = running.current;
    await k.context?.tracing.startChunk({ title: info.title });
    k.errors.length = 0;
    await k.core((d) => d.reset());
    await use(k);
    const now = running.current; // the same, started again by restart()
    const errors = [...now.errors, ...await now.core((d) => d.errors).catch(() => [] as string[])];
    if (info.status !== info.expectedStatus || errors.length) await leave(now, info);
    else await now.context?.tracing.stopChunk().catch(() => {});
    // Started again (restart), it is not as a file's tests begin: the next test gets a new one.
    if (now.restarted) { await close(now); running.current = null; }
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
      const context = running.current.context, isSettings = (p: Page) => p.url().includes('settings.html') && !p.isClosed();
      const p = context.pages().find(isSettings) ?? await context.waitForEvent('page', isSettings);
      await p.waitForLoadState();
      return p;
    });
  },
  restart: async ({ kulisa, running, display }, use, info) => {
    void kulisa;
    await use(async () => {
      const old = running.current;
      await old.context?.tracing.stopChunk().catch(() => {});
      await quit(old);
      // The same object, so that the test's kulisa reaches the new one.
      Object.assign(old, await launch(old.file, display, old.automation, old.root), { restarted: true });
      await running.current.context?.tracing.startChunk({ title: `${info.title} (after the restart)` });
      await running.current.core((d) => d.reset());
      return running.current.ui;
    });
  },
  files: async ({ kulisa }, use) => { await use(data(kulisa.root)); },
});

export { expect };
export type { Core, Call, Where };
