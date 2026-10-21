# Projects and tasks

How projects and their tasks work today: what they are, what the human does, what Kulisa creates on the
computer and removes again, why it is built so, and where the code is. What is still to do:
[ROADMAP.md](ROADMAP.md). Profiles: [profiles.md](profiles.md); the window: [window.md](window.md). Keep this file
current when they change.

## Projects

A **project** is one configuration its tasks are made from: a name, its agents (one the
default), its profiles (each a person in one store, [profiles.md](profiles.md)), and its code: one or more repositories
(one the default), or a folder without git (`~/KulisaProjects/<project>` by default, or one the human picks). The work is done in its tasks (below), each in copies of the
repositories (git worktrees), so the project's folders stay the human's. Kulisa keeps its data in its own data folder
(`projects/<id>/`), never in the project's folder, so sign-ins stay out of its git.

- **A project is no thing to open; its tasks are** (a project is what its tasks are made of:
  profiles, agents, repositories). An open task is a **tab** of a window, of its own, as a browser's ("group" in earlier commits: CLAUDE.md, Terminology). There is no Open
  Project or Close Project, and no question where to open one: a task opens in the window it is asked for, at the end
  of its bar. In code a project is **loaded** (`Project` in `shell.open`) while a task of it is open in any window:
  its git, its agents' accounts; let go when its last open task closes (`unloadIdle` in `app.ts`).
- **The tasks' bar**: a tab per open task, in the bar's order, tasks of any projects side by side: its project's
  icon (its site's favicon, or the app's curtain in the project's color, as a browser's tab shows its site's), its
  agent's state (below), its name, ×; the project's name in its tooltip. A click on any shows it; the
  others keep running, their agents and pages. Where the bar is and how its tabs look: [window.md](window.md), The
  tasks' bar.
  - **Nothing in it moves** when another task is shown: every tab keeps its width (the room of its ×).
    A tab that moves under the mouse makes the human miss.
  - **The middle button on a tab closes the task**, as a browser's tab.
  - **A tab's right-click menu**: the shown one's profiles, open (shown in the grid) and closed (opened in the
    task), and Manage Profiles… (Settings → Profiles); Add Repository, the project's repositories it has no copy of
    (Tasks, below); Rename…; Show Folder, its folder (its worktree, or the project's without git) in the OS's file
    manager (`shell.openPath`); **Move to New Window**, **Move to Window: …** (one row per other window, named by the
    task it shows and how many more it holds: "task-3 (+2)"); Close; Delete Task…; then **the project's submenu**,
    a row of its icon and name opening at its side (`{ submenu }`, [ui.md](ui.md), Menus; the project has no tab of
    its own to open a menu on): New Task, **Move All Tasks to New Window / to Window: …** (its open tasks of this
    window, together), Project Settings… (what a task has not: the project's code, agents, profiles, local
    addresses), Show Data Folder, Delete Merged Tasks… (when a closed task's PR is merged: Tasks, below), **Close
    All Tasks** (its open tasks in every window, asked once when an agent works). The project's name is the
    projects' manager's alone to change.
  - **A task's tab shows nothing of its profiles** (the bar is no place to edit profiles,
    Settings is for that; profiles are the agent's hands: how many are open says nothing).
  - **The button after the tabs is +, a new tab**, as a browser's (Ctrl+Shift+A, again or Esc goes back; `NewTask.vue`): a tab "New Tab" at the end of the bar, chosen, and in the grid's place **the board**
    (`newtab/`): every project a column (all in sight, any task one click away), the one
    worked in last first (an open task, else the one closed last). A column: its project's icon in its color, its
    name, its **+** (a new task of it with its default agent: "Choosing the agent"); then its tasks, those open first,
    marked "open" and not to choose (in this window's bar or another's), then those closed, the one closed last first,
    each with its branch (when its name is another), when it was closed, "merged"; a click opens one again; its 🗑 (on
    the row under the pointer or the keyboard) or Delete deletes it after Delete Task…'s question. A project without
    tasks says so. New Project… after the columns. More tasks than a column holds scroll in it, more columns than the
    window holds scroll sideways. The task chosen or made is shown in the new tab's place, a tab at the end of the
    bar; the new tab closed (×, + again, Esc, a click on another tab) shows the task under it again, which ran on
    meanwhile, its pages hidden (a native view would draw over the board). The grid stays laid out under it, unseen:
    its terminals keep their size. A new tab is the window's alone: the main process does not know it, it is not
    saved, and it moves to no other window.
  - **The window's pages** (`page` in `lib/store.ts`): what the window shows in the grid's place, one at a time: the
    shown task's grid (`task`), a new tab over it (`newtab`), the board with no task open (`board`), the welcome
    with no project at all (`welcome`). One switch, not a router: what is shown is the main process's (its current
    task), and the grid under a new tab must stay as it is.
- **Settings** (the button in the title bar, left of ☰), as JetBrains' Settings (a dialog reads as a web page's, not a desktop app's; docs/ui.md, Desktop, not a web page), a window of
  its own, not modal (how it opens and closes, and which window it acts for: [window.md](window.md), Settings): a tree
  on the
  left of three sections, each with its own under it: **Projects** (every project, its icon in its color, its name),
  **Agents** (each agent: "Choosing the agent") and **Profiles** (every profile, its picture: [profiles.md](profiles.md));
  on the right the chosen one's page under its path ("Projects › shop", "Profiles › ann") with **⋯** at its end. All
  three alike (the author's choice): a section only opens and closes, its **+** beside it makes one of its own
  (Profiles: New Profile…, its name typed in place under the tree, Enter makes it and shows its
  page, Esc puts it away; Agents: a menu of the agents an account can be made of, New Account… on the agent's page,
  as agents are installed, not made; Projects has none: Settings only sets things, a project is made in a tasks'
  window, New Project…); a row's right-click has what its page's ⋯ has (a project's and a profile's
  Delete…, asked first, as Delete on the chosen row; an agent's Install and New Account…), a section's what its +
  does. Project Settings… in a project's submenu (a task tab's menu) opens it at that project;
  a task tab's Manage Profiles… and About this profile… at a profile. **A project's page** (the projects' manager, in
  the code's words): at its top its path and **⋯** (Delete Project…; tasks are made in the bar); then **Name:**, and a group each under a titled line (`.titled`): **Code**, **Agents**,
  **Profiles** (what its tasks are made of), each a list (`.list`) with a toolbar over it: **+** adds (a menu), **−**
  removes the selected row (and Delete), **★** makes it the default (Code, Agents); a row's right-click has the same.
  Its Profiles are only which profiles its tasks have: + makes one in it or adds one of the others, − lets go of one
  (the profile stays); who a profile is, is Settings → Profiles'.
  What needs typing (a URL to clone, a new profile's name) opens a field in place, under the list (Esc puts it away).
  Then **Local addresses:**. Explanations are in the empty lines and the tooltips (a paragraph
  per section reads as documentation, not settings).
  **Everything is saved as it changes** (one rule, so nothing asks what a Save would cover);
  the name on Enter or leaving its field, also when the manager closes or another project is chosen with one typed.
- **New Project**, in three steps (a newcomer goes through everything a project needs in one
  place, each step saying what comes next): **Code**, **Agents**,
  **Profiles**, then Create, which makes the project with them and opens its first task. Next checks a step as Create
  would, nothing made before Create (but an agent's account signed in to on the way: accounts live on their own); Back
  keeps what was typed. It is the welcome's with no project at all, in the grid's place (below), and else a dialog
  (New Project… after the board's columns), the same steps (`newproject/`). The first step, as
  JetBrains' New Project: on the left what its code comes from, on the right the form (**Name:**, **Location:**). **Its code first** (code already on the disk or at a URL is the project's own, with no empty folder made beside it):
  - **New folder**: a name and a location, `~/KulisaProjects` (every new project's place, as JetBrains' `~/PycharmProjects`; a name not to be taken for Kulisa's data folder)
    unless they type or browse to another; the step shows the folder it makes (`<location>/<name>`), so the human
    knows where the agent's files are. A folder there already is taken as it is, its files kept.
  - **Folders on disk**: one folder or several (a frontend and a backend: typed and Add, or + over the list, which
    browses; each a row with "git" or "no git", − leaves the selected one out), taken as they are, nothing made: their files and, for repositories, their history kept.
    The first is the default repository and the project's folder. Create Git repository runs in those
    without git. A folder that is not there, or a project's, is refused as it is added.
  - **Clone from URL**: one URL or several, cloned with the user's own git (as Clone on a project's page). One is cloned
    into `<location>/<name>`, and that clone is the project's folder; several into `<location>/<name>/<repo>` each, the
    project's folder the one that holds them (no former folder), the first the default.
    Clone on its page puts the next one there too. Refused: a folder there with files. Create says Cloning…
    meanwhile; a URL git cannot clone leaves nothing, the clones before it neither.
  - In the welcome, one folder or one URL, in a field (and Browse…) rather than a list, a line under it saying the other
    is added later in Settings (a first project made simply; several are the dialog's). Its
    name is asked only for a new folder (Project name:); code from the disk or a URL has one, the folder's or the
    repository's, said in the line under it ("The project shop takes … as it is"), its field shown only when it will
    not do (empty, a folder there already, a name Create refuses), to correct it; renamed later in Settings.

  The name is the first folder's or repository's until the human types one. A folder or URL typed and not yet added
  counts when Next is pressed. The step says what will happen as it is typed ("… is there already", "… is a git repository", "The repository
  will be cloned into …"; refused: a file, or a folder a project has). Its color and icon are not asked
  (below). Create Git repository is on by default, not shown for repositories or clones: `git init` and an empty
  first commit ("Initial commit"; nothing of the folder is in it), as a worktree needs one, so the first task already
  has a copy of its own. Without git's user name and email set there is no commit, and tasks work in the folder. More
  repositories are added on its page (Code).
  - **Agents**: the accounts there are first, ticked (one or several), one of them the default (★; the first ticked
    unless another is starred): a new task starts it, the others open beside it ("Choosing the agent"). The terminal
    is no choice: every project has it, and a project with none ticked starts its tasks with it. Under them **Add account**, one button per agent an account can be made of (Claude Code, Codex):
    its sign-in, as New Account…, and the account ticked. An agent not on the computer is installed first, by itself,
    with its maker's installer, the sign-in after it (seamless); a line says it installs, and
    Details shows the installer at work (`InstallProgress.vue`, as Settings → Agents).
  - **Profiles**: new ones, a name and who it is each (the agent chooses by it), and any of the human's other
    profiles, ticked; none: the agent makes those it needs. No signing in there: real accounts are signed in when the
    agent asks, or with Sign In… in Settings → Profiles.
  - **Create**: one call (`project:new`), the core making it all (`createProject` in `projects.ts`: its code, its
    agents in order, the default first, its profiles); what could not be added of the agents and profiles is logged,
    the project being made. Then its first task opens in this window (`project:open`), its default agent in it,
    nothing asked (a question where to open it, right after Create, comes unasked).
- **Showing another task** slides the grid towards its tab, as macOS desktops do (a view transition on the compositor, the
  pages as pictures meanwhile; not with reduced motion); the window builds the other grid in place, so nothing jumps.
  Out past the window's edge, with Material's standard easing, so no strip of its page lingers at the edge; every tab
  slides alike. When a task closes, the one next to it is shown, or the empty window when it was the last.
- **Move to New Window** (its tab's menu) puts the task into a window of its own, next to this one, e.g.
  to drag it to a second monitor; **Move to Window: …** (one row per other window) puts it
  into that window, as a browser moves a tab. It keeps running: its agents, its pages (the same ones, moved, not
  loaded again), what its terminals showed. The only tab of a window does not go to a new window; moved into another
  one, its window closes. **Move All Tasks to …** in the project's submenu moves its open tasks of this window the
  same way, one after another. **Dragging a tab** does the same with the mouse: within the bar it changes the order
  (kept); let go on another window's bar, the task moves there, where it was let go; let go outside every Kulisa
  window, it opens in a new window there (the window appears when the mouse is let go, as in VS Code). Each window has
  its bar and its + (the board; a task opens in the window whose + was pressed). The OS's × on a window closes
  its tasks, as × on each would, after one question ("Close the window?", naming them); on the last
  window it quits Kulisa, and the windows with their tasks come again at the next start, where they were: nothing
  is lost, so it asks only when that would stop a working agent ("Quit Kulisa?"). On macOS the last window's × hides
  it, as Mac apps' windows (simpler than closing the window with its agents going on, which can
  come later): its agents, terminals and pages go on, the Dock's icon shows it again as it was; ⌘Q (Kulisa → Quit
  Kulisa) quits, asking as above, the hidden window shown for the question. A window whose last tab is
  closed closes too, unless it is the only one: then it is the empty window.
- **Each project has a color and an icon**, to tell projects apart at a glance: the color is the shown one's glow from
  the middle of the window (seen in the title bar and the gaps between the islands; only while a task is shown, a new
  tab over it too: it fades in with the first task, out with the last, and from one project's color to the next as
  another task is shown; a blot, never a circle: three soft spots, each its own size, drifting and stretching at its own pace, still with reduced
  motion: the author's choice; `App.vue`, its transform alone animated, five times a second: about 2 % of a core while a task is shown, 11 % at the screen's rate) and the title bar
  logo's curtain; the icon is on its tasks' tabs in the bar, in its color. **Both
  are Kulisa's, nothing to choose** (a project is made to work in, not to be set up; a color
  taken from its favicon goes with it):
  - **The icon: its site's favicon**, the curtain while it has none: `favicon.*` (svg, png, ico, webp, gif,
    jpg) anywhere in its code, `icon.*` only in an `app/` folder (Next's; elsewhere `icon.svg` is any component's).
    The files are those git lists in each of its repositories, the default first (new ones too, not those it ignores:
    no library's favicon from `node_modules`, no build's); a folder without git is read a few levels down, without
    hidden folders, `node_modules`, `dist`, `build`, `vendor`. Of several, the nearest to the top, then svg, png, ico,
    then a favicon before an icon, then by name (a monorepo's `apps/admin` before `apps/shop`). Looked for without
    holding the window up, once; again as its settings open, so a favicon added or changed meanwhile shows there and
    in the bar. A picture up to 128 KB is shown as it is; a larger PNG or JPEG made 64 px wide (Electron's
    `nativeImage` reads only those two on every OS); another larger one is not shown (the curtain).
  - **The color: its favicon's hue** (`renderer/lib/project-color.ts`), read in the window, where Chromium draws any
    favicon (svg, ico, png …) on a 32 px canvas, by colorthief (MIT, the most used and maintained of its kind; its
    palette with each color's share, its filters of transparent, white and gray pixels): the hue of the largest
    colored part, near-black left out too (HSV calls a dark red saturated). Only the hue is the site's: its lightness
    and chroma are those of Kulisa's eight colors (OKLCH 0.61, 0.12), so it suits both themes as they do (a site's
    own navy is lost in the dark one, its yellow glares in the light one). A favicon with too little color (under a
    tenth: a black or gray mark, an SVG in `currentColor`) has no hue, nor has a project without a favicon: then the
    color `projects.json` keeps, the next free one of Kulisa's eight given when it was made. Two sites of one hue are
    one color: their icons and names tell them apart. Nothing of it is stored: worked out again as the window gets
    the favicon, so a favicon changed changes it.
- **Its configuration** (a project's page in Settings, `ProjectEditor.vue`) changes its name (on Enter or leaving it)
  and local addresses as they change; the folder is shown (in
  Code), not changed.
- **Its agents**: a list of its agents' accounts and the terminal only ("Choosing the agent", Accounts). Its
  **+** adds the terminal only or any account (made in another project or in Settings → Agents), or, under New Account,
  makes one of an agent, signed in right there; − lets go of the selected one at once (the account stays: Settings →
  Agents deletes it); the first is the default, marked "default" (**★**, or Make Default in a row's right-click, on another): a
  new task runs it; others in a task: the island's + ("Several agents in a task"). **★** on the default one (No Default
  in its right-click) leaves none the default (`noDefaultAgent` in `projects.json`): its new
  tasks start with nothing, the island's big buttons in the empty grid instead ([window.md](window.md), The terminal).
  None: its tasks start with the terminal only; closed, the Terminal button alone.
- **Its code**: the repositories or folders its tasks work on, the default one first (marked when there are several,
  **★** or Make Default in a row's right-click on another: new tasks get a copy of it, their agents start there; the others
  a task adds when it needs them: Tasks, below). Its **+**: **Add
  Folder…** adds one from the computer, **Clone from URL…** one from a URL with the user's own git (its credentials and keys; git asks for no password, so a
  private repository it cannot reach fails with git's own words; cloned into the project's own folder when that has no
  git, `~/KulisaProjects/<project>/<repo>`, else next to it, never inside a repository). A repository added is copied into no task: each adds it when it needs it. **−**
  (or Delete, or the right-click) removes the selected one from the project (its folder stays), only when no task has a copy of it or works in it: the refusal
  names those tasks (deleting a copy would delete their work). A project whose own folder has no git keeps it until a
  repository is added; then it is its **former folder**: new tasks work in copies of the repository, those that worked in it go on there,
  and the settings say so, with Show, while it exists (the human moves its files, or asks an agent).
- **The empty window** (the term: CLAUDE.md) is what a window is with no task open: at the first start, and after
  the last task is closed (×, Close All Tasks, deleting the project). The title bar, no tasks' bar (no tab, and its +
  would show the board the window shows already), and in the grid's place (`Empty.vue`) the
  board, as a new tab shows it
  (above); with no project at all, the **welcome** instead (`welcome/`), the first thing a new user meets: what Kulisa does in three slides (its agent in your browsers; checking as every user; Pick), with Skip,
  then New Project's steps, a question each ("Where is the code?"), as a dialog without its backdrop, Kulisa's red glow
  behind them until the first task's project's color takes its place. Back on the first step goes back to the slides.
  In a low window the slides' picture is smaller, and in one both narrow and low it is left out: the welcome fits the window's least size (640 × 400) without scrolling. New Project's own steps, not a second wizard: the dialog's, under another head (docs/ui.md, Clusters).
  The steps are made each time they are shown, anew,
  and are not there otherwise (their fields' ids are the dialog's too). At the first start the keyboard is on Next
  (`shell.firstStart`).
  The links and Kulisa's version are ☰'s. Later starts
  open the windows that were open, each with its tasks' tabs in their order, showing the one shown last (`windows` in
  `settings.json`, the tasks by key); an open task no window names (a crash) goes into the first window's bar, so
  none is lost. `KULISA_PROJECT=<folder> npm start` shows a task of that
  project in the first window: its first open one, else the one closed last, else a new one.
- **An agent** of a task starts in the user's own shell, in the task's folder, as if the human typed
  it in a terminal there: the project's environment applies (direnv's `.envrc`, nvm, mise), not the one Kulisa was
  started with. When it exits, the shell stays. Its account's variable (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`) is typed
  before the command (`CLAUDE_CONFIG_DIR=… claude …`), so the task's account wins over a project's `.envrc` that sets
  it too (else the task runs as another Claude account, silently).
  Each argument is quoted as that shell reads it ([src/terminal](../src/terminal/README.md)).
  direnv's state in Kulisa's own environment (started from a terminal in a folder direnv had loaded) is dropped at
  start (`DIRENV_*`, `app.ts`): a task's shell takes it for that folder left and undoes its `.envrc`, an account's
  `CLAUDE_CONFIG_DIR` with it.
  On Windows it starts directly, without a shell (ROADMAP, Open issues).

## Tasks

A **task** (the term: CLAUDE.md) is one line of work in a project: its own copy of the
code on a branch, browser profiles, a grid of panels and an agent in a terminal. Several tasks let several agents
build several features of one project at once.

- **Always a copy.** With git (and a first commit), every task is a git worktree of the project's default repository
  on a branch of its own, the first task too: next to its repository when the project has one (`myshop@task-2`), else
  in one folder of the task's (`~/KulisaProjects/<project>@task-<n>/<repo>/`, one place to see and delete), where the others'
  copies go too. Its agent starts there.
- **Another repository when the work needs it** (a task on the backend may turn out to need
  the frontend, and a copy no task needs is made for nothing; the ones a task has are named at the end of its
  terminals' row: [window.md](window.md), The terminal). The project's other repositories
  in git are added to a task one at a time: by the human, Add Repository in its tab's right-click menu; by the agent,
  `task_add_repository`, once the human has agreed in the conversation (the profiles skill and the MCP server's
  instructions say so; no question of Kulisa's: the author's choice, the agent asks). A copy on the task's branch in
  its folder of copies (`Task.addRepository`, `Project.addCopy`), given to its running agents by Kulisa, typed and
  sent as the human would (`giveDirs`, `sendToPrompt`; a `/add-dir` for the human to type is
  a step easily missed), never while the agent waits for the human: Enter there answers Claude Code's permission
  question with Yes, and the pasted line is lost. Claude Code gets `/add-dir <folder>` at once, in its turn
  too: it runs then, its question (Add directory to workspace) over the turn, which goes on, answered with its first
  choice, for this session. Others get a line saying so once their turn is over (Codex has no way to add a
  folder in a session: its changes there ask for approval until its next start). A draft the human is typing in
  that terminal then gets the line too: Kulisa cannot see the prompt. At their next start they get it with the
  others: Claude Code and Codex as `--add-dir` (Claude Code reading their `CLAUDE.md` too:
  `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD`), every agent in the MCP server's instructions and at its session's
  start (`agents/`, `dirs`). The repositories it has no copy of are named there too, to read in the project's folders
  without asking, changing nothing. One added and not needed (added by mistake, or not needed after all) is taken out again: by the human, Remove Repository in its tab's menu or on its chip; by the
  agent, `task_remove_repository`, once the human agreed (`Task.removeRepository`, `Project.removeCopy`). Its folder
  and branch go as a deleted task's do, and what the agents keep of its folder (below, "Deleting a task"); asked first
  only when it holds commits not pushed or uncommitted files, named in the question (`askRemoveCopy`). Its running
  agents get a line saying so once their turn is over (none has a command to drop a folder: Claude Code keeps it in
  its session's list until its next start, harmless), unless they were not told of it yet. The task's own folder,
  where its agents work, goes only with the task.
  The project's folders without git are given to the agent as they are (nothing to copy). With one repository: the project's folder stays the human's, and no agent works in it on its own. Its work
  goes back through git: the human asks the agent to merge into main (the agent first checks the project's folder for
  the human's uncommitted changes, and stops if there are any: the profiles skill and the MCP server's
  instructions), or to open a pull request.
- **Without git** (or before a first commit) a task works right in the project's folder: there is nothing to copy it
  with. A second open task there is made only after a question ("two agents may get in each other's way").
- **Its name** is `task-<n>` until its agent names it (`task_rename`) or the human does (Rename… in its tab's menu, or a double click on its tab):
  the tab and the branch take the name (`git branch -m`, `-2` when the branch is taken); the folder stays
  `<repo>@task-<n>`, not moved under a running agent. Until it is named, its agent is told to name it once the human's
  request says what it is about, before anything else and silently (never asking the human or mentioning it: Kulisa
  is to be invisible in the agent's answers), at every prompt the human sends (the `prompt`
  hook's answer) and in every Kulisa tool's result (for an agent whose hooks do not run: Codex's not trusted yet):
  told only at the session's start, before the agent knows what the task is about, it forgets; and asking the human
  would stop them for a name. `task_rename` and
  `conversation_rename` load with Claude Code's session (`_meta` `anthropic/alwaysLoad`; other agents ignore it): behind
  its tool search, as every MCP tool is, the agent skips the extra step and does not name the task when its answer
  is text only. Until it is named the human's first
  prompt in it (its first line, from the same hook) is over its tab and its row among the closed tasks (their
  tooltips), what it is about when its agent did not name it; a name puts it away.

Example: the project `~/IdeaProjects/myshop`, its second task, named "Checkout-redesign" by its agent:

```
~/IdeaProjects/myshop/          the project's own folder: the human's
~/IdeaProjects/myshop@task-2/   the task: a worktree on the branch checkout-redesign
```

## What the human does

- **Its tab** in the tasks' bar: its project's icon, the agent's state as an icon
  (working, waiting for you, done; from its hooks: "Choosing the agent"), its name. A click shows that task (the slide: Projects,
  above). The one left keeps running.
- **The bar's +** (a project's + in its column; Ctrl+Shift+N, or New Task in the project's submenu, for the shown task's or
  that project) makes a task at once, no dialog,
  from the project's configuration alone, nothing taken from the task on screen: the human describes the task to its
  agent in the terminal. It runs the project's default agent; with none, the terminal only, nothing asked ("Choosing the agent"). **No profile opens by itself**, the first task's
  neither ([profiles.md](profiles.md), What a profile is): each is a browser's processes and
  memory, whether the task needs it or not.
- **×** on a task's tab closes it: its agent stops, its tabs close; its code, branch, profiles and conversation stay,
  and the bar's + lists it in its project's column. Opening it there shows it again and resumes its agent's
  conversation. It asks only when the agent is working (closing would stop it); nothing else is lost. The last open
  task of a project closed lets the project go (nothing of it runs), nothing asked.
- **Delete Task…** in its tab's menu deletes it, after a question saying what goes for good: its folder, its branch,
  its profiles, its agent's conversations, and any work not in main and not pushed (commits of its own, uncommitted
  files). With git a task goes whole (worktree, branch, conversation); without, its files stay in the project's folder.
  A closed task is deleted from its row in the bar's + (the board): its 🗑 (on the row under the pointer) or Delete, the same
  question, its project loaded or not (closed tasks are not to pile up). Closed tasks stay on disk until the human deletes them; Kulisa
  offers it once a closed task's PR is merged: each of its copies has commits of its own, all in its remote's default
  branch (`origin/HEAD`, fetched as the project is shown and as a task is closed, in the background), and nothing
  uncommitted, so deleting it loses nothing. Its row in the board says "merged", and the project's submenu has **Delete
  Merged Tasks…**, one question naming them. A squash merge makes new commits, so it is not seen: Delete Task… as for any other.
- **The island's +** opens another of the project's agents in the task, a new conversation in a tab of its own, or a
  shell; **the agent's icon on its tab** hands the task to an agent of the project, which goes on with that
  conversation ("Several agents in a task").

## Actions: the human's and the agent's

As for profiles ([profiles.md](profiles.md), "Actions"), each action is written once, in the core, with its question
to the human; the window's IPC (`ipc/`) and the MCP tools are handles on it:

| Action | The human | The agent | The core |
|---|---|---|---|
| Open a task (its project loaded with it, when it was not) | the bar's + (the board: a closed one, or a new one) | none: it works inside one task | `openProject` (`open-tasks.ts`): the task opened again and shown, or a new one (`createTask`) |
| Close a project's tasks | Close All Tasks in its submenu | none: it would stop itself | `closeTasks` (`open-tasks.ts`) in every window, asking once when an agent works |
| Close a window, quit | the OS's ×, ☰ → Exit | none | `closeTasks` for the window's tabs; `quit` (`open-tasks.ts`), asking only when an agent works |
| Move a task | Move to New Window, Move to Window, dragging its tab; Move All Tasks to … for a project's | none: where the human sees it is the human's | `moveTask`, `moveAll` (`open-tasks.ts`) |
| Make a project, with its agents and profiles | New Project (the empty window with no project; New Project… on the board) | none: what a project is made of is the human's | `createProject` (`projects.ts`); its first task: `openProject` |
| Delete a project | Delete Project… in the projects' manager | none: it deletes sign-ins, the human's to decide | `deleteProject` (`open-tasks.ts`), `askDeleteProject`, `deleteProjectData` (`projects.ts`) |
| Make a task | the bar's +, Ctrl+Shift+N, New Task in its project's submenu | not yet (ROADMAP, "Tasks, rest") | `Project.createTask` |
| Close a task, open it again | ×, the middle button on its tab, Close in its menu; the bar's + | none: what runs is the human's to stop | `closeTask` (`open-tasks.ts`), `Project.closeTask`, `reopen` |
| Rename a task | Rename… in its tab's menu, or a double click on its tab | `task_rename` | `Task.rename` |
| Read what was said and done in the task before | its terminal, scrolled back | `task_history` ([transcripts.md](transcripts.md)) | `historyPart` (`history.ts`) |
| Delete a task | Delete Task… in its tab's menu; a closed one's 🗑 in the bar's + | none: it deletes work and sign-ins, the human's to decide | `askDeleteTask`, `deleteTask`, `deleteClosedTask` (`projects.ts`) |
| Show a task | a click on its tab, of any project | none: what the human looks at is theirs | `AppWindow.show` (`window.ts`) |
| Add, clone, make the default, remove a repository | the projects' manager | none: what the project is made of is the human's | `addRepo`, `cloneRepo`, `defaultRepo`, `removeRepo` (`projects.ts`) |
| Add a project's repository to a task | Add Repository in its tab's menu | `task_add_repository`, once the human agreed in the conversation | `Task.addRepository`, `Project.addCopy` |
| Remove one added | Remove Repository in its tab's menu, or on its chip | `task_remove_repository`, once the human agreed | `Task.removeRepository`, `Project.askRemoveCopy`, `removeCopy` |
| Add, make the default (or none the default), remove an agent of the project | the projects' manager | none: what the project is made of is the human's | `addAgent`, `defaultAgent`, `removeAgent` (`projects.ts`) |
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
Kulisa never assumes one is installed. A new task opens its
project's default agent (the projects' manager), its own (`agent` in its `agent.json`); a project with no default
(`agent: null` there) starts nothing, without asking: the island's buttons in the empty grid, and Ctrl+` gives them
the keyboard (`Task.ownAgent`, `openOwn`); a project with no agents starts its tasks with the terminal only. An agent to open that is not there (an account let go, an
agent not on the computer) asks, in a dialog, among the project's accounts and the terminal only, with Install and
Cancel (none opens). `KULISA_AGENT` forces one command everywhere, without asking. An agent CLI itself is installed in Settings → Agents (**Install**: Kulisa runs its maker's own
installer, the command shown before, its output while it runs (streamed as it comes; once it is over, the answer
brings the whole of it, since Electron keeps no order between the stream's channel and the answer's: the last line
may come after "Installed"), with no steps for the human to type, for people who
are not programmers); its accounts are made there too, or in a project's page.

- The installers are the makers' official native ones (no Node, no sudo, they update themselves): Claude Code `curl -fsSL https://claude.ai/install.sh | bash`, Codex
  `curl -fsSL https://chatgpt.com/codex/install.sh | sh` (`install.ps1` on Windows).
- Each agent is one entry in `agents/`: how to find, install, start (Claude Code with the Kulisa plugin; Codex
  with the MCP server and its hooks as config overrides, `-c mcp_servers.kulisa.url=…`, `-c hooks=…`), resume
  (`claude --resume` and `codex resume` with the session the `SessionStart` hook reported; else `codex resume
  --last`) and forget a deleted task's folder.
- **Dictation**, where the agent has its own (its entry's `voice`: its key and how often it is typed; Claude
  Code's voice mode, which needs a Claude.ai account; Codex has none, only a realtime voice conversation): a
  key held anywhere in the window (the right Ctrl), and a microphone at the end of the terminals' row, for the agent in
  front ([window.md](window.md), The terminal). The human needs to know neither the agent's command nor its key:
  Kulisa turns it on for its own sessions (Claude Code: `--settings` with `voice: { enabled, mode: "hold",
  autoSubmit: false }`, not the user's settings) and the button holds its key: space typed
  again and again at a keyboard's repeat rate, as a terminal shows a held key (it tells no release), and Claude Code
  records while they come, putting the text where the cursor is, after any text there. Not its `tap` mode (a tap
  starts, another stops): it records only with the input empty, so no second sentence can be added.
- **Language**, where the agent has a setting of its own (its entry's `language`: the codes it takes, and how one is
  written into an account's folder): Kulisa's one language (☰ → Language, [window.md](window.md), Language) goes
  into every account of it. Claude Code's is its `language` setting, which it dictates and answers in (it has none for
  dictation alone), written where its `/config` puts it (`<config dir>/settings.json`, the language's English name),
  the rest of the file kept, not written when it says so already, never into a file that is not JSON. Claude Code
  reads that file again when it changes and the language at each recording, so it holds at once in every session of
  the account. A settings file of one launch (`--settings`) would not do: it is read once.
- **Settings → Agents** (`AgentPage.vue`), as JetBrains' list of SDKs: the agents in
  Settings' tree (not the terminal only: nothing of it to set up there; "not installed" at a row's end),
  the chosen one's page on the right: its maker and website, what it needs, its status (its version, its `--version`, and its
  folder, marked when it is not on the user's `PATH`: Kulisa runs it from there; Install for the others, with the
  command it runs), and its **Accounts** (below), a list with + (New Account…) and − (delete the selected one, asked
  first; also Delete and the right-click). Installing there starts nothing; the agent is chosen
  for a task when one is made, or with the island's +. Kulisa does not remove or update agents: they are the
  user's programs, and the makers' installers update them themselves.
- **The list comes at once**, here and in choosing a task's agent: finding the agents runs
  the user's login shell (`command -v`: Kulisa started from a menu has a shorter `PATH`) and each one's `--version`,
  tenths of a second or more with a heavy `.bashrc`. So the window first shows what the last look in that folder found,
  kept in the main process's memory (`agents:list`, `cached`; nothing on disk: it is the computer's state, which
  changes without Kulisa), and looks again behind it, its rows changed where it differs (an agent installed, updated or
  removed meanwhile). Only the first time after Kulisa starts does it wait for the look.
- **Accounts** (`accounts.ts`): an agent with a sign-in of its own, so one human
  runs a work and a personal Claude side by side. Each is the agent with its own config folder, given to it by its
  variable (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`: `config` in its entry (`agents/`)); the agents without one (the terminal
  only) have no accounts and are chosen as themselves. The human's own folder (`~/.claude`, `~/.codex`) is no account:
  every account is made in Kulisa and starts as a clean agent (no global `CLAUDE.md`, settings, plugins, skills or MCP
  servers of the human's: set up again in each), the author's choice over copying them.
  - **Made in Settings → Agents** (+ over its agent's accounts, or the + beside Agents in the tree: in no project yet) **or in a project** (its page,
    Agents' + → New Account, an agent: in that project): the agent's own sign-in starts at once, as
    its `/login` does (Claude Code `auth login`, Codex `login`), in a terminal there (`AccountSignIn.vue`),
    and ends once signed in. The terminal is under Details, closed (the address it prints, with
    the browser open, only confuses); it opens by itself when the sign-in fails, and is there for what the browser does
    not show (the address, when no browser opened; a code the agent asks for). Its folder in Kulisa's data has a fixed id (`agents/claude-<n>/`, never a number used
    before: a removed one's folder may wait for the next start), never renamed: Claude Code names its macOS Keychain
    entry after a hash of the config folder's path, so a folder renamed after the sign-in would
    lose it. The email it signed in to is read after it (`auth status`) and kept in `agents.json`: the account is
    shown as "Claude Code · ann@shop.com"; Codex's status does not say it ("Logged in using ChatGPT"), so it is shown by its id.
    An email the store has already is that account: the new folder is signed out and removed, the existing one added
    to the project (made in Settings → Agents: said so). Cancel, Settings closed, or a sign-in ended without an account
    keeps nothing.
    **The page opens in the user's own browser**, as the agent opens it without Kulisa (Kulisa sets no `BROWSER`); the
    agent's own server on `localhost` takes the answer, so the sign-in ends by itself. The page names the account it
    signs in to: a browser signed in to another account of the same maker may offer that one, and the human chooses
    there. The system's browser: as desktop apps sign in (RFC 8252), and less code.
  - **One store** (`agents.json`), as the profiles': the projects list the accounts they have (`projects.json`'s
    `agents`); the Agents' **+** of another project takes it there too. The island's + and choosing an agent that is not there (Choose the Agent) list the project's accounts
    and the agents themselves, never another project's: the project's page says who works in its tasks.
  - **An account lives until the human deletes it** (a sign-in is made again only by signing
    in again, so deleting projects does not take it). − on an account in a
    project lets go of it at once, nothing asked, as of the terminal only: a task running it keeps it. Deleting a
    project lets go of its accounts the same way. In Settings → Agents each account says the projects it is in ("in no
    project"), and − deletes it: refused while any task of any project, open or closed, has it open in a tab (counted
    from their `agent.json`; its conversation is in its folder), naming them; else after a question ("Delete the account …?",
    naming the projects that let go of it): signed out with its agent's own command (`auth logout`: what it keeps
    outside its folder goes too, the Keychain's entry on macOS), then its folder, with its sign-in, settings and
    conversations.
- The dialogs are part of the window, not windows of their own: no extra process. `AgentPicker.vue` (choosing) and
  Settings → Agents (`AgentPage.vue`, its state kept by Settings, so an install goes on behind a project's page and
  Settings stays open while it runs) share the state of one list of agents with Install (`lib/agents.ts`), each with
  its own; choosing draws it as radios (`AgentList.vue`), Settings as a list and the chosen one's details.
- An agent's state on the tabs comes from its hooks, each agent's at its own terminal's URL ("Several agents in a task"). Kulisa has events of its own (`agent-hooks.ts`): `prompt`
  working, `waiting` for the human, `tool-done` working again after waiting, `stop` done, `interrupt` and
  `session-end` unknown (but a session ending after a done turn keeps it). No agent tells when the human answered a
  permission, so the first tool to finish after it (`PostToolUse`, both agents) is the sign it works again; until
  then the tab still says waiting. Which of an agent's hooks sends
  which is the agent's, a table in its file (`agents/claude.ts`, `codex.ts`: `hooks`), each running one command
  (`hookCommand`, `agents/agent.ts`):
  - Claude Code, in `--settings` with its plugin (both taken): `UserPromptSubmit`, `Stop`, and
    waiting when it asks for a permission or a question (`Notification` matched to `permission_prompt`,
    `elicitation_*`) or a turn ends with an API error (`StopFailure`: a limit, a sign-in); `PostToolUse`; `SessionEnd` (`/exit`,
    `/clear`). Not `idle_prompt`, sent a minute after an answer: the tab already says done. Esc ends a turn without
    any hook, so Kulisa itself takes an Esc typed into an agent's terminal for the interrupt: working or waiting
    become unknown (`Task.interrupted`; an Esc that only closed a menu does so too, until the next hook).
  - Codex, its entry (`agents/codex.ts`) as a config override (`-c hooks=…`): `UserPromptSubmit`, `PermissionRequest` waiting (its MCP tools' questions too), `PostToolUse`,
    `Stop`, `Interrupt` (Esc), `SessionEnd` (also after 30 minutes idle), and `SessionStart`, which gives it the open
    profiles as Claude Code gets them and the session to resume. Codex runs a hook only once the human has trusted it
    (`/hooks`): its trust is kept per event under one key for every task (`/<session-flags>/config.toml:<event>`), so
    once is enough, and again only when Kulisa changes a hook. Kulisa never bypasses that, which would run any
    project's hooks unreviewed too. Interrupt's and SessionEnd's timeouts are at most 3 s (Codex cuts a longer one and
    warns at every start).

  Done means "come and see": once the human sees that agent's tab (in front of the task shown, with Kulisa's window in
  focus; at once when it was on screen) its tab and its task's show nothing (`seen`, `Task.tabState`), the agent still
  done for the rest of Kulisa.
  Other agents show none yet (ROADMAP).

## What each agent can do

The human gets the same Kulisa with every agent. What Kulisa does with an agent is a field of
its entry (`agents/agent.ts`, `CAPABILITIES`), and an agent either has it or says why not (`lacks`, with the reason):
a unit test fails for an agent that leaves one out silently, so a new agent comes with its gaps named.

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

A task may hold several agents at once, each in a tab of its island with a conversation of its own: Claude Code next to
Codex, or two accounts of one, or the same agent twice ([window.md](window.md),
The terminal, for the island). The human opens one with the island's **+** (the project's accounts, the default
first): always a **new conversation**. Each sees the task's code and profiles.

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
  its terminal's menu) opens **Change Agent** (`HandOver.vue`): the agent it comes from and the one chosen, between
  them what goes along (the task's branch, its open profiles, their tabs, its shells, the conversation), under them
  the project's accounts to choose from (the same one too, "afresh"; another agent's first: a limit is the usual
  reason) and what stays behind. Hand over: the one chosen opens in a new tab, in front under the dialog (a tab behind
  has no size: its terminal broke what the agent drew), which stays while it reads: what goes along flies to it again and again (not with reduced motion), over its real progress ("part 2
  of 5": its `task_history` calls of that conversation, `Task.historyRead` → `handover:read`). The dialog goes once
  it has read the last part, or at once when it waits for the human (its hooks: a permission, a sign-in,
  a limit), its tab is gone, or 30 s pass with no part read (an agent without hooks waiting for the human); Show now
  and × any time. Its first
  message as if the human typed it (a command-line argument, `prompt` in the agent's entry): go on with the work of
  conversation N ("its name"); read it whole in `task_history` first; then tell the human in a few lines what is done
  and what is next. Its first answer is the check: what it missed shows at once. The tab it came from stays: the
  human closes it (they may copy from it first). **New Conversation** (the same menus) opens the same agent anew,
  told nothing.
- What does not work well in a handover, and whether several agents at once are worth it: issue #93.
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

Why so, and what is not chosen:

- **A dialog, not a menu**: the moment a task is handed
  over is where Kulisa shows what no other tool keeps, the work around the agent (branch, signed-in profiles, running
  terminals), and says what does not go. One click more than the menu. It waits for the reading itself: the animation is the real handing over, not a show of 0.9 s; it never waits for an agent waiting for
  the human (the timeout, the hooks, Show now).

- **Several agents side by side, not one switched in another's place**: a side task needs no task of its own, and no
  agent is stopped for another to take over. Each in a tab, the human keeps both, closes one when done.
- **The new agent reads the whole conversation**, lightly cut ([transcripts.md](transcripts.md)), and writes its own
  handoff. The old agent cannot write one: its limit is reached, and `/compact` is a request to its model too.
- A conversation moved to another account of the same CLI and resumed there: with a new conversation for every agent
  opened, the conversation before is read, not continued.
- A mechanical summary alone: details that matter are spread through a long conversation, and rules lose them (the
  author).
- A history Kulisa writes as the work goes, or notes the agent writes through a tool: the transcript is on disk
  already, written by the agent; a copy adds only code, notes cost tokens and depend on the model remembering them.
- Converting a transcript into the other CLI's own format and resuming it there (txcript, baton,
  claude-codex-bridge): young tools over two undocumented formats that change with each release, a failure exactly
  when a limit is reached; and a transcript longer than the other model's window.
- A small local model writing the handoff (LLMLingua-2, a model through llama.cpp): tens of minutes on a CPU for a long
  conversation, gigabytes of memory, and it misses what a coding agent would find.
- A proxy giving the old CLI another vendor's model (`ANTHROPIC_BASE_URL` to a gateway such as LiteLLM; the one truly seamless way): it needs that vendor's API key (a subscription's sign-in is the CLI's own, and
  Kulisa reads no tokens), a gateway process of another's, and drops signed reasoning.
- Anthropic's Consumer Terms: several accounts are not forbidden; "bypassing any of our systems or
  protective measures" is. Going on with another vendor bypasses nothing; a second subscription of the same vendor
  to get around a limit may count as bypassing: the human's choice, so Kulisa never offers a switch on its own.

## Creating a task, step by step

1. **Code** (`worktrees.ts`), a copy of each of the project's repositories with a commit; a folder without git is
   used as it is (the task works right in it, and the next two steps skip it). Each branch starts as Claude Code's
   `--worktree` starts one: from the remote's default branch after `git fetch` (`origin/main`), else from `HEAD`.
   Uncommitted changes of the project's folders are not carried. The branch is `task-<n>`, one name free in every
   repository (`-2`, `-3` if taken), the copies next to their repository with one, in `~/KulisaProjects/<project>@task-<n>/`
   with several: `git worktree add --no-track -b <branch> <copy> <start>`. `--no-track`: pushing the task's branch
   never goes to the default branch.
2. **Files outside git** are copied from the project's folder when git ignores them and they are untracked: `.env*`
   at the top, each agent's own local settings (its `localFiles`: Claude Code's `.claude/settings.local.json`), and
   whatever the project's `.worktreeinclude` names (gitignore syntax, as Claude Code reads it). Dependencies (`node_modules` …) are not copied: the agent installs them (the
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
6. **The agent.** A new conversation in the task's folder, with the project's default agent or the one chosen. Every
   agent asks once per folder whether it may work there, and keeps the answer in its config. When the human said yes
   for the project's folder or another task's copy of it, the task's copy is marked trusted too, so the agent asks
   once a project, whichever agent it is (`extendTrust` in `agents/`; each agent's `trust` reads and writes its
   own config). Codex and Claude Code, asked in a worktree, keep the answer for the repository's root themselves;
   Kulisa's rule holds it for an agent or a version that keeps it per folder. Each
   agent's trust is its own: a yes given to Codex does not reach Claude Code, which asks once too.
7. The task is shown.

## What is on the computer

In Kulisa's data folder (`~/.config/Kulisa` on Linux, `~/Library/Application Support/Kulisa` on macOS,
`%APPDATA%\Kulisa` on Windows), laid out as Chrome lays out its user data (`store.ts`). Show Data Folder in a
project's submenu (a task tab's right-click menu) opens its `projects/<id>` in the file manager (`shell.openPath`), for the human who
asks where it is or what takes the disk; nothing in it is for editing by hand, so it is no button in sight:

```
projects.json                     the projects: id, name, folder, repos, color (the one it has while its favicon gives none), agents (accounts, the default first), profiles (their folders, in order), noDefaultAgent
profiles.json                     the profiles, one store (profiles.md): { next, list: [{ id, name, avatar, description,
                                  folder, login }] }
profiles/Profile <k>/             a profile's master, a Chromium profile, where the human signs in once for every task;
                                  kept in no project too, gone when the human deletes the profile (Settings → Profiles)
agents.json                       the agents' accounts (accounts.ts): { next, list: [{ id, agent, email, folder }] }
agents/<agent>-<n>/               an account's config folder (CLAUDE_CONFIG_DIR, CODEX_HOME): its sign-in, settings,
                                  conversations; Kulisa's profiles skill (skills/kulisa-profiles/) and Claude Code's
                                  settings for Kulisa (kulisa-settings.json), written at each start; gone, signed out first, when the human deletes it (Settings →
                                  Agents); one a sign-in left
                                  unfinished (Kulisa quit meanwhile) goes at the next start
settings.json                     the Kulisa zoom, the theme, where the tasks' bar is, the language; the windows: each one's
                                  tasks by key (in the bar's order), the one shown, where it was
logs/kulisa.log                   what happened and who asked (window.md, The log), for a bug report; at 1 MB it becomes
logs/kulisa.old.log               kulisa.old.log and a new one starts: 2 MB at most
Crashpad/                         Electron's crash dumps (crashReporter, no server; window.md, The log), to ask a user for
                                  after a crash; Crashpad prunes them itself (90 days, 128 MB)
deleted-folders.json              folders to remove at the next start (a session keeps its files open)
projects/<project id>/
  tasks.json                      { next, current, list: [{ n, name, branch, offset, folder (its agent's),
                                  copies: [{ repo, worktree, branch, base, folder }], home (its folder of copies),
                                  closed, closedAt, about }] }; base: the commit a copy started from; about: its first
                                  prompt's first line, until it is named; no copies: it works in
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
      Kulisa Tabs.json              the URLs of its tabs and which is in front
      Kulisa Session Cookies.bin    its session cookies, encrypted with the OS keyring
    Profile 2/ …
```

Outside it:

| What | Where | Made when |
|---|---|---|
| The task's copy | `<repo>@task-<n>/`, next to the repository (one repository) | creating a task |
| The task's folder of copies | `~/KulisaProjects/<project>@task-<n>/<repo>/` (several repositories, or one added later) | creating a task; adding a repository |
| The task's branch | each repository (`git branch`) | creating a task; renamed with the task |
| git's worktree record | `<repo>/.git/worktrees/<copy>/` | creating a task |
| A cloned repository | `<location>/<name>/`, or `<location>/<name>/<repo>/` for several (New Project, Clone from URL); `~/KulisaProjects/<project>/<repo>/` or next to the project's folder (Clone on its page) | cloning; stays, as the human's (removing it from the project, or the project, leaves it) |
| An empty first commit | the project's repository | New Project… with Create Git repository |
| direnv's permission for the task's `.envrc` | direnv's data (`~/.local/share/direnv/allow/`) | creating a task, if the project's is allowed |
| The agent's trust of the task's folder | Claude Code: `<CLAUDE_CONFIG_DIR>/.claude.json`, else `~/.claude.json`, `projects["<task folder>"]`; Codex: `<CODEX_HOME>/config.toml`, `[projects."<task folder>"]` | the task's agent starts, if the project's folder or another task's copy is trusted |
| Claude Code's language, Kulisa's one | `<account folder>/settings.json`, `language` (as its `/config` sets it) | ☰ → Language, and an agent's start; goes with the account's folder |
| An agent's conversation | the agent's own data (Claude: `<config dir>/projects/…/<session>.jsonl`; Codex: `<config dir>/sessions/`), in its account's folder (`agents/<agent>-<n>/`) | the agent runs |
| The agent itself, when Kulisa installed it | its maker's place (`~/.local/bin/claude`, `~/.local/bin/codex`, …) | Install in Settings → Agents |
| Kulisa itself, installed (Windows) | `%LocalAppData%\kulisa\`: `app-<version>\` (Squirrel keeps the one before too, removing older ones), `packages\` (the update downloaded), `Update.exe` | the installer; an update; gone when Kulisa is uninstalled (the data folder stays) |
| Kulisa itself, installed (Linux) | `/usr/lib/kulisa/` (the app, `chrome-sandbox` setuid root), `/usr/bin/kulisa` (a link), `/usr/share/applications/kulisa.desktop`, its icon under `/usr/share/icons/`, `/usr/share/doc/kulisa/` (Forge's deb and rpm makers) | the package; gone with `apt remove` or `dnf remove` (the data folder stays: a package may not touch a home folder) |
| Kulisa's apt repository (Linux, `.deb`) | `/etc/apt/sources.list.d/kulisa.sources`, `/etc/apt/keyrings/kulisa.asc` | the `.deb`'s `postinst`, written again at each update; gone with `apt purge`, kept by `apt remove` (as Chrome's) |
| Kulisa itself, installed (macOS) | `/Applications/Kulisa.app` | the `.dmg` or `.zip`; the human drags it to the Trash (the data folder stays) |
| The key the data folder's secrets are encrypted with | the OS keyring: "kulisa Safe Storage" (Chromium's `safeStorage`; Linux's secret service, macOS's Keychain; Windows uses DPAPI, nothing stored) | the first secret saved; never removed by Kulisa: the human's, as Chrome's |
| An update downloaded (macOS) | Squirrel.Mac's cache, `~/Library/Caches/app.kulisa.ShipIt/` (no update downloaded yet: no signed build) | the packaged app's update check; an update replaced by the next |
| macOS's own for the app (packaged) | `~/Library/Preferences/app.kulisa.plist` (the system's defaults for it), `~/Library/Caches/app.kulisa/` and `~/Library/HTTPStorages/app.kulisa/` (the update check's requests), under its id (`appBundleId`, `forge.config.ts`) | the packaged app's first start; macOS's, as every app's: they stay when the app is moved to the Trash |

Nothing is written into the project's own folder (but the first commit of a project Kulisa made).

**Uninstalling removes the program only**: the data folder, the tasks' copies and
branches, the agents Kulisa installed and the keyring key stay, so that installing Kulisa again brings everything back,
as with Chrome or VS Code. No installer can ask whether to remove the data too: Debian's policy forbids a package to
touch a home folder, macOS has no uninstaller, and Squirrel.Windows gives the `--squirrel-uninstall` hook 10 seconds
before it goes on without it (ROADMAP, Deferred ideas, "Delete all data"). The guide says what stays and how the human
removes it ("Reinstalling and removing Kulisa"): deleting the projects, profiles and accounts in Kulisa first, then
the program and the data folder.

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
- what its agent keeps of the task's folders (`agents/`, each agent's `forget`, `forgetFolder` in `projects.ts`;
  undocumented layouts, so what is not found is skipped): its own folder's conversations and records, and the other
  copies' records (their trust); a copy removed from a task alone (Remove Repository) loses the same:
  - Claude Code, in the config dir its sessions used: its conversations in `projects/<folder>/` (those recorded in
    the task's folder: Claude names that folder with non-Latin letters as `-`, so other folders can share it),
    `file-history/`, `session-env/`, `debug/`, `todos/` of those sessions, the folder's lines in `history.jsonl`,
    and `projects["<folder>"]` in `.claude.json` (the trust Kulisa gave it). Never the project's folder.
  - Codex, in the `CODEX_HOME` its sessions used (its account's folder): the session files whose folder is the task's (`sessions/`,
    `archived_sessions/`), their lines in `history.jsonl` (the prompts typed, by `session_id`) and
    `[projects."<folder>"]` in `config.toml`. Not its own databases (`state_*.sqlite`):
    their format is Codex's alone, so a record of the thread may stay there.

A task without a worktree worked in the project's folder: only its data folder goes; the folder, and what its agent
keeps of it, are the human's, as without Kulisa.

What stays in any case: an agent Kulisa installed (it serves every project).

## Deleting a project

**Delete Project…** in ⋯ at the top of a project's page in the projects' manager, open or not: there
alone (with everything else about a project; not in a tab's menu, the Welcome screen or
a menu). One function (`deleteProject` in `app.ts`): Kulisa asks first, saying what goes and which tasks have
work not in main and not pushed; closes its open tasks in every window; deletes each of its tasks as above; then removes it
from `projects.json` with its data folder `projects/<id>/`. The project's own folder stays as it is, and so do its
agents' accounts, let go of (Settings → Agents deletes one: "Choosing the agent", Accounts).

## While Kulisa runs

- **One Kulisa per data folder** (`app.requestSingleInstanceLock`, at the top of `start` in `app.ts`): a second one
  started on the same data shows the first one's window and quits before it reads or writes anything: two would
  write over each other's saved tabs, session cookies and tasks, and the second would have no MCP server (the port
  taken). Electron's lock is the data folder's: Kulisa on another
  (`KULISA_DATA`) runs next to it, as the tests' apps do, each on its own.
- Each window shows one of its tasks. The others keep running, the other windows' too: their
  pages and agent go on, their pages hidden.
- A task loads (its profiles start, its agent starts) the first time it is shown, also after a restart.
- A task is known among all open ones by its key, `<project id>/<n>` (the window, the terminals). Each has its own
  MCP URL, `http://127.0.0.1:4450/task/<project id>/<n>/mcp`, and hooks under `/task/<project id>/<n>/hooks/` (each part
  percent-encoded: ids have letters of any language); its agent gets them in its environment (`KULISA_MCP_URL`,
  `KULISA_URL`) and sees only its task's profiles. Profile ids repeat across tasks; inside Kulisa a profile
  is `<project id>/<n>/<id>` (CDP proxy, highlights).

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

- **Every task a copy, the project's folder the human's.** An agent working where the human works would leave its
  unfinished edits in the way of the human's own; every agent has its worktree, and the folder changes only when the
  human asks for a merge (the agent checking first for the human's uncommitted changes). No task is special: any one
  is closed, opened again or deleted the same way.
- **× closes, Delete deletes.** A task is often put aside and taken up again (waiting for a review, a question to
  the client), so × keeps everything and stops only what costs memory (its agent, its tabs); deleting is a menu item
  with its question. Closed tasks stay until the human deletes them.
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
  master and every copy, so the human signs in once ([profiles.md](profiles.md), "Sign-ins kept in step"); a copy of
  another task's copy would sign that one out with rotating tokens. `session.fromPath` keeps the
  caches inside the profile (they cannot live elsewhere), so a copy skips them.
- **Storage as Chrome lays it out**, so what is known about Chrome's storage applies. `Profile N` folders are fixed
  at creation: a rename touches only `profiles.json`.
- **One port offset per task** moves any number of services with one number. Cookies do not depend on the
  port, so the copies stay signed in to the app (separate hostnames such as `checkout.localhost` would lose that).
  The local database is the developer's matter (`docker compose` already names containers after the folder, so a
  task gets its own; only published ports clash). An app that cannot change its port (hard-coded, OAuth bound to
  `localhost:3000`) cannot run in a task's copy; the agent says so.
- **Every task asks before it is deleted**, also one without changes (unlike Claude Code's `--worktree`): its
  conversation and profile copies go too.
- **A task loads when first shown**, not at the start: after a restart nothing works in the background anyway,
  and the agent starts at its terminal's real size. Its grid comes from what is saved, without waiting for a program
  to run or a site to answer: its open profiles are made at once and start behind it, together (their cookies, tabs,
  automation: `ProjectProfiles.load`, `started`), its terminals' tabs come starting, before their agents are found ([window.md](window.md), "A tab comes before
  its program"), and its project's repositories are looked at (git) meanwhile (`Task.gitChecked`). Its agents start
  after both: they find its profiles ready, and are told at their start what the task may add.
- **Tasks in the background keep running**, their pages and agents. Memory: each agent is a
  process of its own (Claude Code about 200–400 MB) plus its profiles' tabs; those its agents stop using lose their
  process after a while and load again when the task is shown ([profiles.md](profiles.md), "Tabs unloaded").
- **Another project's task opens beside the shown one** (a tab in the bar), as a browser opens a tab, nothing
  stopped: the human closes a task (×, Close All Tasks) when it is safe.
- **Several windows are one Kulisa**, not a second instance: two cannot share the data folder. A task moves with
  its pages' native views (`Profile.moveTo`), not loaded again, and with what its terminals show (xterm's serialize
  addon, as VS Code keeps terminals), at their size, so its agent is never told a default one. A window is one more
  renderer process for Kulisa's own page, only while it is open.
- **The agent's trust of a task's folder**: the agents' configs are undocumented; when the file is not as expected,
  nothing is changed and the agent asks as usual. Only a yes is carried, never the human's no (Codex's
  `trust_level = "untrusted"`). Claude rewrites its file often; Kulisa writes it whole at once (a rename), and a
  write of Claude's at the same moment may undo it (then Claude asks).

## The code

| File | What |
|---|---|
| `src/main/app.ts` | the app put together, its windows opened at the start |
| `src/main/open-tasks.ts` | open, close and move tasks, load and let go projects (one change at a time, `serial`) |
| `src/main/ipc/tasks.ts`, `projects.ts`, `agents.ts` | the windows' handles on tasks, projects, agents and accounts |
| `src/main/window.ts` | a window: its tabs (tasks), show one, the grid's state, its questions |
| `src/main/projects.ts` | a loaded project: its tasks; making, closing, opening again, deleting one (with the question); making a project (`createProject`), deleting a project's data |
| `src/main/tasks.ts` | a task: its profiles, its terminals and agents (open, hand over, close, environment), renaming, copies of its profiles for a new task, ports |
| `src/main/worktrees.ts` | git: a task's worktree and branch, files outside git, direnv, changes, renaming the branch, removal |
| `src/main/agents/` | the agents to choose from: find, install, start, resume; a folder's trust carried to a task's copy |
| `src/main/store.ts` | the data folder above |
| `src/terminal/` | the terminals: their ptys, buffers and the xterm shown ([README](../src/terminal/README.md)) |
| `src/renderer/components/TaskBar.vue`, `NewTask.vue`, `Empty.vue`, `settings/ProjectEditor.vue` | the tasks' bar (a tab per open task, a new tab); its + (a new tab); the grid's place when no task's grid is shown (the window's pages); the projects' manager |
| `src/renderer/components/newtab/` | the board, a new tab's and the empty window's: `Board.vue` (the columns, New Project…), `ProjectColumn.vue` (a project and its tasks) |
| `src/renderer/components/welcome/` | the first start's welcome: `Welcome.vue` (the slides, then New Project's steps under a question each), `Tour.vue` (the slides, their pictures drawn in HTML) |
| `src/renderer/components/newproject/` | New Project's steps: `Wizard.vue` (the steps, the buttons; the welcome's and the dialog's), `wizard.ts` (their state and rules, one per wizard), `CodeStep.vue`, `AgentStep.vue`, `ProfilesStep.vue`, `NewProject.vue` (the dialog) |
| `src/renderer/components/TaskTab.vue`, `TaskRename.vue` | a task's tab in the bar, its menu, the Rename Task dialog |
| `src/renderer/components/AgentPicker.vue`, `settings/AgentPage.vue`, `AgentList.vue`, `InstallProgress.vue` | choosing an agent when the one to open is not there; an agent's page in Settings, its details and accounts; the radios of agents with Install that choosing shows; an install's line and its Details |
| `src/main/favicons.ts` | a project's icon: its site's favicon in its code (Projects, "Each project has a color and an icon") |
| `src/shared/names.ts` | the one rule for names (projects, tasks, profiles) and slugs |
| `src/main/accounts.ts`, `src/renderer/components/AccountSignIn.vue` | the agents' accounts, one store; a new one's sign-in in Settings (a project's page, or Agents) |
| `src/renderer/lib/grid.ts`, `components/Grid.vue` | building a task's grid; the slide (a view transition) |
| `test/tasks.ts` | the tests; `test/restart-tasks.ts` after a restart; `test/unit/agents.test.ts` |
