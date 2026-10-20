// The GitHub accounts' sign-ins (main/accounts.ts) and a remote's repository (main/api.ts), GitHub answered by a fake fetch.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Accounts } from './main/accounts.ts';
import { repoOf } from './main/api.ts';

const secrets = { available: () => true, encrypt: (s: string) => Buffer.from(s).toString('base64'), decrypt: (b: string) => Buffer.from(b, 'base64').toString() };
const hosts = { web: 'http://gh', api: 'http://gh/api', mcp: 'http://gh/mcp' };
let dir: string, calls: string[], answer: (url: string, body: Record<string, string>) => unknown;
const realFetch = globalThis.fetch;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kulisa-github-'));
  calls = [];
  globalThis.fetch = (async (url: string, o?: { body?: string }) => {
    calls.push(url);
    const j = answer(url, o?.body ? JSON.parse(o.body) : {});
    return new Response(JSON.stringify(j), { status: j === 401 ? 401 : 200 });
  }) as typeof fetch;
});
afterEach(() => { globalThis.fetch = realFetch; fs.rmSync(dir, { recursive: true, force: true }); });

// An account signed in, its token ending in a minute.
async function signedIn() {
  answer = (url) => (url.endsWith('/user') ? { id: 7, login: 'octo', name: null } : []);
  const a = new Accounts(dir, secrets, hosts);
  await a.signIn({ access: 'ghu_1', refresh: 'ghr_1', ends: Date.now() + 60_000, refreshEnds: Date.now() + 86_400_000 }, 'app');
  return a;
}

test("a token is refreshed before it ends, once however many ask, and the new refresh token kept before it is used", async () => {
  const a = await signedIn();
  let refreshes = 0;
  answer = (_url, body) => { refreshes++; assert.equal(body.refresh_token, 'ghr_1'); return { access_token: 'ghu_2', refresh_token: 'ghr_2', expires_in: 28800, refresh_token_expires_in: 100 }; };
  assert.deepEqual(await Promise.all([a.token('7'), a.token('7')]), ['ghu_2', 'ghu_2']);
  assert.equal(refreshes, 1);
  assert.deepEqual(a.tokensOf(a.find('7')!), { access: 'ghu_2', refresh: 'ghr_2' });
  assert.equal(await a.token('7'), 'ghu_2', 'not refreshed again: hours left');
  assert.equal(refreshes, 1);
});

test('a refresh GitHub refuses signs the account out: no token until it signs in again', async () => {
  const a = await signedIn();
  answer = () => ({ error: 'bad_refresh_token' });
  assert.equal(await a.token('7'), null);
  assert.equal(a.find('7')!.expired, true);
  assert.equal(a.suggest('octo/shop'), null, 'one signed out is suggested for nothing');
});

test("an account is suggested for a repository it reaches, else for its owner's own", async () => {
  answer = (url) => (url.endsWith('/user') ? { id: 7, login: 'octo' } : url.includes('page=1') ? [{ full_name: 'Acme/Web' }] : []);
  const a = new Accounts(dir, secrets, hosts);
  await a.signIn({ access: 'github_pat_x', refresh: null, ends: null, refreshEnds: null }, 'token');
  assert.equal(a.suggest('acme/web'), '7');
  assert.equal(a.suggest('octo/other'), '7');
  assert.equal(a.suggest('someone/else'), null);
  assert.equal(await a.token('7'), 'github_pat_x', 'a token without an end is never refreshed');
  assert.ok(!calls.some((u) => u.includes('access_token')));
});

test("a remote's GitHub repository, whatever its form; another host's is none; a token in it is not kept", () => {
  for (const r of ['https://github.com/Acme/web.git', 'https://user:ghp_x@github.com/acme/web', 'git@github.com:acme/web.git', 'ssh://git@github.com/acme/web.git', 'https://github.com/acme/web/'])
    assert.equal(repoOf(r), 'acme/web', r);
  for (const r of ['git@github-work:acme/web.git', 'https://gitlab.com/acme/web.git', '/home/me/web.git']) assert.equal(repoOf(r), null, r);
});
