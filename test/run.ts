// Kulisa tests: start the real app (Electron) against a local test site, drive it like the human (IPC, input
// events) and like the agent (MCP), and check the results. A group of files (start.ts) runs in one app, in order,
// later files building on earlier ones; then a second run after a restart, in the same temporary folder:
//   electron test/run.ts --files=agent,profiles             the tests in these files
//   electron test/run.ts --restart --files=restart-profiles  after a restart: what the group left is still there
// `npm test` runs every group, in parallel (start.ts). Shared helpers: helpers.ts.
import { app } from 'electron';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import path from 'path';
import fs from 'fs';
import { start } from '../src/main/app.ts';
import { claudeConversation } from '../src/main/transcripts.ts';
import { AGENTS } from '../src/main/agents.ts';
import { ensureSite } from './fixtures/site.ts';
import { root, userData, project, SITE, PORT, sleep, waitFor } from './helpers.ts';
import type { Shell } from '../src/main/shell.ts';
import type { AppWindow } from '../src/main/window.ts';
import type { Question } from '../src/renderer/types.ts';
import type { Task, TaskTerminal } from '../src/main/tasks.ts';
import type { Agent } from '../src/main/agents.ts';
import type { IPty } from 'node-pty';

// A site that is not local (local.ts) for the tests of real accounts' sign-ins kept in step (cookie-sync.ts): the test
// site under a name of its own.
app.commandLine.appendSwitch('host-resolver-rules', 'MAP shop.example 127.0.0.1');

const restart = process.argv.includes('--restart');
// direnv's list of allowed .envrc files (tasks copy and allow them): the test's own, not the user's.
process.env.XDG_DATA_HOME = path.join(root, 'xdg-data');
const FILES = (process.argv.find((a) => a.startsWith('--files=')) || '').slice(8).split(',').filter(Boolean);
if (!FILES.length) { console.error('which test files: --files=agent,profiles (npm test runs them all)'); process.exit(2); }
if (!restart) fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(project, { recursive: true });
// The agent: cat, typed into a bash started as a terminal would start the user's shell, in the project's folder;
// its startup file sets an environment of the project, as direnv's .envrc does, an agent's config folder too (a
// project's .envrc with CLAUDE_CONFIG_DIR), which the task's account overrides.
const bashrc = path.join(root, 'bashrc');
fs.writeFileSync(bashrc, `PS1='$ '\nexport FROM_RC="rc of $PWD"\nexport FAKE_CONFIG_DIR="the project's"\n`);
// Its dictation (agents.ts, voice): cat shows the key the microphone holds (repeated); its language kept here. Its
// transcripts read as Claude Code's (task_history): a test writes one in that format.
let dictation = 'en';
const agent = { command: 'bash', args: ['-c', 'echo "agent: $FROM_RC"; exec cat -v'], resume: (): string[] => [], shell: { command: 'bash', args: ['--rcfile', bashrc, '-i'] }, conversation: claudeConversation,
  voice: { key: '<v>', repeat: 50, note: 'it answers in it too', languages: ['en', 'ru', 'de'], language: () => dictation, setLanguage: (_saved: unknown, code: string) => { dictation = code; return { language: code }; } } };
// Agents to choose from for a task (agents.ts): one that is not installed until its installer runs, into a
// folder of the test.
function claudeLike() {
  const { resume, conversation, prompt, forget } = AGENTS.find((a) => a.id === 'claude')!;
  return { resume, conversation, prompt, forget };
}
const bin = path.join(root, 'bin');
process.env.FAKE_LOGOUTS = path.join(root, 'logouts'); // the accounts the fake agent signed out of
// Kulisa started from a folder direnv had loaded, as from a terminal in the repository: its state in the environment.
Object.assign(process.env, { DIRENV_DIR: `-${root}`, DIRENV_FILE: path.join(root, '.envrc'), DIRENV_DIFF: 'eJyrrgUAAXUA-Q', DIRENV_WATCHES: 'eJyLjgUAARUAuQ' });
process.env.FAKE_SIGNIN_PAGE = `${SITE}/app?signin`; // the page its sign-in opens (the test site)
// The user's browser, which an agent's own sign-in opens (tasks.md, Accounts): it notes the page, opens nothing.
Object.assign(process.env, { BROWSER: path.join(import.meta.dirname, 'fixtures', 'browser.sh'), FAKE_OPENED: path.join(root, 'opened') });
const agents: Agent[] = [
  // With accounts (accounts.ts) as Claude Code's, its folder in FAKE_CONFIG_DIR, which it prints; signed in, out and
  // asked who with its own commands (fixtures/fake-agent.sh). Its conversations as Claude Code's: resumed, read,
  // forgotten, a first message (the task handed to it; the arguments it ignores).
  { id: 'fake', name: 'Fake agent', maker: 'Kulisa tests', needs: 'Nothing', command: 'kulisa-fake-agent', installDirs: [bin],
    config: { env: 'FAKE_CONFIG_DIR', home: () => path.join(root, 'fake-config'), login: () => ['auth', 'login'],
      status: ['auth', 'status'], email: (out) => JSON.parse(out).email, logout: ['auth', 'logout'] },
    install: { posix: `echo "installing the fake agent"; mkdir -p '${bin}' && cp '${path.join(import.meta.dirname, 'fixtures', 'fake-agent.sh')}' '${bin}/kulisa-fake-agent' && chmod +x '${bin}/kulisa-fake-agent' && printf '\\033[32mdone\\033]8;;https://kulisa.app\\007\\033]8;;\\007\\033[0m\\n'` }, // colored, a link: as installers print
    args: () => [], shell: agent.shell, ...claudeLike() },
  { id: 'shell', name: 'Terminal only', maker: '', command: null, needs: 'No agent' },
];

// Each test gets the running app and the means to drive it (setup, below).
type Ctx = Awaited<ReturnType<typeof setup>>;
type Test = (name: string, fn: (ctx: Ctx) => Promise<void>) => void;
const tests: { name: string; fn: (ctx: Ctx) => Promise<void> }[] = [];
const test: Test = (name, fn) => { tests.push({ name, fn }); };
// A file that does not load (a syntax error) ends the run at once: Electron would wait, its app never ready.
try { for (const f of FILES) (await import(`./${f}.ts`)).default(test); } catch (e) { console.error(e); app.exit(2); }

// A run that hangs (a test past its timeout, quitting) ends anyway: nothing runs on unseen.
setTimeout(() => { console.error('the whole run took over 5 minutes: stopped'); app.exit(2); }, 5 * 60000).unref();

const sitePromise = ensureSite(Number(PORT));
// The restart phase runs as a packaged build would as to DevTools: Kulisa's own are off (appDevTools).
// After the restart no project is named: the one opened last opens.
start({ userData, project: restart ? undefined : project, projectsHome: path.join(root, 'Kulisa'), agent, agents, mcpPort: 0, signinHosts: ['localhost'], appDevTools: !restart })
  .then(async (shell) => {
    await sitePromise;
    const ctx = await setup(shell);
    let failed = 0;
    for (const t of tests) {
      const t0 = Date.now();
      try {
        await Promise.race([t.fn(ctx), sleep(30000).then(() => { throw new Error('timeout 30 s'); })]);
        console.log(`  ✓ ${t.name} (${Date.now() - t0} ms)`);
      } catch (e) {
        failed++;
        const err = e as Error & { code?: string };
        console.log(`  ✗ ${t.name}\n      ${(err.code === 'ERR_ASSERTION' ? err.message : String(err.stack || err).split('\n').slice(0, 4).join('\n')).replace(/\n/g, '\n      ')}`);
      }
    }
    console.log(failed ? `\n${failed} of ${tests.length} failed` : `\nall ${tests.length} passed`);
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
    return clients.get(url)!;
  };
  // terminal: as the agent in that terminal of the task, by its own URL (tasks.ts, env).
  const call = async (name: string, args: Record<string, unknown>, task: Task = shell.task!, terminal?: TaskTerminal) => {
    const mcp = await mcpOf(task.env(terminal).KULISA_MCP_URL);
    const r = await mcp.callTool({ name, arguments: args });
    const content = r.content as { type: string; text?: string; data?: string }[];
    const text = content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    if (r.isError) throw new Error(`${name}: ${text}`);
    return { ...r, content, text };
  };
  // A script that throws says which it was (Electron's error names none).
  const ui = (js: string) => shell.win!.webContents.executeJavaScript(js).catch((e: Error) => { throw new Error(`${e.message}: ${js.slice(0, 300)}`); });
  let pty = '';
  const watchPty = (p: IPty) => p.onData((d) => (pty += d)); // again for the agent of another project
  await waitFor(() => shell.pty, 10000); // the agent starts once the window has laid out its terminal
  watchPty(shell.pty!);
  // What the terminal in the window shows; lines wrapped at its width joined again.
  const termText = () => ui(`(() => { const b = window.__term.buffer.active;
    return Array.from({ length: b.length }, (_, i) => b.getLine(i)).map((l, i) => (i && !l.isWrapped ? '\\n' : '') + l.translateToString(true)).join(''); })()`);
  await waitFor(async () => (await termText()).includes('agent: rc of')); // the agent runs
  // Questions (deleting a profile, a task…) are answered in the window's dialog, as the human would: ctx.answer
  // true clicks the button that does it, false Cancel; null leaves the dialog to the test. ctx.asked: what was asked.
  const asked: Question[] = [];
  // What the MCP server tells the agent of task task at the start (its instructions).
  const instructions = async (task: Task = shell.task!) => (await mcpOf(task.env().KULISA_MCP_URL)).getInstructions();
  const ctx = { shell, call, instructions, ui, ptyOutput: () => pty, watchPty, termText, asked, answer: true as boolean | 'other' | null };
  const ask = shell.askWhich;
  // Asked in the window w (window.ts), the first one when none is named; shell.ask asks through it.
  shell.askWhich = (q: Question, w: AppWindow | null = shell.windows[0]) => {
    asked.push(q);
    const answer = ask(q, w), yes = ctx.answer, there = (js: string) => w!.win.webContents.executeJavaScript(js);
    if (yes !== null) waitFor(() => there(`(document.getElementById('ask')?.dataset.state === 'open') && document.querySelector('#ask h2').textContent === ${JSON.stringify(q.message)}`))
      .then(() => there(`document.querySelector('#ask ${yes === 'other' ? '.other' : yes ? '.ok' : '.cancel'}').click()`));
    return answer;
  };
  return ctx;
}

export type { Ctx, Test };
