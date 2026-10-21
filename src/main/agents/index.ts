// The agents to choose from (agent.ts: what Kulisa knows of each), and what is done with any of them: finding,
// installing, its version, its accounts' sign-in and sign-out, carrying a folder's trust to a task's copy.
import { execFile, spawn } from 'child_process';
import { stripVTControlCharacters } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { claude } from './claude.ts';
import { codex } from './codex.ts';
import type { Agent, Found, Where } from './agent.ts';

const AGENTS: Agent[] = [
  claude,
  codex,
  { id: 'shell', name: 'Terminal only', maker: '', command: null, needs: "No agent: your shell in the task's folder" },
];

// A task's copy is the project's own code: the trust the human gave the project's folder, or another task's copy of it
// (sources), holds for it too, so the agent asks once a project, whichever agent it is. Codex and Claude Code, asked in
// a worktree, keep the answer for the repository's root themselves; this holds the
// rule for an agent or a version that keeps it per folder. Only a yes is carried; a folder the human trusted nowhere
// stays as it is, and the agent asks.
function extendTrust(agent: Agent, where: Where, folder: string, sources: string[]) {
  if (!agent.trust || agent.trust.has(where, folder) || !sources.some((f) => agent.trust!.has(where, f))) return false;
  return agent.trust.set(where, folder);
}

const run = (cmd: string, args: string[], opts: { cwd?: string }) => new Promise<string | null>((resolve) =>
  execFile(cmd, args, { timeout: 8000, windowsHide: true, ...opts }, (e, out) => resolve(e ? null : String(out))));

// Where the agent's program is: { path, onPath }, or null when it is not installed. Looked up as the user's shell
// would (a login shell: Kulisa started from a menu may have a shorter PATH), then where its installer puts it, for a
// shell that has not picked up the installer's PATH change yet.
async function findAgent(agent: Agent, cwd: string): Promise<Found | null> {
  if (!agent.command) return { path: null, onPath: true };
  if (agent.custom) return { path: agent.command, onPath: true };
  const win = process.platform === 'win32';
  const found = win ? await run('where.exe', [agent.command], { cwd })
    : await run(process.env.SHELL || os.userInfo().shell || '/bin/sh', ['-ilc', `command -v ${agent.command}`], { cwd });
  const line = found?.split(/\r?\n/).map((l) => l.trim()).reverse().find((l) => path.isAbsolute(l));
  if (line) return { path: line, onPath: true };
  const local = (agent.installDirs || [path.join(os.homedir(), '.local', 'bin')]).map((d) => path.join(d, agent.command + (win ? '.exe' : ''))).find((f) => fs.existsSync(f));
  return local ? { path: local, onPath: false } : null;
}

// The version of an installed agent, as its --version says it ("2.1.289 (Claude Code)", "codex-cli 0.160.1"), or
// null. Its input is closed at once: a program that does not know --version must not wait for it.
function agentVersion(found: Found | null): Promise<string | null> {
  if (!found?.path) return Promise.resolve(null);
  return new Promise((resolve) => {
    const p = execFile(found.path!, ['--version'], { timeout: 5000, windowsHide: true }, (e, out) =>
      resolve(e ? null : String(out).match(/\d+\.\d+(\.\d+)?/)?.[0] ?? null));
    p.stdin?.end();
  });
}

// Run the maker's installer; its output goes to onData as it comes (without terminal colors). Resolves to the exit
// code with the whole output: what the window shows once it is over, since the pieces sent while it ran and the
// answer travel on different IPC channels, and Electron keeps no order between them (the last line may come after the
// answer).
function installAgent(agent: Agent, onData: (data: string) => void): Promise<{ code: number; log: string }> {
  const line = installLine(agent);
  if (!line) return Promise.resolve({ code: 1, log: '' });
  const p = process.platform === 'win32'
    ? spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', line], { windowsHide: true })
    : spawn('/bin/sh', ['-c', line]);
  let log = '';
  const out = (d: unknown) => { const s = stripVTControlCharacters(String(d)); log += s; onData(s); };
  p.stdout.on('data', out); p.stderr.on('data', out);
  return new Promise((resolve) => { p.on('error', (e) => { out(`${e.message}\n`); resolve({ code: 1, log }); }); p.on('close', (code) => resolve({ code: code ?? 1, log })); });
}

// An account's sign-in, as its agent's own status says it, its config folder dir: { email } (null: signed in, the email
// not known), or null when not signed in. found: where the agent is (findAgent).
function accountEmail(agent: Agent, found: Found | null, dir: string): Promise<{ email: string | null } | null> {
  const config = agent.config;
  if (!found?.path || !config?.status) return Promise.resolve(null);
  return new Promise((resolve) => {
    const p = execFile(found.path!, config.status, { timeout: 20000, windowsHide: true, env: { ...process.env, [config.env]: dir } },
      (e, out) => resolve(e ? null : { email: config.email(String(out), dir)?.toLowerCase() ?? null }));
    p.stdin?.end();
  });
}
// Signed out of an account before its folder goes, with the agent's own command: what it keeps outside the folder
// (Claude Code's Keychain entry on macOS) goes too.
function signOut(agent: Agent, found: Found | null, dir: string) {
  const config = agent.config;
  if (!found?.path || !config?.logout) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const p = execFile(found.path!, config.logout, { timeout: 20000, windowsHide: true, env: { ...process.env, [config.env]: dir } }, () => resolve());
    p.stdin?.end();
  });
}

// The command line the window shows before installing.
const installLine = (agent: Agent) => agent.install?.[process.platform === 'win32' ? 'win32' : 'posix'] || null;

export type { Agent, Found };
export { AGENTS, findAgent, agentVersion, accountEmail, signOut, installAgent, installLine, extendTrust };
