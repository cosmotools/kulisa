// Shell/task pages resolved through authoritative main-process webContents ownership (docs/testing.md).
import { expect, type BrowserContext, type Page } from '@playwright/test';
import type { Core } from './fixtures.ts';
const connections = new WeakMap<BrowserContext, Core>();
const pageContents = new WeakMap<BrowserContext, Map<number, Page>>();
const targets = new WeakMap<Page, string>();
export function registerPages(context: BrowserContext, core: Core) { connections.set(context, core); }
export async function focusNativePage(page: Page, core: Core) {
  const id = await target(page);
  await core((k, target) => {
    const wc = k.electron.webContents.fromDevToolsTargetId(target), owner = k.shell.windowOf(wc);
    if (!owner) throw new Error('The page has no task window');
    k.focus(owner.win); wc.focus();
  }, id);
}
async function target(page: Page) {
  let id = targets.get(page);
  if (!id) {
    const session = await page.context().newCDPSession(page);
    try { id = (await session.send('Target.getTargetInfo')).targetInfo.targetId; targets.set(page, id); }
    finally { await session.detach(); }
  }
  return id;
}
export async function taskPage(page: Page, key?: string): Promise<Page> {
  const core = connections.get(page.context());
  if (!core) throw new Error('Unregistered Kulisa test context');
  const from = await target(page);
  const owner = await core((k, a) => {
    const wc = k.electron.webContents.fromDevToolsTargetId(a.from);
    const task = a.key ? k.shell.taskByKey(a.key) : k.shell.windowOf(wc)?.task;
    return task?.view?.ui.id;
  }, { from, key });
  const cached = pageContents.get(page.context())?.get(owner);
  if (cached && !cached.isClosed()) return cached;
  let found: Page | undefined;
  await expect.poll(async () => {
    for (const candidate of page.context().pages()) {
      if (candidate.isClosed() || !candidate.url().includes('/task.html')) continue;
      const id = await target(candidate).catch((): string | null => null);
      if (id && await core((k, a) => k.electron.webContents.fromDevToolsTargetId(a.target)?.id === a.owner, { target: id, owner })) { found = candidate; return true; }
    }
    return false;
  }, { message: `task UI ${key ?? 'of the selected tab'} attached` }).toBe(true);
  let cache = pageContents.get(page.context());
  if (!cache) pageContents.set(page.context(), cache = new Map());
  cache.set(owner, found);
  return found;
}
export async function shellPage(page: Page): Promise<Page> {
  if (page.url().includes('/index.html')) return page;
  const core = connections.get(page.context());
  if (!core) throw new Error('Unregistered Kulisa test context');
  const id = await target(page);
  const owner = await core((k, target) => k.shell.windowOf(k.electron.webContents.fromDevToolsTargetId(target))?.ui.id, id);
  for (const candidate of page.context().pages()) {
    if (candidate.isClosed() || !candidate.url().includes('/index.html')) continue;
    const id = await target(candidate);
    if (await core((k, a) => k.electron.webContents.fromDevToolsTargetId(a.target)?.id === a.owner, { target: id, owner })) return candidate;
  }
  throw new Error('The shell of this task UI is closed');
}

export async function menuPage(page: Page): Promise<Page> {
  const shell = await shellPage(page);
  if (await shell.locator('[role="menu"][data-state="open"]').count()) return shell;
  const core = connections.get(page.context());
  const id = await target(shell);
  if (!await core((k, target) => {
    const view = k.shell.windowOf(k.electron.webContents.fromDevToolsTargetId(target))?.task?.view;
    return view && !view.failure;
  }, id)) return shell;
  const task = await taskPage(page);
  if (await task.locator('[role="menu"][data-state="open"]').count()) return task;
  // Shell button events may finish before React commits their portal. Task menus already mount
  // before their asynchronous native snapshot handoff marks them ready.
  return shell;
}
export async function inputPage(page: Page): Promise<Page> {
  const core = connections.get(page.context());
  if (!core) throw new Error('Unregistered Kulisa test context');
  const id = await target(page);
  const shell = await core((k, target) => {
    const window = k.shell.windowOf(k.electron.webContents.fromDevToolsTargetId(target));
    return !window?.task || window.shellCovered;
  }, id);
  return shell ? shellPage(page) : taskPage(page);
}
