// Session cookies across restarts, like Chrome's "Continue where you left off".
// Electron keeps only persistent cookies on disk; session cookies (no expiry) die with the process. Many sign-ins
// live in session cookies (Entra's ESTSAUTH, federation IdPs), so without this every restart signs the profiles out.
// Each profile's session cookies are saved encrypted with the OS keyring (safeStorage), on quit and every 30 s
// (a crash loses at most that much), and restored into the profile before its first tab loads.
const fs = require('fs');
const path = require('path');
const { safeStorage } = require('electron');

const SAVE_EVERY_MS = 30000;

class SessionCookies {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  file(profile) { return path.join(this.dir, `${profile.partition.replace(/[^\w-]/g, '_')}.bin`); }

  async save(profile) {
    if (!safeStorage.isEncryptionAvailable()) return; // never write them in the clear
    const cookies = (await profile.session.cookies.get({})).filter((c) => c.session);
    const data = cookies.map(({ name, value, domain, hostOnly, path: p, secure, httpOnly, sameSite }) => ({ name, value, domain, hostOnly, path: p, secure, httpOnly, sameSite }));
    fs.writeFileSync(this.file(profile), safeStorage.encryptString(JSON.stringify(data)), { mode: 0o600 });
  }

  async restore(profile) {
    let data;
    try { data = JSON.parse(safeStorage.decryptString(fs.readFileSync(this.file(profile)))); } catch { return 0; }
    let restored = 0;
    for (const c of data) {
      const host = c.domain.replace(/^\./, '');
      const cookie = {
        url: `${c.secure ? 'https' : 'http'}://${host}${c.path || '/'}`,
        name: c.name, value: c.value, path: c.path, secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite,
        ...(c.hostOnly ? {} : { domain: c.domain }), // no expirationDate: it stays a session cookie
      };
      await profile.session.cookies.set(cookie).then(() => restored++, () => {});
    }
    return restored;
  }

  forget(profile) { fs.rmSync(this.file(profile), { force: true }); }

  // Save every profile periodically; returns a function that stops it.
  autosave(getProfiles) {
    const timer = setInterval(() => { for (const p of getProfiles()) this.save(p).catch((e) => console.error('[session-cookies]', e.message)); }, SAVE_EVERY_MS);
    return () => clearInterval(timer);
  }
}

module.exports = { SessionCookies };
