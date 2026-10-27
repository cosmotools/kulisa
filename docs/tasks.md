# Projects and tasks

What projects and their tasks are, what the human does, what Kulisa creates on the computer and removes, why, and the
code. What is left: GitHub issues. Profiles: [profiles.md](profiles.md); the window: [window.md](window.md).

## Projects

A **project** is the configuration its tasks are made from: a name, its agents (one the default), its profiles (each a
person in one store, [profiles.md](profiles.md)), and its code: one or more repositories (one the default), or a
folder without git (`~/KulisaProjects/<project>` by default, or one the human picks). Its tasks work in copies of the
repositories (git worktrees), so the project's folders stay the human's. Its data is in Kulisa's data folder
(`projects/<id>/`), never in the project's folder, so sign-ins stay out of its git.

- **A project is no thing to open; its tasks are.** An open task is a **tab** of a window, as a browser's. No Open or
  Close Project, no question where to open one: a task opens in the window it is asked for, at the end of its bar. In
  code a project is **loaded** (`Project` in `shell.open`: its git, its agents' accounts) while a task of it is open in
  any window; let go when its last open task closes (`unloadIdle`, `open-tasks.ts`).
- **The tasks' bar**: a tab per open task, of any projects, in the bar's order: its project's icon (its site's favicon,
  or the curtain in the project's color), its agent's state (below), its name, ×; the project's name in its tooltip.
  A click shows it; the others keep running. Where the bar is and how its tabs look: [window.md](window.md), The
  tasks' bar.
  - **Nothing in it moves** when another task is shown: every tab keeps its width (the room of its ×), so the human
    does not miss.
  - **The middle button on a tab closes the task.**
  - **A tab's right-click menu**: the shown one's profiles, open (in the grid) and closed (opened in the task), and
    Manage Profiles… (Settings → Profiles); Add Repository, the project's repositories it has no copy of (Tasks,
    below); Rename…; Show Folder (its worktree, or the project's folder without git; `shell.openPath`); **Move to New
    Window**, **Move to Window: …** (one row per other window, named by the task it shows and how many more it holds:
    "task-3 (+2)"); Close; Delete Task…; then **the project's submenu** (`{ submenu }`, [ui.md](ui.md), Menus: the
    project has no tab of its own): New Task, **Move All Tasks to New Window / to Window: …** (its open tasks of this
    window), Project Settings…, Show Data Folder, Delete Merged Tasks… (Tasks, below), **Close All Tasks** (its open
    tasks in every window, asked once when an agent works). The project's name is changed in Settings only.
  - **A task's tab shows nothing of its profiles**: Settings edits them, and how many are open says nothing.
  - **The + after the tabs** (`TaskBar.tsx`): a new task of the shown task's project, in one click.
  - **The window's pages** (`page` in `lib/store.ts`), one at a time in the grid's place: the shown task's grid
    (`task`), the sidebar docked with no task open (`sidebar`), the welcome with no project (`welcome`). One switch, not a
    router: it follows the main process's current task.
- **Settings** (the title bar's button left of ☰), as JetBrains' Settings: over the window's area under the title bar,
  not a dialog (a dialog reads as a web page's: [ui.md](ui.md), Desktop, not a web page; how it opens and closes:
  [window.md](window.md), Settings). On the left its categories, as Windows' Settings: **Projects** (each with its icon
  in its color), **Agents** ("Choosing the agent"), **Profiles** ([profiles.md](profiles.md)), GitHub, Log, About; on
  the right a category's page, its things a row each, or one thing's page under its path ("Projects › shop", the
  category a link back) with **⋯** at its end. A category's button at its path makes one (Profiles: New Profile, its
  name typed in place, Enter makes it and shows its page, Esc puts it away; Agents: New Account, a menu of the agents
  an account can be made of, as agents are installed, not made; Projects: none, a project is made in a tasks' window,
  New Project…). A row's right-click has what its page's ⋯ has (a project's or profile's Delete…, asked first; an
  agent's Install and New Account…). Project Settings… opens it at that project; Manage Profiles… at Profiles, About
  this profile… at a profile.
  - **A project's page** (`components/settings/ProjectPage.tsx`): **⋯** (Delete Project…), then **Name** and **Local
    addresses** (a host each, Enter adds one), then **Folders**, **Agents**, **Profiles**, a section each:
    its **Add …** (a menu), a row per thing with its **⋯** (Make Default, Remove from the Project; its right-click the
    same). What needs typing (a URL to clone, a new profile's name) opens a field under the rows (Esc puts it away).
    Its folder is shown, not changed.
  - **Profiles** there are only which profiles its tasks have: Add Profile makes one in it or adds another, Remove
    from the Project… lets go of one (the profile stays); who a profile is, is Settings → Profiles'.
  - **Everything is saved as it changes** (nothing asks what a Save would cover); the name on Enter or leaving its
    field, also when Settings closes or another project is chosen.
- **New Project**, three steps, so a newcomer goes through all a project needs in one place: **Code**, **Agents**,
  **Profiles**, then Create, which makes the project and opens its first task. Next checks a step as Create would;
  nothing is made before Create (but an agent's account signed in to on the way: accounts live on their own); Back
  keeps what was typed. The welcome's with no project, else a dialog (New Project… at the sidebar's foot): the
  same steps (`components/NewProject.tsx`). The first step: where its code comes from (tabs over the form), then the form
  (**Name:**, **Location:**). Code already on the disk or at a URL is the project's own, with no
  empty folder made beside it:
  - **New folder**: a name and a location, `~/KulisaProjects` unless typed or browsed (every new project's place, as
    JetBrains' `~/PycharmProjects`; a name not to be taken for Kulisa's data folder); the step shows the folder it
    makes (`<location>/<name>`). A folder there already is taken as it is, its files kept.
  - **Folders on disk**: one or several (a frontend and a backend: typed and Add, or + over the list, which browses;
    each a row with "git" or "no git", − leaves the selected one out), taken as they are, nothing made. The first is
    the default. A folder that is not there, or a project's, is refused as it is added.
  - **Clone from URL**: one or several, cloned with the user's own git. One into `<location>/<name>`; several into
    `<location>/<name>/<repo>` each, the first the default (the folder holding them is none of the project's); Clone on
    its page puts the next one there too. Refused: a folder there with files. Create says Cloning… meanwhile; a URL git
    cannot clone leaves nothing, the clones before it neither.
  - In the welcome, one folder or one URL in a field (and Browse…), a line under it saying the others are added in
    Settings (several are the dialog's). Its name is asked only for a new folder (Project name:); code from the disk
    or a URL has the folder's or repository's, said in the line under it ("The project shop takes … as it is"), its
    field shown only when it will not do (empty, a folder there already, a name Create refuses).

  The name is the first folder's or repository's until the human types one. A folder or URL typed and not added counts
  when Next is pressed. The step says what will happen as it is typed ("… is there already", "… is a git
  repository", "The repository will be cloned into …"; refused at its field: a file, or a folder a project has).
  Color and icon are not asked (below). Git is not asked of: a new folder, or one without git, is a plain folder its
  tasks work in ("Without git", below); a developer who wants git asks the agent, and tasks made once it has a commit
  get copies.
  - **Agents**: the accounts there are, ticked (one or several), one the default (★; the first ticked unless another is
    starred): a new task starts it, the others open beside it ("Choosing the agent"). The terminal is no choice:
    every project has it, and one with none ticked starts its tasks with it. Under them **Add account**, a button per
    agent an account can be made of: its sign-in, as New Account…, the account ticked. An agent not on the computer is
    installed first, by itself, with its maker's installer, then signed in; Details shows the installer at work
    (`InstallProgress` in `components/AgentPicker.tsx`).
  - **Profiles**: new ones, a name and who it is each (the agent chooses by it), and the human's other profiles,
    ticked; none: the agent makes those it needs. No signing in there: real accounts are signed in when the agent
    asks, or with Sign In… in Settings → Profiles.
  - **Create**: one call (`project:new`), the core making it all (`createProject`, `projects.ts`: code, agents in
    order, profiles); what could not be added of the agents and profiles is logged, the project made all the same.
    Its first task opens in this window (`project:open`) with its default agent, nothing asked.
- **Showing another task** slides the grid towards its tab, as macOS desktops do (a view transition, the pages as
  pictures meanwhile; not with reduced motion), the other grid built in place, so nothing jumps; out past the window's
  edge with Material's standard easing, so no strip of the page lingers. When a task closes, the one next to it is
  shown, or the empty window after the last.
- **Move to New Window** puts the task into a window of its own next to this one (a second monitor); **Move to
  Window: …** into that window, as a browser moves a tab. It keeps running: its agents, its pages (moved, not loaded
  again), what its terminals showed. A window's only tab does not go to a new window; moved into another, its window
  closes. **Move All Tasks to …** moves the project's open tasks of this window, one after another. **Dragging a
  tab** does the same: within the bar it changes the order (kept); let go on another window's bar, the task moves
  there, where it was let go; outside every Kulisa window, it opens in a new window there (appearing when the mouse is
  let go, as in VS Code). Each window has its bar and its + (a task opens in the window whose + was pressed).
- **The OS's × on a window** closes its tasks after one question ("Close the window?", naming them); on the last
  window it quits Kulisa, and the windows with their tasks come again at the next start, so it asks only when that
  would stop a working agent ("Quit Kulisa?"). On macOS the last window's × hides it, as Mac apps do: its agents,
  terminals and pages go on, the Dock's icon shows it again; ⌘Q quits, asking as above, the window shown for the
  question. A window whose last tab closes closes too, unless it is the only one: then it is the empty window.
- **Each project has a color and an icon**, to tell projects apart: the color is the title bar logo's curtain while
  one of its tasks is shown (`--project`, `lib/store.ts`); the icon is on its tasks' tabs
  and its row in the sidebar, in its color. **Both are Kulisa's, nothing to choose** (a project is
  made to work in, not to be set up):
  - **The icon: its site's favicon**, the curtain while it has none: `favicon.*` (svg, png, ico, webp, gif, jpg)
    anywhere in its code, `icon.*` only in an `app/` folder (Next's; elsewhere `icon.svg` is any component's). The
    files git lists in each of its repositories, the default first (new ones too, not ignored ones: no library's
    favicon from `node_modules`); a folder without git read a few levels down, without hidden folders,
    `node_modules`, `dist`, `build`, `vendor`. Of several: the nearest to the top, then svg, png, ico, then a favicon
    before an icon, then by name (`apps/admin` before `apps/shop`). Looked for once, without holding the window up;
    again as its settings open, so a favicon changed meanwhile shows. A picture up to 128 KB is shown as it is; a
    larger PNG or JPEG made 64 px wide (`nativeImage` reads only those two on every OS); another larger one is not
    shown (the curtain).
  - **The color: its favicon's hue** (`renderer/lib/project-color.ts`), read in the window, where Chromium draws any
    favicon on a 32 px canvas, by colorthief (MIT, the most used of its kind; its palette with each color's share, its
    filters of transparent, white and gray pixels): the hue of the largest colored part, near-black left out (HSV
    calls a dark red saturated). Lightness and chroma are those of Kulisa's eight colors (OKLCH 0.61, 0.12), so it
    suits both themes (a site's navy is lost in the dark one, its yellow glares in the light one). A favicon with too
    little color (under a tenth: a black or gray mark, an SVG in `currentColor`), or none: the color `projects.json`
    keeps, the next free of the eight given when it was made. Two sites of one hue are one color. Nothing of it is
    stored: worked out as the window gets the favicon.
- **Its agents** (its page): its agents' accounts and the terminal only ("Choosing the agent", Accounts). **+** adds
  the terminal only or any account (made in another project or Settings → Agents), or, under New Account, makes one,
  signed in there; − lets go of the selected one at once (the account stays: Settings → Agents deletes it). The first
  is the default, marked "default" (**★**, or Make Default in a row's right-click): a new task runs it; others open in
  a task with the terminals' + ("Several agents in a task"). **★** on the default (No Default) leaves none the default
  (`noDefaultAgent` in `projects.json`): new tasks start with nothing, the terminals' big buttons in the empty grid
  ([window.md](window.md), The terminal). None at all: its tasks start with the terminal only.
- **Its folders** (its page): the repositories or plain folders its tasks work on, the default first (marked when
  there are several; **★** or Make Default: new tasks get a copy of it, their agents start there; the others a task
  adds when it needs them: Tasks, below). **+**: **Add Folder…**, or **Clone from URL…** with the user's own git (its
  credentials and keys; git asks for no password, so a private repository it cannot reach fails with git's words;
  cloned next to the default folder, never inside one of the project's). A repository added is copied into no task.
  **−** (Delete, right-click) removes one from the project (its folder stays), only when no task has a copy of it or
  works in it: the refusal names those tasks (deleting a copy would delete their work). All folders are alike, git or
  not: one without git stays, the default too, when repositories are added (`projects.json` keeps one list).
  Each repository's row has its **GitHub account**: the one its origin's remote is bound to (`remotes.ts`, the same on
  every computer), else the first account that reaches it, bound then; a line under the list for one no account
  reaches or whose account is signed out ([src/github](../src/github/README.md), A repository's account).
- **The sidebar** (`components/Sidebar.tsx`, `lib/sidebar.ts`): every project with its tasks, a tree, any task one
  click away, the project worked in last first (`lastWorked`, `lib/common.ts`). Docked in the empty window; over the
  grid while a task is shown (the title bar's button, Ctrl+Shift+A), covering the pages as a dialog does, closed by a
  choice, Esc or the same again.
  - **A project's row**: its icon, its name, its tasks under it (folded by its arrow); **+** under the pointer, a new
    task with its default agent; its right-click: New Task, Project Settings…, Show Data Folder and Delete Merged Tasks…
    (while it is loaded; the second when there are), Close All Tasks (when a task of it is open).
  - **A task's row**: the open first, then the closed, the one closed last first; its agent's state when it is open in
    this window, "open" when in another, its branch (when its name is another), when it was closed, "merged". A click,
    Enter or Space shows it (its window brought to the front) or opens it again; its 🗑 (under the pointer or the
    keyboard) or Delete: Delete Task…'s question; its right-click: Show or Open, Close, Delete Task…. A project without
    tasks says so.
  - **New Project…** at its foot.
- **The empty window** (CLAUDE.md, Terminology), at the first start and after the last task closes (×, Close All
  Tasks, the project deleted): the title bar, no tasks' bar, and in the grid's place (`components/Empty.tsx`) the
  sidebar docked, beside it what to do.
- **The welcome** (`components/Welcome.tsx`), with no project: what Kulisa does in three slides (its agent in your
  browsers; checking as every user; Pick), with Skip, then New Project's steps under a question each ("Where is the
  code?"), in a card on the window's background. Back on the first step goes back to the slides. The slides' picture
  shrinks in a low window and is left out in a narrow and low one: the welcome fits the window's least size (640 ×
  400) without scrolling. New Project's own steps under another head ([ui.md](ui.md), Clusters), made anew each time
  they are shown and not there otherwise (their fields' ids are the dialog's too). At the first start the keyboard is
  on Next (`shell.firstStart`). The links and Kulisa's version are ☰'s.
- **Later starts** open the windows that were open, each with its tabs in their order, showing the one shown last
  (`windows` in `settings.json`, the tasks by key); an open task no window names (a crash) goes into the first
  window's bar. `KULISA_PROJECT=<folder> npm start` shows a task of that project in the first window: its first open
  one, else the one closed last, else a new one.
- **An agent** starts in the user's own shell in the task's folder, as if typed there, so the project's environment
  applies (direnv's `.envrc`, nvm, mise), not Kulisa's. When it exits, the shell stays. Its account's variable is
  typed before the command (`CLAUDE_CONFIG_DIR=… claude …`), so it wins over an `.envrc` that sets it too (else the
  task runs as another account, silently); each argument quoted as that shell reads it
  ([src/terminal](../src/terminal/README.md)). On Windows the shell is PowerShell (its profile applies), the variable
  set first (`$env:CLAUDE_CONFIG_DIR=…`). direnv's state in Kulisa's own environment (started from a folder direnv had
  loaded) is dropped at start (`DIRENV_*`, `app.ts`): a task's shell would take it for that folder left and undo its
  `.envrc`, the account's variable with it.

## Tasks

A **task** (CLAUDE.md, Terminology) is one line of work in a project: its own copy of the code on a branch, browser
profiles, a grid of panels and agents in terminals, so several agents build several features of one project at once.

- **Always a copy.** With git (and a first commit), a task's work is in a git worktree of the default repository on a
  branch of its own, the first task's too, made when its agent asks ("Making the task's worktree"): next to the
  repository (`myshop@task-k3x9q2`), or with several repositories in one folder of the task's
  (`~/KulisaProjects/<project>@<branch>/<repo>/`, one place to see and delete), where the others' copies go too.
- **Another repository when the work needs it** (a task on the backend may need the frontend; a copy no task needs is
  made for nothing). The ones a task has are named at the end of its terminals' row ([window.md](window.md), The
  terminal). The project's other repositories are added one at a time: by the human, Add Repository in its tab's
  menu; by the agent, `task_add_repository`, once the human agreed in the conversation (the skill and the MCP
  server's instructions say so; no question of Kulisa's: the author's choice). A copy on the task's branch in its
  folder of copies (`Task.addRepository`, `Project.addCopy`; a task in a folder without git has no worktree: its first
  copy takes a branch named as that worktree would be).
  - **Its running agents are given it** by Kulisa, typed as the human would (`giveDirs`, `sendToPrompt`: a `/add-dir`
    left to the human is easily missed), never while the agent waits for the human (Enter would answer Claude Code's
    permission question with Yes, and the line be lost). Claude Code gets `/add-dir <folder>` at once, also in its
    turn: its question (Add directory to workspace) is answered with its first choice, for this session. Others get a
    line saying so once their turn is over (Codex cannot add a folder in a session: its changes there ask for approval
    until its next start); a draft the human is typing there gets the line too (Kulisa cannot see the prompt).
  - **At their next start** agents get all of them: Claude Code and Codex as `--add-dir` (Claude Code reading their
    `CLAUDE.md` too: `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD`), every agent in the MCP server's instructions
    and at its session's start (`agents/`, `dirs`). The repositories it has no copy of are named there too, to read
    in the project's folders without asking, changing nothing.
  - **One not needed is taken out**: by the human, Remove Repository in its tab's menu or on its chip; by the agent,
    `task_remove_repository`, once the human agreed (`Task.removeRepository`, `Project.removeCopy`). Its folder and
    branch go as a deleted task's, and what the agents keep of its folder ("Deleting a task"); asked first only when
    it holds commits not pushed or uncommitted files, named in the question (`askRemoveCopy`). Running agents told of
    it get a line once their turn is over (none can drop a folder: Claude Code keeps it listed until its next start,
    harmless). The task's own folder goes only with the task.
  - The project's folders without git are given to the agent as they are.
- **The project's folder stays the human's**: no agent works in it on its own. Work goes back through git: the human
  asks the agent to merge into main (the agent first checks the project's folder for the human's uncommitted
  changes and stops if there are any: the skill and the MCP server's instructions), or to open a pull request.
- **Without git** (or before a first commit) a task works right in the project's folder: nothing to copy it with. A
  second open task there is made only after a question ("two agents may get in each other's way").
- **Its name** is the one it was given, by its agent (`task_rename`) or the human (Rename… in its tab's menu, or a
  double click on its tab): a label ("Fix header": any one line with a letter or a digit, `labelError` in
  `names.ts`; a project's or profile's name keeps a stricter rule, as it becomes a folder or an id). The branch takes
  a slug of it (`fix-header`; `git branch -m`, `-2` when taken); the folder stays where the worktree was made
  (`<repo>@<its branch then>`), not moved under a running agent. Unnamed it is "New Task", and its tab shows its first
  conversation's auto-title when the agent keeps one (Claude Code's, Codex's: read at session start and after a
  turn's end, `Task.followAutoTitle`, the agent's `title`, [transcripts.md](transcripts.md)). The auto-title is only
  shown, never written as the name or made into a slug. `task_rename` is mentioned once in the skill and the MCP
  server's instructions, never injected turn after turn: the agent names the task when it wants to.

Example: the project `~/IdeaProjects/myshop`, a task of it (id `k3x9q2`), its worktree made while it was "New Task",
then named "Checkout redesign":

```
~/IdeaProjects/myshop/                the project's own folder: the human's
~/IdeaProjects/myshop@task-k3x9q2/    the task: a worktree on the branch checkout-redesign
```

### The Resources panel

Next to the terminal, the task's **resources** (what it has, uses or created), each a row with its actions
(`grid/Resources.tsx`, a panel of the grid: [window.md](window.md), The grid; `Task.resources`, in the task's info):

- A **worktree** per repository the task has made its own (`task_worktree` for the default one,
  `task_add_repository` for another): its name and branch; a click opens its folder. An added repository's is removed
  with its 🗑 (`task_remove_repository`); the task's own goes only with the task.
- The **main working tree** until the task makes its own worktree of the default repository: the project's folder (the
  human's) it opened in, opened with a click, never removed. A task on a folder without git stays here. Kept as a
  resource, not worked out from the project: the default repository may change while the task works there.
- **Artifacts**, under them: the files the agent's tools kept of its pages (`artifacts/`, What is on the computer),
  the newest first: their kind (Screenshot, Snapshot, Request or Response body), profile and time, read from the file's
  name and time (`listArtifacts`, `kulisa-plugin/artifacts.ts`; no list beside the files to go stale). A screenshot
  shows a small picture of itself, made by the main process and kept in memory while the task is loaded
  (`Task.artifacts`): the window never decodes the pictures, megabytes each. Made in the background one at a time
  (`makeThumbs`), the list sent again when they are: a whole page's takes tens of milliseconds, and many would hold up
  the task's terminals starting. The list comes when the task is shown and whenever the agent keeps one
  (`Task.artifactsChanged`, the window's `artifacts`). A click opens the file in the OS's app; its menu: Open, Show in
  Folder, Delete (no question: Kulisa's data, not the human's work). Their heading says what they take, from the
  activity monitor ([src/activity-monitor](../src/activity-monitor/README.md); `Task.artifactsUsage`), so the human
  sees a task gather them; its 🗑 deletes them all. The agent: `task_artifacts` lists them with their sizes (or each
  task's total), `task_artifacts_delete` deletes some or all, of its own task only (another task's agent may be
  reading its own).

The panel shows the resources as `tasks.json` keeps them, the first where it works (`store.ts`, `Resource`): the
task's folder, branch and folder of copies are worked out from them, never kept twice. Ownership decides the actions
and the cleanup: the main working tree is the human's, never removed; a worktree the task made goes with the task.

## What the human does

- **Its tab**: its project's icon, the agent's state (working, waiting for you, done; from its hooks: "Choosing the
  agent"), its name. A click shows the task (the slide: Projects, above); the one left keeps running.
- **A new task** (the tasks' bar's + or Ctrl+Shift+N, for the shown task's project; a project's + in the sidebar, or
  New Task in its right-click menu or in the project's submenu) is made at once, no dialog, from the project's
  configuration alone: the human describes the task to its agent in the terminal. It runs the project's default agent;
  with none, the terminal only. **No profile opens by itself** ([profiles.md](profiles.md), What a profile is): each
  is a browser's processes and memory.
- **×** on a tab closes the task: its agents stop, its tabs close; its code, branch, profiles and conversations stay,
  and the sidebar lists it. Opened again, its agents' conversations resume. Asked only when an agent is working. The
  project's last open task closed lets the project go.
- **Delete Task…** deletes it after a question saying what goes for good: its folder, branch, profiles, its agents'
  conversations, and work not in main and not pushed (its own commits, uncommitted files). Without git its files stay
  in the project's folder. The same delete is on every task's row in the sidebar, a closed one's too, its project
  loaded or not.
- **Merged tasks.** Closed tasks stay until the human deletes them; Kulisa offers it once a closed task's PR is merged:
  each of its copies has commits of its own, all in its remote's default branch (`origin/HEAD`, fetched in the
  background as the project is shown and as a task closes), and nothing uncommitted. A squash or rebase merge puts new
  commits there: they count by their changes, git's patch ids (each of the branch's commits has its like there, or the
  branch's whole change is one commit there), so a change made after the merge keeps the task unmerged. Its row in the
  sidebar says "merged"; the project's menus have **Delete Merged Tasks…**, one question naming them.
- **The terminals' +** opens another of the project's agents, a new conversation in a tab of its own, or a shell; **the
  agent's icon on its tab** hands the task to another agent ("Several agents in a task").

## Actions: the human's and the agent's

As for profiles ([profiles.md](profiles.md), "Actions"), each action is written once, in the core, with its question
to the human; the window's IPC (`ipc/`) and the MCP tools are handles on it:

| Action | The human | The agent | The core |
|---|---|---|---|
| Open a task (its project loaded with it, when it was not) | the sidebar (a closed one, or a new one) | none: it works inside one task | `openProject` (`open-tasks.ts`): the task opened again and shown, or a new one (`createTask`) |
| Close a project's tasks | Close All Tasks in its menus | none: it would stop itself | `closeTasks` (`open-tasks.ts`) in every window, asking once when an agent works |
| Close a window, quit | the OS's ×, ☰ → Exit | none | `closeTasks` for the window's tabs; `quit` (`open-tasks.ts`), asking only when an agent works |
| Move a task | Move to New Window, Move to Window, dragging its tab; Move All Tasks to … for a project's | none: where the human sees it is the human's | `moveTask`, `moveAll` (`open-tasks.ts`) |
| Make a project, with its agents and profiles | New Project (the empty window with no project; New Project… in the sidebar) | none: what a project is made of is the human's | `createProject` (`projects.ts`); its first task: `openProject` |
| Delete a project | Delete Project… on its page in Settings | none: it deletes sign-ins, the human's to decide | `deleteProject` (`open-tasks.ts`), `askDeleteProject`, `deleteProjectData` (`projects.ts`) |
| Make a task | the bar's +, Ctrl+Shift+N, a project's + in the sidebar, New Task in its project's menus | none: parallel parts of a task are the agent's own subagents' (#49) | `Project.createTask` |
| Close a task, open it again | ×, the middle button on its tab, Close in its menu; the sidebar | none: what runs is the human's to stop | `closeTask` (`open-tasks.ts`), `Project.closeTask`, `reopen` |
| Rename a task | Rename… in its tab's menu, or a double click on its tab | `task_rename` | `Task.rename` |
| Read what was said and done in the task before | its terminal, scrolled back | `task_history` ([transcripts.md](transcripts.md)) | `historyPart` (`history.ts`) |
| Delete a task | Delete Task… in its tab's menu; its 🗑 in the sidebar | none: it deletes work and sign-ins, the human's to decide | `askDeleteTask`, `deleteTask`, `deleteClosedTask` (`projects.ts`) |
| Show a task | a click on its tab, of any project | none: what the human looks at is theirs | `AppWindow.show` (`window.ts`) |
| Open a resource's folder | a click on its row in the Resources panel | none: the agent opens folders through its own tools | `task:open-folder` (`ipc/tasks.ts`) |
| Open an artifact, show it in its folder | a click on its row in the Resources panel, its menu | none: the tools' answers give the agent its path | `file:open`, `file:show` (`file-links.ts`) |
| See what the artifacts take | the Artifacts heading in the Resources panel (the shown task's) | `task_artifacts`: its task's files, or each task's total | `Task.artifactsUsage` (src/activity-monitor) |
| Delete artifacts | Delete in a row's menu; the heading's 🗑, all | `task_artifacts_delete`: some or all of its task's | `Task.deleteArtifacts` |
| Make the task's worktree | none: its agent makes it before writing code | `task_worktree` | `Task.makeWorktree`, `Project.ensureWorktree` |
| Add, clone, make the default, remove a project's folder | the project's page | none: what the project is made of is the human's | `addFolder`, `cloneRepo`, `defaultFolder`, `removeFolder` (`projects.ts`) |
| Add a project's repository to a task | Add Repository in its tab's menu | `task_add_repository`, once the human agreed in the conversation | `Task.addRepository`, `Project.addCopy` |
| Remove one added | Remove Repository in its tab's menu, or on its chip | `task_remove_repository`, once the human agreed | `Task.removeRepository`, `Project.askRemoveCopy`, `removeCopy` |
| Add, make the default (or none the default), remove an agent of the project | the project's page | none: what the project is made of is the human's | `addAgent`, `defaultAgent`, `removeAgent` (`projects.ts`) |
| Make an account of an agent | New Account… in Settings → Agents or a project's page | none: signing in is the human's (Rules) | `account:signin` (`app.ts`), `Accounts.prepare`, `create` |
| Delete an account | − in Settings → Agents | none: it deletes a sign-in and conversations, the human's to decide | `deleteAccount` (`projects.ts`), `shell.dropAccount` |
| Add a GitHub account, sign it in again, delete it | Settings → GitHub | none: signing in is the human's (Rules) | `GitHub.startFlow`, `addToken`, `deleteGitHub` (`projects.ts`; [src/github](../src/github/README.md)) |
| Choose a repository's GitHub account | its row on the project's page | none: what the project is made of is the human's | `setGitHub` (`projects.ts`) |
| Open an agent in the task, a new conversation | the terminals' +, New Conversation (a tab's menu), Ctrl+` on the folded terminals | none: which agents work is the human's | `Task.openAgent`, `newConversation` |
| Hand the task to an agent, the work kept | the agent's icon on its tab, Change agent… (a tab's menu) | none: the human's choice | `Task.handOver` |
| Close an agent's tab | × on it, Close in its menu (asked first) | none: it would stop another agent | `Task.closeTab` |
| Name an agent's conversation (its tab) | none: the agent knows what it is about | `conversation_rename` | `Task.nameConversation` |

## Choosing the agent

A task's agents are the human's choice: its project's accounts of Claude Code (Anthropic) or Codex (OpenAI)
(Accounts, below), each in a tab of its own ("Several agents in a task"), or the terminal only (the user's shell in
the task's folder: an agent Kulisa does not know is run there by hand, `KULISA_MCP_URL` in its environment). Kulisa
never assumes one is installed.

- **A new task** opens its project's default agent, its own (`agent` in its `agent.json`); a project with no default
  (`agent: null`) starts nothing, without asking: the terminals' buttons in the empty grid, Ctrl+` gives them the
  keyboard (`Task.ownAgent`, `openOwn`); a project with no agents starts the terminal only. An agent to open that is
  not there (an account let go, an agent not on the computer) asks, in a dialog, among the project's accounts and the
  terminal only, with Install and Cancel (none opens). `KULISA_AGENT` forces one command everywhere, without asking.
- **Install** (Settings → Agents) runs the maker's own native installer (no Node, no sudo, they update themselves),
  the command shown before, its output streamed while it runs, so people who are not programmers type nothing; once
  over, the answer brings the whole output (Electron keeps no order between the stream's channel and the answer's: the
  last line may come after "Installed"). Claude Code `curl -fsSL https://claude.ai/install.sh | bash`, Codex `curl
  -fsSL https://chatgpt.com/codex/install.sh | sh` (`install.ps1` on Windows). On Windows the installer gets the
  system's own programs first in its `PATH`: they call `tar` by name, and Kulisa started from Git Bash has Git's GNU
  tar first, which reads `C:\…` as a remote host. Kulisa does not remove or update agents: they are the user's
  programs.
- Each agent is one entry in `agents/`: how to find, install, start (Claude Code with the Kulisa plugin; Codex with
  the MCP server and its hooks as config overrides, `-c mcp_servers.kulisa.url=…`, `-c hooks=…`), resume (`claude
  --resume` and `codex resume` with the session the `SessionStart` hook reported; else `codex resume --last`) and
  forget a deleted task's folder.
- **Dictation** ([src/dictation](../src/dictation/README.md)): where the agent has its own (its entry's `voice`: its
  key and how often it is typed; Claude Code's voice mode, which needs a Claude.ai account), Kulisa holds its key; for
  one without (Codex has only a realtime voice conversation), another agent's dictation recognizes in a session no one
  sees (its entry's `recognizer`: Claude Code's, in hold mode with `autoSubmit`, its text posted by its
  `UserPromptSubmit` hook and blocked there). Kulisa turns it on for its own sessions (Claude Code: `--settings` with
  `voice: { enabled, mode: "hold", autoSubmit: false }`, not the user's settings). Not `tap` mode: it records only with
  the input empty, so no second sentence can be added.
- **Language**, where the agent has a setting (its entry's `language`: the codes it takes, and how one is written into
  an account's folder): Kulisa's one language (☰ → Language, [window.md](window.md), Language) goes into every
  account. Claude Code's is its `language` setting, which it dictates and answers in, written where its `/config`
  puts it (`<config dir>/settings.json`, the language's English name), the rest of the file kept, not written when it
  says so already, never into a file that is not JSON. Claude Code reads that file again when it changes, so it holds
  at once in every session; a `--settings` file would not (read once).
- **Settings → Agents** (`components/settings/AgentPage.tsx`), as JetBrains' list of SDKs: the agents in the nav (not the terminal only;
  "not installed" at a row's end), the chosen one's page: its maker and website, what it needs, its status (its
  `--version`, and its folder, marked when not on the user's `PATH`: Kulisa runs it from there; Install for the
  others, with the command it runs), and its **Accounts** (below), a list with + (New Account…) and − (asked first;
  also Delete and the right-click). Installing starts nothing: the agent is chosen for a task, or with the terminals' +.
- **The list comes at once**, here and in choosing a task's agent: finding the agents runs the user's login shell
  (`command -v`: Kulisa started from a menu has a shorter `PATH`; on Windows `where.exe`, the first match Windows runs:
  an npm-installed agent is a `.cmd`, run through `cmd.exe`) and each one's `--version`, tenths of a second or more
  with a heavy `.bashrc`. So the window first shows what the last look found, kept in the main process's memory
  (`agents:list`, `cached`; nothing on disk: the computer's state changes without Kulisa), and looks again behind it.
  Only the first time after Kulisa starts does it wait.
- **Accounts** (`accounts.ts`): an agent with a sign-in of its own, so one human runs a work and a personal Claude side
  by side. Each is the agent with its own config folder, given by its variable (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`:
  `config` in its entry); agents without one (the terminal only) are chosen as themselves. The human's own folder
  (`~/.claude`, `~/.codex`) is no account: every account is made in Kulisa and starts clean (no global `CLAUDE.md`,
  settings, plugins, skills or MCP servers of the human's), the author's choice over copying them.
  - **Made** in Settings → Agents (+ over its accounts, or + beside Agents in the nav: in no project yet) or on a
    project's page (Agents' + → New Account: in that project): the agent's own sign-in starts at once, as its `/login`
    does (Claude Code `auth login`, Codex `login`), in a terminal there (`components/SignIn.tsx`), and ends once signed
    in. The terminal is under Details, closed (the address it prints, with the browser open, only confuses); it opens
    by itself when the sign-in fails, and is there for what the browser does not show (the address when no browser
    opened; a code the agent asks for).
  - **Its id** is six random characters, its folder in Kulisa's data its agent's and its id (`agents/claude-k3x9ab/`,
    one no account and no folder has: a removed one's folder may wait for the next start), never renamed: Claude
    Code names its macOS Keychain entry after a hash of the config folder's path.
  - **Its email** is read after the sign-in (`auth status`) and kept in `agents.json`: shown as "Claude Code ·
    ann@shop.com". Codex's status does not say it: read from its `auth.json`, the email of its ChatGPT id token
    (undocumented: none there with an API key, and the account is shown by its id); only the email, never the token.
    An email the store has already is that account: the new folder is signed out and removed, the existing one added
    to the project (in Settings → Agents: said so). Cancel, Settings closed, or a sign-in ended without an account
    keeps nothing.
  - **The sign-in page opens in the user's own browser**, as without Kulisa (Kulisa sets no `BROWSER`); the agent's
    own server on `localhost` takes the answer. The page names the account it signs in to (a browser signed in to
    another account of the same maker may offer that one). The system's browser: as desktop apps sign in (RFC 8252),
    and less code.
  - **One store** (`agents.json`), as the profiles': projects list the accounts they have (`projects.json`'s
    `agents`). The terminals' + and Choose the Agent list the project's accounts and the agents, never another
    project's: the project's page says who works in its tasks.
  - **An account lives until the human deletes it** (a sign-in is made again only by signing in again). − on a
    project's account lets go of it at once, nothing asked: a task running it keeps it; deleting a project does the
    same. In Settings → Agents each account says its projects ("in no project"); − deletes it: refused while any task,
    open or closed, has it open in a tab (from their `agent.json`; its conversation is in its folder), naming them;
    else after a question ("Delete the account …?", naming its projects): signed out with its agent's command (`auth
    logout`: the Keychain's entry on macOS goes too), then its folder, with its sign-in, settings and conversations.
- The dialogs are part of the window, not windows (no extra process). Choosing (`components/AgentPicker.tsx`), New
  Project and Settings → Agents keep their agents and an install under way apart from the page shown (`lib/agents.ts`;
  Settings' `components/settings/agents.ts`, so an install goes on behind a project's page); choosing draws them as radios.
- **An agent's state on the tabs** comes from its hooks, each agent's at its own terminal's URL ("Several agents in a
  task"). Kulisa's events (`agent-hooks.ts`): `prompt` working, `waiting` for the human, `tool-done` working again
  after waiting, `stop` done, `interrupt` and `session-end` unknown (a session ending after a done turn keeps done).
  No agent tells when the human answered a permission, so the first tool to finish after it (`PostToolUse`) is the
  sign it works again. Which hook sends which is a table in the agent's file (`agents/claude.ts`, `codex.ts`:
  `hooks`), each running one command (`hookCommand`, `agents/agent.ts`):
  - Claude Code, in `--settings` with its plugin: `UserPromptSubmit`, `Stop`, waiting when it asks for a permission
    or a question (`Notification` matched to `permission_prompt`, `elicitation_*`) or a turn ends with an API error
    (`StopFailure`: a limit, a sign-in); `PostToolUse`; `SessionEnd` (`/exit`, `/clear`). Not `idle_prompt`, sent a
    minute after an answer. Esc ends a turn without any hook, so Kulisa takes an Esc typed into an agent's terminal
    for the interrupt: working or waiting become unknown (`Task.interrupted`; also an Esc that only closed a menu,
    until the next hook).
  - Codex, as a config override (`-c hooks=…`): `UserPromptSubmit`, `PermissionRequest` waiting (its MCP tools'
    questions too), `PostToolUse`, `Stop`, `Interrupt` (Esc), `SessionEnd` (also after 30 minutes idle), and
    `SessionStart`, which gives it the open profiles as Claude Code gets them and the session to resume. Codex runs a
    hook only once the human has trusted it (`/hooks`), kept per event under one key for every task
    (`/<session-flags>/config.toml:<event>`), so once is enough, and again only when Kulisa changes a hook. Kulisa
    never bypasses that, which would run any project's hooks unreviewed too. Interrupt's and SessionEnd's timeouts
    are at most 3 s (Codex cuts a longer one and warns at every start).

  Done means "come and see": once the human sees that agent's tab (in front in the shown task, Kulisa's window in
  focus; at once when it was on screen) its tab and its task's show nothing (`seen`, `Task.tabState`), the agent still
  done for the rest of Kulisa. Other agents show no state yet (#212).

## What each agent can do

What Kulisa does with an agent is a field of its entry (`agents/agent.ts`, `CAPABILITIES`): an agent has it or says
why not (`lacks`, with the reason); a unit test fails for an agent that leaves one out silently, so a new agent comes
with its gaps named.

| Capability | What the human gets | Claude Code | Codex |
|---|---|---|---|
| `config` | accounts: several sign-ins side by side, each its own folder | `CLAUDE_CONFIG_DIR` | `CODEX_HOME` |
| `skills` | the profiles skill: how to work with the profiles | its account's `skills/kulisa-profiles/` | its account's `skills/kulisa-profiles/` |
| `hooks` | the agent's state on its tab; its session to resume; the open profiles at its start | in `--settings` | `-c hooks=…` (trusted once) |
| `resume` | a closed task, or a restart, goes on with the conversation | `--resume` | `resume` |
| `prompt` | handing the task over: the new agent starts with what to read | an argument | an argument |
| `dirs` | a project's other repositories in a task | `--add-dir` | `--add-dir` |
| `addDir` | a repository added to the task while the agent runs | `/add-dir`, sent at once (not while it waits for the human), its question answered | none: a line saying so, sent after its turn |
| `trust` | the agent asks once a project whether it may work there | `.claude.json` | `config.toml` |
| `localFiles` | the project's own settings of the agent in a task's copy | `.claude/settings.local.json` | `.codex/config.toml` |
| `conversation` | its conversation read by the next agent (`task_history`) | its transcript | its transcript (summaries encrypted) |
| `forget` | a deleted task leaves nothing of it in the agent's data | yes | yes |
| `voice` | dictation by the key held, or the microphone | its voice mode | none |
| `language` | ☰ → Language: the language it dictates and answers in | its `language` setting | none |

## Several agents in a task

A task may hold several agents at once, each in a tab of its terminals with a conversation of its own: Claude Code
next to Codex, two accounts of one, or the same agent twice ([window.md](window.md), The terminal). The terminals'
**+** (the project's accounts, the default first) opens always a **new conversation**. Each sees the task's code and
profiles.

- **One kind of terminal.** A task's terminals are one list (`Task.terminals`): each the user's shell in the task's
  folder, an agent started in it or not. An agent's has its conversation (an index into the task's `agent.json`: its
  account, its session as its hooks report it, when, its name, its terminal); a shell has its name and the command
  typed in.
- **Each agent reports for itself.** Its terminal has URLs of its own under the task's
  (`/task/<project>/<task id>/t/<id>/mcp`, `…/hooks/<event>`: `KULISA_MCP_URL`, `KULISA_URL` in its environment), so
  its hooks give its own state, on its tab, and its session goes to its own conversation. The task's tab shows the
  most urgent of its agents: waiting, else working, else done and not seen.
- **Each names its own tab**, in 1 to 3 words, with `conversation_rename`; unnamed, its tab shows the agent's
  auto-title when it keeps one (Claude Code's, `Task.noteAutoTitle`), else its agent's name (`Claude Code`, `Claude
  Code 2`).
- **No handoff by itself.** An agent opened with + is told nothing: a second agent is opened as often for a side task
  (check the layout on a phone) as to take over, and Kulisa cannot tell which. The human says it ("go on with what
  Claude did"), and the agent finds that conversation in `task_history`: where the task stands, its conversations
  numbered, each with its tab's name, agent, open or closed, when, and the human's first and last request; then the one
  asked for, whole ([transcripts.md](transcripts.md)).
- **Handing the task over** is the human's click: the agent's icon on its tab (or **Change agent…** in its tab's or
  terminal's menu) opens **Change Agent** (`components/HandOver.tsx`): the agent it comes from and the one chosen,
  between them what goes along (the branch, open profiles, their tabs, shells, the conversation), under them the
  project's accounts (the same one too, "afresh"; another agent's first: a limit is the usual reason) and what stays
  behind. Hand over: the one chosen opens in a new tab, in front under the dialog (a tab behind has no size, and its
  terminal broke what the agent drew). The dialog stays while it reads, a progress bar of its real progress ("part 2
  of 5": its `task_history` calls of that conversation, `Task.historyRead` → `handover:read`). It goes once the last
  part is read, or at once when the agent waits for the human (its hooks: a permission, a sign-in, a limit), its tab
  is gone, or 30 s pass with no part read (an agent without hooks waiting); Show now and × any time. Its first
  message, as if the human typed it (a command-line argument, `prompt` in its entry): go on with the work of
  conversation N ("its name"); read it whole in `task_history` first; then tell the human in a few lines what is done
  and what is next. Its first answer is the check. The tab it came from stays: the human closes it. **New
  Conversation** (the same menus) opens the same agent anew, told nothing.
- What does not work well in a handover, and whether several agents at once are worth it: issue #93.
- **Closing an agent's tab asks first, always**; its conversation stays in the task's history. A shell closes without
  a question. The last one closed folds the terminals' panel to its +.
- **After a restart** each tab comes back where it was, the one in front too: an agent's conversation resumed
  (`--resume`, `resume`), a shell with nothing running.
- **Its terminal tools reach shells only**: `terminal_run`, `terminal_read`, `terminal_stop` refuse another agent's
  tab (a command typed there would be a message to that agent, Ctrl+C would stop it); what an agent did is read in
  `task_history`.
- Deleting the task forgets each conversation in its own account's folder (`forget`).

What does not move to another agent: its hidden reasoning, permissions given in its session, one account's settings
(its MCP servers, skills). What runs in the task's shells (`terminal_run`) goes on: they are the task's.

Whether an account has tokens left is not asked first: no CLI says it to a program (`/usage`, `/status` are the
human's). It shows at its first answer.

Why so, and what is not chosen:

- **A dialog, not a menu**: handing over is where Kulisa shows what no other tool keeps, the work around the agent
  (branch, signed-in profiles, running terminals), and what does not go. The animation is the real reading, not a
  show; it never waits for an agent waiting for the human (the timeout, the hooks, Show now).
- **Several agents side by side, not one switched in another's place**: a side task needs no task of its own, and no
  agent is stopped for another to take over.
- **The new agent reads the whole conversation**, lightly cut ([transcripts.md](transcripts.md)), and writes its own
  handoff. The old agent cannot write one: its limit is reached, and `/compact` is a request to its model too.
- Not a conversation moved to another account of the same CLI and resumed there: with a new conversation for every
  agent opened, the one before is read, not continued.
- Not a mechanical summary alone: details that matter are spread through a long conversation, and rules lose them.
- Not a history Kulisa writes as the work goes, nor notes the agent writes through a tool: the agent writes the
  transcript already; a copy adds only code, notes cost tokens and depend on the model remembering them.
- Not converting a transcript into the other CLI's format and resuming it there (txcript, baton, claude-codex-bridge):
  young tools over two undocumented formats that change with each release, failing exactly when a limit is reached;
  and a transcript longer than the other model's window.
- Not a small local model writing the handoff (LLMLingua-2, a model through llama.cpp): tens of minutes on a CPU for a
  long conversation, gigabytes of memory, and it misses what a coding agent would find.
- Not a proxy giving the old CLI another vendor's model (`ANTHROPIC_BASE_URL` to a gateway such as LiteLLM, the one
  truly seamless way): it needs that vendor's API key (a subscription's sign-in is the CLI's own, and Kulisa reads no
  tokens), another's gateway process, and drops signed reasoning.
- Anthropic's Consumer Terms: several accounts are not forbidden; "bypassing any of our systems or protective
  measures" is. Going on with another vendor bypasses nothing; a second subscription of the same vendor to get around
  a limit may count: the human's choice, so Kulisa never offers a switch on its own.

## Making the task's worktree, step by step

Opening a task creates nothing: its terminal starts in the project's main working tree (the human's folder), its tab
reads "New Task", its profiles are listed closed. The worktree is made when the agent calls `task_worktree`
(`Task.makeWorktree`, `Project.ensureWorktree`; idempotent, one per task: copies are made one at a time, so two agents
calling it at once get the one worktree), before it writes code, unless the human wants it to work in the folder. The
agent may pass the task's name to it while it is "New Task": the branch then takes a slug of that name. A task on a
folder without git has no worktree.

1. **Code** (`worktrees.ts`). The branch starts as Claude Code's `--worktree` starts one: from the remote's default
   branch after `git fetch` (`origin/main`), else from `HEAD`; the project folder's uncommitted changes are not
   carried. The branch is a slug of the task's name (`fix-header`), or `task-<task id>` while unnamed, a name free in
   every repository (`-2`, `-3` if taken); the copy next to its repository (with several repositories in the project,
   in `~/KulisaProjects/<project>@<branch>/`, where a repository added later goes beside it; a repository is added only
   once the task has its own worktree): `git worktree add --no-track -b <branch> <copy> <start>`. `--no-track`: pushing
   the task's branch never goes to the default branch.
2. **Files outside git** are copied from the project's folder when git ignores them and they are untracked: `.env*` at
   the top, each agent's local settings (its `localFiles`: Claude Code's `.claude/settings.local.json`), and what the
   project's `.worktreeinclude` names (gitignore syntax, as Claude Code reads it). Dependencies (`node_modules` …) are
   not copied: the agent installs them (the skill says so).
3. **direnv.** When `.envrc` was copied and the project's is allowed, Kulisa runs `direnv allow` for the task's
   folder (same content). Without it the task would miss the project's environment (e.g. `CLAUDE_CONFIG_DIR`: its
   agent would run with another account).
4. **Profiles**: all the project's, closed; each a copy of its master made when first opened, without Chromium's
   caches, its tabs the master's ([profiles.md](profiles.md)). The grid starts with the agent's terminal.
5. **Ports.** Kulisa assigns none. The agent runs the app under test on a free port it picks (the skill and the
   session's context say so) and points the profiles' tabs at it with `browser_navigate`; cookies do not depend on the
   port, so the profiles stay signed in.
6. **The agent.** A new conversation in the task's folder, with the default agent or the one chosen. Every agent asks
   once per folder whether it may work there and keeps the answer in its config. When the human said yes for the
   project's folder or another task's copy, the task's copy is marked trusted too, so the agent asks once a project
   (`extendTrust` in `agents/`; each agent's `trust` reads and writes its own config). Codex and Claude Code, asked in
   a worktree, keep the answer for the repository's root themselves; Kulisa's rule holds it for an agent or a version
   that keeps it per folder. Each agent's trust is its own: a yes given to Codex does not reach Claude Code.
7. The task is shown.

## What is on the computer

In Kulisa's data folder (`~/.config/Kulisa` on Linux, `~/Library/Application Support/Kulisa` on macOS,
`%APPDATA%\Kulisa` on Windows), laid out as Chrome lays out its user data (`store.ts`). Show Data Folder in a project's
menus opens its `projects/<id>` (`shell.openPath`), for the human who asks where it is or what takes the disk;
nothing in it is for editing by hand, so it is no button in sight:

```
projects.json                     the projects, { list: [...] } (as profiles.json and agents.json: a field can sit beside
                                  the list): id, name, folders (the default first), color (the one it has while its favicon gives none), agents (accounts, the default first), profiles (their ids, in order), noDefaultAgent,
                                  github (its repositories' GitHub accounts by remote: src/github; one goes with its account, or its repository);
                                  id: six random lowercase letters and digits (k3f9a2), made with the project and never
                                  changed, so a rename leaves its data folder, its tasks' keys (k3f9a2/1) and their agents'
                                  MCP address as they are; no name in it to go stale, and the log names the project
                                  beside it (window.md, The log). An id of any other shape is read as it is
profiles.json                     the profiles, one store (profiles.md): { list: [{ id, name, avatar, description,
                                  login }] }; id: six random lowercase letters and digits (m2q7xd), made with the
                                  profile and never changed; its name unique within each of its projects
profiles/<id>/                    a profile's master, a Chromium profile, where the human signs in once for every task;
                                  kept in no project too, gone when the human deletes the profile (Settings → Profiles)
agents.json                       the agents' accounts (accounts.ts): { list: [{ id, agent, email }] }
github.json                       the GitHub accounts (src/github): { list: [{ id, login, kind, secret }] }; secret: its
                                  tokens encrypted with the OS keyring, none without one (kept in memory then) or when
                                  signed out; an account goes when the human deletes it (Settings → GitHub)
agents/<agent>-<id>/              an account's config folder (CLAUDE_CONFIG_DIR, CODEX_HOME): its sign-in, settings,
                                  conversations; Kulisa's profiles skill (skills/kulisa-profiles/) and Claude Code's
                                  settings for Kulisa (kulisa-settings.json), written at each start; gone, signed out first, when the human deletes it (Settings →
                                  Agents); one a sign-in left
                                  unfinished (Kulisa quit meanwhile) goes at the next start
dictation/                        the folder the hidden session runs in (src/dictation: another agent's dictation
                                  recognizing for one without), empty; it and what that session kept of it in its
                                  account (its conversation, its trust) go when the session ends, or at the next start
settings.json                     the Kulisa zoom, the theme, where the tasks' bar is, the language; the windows: each one's
                                  tasks by key (in the bar's order), the one shown, where it was
logs/kulisa.log                   what happened and who asked (window.md, The log), for a bug report; at 1 MB it becomes
logs/kulisa.old.log               kulisa.old.log and a new one starts: 2 MB at most
Crashpad/                         Electron's crash dumps (crashReporter, no server; window.md, The log), to ask a user for
                                  after a crash; Crashpad prunes them itself (90 days, 128 MB)
deleted-folders.json              folders to remove at the next start (a session keeps its files open)
projects/<project id>/            a project's data, by its id (projects.json), gone with the project
  tasks.json                      { next, list: [{ n, name, named, resources, closed, closedAt, merged }] }; name "New
                                  Task" and named unset until it is named; resources what it has, the first where it
                                  works: { kind: "maintree", folder } (the project's folder it opened in) until its own
                                  { kind: "worktree", repo, worktree, branch, base, folder } takes its place, then the
                                  worktrees of repositories it added; base: the commit a worktree started from. Its
                                  folder, branch and folder of copies are its resources' (store.ts)
  1/, 2/ …                        a task
    profiles.json                 what it has of its project's profiles, in order: id, sites' zoom, closed
    layout.json                   its grid (dockview)
    agent.json                    { agent, conversations: [{ agent, sessionId, transcript, started, from, to, title,
                                  terminal }] }: the agent it was made with; every conversation an agent had in it
                                  (Several agents in a task), kept with the task
    terminals.json                { front, list: [{ id, name, by } | { id, conversation }] }: its terminals' tabs, opened
                                  again when it loads; one goes when closed; an empty list: the panel folded
    artifacts/                    what the agent's tools keep of its pages (profiles.md, What the agent does): a snapshot
                                  or a body too large for an answer, a screenshot; <n>-<profile id>-<tab id>-<kind>, n in
                                  the order made, never replaced; past 100 MB the oldest go; kept with the task
    <id>/                         its copy of a master, named by the profile's id, made at its first open here: a Chromium profile
                                  (session.fromPath), with Kulisa's own files in it:
      Kulisa Tabs.json              the URLs of its tabs and which is in front
      Kulisa Session Cookies.bin    its session cookies, encrypted with the OS keyring
```

Outside it:

| What | Where | Made when |
|---|---|---|
| The task's copy | `<repo>@<branch>/`, next to the repository (one repository) | its agent making its worktree |
| The task's folder of copies | `~/KulisaProjects/<project>@<branch>/<repo>/` (several repositories, or one added later) | its agent making its worktree; adding a repository |
| The task's branch | each repository (`git branch`) | creating a task; renamed with the task |
| git's worktree record | `<repo>/.git/worktrees/<copy>/` | creating a task |
| A cloned repository | `<location>/<name>/`, or `<location>/<name>/<repo>/` for several (New Project, Clone from URL); `~/KulisaProjects/<project>/<repo>/` or next to the project's folder (Clone on its page) | cloning; stays, as the human's (removing it from the project, or the project, leaves it) |
| direnv's permission for the task's `.envrc` | direnv's data (`~/.local/share/direnv/allow/`) | creating a task, if the project's is allowed |
| The agent's trust of the task's folder | Claude Code: `<CLAUDE_CONFIG_DIR>/.claude.json`, else `~/.claude.json`, `projects["<task folder>"]`; Codex: `<CODEX_HOME>/config.toml`, `[projects."<task folder>"]` | the task's agent starts, if the project's folder or another task's copy is trusted |
| Claude Code's language, Kulisa's one | `<account folder>/settings.json`, `language` (as its `/config` sets it) | ☰ → Language, and an agent's start; goes with the account's folder |
| An agent's conversation | the agent's own data (Claude: `<config dir>/projects/…/<session>.jsonl`; Codex: `<config dir>/sessions/`), in its account's folder (`agents/<agent>-<id>/`) | the agent runs |
| The agent itself, when Kulisa installed it | its maker's place (`~/.local/bin/claude`, `~/.local/bin/codex`, …) | Install in Settings → Agents |
| Kulisa itself, installed (Windows) | `%LocalAppData%\kulisa\`: `app-<version>\` (Squirrel keeps the one before too, removing older ones), `packages\` (the update downloaded), `Update.exe` | the installer; an update; gone when Kulisa is uninstalled (the data folder stays) |
| Kulisa itself, installed (Linux) | `/usr/lib/kulisa/` (the app, `chrome-sandbox` setuid root), `/usr/bin/kulisa` (a link), `/usr/share/applications/kulisa.desktop`, its icon under `/usr/share/icons/`, `/usr/share/doc/kulisa/` (Forge's deb and rpm makers) | the package; gone with `apt remove` or `dnf remove` (the data folder stays: a package may not touch a home folder) |
| Kulisa's apt repository (Linux, `.deb`) | `/etc/apt/sources.list.d/kulisa.sources`, `/etc/apt/keyrings/kulisa.asc` | the `.deb`'s `postinst`, written again at each update; gone with `apt purge`, kept by `apt remove` (as Chrome's) |
| Kulisa itself, installed (macOS) | `/Applications/Kulisa.app` | the `.dmg` or `.zip`; the human drags it to the Trash (the data folder stays) |
| The key the data folder's secrets are encrypted with | the OS keyring: "kulisa Safe Storage" (Chromium's `safeStorage`; Linux's secret service, macOS's Keychain; Windows uses DPAPI, nothing stored) | the first secret saved; never removed by Kulisa: the human's, as Chrome's |
| An update downloaded (macOS) | Squirrel.Mac's cache, `~/Library/Caches/app.kulisa.ShipIt/` (no update downloaded yet: no signed build) | the packaged app's update check; an update replaced by the next |
| macOS's own for the app (packaged) | `~/Library/Preferences/app.kulisa.plist` (the system's defaults for it), `~/Library/Caches/app.kulisa/` and `~/Library/HTTPStorages/app.kulisa/` (the update check's requests), under its id (`appBundleId`, `forge.config.ts`) | the packaged app's first start; macOS's, as every app's: they stay when the app is moved to the Trash |

Nothing is written into the project's own folder.

**Uninstalling removes the program only**: the data folder, the tasks' copies and branches, the agents Kulisa
installed and the keyring key stay, so installing Kulisa again brings everything back, as with Chrome or VS Code. No
installer can ask whether to remove the data too: Debian's policy forbids a package to touch a home folder, macOS has
no uninstaller, and Squirrel.Windows gives the `--squirrel-uninstall` hook 10 seconds. The guide says what stays and how to remove it ("Reinstalling and removing Kulisa").

## Deleting a task: what goes

One function deletes a task (`deleteTask` in `projects.ts`), whether the human deletes it or its project is deleted. A
deleted task leaves nothing on the computer that Kulisa or its agent made for it. Kulisa stops its agents and closes
its profiles, then deletes:

- each copy (`git worktree remove --force`) and its branch (`git branch -D`), and its folder of copies; a branch
  already pushed stays on the remote;
- direnv's permission for its `.envrc`: the records in `<XDG data>/direnv/allow/` naming it (`worktrees.ts`; not
  `direnv deny`, which newer direnv records too);
- its data folder `projects/<project id>/<task id>/`, profiles with their sign-ins (also listed in
  `deleted-folders.json`, removed at the next start if a file was still open);
- what its agents keep of the task's folders (`agents/`, each agent's `forget`, `forgetFolder` in `projects.ts`;
  undocumented layouts, so what is not found is skipped): its own folder's conversations and records, and the other
  copies' records (their trust); a copy removed from a task alone (Remove Repository) loses the same:
  - Claude Code, in the config dir its sessions used: its conversations in `projects/<folder>/` (those recorded in the
    task's folder: Claude names that folder with non-Latin letters as `-`, so other folders can share it),
    `file-history/`, `session-env/`, `debug/`, `todos/` of those sessions, the folder's lines in `history.jsonl`, and
    `projects["<folder>"]` in `.claude.json` (the trust Kulisa gave it). Never the project's folder.
  - Codex, in the `CODEX_HOME` its sessions used: the session files whose folder is the task's (`sessions/`,
    `archived_sessions/`), their lines in `history.jsonl` (by `session_id`) and `[projects."<folder>"]` in
    `config.toml`. Not its own databases (`state_*.sqlite`): their format is Codex's alone, so a record of the thread
    may stay there.

A task without a worktree worked in the project's folder: only its data folder goes; the folder, and what its agent
keeps of it, are the human's, as without Kulisa. An agent Kulisa installed stays (it serves every project).

## Deleting a project

**Delete Project…** in ⋯ on the project's page in Settings, there alone (as everything else about a project). One
function (`deleteProject` in `open-tasks.ts`): Kulisa asks first, saying what goes and which tasks have work not in
main and not pushed; closes its open tasks in every window; deletes each of its tasks as above; then removes it from
`projects.json` with its data folder `projects/<id>/`. The project's own folder stays, and so do its agents'
accounts, let go of (Settings → Agents deletes one: "Choosing the agent", Accounts).

## While Kulisa runs

- **One Kulisa per data folder** (`app.requestSingleInstanceLock`, at the top of `start` in `app.ts`): a second one
  started on the same data shows the first one's window and quits before it reads or writes anything: two would write
  over each other's saved tabs, session cookies and tasks, and the second would have no MCP server (the port taken).
  Kulisa on another data folder (`KULISA_DATA`) runs next to it, as the tests' apps do. A second one started with
  `KULISA_QUIT` asks the first, through the same lock, to quit as SIGINT has it do (saved, asking nothing), and goes
  without writing to the log (`askToQuit`): Windows has no signal for it. A console's Ctrl+C reaches `npm start`'s
  Node there, not Electron (a GUI program, without a console), and a signal sent to a child ends it at once, so
  `scripts/electron.ts` stops Kulisa by such a start.
- Each window shows one of its tasks; the others, of every window, keep running, their pages hidden.
- A task loads (its profiles start, its agents start) the first time it is shown, also after a restart.
- A task is known by its key, `<project id>/<task id>` (the window, the terminals); a task's id is six random letters
  and digits, as a project's and a profile's (`store.ts`, `newId`). Each has its own MCP URL,
  `http://127.0.0.1:4450/task/<project id>/<task id>/mcp`, and hooks under `/task/<project id>/<task id>/hooks/` (each
  part percent-encoded: ids have letters of any language); its agent gets them in its environment (`KULISA_MCP_URL`,
  `KULISA_URL`) and sees only its task's profiles. Profile ids repeat across tasks; inside Kulisa a profile is
  `<project id>/<task id>/<id>` (CDP proxy, highlights).

## Removing everything by hand

Quit Kulisa first (it writes its data on quit). Then, for a project:

```sh
cd ~/IdeaProjects/myshop
git worktree list                         # the tasks: <repo>@<branch>, each with its branch
git worktree remove --force ../myshop@task-k3x9q2
git branch -D checkout-redesign
rm -rf ~/.config/Kulisa/projects/<project id>   # all its tasks with their profiles' copies (the masters stay)
```

## Why it is built this way

- **Every task a copy, the project's folder the human's.** An agent working where the human works would leave its
  unfinished edits in the way of the human's own; the folder changes only when the human asks for a merge. No task is
  special: any one is closed, opened again or deleted the same way.
- **× closes, Delete deletes.** A task is often put aside and taken up again (waiting for a review, a question to the
  client), so × keeps everything and stops only what costs memory (its agents, its tabs).
- **Named by the agent.** A name asked for before the work starts is a guess. The branch follows the name; the folder
  does not, as an agent may be working in it.
- **Code through git only.** The task's folder is next to the project (`myshop@task-k3x9q2`): visible, and it opens in
  an IDE; inside the project, IDEs and tools would see the code twice. Kulisa runs no `git init`: run without asking,
  it could put secrets into history, or a huge folder, or nest a repository.
- **A new conversation for a task**, not a fork of another's (`--fork-session`): an agent remembering another task's
  unfinished edits would be misled. Started in the task's folder, it has no questions about access outside it.
- **A master and a copy per task.** Each task's local app keeps its own sessions (each task runs its own dev server,
  and cookies do not depend on the port: shared, two tasks would sign each other out), while real accounts' cookies
  are kept in step between the master and every copy, so the human signs in once ([profiles.md](profiles.md),
  "Sign-ins kept in step"); a copy of another task's copy would sign that one out with rotating tokens.
  `session.fromPath` keeps the caches inside the profile, so a copy skips them.
- **Storage as Chrome lays it out**, so what is known about Chrome's storage applies. Folders are named by fixed ids:
  a rename touches only the JSON.
- **The agent picks the app's port** (CLAUDE.md, Tools for the agent). Separate hostnames such as
  `checkout.localhost` would lose the sign-ins that a port keeps. The local database is the developer's matter
  (`docker compose` names containers after the folder, so a task gets its own; only published ports clash). An app
  that cannot change its port (hard-coded, OAuth bound to `localhost:3000`) cannot run beside another task's; the
  agent tells the human.
- **Every task asks before it is deleted**, also one without changes (unlike Claude Code's `--worktree`): its
  conversation and profile copies go too.
- **A task loads when first shown**, not at the start: after a restart nothing works in the background anyway, and the
  agent starts at its terminal's real size. Its grid comes from what is saved, without waiting for a program or a site:
  its open profiles are made at once and start behind it, together (`ProjectProfiles.load`, `started`), its terminals'
  tabs come starting, before their agents are found ([window.md](window.md), "A tab comes before its program"), and
  its project's repositories are looked at meanwhile (`Task.gitChecked`). Its agents start after both: they find its
  profiles ready, and are told at their start what the task may add.
- **Tasks in the background keep running**, their pages and agents. Memory: each agent is a process of its own (Claude
  Code about 200–400 MB) plus its profiles' tabs; those its agents stop using lose their process after a while and
  load again when the task is shown ([profiles.md](profiles.md), "Tabs unloaded").
- **Another project's task opens beside the shown one**, nothing stopped: the human closes a task when it is safe.
- **Several windows are one Kulisa**, not a second instance: two cannot share the data folder. A task moves with its
  pages' native views (`Profile.moveTo`), not loaded again, and with what its terminals show (xterm's serialize addon,
  as VS Code keeps terminals), at their size, so its agent is never told a default one. A window is one more renderer
  process, only while it is open.
- **The agent's trust of a task's folder**: the agents' configs are undocumented; a file not as expected is left
  unchanged and the agent asks as usual. Only a yes is carried, never the human's no (Codex's `trust_level =
  "untrusted"`). Claude rewrites its file often; Kulisa writes it whole at once (a rename), and a write of Claude's at
  the same moment may undo it (then Claude asks).

## The code

| File | What |
|---|---|
| `src/main/app.ts` | the app put together, its windows opened at the start |
| `src/main/open-tasks.ts` | open, close and move tasks, load and let go projects (one change at a time, `serial`) |
| `src/main/ipc/tasks.ts`, `projects.ts`, `agents.ts` | the windows' handles on tasks, projects, agents and accounts |
| `src/main/window.ts` | a window: its tabs (tasks), show one, the grid's state, its questions |
| `src/main/projects.ts` | a loaded project: its tasks; making, closing, opening again, deleting one (with the question); making a project (`createProject`), deleting a project's data |
| `src/main/tasks.ts` | a task: its profiles, its terminals and agents (open, hand over, close, environment), naming, its worktree on demand and resources, its artifacts (what they take, deleting them), copies of its profiles for a new task |
| `src/main/worktrees.ts` | git: a task's worktree and branch, files outside git, direnv, changes, renaming the branch, removal |
| `src/main/agents/` | the agents to choose from: find, install, start, resume; a folder's trust carried to a task's copy |
| `src/main/store.ts` | the data folder above |
| `src/terminal/` | the terminals: their ptys, buffers and the xterm shown ([README](../src/terminal/README.md)) |
| `src/renderer/components/TaskBar.tsx`, `components/Empty.tsx`, `components/settings/ProjectPage.tsx` | the tasks' bar (a tab per open task); the grid's place when no task's grid is shown (the window's pages: the sidebar docked, the welcome); a project's page in Settings |
| `src/renderer/components/Sidebar.tsx`, `ProjectIcon.tsx`, `lib/sidebar.ts` | the sidebar: every project with its tasks, docked in the empty window, over the grid (its button, Ctrl+Shift+A); a project's icon |
| `src/renderer/components/Welcome.tsx` | the first start's welcome: the slides (their pictures drawn from Fluent's parts), then New Project's steps under a question each |
| `src/renderer/components/NewProject.tsx`, `lib/new-project.ts` | New Project's steps (the welcome's and the dialog's) and the dialog; their state and rules, one per wizard |
| `src/renderer/components/TaskRename.tsx` | the Rename Task dialog |
| `src/renderer/components/AgentPicker.tsx`, `lib/agents.ts` | choosing an agent when the one to open is not there: the radios of agents with Install; an install's line and its Details |
| `src/renderer/components/settings/AgentPage.tsx`, `agents.ts` | an agent's page in Settings, its details, Install and accounts; Settings' agents, accounts and the install under way |
| `src/main/favicons.ts` | a project's icon: its site's favicon in its code (Projects, "Each project has a color and an icon") |
| `src/shared/names.ts` | the rules for names (projects and profiles; a task's, a label) and slugs |
| `src/main/accounts.ts`, `src/renderer/components/SignIn.tsx` | the agents' accounts, one store; a new one's sign-in in Settings (a project's page, or Agents), and New Project's |
| `src/main/recognizer.ts` | which account recognizes speech for an agent without dictation of its own ([src/dictation](../src/dictation/README.md)), its session's folder |
| `src/renderer/lib/grid.ts`, `components/Grid.tsx` | building a task's grid; the slide (a view transition) |
| `test/e2e/tasks*.spec.ts`, `taskbar.spec.ts`, `projects*.spec.ts`, `project-repositories.spec.ts`, `empty-window.spec.ts`, `agents*.spec.ts`, `masters.spec.ts`; `test/unit/agents.test.ts` | the tests |
