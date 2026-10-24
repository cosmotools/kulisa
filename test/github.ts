// GitHub accounts (src/github) against the test site's fake GitHub (KULISA_GITHUB, run.ts): Settings → GitHub (Kulisa
// App's device flow, a fine-grained token, signed out and in again, deleting), a project's repositories' accounts.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { assert, root, userData, SITE, waitFor, click, choose, menuRows, rightClick, closeSettings } from './helpers.ts';
import { removeFolder } from '../src/main/projects.ts';
import type { Ctx, Test } from './run.ts';

const stored = () => JSON.parse(fs.readFileSync(path.join(userData, 'github.json'), 'utf8')).list as { id: string; login: string; kind: string; secret?: string }[];
const logText = () => fs.readFileSync(path.join(userData, 'logs', 'kulisa.log'), 'utf8');
// The accounts' rows as Settings → GitHub shows them: each its cells' words.
const rows = (ctx: Ctx) => ctx.sui(`[...document.querySelectorAll('#ghaccounts [data-github]')].map((r) => [...r.querySelectorAll('.cell')].map((c) => c.textContent.trim()))`);
async function githubPage(ctx: Ctx) {
  if (!ctx.shell.settings) ctx.shell.openSettings({ section: 'projects', id: null });
  await waitFor(() => ctx.sui(`!!document.querySelector('#pjlist [data-page="github"]')`));
  await ctx.sui(`document.querySelector('#pjlist [data-page="github"]').click()`);
  await waitFor(() => ctx.sui(`!!document.getElementById('githubpage')?.checkVisibility()`));
}
async function addAccount(ctx: Ctx, how: 'With GitHub…' | 'With a Token…') {
  await click(ctx.sui, `document.getElementById('ghadd')`);
  assert.deepEqual(await menuRows(ctx.sui), ['# Add Account', 'With GitHub…', 'With a Token…']);
  await choose(ctx.sui, how);
}
// The code GitHub gave, as Kulisa shows it; entered on GitHub's page as the human would (or denied).
const shownCode = async (ctx: Ctx) => { await waitFor(() => ctx.sui(`!!document.getElementById('ghcode')?.textContent`)); return ctx.sui(`document.getElementById('ghcode').textContent`); };
const enter = (code: string, query: string) => fetch(`${SITE}/github/login/device/enter?code=${code}&${query}`);
const typeToken = async (ctx: Ctx, token: string) => {
  await waitFor(() => ctx.sui(`document.activeElement?.id === 'ghtoken'`));
  await ctx.sui(`(() => { const f = document.getElementById('ghtoken'); f.value = ${JSON.stringify(token)}; f.dispatchEvent(new Event('input')); })()`);
  await ctx.sui(`document.getElementById('ghtokensave').click()`);
};
const idOfLogin = (login: string, kind = 'app') => stored().find((a) => a.login === login && a.kind === kind).id;

export default (test: Test) => {
  test('GitHub: signing in with Kulisa App, Kulisa shows the code itself and opens GitHub\'s page; the account comes once it is entered there, no token on disk or in the log', async (ctx) => {
    await githubPage(ctx);
    assert.equal(await ctx.sui(`document.querySelector('#ghaccounts .empty').textContent`), 'No accounts yet.');
    await addAccount(ctx, 'With GitHub…');
    const code = await shownCode(ctx);
    assert.match(await ctx.sui(`document.getElementById('ghsignin').textContent`), /only when Kulisa has just shown it/);
    // GitHub's page in the user's browser, once the code is on screen.
    await waitFor(() => ctx.openedExternally.includes(`${SITE}/github/login/device`));
    await enter(code, 'login=ann');
    await waitFor(async () => (await rows(ctx)).length === 1 && !(await ctx.sui(`!!document.getElementById('ghsignin')`)));
    const [[login, installed, projects, ends]] = await rows(ctx);
    assert.deepEqual([login, installed, projects], ['ann', 'ann', 'in no project'], 'where Kulisa App is installed, asked of GitHub');
    assert.match(ends, /^until .*\d{4}$/, 'the sign-in lasts until its refresh token ends');
    const [a] = stored();
    assert.deepEqual([a.login, a.kind], ['ann', 'app']);
    assert.equal(!!a.secret, ctx.shell.github.kept(), 'its tokens encrypted when there is a keyring, else nowhere on disk');
    for (const text of [fs.readFileSync(path.join(userData, 'github.json'), 'utf8'), logText()]) assert.ok(!/ghu_|ghr_/.test(text) && !text.includes(code), 'no token, no code');
    assert.match(logText(), new RegExp(`\\[github\\] added ${a.id} \\(ann\\)$`, 'm'));
  });

  test('GitHub: a code denied on GitHub says so; a sign-in cancelled makes nothing', async (ctx) => {
    await addAccount(ctx, 'With GitHub…');
    await enter(await shownCode(ctx), 'deny=1');
    await waitFor(async () => /denied/.test(await ctx.sui(`document.getElementById('gherror').textContent`)));
    await addAccount(ctx, 'With GitHub…');
    await shownCode(ctx);
    await ctx.sui(`document.getElementById('ghsignincancel').click()`);
    await waitFor(() => ctx.sui(`!document.getElementById('ghsignin')`));
    assert.equal(stored().length, 1);
  });

  test('GitHub: a fine-grained token, checked with GitHub, its end read from GitHub\'s answer; a classic one refused', async (ctx) => {
    await addAccount(ctx, 'With a Token…');
    await typeToken(ctx, 'ghp_classic');
    await waitFor(async () => /not a fine-grained token/.test(await ctx.sui(`document.getElementById('gherror').textContent`)));
    await typeToken(ctx, 'github_pat_unknown');
    await waitFor(async () => /refused this token/.test(await ctx.sui(`document.getElementById('gherror').textContent`)));
    await typeToken(ctx, 'github_pat_bob_acme');
    await waitFor(async () => (await rows(ctx)).length === 2);
    const bob = (await rows(ctx)).find((r: string[]) => r[0] === 'bob');
    assert.deepEqual(bob.slice(1, 3), ['a token', 'in no project']);
    assert.match(bob[3], /2027/, "GitHub's header says when it ends");
    assert.ok(!fs.readFileSync(path.join(userData, 'github.json'), 'utf8').includes('github_pat_'));
    assert.ok(!logText().includes('github_pat_bob'), 'the token, not even in the line of its channel');
  });

  test("GitHub: a repository's row: the account that reaches its remote suggested and bound (by its remote, whatever its address), why none can, not a GitHub address; another chosen", async (ctx) => {
    const { shell, sui } = ctx;
    // Repositories with origins as people write them: a token and capitals in one, GitLab's, an owner no account reaches.
    const repo = (name: string, origin: string) => {
      const d = path.join(root, 'gh', name);
      fs.mkdirSync(d, { recursive: true });
      execFileSync('git', ['init', '-q', d]);
      execFileSync('git', ['-C', d, 'remote', 'add', 'origin', origin]);
      return d;
    };
    const shop = repo('shop', 'https://x-access-token:ghp_leaked@github.com/Acme/Shop.git'), site = repo('site', 'https://github.com/ann/site'),
      lab = repo('lab', 'https://gitlab.com/acme/lab.git'), beta = repo('beta', 'https://github.com/beta/app.git');
    const p = shell.store.projectFor(shop, 'ghproject');
    shell.store.updateProject(p.id, { folders: [shop, site, lab, beta] });
    shell.openSettings({ section: 'projects', id: p.id });
    const account = (remote: string) => sui(`document.querySelector('.ghaccount[data-remote="${remote}"]')?.textContent.trim() ?? null`);
    await waitFor(async () => (await account('github.com/acme/shop')) === 'bob (token)' && (await account('github.com/ann/site')) === 'ann');
    assert.equal(await sui(`document.querySelector('[data-folder="${lab}"] .notgithub').textContent`), 'not a GitHub address');
    assert.equal(await sui(`document.querySelector('#npgithub [data-folder="${beta}"]').textContent.replace(/\\s+/g, ' ').trim()`),
      'beta: Kulisa App is not installed on beta. Install it on beta (or ask its owner to)');
    assert.equal(await sui(`document.querySelector('#npgithub [data-folder="${beta}"] a').href`), 'https://github.com/apps/kulisa-app/installations/new');
    const bob = idOfLogin('bob', 'pat'), ann = idOfLogin('ann');
    assert.deepEqual(shell.store.projects().find((x) => x.id === p.id).github, { 'github.com/acme/shop': bob, 'github.com/ann/site': ann },
      'bound by remote: the token in its address dropped');
    assert.ok(!logText().includes('ghp_leaked'));
    // Another chosen on its row (Reka's Select): bound to it, even as it cannot reach it, which its line says.
    await click(sui, `document.querySelector('.ghaccount[data-remote="github.com/acme/shop"]')`);
    await waitFor(() => sui(`!!document.querySelector('.menu[data-state="open"].ready [data-account="${ann}"]')`));
    await sui(`(() => { const i = document.querySelector('.menu[data-state="open"] [data-account="${ann}"]');
      for (const t of ['pointerdown', 'pointerup']) i.dispatchEvent(new PointerEvent(t, { bubbles: true, button: 0, pointerType: 'mouse' })); })()`);
    await waitFor(async () => (await account('github.com/acme/shop')) === 'ann');
    await waitFor(async () => /shop: Kulisa App is not installed on acme\./.test(await sui(`document.getElementById('npgithub')?.textContent ?? ''`)));
    assert.equal(shell.store.projects().find((x) => x.id === p.id).github['github.com/acme/shop'], ann);
    // A repository leaving the project takes its binding along, but not while another of its repositories has its remote.
    const again = repo('shop-again', 'git@github.com:acme/shop.git'), bound = shell.store.projects().find((x) => x.id === p.id).github;
    shell.store.updateProject(p.id, { folders: [shop, site, lab, beta, again] });
    assert.ok(!(await removeFolder(shell, p.id, site)).error);
    assert.ok(!(await removeFolder(shell, p.id, shop)).error);
    assert.deepEqual(shell.store.projects().find((x) => x.id === p.id).github, { 'github.com/acme/shop': ann });
    shell.store.updateProject(p.id, { folders: [shop, site, lab, beta], github: bound }); // as the next tests take it
  });

  test('GitHub: signed out (a refresh refused): said on the account and on its repositories; Sign in Again with a new token', async (ctx) => {
    const { shell, sui } = ctx, bob = idOfLogin('bob', 'pat'), p = shell.store.projects().find((x) => x.name === 'ghproject');
    // Bound to bob again, then signed out as a refused refresh does (accounts.ts, refreshNow: its unit test).
    await sui(`kulisa.invoke('project:github-set', { id: '${p.id}', remote: 'github.com/acme/shop', account: '${bob}' })`);
    shell.github.accounts.signOut(bob, 'the test');
    shell.openSettings({ section: 'projects', id: p.id });
    await waitFor(async () => /shop: bob is signed out: Sign in Again in Settings → GitHub\./.test(await sui(`document.getElementById('npgithub')?.textContent ?? ''`)));
    await githubPage(ctx); // read again as it is shown
    await waitFor(async () => (await rows(ctx)).some((r: string[]) => r[0] === 'bob' && r[3] === 'signed out'));
    await rightClick(sui, `#ghaccounts [data-github="${bob}"] .label`);
    assert.deepEqual(await menuRows(sui), ['Sign in Again…', 'Delete…']);
    await choose(sui, 'Sign in Again…');
    await typeToken(ctx, 'github_pat_bob_acme');
    await waitFor(async () => (await rows(ctx)).some((r: string[]) => r[0] === 'bob' && r[3] !== 'signed out'));
    assert.equal(idOfLogin('bob', 'pat'), bob, 'the same account');
    assert.match(logText(), new RegExp(`\\[github\\] signed out ${bob} \\(bob, token\\): the test$`, 'm'));
  });

  test('GitHub: deleting an account asks first, linking where to revoke it on GitHub; its projects let go of it', async (ctx) => {
    const { shell, sui } = ctx, ann = idOfLogin('ann'), p = shell.store.projects().find((x) => x.name === 'ghproject');
    await waitFor(async () => (await rows(ctx)).some((r: string[]) => r[0] === 'ann' && r[2] === 'in ghproject'));
    ctx.asked.length = 0;
    await rightClick(sui, `#ghaccounts [data-github="${ann}"] .label`);
    await menuRows(sui);
    await choose(sui, 'Delete…');
    await waitFor(async () => (await rows(ctx)).length === 1);
    assert.equal(ctx.asked[0].message, 'Delete the GitHub account ann?');
    assert.match(ctx.asked[0].detail, /the projects ghproject let go of it/);
    assert.deepEqual(ctx.asked[0].link, { url: 'https://github.com/settings/apps/authorizations', label: 'Revoke on GitHub' });
    assert.deepEqual(shell.store.projects().find((x) => x.id === p.id).github, { 'github.com/acme/shop': idOfLogin('bob', 'pat') });
    assert.match(logText(), new RegExp(`\\[github\\] deleted ${ann} \\(ann\\)$`, 'm'));
    // Left for the restart: bob's token; the project goes.
    await closeSettings(ctx);
    shell.store.removeProject(p);
  });
};
