// Agent connections and explicit configuration ownership (docs/tasks.md, Choosing the agent). External records
// reference the original directory; forgetting one never owns its files or login.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { removeTree } from './remove.ts';
import { newId } from './store.ts';
import { writeFileAtomic } from './files.ts';
import { log, shortEmail } from './log.ts';
import { findAgent, agentVersion, installAgent, installLine, accountEmail, signOut } from '../kulisa-plugin/main/index.ts';
import type { Agent, Found } from '../kulisa-plugin/main/index.ts';
import type { Pty, TerminalOutput } from '../terminal/main/index.ts';
import { refused } from '../shared/result.ts';
import type { Result } from '../shared/result.ts';
import type { AgentInfo, ListOptions, ExistingAgentSetup } from '../shared/types.ts';

const canonical = (dir: string) => { try { return fs.realpathSync(dir); } catch { return path.resolve(dir); } };

interface Stored { id: string; agent: string; email: string | null; origin: 'kulisa' | 'external'; directory?: string; defaultConfig?: boolean }
// An agent itself (own) or one of its accounts, as all() lists them.
interface Account {
  id: string; agent: Agent; name: string; dir: string | null; own: boolean; choosable: boolean; email?: string | null; origin: 'kulisa' | 'external' | null; defaultConfig?: boolean;
}

interface Terminals {
  startTerminal: typeof import('../terminal/main/index.ts').startTerminal;
  stopTerminal(pty: Pty): void;
  forgetTerminal(key: string): void;
}
interface Seen { found: Found | null; version?: string | null }

class Accounts {
  dir: string; agents: Agent[]; markDeleted: (dir: string) => void; file: string; home: string;
  // Reserve cancellation before discovery or terminal creation finishes.
  readonly signins = new Map<string, Pty | null>();
  private seen = new Map<string, Seen>();
  private terminals: () => Promise<Terminals>;
  constructor(dir: string, agents: Agent[], markDeleted: (dir: string) => void = () => {},
    { home = os.homedir(), terminals = () => import('../terminal/main/index.ts') }: { home?: string; terminals?: () => Promise<Terminals> } = {}) {
    this.dir = dir; this.agents = agents; this.markDeleted = markDeleted;
    this.file = path.join(dir, 'agents.json'); this.home = home; this.terminals = terminals;
  }
  stored(): Stored[] { try { return JSON.parse(fs.readFileSync(this.file, 'utf8')).list || []; } catch { return []; } }
  save(list: Stored[]) { writeFileAtomic(this.file, JSON.stringify({ list }, null, 2)); }
  folderOf({ agent, id }: { agent: string; id: string }) { return path.join(this.dir, 'agents', `${agent}-${id}`); }
  all(): Account[] {
    const stored = this.stored();
    return this.agents.flatMap((a) => [
      { id: a.id, agent: a, name: a.name, dir: null as string | null, own: true, origin: null as Account['origin'], choosable: !a.config },
      ...stored.filter((x) => x.agent === a.id).map((x) => ({ id: x.id, agent: a, name: `${a.name} · ${x.email || x.id}`, email: x.email,
        dir: x.origin === 'external' ? x.directory! : this.folderOf(x), origin: x.origin, defaultConfig: x.defaultConfig, own: false, choosable: true })),
    ]);
  }
  choosable() { return this.all().filter((x) => x.choosable); }
  find(id: string | undefined): Account | null { return this.all().find((x) => x.id === id) || null; }
  // Who an id is, beside it in the log: its id says nothing, and the log is read after it is gone.
  label(id: string) {
    const x = this.find(id);
    return !x ? id : x.own ? x.agent.name : `${id} (${x.agent.name}${x.email ? `, ${shortEmail(x.email)}` : ''})`;
  }
  // Native fresh sign-in reuses only an owned account of this email; external configurations remain independent.
  byEmail(agentId: string, email: string | null) { return (email && this.all().find((x) => !x.own && x.agent.id === agentId && x.email === email && x.origin === 'kulisa')) || null; }
  prepare(agentId: string): { id: string; dir: string; error?: undefined } | { error: string } {
    const agent = this.agents.find((a) => a.id === agentId);
    if (!agent?.config) return { error: `${agent?.name || agentId} has no accounts` };
    // Nor an agent's own id (claude, codex: six letters too), which find() takes for the agent itself.
    const list = this.stored(), taken = (id: string) => this.agents.some((a) => a.id === id) || list.some((x) => x.id === id)
      || fs.existsSync(this.folderOf({ agent: agentId, id }));
    const id = newId(taken), dir = this.folderOf({ agent: agentId, id });
    fs.mkdirSync(dir, { recursive: true });
    return { id, dir };
  }
  create(id: string, agentId: string, email: string | null) {
    this.save([...this.stored().filter((x) => x.id !== id), { id, agent: agentId, email: email || null, origin: 'kulisa' }]);
    log.info(`[accounts] made ${this.label(id)}`);
    return this.find(id)!;
  }
  connectionAt(agentId: string, directory: string, defaultConfig: boolean) {
    return this.all().find((a) => !a.own && a.agent.id === agentId && a.dir && canonical(a.dir) === canonical(directory) && (a.origin === 'kulisa' || !!a.defaultConfig === defaultConfig));
  }
  // Native status was checked before registering a reference. Same directory/mode is one connection,
  // even through a symlink. Discovery excludes the managed storage namespace before allowing an external reference.
  connect(agentId: string, directory: string, email: string | null, defaultConfig = false) {
    const same = this.connectionAt(agentId, directory, defaultConfig);
    if (same) return same;
    const id = newId((v) => !!this.find(v) || fs.existsSync(this.folderOf({ agent: agentId, id: v })));
    this.save([...this.stored(), { id, agent: agentId, email, origin: 'external', directory, defaultConfig }]);
    log.info(`[accounts] connected external ${this.label(id)}`);
    return this.find(id)!;
  }
  drop(id: string) {
    log.info(`[accounts] deleted ${this.label(id)}`);
    this.save(this.stored().filter((x) => x.id !== id));
  }
  remove(dir: string) {
    this.markDeleted(dir);
    try { removeTree(dir); } catch (e) { console.warn('[accounts]', (e as Error).message); }
  }
  // Sign-in folders with no saved account belong to attempts interrupted before registration.
  clean() {
    const keep = new Set(this.stored().filter((x) => x.origin === 'kulisa').map((x) => path.basename(this.folderOf(x))));
    let folders: string[] = [];
    try { folders = fs.readdirSync(path.join(this.dir, 'agents')); } catch {}
    for (const f of folders) if (!keep.has(f)) this.remove(path.join(this.dir, 'agents', f));
    // Each once a run, so that an id in any line after is found.
    for (const x of this.stored()) log.info(`[accounts] ${this.label(x.id)}`);
  }
  async existing(agentId: string): Promise<Result<{ setup: (ExistingAgentSetup & { defaultConfig: boolean }) | null }>> {
    const a = this.find(agentId);
    if (!a?.own || !a.agent.config) return { error: 'This agent has no configurable accounts' };
    const directory = path.resolve(a.agent.config.home());
    const storage = path.join(this.dir, 'agents');
    const inside = (root: string, dir: string) => {
      const relative = path.relative(root, dir);
      return !relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
    };
    if (inside(storage, directory) || inside(canonical(storage), canonical(directory))) {
      return { error: 'This directory is managed by Kulisa. Select its existing account instead.' };
    }
    const found = await findAgent(a.agent, os.homedir());
    if (!found?.path) return { setup: null };
    const defaultConfig = !process.env[a.agent.config.env];
    const status = await accountEmail(a.agent, found, directory, defaultConfig);
    return { setup: status ? { directory, email: status.email, defaultConfig,
      account: this.connectionAt(agentId, directory, defaultConfig)?.id ?? null } : null };
  }

  async connectExisting(agentId: string): Promise<Result<{ connected: string }>> {
    const result = await this.existing(agentId);
    if (refused(result)) return result;
    const { setup } = result;
    if (!setup) return { error: 'No signed-in setup found. Sign in to a new configuration, or sign in with your CLI and check again.' };
    const a = this.connect(agentId, setup.directory, setup.email, setup.defaultConfig);
    return { connected: a.id };
  }
  private async look(agent: Agent, cwd: string, details?: boolean) {
    const key = `${agent.id}\n${cwd}`, found = await findAgent(agent, cwd), old = this.seen.get(key);
    const seen = { found, version: details ? await agentVersion(found) : old?.version };
    this.seen.delete(key); this.seen.set(key, seen);
    // Closed task folders need no permanent cache entry; keep the most recently checked contexts only.
    if (this.seen.size > 256) this.seen.delete(this.seen.keys().next().value!);
    return seen;
  }
  async list(accounts: Account[], cwd: string, { check, details, cached }: ListOptions = {}): Promise<{ list: AgentInfo[]; home: string } | { list: null }> {
    const looks = new Map<string, Promise<Seen>>();
    const of = (a: Agent) => {
      if (cached) return this.seen.get(`${a.id}\n${cwd}`);
      if (!looks.has(a.id)) looks.set(a.id, this.look(a, cwd, details));
      return looks.get(a.id);
    };
    if (cached && (check || details) && accounts.some(({ agent }) => {
      const seen = this.seen.get(`${agent.id}\n${cwd}`);
      return !seen || (details && seen.version === undefined);
    })) return { list: null };
    const list = await Promise.all(accounts.map(async ({ id, agent: a, name, dir, own }) => {
      const seen = check || details ? (await of(a))! : null, found = seen?.found;
      return { id, agent: a.id, name, maker: a.maker, needs: a.needs, site: a.site, install: installLine(a), account: own ? null : dir,
        ...((check || details) && { installed: !!found }),
        ...(details && { path: found?.path ?? null, onPath: found?.onPath ?? null, version: seen!.version }) };
    }));
    return { list, home: this.home };
  }
  async install(id: string, cwd: string, output: (data: string) => void) {
    const agent = this.find(id)?.agent;
    if (!agent?.install) return { error: `nothing to install for ${id}` };
    const { code, log } = await installAgent(agent, output);
    return { code, log, installed: !!(await this.look(agent, cwd, true)).found };
  }

  async cancel(key: string) {
    const pty = this.signins.get(key);
    this.signins.delete(key);
    if (pty) (await this.terminals()).stopTerminal(pty);
  }
  async signIn(agentId: string, key: string, output: TerminalOutput): Promise<Result<{ account: string; existing: boolean }, string | null>> {
    const own = this.find(agentId), config = own?.agent.config;
    if (!own?.own || !config?.login) return { error: `${own?.name || agentId} has no accounts` };
    if (this.signins.has(key)) return { error: 'This sign-in is already running' };
    this.signins.set(key, null);
    let directory: string | undefined, kept = false, signedIn = false;
    let found: Found | null = null, terminals: Terminals | undefined;
    try {
      found = await findAgent(own.agent, this.home);
      if (!this.signins.has(key)) return { error: null };
      if (!found?.path) return { error: `${own.name} is not installed: install it in Settings → Agents` };
      const prepared = this.prepare(agentId);
      if (refused(prepared)) return prepared;
      directory = prepared.dir;
      terminals = await this.terminals();
      if (!this.signins.has(key)) return { error: null };
      const pty = await terminals.startTerminal(output, { command: found.path, args: config.login(), cwd: this.home,
        env: { [config.env]: directory }, shell: false, size: { cols: 100, rows: 8 } }, key);
      const exited = new Promise<number>((resolve) => pty.onExit(({ exitCode }) => resolve(exitCode)));
      if (this.signins.has(key)) this.signins.set(key, pty);
      else terminals.stopTerminal(pty);
      const code = await exited;
      const got = await accountEmail(own.agent, found, directory);
      signedIn = !!got;
      const cancelled = !this.signins.delete(key);
      if (cancelled) return { error: null };
      if (!got) return { error: `Not signed in: ${own.name} ended with code ${code}.` };
      const existing = this.byEmail(agentId, got.email);
      if (existing) return { account: existing.id, existing: true };
      this.create(prepared.id, agentId, got.email);
      kept = true;
      return { account: prepared.id, existing: false };
    } finally {
      this.signins.delete(key);
      terminals?.forgetTerminal(key);
      if (directory && !kept) {
        try { if (signedIn) await signOut(own.agent, found, directory); }
        finally { this.remove(directory); }
      }
    }
  }
  // Core has already checked task use, confirmed removal, and detached project memberships.
  async disposeAccount(account: Account) {
    if (account.origin === 'kulisa') {
      await signOut(account.agent, await findAgent(account.agent, this.home), account.dir!);
      this.remove(account.dir!);
    }
  }
}

export type { Account };
export { Accounts };
