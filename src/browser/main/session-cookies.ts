// Session cookies across restarts, like Chrome's "Continue where you left off".
// Electron keeps only persistent cookies on disk; session cookies (no expiry) die with the process. Many sign-ins
// live in session cookies (Entra's ESTSAUTH, federation IdPs), so without this every restart signs the profiles out.
// Each profile's session cookies are saved encrypted with the OS keyring (safeStorage) in its own folder, on quit and
// every 30 s (a crash loses at most that much), and restored into the profile before its first tab loads.
import electron from 'electron';
import type { Session, CookiesSetDetails } from 'electron';
import fs from 'fs';
import path from 'path';
import { SESSION_COOKIES_FILE } from './storage.ts';
import { writeFileAtomic } from '../../main/files.ts';

const { safeStorage } = electron;
const SAVE_EVERY_MS = 30000;

// What has cookies to keep: a profile (profiles.ts), or a master kept in step ({ session, dir }: cookie-sync.ts).
interface Holder { session: Session; dir: string; deleted?: boolean }
type Saved = Pick<Electron.Cookie, 'name' | 'value' | 'domain' | 'hostOnly' | 'path' | 'secure' | 'httpOnly' | 'sameSite'>;

class SessionCookies {
  file(profile: { dir: string }) { return path.join(profile.dir, SESSION_COOKIES_FILE); }

  async save(profile: Holder) {
    if (!safeStorage.isEncryptionAvailable() || profile.deleted) return; // never write them in the clear
    const cookies = (await profile.session.cookies.get({})).filter((c) => c.session);
    const data = cookies.map(({ name, value, domain, hostOnly, path: p, secure, httpOnly, sameSite }) => ({ name, value, domain, hostOnly, path: p, secure, httpOnly, sameSite }));
    fs.mkdirSync(profile.dir, { recursive: true });
    writeFileAtomic(this.file(profile), safeStorage.encryptString(JSON.stringify(data)), { mode: 0o600 });
  }

  async restore(profile: Holder) {
    let data: Saved[], raw: Buffer;
    try { raw = fs.readFileSync(this.file(profile)); } catch { return 0; } // none saved: nothing to put back
    // Saved with another key (the keyring's changed, or two Kulisas made one at once): after a restart the sign-ins
    // are gone, and the log says why a profile came back signed out.
    try { data = JSON.parse(safeStorage.decryptString(raw)); } catch { console.warn(`[session-cookies] ${profile.dir}: the saved session cookies cannot be read (saved with another keyring key?): not put back`); return 0; }
    let restored = 0;
    for (const c of data) {
      const host = c.domain!.replace(/^\./, '');
      const cookie: CookiesSetDetails = {
        url: `${c.secure ? 'https' : 'http'}://${host}${c.path || '/'}`,
        name: c.name, value: c.value, path: c.path, secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite,
        ...(c.hostOnly ? {} : { domain: c.domain }), // no expirationDate: it stays a session cookie
      };
      await profile.session.cookies.set(cookie).then(() => restored++, () => {});
    }
    return restored;
  }

  // Everything that keeps a profile signed in on disk: its session cookies (here), its persistent ones and its
  // storage (Electron writes them lazily). Before its tabs close, Kulisa quits, or its folder is copied.
  async persist(profile: Holder) {
    await this.save(profile).catch((e: Error) => console.error('[session-cookies]', e.message));
    await profile.session.cookies.flushStore().catch(() => {});
    profile.session.flushStorageData();
  }
  // profile: a Profile, or { session, dir } (a master kept in step: cookie-sync.ts).

  forget(profile: { dir: string }) { fs.rmSync(this.file(profile), { force: true }); }

  // Save every profile periodically; returns a function that stops it.
  autosave(getProfiles: () => Holder[]) {
    const timer = setInterval(() => { for (const p of getProfiles()) this.save(p).catch((e: Error) => console.error('[session-cookies]', e.message)); }, SAVE_EVERY_MS);
    return () => clearInterval(timer);
  }
}

export type { Holder };
export { SessionCookies };
