// Kulisa tests: start the real app (Electron) against a local test site, drive it like the human (IPC, input
// events) and like the agent (MCP), and check the results. A group of files (start.ts) runs in one app, in order,
// later files building on earlier ones; then a second run after a restart, in the same temporary folder:
//   electron test/run.ts --files=agent,profiles             the tests in these files
//   electron test/run.ts --restart --files=restart-profiles  after a restart: what the group left is still there
// `npm test` runs every group, in parallel (start.ts). Shared helpers: helpers.ts.
import electron, { app } from 'electron';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import path from 'path';
import fs from 'fs';
import { start } from '../src/main/app.ts';
import { removeTree } from '../src/main/remove.ts';
import { claudeConversation } from '../src/main/agents/claude.ts';
import { AGENTS } from '../src/main/agents/index.ts';
import { ensureSite } from './fixtures/site.ts';
import { root, userData, project, SITE, PORT, sleep, waitFor } from './helpers.ts';
import type { Shell } from '../src/main/shell.ts';
import type { AppWindow } from '../src/main/window.ts';
import type { SettingsWindow } from '../src/main/settings-window.ts';
import type { Question } from '../src/shared/types.ts';
import type { Task, TaskTerminal } from '../src/main/tasks.ts';
import type { Agent } from '../src/main/agents/index.ts';
import type { IPty } from 'node-pty';

// A site that is not local (local.ts) for the tests of real accounts' sign-ins kept in step (cookie-sync.ts): the test
// site under a name of its own.
app.commandLine.appendSwitch('host-resolver-rules', 'MAP shop.example 127.0.0.1');
// The motion the tests check (a tab growing in, the grid's slide) whatever the OS's setting: a CI machine may
// reduce motion, and nothing moves then. Reduced motion is checked where it matters, emulated.
app.commandLine.appendSwitch('force-prefers-no-reduced-motion');

const restart = process.argv.includes('--restart');
// direnv's list of allowed .envrc files (tasks copy and allow them): the test's own, not the user's.
process.env.XDG_DATA_HOME = path.join(root, 'xdg-data');
const FILES = (process.argv.find((a) => a.startsWith('--files=')) || '').slice(8).split(',').filter(Boolean);
if (!FILES.length) { console.error('which test files: --files=agent,profiles (npm test runs them all)'); process.exit(2); }
// Refused (on Windows a file a process of an earlier run still holds), the run ends saying why: an error at load
// leaves Electron's dialog waiting for a click.
try {
  if (!restart) removeTree(root);
} catch (e) { console.error(`the test folder cannot be emptied (a process of an earlier run still in it?): ${(e as Error).message}`); process.exit(2); }
fs.mkdirSync(project, { recursive: true });
// The agent: cat, typed into a bash started as a terminal would start the user's shell, in the project's folder;
// its startup file sets an environment of the project, as direnv's .envrc does, an agent's config folder too (a
// project's .envrc with CLAUDE_CONFIG_DIR), which the task's account overrides.
const bashrc = path.join(root, 'bashrc');
// On Windows the folder as Windows writes it, as the tests do (Git's bash says /c/…).
const pwd = process.platform === 'win32' ? '$(cygpath -w "$PWD")' : '$PWD';
fs.writeFileSync(bashrc, `PS1='$ '\nexport FROM_RC="rc of ${pwd}"\nexport FAKE_CONFIG_DIR="the project's"\n`);
// Its dictation (agents/, voice): cat shows the key the microphone holds (repeated). Its transcripts read as Claude
// Code's (task_history): a test writes one in that format.
const agent = { command: 'bash', args: ['-c', 'echo "agent: $FROM_RC"; exec cat -v'], resume: (): string[] => [], shell: { command: 'bash', args: ['--rcfile', bashrc, '-i'] }, conversation: claudeConversation,
  voice: { key: '<v>', repeat: 50 } };
// Agents to choose from for a task (agents/): one that is not installed until its installer runs, into a
// folder of the test.
function claudeLike() {
  const { resume, conversation, prompt, forget, trust, localFiles, skills, language } = AGENTS.find((a) => a.id === 'claude');
  return { resume, conversation, prompt, forget, trust, localFiles, skills, language };
}
const bin = path.join(root, 'bin'), fakeAgent = path.join(import.meta.dirname, 'fixtures', 'fake-agent.sh');
process.env.FAKE_LOGOUTS = path.join(root, 'logouts'); // the accounts the fake agent signed out of
process.env.FAKE_RECOGNIZER = path.join(import.meta.dirname, 'fixtures', 'fake-recognizer.mjs');
// Kulisa started from a folder direnv had loaded, as from a terminal in the repository: its state in the environment.
Object.assign(process.env, { DIRENV_DIR: `-${root}`, DIRENV_FILE: path.join(root, '.envrc'), DIRENV_DIFF: 'eJyrrgUAAXUA-Q', DIRENV_WATCHES: 'eJyLjgUAARUAuQ' });
process.env.FAKE_SIGNIN_PAGE = `${SITE}/app?signin`; // the page its sign-in opens (the test site)
// GitHub: the test site's fake one (src/github), never the real one; the pages Kulisa opens in the user's browser
// (GitHub's device page) noted, not opened.
process.env.KULISA_GITHUB = `${SITE}/github`;
const openedExternally: string[] = [];
electron.shell.openExternal = async (url: string) => { openedExternally.push(url); };
// The user's browser, which an agent's own sign-in opens (tasks.md, Accounts): it notes the page, opens nothing.
Object.assign(process.env, { BROWSER: path.join(import.meta.dirname, 'fixtures', 'browser.sh'), FAKE_OPENED: path.join(root, 'opened') });
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

// Each test gets the running app and the means to drive it (setup, below).
type Ctx = Awaited<ReturnType<typeof setup>>;
type Run = (name: string, fn: (ctx: Ctx) => Promise<void>) => void;
type Test = Run & { skip: Run }; // test.skip: held, not run (counted apart), for a test waiting on work not done yet
const tests: { name: string; fn: (ctx: Ctx) => Promise<void>; skip?: boolean }[] = [];
const test = ((name, fn) => { tests.push({ name, fn }); }) as Test;
test.skip = (name, fn) => { tests.push({ name, fn, skip: true }); };
// A file that does not load (a syntax error) ends the run at once: Electron would wait, its app never ready.
try { for (const f of FILES) (await import(`./${f}.ts`)).default(test); } catch (e) { console.error(e); app.exit(2); }

// A run that hangs (a test past its timeout, quitting) ends anyway: nothing runs on unseen.
setTimeout(() => { console.error('the whole run took over 5 minutes: stopped'); app.exit(2); }, 5 * 60000).unref();

const sitePromise = ensureSite(Number(PORT));
// The restart phase runs as a packaged build would as to DevTools: Kulisa's own are off (appDevTools).
// After the restart no project is named: the one opened last opens.
// The folder of the app archive the window tests replace as apt does (installed): watched from the start, as a packaged
// Kulisa's own is.
fs.mkdirSync(path.join(root, 'installed'), { recursive: true });
start({ userData, project: restart ? undefined : project, projectsHome: path.join(root, 'KulisaProjects'), agent, agents, mcpPort: 0, signinHosts: ['localhost'], appDevTools: !restart, installed: path.join(root, 'installed', 'app.asar') })
  .then(async (shell) => {
    await sitePromise;
    // macOS gives the keyboard only to the active app's windows, and the run starts from another (a terminal): the
    // tests' focus would be the human's last click's. It takes the screen's focus, as docs/testing.md says.
    if (process.platform === 'darwin') app.focus({ steal: true });
    const ctx = await setup(shell);
    let failed = 0, held = 0;
    for (const t of tests) {
      if (t.skip) { held++; console.log(`  ↓ ${t.name} (held)`); continue; }
      const t0 = Date.now();
      try {
        await Promise.race([t.fn(ctx), sleep(30000).then(() => { throw new Error(`timeout 30 s, in ${ctx.step}`); })]);
        console.log(`  ✓ ${t.name} (${Date.now() - t0} ms)`);
      } catch (e) {
        failed++;
        const err = e as Error & { code?: string };
        // Its message whole (a wait's condition over several lines, then what was shown instead), then where it was.
        const where = err.code === 'ERR_ASSERTION' || !err.stack ? [] : err.stack.slice(String(err).length).split('\n').filter(Boolean).slice(0, 3);
        console.log(`  ✗ ${t.name}\n      ${[err.code === 'ERR_ASSERTION' ? err.message : String(err), ...where].join('\n').replace(/\n/g, '\n      ')}`);
      }
    }
    console.log(`${failed ? `\n${failed} of ${tests.length} failed` : `\nall ${tests.length - held} passed`}${held ? ` (${held} held)` : ''}`);
    // Quit the way a user closes the window (before-quit saves session cookies, kills the pty), then set the code.
    app.on('will-quit', (e) => {
      e.preventDefault();
      app.exit(failed ? 1 : 0);
    });
    app.quit();
  })
  .catch((e) => { console.error(e); app.exit(1); });

async function setup(shell: Shell) {
  // The agent of the task on screen (each has its own MCP URL), or of task task.
  const clients = new Map<string, Client>();
  const mcpOf = async (url: string) => {
    if (!clients.has(url)) {
      const c = new Client({ name: 'kulisa-test', version: '0' });
      await c.connect(new StreamableHTTPClientTransport(new URL(url)));
      clients.set(url, c);
    }
    return clients.get(url);
  };
  // terminal: as the agent in that terminal of the task, by its own URL (tasks.ts, env).
  // The last call or script a test began, named when the test's 30 s are up (a hang has no stack to read).
  let step = '';
  const call = async (name: string, args: Record<string, unknown>, task: Task = shell.task, terminal?: TaskTerminal) => {
    step = `call ${name} ${JSON.stringify(args).slice(0, 120)}`;
    const mcp = await mcpOf(task.env(terminal).KULISA_MCP_URL);
    const r = await mcp.callTool({ name, arguments: args });
    const content = r.content as { type: string; text?: string; data?: string }[];
    const text = content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    if (r.isError) throw new Error(`${name}: ${text}`);
    return { ...r, content, text };
  };
  // A script that throws says which it was (Electron's error names none).
  const ui = (js: string) => { step = `ui ${js.slice(0, 120)}`; return shell.win.webContents.executeJavaScript(js).catch((e: Error) => { throw new Error(`${e.message}: ${js.slice(0, 300)}`); }); };
  // The same in Settings' window (settings-window.ts), once it is open and its page loaded.
  const sui = async (js: string) => {
    step = `sui ${js.slice(0, 120)}`;
    await waitFor(() => { const w = shell.settings?.win; return w && !w.isDestroyed() && w.webContents.getURL().includes('settings.html') && !w.webContents.isLoading(); });
    return shell.settings.win.webContents.executeJavaScript(js).catch((e: Error) => { throw new Error(`${e.message}: ${js.slice(0, 300)}`); });
  };
  let pty = '';
  const watchPty = (p: IPty) => p.onData((d) => (pty += d)); // again for the agent of another project
  await waitFor(() => shell.pty, 10000); // the agent starts once the window has laid out its terminal
  watchPty(shell.pty);
  // What the terminal in the window shows ('' while none is shown yet), as the screen reads: lines wrapped at its
  // width joined again, and each line's trailing spaces dropped. ConPTY repaints a line padded with spaces to the
  // width when the terminal is resized (written cells, which xterm keeps: it trims only cells never written), and a
  // test looking for a line's end would miss it.
  const termText = () => ui(`(() => { const b = window.__term?.buffer.active; if (!b) return '';
    return Array.from({ length: b.length }, (_, i) => b.getLine(i)).map((l, i) => (i && !l.isWrapped ? '\\n' : '') + l.translateToString(true)).join('')
      .split('\\n').map((l) => l.replace(/ +$/, '')).join('\\n'); })()`);
  // The terminal in the window showing text; when it does not, its xterm as it is: its size, where its cursor is,
  // and its lines up to the cursor and every one with text, each with its number and a ~ when it continues the one
  // before (wrapped).
  const termDump = () => ui(`(() => { const t = window.__term, b = t?.buffer.active; if (!b) return 'no terminal shown';
    const lines = Array.from({ length: b.length }, (_, i) => b.getLine(i)).map((l, i) => i + (l.isWrapped ? '~' : ' ') + '|' + l.translateToString(true));
    return { cols: t.cols, rows: t.rows, length: b.length, cursor: [b.cursorX, b.cursorY], baseY: b.baseY,
      lines: lines.filter((l, i) => i <= b.baseY + b.cursorY + 2 || l.length > 4).slice(0, 40) }; })()`);
  const termShows = (text: string) => waitFor(async () => (await termText()).includes(text), 5000, async () => ({ expected: text, ...await termDump() }));
  await termShows('agent: rc of'); // the agent runs
  // Questions (deleting a profile, a task…) are answered in the window's dialog, as the human would: ctx.answer
  // true clicks the button that does it, false Cancel; null leaves the dialog to the test. ctx.asked: what was asked.
  const asked: Question[] = [];
  // What the MCP server tells the agent of task task at the start (its instructions).
  const instructions = async (task: Task = shell.task) => (await mcpOf(task.env().KULISA_MCP_URL)).getInstructions();
  // The tools the MCP server lists to the agent of task task, as its client gets them.
  const tools = async (task: Task = shell.task) => (await (await mcpOf(task.env().KULISA_MCP_URL)).listTools()).tools;
  const ctx = { shell, call, instructions, tools, ui, sui, ptyOutput: () => pty, watchPty, termText, termDump, termShows, asked, openedExternally, answer: true as boolean | 'other' | null, get step() { return step; } };
  const ask = shell.askWhich;
  // Asked where w is (a tasks' window, Settings': app.ts, askWhich), the first window when none is named; shell.ask
  // asks through it.
  shell.askWhich = (q: Question, w: AppWindow | SettingsWindow | null = shell.windows[0]) => {
    asked.push(q);
    const answer = ask(q, w), yes = ctx.answer, page = w.win.webContents, there = (js: string) => page.executeJavaScript(js);
    if (yes !== null) void waitFor(() => there(`(document.getElementById('ask')?.dataset.state === 'open') && document.querySelector('#ask h2').textContent === ${JSON.stringify(q.message)}`))
      .then(() => there(`document.querySelector('#ask ${yes === 'other' ? '.other' : yes ? '.ok' : '.cancel'}').click()`));
    return answer;
  };
  return ctx;
}

export type { Ctx, Test };
