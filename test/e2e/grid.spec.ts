// The grid of panels: panes and their pages, presets, a menu over pages that give no picture (docs/window.md, The grid).
import { test, expect } from './fixtures.ts';
import type { Page } from '@playwright/test';
import { menu, choose, closeMenu, rightClick, box, pageBox, viewOn, resourcesHeight, dock } from './helpers.ts';
import { SAM, ELON, begin, bothOn } from './tasks-helpers.ts';

const ISLAND = 'rgb(30, 31, 34)'; // --island, the panels' color, in the dark theme
// A pane's tab dragged by the hand onto a place of a target (dockview's drop zones: its edges, its middle).
async function drag(ui: Page, panel: string, target: string, where: 'right' | 'center') {
  const t = await ui.locator(target).boundingBox();
  await ui.locator(`[data-panel="${panel}"]`).dragTo(ui.locator(target), { targetPosition: { x: where === 'right' ? t.width - 10 : t.width / 2, y: t.height / 2 } });
}

test("tasks' bar: a tab is a rounded rectangle apart from the grid, as Firefox's, the shown one filled; its project's icon first", async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  const shown = ui.locator('#projectTabs [role="tab"][aria-selected="true"]'), other = ui.locator('#projectTabs [role="tab"]:not([aria-selected="true"])').first();
  const grid = await ui.locator('#dock').boundingBox(), tab = await shown.boundingBox(), icon = await shown.getByTestId('project-icon').boundingBox();
  expect(Math.round(tab.y - (grid.y + grid.height)), 'apart from the grid by the one gap').toBe(8);
  if (await other.count()) {
    const o = await other.boundingBox();
    expect(Math.round(Math.abs(o.x - (tab.x + tab.width))), 'the tabs apart by it too').toBe(8);
    await expect(other, 'the others on the window').toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  }
  expect(parseFloat(await shown.evaluate((t) => getComputedStyle(t).borderRadius)), 'rounded').toBeGreaterThanOrEqual(4);
  expect(tab.height >= 36 && tab.width >= 120, `as big as a browser's: ${tab.width} × ${tab.height}`).toBe(true);
  await expect(shown, "the shown one in the panels' color (--island)").toHaveCSS('background-color', ISLAND);
  expect(icon.width === 20 && icon.x > tab.x && icon.x <= tab.x + 12, 'the icon, 20 px, at the tab\'s start').toBe(true);
});

test("grid: a pane narrower than its profile's name: the name cut with …, its × in the pane, no list of hidden tabs", async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  const panel = files.panel(SAM);
  // A name as long as names go (64: names have no spaces to wrap at), Sam renamed so, in a pane narrower than it.
  const id = files.idOf(SAM), width = await dock(ui, (api, p) => api.getPanel(p).group.api.width, panel);
  await core((k, a) => k.shell.task.renameProfile(a.id, a.name), { id, name: 'administrator.international-tenant@enterprise-customers.example.org'.slice(0, 64) });
  try {
    await dock(ui, (api, a) => api.getPanel(a.panel).group.api.setSize({ width: a.w }), { panel, w: 300 });
    const header = ui.locator(`[data-panel="${panel}"]`), group = ui.locator('.dv-groupview').filter({ has: header }), name = header.getByTestId('profile-name');
    await expect(name).toHaveCSS('text-overflow', 'ellipsis');
    // Cut: wider than it shows (no assertion for that in Playwright).
    await expect.poll(() => name.evaluate((n) => n.scrollWidth > n.clientWidth), { timeout: 3000 }).toBe(true);
    const g = await group.boundingBox(), x = await header.getByRole('button', { name: 'Close profile' }).boundingBox();
    expect(x.width > 0 && x.x + x.width <= g.x + g.width && x.x >= g.x, 'its × in the pane').toBe(true);
    await expect(group.locator('.dv-tabs-overflow-dropdown-root'), 'no list of hidden tabs').toBeHidden();
  } finally {
    await core((k, a) => k.shell.task.renameProfile(a.id, a.name), { id, name: SAM });
    await dock(ui, (api, a) => api.getPanel(a.panel).group.api.setSize({ width: a.width }), { panel, width });
  }
});

test('grid: a pane moved next to the terminal takes its page along', async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  await drag(ui, files.panel(SAM), '[data-testid="terminal"]', 'right');
  await expect.poll(() => viewOn(core, ui, files, SAM)).toBe(true);
  await expect.poll(() => viewOn(core, ui, files, ELON)).toBe(true);
  const sam = await pageBox(ui, files, SAM), term = await box(ui, '[data-testid="terminal"]');
  expect(sam.x > term.x + term.width - 1 && sam.y + sam.height > term.y, 'Sam is right of the terminal').toBe(true);
});

test("grid: a narrow pane's bar gives up Back and Forward, then Reload, into ⋮; Pick and ⋮ stay in it down to dockview's narrowest", async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  const panel = files.panel(SAM), pane = `[role="region"][data-profile="${files.idOf(SAM)}"]`;
  const width = await dock(ui, (api, p) => api.getPanel(p).group.api.width, panel);
  // The bar's controls shown, each its name, ' out' when it is not inside the pane.
  const bar = async () => {
    const p = await ui.locator(pane).boundingBox(), names: string[] = [];
    for (const e of await ui.locator(`${pane} [role="toolbar"] > :is(button, input):not([hidden])`).filter({ visible: true }).all()) {
      const r = await e.boundingBox({ timeout: 1000 });
      names.push(await e.getAttribute('aria-label') + (r.x >= p.x && r.x + r.width <= p.x + p.width ? '' : ' out'));
    }
    return names;
  };
  const more = async (rows: string) => {
    await ui.locator(`${pane} [aria-label="More"]`).click();
    await expect(menu(ui)).toMatchAriaSnapshot(rows);
    await closeMenu(ui);
  };
  const at = async (w: number, shown: string[]) => {
    await dock(ui, (api, a) => api.getPanel(a.panel).group.api.setSize({ width: a.w }), { panel, w });
    await expect.poll(bar, { timeout: 3000, message: `${w} px` }).toEqual(shown);
  };
  await at(400, ['Back', 'Forward', 'Reload', 'Address', 'Pick an element', 'More']);
  await more(`
    - menu:
      - menuitem "Screenshot"
      - menuitem "DevTools"`);
  await at(240, ['Reload', 'Address', 'Pick an element', 'More']);
  await at(100, ['Address', 'Pick an element', 'More']);
  await more(`
    - menu:
      - menuitem "Back"
      - menuitem "Forward"
      - menuitem "Reload"
      - separator
      - menuitem "Screenshot"
      - menuitem "DevTools"`);
  await dock(ui, (api, a) => api.getPanel(a.panel).group.api.setSize({ width: a.width }), { panel, width });
});

test('grid: a pane stacked behind another as a tab hides its page until chosen', async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  await drag(ui, files.panel(SAM), `[role="region"][data-profile="${files.idOf(ELON)}"]`, 'center');
  await expect.poll(() => viewOn(core, ui, files, SAM)).toBe(true);
  expect(await core((k) => k.profile('Elon.buyer').get().view.getVisible())).toBe(false);
  await ui.locator(`[data-panel="${files.panel(ELON)}"]`).click();
  await expect.poll(() => viewOn(core, ui, files, ELON)).toBe(true);
  expect(await core((k) => k.profile('Sam.admin').get().view.getVisible())).toBe(false);
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

test('grid presets: columns, grid, focus; each fits the window, nothing cut off', async ({ core, ui, files }) => {
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
  // An arrangement chosen in ☰ (Arrange panels).
  const preset = async (name: 'Columns' | 'Two by two' | 'One at a time') => { await ui.locator('#windowMenu').click(); await choose(ui, name); };
  await preset('Columns');
  await expect.poll(() => viewOn(core, ui, files, ELON)).toBe(true);
  await fits();
  let b = await at();
  expect(b.sam.x < b.elon.x && b.sam.y === b.elon.y && b.term.y > b.sam.y + b.sam.height - 1, 'profiles side by side, terminal below').toBe(true);
  // Resources right of the terminal, in its row, a quarter of the grid (laid out maybe a frame after the pages).
  const resources = () => box(ui, '#resources');
  const placed = async () => {
    const r = await resources(), t = await box(ui, '[data-testid="terminal"]');
    return r.x > t.x + t.width - 1 && r.y > b.sam.y + b.sam.height - 1 && Math.abs(r.width / await dock(ui, (api) => api.width) - 0.25) < 0.02;
  };
  await expect.poll(placed, { timeout: 3000, message: 'Resources right of the terminal, a quarter of the grid' }).toBe(true);
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
  await preset('One at a time');
  await expect.poll(() => viewOn(core, ui, files, SAM)).toBe(true);
  await fits();
  b = await at();
  expect(b.elon, 'Elon is a tab behind Sam').toBe(null);
  expect(b.term.y > b.sam.y + b.sam.height - 1).toBe(true);
  await preset('Two by two');
  await bothOn(core, ui, files);
  await fits();
  b = await at();
  expect(b.sam.x < b.elon.x && b.term.x > b.elon.x + b.elon.width - 1, 'profiles in a row of two, terminal on the right').toBe(true);
  // Resources under the terminal, in its column; made taller, as its gap does: kept with the grid.
  const res = await box(ui, '#resources'), term = await box(ui, 'nav[aria-label="Terminals"]');
  expect(res.y > term.y && Math.abs(res.x - term.x) < 20, 'Resources under the terminal').toBe(true);
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
