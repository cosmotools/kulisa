// npm install's postinstall: node-pty built for Electron (README, Run). Not on macOS: there node-pty's own prebuilt
// binary is loaded (N-API, for any Electron; the packaged build does the same: forge.config.ts), and building it needs a
// working compiler a Mac may not have (the author's Command Line Tools, 2026-10-16: npm install failed on it).
// Its prebuilt spawn-helper (the program it starts a shell with) comes without its exec bit in node-pty 1.1.0's
// package: made executable, else every terminal fails (posix_spawnp failed: GitHub's macOS runner, 2026-10-16), and
// the packaged app (which takes it from node_modules) the same.
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

if (process.platform === 'darwin') {
  const prebuilds = path.join(import.meta.dirname, '..', 'node_modules', 'node-pty', 'prebuilds');
  for (const dir of fs.readdirSync(prebuilds).filter((d) => d.startsWith('darwin-'))) {
    const helper = path.join(prebuilds, dir, 'spawn-helper');
    if (fs.existsSync(helper)) fs.chmodSync(helper, 0o755);
  }
} else {
  const r = spawnSync('electron-rebuild', ['-f', '-w', 'node-pty'], { stdio: 'inherit', shell: process.platform === 'win32' });
  process.exit(r.status ?? 1);
}
