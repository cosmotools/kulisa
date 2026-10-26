// What the projects' e2e files share: the task they start from, the window's channels, a project's submenu, the bar's +
// with several projects, Settings' project page (docs/tasks.md, docs/window.md).
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Core } from './fixtures.ts';
import type { data } from './data.ts';
import { SITE, menu, submenu, menuRows, choose, closeMenu, rightClick, plusMenu } from './helpers.ts';

type Files = ReturnType<typeof data>;

export const SAM = 'Sam.admin', ELON = 'Elon.buyer';
export const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=Kulisa test', '-c', 'user.email=test@example.invalid', ...args], { cwd, encoding: 'utf8' }).trim();
export const notLoading = (page: Page) => expect(page.locator('html')).not.toHaveClass(/\bloading\b/);
// A channel of the window's, as its page sends it (a part tested elsewhere, or one with no control of its own).
export const invoke = (page: Page, channel: string, arg?: unknown) => page.evaluate(([c, a]) => (window as any).kulisa.invoke(c, a), [channel, arg] as const);
// An action on the shown task's profiles, as the renderer sends it (lib/store.ts, act).
export const act = (page: Page, channel: string, arg: unknown) => page.evaluate(([c, a]) => (window as any).act(c, a), [channel, arg] as const);
// A text field typed as the human types it, and left (a change) when leave.
export const typeIn = async (page: Page, sel: string, value: string, leave = false) => {
  await page.locator(sel).fill(value);
  if (leave) await page.locator(sel).dispatchEvent('change');
};
// The last question Kulisa asked (answered in its dialog: driver.ts), once it is asked.
export async function asked(core: Core) {
  await expect.poll(() => core((k) => k.asked.length)).toBeGreaterThan(0);
  return core((k) => k.asked.pop());
}
// The shown task's project's tabs in the bar, each its task's name, the shown one with ' *'.
export const taskTabs = (ui: Page) => ui.evaluate(() => {
  const project = document.querySelector<HTMLElement>('#projectTabs .tasktab.active').dataset.project;
  return [...document.querySelectorAll(`#projectTabs .tasktab[data-project="${project}"]`)].map((t) => t.querySelector('.name').textContent + (t.classList.contains('active') ? ' *' : ''));
});
// Another tasks' window's page than ui, once Playwright has it.
export async function otherPage(ui: Page) {
  const find = () => ui.context().pages().find((p) => p !== ui && !p.isClosed() && p.url().includes('/index.html'));
  await expect.poll(() => !!find()).toBe(true);
  return find();
}

// The fake agent installed as its installer puts it (app.ts, its install): the program in the test's bin, on Windows a
// .cmd running it with bash. Installing it is the agents' tests'.
export function installFakeAgent(files: Files) {
  const bin = path.join(files.root, 'bin'), program = path.join(bin, 'kulisa-fake-agent');
  if (fs.existsSync(program)) return;
  fs.mkdirSync(bin, { recursive: true });
  fs.copyFileSync(path.join(import.meta.dirname, '..', 'fixtures', 'fake-agent.sh'), program);
  fs.chmodSync(program, 0o755);
  if (process.platform === 'win32') fs.writeFileSync(`${program}.cmd`, '@bash "%~dp0kulisa-fake-agent" %*');
}

// A project's submenu (a tab's right-click, then the row of the project's name, the one row opening a menu): its rows,
// a row of it chosen. Right-clicked again until its menu and submenu are open: right after Settings or another menu
// closed, the menu may open none, or open and close at once, as the window's focus comes back late (a blur closes a menu).
export async function projectMenu(ui: Page, label?: string, tab = '#projectTabs .tasktab.active .name') {
  const open = ui.locator('.menu[data-state="open"]');
  await expect(async () => {
    if (!(await open.count())) await rightClick(ui, tab);
    await expect(menu(ui)).toBeVisible({ timeout: 1000 });
    if ((await open.count()) < 2) await menu(ui).locator('.item[aria-haspopup]').click({ timeout: 1000 });
    await expect(open).toHaveCount(2, { timeout: 1000 });
  }).toPass({ timeout: 10000 });
  const rows = await menuRows(ui, submenu(ui));
  if (label) await choose(ui, label, submenu(ui));
  else await closeMenu(ui);
  return rows;
}

// A task opened from the bar's + (a closed one opened again, an open one shown). With several projects its project's
// submenu is opened as the hand does, by hovering its row (a click there would make the project a new task:
// MenuRows.vue, runSub); the rows are drawn again as a project just shown moves to the top, and the submenu under the
// pointer closes: hovered again. With one project its tasks are the menu's own (helpers.ts, plusMenu).
const exact = (s: string) => new RegExp(`^${RegExp.escape(s)}$`);
export async function plusOpen(ui: Page, project: string, task: string) {
  const open = ui.locator('.menu[data-state="open"]');
  await plusMenu(ui);
  const trigger = open.first().locator('[role="menuitem"][aria-haspopup]').filter({ has: ui.locator('.label', { hasText: exact(project) }) });
  await expect(open.first().locator(':scope > [role="menuitem"]').first()).toBeVisible();
  if (!(await trigger.count())) return plusMenu(ui, project, task);
  const row = () => open.last().locator('[role="menuitem"]').filter({ has: ui.locator('.label', { hasText: exact(task) }) });
  await expect(async () => {
    if ((await open.count()) < 2) { await ui.mouse.move(0, 0); await trigger.hover(); }
    await expect(row().first()).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 5000 });
  await row().first().click();
}

// A new task of a project (its + in the board or the bar: task:new; the menu itself is tested elsewhere), shown once
// its agent started; named task-<its place among its project's tasks> for the test to refer to it by, unless name is
// null (left "New Task"). A project without git asks first: answered yes (driver.ts). Its key.
export async function newTask(core: Core, ui: Page, project: string, name?: string | null) {
  const before = await core((k) => k.shell.task?.key ?? null);
  await invoke(ui, 'task:new', { project });
  await expect.poll(() => core((k, b) => { const t = k.shell.task; return !!t && t.key !== b && t.loaded && [...t.terminals.values()].some((x) => !!x.pty) && !k.shell.windows[0].switching; }, before), { timeout: 20000 }).toBe(true);
  return core(async (k, n) => {
    const t = k.shell.task;
    if (n !== null) await t.rename(n ?? `task-${[...t.project.tasks.values()].indexOf(t) + 1}`);
    if (k.shell.pty) k.watchPty(k.shell.pty);
    k.asked.length = 0;
    return t.key;
  }, name);
}

// The project's task-1 shown with Feature-X open beside it, Sam signed in and Elon signed out in its panes: made through
// the core and the window's channels where it is not (making tasks and profiles is tested elsewhere).
export async function begin(core: Core, ui: Page, files: Files) {
  const pid = files.pid('project');
  const shown = (key: string) => expect.poll(() => core((k, a) => k.shell.task?.key === a && !!k.shell.task.loaded && !!k.shell.pty && !k.shell.windows[0].switching, key)).toBe(true);
  // A task of the project open again (a closed one) or shown.
  const open = async (task: string) => {
    if (await core((k, key) => k.shell.task?.key === key, `${pid}/${task}`)) return;
    if (await core((k, a) => !!k.shell.taskByKey(`${a.pid}/${a.task}`)?.loaded, { pid, task })) await invoke(ui, 'task:show', `${pid}/${task}`);
    else await invoke(ui, 'project:open', { id: pid, task });
    await shown(`${pid}/${task}`);
  };
  await open(files.tid('project', 1));
  await core(async (k) => { if (k.shell.task.name !== 'task-1') await k.shell.task.rename('task-1'); });
  if (!(await core((k) => [...k.shell.current.tasks.values()].some((t) => t.name === 'Feature-X')))) await newTask(core, ui, pid, 'Feature-X');
  else await open(files.tid('project', 2));
  await open(files.tid('project', 1));
  await core(async (k) => {
    const task = k.shell.task;
    for (const [name, description, avatar] of [['Sam.admin', 'seller in the test shop', 'fox'], ['Elon.buyer', '', 'owl']]) {
      if ([...k.shell.profiles.values()].some((p) => p.name === name)) continue;
      const closed = [...task.closed.keys()].find((id) => task.closed.get(id).cfg.name === name);
      await (closed ? task.openProfile(closed) : task.createProfile(name, description, avatar));
    }
    k.watchPty(k.shell.pty);
  });
  await notLoading(ui);
  await core(async (k, site) => {
    await k.ensureProfile('Sam.admin', `${site}/app/login?name=sam`);
    await k.ensureProfile('Elon.buyer', `${site}/app`);
    k.asked.length = 0;
  }, SITE);
}

// Settings' project page shown: its name in place at its top.
export async function pageOf(s: Page, name: string) {
  await expect(s.locator('#pjname')).toHaveValue(name);
  await expect(s.locator('#pjhead')).toBeVisible();
}
// A new profile on a project's page: + → New Profile…, its name typed in place, Create.
export async function newProfileHere(s: Page, name: string) {
  await s.locator('#npprofileadd').click();
  await choose(s, 'New Profile…');
  await expect(s.locator('#npnewprofile')).toBeFocused();
  await s.locator('#npnewprofile').fill(name);
  await s.locator('#npprofilenew').click();
}
// A list's row selected (a click), then a button of its toolbar acting on it (− removes, ★ makes it the default).
export async function onRow(s: Page, row: string, button: string) {
  await s.locator(row).click();
  await expect(s.locator(row)).toHaveAttribute('aria-selected', 'true');
  await expect(s.locator(`#${button}`)).toBeEnabled();
  await s.locator(`#${button}`).click();
}
