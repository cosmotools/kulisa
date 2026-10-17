// The installers' configuration (forge.config.ts): what a packaged Kulisa needs outside its archive.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import forge from '../../forge.config.ts';

// node-pty starts a shell through its spawn-helper, run from app.asar.unpacked: inside the archive, a packaged
// Kulisa's terminal failed on macOS (posix_spawnp failed; 2026-10-06, and again 2026-10-16).
test("node-pty's spawn-helper is kept outside the archive, on both of macOS's architectures", () => {
  const { unpack } = forge.packagerConfig.asar as { unpack: string };
  for (const arch of ['darwin-arm64', 'darwin-x64']) assert.ok(path.matchesGlob(`node_modules/node-pty/prebuilds/${arch}/spawn-helper`, unpack), arch);
  assert.ok(!path.matchesGlob('node_modules/node-pty/lib/index.js', unpack), 'nothing else');
});

// The id macOS keeps the app's preferences, caches and permissions by: Kulisa's own, not Packager's default
// (com.electron.kulisa, the first builds').
test("macOS's id of the app is Kulisa's own", () => {
  assert.equal(forge.packagerConfig.appBundleId, 'app.kulisa');
});
