# Browser

Browser capability for Stage panes and profile sign-in windows, a Kulisa package ([packages.md](../../docs/packages.md)).
It owns sessions, tabs, navigation, site zoom, native views, page focus, cookies and profile disk formats.
It imports no task, project, profile registry or window state. Hosts supply an Electron window, profile configuration
(id, display fields, absolute data folder or session, saved site zoom) and an opaque ownership key (`task`).
The key namespaces screenshots and automation; it imports no ownership object.

## Entry and ownership

`main/index.ts` exports `Profile`, its tab/configuration types, navigation helpers, `SessionCookies`, `CookieSync`,
focus helpers and browser storage operations. `ipc.ts` defines the profile state a host window displays.
There is no renderer half: the pane, address bar, menus and sign-in window use the window's state and stay there.

The host chooses when to open saved tabs, attach automation through its proxy, persist tabs/cookies, close or destroy
a profile and remove its folder. `Profile` owns the views and their event listeners, clipping parent, active tab,
closed-address list (ten), Playwright connection and each tab's discard/load lifecycle. Close disconnects automation
and closes all tabs; destroy also wipes the session. Moving to a window detaches the views and clears the clipping
parent. A tab's process belongs to that tab; discard closes it and keeps its address. No extra process or buffer is
allocated by the package boundary.

`readTabs`/`writeTabs` keep `Kulisa Tabs.json`; `SessionCookies` keeps `Kulisa Session Cookies.bin`, encrypted with
the OS keyring. `copyProfile` copies a flushed master without caches or the open cookie database. Paths and file
formats are shared by task copies and masters. Atomic writes use `src/main/files.ts`; task documents, folder deletion
queues, profile membership and persistence coordination stay in core.

`CookieSync` takes `masterDir` and cookie restoration callbacks; its attach/detach/forget methods follow the host's
ownership. `SessionCookies.autosave` takes a holder supplier and returns the timer's stop function. Core supplies
local addresses to cookie synchronization and decides sign-in pause and discard eligibility.

## Focus

A page taking focus gives it back to the host window. On macOS a real click is the page's focus, then the click 2 ms later: a
page's focus is the human's when their input in it comes within 150 ms of it, before or after. A focus given back
150 ms later is not given back over Kulisa's gift of it since (Ctrl+` at once after a page loaded). Each decision is a
line in the log (`[focus]`): given back, or left and why.

## Sign-ins kept in step

A real account is signed in to once, for every task (`cookie-sync.ts`): the cookies of sites that
are not local (`local.ts`) are kept in step between a profile's master and its copies open in tasks, both ways, as
they change (Electron's cookies `changed` event, then `cookies.set` or `remove` in the others; a change it made itself
is not taken back). A copy opening takes the master's first (its own non-local cookies give way). So a sign-in, a
refreshed token or a sign-out in one task reaches the master and every other task with that profile open: signing out
of a real account in one task signs it out everywhere. The cookies of local sites stay each copy's own: each task runs
its own app, often with its own database, and cookies do not depend on the port, so shared they would sign the tasks
out of each other.

Taken: a cookie set or changed, or removed explicitly or sent already expired (a site's sign-out, `Max-Age=0`). Not
taken: one replaced as part of a change (its new value comes as its own change), expired or evicted (each store does
that itself). Masters not open in a window keep their session cookies in memory while Kulisa runs, saved with the
others (every 30 s, as Kulisa quits). Limits: cookies only (sign-ins in a site's storage, as MSAL's, stay where they were
made); device-bound session cookies (DBSC: a key per browser, Google's) are copied as any cookie and not tested yet;
two tasks changing the same cookie at once end with the one that came last.

## Sign-ins that last

- **Persistent cookies and storage** are Chromium's own, in the profile's folder.
- **Session cookies** (no expiry; Entra's ESTSAUTH, federated sign-ins) die with the process in Electron. Kulisa
  saves them encrypted with the OS keyring (`safeStorage`) in the profile's folder, on quit, before a profile
  closes, and every 30 s, and puts them back before its first tab loads (`session-cookies.ts`). Never written in
  the clear: without a keyring they are not saved. A file the keyring's key no longer opens (the key changed, or two
  Kulisas made one at once on a fresh keyring) leaves the profile signed out at the next start, with a
  `[session-cookies]` line in the log saying so.
- **Tabs on sign-in pages** are saved as where the sign-in started (sign-in URLs are one-time): the last other page
  in the tab's history, else the origin of the return address in the URL, else not at all (`signin-pages.ts`).

## Tabs unloaded

A tab no one looks at loses its process after a while, as Chrome's Memory Saver discards tabs (every tab is a
Chromium process whether anyone looks at it or not). What stays is the tab's entry in the strip: its address, title
and icon, nothing marking it (as Chrome). Looked at or used again, its page loads again at that address.

- **Off screen** is a tab that is not the active tab of a pane on screen in the task shown in some window: a tab behind
  the active one, a pane stacked behind another, every tab of a task not shown.
- **Unused** is a task whose agents are neither working nor waiting for the human (their hooks: an agent waiting on a
  permission goes on in its tabs, with their state, once answered), and a profile that no automation sent a command
  for that long (every command passes the CDP proxy, `Profile.busyAt`: agents without hooks, the agent's own scripts).
- **The time**: 5 minutes for both (`DISCARD_AFTER`, `discard.ts`), so switching tasks back and
  forth reloads nothing; a task left to a working agent keeps every page as long as it works. A sweep every 30 s dates
  what it sees off screen and discards what has been so, and unused, for the time.
- **Never**: a page loading, one showing a dialog, one with its DevTools open, one playing sound, a profile the human is
  signing in to (sign-in mode), an empty tab. A page that holds its unload (`beforeunload`, as a form with unsaved changes
  does) stays, as in Chrome: Electron says so (`will-prevent-unload`) and keeps it.
- **Back** when the human shows its task or pane, clicks its tab, or types an address into it; when the agent names
  it in a tool (`browser_snapshot` with its `tab`, `browser_tab_select`: the tool loads it first, the agent notices
  nothing; `profile_list` lists it as any tab). Only the active tab of each pane comes back when a task is shown; the
  others stay unloaded until clicked, as Chrome's. Closed while unloaded (× or `browser_tab_close`): gone, nothing to
  close. Its address is saved with the others (`Kulisa Tabs.json`), so it comes back after a restart too.
- **Lost with its process**, as in Chrome: the page's state (its scroll, what was typed without `beforeunload`) and, as
  Electron keeps no history outside the process, the tab's Back and Forward (a closed tab's go the same way).
- **How**: the tab's `webContents` is closed (`Profile.discard`; the view goes from the window), the tab kept in the list
  as `discarded`; the proxy is told as of a tab closed (its target is gone) and, at `load`, of a tab added with a new
  one: a new `WebContentsView` bound as a new tab's, opened as a new tab is (`about:blank`, then the address), so
  Playwright's page for it is new as well (`Profile.page` loads first). Not Chromium's own discarding (Electron does
  not expose it) and not freezing (`Page.setWebLifecycleState`: the process and its memory stay; it freezes only a hidden page,
  which Kulisa's are not yet: issue #52, tabs asleep; and it needs the debugger, which the sign-in
  pause detaches). A discarded tab is never loaded from inside a `webContents`' `destroyed` event
  (Hard-won facts): the active one to be drawn is loaded on the next turn (`_show`).

## Page dialogs

A page's alert or confirm appears inside its pane, over a dimmed picture: "<site> says", its message, OK and Cancel
for confirm, Enter and Esc. A background tab's dialog appears when that tab is chosen. Electron's `prompt()` throws
in the page. The native dialog would obscure which page asked, so `Profile._dialog` handles Electron's internal
`-run-dialog` event ([testing.md](../../docs/testing.md), Upgrading Electron).

Navigation dismisses the dialog because Chromium holds navigation while it is open. A dialog answered through CDP
also leaves the pane. The [Kulisa plugin](../kulisa-plugin/README.md#browser-tools) handles dialogs opened by
agent actions and reports a dialog that needs the human's answer before attempting another action.


## Memory and caches

Memory: each tab is a Chromium process (`ps` shows each); closing a profile frees its tabs, and a tab no one looks at
frees its own after a while ("Tabs unloaded").

Disk: closing a profile, or its task (× on its tab), clears its caches (HTTP, compiled code, shaders, and the sites' Cache API, their service
workers' copies of their bundles, which Chromium counts as storage and which are most of a copy's size, 200 MB for
Teams: `clearCaches` in `profiles.ts`); its sign-ins and the sites' other storage stay. An open profile's HTTP cache has the limit Chromium sets from the free disk
space (issue #113, a task manager).

## The code

| File | What |
|---|---|
| `main/index.ts`, `ipc.ts` | public operations, types and window state |
| `main/profiles.ts`, `main/error-page.html` | sessions, tabs, navigation, zoom, dialogs, clipping, automation connection and failed navigation |
| `main/page-focus.ts` | human focus ownership in each host window |
| `main/cookie-sync.ts` | cookie changes between a master and its attached copies |
| `main/session-cookies.ts` | encrypted session cookie persistence and autosave |
| `main/storage.ts` | browser folder copying and saved tab format |
| `cookies.test.ts`, `storage.test.ts` | cookie synchronization, copy exclusions and saved tabs |
| `test/e2e/profiles.spec.ts`, `discard.spec.ts`, `zoom-and-closing.spec.ts`, `agent-*.spec.ts`, `tasks-restart.spec.ts`, `grid.spec.ts` | browser actions, sign-ins, restore, focus and clipping in real windows |

Outside callers stay in core for these reasons:

- `tasks.ts`, `project-profiles.ts`, `projects.ts`, `shell.ts`, `app.ts`, `store.ts`, `profile-store.ts`: task and
  project ownership, registry, copy creation/removal, persistence coordination and startup/shutdown.
- `master.ts`: sign-in window ownership, menus and persistence coordination.
- `cdp-proxy.ts`, `signin-pause.ts`, `discard.ts`: automation access, sign-in policy and task activity eligibility.
- `window.ts`, `shortcuts.ts`, `ipc/panes.ts`, `ipc/window.ts`, `picker.ts`: window state, human controls,
  layout facts and selections sent to agents.
- `plugin.ts`: supplies core actions and facts to the Kulisa plugin.
- `shared/types.ts`: joins the browser state to the window's state types.
- `accounts.ts`, `github/main/accounts.ts`, `kulisa-plugin/main/agents/{claude,codex,files}.ts`: use the shared atomic
  file writer independently of browser storage.
