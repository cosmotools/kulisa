// The window's own settings and what is drawn over it (docs/window.md): the Kulisa zoom, theme, the bar's place,
// language; the pages hidden under HTML, a question's answer; About Kulisa; the Log page's log.
import { app, dialog, shell as electronShell } from 'electron';
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
    const win = at(e)?.win, options = { defaultPath: path.join(app.getPath('downloads'), 'kulisa.log') };
    const { canceled, filePath } = await (win ? dialog.showSaveDialog(win, options) : dialog.showSaveDialog(options));
    if (canceled || !filePath) return { file: null };
    try { fs.copyFileSync(logFile(), filePath); return { file: filePath }; } catch (err) { return { error: `Not saved: ${(err as Error).message}` }; }
  });
  handle('log:show-folder', () => electronShell.showItemInFolder(logFile()));
  handle('log:report', () => electronShell.openExternal(issueUrl(environment())));
  handle('language:get', () => shell.languageInfo());
  handle('language:set', (_e, code) => shell.setLanguage(code));
  handle('theme:set', (_e, theme) => ['dark', 'light', 'system'].includes(theme) && shell.setTheme(theme));
  handle('stage:follow:set', (e, follow) => {
    if (typeof follow !== 'boolean') return;
    // Enabling an already enabled preference resumes following in the selected task.
    if (shell.stageFollow === follow) at(e)?.task?.send('stage:follow:state', follow);
    else shell.setStageFollow(follow);
  });
  handle('bar:set', (_e, bar) => ['top', 'bottom'].includes(bar) && shell.setBar(bar));
  handle('zoom:ui', (_e, dir) => shell.setUiZoom(stepZoom(shell.uiZoom, dir)));
  handle('task:ready', (e) => shell.taskUiOf(e.sender)?.view?.connect());
  handle('task:reload', (e, key) => at(e)?.tabs.find((t) => t.key === key)?.view?.reload());
  handle('task:drained', (e, sequence) => shell.taskUiOf(e.sender)?.view?.acknowledgeDrain(sequence));
  handle('shell:cover', (e, covered) => at(e)?.coverShell(covered));
  handle('shell:ask', (e, question) => at(e)?.ask(question) ?? null);
  handle('shell:dialog', (e, request) => {
    const window = at(e), task = window?.tabs.find((t) => t.key === request.task);
    if (!task?.shown()) return;
    const terminal = request.kind === 'stageTerminalSettings' ? task.stageTerminals.info().find((t) => t.id === request.terminal.id)
      : task.developmentTerminalsInfo().list.find((t) => t.id === request.terminal.id);
    if (terminal) window!.send('shell:dialog', { ...request, terminal } as typeof request);
  });
  handle('task:command', (e, { task: key, ...command }) => { const task = at(e)?.task; if (task?.key === key) task.send('task:command', command); });
  on('shell:workspace', (e, { task, viewport, ...bounds }) => {
    const window = at(e); if (!window) return;
    if (!task || task !== window.task?.key) return;
    const z = window.ui.getZoomFactor(), [width, height] = window.win.getContentSize();
    if (!viewport || Math.abs(Math.round(viewport.width * z) - width!) > 1
      || Math.abs(Math.round(viewport.height * z) - height!) > 1) return;
    window.placeWorkspace({ x: Math.round(bounds.x * z), y: Math.round(bounds.y * z), width: Math.round(bounds.width * z), height: Math.round(bounds.height * z) });
  });
  on('task:presentation', (e, value) => shell.taskUiOf(e.sender)?.present(value));
  handle('views:pictures', (e) => at(e)?.pictures());
  handle('views:hidden', (e, hidden, opts?) => { const task = shell.taskUiOf(e.sender); return task?.shown() ? task.window?.hideViews(hidden, { ...opts, task: task.key }) : undefined; });
  handle('task:view-failed', (e, failure) => { const task = shell.taskUiOf(e.sender); if (task?.key === failure.task) task.window?.failTaskView(failure); });
  on('ask:answer', (e, { id, answer }) => at(e)?.answer(id, answer)); // where it was asked
  on('settings:open', (e, a) => { const w = at(e); if (w) shell.openSettings(a, w); });
  on('settings:close', () => log.info('[settings] closed'));
}
