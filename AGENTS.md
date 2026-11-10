# Kulisa

Kulisa is an agentic IDE where you and your chosen coding agent develop, run, and test software together.
The Electron app runs unchanged agent CLIs in development terminals; Kulisa's MCP server gives them browser
profiles and Stage terminals to test web and command-line apps. The human can operate the same environments,
signs in to real accounts and points to page elements with Pick. Tasks let several agents work on one project.

## Working with the author

- Raise design problems and material costs before building. Explain why and recommend a solution; the author
  decides. Revisit a settled decision only with new evidence or an architectural conflict, including in these rules.
- Fix architectural faults encountered by the change rather than building around them. Name them in the plan.
- Choose tools and designs by capability, RAM, maintenance, license and fit, not migration effort. Preserve required
  behavior and workarounds; leave deferred features deferred.
- Report additions and deletions separately for code, tests and docs, excluding lockfiles and pictures:
  `code +203 −95 · tests +52 −13 · docs +23 −8`. Include this at commit and in the PR; explain disproportionate scope.

## Conventions

### Worktrees and pull requests

- Check GitHub issues and open PRs before starting; respect deferred decisions. Record ideas and bugs as issues
  (`enhancement`, `bug`), not repository notes. Close the issue when its work is complete.
- Before editing, create a dedicated worktree from local `develop`, or the author's named base:
  `git worktree add .worktrees/<name> -b <name> develop`. Work and commit there.
- The repository's root checkout always holds `develop`: never edit, commit, merge or switch branches there.
  After a PR merges, update it with `git -C <repo> pull --ff-only origin develop`.
- Without dependency changes, link `node_modules`: `ln -s ../../node_modules node_modules`. With dependency changes,
  install locally with `npm install`, then `npm run postinstall`.
- When the author asks to commit, commit, push (`git push -u origin <name>`) and open a PR into `develop`.
  Describe the change, validation, cost and what changed in `src/ui` and why, or state that it is unchanged.
- Only the author merges PRs. Never push to or merge into `develop` or `main`, or merge `main` back into `develop`.
  Report when required checks are green; `develop` requires the release checks below except `version`.
- After merge or abandonment, remove the worktree and its local and remote branches (`git worktree remove`,
  `git branch -D`, GitHub's API). Update the root checkout after a merge.
- Use the `run-kulisa` skill from the worktree being reviewed, and from the root checkout after merge.

### Development skills

- Development skills live in `.agents/skills/`, with Claude Code entrypoints in `.claude/skills/`.
- Use `find-skills` for skill discovery and installation. Install third-party development skills locally for Codex
  and Claude Code; keep their records in `skills-lock.json` and ignore installed directories and links in `.gitignore`.
  Keep downloaded skills unchanged; put project-specific rules in this file or the owning doc.
- Run `npx skills experimental_install` from the checkout root to restore third-party skills from `skills-lock.json`.
- Restore Claude Code's skill links with Skills CLI, using the sources and skill names in `skills-lock.json`.

### Sessions on different OSes

- Share one PR. Fix only what the session can reproduce and test, including shared code. Describe problems needing
  another OS in a PR comment for that session rather than fixing them blind.
- Start comments with agent and OS, e.g. "Codex (the Linux session), not the author"; they use the author's account.
- Before pushing to a shared branch, take its new commits with `git pull --rebase`.
- Read new PR comments when the author asks: `GET /repos/cosmotools/kulisa/issues/<n>/comments`.

### GitHub access

- Use GitHub's API via `curl`, not `gh`. Never print the remote URL: it contains the author's token.
- Read the token into a shell variable without printing it:
  `T=$(git config --get remote.origin.url | sed -E 's#^https://[^:@/]*:?([^@/]*)@.*#\1#')`.
  Call `curl -sf -H "Authorization: Bearer $T" https://api.github.com/…`.
- Job logs (`GET /repos/cosmotools/kulisa/actions/jobs/<id>/logs`) redirect to a signed URL; fetch it without the token.

### Writing

- Write code, comments, docs and commit messages in English.
- Comments explain reasons, constraints and workarounds, not UI behavior or types. File headers identify the part
  and its doc. When renaming, check comments too.
- Technical docs give agents the knowledge needed to understand and change the project: purpose, boundaries,
  interactions, lifecycle, constraints and reasons for decisions. Omit implementation details readily found in code.
- Verify descriptions against the code; existing docs are not proof of current behavior. Keep commands and examples
  correct and usable.
- Document the current state; put history, dates and verification versions in git. Keep required minimum versions.
  Mark unexplained taste decisions "(the author's choice)".
- Keep each fact in its owning doc; elsewhere use a short pointer and link. The user guide stays self-contained.
- Shorten without losing conditions, exceptions or necessary reasons; keep rules unambiguous. Remove repetition
  when editing a section; keep whole-doc rewrites in separate commits.
- Read the relevant docs below and keep them current. Update `docs/guide.md` in the same commit only when a change
  affects how users complete a task (actions, capabilities, requirements, restrictions or results), or makes existing
  guidance incorrect. Omit visual-only changes and routine loading/refresh details that do not affect those tasks.
  Use the user's words, no implementation names, only relative images from `docs/images/`, and no links to other docs.
- Code maps identify where to look, responsibilities and invariants to preserve, rather than listing every file.
  `README.md` covers running, environment variables and top-level folders; it and `CONTRIBUTING.md` also serve people.

## Terminology

Workbench UI names and the bar + item convention: [UI terminology](docs/ui.md#workbench-terminology).

| Term | Meaning |
|---|---|
| environment | Where the app under development runs: a browser profile or Stage terminal; no promise of machine or credential isolation. |
| Stage | The nested testing grid; Workbench has a separate grid. |
| profile | An embedded browser identity with its own cookies, storage, tabs and pane; an account is what it signs in to. |
| task | One line of work: agents, branch, profiles and grid, with its own git worktree beside the project. |
| tab | An open task in a window; projects are loaded while their tasks are open, not opened or closed themselves. |
| the tasks' bar | The bar of task tabs; "taskbar" means the OS's. |
| Settings | The title bar gear's view over the whole window; New Project is a separate sequence of steps. |
| the empty window | A window with no open task: title bar and project sidebar, or the welcome if there are no projects. |
| the welcome | The first-start introduction. |
| Kulisa plugin | The layer between agents and environments; "plugin" always means an agent's plugin. |
| Kulisa package | A self-contained part in `src/<package>/`, reached only through its entries; use both words to distinguish npm packages. |

## Implementation

- Support any agent CLI without requiring `claude` or a particular provider. Build core features on terminals, MCP,
  files and git, using Kulisa's own data and conventions. Keep CLI-specific capabilities optional and in the adapter.
- Prefer maintained open-source libraries over own code. Explain new dependencies in the commit message and check
  GPL-3.0 compatibility (`docs/LICENSING.md`).
- Before writing browser or CDP code, check installed `playwright-core`, `@playwright/mcp` and MCP SDK APIs.
  Read `node_modules/playwright-core/types/types.d.ts`; use existing picking, snapshots, highlights and action APIs.
- Before touching Electron, read the installed version's docs at
  `https://raw.githubusercontent.com/electron/electron/v<version>/docs/` and `node_modules/electron/electron.d.ts`.
- Before using shadcn/ui, use the installed `shadcn` skill. Apply
  [Kulisa's UI integration rules](docs/ui.md#shadcn-in-kulisa), which take precedence over its generic workflow,
  and read the component's generated source in `src/ui/`.
- Hand-written protocol code is limited to `cdp-proxy.ts`, which exposes `webContents.debugger` over CDP.
- Prefer lower RAM use; measure rather than guess (`ps -eo pid,rss,args`). Discuss noticeable increases with the
  author before building, including extra processes, retained hidden views and large buffers.
- Give every stored file an owner and a cleanup path. Delete it with its profile, task or project, including git
  and agent records; defer locked files through `deleted-folders.json`. Bound growing data except task results and
  agent working folders: these have no disk quota or automatic expiry (the author’s choice; `docs/tasks.md`, Artifacts
  and temporary files). Agents clean their own unneeded working files. Bound previews in memory. Document new storage.
- Every core action must leave a log line through existing channels, tools, hooks and lifecycle logging
  (`src/main/log.ts`). Additional lines identify the action and caller, never typed content or secrets; use `summary`.
- Support macOS, Windows and Linux. Avoid shell commands and platform-specific paths, signals or flags in app code
  without alternatives; keep platform branches together per concern. Record untested platform behavior in an issue.

## Rules

- Humans sign in to real accounts. Never automate their login, type their passwords or expose passwords, tokens
  or cookie values. The only exception is Kulisa's encrypted test-user login flow (`browser_type_login`): local app
  pages or pages reached from them, never account providers; the agent never sees the password. See
  `docs/profiles.md`, Test users' sign-ins.
- Never delete or overwrite the author's data in `~/.config/Kulisa`. Stop, start or restart their app only through
  `.agents/skills/run-kulisa/SKILL.md` to preserve cookies and tabs; diagnose running-app bugs with
  `.agents/skills/debug-kulisa/SKILL.md`. Run skill commands from the checkout root.
- Keep `src/main/signin-pause.ts` isolated and temporary (`docs/profiles.md`, Sign-in pause).
  Do not research or build bot-detection evasion (Kasada).
- Bind MCP and CDP only to `127.0.0.1`. Put every endpoint behind `local-only.ts`, preserving rejection of foreign
  Host and any Origin. Local-process authentication is issue #90.
- Keep `playwright-core >= 1.64`; picking, action annotations and recent console/request APIs require it.
- Never use `pkill -f`; it matches its own shell. Select Electron by `ps -eo pid,comm,args`, `comm == "electron"`.

## Architecture

- Follow `.dependency-cruiser.ts`, the authoritative layer list, enforced by `npm run deps` within lint.
  Layers use only lower layers; shared main/renderer code belongs in `src/shared/`.

| Layer | Responsibility |
|---|---|
| 1. Browser Kulisa package (`src/browser/`) | Profiles, tabs, storage; no agents, MCP or window UI. |
| 2. Automation access (`cdp-proxy.ts`, `local-only.ts`) | Automated page access and sign-in enforcement. |
| 3. Kulisa plugin (`src/kulisa-plugin/`) | Tools, instructions, hooks, CLI adapters, transcripts; core facts/actions via contracts in `src/main/plugin.ts`, no core domain imports, including types. |
| 4. Window (remaining `src/main/`, `src/renderer/`) | What the human sees and does. |

- **One core, with handles for the human and agent.** Write actions and their checks, questions and rules once in
  the core. IPC and MCP handles find the target, call the core and translate the result; they do not duplicate rules.
- Give new core actions both handles. Document justified exceptions in `docs/profiles.md`, Actions.
- Agent page interactions use Playwright through the proxy so actions remain visible and the sign-in pause holds.
  Automation-only restrictions stay in the agent's handle; focus and menu pictures stay in the window.
- **Tools for the agent:** Kulisa provides capabilities and instructions; the agent decides its workflow.
  A tool reports missing prerequisites rather than performing the agent's next steps. Core actions still enforce
  their own rules.
- Keep all CLI-specific code, including transcript readers, in `src/kulisa-plugin/main/agents/<agent>.ts`.
  Keep agent-facing behavior in the Kulisa plugin, with the same tools and shared instructions for every agent.
- Use the user's git without a shell (`worktrees.ts`); start agents in the user's shell and project folder so the
  project's environment applies (`src/terminal/`).
- Kulisa packages know nothing of the core and reach other Kulisa packages only through public entries.
  Read `docs/packages.md` before creating one or moving code into one; follow its own README and AGENTS.md.

## Hard-won facts

- Never create `webContents` inside another's `destroyed` event: Chromium teardown can crash with SIGTRAP.
  Create the last tab's replacement on the next turn (`Profile._removed`).
- Keep main-process exception logging in `app.ts`; an uncaught exception opens a blocking GTK dialog.
- Never serve the app's own pages from an HTTP server in Electron's main process: synchronous calls can deadlock.
  Run the test site in a child process.
- On Trusted Types pages, use `locator.highlight()` and `screencast.showActions()`; HTML overlays fail (`/strict`).
- Do not trust rendering timings with the monitor off or screen locked; Chromium throttles frames (`xset q`).
- Before diagnosing profiles restored to `about:blank`, read `docs/profiles.md`, Tabs that come back.
- Playwright attachment keeps pages visible and unthrottled through focus emulation. Electron's `setVisible(false)`
  hides them; see `docs/profiles.md`, How automation reaches the pages, and issue #52.

## Commands and checks

- When writing or changing E2E tests, follow [the E2E rules and harness reference](docs/testing.md#writing-an-e2e-test).
- **Code intelligence.** Use an available language server for definitions, references and types; check `test/` too.
  Without one, use `rg` to find candidates, then read declarations, imports, re-exports and callers. Text matches
  alone do not establish symbol identity or all references. Validate type-sensitive changes with
  `docs/testing.md`, Code analysis.

## Releases

- `develop` is for development; `main` is released automatically on merge. Only the author merges `develop` → `main`,
  with a merge commit, after `test (ubuntu-latest)`, `test (macos-latest)`, `test (windows-latest)`, `dependencies`
  and `version` pass. Ask the author to require a new OS's checks in branch rulesets when adding support.
- `package.json` owns the version. For each release raise it with `npm version <patch|minor> --no-git-tag-version`;
  CI creates the tag. While 0.x, use patch unless the author requests minor or the change is large; explain that choice.
  The version check permits an unchanged number only if it has no release yet.
- A release request authorizes the following PRs, not their merges:
  1. From a worktree based on `develop`, bump the version, commit `Kulisa <version>` and open a PR into `develop`.
  2. After the author merges it, open `develop` → `main`, titled `Kulisa <version>`. Describe user-visible changes
     since the last release (`git log origin/main..origin/develop`); the body becomes the release notes.
  3. Watch checks, fix failures through PRs into `develop`, and report when green.
  4. After the author merges, watch the release run and report publication or failure.
- A failed build or startup leaves an unpublished draft. Fix through the next release with another version bump;
  delete the failed draft with `DELETE /repos/cosmotools/kulisa/releases/<id>`.

## Documentation

| Read when changing | Document |
|---|---|
| Profiles, sign-ins, tabs, storage | `docs/profiles.md` |
| Projects, tasks, agents, Workbench items, task storage | `docs/tasks.md` |
| Window, grids, terminals, settings, keys, logging | `docs/window.md` |
| UI terminology, controls, icons, tokens, components, clusters | `docs/ui.md` |
| Packaging, installers, updates | `docs/releases.md` |
| Agent CLI versions or transcript readers | `docs/transcripts.md` (formats are undocumented) |
| Kulisa package creation or extraction | `docs/packages.md` and the part's README/AGENTS.md |
| User workflows and capabilities | `docs/guide.md` |
| Tests, checks, code analysis | `docs/testing.md` |
| Dependencies and licensing | `docs/LICENSING.md` (GPL-3.0-or-later) |
