// Sign-in pages (identity providers): recognized by host. Used by the sign-in pause and by tab restore.
const SIGNIN_HOSTS = [
  'login.microsoftonline.com', 'login.microsoft.com', 'login.live.com', 'autologon.microsoftazuread-sso.com',
  'sso.godaddy.com', 'accounts.google.com', 'okta.com', 'oktapreview.com', 'onelogin.com', 'auth0.com',
  'duosecurity.com', 'pingone.com', 'login.salesforce.com',
];

// Query parameters in which sign-in URLs carry the address to come back to.
const RETURN_PARAMS = ['redirect_uri', 'wreply', 'returnUrl', 'return_to', 'returnTo', 'continue', 'service', 'RelayState', 'target'];

function signinPages(extraHosts = []) {
  const hosts = [...SIGNIN_HOSTS, ...extraHosts];
  const isSigninUrl = (url) => {
    let host; try { host = new URL(url).hostname; } catch { return false; }
    return hosts.some((h) => host === h || host.endsWith('.' + h));
  };

  // The URL to reopen a tab with after a restart. A sign-in URL is one-time (it carries request ids and expires),
  // so a tab on a sign-in page is restored to where the sign-in started:
  //   1) the last non-sign-in page in the tab's history,
  //   2) else the origin of the return address in the sign-in URL (redirect_uri, wreply, …),
  //   3) else nothing (the tab is not restored).
  const restoreUrl = (wc) => {
    const url = wc.getURL();
    if (!url || url === 'about:blank') return null;
    if (!isSigninUrl(url)) return url;
    const history = wc.navigationHistory;
    const entries = history.getAllEntries();
    for (let i = history.getActiveIndex() - 1; i >= 0; i--) {
      const u = entries[i].url;
      if (u && u !== 'about:blank' && !isSigninUrl(u)) return u;
    }
    const params = new URL(url).searchParams;
    for (const name of RETURN_PARAMS) {
      const value = params.get(name);
      try {
        const target = new URL(value);
        if (/^https?:$/.test(target.protocol) && !isSigninUrl(target.href)) return target.origin + '/';
      } catch {}
    }
    return null;
  };

  return { isSigninUrl, restoreUrl };
}

module.exports = { signinPages, SIGNIN_HOSTS };
