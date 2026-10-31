import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateManifest, type Manifest } from 'material-icon-theme';
import { fileIcon } from './renderer/icon.ts';

test('Material icons distinguish languages, special filenames, dotfiles, and compound extensions', () => {
  const theme = generateManifest({ activeIconPack: '' });
  for (const [name, expected] of [
    ['index.ts', 'typescript'], ['index.tsx', 'react_ts'], ['index.py', 'python'],
    ['package.json', 'nodejs'], ['Dockerfile', 'docker'], ['.gitignore', 'git'],
    ['index.d.ts', 'typescript-def'], ['index.test.ts', 'test-ts'],
    ['README.MD', 'readme'], ['unknown.extension', 'file'], ['noextension', 'file'],
    ['__proto__', 'file'], ['constructor', 'file'], ['name.constructor', 'file'],
  ]) assert.equal(fileIcon(theme, `/project/${name}`), expected, name);
  assert.equal(fileIcon(theme, 'C:\\work\\project\\index.d.ts'), 'typescript-def');
});

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
});
