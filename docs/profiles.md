# Profiles

How profiles work today: what the human and the agent do with them, what is on the computer, how sign-ins are kept,
how automation reaches the pages, and where the code is. Why it is built this way (tried and measured):
[REPORT.md](REPORT.md); what is next: [ROADMAP.md](ROADMAP.md). Keep this file current when profiles change.

## What a profile is

A **profile** (the word Chrome uses; not "persona", "user" or "account") is one embedded browser identity: its own
cookies, storage, sign-ins and tabs, shown as a pane in the grid. One profile is one user of the app under test
("sam@shop.com", "ann.admin"); several profiles side by side are several users at once. Profiles belong to a
workspace ([workspaces.md](workspaces.md)): main has the human's, a fork has copies of them.

A profile is an Electron session on a folder of its own (`session.fromPath`), laid out as a Chrome profile, plus a
`WebContentsView` per tab. Everything stays inside Kulisa: no external Chrome window.

## What the human does

- **Create** in Profiles ▾ → Manage Profiles… (a name; a color is picked). The new profile is empty and signed out.
  Names of profiles, projects and workspaces take letters (any language), digits and `@ . _ + -`, as an email
  address does, starting with a letter or a digit (not `@` alone, `.x`, `..`, `-x`), at most 64, so a profile can be
  named after its account (`ann+test@shop.com`); no spaces (`names.js`, the author's rule). Name fields leave other
  characters out as they are typed or pasted, and the main process checks again (the agent's `profile_create` too).
  Ids, branches and fork folders keep letters of any language.
- **Sign in by hand** in its pane. Only the human signs in: Kulisa never types passwords or automates a sign-in,
  and never prints or logs cookies or tokens (CLAUDE.md, Rules).
- **Rename**: double-click the pane's name, the editor, or the pane's right-click menu. Only the name and id
  change; the folder (sign-ins), tabs and place stay.
- **Close**: × on the pane (or its menu, or the agent). Its tabs go and free their memory; it stays signed in, and
  Profiles ▾ lists it as closed and opens it again with the same tabs. Closed profiles stay closed across restarts.
- **Delete** in the editor or the pane's menu, after a confirmation: its sign-ins, storage and tabs are gone for
  good.
- **Tabs**: a tab strip and an address bar per pane, drawn as Chrome's (the active tab of a piece with the toolbar;
  back, forward, reload as Chrome's icons; the address without `https://` and `www.` until it is clicked, then all
  of it, selected; a tab opened with + gets the focus in its empty address; many tabs shrink to their icon, the strip
  scrolls, the active tab stays in sight); `target=_blank` and `window.open` open tabs of the same
  profile. Right-click a tab: reload, duplicate, close, close others. DevTools of a tab: the pane's ⋮ menu (where more of a pane's actions will go, as in Chrome) or F12.
- **Zoom**: Ctrl + / − / 0 in a page zooms that site in that profile, on top of the Kulisa zoom (saved per profile,
  shown in the address bar).
- **Pick** (DevTools' inspect icon, at the end of the address bar): click an element on the page; a reference to it goes into the agent's prompt (below). Off on an empty tab (`about:blank`): nothing to point at.

## What the agent does

Through Kulisa's MCP server (`mcp-server.js`), every tool taking a profile id: `browser_profiles`,
`browser_snapshot`, `browser_click`, `browser_type`, `browser_navigate`, `browser_tab_new` / `_select` / `_close`,
`browser_highlight`, `browser_screenshot`, `browser_console_messages`, `browser_network_requests`; the tools reading
or acting on a page take an optional `tab`. Profiles: `profile_create`, `profile_open`, `profile_close`, and
`profile_delete`, which asks the human first. The console and network tools (Playwright's `page.consoleMessages()`,
`pageErrors()`, `requests()`) give errors or failures only when asked. `@playwright/mcp` works too, through the
profile's CDP proxy (below).

**The agent points back**: `browser_highlight` outlines elements on a profile's page (Playwright's
`locator.highlight()`, following the element; it works on Trusted Types pages too) and shows its labels in the pane
header, until the human clicks or types in that tab.

The agent learns how to work with profiles from the Kulisa plugin (CLAUDE.md, Architecture). For Claude Code it is
`src/agent/claude-plugin/`, started with `claude --plugin-dir`: the MCP config, the profiles skill
(`skills/profiles/SKILL.md`; keep it in step with the tools) and hooks, among them `SessionStart`, which tells the
agent which profiles are open and tells Kulisa its session (to resume it). The user's own MCP servers stay available
(no `--strict-mcp-config`). Codex gets the MCP server and the hooks as config overrides (its `SessionStart` brings the open profiles), not the
skill yet (ROADMAP).

The human sees what the agent does (`ghost.js`): Playwright's action annotations in the page (a mark at the action
point, the element outlined) and a caption over the pane for every command through the proxy.

**Point and tell** (`picker.js`): Pick, then a click on an element (Playwright's `page.pickLocator()`; Esc or Pick
again cancels). `[kulisa pick: <profile> tab <tab> <locator>]` is typed into the agent's prompt without Enter, and
the terminal gets the focus: the human writes the rest of the message around it. Nothing is saved; the agent looks
at the element on the live page with its tools.

## Actions: the human's and the agent's

Both act on one core (CLAUDE.md, Architecture): the window and the MCP tools find profiles and tabs with
`Workspace.find` / `findTab` (the same refusals: no such profile, a closed one, no such tab) and call the same
methods. A row with one side empty says why, or is a gap to fill.

| Action | The human | The agent | The core |
|---|---|---|---|
| Create a profile | Manage Profiles… | `profile_create` | `Workspace.createProfile` |
| Rename a profile | double-click, editor, pane menu | not yet | `Workspace.renameProfile` |
| Close, open a profile | ×, Profiles ▾, editor | `profile_close`, `profile_open` | `Workspace.closeProfile`, `openProfile` |
| Delete a profile | editor, pane menu | `profile_delete` | `Workspace.deleteProfile(id, by)`: asks the human either way |
| Open a tab | +, Duplicate, New tab | `browser_tab_new` | `Profile.newTab` (the address read by `toUrl`) |
| Switch, close a tab | a click, ×, Close others | `browser_tab_select`, `browser_tab_close` | `Profile.activate`, `closeTab` |
| Go to an address | the address bar | `browser_navigate` (Playwright, so it is shown) | `toUrl`; `Profile.navigate` |
| Back, forward, reload | the toolbar, tab menu | not yet | `Profile.back`, `forward`, `reload` |
| Zoom a site | Ctrl + / − / 0 | none: how the human sees the page | `Profile.zoomSite` |
| DevTools | ⋮, F12 | none: the agent has console and network tools | `Profile.toggleDevTools` |
| Point at an element | Pick (into the agent's prompt) | `browser_highlight` (outlined for the human) | `picker.js`; the MCP server |
| Read a page | looks at it | `browser_snapshot`, `browser_screenshot`, console, network | Playwright |
| Act in a page | mouse, keyboard | `browser_click`, `browser_type` | the page itself; Playwright over the proxy |
| Sign in | by hand | never (Rules) | the sign-in pause |

## Sign-ins that last

- **Persistent cookies and storage** are Chromium's own, in the profile's folder.
- **Session cookies** (no expiry; Entra's ESTSAUTH, federated sign-ins) die with the process in Electron. Kulisa
  saves them encrypted with the OS keyring (`safeStorage`) in the profile's folder, on quit, before a profile
  closes, and every 30 s, and puts them back before its first tab loads (`session-cookies.js`). Never written in
  the clear: without a keyring they are not saved.
- **Tabs on sign-in pages** are saved as where the sign-in started (sign-in URLs are one-time): the last other page
  in the tab's history, else the origin of the return address in the URL, else not at all (`signin-pages.js`).

## Sign-in pause

While any tab of a profile is on a sign-in page (or navigating to one), nothing automated is attached to the
profile: Playwright disconnects, every tab's debugger is detached, the proxy refuses clients, the MCP tools answer
that the human is signing in. When no tab is on one, the shell's connection comes back. Sign-in pages are known by
host (`signin-pages.js`: Microsoft, Google, GoDaddy, Okta, OneLogin, Auth0, Duo, PingOne, Salesforce; more with
`KULISA_SIGNIN_HOSTS`). Some sign-ins (GoDaddy SSO behind Kasada) pass only so. `signin-pause.js` is a deliberately
temporary implementation; the author will replace it (CLAUDE.md, Rules).

## Presenting as Google Chrome

Profiles present themselves as Google Chrome of the same engine version (the author's decision; `mimic-chrome.js`):
the User-Agent, the `Sec-CH-UA*` headers (Electron sends none on navigations; added, high-entropy ones only after
`Accept-CH`) and `navigator.userAgentData`, through Chromium's own override, so headers and JavaScript agree. The
machine part (OS, version, CPU) is what Chromium reports itself. A new tab goes `about:blank` → override → its URL, so
the first request already carries it. `navigator.webdriver` stays false. `KULISA_MIMIC=0` turns it off.

## How automation reaches the pages

Only through the CDP proxy (`cdp-proxy.js`): a fake CDP "browser" endpoint per profile,
`http://127.0.0.1:<port>/<project>/<workspace>/<profile>` (each part percent-encoded), over each tab's `webContents.debugger`. There is no
`--remote-debugging-port`, so Kulisa's own window is never exposed. Clients: the shell's own playwright-core
connection (the MCP tools, the picker, the annotations) and `@playwright/mcp`. The proxy reports Chrome's real target
ids (Playwright needs them) and fans out a tab's events to all clients. A tab opening a URL is shown to clients only
once the site has answered (its page or an error page, `tab.answered`): until then Chromium holds CDP commands to it,
and a site that never answers made Playwright's connection, and opening the project, hang. It and the MCP server listen on 127.0.0.1
only and refuse requests from web pages (`local-only.js`).

## What is on the computer

In the workspace's data folder ([workspaces.md](workspaces.md), "What is on the computer"):

```
projects/<project id>/<workspace>/
  profiles.json                 the profiles in order: { folder, id, name, color, zoom (per site), closed }
  Profile 1/                    a Chromium profile: Cookies, Local Storage, IndexedDB, Cache …
    Kulisa Tabs.json            the URLs of its tabs, to open them again
    Kulisa Session Cookies.bin  its session cookies, encrypted
  Profile 2/ …
```

The folder is named as Chrome names its profiles, fixed at creation; a new profile never takes the number of a folder
still on disk. A deleted profile's data is wiped at once; its folder is removed at the next start
(`deleted-folders.json`), because the session keeps its files open while Kulisa runs. Copying a profile (a fork)
leaves the caches out (Cache, Code Cache, GPUCache, Dawn*).

Memory: each tab is a Chromium process; 5 profiles × 3 tabs ≈ 4 GB (REPORT, E8). Closing a profile frees its tabs.

## The code

| File | What |
|---|---|
| `src/main/profiles.js` | a profile: its session, tabs (WebContentsView), the shell's Playwright connection, sign-in mode, zoom |
| `src/main/project-profiles.js` | a workspace's profiles in order, open and closed: create, rename, close, open, delete |
| `src/main/store.js` | `profiles.json`, the profile folders, their tabs |
| `src/main/session-cookies.js` | session cookies across restarts |
| `src/main/signin-pages.js`, `signin-pause.js` | sign-in pages; the pause |
| `src/main/mimic-chrome.js` | presenting as Google Chrome |
| `src/main/cdp-proxy.js` | the CDP endpoint per profile |
| `src/main/mcp-server.js`, `ghost.js`, `picker.js` | the agent's tools, its actions shown, point and tell |
| `src/renderer/renderer.js`, `profile-editor.js` | the panes, Profiles ▾ and the editor |
| `test/agent.js`, `profiles.js`, `zoom-and-closing.js`, `restart.js` | the tests |
