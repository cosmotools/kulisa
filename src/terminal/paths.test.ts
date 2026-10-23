// The paths a terminal's line names (renderer/paths.ts), in an xterm's buffer with no window (@xterm/headless): what
// the window is asked about, and the cells of each link.
import { test } from 'node:test';
import assert from 'assert/strict';
import headless from '@xterm/headless';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import type { Terminal } from '@xterm/xterm';
import { fileOf, pathsAt } from './renderer/paths.ts';

// The paths on the last row written (its first when wrapped), each with its text and where it starts and ends.
async function paths(line: string, cols = 80) {
  const term = new headless.Terminal({ cols, rows: 5, allowProposedApi: true });
  term.loadAddon(new Unicode11Addon()); // the widths the window's xterms have (renderer/index.ts)
  term.unicode.activeVersion = '11';
  await new Promise<void>((r) => term.write(`${line}\r\n`, r));
  const y = term.buffer.active.cursorY - Math.ceil(line.length / cols) + 1;
  return pathsAt(term as unknown as Terminal, y).map((p) => [p.path, p.text, `${p.range.start.x},${p.range.start.y}-${p.range.end.x},${p.range.end.y}`]);
}

test('paths in a line', async () => {
  assert.deepEqual(await paths('see `src/main/tasks.ts:412`. or ~/notes.md:3:7 and README.md.'), [
    ['src/main/tasks.ts', 'src/main/tasks.ts:412', '6,1-26,1'], ['~/notes.md', '~/notes.md:3:7', '33,1-46,1'], ['README.md', 'README.md', '52,1-60,1']]);
  assert.deepEqual(await paths('C:\\Users\\me\\a.txt:2 \\\\server\\share\\x'), [
    ['C:\\Users\\me\\a.txt', 'C:\\Users\\me\\a.txt:2', '1,1-19,1'], ['\\\\server\\share\\x', '\\\\server\\share\\x', '21,1-36,1']]);
  assert.deepEqual(await paths('"/tmp/a b/shot.jpg" it\'s'), [
    ['/tmp/a b/shot.jpg', '/tmp/a b/shot.jpg', '2,1-18,1'], ['/tmp/a', '/tmp/a', '2,1-7,1'], ['b/shot.jpg', 'b/shot.jpg', '9,1-18,1']]);
});

test('a path wrapped over two rows is one link; wide characters before it counted', async () => {
  assert.deepEqual(await paths('⏺ ✅ src/main/tasks.ts', 12), [['src/main/tasks.ts', 'src/main/tasks.ts', '6,1-10,2']]);
});

test('not paths', async () => {
  assert.deepEqual(await paths('version 1.5 at https://example.com/a.html, a / b, ~ . .. 3:12 done'), []);
});

test("an agent's link to a file (OSC 8): a path as it is, or a file:// address", () => {
  assert.deepEqual(['/tmp/a b.png', 'src/x.ts', 'C:\\x.txt', 'file:///tmp/a%20b.png', 'file:///C:/x.txt', 'javascript:alert(1)', 'mailto:a@b.c'].map(fileOf),
    ['/tmp/a b.png', 'src/x.ts', 'C:\\x.txt', '/tmp/a b.png', 'C:/x.txt', null, null]);
});
