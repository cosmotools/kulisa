// The installers' configuration (forge.config.ts): what a packaged Kulisa needs outside its archive.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import forge from '../../forge.config.ts';

// node-pty starts a shell through its spawn-helper, run from app.asar.unpacked: inside the archive, a packaged
// Kulisa's terminal failed on macOS (posix_spawnp failed; 2026-10-06, and again 2026-10-16).
test("node-pty's spawn-helper is kept outside the archive, on both of macOS's architectures", () => {
  const { unpack } = forge.packagerConfig.asar as { unpack: string };
  for (const arch of ['darwin-arm64', 'darwin-x64']) assert.ok(path.matchesGlob(`node_modules/node-pty/prebuilds/${arch}/spawn-helper`, unpack), arch);
  assert.ok(!path.matchesGlob('node_modules/node-pty/lib/index.js', unpack), 'nothing else');
});

// The manifest of Claude Code's plugin names a version of its own (its format's): package.json's, written by npm version
// (scripts/version.ts), not a number of its own gone stale (0.1.0 until 2026-10-18).
test("Claude Code's plugin manifest carries Kulisa's version", () => {
  const read = (f: string) => JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '../..', f), 'utf8')).version;
  assert.equal(read('src/agent/claude-plugin/.claude-plugin/plugin.json'), read('package.json'));
});

// The id macOS keeps the app's preferences, caches and permissions by: Kulisa's own, not Packager's default
// (com.electron.kulisa, the first builds').
test("macOS's id of the app is Kulisa's own", () => {
  assert.equal(forge.packagerConfig.appBundleId, 'app.kulisa');
});
