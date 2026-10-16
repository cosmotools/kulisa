// Settings in a window of its own (docs/window.md, Settings), as a desktop app's: one for the whole app, with the OS's
// title bar, opened from a tasks' window (its parent) at a page. While it is open the tasks' windows take no input, as
// JetBrains' Settings holds its IDE: open it, set things, close it; their pages and terminals stay on screen and live.
// Not Electron's modal: on macOS that is a sheet without a title bar (browser-window.md, Platform notices). Its page:
// settings.html (components/Settings.vue).
import { BrowserWindow } from 'electron';
import path from 'path';
import { on } from './ipc.ts';
import { page } from './pages.ts';
import { COLORS, Questions, keepPage, onScreen } from './window.ts';
import type { Shell } from './shell.ts';
import type { AppWindow } from './window.ts';
import type { Arg, Events } from '../shared/ipc.ts';

// Its size at first, and the smallest one whose tree and page still fit, in CSS pixels: times the Kulisa zoom.
const SIZE = { width: 1000, height: 680 }, MIN = { width: 640, height: 420 };
const scaled = (s: { width: number; height: number }, z: number) => ({ width: Math.round(s.width * z), height: Math.round(s.height * z) });

interface SettingsWindow {
  win: BrowserWindow;
  parent: AppWindow; // the tasks' window it was opened from: the shown task's project and folder are its
  questions: Questions; // while it is open every question is asked here: the tasks' windows take no input (app.ts, askWhich)
  send<C extends keyof Events>(channel: C, ...data: Arg<Events[C]>): void;
  setZoom(z: number): void;
  setTheme(theme: string, shade: 'dark' | 'light'): void;
  close(): void; // its page has saved what was typed: where it is kept, then closed
}

function installSettings(shell: Shell, { preload, appDevTools }: { preload: string; appDevTools: boolean }) {
  shell.settings = null;
  shell.openSettings = (parent, at) => {
    const open = shell.settings;
    if (open) { open.send('settings:show', at); open.win.focus(); return; }
    const z = shell.uiZoom, saved = shell.store.settings().settingsWindow;
    const win = new BrowserWindow({ ...scaled(SIZE, z), ...(saved && onScreen(saved) ? saved : {}), useContentSize: !saved,
      minWidth: scaled(MIN, z).width, minHeight: scaled(MIN, z).height, parent: parent.win, title: 'Settings — Kulisa',
      show: false, // until its page is filled (settings:ready): shown empty, its tree and page jumped as they came
      backgroundColor: COLORS[shell.shade()].window, icon: path.join(import.meta.dirname, '..', '..', 'assets', 'icon.png'),
      webPreferences: { preload, sandbox: true, devTools: appDevTools, zoomFactor: z } });
    win.removeMenu(); // Electron's default menu: a row of nothing (window.ts)
    keepPage(win);
    let loaded = false, closing = false;
    const pending: [string, unknown[]][] = [];
    const s: SettingsWindow = {
      win, parent,
      questions: new Questions((q) => s.send('ask', q)),
      send(channel, ...data) {
        if (win.isDestroyed()) return;
        if (loaded) win.webContents.send(channel, ...data); else pending.push([channel, data]);
      },
      setZoom(z) {
        if (win.isDestroyed()) return;
        win.webContents.setZoomFactor(z);
        const min = scaled(MIN, z);
        win.setMinimumSize(min.width, min.height);
      },
      setTheme(theme, shade) { if (!win.isDestroyed()) { win.setBackgroundColor(COLORS[shade].window); s.send('theme', theme); } },
      close() {
        closing = true;
        if (win.isDestroyed()) return;
        shell.store.saveSettings({ ...shell.store.settings(), settingsWindow: win.getNormalBounds() });
        win.close();
      },
    };
    shell.settings = s;
    // The tasks' windows held, as long as it is open; a click on one brings it back to the front (on Linux a child
    // window is not kept above its parent: no transient hint, seen 2026-10-16).
    const raise = () => { if (!win.isDestroyed()) win.focus(); };
    const held = shell.windows.filter((w) => !w.win.isDestroyed());
    for (const w of held) { w.win.setEnabled(false); w.win.on('focus', raise); }
    // Its ×: the page first saves what is typed (a project's name) and then closes it (settings:close); while an agent
    // installs, it stays (AgentPage.vue). Quitting, or its page gone, it just closes.
    win.on('close', (e) => {
      if (closing || shell.quitting || !loaded) return;
      e.preventDefault();
      s.send('settings:closing');
    });
    win.webContents.on('render-process-gone', () => { closing = true; win.close(); });
    win.on('closed', () => {
      s.questions.unanswered();
      if (shell.settings === s) shell.settings = null;
      for (const w of held) if (!w.win.isDestroyed()) { w.win.removeListener('focus', raise); w.win.setEnabled(true); }
      // The keyboard back where it was; not as Kulisa quits, its windows going too (one gone meanwhile threw).
      if (!shell.quitting && !parent.win.isDestroyed() && !parent.win.webContents.isDestroyed()) { parent.focus(); parent.win.webContents.focus(); }
    });
    s.send('settings:show', at);
    // Its page stuck or gone: shown all the same, as the tasks' windows are held meanwhile.
    setTimeout(() => { if (!win.isDestroyed() && !win.isVisible()) win.show(); }, 2000);
    void win.loadFile(page('settings.html'), { query: { theme: shell.theme } }).then(() => {
      loaded = true;
      for (const [channel, data] of pending.splice(0)) win.webContents.send(channel, ...data);
    });
  };
  // Its page, done: closed. A question's answer in it.
  const of = (e: Electron.IpcMainEvent) => (shell.settings?.win.webContents === e.sender ? shell.settings : null);
  on('settings:close', (e) => of(e)?.close());
  on('settings:ready', (e) => { const s = of(e); if (s && !s.win.isVisible()) s.win.show(); });
  on('ask:answer', (e, { id, answer }) => of(e)?.questions.answer(id, answer));
  on('settings:open', (e, at) => { const w = shell.windowOf(e.sender); if (w) shell.openSettings(w, at); });
}

export type { SettingsWindow };
export { installSettings };
