// Kulisa's releases updating themselves, Forge's way: Squirrel's events, update.electronjs.org. docs/window.md,
// "The app icon, installers and updates".
import electron from 'electron';
import path from 'path';
import squirrelStarted from 'electron-squirrel-startup';
import { UpdateSourceType, updateElectronApp } from 'update-electron-app';
import { watchInstalled } from './installed.ts';
import { stillWorking } from './open-tasks.ts';
import type { Shell } from './shell.ts';

const { app, autoUpdater } = electron;

// Squirrel.Windows starts the app to install, update or remove it: it makes or removes the shortcuts and quits
// (Forge's Squirrel.Windows maker), and Kulisa must not start then.
export const squirrelEvent = squirrelStarted;

export function updates() {
  // Squirrel's shortcuts carry this id; another one and Windows does not pin Kulisa to the taskbar
  // (Electron's api/auto-updater.md).
  if (app.isPackaged && process.platform === 'win32') app.setAppUserModelId('com.squirrel.kulisa.kulisa');
  // Squirrel holds a lock on the app while it runs first, and a check fails then (api/auto-updater.md).
  if (process.argv.includes('--squirrel-firstrun')) return;
  // No dialog of the module's: Kulisa asks in its own (updateNotices). Every 6 hours, not its 10 minutes: Kulisa stays open for days. Nothing when not packaged, nor on Linux.
  // The repository named: the module otherwise reads it from the package.json next to the app's entry, which a
  // Kulisa started on its entry file (the tests' second one) has not. Its asserts throw: never in the way of starting.
  const log = (...a: unknown[]) => console.log('[kulisa] update:', ...a);
  try {
    updateElectronApp({ updateSource: { type: UpdateSourceType.ElectronPublicUpdateService, repo: 'cosmotools/kulisa' },
      updateInterval: '6 hours', notifyUser: false, logger: { log, info: log, warn: log, error: log } });
  } catch (e) { log(e); }
}

// A new version ready while Kulisa runs: downloaded by the updater (Windows, macOS), or installed on disk by the
// package manager (Linux: apt replaces the files under the running Kulisa, which goes on from the old ones; seen on
// the app archive, renamed over as dpkg and rpm do: installed.ts). Asked once per version, in the tasks' window in
// front, shown when hidden (macOS): Restart quits as ☰ → Exit does (everything saved, the windows and tasks back:
// shell.restart) into the new version; Later leaves it to the next start, which is the new version anyway.
export function updateNotices(shell: Shell, installed?: string) {
  const notice = async (version: string, apply?: () => void) => {
    const w = shell.front();
    if (w && !w.win.isVisible()) w.focus();
    const tasks = [...shell.open.values()].flatMap((p) => [...p.tasks.values()]).filter((t) => t.window);
    const answer = await shell.askWhich({ message: `Kulisa ${version} is ready`, ok: 'Restart', cancel: 'Later',
      detail: `${stillWorking(tasks, 'restarting')}Restart to use it: the windows, their tasks and conversations come back. Later: the next start is ${version}.` }, w);
    if (answer === 'ok') await shell.restart(apply);
  };
  autoUpdater.on('update-downloaded', (_e, _notes, name) => void notice(name.replace(/^v/, ''), () => autoUpdater.quitAndInstall()));
  const asar = installed ?? (app.isPackaged && process.platform === 'linux' ? path.join(process.resourcesPath, 'app.asar') : null);
  if (asar) watchInstalled(asar, app.getVersion(), (version) => void notice(version));
}
