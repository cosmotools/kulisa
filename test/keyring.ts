// The keyring's key, made once before the groups run side by side (start.ts; docs/testing.md, On Linux).
// Chromium's OSCrypt looks the key up in the keyring and, finding none, makes one and stores it: two Electrons starting
// on a fresh keyring each make their own, the keyring keeps the last, and the group whose key it is not cannot read
// the session cookies it saved once it restarts ("Signed out").
import { app, safeStorage } from 'electron';

void app.whenReady().then(() => {
  if (safeStorage.isEncryptionAvailable()) safeStorage.encryptString('key');
  app.exit(0);
});
