// LOW-QUALITY, TEMPORARY IMPLEMENTATION — the author's decision (docs/REPORT.md, "Author's position on sign-in
// mode"); the author will replace it.
// The agent is paused while any tab of a profile is on a sign-in page (signin-pages.ts) or navigating to one, and
// resumes when none is. Only hosts are recognized: a sign-in form on another host is not.

import type { Profile, Tab } from './profiles.ts';

// isSigninUrl: from signinPages() in signin-pages.ts.
function installSigninPause(profile: Profile, isSigninUrl: (url: string) => boolean) {
  let chain = Promise.resolve();
  const check = (pendingUrl?: string) => {
    const want = (pendingUrl && isSigninUrl(pendingUrl)) ||
      profile.tabs.some((t) => !t.wc.isDestroyed() && isSigninUrl(t.wc.getURL()));
    chain = chain.then(() => profile.setSigninMode(!!want)).catch((e: Error) => console.error('[signin-pause]', e.message));
  };
  const watch = (tab: Tab) => {
    // did-start-navigation fires before the sign-in page's scripts run.
    tab.wc.on('did-start-navigation', (d) => { if (d.isMainFrame && !d.isSameDocument) check(d.url); });
    tab.wc.on('did-navigate', () => check());
  };
  profile.tabs.forEach(watch);
  profile.on('tab-added', watch);
  profile.on('tab-closed', () => check());
}

export { installSigninPause };
