import { taskPage, menuPage } from './pages.ts';
// The grid of panels: panes and their pages, presets, a menu over pages that give no picture (docs/window.md, The grid).
import { test, expect } from './fixtures.ts';
import type { Page } from '@playwright/test';
import { menu, anyMenu, closeMenu, rightClick, box, pageBox, viewOn, resourcesGroup, dock, stageDock } from './helpers.ts';
import { SAM, ELON, begin, bothOn } from './tasks-helpers.ts';

// A pane's tab dragged by the hand onto a place of a target (dockview's drop zones: its edges, its middle).
// Moved on only once the drag is under way (the pages pictures): a drop let go before dockview has its drop targets is
// lost.
async function drag(ui: Page, panel: string, target: string, where: 'right' | 'center') {
  const f = await (await taskPage(ui)).locator(`[data-task-view][data-active] [data-panel="${panel}"]`).boundingBox(), t = await (await taskPage(ui)).locator(target).boundingBox();
  await (await taskPage(ui)).mouse.move(f.x + f.width / 2, f.y + f.height / 2);
  await (await taskPage(ui)).mouse.down();
  await (await taskPage(ui)).mouse.move(f.x + f.width / 2 + 40, f.y + f.height / 2 + 40, { steps: 4 });
  await expect((await taskPage(ui)).locator('[data-task-view][data-active]').getByTestId('page').getByTestId('snapshot').first()).toBeVisible();
  await (await taskPage(ui)).mouse.move(t.x + (where === 'right' ? t.width - 10 : t.width / 2), t.y + t.height / 2, { steps: 8 });
  await (await taskPage(ui)).mouse.up();
}

test("grid: a pane narrower than its profile's name: the name cut with …, its × in the pane, no list of hidden tabs", async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  const panel = files.panel(SAM);
  // A name as long as names go (64: names have no spaces to wrap at), Sam renamed so, in a pane narrower than it.
  const id = files.idOf(SAM), width = await stageDock(ui, (api, p) => api.getPanel(p).group.api.width, panel);
  await core((k, a) => k.shell.task.renameProfile(a.id, a.name), { id, name: 'administrator.international-tenant@enterprise-customers.example.org'.slice(0, 64) });
  try {
    await stageDock(ui, (api, a) => api.getPanel(a.panel).group.api.setSize({ width: a.w }), { panel, w: 300 });
    const header = (await taskPage(ui)).locator(`[data-task-view][data-active] [data-panel="${panel}"]`), group = (await taskPage(ui)).locator('[data-task-view][data-active]').getByTestId('stage').locator('.dv-groupview').filter({ has: (await taskPage(ui)).locator(`[data-panel="${panel}"]`) }), name = header.getByTestId('profile-name');
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
  const bar = async () => (await taskPage(ui)).evaluate((sel) => {
    const p = document.querySelector(sel).getBoundingClientRect();
    return [...document.querySelectorAll(`${sel} [role="group"][aria-label="Page"] :is(button:not([role="tab"]), input)`)].filter((e) => e.checkVisibility()).map((e) => {
      const r = e.getBoundingClientRect();
      return e.getAttribute('aria-label') + (r.x >= p.x && r.right <= p.right ? '' : ' out');
    });
  }, pane);
  const more = async (rows: string) => {
    await (await taskPage(ui)).locator(`${pane} [aria-label="More"]`).click();
    await expect((await menu(ui))).toMatchAriaSnapshot(rows);
    await closeMenu(ui);
  };
  const at = async (w: number, shown: string[]) => {
    await stageDock(ui, (api, a) => api.getPanel(a.panel).group.api.setSize({ width: a.w }), { panel, w });
    await expect.poll(bar, { timeout: 3000, message: `${w} px` }).toEqual(shown);
  };
  await at(400, ['Back', 'Forward', 'Reload', 'New tab', 'Pick an element', 'More']);
  const shots = `
      - text: Screenshot
      - menuitem /^Element/
      - menuitem "Visible Part"
      - menuitem "Full Page"
      - menuitem /^DevTools/`;
  await more(`
    - menu: ${shots}`);
  await at(272, ['Reload', 'New tab', 'Pick an element', 'More']);
  await at(100, ['New tab', 'Pick an element', 'More']);
  await more(`
    - menu:
      - menuitem /^Back/
      - menuitem /^Forward/
      - menuitem /^Reload/ ${shots}`);
  await at(400, ['Back', 'Forward', 'Reload', 'New tab', 'Pick an element', 'More']);
  await (await taskPage(ui)).locator(pane).getByRole('tab', { selected: true }).dblclick();
  await at(400, ['Back', 'Forward', 'Reload', 'Address', 'Pick an element', 'More']);
  await at(272, ['Reload', 'Address', 'Pick an element', 'More']);
  await at(100, ['Address', 'Pick an element', 'More']);
  await (await taskPage(ui)).locator(`${pane} [aria-label="Address"]`).press('Escape');
  await stageDock(ui, (api, a) => api.getPanel(a.panel).group.api.setSize({ width: a.width }), { panel, width });
});

test('grid: a pane stacked behind another as a tab hides its page until chosen', async ({ core, ui, files }) => {
  // Polled: dockview may still count the pane behind as visible in the drop's first layout; the next one hides it.
  await begin(core, ui, files, { columns: true });
  await drag(ui, files.panel(SAM), `[role="region"][data-profile="${files.idOf(ELON)}"]`, 'center');
  await expect.poll(() => viewOn(core, ui, files, SAM)).toBe(true);
  await expect.poll(() => core((k) => k.profile('Elon.buyer').view.getVisible())).toBe(false);
  await (await taskPage(ui)).locator(`[data-task-view][data-active] [data-panel="${files.panel(ELON)}"]`).click();
  await expect.poll(() => viewOn(core, ui, files, ELON)).toBe(true);
  await expect.poll(() => core((k) => k.profile('Sam.admin').view.getVisible())).toBe(false);
});

test('page captures respect their adaptive deadline when a native page stops answering', async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  const SAM = files.idOf('Sam.admin'), ELON = files.idOf('Elon.buyer');
  // Chromium may deliver even a live page's frame after the fallback deadline. Use a real image, but move the
  // capture completions and deadline clock ourselves so rendering speed cannot decide which branch is covered.
  const pics = await core(async (k, ids) => {
    const sam = k.shell.profiles.get(ids.SAM).get().wc, elon = k.shell.profiles.get(ids.ELON).get().wc;
    const image = await elon.capturePage(), realNow = Date.now, results = [];
    const captures = [sam, elon].map((wc) => Object.getOwnPropertyDescriptor(wc, 'capturePage'));
    try {
      for (const [firstAt, deadline] of [[20, 100], [200, 600], [null, 500]] as const) {
        k.clock.hold(1);
        let now = 0, done = false, complete = (_: typeof image) => {};
        Date.now = () => now;
        sam.capturePage = () => new Promise(() => {});
        elon.capturePage = () => new Promise((ok) => { complete = ok; });
        const pending = k.shell.windows[0].pictures().then((got) => { done = true; return got; });
        // A turn flushes capture and Promise.all continuations before inspecting their effects.
        const advance = async (ms: number) => { now += ms; k.clock.advance(ms); await new Promise(setImmediate); };
        if (firstAt !== null) {
          await advance(firstAt);
          complete(image);
          await advance(0);
        }
        await advance(deadline - now - 1);
        const before = done;
        await advance(1);
        const after = done;
        // Do not await pending: a broken deadline must fail an assertion rather than hang the test.
        const got = done ? await pending : {};
        complete(image);
        await advance(1000);
        results.push({ firstAt, before, after, sam: !!got[ids.SAM], elon: got[ids.ELON] === `data:image/jpeg;base64,${image.toJPEG(90).toString('base64')}`, keys: Object.keys(got) });
      }
    } finally {
      Date.now = realNow;
      k.clock.release();
      for (const [i, wc] of [sam, elon].entries()) {
        if (captures[i]) Object.defineProperty(wc, 'capturePage', captures[i]); else Reflect.deleteProperty(wc, 'capturePage');
      }
    }
    return results;
  }, { SAM, ELON });
  expect(pics).toEqual([
    { firstAt: 20, before: false, after: true, sam: false, elon: true, keys: [ELON] },
    { firstAt: 200, before: false, after: true, sam: false, elon: true, keys: [ELON] },
    { firstAt: null, before: false, after: true, sam: false, elon: false, keys: [] },
  ]);
});

for (const count of [2, 1, 0]) test(`grid: while a pane is dragged, ${count} page pictures cover hidden views; both pages live again after the drop`, async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  // The preceding test checks capture deadlines. Supply their possible results here, so Chromium's frame
  // delivery cannot decide whether the drag covers both pages, one, or neither.
  const image = await core(async (k, count) => {
    const pages = ['Sam.admin', 'Elon.buyer'].map((name) => k.profile(name).get().wc);
    const image = await pages[0].capturePage(), captures = pages.map((wc) => Object.getOwnPropertyDescriptor(wc, 'capturePage'));
    k.stash.restoreCaptures = () => pages.forEach((wc, i) => {
      if (captures[i]) Object.defineProperty(wc, 'capturePage', captures[i]); else Reflect.deleteProperty(wc, 'capturePage');
    });
    pages.forEach((wc, i) => { wc.capturePage = () => i < count ? Promise.resolve(image) : Promise.reject(new Error('capture unavailable')); });
    return `data:image/jpeg;base64,${image.toJPEG(90).toString('base64')}`;
  }, count);
  try {
    // Let go on the same tab: the drag ends without changing the arrangement.
    const b = await (await taskPage(ui)).locator(`[data-task-view][data-active] [data-panel="${files.panel(ELON)}"]`).boundingBox(), at = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    await (await taskPage(ui)).mouse.move(at.x, at.y);
    await (await taskPage(ui)).mouse.down();
    await (await taskPage(ui)).mouse.move(at.x + 40, at.y + 40, { steps: 4 });
    await expect.poll(() => core((k) => [...k.shell.profiles.values()].every((p) => !p.view.getVisible()))).toBe(true);
    for (const [i, name] of [SAM, ELON].entries()) {
      const picture = (await taskPage(ui)).locator(`[data-task-view][data-active] [role="region"][data-profile="${files.idOf(name)}"]`).getByTestId('snapshot');
      await expect(picture).toHaveCount(i < count ? 1 : 0);
      if (i < count) {
        await expect(picture).toBeVisible();
        await expect(picture).toHaveAttribute('src', image);
      }
    }
    await (await taskPage(ui)).mouse.move(at.x, at.y, { steps: 4 });
    await (await taskPage(ui)).mouse.up();
    await bothOn(core, ui, files);
    await expect((await taskPage(ui)).locator('[data-task-view][data-active]').getByTestId('page').getByTestId('snapshot')).toHaveCount(0);
  } finally {
    await (await taskPage(ui)).mouse.up();
    await core((k) => { k.stash.restoreCaptures(); delete k.stash.restoreCaptures; });
  }
});

test('resizing Resources and the window fits the agent terminal to its pane', async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  const terminalSize = async () => (await taskPage(ui)).evaluate(() => { const t = (window as any).__term; return { cols: t.cols, rows: t.rows }; });
  const fitted = async () => (await taskPage(ui)).locator('[data-task-view][data-active]').getByTestId('terminal').evaluate((el) => {
    const host = el.querySelector('.xterm').parentElement, screen = el.querySelector('.xterm-screen');
    return Math.abs(host.clientWidth - screen.clientWidth) < 30 && Math.abs(host.clientHeight - screen.clientHeight) < 30;
  });
  const workspace = await dock(ui, (api) => api.toJSON()), size = await core((k) => k.shell.win.getSize());
  try {
    await dock(ui, (api) => api.getEdgeGroup('left').setSize({ width: 500 }));
    await expect.poll(fitted).toBe(true);
    const before = await terminalSize();
    await dock(ui, (api) => api.getEdgeGroup('left').setSize({ width: 340.25 }));
    await expect.poll(async () => (await terminalSize()).cols).toBeGreaterThan(before.cols);
    await dock(ui, (api) => api.getEdgeGroup('left').setSize({ width: 660.75 }));
    await expect.poll(async () => (await terminalSize()).cols).toBeLessThan(before.cols);
    const rows = (await terminalSize()).rows;
    await core((k, size) => k.shell.win.setSize(size[0], size[1] - 100), size);
    await expect.poll(async () => (await terminalSize()).rows).toBeLessThan(rows);
    await expect.poll(fitted).toBe(true);
    await expect.poll(() => core((k) => ({ cols: k.shell.pty.cols, rows: k.shell.pty.rows }))).toEqual(await terminalSize());
  } finally {
    await core((k, size) => k.shell.win.setSize(size[0], size[1]), size);
    await dock(ui, (api, saved) => api.fromJSON(saved), workspace);
  }
});

test('workspace and stage presets each fit the window without changing the other layout', async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  const at = async () => ({ sam: await pageBox(ui, files, SAM), elon: await pageBox(ui, files, ELON), term: await box(ui, '[data-testid="terminal"]') });
  // Every panel inside the grid's room (#dock less its padding): none cut off at the right or the bottom.
  const fits = async () => {
    const d = await (await taskPage(ui)).locator('#dock').boundingBox(), pad = await (await taskPage(ui)).locator('#dock').evaluate((e) => { const s = getComputedStyle(e); return { right: parseFloat(s.paddingRight), bottom: parseFloat(s.paddingBottom) }; });
    const right = d.x + d.width - pad.right, bottom = d.y + d.height - pad.bottom, cut = [];
    for (const g of await (await taskPage(ui)).locator('#dock .dv-groupview').filter({ visible: true }).all()) {
      const r = await g.boundingBox();
      if (r.x + r.width > right + 1 || r.y + r.height > bottom + 1) cut.push({ right: r.x + r.width - right, bottom: r.y + r.height - bottom });
    }
    expect(cut, 'panels cut off').toEqual([]);
  };
  // Stage position and view are independent choices in its title-bar menu.
  const stagePreset = async (name: string) => { await ui.getByRole('button', { name: 'Stage', exact: true }).click(); await (await menuPage(ui)).getByRole('menuitemradio', { name, exact: true }).click(); };
  await stagePreset('Above');
  await expect.poll(() => viewOn(core, ui, files, ELON)).toBe(true);
  await fits();
  let b = await at();
  expect(b.sam.x < b.elon.x && b.sam.y === b.elon.y && b.term.y > b.sam.y + b.sam.height - 1, 'profiles side by side, terminal below').toBe(true);
  // Resources uses its native edge minimum beside the terminal.
  const resources = async () => (await resourcesGroup(ui)).boundingBox();
  const placed = async () => {
    const r = await resources(), t = await box(ui, '[data-testid="terminal"]');
    return r.x + r.width <= t.x + 1 && r.y > b.sam.y + b.sam.height - 1 && r.width >= 300 && r.width <= 301;
  };
  await expect.poll(placed, { timeout: 3000, message: 'Resources left of the terminal, at its native minimum' }).toBe(true);
  await stagePreset('Tabs');
  await expect.poll(() => viewOn(core, ui, files, SAM)).toBe(true);
  await fits();
  b = await at();
  expect(b.elon, 'Elon is a tab behind Sam').toBe(null);
  expect(b.term.y > b.sam.y + b.sam.height - 1).toBe(true);
  await stagePreset('Vertical stack');
  await stagePreset('Left');
  await bothOn(core, ui, files);
  await fits();
  b = await at();
  expect(b.sam.y < b.elon.y && b.term.x > b.sam.x + b.sam.width - 1, 'profiles in a vertical stack, terminal on the right').toBe(true);
  // Moving Stage preserves Resources beside the terminal; its own docking stays independent.
  const res = await box(ui, '[data-task-view][data-active] [data-resources]'), term = await box(ui, '[data-testid="development-terminals"]');
  expect(res.x < term.x && Math.abs(res.y - term.y) < 40, 'Resources beside the terminal').toBe(true);
  await dock(ui, (api) => api.getEdgeGroup('left').setSize({ width: 350 }));
  const resized = await dock(ui, (api) => api.getEdgeGroup('left').width);
  await expect.poll(() => core((k) => (k.shell.task.store.layout() as any)?.workspace.width)).toBe(resized);

});

test('a menu opens even when a page gives no picture (a page that draws no frames: covered, the monitor off, busy)', async ({ core, ui, files }) => {
  await begin(core, ui, files, { columns: true });
  await core((k) => { k.profile('Elon.buyer').get().wc.capturePage = () => new Promise(() => {}); }); // never
  try {
    await rightClick(ui, `[data-panel="${files.panel(ELON)}"]`);
    await expect((await menu(ui))).toBeVisible({ timeout: 2000 });
    expect(await (await taskPage(ui)).locator(`[data-task-view][data-active] [role="region"][data-profile="${files.idOf(ELON)}"] [data-testid="page"] [data-testid="snapshot"]`).count(), 'no picture, the pane is empty meanwhile').toBe(0);
    await closeMenu(ui);
    await expect((await anyMenu(ui))).toHaveCount(0);
  } finally { await core((k) => { delete k.profile('Elon.buyer').get().wc.capturePage; }); }
});
