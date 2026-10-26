// Agents and their accounts: Settings → Agents (installed, installing), an account made with the agent's own sign-in
// and deleted, the language every agent speaks, dictation for an agent without its own (docs/tasks.md, "Choosing the
// agent", Accounts).
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.ts';
import type { Core } from './fixtures.ts';
import type { Files } from './data.ts';
import { SITE, WIN, holdPointer, focusWindow, choose, closeMenu, rightClick, closeSettings, item, renamed, termText, termShows, invoke, ipcSettled, answer, projectMenu, onRow } from './helpers.ts';
import { newTask } from './tasks-helpers.ts';
import { fakeAgent, fakeBin } from './agent-helpers.ts';

// The project with its first task alone, shown, and no account: the tasks and accounts the file's other tests made go
// (deleting a task asks: answered yes).
async function fresh(core: Core, ui: Page, files: Files) {
  const first = files.tkey('project', 1), pid = files.pid('project');
  for (const key of await core((k, f) => [...k.shell.current.tasks.values()].map((t) => t.key).filter((x) => x !== f), first)) {
    const deleted = invoke(ui, 'task:delete', key);
    await answer(ui);
    await deleted;
  }
  await expect.poll(() => core((k, f) => k.shell.current.tasks.size === 1 && k.shell.task?.key === f && k.settled(), first), { timeout: 20000 }).toBe(true);
  for (const id of await core((k) => k.shell.accounts.stored().map((a) => a.id))) await invoke(ui, 'project:agent-remove', { id: pid, agent: id });
  await core(async (k) => {
    for (const a of k.shell.accounts.stored()) { k.shell.accounts.drop(a.id); k.removeTree(k.shell.accounts.folderOf(a)); }
  });
}
// The account the new account test makes (Fake agent · work@shop.com, the project's one account), signed in, and a task
// running it shown: made through the core where it is not (making it is tested below). Its id and the task's key.
async function workAccount(core: Core, ui: Page, files: Files) {
  await fakeAgent(ui, files);
  const has = await core((k) => {
    const a = k.shell.accounts.stored().find((x) => x.email === 'work@shop.com');
    return a && k.shell.accounts.stored().length === 1 && k.shell.task.promptTarget()?.agent.id === a.id ? { work: a.id, task: k.shell.task.key } : null;
  });
  if (has) return has;
  await fresh(core, ui, files);
  const work = await core((k) => {
    const r = k.shell.accounts.prepare('fake') as { id: string; dir: string; error?: string };
    if (r.error !== undefined) throw new Error(r.error);
    k.shell.accounts.create(r.id, 'fake', 'work@shop.com');
    return r.id;
  });
  fs.writeFileSync(path.join(accountDir(files, work), 'account'), 'work@shop.com'); // signed in, as its own sign-in leaves it (fixtures/fake-agent.sh)
  await invoke(ui, 'project:agent-add', { id: files.pid('project'), agent: work });
  const task = await newTask(core, ui, null, files.pid('project'));
  await expect.poll(() => core((k) => k.shell.task.promptTarget()?.agent.id), { timeout: 20000 }).toBe(work); // the project's default: its one account
  return { work, task };
}

// Settings (the title bar's gear) at the first agent: the agents in its nav (agents are set up in Settings); it closes
// as the human closes it (closeSettings). Its page.
async function openAgents(ui: Page, sui: () => Promise<Page>, rows = 2) {
  await ui.locator('#manageProjects').click();
  const s = await sui();
  const agents = s.locator('[data-key^="a:"]');
  await expect(agents).toHaveCount(rows, { timeout: 20000 });
  await agents.first().click();
  await expect(agents.first()).toHaveAttribute('aria-current', 'page');
  await expect(s.locator('section[data-agent]')).toBeVisible();
  return s;
}
// An agent's page in Settings.
const agentPage = (s: Page, id: string) => s.locator(`section[data-agent="${id}"]`);
// An agent chosen in the nav (once the agents are there: looked for as Settings opens), its page shown.
async function showAgent(s: Page, id: string) {
  const row = s.locator(`[data-key="a:${id}"]`);
  await row.click();
  await expect(row).toHaveAttribute('aria-current', 'page');
  await expect(agentPage(s, id)).toBeVisible();
}
// The project's settings (Project Settings… in its submenu: helpers.ts, projectMenu), with its agents.
async function projectSettings(ui: Page, sui: () => Promise<Page>) {
  await choose(ui, 'Project Settings…', await projectMenu(ui));
  const s = await sui();
  await expect(addAgent(s)).toBeAttached();
  return s;
}
// The project page's Agents: + (Add an agent), − on the selected one, the sign-in of a new account.
const addAgent = (s: Page) => s.getByRole('button', { name: 'Add an agent', exact: true });
const signIn = (s: Page) => s.getByRole('group', { name: /^New account of / });
// Settings' menu open (Fluent's).
const settingsMenu = (s: Page) => s.getByRole('menu');
const accountDir = (files: Files, id: string) => path.join(files.userData, 'agents', `fake-${id}`);
const accountOf = (dir: string) => path.basename(dir).replace(/^fake-/, '');
const lines = (f: string) => { try { return fs.readFileSync(f, 'utf8').trim().split('\n'); } catch { return []; } };
// The pages the fake agent's sign-in opened in the user's browser (app.ts' BROWSER); the accounts it signed out of.
const browserOpened = (files: Files) => lines(path.join(files.root, 'opened'));
const logouts = (files: Files) => lines(path.join(files.root, 'logouts'));
// The folder a sign-in under way was given (its id random: accounts.ts), the one no account stores yet.
async function signingIn(core: Core, files: Files) {
  const stored = await core((k) => k.shell.accounts.stored().map((a) => a.id));
  const found = fs.readdirSync(path.join(files.userData, 'agents')).filter((f) => !stored.includes(f.replace(/^fake-/, '')));
  expect(found, `one sign-in's folder: ${found}`).toHaveLength(1);
  return path.join(files.userData, 'agents', found[0]);
}
// Typed into the sign-in under way, as the human types in its terminal (a pty keeps what is typed until the agent reads it).
const typeSignIn = (core: Core, text: string) => core((k, t) => { [...k.shell.signins.values()][0].write(t); }, text);
// New Account… of the fake agent on a project's page: its own sign-in starts at once; resolves once its page is open
// in the user's browser (the sign-in waiting for the human).
async function newAccount(core: Core, s: Page, files: Files) {
  await core((k) => k.shell.signins.clear());
  const before = browserOpened(files).length;
  await addAgent(s).click();
  // The agents that have accounts, under New Account after the ones to add.
  await expect(settingsMenu(s).getByText('New Account', { exact: true })).toBeVisible();
  await choose(s, 'Fake agent…', settingsMenu(s));
  await expect.poll(() => core((k) => k.shell.signins.size)).toBeGreaterThan(0);
  await expect.poll(() => browserOpened(files).length).toBe(before + 1);
  expect(browserOpened(files).at(-1)).toBe(`${SITE}/app?signin`);
}

test('Settings → Agents (not the terminal only): what is installed, installs the others; nothing is chosen or started', async ({ core, ui, sui, files }) => {
  await fresh(core, ui, files);
  await fakeAgent(ui, files, false);
  const pty = await core((k) => k.shell.task.pty.pid);
  const s = await openAgents(ui, sui);
  await expect(s.locator('[data-key="a:fake"]')).toContainText('not installed');
  await showAgent(s, 'fake');
  await expect(s.getByRole('navigation', { name: 'Path' }).locator('[aria-current="page"]')).toHaveText('Fake agent');
  expect(await core((k) => k.shell.settings.win.getTitle())).toBe('Settings — Kulisa');
  await expect(s.locator('[data-key="a:shell"]'), 'not the terminal only: nothing of it to set up').toHaveCount(0);
  const page = agentPage(s, 'fake'), newAccount = page.getByRole('button', { name: 'New Account…: signed in with its own sign-in' });
  await expect(page.getByText('No accounts yet.', { exact: true })).toBeVisible();
  await expect(newAccount, 'not installed: no account yet').toBeDisabled();
  await expect(page.getByRole('status').first()).toHaveText('Not installed');
  await expect(page.getByText(/^Install runs Kulisa tests's installer: echo ["']installing the fake agent["']/)).toBeVisible();
  // Installed with its maker's installer; what it said only under Details.
  await page.getByRole('button', { name: 'Install', exact: true }).click();
  await expect(page.getByRole('status').first()).toHaveText('Installed', { timeout: 10000 });
  await expect(page.getByRole('status').filter({ hasText: /^Fake agent is installed/ })).toHaveText(/^Fake agent is installed\. Make an account of it below/);
  const details = page.getByRole('button', { name: 'Details' });
  await expect(details, "the installer's own output only under Details").toHaveAttribute('aria-expanded', 'false');
  await details.click();
  const said = await page.locator('pre').textContent();
  expect(said).toMatch(/installing the fake agent\s+(tar: .*\s+)?done/);
  if (WIN) expect(said.match(/tar: (.*)/)[1].trim().toLowerCase(), "Windows' own tar, not Git's: GNU tar reads C:\\… as a host").toBe(path.join(process.env.SystemRoot, 'System32', 'tar.exe').toLowerCase());
  expect(said, 'no terminal codes: colors, links').not.toMatch(/\x1b/);
  await expect(newAccount).toBeEnabled();
  await closeSettings(core, ui, sui);
  expect(await core((k) => k.shell.task.pty.pid), 'the agent goes on').toBe(pty);
});

test('once installed, the Agents window shows its version and where it is', async ({ core, ui, sui, files }) => {
  await fakeAgent(ui, files);
  const s = await openAgents(ui, sui);
  await showAgent(s, 'fake');
  const page = agentPage(s, 'fake');
  await expect(page.getByRole('status').first()).toHaveText('Installed');
  await expect(page.getByRole('button', { name: 'Install', exact: true })).toHaveCount(0);
  // Shown as the human's home folder shortened to ~, as a test folder inside it is (the CI's runner.temp).
  const bin = fakeBin(files), home = os.homedir() + path.sep;
  await expect(page.getByTestId('agent-where')).toHaveText(`1.2.3 · ${bin.startsWith(home) ? '~' + bin.slice(home.length - 1) : bin} · not on your PATH: Kulisa runs it from here`);
  await expect(page.getByText(/^Install runs/)).toHaveCount(0);
  // A click on the row already shown keeps it chosen.
  await showAgent(s, 'fake');
  const png = test.info().outputPath('agents.png');
  await s.screenshot({ path: png });
  await test.info().attach('agents', { path: png, contentType: 'image/png' });
  await closeSettings(core, ui, sui);
});

test('the list comes at once with what the last look found, then looks again: an agent removed meanwhile shows so', async ({ core, ui, sui, files }) => {
  await fakeAgent(ui, files);
  const bin = fakeBin(files), away = `${bin}.away`;
  const fake = (cached: boolean) => invoke(ui, 'agents:list', { details: true, cached }).then((r: any) => r.list?.find((a: any) => a.id === 'fake'));
  expect((await fake(true)).version, "the last look's, nothing run").toBe('1.2.3');
  await renamed(bin, away); // the look just made may still run its .cmd, holding it
  try {
    expect((await fake(true)).installed, 'not looked for again yet').toBe(true);
    const s = await openAgents(ui, sui);
    await showAgent(s, 'fake');
    await expect(agentPage(s, 'fake').getByRole('status').first()).toHaveText('Not installed');
    expect((await fake(true)).installed, 'what the window looked for again is kept').toBe(false);
    await closeSettings(core, ui, sui);
  } finally {
    await renamed(away, bin);
    await fake(false);
  }
});

test("a new account is made in the project's settings: the agent's own sign-in at once, in a terminal there (under Details), its page in the user's own browser (Google refuses an embedded one); named by the email it signed in to; a task runs it with its folder, over a folder the project's environment sets", async ({ core, ui, sui, files }) => {
  await fresh(core, ui, files);
  await fakeAgent(ui, files);
  const s = await projectSettings(ui, sui);
  const windows = await core((k) => k.electron.BrowserWindow.getAllWindows().length);
  await newAccount(core, s, files);
  const dir = await signingIn(core, files), work = accountOf(dir);
  expect(work, 'its folder its agent and a fixed id: never renamed').toMatch(/^[a-z0-9]{6}$/);
  // The sign-in in a terminal there, under Details, closed: the window shows what it says.
  await expect(signIn(s).getByRole('button', { name: 'Details' })).toHaveAttribute('aria-expanded', 'false');
  await expect(signIn(s).locator('.xterm')).toHaveCount(0);
  // Its page in the user's browser (the BROWSER Kulisa was started with), not a window of Kulisa's.
  expect(await core((k) => k.electron.BrowserWindow.getAllWindows().length), 'no window of its own').toBe(windows);
  await typeSignIn(core, 'Work@Shop.com\r');
  await expect(s.locator(`[data-agent="${work}"]`)).toHaveCount(1);
  await expect(signIn(s)).toHaveCount(0);
  // Its agent and its email, each in its column (a table).
  expect((await s.locator(`[data-agent="${work}"] > *`).allTextContents()).slice(0, 2).map((c) => c.trim())).toEqual(['Fake agent', 'work@shop.com']);
  expect(files.json('agents.json')).toEqual({ list: [{ id: work, agent: 'fake', email: 'work@shop.com' }] });
  expect(await core((k, a) => k.shell.store.projects().find((x) => x.id === a.pid).agents.includes(a.work), { pid: files.pid('project'), work }), 'the project lists it').toBe(true);
  // Signed in to an email it has already: that account, the new folder signed out and gone.
  await newAccount(core, s, files);
  let again = await signingIn(core, files);
  await typeSignIn(core, 'work@shop.com\r');
  await expect(signIn(s).getByRole('alert')).toHaveText(/is in the project already/);
  await expect.poll(() => !fs.existsSync(again) && logouts(files).includes(again)).toBe(true);
  await signIn(s).getByRole('button', { name: 'Cancel' }).click();
  await expect(signIn(s)).toHaveCount(0);
  // Cancelled: nothing kept; + adds again (not while a sign-in is shown).
  await newAccount(core, s, files);
  again = await signingIn(core, files);
  await expect(addAgent(s)).toBeDisabled();
  await signIn(s).getByRole('button', { name: 'Cancel' }).click();
  await expect.poll(() => !fs.existsSync(again)).toBe(true);
  await expect(signIn(s)).toHaveCount(0);
  await expect(addAgent(s)).toBeEnabled();
  // Not signed in (the agent's sign-in ended without it): said so, Try Again.
  await newAccount(core, s, files);
  again = await signingIn(core, files);
  await typeSignIn(core, '\r');
  await expect(signIn(s).getByRole('alert')).toHaveText(/Not signed in/);
  await expect(signIn(s).getByRole('button', { name: 'Try Again' })).toBeVisible();
  await expect(signIn(s).locator('.xterm'), 'its Details open by itself, with what the agent said').toBeVisible();
  expect(fs.existsSync(again)).toBe(false);
  await signIn(s).getByRole('button', { name: 'Cancel' }).click();
  await closeSettings(core, ui, sui);
  // A task runs it: the agent with its folder in its variable, though the project's environment set it to another
  // (app.ts: its shell's startup, as a project's .envrc). Choosing a task's agent lists the project's accounts.
  await newTask(core, ui, null, files.pid('project'));
  await expect.poll(() => core((k) => k.shell.task.promptTarget()?.agent.id), { timeout: 20000 }).toBe(work); // the project's default: its one account
  await core((k) => k.watchPty(k.shell.task.pty));
  await termShows(ui, `config [${dir}]`);
  // Its shell gets none of direnv's state from where Kulisa was started: else the user's direnv hook takes the task's
  // folder for a folder left, undoes that .envrc's changes and with them the account's variable, and the agent runs
  // with the user's own sign-in (Kulisa started from the repository's folder).
  if (process.platform === 'linux') {
    const pid = await core((k) => k.shell.task.pty.pid);
    expect(fs.readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter((v) => v.startsWith('DIRENV_'))).toEqual([]);
  }
  // Change agent… (the terminal's menu) hands the task to one of the project's accounts.
  await rightClick(ui, '[data-testid="terminal"]');
  await choose(ui, 'Change agent…');
  const handover = ui.getByRole('dialog', { name: 'Change Agent' });
  await expect(handover.getByRole('radio')).toHaveCount(1);
  await expect(handover.getByRole('radio')).toHaveAccessibleName('Fake agent · work@shop.com');
  await handover.getByRole('button', { name: 'Close' }).click();
  await expect(handover).toHaveCount(0);
});

test("language: one for every agent (☰ → Language): written into the agents' own setting in each account's folder, at an agent's start and when chosen, never into the human's own", async ({ core, ui, files }) => {
  const { work } = await workAccount(core, ui, files);
  const own = path.join(accountDir(files, work), 'settings.json');
  const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
  await expect.poll(() => fs.existsSync(own) && read(own), 'at its start: English, the default').toEqual({ language: 'English' });
  await focusWindow(core, ui); // the keyboard chooses below
  await ui.locator('#windowMenu').click();
  const row = item(ui, 'Language');
  await expect(row).toBeVisible();
  await expect(row, 'the language chosen, under its label').toContainText('English');
  await expect(row).toHaveAttribute('title', /^The language you speak with the agents\. Fake agent dictates and answers in it, and may write code comments in it too: your project's CLAUDE\.md or AGENTS\.md decides that\./);
  await row.click();
  const languages = ui.getByRole('menu', { name: 'Language', exact: true });
  await expect(languages).toBeVisible();
  const system = await ui.evaluate(() => navigator.language.split('-')[0]);
  await expect(languages.locator('[data-language]').first(), "the system's first").toHaveAttribute('data-language', system);
  // Russian chosen with the keyboard, as the hand does it in a long list (into the list, down to it, Enter): it is past
  // the menu's end, and the pointer jumping from the row to the list closes it.
  await ui.keyboard.press('ArrowRight');
  await expect(languages.locator('[data-language]').first()).toBeFocused();
  const ru = languages.locator('[data-language="ru"]');
  await expect(async () => {
    if (!(await ru.evaluate((e) => e === document.activeElement))) { await ui.keyboard.press('ArrowDown'); throw new Error('not there yet'); }
  }).toPass({ intervals: [0] });
  await ui.keyboard.press('Enter');
  await expect.poll(() => read(path.join(files.userData, 'settings.json')).language).toBe('ru');
  await expect.poll(() => read(own).language).toBe('Russian');
  expect(fs.existsSync(path.join(files.root, 'fake-config', 'settings.json')), "the human's own folder untouched").toBe(false);
  // Esc closes the languages first, then ☰.
  await ui.keyboard.press('Escape');
  await expect(languages).toHaveCount(0);
  await closeMenu(ui);
  expect(await core((k) => k.shell.setLanguage('xx').error !== undefined), 'only one an agent takes').toBe(true);
  await core((k) => { k.shell.setLanguage('en'); });
  expect(read(own).language).toBe('English');
});

test("dictation: an agent without its own is recognized for by another agent's dictation in a hidden session (fixtures/fake-recognizer.mjs): the pill at once, then recording; let go, the text it heard goes into that agent's input, the pill saying so; ended, nothing of it is left", async ({ core, ui, files }) => {
  const { task } = await workAccount(core, ui, files);
  const mic = ui.getByRole('button', { name: 'Speak to the agent' }), pill = ui.getByRole('status', { name: 'Dictation' });
  await core((k) => k.watchPty(k.shell.task.pty));
  await expect(mic).toBeEnabled();
  await expect(mic).toHaveAttribute('title', /^Speak to the agent in English: hold/);
  // The microphone held (the key's way is the window tests'), let go once it records: pressed longer ago than a click.
  const letGo = await holdPointer(ui, mic);
  await expect(pill).toBeAttached(); // getting ready (when slow) or listening: as the key goes down
  // Drawn as recording while it gets ready, unless that lasts (src/dictation/renderer/voice.ts): it listens first.
  await expect.poll(() => core((k, key) => k.shell.dictation.state(key).state, task), { timeout: 15000 }).toBe('recording');
  expect(`${await mic.getAttribute('data-state')} ${await pill.getAttribute('data-state')}`).toBe('recording listening');
  await letGo();
  await expect.poll(() => termText(ui)).toContain('Heard by the fake recognizer.');
  await expect(mic).toHaveAttribute('data-state', 'ready');
  await expect(pill).toHaveAttribute('data-state', 'done');
  await expect(pill).toHaveText("In Fake agent's input");
  await expect(pill).toHaveCount(0);
  const folder = path.join(files.userData, 'dictation');
  expect(fs.existsSync(folder), "its session runs in a folder of Kulisa's").toBe(true);
  await core((k) => k.shell.dictation.close());
  await expect.poll(() => fs.existsSync(folder)).toBe(false);
});

test("an account lives until deleted in Settings → Agents: let go by its project at once, kept; not deleted while a task runs it; deleted after a question, signed out, with its folder; one made there is in no project", async ({ core, ui, sui, files }) => {
  const { work, task } = await workAccount(core, ui, files);
  const dir = accountDir(files, work), pid = files.pid('project');
  const row = (s: Page, id: string) => agentPage(s, 'fake').locator(`[data-account="${id}"]`);
  // An account deleted: its row selected, then − over its list.
  const deleteAccount = (s: Page, id: string) => onRow(s, `section[data-agent="fake"] [data-account="${id}"]`, 'section[data-agent="fake"] [aria-label="Delete the account (asks first)"]');
  // Nothing asked, in either window, once what Settings sent is handled.
  const noQuestion = async (s: Page) => {
    await ipcSettled(s);
    for (const page of [s, ui]) await expect(page.getByRole('alertdialog')).toHaveCount(0);
  };
  const inProjects = (id: string) => core((k, a) => k.shell.store.projectsWith('agents', a).map((p) => p.id), id);
  // × in the project lets go of it at once, nothing asked; the account stays, and the task running it keeps it.
  let s = await projectSettings(ui, sui);
  await onRow(s, `[data-agent="${work}"]`, '[aria-label="Remove from the project (its tasks keep it)"]');
  await expect(s.locator(`[data-agent="${work}"]`)).toHaveCount(0);
  await noQuestion(s);
  expect(await inProjects(work), 'kept, in no project').toEqual([]);
  expect(await core((k, key) => k.shell.taskByKey(key).promptTarget().agent.id, task)).toBe(work);
  expect(fs.existsSync(dir)).toBe(true);
  // Its agent's page: the account in no project; Delete refused while a task runs it.
  await showAgent(s, 'fake');
  await expect(row(s, work).getByText('in no project', { exact: true })).toBeVisible();
  await deleteAccount(s, work);
  const name = await core((k, key) => k.shell.taskByKey(key).entry.name, task);
  await expect(agentPage(s, 'fake').getByRole('alert')).toHaveText(new RegExp(`^Tasks run it: ${RegExp.escape(name)} \\(project\\)`));
  await noQuestion(s);
  await closeSettings(core, ui, sui);
  const deleted = invoke(ui, 'task:delete', task);
  await answer(ui);
  await deleted;
  await expect.poll(() => core((k, key) => !k.shell.taskByKey(key) && k.settled(), task)).toBe(true);
  // Deleted after a question; no: kept.
  s = await openAgents(ui, sui);
  await showAgent(s, 'fake'); // its accounts on its page
  await expect(row(s, work)).toBeVisible();
  await deleteAccount(s, work);
  expect((await answer(s, false)).message).toBe('Delete the account Fake agent · work@shop.com?');
  await ipcSettled(s);
  expect(fs.existsSync(dir), 'kept when the human says no').toBe(true);
  await deleteAccount(s, work);
  await answer(s);
  await expect.poll(() => fs.existsSync(dir)).toBe(false);
  await expect(row(s, work)).toHaveCount(0);
  expect(logouts(files), "signed out first, with its agent's own command").toContain(dir);
  expect(files.json('agents.json')).toEqual({ list: [] });
  await core((k) => { k.shell.signins.clear(); });
  // New Account… there (the + beside Agents in the nav, an agent): signed in on its page, in no project; a project's
  // Add Agent… takes it.
  await s.locator('[data-key^="a:"]:not([data-key="a:fake"])').first().click(); // another agent's page shown first
  await s.getByRole('button', { name: 'New Account', exact: true }).click();
  await choose(s, 'Fake agent…', settingsMenu(s));
  await expect(s.locator('[data-key="a:fake"]')).toHaveAttribute('aria-current', 'page');
  await expect.poll(() => core((k) => k.shell.signins.size)).toBeGreaterThan(0);
  const home = accountOf(await signingIn(core, files));
  await typeSignIn(core, 'home@shop.com\r'); // kept by the pty until the agent reads it
  await expect(row(s, home)).toBeVisible();
  await expect(signIn(s)).toHaveCount(0);
  await expect(row(s, home)).toHaveAccessibleName('home@shop.com');
  expect(await inProjects(home)).toEqual([]);
  await s.locator(`[data-key="p:${pid}"]`).click();
  await expect(addAgent(s)).toBeEnabled();
  // The accounts to add are asked for again as the project's page is shown.
  await addAgent(s).click();
  await expect(item(s, 'Fake agent · home@shop.com', settingsMenu(s))).toBeVisible();
  await s.keyboard.press('Escape');
  await expect(settingsMenu(s)).toHaveCount(0);
  // In no project and no task: deleted at once after the question.
  await showAgent(s, 'fake');
  await expect(row(s, home)).toBeVisible();
  await deleteAccount(s, home);
  await answer(s);
  await expect.poll(async () => !fs.existsSync(accountDir(files, home)) && !(await core((k, id) => !!k.shell.accounts.find(id), home))).toBe(true);
  await closeSettings(core, ui, sui);
});
