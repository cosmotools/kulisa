// npm install's postinstall: node-pty built for Electron (README, Run). Not on macOS: there node-pty's own prebuilt
// binary is loaded (N-API, for any Electron; the packaged build does the same: forge.config.ts), and building it needs a
// working compiler a Mac may not have (the author's Command Line Tools, 2026-10-16: npm install failed on it).
import { spawnSync } from 'child_process';

if (process.platform !== 'darwin') {
  const r = spawnSync('electron-rebuild', ['-f', '-w', 'node-pty'], { stdio: 'inherit', shell: process.platform === 'win32' });
  process.exit(r.status ?? 1);
}
