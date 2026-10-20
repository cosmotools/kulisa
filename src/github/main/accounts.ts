// The GitHub accounts and their sign-ins (../README.md, The accounts): one file in Kulisa's data folder, each
// account's tokens encrypted with the OS keyring (the caller's secrets), never in the clear and never shown or logged.
// Plain Node (no Electron): unit-tested.
//   github.json   { list: [{ id (GitHub's user id), login, name, via, repos, secret, ends, refreshEnds, expired }] }
import fs from 'fs';
import path from 'path';
import { log } from '../../main/log.ts';
import { GITHUB, Unauthorized, refreshed, whoIs, reposOf } from './api.ts';
import type { Hosts, Tokens } from './api.ts';

interface Secrets { available(): boolean; encrypt(s: string): string; decrypt(b: string): string }
interface Stored {
  id: string; login: string; name: string | null; via: 'app' | 'token'; repos: string[];
  secret: string; ends: number | null; refreshEnds: number | null; expired?: boolean;
}
const REFRESH_BEFORE = 5 * 60_000; // refreshed this long before its token ends: a call made then still has it

class Accounts {
  file: string; secrets: Secrets; hosts: Hosts;
  refreshing = new Map<string, Promise<string | null>>(); // one refresh at a time per account: each replaces the refresh token
  constructor(dir: string, secrets: Secrets, hosts: Hosts = GITHUB) {
    this.file = path.join(dir, 'github.json'); this.secrets = secrets; this.hosts = hosts;
  }
  stored(): Stored[] { try { return JSON.parse(fs.readFileSync(this.file, 'utf8')).list; } catch { return []; } }
  save(list: Stored[]) {
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ list }, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.file);
  }
  put(a: Stored) { const list = this.stored(), i = list.findIndex((x) => x.id === a.id); if (i < 0) list.push(a); else list[i] = a; this.save(list); }
  find(id: string) { return this.stored().find((a) => a.id === id) ?? null; }
  tokensOf(a: Stored): { access: string; refresh: string | null } { return JSON.parse(this.secrets.decrypt(a.secret)); }

  // Signed in, by Kulisa App (its tokens) or a token pasted: who it is and what it reaches, stored. The same GitHub
  // account signed in again (Sign In Again) is that account, its sign-in replaced.
  async signIn(t: Tokens, via: Stored['via']) {
    if (!this.secrets.available()) throw new Error('this computer has no keyring to keep the sign-in encrypted, so none is kept');
    const who = await whoIs(this.hosts, t.access), repos = await reposOf(this.hosts, t.access);
    const a: Stored = { id: who.id, login: who.login, name: who.name, via, repos, secret: this.secrets.encrypt(JSON.stringify({ access: t.access, refresh: t.refresh })),
      ends: t.ends ?? who.ends, refreshEnds: t.refreshEnds };
    this.put(a);
    log.info(`[github] signed in as ${a.login} (${via === 'app' ? 'Kulisa App' : 'a token'})`);
    return a;
  }
  // Its token to call GitHub with, refreshed first when it ends soon (saved before it is used: a refresh replaces the
  // refresh token, and one lost signs the account out); null: signed out, Sign In Again.
  token(id: string, now = Date.now()): Promise<string | null> {
    const a = this.find(id);
    if (!a || a.expired) return Promise.resolve(null);
    const t = this.tokensOf(a);
    if (!a.ends || a.ends - now > REFRESH_BEFORE) return Promise.resolve(t.access);
    if (!t.refresh || (a.refreshEnds && a.refreshEnds <= now)) { this.signedOut(a, 'its sign-in ended'); return Promise.resolve(null); }
    if (!this.refreshing.has(id)) {
      this.refreshing.set(id, refreshed(this.hosts, t.refresh).then((n) => {
        if (!n) { this.signedOut(a, 'GitHub refused its refresh'); return null; }
        this.put({ ...a, secret: this.secrets.encrypt(JSON.stringify({ access: n.access, refresh: n.refresh })), ends: n.ends, refreshEnds: n.refreshEnds });
        log.info(`[github] ${a.login}: sign-in refreshed`);
        return n.access;
      }).finally(() => this.refreshing.delete(id)));
    }
    return this.refreshing.get(id)!;
  }
  signedOut(a: Stored, why: string) {
    const now = this.find(a.id);
    if (now && !now.expired) { this.put({ ...now, expired: true }); log.info(`[github] ${a.login} signed out: ${why}`); }
  }
  // Looked at again on GitHub: what each reaches now (Kulisa App installed on more repositories), or that GitHub no
  // longer takes its sign-in (revoked there). One that cannot be reached (offline) stays as it was.
  async look() {
    await Promise.all(this.stored().filter((a) => !a.expired).map(async (a) => {
      try {
        const t = await this.token(a.id);
        if (!t) return;
        const repos = await reposOf(this.hosts, t), now = this.find(a.id);
        if (now && repos.join() !== now.repos.join()) this.put({ ...now, repos });
      } catch (e) {
        if (e instanceof Unauthorized) this.signedOut(a, 'GitHub no longer takes it'); else log.warn(`[github] ${a.login}: ${(e as Error).message}`);
      }
    }));
  }
  drop(id: string) { this.save(this.stored().filter((a) => a.id !== id)); }
  // The account for a repository (owner/name): one that reaches it, else one of its owner's own; null: none.
  suggest(repo: string) {
    const list = this.stored().filter((a) => !a.expired);
    return (list.find((a) => a.repos.some((r) => r.toLowerCase() === repo)) ?? list.find((a) => a.login.toLowerCase() === repo.split('/')[0]))?.id ?? null;
  }
}

export type { Secrets };
export { Accounts };
