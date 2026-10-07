---
name: profiles
description: You are running inside Kulisa, a window for testing web apps as several users at once. The browser panes above your terminal are Kulisa profiles, separate browser profiles (own cookies, tabs, sign-ins) that the human signed in to by hand. Use this skill whenever you need to open, read, click or type in a web app, check something as one user or several, or when a message holds [kulisa pick: …] (an element the human pointed at).
---

# Working with Kulisa profiles

A **profile** is one user of the app under test: its own browser profile, shown as a pane above your terminal. The
human sees everything you do there: your cursor and a caption are drawn in the pane.

## Tools (the kulisa MCP server)

| Tool | Use |
|---|---|
| `browser_profiles` | List profiles: id, name, `signinMode`, tabs; closed ones as `closed: true` with their number of tabs. Call it first; the human may add profiles at any time. |
| `browser_snapshot` | Accessibility snapshot of a profile's active tab, with `[ref=eN]` for click and type. |
| `browser_click`, `browser_type` | Act by `ref` from the latest snapshot, or by a Playwright `locator` such as `getByRole('button', { name: 'Pay now' })`. |
| `browser_tab_new` | Open a URL in a new tab of a profile; it becomes the active tab. |
| `browser_tab_select`, `browser_tab_close` | Switch to a tab (by id from `browser_profiles`), close a tab. |
| `browser_navigate` | Load a URL in the profile's active tab, replacing what it shows. |
| `browser_highlight` | Outline elements on a profile's page for the human to see; the labels show over the pane. They go when the human clicks or types there; an empty list clears them. |
| `browser_screenshot` | See the page when the snapshot is not enough (layout, images, colors). |
| `browser_console_messages`, `browser_network_requests` | What a tab logged and requested recently: errors, failed requests (`onlyErrors`, `onlyFailed`). |
| `profile_open` | Open a closed profile (`closed: true` in `browser_profiles`): its pane and tabs come back, still signed in. |
| `profile_close` | Close a profile: its pane and tabs go (memory freed); it stays signed in. |
| `profile_create` | A new, empty profile for a user the task needs and no profile has. |
| `profile_delete` | Delete a profile for good (sign-ins, storage, tabs). The human confirms it in a dialog. |

Every browser tool takes `profile`: the id from `browser_profiles`, not the display name. Tools that read or act on
a page take an optional `tab` (default: the profile's active tab).

## How to work

- **Pick the profile by who the task is about.** Names say who a profile is, often the account it signs in to ("sam@shop.com", "ann.admin"). If it
  is unclear which user to act as, ask.
- **Several users at once** is what Kulisa is for: act as one profile, then check the effect as another ("Sam sends
  an invite, Ann sees it"). Re-read the second profile with `browser_snapshot` after the first one acts; reload if
  the app does not push updates.
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
- **Closed profiles** are users set aside to save memory; they are still signed in. Open one with `profile_open`
  when the task needs that user, not to look around, and close what you opened when you are done with it. Close a
  profile the human opened only when they ask.

## Workspaces

The human may run several agents on one project at once, each in a Kulisa **workspace**: main is the project's own
folder; a fork is a git worktree next to it (`<project>@<name>`) on a branch of its own, with copies of main's
profiles. You see only your workspace's profiles. In a fork (the session start says so):

- Work and commit on the fork's branch; the human merges it into main (or asks you to open a pull request).
- The worktree has the project's files in git and `.env*`, but no installed dependencies: install them first
  (`npm install`, `pip install`, …) before running anything.
- Run the app under test on its usual ports plus `$KULISA_PORT_OFFSET` (3000 → 3100 with 100), so it does not clash
  with main's: through `PORT`, a `--port` flag, `.env.local`, or the published ports of `docker compose`. The
  profiles' tabs on local addresses already point at those ports, and they stay signed in (cookies do not depend on
  the port). If the app cannot run on other ports, tell the human.

## Signing in: never you

- Never sign in, type passwords or one-time codes, or read cookies or tokens. The human signs in by hand.
- A signed-out profile, or one on a sign-in page: tell the human which profile needs signing in, and wait.
- `signinMode: true`, or an error saying the profile is in sign-in mode: the human is signing in right now, and
  Kulisa keeps all automation away from that profile until they finish. Do something else, then try again.
- After `profile_create`, the new profile is empty and signed out: ask the human to sign it in in its pane.
- Delete a profile (`profile_delete`) only when the human asks, or one you created is no longer needed. The
  human confirms each deletion; a deleted profile's sign-ins are gone and only the human can sign in again. If they
  say no, leave it.

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
