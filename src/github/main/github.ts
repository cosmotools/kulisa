// GitHub as Kulisa has it (README): the accounts (accounts.ts), signing in with Kulisa App's device flow or a
// fine-grained token, and what a repository's remote is to them (its account, or why none). Plain Node (no Electron:
// the caller gives the fetch and the keyring): unit-tested.
import { Accounts } from './accounts.ts';
import { deviceCode, deviceToken, installations, reaches, user } from './api.ts';
import { INSTALL } from '../ipc.ts';
import type { Secrets } from './accounts.ts';
import type { Fetch, Tokens } from './api.ts';
import type { GitHubAccount, RepoGitHub, RepoState } from '../ipc.ts';

// A device flow under way: its code, until the human has entered it, denied it or it expired, or it is cancelled.
interface Flow { device: string; code: string; url: string; interval: number; until: number; again: string | null; cancel?: () => void; cancelled?: boolean }
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
// A fine-grained token's prefix: a classic one (ghp_) reaches every repository of its user, which Kulisa's sign-in
// exists not to give (README, Why a GitHub App).
const FINE_GRAINED = /^github_pat_[A-Za-z0-9_]+$/;

class GitHub {
  accounts: Accounts; fetch: Fetch; flow: Flow | null = null;
  constructor({ dir, secrets, fetch }: { dir: string; secrets: Secrets; fetch: Fetch }) {
    this.accounts = new Accounts({ dir, secrets, fetch }); this.fetch = fetch;
  }
  kept() { return this.accounts.secrets.kept(); }

  // The accounts as Settings → GitHub shows them; where Kulisa App is installed asked of GitHub for each signed in.
  // usedBy: the projects that use one (their names: the caller's).
  async list(usedBy: (id: string) => string[]): Promise<GitHubAccount[]> {
    return Promise.all(this.accounts.list().map(async ({ id, login, kind }) => {
      const signedIn = this.accounts.signedIn(id);
      const installed = kind === 'app' && signedIn ? await this.accounts.token(id).then((t) => installations(this.fetch, t), (): null => null) : null;
      return { id, login, kind, installed, projects: usedBy(id), ends: this.accounts.ends(id), signedIn };
    }));
  }

  // The device flow (GitHub's "Generating a user access token for a GitHub App"): a code, shown by Kulisa itself; again:
  // the account it signs in again. One at a time: a second one cancels the first.
  async startFlow(again: string | null = null) {
    this.cancelFlow();
    const d = await deviceCode(this.fetch);
    this.flow = { device: d.device, code: d.code, url: d.url, interval: d.interval, until: Date.now() + d.expires * 1000, again };
    return { code: d.code, url: d.url };
  }
  cancelFlow() { const f = this.flow; this.flow = null; if (f) { f.cancelled = true; f.cancel?.(); } }
  // Asked at GitHub's interval (slow_down adds to it) until the human has entered the code; open: GitHub's page in the
  // user's browser, once the code is on screen. The account, or why not (null: cancelled).
  async waitFlow(open: (url: string) => void): Promise<{ id: string; error?: undefined } | { error: string | null }> {
    const f = this.flow;
    if (!f) return { error: 'no sign-in under way' };
    open(f.url);
    while (!f.cancelled) {
      await new Promise<void>((resolve) => { const t = setTimeout(resolve, f.interval * 1000); f.cancel = () => { clearTimeout(t); resolve(); }; });
      if (f.cancelled) break;
      if (Date.now() > f.until) { this.done(f); return { error: 'The code expired: sign in again.' }; }
      let r;
      try { r = await deviceToken(this.fetch, f.device); } catch { await sleep(1000); continue; } // the network: asked again
      if (f.cancelled) break;
      if ('tokens' in r) { this.done(f); return this.signedIn(r.tokens, 'app', f.again); }
      if (r.error === 'authorization_pending') continue;
      if (r.error === 'slow_down') { f.interval = r.interval ?? f.interval + 5; continue; }
      this.done(f);
      return { error: r.error === 'access_denied' ? 'Not signed in: the code was denied on GitHub.' : r.error === 'expired_token' ? 'The code expired: sign in again.'
        : `Not signed in: GitHub answered ${r.error}.` };
    }
    return { error: null };
  }
  private done(f: Flow) { if (this.flow === f) this.flow = null; }

  // A fine-grained token pasted: checked with GitHub (who it is, its end), then kept. again: the account it is a new
  // token for.
  async addToken(token: string, again: string | null = null) {
    token = token.trim();
    if (!FINE_GRAINED.test(token)) return { error: 'not a fine-grained token (github_pat_…): make one on GitHub, as the link above says' };
    return this.signedIn({ access: token }, 'pat', again);
  }
  // Who the tokens are (GET /user), then the account kept.
  private async signedIn(tokens: Tokens, kind: 'app' | 'pat', again: string | null) {
    let who;
    try { who = await user(this.fetch, tokens.access); } catch { return { error: 'GitHub could not be reached' }; }
    if (!who) return { error: kind === 'pat' ? 'GitHub refused this token' : 'GitHub refused the sign-in' };
    const a = this.accounts.add(who.login, kind, kind === 'pat' && who.ends ? { ...tokens, ends: who.ends } : tokens, again);
    return 'error' in a ? { error: a.error } : { id: a.id };
  }

  // What a repository's remote (its key: remotes.ts) is to the accounts: bound to one (account), or the first that
  // reaches it suggested. Its owner/repo for the window's words.
  async repo(key: string | null, bound: string | null): Promise<RepoGitHub> {
    const m = key && /^github\.com\/([^/]+)\/([^/]+)$/.exec(key);
    const none: Omit<RepoGitHub, 'state'> = { account: null, suggested: false, owner: null, repo: null, install: null };
    if (!m) return { ...none, state: 'not-github' };
    const owner = m[1]!, repo = `${m[1]}/${m[2]}`, list = this.accounts.list();
    const of = { ...none, owner, repo };
    const account = list.find((a) => a.id === bound);
    const reach = async (id: string): Promise<RepoState> => {
      let token;
      try { token = await this.accounts.token(id); } catch { return this.accounts.signedIn(id) ? 'unreachable' : 'signed-out'; }
      const status = await reaches(this.fetch, token, repo).catch(() => 0);
      if (status === 401) { this.accounts.signOut(id, 'GitHub refused its token'); return 'signed-out'; }
      return status === 200 ? 'ok' : status ? 'not-reached' : 'unreachable';
    };
    const install = (a?: { kind: string }) => (!a || a.kind === 'app' ? INSTALL : null);
    if (account) { const state = await reach(account.id); return { ...of, account: account.id, state, install: state === 'not-reached' ? install(account) : null }; }
    if (!list.length) return { ...of, state: 'no-account' };
    const states = new Set<RepoState>();
    for (const a of list) {
      const state = await reach(a.id);
      if (state === 'ok') return { ...of, account: a.id, suggested: true, state };
      states.add(state);
    }
    // None reaches it: why, the one that matters most first (GitHub not reached says nothing of the rest).
    const state = states.has('unreachable') ? 'unreachable' : states.has('not-reached') ? 'not-reached' : 'signed-out';
    return { ...of, state, install: state === 'not-reached' && list.some((a) => a.kind === 'app') ? INSTALL : null };
  }
}

export { GitHub };
