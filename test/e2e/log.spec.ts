// The log in Settings (docs/window.md, The log): what Kulisa did, live, filtered, saved, sent as an issue.
import fs from 'fs';
import path from 'path';
import { test, expect } from './fixtures.ts';
import { CHECKOUT, menu, choose, closeSettings, invoke } from './helpers.ts';

test("☰ → Report a Problem… opens Settings at the Log page: the log so far and live, each line with its time and tag; chips and a text filter; Copy All, Save As… (a file), Open Folder; Report… → On GitHub… opens a new issue with the environment filled in", async ({ core, ui, sui, files }) => {
  await ui.locator('#windowMenu').click();
  await expect(menu(ui)).toBeVisible();
  await choose(ui, 'Report a Problem…');
  const s = await sui();
  const line = s.locator('#logpage [role="log"] > div'), lines = () => line.allTextContents();
  await expect(s.locator('#pjlist [data-page="log"]')).toHaveAttribute('aria-current', 'page');
  await expect(s.locator('#lgconfig')).toBeVisible();
  await expect(line.first()).toBeVisible();
  expect(await line.first().textContent(), 'the time and the tag, the date in the tooltip').toMatch(/^\d\d:\d\d:\d\d\.\d{3}\[kulisa\]start \d+\.\d+\.\d+, electron /);
  await expect(line.first(), 'the date and the time zone').toHaveAttribute('title', /^\d{4}-\d\d-\d\d [+-]\d\d:\d\d$/);
  await expect(s.locator('#logpage [role="log"] > div[data-tag="kulisa"]').first(), "the tag in its group's color").toHaveAttribute('data-group', 'tasks');
  // Live: what is logged now comes at the end, Follow keeping it in view.
  const theme = await core((k) => k.electron.nativeTheme.themeSource);
  await invoke(ui, 'theme:set', 'dark');
  await expect.poll(async () => (await lines()).at(-1)).toContain('[ipc]theme:set wc=');
  await expect(line.last(), 'the end in view').toBeInViewport();
  // Errors: a page's error is a warning line, in red; the chip shows those alone.
  await ui.evaluate(() => console.error('boom-for-the-log'));
  await expect.poll(async () => (await lines()).some((l) => l.includes('boom-for-the-log'))).toBe(true);
  const chip = (id: string) => s.locator(`#logchips [data-chip="${id}"]`).click();
  const typeFilter = (text: string) => s.locator('#logfilter').fill(text);
  await chip('errors');
  await expect(line.filter({ hasText: 'boom-for-the-log' })).not.toHaveCount(0);
  await expect(line.and(s.locator(':not([data-bad])')), 'errors alone').toHaveCount(0);
  await expect(s.locator('#logpage [role="log"] > div[data-tag="page"]').first(), 'in red').toHaveAttribute('data-bad');
  // A chip and the text filter on top of it; nothing left says so.
  await chip('tasks');
  await typeFilter('[kulisa] start');
  // Two at most: a second Kulisa's start, told it is running already.
  await expect.poll(async () => { const l = await lines(); return l.length > 0 && l.length < 5 && l.every((x) => x.includes('[kulisa]start')); }).toBe(true);
  await typeFilter('nothing-like-this');
  await expect(s.locator('#logpage').getByText('Nothing matches.', { exact: true })).toBeVisible();
  await typeFilter('');
  await chip('all');
  await expect.poll(async () => (await lines()).length).toBeGreaterThan(10);
  // Under it: the file's size, and what is never in it.
  await expect(s.locator('#logpage').getByText(/^kulisa\.log, /)).toHaveText(/^kulisa\.log, \d+ KB of 1 MB\. Never here: what you typed, passwords, tokens, cookies, the pages' queries\.$/);
  // Save As…: where the human says, the file as it is.
  const saved = path.join(files.root, 'saved.log'), log = path.join(files.userData, 'logs', 'kulisa.log');
  await core((k, f) => {
    const g = k.stash;
    g.showSaveDialog = k.electron.dialog.showSaveDialog;
    k.electron.dialog.showSaveDialog = (async () => ({ canceled: false, filePath: f }));
  }, saved);
  try {
    await s.locator('#logsave').click();
    await expect.poll(() => fs.existsSync(saved)).toBe(true);
  } finally { await core((k) => { k.electron.dialog.showSaveDialog = k.stash.showSaveDialog; }); }
  expect(fs.readFileSync(saved, 'utf8').split('\n')[0]).toBe(fs.readFileSync(log, 'utf8').split('\n')[0]);
  await expect(s.locator('#logpage [role="status"]')).toHaveText(/^Saved as /);
  fs.rmSync(saved);
  // Open Folder: the file picked out in the file manager.
  await core((k) => {
    const g = k.stash;
    g.showItemInFolder = k.electron.shell.showItemInFolder;
    g.shownItems = [];
    k.electron.shell.showItemInFolder = (p: string) => { g.shownItems.push(p); };
  });
  try {
    await s.locator('#logfolder').click();
    await expect.poll(() => core((k) => k.stash.shownItems as string[])).toHaveLength(1);
  } finally { await core((k) => { k.electron.shell.showItemInFolder = k.stash.showItemInFolder; }); }
  expect((await core((k) => k.stash.shownItems as string[]))[0]).toBe(log);
  // Report… → On GitHub…: a new issue from the template in the user's browser, the environment filled in (the start
  // line's facts). The pages Kulisa opens in the user's browser are noted, not opened (app.ts).
  const opened = await core((k) => k.openedExternally.length);
  await s.locator('#logreport').click();
  await expect(menu(s)).toMatchAriaSnapshot(`
    - menu:
      - menuitem "On GitHub…"`);
  await choose(s, 'On GitHub…');
  await expect.poll(() => core((k) => k.openedExternally.length)).toBe(opened + 1);
  const u = new URL(await core((k) => k.openedExternally.at(-1)));
  expect(u.origin + u.pathname).toBe('https://github.com/cosmotools/kulisa/issues/new');
  expect(u.searchParams.get('template')).toBe('bug.yml');
  expect(u.searchParams.get('environment')).toMatch(/^Kulisa \d+\.\d+\.\d+, electron \d+\.\d+\.\d+, \w+ \S+.*, from source$/);
  expect(fs.readFileSync(path.join(CHECKOUT, '.github', 'ISSUE_TEMPLATE', 'bug.yml'), 'utf8'), 'the template with that field').toMatch(/id: environment/);
  await closeSettings(core, ui, sui);
  await invoke(ui, 'theme:set', theme);
});
