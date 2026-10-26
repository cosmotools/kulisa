// What sites see of a profile (docs/profiles.md, What sites see, Sign-in pause): Kulisa started as the human starts it,
// without the tests' debugging port, which would make navigator.webdriver true in every page.
import { test, expect } from './fixtures.ts';
import { SITE, PORT, who } from './helpers.ts';
import { profiles } from './agent-helpers.ts';

test.use({ automation: false });

// Not presenting as Google Chrome: Google refuses to sign in a browser that does and is not (docs/profiles.md, What
// sites see), and lets Electron's own Chromium in. Without Electron's word: Teams takes a Mac's or Windows' Electron
// for its own retired app and shows "Classic Teams is no longer available". No automation flag: navigator.webdriver
// false, with the agent's Playwright attached through the proxy too.
test('profiles present themselves as what they are, Kulisa on Chromium, in pages and popups alike', async ({ core }) => {
  await profiles(core);
  const seen = await core(async (k, a) => {
    const { app } = k.electron;
    const page = await k.profile('Elon.buyer').page();
    await page.goto(`${a.site}/headers`);
    const header = JSON.parse(await page.locator('body').innerText())['user-agent'];
    const ua = await page.evaluate(() => navigator.userAgent);
    const webdriver = await page.evaluate(() => navigator.webdriver);
    const brands = await page.evaluate(() => (navigator as unknown as { userAgentData: { brands: { brand: string }[] } }).userAgentData.brands.map((b) => b.brand));
    const [popup] = await Promise.all([page.context().waitForEvent('page'), page.evaluate((u) => window.open(u), `${a.site}/headers`)]);
    await popup.waitForLoadState();
    const popupHeader = JSON.parse(await popup.locator('body').innerText())['user-agent'];
    await popup.close();
    return { fallback: app.userAgentFallback, header, ua, brands, webdriver, popupHeader };
  }, { site: SITE });
  expect(seen.header).toBe(seen.fallback);
  expect(seen.fallback).toMatch(/ Chrome\/\d/);
  expect(seen.fallback).not.toMatch(/Electron/);
  expect(seen.ua).toBe(seen.fallback);
  expect(seen.brands).not.toContain('Google Chrome');
  expect(seen.webdriver).toBe(false);
  expect(seen.popupHeader).toBe(seen.fallback);
});

test('the agent pauses on sign-in pages and comes back after', async ({ core, call }) => {
  await profiles(core);
  await core((k, url) => k.profile('Elon.buyer').get().wc.loadURL(url), `http://localhost:${PORT}/app`); // localhost is a sign-in host in this test
  await expect.poll(() => core((k) => !!k.profile('Elon.buyer').signinMode)).toBe(true);
  await expect(call('browser_snapshot', { profile: 'Elon.buyer' })).rejects.toThrow(/sign-in mode/);
  expect(await core((k) => k.profile('Elon.buyer').get().wc.executeJavaScript('navigator.webdriver'))).toBe(false);
  await core((k, url) => k.profile('Elon.buyer').get().wc.loadURL(url), `${SITE}/app`);
  await expect.poll(() => core((k) => !!k.profile('Elon.buyer').signinMode)).toBe(false);
  expect(await who(call, 'Elon.buyer')).toBe('Signed out');
});
