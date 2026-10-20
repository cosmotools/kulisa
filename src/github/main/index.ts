// GitHub's main process half: its entry (../README.md). Its accounts, their sign-ins, Settings → GitHub's channels, and
// GitHub's own tools for the agent, with the rule of where it may write.
import { handle } from '../../main/ipc.ts';
import { log } from '../../main/log.ts';
import { Accounts } from './accounts.ts';
import { Tools } from './tools.ts';
import { GITHUB, APP, call, deviceCode, deviceTokens, isPublic, repoOf } from './api.ts';
import type { IpcMainInvokeEvent } from 'electron';
import type { Secrets } from './accounts.ts';
import type { Hosts } from './api.ts';
import type { GithubAccounts } from '../ipc.ts';
import type { Question } from '../../shared/types.ts';
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';

// A repository of the agent's project on GitHub (owner/name, lowercase) and the account it goes as (null: none reaches it).
interface Repo { repo: string; account: string | null }

// What only the rest of Kulisa knows, passed in: where its data is, the keyring, the projects whose repositories an
// account is for (by name), asking the human in the window a channel came from, and an account gone (the projects let
// go of it).
interface Options {
  dir: string; secrets: Secrets; hosts?: Hosts;
  usedBy(id: string): string[];
  ask(e: IpcMainInvokeEvent, q: Question): Promise<boolean>;
  deleted(id: string): void;
}

class Github {
  accounts: Accounts; o: Options; hosts: Hosts; mcp: Tools;
  signins = new Map<string, AbortController>(); // a sign-in's key -> its cancel
  publicRepos = new Map<string, boolean>(); // a repository outside the project: whether it is public, as found once
  constructor(o: Options) {
    this.o = o; this.hosts = o.hosts ?? GITHUB;
    this.accounts = new Accounts(o.dir, o.secrets, this.hosts);
    this.mcp = new Tools(this.hosts.mcp, (id) => this.accounts.token(id));
    this.register();
  }
  // GitHub's tools, listed by its server with the first account signed in (at start, once the app is ready: the keyring
  // is not before; after a sign-in; as Settings → GitHub is shown); none without an account. Kept in memory: the agent's MCP server is built per request.
  tools(): Tool[] { return this.mcp.list; }
  async loadTools() {
    const a = this.accounts.stored().find((x) => !x.expired);
    if (!a) { this.mcp.list = []; return; }
    try { log.info(`[github] ${(await this.mcp.load(a.id)).length} tools from GitHub's MCP server`); } catch (e) { log.warn(`[github] GitHub's MCP server: ${(e as Error).message}`); }
  }
  // A tool of GitHub's called by the agent (Kulisa's MCP server), for the repositories of its project. It writes only to
  // those, as the account each goes as; it reads them, and others that are public, as the account of the repository
  // named, else the project's first, else the first signed in (a project with no repository on GitHub); issue #48:
  // against a prompt injection making the agent write anywhere as the human.
  async call(repos: Repo[], name: string, args: Record<string, unknown>): Promise<CallToolResult> {
    const tool = this.mcp.list.find((t) => t.name === name);
    if (!tool) throw new Error(`GitHub has no tool ${name}`);
    const ours = repos.map((r) => r.repo).join(', ') || 'none';
    const target = typeof args.owner === 'string' && typeof args.repo === 'string' ? `${args.owner}/${args.repo}`.toLowerCase() : null;
    const mine = target ? repos.find((r) => r.repo === target) : undefined;
    if (!tool.annotations?.readOnlyHint && !mine) {
      throw new Error(`${target ? `${target} is not` : 'This names no repository of'} the project (${ours}): GitHub's tools here change only the project's repositories.`);
    }
    const account = mine ? mine.account : repos.find((r) => r.account)?.account ?? this.accounts.stored().find((a) => !a.expired)?.id;
    if (!account) throw new Error(`No GitHub account of the human's reaches ${target ?? ours}: they sign one in in Settings → GitHub, or choose one on the repository's row in the project's Code.`);
    if (target && !mine) {
      if (!this.publicRepos.has(target)) { const t = await this.accounts.token(account); this.publicRepos.set(target, !!t && await isPublic(this.hosts, t, target)); }
      if (!this.publicRepos.get(target)) throw new Error(`${target} is not the project's (${ours}) and not public: GitHub's tools here read only the project's repositories and public ones.`);
    }
    return this.mcp.call(account, name, args);
  }
  info(): GithubAccounts {
    return { install: `${(this.o.hosts ?? GITHUB).web}/apps/${APP}/installations/new`,
      accounts: this.accounts.stored().map(({ id, login, name, via, repos, ends, expired }) => ({ id, login, name, via, repos, ends, expired: !!expired, projects: this.o.usedBy(id) })) };
  }
  // The account for a remote's repository (the projects' Code: the one chosen, else this), with its login; repo: the
  // repository on GitHub, null when the remote is not GitHub's.
  forRemote(remote: string | null) {
    const repo = remote ? repoOf(remote) : null;
    return { repo, suggested: repo ? this.accounts.suggest(repo) : null };
  }
  login(id: string) { return this.accounts.find(id)?.login ?? null; }
  // A pull request's thread, for the partners of a task on the human's other computers (partners.ts; #49): the open
  // pull request of a branch, a comment posted to it, the comments since the last one seen.
  async api(account: string, path: string, o?: Parameters<typeof call>[3]) {
    const t = await this.accounts.token(account);
    if (!t) throw new Error('its GitHub account is signed out: sign in to it again in Settings → GitHub');
    return call(this.hosts, t, path, o);
  }
  async pullOf(account: string, repo: string, branch: string) {
    const { json } = await this.api(account, `/repos/${repo}/pulls?state=open&head=${encodeURIComponent(`${repo.split('/')[0]}:${branch}`)}`);
    return (json as { number: number }[])[0]?.number ?? null;
  }
  async comment(account: string, repo: string, pr: number, body: string) {
    await this.api(account, `/repos/${repo}/issues/${pr}/comments`, { method: 'POST', body: { body } });
  }
  // The comments after after (an id), oldest first; etag: the last answer's, so an unchanged thread costs nothing.
  async comments(account: string, repo: string, pr: number, after: number, etag?: string) {
    const { json, headers } = await this.api(account, `/repos/${repo}/issues/${pr}/comments?per_page=100`, { etag });
    const list = json ? (json as { id: number; body: string; user: { login: string } }[]).filter((c) => c.id > after).map((c) => ({ id: c.id, body: c.body, login: c.user.login })) : [];
    return { list, etag: headers.get('etag') ?? undefined };
  }
  register() {
    const hosts = this.o.hosts ?? GITHUB;
    handle('github:accounts', () => this.info());
    handle('github:refresh', async () => { await this.accounts.look(); if (!this.mcp.list.length) await this.loadTools(); return this.info(); });
    handle('github:signin', async (e, { key }) => {
      const stop = new AbortController();
      this.signins.get(key)?.abort();
      this.signins.set(key, stop);
      try {
        const d = await deviceCode(hosts);
        if (!e.sender.isDestroyed()) e.sender.send('github:code', { key, code: d.code, url: d.url, ends: d.ends });
        const ends = AbortSignal.timeout(Math.max(d.ends - Date.now(), 0));
        await this.accounts.signIn(await deviceTokens(hosts, d.device, d.interval, AbortSignal.any([stop.signal, ends])), 'app');
        if (!this.mcp.list.length) await this.loadTools();
        return this.info();
      } catch (err) {
        if (stop.signal.aborted) return { error: null };
        return { error: (err as Error).name === 'TimeoutError' ? 'Not signed in: the code expired. Try again.' : (err as Error).message };
      } finally { if (this.signins.get(key) === stop) this.signins.delete(key); }
    });
    handle('github:signin-cancel', (_e, { key }) => { this.signins.get(key)?.abort(); this.signins.delete(key); });
    // A fine-grained token, for an organization that will not install Kulisa App. Not a classic one: its scopes reach
    // every repository the human can (issue #48: the reason for the App).
    handle('github:token', async (_e, { token }) => {
      token = token.trim();
      if (/^gh[pousr]_/.test(token)) return { error: 'This is a classic token, which reaches all your repositories: make a fine-grained one (github_pat_…).' };
      if (!token.startsWith('github_pat_')) return { error: 'Not a GitHub token: a fine-grained one starts with github_pat_.' };
      try {
        await this.accounts.signIn({ access: token, refresh: null, ends: null, refreshEnds: null }, 'token');
        if (!this.mcp.list.length) await this.loadTools();
        return this.info();
      } catch (err) { return { error: `Not signed in: ${(err as Error).message}.` }; }
    });
    handle('github:delete', async (e, { id }) => {
      const a = this.accounts.find(id);
      if (!a) return { error: `no account ${id}` };
      const used = this.o.usedBy(id);
      if (!await this.o.ask(e, { message: `Delete the GitHub account ${a.login}?`, ok: 'Delete', danger: true, detail: [
        'Kulisa forgets its sign-in.',
        used.length && `The projects ${used.join(', ')} let go of it.`,
        a.via === 'app' ? 'Kulisa App stays authorized on GitHub until you revoke it there: Settings → Applications.' : 'The token stays on GitHub until you delete it there.',
      ].filter(Boolean).join(' ') })) return { error: null };
      this.accounts.drop(id);
      this.mcp.clients.delete(id);
      if (!this.accounts.stored().length) this.mcp.list = [];
      this.o.deleted(id);
      log.info(`[github] ${a.login} deleted`);
      return this.info();
    });
  }
}

export type { Repo as GithubRepo };
export { Github };
