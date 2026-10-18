# Profiles

How profiles work today: what the human and the agent do with them, what is on the computer, how sign-ins are kept,
how automation reaches the pages, and where the code is. What is next: [ROADMAP.md](ROADMAP.md). Keep this file current when profiles change.

## What a profile is

A **profile** (the word Chrome uses; not "persona", "user" or "account") is one embedded browser identity: its own
cookies, storage, sign-ins and tabs, shown as a pane in the grid. One profile is one user of the app under test
("sam@shop.com", "ann.admin"); several profiles side by side are several users at once.

**One store, a master and copies** (`profile-store.ts`, `project-profiles.ts`; built 2026-10-10). A profile is a
person, the same in every project it is listed in: its name, id, picture and description are one, changed anywhere,
seen everywhere. Its **master** is a folder in Kulisa's data (`profiles/Profile <k>/`) that no one works in. Each task
([tasks.md](tasks.md)) of its projects works in a **copy** of the master, made when the profile is first opened in
that task (not all at once: a closed one costs nothing), its tabs the master's moved to the task's ports. What a task
has of a profile is its own: its copy (what is signed in there stays there), its tabs, open or closed, its sites'
zoom. A new task opens none of them (the first one neither): the agent opens one when it needs it (`profile_open`),
the human from a tile over the terminal while none is open, or the task tab's right-click menu ([tasks.md](tasks.md),
What the human does).
**A profile lives until the human deletes it** (Settings → Profiles; the author, 2026-10-11, as the agents' accounts):
a profile in no project is kept, with its master and sign-ins. A project gets a profile when one is made in it
(`profile_create`, its page in Settings → Profiles' + → New Profile…) or taken from the others (its page's + → Other
Profiles: made in Settings → Profiles, or another project's); it lets go of one (− on its page, Remove from Project…
in the pane's menu, `profile_delete`; its tasks open or not), after a question: its copies in this project's tasks go,
the profile stays. Removing a project lets go of its profiles the same way.

A profile is an Electron session on a folder of its own (`session.fromPath`), laid out as a Chrome profile, plus a
`WebContentsView` per tab. Everything stays inside Kulisa: no external Chrome window.

## What the human does

- **Settings → Profiles** (the gear's Settings, its tree; Manage Profiles… in a task tab's right-click menu and About this profile… in the
  pane's menu open it, the latter at that profile; `settings/ProfilePage.vue`; it replaced the task's profile editor, 2026-10-11): every
  profile in Settings' tree, under Profiles, the chosen one's page on the right, each field saved on Enter or
  leaving it: **Picture**, **Name**, **About**, **Test login** and **Test password**, **Sign In…** (its master's
  window, below) and the projects it is in. It is the human's one place for who a profile is: a profile is the same
  in every project and task.
- **Create** there: the + beside Profiles in the tree, its name typed in place under it, Enter: in no project yet, the next free picture, empty and signed
  out; a project's page adds it (+ → Other Profiles). Or on a project's page (+ → New Profile…: in that project).
  Names of profiles, projects and tasks take letters (any language), digits and `@ . _ + -`, as an email
  address does, starting with a letter or a digit (not `@` alone, `.x`, `..`, `-x`), at most 64, so a profile can be
  named after its account (`ann+test@shop.com`); no spaces (`names.ts`, the author's rule). Name fields leave other
  characters out as they are typed or pasted, and the main process checks again (the agent's `profile_create` too).
  Ids and branches keep letters of any language.
- **Sign in by hand**, once for every task, in its master: **Sign In to Master…** in the pane's right-click menu, or
  **Sign In…** in Settings → Profiles (no task needed: right after making it), opens
  a window of its own on the master (`master.ts`): its page under a small bar (the address, Back, Forward, Reload),
  its session cookies kept, and nothing automated attached to it (no CDP proxy, so no agent's
  tool, Playwright or picker reaches it, and no sign-in pause is needed). Closed, its tabs and sign-ins are saved;
  its cookies reach every task's copy of the profile (below, "Sign-ins kept in step"). **Refresh from Master…** (the
  same menu, asked first) replaces a copy's cookies with all of the master's, a local app's included, and reloads its
  tabs. Sign-ins a site keeps in its storage (Microsoft's MSAL, in localStorage) are not brought: sign in again in that
  copy. Signing in to a real account in a task's pane reaches the master and the other tasks too; to a local app, that
  task only. Only the human signs in: Kulisa never types
  passwords or automates a sign-in, and never prints or logs cookies or tokens (CLAUDE.md, Rules).
- **Rename**: Settings → Profiles, its Name. Only the name and id change; the folder (sign-ins), tabs and place stay.
- **Who it is** (the description): a few words on who the profile is in the app under test, its role, what it can do
  ("seller in the Acme shop; can approve refunds"), Settings → Profiles' About. Agents
  choose profiles by it: a name says which account is signed in, not who that is in the tests. Optional, and the
  dialog says so, with what it is for: left empty, the agent asks the human when a task needs to know and saves the
  answer (below). At most 500 characters; shown under the name in the task tab's right-click menu and when pointing at the pane's name.
  The human's own words: a button to have an AI rewrite them was proposed and not built (2026-10-08): the reader is
  an agent, which understands them as they are, and a rewrite would add what the human did not say.
- **Picture**: an animal, as Chrome's profile avatars and Google's anonymous animals, each profile of a task its
  own unless the human picks one twice; Settings → Profiles' Picture shows the others. It tells panes apart by shape and colors, not by a color alone
  (some people do not tell colors apart), and can be named ("the fox"). The pictures are Noto Emoji's (Google,
  Apache-2.0), in `src/renderer/public/avatars/`, the list in `avatars.ts`; not the OS's emoji, which look different on each
  OS and are missing on some Linux.
- **Close**: × on the pane (or its menu, or the agent). Its tabs go and free their memory; it stays signed in, and
  the task tab's right-click menu lists it as closed and opens it again with the same tabs. Closed profiles stay closed across restarts.
- **Remove from Project…** (the pane's menu, − on the project's page), after a confirmation: the project lets go of it
  (above); the profile stays. **Delete** in Settings (its page's ⋯ → Delete Profile…, its row's right-click, Delete), after a
  confirmation: its copies in every project's tasks and its master, with its sign-ins, storage and tabs, go for good
  (`projects.ts`, `deleteProfile`).
- **Tabs**: a tab strip and an address bar per pane, drawn as Chrome's (the active tab of a piece with the toolbar;
  back, forward, reload as Chrome's icons; the address without `https://` and `www.` until it is clicked, then all
  of it, selected; a tab opened with + gets the focus in its empty address; many tabs shrink to their icon and × (each keeps its ×), then the
  strip scrolls, by the wheel too, its edges faded where tabs are past them, the active tab in sight: [ui.md](ui.md),
  `.tabstrip`); `target=_blank` and `window.open` open tabs of the same
  profile. Right-click a tab: reload, duplicate, close, close others. DevTools of a tab: the pane's ⋮ menu (where more of a pane's actions will go, as in Chrome) or F12.
  A narrow pane gives up back and forward (under 260 px), then reload (under 200), into ⋮, their keys staying; never
  Pick or ⋮, which went out of reach first when the buttons kept their order (2026-10-16; `.bar`'s container queries).
  Chrome's keys work in a page for its pane: Ctrl+T, Ctrl+W, Ctrl+Shift+T, Ctrl+L, Ctrl+Tab, Ctrl+1…9 and the rest
  ([window.md](window.md), Keys).
- **Zoom**: Ctrl + / − / 0 in a page zooms that site in that profile, on top of the Kulisa zoom (saved per profile,
  shown in the address bar).
- **A page that does not load** says why, as Chrome's error page does (Electron leaves it blank): the site cannot be
  found, refused to connect (a local app whose server is not running), took too long, no internet, an untrusted
  certificate; with Chromium's code (`ERR_…`). The address stays the one that failed, so reload tries it again; the
  agent's snapshot reads the same words (`error-page.html`, filled in by `profiles.ts`). A tab whose site refuses to connect
  (a new task's tabs on its ports before its dev server runs) is ready at once with that page: it held its profile's
  opening 5 s until 2026-10-09.
- **Pick** (DevTools' inspect icon, at the end of the address bar): click an element on the page; a reference to it goes into the agent's prompt (below). Off on an empty tab (`about:blank`): nothing to point at.

## What the agent does

Through Kulisa's MCP server (`mcp-server.ts`). `profile_list` lists the profiles, their ids and tabs; the `browser_*`
tools act in one, each taking a profile id: `browser_snapshot`, `browser_click`, `browser_type`, `browser_press_key`, `browser_hover`, `browser_select_option`,
`browser_file_upload`, `browser_wait_for`, `browser_evaluate`, `browser_navigate` (also back, forward, reload),
`browser_tab_new` / `_select` / `_close`, `browser_highlight`, `browser_screenshot`, `browser_console_messages`,
`browser_network_requests`, `browser_type_login`; the tools reading or acting on a page take an optional `tab`.
Profiles (`profile_*`, the profile as a thing): `profile_create`, `profile_rename`, `profile_describe`, `profile_open`, `profile_close`, `profile_ask_signin`,
`profile_set_login`, and `profile_delete`, which asks the human first. Tasks: `task_rename`, `task_add_repository` (another of the project's repositories, once the human agreed: [tasks.md](tasks.md), Tasks),
`task_remove_repository` (one added, no longer needed, once the human agreed), `task_history` (what was
said and done in the task before: [transcripts.md](transcripts.md)), `conversation_rename` (its tab). Terminals:
`terminal_run`, `terminal_read`, `terminal_stop` (shells only, [window.md](window.md), The terminal).

**The agent does not ask the human before Kulisa's tools** (the author, 2026-10-12): it works in the profiles while the
human watches or is away, and a question at every click undoes that; what acts on real accounts asks in Kulisa itself
(`profile_delete`, the sign-in pause). But two keep the agent's own approval (`KULISA_ASKS`, `agents/`):
`terminal_run`, any command in the human's shell, which would get around the agent's approval of commands (and
Codex's sandbox: the command runs in Kulisa's terminal); `browser_file_upload`, a file of the disk sent to a site, what
a prompt injection would use. A new tool runs without a question unless it is added there. Through the start's
arguments, as the MCP server and the hooks are, not the agents' own config files: Claude Code's `permissions` in
`--settings` (allow the plugin's server, `mcp__plugin_kulisa_kulisa`; ask the two: an ask rule wins), Codex's
`mcp_servers.kulisa.default_tools_approval_mode="approve"` and `prompt` for the two.

What the tools are for, beyond acting as one user:

- **Choosing the profile** by who it is, as cast did: `profile_list` and the session's start give each profile's
  description, or say it is not said. The agent chooses by it, never guessing a role from a name; when none or several
  fit, it asks the human once and saves their answer (`profile_describe`), so no one asks again. The rule is in the
  MCP server's `instructions` too, so agents without the profiles skill (one run by hand in the terminal) get it.
- **Several users at once.** `browser_wait_for` waits in any profile, so the agent acts as one user and waits for
  the effect as another (a message, an invite), up to 45 s a call (Codex gives an MCP tool 60 s).
  `browser_snapshot` with `also` reads several profiles' active tabs in one call, to compare what each user sees.
- **Dialogs** (alert, confirm). A page's dialog is shown in its pane, as Chrome shows it in the page: "<site> says",
  the message, OK (and Cancel for confirm), at the top of a dimmed picture of the page (a page is still while its
  dialog is open), Enter and Esc as in Chrome. Electron showed its own message box in the middle of the window, which
  did not say which page asked; its handler is a listener of an internal event (`-run-dialog`), replaced for every
  tab (`Profile._dialog`; ROADMAP, "Workarounds of Electron bugs"). A dialog of a tab in the background shows when the
  tab is chosen. Electron has no `prompt()` (it throws in the page). Starting a navigation (the address bar, reload)
  dismisses an open dialog, as Chrome does: Chromium holds the navigation until it is answered. The dialogs an
  agent's click, key or navigation opens are answered as it asks (`dialog: accept`), else dismissed, the safe
  answer, and none is shown; the result says what the page asked. Others stay for the human; one answered over CDP
  by another client (an agent's own script) leaves the pane too. While one is open the page does nothing (its JS waits,
  as in Chrome), so the agent's tools on that tab say so at once instead of waiting for it. Its look is Chrome's
  (smaller and plainer than Kulisa's own dialogs), as everything in the pane: it is the page's.
- **Signing in stays the human's** (Rules): `profile_ask_signin` shows the request over the pane ("sign in,
  please: …"), optionally opens the app's sign-in page first (the window's way, `Profile.navigate`: a sign-in page
  puts the profile in sign-in mode, which cuts Playwright off), and waits until the human is through: the profile
  went through sign-in mode and left it, or its page is no longer the one it was asked on (origin and path). The
  agent's turn goes on instead of ending at "please sign in". Up to 45 s a call; where it was asked is kept across
  calls (10 minutes). A sign-in on the same address (a dialog in the page) is not seen: the human then tells the
  agent.
- **`browser_evaluate`** runs a function the agent writes in the page: made there from its source (no eval in the
  main process; CDP's evaluation is not held to the page's CSP) and called with the element, if one is given. The
  skill forbids reading cookies or tokens with it; the profile's CDP proxy is open to local processes anyway (open
  issue in ROADMAP). The console and network tools (Playwright's `page.consoleMessages()`,
`pageErrors()`, `requests()`) give errors or failures only when asked. `@playwright/mcp` works too, through the
profile's CDP proxy (below).

**The agent points back**: `browser_highlight` outlines elements on a profile's page (Playwright's
`locator.highlight()`, following the element; it works on Trusted Types pages too) and shows its labels in the pane
header, until the human clicks or types in that tab.

**The agent types as a person does**: `browser_type` clears the field and types its text key by key (Playwright's
`pressSequentially`), 40 ms a key, faster for a longer text (about 1.5 s at most), so the human sees it typed and the
page gets the keys typing sends (suggestions, checks as one types). A text over 300 characters (a pasted paragraph)
is filled at once (`TYPED_MAX`, `mcp-server.ts`). Letters not on a US keyboard come as typed text, without key codes
(Playwright's way).

The agent learns how to work with profiles from the Kulisa plugin (CLAUDE.md, Architecture):
the profiles skill (`src/agent/skills/profiles/SKILL.md`; keep it in step with the tools), one text for every agent,
written into each account's folder where its agent reads its skills (`kulisa-profiles`), and for Claude Code a plugin
with the MCP config (`src/agent/claude-plugin/`, `claude --plugin-dir`). Every agent gets Kulisa's hooks at its start (a table in
its file, `agents/`), among them `SessionStart`, which tells the agent which profiles are open and tells Kulisa its
session (to resume it). The user's own MCP servers stay available
(no `--strict-mcp-config`). Some of them may drive another browser with tools of the same names (cast's,
Playwright MCP's `browser_click` …), and an agent has no priority among MCP servers: it chooses by names and
descriptions. So every agent is told, in the MCP server's `instructions` and again at the session's start next to the
profiles (`ONLY_BROWSER`, `agent-hooks.ts`), that the profiles are the only browser here, and why: another browser is
not the one the human sees, and not signed in. Not blocked (`--disallowedTools` would need every such server's name,
and would refuse it also when the human asks for it). Codex gets the MCP server and the hooks as config overrides (its `SessionStart` brings the open profiles).

The human sees what the agent does (`ghost.ts`): Playwright's action annotations in the page, each shown 500 ms,
which every action waits for (1.2 s until 2026-10-09 cost an agent a minute every 50 clicks): a mark at the action
point, the element outlined, and the agent's own pointer, moving from one action to the next and staying at the last
(Playwright's `cursor: 'pointer'`; not the OS's: the human's mouse stays theirs; no test of its pixels, Playwright
draws it); and a caption over the pane for every command through the proxy. The marks and
`browser_highlight`'s outlines are in Kulisa's accent in every profile (`MARK`): the pane says whose page it is.

**Point and tell** (`picker.ts`): Pick, then a click on an element (Playwright's `page.pickLocator()`; Esc or Pick
again cancels). `[kulisa pick: <profile> tab <tab> <locator>]` is typed without Enter into the prompt of the agent in
front of the task's island, else the one in front last (a shell in front: `Task.promptTarget`), whose tab comes to the
front, and the terminal gets the focus: the human writes the rest of the message around it. Nothing is saved; the agent looks
at the element on the live page with its tools.

## Actions: the human's and the agent's

Both act on one core (CLAUDE.md, Architecture): the window and the MCP tools find profiles and tabs with
`Task.find` / `findTab` (the same refusals: no such profile, a closed one, no such tab) and call the same
methods; who a profile is changes and is checked in the store (`ProfileStore.rename`, `describe`, `setAvatar`,
`setLogin`), which Settings → Profiles calls directly (no task needed) and a task's methods through its list
(`ProjectProfiles`). A row with one side empty says why, or is a gap to fill.

| Action | The human | The agent | The core |
|---|---|---|---|
| Create a profile | Settings → Profiles (in no project), a project's page (in it) | `profile_create` (in its project) | `ProfileStore.create`; `Task.createProfile` |
| Rename a profile | Settings → Profiles | `profile_rename` | `ProfileStore.rename`; `Task.renameProfile` |
| Say who a profile is | Settings → Profiles | `profile_describe`, `profile_create` (the human's words only) | `ProfileStore.describe`; `Task.describeProfile` |
| Change its picture | Settings → Profiles | none: how the human tells panes apart | `ProfileStore.setAvatar` |
| A test user's pair | Settings → Profiles | `profile_set_login` | `ProfileStore.setLogin` (`shell.loginSecret` encrypts) |
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
| DevTools | ⋮, F12 | none: the agent has console and network tools | `Profile.toggleDevTools` |
| Point at an element | Pick, Ctrl+Shift+C (into the agent's prompt) | `browser_highlight` (outlined for the human) | `picker.ts`; the MCP server |
| Read a page | looks at it | `browser_snapshot`, `browser_screenshot`, console, network | Playwright |
| Act in a page | mouse, keyboard | `browser_click`, `browser_type`, `browser_press_key`, `browser_hover`, `browser_select_option`, `browser_file_upload`, `browser_evaluate` | the page itself; Playwright over the proxy |
| Answer a dialog | the dialog in the pane | `dialog` on the action that opened it | `Profile._dialog`, `answerDialog` |
| Sign in | by hand, in its master (Sign In to Master…) or a task's pane | never (Rules); asks with `profile_ask_signin` | `master.ts`; the sign-in pause |
| Save a test user's pair | Settings → Profiles' Test login and Test password | `profile_set_login` | `ProfileStore.setLogin`, `Task.setLogin` (encrypted: `shell.loginSecret`) |
| Sign in as a test user | types it | `browser_type_login` (never sees the password) | `Task.loginFor`, `local.ts` |
| Bring the master's sign-ins to a task's copy | Refresh from Master… | none: it replaces sign-ins, the human's to decide | `Task.refreshProfile`, `SessionCookies.copy` |
| Open a shell in the task's island, run in it | the island's + → Terminal, then types | `terminal_run` (a name and a command; never in another agent's tab) | `Task.openTerminal`, `runInTerminal` |
| Read a terminal, stop what runs there | looks at it, Ctrl+C | `terminal_read`, `terminal_stop` | `Task.readTerminal`, `interruptTerminal` |
| Close a terminal | ×, Close in its menu, `exit` | `terminal_stop` with `close` | `Task.closeTerminal`; a shell's exit too |

## Sign-ins kept in step

A real account is signed in to once, for every task (`cookie-sync.ts`; built 2026-10-10): the cookies of sites that
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

## Test users' sign-ins

Real accounts are the human's to sign in to (Rules); a **test user of the app under test on this computer** is the
agent's, so it can sign up, sign in and sign out as many users as the tests need without asking (designed with the
author, 2026-10-10). How it is kept safe, each line with its reason:

- **A pair per profile** (`profile-store.ts`, `login`): a login and a password. Set by the human (Settings → Profiles'
  Test login and Test password) or the agent (`profile_set_login`, after it signed that user up). The password is
  encrypted with the OS keyring (`safeStorage`), as session cookies are; without a keyring none is kept: never in the
  clear on disk.
- **The agent never gets the password.** `browser_type_login` (a field, `login` or `password`) has Kulisa type it into
  the page; `profile_list` shows the login and whether a password is kept, not the password; the pane's caption
  says `type ••••••` (`ghost.ts`, `shell.typingSecret`). So it is in no transcript, log or screen share. (A script the
  agent runs in the page could read a field back; the skill forbids reading secrets, as it forbids cookies.)
- **Only on a local page** (`local.ts`, `Task.loginFor`): `localhost`, `*.localhost`, `*.test`, `*.local`, loopback,
  private and link-local addresses, IPv4's and IPv6's (ipaddr.js's ranges), and the project's own list (its page in Settings → Projects, Local addresses: a tunnel, dev
  domains, each with its subdomains); or a page the same tab reached from one (an Auth0 dev tenant, a local Keycloak on another name).
  Elsewhere it is refused, so a pair cannot be typed into a real site, a look-alike page, or a link the agent was sent
  to. An address left out is safe the other way: the pair is not typed there.
- **Never on an account provider** (Google, Microsoft, Apple, GitHub, Facebook, Okta), even reached from a local app:
  a test account there is the human's to sign in to, in the profile's master.
- The agent's own rule (the MCP server's instructions, the skill): a real account's password never goes into a pair.

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

## Tabs that come back

Each profile's tabs are saved in its folder (`Kulisa Tabs.json`) after every change of its task and as Kulisa
quits, and opened again at the next start. Saving often means a moment with no tabs, saved, loses them all: the
profiles come back on `about:blank`. It happened twice on 2026-10-08, each time from another path; when it happens
again, look for a third such moment first (which file went `[]`, and when: log a stack where
`TaskStore.saveTabs` gets `[]`, as the second time was found):

1. **A profile still opening** (its session cookies restored before its tabs open) was saved with no tabs; Kulisa
   quitting right after a start lost every profile's. Now one opening is saved as what it opens
   (`ProjectProfiles.saveTabs`; test in `grid.ts`).
2. **Tabs closing as Kulisa quits**: after the tabs were saved, each one destroyed saved its task again, one
   fewer each time, none at last. A task in the background (shown before, then left) saved at once and lost
   all; the shown one's save waited 30 ms and missed the exit. Now nothing is saved from then on (`quitting` in
   `shell.taskChanged`, `app.ts`; test in `restart-tasks.ts`: the task left loaded in the background keeps its tabs).

What is lost cannot be recovered from Kulisa's files; Chromium's own history in the profile's folder still has the
pages.

## Tabs unloaded

A tab no one looks at loses its process after a while, as Chrome's Memory Saver discards tabs (built 2026-10-13: the
author's RAM went with several projects open, each with several profiles, every tab of them a Chromium process whether
anyone looked at it or not). What stays is the tab's entry in the strip: its address, title and icon, as before, nothing
marks it (Chrome marks none either). Looked at or used again, its page loads again at that address.

- **Off screen** is a tab that is not the active tab of a pane on screen in the task shown in some window: a tab behind
  the active one, a pane stacked behind another, every tab of a task not shown (a group in the background too).
- **Unused** is a task whose agents are neither working nor waiting for the human (their hooks: an agent waiting on a
  permission goes on in its tabs, with their state, once answered), and a profile that no automation sent a command
  for that long (every command passes the CDP proxy, `Profile.busyAt`: agents without hooks, the agent's own scripts).
- **The time**: 5 minutes for both (`DISCARD_AFTER`, `discard.ts`; the author, 2026-10-13), so switching tasks back and
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

## Sign-in pause

While any tab of a profile is on a sign-in page (or navigating to one), nothing automated is attached to the
profile: Playwright disconnects, every tab's debugger is detached, the proxy refuses clients, the MCP tools answer
that the human is signing in. When no tab is on one, the shell's connection comes back. Sign-in pages are known by
host (`signin-pages.ts`: Microsoft, Google, GoDaddy, Okta, OneLogin, Auth0, Duo, PingOne, Salesforce; more with
`KULISA_SIGNIN_HOSTS`). Some sign-ins (GoDaddy SSO behind Kasada) pass only so: Kasada judged the sign-in itself, with
automation attached at that moment; once signed in, the agent reattached and worked in the session without being blocked
(2026-10-05). `signin-pause.ts` is a deliberately temporary implementation; the author will replace it (CLAUDE.md, Rules).

Why so, and why temporary (the author, 2026-10-05): the agent's presence in a profile is not automation of a sign-in
(Kulisa is not a bot: [README](../README.md), Why); the pause exists only because such a service refuses a sign-in with
automation attached at that moment, and goes once it is understood how the embedded browser passes it with the agent
attached. Not by hiding the agent from bot detection: Kulisa does not get past it.

## What sites see

Profiles present themselves as what they are: Kulisa on Chromium, Electron's User-Agent without its `Electron/<version>`
(`… kulisa/<version> Chrome/<version> Safari/537.36`; `app.userAgentFallback`, `app.ts`) and Electron's brands
(Chromium, not Google Chrome); `navigator.webdriver` stays false, as no automation port is open. Electron's word went on
2026-10-16: Teams took a Mac's or Windows' User-Agent with it for its own retired desktop app (built on Electron) and
showed "Classic Teams is no longer available" (`/error/eoa`) instead of its sign-in; Linux's, and a Mac's without
it, got the sign-in (tried in a bare Electron, one change at a time).
From 2026-10-05 to 2026-10-12 they presented as Google Chrome (`mimic-chrome.ts`: the User-Agent, `Sec-CH-UA*`
headers, `navigator.userAgentData`), on reasons not tested one at a time: Google was said to block embedded browsers,
and GoDaddy's Kasada passed once the sign-in pause and the mimicry were both in. Tried with the author on 2026-10-12:
Google refused to sign in that profile ("This browser or app may not be secure") and let Electron's own Chromium in,
with a debugger attached too; GoDaddy's sign-in passed without it (the pause is what it needs). Dropped then.

## How automation reaches the pages

Only through the CDP proxy (`cdp-proxy.ts`): a fake CDP "browser" endpoint per profile,
`http://127.0.0.1:<port>/<project>/<task>/<profile>` (each part percent-encoded), over each tab's `webContents.debugger`. There is no
`--remote-debugging-port`, so Kulisa's own window is never exposed. Clients: the shell's own playwright-core
connection (the MCP tools, the picker, the annotations) and `@playwright/mcp`. The proxy reports Chrome's real target
ids (Playwright needs them) and fans out a tab's events to all clients. Playwright's first command to a page,
`Emulation.setFocusEmulationEnabled`, is a capture to Chromium: the page stays visible, unthrottled and unfrozen
behind the active tab and under another task (issue #52, tabs asleep). A tab opening a URL is shown to clients only
once the site has answered (its page or an error page, `tab.answered`): until then Chromium holds CDP commands to it,
and a site that never answers made Playwright's connection, and opening the task, hang. It and the MCP server listen on 127.0.0.1
only and refuse requests from web pages (`local-only.ts`). Why the tools are Kulisa's own and not a bridge to
`@playwright/mcp` (the author's question, 2026-10-08): it has no profile argument (a server per profile, its 25 tools
each, while profiles come and go and an agent's servers are fixed at its start); the core's rules live in the tools
(the sign-in pause, dialogs, captions and highlights over the pane, the human's tabs); and a tool running the agent's
own Playwright code cannot run in Electron's main process (`vm` is no boundary), while in a process of its own it is
what the agent already does with a script through the proxy. Each tool is a few lines of Playwright; most of their size
is the descriptions the agent reads. If agents often write their own scripts, that names a missing tool.

## What is on the computer

In Kulisa's data folder ([tasks.md](tasks.md), "What is on the computer"): the masters at its top, each task's copies
in the task's folder:

```
profiles.json                   { next, list: [{ id, name, avatar, description, folder, projects }] }: the profiles
profiles/Profile 1/             a profile's master, a Chromium profile: Cookies, Local Storage, IndexedDB …;
                                kept in no project too, gone when the human deletes the profile (Settings → Profiles)
projects/<project id>/<task>/
  profiles.json                 what the task has of them: { folder, id, zoom (per site), closed }
  Profile 1/                    its copy of the master, made at its first open here: a Chromium profile
    Kulisa Tabs.json            the URLs of its tabs, to open them again
    Kulisa Session Cookies.bin  its session cookies, encrypted
  Profile 2/ …
```

The folder is named as Chrome names its profiles, fixed at creation, the same for the master and every copy; a new
profile never takes a number used before (`next`: a task's copy of a deleted one may still be on disk, its session
open, and would pass for the new one's copy). A deleted profile's data is wiped at once; its folder is removed at the next start
(`deleted-folders.json`), because the session keeps its files open while Kulisa runs. Copying a master (a profile's first open in a task)
leaves the caches out (Cache, Code Cache, GPUCache, Dawn*).

Memory: each tab is a Chromium process (`ps` shows each); closing a profile frees its tabs, and a tab no one looks at
frees its own after a while ("Tabs unloaded").

Disk: closing a profile clears its caches (HTTP, compiled code, shaders, and the sites' Cache API, their service
workers' copies of their bundles, which Chromium counts as storage and which was most of a copy's size, 200 MB for
Teams: `clearCaches` in `profiles.ts`); its sign-ins and the sites' other storage stay. An open profile's HTTP cache has the limit Chromium sets from the free disk
space (ROADMAP, "Profiles' caches").

## The code

| File | What |
|---|---|
| `src/main/profiles.ts` | a profile: its session, tabs (WebContentsView), the shell's Playwright connection, sign-in mode, zoom |
| `src/main/error-page.html` | what a tab shows when its page did not load |
| `src/main/profile-store.ts` | the profiles, one store: who each is, its master, its projects, a test user's pair |
| `src/main/local.ts` | what is local: where a test user's pair may be typed, which sites' cookies stay each task's |
| `src/main/cookie-sync.ts` | real accounts' cookies kept in step between a master and its copies |
| `src/main/master.ts`, `src/renderer/master.html`, `master.ts`, `components/Master.vue` | a master's window, to sign in to it |
| `src/main/project-profiles.ts` | a task's profiles: copies of their masters made at their first open, open and closed; create, rename, describe, close, open, let go |
| `src/shared/avatars.ts`, `src/renderer/public/avatars/` | the profiles' pictures (Noto Emoji) |
| `src/main/store.ts` | `profiles.json`, the profile folders, their tabs |
| `src/main/session-cookies.ts` | session cookies across restarts |
| `src/main/signin-pages.ts`, `signin-pause.ts` | sign-in pages; the pause |
| `src/main/cdp-proxy.ts` | the CDP endpoint per profile |
| `src/main/local-only.ts` | refusing web pages' requests to the MCP server, the hooks and the proxy (Host, Origin) |
| `src/main/kulisa-plugin/agent-hooks.ts` | the answers to the agents' hooks: the open profiles, the session, the agent's state |
| `src/main/page-focus.ts` | the keyboard stays where the human put it: a page taking it by itself gives it back ([window.md](window.md), Keys) |
| `src/main/discard.ts` | tabs no one looks at losing their process: the rule, the sweep (`Profile.discard`, `load` in `profiles.ts`) |
| `src/main/kulisa-plugin/mcp-server.ts`, `ghost.ts`; `src/main/picker.ts` | the agent's tools, its actions shown; point and tell |
| `src/agent/skills/profiles/SKILL.md`, `src/agent/claude-plugin/` | the profiles skill, every agent's; Claude Code's plugin (`.mcp.json`: the task's MCP URL) |
| `src/renderer/components/grid/ProfilePane.vue`, `ProfileHeader.vue`, `lib/profiles.ts`; `settings/ProfilePage.vue`, `settings/Avatars.vue` | the panes and the profiles' menu (a task tab's right-click); a profile's page in Settings and its pictures |
| `test/agent.ts`, `profiles.ts`, `discard.ts`, `zoom-and-closing.ts`, `restart-profiles.ts`, `unit/store.test.ts`, `unit/discard.test.ts` | the tests |
