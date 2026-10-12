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

- **A project is no thing to open; its tasks are** (the author, 2026-10-11: a project is what its tasks are made of:
  profiles, agents, repositories). Its island in a window's bar is the **group** of its open tasks there, as Chrome's
  tab group: it comes with the first task opened (the bar's +) and goes with the last one
  closed. There is no Open Project or Close Project, and no question where to open one: a task of a project with no
  group opens in a new group in this window, one with a group goes into it, in its window (one group per project, as
  Chrome's per window; Move to New Window takes a group away whole). In code the group is still an open project
  (`Project` in `shell.open`, a tab of its window).
- **The tasks' bar**, drawn as Chrome's tab groups: each group an island of its own: its label
  (its icon, the app's logo with the curtain in the project's color, and its name), a tab per open task with its
  agent's state (below). Every group's tasks are there, so a click on any of them shows that group with it; the
  others keep running, their agents and pages. The bar is in the middle under the grid, where the hand goes for the
  terminal anyway, or over it (☰ → Tasks bar: Top, Bottom; saved). Each island looks like a tab of the grid: square
  where it meets the grid and merging into it with curves, rounded towards the window's edge.
  - **Nothing in it moves** when another project or task is shown: every island keeps its width (every tab the room
    of its ×), and the shown project's tabs come with the projects' news, not after it. Islands that moved under the mouse made
    the human miss (the author, 2026-10-08).
  - **A click on the label folds the group** to it, as Chrome's collapsed tab groups, and back (kept in
    `tasks.json`); the tab of the task it shows stays, so the grid on screen keeps its tab. Showing a project is a
    click on one of its tasks (two ways to the same thing confused, when the label showed it too).
  - **A right-click on the label opens the group's menu**, as Chrome's tab group's: New Task, its **closed
    tasks** under a heading (the one closed last first; a click opens one again; Delete Merged Tasks… when some are
    merged), Move to New Window, Move to Window, Project Settings… (what a group has not: its code, agents, profiles,
    local addresses), Show Data Folder, Close Group. The project's name, color and icon are the projects' manager's
    alone (the author, 2026-10-11: a panel with them at the menu's top, as Chrome's, was there for a day and was
    redundant). **Closing a group** (that menu, the middle button on its label,
    × on its last open task) closes its tasks as × on each would (`Project.closeAll`: agents stopped, profiles saved
    and closed, everything kept; the shown one listed as closed last), its island goes; it asks only when an agent
    works (the author, 2026-10-11, with groups; before, a project's closing always asked).
  - **No profiles' button on a task's tab** (the author, 2026-10-12: the bar is no place to edit profiles, Settings is
    for that). A 👥 on the shown task's tab had their menu until then (before it, a Profiles ▾ button in the title
    bar), and every tab a number of its open profiles until 2026-10-11 (profiles are the agent's hands: how many are
    open says nothing).
  - **A task tab's right-click menu**: the shown one's profiles, open (shown in the grid) and closed (opened in the
    task), and Manage Profiles… (Settings → Profiles); Rename…; Show Folder, its folder (its
    worktree, or the project's without git) in the OS's file manager (`shell.openPath`); Delete Task….
  - **The button after the islands is +**, a new task (Ctrl+Shift+A; `NewTask.vue`; the author, 2026-10-11): a task
    is made of a project (its profiles, agents and code), so its menu lists every project, with its icon in its
    color; a click makes a task of it with its default agent ("Choosing the agent") and shows it in its group, in
    its group's window (a new group in this window when it has none). Under each project its **closed tasks**, set in
    (the one closed last first, its branch, merged): a click opens one again, the same way; for a project with no
    group it is the one way to them. New Project… last. One + for every project: the groups have none of their own
    (each had its + until 2026-10-11, its right-click New Task with another agent; another agent is the project's
    default one, or the island's + after), and it replaced Search Tasks (a panel of every project's tasks with a search
    field, from the morning of 2026-10-11 until its evening).
- **Settings** (the button in the title bar, left of ☰; the author, 2026-10-11), as JetBrains' Settings (the author,
  2026-10-11: the dialogs read as a web page's, not a desktop app's; docs/ui.md, Desktop, not a web page): a tree on the
  left, **Projects** with every project under it (its icon in its color, its name), **Agents** (the agents and their
  accounts: "Choosing the agent") and **Profiles** (every profile and who it is: [profiles.md](profiles.md)), its **+** at
  the top New Project; on the right the chosen one's page under its path ("Projects › shop"). Project Settings… in a
  group's menu opens it at that project; ☰ → Agents… on Agents; a task tab's Manage Profiles… and About this profile… on
  Profiles. It was the
  projects' manager alone, under a Projects button, until the agents' accounts needed a place outside projects; then
  tabs, Projects and Agents, until the tree. **A project's page** (the projects' manager, in earlier words): at its top
  its path and **⋯** (Delete Project…; no New Task there since 2026-10-12, the author: tasks are made in the bar); then **Name:** with its color and
  icon in a button beside it (a panel), and a group each under a titled line (`.titled`): **Code**, **Agents**,
  **Profiles** (what its tasks are made of), each a list (`.list`) with a toolbar over it: **+** adds (a menu), **−**
  removes the selected row (and Delete), **★** makes it the default (Code, Agents); a row's right-click has the same.
  Its Profiles are only which profiles its tasks have: + makes one in it or adds one of the others, − lets go of one
  (the profile stays); who a profile is, is Settings → Profiles'.
  What needs typing (a URL to clone, a new profile's name) opens a field in place, under the list (Esc puts it away).
  Then **Local addresses:**. Explanations are in the empty lines and the tooltips, not in a paragraph per section (the
  author, 2026-10-11: the page with cards, a paragraph each and four ways to add read as documentation, not settings).
  **Everything is saved as it changes**: no Save and no
  Cancel (the author, 2026-10-11: with code, agents and profiles saved at once and the look on Save, it was not plain
  what Save and Cancel were for); the name on Enter or leaving its field, also when the manager closes or another
  project is chosen with one typed. Decided with the author on 2026-10-10, when a project became the configuration its tasks are made
  from: the menu and the Welcome screen (JetBrains' way, 2026-10-07) showed no project's configuration without opening
  it. A dialog, not a window of the OS: no process more.
- **New Project** (a dialog of its own, `NewProject.vue`: Settings' +, which it takes the place of until Create or
  Cancel; New Project… in the empty window; by itself at the first start, no project yet), as JetBrains': on the left
  what its code comes from, on the right the form (**Name:**, **Location:**). **Its code first** (the author,
  2026-10-11: a folder made in `~/Kulisa` first, git on, was in the way of code already on the disk or at a URL: with
  a repository added after it, every task got a copy of the empty one too, or the empty folder stayed as a former one):
  - **New folder**: a name and a location, `~/Kulisa` (every new project's place, as JetBrains' `~/PycharmProjects`)
    unless they type or browse to another; the dialog shows the folder it makes (`<location>/<name>`), so the human
    knows where the agent's files are. A folder there already is taken as it is, its files kept.
  - **Folders on disk**: one folder or several (a frontend and a backend: typed and Add, or + over the list, which
    browses; each a row with "git" or "no git", − leaves the selected one out), taken as they are, nothing made: their files and, for repositories, their history kept.
    The first is the default repository and the project's folder (Open Folder… was until 2026-10-11, a command of its
    own whose effect was not clear, the author; now a choice inside New Project). Create Git repository runs in those
    without git. A folder that is not there, or a project's, is refused as it is added.
  - **Clone from URL**: one URL or several, cloned with the user's own git (as Clone on a project's page). One is cloned
    into `<location>/<name>`, and that clone is the project's folder; several into `<location>/<name>/<repo>` each, the
    project's folder the one that holds them (no former folder: tasks never worked in it), the first the default.
    Clone on its page puts the next one there too. Refused: a folder there with files. Create says Cloning…
    meanwhile; a URL git cannot clone leaves nothing, the clones before it neither.

  The name is the first folder's or repository's until the human types one. A folder or URL typed and not yet added
  counts when Create is pressed. The dialog says what will happen as it is typed ("… is there already", "… is a git repository", "The repository
  will be cloned into …"; refused: a file, or a folder a project has). Its color (the next free one)
  and icon (the curtain, or its site's favicon) are not asked: one decision less to make a project, changed at its
  page's top. Create Git repository is on by default, not shown for repositories or clones: `git init` and an empty
  first commit ("Initial commit"; nothing of the folder is in it), as a worktree needs one, so the first task already
  has a copy of its own. Without git's user name and email set there is no commit, and tasks work in the folder. More
  repositories are added on its page (Code).
  **Create makes no task**: Settings opens on its page (its agents' accounts: New
  Account…; its code, profiles); its first task is made from the bar's + (the project is in its menu).
- **Showing another group** slides the grid towards its island, as macOS desktops do (a view transition on the compositor, the
  pages as pictures meanwhile; not with reduced motion); the window builds the other grid in place, so nothing jumps.
  When a group closes, the one next to it is shown, or the empty window when it was the last.
- **Move to New Window** (the group's menu) puts the group into a window of its own, next to this one, e.g.
  to drag it to a second monitor; **Move to Window: …** (one item per other window, named by its projects) puts it
  into that window, as a browser moves a tab. It keeps running: its agents, its pages (the same ones, moved, not
  loaded again), what its terminals showed. The only tab of a window does not go to a new window; moved into another
  one, its window closes. **Dragging a label** does the same with the mouse: within the bar it changes the order
  (kept); let go on another window's bar, the group moves there, where it was let go; let go outside every Kulisa
  window, it opens in a new window there (the window appears when the mouse is let go, as in VS Code). Each window has
  its bar and its + (every project; a task of one with a group in another window goes there, that window brought to
  the front). The OS's × on a window closes its groups, as Close Group on each would, after one question ("Close the window?"); on the last
  window it quits Kulisa, and the windows with their groups and open tasks come again at the next start, where they were: nothing
  is lost, so it asks only when that would stop a working agent ("Quit Kulisa?"). A window whose last group is
  closed closes too, unless it is the only one: then it is the empty window.
- **Each project has a color and an icon**, to tell projects apart at a glance: the color is the shown one's glow from
  the middle of the window and the title bar logo's curtain; the icon is on its label in the bar, in its color. The
  icon is one of:
  - **Its site's favicon**, every new project's (the curtain while it has none): `favicon.*` (svg, png, ico, webp, gif,
    jpg) anywhere in its code, `icon.*` only in an `app/` folder (Next's; elsewhere `icon.svg` is any component's).
    The files are those git lists in each of its repositories, the default first (new ones too, not those it ignores:
    no library's favicon from `node_modules`, no build's); a folder without git is read a few levels down, without
    hidden folders, `node_modules`, `dist`, `build`, `vendor`. Of several, the nearest to the top, then svg, png, ico,
    then a favicon before an icon, then by name (a monorepo's `apps/admin` before `apps/shop`: Choose File… for
    another). Looked for without holding the window up, once; again as its settings open, so a favicon added or
    changed meanwhile shows there and in the bar.
  - **A picture file the human chose** (Choose File… in the icon's panel, the OS's dialog in the project's folder):
    its path kept (relative inside the project), so the picture follows the file as the code changes it; read again
    as its settings open. While the file is gone, the project shows its favicon (or the curtain); the choice stays until its look is changed again.
  - **One of Kulisa's set** (Lucide's cart, briefcase, globe, flask, rocket, code, building, people, book, heart), or
    the app's curtain.

  A picture up to 128 KB is shown as it is; a larger PNG or JPEG made 64 px wide (Electron's `nativeImage` reads only
  those two on every OS); another larger one is refused when chosen ("Not a picture Kulisa can show").
- **Its configuration** (a project's page in Settings, `ProjectEditor.vue`) changes its name (on Enter or leaving it),
  color, icon (a panel from the button beside its name) and local addresses as they change; the folder is shown (in
  Code), not changed.
- **Its agents**: a list of its agents' accounts and the terminal only ("Choosing the agent", Accounts). Its
  **+** adds the terminal only or any account (made in another project or in Settings → Agents), or, under New Account,
  makes one of an agent, signed in right there; − lets go of the selected one at once (the account stays: Settings →
  Agents deletes it); the first is the default, marked "default" when there are several (**★**, or Make Default in a
  row's right-click, on another): the bar's + runs it; others in a task: the island's + ("Several agents in a task").
  None: its tasks start with the terminal only.
- **Its code**: the repositories or folders its tasks work on, the default one first (marked when there are several,
  **★** or Make Default in a row's right-click on another: new tasks' agents start in its copy; every task gets a copy of each). Its **+**: **Add
  Folder…** adds one from the computer, **Clone from URL…** one from a URL with the user's own git (its credentials and keys; git asks for no password, so a
  private repository it cannot reach fails with git's own words; cloned into the project's own folder when that has no
  git, `~/Kulisa/<project>/<repo>`, else next to it, never inside a repository). A repository added while tasks run is copied for each loaded one (the others when they load) and its agent is
  told, typed into its prompt for the human to send: Claude Code `/add-dir <folder>`, others a line saying so. **−**
  (or Delete, or the right-click) removes the selected one from the project (its folder stays), only when no task has a copy of it or works in it: the refusal
  names those tasks (deleting a copy would delete their work). A project whose own folder has no git keeps it until a
  repository is added; then it is its **former folder**: new tasks no longer work in it, those that did go on there,
  and the settings say so, with Show, while it exists (the human moves its files, or asks an agent).
- **The empty window** (the term: CLAUDE.md) is what a window is with no task open: at the first start, and after
  the last group is closed (Close Group, the middle button on its label, × on its last task, deleting the project). The title bar and
  the tasks' bar as always (no islands; + there) and, in the grid's place, an
  empty island: "No task is open", New Task (+'s menu), New Project…. At the first start (no project at all: nothing to do in Kulisa
  without one) New Project opens by itself (`shell.firstStart`). It replaced the Welcome
  screen (the author, 2026-10-11: once the bar listed the tasks, it was not needed): its list of tasks is the bar's
  + (the closed ones), the links and Kulisa's version are ☰'s, New Project the manager's. Later starts
  open the windows that were open, each with its projects, showing the one shown last (`windows` in `settings.json`);
  `KULISA_PROJECT=<folder> npm start` adds that one to the first window and shows it.
- **An agent** of a task starts in the user's own shell, in the task's folder, as if the human typed
  it in a terminal there: the project's environment applies (direnv's `.envrc`, nvm, mise), not the one Kulisa was
  started with. When it exits, the shell stays. Its account's variable (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`) is typed
  before the command (`CLAUDE_CONFIG_DIR=… claude …`), so the task's account wins over a project's `.envrc` that sets
  it too (the author, 2026-10-12: one of them ran a task as another Claude account, silently).
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
  agent in the MCP server's instructions and at its session's start (`agents.ts`, `dirs`). With one repository: the project's folder stays the human's, and no agent works in it on its own. Its work
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

- **Its tabs** in its project's group in the tasks' bar: a tab per open task, with the agent's state as an icon
  (working, waiting for you, done; from its hooks: "Choosing the agent"). A click shows that task, at once, as
  Chrome switches tabs: no slide or fade (a flash over the whole grid at every switch; a slide made the tasks
  and the projects look alike). The pages come in the same frames as the terminal: the view transition that holds
  the old grid's picture while the next one is built runs no animation at all, Chromium's own for its groups
  included (it kept the pages, shown when it ends, 250 ms behind the terminal). The one left keeps running. Another
  project's group marks the task it shows (a step brighter): where that project is when shown again.
- **The bar's +** (a project in its menu; Ctrl+Shift+N, or New Task in the label's menu, for the shown or that
  group's project) makes a task at once, no dialog,
  from the project's configuration alone, nothing taken from the task on screen: the human describes the task to its
  agent in the terminal. It runs the project's default agent; with none, the terminal only, nothing asked ("Choosing the agent"). **No profile opens by itself**, the first task's
  neither: all the project's are listed closed, and the agent opens one when it needs it (`profile_open`), the human
  from the task's tab's right-click menu; each a copy of its master made then ([profiles.md](profiles.md)). Decided with the author on 2026-10-10:
  a task opened those open in the task on screen before (the first one all), each a browser's processes and memory
  whether the task needed it or not.
- **×** on a task's tab closes it: its agent stops, its tabs close; its code, branch, profiles and conversation stay,
  and the bar's + and its group's menu list it as closed. Opening it there shows it again and resumes its agent's
  conversation. It asks only when the agent is working (closing would stop it); nothing else is lost. × on a group's
  last open task closes the group, as Chrome's tab group goes with its last tab.
- **Delete Task…** in its tab's menu deletes it, after a question saying what goes for good: its folder, its branch,
  its profiles, its agent's conversations, and any work not in main and not pushed (commits of its own, uncommitted
  files). With git a task goes whole (worktree, branch, conversation); without, its files stay in the project's folder.
  Deleting the last open task closes its group. Closed tasks stay on disk until the human deletes them; Kulisa
  offers it once a closed task's PR is merged: each of its copies has commits of its own, all in its remote's default
  branch (`origin/HEAD`, fetched as the project is shown and as a task is closed, in the background), and nothing
  uncommitted, so deleting it loses nothing. Its group's menu marks it "merged" and has **Delete Merged Tasks…**, one
  question naming them. A squash merge makes new commits, so it is not seen: Delete Task… as for any other.
- **The island's +** opens another of the project's agents in the task, a new conversation in a tab of its own, or a
  shell; **the agent's icon on its tab** hands the task to an agent of the project, which goes on with that
  conversation ("Several agents in a task").

## Actions: the human's and the agent's

As for profiles ([profiles.md](profiles.md), "Actions"), each action is written once, in the core, with its question
to the human; the window's IPC (`app.ts`) and the MCP tools are handles on it:

| Action | The human | The agent | The core |
|---|---|---|---|
| Open a task (a group with it, when its project has none) | the bar's + (a closed one, or a new one) | none: it works inside one task | `openProject` (`app.ts`): the task opened again and shown, or a new one (`createTask`) |
| Close a group | Close Group in its menu, the middle button on its label, × on its last open task | none: it would stop itself | `closeProjects` (`app.ts`), `Project.closeAll`, asking only when an agent works |
| Close a window, quit | the OS's ×, ☰ → Exit | none | `closeProjects` for the window's groups; `quit` (`app.ts`), asking only when an agent works |
| Move a group | Move to New Window, Move to Window, dragging its label | none: where the human sees it is the human's | `moveProject` (`app.ts`) |
| Delete a project | Delete Project… in the projects' manager | none: it deletes sign-ins, the human's to decide | `deleteProject` (`app.ts`), `askDeleteProject`, `deleteProjectData` (`projects.ts`) |
| Make a task | the bar's +, Ctrl+Shift+N, New Task in its group's menu | not yet (ROADMAP, "Tasks, rest") | `Project.createTask` |
| Close a task, open it again | ×; the bar's +, its group's menu | none: what runs is the human's to stop | `Project.closeTask`, `reopen` |
| Rename a task | Rename… in its tab's menu | `task_rename` | `Task.rename` |
| Read what was said and done in the task before | its terminal, scrolled back | `task_history` ([transcripts.md](transcripts.md)) | `historyPart` (`history.ts`) |
| Delete a task | Delete Task… in its tab's menu | none: it deletes work and sign-ins, the human's to decide | `Project.askDeleteTask`, `deleteTask` |
| Show a task | a click on its tab, of any group | none: what the human looks at is theirs | `AppWindow.showTask`, then `show` its project (`window.ts`) |
| Fold a project's group | a click on its label | none: how the human sees the bar | `Project.collapse` |
| Add, clone, make the default, remove a repository | the projects' manager | none: what the project is made of is the human's | `addRepo`, `cloneRepo`, `defaultRepo`, `removeRepo` (`projects.ts`); `Task.reposChanged` |
| Add, make the default, remove an agent of the project | the projects' manager | none: what the project is made of is the human's | `addAgent`, `defaultAgent`, `removeAgent` (`projects.ts`) |
| Make an account of an agent | New Account… in Settings → Agents or a project's page | none: signing in is the human's (Rules) | `account:signin` (`app.ts`), `Accounts.prepare`, `create` |
| Delete an account | − in Settings → Agents | none: it deletes a sign-in and conversations, the human's to decide | `deleteAccount` (`projects.ts`), `shell.dropAccount` |
| Open an agent in the task, a new conversation | the island's +, New Conversation (a tab's menu), Ctrl+` on the folded island | none: which agents work is the human's | `Task.openAgent`, `newConversation` |
| Hand the task to an agent, the work kept | the agent's icon on its tab, Change agent… (a tab's menu) | none: the human's choice | `Task.handOver` |
| Close an agent's tab | × on it, Close in its menu (asked first) | none: it would stop another agent | `Task.closeTab` |
| Name an agent's conversation (its tab) | none: the agent knows what it is about | `conversation_rename` | `Task.nameConversation` |

## Choosing the agent

A task's agents are the human's choice: its project's accounts of Claude Code (Anthropic) or Codex (OpenAI)
(Accounts, below), any of them in a tab of its own ("Several agents in a task"), or the terminal only (the user's
shell in the task's folder: an agent Kulisa does not know is run there by hand, `KULISA_MCP_URL` in its environment).
Kulisa never assumes one is installed (it started `claude` without asking until 2026-10-06). A new task opens its
project's default agent (the projects' manager), its own (`agent` in its `agent.json`); a project with none starts
its tasks with the terminal only, without asking. An agent to open that is no longer there (an account let go, an
agent not on the computer) asks, in a dialog, among the project's accounts and the terminal only, with Install and
Cancel (none opens). `KULISA_AGENT` forces one command everywhere, without asking. An agent CLI itself is installed in ☰ → Agents… (**Install**: Kulisa runs its maker's own
installer, the command shown before, its output while it runs, with no steps for the human to type, for people who
are not programmers); its accounts are made there too, or in a project's page.

- The installers are the makers' official native ones (no Node, no sudo, they update themselves; checked
  2026-10-06): Claude Code `curl -fsSL https://claude.ai/install.sh | bash`, Codex
  `curl -fsSL https://chatgpt.com/codex/install.sh | sh` (`install.ps1` on Windows).
- Each agent is one entry in `agents.ts`: how to find, install, start (Claude Code with the Kulisa plugin; Codex
  with the MCP server and its hooks as config overrides, `-c mcp_servers.kulisa.url=…`, `-c hooks=…`), resume
  (`claude --resume` and `codex resume` with the session the `SessionStart` hook reported; else `codex resume
  --last`) and forget a deleted task's folder.
- **Dictation**, where the agent has its own (its entry's `voice`: the arguments that turn it on, its key, its
  languages, how to read and set the one it uses, and a note shown with it; Claude Code's voice mode, which needs a Claude.ai
  account; Codex 0.160 has none, only a realtime voice conversation): the island's row of tabs ends with the language
  and a microphone of the agent in front ([window.md](window.md), The terminal). The human needs to know neither the agent's command nor its key:
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
- **Settings → Agents** (☰ → Agents… opens it there; `AgentsTab.vue`), as JetBrains' list of SDKs: the agents on the
  left (not the terminal only: nothing of it to set up there; the author, 2026-10-11; "not installed" at a row's end),
  the chosen one on the right: its maker and website, what it needs, its status (its version, its `--version`, and its
  folder, marked when it is not on the user's `PATH`: Kulisa runs it from there; Install for the others, with the
  command it runs), and its **Accounts** (below), a list with + (New Account…) and − (delete the selected one, asked
  first; also Delete and the right-click). Installing there starts nothing; the agent is chosen
  for a task when one is made, or with the island's +. Kulisa does not remove or update agents: they are the
  user's programs, and the makers' installers update them themselves.
- **The list comes at once** (the author, 2026-10-11), here and in choosing a task's agent: finding the agents runs
  the user's login shell (`command -v`: Kulisa started from a menu has a shorter `PATH`) and each one's `--version`,
  tenths of a second or more with a heavy `.bashrc`. So the window first shows what the last look in that folder found,
  kept in the main process's memory (`agents:list`, `cached`; nothing on disk: it is the computer's state, which
  changes without Kulisa), and looks again behind it, its rows changed where it differs (an agent installed, updated or
  removed meanwhile). Only the first time after Kulisa starts does it wait for the look.
- **Accounts** (`accounts.ts`; decided with the author 2026-10-11): an agent with a sign-in of its own, so one human
  runs a work and a personal Claude side by side. Each is the agent with its own config folder, given to it by its
  variable (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`: `config` in its `agents.ts` entry); the agents without one (the terminal
  only) have no accounts and are chosen as themselves. The human's own folder (`~/.claude`, `~/.codex`) is no account:
  every account is made in Kulisa and starts as a clean agent (no global `CLAUDE.md`, settings, plugins, skills or MCP
  servers of the human's: set up again in each), the author's choice over copying them.
  - **Made in Settings → Agents** (+ over its agent's accounts: in no project yet) **or in a project** (its page,
    Agents' + → New Account, an agent: in that project): the agent's own sign-in starts at once, as
    its `/login` does (Claude Code `auth login`, Codex `login`), in a terminal there (`AccountSignIn.vue`),
    and ends once signed in. The terminal is under Details, closed (the author, 2026-10-11: the address it prints, with
    the browser open, only confused); it opens by itself when the sign-in fails, and is there for what the browser does
    not show (the address, when no browser opened; a code the agent asks for). Its folder in Kulisa's data has a fixed id (`agents/claude-<n>/`, never a number used
    before: a removed one's folder may wait for the next start), never renamed: Claude Code names its macOS Keychain
    entry after a hash of the config folder's path (checked in 2.1.296), so a folder renamed after the sign-in would
    lose it. The email it signed in to is read after it (`auth status`) and kept in `agents.json`: the account is
    shown as "Claude Code · ann@shop.com"; Codex's status may not say it (not tried yet: no Codex account), then its id.
    An email the store has already is that account: the new folder is signed out and removed, the existing one added
    to the project (made in Settings → Agents: said so). Cancel, Settings closed, or a sign-in ended without an account
    keeps nothing.
    **The page opens in the user's own browser**, as the agent opens it without Kulisa (Kulisa sets no `BROWSER`); the
    agent's own server on `localhost` takes the answer, so the sign-in ends by itself. The page names the account it
    signs in to: a browser signed in to another account of the same maker may offer that one, and the human chooses
    there. From 2026-10-11 to 2026-10-12 it opened in a clean browser of Kulisa's (an Electron window, presenting as
    Chrome, its session in memory), so that none of the human's other sign-ins was there; Google refused to sign in
    there ("This browser or app may not be secure"), and OpenAI and Anthropic send an account made with Google to it.
    It was then moved to the system's browser, as desktop apps sign in (RFC 8252); found after: what Google refused was
    a browser presenting as Chrome without being it, and it lets Electron's own Chromium in ([profiles.md](profiles.md),
    "What sites see"). The system's browser was kept (the author, 2026-10-12): as desktop apps sign in, and less code.
  - **One store** (`agents.json`), as the profiles': each account lists the projects it is in; the Agents' **+** of another
    project takes it there too. The island's + and choosing an agent that is not there (Choose the Agent) list the project's accounts
    and the agents themselves, never another project's: the project's page says who works in its tasks.
  - **An account lives until the human deletes it** (the author, 2026-10-11: with every project deleted, every account
    went, and the next project had none; a sign-in is made again only by signing in again). − on an account in a
    project lets go of it at once, nothing asked, as of the terminal only: a task running it keeps it. Deleting a
    project lets go of its accounts the same way. In Settings → Agents each account says the projects it is in ("in no
    project"), and − deletes it: refused while any task of any project, open or closed, has it open in a tab (counted
    from their `agent.json`; its conversation is in its folder), naming them; else after a question ("Delete the account …?",
    naming the projects that let go of it): signed out with its agent's own command (`auth logout`: what it keeps
    outside its folder goes too, the Keychain's entry on macOS), then its folder, with its sign-in, settings and
    conversations.
  The task's account wins over the project's own environment (a `.envrc` setting `CLAUDE_CONFIG_DIR`): its variable
  is typed with the agent's command ("The agent", above).
- The dialogs are part of the window, not windows of their own: no extra process. `AgentPicker.vue` (choosing) and
  Settings → Agents (`AgentsTab.vue`, its state kept by Settings, so an install goes on behind a project's page and
  Settings stays open while it runs) share the state of one list of agents with Install (`lib/agents.ts`), each with
  its own; choosing draws it as radios (`AgentList.vue`), Settings as a list and the chosen one's details.
- An agent's state on the tabs comes from its hooks, each agent's at its own terminal's URL ("Several agents in a task"). Kulisa has events of its own (`agent-hooks.ts`): `prompt`
  working, `waiting` for the human, `stop` done, `interrupt` and `session-end` unknown (but a session ending after a
  done turn keeps it). Which of an agent's hooks sends which is the agent's, in one place each:
  - Claude Code, its plugin's `hooks.json` (checked with 2.1.293, 2026-10-08): `UserPromptSubmit`, `Stop`, and
    waiting when it asks for a permission or a question (`Notification` matched to `permission_prompt`,
    `elicitation_*`) or a turn ends with an API error (`StopFailure`: a limit, a sign-in); `SessionEnd` (`/exit`,
    `/clear`). Not `idle_prompt`, sent a minute after an answer: the tab already says done. Esc ends a turn without
    any hook, so Kulisa itself takes an Esc typed into an agent's terminal for the interrupt: working or waiting
    become unknown (`Task.interrupted`; an Esc that only closed a menu does so too, until the next hook).
  - Codex, its entry in `agents.ts` as a config override (`-c hooks=…`; built from its documentation, not yet tried in
    a session: ROADMAP): `UserPromptSubmit`, `PermissionRequest` waiting, `Stop`, `Interrupt` (Esc), `SessionEnd`
    (also after 30 minutes idle), and `SessionStart`, which gives it the open profiles as Claude Code gets them and
    the session to resume. Codex runs a hook only once the human has trusted it (`/hooks`, once: the command line is
    the same for every task); Kulisa never bypasses that, which would run any project's hooks unreviewed too.

  Done means "come and see": once the human sees that agent's tab (in front of the task shown, with Kulisa's window in
  focus; at once when it was on screen) its tab and its task's show nothing (`seen`, `Task.tabState`), the agent still
  done for the rest of Kulisa.
  Other agents show none yet (ROADMAP).

## Several agents in a task

A task may hold several agents at once, each in a tab of its island with a conversation of its own: Claude Code next to
Codex, or two accounts of one, or the same agent twice (decided with the author 2026-10-12; [window.md](window.md),
The terminal, for the island). The human opens one with the island's **+** (the project's accounts, the default
first): always a **new conversation**. Each sees the task's code and profiles, as the agent of a task always did.

- **One kind of terminal.** A task's terminals are one list (`Task.terminals`): each the user's shell in the task's
  folder, an agent started in it or not. An agent's has its conversation (an index into the task's `agent.json`: its
  account, its session as its hooks report it, when, the name it gave it, the terminal it is open in); a shell has
  its name and the command typed in.
- **Each agent reports for itself.** Its terminal has URLs of its own under the task's
  (`/task/<project>/<n>/t/<id>/mcp`, `…/hooks/<event>`: `KULISA_MCP_URL`, `KULISA_URL` in its environment), so its
  hooks give its own state, shown on its tab, and its session goes to its own conversation. The task's tab in the
  tasks' bar shows the most urgent of its agents: waiting for the human, else working, else done and not seen.
- **Each names its own tab**, in 1 to 3 words, with `conversation_rename` (as `task_rename` names the task); until then
  its tab has its agent's name (`Claude Code`, `Claude Code 2` when two have it).
- **No handoff by itself.** An agent opened with + is told nothing: a second agent is opened as often for a task of
  its own (check the layout on a phone) as to take over, and Kulisa cannot tell which. The human says it in their own
  words ("go on with what Claude did"), and the agent finds that conversation in `task_history`: where the task
  stands, then its conversations, numbered, each with its tab's name, its agent, open or closed, when, and the human's
  first and last request in it; then the one asked for, whole ([transcripts.md](transcripts.md)).
- **Handing the task over** is the human's click: the agent's icon on its tab (or **Change agent…** in its tab's or
  its terminal's menu) lists the project's accounts, the same one too; the one chosen opens in a new tab, its first
  message as if the human typed it (a command-line argument, `prompt` in the agent's entry): go on with the work of
  conversation N ("its name"); read it whole in `task_history` first; then tell the human in a few lines what is done
  and what is next. Its first answer is the check: what it missed shows at once. The tab it came from stays: the
  human closes it (they may copy from it first). **New Conversation** (the same menus) opens the same agent anew,
  told nothing.
- **Closing an agent's tab asks first, always**, whatever it is doing; its conversation stays in the task's history.
  A shell closes without a question, as a terminal's tab does. The last one closed folds the island to its +.
- **After a restart** each tab comes back where it was, the one in front too: an agent's conversation resumed
  (`--resume`, `resume`), a shell with nothing running.
- **Its terminal tools reach shells only**: `terminal_run`, `terminal_read`, `terminal_stop` refuse another agent's
  tab (a command typed there would be a message to that agent, Ctrl+C would stop it); what an agent did is read in
  `task_history`.
- Deleting the task forgets each conversation in its own account's folder (`forget`).

What does not move from one agent to another: its hidden reasoning, permissions given in its session, settings of one
account (its MCP servers, skills). What runs in the task's shells (`terminal_run`) goes on: they are the task's.

Whether an account has tokens is not asked first: no CLI says it to a program (`/usage`, `/status` are the human's).
It shows at its first answer.

Why so, and what was not chosen (2026-10-11, 2026-10-12):

- **Several agents side by side, not one switched** (built so first, 2026-10-12, Change agent… stopping the agent and
  starting the next one in its place): a side task needed a task of its own, and an agent was stopped to take another
  over. Each in a tab, the human keeps both, closes one when done.
- **The new agent reads the whole conversation**, lightly cut ([transcripts.md](transcripts.md)), and writes its own
  handoff. The old agent cannot write one: its limit is reached, and `/compact` is a request to its model too.
- A conversation moved to another account of the same CLI and resumed there (built first: Claude Code's files moved
  between config folders): with a new conversation for every agent opened, the conversation before is read, not
  continued.
- A mechanical summary alone: details that matter are spread through a long conversation, and rules lose them (the
  author).
- A history Kulisa writes as the work goes, or notes the agent writes through a tool: the transcript is on disk
  already, written by the agent; a copy adds only code, notes cost tokens and depend on the model remembering them.
- Converting a transcript into the other CLI's own format and resuming it there (txcript, baton,
  claude-codex-bridge): young tools over two undocumented formats that change with each release, a failure exactly
  when a limit is reached; and a transcript longer than the other model's window.
- A small local model writing the handoff (LLMLingua-2, a model through llama.cpp): tens of minutes on a CPU for a long
  conversation, gigabytes of memory, and it misses what a coding agent would find.
- A proxy giving the old CLI another vendor's model (`ANTHROPIC_BASE_URL` to a gateway such as LiteLLM; the author's
  idea, the one truly seamless way): it needs that vendor's API key (a subscription's sign-in is the CLI's own, and
  Kulisa reads no tokens), a gateway process of another's, and drops signed reasoning. A candidate for an extension.
- Anthropic's Consumer Terms (read 2026-10-11): several accounts are not forbidden; "bypassing any of our systems or
  protective measures" is. Going on with another vendor bypasses nothing; a second subscription of the same vendor
  to get around a limit may count as bypassing: the human's choice, so Kulisa never offers a switch on its own.

## Creating a task, step by step

1. **Code** (`worktrees.ts`), a copy of each of the project's repositories with a commit; a folder without git is
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
   does not ask (`agents.ts`).
7. The task is shown.

## What is on the computer

In Kulisa's data folder (`~/.config/Kulisa` on Linux, `~/Library/Application Support/Kulisa` on macOS,
`%APPDATA%\Kulisa` on Windows), laid out as Chrome lays out its user data (`store.ts`). Show Data Folder in a
project label's right-click menu opens its `projects/<id>` in the file manager (`shell.openPath`), for the human who
asks where it is or what takes the disk; nothing in it is for editing by hand, so it is no button in sight:

```
projects.json                     the projects: id, name, folder, repos, color, icon (a name or a picture's path), agents (accounts, the default first)
profiles.json                     the profiles, one store: who each is, its projects, a test user's pair (profiles.md)
profiles/Profile <k>/             a profile's master, where the human signs in once for every task
agents.json                       the agents' accounts (accounts.ts): { next, list: [{ id, agent, email, folder, projects }] }
agents/<agent>-<n>/               an account's config folder (CLAUDE_CONFIG_DIR, CODEX_HOME): its sign-in, settings,
                                  conversations; gone, signed out first, when the human deletes it (Settings →
                                  Agents); one a sign-in left
                                  unfinished (Kulisa quit meanwhile) goes at the next start
settings.json                     the Kulisa zoom, the theme, where the tasks' bar is; the windows: each one's
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
    agent.json                    { agent, conversations: [{ agent, sessionId, transcript, started, from, to, title,
                                  terminal }] }: the agent it was made with; every conversation an agent had in it
                                  (Several agents in a task), kept with the task
    terminals.json                { front, list: [{ id, name, by } | { id, conversation }] }: its island's tabs, opened
                                  again when it loads; one goes when closed; an empty list: the island folded
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
| A cloned repository | `<location>/<name>/`, or `<location>/<name>/<repo>/` for several (New Project, Clone from URL); `~/Kulisa/<project>/<repo>/` or next to the project's folder (Clone on its page) | cloning; stays, as the human's (removing it from the project, or the project, leaves it) |
| An empty first commit | the project's repository | New Project… with Create Git repository |
| direnv's permission for the task's `.envrc` | direnv's data (`~/.local/share/direnv/allow/`) | creating a task, if the project's is allowed |
| Claude Code's trust of the task's folder | Claude's config: `<CLAUDE_CONFIG_DIR>/.claude.json`, else `~/.claude.json`, `projects["<task folder>"]` | the task's Claude starts, if the project's folder is trusted |
| Claude Code's language, chosen for dictation | `<config dir>/settings.json`, `language` (as its `/config` sets it) | the human picks a language in the island's row of tabs; stays, as the human's setting |
| An agent's conversation | the agent's own data (Claude: `<config dir>/projects/…/<session>.jsonl`; Codex: `<config dir>/sessions/`), in its account's folder (`agents/<agent>-<n>/`) | the agent runs |
| The agent itself, when Kulisa installed it | its maker's place (`~/.local/bin/claude`, `~/.local/bin/codex`, …) | Install in Settings → Agents |

Nothing is written into the project's own folder (but the first commit of a project Kulisa made).

## Deleting a task: what goes

One function deletes a task (`deleteTask` in `projects.ts`), whether the human deletes it (Delete Task…) or its
project is deleted. A deleted task leaves nothing on the computer that Kulisa or its agent made for it. Kulisa stops
its agent and closes its profiles, then deletes:

- each copy (`git worktree remove --force`) and its branch (`git branch -D`), and its folder of copies; a branch
  already pushed stays on the remote;
- direnv's permission for its `.envrc`: the records in `<XDG data>/direnv/allow/` naming it (`worktrees.ts`; not
  `direnv deny`, which newer direnv records too);
- its data folder `projects/<id>/<n>/`, profiles with their sign-ins (also listed in `deleted-folders.json`,
  removed at the next start if a file was still open);
- what its agent keeps of the task's folder (`agents.ts`, each agent's `forget`; undocumented layouts, so what is
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

**Delete Project…** in ⋯ at the top of a project's page in the projects' manager, open or not: there
alone (the author, 2026-10-11: with everything else about a project; not in its group's menu, the Welcome screen or
a menu). One function (`deleteProject` in `app.ts`): Kulisa asks first, saying what goes and which tasks have
work not in main and not pushed; closes its group if it has one; deletes each of its tasks as above; then removes it
from `projects.json` with its data folder `projects/<id>/`. The project's own folder stays as it is, and so do its
agents' accounts, let go of (Settings → Agents deletes one: "Choosing the agent", Accounts).

## While Kulisa runs

- **One Kulisa per data folder** (`app.requestSingleInstanceLock`, at the top of `start` in `app.ts`): a second one
  started on the same data shows the first one's window and quits before it reads or writes anything. Until
  2026-10-12 a second one ran beside the first, without its MCP server (the port taken), and the two wrote over each
  other's saved tabs, session cookies and tasks. Electron's lock is the data folder's: Kulisa on another
  (`KULISA_DATA`) runs next to it, as the tests' apps do, each on its own.
- Each window shows one task of its shown group. The others keep running, the other groups' too: their
  pages and agent go on, their pages hidden.
- A task loads (its profiles start, its agent starts) the first time it is shown, also after a restart.
- A task is known among all open ones by its key, `<project id>/<n>` (the window, the terminals). Each has its own
  MCP URL, `http://127.0.0.1:4450/task/<project id>/<n>/mcp`, and hooks under `/task/<project id>/<n>/hooks/` (each part
  percent-encoded: ids have letters of any language); its agent gets them in its environment (`KULISA_MCP_URL`,
  `KULISA_URL`) and sees only its task's profiles. Profile ids repeat across tasks; inside Kulisa a profile
  is `<project id>/<n>/<id>` (CDP proxy, highlights).
- Closing a group closes all its tasks; opening one again resumes its agent where the agent can (Claude `--resume`,
  Codex `resume`). Restarting brings back every window's groups with their open tasks.

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
- **The last task's × closes the group**, as Chrome's tab group goes with its last tab: a group with no open task
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
- **Tasks and groups in the background keep running**, their pages and agents. Memory: each agent is a
  process of its own (Claude Code about 200–400 MB) plus its profiles' tabs.
- **Another project's task opens beside the shown one** (its group, an island in the bar), as a browser opens a tab.
  At first opening a project closed the shown one and stopped its agents; now the human closes a group (Close Group)
  when it is safe.
- **Several windows are one Kulisa**, not a second instance: two cannot share the data folder. A group moves with
  its pages' native views (`Profile.moveTo`), not loaded again, and with what its terminals show (xterm's serialize
  addon, as VS Code keeps terminals), at their size, so its agent is never told a default one. A window is one more
  renderer process for Kulisa's own page, only while it is open.
- **Claude's trust of a task's folder**: Claude's config is undocumented; when the file is not as expected, nothing
  is changed and Claude asks as usual. Claude rewrites that file often; Kulisa writes it whole at once (a rename),
  and a write of Claude's at the same moment may undo it (then Claude asks).

## The code

| File | What |
|---|---|
| `src/main/app.ts` | the windows; open, close and move projects (one change at a time, `serial`); IPC |
| `src/main/window.ts` | a window: its groups (open projects in code), show a group or a task, the grid's state, its questions |
| `src/main/projects.ts` | a project's group (an open project in code): its tasks; making, closing, opening again, deleting one (with the question); deleting a project's data |
| `src/main/tasks.ts` | a task: its profiles, its terminals and agents (open, hand over, close, environment), renaming, copies of its profiles for a new task, ports |
| `src/main/worktrees.ts` | git: a task's worktree and branch, files outside git, direnv, changes, renaming the branch, removal |
| `src/main/agents.ts` | the agents to choose from: find, install, start, resume; Claude's folder trust |
| `src/main/store.ts` | the data folder above |
| `src/main/terminal.ts` | the task's terminals' ptys (window.md, The terminal) |
| `src/renderer/components/TaskBar.vue`, `NewTask.vue`, `Empty.vue`, `ProjectEditor.vue` | the tasks' bar (an island per project); its + (every project, their closed tasks); the empty window's island; the projects' manager |
| `src/renderer/components/TaskTab.vue`, `TaskRename.vue` | a task's tab in the bar, its menu, the Rename Task dialog |
| `src/renderer/components/AgentPicker.vue`, `AgentsTab.vue`, `AgentList.vue` | choosing an agent when the one to open is not there; Settings → Agents, the agents, the chosen one's details and accounts; the radios of agents with Install that choosing shows |
| `src/main/accounts.ts`, `src/renderer/components/AccountSignIn.vue` | the agents' accounts, one store; a new one's sign-in in Settings (a project's page, or Agents) |
| `src/renderer/lib/grid.ts`, `components/Grid.vue` | building a task's grid; the slide (a view transition) |
| `test/tasks.ts` | the tests; `test/restart-tasks.ts` after a restart; `test/unit/agents.test.ts` |
