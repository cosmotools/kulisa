import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Manifest } from 'material-icon-theme';
import { fileIcon } from './renderer/icon.ts';

test('icon matching preserves filename and parent precedence across light and dark themes', () => {
  const theme: Manifest = {
    file: 'file',
    fileNames: { 'special.test.ts': 'special', 'src/special.test.ts': 'source-special' },
    fileExtensions: { ts: 'ts', 'test.ts': 'test', 'src/test.ts': 'source-test' },
    light: { fileExtensions: { ts: 'ts-light' } },
  };
  assert.equal(fileIcon(theme, '/src/special.test.ts'), 'source-special');
  assert.equal(fileIcon(theme, '/else/special.test.ts', true), 'special');
  assert.equal(fileIcon(theme, '/src/example.test.ts', true), 'source-test');
  assert.equal(fileIcon(theme, '/else/example.test.ts', true), 'test');
  assert.equal(fileIcon(theme, '/else/example.ts', true), 'ts-light');
  assert.equal(fileIcon(theme, '/else/example.ts'), 'ts');
  assert.equal(fileIcon(theme, 'C:\\SRC\\EXAMPLE.TEST.TS'), 'source-test');
  for (const name of ['__proto__', 'constructor', 'name.constructor', 'unknown.extension', 'noextension'])
    assert.equal(fileIcon(theme, `/project/${name}`), 'file', name);
});
