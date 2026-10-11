# Projects and tasks

How projects and their tasks work today: what they are, what the human does, what Kulisa creates on the
computer and removes again, why it is built so, and where the code is. What is still to do:
[ROADMAP.md](ROADMAP.md). Profiles: [profiles.md](profiles.md); the window: [window.md](window.md). Keep this file
current when they change.

## Projects

A **project** is one configuration its tasks are made from: a name, a color and an icon, its agents (one the
default), its profiles (each a person in one store, [profiles.md](profiles.md)), and its code: one or more repositories
(one the default), or a folder without git (`~/Kulisa/<project>` by default, or one the human picks). The work is done in its tasks (below), each in copies of the
repositories (git worktrees), so the project's folders stay the human's. Kulisa keeps its data in its own data folder
(`projects/<id>/`), never in the project's folder, so sign-ins stay out of its git.

- **The projects' bar**, drawn as Chrome's tab groups: each open project an island of its own, its group: its label
  (its icon, the app's logo with the curtain in the project's color, and its name), a tab per open task with its
  agent's state (below), and + for a new task. Every open project's tasks are there, so a click on any of them shows that project with it; the
  others keep running, their agents and pages. The bar is in the middle under the grid, where the hand goes for the
  terminal anyway, or over it (☰ → Projects bar: Top, Bottom; saved). Each island looks like a tab of the grid: square
  where it meets the grid and merging into it with curves, rounded towards the window's edge.
  - **Nothing in it moves** when another project or task is shown: every island keeps its width (every one has its
    +; every tab the room of its ×), and the shown project's tabs come with the projects' news, not after it. Islands that moved under the mouse made
    the human miss (the author, 2026-10-08).
  - **A click on the label folds the group** to it, as Chrome's collapsed tab groups, and back (kept in
    `tasks.json`); the tab of the task it shows stays, so the grid on screen keeps its tab. Showing a project is a
    click on one of its tasks (two ways to the same thing confused, when the label showed it too). Its right-click
    menu: New Task, its **closed tasks** under a heading (the one closed last first; a click opens one again; Delete Merged
    Tasks… when some are merged), Close Project, Move to New Window, Move to Window, Project Settings…, Show Data Folder,
    Delete Project…. Closing a project: that menu, the
    middle button on its label, or × on its last open task; it asks first (the author's decision, 2026-10-07; before,
    only when its agent was working), and says so when an agent is still working.
  - **The profiles' chip**: 👥 and how many of its profiles are open, on every task's tab (each task has its
    copies, and its number shows it); on the shown one a button whose menu lists them, open and closed, and Manage
    Profiles…. On the tab because profiles are a task's; it was a Profiles ▾ button in the title bar until the
    projects moved to this bar. On every tab rather than the shown one's alone, so that the tabs keep their widths
    as another is shown (`Window.changed` sends the number when it changes).
  - **A task tab's right-click menu**: the shown one's profiles, as its chip's; Rename…; Show Folder, its folder (its
    worktree, or the project's without git) in the OS's file manager (`shell.openPath`); Delete Task….
  - **The button after the islands** is the menu of the projects (each with its color and folder, the open ones marked
    ✓; × on hover deletes one), Projects…, New Project…, Open Folder…, Close Project and Delete Project… (the shown
    one).
- **The projects' manager** (the Projects button in the title bar, left of ☰; Projects… in the projects' menu; Project
  Settings… in a label's menu opens it at that project): one dialog, every project on the left, open or not (the open
  ones marked), + New Project under them; on the right one project's configuration, edited there whether the project
  is open or not. Decided with the author on 2026-10-10, when a project became the configuration its tasks are made
  from: the menu and the Welcome screen (JetBrains' way, 2026-10-07) showed no project's configuration without opening
  it. A dialog, not a window of the OS: no process more.
- **New Project** (in the manager; New Project… in the menu and on the Welcome screen), as JetBrains': a name and a location, `~/Kulisa` (every new project's place, as JetBrains'
  `~/PycharmProjects`) unless they type or browse to another; the dialog shows the folder it makes
  (`<location>/<name>`; one that is there must be empty), so the human knows where the agent's files are; its color
  (the next free one) and its icon. Create Git repository is on by default: `git init` and an empty
  first commit ("Initial commit"; nothing of the folder is in it), as a worktree needs one, so the first task already
  has a copy of its own. Without git's user name and email set there is no commit, and tasks work in the folder.
  **Create makes it without opening it**: the manager goes on to its configuration (its agents' accounts: New
  Account…; its code, profiles), and **Open** there (at the footer's start, for any project not open) opens it, after
  saving what was changed (the author, 2026-10-11: opening right after Create asked where, unasked for).
- **Open Folder…** (in the projects' menu and on the Welcome screen): a folder a project has (its own or one of its
  repositories) opens that project. Another folder becomes a project (its name the folder's, the next free color, its
  site's favicon as its icon when it has one) and, as New Project's, is made, not opened: the manager goes on to its
  configuration, and Open there opens it (the author, 2026-10-11: opened at once, its first task started with no agent
  and no profiles, with nothing saying where they are made).
- **Opening another project** (the + menu, Open Folder… on a project's folder, Open in the manager) in a window with projects open asks where, as
  JetBrains does: **This Window** adds its tab at the end and shows it, the one on screen keeps running; **New
  Window** opens it in a window of its own. From the Welcome screen (no tab open) it opens in that window without a
  question; a project already open is shown in its window. Showing
  another project slides the grid towards its island, as macOS desktops do (a view transition on the compositor, the
  pages as pictures meanwhile; not with reduced motion); the window builds the other grid in place, so nothing jumps.
  **Closing a project** stops the project's agents and closes its profiles (tabs and sign-ins kept); the
  tab next to it is shown, or the Welcome screen when it was the last. Opening it again restores its open tasks and
  resumes their agents; one with none opens on the task closed last, or on a new one when it has none.
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
- **Each project has a color and an icon**, to tell projects apart at a glance: the color is the shown one's glow from
  the middle of the window and the title bar logo's curtain; the icon is on its label in the bar, in its color. The
  icon is its site's favicon (`favicon.*` or `icon.*` at the top or in `public/`, `static/`, `app/`, `src/`, `assets/`
  …, up to 128 KB; a project opened from a folder that has one gets it), one of Kulisa's set (Lucide's cart, briefcase,
  globe, flask, rocket, code, building, people, book, heart), or the app's curtain.
- **Its configuration** (the manager's right side, `ProjectEditor.vue`, one form for a new project and an existing
  one) changes its name, color, icon and local addresses on Save; the folder is shown, not changed.
- **Its agents**: a list of its agents' accounts and the terminal only ("Choosing the agent", Accounts). **Add
  Agent…** adds the terminal only or an account another project has; **New Account…** makes one, signed in right there;
  × removes one; the radio makes one the default: + runs it, the others are in +'s right-click menu (New Task with).
  None: its tasks start with the terminal only. A task keeps the agent it started with; Change agent… in its terminal
  picks another of the project's. Made at once, not on Save.
- **Its code**: the repositories or folders its tasks work on, the default one first (its radio: new tasks' agents
  start in its copy; every task gets a copy of each). **Add Folder…** adds one from the
  computer, **Clone** one from a URL with the user's own git (its credentials and keys; git asks for no password, so a
  private repository it cannot reach fails with git's own words; cloned into the project's own folder when that has no
  git, `~/Kulisa/<project>/<repo>`, else next to it, never inside a repository). Changes are made at once, not on
  Save. A repository added while tasks run is copied for each loaded one (the others when they load) and its agent is
  told, typed into its prompt for the human to send: Claude Code `/add-dir <folder>`, others a line saying so. **×**
  removes one from the project (its folder stays), only when no task has a copy of it or works in it: the refusal
  names those tasks (deleting a copy would delete their work). A project whose own folder has no git keeps it until a
  repository is added; then it is its **former folder**: new tasks no longer work in it, those that did go on there,
  and the settings say so, with Show, while it exists (the human moves its files, or asks an agent).
- **The Welcome screen** (the term: CLAUDE.md) is what the window shows with no project open: at the first start, and
  after the last project is closed (Close Project, the middle button on its label, deleting the project). What a project
  is, in a sentence (its code, its agents, its profiles; a task an agent in a copy of the code); New Project…, Open
  Folder…; every project, each with its icon in its color as on its label in the bar (a click opens one; its
  right-click menu: Open, Project Settings…, Delete Project…; × deletes it too); and links (the
  documentation, GitHub, reporting an issue, also in ☰; they open in the user's browser) with Kulisa's version. Later starts
  open the windows that were open, each with its projects, showing the one shown last (`windows` in `settings.json`);
  `KULISA_PROJECT=<folder> npm start` adds that one to the first window and shows it.
- **The agent** of each task starts in the user's own shell, in the task's folder, as if the human typed
  it in a terminal there: the project's environment applies (direnv's `.envrc`, nvm, mise; e.g. a project's
  `CLAUDE_CONFIG_DIR`, another Claude account), not the one Kulisa was started with. When it exits, the shell stays.
  direnv's state in Kulisa's own environment (started from a terminal in a folder direnv had loaded) is dropped at
  start: a task's shell took it for that folder left and undid its `.envrc`, an account's `CLAUDE_CONFIG_DIR` with it.
  On Windows it starts directly, without a shell (ROADMAP, Open issues).

## Tasks

A **task** (the term: CLAUDE.md; "workspace" until 2026-10-10) is one line of work in a project: its own copy of the
code on a branch, browser profiles, a grid of panels and an agent in a terminal. Several tasks let several agents
build several features of one project at once.

- **Always a copy.** With git (and a first commit), every task is a git worktree of each of the project's
  repositories, all on one branch of its own, the first task too: next to its repository when the project has one
  (`myshop@task-2`), else all in one folder of the task's (`~/Kulisa/<project>@task-<n>/<repo>/`, one place to see and
  delete). Its agent starts in the copy of the default repository and gets the others: Claude Code and Codex as
  `--add-dir` (Claude Code reading their `CLAUDE.md` too: `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD`), every
  agent in the MCP server's instructions and at its session's start (`agents.js`, `dirs`). With one repository: the project's folder stays the human's, and no agent works in it on its own. Its work
  goes back through git: the human asks the agent to merge into main (the agent first checks the project's folder for
  the human's uncommitted changes, and stops if there are any: the Kulisa plugin's skill and the MCP server's
  instructions), or to open a pull request.
- **Without git** (or before a first commit) a task works right in the project's folder: there is nothing to copy it
  with. A second open task there is made only after a question ("two agents may get in each other's way").
- **Its name** is `task-<n>` until its agent names it (`task_rename`, once it knows what the task is about) or the
  human does (Rename… in its tab's menu): the tab and the branch take the name (`git branch -m`, `-2` when the branch
  is taken); the folder stays `<repo>@task-<n>`, not moved under a running agent.

Example: the project `~/IdeaProjects/myshop`, its second task, named "Checkout-redesign" by its agent:

```
~/IdeaProjects/myshop/          the project's own folder: the human's
~/IdeaProjects/myshop@task-2/   the task: a worktree on the branch checkout-redesign
```

## What the human does

- **Its tabs** in its project's group in the projects' bar: a tab per open task, with the agent's state as an icon
  (working, waiting for you, done; from its hooks: "Choosing the agent"). A click shows that task, at once, as
  Chrome switches tabs: no slide or fade (a flash over the whole grid at every switch; a slide made the tasks
  and the projects look alike). The pages come in the same frames as the terminal: the view transition that holds
  the old grid's picture while the next one is built runs no animation at all, Chromium's own for its groups
  included (it kept the pages, shown when it ends, 250 ms behind the terminal). The one left keeps running. Another
  project's group marks the task it shows (a step brighter): where that project is when shown again.
- **+** at the end of a group (or Ctrl+Shift+N, or New Task in the label's menu) makes a task at once, no dialog,
  from the project's configuration alone, nothing taken from the task on screen: the human describes the task to its
  agent in the terminal. It runs the project's default agent; with none, the window asks. Its right-click menu, **New
  Task with**, makes one with another of the project's agents. **No profile opens by itself**, the first task's
  neither: all the project's are listed closed, and the agent opens one when it needs it (`profile_open`), the human
  with 👥; each a copy of its master made then ([profiles.md](profiles.md)). Decided with the author on 2026-10-10:
  a task opened those open in the task on screen before (the first one all), each a browser's processes and memory
  whether the task needed it or not.
- **×** on a task's tab closes it: its agent stops, its tabs close; its code, branch, profiles and conversation stay,
  and its project's menu lists it as closed. Opening it there shows it again and resumes its agent's conversation.
  It asks only when the agent is working (closing would stop it); nothing else is lost. × on a project's last open
  task closes the project, as Chrome closes a window with its last tab, with closing a project's question; the
  project opens on it again.
- **Delete Task…** in its tab's menu deletes it, after a question saying what goes for good: its folder, its branch,
  its profiles, its agent's conversations, and any work not in main and not pushed (commits of its own, uncommitted
  files). With git a task goes whole (worktree, branch, conversation); without, its files stay in the project's folder.
  Deleting the last open task closes the project. Closed tasks stay on disk until the human deletes them; Kulisa
  offers it once a closed task's PR is merged: each of its copies has commits of its own, all in its remote's default
  branch (`origin/HEAD`, fetched as the project is shown and as a task is closed, in the background), and nothing
  uncommitted, so deleting it loses nothing. Its group's menu marks it "merged" and has **Delete Merged Tasks…**, one
  question naming them. A squash merge makes new commits, so it is not seen: Delete Task… as for any other.
- **Change agent…** in the terminal's right-click menu picks another agent for the shown task.

## Actions: the human's and the agent's

As for profiles ([profiles.md](profiles.md), "Actions"), each action is written once, in the core, with its question
to the human; the window's IPC (`app.js`) and the MCP tools are handles on it:

| Action | The human | The agent | The core |
|---|---|---|---|
| Open a project | + menu, Open Folder…, New Project…, the Welcome screen | none: it works inside one project | `openLater` (`app.js`), asking This Window or New Window; then `openProject` or `openInNewWindow` |
| Close a project | its label's menu, the middle button on its label, × on its last open task, Close Project in the projects' menu | none: it would stop itself | `closeProjects` (`app.js`), asking first |
| Close a window, quit | the OS's ×, ☰ → Exit | none | `closeProjects` for the window's projects; `quit` (`app.js`), asking only when an agent works |
| Move a project | Move to New Window, Move to Window, dragging its label | none: where the human sees it is the human's | `moveProject` (`app.js`) |
| Delete a project | Delete Project…, ×, the Welcome screen | none: it deletes sign-ins, the human's to decide | `deleteProject` (`app.js`), `askDeleteProject`, `deleteProjectData` (`projects.js`) |
| Make a task | + in its group, Ctrl+Shift+N, New Task, New Task with (+'s right-click) | not yet (ROADMAP, "Tasks, rest") | `Project.createTask` |
| Close a task, open it again | ×; its group's menu | none: what runs is the human's to stop | `Project.closeTask`, `reopen` |
| Rename a task | Rename… in its tab's menu | `task_rename` | `Task.rename` |
| Delete a task | Delete Task… in its tab's menu | none: it deletes work and sign-ins, the human's to decide | `Project.askDeleteTask`, `deleteTask` |
| Show a task | a click on its tab, of any open project | none: what the human looks at is theirs | `AppWindow.showTask`, then `show` its project (`window.js`) |
| Fold a project's group | a click on its label | none: how the human sees the bar | `Project.collapse` |
| Add, clone, make the default, remove a repository | the projects' manager | none: what the project is made of is the human's | `addRepo`, `cloneRepo`, `defaultRepo`, `removeRepo` (`projects.js`); `Task.reposChanged` |
| Add, make the default, remove an agent of the project | the projects' manager | none: what the project is made of is the human's | `addAgent`, `defaultAgent`, `removeAgent` (`projects.js`) |
| Make an account of an agent | New Account… in the projects' manager | none: signing in is the human's (Rules) | `account:signin` (`app.js`), `Accounts.prepare`, `create` |
| Change the agent | Change agent… (the terminal's menu) | none: the human's choice | `Task.changeAgent` |

## Choosing the agent

Each task runs the agent the human chose for it (its `agent.json`): one of its project's accounts of Claude Code
(Anthropic) or Codex (OpenAI) (Accounts, below), or the terminal only (the user's shell in the task's folder: an agent
Kulisa does not know is run there by hand, `KULISA_MCP_URL` in its environment). Kulisa never assumes one is
installed (it started `claude` without asking until 2026-10-06). A new task runs its project's default agent (the
projects' manager), or the one chosen in New Task with; a project with none starts its tasks with the terminal only,
without asking. A task whose agent is no longer there (an account let go, an agent not on the computer) asks, in a
dialog, among the project's accounts and the terminal only. **Change agent…** (the terminal's right-click menu) opens
the same dialog, with Cancel, and starts the chosen one with a new conversation. `KULISA_AGENT` forces one command
everywhere, without asking. An agent CLI itself is installed in ☰ → Agents… (**Install**: Kulisa runs its maker's own
installer, the command shown before, its output while it runs, with no steps for the human to type, for people who
are not programmers); its accounts are made in a project's settings.

- The installers are the makers' official native ones (no Node, no sudo, they update themselves; checked
  2026-10-06): Claude Code `curl -fsSL https://claude.ai/install.sh | bash`, Codex
  `curl -fsSL https://chatgpt.com/codex/install.sh | sh` (`install.ps1` on Windows).
- Each agent is one entry in `agents.js`: how to find, install, start (Claude Code with the Kulisa plugin; Codex
  with the MCP server and its hooks as config overrides, `-c mcp_servers.kulisa.url=…`, `-c hooks=…`), resume
  (`claude --resume` and `codex resume` with the session the `SessionStart` hook reported; else `codex resume
  --last`) and forget a deleted task's folder.
- **Dictation**, where the agent has its own (its entry's `voice`: the arguments that turn it on, its key, its
  languages, how to read and set the one it uses, and a note shown with it; Claude Code's voice mode, which needs a Claude.ai
  account; Codex 0.160 has none, only a realtime voice conversation): the terminal's header has its language and a
  microphone ([window.md](window.md), The terminal). The human needs to know neither the agent's command nor its key:
  Kulisa turns it on for its own sessions (Claude Code: `--settings` with `voice: { enabled, mode: "hold",
  autoSubmit: false }`, not the user's settings, checked with 2.1.294) and the button holds its key: space typed
  again and again at a keyboard's repeat rate, as a terminal shows a held key (it tells no release), and Claude Code
  records while they come, putting the text where the cursor is, after any text there. Its `tap` mode (a tap
  starts, another stops) was tried first: it records only with the input empty, so a second sentence could not be
  added (the author, 2026-10-08). The language is Claude Code's `language` setting, which is also the language it answers in; it has no
  setting for dictation alone. The one chosen in Kulisa goes where its `/config` puts it (`<config dir>/settings.json`,
  the language's English name), the rest of the file kept, never into a file that is not JSON. Claude Code reads that
  file again when it changes and the language at each recording, so it holds from the next one, in every session
  of the human's, as if set in `/config`. A settings file of one launch would not do: it is read once.
- **Agents…** (☰) opens a dialog of its own with the agents alone (their
  accounts are the projects'), at any time, with nothing to choose: each agent's version (its `--version`), its folder (marked when it is not on the user's `PATH`: Kulisa runs it
  from there), its maker's website, and Install for the others. Installing there starts nothing; the agent is chosen
  for a task when one is made, or with Change agent…. Kulisa does not remove or update agents: they are the
  user's programs, and the makers' installers update them themselves.
- **Accounts** (`accounts.js`; decided with the author 2026-10-11): an agent with a sign-in of its own, so one human
  runs a work and a personal Claude side by side. Each is the agent with its own config folder, given to it by its
  variable (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`: `config` in its `agents.js` entry); the agents without one (the terminal
  only) have no accounts and are chosen as themselves. The human's own folder (`~/.claude`, `~/.codex`) is no account:
  every account is made in Kulisa and starts as a clean agent (no global `CLAUDE.md`, settings, plugins, skills or MCP
  servers of the human's: set up again in each), the author's choice over copying them.
  - **Made in a project** (the projects' manager, New Account…, an agent): the agent's own sign-in starts at once, as
    its `/login` does (Claude Code `auth login`, Codex `login`), in a terminal in the manager (`AccountSignIn.vue`),
    and ends once signed in. Its folder in Kulisa's data has a fixed id (`agents/claude-<n>/`, never a number used
    before: a removed one's folder may wait for the next start), never renamed: Claude Code names its macOS Keychain
    entry after a hash of the config folder's path (checked in 2.1.296), so a folder renamed after the sign-in would
    lose it. The email it signed in to is read after it (`auth status`) and kept in `agents.json`: the account is
    shown as "Claude Code · ann@shop.com"; Codex's status may not say it (not tried yet: no Codex account), then its id.
    An email the store has already is that account: the new folder is signed out and removed, the existing one added
    to the project. Cancel, the manager closed, or a sign-in ended without an account keeps nothing.
    **The page opens in a clean browser of Kulisa's**, not the user's (the author, 2026-10-11: theirs is signed in to
    other accounts, which they would have to sign out of and back into): the agent's `BROWSER` is Kulisa's
    `src/agent/open-url`, which sends the address to Kulisa (its local server, a token per sign-in), and Kulisa shows
    it in a window of its own with a master's bar (the address: the human sees which site it is), presenting as Chrome,
    its session in memory only (nothing on disk); it closes when the sign-in ends, its session wiped, and closed by the
    human it ends the sign-in. Claude Code reads `BROWSER` on Linux (checked in 2.1.296); on macOS and Windows not
    checked (there it may still open the user's browser), and on Windows it is not set (a sh script).
  - **One store** (`agents.json`), as the profiles': each account lists the projects it is in; **Add Agent…** in another
    project takes it there too. Choosing a task's agent (Change agent…, Choose the Agent) lists the project's accounts
    and the agents themselves, never another project's: it could go with that project while a task here runs it.
  - **× on an account** in a project is refused while any of the project's tasks, open or closed, runs it (counted
    then from their `agent.json`, as × on a repository): the refusal names them. The terminal only may be removed (its
    tasks keep it). An account no project lists any more goes, after a question ("Delete the
    account …?"): signed out with its agent's own command (`auth logout`: what it keeps outside its folder goes too,
    the Keychain's entry on macOS), then its folder, with its sign-in, settings and conversations. Deleting a project
    does the same for the accounts only it had, named in its question.
  The project's own environment still comes last (direnv's `.envrc` may set `CLAUDE_CONFIG_DIR`), as without Kulisa.
- The dialog is part of the window, not a window of its own: no extra process. `AgentPicker.vue` (choosing) and
  `Agents.vue` (the Agents window) are two dialogs of their own around one list of agents with Install
  (`AgentList.vue`), each with its own state.
- The agent's state on the tabs comes from its hooks. Kulisa has events of its own (`agent-hooks.js`): `prompt`
  working, `waiting` for the human, `stop` done, `interrupt` and `session-end` unknown (but a session ending after a
  done turn keeps it). Which of an agent's hooks sends which is the agent's, in one place each:
  - Claude Code, its plugin's `hooks.json` (checked with 2.1.293, 2026-10-08): `UserPromptSubmit`, `Stop`, and
    waiting when it asks for a permission or a question (`Notification` matched to `permission_prompt`,
    `elicitation_*`) or a turn ends with an API error (`StopFailure`: a limit, a sign-in); `SessionEnd` (`/exit`,
    `/clear`). Not `idle_prompt`, sent a minute after an answer: the tab already says done. Esc ends a turn without
    any hook, so Kulisa itself takes an Esc typed into the agent's terminal for the interrupt: working or waiting
    become unknown (`Task.interrupted`; an Esc that only closed a menu does so too, until the next hook).
  - Codex, its entry in `agents.js` as a config override (`-c hooks=…`; built from its documentation, not yet tried in
    a session: ROADMAP): `UserPromptSubmit`, `PermissionRequest` waiting, `Stop`, `Interrupt` (Esc), `SessionEnd`
    (also after 30 minutes idle), and `SessionStart`, which gives it the open profiles as Claude Code gets them and
    the session to resume. Codex runs a hook only once the human has trusted it (`/hooks`, once: the command line is
    the same for every task); Kulisa never bypasses that, which would run any project's hooks unreviewed too.

  Done means "come and see": once the human sees that task (shown with
  Kulisa's window in focus; at once when it was on screen) its tab shows nothing (`Task.seen`, `tabState`), the
  agent still done for the rest of Kulisa.
  Other agents show none yet (ROADMAP).

## Creating a task, step by step

1. **Code** (`worktrees.js`), a copy of each of the project's repositories with a commit; a folder without git is
   used as it is (the task works right in it, and the next two steps skip it). Each branch starts as Claude Code's
   `--worktree` starts one: from the remote's default branch after `git fetch` (`origin/main`), else from `HEAD`.
   Uncommitted changes of the project's folders are not carried. The branch is `task-<n>`, one name free in every
   repository (`-2`, `-3` if taken), the copies next to their repository with one, in `~/Kulisa/<project>@task-<n>/`
   with several: `git worktree add --no-track -b <branch> <copy> <start>`. `--no-track`: pushing the task's branch
   never goes to the default branch.
2. **Files outside git** are copied from the project's folder when git ignores them and they are untracked: `.env*`
   and `.claude/settings.local.json` at the top, and whatever the project's `.worktreeinclude` names (gitignore
   syntax, as Claude Code reads it). Dependencies (`node_modules` …) are not copied: the agent installs them (the
   skill says so).
3. **direnv.** When `.envrc` was copied and the project's `.envrc` is allowed, Kulisa runs `direnv allow` for the
   task's folder: same content. Without it the task would miss the project's environment (e.g. `CLAUDE_CONFIG_DIR`,
   and its agent would run with another account).
4. **Profiles**: all the project's, closed; each is a copy of its master made when it is first opened, without
   Chromium's caches, its tabs the master's ([profiles.md](profiles.md)). The grid starts with the agent's terminal.
5. **Ports.** A task with a worktree gets a port offset no other task of the project has: 100, 200, …; 0 stays the
   project's folder's (the human's own dev server; a task without git works there). Copied tabs on local addresses
   move by the difference (`localhost:3000/cart` → `localhost:3100/cart`); cookies do not depend on the port, so they
   stay signed in. The agent gets the offset as `KULISA_PORT_OFFSET`.
6. **The agent.** A new conversation in the task's folder, with the project's default agent or the one chosen. When it is Claude
   Code and the project's folder is trusted in Claude's config, the task's folder is marked trusted too, so Claude
   does not ask (`agents.js`).
7. The task is shown.

## What is on the computer

In Kulisa's data folder (`~/.config/Kulisa` on Linux, `~/Library/Application Support/Kulisa` on macOS,
`%APPDATA%\Kulisa` on Windows), laid out as Chrome lays out its user data (`store.js`). Show Data Folder in a
project label's right-click menu opens its `projects/<id>` in the file manager (`shell.openPath`), for the human who
asks where it is or what takes the disk; nothing in it is for editing by hand, so it is no button in sight:

```
projects.json                     the projects: id, name, folder, repos, color, icon, agents (accounts, the default first)
profiles.json                     the profiles, one store: who each is, its projects, a test user's pair (profiles.md)
profiles/Profile <k>/             a profile's master, where the human signs in once for every task
agents.json                       the agents' accounts (accounts.js): { next, list: [{ id, agent, email, folder, projects }] }
agents/<agent>-<n>/               an account's config folder (CLAUDE_CONFIG_DIR, CODEX_HOME): its sign-in, settings,
                                  conversations; gone, signed out first, with its last project; one a sign-in left
                                  unfinished (Kulisa quit meanwhile) goes at the next start
settings.json                     the Kulisa zoom, the theme, where the projects' bar is; the windows: each one's
                                  projects (in the bar's order), the one shown, where it was
deleted-folders.json              folders to remove at the next start (a session keeps its files open)
projects/<project id>/
  tasks.json                      { next, current, collapsed, list: [{ n, name, branch, offset, folder (its agent's),
                                  copies: [{ repo, worktree, branch, base, folder }], home (its folder of copies),
                                  closed, closedAt }] }; base: the commit a copy started from; no copies: it works in
                                  a folder of the project
  1/, 2/ …                        a task
    profiles.json                 what it has of its project's profiles, in order: folder, id, sites' zoom, closed
    layout.json                   its grid (dockview)
    agent.json                    { agent, started, sessionId, transcript }: which agent, its conversation
    terminals.json                its other terminals [{ id, name, by }], opened again when it loads; one goes when
                                  closed
    Profile 1/                    its copy of a master, made at its first open here: a Chromium profile
                                  (session.fromPath), with Kulisa's own files in it:
      Kulisa Tabs.json              the URLs of its tabs
      Kulisa Session Cookies.bin    its session cookies, encrypted with the OS keyring
    Profile 2/ …
```

Outside it:

| What | Where | Made when |
|---|---|---|
| The task's copy | `<repo>@task-<n>/`, next to the repository (one repository) | creating a task |
| The task's folder of copies | `~/Kulisa/<project>@task-<n>/<repo>/` (several repositories, or one added later) | creating a task; adding a repository |
| The task's branch | each repository (`git branch`) | creating a task; renamed with the task |
| git's worktree record | `<repo>/.git/worktrees/<copy>/` | creating a task |
| A cloned repository | `~/Kulisa/<project>/<repo>/` or next to the project's folder | Clone in the projects' manager; stays, as the human's (removing it from the project leaves it) |
| An empty first commit | the project's repository | New Project… with Create Git repository |
| direnv's permission for the task's `.envrc` | direnv's data (`~/.local/share/direnv/allow/`) | creating a task, if the project's is allowed |
| Claude Code's trust of the task's folder | Claude's config: `<CLAUDE_CONFIG_DIR>/.claude.json`, else `~/.claude.json`, `projects["<task folder>"]` | the task's Claude starts, if the project's folder is trusted |
| Claude Code's language, chosen for dictation | `<config dir>/settings.json`, `language` (as its `/config` sets it) | the human picks a language in the terminal's header; stays, as the human's setting |
| The agent's conversation | the agent's own data (Claude: `<config dir>/projects/…/<session>.jsonl`; Codex: `<config dir>/sessions/`), in its account's folder (`agents/<agent>-<n>/`) | the agent runs |
| The agent itself, when Kulisa installed it | its maker's place (`~/.local/bin/claude`, `~/.local/bin/codex`, …) | Install in the agent dialog |

Nothing is written into the project's own folder (but the first commit of a project Kulisa made).

## Deleting a task: what goes

One function deletes a task (`deleteTask` in `projects.js`), whether the human deletes it (Delete Task…) or its
project is deleted. A deleted task leaves nothing on the computer that Kulisa or its agent made for it. Kulisa stops
its agent and closes its profiles, then deletes:

- each copy (`git worktree remove --force`) and its branch (`git branch -D`), and its folder of copies; a branch
  already pushed stays on the remote;
- direnv's permission for its `.envrc`: the records in `<XDG data>/direnv/allow/` naming it (`worktrees.js`; not
  `direnv deny`, which newer direnv records too);
- its data folder `projects/<id>/<n>/`, profiles with their sign-ins (also listed in `deleted-folders.json`,
  removed at the next start if a file was still open);
- what its agent keeps of the task's folder (`agents.js`, each agent's `forget`; undocumented layouts, so what is
  not found is skipped):
  - Claude Code, in the config dir its sessions used: its conversations in `projects/<folder>/` (those recorded in
    the task's folder: Claude names that folder with non-Latin letters as `-`, so other folders can share it),
    `file-history/`, `session-env/`, `debug/`, `todos/` of those sessions, the folder's lines in `history.jsonl`,
    and `projects["<folder>"]` in `.claude.json` (the trust Kulisa gave it). Never the project's folder.
  - Codex, in the `CODEX_HOME` its sessions used (its account's folder): the session files whose folder is the task's (`sessions/`,
    `archived_sessions/`) and `[projects."<folder>"]` in `config.toml`. Not its own databases (`state_*.sqlite`):
    their format is Codex's alone, so a record of the thread may stay there.

A task without a worktree worked in the project's folder: only its data folder goes; the folder, and what its agent
keeps of it, are the human's, as without Kulisa.

What stays in any case: an agent Kulisa installed (it serves every project).

## Deleting a project

**Delete Project…**: in the projects' menu (Delete Project… for the shown project; any project's × on hover), a
project label's right-click menu, and a project on the Welcome screen (its × on hover, or its right-click
menu). All call one function (`deleteProject` in `app.js`): Kulisa asks first, saying what goes and which tasks have
work not in main and not pushed; closes the project if it is open; deletes each of its tasks as above; then removes it
from `projects.json` with its data folder `projects/<id>/`. The project's own folder stays as it is.

## While Kulisa runs

- Each window shows one task of its shown project. The others keep running, the other open projects' too: their
  pages and agent go on, their pages hidden.
- A task loads (its profiles start, its agent starts) the first time it is shown, also after a restart.
- A task is known among all open ones by its key, `<project id>/<n>` (the window, the terminals). Each has its own
  MCP URL, `http://127.0.0.1:4450/task/<project id>/<n>/mcp`, and hooks under `/task/<project id>/<n>/hooks/` (each part
  percent-encoded: ids have letters of any language); its agent gets them in its environment (`KULISA_MCP_URL`,
  `KULISA_URL`) and sees only its task's profiles. Profile ids repeat across tasks; inside Kulisa a profile
  is `<project id>/<n>/<id>` (CDP proxy, highlights).
- Closing a project stops all its tasks; opening it again, or restarting, restores them and resumes their
  agents where the agent can (Claude `--resume`, Codex `resume`).

## Removing everything by hand

Quit Kulisa first (it writes its data on quit). Then, for a project:

```sh
cd ~/IdeaProjects/myshop
git worktree list                         # the tasks: <repo>@task-<n>, each with its branch
git worktree remove --force ../myshop@task-2
git branch -D checkout-redesign
rm -rf ~/.config/Kulisa/projects/myshop   # all its tasks with their profiles' copies (the masters stay)
```

## Why it is built this way

Designed with the author on 2026-10-06 and 2026-10-07 (workspaces: a permanent main in the project's folder and
temporary forks), and again on 2026-10-10 (tasks; ROADMAP, "Projects and tasks").

- **Every task a copy, the project's folder the human's.** With a main in the folder, one agent worked where the
  human works, and its unfinished edits were in the way of the human's own; now every agent has its worktree, and the
  folder changes only when the human asks for a merge (the agent checking first for the human's uncommitted
  changes). No task is special: any one is closed, opened again or deleted the same way.
- **× closes, Delete deletes.** A fork's × deleted it, the one way out; a task is often put aside and taken up again
  (waiting for a review, a question to the client), so × keeps everything and stops only what costs memory (its
  agent, its tabs); deleting is a menu item with its question. Closed tasks stay until the human deletes them.
- **The last task's × closes the project**, as Chrome closes a window with its last tab: a project with no open task
  would show an empty grid with nothing to do there.
- **Named by the agent.** A name asked for before the work starts is a guess; `task-<n>` until the agent (or the
  human) knows what the task is about. The branch follows the name; the folder does not, as an agent may be working
  in it.
- **Code through git only.** The task's folder is next to the project (`myshop@task-2`): visible, and it opens in an
  IDE; inside the project, IDEs and tools would see the code twice. A project without git has no copies; `git init`
  runs only on the human's click (New Project…): run without asking, it could put secrets into history, or a huge
  folder, or nest a repository. Its first commit is empty for the same reason.
- **A new conversation for a task**, not a fork of another's (`--fork-session`): its code starts clean, and an agent
  remembering another task's unfinished edits would be misled. Started in the task's folder, it has no questions about
  access outside it.
- **A master and a copy per task.** A task's profiles are copies of their masters, made at their first open, so
  each task's local app keeps its own sessions (each task runs its own dev server, and cookies do not depend on the
  port: shared, two tasks would sign each other out), while real accounts' cookies are kept in step between the
  master and every copy, so the human signs in once ([profiles.md](profiles.md), "Sign-ins kept in step"). Copied
  from task to task until 2026-10-10, with rotating tokens a copy signed the other out. `session.fromPath` keeps the
  caches inside the profile (they cannot live elsewhere), so a copy skips them.
- **Storage as Chrome lays it out**, so what is known about Chrome's storage applies. `Profile N` folders are fixed
  at creation: a rename touches only `profiles.json`.
- **One port offset per task** moves any number of services with one number. Cookies do not depend on the
  port, so the copies stay signed in to the app (separate hostnames such as `checkout.localhost` would lose that).
  The local database is the developer's matter (`docker compose` already names containers after the folder, so a
  task gets its own; only published ports clash). An app that cannot change its port (hard-coded, OAuth bound to
  `localhost:3000`) cannot run in a task's copy; the agent says so.
- **Every task asks before it is deleted**, also one without changes (at first a fork without changes went without a
  question, as with Claude Code's `--worktree`): its conversation and profile copies go too.
- **A task loads when first shown**, not at the start: after a restart nothing works in the background anyway,
  and the agent starts at its terminal's real size.
- **Tasks and projects in the background keep running**, their pages and agents. Memory: each agent is a
  process of its own (Claude Code about 200–400 MB) plus its profiles' tabs.
- **Another project opens beside the shown one** (an island in the bar), as a browser opens a tab. At first opening
  one closed the shown one and stopped its agents; now the human closes a project when it is safe.
- **Several windows are one Kulisa**, not a second instance: two cannot share the data folder. A project moves with
  its pages' native views (`Profile.moveTo`), not loaded again, and with what its terminals show (xterm's serialize
  addon, as VS Code keeps terminals), at their size, so its agent is never told a default one. A window is one more
  renderer process for Kulisa's own page, only while it is open.
- **Claude's trust of a task's folder**: Claude's config is undocumented; when the file is not as expected, nothing
  is changed and Claude asks as usual. Claude rewrites that file often; Kulisa writes it whole at once (a rename),
  and a write of Claude's at the same moment may undo it (then Claude asks).

## The code

| File | What |
|---|---|
| `src/main/app.js` | the windows; open, close and move projects (one change at a time, `serial`); IPC |
| `src/main/window.js` | a window: its open projects, show a project or a task, the grid's state, its questions |
| `src/main/projects.js` | an open project: its tasks; making, closing, opening again, deleting one (with the question); deleting a project's data |
| `src/main/tasks.js` | a task: its profiles, its agent (start, change, environment), renaming, copies of its profiles for a new task, ports |
| `src/main/worktrees.js` | git: a task's worktree and branch, files outside git, direnv, changes, renaming the branch, removal |
| `src/main/agents.js` | the agents to choose from: find, install, start, resume; Claude's folder trust |
| `src/main/store.js` | the data folder above |
| `src/main/terminal.js` | the task's terminals: its agent's and the others (window.md, The terminal) |
| `src/renderer/components/ProjectBar.vue`, `Welcome.vue`, `ProjectEditor.vue` | the projects' bar (an island per project) and the projects' menu, the Welcome screen; the projects' manager |
| `src/renderer/components/TaskTab.vue`, `TaskRename.vue` | a task's tab in the bar, its menu, the Rename Task dialog |
| `src/renderer/components/AgentPicker.vue`, `Agents.vue`, `AgentList.vue` | choosing a task's agent; the Agents window; the list of agents with Install that both show |
| `src/main/accounts.js`, `src/renderer/components/AccountSignIn.vue` | the agents' accounts, one store; a new one's sign-in in the projects' manager |
| `src/renderer/lib/grid.ts`, `components/Grid.vue` | building a task's grid; the slide (a view transition) |
| `test/tasks.js` | the tests; `test/restart-tasks.js` after a restart; `test/unit/agents.test.js` |
