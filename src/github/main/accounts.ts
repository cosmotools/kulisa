// The GitHub accounts and their tokens (README, The accounts, The tokens): github.json in Kulisa's data folder, each
// account until the human deletes it. Plain Node (no Electron): unit-tested.
//   github.json   { list: [{ id, login, kind, secret }] }: id six random characters (newId); kind 'app' (Kulisa App's
//                 device flow) or 'pat' (a fine-grained token); secret: its tokens, encrypted with the OS keyring, none
//                 without one (kept), nor when signed out
import fs from 'fs';
import path from 'path';
import { newId, writeFileAtomic } from '../../main/store.ts';
import { log } from '../../main/log.ts';
import { refresh } from './api.ts';
import type { Fetch, Tokens } from './api.ts';
import type { GitHubKind } from '../ipc.ts';

interface Stored { id: string; login: string; kind: GitHubKind; secret?: string }
// The OS keyring (safeStorage): kept, whether a secret written is one (false: no keyring, Linux's basic_text, where
// Electron's fixed key is as good as plain text).
interface Secrets { kept(): boolean; encrypt(s: string): string; decrypt(s: string): string }
// A refresh that GitHub may still turn down is done before the token is used, this long before it ends: a call with
// a token about to end would fail on the way.
const EARLY = 5 * 60_000;

class Accounts {
  file: string; secrets: Secrets; fetch: Fetch; now: () => number;
  // The tokens while Kulisa runs, by account (decrypted once; without a keyring, the only place they are).
  memory = new Map<string, Tokens>();
  // One refresh at a time per account, every caller waiting on it: each refresh replaces the refresh token, so a second
  // one with the same token would be refused and sign the account out for nothing.
  refreshing = new Map<string, Promise<string>>();
  constructor({ dir, secrets, fetch, now = Date.now }: { dir: string; secrets: Secrets; fetch: Fetch; now?: () => number }) {
    this.file = path.join(dir, 'github.json'); this.secrets = secrets; this.fetch = fetch; this.now = now;
  }
  list(): Stored[] { try { return JSON.parse(fs.readFileSync(this.file, 'utf8')).list || []; } catch { return []; } }
  private save(list: Stored[]) { writeFileAtomic(this.file, JSON.stringify({ list }, null, 2)); }
  get(id: string) { return this.list().find((a) => a.id === id) || null; }
  // Who an id is, beside it in the log: its login, never a token.
  label(id: string) { const a = this.get(id); return a ? `${id} (${a.login}${a.kind === 'pat' ? ', token' : ''})` : id; }
  // At start, each once a run, so that an id in any line after is found.
  logAll() { for (const a of this.list()) log.info(`[github] ${this.label(a.id)}`); }

  // Its tokens: from memory, or the keyring's once; null when signed out (or kept nowhere: no keyring at the last start).
  tokens(id: string): Tokens | null {
    const t = this.memory.get(id);
    if (t) return t;
    const secret = this.get(id)?.secret;
    if (!secret) return null;
    try { const read = JSON.parse(this.secrets.decrypt(secret)) as Tokens; this.memory.set(id, read); return read; } catch { return null; }
  }
  // When the human must sign in again: a refresh token's end, a fine-grained token's own; null: never.
  ends(id: string) { const t = this.tokens(id); return t ? (t.refresh ? t.refreshEnds : t.ends) ?? null : null; }
  signedIn(id: string) { const t = this.tokens(id), ends = this.ends(id); return !!t && (ends === null || ends > this.now()); }

  // Signed in: a new account, or the one signed in again (again), or (Kulisa App) the one of the same login, which it
  // is: GitHub gives one user one authorization of an app. Its tokens written before they are used.
  add(login: string, kind: GitHubKind, tokens: Tokens, again?: string | null): Stored | { error: string } {
    const list = this.list();
    let a = again ? list.find((x) => x.id === again) : kind === 'app' ? list.find((x) => x.kind === 'app' && x.login === login) : undefined;
    if (again && !a) return { error: `no account ${again}` };
    if (a && a.login !== login) return { error: `signed in as ${login}, not ${a.login}: sign in as ${a.login}, or add ${login} as an account of its own` };
    const made = !a;
    if (!a) { a = { id: newId((id) => list.some((x) => x.id === id)), login, kind }; list.push(a); }
    a.kind = kind;
    this.keep(list, a, tokens);
    log.info(`[github] ${made ? 'added' : 'signed in again'} ${this.label(a.id)}`);
    return a;
  }
  // The tokens kept: written (encrypted) when there is a keyring, in memory either way; never written without one.
  private keep(list: Stored[], a: Stored, tokens: Tokens) {
    if (this.secrets.kept()) a.secret = this.secrets.encrypt(JSON.stringify(tokens)); else delete a.secret;
    this.save(list);
    this.memory.set(a.id, tokens);
  }
  // Its tokens forgotten: Sign in Again in Settings → GitHub. why: for the log.
  signOut(id: string, why: string) {
    const list = this.list(), a = list.find((x) => x.id === id);
    this.memory.delete(id);
    if (!a) return;
    delete a.secret;
    this.save(list);
    log.warn(`[github] signed out ${this.label(id)}: ${why}`);
  }
  // Deleted by the human: its tokens forgotten here; they live on GitHub until they end (README, Deleting).
  delete(id: string) {
    log.info(`[github] deleted ${this.label(id)}`);
    this.memory.delete(id);
    this.save(this.list().filter((x) => x.id !== id));
  }

  // A token to call GitHub with as the account: its access token, refreshed first when it ends soon (one refresh at a
  // time: refreshing). Throws, saying why, when there is none: signed out (a refresh refused), or GitHub not reached.
  async token(id: string): Promise<string> {
    const t = this.tokens(id);
    if (!t || !this.signedIn(id)) throw new Error(`${this.get(id)?.login ?? id} is signed out: Sign in Again in Settings → GitHub`);
    if (!t.refresh || !t.ends || t.ends - EARLY > this.now()) return t.access;
    let p = this.refreshing.get(id);
    if (!p) {
      p = this.refreshNow(id, t.refresh).finally(() => this.refreshing.delete(id));
      this.refreshing.set(id, p);
    }
    return p;
  }
  private async refreshNow(id: string, token: string) {
    let r;
    try { r = await refresh(this.fetch, token, this.now()); } catch (e) {
      // Not GitHub's no: the network. The tokens stay; the next call tries again.
      log.warn(`[github] refresh failed ${this.label(id)}: ${(e as Error).message}`);
      throw new Error('GitHub could not be reached', { cause: e });
    }
    if (!('tokens' in r)) { this.signOut(id, `refresh refused (${r.error})`); throw new Error(`${this.get(id)?.login ?? id} is signed out: Sign in Again in Settings → GitHub`); }
    // Written first, used after: the old refresh token works no more, and a pair lost to a crash after GitHub's answer
    // would leave only a sign-in again.
    const list = this.list(), a = list.find((x) => x.id === id);
    if (!a) throw new Error(`no account ${id}`);
    this.keep(list, a, r.tokens);
    return r.tokens.access;
  }
}

export type { Secrets };
export { Accounts };
