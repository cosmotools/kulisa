// The log in Settings (docs/window.md, The log): what Kulisa did, live, filtered, saved, sent as an issue.
import fs from 'fs';
import path from 'path';
import { test, expect } from './fixtures.ts';
import { CHECKOUT, menu, choose, closeSettings, invoke } from './helpers.ts';

test("☰ → Report a Problem… opens Settings at the Log page: the log so far and live, each line with its time and tag, Follow; what to show and a text filter; Copy All, Save As… (a file), Open Folder; Report… → On GitHub… opens a new issue with the environment filled in", async ({ core, ui, sui, files }) => {
  await ui.locator('#windowMenu').click();
  await expect(menu(ui)).toBeVisible();
  await choose(ui, 'Report a Problem…');
  const s = await sui();
  const log = s.getByRole('log', { name: 'Log' }), line = log.locator('[data-tag]'), lines = () => line.allTextContents();
  await expect(s.locator('[data-key="log"]'), 'the Log page chosen in the nav').toHaveAttribute('aria-current', 'page');
  await expect(line.first()).toBeVisible();
  expect(await line.first().textContent(), 'the time and the tag').toMatch(/^\d\d:\d\d:\d\d\.\d{3}\[kulisa\]start \d+\.\d+\.\d+, electron /);
  await expect(line.first(), 'the date and the time zone in its tooltip').toHaveAttribute('title', /^\d{4}-\d\d-\d\d [+-]\d\d:\d\d$/);
  await expect(log.locator('[data-tag="kulisa"]').first(), "the tag in its group's color").toHaveAttribute('data-group', 'tasks');
  // Live: what is logged now comes at the end, Follow keeping it in view.
  const theme = await core((k) => k.electron.nativeTheme.themeSource);
  await invoke(ui, 'theme:set', 'dark');
  await expect.poll(async () => (await lines()).at(-1)).toContain('[ipc]theme:set wc=');
  await expect(line.last(), 'the end in view').toBeInViewport();
  // Scrolled up, Follow lets go; checked again, back to the end. Lines logged until there is somewhere to scroll: Settings
  // takes the whole window; more than the 4 px threshold for following the end.
  while (await log.evaluate((b) => b.scrollHeight - b.clientHeight < 40)) await invoke(ui, 'theme:set', 'dark');
  const follow = s.getByRole('switch', { name: 'Follow' });
  await log.hover();
  await s.mouse.wheel(0, -100000);
  await expect(follow).not.toBeChecked();
  await follow.check();
  await expect(line.last()).toBeInViewport();
  // Errors: a page's error is a warning line, in red; Errors shows those alone.
  await ui.evaluate(() => console.error('boom-for-the-log'));
  await expect.poll(async () => (await lines()).some((l) => l.includes('boom-for-the-log'))).toBe(true);
  const showOnly = (name: string) => s.getByRole('radiogroup', { name: 'Show' }).getByRole('radio', { name, exact: true }).click();
  const typeFilter = (text: string) => s.getByRole('searchbox', { name: 'Filter' }).fill(text);
  await showOnly('Errors');
  await expect(s.getByRole('radio', { name: 'Errors', exact: true })).toBeChecked();
  await expect(line.filter({ hasText: 'boom-for-the-log' })).not.toHaveCount(0);
  await expect(line.and(s.locator(':not([data-bad])')), 'errors alone').toHaveCount(0);
  await expect(log.locator('[data-tag="page"]').first(), 'in red').toHaveAttribute('data-bad');
  // A filter of who acted, and the text filter on top of it; nothing left says so.
  await showOnly('Tasks');
  await typeFilter('[kulisa] start');
  // Two at most: a second Kulisa's start, told it is running already.
  await expect.poll(async () => { const l = await lines(); return l.length > 0 && l.length < 5 && l.every((x) => x.includes('[kulisa]start')); }).toBe(true);
  await typeFilter('nothing-like-this');
  await expect(log.getByText('Nothing matches.', { exact: true })).toBeVisible();
  await typeFilter('');
  await showOnly('All');
  await expect.poll(async () => (await lines()).length).toBeGreaterThan(10);
  // Under it: the file's size, and what is never in it.
  await expect(s.getByText(/^kulisa\.log, /)).toHaveText(/^kulisa\.log, \d+ KB of 1 MB\. Never here: what you typed, passwords, tokens, cookies, the pages' queries\.$/);
  // Copy All: the whole log, line by line as the file has it.
  await s.getByRole('button', { name: 'Copy All' }).click();
  await expect(s.locator('[data-sonner-toast]').filter({ hasText: /^Copied$/ }), 'a toast').toBeVisible();
  expect((await core((k) => k.electron.clipboard.readText())).split('\n')[0]).toMatch(/^\[\d{4}-\d\d-\d\dT[^\]]+\] \[info\]\s*\[kulisa\] start /);
  // Save As…: where the human says, the file as it is.
  const saved = path.join(files.root, 'saved.log'), file = path.join(files.userData, 'logs', 'kulisa.log');
  await core((k, f) => {
    const g = k.stash;
    g.showSaveDialog = k.electron.dialog.showSaveDialog;
    k.electron.dialog.showSaveDialog = (async () => ({ canceled: false, filePath: f }));
  }, saved);
  try {
    await s.getByRole('button', { name: 'Save As…' }).click();
    await expect.poll(() => fs.existsSync(saved)).toBe(true);
  } finally { await core((k) => { k.electron.dialog.showSaveDialog = k.stash.showSaveDialog; }); }
  expect(fs.readFileSync(saved, 'utf8').split('\n')[0]).toBe(fs.readFileSync(file, 'utf8').split('\n')[0]);
  const toast = s.locator('[data-sonner-toast]').filter({ hasText: `Saved as ${saved}` });
  await expect(toast, 'a toast').toBeVisible();
  await expect(toast.getByRole('button', { name: 'Show in Folder' })).toBeVisible();
  fs.rmSync(saved);
  // Open Folder: the file picked out in the file manager.
  await core((k) => {
    const g = k.stash;
    g.showItemInFolder = k.electron.shell.showItemInFolder;
    g.shownItems = [];
    k.electron.shell.showItemInFolder = (p: string) => { g.shownItems.push(p); };
  });
  try {
    await s.getByRole('button', { name: 'Open Folder' }).click();
    await expect.poll(() => core((k) => k.stash.shownItems as string[])).toHaveLength(1);
  } finally { await core((k) => { k.electron.shell.showItemInFolder = k.stash.showItemInFolder; }); }
  expect((await core((k) => k.stash.shownItems as string[]))[0]).toBe(file);
  // Report… → On GitHub…: a new issue from the template in the user's browser, the environment filled in (the start
  // line's facts). The pages Kulisa opens in the user's browser are noted, not opened (app.ts).
  const opened = await core((k) => k.openedExternally.length);
  await s.getByRole('button', { name: 'Report…' }).click();
  await expect(s.getByRole('menu')).toMatchAriaSnapshot(`
    - menu:
      - menuitem /^On GitHub…/`);
  await s.getByRole('menuitem', { name: /^On GitHub…/ }).click();
  await expect.poll(() => core((k) => k.openedExternally.length)).toBe(opened + 1);
  const u = new URL(await core((k) => k.openedExternally.at(-1)));
  expect(u.origin + u.pathname).toBe('https://github.com/cosmotools/kulisa/issues/new');
  expect(u.searchParams.get('template')).toBe('bug.yml');
  expect(u.searchParams.get('environment')).toMatch(/^Kulisa \d+\.\d+\.\d+, electron \d+\.\d+\.\d+, \w+ \S+.*, from source$/);
  expect(fs.readFileSync(path.join(CHECKOUT, '.github', 'ISSUE_TEMPLATE', 'bug.yml'), 'utf8'), 'the template with that field').toMatch(/id: environment/);
  await closeSettings(core, ui, sui);
  await invoke(ui, 'theme:set', theme);
});

test('a large log scrolls through every entry with few rendered rows; filtering and Copy All reach the whole log', async ({ core, ui, sui, files }, testInfo) => {
  const file = path.join(files.userData, 'logs', 'kulisa.log');
  const text = Array.from({ length: 1600 }, (_, i) => `[2026-01-01T12:00:00.000+00:00] [info] [task] virtual-entry-${String(i).padStart(4, '0')}${i % 7 === 0 ? ' wrapped words'.repeat(30) : ''}`).join('\n') + '\n';
  fs.appendFileSync(file, text);
  await ui.locator('#windowMenu').click();
  await choose(ui, 'Report a Problem…');
  const s = await sui(), log = s.getByRole('log', { name: 'Log' });
  const rows = log.locator('[data-tag]');
  const entry = (n: string) => rows.filter({ hasText: `virtual-entry-${n}` });
  await expect(entry('1599')).toBeInViewport();
  await expect.poll(() => rows.count()).toBeLessThan(100);
  await s.getByRole('searchbox', { name: 'Filter' }).fill('virtual-entry-');
  await expect(entry('1599')).toBeInViewport();
  await log.hover();
  await s.mouse.wheel(0, -100000);
  await expect(entry('0000')).toBeInViewport();
  await expect(s.getByRole('switch', { name: 'Follow' })).not.toBeChecked();
  await expect.poll(() => rows.count()).toBeLessThan(100);
  const before = await entry('0000').boundingBox();
  await ui.evaluate(() => console.error('virtual-live-after-pause'));
  await expect.poll(() => fs.readFileSync(file, 'utf8')).toContain('virtual-live-after-pause');
  await expect(entry('0000')).toBeInViewport();
  expect((await entry('0000').boundingBox()).y).toBeCloseTo(before.y, 0);
  await s.getByRole('searchbox', { name: 'Filter' }).fill('');
  await s.getByRole('switch', { name: 'Follow' }).check();
  await expect(rows.filter({ hasText: 'virtual-live-after-pause' })).toBeInViewport();
  await s.getByRole('searchbox', { name: 'Filter' }).fill('virtual-entry-0000');
  await expect(rows).toHaveCount(1);
  await expect(entry('0000')).toBeInViewport();
  await s.getByRole('radio', { name: 'Errors', exact: true }).click();
  await expect(log.getByText('Nothing matches.', { exact: true })).toBeVisible();
  await s.getByRole('radio', { name: 'Tasks', exact: true }).click();
  await expect(entry('0000')).toBeInViewport();
  await s.getByRole('button', { name: 'Copy All' }).click();
  await expect.poll(() => core((k) => k.electron.clipboard.readText())).toContain('virtual-entry-0000');
  const copied = await core((k) => k.electron.clipboard.readText());
  expect(copied).toContain('virtual-entry-0000');
  expect(copied).toContain('virtual-entry-1599');
  await s.getByRole('searchbox', { name: 'Filter' }).fill('');
  await s.getByRole('radio', { name: 'All', exact: true }).click();
  await expect(rows.filter({ hasText: 'virtual-live-after-pause' })).toBeInViewport();
  await expect.poll(() => rows.count()).toBeLessThan(100);
  await core((k, f) => k.shot(f), testInfo.outputPath('log-virtual.png'));
  await closeSettings(core, ui, sui);
});
