# Profiles

How profiles work today: what the human and the agent do with them, what is on the computer, how sign-ins are kept,
how automation reaches the pages, and where the code is. What is next: GitHub issues.

## What a profile is

A **profile** is one embedded browser identity: its own
cookies, storage, sign-ins and tabs, shown as a pane in the grid. One profile is one user of the app under test
("sam@shop.com", "ann.admin"); several profiles side by side are several users at once.

**One store, a master and copies** (`profile-store.ts`, `project-profiles.ts`). A profile is a
person, the same in every project it is listed in: its name, picture and description are one, changed anywhere,
seen everywhere. Its **id** is six random lowercase letters and digits (`m2q7xd`), made once and never changed, as a
project's and an agent's account's: inside Kulisa a profile is its id (its folders, a project's list, a task's file, its
pane in the grid, what the window and the main process say of it). The agent knows it by its **name** (the tools'
`profile`, matched whatever its case), never by its id, so a name is unique within a project, whatever its case:
made in a project, renamed, or added to one, a profile whose name another profile there has is refused, saying so
(`ProfileStore.nameTaken`; a profile in no project is checked when a project takes it). A project lists its profiles,
in order, by their ids (`projects.json`'s `profiles`). What a project is made of (its repositories, agents, profiles)
is said in the project alone: one place to read it and to change it. Its **master** is a folder in Kulisa's data
(`profiles/<id>/`) that no one works in. Each task
([tasks.md](tasks.md)) of its projects works in a **copy** of the master, made when the profile is first opened in
that task (not all at once: a closed one costs nothing), its tabs the master's moved to the task's ports. What a task
has of a profile is its own: its copy (what is signed in there stays there), its tabs, open or closed, its sites'
zoom. A new task opens none of them (the first one neither): the agent opens one when it needs it (`profile_open`),
the human from a tile over the terminal while none is open, or the task tab's right-click menu ([tasks.md](tasks.md),
What the human does).
**A profile lives until the human deletes it** (Settings → Profiles; as the agents' accounts):
a profile in no project is kept, with its master and sign-ins. A project gets a profile when one is made in it
(`profile_create`, its page in Settings → Profiles' + → New Profile…) or taken from the others (its page's + → Other
Profiles: made in Settings → Profiles, or another project's); it lets go of one (− on its page, Remove from Project…
in the pane's menu, `profile_delete`; its tasks open or not), after a question: its copies in this project's tasks go,
the profile stays. Removing a project lets go of its profiles the same way.

A profile is an Electron session on a folder of its own (`session.fromPath`), laid out as a Chrome profile, plus a
`WebContentsView` per tab. Everything stays inside Kulisa: no external Chrome window.

## What the human does

- **Settings → Profiles** (the gear's Settings; Manage Profiles… in a task tab's right-click menu and About this profile… in the
  pane's menu open it, the latter at that profile; `components/settings/ProfilePage.tsx`): every
  profile a row of Settings' Profiles page, its own page under it, each field saved on Enter or
  leaving it: **Picture**, **Name**, **About**, **Test login** and **Test password**, **Sign In…** (its master's
  window, below) and the projects it is in: the human's one place for who a profile is.
- **Create** there: New Profile on Profiles' page, its name typed in place, Enter: in no project yet, the next free picture, empty and signed
  out; a project's page adds it (+ → Other Profiles). Or on a project's page (+ → New Profile…: in that project).
  Names of profiles, projects and tasks take letters (any language), digits and `@ . _ + -`, as an email
  address does, starting with a letter or a digit (not `@` alone, `.x`, `..`, `-x`), at most 64, so a profile can be
  named after its account (`ann+test@shop.com`); no spaces (`names.ts`, the author's choice). Name fields leave other
  characters out as they are typed or pasted, and the main process checks again (the agent's `profile_create` too).
  Ids and branches keep letters of any language.
- **Sign in by hand**, once for every task, in its master: **Sign In to Master…** in the pane's right-click menu, or
  **Sign In…** in Settings → Profiles (no task needed: right after making it), opens
  a window of its own on the master (`master.ts`): its page under a small bar (the address, Back, Forward, Reload), one tab shown at a time (a sign-in's popup takes
  its place, the tab before comes back when it closes),
  its session cookies kept, and nothing automated attached to it (no CDP proxy, so no agent's
  tool, Playwright or picker reaches it, and no sign-in pause is needed). Closed, its tabs and sign-ins are saved;
  its cookies reach every task's copy of the profile (below, "Sign-ins kept in step"). Signing in to a real account in a
  task's pane reaches the master and the other tasks too; to a local app, that task only (each task runs its own copy
  of the app): a task's copy made before its master signed in to a local app is signed in there in its own pane.
- **Rename**: Settings → Profiles, its Name. Only the name changes; the id, the folders (sign-ins), tabs and place stay.
- **Who it is** (the description): a few words on who the profile is in the app under test, its role, what it can do
  ("seller in the Acme shop; can approve refunds"), Settings → Profiles' About. Agents
  choose profiles by it: a name says which account is signed in, not who that is in the tests. Optional, and its
  hint says so, with what it is for: left empty, the agent asks the human when a task needs to know and saves the
  answer (below). At most 500 characters; shown under the name in the task tab's right-click menu and when pointing at the pane's name.
  The human's own words, never rewritten by an AI: the reader is an agent, which understands them as they are, and a
  rewrite would add what the human did not say.
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
- **Tabs**: a tab strip and a toolbar per pane, as Chrome's (`components/grid/ProfilePane.tsx`): back, forward,
  reload; the address without `https://` and `www.` until it is clicked, then all of it, selected; a tab opened with +
  gets the focus in its empty address; many tabs shrink to their icon and × (each keeps its ×), then the strip scrolls
  (`useStrip`, `lib/strip.ts`); `target=_blank` and `window.open` open tabs of the same profile. Right-click a tab:
  reload, duplicate, close, close others. **⋮** at the toolbar's end, as Chrome's: Screenshot (Element, Visible Part,
  Full Page) and DevTools (or F12). A narrow pane gives up back and forward, then reload, into ⋮ as they no longer
  fit beside the address's least room, their keys staying; never Pick or ⋮ (container queries: [ui.md](ui.md), Controls).
  Chrome's keys work in a page for its pane: Ctrl+T, Ctrl+W, Ctrl+Shift+T, Ctrl+L, Ctrl+Tab, Ctrl+1…9 and the rest
  ([window.md](window.md), Keys).
- **Zoom**: Ctrl + / − / 0 in a page zooms that site in that profile, on top of the Kulisa zoom (saved per profile,
  shown in the address bar).
- **An empty tab** (`about:blank`: a new one, the last one closed) is the pane's color in Kulisa's theme, not
  Chromium's white (`Profile.setBlank`, by the window; `COLORS.page`, `window.ts`); a page's own colors stay its own.
- **A page that does not load** says why, as Chrome's error page does (Electron leaves it blank): the site cannot be
  found, refused to connect (a local app whose server is not running), took too long, no internet, an untrusted
  certificate; with Chromium's code (`ERR_…`). The address stays the one that failed, so reload tries it again; the
  agent's snapshot reads the same words (`error-page.html`, filled in by `profiles.ts`). A tab whose site refuses to connect
  (a new task's tabs on its ports before its dev server runs) is ready at once with that page, so its profile opens
  without waiting for it.
- **Pick** (DevTools' inspect icon, at the end of the address bar): click an element on the page; a reference to it goes into the agent's prompt (below). Off on an empty tab (`about:blank`): nothing to point at.

## What the agent does

The [Kulisa plugin](../src/kulisa-plugin/README.md#browser-tools) supplies every agent with the same profile and browser
tools, instructions, and action annotations. Tools call the core actions listed below.

## Page dialogs

The [Browser Kulisa package](../src/browser/README.md#page-dialogs) owns page dialogs.

**Point and tell** (`picker.ts`): Pick, then a click on an element (Playwright's `page.pickLocator()`; Esc or Pick
again cancels). `[kulisa pick: <profile> tab <tab> <locator>]` is typed without Enter into the prompt of the agent in
front of the task's terminals, else the one in front last (a shell in front: `Task.promptTarget`), whose tab comes to the
front, and the terminal gets the focus: the human writes the rest of the message around it. Nothing is saved; the agent looks
at the element on the live page with its tools.

## Actions: the human's and the agent's

Both act on one core (AGENTS.md, Architecture): the window and the MCP tools find profiles and tabs with
`Task.find` / `findTab` by id (the same refusals: no such profile, a closed one, no such tab; said with the profile's
name), the agent's handle first finding the id of the name it was given (`Task.named`), and call the same
methods; who a profile is changes and is checked in the store (`ProfileStore.rename`, `describe`, `setAvatar`,
`setLogin`), which Settings → Profiles calls directly (no task needed) and a task's methods through its list
(`ProjectProfiles`). A row with one side empty says why, or is a gap to fill.

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
| Take a screenshot (an element, the visible part, the whole page) | ⋮ → Screenshot, Ctrl+Shift+S (an element); to the clipboard and the task's artifacts in Resources | `browser_screenshot` (`ref`/`locator`, `fullPage`, `also`) | `Task.screenshot`, `Profile.screenshot`, the screenshots' Kulisa package ([README](../src/screenshots/README.md)) |
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

Real accounts are the human's to sign in to (Rules); a **test user of the app under test on this computer** is the
agent's, so it can sign up, sign in and sign out as many users as the tests need without asking. Kept safe so:

- **A pair per profile** (`profile-store.ts`, `login`): a login and a password. Set by the human (Settings → Profiles'
  Test login and Test password) or the agent (`profile_set_login`, after it signed that user up). The password is
  encrypted with the OS keyring (`safeStorage`), as session cookies are; without a keyring none is kept: never in the
  clear on disk.
- **The agent never gets the password.** `browser_type_login` (a field, `login` or `password`) has Kulisa type it into
  the page; `profile_list` shows the login and whether a password is kept, not the password; the pane's caption
  says `type ••••••` (`ghost.ts`, `shell.typingSecret`). So it is in no transcript, log or screen share. (A script the
  agent runs in the page can read a field back: left open, as Kulisa does not restrict the agent.)
- **Only on a local page** (`local.ts`, `Task.loginFor`): `localhost`, `*.localhost`, `*.test`, `*.local`, loopback,
  private and link-local addresses, IPv4's and IPv6's (ipaddr.js's ranges), and the project's own list (its page in Settings → Projects, Local addresses: a tunnel, dev
  domains, each with its subdomains); or a page the same tab reached from one (an Auth0 dev tenant, a local Keycloak on another name).
  Elsewhere it is refused, so a pair cannot be typed into a real site, a look-alike page, or a link the agent was sent
  to. An address left out is safe the other way: the pair is not typed there.
- **Never on an account provider** (Google, Microsoft, Apple, GitHub, Facebook, Okta), even reached from a local app:
  a test account there is the human's to sign in to, in the profile's master.
- The agent's own rule (the MCP server's instructions, the skill): a real account's password never goes into a pair.

## Sign-ins that last

See the [Browser Kulisa package](../src/browser/README.md#sign-ins-that-last).

## Tabs that come back

Each profile's tabs are saved in its folder (`Kulisa Tabs.json`: their addresses and which one is in front) after
every change of its task and as Kulisa quits, and opened again at the next start, the one in front again in front,
as Chrome does (a master's the same; `Profile.savedTabs`, `openTabs`).

A moment with no tabs, saved, loses them all: the profiles come back on `about:blank`. Two such moments are not saved:

1. **A profile still opening** (its session cookies restored before its tabs open) is saved as what it opens, not as
   the none it has yet (`ProjectProfiles.saveTabs`; test in `grid.spec.ts`).
2. **Tabs closing as Kulisa quits**: the tabs are saved first, and each one destroyed after would save its task again,
   one fewer each time, none at last; so nothing is saved from then on (`quitting` in `shell.taskChanged`, `app.ts`;
   test in `tasks-restart.spec.ts`: the task left loaded in the background keeps its tabs).

When profiles come back on `about:blank`, look for a third such moment first: which file's `urls` went empty, and
when (log a stack where `TaskStore.saveTabs` gets none).

What is lost cannot be recovered from Kulisa's files; Chromium's own history in the profile's folder still has the
pages.

## Tabs unloaded

See the [Browser Kulisa package](../src/browser/README.md#tabs-unloaded).

## Sign-in pause

While any tab of a profile is on a sign-in page (or navigating to one), nothing automated is attached to the
profile: Playwright disconnects, every tab's debugger is detached, the proxy refuses clients, the MCP tools answer
that the human is signing in. When no tab is on one, the shell's connection comes back. Sign-in pages are known by
host (`signin-pages.ts`: Microsoft, Google, GoDaddy, Okta, OneLogin, Auth0, Duo, PingOne, Salesforce; more with
`KULISA_SIGNIN_HOSTS`). Some sign-ins (GoDaddy SSO behind Kasada) pass only so: Kasada judges the sign-in itself, with
automation attached at that moment; once signed in, the agent reattaches and works in the session without being
blocked.

`signin-pause.ts` is deliberately temporary (AGENTS.md, Rules): the agent's presence in a profile is not automation of
a sign-in (Kulisa is not a bot: [README](../README.md), Why); the pause goes once it is understood how the embedded
browser passes such a service with the agent attached. Not by hiding the agent from bot detection: Kulisa does not get
past it.

## What sites see

Profiles present themselves as what they are: Kulisa on Chromium, Electron's User-Agent without its `Electron/<version>`
(`… kulisa/<version> Chrome/<version> Safari/537.36`; `app.userAgentFallback`, `app.ts`) and Electron's brands
(Chromium, not Google Chrome); `navigator.webdriver` stays false, as no automation port is open. Without Electron's
word: Teams takes a Mac's or Windows' User-Agent with it for its own retired desktop app (built on Electron) and
shows "Classic Teams is no longer available" (`/error/eoa`) instead of its sign-in; Linux's, and a Mac's without it,
get the sign-in.
Not as Google Chrome: Google refuses to sign in a profile that presents as Chrome ("This browser or app may not be
secure") and lets Electron's own Chromium in, with a debugger attached too; GoDaddy's Kasada needs only the sign-in
pause.

## How automation reaches the pages

Only through the CDP proxy (`cdp-proxy.ts`): a fake CDP "browser" endpoint per profile,
`http://127.0.0.1:<port>/<project>/<task>/<profile>` (each part percent-encoded), over each tab's `webContents.debugger`. There is no
`--remote-debugging-port`, so Kulisa's own window is never exposed (the e2e tests alone start it with one, a port of
their own on 127.0.0.1: docs/testing.md, End to end). Clients: the shell's own playwright-core
connection (the MCP tools, the picker, the annotations) and `@playwright/mcp`. The proxy reports Chrome's real target
ids (Playwright needs them) and fans out a tab's events to all clients. Playwright's first command to a page,
`Emulation.setFocusEmulationEnabled`, is a capture to Chromium: the page stays visible, unthrottled and unfrozen
behind the active tab and under another task (issue #52, tabs asleep). A tab opening a URL is shown to clients only
once the site has answered (its page or an error page, `tab.answered`): until then Chromium holds CDP commands to it,
and a site that never answers would make Playwright's connection, and opening the task, hang. It and the MCP server listen on 127.0.0.1
only and refuse requests from web pages (`local-only.ts`). Why the tools are Kulisa's own and not a bridge to
`@playwright/mcp`: it has no profile argument (a server per profile, its 25 tools
each, while profiles come and go and an agent's servers are fixed at its start); the core's rules live in the tools
(the sign-in pause, dialogs, captions and highlights over the pane, the human's tabs); and a tool running the agent's
own Playwright code cannot run in Electron's main process (`vm` is no boundary), while in a process of its own it is
what the agent already does with a script through the proxy.

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

| File | What |
|---|---|
| `src/browser/` | sessions, tabs, navigation, cookies, storage and native views ([README](../src/browser/README.md)) |
| `src/main/profile-store.ts` | the profiles, one store: who each is, its master, its projects, a test user's pair |
| `src/main/local.ts` | what is local: where a test user's pair may be typed, which sites' cookies stay each task's |
| `src/main/master.ts`, `src/renderer/master.html`, `master.tsx`, `components/Master.tsx` | a master's window, to sign in to it |
| `src/main/project-profiles.ts` | a task's profiles: copies of their masters made at their first open, open and closed; create, rename, describe, close, open, let go |
| `src/shared/avatars.ts`, `src/renderer/public/avatars/` | the profiles' pictures (Noto Emoji) |
| `src/main/store.ts` | a task's `profiles.json`, the profiles' folders, their tabs |
| `src/main/signin-pages.ts`, `signin-pause.ts` | sign-in pages; the pause |
| `src/main/cdp-proxy.ts` | the CDP endpoint per profile |
| `src/main/local-only.ts` | refusing web pages' requests to the MCP server, the hooks and the proxy (Host, Origin) |
| `src/kulisa-plugin/` | agent tools, hooks, instructions and action annotations ([README](../src/kulisa-plugin/README.md)) |
| `src/main/discard.ts` | tabs no one looks at losing their process: the rule, the sweep (the Browser Kulisa package) |
| `src/main/artifacts.ts` | what the human and agent keep of the pages in the task's `artifacts/`: numbered files, the oldest gone past 100 MB; listed with their sizes for the Resources panel and `task_artifacts` |
| `src/main/picker.ts` | point and tell |
| `src/renderer/components/grid/ProfilePane.tsx` (the pane, `ProfileHeader`), `lib/profiles.ts`; `components/settings/ProfilePage.tsx` | the panes and the profiles' menu (a task tab's right-click); a profile's page in Settings and its pictures |
| `test/e2e/agent-*.spec.ts`, `profiles.spec.ts`, `discard.spec.ts`, `zoom-and-closing.spec.ts`, `test/unit/store.test.ts`, `unit/discard.test.ts` | the tests |
