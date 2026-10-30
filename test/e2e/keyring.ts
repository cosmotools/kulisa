// The keyring's key for safeStorage, made once before the run's Kulisas start (global-setup.ts, Linux): several starting
// at once on a keyring without it would each make their own, and one's restart would not read what it saved
// (docs/testing.md, Speed). Run by Electron under the test Kulisas' own name (Electron's: no package.json names it).
import { app, safeStorage } from 'electron';

void app.whenReady().then(() => {
  if (safeStorage.isEncryptionAvailable()) safeStorage.encryptString('kulisa tests');
  app.quit();
});
