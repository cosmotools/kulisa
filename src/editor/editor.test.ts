// Autosave, recovery and external writers; plain Node (README.md).
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EditorWorkspace } from './main/index.ts';
import { MAX_FILE_BYTES, type EditorSnapshot } from './ipc.ts';
import { refused } from '../shared/result.ts';
import { writeFileAtomic } from '../main/files.ts';

function setup(t: TestContext, initial: string | Buffer = 'const value = 1;\n') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kulisa-editor-'));
  const folder = path.join(root, 'project'), directory = path.join(root, 'data', 'editor');
  fs.mkdirSync(folder); const file = path.join(folder, 'code.ts'); fs.writeFileSync(file, initial);
  const updates: EditorSnapshot[] = [];
  const options = { roots: () => [folder], directory, changed: (state: EditorSnapshot) => { updates.push(state); }, activity() {} };
  const editor = new EditorWorkspace(options);
  t.after(async () => { await editor.dispose(); fs.rmSync(root, { recursive: true, force: true }); });
  return { editor, options, file, root, folder, directory, updates };
}

test('autosave waits, checkpoints the draft first, and preserves BOM, CRLF and executable mode', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { editor, file, directory, updates } = setup(t, '\uFEFFone\r\ntwo\r\n');
  if (process.platform !== 'win32') fs.chmodSync(file, 0o755);
  assert.ok(!refused(await editor.execute({ type: 'open', path: file })));
  await editor.execute({ type: 'edit', path: file, text: 'one\r\nchanged\r\n' });
  assert.equal(fs.readFileSync(file, 'utf8'), '\uFEFFone\r\ntwo\r\n');
  assert.equal(fs.readdirSync(directory).length, 2);
  t.mock.timers.tick(600);
  await editor.execute({ type: 'list' });
  assert.equal(fs.readFileSync(file, 'utf8'), '\uFEFFone\r\nchanged\r\n');
  assert.equal(fs.readdirSync(directory).length, 1);
  assert.equal(updates.at(-1)?.document?.dirty, false);
  if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o755);
});

test('a concurrent writer pauses autosave and resolution checks the version shown in the comparison', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { editor, file } = setup(t);
  await editor.execute({ type: 'open', path: file });
  await editor.execute({ type: 'edit', path: file, text: 'my changes\n' });
  fs.writeFileSync(file, 'agent changes\n');
  t.mock.timers.tick(600);
  const state = await editor.execute({ type: 'refresh', path: file });
  assert.ok(!refused(state)); assert.equal(state.document?.conflict, true);
  assert.equal(state.document?.text, 'my changes\n'); assert.equal(state.document?.disk?.text, 'agent changes\n');
  fs.writeFileSync(file, 'newer agent changes\n');
  assert.ok(refused(await editor.execute({ type: 'resolve', path: file, choice: 'mine', revision: state.document.disk.revision })));
  assert.equal(fs.readFileSync(file, 'utf8'), 'newer agent changes\n');
  const latest = await editor.execute({ type: 'refresh', path: file }); assert.ok(!refused(latest));
  await editor.execute({ type: 'resolve', path: file, choice: 'mine', revision: latest.document!.disk!.revision });
  t.mock.timers.tick(600); await editor.execute({ type: 'list' });
  assert.equal(fs.readFileSync(file, 'utf8'), 'my changes\n');
});

test('clean files follow disk; a removed dirty file stays recoverable without recreating it', async (t) => {
  const { editor, file, options } = setup(t);
  await editor.execute({ type: 'open', path: file });
  fs.writeFileSync(file, 'new disk text');
  const reloaded = await editor.execute({ type: 'refresh', path: file });
  assert.ok(!refused(reloaded)); assert.equal(reloaded.document?.text, 'new disk text');
  await editor.execute({ type: 'edit', path: file, text: 'recovered text' });
  fs.unlinkSync(file);
  await editor.dispose();
  assert.equal(fs.existsSync(file), false);
  const restored = new EditorWorkspace(options);
  try {
    const result = await restored.execute({ type: 'list' });
    assert.ok(!refused(result)); assert.equal(result.document?.text, 'recovered text'); assert.ok(result.document?.error);
    assert.ok(refused(await restored.execute({ type: 'close', path: file })));
    assert.ok(!refused(await restored.execute({ type: 'close', path: file, discard: true })));
  } finally { await restored.dispose(); }
});

test('a crash draft is recovered without overwriting subsequent agent work; choosing disk discards only that draft', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { editor, file, options, directory } = setup(t);
  await editor.execute({ type: 'open', path: file });
  await editor.execute({ type: 'edit', path: file, text: 'unfinished work' });
  // A second instance reads only persisted data, as a replacement process would after a crash.
  fs.writeFileSync(file, 'agent after crash');
  const restored = new EditorWorkspace(options);
  try {
    const result = await restored.execute({ type: 'list' });
    assert.ok(!refused(result)); assert.equal(result.document?.text, 'unfinished work'); assert.equal(result.document?.conflict, true);
    const disk = await restored.execute({ type: 'resolve', path: file, choice: 'disk', revision: result.document.disk!.revision });
    assert.ok(!refused(disk)); assert.equal(disk.document?.text, 'agent after crash');
    assert.equal(fs.readdirSync(directory).length, 1);
  } finally { await restored.dispose(); }
});

test('unsupported files use the external fallback and roots constrain reads, writes and restored drafts', async (t) => {
  const { editor, file, root, folder } = setup(t, Buffer.from([0, 1, 2]));
  const binary = await editor.execute({ type: 'open', path: file }); assert.ok(!refused(binary)); assert.equal(binary.external, fs.realpathSync.native(file));
  fs.writeFileSync(file, Buffer.from([0xff]));
  const encoding = await editor.execute({ type: 'open', path: file }); assert.ok(!refused(encoding)); assert.match(encoding.notice!, /encoding/);
  fs.writeFileSync(file, Buffer.alloc(MAX_FILE_BYTES + 1, 65));
  const large = await editor.execute({ type: 'open', path: file }); assert.ok(!refused(large)); assert.match(large.notice!, /1 MB/);
  const outside = path.join(root, 'outside.txt'); fs.writeFileSync(outside, 'outside');
  assert.ok(refused(await editor.execute({ type: 'open', path: outside })));
  fs.writeFileSync(file, 'plain text');
  await editor.execute({ type: 'open', path: file }); await editor.execute({ type: 'edit', path: file, text: 'my text' });
  // Replacing a task root with a symlink must not redirect autosave outside it.
  if (process.platform !== 'win32') {
    const link = path.join(folder, 'linked.txt'); fs.symlinkSync(outside, link);
    assert.ok(refused(await editor.execute({ type: 'open', path: link })));
    fs.unlinkSync(file); fs.symlinkSync(outside, file);
    await editor.dispose(); assert.equal(fs.readFileSync(outside, 'utf8'), 'outside');
  }
});

test('Retry saves a retained read-only draft after access is restored', { skip: process.platform === 'win32' }, async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { editor, file } = setup(t, 'original');
  await editor.execute({ type: 'open', path: file }); fs.chmodSync(file, 0o444);
  await editor.execute({ type: 'edit', path: file, text: 'retry me' });
  t.mock.timers.tick(600);
  const failed = await editor.execute({ type: 'refresh', path: file }); assert.ok(!refused(failed));
  assert.match(failed.document!.error!, /read-only/); assert.equal(fs.readFileSync(file, 'utf8'), 'original');
  fs.chmodSync(file, 0o644);
  const retried = await editor.execute({ type: 'retry', path: file }); assert.ok(!refused(retried));
  assert.equal(retried.document?.dirty, false); assert.equal(fs.readFileSync(file, 'utf8'), 'retry me');
});

test('a conflict clears when the external writer restores the base version', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { editor, file } = setup(t, 'original');
  await editor.execute({ type: 'open', path: file }); await editor.execute({ type: 'edit', path: file, text: 'mine' });
  fs.writeFileSync(file, 'theirs');
  await editor.execute({ type: 'refresh', path: file }); fs.writeFileSync(file, 'original');
  const resumed = await editor.execute({ type: 'refresh', path: file }); assert.ok(!refused(resumed)); assert.equal(resumed.document?.conflict, false);
  t.mock.timers.tick(600); await editor.execute({ type: 'list' }); assert.equal(fs.readFileSync(file, 'utf8'), 'mine');
});

test('atomic saves do not overwrite a pre-existing temporary file or follow its symlink', (t) => {
  const { file, root } = setup(t, 'original'), temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, 'human-owned');
  writeFileAtomic(file, 'saved');
  assert.equal(fs.readFileSync(temporary, 'utf8'), 'human-owned');
  if (process.platform !== 'win32') {
    fs.unlinkSync(temporary);
    const outside = path.join(root, 'outside.txt'); fs.writeFileSync(outside, 'untouched');
    fs.symlinkSync(outside, temporary); writeFileAtomic(file, 'saved again');
    assert.equal(fs.readFileSync(outside, 'utf8'), 'untouched');
  }
  assert.equal(fs.readdirSync(path.dirname(file)).some((name) => name.startsWith('.kulisa-')), false);
  const directory = path.join(root, 'directory'); fs.mkdirSync(directory);
  assert.throws(() => writeFileAtomic(directory, 'cannot replace a directory'));
  assert.equal(fs.readdirSync(root).some((name) => name.startsWith('.kulisa-')), false);
});
