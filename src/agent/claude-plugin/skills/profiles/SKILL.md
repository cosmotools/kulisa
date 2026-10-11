---
name: profiles
description: You are running inside Kulisa, a window for building and testing web apps as several users at once. The browser panes above your terminal are Kulisa profiles, separate browser profiles (own cookies, tabs, sign-ins) that the human signed in to by hand. Use this skill whenever you need to open, read, click or type in a web app, check something as one user or several, or when a message holds [kulisa pick: …] (an element the human pointed at). Use it instead of any other browser tool.
---

# Working with Kulisa profiles

A **profile** is one user of the app under test: its own browser profile, shown as a pane above your terminal. The
human sees everything you do there: your cursor and a caption are drawn in the pane.

## Tools (the kulisa MCP server)

| Tool | Use |
|---|---|
| `browser_profiles` | List profiles: id, name, `description` (who it is in the app; `null`: not said), `avatar` (its picture: the human may call a pane "the fox"), `signinMode`, tabs; closed ones as `closed: true` with their number of tabs. Call it first; the human may add profiles at any time. |
| `browser_snapshot` | Accessibility snapshot of a profile's active tab, with `[ref=eN]` for click and type. `also`: more profiles' active tabs in the same call, to compare what each user sees. |
| `browser_click`, `browser_type` | Act by `ref` from the latest snapshot, or by a Playwright `locator` such as `getByRole('button', { name: 'Pay now' })`. `browser_type` replaces the field's text, typing it key by key as a person would (the human sees it). |
| `browser_press_key`, `browser_hover`, `browser_select_option`, `browser_file_upload` | A key (Escape, Tab, Control+A) on an element or the focused one; the pointer over an element (menus, tooltips); options of a `<select>`; files (absolute paths) for a file input or the button that opens a file chooser. |
| `browser_wait_for` | Wait until text or an element appears, or text is gone, in a profile's tab: up to 45 s a call. |
| `browser_evaluate` | Run a JavaScript function in the page (`() => …`, or `(el) => …` with `ref` or `locator`) for what the other tools do not do. |
| `browser_tab_new` | Open a URL in a new tab of a profile; it becomes the active tab. |
| `browser_tab_select`, `browser_tab_close` | Switch to a tab (by id from `browser_profiles`), close a tab. |
| `browser_navigate` | Load a URL in the profile's active tab, replacing what it shows; or `go`: `back`, `forward`, `reload`. |
| `browser_highlight` | Outline elements on a profile's page for the human to see; the labels show over the pane. They go when the human clicks or types there; an empty list clears them. |
| `browser_screenshot` | See the page when the snapshot is not enough (layout, images, colors). |
| `browser_console_messages`, `browser_network_requests` | What a tab logged and requested recently: errors, failed requests (`onlyErrors`, `onlyFailed`). |
| `profile_open` | Open a closed profile (`closed: true` in `browser_profiles`): its pane and tabs come back, still signed in. |
| `profile_close` | Close a profile: its pane and tabs go (memory freed); it stays signed in. |
| `profile_create` | A new, empty profile for a user the task needs and no profile has. |
| `profile_rename` | Rename a profile (its id follows), e.g. after the human signed it in to another account. |
| `profile_describe` | Save who a profile is (its role, what it can do): the human's answer when you had to ask. |
| `profile_ask_signin` | Ask the human to sign a profile in (shown over its pane; `url`: the app's sign-in page, opened first), and wait until they are through. |
| `profile_delete` | Remove a profile from this project (its copies in the project's tasks go). The profile stays, signed in, in Kulisa's Settings → Profiles; the human confirms it in a dialog. |
| `terminal_run` | Run what keeps running (the app's dev server, `docker compose up`, a watcher) in a terminal of its own next to yours, by a name ("dev server"): the human sees it there. The same name again types into it. |
| `terminal_read` | The last lines a terminal shows, as plain text (errors, the address the server listens on); without a name, the terminals open, yours and the human's. |
| `terminal_stop` | Ctrl+C in a terminal (`close: true` closes it). The human's own terminals only when they ask. |
| `browser_type_login` | Type a test user's saved login or password into a field of the local app (never shown to you). |
| `profile_set_login` | Save a test user's pair (after you signed it up), for you and later tasks. |
| `task_rename` | Name your task once you know what it is about: its tab, and its git branch. |

Every browser tool takes `profile`: the id from `browser_profiles`, not the display name. Tools that read or act on
a page take an optional `tab` (default: the profile's active tab).

## How to work

- **Pick the profile by its description**, which says who it is in the app ("seller in the Acme shop"). Never
  guess a role from a name, an email or the sites it has open: a name says which account is signed in, not who that
  is in the tests. When no description fits the task, or several do, ask the human once which profile it is, then
  save their answer with `profile_describe` (their words, not your guess), so nobody has to ask again.
- **Several users at once** is what Kulisa is for: act as one profile, then check the effect as another ("Sam sends
  an invite, Ann sees it"). After the first one acts, wait for the effect in the second with `browser_wait_for`
  (the text it should show); if it does not come, reload it (`browser_navigate` with `go: reload`), as the app may
  not push updates. `browser_snapshot` with `also` shows what several users see in one call.
- **Dialogs** (confirm, alert) that your click, key or navigation opens are dismissed unless you pass
  `dialog: accept`; the result says what the page asked. Accept only what the task means to do (a delete the human
  asked for); dialogs you did not open are the human's, shown in the pane for them to answer.
- **Keep the human's pages.** To open something new, use `browser_tab_new` rather than navigating away from a page
  the human has open (a chat, a form in progress). Navigate the active tab when it is yours or the human asks.
  Close only tabs you opened, unless asked.
- **Snapshot before acting**, and act by `ref` from the latest snapshot. Refs go stale after the page changes. Do
  not guess element names (apps name things their own way: Teams' "new chat" is "New message"); a snapshot is
  fast, a wrong guess is an error and a retry.
- **Show, don't only tell.** When the human asks where something is, or you explain what you found or changed on a
  page, outline it with `browser_highlight` (a label of a few words each) and refer to it in your answer. Clear the
  highlights when they are no longer relevant.
- **Prefer reusing profiles.** Each one is a browser with its own processes and memory. Create one only when the
  task needs a user that no profile is.
- **Closed profiles** are users set aside to save memory; they are still signed in. A new task starts with all of
  them closed. Open one with `profile_open` when the task needs that user, not to look around, and close what you
  opened when you are done with it. Close a profile the human opened only when they ask.

## Tasks

The human may run several agents on one project at once, each in a Kulisa **task**: a git worktree of its own next
to the project's folder (`<project>@task-<n>`) on a branch of its own, with copies of the profiles. You see only your
task's profiles. A project of several repositories gives you a copy of each, all on your branch: you start in the
default one's, the others are added folders (the session start names them). Without git a task works right in the
project's folder.

- **Name the task** with `task_rename` once you know what it is about (it starts as `task-<n>`): its tab and its
  branch take the name (`checkout-redesign`); the folder stays.
- Work and commit on the task's branch. **The project's folder is the human's**: never change it on your own. Asked
  to merge your work into main there, first run `git status` in the project's folder; if the human has uncommitted
  changes there, stop and tell them, rather than merging over their work. Or open a pull request, if asked.
- The worktree has the project's files in git and `.env*`, but no installed dependencies: install them first
  (`npm install`, `pip install`, …) before running anything.
- Run the app under test with `terminal_run`, not in your own shell or its background, on its usual ports plus
  `$KULISA_PORT_OFFSET` (3000 → 3100 with 100), so it does not clash with the other tasks' or the human's own: through
  `PORT`, a `--port` flag, `.env.local`, or the published ports of `docker compose`. The profiles' tabs on local
  addresses already point at those ports, and they stay signed in (cookies do not depend on the port). If the app
  cannot run on other ports, tell the human.

## Signing in: real accounts are the human's; test users of the local app, yours

- Never sign in to a real account (Google, Microsoft, a client's tenant), type its password or a one-time code, or
  read cookies or tokens. The human signs in by hand, once for every task, in the profile's master.
- A **test user of the app under test on this computer** with a saved pair (`testLogin` in `browser_profiles`): sign
  in yourself with `browser_type_login` (`field: "login"`, then `"password"`, `submit: true`). Kulisa types it, only on
  a local page (localhost, `*.test`, a private network, the project's own list) or one the tab reached from it, never
  on an account provider's; you never see the password. After you sign a test user up, save its pair with
  `profile_set_login` so later tasks sign in too. Never put a real account's password there.
- A signed-out profile, or one on a sign-in page: ask the human with `profile_ask_signin` (say as whom and why),
  which waits while they sign in; on "not yet", call it again or do something else meanwhile. Then check with
  `browser_snapshot`.
- `signinMode: true`, or an error saying the profile is in sign-in mode: the human is signing in right now, and
  Kulisa keeps all automation away from that profile until they finish. Do something else, then try again.
- After `profile_create`, the new profile is empty and signed out: a test user of the local app you sign up or sign
  in yourself (above); a real account, ask the human to sign it in (`profile_ask_signin`).
- `browser_evaluate` is not a way around this rule: never read cookies, tokens or passwords with it.
- Remove a profile (`profile_delete`) only when the human asks, or one you created is no longer needed. The
  human confirms it; its copies in this project's tasks go, with what was signed in only there. Only the human
  deletes a profile for good (Settings → Profiles). If they say no, leave it.

## Elements the human points at ([kulisa pick: …])

The human can click Pick on a pane and then an element on its page. A reference to that element is put into
the human's message, and they write around it what they want, e.g.:

```
[kulisa pick: elon-buyer tab k7 getByRole('button', { name: 'Pay now' })] does nothing
```

- After `pick:` come the profile id, the tab and a Playwright locator for the element. Pass the tab as `tab` and the
  locator as `locator` to the browser tools (the human may have switched to another tab since), or use the locator
  to find the element in the app's source code.
- Look at the element on the live page before changing code: `browser_snapshot` of that tab, `browser_screenshot`
  when the look matters, and when something does not work, `browser_console_messages` (errors) and
  `browser_network_requests` (failed requests) of that tab.
- One message can hold several picks, also from different profiles ("sent here, did not appear there").
