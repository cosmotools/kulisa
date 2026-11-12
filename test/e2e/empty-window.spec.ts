import { taskPage } from './pages.ts';
// The empty window and welcome, New Project validation and creation (docs/tasks.md, The empty window and Projects).
import fs from 'fs';
import path from 'path';
import { test, expect } from './fixtures.ts';
import type { Core } from './fixtures.ts';
import type { Files } from './data.ts';
import { fakeAgent } from './agent-helpers.ts';
import type { Locator, Page } from '@playwright/test';
import { ipcSettled, choose, invoke, typeIn, notLoading, projectMenu, fromSidebar, sidebar, removed, answer, termKeys, termShows } from './helpers.ts';
import { begin, taskShown } from './tasks-helpers.ts';

// Closing through the menu is tested below; other scenarios need only the resulting empty window.
async function emptyWindow(core: Core, ui: Page) {
  for (const id of await core((k) => [...k.shell.open.keys()])) await invoke(ui, 'project:task:close-all', { id });
  await expect(ui.locator('html')).toHaveAttribute('data-page', 'sidebar');
}

test('Close All Tasks leaves the empty window, where documentation opens externally and tasks can be reopened', async ({ core, ui, files }) => {
  await begin(core, ui, files, { only: true, featureX: true });
  const sub = await projectMenu(ui);
  await expect(sub.getByRole('menuitem').last()).toHaveAccessibleName('Close All Tasks');
  await choose(ui, 'Close All Tasks', sub);
  await expect(ui.locator('html')).toHaveAttribute('data-page', 'sidebar');
  expect(await core((k) => k.shell.task)).toBeNull();
  await ui.locator('#windowMenu').click();
  const before = await core((k) => k.openedExternally.length);
  await choose(ui, 'Documentation');
  await expect.poll(() => core((k, n) => k.openedExternally.slice(n), before)).toEqual(['https://kulisa.app/docs']);
  expect(ui.url()).toMatch(/^file:/);
  // A welcome request with existing projects keeps the sidebar.
  await core((k) => k.shell.firstStart(k.shell.windows[0]));
  await ipcSettled(ui);
  await expect(sidebar(ui)).toBeVisible();
  await expect(ui.locator('#welcome')).toHaveCount(0);
  for (const [name, nth] of [['task-1', 1], ['Feature-X', 2]] as const) {
    await fromSidebar(ui, 'project', name);
    await taskShown(core, files.tkey('project', nth));
  }
});

test('the first-start welcome introduces web and CLI work and opens the shared project flow', async ({ core, ui }) => {
  await emptyWindow(core, ui);
  // Blur before the welcome requests focus, as when the last task closes.
  if (await ui.locator(':focus').count()) await ui.locator(':focus').blur();
  const kept = await core((k) => {
    const p = k.shell.profileStore.create(null, { name: 'Welcome-kept' });
    if ('error' in p) throw new Error(p.error);
    return p.id;
  });
  const size = await core((k) => k.shell.win.getContentSize());
  const gear = ui.locator('#settingsButton');
  await expect(gear).toBeVisible();
  await core((k) => {
    const s = k.shell;
    k.stash.empty = { projects: s.store.projects, sent: s.projects, accounts: s.accounts.all, profiles: s.profileStore.all };
    s.store.projects = () => []; s.projects = () => [];
  });
  const tour = ui.getByRole('region', { name: 'What Kulisa does' }), welcome = ui.locator('#welcome');
  const button = (name: string, within: Locator = welcome) => within.getByRole('button', { name, exact: true });
  try {
    await core((k) => { k.shell.sendProjects(); k.shell.firstStart(k.shell.windows[0]); });
    await expect(button('Create a project', tour)).toBeFocused();
    await expect(ui.locator('html')).toHaveAttribute('data-page', 'welcome');
    await expect(sidebar(ui), 'nothing to list').toHaveCount(0);
    // Settings' gear: there while it has anything to show (an account, a profile left after their projects), none
    // at the first start.
    await expect(gear, 'accounts and profiles there').toBeVisible();
    await core((k) => {
      const s = k.shell, saved = k.stash.empty;
      s.accounts.all = () => saved.accounts.call(s.accounts).filter((a: { own?: boolean }) => a.own); s.profileStore.all = () => [];
      s.sendProjects();
    });
    await expect(gear).toBeHidden();
    await expect(tour.getByRole('heading', { level: 1 })).toHaveText(/Your agentic IDE.*Build together/);
    await expect(tour.getByRole('tab', { name: 'Web app', exact: true })).toHaveAttribute('aria-selected', 'true');
    // Include reduced content height when desktop panels and the native frame take some screen space.
    for (const height of [960, 944]) {
      await core((k, h) => k.shell.win.setContentSize(1280, h), height);
      await expect.poll(() => ui.evaluate(() => [innerWidth, innerHeight])).toEqual([1280, height]);
      const before = await tour.boundingBox();
      const tabsBefore = await tour.getByRole('tablist').boundingBox();
      const pauseBefore = await button('Pause demonstration', tour).boundingBox();
      for (const name of ['CLI app', 'Web app']) {
        await tour.getByRole('tab', { name, exact: true }).click();
        await expect(tour.getByRole('img', { name: name === 'CLI app' ? /^A coding agent you are building/ : /^Customer browser profile/ })).toBeVisible();
        for (const text of ['Try the real app', 'Work together', 'Keep work moving']) await expect(tour.getByText(text, { exact: true })).toBeVisible();
        // Native window sizing is outside Playwright's viewport emulation. Check the page's actual scroll and edges.
        await expect.poll(() => ui.evaluate(() => {
          const e = document.getElementById('welcome'), r = document.querySelector('[aria-label="What Kulisa does"]').getBoundingClientRect();
          return e.scrollHeight <= e.clientHeight && e.scrollWidth <= e.clientWidth && r.top >= e.getBoundingClientRect().top && r.bottom <= innerHeight;
        }), `${name}: the full welcome fits at 1280×${height}`).toBe(true);
        await expect.poll(() => tour.boundingBox(), `${name}: the introduction stays in place`).toEqual(before);
        await expect.poll(() => tour.getByRole('tablist').boundingBox(), `${name}: the tabs stay in place`).toEqual(tabsBefore);
        await expect.poll(() => button('Pause demonstration', tour).boundingBox(), `${name}: the frame keeps its size`).toEqual(pauseBefore);
      }
    }
    // A low window, wide or at the least size: the introduction fits, nothing to scroll to (its top not cut off above the
    // window's edge, out of scrolling's reach).
    for (const [w, h] of [[1100, 400], [1600, 400], [640, 400]]) {
      await core((k, a) => k.shell.win.setContentSize(a[0], a[1]), [w, h]);
      // The page's own size and scroll: Playwright's viewportSize is the one it emulates, and it has no scroll reading.
      await expect.poll(() => ui.evaluate(() => [innerWidth, innerHeight])).toEqual([w, h]);
      // Polled: the introduction follows the window's size as its media queries change, a frame after the resize.
      await expect.poll(() => ui.evaluate(() => {
        const e = document.getElementById('welcome'), t = document.querySelector('[aria-label="What Kulisa does"]');
        return e.scrollHeight <= e.clientHeight && t.getBoundingClientRect().top >= e.getBoundingClientRect().top;
      }), `${w}×${h}: the introduction fits`).toBe(true);
    }
    await button('Create a project', tour).click();
    await expect(welcome.getByRole('heading', { name: 'Choose your agent' })).toBeFocused();
    await expect(welcome.getByRole('heading', { level: 1 })).toHaveText('Make room for your next project');
    await expect(button('Continue')).toBeDisabled();
    await expect(welcome.getByRole('textbox', { name: 'Project name' })).toHaveCount(0);
    await button('Back').click();
    await expect(button('Create a project', tour)).toBeVisible();
  } finally {
    await core((k, s) => k.shell.win.setContentSize(s[0], s[1]), size);
    await core((k) => {
      const s = k.shell, saved = k.stash.empty;
      s.store.projects = saved.projects; s.projects = saved.sent; s.accounts.all = saved.accounts; s.profileStore.all = saved.profiles;
      s.sendProjects();
    });
    await core((k, id) => { k.shell.profileStore.delete(id); }, kept);
  }
  await expect(ui.locator('html')).toHaveAttribute('data-page', 'sidebar');
});

// Agent installation and sign-in have their own scenarios; these tests begin with a connected account.
async function projectForm(core: Core, ui: Page, files: Files) {
  await emptyWindow(core, ui);
  await fakeAgent(ui, files);
  const account = await core((k) => {
    const s = k.shell, r = s.accounts.prepare('fake') as { id: string };
    s.accounts.create(r.id, 'fake', 'onboarding@shop.com');
    return r.id;
  });
  await ui.getByRole('button', { name: 'New Project…' }).click();
  const np = ui.getByRole('dialog', { name: 'New Project' });
  await expect(np.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  await np.getByRole('button', { name: /Use Fake agent · onboarding@shop.com/ }).click();
  await expect(np.getByRole('radio', { name: 'Start a new project', exact: true })).toBeChecked();
  return { np, account };
}
const dropAccount = (core: Core, account: string) => core((k, id) => {
  const a = k.shell.accounts.find(id);
  k.shell.accounts.drop(id); k.shell.accounts.remove(a.dir);
}, account);

test('New Project validates its name and location, lets the human browse and copy an error', async ({ core, ui, files }) => {
  const { np, account } = await projectForm(core, ui, files);
  const field = (name: string) => np.getByRole('textbox', { name, exact: true });
  const made = path.join(files.root, 'made');
  try {
    const next = () => np.getByRole('button', { name: 'Continue', exact: true }).click();
    const home = await core((k) => k.shell.projectsHome);
    fs.mkdirSync(made, { recursive: true });
    await next();
    await expect(np.getByRole('alert')).toContainText('Enter a folder name.');
    await expect(field('Create in')).toHaveValue(home);
    await core((k, f) => {
      k.stash.open = k.electron.dialog.showOpenDialog;
      k.electron.dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [f] }));
    }, made);
    try {
      await np.getByRole('button', { name: 'Browse location' }).click();
      await expect(field('Create in')).toHaveValue(made);
    } finally { await core((k) => { k.electron.dialog.showOpenDialog = k.stash.open; }); }
    await typeIn(ui, field('Folder name'), 'CON.v2');
    await next();
    await expect(np.getByRole('alert')).toContainText('reserved by Windows');
    expect((await invoke(ui, 'project:new', { from: 'new', name: 'Valid Label', directoryName: 'CON.v2', location: made })).error)
      .toContain('reserved by Windows');
    await typeIn(ui, field('Folder name'), 'shop.v2');
    await np.getByRole('radio', { name: 'Clone a repository', exact: true }).check();
    await field('Repository URL').fill('https://example.test/backend.git');
    await field('Folder name').fill('backend.v2');
    await np.getByRole('radio', { name: 'Start a new project', exact: true }).check();
    await expect(field('Folder name')).toHaveValue('shop.v2');
    await np.getByRole('radio', { name: 'Clone a repository', exact: true }).check();
    await expect(field('Folder name')).toHaveValue('backend.v2');
    await np.getByRole('radio', { name: 'Start a new project', exact: true }).check();
    await next();
    await expect(np.getByRole('heading', { name: 'Shop V2', exact: true })).toBeVisible();
    expect(fs.existsSync(path.join(made, 'shop.v2')), 'Continue does not create the folder').toBe(false);
    await np.getByRole('button', { name: 'Back', exact: true }).click();
    const taken = path.join(made, 'taken');
    fs.mkdirSync(taken);
    await typeIn(ui, field('Folder name'), 'taken');
    await next();
    await expect(np.getByRole('alert')).toContainText('This folder already exists.');
    for (const from of ['new', 'clone']) {
      expect((await invoke(ui, 'project:new', { from, name: 'Taken', directoryName: 'taken', location: made })).error)
        .toContain('This folder already exists.');
      expect(fs.readdirSync(taken), `${from} leaves the existing empty folder intact`).toEqual([]);
    }
    fs.writeFileSync(path.join(taken, 'keep.txt'), 'keep');
    expect((await invoke(ui, 'project:new', { name: 'Taken', directoryName: 'taken', location: made })).error)
      .toContain('This folder already exists.');
    expect(fs.readFileSync(path.join(taken, 'keep.txt'), 'utf8')).toBe('keep');
    fs.writeFileSync(path.join(made, 'note'), '');
    await typeIn(ui, field('Folder name'), 'note');
    await next();
    const error = np.getByRole('alert');
    await expect(error).toContainText('This path is a file. Choose a folder.');
    const said = error.getByText('This path is a file. Choose a folder.');
    await said.selectText();
    expect(await ui.evaluate(() => getSelection().toString())).toBe(await said.textContent());
  } finally {
    await np.press('Escape');
    await expect(np).toHaveCount(0);
    await dropAccount(core, account);
    await removed(made);
  }
});

test('creating a project keeps the chosen account and folder and logs the action without terminal input', async ({ core, ui, files }) => {
  const { np, account } = await projectForm(core, ui, files);
  const field = (name: string) => np.getByRole('textbox', { name, exact: true });
  const next = () => np.getByRole('button', { name: 'Continue', exact: true }).click();
  const create = () => np.getByRole('button', { name: 'Create project', exact: true }).click();
  const made = path.join(files.root, 'created');
  let shopId: string | null = null;
  try {
    await field('Create in').fill(made);
    await typeIn(ui, field('Folder name'), 'Shop');
    await next();
    await expect(np.getByRole('heading', { name: 'Shop', exact: true })).toBeVisible();
    await np.getByRole('button', { name: 'Edit name' }).click();
    await field('Project name').fill('');
    await create();
    await expect(np.getByRole('alert')).toContainText('Give your project a name.');
    await typeIn(ui, field('Project name'), 'My Shop');
    await np.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(field('Folder name'), 'display name never renames the destination').toHaveValue('Shop');
    await expect(field('Create in')).toHaveValue(made);
    await next();
    await expect(np.getByRole('heading', { name: 'My Shop', exact: true })).toBeVisible();
    await np.getByRole('button', { name: 'Edit name' }).click();
    await typeIn(ui, field('Project name'), 'Shop');
    await np.getByRole('radio', { name: 'CLI app', exact: true }).check();
    await expect(np.getByText(/Help me build my own coding agent/)).toBeVisible();
    await np.getByRole('button', { name: 'Back', exact: true }).click();
    await next();
    await expect(np.getByRole('heading', { name: 'Shop', exact: true })).toBeVisible();
    await expect(np.getByRole('radio', { name: 'CLI app', exact: true })).toBeChecked();
    await create();
    const shopDir = path.join(made, 'Shop');
    await expect.poll(() => core((k, f) => k.shell.current?.folder === f && !!k.shell.task?.loaded && !!k.shell.pty, shopDir)).toBe(true);
    await expect(ui.getByRole('alertdialog'), 'nothing asked').toHaveCount(0);
    shopId = files.pid('shop');
    expect(await core((k, id) => k.shell.profileStore.of(id).length, shopId)).toBe(0);
    expect(fs.existsSync(path.join(shopDir, '.git')), 'a new folder stays without git').toBe(false);
    expect(await core((k, id) => k.shell.store.projects().find((p) => p.id === id).agents, shopId)).toEqual([account]);
    await notLoading(ui);
    const typed = 'private-terminal-input';
    await expect((await taskPage(ui)).getByRole('tab', { name: 'Agents', exact: true })).toHaveAttribute('aria-selected', 'true');
    await (await termKeys(ui)).pressSequentially(typed);
    await termShows(ui, typed);
    const logged = files.log();
    expect(logged).toMatch(new RegExp(`\\[ipc\\] task:new wc=\\d+ \\{"project":"${shopId}"\\}`));
    expect(logged).toMatch(new RegExp(`\\[project\\] ${shopId} loaded: Shop `));
    expect(logged).toMatch(new RegExp(`\\[task\\] created ${shopId}/[a-z0-9]{6} \\(Shop\\)`));
    expect(logged).not.toContain(typed);
    expect(logged).not.toContain('pty:in');
  } finally {
    if (shopId) {
      const deleted = invoke(ui, 'project:delete', { id: shopId });
      await answer(ui);
      await deleted;
    }
    await dropAccount(core, account);
    await removed(made);
  }
});
