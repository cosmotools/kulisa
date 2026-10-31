// Real accounts signed in once, in every task (profiles.md, "Sign-ins kept in step"): the cookies of non-local sites
// kept in step between a profile's master and its open copies, both ways, as they change (Electron's cookies 'changed'
// event, then cookies.set or remove in the others). A sign-in, a refreshed token or a sign-out in one task reaches the
// master and every other task with that profile open; a copy opening gets the master's first. Local sites (local.ts)
// stay each copy's own: each task runs its own app, often with its own database, and cookies do not depend on the
// port, so shared they would sign the tasks out of each other. Cookies only: a sign-in a site keeps in its storage
// (MSAL's localStorage) is not brought. Electron is required only when a group is made: the rules load in plain Node.
import electron from 'electron';
import type { Session, Cookie, CookiesSetDetails } from 'electron';
import { isLocal } from '../../main/local.ts';
import type { Holder } from './session-cookies.ts';
// Taken from the module, not imported by name: unit tests load this in plain Node, where 'electron' is only a path
// (docs/testing.md, Two layers).
const { session } = electron;

type Cause = 'explicit' | 'overwrite' | 'expired' | 'evicted' | 'expired-overwrite' | 'inserted' | 'inserted-no-change-overwrite'
  | 'inserted-no-value-change-overwrite';
interface Group { master: Session; dir: string; copies: Map<Session, string[]>; ready?: Promise<unknown> }

// A change seen in one session that the others take: a cookie set or changed, or removed: explicitly, or by the site
// sending it already expired (Max-Age=0: a sign-out; Chromium says expired-overwrite). Not one replaced as part of a
// change (its new value comes as its own event), expired or evicted (each store does that by itself), nor one of a
// local site.
function takes({ cookie, cause, removed }: { cookie: Cookie; cause: Cause; removed?: boolean }, local: string[] = []) {
  if (!cookie?.domain || isLocal(`http://${cookie.domain.replace(/^\./, '')}/`, local)) return false;
  if (removed) return cause === 'explicit' || cause === 'expired-overwrite';
  return cause === 'inserted' || cause === 'inserted-no-value-change-overwrite' || cause === 'explicit';
}
// The details cookies.set takes for a cookie as cookies.get gives it; a session cookie stays one (no expirationDate).
function details(c: Cookie): CookiesSetDetails & { url: string } {
  return { url: `${c.secure ? 'https' : 'http'}://${c.domain!.replace(/^\./, '')}${c.path || '/'}`, name: c.name, value: c.value, path: c.path,
    secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite, ...(c.hostOnly ? {} : { domain: c.domain }),
    ...(c.session || !c.expirationDate ? {} : { expirationDate: c.expirationDate }) };
}
const keyOf = (s: Session, c: Cookie, removed: boolean) => `${sessionKey(s)}|${c.name}|${c.domain}|${c.path}|${removed ? '' : c.value}`;
const ids = new WeakMap<Session, number>(); let nextId = 0;
const sessionKey = (s: Session) => { if (!ids.has(s)) ids.set(s, ++nextId); return ids.get(s)!; };
const listened = new WeakSet<Session>(); // the sessions _listen listens to

// masterDir(id): a profile's master (profile-store.ts); restore({ session, dir }): its session cookies put back
// from its file (session-cookies.ts), as a master not open in a window keeps them only there.
class CookieSync {
  masterDir: (id: string) => string; restore: (holder: Holder) => Promise<unknown>; groups: Map<string, Group>; echoes: Set<string>;
  constructor({ masterDir, restore = async () => {} }: { masterDir: (id: string) => string; restore?: (holder: Holder) => Promise<unknown> }) {
    this.masterDir = masterDir; this.restore = restore;
    this.groups = new Map(); // profile id -> { master: session, copies: Map(session -> project's local list) }
    this.echoes = new Set(); // changes this made, not to be taken back from where they were made
  }
  // A copy opening (tasks.ts: before its first tab loads): the master's non-local cookies first, then kept in step.
  async attach(id: string, copy: Session, local: string[] = []) {
    const g = await this._group(id);
    if (g.copies.has(copy)) return;
    await this._bring(g.master, copy, local, { replace: true });
    g.copies.set(copy, local);
    this._listen(copy, id);
  }
  // A copy just made (store.ts, copyProfile): every cookie of the master, local sites' too: the copy starts as the
  // master is.
  async copy(id: string, to: Session) {
    const g = await this._group(id);
    for (const c of await g.master.cookies.get({})) await to.cookies.set(details(c)).catch((e: Error) => console.warn('[cookie-sync] not copied:', c.domain, c.name, e.message));
  }
  detach(id: string, copy: Session) { this.groups.get(id)?.copies.delete(copy); }
  async _group(id: string) {
    let g = this.groups.get(id);
    if (!g) {
      g = { master: session.fromPath(this.masterDir(id)), dir: this.masterDir(id), copies: new Map() };
      this.groups.set(id, g);
      g.ready = this.restore({ session: g.master, dir: g.dir }).catch(() => {});
      this._listen(g.master, id);
    }
    await g.ready;
    return g;
  }
  // The masters kept in step, as Kulisa quits: their session cookies to save (session-cookies.ts).
  masters(): Holder[] { return [...this.groups.values()].map((g) => ({ session: g.master, dir: g.dir })); }
  forget(id: string) { this.groups.delete(id); } // its profile deleted
  _listen(s: Session, id: string) {
    if (listened.has(s)) return;
    listened.add(s);
    s.cookies.on('changed', (_e, cookie, cause, removed) => {
      const echo = keyOf(s, cookie, removed);
      if (this.echoes.delete(echo)) return; // ours
      const g = this.groups.get(id);
      if (!g) return;
      const others = [g.master, ...g.copies.keys()].filter((x) => x !== s);
      for (const t of others) {
        const local = t === g.master ? [] : g.copies.get(t)!;
        if (!takes({ cookie, cause, removed }, s === g.master ? local : g.copies.get(s) || local)) continue;
        this._apply(t, cookie, removed);
      }
    });
  }
  _apply(t: Session, c: Cookie, removed: boolean) {
    const k = keyOf(t, c, removed);
    this.echoes.add(k);
    setTimeout(() => this.echoes.delete(k), 5000); // a change Chromium did not report back (the same value) is forgotten
    const done = removed ? t.cookies.remove(details(c).url, c.name) : t.cookies.set(details(c));
    done.catch((e: Error) => { this.echoes.delete(k); console.warn('[cookie-sync]', c.domain, c.name, e.message); });
  }
  // from's non-local cookies into to; replace: to's own non-local ones go first (a copy takes the master's as they are).
  async _bring(from: Session, to: Session, local: string[], { replace = false } = {}) {
    const all = (await from.cookies.get({})).filter((c) => takes({ cookie: c, cause: 'inserted' }, local));
    if (replace) {
      for (const c of await to.cookies.get({})) {
        if (takes({ cookie: c, cause: 'explicit', removed: true }, local) && !all.some((x) => x.name === c.name && x.domain === c.domain && x.path === c.path)) {
          await to.cookies.remove(details(c).url, c.name).catch(() => {});
        }
      }
    }
    for (const c of all) await to.cookies.set(details(c)).catch(() => {}); // before to is listened to: nothing to echo
  }
}

export { CookieSync, takes, details };
