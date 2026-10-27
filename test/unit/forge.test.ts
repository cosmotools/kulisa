// The installers' configuration (forge.config.ts): what a packaged Kulisa needs outside its archive.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import forge, { prunePrebuilds } from '../../forge.config.ts';

// node-pty starts a shell through its spawn-helper, run from app.asar.unpacked: inside the archive, a packaged
// Kulisa's terminal fails on macOS (posix_spawnp failed).
test("node-pty's spawn-helper is kept outside the archive, on both of macOS's architectures", () => {
  const { unpack } = forge.packagerConfig.asar as { unpack: string };
  for (const arch of ['darwin-arm64', 'darwin-x64']) assert.ok(path.matchesGlob(`node_modules/node-pty/prebuilds/${arch}/spawn-helper`, unpack), arch);
  assert.ok(!path.matchesGlob('node_modules/node-pty/lib/index.js', unpack), 'nothing else');
});

// The manifest of Claude Code's plugin names a version of its own (its format's): package.json's, written by npm version
// (scripts/version.ts), not a number of its own that goes stale.
test("Claude Code's plugin manifest carries Kulisa's version", () => {
  const read = (f: string) => JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '../..', f), 'utf8')).version;
  assert.equal(read('src/agent/claude-plugin/.claude-plugin/plugin.json'), read('package.json'));
});

// The id macOS keeps the app's preferences, caches and permissions by: Kulisa's own, not Packager's default
// (com.electron.kulisa, the first builds').
test("macOS's id of the app is Kulisa's own", () => {
  assert.equal(forge.packagerConfig.appBundleId, 'app.kulisa');
});

// node-pty's prebuilt binaries for the other platforms (58 MB, most of them Windows's) are left out of each OS's
// package: it loads only its own platform and architecture's, on Linux the one built at install.
test("node-pty's prebuilt binaries of the other platforms are left out of the package", () => {
  assert.ok(forge.hooks?.packageAfterCopy, 'the hook is set');
  const all = ['darwin-arm64', 'darwin-x64', 'win32-arm64', 'win32-x64'];
  const build = (): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kulisa-forge-'));
    for (const d of all) fs.mkdirSync(path.join(dir, 'node_modules/node-pty/prebuilds', d), { recursive: true });
    return dir;
  };
  const left = (dir: string) => fs.readdirSync(path.join(dir, 'node_modules/node-pty/prebuilds'));
  let dir = build();
  prunePrebuilds(dir, 'darwin', 'arm64');
  assert.deepEqual(left(dir), ['darwin-arm64']);
  fs.rmSync(dir, { recursive: true });
  dir = build();
  prunePrebuilds(dir, 'linux', 'x64');
  assert.deepEqual(left(dir), [], 'Linux loads the one built at install');
  fs.rmSync(dir, { recursive: true });
  prunePrebuilds(dir, 'linux', 'x64'); // no prebuilds folder at all: nothing to do
});

// macOS's and Windows's file systems ignore case: two files whose names differ only in it are one there, and an import
// without its extension (./Thumbnail) finds either of two modules named so (a component, the page thumbnail.ts): the
// build there fails while Linux's passes.
test('no two files of the repository are one on a file system that ignores case, nor two modules one import', () => {
  const files = execFileSync('git', ['ls-files'], { cwd: path.join(import.meta.dirname, '../..'), encoding: 'utf8' }).split('\n').filter(Boolean);
  const seen = new Map<string, string>(), twins: string[] = [];
  for (const f of files) for (const key of [f.toLowerCase(), /\.[cm]?[jt]sx?$/.test(f) && `module ${f.replace(/\.[^./]+$/, '').toLowerCase()}`]) {
    if (!key) continue;
    const other = seen.get(key);
    if (other) twins.push(`${other} ~ ${f}`); else seen.set(key, f);
  }
  assert.deepEqual(twins, []);
});
