// The window's own settings and what is drawn over it (docs/window.md): the Kulisa zoom, theme, the bar's place,
// language; the pages hidden under HTML, a question's answer; About Kulisa.
import { app, shell as electronShell } from 'electron';
import fs from 'fs';
import path from 'path';
import { stepZoom } from '../profiles.ts';
import { handle, on } from '../ipc.ts';
import type { Ipc } from '../ipc.ts';
import pkg from '../../../package.json' with { type: 'json' };
import type { AboutFolder } from '../../shared/types.ts';

// The program's folder: run from source the checkout (not app.getAppPath(): the tests' is their folder); packaged, the
// whole of what the installer put there (on macOS the .app bundle, three up from its executable; on Windows Squirrel's
// root, where Update.exe is, over its app-<version>; elsewhere the executable's folder).
function programFolder(): string {
  if (!app.isPackaged) return path.join(import.meta.dirname, '..', '..', '..');
  const exe = app.getPath('exe');
  return process.platform === 'darwin' ? path.resolve(exe, '..', '..', '..') : process.platform === 'win32' ? path.dirname(path.dirname(exe)) : path.dirname(exe);
}

export function registerWindow(ipc: Ipc) {
  const { shell, at } = ipc;
  handle('zoom:get', () => shell.uiZoom);
  // About Kulisa: the versions (Electron's and Chromium's for a bug report and What sites see) and the folders Kulisa
  // writes in, so the exact ones are in the app, whatever the OS and its variables make of them (docs/guide.md, Where
  // Kulisa keeps things).
  const folders = (): Record<AboutFolder, string> => ({ data: app.getPath('userData'), projects: shell.projectsHome, program: programFolder() });
  // package.json's version: run from source, app.getVersion() is Electron's own.
  handle('about:get', () => ({ version: pkg.version, electron: process.versions.electron, chrome: process.versions.chrome,
    folders: (Object.entries(folders()) as [AboutFolder, string][]).map(([id, p]) => ({ id, path: p, exists: fs.existsSync(p) })) }));
  handle('about:show-folder', (_e, id) => { const p = folders()[id]; return p && fs.existsSync(p) ? electronShell.openPath(p) : undefined; });
  handle('language:get', () => shell.languageInfo());
  handle('language:set', (_e, code) => shell.setLanguage(code));
  handle('theme:set', (_e, theme) => ['dark', 'light', 'system'].includes(theme) && shell.setTheme(theme));
  handle('bar:set', (_e, bar) => ['top', 'bottom'].includes(bar) && shell.setBar(bar));
  handle('zoom:ui', (_e, dir) => shell.setUiZoom(stepZoom(shell.uiZoom, dir)));
  handle('views:hidden', (e, hidden, opts?) => at(e)?.hideViews(hidden, opts));
  on('ask:answer', (e, { id, answer }) => at(e)?.answer(id, answer));
}
