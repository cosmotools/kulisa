// The windows' handles on the agents and their accounts (docs/tasks.md, Agents, Accounts): Settings → Agents, a new
// account's sign-in, Choose the Agent, the installer.
import { app } from 'electron';
import { addAgent, deleteAccount } from '../projects.ts';
import { findAgent, accountEmail, signOut, agentVersion, installLine, installAgent } from '../agents/index.ts';
import { startTerminal, stopTerminal, forgetTerminal } from '../terminal.ts';
import { refused } from '../../shared/result.ts';
import { handle, on } from '../ipc.ts';
import type { Ipc } from '../ipc.ts';
import type { Shell, AgentChoice } from '../shell.ts';
import type { Agent } from '../agents/index.ts';
import type { Task } from '../tasks.ts';
import type { Pty } from '../terminal.ts';
import type * as Sent from '../../shared/types.ts'; // what the window gets: its one definition

export function registerAgents(ipc: Ipc) {
  const { shell, at, serial } = ipc;
  const store = shell.store;
  // The accounts (Settings → Agents), each with the projects it is in; clis: the agents an account can be made of.
  const accountsInfo = (): Sent.AccountsInfo => {
    const names = new Map(store.projects().map((p) => [p.id, p.name]));
    return { accounts: shell.accounts.all().filter((a) => !a.own).map(({ id, agent, name, email, projects }) => ({ id, agent: agent.id, name, email: email ?? null,
      projects: projects!.map((p) => names.get(p)).filter((n) => n !== undefined) })),
    clis: shell.accounts.all().filter((a) => a.own && a.agent.config?.login).map((a) => a.id) };
  };
  handle('accounts:list', () => accountsInfo());
  // Delete Account… (projects.ts: refused while a task runs it, asked first). { accounts, clis } or { error }.
  handle('account:delete', (e, { id }) => serial(async () => {
    const r = await deleteAccount(shell, id, at(e));
    if (refused(r)) return r;
    shell.sendProjects(); // +'s right-click menu of the projects that had it
    return accountsInfo();
  }));
  // A new account of an agent, made in Settings → Agents or in a project (tasks.md, Accounts): a folder of its own
  // (accounts.ts), then the agent's own sign-in in it, as /login, in a terminal of the window (key), which ends once signed
  // in; its status says the email it signed in to. Its page opens in the user's own browser, the agent's default: Google
  // refuses its sign-in in an embedded browser (2026-10-12, tasks.md, Accounts). An email stored already is that
  // account, added to the project. Not one change after another
  // (serial): a sign-in takes minutes. In a project (id): { agents } (the project's); in Settings → Agents (no id):
  // { accounts, clis }; or { error } (null: cancelled).
  const signins = shell.signins = new Map<string, Pty>(); // a sign-in terminal's key -> its pty
  const cancel = (key: string) => { const p = signins.get(key); signins.delete(key); if (p) stopTerminal(p); };
  handle('account:signin', async (e, { id, agent: agentId, key }) => {
    const w = at(e), own = shell.accounts.find(agentId);
    if (id && !store.projects().some((x) => x.id === id)) return { error: `no project ${id}` };
    const config = own?.agent.config;
    if (!own?.own || !config?.login) return { error: `${own?.name || agentId} has no accounts` };
    const found = await findAgent(own.agent, app.getPath('home'));
    if (!found?.path) return { error: `${own.name} is not installed: install it in Settings → Agents` };
    const r = shell.accounts.prepare(agentId);
    if (refused(r)) return r;
    const p = await startTerminal((channel, data) => w?.send(channel, data), { command: found.path, args: config.login(),
      cwd: app.getPath('home'), env: { [config.env]: r.dir }, shell: false,
      size: { cols: 100, rows: 8 } }, key); // its terminal is folded away, so no size would come
    signins.set(key, p);
    const code = await new Promise<number>((resolve) => p.onExit(({ exitCode }) => resolve(exitCode)));
    const cancelled = !signins.delete(key);
    forgetTerminal(key);
    const got = await accountEmail(own.agent, found, r.dir);
    // One it has already (the same email): that one; the new folder signed out and gone.
    const existing = got && shell.accounts.byEmail(agentId, got.email);
    if (cancelled || !got || existing) {
      if (got) await signOut(own.agent, found, r.dir);
      shell.accounts.remove(r.dir);
      if (existing) return id ? addAgent(shell, id, existing.id) : { error: `${existing.name} is an account already` };
      return { error: cancelled ? null : `Not signed in: ${own.name} ended with code ${code}.` };
    }
    shell.accounts.create(id, r.id, agentId, got.email);
    return id ? addAgent(shell, id, r.id) : accountsInfo();
  });
  handle('account:signin-cancel', (_e, { key }) => cancel(key));
  const choosing = new Map<string, (agent: AgentChoice | null) => void>(); // task key -> resolve(agent or null)
  // Asked in the task's window; Cancel opens none.
  shell.chooseAgent = ((task: Task, agent: AgentChoice | null) => new Promise<AgentChoice | null>((resolve) => {
    choosing.get(task.key)?.(null);
    choosing.set(task.key, resolve);
    task.window?.send('agent:choose', { task: task.key, selected: agent?.id ?? null });
  })) as Shell['chooseAgent'];
  shell.chooseAgent.cancel = (task: Task) => { choosing.get(task.key)?.(null); choosing.delete(task.key); };
  on('agent:chosen', (_e, { task, id }) => { if (!task) return; const r = choosing.get(task); choosing.delete(task); r?.(id ? shell.agentFor(id) : null); });
  // The agents to choose from; with check, whether each is installed (for the task's folder: its environment);
  // with details (the Agents window), also where it is and its version. Finding them runs the user's login shell and
  // each agent's --version, tenths of a second or more (the author, 2026-10-11: the list should come at once): with
  // cached, what the last look in this folder found, kept in memory, or { list: null } before the first; the window
  // shows it and looks again.
  const seen = new Map<string, { found: import('../agents/index.ts').Found | null; version?: string | null }>(); // `${agent id}\n${folder}` -> { found, version }
  const look = async (a: Agent, cwd: string, details?: boolean) => {
    const found = await findAgent(a, cwd), old = seen.get(`${a.id}\n${cwd}`);
    const s = { found, version: details ? await agentVersion(found) : old?.version };
    seen.set(`${a.id}\n${cwd}`, s);
    return s;
  };
  const notYet: { list: null } = { list: null }; // not looked for in this folder yet
  handle('agents:list', async (e, { check, details, cached } = {}) => {
    const w = at(e), looks = new Map<string, ReturnType<typeof look>>(), cwd = w?.task?.folder || app.getPath('home'); // each agent looked for once, whatever its accounts
    // The project's agents first (Choose the Agent), in its order.
    const mine = w?.task?.project.agents() || [], rank = (id: string) => (mine.includes(id) ? mine.indexOf(id) : mine.length);
    // Choosing a task's: the project's accounts, and the agents without accounts (the terminal only); never another
    // project's account: it could go with that project while a task here runs it. The Agents window: the agents alone,
    // not the terminal only: nothing of it to set up there (the author, 2026-10-11).
    const accounts = shell.accounts.all().filter((a) => (details ? a.own && a.agent.command : a.choosable && (a.own || mine.includes(a.id))))
      .sort((x, y) => rank(x.id) - rank(y.id)); // stable: the others as they were
    const of = (a: Agent) => {
      if (cached) return seen.get(`${a.id}\n${cwd}`);
      if (!looks.has(a.id)) looks.set(a.id, look(a, cwd, details));
      return looks.get(a.id);
    };
    if (cached && (check || details) && accounts.some(({ agent: a }) => !of(a) || (details && (of(a) as { version?: string | null }).version === undefined))) return notYet;
    const list = await Promise.all(accounts.map(async ({ id, agent: a, name, dir, own }) => {
      const f = check || details ? (await of(a))!.found : null;
      return {
        id, agent: a.id, name, maker: a.maker, needs: a.needs, site: a.site, install: installLine(a),
        account: own ? null : dir,
        ...((check || details) && { installed: !!f }),
        ...(details && { path: f?.path ?? null, onPath: f?.onPath ?? null, version: (await of(a))!.version }),
      };
    }));
    return { list, home: app.getPath('home') };
  });
  // The maker's installer, run when the human clicks Install (that is their go-ahead); its output goes to the window.
  handle('agents:install', async (e, { id }) => {
    const w = at(e), a = shell.agentFor(id, { any: true });
    if (!a?.install) return { error: `nothing to install for ${id}` };
    const { code, log } = await installAgent(a, (data) => w?.send('agents:install-log', data));
    return { code, log, installed: !!(await look(a, w?.task?.folder || app.getPath('home'), true)).found };
  });

}
