// A project's favicon found in its code (favicons.ts): which one first, and what is left out.
// Plain Node (npm run test:unit), no Electron, in a temporary folder of its own.
import { test, after } from 'node:test';
import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { findFavicon, rankFavicons } from '../../src/main/favicons.ts';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kulisa-unit-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));

const files = (folder: string, list: string[]) => {
  for (const f of list) { fs.mkdirSync(path.dirname(path.join(folder, f)), { recursive: true }); fs.writeFileSync(path.join(folder, f), 'x'); }
};

test('favicons: the nearest to the top first, then svg, png, ico, then a favicon before an icon, then by name; icon.* only in app/', () => {
  assert.deepEqual(rankFavicons(['apps/web/public/favicon.ico', 'public/favicon.ico', 'public/favicon.png', 'src/app/icon.svg',
    'docs/favicon.svg', 'public/Favicon.SVG', 'components/icon.svg', 'favicon.txt', 'app/icon.png', 'app/favicon.png']),
  ['docs/favicon.svg', 'public/Favicon.SVG', 'app/favicon.png', 'public/favicon.png', 'app/icon.png', 'public/favicon.ico', 'src/app/icon.svg',
    'apps/web/public/favicon.ico']);
  assert.deepEqual(rankFavicons(['favicon-32.png', 'myfavicon.ico']), []);
});

test("favicons: in a repository, its files git lists (new ones too), not those it ignores; in a folder without git, not in dependencies or hidden folders", async () => {
  const repo = path.join(root, 'repo');
  files(repo, ['node_modules/lib/favicon.svg', 'deep/a/b/c/d/e/f/favicon.ico', 'site/public/favicon.png']);
  fs.writeFileSync(path.join(repo, '.gitignore'), 'node_modules\n');
  execFileSync('git', ['init', '-q'], { cwd: repo });
  assert.equal(await findFavicon([repo]), path.join(repo, 'site/public/favicon.png'), 'not committed yet, and not the ignored one nearer the top');

  const plain = path.join(root, 'plain');
  files(plain, ['node_modules/favicon.svg', '.cache/favicon.svg', 'dist/favicon.svg', 'web/static/favicon.ico']);
  assert.equal(await findFavicon([plain]), path.join(plain, 'web/static/favicon.ico'));

  const none = path.join(root, 'none');
  files(none, ['README.md']);
  assert.equal(await findFavicon([none, plain]), path.join(plain, 'web/static/favicon.ico'), "the next repository's when the first has none");
  assert.equal(await findFavicon([none]), null);
});
