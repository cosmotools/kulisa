// GitHub's accounts (main/accounts.ts, main/github.ts) against a fake GitHub (a fetch of the test's own): the store,
// a token refreshed once whoever asks and written before it is used, nothing written without a keyring, a
// repository's account. Plain Node (npm run test:unit), in a temporary folder of its own.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { GitHub } from './main/index.ts';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kulisa-github-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));
let n = 0;
const folder = () => { const d = path.join(root, String(++n)); fs.mkdirSync(d); return d; };
// A keyring that marks what it encrypts, so a test sees a secret is no token in the clear.
const keyring = (kept = true) => ({ kept: () => kept, encrypt: (s: string) => `enc:${Buffer.from(s).toString('base64')}`,
  decrypt: (s: string) => Buffer.from(s.replace(/^enc:/, ''), 'base64').toString() });
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
// GitHub, as far as these tests ask it: who a token is, a refresh (each answered when released), a repository reached.
function fakeGitHub({ users = { ghu_1: 'ann' }, repos = {} }: { users?: Record<string, string>; repos?: Record<string, string[]> } = {}) {
  const calls: string[] = [];
  let pending: (() => void)[] = [], refreshes = 0;
  const fetch = async (url: string, init?: RequestInit) => {
    const u = new URL(url), token = String(new Headers(init?.headers).get('authorization') ?? '').replace('Bearer ', '');
    calls.push(u.pathname);
    if (u.pathname === '/login/oauth/access_token') {
      const form = new Map<string, string>(Object.entries(JSON.parse(String(init?.body)) as Record<string, string>));
      await new Promise<void>((r) => pending.push(r));
      if (form.get('refresh_token') !== `ghr_${refreshes}`) return json({ error: 'bad_refresh_token' });
      refreshes++;
      users[`ghu_r${refreshes}`] = 'ann';
      return json({ access_token: `ghu_r${refreshes}`, expires_in: 28800, refresh_token: `ghr_${refreshes}`, refresh_token_expires_in: 15897600 });
    }
    if (u.pathname === '/user') return users[token] ? json({ login: users[token] }) : json({ message: 'Bad credentials' }, 401);
    const repo = /^\/repos\/(.+)$/.exec(u.pathname)?.[1];
    if (repo) return json({}, users[token] && repos[users[token]]?.includes(repo) ? 200 : 404);
    return json({}, 404);
  };
  return { fetch: fetch as typeof globalThis.fetch, calls, release: () => { const p = pending; pending = []; for (const r of p) r(); }, waiting: () => pending.length };
}
const stored = (dir: string) => JSON.parse(fs.readFileSync(path.join(dir, 'github.json'), 'utf8')).list;

test('github: an account kept with its tokens encrypted, the same login signed in again is the same account', async () => {
  const dir = folder(), gh = new GitHub({ dir, secrets: keyring(), fetch: fakeGitHub().fetch });
  const a = gh.accounts.add('ann', 'app', { access: 'ghu_1', ends: Date.now() + 8 * 3600e3, refresh: 'ghr_0', refreshEnds: Date.now() + 1e10 });
  assert.ok(!('error' in a));
  const [s] = stored(dir);
  assert.deepEqual([s.id, s.login, s.kind], [a.id, 'ann', 'app']);
  assert.match(s.id, /^[a-z0-9]{6}$/);
  assert.ok(s.secret.startsWith('enc:') && !fs.readFileSync(path.join(dir, 'github.json'), 'utf8').includes('ghu_1'), 'no token in the clear');
  // Read again by another run: decrypted from the file.
  const later = new GitHub({ dir, secrets: keyring(), fetch: fakeGitHub().fetch });
  assert.equal(await later.accounts.token(a.id), 'ghu_1');
  const again = later.accounts.add('ann', 'app', { access: 'ghu_2' });
  assert.equal(!('error' in again) && again.id, a.id, 'one account');
  // A token is an account of its own (one per owner), and signing one in again as another login is refused.
  const pat = later.accounts.add('ann', 'pat', { access: 'github_pat_x' });
  assert.ok(!('error' in pat) && pat.id !== a.id);
  assert.match((later.accounts.add('bob', 'app', { access: 'ghu_3' }, a.id) as { error: string }).error, /signed in as bob, not ann/);
  later.accounts.delete(pat.id);
  assert.deepEqual(stored(dir).map((x: { id: string }) => x.id), [a.id]);
});

test('github: without a keyring (basic_text) nothing of a token is written; it lasts while Kulisa runs', async () => {
  const dir = folder(), gh = new GitHub({ dir, secrets: keyring(false), fetch: fakeGitHub().fetch });
  const a = gh.accounts.add('ann', 'app', { access: 'ghu_1', ends: Date.now() + 8 * 3600e3, refresh: 'ghr_0' });
  assert.ok(!('error' in a));
  assert.equal(stored(dir)[0].secret, undefined);
  assert.ok(!fs.readFileSync(path.join(dir, 'github.json'), 'utf8').includes('ghu_1'));
  assert.equal(await gh.accounts.token(a.id), 'ghu_1', 'in memory');
  const next = new GitHub({ dir, secrets: keyring(false), fetch: fakeGitHub().fetch });
  assert.equal(next.accounts.signedIn(a.id), false, 'the next run: signed out, the account kept');
  assert.equal(next.kept(), false);
});

test('github: a token about to end is refreshed once for every caller, the new pair written before it is used', async () => {
  const dir = folder(), fake = fakeGitHub(), gh = new GitHub({ dir, secrets: keyring(), fetch: fake.fetch });
  const a = gh.accounts.add('ann', 'app', { access: 'ghu_1', ends: Date.now() + 60_000, refresh: 'ghr_0', refreshEnds: Date.now() + 1e10 });
  assert.ok(!('error' in a));
  // Two tasks' agents at once: one refresh; the second, with the same refresh token, would be refused and sign out.
  const both = Promise.all([gh.accounts.token(a.id), gh.accounts.token(a.id)]);
  while (!fake.waiting()) await new Promise((r) => setImmediate(r));
  fake.release();
  assert.deepEqual(await both, ['ghu_r1', 'ghu_r1']);
  assert.equal(fake.calls.filter((c) => c === '/login/oauth/access_token').length, 1);
  // On disk before any caller got it: another run starts with the new pair.
  assert.equal(JSON.parse(keyring().decrypt(stored(dir)[0].secret)).refresh, 'ghr_1');
  assert.equal(await gh.accounts.token(a.id), 'ghu_r1', 'not refreshed again: 8 hours left');
});

test('github: a refresh GitHub refuses signs the account out; the network failing does not', async () => {
  const dir = folder(), fake = fakeGitHub(), gh = new GitHub({ dir, secrets: keyring(), fetch: fake.fetch });
  const a = gh.accounts.add('ann', 'app', { access: 'ghu_1', ends: Date.now() + 60_000, refresh: 'ghr_stale', refreshEnds: Date.now() + 1e10 });
  assert.ok(!('error' in a));
  const failed = assert.rejects(gh.accounts.token(a.id), /ann is signed out: Sign in Again/);
  while (!fake.waiting()) await new Promise((r) => setImmediate(r));
  fake.release();
  await failed;
  assert.equal(gh.accounts.signedIn(a.id), false);
  assert.equal(stored(dir)[0].secret, undefined, 'its tokens forgotten, the account kept');
  const offline = new GitHub({ dir: folder(), secrets: keyring(), fetch: (async () => { throw new TypeError('net::ERR_INTERNET_DISCONNECTED'); }) });
  const b = offline.accounts.add('ann', 'app', { access: 'ghu_1', ends: Date.now() + 60_000, refresh: 'ghr_0', refreshEnds: Date.now() + 1e10 });
  assert.ok(!('error' in b));
  await assert.rejects(offline.accounts.token(b.id), /GitHub could not be reached/);
  assert.equal(offline.accounts.signedIn(b.id), true, 'tried again next time');
});

test("github: a repository's account: the one bound, else the first that reaches it; why none", async () => {
  const fake = fakeGitHub({ users: { ghu_1: 'ann', github_pat_b: 'bob' }, repos: { bob: ['acme/shop'] } });
  const gh = new GitHub({ dir: folder(), secrets: keyring(), fetch: fake.fetch });
  assert.equal((await gh.repo('github.com/acme/shop', null)).state, 'no-account');
  const ann = gh.accounts.add('ann', 'app', { access: 'ghu_1' }) as { id: string };
  const r = await gh.repo('github.com/acme/shop', null);
  assert.deepEqual([r.state, r.owner, !!r.install], ['not-reached', 'acme', true], 'Kulisa App not installed on acme');
  const bob = await gh.addToken('github_pat_b') as { id: string };
  assert.deepEqual(await gh.repo('github.com/acme/shop', null), { account: bob.id, suggested: true, state: 'ok', owner: 'acme', repo: 'acme/shop', install: null });
  assert.deepEqual([(await gh.repo('github.com/acme/shop', ann.id)).state], ['not-reached'], 'bound: that one, even when another reaches it');
  assert.equal((await gh.repo('gitlab.com/acme/shop', null)).state, 'not-github');
  assert.equal((await gh.repo(null, null)).state, 'not-github');
  // A classic token reaches all of its user's repositories: refused, as a token GitHub does not know.
  assert.match((await gh.addToken('ghp_classic')).error!, /not a fine-grained token/);
  assert.match((await gh.addToken('github_pat_unknown')).error!, /GitHub refused this token/);
});
