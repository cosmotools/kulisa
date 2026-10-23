---
name: kulisa-profiles
description: You are running inside Kulisa, a window for building and testing web apps as several users at once. This skill is how you work through Kulisa. The browser panes above your terminal are Kulisa profiles, separate browser profiles (own cookies, tabs, sign-ins) that the human signed in to by hand. Use it whenever you open, read, click or type in a web app, check something as one user or several, or a message holds [kulisa pick: …] (an element the human pointed at); and whenever you set up or run the task (its git worktree, repositories, the app's dev server) or read what was done in it before. Use its browser tools instead of any other browser tool.
---

# Working with Kulisa profiles

A **profile** is one user of the app under test: its own browser profile, shown as a pane above your terminal. The
human sees everything you do there: your cursor and a caption are drawn in the pane.

## Tools

The tools are the kulisa MCP server's; its listing gives each one's description and inputs (`profile_*` for profiles,
`browser_*` for their pages, `terminal_*` for terminals next to yours, `task_*` and `conversation_rename` for the
task). This skill is how they fit together; what each one does is in its own description. Every browser tool takes
`profile` — a profile's name, as `profile_list` gives it (unique within the project, in any case) — and an optional
`tab` (default: the profile's active tab).

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
  fast, a wrong guess is an error and a retry. On a large page take only what you need (`find`, an element, a
  `depth`); a snapshot too large for an answer is written to a file, and the answer says where: read the part you
  need there.
- **When an action's answer counts errors** ("Since: 2 console errors, 1 failed request"), look before going on:
  `browser_console_messages` and `browser_network_requests` with `since: action`, and what the server answered with
  `browser_network_request`.
- **Show, don't only tell.** When the human asks where something is, or you explain what you found or changed on a
  page, outline it with `browser_highlight` (a label of a few words each) and refer to it in your answer. Clear the
  highlights when they are no longer relevant.
- **Prefer reusing profiles.** Each one is a browser with its own processes and memory. Create one only when the
  task needs a user that no profile is.
- **Closed profiles** are users set aside to save memory; they are still signed in. A new task starts with all of
  them closed. Open one with `profile_open` when the task needs that user, not to look around, and close what you
  opened when you are done with it. Close a profile the human opened only when they ask.

## Tasks

The human may run several agents on one project at once, each in a Kulisa **task**. A task opens in the project's
**main working tree** — the human's own folder, on whatever branch they checked out — with copies of the profiles; its
tab reads "New Task" until it is named. You see only your task's profiles.

- **Make the task its own worktree before you write code.** The project's folder is the human's: never change it on
  your own. When you start to write code, make the task a git worktree and branch of its own with `task_worktree`
  (idempotent: the first agent of the task creates it, the rest of its agents get the same one), and work and commit
  there — unless the human asked you to work right in their folder ("don't make a branch"). If the task is still "New
  Task", pass its name to `task_worktree` to name it at the same time; the branch takes a slug of the name. Without git,
  or when the human wants it that way, the task works right in the project's folder and `task_worktree` does nothing.
- **Name the task** with `task_rename` once you know what it is about (it starts as "New Task"): its tab shows the name
  and its branch takes a slug of it (`Fix header` → `fix-header`). A short readable label. Silently: never ask the
  human for a name or mention naming it, and do not let naming hold up the work. Naming and making the worktree are
  separate — name the task any time, make the worktree when you reach code.
- **Name your conversation** with `conversation_rename` once you know what it is about.
- **Other agents' work**: the human may open several agents in a task, each in a tab of its own. When they ask you to
  go on with another's work ("go on with what Claude did"), or your context lost details you need, find that
  conversation in `task_history` and read every part of it before anything else.
- **Another of the project's repositories**: read it freely in the project's folder, changing nothing there. When the
  task needs changes in it, ask the human first, saying why; once they agree, `task_add_repository` adds a copy on the
  task's branch, where you make them. A copy the task no longer needs (added by mistake, or not needed after all) goes
  the same way: ask, then `task_remove_repository`; its folder and branch are deleted.
- Asked to merge your work into main in the project's folder, first run `git status` there; if the human has
  uncommitted changes, stop and tell them rather than merging over their work. Or open a pull request, if asked.
- A fresh worktree has the project's files in git and `.env*`, but no installed dependencies: install them first
  (`npm install`, `pip install`, …) before running anything.
- Run the app under test with `terminal_run`, not in your own shell or its background, on a **free port you pick**
  (Kulisa assigns none; another task or the human may hold the usual one): through `PORT`, a `--port` flag,
  `.env.local`, or the published ports of `docker compose`. Point the profiles' tabs at it with `browser_navigate`;
  they stay signed in (cookies do not depend on the port).
- What Kulisa tells you (at the session's start, in a tool's result) is for you: act on it without recounting it to
  the human.

## Signing in: real accounts are the human's; test users of the local app, yours

- Never sign in to a real account (Google, Microsoft, a client's tenant), type its password or a one-time code, or
  read cookies or tokens. The human signs in by hand, once for every task, in the profile's master.
- A **test user of the app under test on this computer** with a saved pair (`testLogin` in `profile_list`): sign
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
[kulisa pick: elon@shop.com tab k7 getByRole('button', { name: 'Pay now' })] does nothing
```

- After `pick:` come the profile's name, the tab and a Playwright locator for the element. Pass the tab as `tab` and the
  locator as `locator` to the browser tools (the human may have switched to another tab since), or use the locator
  to find the element in the app's source code.
- Look at the element on the live page before changing code: `browser_snapshot` of that tab, `browser_screenshot`
  when the look matters, and when something does not work, `browser_console_messages` (`level: error`) and
  `browser_network_requests` (`onlyFailed`) of that tab.
- One message can hold several picks, also from different profiles ("sent here, did not appear there").
