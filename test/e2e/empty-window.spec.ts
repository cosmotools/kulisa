// The empty window (docs/tasks.md, The empty window): the sidebar with every project, the welcome at the first start,
// New Project's steps there and in a dialog; the log a new project leaves.
import fs from 'fs';
import path from 'path';
import { test, expect } from './fixtures.ts';
import type { Locator, Page } from '@playwright/test';
import { ipcSettled, menu, choose, tabProjects, showProject, invoke, typeIn, notLoading, projectMenu, fromSidebar, sidebar, removed, answer, termKeys } from './helpers.ts';
import { begin, bothOn, taskShown, taskTab, deleteProfile } from './tasks-helpers.ts';

// The keyboard taken from whatever has it.
const blur = async (ui: Page) => { if (await ui.locator(':focus').count()) await ui.locator(':focus').blur(); };

test("the empty window: Close All Tasks in the project's submenu; links in ☰ open in the browser; at the first start the welcome; New Project… in the sidebar asks where its folder goes", async ({ core, ui, files }) => {
  test.slow(); // the welcome's slides, New Project's steps, and three tasks opened again
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

  // With no project at all, the empty window is the welcome: what Kulisa does in three slides, the keyboard on Next
  // at the first start; then New Project's steps, a question each. With projects, the sidebar, and nothing happens.
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
    await expect(button('Next', tour)).toBeFocused();
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
    const slide = async (title: string, next: string) => {
      await expect(tour.getByRole('heading', { level: 1 })).toHaveText(title);
      await expect(tour.getByRole('button', { name: /^(Next|Set Up a Project)$/ })).toHaveText(next);
    };
    await slide('Your agent, in your browsers', 'Next');
    await button('Next', tour).click();
    await button('Next', tour).click();
    await slide('Point at it, and say what is wrong', 'Set Up a Project');
    await button('Back', tour).click();
    await slide('It checks the result as every user', 'Next');
    // A low window, wide or at the least size: the slide fits, nothing to scroll to (its top not cut off above the
    // window's edge, out of scrolling's reach).
    const size = await core((k) => k.shell.win.getContentSize());
    for (const [w, h] of [[1100, 400], [640, 400]]) {
      await core((k, a) => k.shell.win.setContentSize(a[0], a[1]), [w, h]);
      // The page's own size and scroll: Playwright's viewportSize is the one it emulates, and it has no scroll reading.
      await expect.poll(() => ui.evaluate(() => [innerWidth, innerHeight])).toEqual([w, h]);
      // Polled: the slide follows the window's size as its media queries change, a frame after the resize.
      await expect.poll(() => ui.evaluate(() => {
        const e = document.getElementById('welcome'), t = document.querySelector('[aria-label="What Kulisa does"]');
        return e.scrollHeight <= e.clientHeight && t.getBoundingClientRect().top >= e.getBoundingClientRect().top;
      }), `${w}×${h}: the slide fits`).toBe(true);
    }
    await core((k, s) => k.shell.win.setContentSize(s[0], s[1]), size);
    await button('Skip', tour).click();
    const field = (name: string) => welcome.getByRole('textbox', { name, exact: true });
    await expect(field('Project name')).toBeFocused();
    // A question, not the steps' names.
    await expect(welcome.getByRole('heading', { level: 1 })).toHaveText('Where is the code?');
    await expect(welcome.getByRole('list', { name: 'Steps' }).getByRole('listitem')).toHaveCount(3);
    await expect(welcome.getByText('Agents', { exact: true }), "no steps' names").toHaveCount(0);
    await expect(button('Next')).toBeVisible();
    // Code from the disk or a URL: one folder or one URL, in a field, not a list (the others later, in Settings); its
    // name the folder's or the repository's, no field for it unless it will not do. A new folder's is asked.
    const kind = async (from: string) => {
      await welcome.getByRole('tab', { name: from }).click();
      await expect(welcome.getByRole('tab', { name: from })).toHaveAttribute('aria-selected', 'true');
    };
    const where = welcome.getByRole('status', { name: 'What will happen' });
    const single = path.join(files.root, 'single', 'Shop');
    fs.mkdirSync(single, { recursive: true });
    await kind('Folders on Disk');
    await expect(welcome.getByRole('group', { name: 'Folders' })).toHaveCount(0);
    await expect(welcome.getByText(/^A frontend and a backend\?/)).toHaveCount(1);
    await typeIn(ui, field('Folder'), single, true);
    await expect(where).toHaveText(`The project Shop takes ${single} as it is`);
    await expect(field('Project name'), "its name: the folder's").toHaveCount(0);
    await kind('Clone from URL');
    // A clone whose folder is there already, with files: its name to change, in its field.
    const home = await core((k) => k.shell.projectsHome), taken = path.join(home, 'taken');
    fs.mkdirSync(taken, { recursive: true });
    fs.writeFileSync(path.join(taken, 'notes.txt'), '');
    await typeIn(ui, field('URL'), 'https://example.com/me/taken.git', true);
    await expect(field('Project name')).toHaveValue('taken');
    await expect(field('Location'), 'refused at its field').toHaveAccessibleDescription(/is there already: choose another name or location/);
    await kind('New Folder');
    await expect(field('Project name')).toHaveCount(1);
    // Once the git that looked at it (whether it is a repository) has left it: Windows does not remove a process's folder.
    await removed(taken);
    // Back on the first step: the slides again, on the one left.
    await button('Back').click();
    await expect(tour.getByRole('heading', { level: 1 })).toHaveText('It checks the result as every user');
  } finally {
    await core((k) => {
      const s = k.shell, saved = k.stash.empty;
      s.store.projects = saved.projects; s.projects = saved.sent; s.accounts.all = saved.accounts; s.profileStore.all = saved.profiles;
      s.sendProjects();
    });
  }
  await expect(ui.locator('html')).toHaveAttribute('data-page', 'sidebar');

  // New Project… at the sidebar's foot: the same steps in a dialog.
  await ui.getByRole('button', { name: 'New Project…' }).click();
  const np = ui.getByRole('dialog', { name: 'New Project' });
  await expect(np).toBeVisible();
  const field = (name: string) => np.getByRole('textbox', { name, exact: true });
  await expect(field('Name')).toHaveCount(1);

  // Its code: a name and where its folder goes, the home folder unless another is chosen.
  const home = await core((k) => k.shell.projectsHome);
  await expect(field('Location'), "every new project's place (~/KulisaProjects; the tests' own here)").toHaveValue(home);
  const color = await core((k) => k.shell.store.nextColor());
  const made = path.join(files.root, 'made');
  fs.mkdirSync(path.join(made, 'Taken'), { recursive: true });
  fs.writeFileSync(path.join(made, 'Taken', 'notes.txt'), '');
  await core((k, f) => {
    const d = k.electron.dialog;
    k.stash.open = d.showOpenDialog;
    d.showOpenDialog = (async () => ({ canceled: false, filePaths: [f] }));
  }, made);
  try {
    await np.getByRole('button', { name: 'Browse…' }).click();
    await expect(field('Location')).toHaveValue(made);
  } finally { await core((k) => { k.electron.dialog.showOpenDialog = k.stash.open; }); }
  // The step shown (its number, then its name); Next as the human goes on.
  const step = (name: string) => expect(np.getByRole('list', { name: 'Steps' }).locator('[aria-current="step"]')).toHaveText(new RegExp(`^.${name}$`));
  const next = () => np.getByRole('button', { name: /^(Next|Create)$/ }).click();
  const where = np.getByRole('status', { name: 'What will happen' }), error = np.getByRole('alert');
  // A folder there already would be taken as it is (the form says so as it is typed); a file is refused at its field,
  // and Next does not go on.
  await typeIn(ui, field('Name'), 'Taken');
  await expect(where).toHaveText(`${path.join(made, 'Taken')} is there already: the project takes it as it is, its files kept`);
  fs.writeFileSync(path.join(made, 'note'), '');
  await typeIn(ui, field('Name'), 'note');
  await expect(field('Location')).toHaveAccessibleDescription(/is a file, not a folder/);
  await next();
  await expect(error).toContainText(/is a file, not a folder/);
  await step('Code'); // not on
  // An error is text to copy and search for: it can be selected (the window's other words cannot). What is selected
  // read in the page: Playwright has no getter of the selection.
  const said = error.getByText(/is a file, not a folder/);
  await expect(said).toHaveCSS('user-select', 'text');
  await expect(np.getByRole('heading', { name: 'New Project' })).toHaveCSS('user-select', 'none');
  await said.selectText();
  expect(await ui.evaluate(() => getSelection().toString())).toBe(await said.textContent());
  await typeIn(ui, field('Name'), 'Shop');
  await expect(where).toHaveText(`The project will be created in ${path.join(made, 'Shop')}`);
  await next();
  // Its agents: the accounts there are, to tick (none here: its tasks start with a terminal), and a new one of each
  // agent an account can be made of (its sign-in: the agents' tests).
  await step('Agents');
  const accounts: string[] = (await invoke(ui, 'account:list')).accounts.map((a: { id: string }) => a.id);
  const rows = np.getByRole('group', { name: 'Accounts' }).locator('[data-account]');
  await expect(rows).toHaveCount(accounts.length);
  for (const [i, id] of accounts.entries()) await expect(rows.nth(i)).toHaveAttribute('data-account', id);
  await expect.poll(() => np.locator('[data-add]').count()).toBeGreaterThan(0); // Add account: an agent to make one of, once they are found (behind the steps)
  await np.getByRole('button', { name: 'Back' }).click();
  await step('Code');
  await expect(field('Name')).toHaveValue('Shop'); // Back: as it was
  await next();
  await step('Agents');
  await next();
  // Its profiles: a new one, named and said who it is; Create makes the project with it and opens its first task,
  // nothing asked, no Settings.
  await step('Profiles');
  await expect(np.getByRole('button', { name: 'Create' })).toBeVisible();
  await np.getByRole('button', { name: 'Add Profile' }).click();
  const profiles = np.getByRole('group', { name: 'Profiles' });
  await profiles.getByRole('textbox', { name: 'Name' }).fill('Shop-buyer');
  await profiles.getByRole('textbox', { name: 'Who it is' }).fill('buys things');
  await next();
  const shopDir = path.join(made, 'Shop');
  await expect.poll(() => core((k, f) => k.shell.current?.folder === f && !!k.shell.task?.loaded && !!k.shell.pty, shopDir)).toBe(true);
  await expect(ui.getByRole('alertdialog'), 'nothing asked').toHaveCount(0);
  const shopId = files.pid('shop');
  expect(await core((k, id) => k.shell.profileStore.of(id).map((p) => [p.name, p.description]), shopId)).toEqual([['Shop-buyer', 'buys things']]);
  expect(fs.existsSync(path.join(shopDir, '.git')), 'a plain folder: Kulisa makes no repository').toBe(false);
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
  expect(await core((k, id) => { const p = k.shell.store.projects().find((x) => x.id === id); return [p.color, p.agents ?? null]; }, shopId)).toEqual([color, null]);
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

  // Shop and its profile gone, for the test run again in this Kulisa.
  const deleted = invoke(ui, 'project:delete', { id: shopId });
  await answer(ui);
  await deleted;
  await deleteProfile(core, ui, 'Shop-buyer');
  await removed(made);
});
