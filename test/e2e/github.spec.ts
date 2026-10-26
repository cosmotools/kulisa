// GitHub accounts (src/github/README.md) against the test site's fake GitHub (KULISA_GITHUB, app.ts): Settings → GitHub
// (Kulisa App's device flow, a fine-grained token, signed out and in again, deleting), a project's repositories' accounts.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.ts';
import type { Core } from './fixtures.ts';
import type { Files } from './data.ts';
import type { SettingsAt } from '../../src/shared/ipc.ts';
import { SITE, attr, menuRows, choose, rightClick, closeSettings, invoke, removed } from './helpers.ts';

type Account = { id: string; login: string; kind: string; secret?: string };

const accounts = (core: Core) => core((k) => k.shell.github.accounts.list() as Account[]);
const stored = (files: Files): Account[] => files.json('github.json').list;
const idOfLogin = async (core: Core, login: string, kind = 'app') => (await accounts(core)).find((a) => a.login === login && a.kind === kind).id;
// No accounts, Settings closed: what a test starts from (deleting one as the human does: the last test).
async function clean(core: Core) {
  await core((k) => { for (const a of k.shell.github.accounts.list()) k.shell.github.accounts.delete(a.id); k.shell.settings?.win.close(); });
  await expect.poll(() => core((k) => !k.shell.settings)).toBe(true);
}
// Settings' window open (on Settings → GitHub once it is), its page.
async function settings(core: Core, sui: () => Promise<Page>, at: SettingsAt = { section: 'projects', id: null }) {
  await core((k, a) => k.shell.openSettings(a), at);
  return sui();
}
// The accounts' rows as Settings → GitHub shows them: each its cells' words.
const rows = (s: Page) => s.locator('#ghaccounts [data-github]').evaluateAll((rs) => rs.map((r) => [...r.children].map((c) => c.textContent.trim())));
async function githubPage(core: Core, sui: () => Promise<Page>) {
  const s = await settings(core, sui);
  await s.locator('#pjlist [data-page="github"]').click();
  await expect(s.locator('#githubpage')).toBeVisible();
  return s;
}
async function addAccount(s: Page, how: 'With GitHub…' | 'With a Token…') {
  await s.locator('#ghadd').click();
  expect(await menuRows(s)).toEqual(['# Add Account', 'With GitHub…', 'With a Token…']);
  await choose(s, how);
}
// The code GitHub gave, as Kulisa shows it; entered on GitHub's page as the human would (or denied).
async function shownCode(s: Page) {
  await expect(s.locator('#ghcode')).not.toBeEmpty();
  return s.locator('#ghcode').textContent();
}
const enter = (code: string, query: string) => fetch(`${SITE}/github/login/device/enter?code=${code}&${query}`);
// The field takes the keyboard as it opens (shown: false, typed again after GitHub refused one).
async function typeToken(s: Page, token: string, shown = true) {
  if (shown) await expect(s.locator('#ghtoken')).toBeFocused();
  await s.locator('#ghtoken').evaluate((f: HTMLInputElement, t) => { f.value = t; f.dispatchEvent(new Event('input')); }, token);
  await s.locator('#ghtokensave').click();
}
// ann with Kulisa App and bob with a fine-grained token, signed in in Settings → GitHub as the first and third tests do.
async function annAndBob(core: Core, sui: () => Promise<Page>) {
  const s = await githubPage(core, sui);
  await addAccount(s, 'With GitHub…');
  await enter(await shownCode(s), 'login=ann');
  await expect(s.locator('#ghsignin')).toHaveCount(0);
  await addAccount(s, 'With a Token…');
  await typeToken(s, 'github_pat_bob_acme');
  await expect.poll(async () => (await rows(s)).length).toBe(2);
  return { s, ann: await idOfLogin(core, 'ann'), bob: await idOfLogin(core, 'bob', 'pat') };
}
// Repositories with origins as people write them: a token and capitals in one, GitLab's, an owner no account reaches;
// a project of them (ghproject).
async function ghProject(core: Core, files: Files) {
  await removed(path.join(files.root, 'gh'));
  const repo = (name: string, origin: string) => {
    const d = path.join(files.root, 'gh', name);
    fs.mkdirSync(d, { recursive: true });
    execFileSync('git', ['init', '-q', d]);
    execFileSync('git', ['-C', d, 'remote', 'add', 'origin', origin]);
    return d;
  };
  const folders = { shop: repo('shop', 'https://x-access-token:ghp_leaked@github.com/Acme/Shop.git'), site: repo('site', 'https://github.com/ann/site'),
    lab: repo('lab', 'https://gitlab.com/acme/lab.git'), beta: repo('beta', 'https://github.com/beta/app.git'), again: repo('shop-again', 'git@github.com:acme/shop.git') };
  const id = await core((k, f) => {
    const p = k.shell.store.projectFor(f.shop, 'ghproject');
    k.shell.store.updateProject(p.id, { folders: [f.shop, f.site, f.lab, f.beta] });
    return p.id;
  }, folders);
  return { id, folders };
}
const github = (core: Core, id: string) => core((k, p) => k.shell.store.projects().find((x) => x.id === p).github, id);
const removeProject = (core: Core, id: string) => core((k, p) => { const x = k.shell.store.projects().find((y) => y.id === p); if (x) k.shell.store.removeProject(x); }, id);
const bind = (s: Page, a: { id: string; remote: string; account: string }) => invoke(s, 'project:github-set', a);

test('GitHub: signing in with Kulisa App, Kulisa shows the code itself and opens GitHub\'s page; the account comes once it is entered there, no token on disk or in the log', async ({ core, ui, sui, files }) => {
  await clean(core);
  const s = await githubPage(core, sui);
  await expect(s.locator('#ghaccounts').getByText('No accounts yet.', { exact: true })).toBeVisible();
  await addAccount(s, 'With GitHub…');
  const code = await shownCode(s);
  await expect(s.locator('#ghsignin')).toContainText(/only when Kulisa has just shown it/);
  // GitHub's page in the user's browser, once the code is on screen.
  await expect.poll(() => core((k) => k.openedExternally)).toContain(`${SITE}/github/login/device`);
  await enter(code, 'login=ann');
  await expect.poll(async () => (await rows(s)).length).toBe(1);
  await expect(s.locator('#ghsignin')).toHaveCount(0);
  const [[login, installed, projects, ends]] = await rows(s);
  expect([login, installed, projects], 'where Kulisa App is installed, asked of GitHub').toEqual(['ann', 'ann', 'in no project']);
  expect(ends, 'the sign-in lasts until its refresh token ends').toMatch(/^until .*\d{4}$/);
  const [a] = stored(files);
  expect([a.login, a.kind]).toEqual(['ann', 'app']);
  expect(!!a.secret, 'its tokens encrypted when there is a keyring, else nowhere on disk').toBe(await core((k) => k.shell.github.kept()));
  for (const text of [fs.readFileSync(path.join(files.userData, 'github.json'), 'utf8'), files.log()]) {
    expect(!/ghu_|ghr_/.test(text) && !text.includes(code), 'no token, no code').toBe(true);
  }
  expect(files.log()).toMatch(new RegExp(`\\[github\\] added ${a.id} \\(ann\\)$`, 'm'));
  await closeSettings(core, ui, sui);
});

test('GitHub: a code denied on GitHub says so; a sign-in cancelled makes nothing', async ({ core, ui, sui }) => {
  await clean(core);
  const s = await githubPage(core, sui);
  await addAccount(s, 'With GitHub…');
  await enter(await shownCode(s), 'deny=1');
  await expect(s.locator('#gherror')).toContainText(/denied/);
  await addAccount(s, 'With GitHub…');
  await shownCode(s);
  await s.locator('#ghsignincancel').click();
  await expect(s.locator('#ghsignin')).toHaveCount(0);
  expect(await accounts(core)).toEqual([]);
  await closeSettings(core, ui, sui);
});

test('GitHub: a fine-grained token, checked with GitHub, its end read from GitHub\'s answer; a classic one refused', async ({ core, ui, sui, files }) => {
  await clean(core);
  const s = await githubPage(core, sui);
  await addAccount(s, 'With a Token…');
  await typeToken(s, 'ghp_classic');
  await expect(s.locator('#gherror')).toContainText(/not a fine-grained token/);
  await typeToken(s, 'github_pat_unknown', false);
  await expect(s.locator('#gherror')).toContainText(/refused this token/);
  await typeToken(s, 'github_pat_bob_acme', false);
  await expect.poll(async () => (await rows(s)).length).toBe(1);
  const bob = (await rows(s)).find((r) => r[0] === 'bob');
  expect(bob.slice(1, 3)).toEqual(['a token', 'in no project']);
  expect(bob[3], "GitHub's header says when it ends").toMatch(/2027/);
  expect(fs.readFileSync(path.join(files.userData, 'github.json'), 'utf8')).not.toContain('github_pat_');
  expect(files.log(), 'the token, not even in the line of its channel').not.toContain('github_pat_bob');
  await closeSettings(core, ui, sui);
});

test("GitHub: a repository's row: the account that reaches its remote suggested and bound (by its remote, whatever its address), why none can, not a GitHub address; another chosen", async ({ core, ui, sui, files }) => {
  await clean(core);
  const { ann, bob } = await annAndBob(core, sui);
  const { id, folders } = await ghProject(core, files);
  try {
    const s = await settings(core, sui, { section: 'projects', id });
    const account = (remote: string) => s.locator(`[data-remote="${remote}"]`);
    await expect(account('github.com/acme/shop')).toHaveText('bob (token)');
    await expect(account('github.com/ann/site')).toHaveText('ann');
    await expect(s.locator(attr('data-folder', folders.lab)).getByText('not a GitHub address', { exact: true })).toBeVisible();
    expect((await s.locator(`#npgithub ${attr('data-folder', folders.beta)}`).textContent()).replace(/\s+/g, ' ').trim())
      .toBe('beta: Kulisa App is not installed on beta. Install it on beta (or ask its owner to)');
    await expect(s.locator(`#npgithub ${attr('data-folder', folders.beta)} a`)).toHaveAttribute('href', 'https://github.com/apps/kulisa-app/installations/new');
    expect(await github(core, id), 'bound by remote: the token in its address dropped').toEqual({ 'github.com/acme/shop': bob, 'github.com/ann/site': ann });
    expect(files.log()).not.toContain('ghp_leaked');
    // Another chosen on its row (Reka's Select): bound to it, even as it cannot reach it, which its line says.
    await account('github.com/acme/shop').click();
    await s.locator(`[role="listbox"][data-state="open"][data-ready] [data-account="${ann}"]`).click();
    await expect(account('github.com/acme/shop')).toHaveText('ann');
    await expect(s.locator('#npgithub')).toContainText(/shop: Kulisa App is not installed on acme\./);
    expect((await github(core, id))['github.com/acme/shop']).toBe(ann);
    // A repository leaving the project takes its binding along, but not while another of its repositories has its remote.
    await core((k, a) => k.shell.store.updateProject(a.id, { folders: [a.f.shop, a.f.site, a.f.lab, a.f.beta, a.f.again] }), { id, f: folders });
    const removeFolder = (folder: string) => invoke(s, 'project:folder-remove', { id, folder });
    expect((await removeFolder(folders.site)).error).toBeUndefined();
    expect((await removeFolder(folders.shop)).error).toBeUndefined();
    expect(await github(core, id)).toEqual({ 'github.com/acme/shop': ann });
    await closeSettings(core, ui, sui);
  } finally { await removeProject(core, id); }
});

test('GitHub: signed out (a refresh refused): said on the account and on its repositories; Sign in Again with a new token', async ({ core, ui, sui, files }) => {
  await clean(core);
  const { s: page, bob } = await annAndBob(core, sui);
  const { id } = await ghProject(core, files);
  try {
    // Bound to bob, then signed out as a refused refresh does (accounts.ts, refreshNow: its unit test).
    expect((await bind(page, { id, remote: 'github.com/acme/shop', account: bob })).error).toBeUndefined();
    await core((k, b) => k.shell.github.accounts.signOut(b, 'the test'), bob);
    let s = await settings(core, sui, { section: 'projects', id });
    await expect(s.locator('#npgithub')).toContainText(/shop: bob is signed out: Sign in Again in Settings → GitHub\./);
    s = await githubPage(core, sui); // read again as it is shown
    await expect.poll(async () => (await rows(s)).some((r) => r[0] === 'bob' && r[3] === 'signed out')).toBe(true);
    await rightClick(s, `#ghaccounts [data-github="${bob}"]`);
    expect(await menuRows(s)).toEqual(['Sign in Again…', 'Delete…']);
    await choose(s, 'Sign in Again…');
    await typeToken(s, 'github_pat_bob_acme');
    await expect.poll(async () => (await rows(s)).some((r) => r[0] === 'bob' && r[3] !== 'signed out')).toBe(true);
    expect(await idOfLogin(core, 'bob', 'pat'), 'the same account').toBe(bob);
    expect(files.log()).toMatch(new RegExp(`\\[github\\] signed out ${bob} \\(bob, token\\): the test$`, 'm'));
    await closeSettings(core, ui, sui);
  } finally { await removeProject(core, id); }
});

test('GitHub: deleting an account asks first, linking where to revoke it on GitHub; its projects let go of it', async ({ core, ui, sui, files }) => {
  await clean(core);
  const { s: page, ann, bob } = await annAndBob(core, sui);
  const { id } = await ghProject(core, files);
  try {
    // shop bound to bob, site to ann, as a repository's row binds them (the test above).
    expect((await bind(page, { id, remote: 'github.com/acme/shop', account: bob })).error).toBeUndefined();
    expect((await bind(page, { id, remote: 'github.com/ann/site', account: ann })).error).toBeUndefined();
    const s = await githubPage(core, sui);
    await expect.poll(async () => (await rows(s)).some((r) => r[0] === 'ann' && r[2] === 'in ghproject')).toBe(true);
    await rightClick(s, `#ghaccounts [data-github="${ann}"]`);
    await menuRows(s);
    await choose(s, 'Delete…');
    await expect.poll(async () => (await rows(s)).length).toBe(1);
    const [asked] = await core((k) => k.asked);
    expect(asked.message).toBe('Delete the GitHub account ann?');
    expect(asked.detail).toMatch(/the projects ghproject let go of it/);
    expect(asked.link).toEqual({ url: 'https://github.com/settings/apps/authorizations', label: 'Revoke on GitHub' });
    expect(await github(core, id)).toEqual({ 'github.com/acme/shop': bob });
    expect(files.log()).toMatch(new RegExp(`\\[github\\] deleted ${ann} \\(ann\\)$`, 'm'));
    await closeSettings(core, ui, sui);
  } finally { await removeProject(core, id); }
});

// RepoAccount.vue's trigger keeps Delete and the arrows to itself, not Esc.
test('Esc closes Settings with the keyboard on a repository\'s account (its Select\'s trigger, as after choosing one)', async ({ core, ui, sui, files }) => {
  await clean(core);
  await annAndBob(core, sui);
  const { id } = await ghProject(core, files);
  try {
    const s = await settings(core, sui, { section: 'projects', id });
    await s.locator('[data-remote="github.com/acme/shop"]').focus();
    await closeSettings(core, ui, sui);
  } finally { await removeProject(core, id); }
});

// The token kept with the keyring, else (no keyring: basic_text) only while Kulisa ran.
test('after a restart: a GitHub sign-in is kept with the keyring, or signed out without one', async ({ core, ui, sui, restart }) => {
  test.setTimeout(60000); // a restart
  await clean(core);
  const s = await githubPage(core, sui);
  await addAccount(s, 'With a Token…');
  await typeToken(s, 'github_pat_bob_acme');
  await expect.poll(async () => (await rows(s)).length).toBe(1);
  await closeSettings(core, ui, sui);
  await restart();
  const [bob, ...more] = await accounts(core);
  expect([bob.login, more]).toEqual(['bob', []]);
  expect(await core((k, id) => k.shell.github.accounts.signedIn(id), bob.id)).toBe(await core((k) => k.shell.github.kept()));
});
