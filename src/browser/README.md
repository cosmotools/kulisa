# Browser

Sessions, tabs, navigation, zoom, native views, focus, cookies and profile storage for Stage and sign-in windows.
This [Kulisa package](../../docs/packages.md) imports no task, project, profile registry or window state.

## Entry and ownership

`main/index.ts` exports `Profile`, configuration/tab types, navigation helpers, cookie synchronization, focus and
storage operations. `ipc.ts` defines host-visible state; there is no renderer half.

- Hosts supply the window, optional native parent (default: the window's content view), profile configuration,
  absolute data folder/session, site zoom and opaque ownership key (`task`, for automation and screenshot namespacing).
  They coordinate tab restoration, proxy attachment, persistence, sign-in/discard policy, membership and folder removal.
- `Profile` owns one persistent native `View` containing all live tabs, their listeners, active-tab selection, ten
  closed addresses, Playwright connection and discard/load lifecycle. Its `View` provides group visibility and clips
  pages; child bounds preserve the full viewport with an offset inside it. Layout coordinates are relative to the
  supplied host. Moving windows reparents the group, hidden until layout. Close disconnects, detaches the container and
  closes tabs; destroy also wipes the session. The container adds no renderer process or retained buffer.
- `readTabs`/`writeTabs`: `Kulisa Tabs.json`. `SessionCookies`: encrypted `Kulisa Session Cookies.bin`.
  `copyProfile` copies a flushed master excluding caches and the open cookie database; masters/copies share formats.
  Atomic writes use `src/main/files.ts`.
- `CookieSync` receives `masterDir` and restoration callbacks, with host-controlled attach/detach/forget.
  `SessionCookies.autosave` receives a holder supplier and returns its timer's stop function.

## Focus

Return unsolicited page focus to the host. Treat input within 150 ms before or after page focus as human intent
(macOS clicks can follow focus). A delayed return must respect any newer Kulisa focus assignment. Log each decision
under `[focus]` with its reason.

## Sign-ins kept in step

`cookie-sync.ts` synchronizes non-local cookie changes between the master and open copies, suppressing echoes.
Opening a copy takes the master's non-local cookies. Explicit removal/expired writes propagate; replacement,
expiry and eviction events do not. Thus real-account sign-out reaches all copies, while local cookies remain
independent: cookies ignore ports, and tasks can use different app databases.

Closed masters retain session cookies in memory, saved every 30 s and on quit. Site storage is not synchronized;
DBSC is untested. Concurrent writes to one cookie use the last change.

## Sign-ins that last

- Chromium persists cookies with expiry and site storage.
- `session-cookies.ts` encrypts session cookies with the OS keyring on close/quit and every 30 s, restoring before
  the first tab loads. Without a keyring, do not save them. Decryption failure leaves the profile signed out and
  logs `[session-cookies]`.
- `signin-pages.ts` saves a sign-in tab's last non-sign-in history entry, else the return URL's origin, else omits
  it; sign-in URLs are single-use.

## Tabs unloaded

`discard.ts` sweeps every 30 s. Discard after both off-screen and unused periods reach five minutes (`DISCARD_AFTER`).

- Off-screen: not the active tab of a visible pane in a displayed task.
- Unused: task agents neither working nor waiting for permission, and no profile automation command through the
  proxy (`Profile.busyAt`). This also covers agents without hooks and direct scripts.
- Exclusions: loading, dialogs, DevTools, sound, sign-in mode, blank tabs or `beforeunload` preventing closure.
- Discard closes `webContents` and removes its proxy target, retaining address/title/icon in the tab strip.
  Scroll, unsaved input and Back/Forward history disappear with the process. Chromium discarding is unavailable;
  freezing would retain its memory and requires hidden state/debugger access (issue #52).
- Showing a task/pane restores only active tabs; clicking, navigating or naming a tab in an agent tool loads it.
  Loading creates a new view/target/Playwright page via `about:blank`, then its address. Closing a discarded tab
  simply removes its entry; its address otherwise persists in `Kulisa Tabs.json`.
- Never load within a `destroyed` event; `_show` defers to the next turn.

## Page dialogs

Alert/confirm appears over a dimmed pane snapshot: site, message, OK, Cancel for confirm; Enter/Esc work. Background
requests wait for tab selection. Electron's `prompt()` throws. `Profile._dialog` intercepts internal `-run-dialog`
([testing.md](../../docs/testing.md), Upgrading Electron).

Navigation dismisses dialogs to release Chromium's navigation block; CDP answers also remove the pane dialog.
[Agent tools](../kulisa-plugin/README.md#browser-tools) handle action-triggered dialogs and report pending human
questions before another action.

## Memory and caches

Closing/discarding tabs frees their processes. Closing a profile or task clears HTTP, compiled-code, shader and
Cache API caches, preserving sign-ins and other storage (`clearCaches`). Open HTTP caches use Chromium's free-disk
limit; task-level usage controls are planned in #113.

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
