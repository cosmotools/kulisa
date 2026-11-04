// The empty window (docs/tasks.md, The empty window): the sidebar with every project, the welcome at the first start,
// the shared project flow there and in a dialog; the log a new project leaves.
import fs from 'fs';
import path from 'path';
import { fakeAgent } from './agent-helpers.ts';
import { test, expect } from './fixtures.ts';
import type { Locator, Page } from '@playwright/test';
import { ipcSettled, menu, choose, tabProjects, showProject, invoke, typeIn, notLoading, projectMenu, fromSidebar, sidebar, removed, answer, termKeys } from './helpers.ts';
import { begin, bothOn, taskShown, taskTab } from './tasks-helpers.ts';

// The keyboard taken from whatever has it.
const blur = async (ui: Page) => { if (await ui.locator(':focus').count()) await ui.locator(':focus').blur(); };

test("the empty window: Close All Tasks in the project's submenu; links in ☰ open in the browser; at the first start the welcome; New Project… in the sidebar asks where its folder goes", async ({ core, ui, files }) => {
  test.slow(); // the welcome, project creation, and three tasks opened again
  await begin(core, ui, files, { featureX: true });
  // A key taken and something typed into the terminal, for the log below.
  await core((k) => { const sam = k.profile('Sam.admin'); sam.focusTab(sam.get()); k.press(sam.get().wc, 'T', k.CMD); });
  await expect.poll(() => core((k) => k.profile('Sam.admin').tabs.length)).toBe(2);
  await core((k) => { const sam = k.profile('Sam.admin'); sam.closeTab(sam.tabs[1].id); });
  await expect.poll(() => core((k) => k.profile('Sam.admin').tabs.length)).toBe(1);
  await termKeys(ui).focus();
  await ui.keyboard.type('typed');

  const sub = await projectMenu(ui);
  // The row's place: the last of the rows.
  await expect(sub.getByRole('menuitem').last()).toHaveAccessibleName('Close All Tasks');
  await choose(ui, 'Close All Tasks', sub);
  await expect.poll(() => core((k) => k.shell.task === null && !k.shell.current)).toBe(true);
  await expect(ui.locator('html')).toHaveAttribute('data-page', /^(sidebar|welcome)$/);
  await ui.locator('#windowMenu').click();
  await expect(menu(ui)).toMatchAriaSnapshot(`
    - /children: contain
    - menuitem "Documentation"
    - menuitem "GitHub"
    - menuitem "Report a Problem…"
  `);
  const before = await core((k) => k.openedExternally.length);
  await choose(ui, 'Documentation');
  await expect.poll(() => core((k, n) => k.openedExternally.slice(n), before), { message: 'the user guide on the website' }).toEqual(['https://kulisa.app/docs']);
  expect(ui.url().startsWith('file:') && await ui.locator('#empty').count(), 'the window stays on its page').toBe(1);

  // With no project at all, the welcome introduces web and CLI work, then opens the shared project flow.
  // With projects, firstStart keeps the sidebar.
  await blur(ui);
  await core((k) => k.shell.firstStart(k.shell.windows[0]));
  await ipcSettled(ui); // what it told the window is there
  await expect(ui.locator('html'), 'projects there: nothing').toHaveAttribute('data-page', 'sidebar');
  await expect(sidebar(ui)).toBeVisible();
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
    await expect(tour.getByRole('heading', { level: 1 })).toHaveText(/Your agent builds.*You see it work/);
    await expect(tour.getByRole('tab', { name: 'Web app', exact: true })).toHaveAttribute('aria-selected', 'true');
    await tour.getByRole('tab', { name: 'CLI app', exact: true }).click();
    await expect(tour.getByRole('img', { name: /^A coding agent you are building/ })).toBeVisible();
    await tour.getByRole('tab', { name: 'Web app', exact: true }).click();
    await expect(tour.getByRole('img', { name: /^Customer browser profile/ })).toBeVisible();
    // A low window, wide or at the least size: the introduction fits, nothing to scroll to (its top not cut off above the
    // window's edge, out of scrolling's reach).
    const size = await core((k) => k.shell.win.getContentSize());
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
    await core((k, s) => k.shell.win.setContentSize(s[0], s[1]), size);
    await button('Create a project', tour).click();
    await expect(welcome.getByRole('heading', { name: 'Choose your agent' })).toBeFocused();
    await expect(welcome.getByRole('heading', { level: 1 })).toHaveText('Make room for your next project');
    await expect(button('Continue')).toBeDisabled();
    await expect(welcome.getByRole('textbox', { name: 'Project name' })).toHaveCount(0);
    await button('Back').click();
    await expect(button('Create a project', tour)).toBeVisible();
  } finally {
    await core((k) => {
      const s = k.shell, saved = k.stash.empty;
      s.store.projects = saved.projects; s.projects = saved.sent; s.accounts.all = saved.accounts; s.profileStore.all = saved.profiles;
      s.sendProjects();
    });
  }
  await expect(ui.locator('html')).toHaveAttribute('data-page', 'sidebar');

  // Agent setup is independent of project creation and is covered in agents.spec.ts.
  await fakeAgent(ui, files);
  const account = await core((k) => {
    const s = k.shell, r = s.accounts.prepare('fake') as { id: string; dir: string };
    s.accounts.create(r.id, 'fake', 'onboarding@shop.com');
    return r.id;
  });
  await ui.getByRole('button', { name: 'New Project…' }).click();
  const np = ui.getByRole('dialog', { name: 'New Project' });
  await expect(np).toBeVisible();
  await expect(np.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  await np.getByRole('button', { name: /Use Fake agent · onboarding@shop.com/ }).click();
  await expect(np.getByRole('radio', { name: /Start a new project/ })).toBeChecked();
  const field = (name: string) => np.getByRole('textbox', { name, exact: true });
  const next = () => np.getByRole('button', { name: 'Continue', exact: true }).click();
  const home = await core((k) => k.shell.projectsHome), color = await core((k) => k.shell.store.nextColor());
  const made = path.join(files.root, 'made');
  fs.mkdirSync(made, { recursive: true });
  const create = () => np.getByRole('button', { name: 'Create project', exact: true }).click();
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
  await expect(said).toHaveCSS('user-select', 'text');
  await expect(np.getByRole('heading', { name: 'New Project' })).toHaveCSS('user-select', 'none');
  await said.selectText();
  expect(await ui.evaluate(() => getSelection().toString())).toBe(await said.textContent());
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
  const shopId = files.pid('shop');
  expect(await core((k, id) => k.shell.profileStore.of(id).length, shopId)).toBe(0);
  expect(fs.existsSync(path.join(shopDir, '.git')), 'a new folder stays without git').toBe(false);
  // The log (window.md, The log): the start, the task and the channel that made it, a key taken; nothing typed into a
  // terminal.
  const logged = files.log();
  expect(logged, 'the time as ISO 8601 with its offset').toMatch(/^\[\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}[+-]\d\d:\d\d\] \[info\] \[kulisa\] start \d+\.\d+\.\d+, electron \d+\./m);
  expect(logged).toMatch(/\[kulisa\] encryption (available|not available)/);
  expect(logged, 'the run before quit as asked (the tests quit with app.quit)').not.toMatch(/did not quit by itself/);
  expect(logged).toMatch(new RegExp(`\\[ipc\\] task:new wc=\\d+ \\{"project":"${shopId}"\\}`));
  // The project named beside its id where it first appears (its id is random: store.ts).
  expect(logged).toMatch(new RegExp(`\\[project\\] ${shopId} loaded: Shop \\(\\S*Shop\\)`));
  expect(logged).toMatch(new RegExp(`\\[task\\] created ${shopId}/[a-z0-9]{6} \\(Shop\\) in \\S*Shop wc=\\d+`));
  expect(logged).toMatch(/\[key\] tab\.new zone=/);
  expect(logged, 'what is typed into a terminal is never logged').not.toMatch(/pty:in/);
  expect(await core((k, id) => { const p = k.shell.store.projects().find((x) => x.id === id); return [p.color, p.agents ?? null]; }, shopId)).toEqual([color, [account]]);
  // No favicon in its code: the next free color, the window's too.
  await expect(ui.locator(':root')).toHaveCSS('--project', color);
  expect(await core((k) => k.shell.task.folder), 'its first task works in it').toBe(shopDir);
  await expect(ui.locator('#settings')).toHaveCount(0);
  await notLoading(ui);
  await fromSidebar(ui, 'project', 'task-1'); // a closed task in the sidebar: opened again
  await expect.poll(() => core((k, f) => k.shell.current?.folder === f && k.shell.task?.name === 'task-1' && !!k.shell.task.loaded && !!k.shell.pty, files.project)).toBe(true);
  await core((k) => k.watchPty(k.shell.pty));
  await expect(ui.locator('html')).toHaveAttribute('data-page', 'task');
  await notLoading(ui);
  await bothOn(core, ui, files);
  // Feature-X, closed with the others, opened again from the sidebar over the grid.
  await fromSidebar(ui, 'project', 'Feature-X');
  await taskShown(core, files.tkey('project', 2));
  await taskTab(ui, files.tkey('project', 1)).click();
  await taskShown(core, files.tkey('project', 1));
  await notLoading(ui);
  expect(await tabProjects(ui, files)).toEqual(['shop', 'project *', 'project']);
  // Another project's task: a click shows it.
  const shopTask = files.tkey('shop', 1);
  await ui.locator(`#taskTabs [data-task="${shopTask}"]`).click();
  await expect.poll(() => core((k, a) => k.shell.current?.id === a.id && k.shell.task?.key === a.task && k.settled(), { id: shopId, task: shopTask })).toBe(true);
  await notLoading(ui);
  expect(await tabProjects(ui, files)).toEqual(['shop *', 'project', 'project']);
  await showProject(ui, files, 'project');
  await expect.poll(() => core((k, id) => k.shell.current?.id === id && !!k.shell.task.loaded, files.pid('project'))).toBe(true);
  // A tab in the background has its × too: the last one of its project lets the project go.
  await ui.locator(`#taskTabs [data-task="${shopTask}"] [aria-label="Close"]`).click();
  await expect.poll(() => core((k, id) => !k.shell.open.has(id), shopId)).toBe(true);
  expect(await core((k) => k.shell.current?.id), 'the shown project stays').toBe(files.pid('project'));

  // Shop and its account gone, for the test run again in this Kulisa.
  const deleted = invoke(ui, 'project:delete', { id: shopId });
  await answer(ui);
  await deleted;
  await core((k, id) => { const a = k.shell.accounts.find(id); k.shell.accounts.drop(id); k.shell.accounts.remove(a.dir); }, account);
  await removed(made);
});
