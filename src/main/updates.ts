// Kulisa's releases updating themselves, Forge's way: Squirrel's events, update.electronjs.org. docs/window.md,
// "The app icon, installers and updates".
import electron from 'electron';
import squirrelStarted from 'electron-squirrel-startup';
import { UpdateSourceType, updateElectronApp } from 'update-electron-app';

const { app } = electron;

// Squirrel.Windows starts the app to install, update or remove it: it makes or removes the shortcuts and quits
// (Forge's Squirrel.Windows maker), and Kulisa must not start then.
export const squirrelEvent = squirrelStarted;

export function updates() {
  // Squirrel's shortcuts carry this id; another one and Windows does not pin Kulisa to the taskbar
  // (Electron's api/auto-updater.md).
  if (app.isPackaged && process.platform === 'win32') app.setAppUserModelId('com.squirrel.kulisa.kulisa');
  // Squirrel holds a lock on the app while it runs first, and a check fails then (api/auto-updater.md).
  if (process.argv.includes('--squirrel-firstrun')) return;
  // No dialog of the module's: Kulisa asks in its own, and its Restart (quitAndInstall) closes the windows before
  // before-quit, where session cookies and tabs are saved. The update applies at the next start by itself.
  // Every 6 hours, not its 10 minutes: Kulisa stays open for days. Nothing when not packaged, nor on Linux.
  // The repository named: the module otherwise reads it from the package.json next to the app's entry, which a
  // Kulisa started on its entry file (the tests' second one) has not. Its asserts throw: never in the way of starting.
  const log = (...a: unknown[]) => console.log('[kulisa] update:', ...a);
  try {
    updateElectronApp({ updateSource: { type: UpdateSourceType.ElectronPublicUpdateService, repo: 'cosmotools/kulisa' },
      updateInterval: '6 hours', notifyUser: false, logger: { log, info: log, warn: log, error: log } });
  } catch (e) { log(e); }
}
