import { taskPage } from './pages.ts';
// Controlled malformed task data exercises React boundaries without a production failure trigger.
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, type Core } from './fixtures.ts';
import { closeMenu, closeSettings, frames, invoke, ipcSettled, menu, notLoading, otherPage, rightClick, choose, showResources, SITE } from './helpers.ts';
import { newTask, taskShown, taskTab } from './tasks-helpers.ts';

const PRIVATE = 'private-terminal-content-396';
const fallback = async (ui: Page) => (await taskPage(ui)).getByRole('alert').filter({ hasText: 'This task’s screen could not be displayed' });

async function selectTask(core: Core, ui: Page, key: string) {
  await taskTab(ui, key).click(); await taskShown(core, key); await notLoading(ui);
}
async function closeFailedTask(ui: Page, key: string) {
  const closed = await taskPage(ui, key);
  await taskTab(ui, key).getByRole('button', { name: 'Close', exact: true }).click();
  await expect.poll(() => closed.isClosed()).toBe(true);
}

// A tab's malformed label reaches the renderer through real task-state delivery. The core stays valid;
// React throws inside the task's tab strip. Window-wide task menus do not consume tab titles.
async function failScreen(core: Core, ui: Page, task: string, mount?: () => Promise<unknown>) {
  await core((k, key) => {
    const t = k.shell.taskByKey(key), p = [...t.profiles.values()][0], info = p.info;
    k.stash.boundaryProfile = { p, info };
    p.info = () => {
      const data = info.call(p);
      return { ...data, tabs: data.tabs.map((tab, i) => i ? tab : { ...tab, title: { 'private-terminal-content-396': true } as unknown as string }) };
    };
    t.send('profile:state', { task: key, list: [...t.profiles.values()].map((p) => p.info()) });
  }, task);
  try {
    await mount?.();
    await expect((await taskPage(ui, task)).locator(`[data-task-view="${task}"] [role="alert"]`)).toHaveCount(1);
    await expect.poll(() => core((k, key) => k.shell.taskByKey(key).viewFailed, task)).toBe(true);
  } finally {
    await core((k) => { const { p, info } = k.stash.boundaryProfile; p.info = info; delete k.stash.boundaryProfile; });
  }
}

test('a mounted task failure contains native pages and releases Views while running work and other tasks survive', async ({ core, ui, files, call, sui }) => {
  await notLoading(ui);
  const healthy = await core((k) => k.shell.task.key);
  await showResources(ui, 'Project');
  await core(async (k, site) => { await k.ensureProfile('Healthy.browser', `${site}/app`); }, SITE);
  const failed = await newTask(core, ui, 'broken-screen');
  await notLoading(ui);
  await core(async (k, site) => { await k.ensureProfile('Failed.browser', `${site}/app`); }, SITE);
  await showResources(ui, 'Agents');
  fs.writeFileSync(path.join(files.project, 'boundary-query.cjs'), `
    process.stdin.setRawMode(true); process.stdin.setEncoding('utf8');
    let replies = 0;
    process.stdin.on('data', s => {
      if (s.includes('ask')) process.stdout.write('\\x1b[5n');
      if (s.includes('\\x1b[0n')) console.log('reply ' + ++replies);
      if (s.includes('finished')) { console.log('final replies ' + replies); process.exit(); }
    });
    console.log('query ready');
  `);
  await call('terminal_run', { name: 'Boundary.query', command: 'node boundary-query.cjs' });
  const read = async () => JSON.parse((await call('terminal_read', { name: 'Boundary.query' }, { task: failed })).text);
  await expect.poll(async () => (await read()).text).toContain('query ready');
  const stageView = await (await taskPage(ui)).locator('[data-stage-terminal] .xterm').elementHandle();
  await core((k) => {
    const w = k.shell.task.window, pictures = w.pictures;
    let release: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    k.stash.boundaryCapture = { w, pictures, requested: false, completed: false, release: () => release() };
    w.pictures = async () => { k.stash.boundaryCapture.requested = true; await gate; k.stash.boundaryCapture.completed = true; return {}; };
    k.stash.boundaryPty = k.shell.task.pty;
  });
  try {
    await (await taskPage(ui)).locator('[data-profile]').first().getByRole('button', { name: 'More', exact: true }).click();
    await expect.poll(() => core((k) => k.stash.boundaryCapture.requested)).toBe(true);
    await failScreen(core, ui, failed);
    await expect((await fallback(ui))).toBeVisible();
    await expect.poll(() => core((k) => k.shell.task.viewFailed && k.shell.task.window.viewsHidden && !k.profile('Failed.browser').view.getVisible())).toBe(true);
    await core((k) => k.stash.boundaryCapture.release());
    await expect.poll(() => core((k) => k.stash.boundaryCapture.completed)).toBe(true);
    await ui.locator('#windowMenu').click();
    await expect((await menu(ui))).toBeVisible();
    await closeMenu(ui);
    await ipcSettled(ui); await frames(ui);
    expect(await (await taskPage(ui)).evaluate(() => !(window as any).__dock && !(window as any).__stage && !(window as any).__term)).toBe(true);
    expect(await stageView.evaluate((el) => el.isConnected), 'failed visible Views unmount').toBe(false);
    expect(await core((k) => k.shell.task.pty === k.stash.boundaryPty)).toBe(true);
    // The detached buffer must still answer once; the disposed visible View must never answer.
    await call('terminal_input', { name: 'Boundary.query', text: 'ask' }, { task: failed });
    await expect.poll(async () => (await read()).text).toContain('reply 1');
    await call('terminal_input', { name: 'Boundary.query', text: 'finished' }, { task: failed });
    await expect.poll(async () => (await read()).terminal.status).toBe('exited');
    expect((await read()).text).toContain('final replies 1');
    await core((k) => { k.stash.boundaryPty.write('agent-still-running\r'); });
    await expect.poll(() => core((k) => k.ptyOutput())).toContain('agent-still-running');

    // A late menu-close request cannot undo main's failure latch.
    await (await taskPage(ui)).evaluate((task) => (window as any).kulisa.invoke('views:hidden', false, { task }), failed);
    await ui.getByRole('button', { name: 'Settings', exact: true }).click();
    await sui();
    await closeSettings(core, ui, sui);
    await selectTask(core, ui, healthy);
    await expect((await taskPage(ui)).getByRole('region', { name: 'Project', exact: true })).toBeVisible();
    await expect.poll(() => core((k) => k.profile('Healthy.browser').view.getVisible())).toBe(true);
    await selectTask(core, ui, failed);
    await expect((await fallback(ui))).toBeVisible();
    await ui.locator('#windowMenu').click(); await expect((await menu(ui))).toBeVisible(); await closeMenu(ui);
    await ipcSettled(ui); await frames(ui);
    expect(await core((k) => k.profile('Failed.browser').view.getVisible())).toBe(false);
    expect(files.log()).toContain(`[task-view] failed`);
    expect(files.log()).toContain(failed);
    expect(files.log()).not.toContain(PRIVATE);
    await closeFailedTask(ui, failed);
    expect(await core((k, key) => !k.shell.taskByKey(key).loaded && !k.shell.taskByKey(key).pty, failed)).toBe(true);
  } finally {
    await core((k) => { const c = k.stash.boundaryCapture; c.release(); c.w.pictures = c.pictures; delete k.stash.boundaryCapture; });
    await stageView.dispose();
  }
});

test('repeated failures during the first grid mount leave no controller or native page and can close normally', async ({ core, ui, call }) => {
  const healthy = await core((k) => k.shell.task.key);
  const failed = await newTask(core, ui, 'broken-initialization');
  await call('profile_create', { name: 'Initializing.browser' });
  await invoke(ui, 'task:close', failed);
  for (let attempt = 0; attempt < 2; attempt++) {
    await core((k, key) => {
      const store = k.shell.taskByKey(key).store, layout = store.layout;
      let release: () => void;
      const gate = new Promise<void>((r) => { release = r; });
      k.stash.boundaryLoad = { store, layout, requested: false, release: () => release() };
      store.layout = () => { k.stash.boundaryLoad.requested = true; return gate.then(() => layout.call(store)); };
    }, failed);
    try {
      const [id, task] = failed.split('/');
      await invoke(ui, 'project:open', { id, task });
      await expect.poll(() => core((k) => k.stash.boundaryLoad.requested)).toBe(true);
      await failScreen(core, ui, failed, () => core((k) => k.stash.boundaryLoad.release()));
      await expect((await fallback(ui))).toBeVisible();
      await notLoading(ui);
      expect(await (await taskPage(ui)).evaluate(() => !(window as any).__dock && !(window as any).__stage)).toBe(true);
      await expect.poll(() => core((k) => !k.profile('Initializing.browser').view.getVisible() && k.shell.task.viewFailed)).toBe(true);
      await closeFailedTask(ui, failed);
      await taskShown(core, healthy); await notLoading(ui);
    } finally {
      await core((k) => { const p = k.stash.boundaryLoad; p.release(); p.store.layout = p.layout; delete k.stash.boundaryLoad; });
    }
  }
});

test('moving a failed task preserves its fallback and running core instead of remounting the screen', async ({ core, ui, call }) => {
  const healthy = await core((k) => k.shell.task.key);
  const failed = await newTask(core, ui, 'broken-moved');
  await call('profile_create', { name: 'Moving.browser' });
  await core((k) => { k.stash.boundaryPty = k.shell.task.pty; });
  await failScreen(core, ui, failed);
  await expect((await fallback(ui))).toBeVisible();
  await rightClick(ui, taskTab(ui, failed));
  await choose(ui, 'Move to New Window');
  const moved = await otherPage(ui);
  await expect((await fallback(moved))).toBeVisible();
  await notLoading(moved);
  expect(await (await taskPage(moved)).evaluate(() => !(window as any).__dock && !(window as any).__stage)).toBe(true);
  expect(await core((k, key) => {
    const t = k.shell.taskByKey(key), p = [...t.profiles.values()][0];
    return t.pty === k.stash.boundaryPty && t.window.viewsHidden && !p.view.getVisible() && k.viewIn(p.view, t.window.win);
  }, failed)).toBe(true);
  await taskShown(core, healthy); await notLoading(ui);
  await taskTab(moved, failed).getByRole('button', { name: 'Close', exact: true }).click();
  await expect.poll(() => core((k, key) => !k.shell.taskByKey(key).loaded && !k.shell.taskByKey(key).viewFailed, failed)).toBe(true);
  // Moving/closing must leave the unrelated original window usable.
  await expect(taskTab(ui, healthy)).toHaveAttribute('aria-selected', 'true');
});

test('a hidden task failure leaves the selected task’s native pages visible', async ({ core, ui, call }) => {
  const healthy = await core((k) => k.shell.task.key);
  await core(async (k, site) => { await k.ensureProfile('Healthy.background-check', `${site}/app`); }, SITE);
  const failed = await newTask(core, ui, 'broken-background');
  await call('profile_create', { name: 'Background.browser' });
  await selectTask(core, ui, healthy);
  await failScreen(core, ui, failed);
  await ipcSettled(ui); await frames(ui);
  expect(await core((k) => !k.shell.task.window.viewsHidden && k.profile('Healthy.background-check').view.getVisible())).toBe(true);
  await selectTask(core, ui, failed);
  await expect((await fallback(ui))).toBeVisible();
  await closeFailedTask(ui, failed);
});

test('reporting a render failure never reads properties of the thrown object', async ({ core, ui, call, files }) => {
  const failed = await newTask(core, ui, 'broken-error-details');
  await call('profile_create', { name: 'Error.details' });
  await expect((await taskPage(ui)).locator('[data-task-view][data-active] [data-profile]')).not.toHaveCount(0);
  // The existing renderer inspection handles reach the render path; no production failure control is added.
  await (await taskPage(ui)).evaluate(() => {
    const w = window as any, profile = w.state[0];
    const error = new Error('private-terminal-content-396');
    Object.defineProperty(error, 'name', { get() { throw new Error('private-terminal-content-396'); } });
    const tab = profile.tabs[0], title = tab.title;
    w.__restoreErrorDetails = () => Object.defineProperty(tab, 'title', { configurable: true, writable: true, value: title });
    Object.defineProperty(tab, 'title', { configurable: true, get() { throw error; } });
    w.__stage.getPanel(`profile:${profile.id}`).api.updateParameters({ checkErrorDetails: true });
  });
  try { await expect((await fallback(ui))).toBeVisible(); }
  finally { await (await taskPage(ui)).evaluate(() => { const w = window as any; w.__restoreErrorDetails(); delete w.__restoreErrorDetails; }); }
  await expect.poll(() => core((k, key) => k.shell.taskByKey(key).viewFailed, failed)).toBe(true);
  expect(files.log()).not.toContain(PRIVATE);
  await closeFailedTask(ui, failed);
});
