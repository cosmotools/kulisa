// The window's own settings and what is drawn over it (docs/window.md): the Kulisa zoom, theme, the bar's place,
// language; the pages hidden under HTML, a question's answer; About Kulisa; the Log page's log.
import { app, BrowserWindow, dialog, shell as electronShell } from 'electron';
import fs from 'fs';
import path from 'path';
import { stepZoom } from '../../browser/main/index.ts';
import { handle, on } from '../ipc.ts';
import { LOG_MAX, environment, issueUrl, log, logFile, readLog } from '../log.ts';
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
  handle('window:focused', (e) => at(e)?.win.isFocused() ?? false);
  handle('zoom:get', () => shell.uiZoom);
  // About Kulisa: the versions (Electron's and Chromium's for a bug report and What sites see) and the folders Kulisa
  // writes in, so the exact ones are in the app, whatever the OS and its variables make of them (docs/guide.md, Where
  // Kulisa keeps things).
  const folders = (): Record<AboutFolder, string> => ({ data: app.getPath('userData'), projects: shell.projectsHome, program: programFolder() });
  // package.json's version: run from source, app.getVersion() is Electron's own.
  handle('about:get', () => ({ version: pkg.version, electron: process.versions.electron, chrome: process.versions.chrome,
    folders: (Object.entries(folders()) as [AboutFolder, string][]).map(([id, p]) => ({ id, path: p, exists: fs.existsSync(p) })) }));
  handle('about:show-folder', (_e, id) => { const p = folders()[id]; return p && fs.existsSync(p) ? electronShell.openPath(p) : undefined; });
  // The Log page (window.md, The log): the file whole, then followed (log.ts); saved where the human says, to attach
  // anywhere; its folder shown, the file picked out; a new issue on GitHub with the environment filled in.
  handle('log:get', (e) => {
    let old: Date | undefined;
    try { old = fs.statSync(logFile().replace(/\.log$/, '.old.log')).mtime; } catch { /* none yet */ }
    return { ...readLog(e.sender), max: LOG_MAX, old: old?.toISOString() ?? null };
  });
  handle('log:save', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender), options = { defaultPath: path.join(app.getPath('downloads'), 'kulisa.log') };
    const { canceled, filePath } = await (win ? dialog.showSaveDialog(win, options) : dialog.showSaveDialog(options));
    if (canceled || !filePath) return { file: null };
    try { fs.copyFileSync(logFile(), filePath); return { file: filePath }; } catch (err) { return { error: `Not saved: ${(err as Error).message}` }; }
  });
  handle('log:show-folder', () => electronShell.showItemInFolder(logFile()));
  handle('log:report', () => electronShell.openExternal(issueUrl(environment())));
  handle('language:get', () => shell.languageInfo());
  handle('language:set', (_e, code) => shell.setLanguage(code));
  handle('theme:set', (_e, theme) => ['dark', 'light', 'system'].includes(theme) && shell.setTheme(theme));
  handle('stage:follow:set', (_e, follow) => { if (typeof follow === 'boolean') shell.setStageFollow(follow); });
  handle('bar:set', (_e, bar) => ['top', 'bottom'].includes(bar) && shell.setBar(bar));
  handle('zoom:ui', (_e, dir) => shell.setUiZoom(stepZoom(shell.uiZoom, dir)));
  handle('views:hidden', (e, hidden, opts?) => at(e)?.hideViews(hidden, opts));
  on('ask:answer', (e, { id, answer }) => at(e)?.answer(id, answer)); // where it was asked
  on('settings:open', (e, a) => { const w = at(e); if (w) shell.openSettings(a, w); });
  on('settings:close', () => log.info('[settings] closed'));
}
