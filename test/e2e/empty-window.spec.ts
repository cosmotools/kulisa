// The empty window (docs/window.md, The empty window): the sidebar with every project, the welcome at the first start,
// New Project's steps there and in a dialog; the log a new project leaves.
import fs from 'fs';
import path from 'path';
import { test, expect } from './fixtures.ts';
import type { Page } from '@playwright/test';
import { ipcSettled, menu, choose, projectTabs, projectTab, showProject, invoke, typeIn, notLoading, projectMenu, fromSidebar, removed, answer, termKeys } from './helpers.ts';
import { begin, bothOn, taskShown, taskTab, deleteProfile } from './tasks-helpers.ts';

// A color token as the page resolves it (Playwright reads a style only to compare it with one given).
const token = (ui: Page, name: string) => ui.evaluate((n) => {
  const i = document.body.appendChild(document.createElement('i'));
  i.style.background = `var(${n})`;
  const c = getComputedStyle(i).backgroundColor;
  i.remove();
  return c;
}, name);
// The keyboard taken from whatever has it.
const blur = async (ui: Page) => { if (await ui.locator(':focus').count()) await ui.locator(':focus').blur(); };

test("the empty window: Close All Tasks in the project's submenu; links in ☰ open in the browser; at the first start the manager on New Project; New Project… asks where its folder goes", async ({ core, ui, files }) => {
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
  await expect(sub).toMatchAriaSnapshot(`
    - /children: contain
    - separator
    - menuitem "Close All Tasks"
  `);
  await expect(sub.getByRole('menuitem').last()).toHaveAccessibleName('Close All Tasks');
  await choose(ui, 'Close All Tasks', sub);
  await expect.poll(() => core((k) => k.shell.task === null && !k.shell.current)).toBe(true);
  await expect(ui.locator('#dock')).toBeHidden();
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
  // at the first start; then New Project's steps, a question each, in an island as a dialog. With projects, the
  // sidebar, and nothing happens.
  await blur(ui);
  await core((k) => k.shell.firstStart(k.shell.windows[0]));
  await ipcSettled(ui); // what it told the window is there
  await expect(ui.locator('html'), 'projects there: nothing').toHaveAttribute('data-page', 'projects');
  const gear = ui.locator('#manageProjects');
  await expect(gear).toBeVisible();
  await core((k) => {
    const s = k.shell;
    k.stash.empty = { projects: s.store.projects, sent: s.projects, accounts: s.accounts.all, profiles: s.profileStore.all };
    s.store.projects = () => []; s.projects = () => [];
  });
  try {
    await core((k) => { k.shell.sendProjects(); k.shell.firstStart(k.shell.windows[0]); });
    await expect(ui.locator('#tournext')).toBeFocused();
    await expect(ui.locator('html')).toHaveAttribute('data-page', 'welcome');
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
      await expect(ui.locator('#tour h1')).toHaveText(title);
      await expect(ui.locator('#tournext')).toHaveText(next);
    };
    await slide('Your agent, in your browsers', 'Next');
    await ui.locator('#tournext').click();
    await ui.locator('#tournext').click();
    await slide('Point at it, and say what is wrong', 'Set Up a Project');
    await ui.locator('#tourback').click();
    await slide('It checks the result as every user', 'Next');
    // A low window, wide or at the least size: the slide fits, nothing to scroll to (its top not cut off above the
    // window's edge, out of scrolling's reach).
    const size = await core((k) => k.shell.win.getContentSize());
    for (const [w, h] of [[1100, 400], [640, 400]]) {
      await core((k, a) => k.shell.win.setContentSize(a[0], a[1]), [w, h]);
      // The page's own size and scroll: Playwright's viewportSize is the one it emulates, and it has no scroll reading.
      await expect.poll(() => ui.evaluate(() => [innerWidth, innerHeight])).toEqual([w, h]);
      expect(await ui.evaluate(() => {
        const e = document.getElementById('empty');
        return e.scrollHeight <= e.clientHeight && document.getElementById('tour').getBoundingClientRect().top >= e.getBoundingClientRect().top;
      }), `${w}×${h}: the slide fits`).toBe(true);
    }
    await core((k, s) => k.shell.win.setContentSize(s[0], s[1]), size);
    await ui.locator('#tourskip').click();
    await expect(ui.locator('#npname')).toBeFocused();
    // A question, not the steps' names.
    await expect(ui.locator('#welcome h1')).toHaveText('Where is the code?');
    await expect(ui.locator('#welcome [data-on]')).toHaveCount(1);
    await expect(ui.locator('#welcome [aria-current="step"]')).toHaveCount(0);
    await expect(ui.locator('#npcreate')).toHaveText('Next');
    await expect(ui.locator('#npform').locator('..'), "an island's, as a dialog's").toHaveCSS('background-color', await token(ui, '--island'));
    // Code from the disk or a URL: one folder or one URL, in a field, not a list (the others later, in Settings); its
    // name the folder's or the repository's, no field for it unless it will not do. A new folder's is asked.
    await expect(ui.locator('label[for="npname"]')).toHaveText('Project name:');
    const kind = async (from: string) => {
      await ui.locator(`#npfrom [data-value="${from}"]`).click();
      await expect(ui.locator(`#npfrom [data-value="${from}"]`)).toHaveAttribute('aria-selected', 'true');
    };
    const single = path.join(files.root, 'single', 'Shop');
    fs.mkdirSync(single, { recursive: true });
    await kind('folder');
    await expect(ui.locator('#npsources')).toHaveCount(0);
    await expect(ui.locator('#npsingle label')).toHaveText('Folder:');
    await expect(ui.locator('#npmore')).toHaveCount(1);
    await typeIn(ui, '#npsource', single, true);
    await expect(ui.locator('#npwhere')).toHaveText(`The project Shop takes ${single} as it is`);
    await expect(ui.locator('#npname'), "its name: the folder's").toHaveCount(0);
    await kind('clone');
    await expect(ui.locator('#npsingle label')).toHaveText('URL:');
    // A clone whose folder is there already, with files: its name to change, in its field.
    const home = await core((k) => k.shell.projectsHome), taken = path.join(home, 'taken');
    fs.mkdirSync(taken, { recursive: true });
    fs.writeFileSync(path.join(taken, 'notes.txt'), '');
    await typeIn(ui, '#npsource', 'https://example.com/me/taken.git', true);
    await expect(ui.locator('#npname')).toHaveValue('taken');
    await expect(ui.locator('#npwhere')).toContainText(/is there already: choose another name or location/);
    await kind('new');
    await expect(ui.locator('#npname')).toHaveCount(1);
    // Once the git that looked at it (whether it is a repository) has left it: Windows does not remove a process's folder.
    await removed(taken);
    // Back on the first step: the slides again, on the one left.
    await ui.locator('#npback').click();
    await expect(ui.locator('#tour h1')).toHaveText('It checks the result as every user');
  } finally {
    await core((k) => {
      const s = k.shell, saved = k.stash.empty;
      s.store.projects = saved.projects; s.projects = saved.sent; s.accounts.all = saved.accounts; s.profileStore.all = saved.profiles;
      s.sendProjects();
    });
  }
  await expect(ui.locator('html')).toHaveAttribute('data-page', 'projects');

  // New Project… at the sidebar's foot: the same steps in a dialog.
  await ui.locator('#sidebarnewproject').click();
  await expect(ui.locator('#newproject')).toHaveAttribute('data-state', 'open');
  await expect(ui.locator('#npname')).toHaveCount(1);

  // Its code: a name and where its folder goes, the home folder unless another is chosen.
  const home = await core((k) => k.shell.projectsHome);
  await expect(ui.locator('#nplocation'), "every new project's place (~/KulisaProjects; the tests' own here)").toHaveValue(home);
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
    await ui.locator('#npbrowse').click();
    await expect(ui.locator('#nplocation')).toHaveValue(made);
  } finally { await core((k) => { k.electron.dialog.showOpenDialog = k.stash.open; }); }
  // The step shown (its number, then its name); Next as the human goes on.
  const step = (name: string) => expect(ui.locator('#newproject [aria-current="step"]')).toHaveText(new RegExp(`^.${name}$`));
  const next = () => ui.locator('#npcreate').click();
  // A folder there already would be taken as it is (the form says so as it is typed); a file is refused at Next.
  await typeIn(ui, '#npname', 'Taken');
  await expect(ui.locator('#npwhere')).toHaveText(`${path.join(made, 'Taken')} is there already: the project takes it as it is, its files kept`);
  fs.writeFileSync(path.join(made, 'note'), '');
  await typeIn(ui, '#npname', 'note');
  await expect(ui.locator('#npwhere')).toContainText(/is a file, not a folder/);
  await next();
  await expect(ui.locator('#nperror')).toContainText(/is a file, not a folder/);
  await step('Code'); // not on
  // An error is text to copy and search for: it can be selected (the window's other words cannot). What is selected
  // read in the page: Playwright has no getter of the selection.
  await expect(ui.locator('#nperror')).toHaveCSS('user-select', 'text');
  await expect(ui.locator('#newproject [data-slot="dialog-title"]')).toHaveCSS('user-select', 'none');
  await ui.locator('#nperror').selectText();
  expect(await ui.evaluate(() => getSelection().toString())).toBe(await ui.locator('#nperror').textContent());
  await typeIn(ui, '#npname', 'Shop');
  await expect(ui.locator('#npwhere')).toHaveText(`The project will be created in ${path.join(made, 'Shop')}`);
  await next();
  // Its agents: the accounts there are, to tick (none here: its tasks start with a terminal), and a new one of each
  // agent an account can be made of (its sign-in: the agents' tests).
  await step('Agents');
  const accounts: string[] = (await invoke(ui, 'accounts:list')).accounts.map((a: { id: string }) => a.id);
  await expect(ui.locator('#npagents > [data-account]')).toHaveCount(accounts.length);
  for (const [i, id] of accounts.entries()) await expect(ui.locator('#npagents > [data-account]').nth(i)).toHaveAttribute('data-account', id);
  await expect.poll(() => ui.locator('#npagentstep [data-add]').count()).toBeGreaterThan(0); // Add account: an agent to make one of, once they are found (behind the steps)
  await ui.locator('#npback').click();
  await step('Code');
  await expect(ui.locator('#npname')).toHaveValue('Shop'); // Back: as it was
  await next();
  await step('Agents');
  await next();
  // Its profiles: a new one, named and said who it is; Create makes the project with it and opens its first task,
  // nothing asked, no Settings.
  await step('Profiles');
  await expect(ui.locator('#npcreate')).toHaveText('Create');
  await ui.locator('#npprofileadd').click();
  await ui.locator('#npprofilestep').getByRole('textbox', { name: 'Name' }).fill('Shop-buyer');
  await ui.locator('#npprofilestep').getByRole('textbox', { name: 'Who it is' }).fill('buys things');
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
  expect(logged).toMatch(new RegExp(`\\[ipc\\] project:open wc=\\d+ \\{"id":"${shopId}"\\}`));
  // The project named beside its id where it first appears (its id is random: store.ts).
  expect(logged).toMatch(new RegExp(`\\[project\\] ${shopId} loaded: Shop \\(\\S*Shop\\)`));
  expect(logged).toMatch(new RegExp(`\\[task\\] created ${shopId}/[a-z0-9]{6} \\(Shop\\) in \\S*Shop wc=\\d+`));
  expect(logged).toMatch(/\[key\] tab\.new zone=/);
  expect(logged, 'what is typed into a terminal is never logged').not.toMatch(/pty:in/);
  expect(await core((k, id) => { const p = k.shell.store.projects().find((x) => x.id === id); return [p.color, p.agents ?? null]; }, shopId)).toEqual([color, null]);
  // No favicon in its code: the curtain, in the next free color, the window's too.
  await expect(projectTab(ui, files, 'shop').getByTestId('project-icon')).toHaveAttribute('data-icon', 'logo');
  await expect(ui.locator(':root')).toHaveCSS('--project', color);
  expect(await core((k) => k.shell.task.folder), 'its first task works in it').toBe(shopDir);
  expect(await core((k) => k.shell.settings)).toBe(null);
  await notLoading(ui);
  await fromSidebar(ui, 'project', 'task-1'); // a closed task in the sidebar: its project opens again on it
  await expect.poll(() => core((k, f) => k.shell.current?.folder === f && k.shell.task?.name === 'task-1' && !!k.shell.task.loaded && !!k.shell.pty, files.project)).toBe(true);
  await core((k) => k.watchPty(k.shell.pty));
  await expect(ui.locator('#dock')).toBeVisible();
  await notLoading(ui);
  await bothOn(core, ui, files);
  // Feature-X, closed with the others, opened again from the sidebar.
  await fromSidebar(ui, 'project', 'Feature-X');
  await taskShown(core, files.tkey('project', 2));
  await taskTab(ui, files.tkey('project', 1)).click();
  await taskShown(core, files.tkey('project', 1));
  await notLoading(ui);
  expect(await projectTabs(ui, files)).toEqual(['shop', 'project *', 'project']);
  // Another project's task: a click shows it.
  const shopTask = files.tkey('shop', 1);
  await ui.locator(`#projectTabs [data-task="${shopTask}"]`).click();
  await expect.poll(() => core((k, a) => k.shell.current?.id === a.id && k.shell.task?.key === a.task && k.settled(), { id: shopId, task: shopTask })).toBe(true);
  await notLoading(ui);
  expect(await projectTabs(ui, files)).toEqual(['shop *', 'project', 'project']);
  await showProject(ui, files, 'project');
  await expect.poll(() => core((k, id) => k.shell.current?.id === id && !!k.shell.task.loaded, files.pid('project'))).toBe(true);
  // A tab in the background has its × too: the last one of its project lets the project go.
  await ui.locator(`#projectTabs [data-task="${shopTask}"] [aria-label="Close"]`).click();
  await expect.poll(() => core((k, id) => !k.shell.open.has(id), shopId)).toBe(true);
  expect(await core((k) => k.shell.current?.id), 'the shown project stays').toBe(files.pid('project'));

  // Shop and its profile gone, for the test run again in this Kulisa.
  const deleted = invoke(ui, 'project:delete', { id: shopId });
  await answer(ui);
  await deleted;
  await deleteProfile(core, ui, 'Shop-buyer');
  await removed(made);
});
