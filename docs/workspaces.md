# Projects and workspaces

How projects and their workspaces work today: what they are, what the human does, what Kulisa creates on the
computer and removes again, and where the code is. The decisions behind them and what is still to do:
[ROADMAP.md](ROADMAP.md), "Workspaces" and "Choosing the agent". Profiles: [profiles.md](profiles.md). Keep this file
current when they change.

## Projects

A **project** is a folder, usually a repository, with its workspaces. Kulisa keeps its data in its own data folder
(`projects/<id>/`), never in the project's folder, so sign-ins stay out of its git.

- **One project is open at a time.** The project button in the title bar is a menu of the projects (each with its
  color and folder), Open Folder…, and Manage Projects… (a dialog: also New Project, a project without a folder of
  its own: Kulisa makes `~/Kulisa/<name>`). Opening another closes this one: all its workspaces saved, their agents
  stopped. Coming back restores them and resumes their agents. The window builds the other grid in place, hidden
  until it is laid out, so nothing jumps.
- **Each project has a color** (a glow from the middle of the window, the logo's curtain, the name's plate), to tell
  projects apart at a glance.
- **The Welcome screen** (the term: CLAUDE.md) is what the window shows with no project open: at the first start, and
  after Close Project (the project button's menu), closing main, or removing the open project. Open Folder…, New Project…, the recent projects,
  and links (the website, the documentation, GitHub, reporting an issue; they open in the user's browser) with
  Kulisa's version. Later starts open the project opened last;
  `KULISA_PROJECT=<folder> npm start` opens that one.
- **The agent** of each workspace starts in the user's own shell, in the workspace's folder, as if the human typed
  it in a terminal there: the project's environment applies (direnv's `.envrc`, nvm, mise; e.g. a project's
  `CLAUDE_CONFIG_DIR`, another Claude account), not the one Kulisa was started with. When it exits, the shell stays.
  On Windows it starts directly, without a shell (ROADMAP, Open issues).

## Workspaces

A **workspace** (WS) is one line of work in a project: code on a branch, browser profiles, a grid of panels and an
agent in a terminal. Several workspaces let several agents build several features of one project at once.

- **Main** (workspace 1) is the project itself: its folder, the branch checked out there, its profiles with the
  human's sign-ins. It is permanent; closing it closes the project.
- A **fork** is a temporary workspace made from main: a git worktree on a branch of its own next to the project,
  copies of main's profiles (signed in), its own agent. Its work goes back into main through git (merge or pull
  request); then the fork is closed, which deletes it. A fork never becomes main.

Example: the project `~/IdeaProjects/myshop`, a fork named "Checkout redesign":

```
~/IdeaProjects/myshop/                    main: the project's own folder
~/IdeaProjects/myshop@checkout-redesign/  the fork: a worktree on the branch checkout-redesign
```

## What the human does

- **The strip** under the grid: a tab per workspace, with the agent's state as a dot (working, waiting for you,
  done; from Claude Code's hooks only). A click shows that workspace: its grid and terminal slide in as macOS
  desktops do (not with reduced motion). The one left keeps running.
- **+** asks for a name and the agent (main's by default) and makes a fork. Off without git: then **Initialize
  git…** runs `git init` in the project after a confirmation (nothing is committed); + stays off until the first
  commit.
- **×** on a fork closes and deletes it, after a question: what goes for good (its folder, branch, profile copies,
  its agent's conversations) and any work not in main (commits of its own, uncommitted files), as removing a
  project asks. **×** on main closes the project: the window
  shows the Welcome screen.
- **Change agent…** in the terminal's right-click menu picks another agent for the shown workspace.

## Creating a fork, step by step

1. **Code** (`worktrees.js`). The repository of the project's folder must have a commit. The branch starts as Claude
   Code's `--worktree` starts one: from the remote's default branch after `git fetch` (`origin/main`), else from
   `HEAD`. Uncommitted changes of main are not carried. The branch and the folder take the name, lower case with
   dashes (`checkout-redesign`, then `-2`, `-3` if taken):
   `git worktree add --no-track -b <branch> <repo>@<branch> <start>`. `--no-track`: pushing the fork's branch never
   goes to the default branch.
2. **Files outside git** are copied from main when git ignores them and they are untracked: `.env*` and
   `.claude/settings.local.json` at the top, and whatever the project's `.worktreeinclude` names (gitignore syntax,
   as Claude Code reads it). Dependencies (`node_modules` …) are not copied: the agent installs them (the skill
   says so).
3. **direnv.** When `.envrc` was copied and main's `.envrc` is allowed, Kulisa runs `direnv allow` for the fork's
   folder: same content. Without it the fork would miss the project's environment (e.g. `CLAUDE_CONFIG_DIR`, and
   its agent would run with another account).
4. **Profiles** (`Workspace.forkProfilesInto`). Each of main's profiles is copied, sign-ins included: open ones are
   flushed first (cookies, storage, session cookies), every folder is copied without Chromium's caches. Closed
   profiles stay closed; open ones open with their active tab only. Main's grid comes along.
5. **Ports.** The fork gets a port offset no other workspace of the project has: 100, 200, … (main 0). Its copied
   tabs on local addresses move by it (`localhost:3000/cart` → `localhost:3100/cart`); cookies do not depend on
   the port, so they stay signed in. The agent gets the offset as `KULISA_PORT_OFFSET`.
6. **The agent.** A new conversation in the fork's folder, with the agent chosen in the dialog. When it is Claude
   Code and main's folder is trusted in Claude's config, the fork's folder is marked trusted too, so Claude does
   not ask (`agents.js`).
7. The fork is shown.

## What is on the computer

In Kulisa's data folder (`~/.config/Kulisa` on Linux, `~/Library/Application Support/Kulisa` on macOS,
`%APPDATA%\Kulisa` on Windows), laid out as Chrome lays out its user data (`store.js`):

```
projects.json                     the projects: id, name, folder, color
settings.json                     the Kulisa zoom, the project opened last
deleted-folders.json              folders to remove at the next start (a session keeps its files open)
projects/<project id>/
  workspaces.json                 { next, current, list: [{ n, name, branch, worktree, folder, base, offset }] }
                                  main is { n: 1, name: "main" }; base: the commit the fork started from
  1/                              main
    profiles.json                 its profiles in order: folder, id, name, color, sites' zoom, closed
    layout.json                   its grid (dockview)
    agent.json                    { agent, started, sessionId, transcript }: which agent, its conversation
    Profile 1/                    a Chromium profile (session.fromPath), with Kulisa's own files in it:
      Kulisa Tabs.json              the URLs of its tabs
      Kulisa Session Cookies.bin    its session cookies, encrypted with the OS keyring
    Profile 2/ …
  2/, 3/ …                        forks, the same inside
```

Outside it:

| What | Where | Made when |
|---|---|---|
| The fork's folder | `<repo>@<branch>/`, next to the repository | creating a fork |
| The fork's branch | the repository (`git branch`) | creating a fork |
| git's worktree record | `<repo>/.git/worktrees/<branch>/` | creating a fork |
| direnv's permission for the fork's `.envrc` | direnv's data (`~/.local/share/direnv/allow/`) | creating a fork, if main's is allowed |
| Claude Code's trust of the fork's folder | Claude's config: `<CLAUDE_CONFIG_DIR>/.claude.json`, else `~/.claude.json`, `projects["<fork folder>"]` | the fork's Claude starts, if main is trusted |
| The agent's conversation | the agent's own data (Claude: `<config dir>/projects/…/<session>.jsonl`; Codex: `~/.codex/sessions/`) | the agent runs |
| The agent itself, when Kulisa installed it | its maker's place (`~/.local/bin/claude`, `~/.local/bin/codex`, …) | Install in the agent dialog |

Nothing is written into the project's own folder (main's).

## Deleting a workspace: what goes

One function deletes a workspace (`deleteWorkspace` in `app.js`), whether a fork is closed (×) or its project
removed. A deleted fork leaves nothing on the computer that Kulisa or its agent made for it. Kulisa stops its agent
and closes its profiles, then deletes:

- the worktree folder (`git worktree remove --force`) and its branch (`git branch -D`); a copy already pushed stays
  on the remote;
- direnv's permission for its `.envrc`: the records in `<XDG data>/direnv/allow/` naming it (`worktrees.js`; not
  `direnv deny`, which newer direnv records too);
- its data folder `projects/<id>/<n>/`, profiles with their sign-ins (also listed in `deleted-folders.json`,
  removed at the next start if a file was still open);
- what its agent keeps of the fork's folder (`agents.js`, each agent's `forget`; undocumented layouts, so what is
  not found is skipped):
  - Claude Code, in the config dir its sessions used: `projects/<folder>/` (every conversation there),
    `file-history/`, `session-env/`, `debug/`, `todos/` of those sessions, the folder's lines in `history.jsonl`,
    and `projects["<folder>"]` in `.claude.json` (the trust Kulisa gave it). Never main's folder.
  - Codex, in `CODEX_HOME` (`~/.codex`): the session files whose folder is the fork's (`sessions/`,
    `archived_sessions/`) and `[projects."<folder>"]` in `config.toml`. Not its own databases (`state_*.sqlite`):
    their format is Codex's alone, so a record of the thread may stay there.

Main is deleted the same way when its project is removed, but only its data folder: the project's folder, and what
its agent keeps of it, are the human's, as without Kulisa.

What stays in any case: an agent Kulisa installed (it serves every project).

## Removing a project

**Remove Project…**: in the project button's menu (the open project), Manage Projects… (a button per project), and
a recent project on the Welcome screen (its × on hover, or its right-click menu). All call one function (`removeProject` in `app.js`):
Kulisa asks first, saying what goes and which forks have work not in main; closes the project if it is open;
deletes each of its workspaces as above, forks first; then removes it from `projects.json` with its data folder
`projects/<id>/`. The project's own folder stays as it is.

## While Kulisa runs

- The window shows one workspace. The others keep running: their pages and agent go on, their pages hidden.
- A workspace loads (its profiles start, its agent starts) the first time it is shown, also after a restart.
- Each workspace has its own MCP URL, `http://127.0.0.1:4450/ws/<n>/mcp`, and hooks under `/ws/<n>/hooks/`; its
  agent gets them in its environment (`KULISA_MCP_URL`, `KULISA_URL`) and sees only its workspace's profiles.
  Profile ids repeat across workspaces; inside Kulisa a profile is `<n>/<id>` (CDP proxy, highlights).
- Opening another project closes all workspaces of this one; coming back, or restarting, restores them and resumes
  their agents where the agent can (Claude `--resume`, Codex `resume --last`).

## Removing everything by hand

Quit Kulisa first (it writes its data on quit). Then, for a project:

```sh
cd ~/IdeaProjects/myshop
git worktree list                         # the forks: <repo>@<branch>
git worktree remove --force ../myshop@checkout-redesign
git branch -D checkout-redesign
rm -rf ~/.config/Kulisa/projects/myshop   # all its workspaces and profiles, sign-ins included
```

## The code

| File | What |
|---|---|
| `src/main/app.js` | open, show, create and close workspaces (one at a time, `serial`); IPC; the window's state |
| `src/main/workspaces.js` | a workspace: its profiles, its agent (start, change, environment), a fork's profile copies, ports |
| `src/main/worktrees.js` | git: the fork's worktree and branch, files outside git, direnv, changes, removal |
| `src/main/agents.js` | the agents to choose from: find, install, start, resume; Claude's folder trust |
| `src/main/store.js` | the data folder above |
| `src/main/terminal.js` | a terminal per workspace |
| `src/renderer/workspaces.js` | the strip and the new-workspace dialog |
| `src/renderer/agent-picker.js` | choosing and installing an agent (loaded when needed) |
| `src/renderer/renderer.js` | building a workspace's grid, the slide |
| `test/workspaces.js` | the tests; `test/restart.js` after a restart |
