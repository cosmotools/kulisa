# Projects and workspaces

How projects and their workspaces work today: what they are, what the human does, what Kulisa creates on the
computer and removes again, why it is built so, and where the code is. What is still to do:
[ROADMAP.md](ROADMAP.md). Profiles: [profiles.md](profiles.md); the window: [window.md](window.md). Keep this file
current when they change.

## Projects

A **project** is a folder, usually a repository, with its workspaces. Kulisa keeps its data in its own data folder
(`projects/<id>/`), never in the project's folder, so sign-ins stay out of its git.

- **The projects' bar**: each open project an island of its own, as an app in a dock with its windows: its label
  (its icon, the app's logo with the curtain in the project's color, and its name), then a tab per workspace with
  its agent's state (below). Every open project's workspaces are there, so a click on any of them shows that project with it; the
  others keep running, their agents and pages. The bar is in the middle under the grid, where the hand goes for the
  terminal anyway, or over it (☰ → Projects bar: Top, Bottom; saved). Each island looks like a tab of the grid: square
  where it meets the grid and merging into it with curves, rounded towards the window's edge.
  - **Nothing in it moves** when another project or workspace is shown: every island keeps its width (another
    project's keeps the room of the shown one's +; every tab the room of its ×; a project without git keeps the room
    of its +),
    and the shown project's tabs come with the projects' news, not after it. Islands that moved under the mouse made
    the human miss (the author, 2026-10-08).
  - **The label is no button**: its workspaces are what is clicked (two ways to the same thing confused). Closing the
    project: main's ×, the middle button on its label, or Close Project in its right-click menu (with Move to New
    Window, Move to Window, Show Data Folder, Remove Project…). Closing asks first
    (the author's decision, 2026-10-07; before, only when its agent was working), and says so when an agent is still
    working.
  - **The button after the islands** is the menu of the projects (each with its color and folder, the open ones marked
    ✓; × on hover removes one), New Project…, Open Folder…, Close Project and Remove Project… (the shown one). No
    separate Manage Projects dialog: as in JetBrains, the menu and the Welcome screen do it all.
- **New Project…**, as JetBrains': a name and a location, the user's home folder unless they type or browse to
  another; the dialog shows the folder it makes (`<location>/<name>`; one that is there must be empty), so the human
  knows where the agent's files are. Create Git repository is on by default (`git init`, nothing committed):
  workspaces need git.
- **Opening another project** (the + menu, Open Folder…, New Project…) in a window with projects open asks where, as
  JetBrains does: **This Window** adds its tab at the end and shows it, the one on screen keeps running; **New
  Window** opens it in a window of its own. From the Welcome screen (no tab open) it opens in that window without a
  question; a project already open is shown in its window. Showing
  another project slides the grid towards its island, as macOS desktops do (a view transition on the compositor, the
  pages as pictures meanwhile; not with reduced motion); the window builds the other grid in place, so nothing jumps.
  **Closing a project** stops the project's agents and closes its profiles (tabs and sign-ins kept); the
  tab next to it is shown, or the Welcome screen when it was the last. Opening it again restores its workspaces and
  resumes their agents.
- **Move to New Window** (the label's right-click menu) puts the project into a window of its own, next to this one, e.g.
  to drag it to a second monitor; **Move to Window: …** (one item per other window, named by its projects) puts it
  into that window, as a browser moves a tab. It keeps running: its agents, its pages (the same ones, moved, not
  loaded again), what its terminals showed. The only tab of a window does not go to a new window; moved into another
  one, its window closes. **Dragging a label** does the same with the mouse: within the bar it changes the order
  (kept); let go on another window's bar, the project moves there, where it was let go; let go outside every Kulisa
  window, it opens in a new window there (the window appears when the mouse is let go, as in VS Code). Each window has
  its bar and its projects' menu (a project open in another window is marked ✓ too; choosing it brings that window
  to the front). The OS's × on a window closes its projects, as closing each would, after one question ("Close the window?"); on the last
  window it quits Kulisa, and the windows with their projects open again at the next start, where they were: nothing
  is lost, so it asks only when that would stop a working agent ("Quit Kulisa?"). A window whose last project is
  closed closes too, unless it is the only one: then it shows the Welcome screen.
- **Each project has a color** (the shown one's: a glow from the middle of the window, the logo's curtain; each one's
  curtain on its label in the bar), to tell projects apart at a glance.
- **The Welcome screen** (the term: CLAUDE.md) is what the window shows with no project open: at the first start, and
  after the last project is closed (Close Project, the middle button on its label, removing the project). New Project…, Open
  Folder…, the recent projects (a click opens one, × or a right-click removes it), and links (the
  documentation, GitHub, reporting an issue, also in ☰; they open in the user's browser) with Kulisa's version. Later starts
  open the windows that were open, each with its projects, showing the one shown last (`windows` in `settings.json`);
  `KULISA_PROJECT=<folder> npm start` adds that one to the first window and shows it.
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

- **Its tabs** in its project's island in the projects' bar: a tab per workspace, with the agent's state as an icon
  (working, waiting for you, done; from its hooks: "Choosing the agent"). A click shows that workspace, at once, as
  Chrome switches tabs: no slide or fade (a flash over the whole grid at every switch; a slide made the workspaces
  and the projects look alike). The pages come in the same frames as the terminal: the view transition that holds
  the old grid's picture while the next one is built runs no animation at all, Chromium's own for its groups
  included (it kept the pages, shown when it ends, 250 ms behind the terminal). The one left keeps running. Another
  project's island marks the workspace it shows (a step brighter): where that project is when shown again.
- **+** asks for a name and the agent (main's by default) and makes a fork. Forks need git and a first commit:
  until then there is no + (its room kept), and nothing in the window offers git: who wants workspaces finds why
  here (the author's decision, 2026-10-08; an Initialize git… button made the bar busier for the few who need it).
  The bar checks again when the pointer comes to the island (a commit made in the terminal).
- **×** on every workspace's tab, of any open project, under the pointer and on the shown one, as in Chrome (its
  room kept). On a fork it deletes it, after a question: what goes for good (its folder, branch, profile copies, its
  agent's conversations) and any work not in main (commits of its own, uncommitted files), as removing a project
  asks. On main it closes the project, after its question.
- **Change agent…** in the terminal's right-click menu picks another agent for the shown workspace.

## Actions: the human's and the agent's

As for profiles ([profiles.md](profiles.md), "Actions"), each action is written once, in the core, with its question
to the human; the window's IPC (`app.js`) is a handle on it. The agent has no handle on projects and workspaces yet:

| Action | The human | The agent | The core |
|---|---|---|---|
| Open a project | + menu, Open Folder…, New Project…, the Welcome screen | none: it works inside one project | `openLater` (`app.js`), asking This Window or New Window; then `openProject` or `openInNewWindow` |
| Close a project | main's ×, the middle button on its label, Close Project (its right-click menu, the projects' menu) | none: it would stop itself | `closeProjects` (`app.js`), asking first |
| Close a window, quit | the OS's ×, ☰ → Exit | none | `closeProjects` for the window's projects; `quit` (`app.js`), asking only when an agent works |
| Move a project | Move to New Window, Move to Window, dragging its label | none: where the human sees it is the human's | `moveProject` (`app.js`) |
| Remove a project | Remove Project…, ×, the Welcome screen | none: it deletes sign-ins, the human's to decide | `removeProject` (`app.js`), `askRemoveProject`, `removeProjectData` (`projects.js`) |
| Make a fork | + in its project's island | not yet (ROADMAP, "Workspaces, rest") | `Project.createFork` |
| Close (delete) a fork | its ×, in any open project's island | not yet (same) | `Project.askDeleteFork`, `deleteFork` |
| Show a workspace | a click on its tab, of any open project | none: what the human looks at is theirs | `AppWindow.showWorkspace`, then `show` its project (`window.js`) |
| Change the agent | Change agent… (the terminal's menu) | none: the human's choice | `Workspace.changeAgent` |

## Choosing the agent

Each workspace runs the agent the human chose for it (its `agent.json`); Kulisa never assumes one is installed (it
started `claude` without asking until 2026-10-06). When a workspace has none, or its agent is not on the computer, a
dialog asks: Claude Code (Anthropic), Codex (OpenAI) or the terminal only, each with what it needs and whether it is
on this computer. One that is not has **Install**: Kulisa runs its maker's own installer (the command shown before,
its output while it runs), with no steps for the human to type, for people who are not programmers. Then the agent
starts and asks the human to sign in to it. A new fork proposes main's agent; another can be picked in its dialog.
**Change agent…** (the terminal's right-click menu) opens the same dialog, with Cancel, and starts the chosen agent
with a new conversation: the way back when, say, Codex was chosen without a Codex account. `KULISA_AGENT` forces one
command everywhere, without asking.

- The installers are the makers' official native ones (no Node, no sudo, they update themselves; checked
  2026-10-06): Claude Code `curl -fsSL https://claude.ai/install.sh | bash`, Codex
  `curl -fsSL https://chatgpt.com/codex/install.sh | sh` (`install.ps1` on Windows).
- Each agent is one entry in `agents.js`: how to find, install, start (Claude Code with the Kulisa plugin; Codex
  with the MCP server and its hooks as config overrides, `-c mcp_servers.kulisa.url=…`, `-c hooks=…`), resume
  (`claude --resume` and `codex resume` with the session the `SessionStart` hook reported; else `codex resume
  --last`) and forget a fork's folder.
- **Agents…** (☰, and the Welcome screen, before any project) opens a dialog of its own with the same list at any
  time, with nothing to choose: each agent's version (its `--version`), its folder (marked when it is not on the user's `PATH`: Kulisa runs it
  from there), its maker's website, and Install for the others. Installing there starts nothing; the agent is chosen
  for a workspace when one is made, or with Change agent…. Kulisa does not remove or update agents: they are the
  user's programs, and the makers' installers update them themselves.
- The dialog is part of the window, not a window of its own: no extra process, and its code is a module loaded only
  when it is needed: `agent-picker.js` (choosing) and `agents.js` (the Agents window) are two dialogs of their own
  around one list of agents with Install (`agent-list.js`), each with its own state.
- The agent's state on the tabs comes from its hooks. Kulisa has events of its own (`agent-hooks.js`): `prompt`
  working, `waiting` for the human, `stop` done, `interrupt` and `session-end` unknown (but a session ending after a
  done turn keeps it). Which of an agent's hooks sends which is the agent's, in one place each:
  - Claude Code, its plugin's `hooks.json` (checked with 2.1.293, 2026-10-08): `UserPromptSubmit`, `Stop`, and
    waiting when it asks for a permission or a question (`Notification` matched to `permission_prompt`,
    `elicitation_*`) or a turn ends with an API error (`StopFailure`: a limit, a sign-in); `SessionEnd` (`/exit`,
    `/clear`). Not `idle_prompt`, sent a minute after an answer: the tab already says done. Esc ends a turn without
    any hook, so the tab says working until the next prompt.
  - Codex, its entry in `agents.js` as a config override (`-c hooks=…`; built from its documentation, not yet tried in
    a session: ROADMAP): `UserPromptSubmit`, `PermissionRequest` waiting, `Stop`, `Interrupt` (Esc), `SessionEnd`
    (also after 30 minutes idle), and `SessionStart`, which gives it the open profiles as Claude Code gets them and
    the session to resume. Codex runs a hook only once the human has trusted it (`/hooks`, once: the command line is
    the same for every workspace); Kulisa never bypasses that, which would run any project's hooks unreviewed too.

  Done means "come and see": once the human sees that workspace (shown with
  Kulisa's window in focus; at once when it was on screen) its tab shows nothing (`Workspace.seen`, `tabState`), the
  agent still done for the rest of Kulisa.
  Other agents show none yet (ROADMAP).

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
`%APPDATA%\Kulisa` on Windows), laid out as Chrome lays out its user data (`store.js`). Show Data Folder in a
project label's right-click menu opens its `projects/<id>` in the file manager (`shell.openPath`), for the human who
asks where it is or what takes the disk; nothing in it is for editing by hand, so it is no button in sight:

```
projects.json                     the projects: id, name, folder, color
settings.json                     the Kulisa zoom, the theme, where the projects' bar is; the windows: each one's
                                  projects (in the bar's order), the one shown, where it was
deleted-folders.json              folders to remove at the next start (a session keeps its files open)
projects/<project id>/
  workspaces.json                 { next, current, list: [{ n, name, branch, worktree, folder, base, offset }] }
                                  main is { n: 1, name: "main" }; base: the commit the fork started from
  1/                              main
    profiles.json                 its profiles in order: folder, id, name, avatar, description, sites' zoom, closed
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

One function deletes a workspace (`deleteWorkspace` in `projects.js`), whether a fork is closed (×) or its project
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
  - Claude Code, in the config dir its sessions used: its conversations in `projects/<folder>/` (those recorded in
    the fork's folder: Claude names that folder with non-Latin letters as `-`, so other folders can share it),
    `file-history/`, `session-env/`, `debug/`, `todos/` of those sessions, the folder's lines in `history.jsonl`,
    and `projects["<folder>"]` in `.claude.json` (the trust Kulisa gave it). Never main's folder.
  - Codex, in `CODEX_HOME` (`~/.codex`): the session files whose folder is the fork's (`sessions/`,
    `archived_sessions/`) and `[projects."<folder>"]` in `config.toml`. Not its own databases (`state_*.sqlite`):
    their format is Codex's alone, so a record of the thread may stay there.

Main is deleted the same way when its project is removed, but only its data folder: the project's folder, and what
its agent keeps of it, are the human's, as without Kulisa.

What stays in any case: an agent Kulisa installed (it serves every project).

## Removing a project

**Remove Project…**: in the projects' menu (Remove Project… for the shown project; any project's × on hover), a
project label's right-click menu, and a recent project on the Welcome screen (its × on hover, or its right-click menu). All call one function (`removeProject` in `app.js`):
Kulisa asks first, saying what goes and which forks have work not in main; closes the project if it is open;
deletes each of its workspaces as above, forks first; then removes it from `projects.json` with its data folder
`projects/<id>/`. The project's own folder stays as it is.

## While Kulisa runs

- Each window shows one workspace of its shown project. The others keep running, the other open projects' too: their
  pages and agent go on, their pages hidden.
- A workspace loads (its profiles start, its agent starts) the first time it is shown, also after a restart.
- A workspace is known among all open ones by its key, `<project id>/<n>` (the window, the terminals). Each has its own
  MCP URL, `http://127.0.0.1:4450/ws/<project id>/<n>/mcp`, and hooks under `/ws/<project id>/<n>/hooks/` (each part
  percent-encoded: ids have letters of any language); its agent gets them in its environment (`KULISA_MCP_URL`,
  `KULISA_URL`) and sees only its workspace's profiles. Profile ids repeat across workspaces; inside Kulisa a profile
  is `<project id>/<n>/<id>` (CDP proxy, highlights).
- Closing a project stops all its workspaces; opening it again, or restarting, restores them and resumes their
  agents where the agent can (Claude `--resume`, Codex `resume`).

## Removing everything by hand

Quit Kulisa first (it writes its data on quit). Then, for a project:

```sh
cd ~/IdeaProjects/myshop
git worktree list                         # the forks: <repo>@<branch>
git worktree remove --force ../myshop@checkout-redesign
git branch -D checkout-redesign
rm -rf ~/.config/Kulisa/projects/myshop   # all its workspaces and profiles, sign-ins included
```

## Why it is built this way

Designed with the author on 2026-10-06 and 2026-10-07.

- **Main is permanent, forks are temporary, and a fork never becomes main**: no pointer to move, no branches
  swapped. Something a fork needs that main lacks (a new sign-in) is done in main; later forks get it.
- **Code through git only.** The fork's folder is next to the project (`myshop@<ws>`): visible, and it opens in an
  IDE; inside the project, IDEs and tools would see the code twice. Kulisa writes nothing into the project's folder.
  A project without git has no forks; `git init` runs only on the human's click: run without asking, it could put
  secrets into history, or a huge folder, or nest a repository.
- **A new conversation for a fork**, not a fork of main's (`--fork-session`): the fork's code starts clean, and an
  agent remembering main's unfinished edits would be misled. Started in the fork's folder, it has no questions about
  access outside it.
- **Profiles copied, sign-ins included.** Accepted risk: with real SSO, rotated tokens may sign a copy or the
  original out. `session.fromPath` keeps the caches inside the profile (they cannot live elsewhere), so a copy
  skips them; a profile copied while open, after a flush, opens signed in (checked on Linux).
- **Storage as Chrome lays it out**, so what is known about Chrome's storage applies. `Profile N` folders are fixed
  at creation: a rename touches only `profiles.json`.
- **One port offset per workspace** moves any number of services with one number. Cookies do not depend on the
  port, so the copies stay signed in to the app (separate hostnames such as `checkout.localhost` would lose that).
  The local database is the developer's matter (`docker compose` already names containers after the folder, so a
  fork gets its own; only published ports clash). An app that cannot change its port (hard-coded, OAuth bound to
  `localhost:3000`) cannot run in a fork; the agent says so.
- **Every fork asks before it is deleted**, also one without changes (at first that one went without a question,
  as with Claude Code's `--worktree`): its conversation and profile copies go too, and × is easy to hit by mistake.
- **A workspace loads when first shown**, not at the start: after a restart nothing works in the background anyway,
  and the agent starts at its terminal's real size.
- **Workspaces and projects in the background keep running**, their pages and agents. Memory: each agent is a
  process of its own (Claude Code about 200–400 MB) plus its profiles' tabs.
- **Another project opens beside the shown one** (an island in the bar), as a browser opens a tab. At first opening
  one closed the shown one and stopped its agents; now the human closes a project when it is safe.
- **Several windows are one Kulisa**, not a second instance: two cannot share the data folder. A project moves with
  its pages' native views (`Profile.moveTo`), not loaded again, and with what its terminals show (xterm's serialize
  addon, as VS Code keeps terminals), at their size, so its agent is never told a default one. A window is one more
  renderer process for Kulisa's own page, only while it is open.
- **Claude's trust of a fork's folder**: Claude's config is undocumented; when the file is not as expected, nothing
  is changed and Claude asks as usual. Claude rewrites that file often; Kulisa writes it whole at once (a rename),
  and a write of Claude's at the same moment may undo it (then Claude asks).

## The code

| File | What |
|---|---|
| `src/main/app.js` | the windows; open, close and move projects (one change at a time, `serial`); IPC |
| `src/main/window.js` | a window: its open projects, show a project or a workspace, the grid's state, its questions |
| `src/main/projects.js` | an open project: its workspaces; making a fork, deleting one (with the question); removing a project's data |
| `src/main/workspaces.js` | a workspace: its profiles, its agent (start, change, environment), a fork's profile copies, ports |
| `src/main/worktrees.js` | git: the fork's worktree and branch, files outside git, direnv, changes, removal |
| `src/main/agents.js` | the agents to choose from: find, install, start, resume; Claude's folder trust |
| `src/main/store.js` | the data folder above |
| `src/main/terminal.js` | a terminal per workspace |
| `src/renderer/projects.js`, `new-project.js` | the projects' bar (an island per project) and the projects' menu, the Welcome screen; New Project… (loaded when needed) |
| `src/renderer/workspaces.js` | the workspaces' tabs in the bar, the new-workspace dialog |
| `src/renderer/agent-picker.js`, `agents.js`, `agent-list.js` | choosing a workspace's agent; the Agents window; the list of agents with Install that both show (loaded when needed) |
| `src/renderer/renderer.js`, `window.css` | building a workspace's grid; the slide (a view transition) |
| `test/workspaces.js` | the tests; `test/restart.js` after a restart |
