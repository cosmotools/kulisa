// The keyring's key, made once before the groups run side by side (start.ts; docs/testing.md, On Linux).
// Chromium's OSCrypt looks the key up in the keyring and, finding none, makes one and stores it: two Electrons starting
// on a fresh keyring (GitHub's runner) each made their own, the keyring kept the last, and the group whose key it was
// not could not read the session cookies it had saved once it restarted (2026-10-18: "Signed out", one run in three).
import { app, safeStorage } from 'electron';

void app.whenReady().then(() => {
  if (safeStorage.isEncryptionAvailable()) safeStorage.encryptString('key');
  app.exit(0);
});
