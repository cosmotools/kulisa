# Kulisa

Desktop app (Electron) where the AI agent the human chooses develops and tests web and command-line apps while the
human watches or takes a break. The coding agent (Claude Code, Codex: the unchanged CLI) works in a development
terminal and drives built-in **environments** through Kulisa's MCP server: signed-in browser profiles for web apps,
Stage terminals for CLIs and TUIs. Each **profile** is an embedded browser identity (own cookies, storage, tabs)
shown as a pane; the human signs in by hand. Environments appear in the **stage**, a nested grid distinct from the
agent's development panels. Tasks run several agents on one project at once. Point-and-tell (Pick, then click an
element) puts a reference with a Playwright locator into the agent's prompt; the human writes the rest around it.

- **Ideas and bugs go to GitHub issues** (`enhancement`, `bug`; GitHub's API below), not into the repository. Before
  building something, look for its issue: it may have been put off, with the reason. Once built, close it.
- `docs/profiles.md`, `docs/tasks.md`, `docs/window.md`: how profiles, projects with their tasks, and the
  window work now: what the human and the agent do, what Kulisa creates on the computer and removes, why it is built
  so, the code. Read the one for the part you change; keep it current.
- `docs/releases.md`: how Kulisa is packaged, released and updated on the user's computer: the app icon, the
  installers, the release workflow, the updates.
- `docs/transcripts.md`: the task's history for its agent (`task_history`) and how each agent CLI's transcript is
  read for it, field by field. Check it when an agent CLI is updated: the formats are undocumented.
- `docs/packages.md`: Kulisa packages, parts of Kulisa in folders of their own (`src/terminal/`): what makes code
  one, how one is laid out and checked, and moving code into one step by step. Read it before making one or moving
  code into one; a package's own `README.md` and `AGENTS.md` are its docs.
- `docs/ui.md`: what the window's UI is built of: tokens, icons, components (buttons, rows, dialogs, menus). Look
  there before making a button, an icon, a row, a dialog, a control or a part of several files (a cluster); keep it current.
- `docs/guide.md`: the user guide, for everyone who uses Kulisa, not only developers: what they do and see, in their
  words (no file, function or protocol names). kulisa.app builds its documentation page from it (`kulisa-site`), so
  pictures only from `docs/images/` by a relative path, and no links to the other docs. Keep it current: a change to
  what the human does or sees changes it too, in the same commit.
- `README.md`: how to run, environment variables, the top-level folders. Not a list of files: those are in each
  part's doc ("The code"; `docs/ui.md` at its top), kept with what they do (a map of every
  file goes out of date, and does not scale).
- `docs/testing.md`: what gets a test, when to run which, how the tests are built and written. Read it before
  writing or running a test.
- `docs/LICENSING.md`: Kulisa is GPL-3.0-or-later, the author's; what the license covers and what it does not.

## Working with the author

- **A peer developer, not an assistant who pleases.** Where the author is wrong, or a request has a cost (more RAM,
  against a rule here), say so before building it, with the reason, and propose a way with a
  recommendation ("I would do X, because …"), not a list of options. Then do what the author decides: it is their
  product, the last word is theirs, and a settled question is not raised again. The exception is a rule of this file
  or one the author states: it is a decision, not proof it is right. Where one goes against a design or coding
  standard or plain sense (a second source of truth, a leaky boundary, needless duplication), say so, why, and what
  the standard holds instead, rather than follow it silently; the author decides on the merits, having heard the case.
  Take part in the design: point out what the author did not ask about but should know.
- **Do it right, never a compromise.** Build the correct shape, not one bent around code that is already there:
  existing code is no reason to keep a wrong shape. Where a change meets code that is wrong (a leaky boundary, a
  shortcut, a workaround without a reason), be intolerant of it: name it in the plan, and fix it as part of the
  change, not around it.
- **The time to rewrite is not an argument** (with AI a rewrite costs nothing). When
  weighing a tool or a library, or replacing one with another, the better one is chosen on its merits (what it does,
  RAM, how well it is maintained, its license, how it fits); the time a move takes, the agent's to write it and the
  author's to check it by hand, is not weighed against it: the result matters, not the time. What a move may lose
  (the workarounds in Hard-won facts and the docs, behavior no test covers) is not a reason against it either, but
  a part of the plan: named, and kept with tests first. Not about when a feature is built: what is put off for its
  turn ("later") stays put off.
- **What a change cost, at its commit.** When code becomes part of the project (a feature, a fix; not experiments),
  say in one line how many lines were added and removed, apart for code, tests and docs (not `package-lock.json` or
  pictures): `code +203 −95 · tests +52 −13 · docs +23 −8`. When it is more than the task should take, say why in a
  sentence: a signal to talk it over.

## Conventions

- Everything in the repository is written in English: code, comments, documentation, commit messages.
- **Comments say why, not what** (comments that retell the UI go out of date). A comment holds what the code cannot say: why it is so, a workaround and what it works around, a pointer
  to a doc. It does not retell what a part shows, what its buttons are or what things are called: that is
  the docs' (`docs/`) and the code's own; a file's header is a line saying what it is, and the doc to read. Types are
  TypeScript's, not a comment's. When a term or a part is renamed, look for the old word in the code's comments too,
  not only in the docs.
- **Docs without redundancy**: each rule once, its reason in a clause; no connecting prose, no retelling of the code,
  a tool's docs or another doc. A sentence whose removal would not change what an agent does goes. A doc section the
  change edits is tightened in the same change; a whole doc's rewrite is a commit of its own. Not `docs/guide.md`
  (the users').
- **Docs and comments say how it is, not how it came to be.** They describe the last state
  only; how it was before and what replaced what is git's: the commit message, the pull request's text. No "was",
  "until", "no longer", "replaced", nor a negation that only makes sense against the old shape ("lists no projects").
  The reason is said as a property of what is there now ("one place to read and change it"), not as its story. No
  dates and no "the author" beside a reason: the reason shows the decision is meant; only a choice of taste with no
  reason to give is marked "(the author's choice)": not argued again on the merits as it stands, yet not frozen — a
  taste decision goes stale too (a better option appears, the context shifts), and then it is raised again, as any
  convention here (Working with the author, "A peer developer"). What they keep of a
  failure is the constraint today's code keeps to, next to that code; a story of an attempt is git's: it goes stale unseen, and the next session believes it. Nor where
  or when something was seen, nor the versions it was checked with: they go stale at once, and the tests hold what
  must stay true (a version Kulisa requires, `>=`, is a constraint, not a record). The one
  exception, the terms here: the word earlier commits used, so that they can be read.
- **Terminology: "environment"** for where the application under development runs and the human and agent interact
  with it: browser profiles and Stage terminals. Not an agent's MCP tool, nor a promise of machine or credential
  isolation. **Stage** is the working name for their nested testing grid; development terminals and Resources stay
  in a separate development grid. Their behavior and lifecycle: `docs/window.md`, The grid.
- **Terminology: "Resources panel"** for the whole panel beside the development terminal. **Resources bar** is its
  vertical icon bar on the left; **Resources content** is the area on the right, which can close while the bar stays
  visible. **Agents**, **Project**, **Changes** and **Artifacts** are its sections; **Project Explorer** is the folder and file tree inside
  Project. Behavior: `docs/tasks.md`, The Resources panel.
- **Terminology: "profile"**, the word Chrome uses, for one embedded browser identity (cookies, storage, tabs) and
  its pane. Not "persona", "user" or "account" (an account is what a profile signs in to). Early commits and
  experiments said "persona".
- **Terminology: "Kulisa plugin"** for the layer between the agent and the profiles (Architecture, layer 3). Earlier
  commits say "agent bridge".
- **Terminology: "plugin"**: always an agent's (Claude Code's, Codex's), the Kulisa plugin being one.
- **Terminology: "Kulisa package"** (after "Kulisa plugin": an npm package's idea in Kulisa's
  own context) for a part of Kulisa that does one thing and knows nothing of the core (other Kulisa packages only by
  their entries), all of it in one folder `src/<package>/`, reached only through its entries: the terminal first (`docs/packages.md`). Always the two words: a bare "package" is an npm
  package (a dependency) or the app's package (Forge's build, the installers). Not a cluster (a folder of the
  window's components, `docs/ui.md`).
- **Terminology: "tab"**: an open task in a window's tasks' bar, as a browser's tab (`docs/tasks.md`). A project is
  no thing to open (it is what its tasks are made of); not "open project" or "Close Project". In code a project is
  loaded (`Project` in `shell.open`) while a task of it is open in any window. Earlier commits say **group** (Close
  Group).
- **Terminology: "the tasks' bar"**: the bar of the tasks' tabs, under the grid or in the title bar after the logo,
  as a browser's tabs (☰ → Tasks bar; `TaskBar.tsx`, `#taskbar`). Not "taskbar", the OS's. Earlier commits say "the
  projects' bar" (`ProjectBar.vue`).
- **Terminology: "Settings"**: what the title bar's gear shows over the whole window, as JetBrains' Settings (its categories
  and pages: `docs/window.md`); in code `components/settings/`. Earlier commits say "the projects' manager". New Project is steps
  (`NewProject.tsx`): the welcome's, and a dialog of a tasks' window.
- **Terminology: "the empty window"**: what a window is with no task open (`Empty.tsx`; `docs/window.md`): the title
  bar, no tasks' bar, and in the grid's place the sidebar docked (every project with its tasks) or, with no project at
  all, the welcome.
- **Terminology: "the welcome"**: the first start's (`Welcome.tsx`; `docs/window.md`). Earlier commits say "Welcome
  screen" (JetBrains' name) for a list of projects, not this.
- **Terminology: "task"** for one line of work inside a project: its agents, a branch of the code, profiles and a
  grid, each in a git worktree of its own next to the project (`myshop@task-2`). Earlier commits say "workspace" (the
  word of tools for parallel agents, e.g. Conductor). How they work and why: `docs/tasks.md`; what is left: issues.
- **Not tied to one agent or LLM vendor.** The user chooses the agent CLI (Claude Code, Codex, others); Kulisa must
  not require Claude Code or any one model provider, and never assumes `claude` is installed. When planning a
  feature, design it for any agent CLI:
  - The core of a feature works through what every agent has: a terminal, the MCP server, files, git. Kulisa's
    own data and conventions (e.g. its own folders), not one agent's (`.claude/…`).
  - What only some agents can do (Claude Code's `--resume`, `--fork-session`, plugin, hooks) is an optional extra
    per agent, kept in one place per agent, and the feature still works without it.
  - Claude Code is the default and the best supported today; that is fine as long as the others are not locked out.
- **Keep the amount of own code minimal, so the project stays under control.** Prefer maintained open-source
  libraries to writing our own.
  - Before writing browser or CDP code, check whether playwright-core already does it: picker
    (`page.pickLocator`), snapshots (`ariaSnapshot`), action annotations (`page.screencast.showActions`),
    highlights (`locator.highlight`), recent console messages and requests (`page.consoleMessages`, `requests`).
    Check `@playwright/mcp` and the MCP SDK the same way. Read the API of the installed version, not what you
    remember: its newest APIs are younger than your training. Its documentation is in
    `node_modules/playwright-core/types/types.d.ts`.
  - Before building anything that touches Electron, look it up in Electron's documentation for the installed version
    instead of building from memory (Electron ships every 8 weeks; knowledge from training is older). The guides,
    their index and what changed between versions are in the repository's docs at the version's tag
    (`https://raw.githubusercontent.com/electron/electron/v<version>/docs/`: `README.md`, `tutorial/…`, `api/…`,
    `breaking-changes.md`); the API is in `node_modules/electron/electron.d.ts`.
  - Before using a shadcn/ui component in the window, read its page (`https://ui.shadcn.com/docs/components/radix/<name>`:
    what it is for, its examples as code) and its file in `src/ui/`, and build as its examples do, not from memory. `src/ui/`
    is never edited (`npm run ui`); what is passed to a component: `docs/ui.md`.
  - Hand-written protocol code is the exception: today only `cdp-proxy.ts`, because nothing existing exposes
    `webContents.debugger` over CDP.
  - When adding a dependency, prefer one that is widely used and maintained, and say why in the commit message. Its
    license must allow being part of a GPL-3.0 program (MIT, ISC, BSD, Apache-2.0 do; `docs/LICENSING.md`).
- **RAM matters.** Kulisa is Electron plus a Chromium process per tab, for several profiles at once, next to the
  user's own browser and IDE. When choosing how to build something, weigh how much memory it keeps and prefer the
  cheaper way. If a feature would noticeably raise RAM use (a process per tab or profile, keeping hidden things
  alive, large buffers), discuss it with the author before building it. Measure rather than guess: `ps -eo pid,rss,args`
  on a running Kulisa shows each tab's process.
- **Nothing piles up on the user's computer.** Everything Kulisa writes has an owner and an end:
  - It goes when its owner goes (a profile, a task, a project: their data, the copies, git's and the agent's
    records of a task's copy), at once or at the next start when a file is still open (`deleted-folders.json`).
  - It is rewritten rather than added to: no files per event, no logs that grow; or it has a limit.
  - Temporary files are removed when done, also after an error; pictures and the like stay in memory.
  - A new kind of file or folder is listed in "What is on the computer" (`docs/tasks.md`, `profiles.md`) with
    when it goes, and its removal is tested.
- **Every action of the core is logged** (`src/main/log.ts`; docs/window.md, The log): a window's
  channel (`handle()`, `on()`), an agent's tool (`registerTool`), a key, a hook, a task or a window made or closed, a
  terminal started: through those, by itself. A line elsewhere (`log.info('[part] what')`) says what happened and who
  asked, never what was typed or a secret (`summary`). The log is where a user's bug is read (by the user too: Settings →
  Log, with the ways to send it): when a new kind of thing can happen, make sure it leaves a line.
- **Kulisa runs on macOS, Windows and Linux.** Write code for all three: no shell commands, Unix-only paths or
  signals, or Linux-only flags without a branch for the others. Keep platform branches few and in one place per
  concern (e.g. the shell fallback in `src/terminal/main/`). What is untested on a platform goes into an issue.
- The repo is public on GitHub (`origin`, github.com/cosmotools/kulisa). Never print the remote URL (`git remote -v`):
  it carries the author's token.
- **Each piece of work in a worktree of its own** (several agent sessions work on Kulisa
  at once, and one switching or editing a shared folder pulls the files out from under the others):
  - Before the first change: `git worktree add .worktrees/<name> -b <name> develop` (from the local
    `develop`, or the branch the author names; use the explicit base rather than an agent tool's default), and work
    there. `develop` is where work goes; `main` is what is released (Releases, below).
  - **The repository's own folder holds `develop`, always** (a session started there reads
    AGENTS.md and the docs of whatever branch the folder is on). Nothing is
    edited, committed or merged there, and it is never switched to another branch: it only follows GitHub's
    `develop` once a pull request is merged (`git -C <repo> pull --ff-only origin develop`).
  - `node_modules` is a link to the repository's (`ln -s ../../node_modules node_modules`) while the work does
    not change the dependencies; work that does gets its own (`npm install`, then `npm run postinstall`).
  - Commits go to the worktree's branch; no worktree has `develop` checked out. **Into `develop` only by a pull
    request, merged by the author**: when the author asks for the commit, push the branch (`git push -u origin
    <name>`) and open its pull request into `develop` (GitHub's API, below), its body what the change does, its cost
    line (Working with the author) and a line on `src/ui`: what it adds or updates and why (`npm run ui -- progress`:
    the agent's progress bar), or that it is unchanged, so the author decides on it without reading its diff. Its
    required checks are `main`'s but `version` (Releases): tell the author when they are green. Never merge into `develop` or `main` here, nor push them.
  - The author's Kulisa runs one checkout at a time: the `run-kulisa` skill, from the worktree
    while its work is shown, from the repository's folder (`develop`) once it is merged.
  - Once its pull request is merged (or the author drops it), the repository's folder follows `develop` (above),
    and the worktree goes (`git worktree remove`), its branch here (`git branch -D`: merged by GitHub's merge commit,
    git here may not know it) and on GitHub (the API, below).
- **Sessions on different OSes share a pull request**. A session fixes what it can reproduce
  and test on its own OS, shared code too: what decides is where the bug can be checked, not which OS the code is for.
  What only another OS shows, or what it cannot check there, it does not fix blind: it writes it in a comment on the
  pull request, for the session on that OS, which fixes it on its side. The pull request is where they talk. Each
  comment starts with the agent and OS (e.g. "Codex (the Linux session), not the author"): the comments go up under
  the author's account. Before pushing to a branch another session works on, take its new commits (`git pull --rebase`).
  A session learns of new comments only when the author tells it to read them (`GET …/issues/<n>/comments`).
- **GitHub's API, not `gh`** (not installed; the author's choice): `curl` to `https://api.github.com`
  with the token of the remote's URL, read into a shell variable and never printed:
  `T=$(git config --get remote.origin.url | sed -E 's#^https://[^:@/]*:?([^@/]*)@.*#\1#')`, then
  `curl -sf -H "Authorization: Bearer $T" …`. A job's log (`GET …/actions/jobs/<id>/logs`) answers with a redirect to
  a signed address, fetched without the token.

## Releases

`main` is what users get; `develop` is where work goes. A merge into `main` is a release.

- **`main` is protected on GitHub** (a ruleset, no one bypassing it): no push, no force push; only a pull request
  from `develop`, merged with a merge commit (not squash or rebase: `develop` would part from `main`), by the author,
  once its required checks pass: `test (ubuntu-latest)`, `test (macos-latest)`, `test (windows-latest)`, `dependencies` and `version`
  (`.github/workflows/test.yml`). Never push to `main`, merge into it, or merge `main` back into `develop`.
  Supporting an OS makes its tests required, on `develop` and `main`; the author adds it to the rulesets, the session
  says when it is time.
- **The version** in `package.json` is the truth; the app shows it (☰) and the updater compares it. Each pull
  request into `main` raises it (the `version` check refuses one that does not, unless no release of that number
  exists yet). `npm version <patch|minor> --no-git-tag-version`: no tag by hand,
  the CI makes it. While 0.x: `patch` by default, `minor` when the author says so or for a large change (say which).
- **A merge into `main` is published by itself** (`.github/workflows/release.yml`; docs/releases.md, Publishing a
  release). A failed build or start leaves the draft unpublished: fixed by the next release, its
  version raised again; the failed draft deleted (`DELETE …/releases/<id>`).
- **When the author says to release** (that is the ask to open the two pull requests, nothing more):
  1. In a worktree from `develop`: raise the version, commit (`Kulisa <version>`), and open its pull request into
     `develop` as any work's; the author merges it.
  2. Open the pull request `develop` → `main` (GitHub's API, above): title `Kulisa <version>`, its body what is new
     for the user since the last release (from `git log origin/main..origin/develop`, in the guide's words: it becomes
     the release's notes).
  3. Watch its checks; a red one is fixed by a pull request into `develop` (merged, it updates this one). Tell the
     author when it is green: the merge is theirs.
  4. After the merge, watch the release's run; tell the author when it is published, or what failed.

## Commands

- **Diff renderer skill**: Pierre's [official diffs skill](https://github.com/pierrecomputer/pierre/tree/main/skills/diffs)
  covers `@pierre/diffs` rendering, CodeView, themes and workers. Before changing them, read the skill and relevant
  references. If missing, install it from the checkout root with `npx skills add pierrecomputer/pierre --skill diffs`.
  Downloaded instructions and the CLI-generated lockfile stay local. Installed dependency types decide which APIs
  this checkout supports.

- **Development skills**: `.agents/skills/run-kulisa/SKILL.md` for starting, stopping or restarting the app;
  `.agents/skills/debug-kulisa/SKILL.md` for diagnosing the running app. Instructions and scripts live there;
  `.claude/skills/` contains Claude Code entrypoints to the same skills. Run their commands from the checkout root.

- **Code intelligence.** Use an available language-server tool for definitions, references and types. Check
  `test/` too: a language server's project may not include it. With no such tool (including a Codex session without
  one), use `rg` to locate candidates, then read their declarations, imports, re-exports and callers; text matches
  alone do not establish symbol identity or a complete set of references. Validate type-sensitive changes with the
  project's TypeScript checks (`docs/testing.md`, Code analysis). Claude Code's LSP setup is documented there;
  installing its plugin is only for Claude Code sessions.

- **Before committing or ending a turn with changes**, complete `docs/testing.md`, Agent completion checks,
  in the worktree being changed. This applies to every agent, whether or not it has a checking hook.

## Rules

- **A human signs in to real accounts, never the agent or the code.** Never type their passwords, automate their
  logins, or print or log cookie values, tokens or passwords. The one exception, the author's design
  (`docs/profiles.md`, "Test users' sign-ins"): a test user of the app under test on this computer, whose pair Kulisa
  keeps encrypted and types itself (`browser_type_login`), only on a local address (`local.ts`) or a page the tab
  reached from one, never on an account provider's; the agent never sees the password.
- **The author's data is in `~/.config/Kulisa`**: profiles with real sign-ins to work tenants.
  Never delete or overwrite it. Stop or restart the author's running app only with the `run-kulisa` skill: it lets
  session cookies and tabs be saved.
- **`src/main/signin-pause.ts` is a deliberately temporary implementation** (the author's decision: `docs/profiles.md`, Sign-in pause).
  Keep it isolated; the author will replace it. Hiding the agent from bot detection (Kasada) is not researched or
  built.
- **The MCP server and the CDP proxy listen on 127.0.0.1 only.** Never bind them to 0.0.0.0 or another
  interface: they control signed-in browser profiles. `local-only.ts` also refuses requests from web pages (a
  foreign Host: DNS rebinding; any Origin: a page's fetch or WebSocket); keep every new endpoint behind it. Local
  processes are not authenticated yet (issue #90).
- **Do not downgrade `playwright-core`** below 1.64: Kulisa uses APIs that first shipped there: `page.pickLocator()`
  (the picker), `page.screencast.showActions()` (the agent's actions in the page), `page.consoleMessages()`/`requests()`.
- **Killing processes:** `pkill -f <pattern>` also matches the shell running it. Select Electron by
  `ps -eo pid,comm,args` with `comm == "electron"`.

## Architecture

How the parts work, in detail: the docs listed at the top. Here: the layers, where a kind of code goes, and what must
hold.

Layers, each using only the ones below it. Which file is in which layer is `.dependency-cruiser.ts`'s (the one list;
`npm run deps`, in `npm run lint`, refuses an import against them; docs/testing.md, Layers). Under them all, a base of
git and what is local; `src/shared/` what the main process and the window both import (the rule for names, the
profiles' pictures, `Result`).

1. **Browser Kulisa package** (`src/browser/`; its README and AGENTS.md): browser profiles, their tabs and storage. Knows nothing about agents, MCP or the window UI.
2. **Automation access** (`cdp-proxy.ts`, `local-only.ts`): the only way anything automated reaches a profile's pages, and where
   sign-in mode is enforced.
3. **Kulisa plugin**, a Kulisa package (`src/kulisa-plugin/`; its README and AGENTS.md): MCP tools, shared instructions,
   hooks, CLI adapters and transcript readers. The core supplies actions and facts through the Kulisa package's
   contracts (`src/main/plugin.ts`); the Kulisa package imports no core domain code or types. Agent-facing behavior
   belongs here; every agent gets the same tools and skill, CLI-specific behavior stays in its adapter.
4. **Window** (every other file of `src/main`, and `src/renderer/`): what the human sees and does.

**One core, with handles for the human and for the agent.** The human (the window) and the agent (the Kulisa
plugin) do the same things to profiles, tabs and tasks: open a tab, go to an address, close or delete a profile.
Each such action is written once, in the core (`Task`: `find`, `findTab`, `createProfile`, `deleteProfile` …;
`Profile`: `newTab`, `navigate`, `closeTab` …), with its checks, its questions to the human and its rules. The
windows' IPC (`ipc/`) and the agent's MCP tools (`kulisa-plugin/main/tools/`) are handles on it: each finds what to act on
through the core, calls it, and translates the answer (`{ error }` for the window, an error the agent reads). A
check, a rule or a way of doing an action is never written in a handle, nor twice.

- A new action goes into the core first, then gets both handles. When one side should not have it, say why in
  the table of actions in `docs/profiles.md` (Pick is the human's, `browser_highlight` the agent's). An action
  missing on one side for no reason is a gap to fill, not a decision.
- What only automation keeps to stays in the agent's handle: the sign-in pause. What the agent does inside a page
  goes through Playwright over the proxy (layer 2), so the human sees it and the pause holds; the core still
  decides what is done (`browser_navigate` takes the address as the address bar does: `toUrl`).
- What only the window needs (where the keyboard focus goes, pictures of the pages under a menu) stays in the
  window.

**Tools for the agent, not the work's logic in Kulisa** (for all of Kulisa: the agent then
solves what comes up its own way). Kulisa does what only it can: the window, notifications, waking an agent, typing
into its terminal, reading for it what it cannot reach. The steps of the work (open a pull request first, push before
asking, where a fix goes) are the agent's: Kulisa gives it the tools and says in the skill how they fit, and a tool
that cannot act says back what is missing instead of doing it itself. Not against One core: a core action still keeps
its own checks and rules; what Kulisa does not do is decide the agent's way through the work.

Where a kind of code goes:

- Agent-specific code goes into its agent's file in `src/kulisa-plugin/main/agents/` (`claude.ts`, `codex.ts`: everything Kulisa knows of
  that agent, its transcript's reader too), nowhere else; a new agent is a new file there.
- Git for tasks is the user's git, never a shell (`worktrees.ts`); an agent is typed into the user's shell in its
  folder, so the project's own environment applies (direnv, nvm, mise; `src/terminal/`).

## Hard-won facts (details in the doc of the part)

- **Never make a `webContents` inside another's `'destroyed'` event.** Chromium is still taking the old one down;
  the new one crashes the main process now and then with SIGTRAP (`CHECK(!frame_tree_->IsBeingDestroyed())`). The
  empty tab after the last one closes is made on the next turn (`Profile._removed`).
- **An uncaught exception in the main process** opens a modal GTK dialog that blocks everything, including the
  proxy and MCP. `app.ts` logs instead; keep it that way.
- **No HTTP server in the Electron main process that the app's own pages load from.** A sync Electron call
  waiting on a renderer that waits on that server deadlocks. The test site runs in a child process.
- **Pages with Trusted Types (Microsoft 365, Google) refuse HTML strings**, so Playwright's
  `screencast.showOverlay(html)` draws nothing there. `locator.highlight()` and `screencast.showActions()` work;
  use those (test page `/strict`).
- **With the monitor off or the screen locked**, Chromium renders at 1–2 fps, and anything waiting for frames
  crawls. Don't trust timings taken then (`xset q` shows "Monitor is Off").
- **Profiles coming back on `about:blank`** (their saved tabs `[]`) have two known paths, both handled: a profile
  still opening, and tabs closing as Kulisa quits. Read `docs/profiles.md`, "Tabs that come back", before looking for
  another.
- **Playwright keeps every page it attaches to "visible".** Its first command to a page,
  `Emulation.setFocusEmulationEnabled`, is a capture to Chromium: the page stays visible, unthrottled and unfreezable
  behind other tabs and in a hidden window. Electron's `setVisible(false)` does hide a page (issue #52, tabs
  asleep).
