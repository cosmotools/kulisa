// Signing in to a profile's master (profiles.md, "One store, a master and copies"): Sign In to Master… in a profile's
// menu opens a window of its own on the master (profile-store.ts), where the human signs in by hand, once for every
// task of its projects: each task's copy is made from the master at the profile's first open there (Refresh from
// Master… brings its cookies to a copy made before). Nothing automated is attached to it: no CDP proxy, no Playwright,
// no agent's tool sees it, so no sign-in pause is needed. The page is a Profile as a task's (its tabs, its session
// cookies kept), under a small bar of its own (master.html): the address, back, forward, reload.
// One window per master; asked again, it comes to the front. Closed, its tabs and sign-ins are saved.
import { BrowserWindow } from 'electron';
import { handle } from './ipc.ts';
import { Profile, toUrl } from './profiles.ts';
import { readTabs, writeTabs } from './store.ts';
import { page } from './pages.ts';
import type { Shell } from './shell.ts';

// A master's window, with its profile.
interface Master { win: BrowserWindow; profile: Profile; closing: Promise<void> | null; closed?: boolean; ready?: Promise<unknown> }

const BAR = 44; // keep in sync with #bar in Master.vue

function installMasters(shell: Shell, { preload, colors }: { preload: string; colors: () => { window: string } }) {
  shell.masters = new Map(); // id -> { win, profile }
  // tasks.ts: before a copy is made of it, what the human did there is on disk.
  shell.flushMaster = async (id) => { const m = shell.masters.get(id); if (m) await shell.sessionCookies.persist(m.profile); };
  shell.closeMaster = async (id) => { const m = shell.masters.get(id); if (m) await close(m); };
  shell.openMaster = async (id) => {
    const g = shell.profileStore.get(id);
    if (!g) return { error: `no profile ${id}` };
    const open = shell.masters.get(id);
    if (open) { open.win.focus(); return { id }; }
    const win = new BrowserWindow({ width: 1100, height: 800, title: `${g.name}: sign in once for every task — Kulisa`, backgroundColor: colors().window,
      autoHideMenuBar: true, webPreferences: { preload, sandbox: true } });
    win.removeMenu();
    const dir = shell.profileStore.masterDir(id);
    const profile = new Profile(win, { id, name: g.name, avatar: g.avatar, dir }, { task: `master/${id}` });
    const m: Master = { win, profile, closing: null };
    shell.masters.set(id, m);
    win.on('close', (e) => { if (!m.closed && !shell.quitting) { e.preventDefault(); void close(m); } });
    // Closed meanwhile (its page, or a slow sign-in page, still loading): nothing to lay out, the window is gone.
    await win.loadFile(page('master.html'), { query: { name: g.name, theme: shell.shade() } }).catch((e) => { if (!m.closing) throw e; });
    if (m.closing) return { id };
    const place = () => { const [width = 0, height = 0] = win.getContentSize(); profile.layout({ x: 0, y: BAR, width, height: Math.max(0, height - BAR) }); };
    const tell = () => { const t = profile.get(); if (!win.isDestroyed() && t && !t.wc.isDestroyed()) win.webContents.send('master:url', t.wc.getURL()); };
    profile.on('changed', () => { place(); tell(); });
    win.on('resize', place);
    // Its tabs open; the bar's controls wait for them (an address typed while a tab loads was overwritten).
    m.ready = (async () => {
      await shell.sessionCookies.restore(profile); // before the first request
      await profile.openTabs(readTabs(dir));
    })();
    await m.ready;
    if (m.closing) return { id };
    place(); tell();
    return { id };
  };
  async function close(m: Master): Promise<void> {
    if (m.closing) return m.closing;
    m.closing = (async () => {
      writeTabs(m.profile.dir, m.profile.savedTabs((t) => (t.wc.isDestroyed() ? '' : t.wc.getURL())));
      await shell.sessionCookies.persist(m.profile);
      await m.profile.close();
      shell.masters.delete(m.profile.id);
      m.closed = true;
      if (!m.win.isDestroyed()) m.win.destroy();
    })();
    return m.closing;
  }
  // The bar's controls, each acting in the master of the window it comes from.
  const of = async (e: Electron.IpcMainInvokeEvent) => {
    const m = [...shell.masters.values()].find((x) => !x.win.isDestroyed() && x.win.webContents === e.sender);
    await m?.ready;
    return m?.profile.get() ? m : null;
  };
  handle('master:go', async (e, url) => (await of(e))?.profile.navigate(null, toUrl(url)));
  handle('master:back', async (e) => { const m = await of(e); if (m?.profile.get()!.wc.navigationHistory.canGoBack()) m.profile.back(); });
  handle('master:forward', async (e) => { const m = await of(e); if (m?.profile.get()!.wc.navigationHistory.canGoForward()) m.profile.forward(); });
  handle('master:reload', async (e) => (await of(e))?.profile.reload());
}

export type { Master };
export { installMasters };
