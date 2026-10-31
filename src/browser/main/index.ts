// Browser capability entry; see ../README.md.
export { Profile, stepZoom, wipeSession, clearCaches, toUrl, ensureTarget } from './profiles.ts';
export type { Tab, ProfileConfig, Bounds } from './profiles.ts';
export { focusWindow } from './page-focus.ts';
export { SessionCookies } from './session-cookies.ts';
export { CookieSync } from './cookie-sync.ts';
export { readTabs, writeTabs, copyProfile } from './storage.ts';
export type { SavedTabs } from './storage.ts';
