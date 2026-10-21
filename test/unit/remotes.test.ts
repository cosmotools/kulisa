// A remote by what it points to (remotes.ts): one key for every way of writing it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { remoteKey } from '../../src/main/remotes.ts';

// ssh -G as the test's ~/.ssh/config would answer: github-work an alias of GitHub; unknown names given back as they are,
// as ssh does; 'broken' not answered (ssh not there).
const ssh = async (alias: string) => (alias === 'github-work' ? 'github.com' : alias === 'broken' ? null : alias);
const key = (url: string) => remoteKey(url, { ssh });

test('remotes: https, ssh and scp-like addresses of one repository have one key', async () => {
  for (const url of ['https://github.com/acme/shop.git', 'https://github.com/Acme/Shop', 'https://github.com/acme/shop/', 'http://github.com:80/acme/shop.git',
    'git@github.com:acme/shop.git', 'git@github.com:Acme/shop', 'ssh://git@github.com/acme/shop.git', 'ssh://git@github.com:22/acme/shop.git',
    'git+ssh://git@github.com/acme/shop', 'git@github-work:acme/shop.git', 'git@ssh.github.com:acme/shop.git', '  https://GitHub.com/acme/shop.git\n']) {
    assert.equal(await key(url), 'github.com/acme/shop', url);
  }
});

test('remotes: a user or token in the address is dropped, never in the key', async () => {
  assert.equal(await key('https://x-access-token:ghp_secret123@github.com/acme/shop.git'), 'github.com/acme/shop');
  assert.equal(await key('https://ghp_secret123@github.com/acme/shop.git'), 'github.com/acme/shop');
});

test('remotes: other hosts keep their path; a folder is no remote; an alias ssh cannot name points nowhere known', async () => {
  assert.equal(await key('https://gitlab.com/group/sub/repo.git'), 'gitlab.com/group/sub/repo');
  assert.equal(await key('git@gitlab.example.org:team/app.git'), 'gitlab.example.org/team/app');
  for (const url of ['/srv/git/shop', 'C:\\repos\\shop', 'file:///srv/git/shop', '../shop', '', 'https://github.com/'])
    assert.equal(await key(url), null, url);
  assert.equal(await key('git@broken:acme/shop.git'), null, 'an alias: what it points to is not known');
  assert.equal(await remoteKey('git@github.com:acme/shop.git', { ssh: async () => null }), 'github.com/acme/shop', 'a real host name stays itself without ssh');
});
