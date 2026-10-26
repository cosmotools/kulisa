// Kulisa as the e2e tests start it (fixtures.ts, Playwright's _electron): in the test's folder, against the test site,
// with fake agents, its core on globalThis for the tests' core() (driver.ts). KULISA_RESTART: started again in the same
// folder, as a packaged build would as to DevTools.
import electron, { app } from 'electron';
import fs from 'fs';
import net from 'net';
import path from 'path';
import readline from 'readline';
import { start } from '../../src/main/app.ts';
import { claudeConversation } from '../../src/main/agents/claude.ts';
import { AGENTS } from '../../src/main/agents/index.ts';
import type { Agent } from '../../src/main/agents/index.ts';
import { driver } from './driver.ts';
import type { Kulisa } from './driver.ts';

declare global { var __kulisa: Kulisa | undefined }

// A site that is not local (local.ts) for the tests of real accounts' sign-ins kept in step (cookie-sync.ts): the test
// site under a name of its own.
app.commandLine.appendSwitch('host-resolver-rules', 'MAP shop.example 127.0.0.1');
// The motion the tests check (a tab growing in, the grid's slide) whatever the OS's setting: a CI machine may reduce
// motion, and nothing moves then. Reduced motion is checked where it matters, emulated.
app.commandLine.appendSwitch('force-prefers-no-reduced-motion');

const root = process.env.KULISA_TEST_ROOT, site = process.env.KULISA_TEST_SITE;
const restart = !!process.env.KULISA_RESTART;
const userData = path.join(root, 'data'), project = path.join(root, 'project');
fs.mkdirSync(project, { recursive: true });
// direnv's list of allowed .envrc files (tasks copy and allow them): the test's own, not the user's.
process.env.XDG_DATA_HOME = path.join(root, 'xdg-data');
// The agent: cat, typed into a bash started as a terminal would start the user's shell, in the project's folder; its
// startup file sets an environment of the project, as direnv's .envrc does, an agent's config folder too (a project's
// .envrc with CLAUDE_CONFIG_DIR), which the task's account overrides. On Windows the folder as Windows writes it (Git's
// bash says /c/…).
const bashrc = path.join(root, 'bashrc');
const pwd = process.platform === 'win32' ? '$(cygpath -w "$PWD")' : '$PWD';
fs.writeFileSync(bashrc, `PS1='$ '\nexport FROM_RC="rc of ${pwd}"\nexport FAKE_CONFIG_DIR="the project's"\n`);
// Its dictation (agents/, voice): cat shows the key the microphone holds (repeated). Its transcripts read as Claude
// Code's (task_history): a test writes one in that format.
const agent = { command: 'bash', args: ['-c', 'echo "agent: $FROM_RC"; exec cat -v'], resume: (): string[] => [], shell: { command: 'bash', args: ['--rcfile', bashrc, '-i'] }, conversation: claudeConversation,
  voice: { key: '<v>', repeat: 50 } };
function claudeLike() {
  const { resume, conversation, prompt, forget, trust, localFiles, skills, language } = AGENTS.find((a) => a.id === 'claude');
  return { resume, conversation, prompt, forget, trust, localFiles, skills, language };
}
const fixtures = path.join(import.meta.dirname, '..', 'fixtures');
const bin = path.join(root, 'bin'), fakeAgent = path.join(fixtures, 'fake-agent.sh');
process.env.FAKE_LOGOUTS = path.join(root, 'logouts'); // the accounts the fake agent signed out of
process.env.FAKE_RECOGNIZER = path.join(fixtures, 'fake-recognizer.mjs');
// Kulisa started from a folder direnv had loaded, as from a terminal in the repository: its state in the environment.
Object.assign(process.env, { DIRENV_DIR: `-${root}`, DIRENV_FILE: path.join(root, '.envrc'), DIRENV_DIFF: 'eJyrrgUAAXUA-Q', DIRENV_WATCHES: 'eJyLjgUAARUAuQ' });
process.env.FAKE_SIGNIN_PAGE = `${site}/app?signin`; // the page its sign-in opens (the test site)
// GitHub: the test site's fake one (src/github), never the real one.
process.env.KULISA_GITHUB = `${site}/github`;
// The user's browser, which an agent's own sign-in opens (tasks.md, Accounts): it notes the page, opens nothing.
Object.assign(process.env, { BROWSER: path.join(fixtures, 'browser.sh'), FAKE_OPENED: path.join(root, 'opened') });
const agents: Agent[] = [
  // With accounts (accounts.ts) as Claude Code's, its folder in FAKE_CONFIG_DIR, which it prints; signed in, out and
  // asked who with its own commands (fixtures/fake-agent.sh). Its conversations as Claude Code's: resumed, read,
  // forgotten, a first message (the task handed to it; the arguments it ignores), its trust of a folder, its local
  // settings a task's copy gets, Kulisa's skill in its account, its language setting.
  { id: 'fake', name: 'Fake agent', maker: 'Kulisa tests', needs: 'Nothing', command: 'kulisa-fake-agent', installDirs: [bin],
    config: { env: 'FAKE_CONFIG_DIR', home: () => path.join(root, 'fake-config'), login: () => ['auth', 'login'],
      status: ['auth', 'status'], email: (out) => JSON.parse(out).email, logout: ['auth', 'logout'] },
    install: { posix: `echo "installing the fake agent"; mkdir -p '${bin}' && cp '${fakeAgent}' '${bin}/kulisa-fake-agent' && chmod +x '${bin}/kulisa-fake-agent' && printf '\\033[32mdone\\033]8;;https://kulisa.app\\007\\033]8;;\\007\\033[0m\\n'`, // colored, a link: as installers print
      // Windows: the script and a .cmd running it with bash, as npm puts a package's program there; the tar it would
      // unpack with, as Codex's installer does.
      win32: `echo 'installing the fake agent'; echo "tar: $((Get-Command tar).Source)"; New-Item -ItemType Directory -Force '${bin}' > $null; Copy-Item '${fakeAgent}' '${bin}\\kulisa-fake-agent'; Set-Content -Encoding ascii '${bin}\\kulisa-fake-agent.cmd' '@bash "%~dp0kulisa-fake-agent" %*'; $e = [char]27; $b = [char]7; echo "$e[32mdone$e]8;;https://kulisa.app$b$e]8;;$b$e[0m"` },
    args: () => [], shell: agent.shell, ...claudeLike(),
    // Recognizing for an agent without dictation of its own (src/dictation's hidden session) when signed in, as
    // Claude Code's dictation does: fixtures/fake-recognizer.mjs.
    recognizer: { available: (dir) => fs.existsSync(path.join(dir, 'account')), args: () => ['--recognize'], env: (env) => ({ ...env }),
      key: ' ', repeat: 30, clear: '\x15', submit: '\r' } },
  { id: 'shell', name: 'Terminal only', maker: '', command: null, needs: 'No agent' },
];
// The pages Kulisa opens in the user's browser (GitHub's device page): noted, not opened.
const openedExternally: string[] = [];
electron.shell.openExternal = async (url: string) => { openedExternally.push(url); };

// fixtures.ts' core(): a function's source run with the driver, read as a line of JSON on the test's socket (why a
// socket: fixtures.ts); its result or its error written back as a line.
const core = net.connect(process.env.KULISA_CORE);
core.on('error', () => {}); // the test gone first: nothing to answer
readline.createInterface({ input: core }).on('line', async (line) => {
  const { id, src, arg } = JSON.parse(line) as { id: number; src: string; arg: unknown };
  const reply = (m: object) => {
    let text: string;
    try { text = JSON.stringify({ id, ...m }); } catch (e) { text = JSON.stringify({ id, error: `its result cannot be sent back: ${(e as Error).message}` }); }
    core.write(`${text}\n`);
  };
  try { reply({ value: await (0, eval)(`(${src})`)(globalThis.__kulisa, arg) }); } catch (e) { reply({ error: (e as Error)?.stack ?? String(e) }); }
});

// Uncaught in the main process: app.ts logs it and goes on (an error dialog would block everything); the test it came
// in fails (fixtures.ts).
const uncaught = (e: unknown) => globalThis.__kulisa?.errors.push(`main: ${(e as Error)?.stack ?? String(e)}`);
process.on('uncaughtException', uncaught);
process.on('unhandledRejection', uncaught);

// The folder of the app archive the window tests replace as apt does (installed): watched from the start, as a packaged
// Kulisa's own is.
fs.mkdirSync(path.join(root, 'installed'), { recursive: true });
// Not awaited at the top: Electron finishes loading an ES module main before it gets ready, and start waits for ready.
// Started again, no project is named: the one opened last opens.
void start({ userData, project: restart ? undefined : project, projectsHome: path.join(root, 'KulisaProjects'), agent, agents, mcpPort: 0,
  signinHosts: ['localhost'], appDevTools: !restart, installed: path.join(root, 'installed', 'app.asar') }).then((shell) => {
  globalThis.__kulisa = driver(shell, openedExternally);
  // macOS gives the keyboard only to the active app's windows, and the run starts from another (a terminal).
  if (process.platform === 'darwin') app.focus({ steal: true });
});
