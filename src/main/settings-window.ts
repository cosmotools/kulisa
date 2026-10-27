// Settings in a window of its own (docs/window.md, Settings), as a desktop app's: one for the whole app, with the OS's
// title bar, at a page. Not modal: the tasks' windows go on taking input beside it, as macOS
// apps', VS Code's and Chrome's settings do; on macOS a window could not be held without Electron's half-black sheet
// over it. Its page: settings.html (components/Settings.tsx).
import { BrowserWindow } from 'electron';
import path from 'path';
import { on } from './ipc.ts';
import { page } from './pages.ts';
import { log } from './log.ts';
import { COLORS, Questions, keepPage, onScreen } from './window.ts';
import type { Shell } from './shell.ts';
import type { Arg, Events } from '../shared/ipc.ts';
import type { Question } from '../shared/types.ts';

// Its size at first, and the smallest one whose tree and page still fit, in CSS pixels: times the Kulisa zoom.
const SIZE = { width: 1000, height: 680 }, MIN = { width: 640, height: 420 };
const scaled = (s: { width: number; height: number }, z: number) => ({ width: Math.round(s.width * z), height: Math.round(s.height * z) });

interface SettingsWindow {
  win: BrowserWindow;
  questions: Questions; // what is done in it is asked in it (app.ts, asker)
  ask(q: Question): Promise<string | null>;
  answer(id: number, answer: string): void;
  send<C extends keyof Events>(channel: C, ...data: Arg<Events[C]>): void;
  setZoom(z: number): void;
  setTheme(theme: string, shade: 'dark' | 'light'): void;
  close(): void; // its page has saved what was typed: where it is kept, then closed
}

function installSettings(shell: Shell, { preload, appDevTools }: { preload: string; appDevTools: boolean }) {
  shell.settings = null;
  shell.openSettings = (at) => {
    const open = shell.settings;
    log.info(`[settings] ${open ? 'shown' : 'opened'} at ${at.section}${at.id ? ` ${at.id}` : ''}`);
    if (open) { open.send('settings:show', at); open.win.focus(); return; }
    const z = shell.uiZoom, saved = shell.store.settings().settingsWindow;
    const win = new BrowserWindow({ ...scaled(SIZE, z), ...(saved && onScreen(saved) ? saved : {}), useContentSize: !saved,
      // Not a child of a tasks' window: on macOS a child stays above its parent, which then never came in front of it.
      minWidth: scaled(MIN, z).width, minHeight: scaled(MIN, z).height, title: 'Settings — Kulisa',
      // Never full screen itself: opened from a full-screen tasks' window, macOS would make it a full-screen window in a
      // Space of its own; not full-screenable, it opens over that window, in its Space, as Mac apps' settings do.
      fullscreenable: false,
      show: false, // until its page is filled (settings:ready): shown empty, its tree and page jumped as they came
      backgroundColor: COLORS[shell.shade()].window, icon: path.join(import.meta.dirname, '..', '..', 'assets', 'icon.png'),
      webPreferences: { preload, sandbox: true, devTools: appDevTools, zoomFactor: z } });
    win.removeMenu(); // Electron's default menu: a row of nothing (window.ts)
    keepPage(win);
    let loaded = false, closing = false;
    const pending: [string, unknown[]][] = [];
    const s: SettingsWindow = {
      win,
      questions: new Questions((q) => s.send('ask', q)),
      ask: (q) => s.questions.ask(q),
      answer: (id, answer) => s.questions.answer(id, answer),
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
    // Its ×: the page first saves what is typed (a project's name) and then closes it (settings:close); while an agent
    // installs, it stays (components/agents.ts). Quitting, or its page gone, it just closes.
    win.on('close', (e) => {
      if (closing || shell.quitting || !loaded) return;
      e.preventDefault();
      s.send('settings:closing');
    });
    win.webContents.on('render-process-gone', () => { closing = true; win.close(); });
    win.on('closed', () => {
      log.info('[settings] closed');
      s.questions.unanswered();
      if (shell.settings === s) shell.settings = null;
      // The keyboard to the tasks' window last in front, its own page; not as Kulisa quits, its windows going too (one gone
      // meanwhile threw). macOS makes that window key a moment later and then gives the keyboard back to the view that had
      // it there (a profile's page), over ours: given again once it is key ('focus' comes after).
      const w = shell.front();
      if (!shell.quitting && w && !w.win.webContents.isDestroyed()) {
        const page = () => { if (!w.win.webContents.isDestroyed()) w.win.webContents.focus(); };
        const key = w.win.isFocused();
        w.focus(); page();
        if (!key) { w.win.once('focus', page); setTimeout(() => { if (!w.win.isDestroyed()) w.win.removeListener('focus', page); }, 1000); }
      }
    });
    s.send('settings:show', at);
    // Its page stuck or gone: shown all the same.
    setTimeout(() => { if (!win.isDestroyed() && !win.isVisible()) win.show(); }, 2000);
    void win.loadFile(page('settings.html'), { query: { theme: shell.theme } }).then(() => {
      loaded = true;
      for (const [channel, data] of pending.splice(0)) win.webContents.send(channel, ...data);
    });
  };
  // Its page, done: closed.
  const of = (e: Electron.IpcMainEvent) => (shell.settings?.win.webContents === e.sender ? shell.settings : null);
  on('settings:close', (e) => of(e)?.close());
  on('settings:ready', (e) => { const s = of(e); if (s && !s.win.isVisible()) s.win.show(); });
  on('settings:open', (e, at) => { if (shell.windowOf(e.sender)) shell.openSettings(at); });
}

export type { SettingsWindow };
export { installSettings };
