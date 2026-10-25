// `npm test`: the unit tests (test/unit and the parts' own, plain Node, a second), knip (npm run knip: no file, export or dependency
// nothing uses; docs/testing.md, Dead code), ESLint (npm run lint; docs/testing.md, Lint), actionlint on the CI's workflows when installed, the window built (npm run build: its types checked,
// then Vite), then the groups of e2e files, in parallel where each has a screen of its own (below). Each group
// runs in an app of its own (run.ts), in its own folder, its files in order (later ones build on earlier ones), then
// again after a restart. On Linux, with Xvfb and openbox installed, each on a screen of its own: the tests' windows
// never take the human's focus or clipboard (`npm run test:visible`: on the human's screen, to watch them; one group
// after another, as they would fight for the focus there).
//   npm test -- tasks    one group only
import { spawn, spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import electron from 'electron';
import { ensureSite } from './fixtures/site.ts';
import type { AddressInfo } from 'net';
import type { ChildProcess } from 'child_process';

// A group starts from nothing, or from setup.ts (the profiles the first group makes on its way).
const GROUPS: Record<string, { files: string[]; restart: string[] }> = {
  profiles: { files: ['agent', 'profiles', 'discard', 'zoom-and-closing', 'github'], restart: ['restart-profiles'] },
  tasks: { files: ['setup', 'window', 'keys', 'grid', 'tasks'], restart: ['restart-tasks'] },
};

const visible = process.argv.includes('--visible');
const has = (cmd: string) => spawnSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' }).status === 0;
const hidden = process.platform === 'linux' && !visible && has('xvfb-run') && has('openbox');
if (process.platform === 'linux' && !hidden && !visible) {
  console.log('The tests run on your screen and take its focus; to run them on a screen of their own: sudo apt install xvfb openbox');
}
const run = path.join(import.meta.dirname, 'run.ts');
// The run's folder and test site are its checkout's own: runs from several worktrees at once (CLAUDE.md, Worktrees)
// removed each other's folders, and tested against another one's site on the shared port 4417. The folder is the same
// for every run of a checkout, so a failed run's, kept to look at, is replaced by the next run's. The temporary folder by
// its real name: Windows may give it by a short one (C:\Users\COSMOT~1), and git and Chromium answer with the long one.
const repo = path.join(import.meta.dirname, '..');
const base = path.join(fs.realpathSync.native(os.tmpdir()),`kulisa-test-${path.basename(repo)}-${crypto.createHash('sha1').update(repo).digest('hex').slice(0, 6)}`);
const folder = (group: string) => path.join(base, group);
const freePort = () => new Promise<number>((resolve) => {
  const s = net.createServer().listen(0, '127.0.0.1', () => { const { port } = s.address() as AddressInfo; s.close(() => resolve(port)); });
});
let site: { url: string; child?: ChildProcess };

// One run of the app (run.ts, or another script), its output kept until it ends (groups side by side would mix
// their lines).
function app(group: string, args: string[], script = run) {
  // The human's screenshots go into the group's folder, never the user's own (src/screenshots, KULISA_SCREENSHOTS).
  const env: NodeJS.ProcessEnv = { ...process.env, KULISA_TEST_ROOT: folder(group), KULISA_TEST_SITE: site.url, KULISA_SCREENSHOTS: path.join(folder(group), 'screenshots') };
  // In plain Node the electron package is the path of Electron's binary.
  // Linux only: chrome-sandbox in node_modules is not setuid there (README, Run).
  const sandbox = process.platform === 'linux' ? ['--no-sandbox'] : [];
  let cmd = electron as unknown as string, argv = [...sandbox, script, ...args];
  if (hidden) {
    // A screen as large as a monitor (tests open windows beside each other; -a: a free display), with a window
    // manager: without one, windows are not listed for capture (screenshots) and focus differs from a desktop.
    // No GPU there: WebGL on Chromium's software renderer, as the terminal uses it on a real one.
    const line = [cmd, ...sandbox, '--ignore-gpu-blocklist', script, ...args].map((a) => `'${a}'`).join(' ');
    cmd = 'xvfb-run'; argv = ['-a', '-s', '-screen 0 1920x1080x24', 'sh', '-c', `openbox >/dev/null 2>&1 & sleep 0.5; exec ${line}`];
    // Started from a Wayland desktop, Electron and GTK would open on it, the human's screen, not on Xvfb's X11.
    delete env.WAYLAND_DISPLAY;
    env.XDG_SESSION_TYPE = 'x11';
  }
  return new Promise<{ code: number; out: string }>((resolve) => {
    const child = spawn(cmd, argv, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    // How it ended, said when it failed: its tests may all have passed and the app not ended cleanly.
    child.on('close', (code, signal) => resolve({ code: code ?? 1, out: code === 0 ? out : `${out}\nthe app ended with ${code ?? signal}\n` }));
  });
}

async function group(name: string) {
  const { files, restart } = GROUPS[name], t0 = Date.now();
  let out = '', code = 0;
  for (const args of [[`--files=${files}`], ['--restart', `--files=${restart}`]]) {
    const r = await app(name, args);
    out += r.out; code = r.code;
    if (code !== 0) break;
  }
  // Its folder, once the app is gone (Electron writes into it as it exits); kept to look at when it failed.
  if (!code) fs.rmSync(folder(name), { recursive: true, force: true });
  console.log(`\n── ${name} (${files.join(', ')}; ${restart.join(', ')}): ${code ? 'FAILED' : 'passed'} in ${Math.round((Date.now() - t0) / 1000)} s\n${out}`);
  return code;
}

void (async () => {
  // The same as npm run test:unit: Kulisa packages' unit tests are in their folders (docs/packages.md).
  const unit = spawnSync(process.execPath, ['--test', 'test/unit/*.test.ts', 'src/*/*.test.ts'], { cwd: path.join(import.meta.dirname, '..'), stdio: 'inherit' });
  if (unit.status !== 0) process.exit(unit.status ?? 1);
  const knip = spawnSync('npm', ['run', 'knip'], { cwd: path.join(import.meta.dirname, '..'), stdio: 'inherit', shell: process.platform === 'win32' });
  if (knip.status !== 0) process.exit(knip.status ?? 1);
  const eslint = spawnSync('npm', ['run', 'lint'], { cwd: path.join(import.meta.dirname, '..'), stdio: 'inherit', shell: process.platform === 'win32' });
  if (eslint.status !== 0) process.exit(eslint.status ?? 1);
  // The CI's workflows: GitHub refuses a whole file for one wrong line, and says so only once it is pushed (run
  // 38277005183). actionlint is a Go program with no maintained npm package: checked when installed, else said.
  if (has('actionlint')) {
    const lint = spawnSync('actionlint', [], { cwd: path.join(import.meta.dirname, '..'), stdio: 'inherit' });
    if (lint.status !== 0) process.exit(lint.status ?? 1);
  } else console.log('The CI\'s workflows are not checked: install actionlint (docs/testing.md, Workflows)');
  const build = spawnSync('npm', ['run', 'build'], { cwd: path.join(import.meta.dirname, '..'), stdio: 'inherit', shell: process.platform === 'win32' });
  if (build.status !== 0) process.exit(build.status ?? 1);
  const names = process.argv.slice(2).filter((a) => GROUPS[a]);
  const chosen = names.length ? names : Object.keys(GROUPS);
  site = await ensureSite(await freePort()); // one for every group: a group's own would go with it while others still use it
  const codes = [];
  // In parallel only on screens of their own: on one screen (macOS, Windows, --visible) the groups' windows would take each
  // other's focus, and tests waiting for it fail.
  if (!hidden) for (const n of chosen) codes.push(await group(n));
  else {
    // The keyring's key first, by one Electron alone (keyring.ts): the groups' two would make it at once on a fresh
    // keyring, and the one whose key the keyring does not keep lose its session cookies at its restart.
    await app('keyring', [], path.join(import.meta.dirname, 'keyring.ts'));
    codes.push(...await Promise.all(chosen.map(group)));
  }
  site.child?.kill();
  try { fs.rmdirSync(base); } catch {} // empty once every group passed
  process.exit(codes.some(Boolean) ? 1 : 0);
})();
