# Kulisa

Desktop app (Electron) where the AI agent the human chooses works in their signed-in browser profiles, side by side:
it builds, checks the result as every user, fixes, and goes again until it works, while the human watches or takes a
break. Made first for developing and testing web apps with several users at once. Each **profile** is an
embedded browser profile (own cookies, storage, tabs) shown as a pane. The human signs in by hand in a pane; a
coding agent the human chooses (Claude Code, Codex: the unchanged CLI) runs in the built-in terminal and drives
profiles through Kulisa's MCP server. Tasks run several agents on one project at once. Point-and-tell (Pick, then click an element) puts a reference with a Playwright locator into the agent's
prompt; the human writes the rest of the message around it.

The author's framing: Kulisa is made first for developers, as an IDE is (like JetBrains or VS Code), and is good for
any work in web apps (several clients' tenants, admin and support work). Not a bot, and not a tool for farms of
accounts or getting past bot detection (the author despises those): the human's own accounts, signed in by hand.
Everything happens inside Kulisa; no external Chrome windows.

**Being rewritten (since 2026-10-10; on `main` since 2026-10-11, being stabilized there).** Kulisa is being rebuilt around projects and tasks: tasks
replace workspaces; projects are composites (repositories, agents with accounts, profiles); profiles live in one
store with a master each and a copy per task; test users sign in with saved pairs on local pages; real accounts'
cookies are kept in step between a master and its copies. The design, the steps and what is left of each: ROADMAP,
"Projects and tasks: Kulisa rebuilt around them"; how the built parts work: `docs/tasks.md`, `docs/profiles.md`.
Where it stands, what is next and what is open for the author: that section's **Status**; read it first, and keep it
current when something is built or decided. Until it is done, some parts of the app, the docs and the tests may be
outdated (still written for workspaces, main and forks), unfinished or unstable: check the ROADMAP section before
trusting one, and say so when you find one. How the author wants it built: a step at a time, a plan first, then the
code with its tests and docs, a commit per step (the author asked for them), the author's Kulisa restarted after it;
only what was discussed and written down as decided, no open questions built over and no ideas of one's own added
unasked. This paragraph is removed when the rewrite is finished.

- `docs/SPEC.md`: the product: problem, features and phases, architecture decisions.
- `docs/REPORT.md`: how the design was tested and decided. Read its later sections (sign-in, Kasada, session
  cookies) before changing sign-in, identity or persistence code.
- `docs/ROADMAP.md`: only what is planned: ideas and details of features to build, deferred ideas, open issues.
  When a feature is built, document it in the docs below (how it works, and why it is built so) and remove it from
  the ROADMAP, keeping only what is left of it. **Before
  building something, look for it there** (Deferred ideas, Open issues): it may have been tried and put off, with
  the reason (a native menu in pages froze the desktop, and was built again without reading this).
- `docs/profiles.md`, `docs/tasks.md`, `docs/window.md`: how profiles, projects with their tasks, and the
  window work now: what the human and the agent do, what Kulisa creates on the computer and removes, why it is built
  so, the code. Read the one for the part you change; keep it current.
- `docs/transcripts.md`: the task's history for its agent (`task_history`) and how each agent CLI's transcript is
  read for it, field by field. Check it when an agent CLI is updated: the formats are undocumented.
- `docs/ui.md`: what the window's UI is built of: tokens, icons, components (buttons, rows, dialogs, menus). Look
  there before making a button, an icon, a row or a dialog; keep it current.
- `docs/guide.md`: the user guide, for everyone who uses Kulisa, not only developers: what they do and see, in their
  words (no file, function or protocol names). kulisa.app builds its documentation page from it (`kulisa-site`), so
  pictures only from `docs/images/` by a relative path, and no links to the other docs. Keep it current: a change to
  what the human does or sees changes it too, in the same commit.
- `README.md`: how to run, environment variables, a map of `src/`.
- `docs/testing.md`: how the tests are built and written. Read it before writing a test.
- `docs/LICENSING.md`: Kulisa is GPL-3.0-or-later, the author's; what the license covers and what it does not.

## Working with the author

- **A peer developer, not an assistant who pleases.** Where the author is wrong, or a request has a cost (much work,
  more RAM, against a rule here), say so before building it, with the reason, and propose a way with a
  recommendation ("I would do X, because …"), not a list of options. Then do what the author decides: it is their
  product, the last word is theirs, and a settled question is not raised again. Take part in the design: point out
  what the author did not ask about but should know.
- **The time to rewrite is not an argument** (the author, 2026-10-10: with AI a rewrite costs nothing). When
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
- **Comments say why, not what** (the author, 2026-10-11: comments that retold the UI went out of date again and
  again). A comment holds what the code cannot say: why it is so, a workaround and what it works around, a pointer
  to REPORT or a doc. It does not retell what a part shows, what its buttons are or what things are called: that is
  the docs' (`docs/`) and the code's own; a file's header is a line saying what it is, and the doc to read. Types are
  TypeScript's, not a comment's. When a term or a part is renamed, look for the old word in the code's comments too,
  not only in the docs.
- **Terminology: "profile"**, the word Chrome uses, for one embedded browser identity (cookies, storage, tabs) and
  its pane. Not "persona", "user" or "account" (an account is what a profile signs in to). Early commits and
  experiments said "persona".
- **Terminology: "Kulisa plugin"** for the layer between the agent and the profiles (Architecture, layer 3): the
  MCP server with the browser tools (agent-agnostic, where new abilities go), the profiles skill (one text for every
  agent, `src/agent/skills/profiles/`) and the hooks (each agent's table in `agents/`), brought to each agent its own
  way (for Claude Code also a plugin with the MCP config, `src/agent/claude-plugin/`).
  Giving the agent more it can do in the browsers is one of Kulisa's features: extend the MCP server, then describe
  it in the skill.
- **Terminology: "plugin" vs "extension".** A plugin is always an agent's (Claude Code's, Codex's), the Kulisa plugin
  being one. Code that extends Kulisa itself (panels, features of the IDE) is an "extension", as in VS Code and
  Chrome. Not "module": that is a file of code.
- **The agent is the human's choice, per task** (`agents/`): never assume `claude` is installed. Kulisa
  installs a missing agent itself with its maker's installer when the human asks, without steps for them to type.
- **Terminology: "group"**: a project's open tasks in a window, its island in the bar, as Chrome's tab group (it
  comes with the first task opened, goes with the last one closed: Close Group). A project is no thing to open (the
  author, 2026-10-11: it is what its tasks are made of: profiles, agents, repositories); not "open project" or "Close
  Project" (earlier commits say so). In code a group is still an open project (`Project` in `shell.open`).
- **Terminology: "the tasks' bar"**: the bar of the groups' islands with their tasks' tabs, under the grid or over it
  (☰ → Tasks bar; `TaskBar.vue`, `#taskbar`). Not "taskbar", the OS's. It was "the projects' bar" (`ProjectBar.vue`)
  until 2026-10-11: its tabs are tasks; earlier commits say so.
- **Terminology: "Settings"**: the dialog behind the title bar's gear, as JetBrains' Settings: a tree of Projects (every
  project, each its page), Agents (the agents, their accounts) and Profiles (every profile, who it is). It was "the projects' manager" alone until 2026-10-11,
  then tabs; a project's page is still the manager in code (`ProjectEditor.vue`, `dialog('projects')`). New Project is a
  dialog of its own (`NewProject.vue`).
- **Terminology: "the empty window"**: what a window is with no task open (at first start, after its last
  group is closed): the title bar and the tasks' bar as always (no islands, its + there) and, in the
  grid's place, an empty island: "No task is open", New Task (the bar's + menu), New Project…. `Empty.vue`. It replaced
  the Welcome screen (JetBrains' name; 2026-10-11), whose list of tasks is the bar's + now (the closed ones; Search
  Tasks for a few hours before it); earlier commits say Welcome screen.
- **Terminology: "task"** for one line of work inside a project: its agents (each in a terminal of its island,
  with a conversation of its own; any agent CLI), a branch of the code, profiles and a grid. It replaced "workspace" (the word of tools for parallel agents,
  e.g. Conductor) on 2026-10-10; earlier commits say workspace. Each works in a git worktree of its own next to the
  project (`myshop@task-2`); the project's folder is the human's. Several tasks build several features at once. How
  they work and why: `docs/tasks.md`; what is left: ROADMAP, "Projects and tasks" and "Tasks, rest".
- **Not tied to one agent or LLM vendor.** The user chooses the agent CLI (Claude Code, Codex, others); Kulisa must
  not require Claude Code or any one model provider. When planning a feature, design it for any agent CLI:
  - The core of a feature works through what every agent has: a terminal, the MCP server, files, git. Kulisa's
    own data and conventions (e.g. its own folders), not one agent's (`.claude/…`).
  - What only some agents can do (Claude Code's `--resume`, `--fork-session`, plugin, hooks) is an optional extra
    per agent, kept in one place per agent, and the feature still works without it.
  - Claude Code is the default and the best supported today; that is fine as long as the others are not locked out.
- **TypeScript everywhere, as ES modules** (since 2026-10-11): the main process, the tests and the scripts run as
  they are by Node's type stripping (Electron's own Node 24, or Node 24.12+), so erasable syntax
  only (no `enum`, `namespace`, parameter properties) and imports with their `.ts`. `tsc` only checks: `tsconfig.json`
  (strict), `test/tsconfig.json` (the same without null checks: a test counts on what it checks being there). What
  the main process sends the window is typed once, in `src/renderer/types.ts`; the app every module gets, `Shell`
  (`src/main/shell.ts`); an action's `{ error }` answer, `Result` and `refused()` (`src/main/result.ts`). One way of
  writing code, all at once: what was dropped on 2026-10-08 was a mix of `.mts`, `.js` and JSDoc. The one exception,
  the windows' preload (`src/preload/index.cjs`, a few lines of plain JavaScript; the author, 2026-10-12): the windows
  are sandboxed (no Node in their pages: about 15 MB less each, PSS), and Electron runs a sandboxed preload without Node,
  so no type stripping and no `require` of Kulisa's modules. What the window shares with the main process (the rule
  for names, the profiles' pictures) it imports itself. No build of the main
  process (Vite, esbuild): runs from source and packaged were checked, the asar too.
- **Keep the amount of own code minimal, so the project stays under control.** Prefer maintained open-source
  libraries to writing our own.
  - Before writing browser or CDP code, check whether playwright-core already does it: picker
    (`page.pickLocator`), snapshots (`ariaSnapshot`), action annotations (`page.screencast.showActions`),
    highlights (`locator.highlight`), recent console messages and requests (`page.consoleMessages`, `requests`).
    Check `@playwright/mcp` and the MCP SDK the same way. Read the API of the installed version, not what you
    remember: it is a 1.64 alpha, whose newest APIs are younger than your training. Its documentation is in
    `node_modules/playwright-core/types/types.d.ts` (playwright.dev describes the stable release); name what you read
    in the plan.
  - Window layout (panels, splits, drag and drop, tabs of panels, saving the grid) is dockview's; use its API
    before adding layout code.
  - Before building anything that touches Electron, look it up in Electron's documentation for the installed version
    instead of building from memory (Electron ships every 8 weeks; knowledge from training is older). The guides,
    their index and what changed between versions are in the repository's docs at the version's tag
    (`https://raw.githubusercontent.com/electron/electron/v<version>/docs/`: `README.md`, `tutorial/…`, `api/…`,
    `breaking-changes.md`); the API is in `node_modules/electron/electron.d.ts`. Name what you read in the plan. The
    dark mode was first built from memory, and redone after its guide was read.
  - The same for Vue: before using a part of Vue new to the window, read its page in Vue's own documentation for
    agents (`https://vuejs.org/llms.txt`, each page as `.md`; it describes 3.5, the installed version), and name it in
    the plan. Official sources only, no community skills or MCP servers (the author, 2026-10-10).
  - Hand-written protocol code is the exception: today only `cdp-proxy.ts`, because nothing existing exposes
    `webContents.debugger` over CDP.
  - When adding a dependency, prefer one that is widely used and maintained, and say why in the commit message. Its
    license must allow being part of a GPL-3.0 program (MIT, ISC, BSD, Apache-2.0 do; `docs/LICENSING.md`).
- **Window UI: Vue 3 components in TypeScript, built by Vite** (`src/renderer`, `vite.config.mts`; since 2026-10-10,
  `docs/ui.md`). Electron ships a recent Chromium; use what it has instead of code or workarounds:
  - A part of the window is one `.vue` file in `src/renderer/components/`: its markup, its behavior and its own look
    (`<style>`, rooted at its id or class) together. What several parts share, or what outlives a component (the
    store of what the main process sends, the grid, the terminals' xterms, the pages under menus and dialogs, the
    questions, the keys), is a TypeScript module in `src/renderer/lib/` with a small interface (`covered('hide')`,
    `ask(q)`, `dialog('projects')`). State the main process sends lives in `lib/store.ts` (Vue's `reactive`) and
    components draw from it; no DOM built by hand where a template does it. `types.ts`: the shapes the main process sends.
  - **Generic UI is Reka UI's** (`reka-ui`, the author's decision, 2026-10-11): menus, dialogs, and the controls Reka
    has (choices, radios, selects, checkboxes, lists, tabs …), in Kulisa's look (Reka has no look of its own); nothing
    of our own where Reka has it, and every new part built on it. Its documentation for agents:
    `https://reka-ui.com/llms.txt` (each page as `.md`); its API: the installed version's `node_modules/reka-ui/dist/`
    (`.d.ts`); name what you read in the plan. Not Reka's: what is not generic (the grid is dockview's, the terminal
    xterm's) and tooltips (the native `title`: drawn above the profiles' pages, an HTML one would be under them).
  - Semantic elements (`header`, `main`, `nav`), `hidden`, form submit.
  - **One set of components** (`docs/ui.md`): the window is built of them, each defined once. Icons are the
    sprite's (`Sprite.vue`, used as `<Icon name="i-…">`), never drawn in place; icon buttons are `.icon`; rows
    `.item`; menus are `ButtonMenu.vue`, `RightClickMenu.vue` (`components/menu/`); every dialog is `Modal.vue`
    (Reka's Dialog; questions `Ask.vue`, its AlertDialog): `header` (title, × when it may be closed), `.body`,
    `footer` with the buttons at the right end, the main one last (`.primary`, `.danger` when it deletes). Global CSS
    only in `tokens.css` (colors, sizes) and `components.css` (the shared components); a part's own CSS places
    components, never restyles them into new ones. Something new that more than one place could use goes into
    `components.css` (or a component of its own) and `docs/ui.md` first.
  - CSS: nesting, custom properties for every color and size (`tokens.css`; no literal colors elsewhere; each color
    `light-dark()` for both themes),
    `:is()`, `:has()`, `color-mix()`, logical properties. Before overriding dockview, check that its own variables
    or rules don't already do it.
  - No wrapper elements or rules without an effect; when touching a part, remove what it no longer needs.
  - The e2e tests find elements by their ids and classes: keep them when a part changes, or change the test with it.
  - `npm run build` type checks (tsc, vue-tsc) and builds into `dist/renderer`, which the main process loads from disk
    (`src/main/pages.ts`); `npm start` and `npm test` build first. No dev server: no page of the app may load from an
    HTTP server of its own (Hard-won facts).
- **RAM matters.** Kulisa is Electron plus a Chromium process per tab, for several profiles at once, next to the
  user's own browser and IDE. When choosing how to build something, weigh how much memory it keeps and prefer the
  cheaper way. If a feature would noticeably raise RAM use (a process per tab or profile, keeping hidden things
  alive, large buffers), discuss it with the author before building it. Reference: 5 profiles × 3 tabs ≈ 4 GB,
  almost all in tab processes (REPORT, E8).
- **Nothing piles up on the user's computer.** Everything Kulisa writes has an owner and an end:
  - It goes when its owner goes (a profile, a task, a project: their data, the copies, git's and the agent's
    records of a task's copy), at once or at the next start when a file is still open (`deleted-folders.json`).
  - It is rewritten rather than added to: no files per event, no logs that grow; or it has a limit.
  - Temporary files are removed when done, also after an error; pictures and the like stay in memory.
  - A new kind of file or folder is listed in "What is on the computer" (`docs/tasks.md`, `profiles.md`) with
    when it goes, and its removal is tested.
  - The same in development: tests write only in their temp folder; screenshots, logs and scripts made while working
    go into the session's scratch folder and are deleted when the task is done.
- **Every behavior change comes with a test.** **Read `docs/testing.md` before writing one**: the two layers (unit
  tests in plain Node, e2e in the real app), the groups of e2e files, and how a test is written (wait for a state,
  never for time).
  - Fix a bug by first reproducing it as a failing test, then making it pass (the session-cookie bug was done
    this way).
  - **The full suite (`npm test`, about a minute) runs once, when the author says the work is done** ("всё ок",
    "commit"), before the commit; fix what fails and run it again. `npm run knip` once a step, when its code is
    written, before it is shown to the author (not after every change). While building: `npm run test:unit` (a second),
    one group (`npm test -- <group>`), a screenshot (`KULISA_SHOT`) or the author's running Kulisa, restarted with
    the change. On Linux the tests run on a screen of their own (Xvfb, openbox): they never take the author's
    focus.
- **Kulisa runs on macOS, Windows and Linux.** Write code for all three: no shell commands, Unix-only paths or
  signals, or Linux-only flags without a branch for the others. Keep platform branches few and in one place per
  concern (e.g. the shell fallback in `terminal.ts`). What is untested on a platform goes into ROADMAP.
- Ask before anything outward-facing: pushing, publishing, registering domains.
- Commit only when asked. The repo is public on GitHub (`origin`, github.com/cosmotools/kulisa); push only when
  asked, and never print the remote URL (`git remote -v`): it carries the author's token.
- **Each piece of work in a worktree of its own** (the author, 2026-10-11: several Claude sessions work on Kulisa
  at once, and one switching or editing the shared folder pulled the files out from under the others):
  - Before the first change: `git worktree add .claude/worktrees/<name> -b <name> main` (from the local `main`, or
    the branch the author names; not EnterWorktree's default, which starts from `origin`, behind the local one), and
    work there.
  - **The repository's own folder holds `main`, always** (the author, 2026-10-11: with `main` in a worktree, the
    folder stayed on an old branch, and a session started there read an old CLAUDE.md and old docs). Nothing is
    edited there and it is never switched to another branch; only merges into `main` are done in it.
  - `node_modules` is a link to the repository's (`ln -s ../../../node_modules node_modules`) while the work does
    not change the dependencies; work that does gets its own (`npm install`, then `npm run postinstall`).
  - Commits go to the worktree's branch. Merging into `main` is done in the repository's folder (`git -C <repo>
    merge --no-ff <name>`), with nothing else there; no worktree has `main` checked out.
  - `npm test` runs from several worktrees at once: each checkout has its own test folder and test site
    (`test/start.ts`). The author's Kulisa runs one checkout at a time: the `run-kulisa` skill, from the worktree
    while its work is shown, from the repository's folder (`main`) once it is merged.
  - Once its branch is merged (or the author drops it), the worktree goes (`git worktree remove`), its branch
    (`git branch -d`) and its test folder (`/tmp/kulisa-test-<worktree>-…`).

## Commands

```sh
npm start   # the app: the groups open last, plus $KULISA_PROJECT's (at first start none: New Project)
npm test    # unit tests, knip, actionlint (when installed), then the e2e groups in parallel, each the real app against a local test site, then restarted
npm run test:unit     # the unit tests alone (plain Node, a second)
npm run knip  # no file, export or dependency nothing uses: once a step, before showing it (docs/testing.md, Dead code)
npm run test:visible  # e2e on your screen, to watch them (npm test uses Xvfb on Linux when installed)
npm run make  # installers for this platform with Electron Forge (forge.config.ts), in out/make/
npm run publish  # the same, to a draft release on GitHub: the CI's, on a tag v* (window.md, The app icon, installers and updates)
npm run icons # renders assets/icon.svg to icon.png/.ico/.icns (committed; run after changing the SVG)
npm run build # type checks (tsc: the main process and the tests; vue-tsc: the window), then Vite into dist/renderer
npm run watch # the window built again on every change; then reload it (Ctrl+R in its DevTools) or restart
```

- **Node 24.12+ and npm 11** (type stripping is stable from 24.12). npm 11 runs dependencies' install scripts only when listed in `allowScripts` in
  package.json (`npm install-scripts approve <pkg>`). Approving `node-pty` builds it for Node, not Electron;
  run `npm run postinstall` after that.

- **Sandbox and native module.** On Linux Electron needs `--no-sandbox` (`chrome-sandbox` in `node_modules` is
  not setuid); `npm start` (`scripts/electron.ts`) and `npm test` pass it there only. `npm install` rebuilds `node-pty` for Electron (postinstall).
- **Starting the app from a Claude Code session.** The app's terminal starts `claude`, which would inherit the
  parent session's `CLAUDE_*` variables, take itself for a child session and not save its history. Unset them all
  except `CLAUDE_CONFIG_DIR`, and run it in the background:
  `env $(env | grep -o '^CLAUDE[A-Z_]*' | grep -v '^CLAUDE_CONFIG_DIR$' | sed 's/^/-u /') npm start`.
- **Looking at the window.** `KULISA_SHOT=/tmp/kulisa.png npm start` saves a screenshot of the whole window,
  profile views included, about 4 s after start (`KULISA_SHOT_DELAY` in ms). In tests: `shell.screenshot(file)`.
  Then read the PNG. Use it to check any UI change.
- **A bug the tests and screenshots do not show** (input going nowhere, a native view misbehaving): the
  `debug-kulisa` skill (`.claude/skills/debug-kulisa/`): look inside the running app, a scratch Kulisa, real clicks,
  bare Electron. Read it before guessing at causes.

## Rules

- **A human signs in to real accounts, never the agent or the code.** Never type their passwords, automate their
  logins, or print or log cookie values, tokens or passwords. The one exception, the author's design (2026-10-10;
  `docs/profiles.md`, "Test users' sign-ins"): a test user of the app under test on this computer, whose pair Kulisa
  keeps encrypted and types itself (`browser_type_login`), only on a local address (`local.ts`) or a page the tab
  reached from one, never on an account provider's; the agent never sees the password.
- **The author's data is in `~/.config/Kulisa`**: profiles with real sign-ins to work tenants.
  - Never delete or overwrite it.
  - Tests use their own temp folder (`/tmp/kulisa-test-<checkout>-<hash>`, one per checkout: `test/start.ts`).
  - To restart the author's running app, or give them a fresh start: the `run-kulisa` skill
    (`.claude/skills/run-kulisa/`): SIGINT to the main `electron … .` process, so session cookies and tabs get
    saved; then `npm start` in the background.
- **`src/main/signin-pause.ts` is a deliberately temporary implementation** (the author's decision, see REPORT).
  Keep it isolated; the author will replace it. Claude declined to research hiding the agent from bot detection
  (Kasada); don't build that.
- **The MCP server and the CDP proxy listen on 127.0.0.1 only.** Never bind them to 0.0.0.0 or another
  interface: they control signed-in browser profiles. `local-only.ts` also refuses requests from web pages (a
  foreign Host: DNS rebinding; any Origin: a page's fetch or WebSocket); keep every new endpoint behind it. Local
  processes are not authenticated yet (open issue in ROADMAP).
- **Do not downgrade `playwright-core`.** It is pinned to `1.64.0-alpha-…` because Kulisa uses APIs that exist
  only there: `page.pickLocator()` (the picker), `page.screencast.showActions()` (the agent's actions in the
  page), `page.consoleMessages()`/`requests()`. Move to the stable release once it ships with them.
- **Killing processes:** `pkill -f <pattern>` also matches the shell running it. Select Electron by
  `ps -eo pid,comm,args` with `comm == "electron"`.

## Architecture

How the parts work, in detail: `docs/profiles.md` (profiles, sign-ins, the CDP proxy, the agent's tools, point and
tell), `docs/tasks.md` (projects, tasks, agents, windows, what is on the computer) and `docs/window.md`
(the title bar, the grid, zoom, menus, dialogs, the terminal). Read the one for the part you
change; keep it current. Here: the layers, the modules, and what must hold.

Layers, each using only the ones below it:

1. **Profiles** (`profiles.ts`, `project-profiles.ts`, `store.ts`, `session-cookies.ts`,
   `signin-*.ts`): browser profiles, their tabs and storage. Knows nothing about agents, MCP or the window UI.
2. **Automation access** (`cdp-proxy.ts`): the only way anything automated reaches a profile's pages, and where
   sign-in mode is enforced.
3. **Kulisa plugin** (formerly "agent bridge"): everything that lets an unchanged agent CLI understand and use
   profiles: tools, knowledge (skill) and hooks, the same for every agent.
   - `mcp-server.ts` is the functional part and is agent-agnostic: any capability for the agent is an MCP tool
     there, so Codex and other CLIs get it too. One URL per task (`/task/<project>/<n>/mcp`).
   - The profiles skill, `src/agent/skills/profiles/SKILL.md` (change it when a tool or a rule changes), is one text
     for every agent, written as `kulisa-profiles` into each account's folder where its agent reads skills
     (`installSkill`, an entry's `skills`). Claude Code's package is `src/agent/claude-plugin/` (`claude
     --plugin-dir`): `.mcp.json` (`KULISA_MCP_URL`). Packaged, both sit outside the asar (`extraResource`).
   - Each agent's hooks are a table in its file (`agents/claude.ts`, `codex.ts`: which of its events sends which of
     Kulisa's), given at its start (Claude Code in `--settings`, Codex as `-c`), never written into its config; every
     hook runs one command (`hookCommand`: `curl` to `$KULISA_URL/hooks/<event>`, answered by `agent-hooks.ts`).
   - Do not add agent-facing behavior elsewhere (e.g. in `profiles.ts` or the renderer).
4. **Window** (`app.ts`, `window.ts`, `keys.ts`, `projects.ts`, `tasks.ts`, `worktrees.ts`, `agents/`, `renderer/`, `ghost.ts`, `picker.ts`,
   `terminal.ts`): what the human sees and does.

**One core, with handles for the human and for the agent.** The human (the window) and the agent (the Kulisa
plugin) do the same things to profiles, tabs and tasks: open a tab, go to an address, close or delete a profile.
Each such action is written once, in the core (`Task`: `find`, `findTab`, `createProfile`, `deleteProfile` …;
`Profile`: `newTab`, `navigate`, `closeTab` …), with its checks, its questions to the human and its rules. The
windows' IPC (`app.ts`) and the agent's MCP tools (`mcp-server.ts`) are handles on it: each finds what to act on
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

Modules (`src/main`):

- `app.ts`: the app: its windows, the groups (open projects in code: a task opened, closed, moved to a new window; one change after
  another: `serial`), the agents, the windows' IPC (each message acts in the window it comes from: `event.sender`;
  one on profiles or tabs names its task too, refused when that window shows another by then: `act` in the
  renderer's `lib/store.ts`), quit. `shell.win`, `shell.task`, `shell.profiles`, `shell.closed`, `shell.pty` are the first window's (the tests').
- `window.ts`: a window: its groups and what it shows (show a group or a task, the grid's state, the
  views' places), the questions asked there (`shell.ask(q, window)`, in its dialog: `Ask.vue`), the theme's colors
  CSS does not paint.
- `keys.ts`: the keyboard shortcuts: one table (what each key does, and where: a page, everywhere, the terminal) and
  which key an input event is; `app.ts` takes them before any page does (`before-input-event`), the window runs them
  (`renderer/lib/keys.ts`). A new key goes into the table (`docs/window.md`, Keys).
- `projects.ts`: a project's group (an open project in code): its tasks (make, close, open again, delete; closing them all), removing a project's data.
- `tasks.ts`: a task: its profiles, its terminals (its island) with its agents and their conversations, their
  environment, renaming, copies for a new task.
- `worktrees.ts`: git for tasks (the user's git, never a shell): worktree, branch, files outside git, direnv.
- `accounts.ts`: the agents' accounts, one store: each made with the agent's own sign-in (Settings → Agents, or a
  project), a config folder of its own (not the human's `~/.claude`), shown by its email, kept until the human deletes
  it (Settings → Agents), with no project too.
- `agents/`: the agents to choose from, a file each (`claude.ts`, `codex.ts`: everything Kulisa knows of that agent,
  its transcript's reader too); `agent.ts` what an entry is, the contract every agent fills; `index.ts` the list and
  what is done with any agent (find, install, version, accounts' sign-in, a folder's trust). Agent-specific code goes
  into its agent's file, nowhere else; a new agent is a new file there.
- `profile-store.ts`: the profiles, one store: who each is, its master, its projects. `master.ts`: a master's window,
  where the human signs in once for every task (nothing automated attached). `cookie-sync.ts`: real accounts'
  cookies kept in step between a master and its copies. `local.ts`: what is local.
- `project-profiles.ts`: a task's profiles (its project's, each a copy of its master made at its first open), open
  and closed: create, rename, describe, close, open, let go. `avatars.ts`: their pictures.
- `profiles.ts`: a profile: `session.fromPath(<task>/Profile <k>)` plus a `WebContentsView` per tab.
- `store.ts`: Kulisa's data folder, laid out as Chrome's user data.
- `names.ts`: the one rule for names (projects, tasks, profiles: an email address's characters) and slugs.
- `session-cookies.ts`, `signin-pages.ts`, `signin-pause.ts`: sign-ins that last, the sign-in pause.
- `cdp-proxy.ts`, `local-only.ts`: the CDP endpoint per profile; refusing web pages.
- `history.ts`, `transcripts.ts`: the task's history for its agent, read from the agents' transcripts.
- `mcp-server.ts`, `agent-hooks.ts`, `ghost.ts`, `picker.ts`: the agent's tools and hooks, its actions shown, point
  and tell.
- `updates.ts`: a packaged Kulisa updating itself (Forge's way), Squirrel's events on Windows.
- `terminal.ts`: a pty per task for its agent, and its other terminals (a dev server the agent runs, the
  human's shells); the agent typed into the user's shell in its folder (the project's own
  environment: direnv, nvm, mise). On Windows started directly (the other terminals in cmd).

What must hold in the window:

- **Profile views are native and draw above the window's HTML.** They belong to their project's window (moving a
  project moves them: `Profile.moveTo`). The renderer sends each pane's `.content` box (or
  that it is off screen) to the main process after every grid change. Anything HTML over the panes must hide them
  (`views:hidden`): dialogs; while a panel is dragged or a menu is open, pictures of the pages stand in for them.
  Every menu and dialog opens through `covered()` (`lib/views.ts`), which puts the pages back however it closes.
- **Sizes and zoom.** UI text and controls use `--font` and `--control` (tokens.css), not their own sizes. The Kulisa
  zoom is Chromium's zoom of every window's page (`setUiZoom` in app.ts); the renderer's boxes are CSS pixels and
  `window.ts` scales them for the native views. Pages get the Kulisa zoom times their site's own zoom.
- Kulisa's own DevTools exist only when running from source (`appDevTools`, off when `app.isPackaged`). End users
  get DevTools for profiles' tabs only.

## Hard-won facts (each cost hours; details in docs/REPORT.md)

- **`setWindowOpenHandler` → `createWindow`:** pass `options.webContents` into the new `WebContentsView`.
  A fresh one freezes the main process.
- **Never make a `webContents` inside another's `'destroyed'` event.** Chromium is still taking the old one down;
  the new one crashed the main process now and then with SIGTRAP (`CHECK(!frame_tree_->IsBeingDestroyed())`), in
  about 40% of test runs and in the author's running Kulisa. The empty tab after the last one closes is made on the
  next turn (`Profile._removed`). Found with gdb and Electron's breakpad symbols (2026-10-09).
- **An uncaught exception in the main process** opens a modal GTK dialog that blocks everything, including the
  proxy and MCP. `app.ts` logs instead; keep it that way.
- **No HTTP server in the Electron main process that the app's own pages load from.** A sync Electron call
  waiting on a renderer that waits on that server deadlocks. The test site runs in a child process.
- **The proxy must report real Chrome target ids** (`Target.getTargetInfo`). Playwright assumes
  main frame id == target id. One debugger session per tab is shared by all clients; events fan out.
- **A brand-new `webContents` has no renderer, and CDP commands wait for one.** Tabs go
  `about:blank` → real URL; clients attach only after `tab.ready`.
- **Chromium holds CDP commands to a tab until its navigation commits.** A site that never answers hung
  `connectOverCDP` and with it opening the task; the proxy shows a tab only once its site has answered
  (`tab.answered`, test `/hang`).
- **Do not present profiles as Google Chrome.** Google refused to sign in a profile that did ("This browser or app
  may not be secure") and lets Electron's own Chromium in; GoDaddy's Kasada did not need it either. Kulisa presented
  as Chrome from 2026-10-05 to 2026-10-12 on reasons never tested one at a time (REPORT, "Chrome mimicry dropped").
- **Electron drops session cookies on exit.** Entra and federated sign-ins depend on them, hence
  `session-cookies.ts`. Tests must quit with `app.quit()`, not `app.exit()`, so `before-quit` runs.
- **Pages with Trusted Types (Microsoft 365, Google) refuse HTML strings**, so Playwright's
  `screencast.showOverlay(html)` draws nothing there. `locator.highlight()` and `screencast.showActions()` work;
  use those (test page `/strict`).
- **GoDaddy SSO uses Kasada.** Sign-in passes in an embedded profile when no automation is attached during
  sign-in (the sign-in pause).
- **With the monitor off or the screen locked**, Chromium renders at 1–2 fps, and anything waiting for frames
  crawls. Don't trust timings taken then (`xset q` shows "Monitor is Off").
- **A right-click on a drag region froze the whole Ubuntu desktop** (GNOME 46, X11): GNOME's window menu opened at a
  NaN place, invisible, holding the pointer and keyboard grab until the overview opened. The window cancels
  `system-context-menu` on Linux (`window.ts`; `docs/window.md`, The title bar).
- **Profiles coming back on `about:blank`** (their saved tabs `[]`): fixed twice on 2026-10-08, by two different
  paths (a profile still opening; tabs closing as Kulisa quits). Read `docs/profiles.md`, "Tabs that come back",
  before looking for a third.
- **A test run used whatever test site listened on its port.** With the port fixed (:4417), a stale server from an
  earlier run, or another worktree's run, made tests lie. `npm test` now starts a site of its own on a free port
  (`KULISA_TEST_SITE`); tests take the address from `SITE`/`PORT` in `helpers.ts`, never a literal port.
