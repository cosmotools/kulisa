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
  assert.equal(fileIcon(theme, '/work/project/src', true), 'folder-src');
  assert.equal(fileIcon(theme, '/work/project/src', true, true), 'folder-src-open');
  assert.equal(fileIcon(theme, '/work/project/unusual', true), 'folder');
  assert.equal(fileIcon(theme, '/work/project/unusual', true, true), 'folder-open');
});

test('icon matching preserves filename and parent precedence across light and dark themes', () => {
  const theme: Manifest = {
    file: 'file', folder: 'folder', folderExpanded: 'folder-open',
    fileNames: { 'special.test.ts': 'special', 'src/special.test.ts': 'source-special' },
    fileExtensions: { ts: 'ts', 'test.ts': 'test', 'src/test.ts': 'source-test' },
    folderNames: { src: 'source', 'project/src': 'project-source' },
    folderNamesExpanded: { src: 'source-open' },
    light: { fileExtensions: { ts: 'ts-light' }, folderNames: { src: 'source-light' } },
  };
  assert.equal(fileIcon(theme, '/src/special.test.ts'), 'source-special');
  assert.equal(fileIcon(theme, '/else/special.test.ts', false, false, true), 'special');
  assert.equal(fileIcon(theme, '/src/example.test.ts', false, false, true), 'source-test');
  assert.equal(fileIcon(theme, '/else/example.test.ts', false, false, true), 'test');
  assert.equal(fileIcon(theme, '/else/example.ts', false, false, true), 'ts-light');
  assert.equal(fileIcon(theme, '/else/example.ts'), 'ts');
  assert.equal(fileIcon(theme, '/project/src', true, false, true), 'project-source');
  assert.equal(fileIcon(theme, '/else/src', true, false, true), 'source-light');
  assert.equal(fileIcon(theme, '/else/src', true, true, true), 'source-open');
  assert.equal(fileIcon(theme, '/unknown', true, true, true), 'folder-open');
});
