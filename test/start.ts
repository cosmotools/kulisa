// `npm test`: the unit tests (test/unit and the parts' own, plain Node, a second), knip (npm run knip: no file, export or dependency
// nothing uses; docs/testing.md, Dead code), ESLint (npm run lint; docs/testing.md, Lint), actionlint on the CI's workflows when installed, the window built (npm run build: its types checked,
// then Vite), then the e2e tests on Playwright Test (test/e2e, playwright.config.ts; docs/testing.md, End to end). On
// Linux, with Xvfb and openbox installed, each Kulisa on a screen of its own: the tests' windows never take the human's
// focus or clipboard (`npm run test:visible`: on the human's screen, to watch them).
//   npm test -- e2e               the e2e tests only
//   npm test -- e2e keys grid     some of their files (any of Playwright Test's arguments after e2e)
import { spawnSync } from 'child_process';
import path from 'path';

const root = path.join(import.meta.dirname, '..');
const visible = process.argv.includes('--visible');
const has = (cmd: string) => spawnSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' }).status === 0;
const step = (cmd: string, args: string[], env = process.env) => {
  const r = spawnSync(cmd, args, { cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

const at = process.argv.indexOf('e2e'), only = at >= 0;
if (!only) {
  // The same as npm run test:unit: Kulisa packages' unit tests are in their folders (docs/packages.md).
  step(process.execPath, ['--test', 'test/unit/*.test.ts', 'src/*/*.test.ts']);
  step('npm', ['run', 'knip']);
  step('npm', ['run', 'lint']);
  // The CI's workflows: GitHub refuses a whole file for one wrong line, and says so only once it is pushed (run
  // 38277005183). actionlint is a Go program with no maintained npm package: checked when installed, else said.
  if (has('actionlint')) step('actionlint', []);
  else console.log('The CI\'s workflows are not checked: install actionlint (docs/testing.md, Workflows)');
}
step('npm', ['run', 'build']);
const screen = process.platform === 'linux' && !visible && !(has('Xvfb') && has('openbox'));
if (screen) console.log('The tests run on your screen and take its focus; to run them on a screen of their own: sudo apt install xvfb openbox');
const args = only ? process.argv.slice(at + 1).filter((a) => a !== '--visible') : [];
step('npx', ['playwright', 'test', ...args], { ...process.env, ...(visible || screen ? { KULISA_VISIBLE: '1' } : {}) });
