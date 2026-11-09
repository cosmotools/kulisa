# Profiles

Profile ownership, human controls, authentication and automation. Browser internals:
[Browser Kulisa package](../src/browser/README.md); project/task lifecycle: [tasks.md](tasks.md).

## What a profile is

A **profile** is an embedded browser identity with its own cookies, storage, sign-ins and tabs, displayed as a pane.
`ProfileStore` owns global name/picture/description and `profiles/<id>/`, its master. IDs are immutable six-character
lowercase alphanumerics; names are case-insensitively unique within every project using the profile (`nameTaken`).
Projects list profile IDs in order; changing identity fields affects every project.

Each task lazily copies the master on first profile open (`project-profiles.ts`). Its tabs, local sessions and site
zoom belong to that copy. New tasks start with every profile closed. The human opens profiles from closed-profile
tiles or the task menu; the agent uses `profile_open`.

A project can create a profile or add an existing one. Removal (`profile_delete` included) asks first and deletes
only that project's task copies. Global profiles and masters survive project removal, even with no project using them.
Only Settings → Profiles deletes the profile everywhere.

Browser sessions use `session.fromPath` with one `WebContentsView` per tab; no external Chrome window.

## What the human does

- **Settings → Profiles** owns identity and credentials: Picture, Name, About, Test login/password, Sign In and
  project membership. Fields save on Enter/blur. Manage Profiles and About this profile open the relevant page.
- **New Profile** creates a signed-out profile, globally or from a project's Add menu. Names start with a letter or
  digit, contain letters/digits/`@ . _ + -`, and have at most 64 characters, no spaces (`names.ts`, the author's
  choice). Filter input and validate again in core. IDs/branches support non-Latin letters.
- **Sign In… / Sign In to Master…** opens the master window with address/navigation controls and one visible tab;
  popups temporarily replace it. No proxy, Playwright or picker attaches. Closing saves tabs/cookies. Non-local
  sign-ins propagate to task copies; local-app sessions remain task-specific.
- **Rename** changes only the display name. **About** holds up to 500 characters of the human's role description;
  agents select by it and ask/save the human's answer if ambiguous. Preserve their words without AI rewriting.
- **Picture** uses bundled Noto Emoji animals (`avatars.ts`, Apache-2.0) for consistent shapes across OSes.
- **Close** frees tab processes and saves tabs/sign-ins; reopening restores them. Closed state survives restart.
- **Remove from Project…** deletes that project's copies after confirmation. **Delete Profile…** in Settings
  deletes all copies and master, including sign-ins and storage (`projects.ts`, `deleteProfile`).
- **Pane controls** share one row: Back, Forward, Reload, tabs/+, Pick, ⋮. Double-click a tab, Edit address or Ctrl+L
  opens its selected URL in place of tabs; Enter navigates, Esc/blur cancels. Keep tabs mounted. A new tab starts
  editing immediately. Overflowing tabs shrink to icon/× then scroll; popups stay in the same profile.
  Reserve the tab area during restoration and show + with the restored tabs so controls keep their positions.
- **Tab menu**: Edit address, Reload, Duplicate, Close, Close others. **⋮**: Screenshot and DevTools. Narrow panes
  move Back/Forward, then Reload into ⋮, preserving Pick/⋮. Hover shows the full address. Keys: [window.md](window.md), Keys.
- **Site zoom**: Ctrl +/−/0, saved per site/profile above Kulisa zoom and shown beside tabs.
- **Blank tabs** use Kulisa's theme (`Profile.setBlank`); site colors remain the site's.
- **Failed navigation** displays Chromium's reason/code at the failed URL, available to snapshots; Reload retries.
  Refused connections become ready error pages without delaying profile opening.
- **Pick** sends an element reference to the agent; disabled on blank tabs.

## What the agent does

The [Kulisa plugin](../src/kulisa-plugin/README.md#browser-tools) supplies every agent with the same profile and browser
tools, instructions, and action annotations. Tools call the core actions listed below.

## Page dialogs

The [Browser Kulisa package](../src/browser/README.md#page-dialogs) owns page dialogs.

**Point and tell** (`picker.ts`): `page.pickLocator()` selects an element; Esc or Pick cancels.
Append `[kulisa pick: <profile> tab <tab> <locator>]` without Enter to `Task.promptTarget`, bring that agent forward
and focus its terminal. Nothing is saved; the human supplies the request, the agent inspects the live page.

## Actions: the human's and the agent's

Window and MCP handles resolve targets through `Task.find`/`findTab`; MCP first maps name to ID with `Task.named`.
Both call the same core actions and receive the same refusals. Identity changes use `ProfileStore` directly from
Settings or through `ProjectProfiles`. Missing handles require a reason in the table.
Task file editing uses the human's recoverable editor drafts; agents keep their own filesystem tools and do not
replace or resolve human drafts through MCP. Its core/handle ownership is listed in [tasks.md](tasks.md#actions-the-humans-and-the-agents).

| Action | The human | The agent | The core |
|---|---|---|---|
| Create a profile | Settings → Profiles (in no project), a project's page (in it) | `profile_create` (in its project) | `ProfileStore.create`; `Task.createProfile`; its name one the project has not (`nameTaken`) |
| Add a profile to the project | its page's + → Other Profiles | none: the agent makes one (`profile_create`) | `ProfileStore.addTo`; its name one the project has not (`nameTaken`) |
| Rename a profile | Settings → Profiles | `profile_rename` | `ProfileStore.rename`; `Task.renameProfile`; its name one none of its projects has (`nameTaken`) |
| Say who a profile is | Settings → Profiles | `profile_describe`, `profile_create` (the human's words only) | `ProfileStore.describe`; `Task.describeProfile` |
| Change its picture | Settings → Profiles | none: how the human tells panes apart | `ProfileStore.setAvatar` |
| Close, open a profile | ×; a tile while none is open, a task tab's menu | `profile_close`, `profile_open` | `Task.closeProfile`, `openProfile` |
| Remove a profile from the project | Remove from Project…, − on its page | `profile_delete` | `Task.deleteProfile(id, by)`: asks the human either way |
| Delete a profile | Settings → Profiles | none: its sign-ins are the human's | `deleteProfile` (`projects.ts`) |
| Open a tab | +, Duplicate, New tab | `browser_tab_new` | `Profile.newTab` (the address read by `toUrl`) |
| Switch, close a tab | a click, ×, Close others, Ctrl+Tab, Ctrl+1…9, Ctrl+W | `browser_tab_select`, `browser_tab_close` | `Profile.activate`, `closeTab`; the last one closed, an empty tab takes its place |
| Open the tab closed last again | Ctrl+Shift+T | none: it opens the address it wants (`browser_tab_new`) | `Profile.reopenTab` (the addresses of the last ten closed, in memory) |
| Go to an address | the address bar | `browser_navigate` (Playwright, so it is shown) | `toUrl`; `Profile.navigate` |
| Back, forward, reload | the toolbar, tab menu, their keys | `browser_navigate` with `go` (Playwright, so it is shown) | `Profile.back`, `forward`, `reload`; the history's `canGoBack` |
| Reload, not from the cache | Ctrl+Shift+R | none yet: a gap, when an agent needs it | `Profile.reload` with `ignoreCache` |
| Zoom a site | Ctrl + / − / 0 | none: how the human sees the page | `Profile.zoomSite` |
| DevTools | ⋮, F12; Inspect in a page's right-click menu (at the element) | none: the agent has console and network tools | `Profile.toggleDevTools`, `inspect` |
| Point at an element | Pick, Ctrl+Shift+C (into the agent's prompt) | `browser_highlight` (outlined for the human) | `picker.ts`; the MCP server |
| Read a page | looks at it | `browser_snapshot`, `browser_screenshot`, console, network | Playwright |
| Send selected page text | right-click → Send selection to agent | none: the human’s selection; agents read pages through browser tools | `Task.sendSelection`, `Task.typeForAgent` |
| Take a screenshot (an element, the visible part, the whole page) | ⋮ → Screenshot, Ctrl+Shift+S (an element); to the clipboard and the task's Artifacts [Side bar](ui.md#workbench-terminology) | `browser_screenshot` (`ref`/`locator`, `fullPage`, `also`, `purpose`) | `Task.screenshot`, `Profile.screenshot`, the screenshots' Kulisa package ([README](../src/screenshots/README.md)) |
| Act in a page | mouse, keyboard | `browser_click`, `browser_type`, `browser_press_key`, `browser_hover`, `browser_select_option`, `browser_file_upload`, `browser_evaluate` | the page itself; Playwright over the proxy |
| Answer a dialog | the dialog in the pane | `dialog` on the action that opened it | `Profile._dialog`, `answerDialog` |
| Sign in | by hand, in its master (Sign In to Master…) or a task's pane | never (Rules); asks with `profile_ask_signin` | `master.ts`; the sign-in pause |
| Save a test user's pair | Settings → Profiles' Test login and Test password | `profile_set_login` | `ProfileStore.setLogin`, `Task.setLogin` (encrypted: `shell.loginSecret`) |
| Sign in as a test user | types it | `browser_type_login` (never sees the password) | `Task.loginFor`, `local.ts` |
| Open a shell in the task's terminals, run in it | the terminals' + → Terminal, then types | `shell_run` (a name and a command; never in another agent's tab) | `Task.openTerminal`, `runInTerminal` |
| Read a terminal, stop what runs there | looks at it, Ctrl+C | `shell_read`, `shell_stop` | `Task.readTerminal`, `interruptTerminal` |
| Close a terminal | ×, Close in its menu, `exit` | `shell_stop` with `close` | `Task.closeTerminal`; a shell's exit too |

## Sign-ins kept in step

See the [Browser Kulisa package](../src/browser/README.md#sign-ins-kept-in-step).

## Test users' sign-ins

Agents may create/sign in local-app test users; real-account sign-in stays human.

- `ProfileStore.login` holds one pair, set in Settings or `profile_set_login`. Encrypt passwords with the OS keyring;
  without one, do not persist them.
- `browser_type_login` types login/password without returning the password. `profile_list` reports login and password
  availability; captions mask secrets (`shell.typingSecret`). Never put real credentials in these pairs.
- `Task.loginFor` permits local pages (`local.ts`: localhost, `.localhost`, `.test`, `.local`, loopback/private/link-local
  IPv4/IPv6 and project-specified hosts/subdomains), or pages reached from one in that tab.
- Always reject account providers (Google, Microsoft, Apple, GitHub, Facebook, Okta), including local-app redirects.
- Passwords stay out of tool results/logs/transcripts; an agent's own page script could read a field, since Kulisa
  does not sandbox its access.

## Sign-ins that last

See the [Browser Kulisa package](../src/browser/README.md#sign-ins-that-last).

## Tabs that come back

Save URLs/active tab in `Kulisa Tabs.json` on task changes and quit, including masters (`savedTabs`, `openTabs`).
Never save a transient empty list:

1. While opening/restoring cookies, save intended tabs (`ProjectProfiles.saveTabs`; `grid.spec.ts`).
2. Save once before shutdown, then suppress destruction-triggered writes (`quitting`, `shell.taskChanged`;
   `tasks-restart.spec.ts` covers background tasks).

For unexpected `about:blank`, trace empty `TaskStore.saveTabs` calls and which file lost `urls`. Kulisa cannot
recover overwritten URLs; Chromium history may retain them.

## Tabs unloaded

See the [Browser Kulisa package](../src/browser/README.md#tabs-unloaded).

## Sign-in pause

When any tab reaches/navigates to a recognized sign-in host, detach Playwright and every debugger, refuse proxy
clients and report sign-in mode to tools. Reconnect when all tabs leave. `signin-pages.ts` recognizes major account
providers; `KULISA_SIGNIN_HOSTS` extends the list.

Keep `signin-pause.ts` temporary and isolated. Some sign-ins require automation detached during authentication;
bot-detection evasion is outside scope (AGENTS.md, Rules).

## What sites see

Use Electron's Chromium identity/brands with `Electron/<version>` removed from the User-Agent (`app.ts`): Teams
otherwise identifies macOS/Windows profiles as its retired desktop app. Do not impersonate Google Chrome, which
Google sign-in rejects. `navigator.webdriver` stays false because no automation port is open; GoDaddy/Kasada uses
the sign-in pause.

## How automation reaches the pages

`cdp-proxy.ts` exposes one CDP browser endpoint per profile:
`http://127.0.0.1:<port>/<project>/<task>/<profile>` (encoded segments), backed by tabs' `webContents.debugger`.
No production remote-debugging port exposes the window. Both MCP and proxy use `local-only.ts`.

Playwright tools, Pick and annotations share this connection; external `@playwright/mcp` clients can use it too.
Preserve real target IDs and fan out events to clients. Advertise new targets only after navigation responds
(`tab.answered`), or a nonresponding site blocks Playwright attachment/task opening. Focus emulation keeps attached
pages visible/unthrottled (issue #52).

Kulisa owns profile-aware tools: per-profile MCP servers multiply fixed tool registrations and cannot follow dynamic
profiles. Agent scripts run outside Electron main; `vm` does not isolate arbitrary code. Core owns domain rules;
the plugin supplies tool behavior.

## What is on the computer

In Kulisa's data folder, laid out in [tasks.md](tasks.md), "What is on the computer": the masters at its top
(`profiles/<id>/`), each task's copies in the task's folder (`<id>/`), with Kulisa's own files in each (its tabs, its
session cookies).

The folder is the profile's id, the same for the master and every copy; a new profile's id is one no profile, no
master and no folder waiting in `deleted-folders.json` has (a task's copy of a deleted one may still be on disk, its
session open, and would pass for the new one's copy). A deleted profile's data is wiped at once; its folder is removed at the next start
(`deleted-folders.json`), because the session keeps its files open while Kulisa runs. Copying a master (a profile's first open in a task)
leaves the caches out (Cache, Code Cache, GPUCache, Dawn*) and its cookie database: the copy takes every cookie of the
master through its session (`cookie-sync.ts`, `copy`), local sites' too, as Windows keeps an open session's database locked.

Browser memory and cache ownership: [Browser Kulisa package](../src/browser/README.md#memory-and-caches).

## The code

- `src/browser/`: browser state/views, tabs, cookies and storage; see its [README](../src/browser/README.md).
- `src/main/profile-store.ts`, `project-profiles.ts`, `master.ts`: global identity, task copies and master sign-in.
  Task persistence is owned by `store.ts`; test-login locality by `local.ts`.
- `src/main/cdp-proxy.ts`, `local-only.ts`, `signin-pages.ts`, `signin-pause.ts`: automation access and sign-in policy.
- `src/main/discard.ts`, `picker.ts`: activity-based unloading and human selections.
- [Task Files](../src/task-files/README.md): task file storage and previews.
- `src/kulisa-plugin/`: agent handles/instructions ([README](../src/kulisa-plugin/README.md)).
- Renderer profile panes/controls live in `task-view/`; identity editing in `components/settings/ProfilePage.tsx`.
  Shared avatar definitions/assets provide consistent profile pictures.
- Coverage: profile/agent/discard/restart/grid e2e files, plus store/discard unit tests.
