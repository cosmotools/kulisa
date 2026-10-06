// node-pty for Electron, after npm install.
// - macOS and Windows: node-pty ships prebuilt N-API binaries, which Electron loads as they are; nothing to compile
//   (and no Xcode or Visual Studio needed). node-pty 1.1.0's package has macOS's spawn-helper without the executable
//   bit, so every terminal fails with "posix_spawnp failed"; set it.
// - Linux (no prebuilds): build node-pty for Electron.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const prebuilds = path.join(__dirname, '..', 'node_modules', 'node-pty', 'prebuilds', `${process.platform}-${process.arch}`);
if (fs.existsSync(prebuilds)) {
  const helper = path.join(prebuilds, 'spawn-helper');
  if (fs.existsSync(helper)) fs.chmodSync(helper, 0o755);
} else {
  execFileSync(process.execPath, [require.resolve('@electron/rebuild/lib/cli.js'), '-f', '-w', 'node-pty'], { stdio: 'inherit' });
}
