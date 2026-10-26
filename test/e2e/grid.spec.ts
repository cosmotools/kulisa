// The grid of panels: panes and their pages, presets, a menu over pages that give no picture (docs/window.md, The grid).
import { test, expect } from './fixtures.ts';
import { menu, menuRows, closeMenu, rightClick, box, pageBox, viewOn, resourcesHeight, dock } from './helpers.ts';
import { SAM, ELON, begin, bothOn } from './tasks-helpers.ts';

test("tasks' bar: a tab is a rounded rectangle apart from the grid, as Firefox's, the shown one filled; its project's icon first", async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  const [grid, tab, icon, look] = await ui.evaluate(() => {
    const t = document.querySelector('#projectTabs [role="tab"][aria-selected="true"]'), c = (q: string) => getComputedStyle(document.querySelector(q));
    const island = (() => { const i = document.body.appendChild(document.createElement('i')); i.style.background = 'var(--island)'; const v = getComputedStyle(i).backgroundColor; i.remove(); return v; })();
    const other = document.querySelector('#projectTabs [role="tab"]:not([aria-selected="true"])');
    const dock = document.getElementById('dock').getBoundingClientRect().toJSON();
    return [dock, t.getBoundingClientRect().toJSON(), t.querySelector('[data-testid="project-icon"]').getBoundingClientRect().toJSON(),
      { radius: c('#projectTabs [role="tab"][aria-selected="true"]').borderRadius, active: c('#projectTabs [role="tab"][aria-selected="true"]').backgroundColor,
        other: other ? getComputedStyle(other).backgroundColor : null, island,
        apart: other ? Math.abs(other.getBoundingClientRect().left - t.getBoundingClientRect().right) : null }];
  });
  expect(Math.round(tab.top - grid.bottom), 'apart from the grid by the one gap').toBe(8);
  if (look.other) expect(Math.round(look.apart), 'the tabs apart by it too').toBe(8);
  expect(parseFloat(look.radius), `rounded: ${look.radius}`).toBeGreaterThanOrEqual(4);
  expect(tab.height >= 36 && tab.width >= 120, `as big as a browser's: ${tab.width} × ${tab.height}`).toBe(true);
  expect(look.active, "the shown one in the panels' color").toBe(look.island);
  if (look.other) expect(look.other, 'the others on the window').toBe('rgba(0, 0, 0, 0)');
  expect(icon.width === 20 && icon.left > tab.left && icon.left <= tab.left + 12, 'the icon, 20 px, at the tab\'s start').toBe(true);
});

test("grid: a pane narrower than its profile's name: the name cut with …, its × in the pane, no list of hidden tabs", async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  const panel = files.panel(SAM);
  // A name longer than any pane is wide (names have no spaces to wrap at), put in place of Sam's.
  const was = await ui.evaluate((p) => {
    const n = document.querySelector(`[data-panel="${p}"] [data-testid="profile-name"]`), w = n.textContent;
    n.textContent = 'administrator.international-tenant@enterprise-customers.example'.repeat(3);
    return w;
  }, panel);
  const fits = () => ui.evaluate((p) => {
    const t = document.querySelector(`[data-panel="${p}"]`), g = t.closest('.dv-groupview').getBoundingClientRect();
    const n = t.querySelector('[data-testid="profile-name"]'), x = t.querySelector('[aria-label="Close profile"]').getBoundingClientRect(), more = t.closest('.dv-groupview').querySelector('.dv-tabs-overflow-dropdown-root');
    return n.scrollWidth > n.clientWidth && getComputedStyle(n).textOverflow === 'ellipsis' && x.width > 0 && x.right <= g.right && x.left >= g.left
      && !(more && more.checkVisibility());
  }, panel);
  await expect.poll(fits, { timeout: 3000 }).toBe(true);
  await ui.evaluate(([p, w]) => { document.querySelector(`[data-panel="${p}"] [data-testid="profile-name"]`).textContent = w; }, [panel, was]);
});

test('grid: a pane moved next to the terminal takes its page along', async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  await dock(ui, (api, p) => api.getPanel(p).api.moveTo({ group: api.getPanel('terminal').group, position: 'right' }), files.panel(SAM));
  await expect.poll(() => viewOn(core, ui, files, SAM)).toBe(true);
  await expect.poll(() => viewOn(core, ui, files, ELON)).toBe(true);
  const sam = await pageBox(ui, files, SAM), term = await box(ui, '[data-testid="terminal"]');
  expect(sam.x > term.x + term.width - 1 && sam.y + sam.height > term.y, 'Sam is right of the terminal').toBe(true);
});

test("grid: a narrow pane's bar gives up Back and Forward, then Reload, into ⋮; Pick and ⋮ stay in it down to dockview's narrowest", async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  const panel = files.panel(SAM), pane = `[role="region"][data-profile="${files.idOf(SAM)}"]`;
  const width = await dock(ui, (api, p) => api.getPanel(p).group.api.width, panel);
  const bar = () => ui.evaluate((sel) => {
    const p = document.querySelector(sel).getBoundingClientRect();
    return [...document.querySelectorAll(`${sel} [role="toolbar"] > :is(button, input):not([hidden])`)].filter((e) => e.checkVisibility()).map((e) => {
      const r = e.getBoundingClientRect();
      return e.ariaLabel + (r.left >= p.left && r.right <= p.right ? '' : ' out');
    });
  }, pane);
  const more = async () => {
    await ui.locator(`${pane} [aria-label="More"]`).click();
    const rows = await menuRows(ui);
    await closeMenu(ui);
    return rows;
  };
  const at = async (w: number, shown: string[]) => {
    await dock(ui, (api, a) => api.getPanel(a.panel).group.api.setSize({ width: a.w }), { panel, w });
    await expect.poll(bar, { timeout: 3000, message: `${w} px` }).toEqual(shown);
  };
  await at(400, ['Back', 'Forward', 'Reload', 'Address', 'Pick an element', 'More']);
  expect(await more()).toEqual(['Screenshot', 'DevTools']);
  await at(240, ['Reload', 'Address', 'Pick an element', 'More']);
  await at(100, ['Address', 'Pick an element', 'More']);
  expect((await more()).map((r) => (r as string).replace(' (off)', ''))).toEqual(['Back', 'Forward', 'Reload', '-', 'Screenshot', 'DevTools']);
  await dock(ui, (api, a) => api.getPanel(a.panel).group.api.setSize({ width: a.width }), { panel, width });
});

test('grid: a pane stacked behind another as a tab hides its page until chosen', async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  await dock(ui, (api, a) => api.getPanel(a.sam).api.moveTo({ group: api.getPanel(a.elon).group, position: 'center' }), { sam: files.panel(SAM), elon: files.panel(ELON) });
  await expect.poll(() => viewOn(core, ui, files, SAM)).toBe(true);
  expect(await core((k) => k.profile('Elon.buyer').get().view.getVisible())).toBe(false);
  await dock(ui, (api, p) => api.getPanel(p).api.setActive(), files.panel(ELON));
  await expect.poll(() => viewOn(core, ui, files, ELON)).toBe(true);
  expect(await core((k) => k.profile('Sam.admin').get().view.getVisible())).toBe(false);
});

test('grid: while a pane is dragged, pages are pictures (drop targets are HTML), live again after the drop', async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  const tab = ui.locator(`[data-panel="${files.panel(ELON)}"]`);
  await tab.evaluate((t) => t.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: new DataTransfer() })));
  await expect.poll(() => core((k) => [...k.shell.profiles.values()].every((p) => !p.get().view.getVisible()))).toBe(true);
  await expect(ui.getByTestId('page').getByTestId('snapshot')).toHaveCount(2);
  await tab.evaluate((t) => t.dispatchEvent(new DragEvent('dragend', { bubbles: true })));
  await bothOn(core, ui, files);
  await expect(ui.getByTestId('page').getByTestId('snapshot')).toHaveCount(0);
});

test('grid presets: columns, grid, focus; each fits the window, nothing cut off', async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  const at = async () => ({ sam: await pageBox(ui, files, SAM), elon: await pageBox(ui, files, ELON), term: await box(ui, '[data-testid="terminal"]') });
  // Every panel inside the grid's room (#dock less its padding): none cut off at the right or the bottom.
  const fits = async () => expect(await ui.evaluate(() => {
    const d = document.getElementById('dock'), r = d.getBoundingClientRect(), s = getComputedStyle(d);
    const right = r.right - parseFloat(s.paddingRight), bottom = r.bottom - parseFloat(s.paddingBottom);
    return [...d.querySelectorAll('.dv-groupview')].map((g) => g.getBoundingClientRect()).filter((g) => g.right > right + 1 || g.bottom > bottom + 1)
      .map((g) => ({ right: g.right - right, bottom: g.bottom - bottom }));
  }), 'panels cut off').toEqual([]);
  const preset = (name: string) => ui.evaluate((n) => (window as any).__layoutPreset(n), name);
  await preset('columns');
  await expect.poll(() => viewOn(core, ui, files, ELON)).toBe(true);
  await fits();
  let b = await at();
  expect(b.sam.x < b.elon.x && b.sam.y === b.elon.y && b.term.y > b.sam.y + b.sam.height - 1, 'profiles side by side, terminal below').toBe(true);
  // Resources right of the terminal, in its row, a quarter of the grid (laid out maybe a frame after the pages).
  const resources = () => box(ui, '#resources');
  const placed = async () => {
    const r = await resources(), t = await box(ui, '[data-testid="terminal"]');
    return r.x > t.x + t.width - 1 && r.y > b.sam.y + b.sam.height - 1 && Math.abs(r.width / (await ui.evaluate(() => (window as any).__dock.width)) - 0.25) < 0.02;
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
  await preset('focus');
  await expect.poll(() => viewOn(core, ui, files, SAM)).toBe(true);
  await fits();
  b = await at();
  expect(b.elon, 'Elon is a tab behind Sam').toBe(null);
  expect(b.term.y > b.sam.y + b.sam.height - 1).toBe(true);
  await preset('grid');
  await bothOn(core, ui, files);
  await fits();
  b = await at();
  expect(b.sam.x < b.elon.x && b.term.x > b.elon.x + b.elon.width - 1, 'profiles in a row of two, terminal on the right').toBe(true);
  // Resources under the terminal, in its column; made taller, as its gap does: kept with the grid.
  const res = await box(ui, '#resources'), term = await box(ui, 'nav[aria-label="Terminals"]');
  expect(res.y > term.y && Math.abs(res.x - term.x) < 20, 'Resources under the terminal').toBe(true);
  await ui.evaluate(() => (window as any).__dock.getPanel('resources').group.api.setSize({ height: 300 }));
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
