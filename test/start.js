// `npm test`: the unit tests (test/unit, plain Node, a second), then the groups of e2e files, in parallel. Each group
// runs in an app of its own (run.js), in its own folder, its files in order (later ones build on earlier ones), then
// again after a restart. On Linux, with Xvfb and openbox installed, each on a screen of its own: the tests' windows
// never take the human's focus or clipboard (`npm run test:visible`: on the human's screen, to watch them; one group
// after another, as they would fight for the focus there).
//   npm test -- tasks    one group only
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const electron = require('electron');
const { ensureSite } = require('./fixtures/site');

// A group starts from nothing, or from setup.js (the profiles the first group makes on its way).
const GROUPS = {
  profiles: { files: ['agent', 'profiles', 'zoom-and-closing'], restart: ['restart-profiles'] },
  tasks: { files: ['setup', 'window', 'keys', 'grid', 'tasks'], restart: ['restart-tasks'] },
};

const visible = process.argv.includes('--visible');
const has = (cmd) => spawnSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' }).status === 0;
const hidden = process.platform === 'linux' && !visible && has('xvfb-run') && has('openbox');
if (process.platform === 'linux' && !hidden && !visible) {
  console.log('The tests run on your screen and take its focus; to run them on a screen of their own: sudo apt install xvfb openbox');
}
const run = path.join(__dirname, 'run.js');
const folder = (group) => path.join(os.tmpdir(), 'kulisa-test', group);

// One run of the app, its output kept until it ends (groups side by side would mix their lines).
function app(group, args) {
  const env = { ...process.env, KULISA_TEST_ROOT: folder(group) };
  let cmd = electron, argv = ['--no-sandbox', run, ...args];
  if (hidden) {
    // A screen as large as a monitor (tests open windows beside each other; -a: a free display), with a window
    // manager: without one, windows are not listed for capture (screenshots) and focus differs from a desktop.
    // No GPU there: WebGL on Chromium's software renderer, as the terminal uses it on a real one.
    const line = [electron, '--no-sandbox', '--ignore-gpu-blocklist', run, ...args].map((a) => `'${a}'`).join(' ');
    cmd = 'xvfb-run'; argv = ['-a', '-s', '-screen 0 1920x1080x24', 'sh', '-c', `openbox >/dev/null 2>&1 & sleep 0.5; exec ${line}`];
  }
  return new Promise((resolve) => {
    const child = spawn(cmd, argv, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => resolve({ code, out }));
  });
}

async function group(name) {
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

(async () => {
  const unit = spawnSync(process.execPath, ['--test', 'test/unit/*.test.js'], { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
  if (unit.status !== 0) process.exit(unit.status ?? 1);
  const names = process.argv.slice(2).filter((a) => GROUPS[a]);
  const chosen = names.length ? names : Object.keys(GROUPS);
  const site = await ensureSite(); // one for every group: a group's own would go with it while others still use it
  const codes = [];
  if (visible) for (const n of chosen) codes.push(await group(n));
  else codes.push(...await Promise.all(chosen.map(group)));
  site.child?.kill();
  try { fs.rmdirSync(path.join(os.tmpdir(), 'kulisa-test')); } catch {} // empty once every group passed
  process.exit(codes.some(Boolean) ? 1 : 0);
})();
