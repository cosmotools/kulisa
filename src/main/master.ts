// Signing in to a profile's master (profiles.md, "One store, a master and copies"): Sign In to Master… in a profile's
// menu opens a window of its own on the master (profile-store.ts), where the human signs in by hand, once for every
// task of its projects: each task's copy is made from the master at the profile's first open there (Refresh from
// Master… brings its cookies to a copy made before). Nothing automated is attached to it: no CDP proxy, no Playwright,
// no agent's tool sees it, so no sign-in pause is needed. The page is a Profile as a task's (its tabs, presenting as
// Chrome, its session cookies kept), under a small bar of its own (master.html): the address, back, forward, reload.
// One window per master; asked again, it comes to the front. Closed, its tabs and sign-ins are saved.
import { BrowserWindow, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { Profile, toUrl } from './profiles.ts';
import { writeFileAtomic } from './store.ts';
import { page } from './pages.ts';
import type { Shell } from './shell.ts';

// A master's window, with its profile.
interface Master { win: BrowserWindow; profile: Profile; closing: Promise<void> | null; closed?: boolean; ready?: Promise<unknown> }

const BAR = 44; // keep in sync with #bar in Master.vue

function installMasters(shell: Shell, { preload, colors }: { preload: string; colors: () => { window: string } }) {
  shell.masters = new Map(); // folder -> { win, profile }
  // tasks.ts: before a copy is made of it, what the human did there is on disk.
  shell.flushMaster = async (folder) => { const m = shell.masters.get(folder); if (m) await shell.sessionCookies.persist(m.profile); };
  shell.closeMaster = async (folder) => { const m = shell.masters.get(folder); if (m) await close(m); };
  shell.openMaster = async (folder) => {
    const g = shell.profileStore.byFolder(folder);
    if (!g) return { error: 'no such profile' };
    const open = shell.masters.get(folder);
    if (open) { open.win.focus(); return { folder }; }
    const win = new BrowserWindow({ width: 1100, height: 800, title: `${g.name}: sign in once for every task — Kulisa`, backgroundColor: colors().window,
      autoHideMenuBar: true, webPreferences: { preload, sandbox: false } });
    win.removeMenu();
    const dir = shell.profileStore.masterDir(folder);
    const profile = new Profile(win, { id: g.id, name: g.name, avatar: g.avatar, folder, dir }, { task: `master/${folder}`, mimic: shell.chromeIdentity });
    const m: Master = { win, profile, closing: null };
    shell.masters.set(folder, m);
    await win.loadFile(page('master.html'), { query: { name: g.name, theme: shell.shade() } });
    const place = () => { const [width, height] = win.getContentSize(); profile.layout({ x: 0, y: BAR, width, height: Math.max(0, height - BAR) }); };
    const tell = () => { const t = profile.get(); if (!win.isDestroyed() && t && !t.wc.isDestroyed()) win.webContents.send('master:url', t.wc.getURL()); };
    profile.on('changed', () => { place(); tell(); });
    win.on('resize', place);
    win.on('close', (e) => { if (!m.closed && !shell.quitting) { e.preventDefault(); close(m); } });
    // Its tabs open; the bar's controls wait for them (a tab goes about:blank, then presents as Chrome, then loads: an
    // address typed meanwhile was overwritten).
    m.ready = (async () => {
      await shell.sessionCookies.restore(profile); // before the first request
      const urls = readTabs(dir);
      await Promise.all((urls.length ? urls : ['about:blank']).map((u, i) => profile.newTab(u, { activate: i === 0 }).ready));
    })();
    await m.ready;
    place(); tell();
    return { folder };
  };
  async function close(m: Master): Promise<void> {
    if (m.closing) return m.closing;
    m.closing = (async () => {
      const urls = m.profile.tabs.filter((t) => !t.wc.isDestroyed()).map((t) => t.wc.getURL()).filter((u) => u && u !== 'about:blank');
      writeTabs(m.profile.dir, urls);
      await shell.sessionCookies.persist(m.profile);
      await m.profile.close();
      shell.masters.delete(m.profile.folder);
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
  ipcMain.handle('master:go', async (e, url: string) => (await of(e))?.profile.navigate(null, toUrl(url)));
  ipcMain.handle('master:back', async (e) => { const m = await of(e); if (m?.profile.get()!.wc.navigationHistory.canGoBack()) m.profile.back(); });
  ipcMain.handle('master:forward', async (e) => { const m = await of(e); if (m?.profile.get()!.wc.navigationHistory.canGoForward()) m.profile.forward(); });
  ipcMain.handle('master:reload', async (e) => (await of(e))?.profile.reload());
}

// A master's tabs, in its folder as a copy's are (store.ts, Kulisa Tabs.json): a task's copy starts with them.
const TABS = 'Kulisa Tabs.json';
function readTabs(dir: string): string[] { try { return JSON.parse(fs.readFileSync(path.join(dir, TABS), 'utf8')); } catch { return []; } }
function writeTabs(dir: string, urls: string[]) { fs.mkdirSync(dir, { recursive: true }); writeFileAtomic(path.join(dir, TABS), JSON.stringify(urls)); }

export type { Master };
export { installMasters };
