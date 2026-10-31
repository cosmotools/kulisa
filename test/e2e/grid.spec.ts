// The grid of panels: panes and their pages, presets, a menu over pages that give no picture (docs/window.md, The grid).
import { test, expect } from './fixtures.ts';
import type { Page } from '@playwright/test';
import { menu, closeMenu, rightClick, box, pageBox, viewOn, resourcesHeight, dock, stageDock } from './helpers.ts';
import { SAM, ELON, begin, bothOn } from './tasks-helpers.ts';

// A pane's tab dragged by the hand onto a place of a target (dockview's drop zones: its edges, its middle).
// Moved on only once the drag is under way (the pages pictures): a drop let go before dockview has its drop targets is
// lost.
async function drag(ui: Page, panel: string, target: string, where: 'right' | 'center') {
  const f = await ui.locator(`[data-panel="${panel}"]`).boundingBox(), t = await ui.locator(target).boundingBox();
  await ui.mouse.move(f.x + f.width / 2, f.y + f.height / 2);
  await ui.mouse.down();
  await ui.mouse.move(f.x + f.width / 2 + 40, f.y + f.height / 2 + 40, { steps: 4 });
  await expect(ui.getByTestId('page').getByTestId('snapshot').first()).toBeVisible();
  await ui.mouse.move(t.x + (where === 'right' ? t.width - 10 : t.width / 2), t.y + t.height / 2, { steps: 8 });
  await ui.mouse.up();
}

test("tasks' bar: under the grid, a tab per open task, its project's icon first, its name after; the shown one selected", async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  const shown = ui.locator('#taskTabs [role="tab"][aria-selected="true"]');
  await expect(shown).toHaveCount(1);
  const grid = await ui.locator('#dock').boundingBox(), tab = await shown.boundingBox(), icon = await shown.getByTestId('project-icon').boundingBox();
  const name = await shown.getByText(await shown.getAttribute('aria-label'), { exact: true }).boundingBox();
  expect(tab.y >= grid.y + grid.height - 1, 'under the grid').toBe(true);
  expect(tab.width >= 160, `wide enough for a name: ${tab.width}`).toBe(true);
  expect(icon.width === 16 && icon.x > tab.x && icon.x + icon.width <= name.x, "the icon at the tab's start, the name after it").toBe(true);
});

test("grid: a pane narrower than its profile's name: the name cut with …, its × in the pane, no list of hidden tabs", async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  const panel = files.panel(SAM);
  // A name as long as names go (64: names have no spaces to wrap at), Sam renamed so, in a pane narrower than it.
  const id = files.idOf(SAM), width = await stageDock(ui, (api, p) => api.getPanel(p).group.api.width, panel);
  await core((k, a) => k.shell.task.renameProfile(a.id, a.name), { id, name: 'administrator.international-tenant@enterprise-customers.example.org'.slice(0, 64) });
  try {
    await stageDock(ui, (api, a) => api.getPanel(a.panel).group.api.setSize({ width: a.w }), { panel, w: 300 });
    const header = ui.locator(`[data-panel="${panel}"]`), group = ui.getByTestId('stage').locator('.dv-groupview').filter({ has: header }), name = header.getByTestId('profile-name');
    await expect(name).toHaveCSS('text-overflow', 'ellipsis');
    // Cut: wider than it shows (no assertion for that in Playwright).
    await expect.poll(() => name.evaluate((n) => n.scrollWidth > n.clientWidth), { timeout: 3000 }).toBe(true);
    const g = await group.boundingBox(), x = await header.getByRole('button', { name: 'Close profile' }).boundingBox();
    expect(x.width > 0 && x.x + x.width <= g.x + g.width && x.x >= g.x, 'its × in the pane').toBe(true);
    await expect(group.locator('.dv-tabs-overflow-dropdown-root'), 'no list of hidden tabs').toBeHidden();
  } finally {
    await core((k, a) => k.shell.task.renameProfile(a.id, a.name), { id, name: SAM });
    await stageDock(ui, (api, a) => api.getPanel(a.panel).group.api.setSize({ width: a.width }), { panel, width });
  }
});

test('grid: environment panes stay in the stage when dragged onto a development terminal', async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  await drag(ui, files.panel(SAM), '[data-testid="terminal"]', 'right');
  await expect.poll(() => viewOn(core, ui, files, SAM)).toBe(true);
  await expect.poll(() => viewOn(core, ui, files, ELON)).toBe(true);
  const sam = await pageBox(ui, files, SAM), term = await box(ui, '[data-testid="terminal"]');
  expect(sam.y + sam.height <= term.y, 'Sam stays in the testing stage above the development terminal').toBe(true);
  expect(await stageDock(ui, (api, id) => !!api.getPanel(id), files.panel(SAM))).toBe(true);
  expect(await dock(ui, (api, id) => !!api.getPanel(id), files.panel(SAM))).toBe(false);
});

test("grid: a narrow pane's bar gives up Back and Forward, then Reload, into ⋮; Pick and ⋮ stay in it down to dockview's narrowest", async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  const panel = files.panel(SAM), pane = `[role="region"][data-profile="${files.idOf(SAM)}"]`;
  const width = await stageDock(ui, (api, p) => api.getPanel(p).group.api.width, panel);
  // The bar's controls shown, each its name, ' out' when it is not inside the pane. Read at once, in one
  // layout: a locator's readings one by one could straddle a resize.
  const bar = () => ui.evaluate((sel) => {
    const p = document.querySelector(sel).getBoundingClientRect();
    return [...document.querySelectorAll(`${sel} [role="group"][aria-label="Page"] :is(button, input)`)].filter((e) => e.checkVisibility()).map((e) => {
      const r = e.getBoundingClientRect();
      return e.getAttribute('aria-label') + (r.x >= p.x && r.right <= p.right ? '' : ' out');
    });
  }, pane);
  const more = async (rows: string) => {
    await ui.locator(`${pane} [aria-label="More"]`).click();
    await expect(menu(ui)).toMatchAriaSnapshot(rows);
    await closeMenu(ui);
  };
  const at = async (w: number, shown: string[]) => {
    await stageDock(ui, (api, a) => api.getPanel(a.panel).group.api.setSize({ width: a.w }), { panel, w });
    await expect.poll(bar, { timeout: 3000, message: `${w} px` }).toEqual(shown);
  };
  await at(400, ['Back', 'Forward', 'Reload', 'Address', 'Pick an element', 'More']);
  const shots = `
      - text: Screenshot
      - menuitem /^Element/
      - menuitem "Visible Part"
      - menuitem "Full Page"
      - menuitem /^DevTools/`;
  await more(`
    - menu: ${shots}`);
  await at(272, ['Reload', 'Address', 'Pick an element', 'More']);
  await at(100, ['Address', 'Pick an element', 'More']);
  await more(`
    - menu:
      - menuitem /^Back/
      - menuitem /^Forward/
      - menuitem /^Reload/ ${shots}`);
  await stageDock(ui, (api, a) => api.getPanel(a.panel).group.api.setSize({ width: a.width }), { panel, width });
});

test('grid: a pane stacked behind another as a tab hides its page until chosen', async ({ core, ui, files }) => {
  // Polled: dockview may still count the pane behind as visible in the drop's first layout; the next one hides it.
  await begin(core, ui, files, { columns: true });
  await drag(ui, files.panel(SAM), `[role="region"][data-profile="${files.idOf(ELON)}"]`, 'center');
  await expect.poll(() => viewOn(core, ui, files, SAM)).toBe(true);
  await expect.poll(() => core((k) => k.profile('Elon.buyer').get().view.getVisible())).toBe(false);
  await ui.locator(`[data-panel="${files.panel(ELON)}"]`).click();
  await expect.poll(() => viewOn(core, ui, files, ELON)).toBe(true);
  await expect.poll(() => core((k) => k.profile('Sam.admin').get().view.getVisible())).toBe(false);
});

test('grid: while a pane is dragged, pages are pictures (drop targets are HTML), live again after the drop', async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  // Pressed on Elon's tab and moved: the drag begins; let go where it began (on its own tab: nowhere to go).
  const b = await ui.locator(`[data-panel="${files.panel(ELON)}"]`).boundingBox(), at = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await ui.mouse.move(at.x, at.y);
  await ui.mouse.down();
  await ui.mouse.move(at.x + 40, at.y + 40, { steps: 4 });
  await expect.poll(() => core((k) => [...k.shell.profiles.values()].every((p) => !p.get().view.getVisible()))).toBe(true);
  await expect(ui.getByTestId('page').getByTestId('snapshot')).toHaveCount(2);
  await ui.mouse.move(at.x, at.y, { steps: 4 });
  await ui.mouse.up();
  await bothOn(core, ui, files);
  await expect(ui.getByTestId('page').getByTestId('snapshot')).toHaveCount(0);
});

test('resizing Resources updates the agent terminal at fractional widths and heights', async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  const terminalSize = () => ui.evaluate(() => { const t = (window as any).__term; return { cols: t.cols, rows: t.rows }; });
  const fitted = () => ui.getByTestId('terminal').evaluate((el) => {
    const host = el.querySelector('.xterm').parentElement, screen = el.querySelector('.xterm-screen');
    return Math.abs(host.clientWidth - screen.clientWidth) < 30 && Math.abs(host.clientHeight - screen.clientHeight) < 30;
  });
  const workspace = await dock(ui, (api) => api.toJSON());
  try {
    // Dockview preserves fractional sash positions; its API supplies the same size deterministically on every OS.
    await dock(ui, (api) => {
      api.getPanel('resources').api.moveTo({ group: api.getPanel('terminal').group, position: 'right' });
      api.getPanel('resources').group.api.setSize({ width: Math.round(api.width / 3) });
    });
    await expect.poll(fitted).toBe(true);
    const before = await terminalSize();
    await dock(ui, (api) => api.getPanel('resources').group.api.setSize({ width: Math.round(api.width / 3) - 160.25 }));
    await expect.poll(async () => (await terminalSize()).cols).toBeGreaterThan(before.cols);
    await dock(ui, (api) => api.getPanel('resources').group.api.setSize({ width: Math.round(api.width / 3) + 160.75 }));
    await expect.poll(async () => (await terminalSize()).cols).toBeLessThan(before.cols);
    await dock(ui, (api) => {
      api.getPanel('resources').api.moveTo({ group: api.getPanel('terminal').group, position: 'bottom' });
      api.getPanel('resources').group.api.setSize({ height: Math.round(api.height / 3) });
    });
    await expect.poll(fitted).toBe(true);
    const rows = (await terminalSize()).rows;
    await dock(ui, (api) => api.getPanel('resources').group.api.setSize({ height: Math.round(api.height / 3) + 70.25 }));
    await expect.poll(async () => (await terminalSize()).rows).toBeLessThan(rows);
    await expect.poll(fitted).toBe(true);
    await expect.poll(() => core((k) => ({ cols: k.shell.pty.cols, rows: k.shell.pty.rows }))).toEqual(await terminalSize());
  } finally { await dock(ui, (api, saved) => api.fromJSON(saved), workspace); }
});

test('workspace and stage presets each fit the window without changing the other layout', async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  const at = async () => ({ sam: await pageBox(ui, files, SAM), elon: await pageBox(ui, files, ELON), term: await box(ui, '[data-testid="terminal"]') });
  // Every panel inside the grid's room (#dock less its padding): none cut off at the right or the bottom.
  const fits = async () => {
    const d = await ui.locator('#dock').boundingBox(), pad = await ui.locator('#dock').evaluate((e) => { const s = getComputedStyle(e); return { right: parseFloat(s.paddingRight), bottom: parseFloat(s.paddingBottom) }; });
    const right = d.x + d.width - pad.right, bottom = d.y + d.height - pad.bottom, cut = [];
    for (const g of await ui.locator('#dock .dv-groupview').filter({ visible: true }).all()) {
      const r = await g.boundingBox();
      if (r.x + r.width > right + 1 || r.y + r.height > bottom + 1) cut.push({ right: r.x + r.width - right, bottom: r.y + r.height - bottom });
    }
    expect(cut, 'panels cut off').toEqual([]);
  };
  // Stage position and view are independent choices in its title-bar menu.
  const preset = async (name: 'Above' | 'Left') => { await ui.getByRole('button', { name: 'Stage', exact: true }).click(); await ui.getByRole('menuitemradio', { name, exact: true }).click(); };
  const stagePreset = async (name: string) => { await ui.getByRole('button', { name: 'Stage', exact: true }).click(); await ui.getByRole('menuitemradio', { name, exact: true }).click(); };
  await preset('Above');
  await expect.poll(() => viewOn(core, ui, files, ELON)).toBe(true);
  await fits();
  let b = await at();
  expect(b.sam.x < b.elon.x && b.sam.y === b.elon.y && b.term.y > b.sam.y + b.sam.height - 1, 'profiles side by side, terminal below').toBe(true);
  // Resources left of the terminal, in its row, a quarter of the grid (laid out maybe a frame after the pages).
  const resources = () => box(ui, '#resources');
  const placed = async () => {
    const r = await resources(), t = await box(ui, '[data-testid="terminal"]');
    return r.x + r.width <= t.x + 1 && r.y > b.sam.y + b.sam.height - 1 && Math.abs(r.width / await dock(ui, (api) => api.width) - 0.25) < 0.02;
  };
  await expect.poll(placed, { timeout: 3000, message: 'Resources left of the terminal, a quarter of the grid' }).toBe(true);
  const side = await resources();
  b = await at();
  // A narrower window takes from every panel in its share, not from the last one alone; wider gives back the same way.
  const size = await core((k) => k.shell.win.getSize()), both = (x: typeof b) => x.sam.width + x.elon.width, share = (x: typeof b) => x.sam.width / both(x);
  const was = share(b), wide = both(b), row = side.width / b.term.width;
  await core((k, s) => k.shell.win.setSize(s[0] - 300, s[1]), size);
  await expect.poll(async () => { b = await at(); return !!b.sam && !!b.elon && both(b) < wide - 200; }).toBe(true);
  expect(Math.abs(share(b) - was), `shares kept: ${share(b)} vs ${was}`).toBeLessThan(0.02);
  // The terminal's row too, laid out a frame later perhaps: Resources and the terminal keep theirs.
  const kept = async () => { const r = await resources(), t = await box(ui, '[data-testid="terminal"]'); return r.width < side.width && Math.abs(r.width / t.width - row) < 0.02; };
  await expect.poll(kept, { timeout: 3000, message: 'the terminal and Resources keep their shares' }).toBe(true);
  await core((k, s) => k.shell.win.setSize(s[0], s[1]), size);
  await expect.poll(async () => { b = await at(); return !!b.sam && !!b.elon && Math.abs(share(b) - was) < 0.02 && viewOn(core, ui, files, ELON); }).toBe(true);
  await stagePreset('Tabs');
  await expect.poll(() => viewOn(core, ui, files, SAM)).toBe(true);
  await fits();
  b = await at();
  expect(b.elon, 'Elon is a tab behind Sam').toBe(null);
  expect(b.term.y > b.sam.y + b.sam.height - 1).toBe(true);
  await stagePreset('Vertical stack');
  await preset('Left');
  await bothOn(core, ui, files);
  await fits();
  b = await at();
  expect(b.sam.y < b.elon.y && b.term.x > b.sam.x + b.sam.width - 1, 'profiles in a vertical stack, terminal on the right').toBe(true);
  // Moving Stage preserves Resources beside the terminal; its own docking stays independent.
  const res = await box(ui, '#resources'), term = await box(ui, 'nav[aria-label="Terminals"]');
  expect(res.x < term.x && Math.abs(res.y - term.y) < 40, 'Resources beside the terminal').toBe(true);
  await dock(ui, (api) => api.getPanel('resources').api.moveTo({ group: api.getPanel('terminal').group, position: 'bottom' }));
  // Sized by dockview's API, as a drag of its sash sizes it: the sash is a bare element with no name to find it by.
  await dock(ui, (api) => api.getPanel('resources').group.api.setSize({ height: 300 }));
  await expect.poll(async () => { const h = await resourcesHeight(ui); return h > 280 && files.savedResourcesHeight() === h; }).toBe(true);
});

test('a menu opens even when a page gives no picture (a page that draws no frames: covered, the monitor off, busy)', async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  await core((k) => { k.profile('Elon.buyer').get().wc.capturePage = () => new Promise(() => {}); }); // never
  try {
    await rightClick(ui, `[data-panel="${files.panel(ELON)}"]`);
    await expect(menu(ui)).toBeVisible({ timeout: 2000 });
    expect(await ui.locator(`[role="region"][data-profile="${files.idOf(ELON)}"] [data-testid="page"] [data-testid="snapshot"]`).count(), 'no picture, the pane is empty meanwhile').toBe(0);
    await closeMenu(ui);
    await expect(menu(ui)).toHaveCount(0);
  } finally { await core((k) => { delete k.profile('Elon.buyer').get().wc.capturePage; }); }
});
