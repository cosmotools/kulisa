// npm install's postinstall: node-pty built for Electron (README, Run), on Linux only. macOS and Windows load
// node-pty's own prebuilt binary (N-API, for any Electron; the packaged build does the same: forge.config.ts), and
// building it needs a compiler those may not have (a Mac's Command Line Tools; Visual Studio's C++ tools and Python).
// Its prebuilt spawn-helper (the program it starts a shell with on macOS) may come without its exec bit in node-pty's
// package: made executable, else every terminal fails (posix_spawnp failed), and
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
} else if (process.platform === 'linux') {
  const r = spawnSync('electron-rebuild', ['-f', '-w', 'node-pty'], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
