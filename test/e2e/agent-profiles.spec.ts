// Profiles, the human's and the agent's: made in Settings and by profile_create, who each is, renamed, signed in by the
// human when the agent asks; isolated, presenting as what they are, the sign-in pause (docs/profiles.md).
import { test, expect } from './fixtures.ts';
import { SITE, who, menuRows, choose, closeMenu, manageProfiles, closeSettings, chooseProfile, setProfileField, taskMenu } from './helpers.ts';
import { profiles, signIn, act, invoke } from './agent-helpers.ts';

test('profiles are made in Settings (Profiles\' + in its tree), each with its own picture and, if the human says, who it is; added to the project on its page, opened in its task; the pages stay on screen under Settings\' window', async ({ core, ui, sui, files }) => {
  // None yet, as in a new Kulisa: the profiles a test before left deleted as the human deletes them.
  for (const id of await core((k) => k.shell.profileStore.all().map((p) => p.id))) await invoke(ui, 'profiles:delete', { profile: id });
  await expect.poll(() => core((k) => k.shell.profileStore.all().length)).toBe(0);
  const s = await manageProfiles(ui, sui);
  await expect(s.locator('#prconfig .empty')).toHaveText('No profiles yet.');
  // + beside Profiles: its name typed in place under the tree, Enter; then it is chosen, its page shown (the picture:
  // the next free one, unless the human picks another).
  const make = async (name: string) => {
    await s.locator('#profilenew').click();
    await expect(s.locator('#profilenewname')).toBeFocused();
    await s.locator('#profilenewname').fill(name);
    await s.locator('#profilenewname').press('Enter');
    await expect(s.locator('#profilename')).toHaveValue(name);
    await expect(s.locator('#profilenewname')).toHaveCount(0);
    await expect(s.locator('#pjlist [aria-selected="true"] .label')).toHaveText(name);
  };
  const stored = (name: string) => core((k, id) => k.shell.profileStore.get(id), files.idOf(name));
  await make('Sam.seller');
  await setProfileField(s, 'profileabout', ' seller in the test shop ');
  await expect.poll(async () => (await stored('Sam.seller'))?.description).toBe('seller in the test shop');
  await make('Elon.buyer');
  expect((await stored('Elon.buyer')).avatar, 'the next picture free').toBe('frog');
  // Its picture's button looks as a field to choose from (.select): the chosen one, a chevron, the fields' background.
  expect(await s.locator('#profilepic').evaluate((p) => {
    const b = getComputedStyle(p), f = document.body.appendChild(document.createElement('i'));
    f.style.background = 'var(--field)'; const field = getComputedStyle(f).backgroundColor; f.remove(); return [b.display, b.backgroundColor === field];
  })).toEqual(['flex', true]);
  await s.locator('#profilepic').click();
  await expect(s.locator('.profilepics.ready')).toBeVisible();
  await expect(s.locator('.profilepics [data-avatar]'), 'all of them to choose from, at once').toHaveCount(16);
  await s.locator('.profilepics [data-avatar="penguin"]').click();
  await expect.poll(async () => (await stored('Elon.buyer')).avatar).toBe('penguin');
  // Who they are: in the store of profiles (profile-store.ts), the same in every task; in no project yet.
  expect(await core((k) => k.shell.profileStore.all().map((g: { id: string; avatar: string; description?: string; color?: string }) => ({ id: g.id, avatar: g.avatar, description: g.description, projects: k.shell.profileStore.projectsOf(g as never), color: g.color }))),
    'pictures, not colors; who it is when said').toEqual([
    { id: files.idOf('Sam.seller'), avatar: 'fox', description: 'seller in the test shop', projects: [], color: undefined },
    { id: files.idOf('Elon.buyer'), avatar: 'penguin', description: undefined, projects: [], color: undefined }]);
  await expect(s.locator('#profilepage .projects')).toHaveText("none: add it on a project's page");
  // Added on the project's page (+ → its other profiles), closed in its task; opened there (👥).
  const project = await core((k) => k.shell.current.id);
  await s.locator(`#pjlist [data-project="${project}"]`).click(); // the projects come as it opens
  for (const name of ['Sam.seller', 'Elon.buyer']) {
    // The profiles to add are asked for again as the page is shown: the menu may open before they come.
    await expect(async () => {
      await s.locator('#npprofileadd').click();
      const has = (await menuRows(s)).includes(name);
      if (!has) await closeMenu(s);
      expect(has).toBe(true);
    }).toPass();
    await choose(s, name);
    const row = s.locator('#npprofiles .item').filter({ has: s.locator('.label', { hasText: new RegExp(`^${RegExp.escape(name)}$`) }) });
    await expect(row).toHaveCount(1);
    // A row cuts its name and description: the whole in its tooltip.
    expect((await row.getAttribute('title')).split('\n')[0]).toBe(name);
  }
  const [sam, elon] = [files.idOf('Sam.seller'), files.idOf('Elon.buyer')];
  await expect.poll(() => core((k, a) => k.shell.closed.has(a[0]) && k.shell.closed.has(a[1]), [sam, elon])).toBe(true);
  await act(ui, 'profile:open', { profile: sam });
  await act(ui, 'profile:open', { profile: elon });
  expect(await core((k) => [...k.shell.profiles.keys()])).toEqual([sam, elon]);
  // Settings is a window of its own: the task's pages stay on screen and live (a dialog had hidden them). Elon's first
  // tab comes after it is opened.
  await expect.poll(() => core((k, id) => !!k.shell.profiles.get(id).get()?.view.getVisible(), elon)).toBe(true);
  await closeSettings(core, ui, sui);
  await expect(ui.locator('.pane')).toHaveCount(2);
  // The first page over the terminal alone took half the grid (dockview's split); the terminal keeps its share.
  const share = await ui.evaluate(() => (window as any).__dock.getPanel('terminal').group.api.height / (window as any).__dock.height);
  expect(Math.abs(share - 0.35), `the terminal's share: ${share}`).toBeLessThan(0.03);
});

test('agent: create a profile with profile_create; removed from the project, it stays in Settings → Profiles until deleted there', async ({ core, call, ui, files }) => {
  await profiles(core);
  const r = await call('profile_create', { name: 'Ann.admin', description: 'the shop\'s admin' });
  expect(r.text).toMatch(/Created profile Ann\.admin\./);
  const ann = files.idOf('Ann.admin');
  expect(await core((k, id) => k.shell.profiles.has(id), ann)).toBe(true);
  const list: { name: string; avatar: string; description: string | null }[] = JSON.parse((await call('profile_list', {})).text);
  expect(list.map((p) => p.name), 'by name: the agent never sees an id').toEqual(['Sam.seller', 'Elon.buyer', 'Ann.admin']);
  expect(list.every((p) => !('id' in p))).toBe(true);
  expect(list.map((p) => [p.avatar, p.description])).toEqual([['fox', 'seller in the test shop'], ['penguin', null], ['frog', 'the shop\'s admin']]);
  await expect(ui.locator('.pane')).toHaveCount(3);
  await act(ui, 'profile:delete', { profile: ann }); // Remove from Project… in its pane's menu
  expect(await core((k) => k.asked.at(-1).message)).toMatch(/^Remove the profile Ann\.admin from /);
  await expect.poll(() => core((k, id) => k.shell.profiles.has(id), ann)).toBe(false);
  expect(await core((k, id) => k.shell.profileStore.projectsOf(k.shell.profileStore.get(id)), ann), 'kept, in no project').toEqual([]);
  await invoke(ui, 'profiles:delete', { profile: ann });
  expect(await core((k) => k.asked.at(-1).message)).toBe('Delete the profile Ann.admin?');
  await expect.poll(() => core((k, id) => k.shell.profileStore.get(id), ann)).toBeNull();
});

test('who a profile is: the agent is told to choose by it and to ask; it saves the human\'s answer, Settings → Profiles shows it', async ({ core, call, ui, sui, mcp, files }) => {
  const { elon } = await profiles(core);
  expect((await mcp()).getInstructions(), 'every agent, also without the skill').toMatch(/by its description .* ask the human once .* profile_describe/s);
  const description = () => core((k) => k.profile('Elon.buyer').description);
  expect((await call('profile_describe', { profile: 'Elon.buyer', description: 'buyer; pays by card' })).text).toMatch(/Saved/);
  expect(await description()).toBe('buyer; pays by card');
  await expect(call('profile_describe', { profile: 'Elon.buyer', description: 'x'.repeat(501) })).rejects.toThrow(/at most 500/);
  // The editor shows it and the human changes it there; the pane's name tells it on hover (under the whole name, which a
  // narrow pane cuts), the task's tab's menu under the name.
  const header = ui.locator('.ptab').filter({ has: ui.locator('.pname', { hasText: /^Elon\.buyer$/ }) });
  await expect(header.locator('.pname')).toHaveAttribute('title', /^Elon\.buyer\nbuyer; pays by card/);
  await expect.poll(() => header.locator('.avatar').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true); // the picture is drawn
  await taskMenu(ui);
  expect(await ui.locator('.menu[data-state="open"] .item').evaluateAll((items) => items.slice(0, 2).map((b) => [b.querySelector('small').textContent, b.querySelector('.avatar').getAttribute('src')])))
    .toEqual([['seller in the test shop', 'avatars/fox.svg'], ['buyer; pays by card', 'avatars/penguin.svg']]);
  await closeMenu(ui);
  // Settings → Profiles shows it and the human changes it there.
  const s = await manageProfiles(ui, sui);
  await chooseProfile(s, files, 'Elon.buyer');
  await expect(s.locator('#profileabout')).toHaveValue('buyer; pays by card');
  expect(await s.locator('#profileabout').evaluate((a: HTMLTextAreaElement) => [a.localName, a.rows, getComputedStyle(a).resize]), 'two lines, made taller by hand')
    .toEqual(['textarea', 2, 'vertical']);
  await setProfileField(s, 'profileabout', '');
  await expect.poll(description).toBe('');
  // The picture: a panel of them from the button beside it; one chosen, it goes.
  await s.locator('#profilepic').click();
  await expect(s.locator('.profilepics.ready')).toBeVisible();
  await s.locator('.profilepics [data-avatar="owl"]').click();
  await expect.poll(() => core((k) => k.profile('Elon.buyer').avatar)).toBe('owl');
  await expect(s.locator('.profilepics')).toHaveCount(0);
  await expect(s.locator('#profilepic .avatar')).toHaveAttribute('src', 'avatars/owl.svg');
  expect((await s.evaluate((id) => (window as any).kulisa.invoke('profiles:avatar', { profile: id, avatar: 'dragon' }), elon)).error).toMatch(/no picture/);
  await closeSettings(core, ui, sui);
});

test('agent: rename a profile; ask the human to sign one in and wait until they are through', async ({ core, call, ui }) => {
  const { elon } = await profiles(core);
  expect((await call('profile_rename', { profile: 'elon.BUYER', name: 'elon.payer' })).text).toMatch(/Renamed elon\.BUYER to elon\.payer\./);
  expect(await core((k, id) => k.shell.profiles.get(id).name, elon), 'the same profile').toBe('elon.payer');
  expect((await call('browser_snapshot', { profile: 'Elon.payer' })).text, 'by its new name').toMatch(/Profile: Elon\.payer/);
  await expect(call('browser_snapshot', { profile: 'Elon.buyer' })).rejects.toThrow(/No profile "Elon\.buyer"\. Profiles: Sam\.seller, elon\.payer/);
  await expect(call('profile_rename', { profile: 'elon.payer', name: 'SAM.seller' }), 'names are unique in a project, whatever their case')
    .rejects.toThrow(/a profile SAM\.seller is in the project .* already/);
  await call('profile_rename', { profile: 'elon.payer', name: 'Elon.buyer' });
  const back = await core((k) => k.profile('Elon.buyer').get().wc.getURL());
  const asking = call('profile_ask_signin', { profile: 'Elon.buyer', url: `${SITE}/form`, why: 'as Elon' });
  const caption = ui.locator(`.ptab[data-panel="profile:${elon}"] .caption`);
  await expect(caption).toContainText('sign in, please: as Elon');
  expect(await core((k) => k.profile('Elon.buyer').get().wc.getURL()), 'the sign-in page opened').toMatch(/\/form$/);
  await core((k, url) => { void k.profile('Elon.buyer').get().wc.loadURL(url); }, back); // the human signs in and lands elsewhere
  expect((await asking).text).toMatch(/The human is through/);
  await expect(caption).toHaveText('');
});

test('profiles are isolated', async ({ core, call }) => {
  await profiles(core);
  await signIn(call, 'Sam.seller', 'sam');
  await call('browser_navigate', { profile: 'Elon.buyer', url: `${SITE}/app` });
  expect(await who(call, 'Sam.seller')).toBe('Signed in as sam');
  expect(await who(call, 'Elon.buyer')).toBe('Signed out');
});
