# Kulisa user guide

![Kulisa: three profiles of a shop (buyer, seller, admin) side by side, the agent outlining the buyer's new order in the seller's and the admin's, and Claude Code in the terminal below](images/kulisa.png)

Kulisa is an agentic IDE where you and your chosen coding agent develop, run, and test software together.
The agent works in a terminal, opens browser profiles to test web apps as different users, and runs CLI apps in
interactive terminals you can both operate. You can watch its work and try the result yourself. Several tasks let
you work on different parts of a project at once.

You sign in to your accounts yourself, by hand; the agent never does, except as test users of your own app on this
computer.

## Words used here

- **Profile**: one browser identity, as in Chrome: its own cookies, sign-ins and tabs. One profile is one user of
  your app ("ann, the seller"). It is shown as a pane with its tabs.
- **Project**: what you work on: its code (a folder, or one or more git repositories), the agents that work in it,
  and any browser profiles it needs.
- **Task**: one piece of work in a project: an agent in a terminal, a branch and copy of the code when needed,
  browser profiles and interactive terminals for checking the result. Several tasks of one project run at once, each building something else.
- **Tab**: an open task in the tasks' bar (under the grid, or in the title bar), as a browser's tab; its project's icon is on it.

## Systems

Kulisa is made for Linux, Windows and macOS. Its installers are for 64-bit Intel and AMD processors (x64), not yet
for ARM ones.

- **Linux:** Ubuntu, Debian and Fedora, in the versions their makers still support.
- **Windows:** Windows 10 and later.
- **macOS:** Ventura (13) and later; no installer yet.

## Getting started

Download Kulisa from its [latest release](https://github.com/cosmotools/kulisa/releases/latest):

- **Windows:** `Kulisa-<version>.Setup.exe`. It is not signed yet, so Windows warns about it: More info → Run anyway.
  It installs for you alone, with no questions, and starts. From then on it updates itself: a new version is
  downloaded in the background; Kulisa offers to restart into it, or it starts the next time you start Kulisa.
- **Linux:** the `.deb` for Ubuntu and Debian (`sudo apt install ./kulisa_<version>_amd64.deb`), the `.rpm` for
  Fedora. Kulisa is then in your apps. On Ubuntu and Debian it then updates with the system: a new version comes in
  Software Updater, or with `sudo apt update && sudo apt upgrade`; installed while Kulisa is open, it offers to restart
  (everything comes back as it was), or starts next time. The `.rpm` does not update itself: install a new
  version the same way.
- **macOS:** to come.

To verify a downloaded installer with GitHub CLI, run `gh attestation verify <file> -R cosmotools/kulisa`.

1. **Make a project.** Choose **Create a project**, connect an agent such as Claude Code or Codex, choose where
   the code comes from and finish setup. **Create project** opens its first task.
2. **Tell the agent what to do** in the terminal. It can open the browser profiles and interactive terminals it
   needs as you work. You can use them too.
3. **For web apps**, sign in where your app needs a real account: when the agent asks, or ahead of time with
   **Sign In…** in Settings → Profiles. You sign in once, for every task.

More tasks: **+** in the tasks' bar makes a new one in one click (with several projects, it asks which one first). Tasks of another
project, and those you closed, are in the sidebar (Tasks, below).

## The window

Open **Settings** with the title bar's gear. Changes save as you edit; close with Esc, the back arrow or the gear.
Your task keeps running underneath. **☰** includes zoom, theme, language, task-bar position, shortcuts, help and About.

On macOS, ⌘, opens Settings and ⌘Q quits. Closing the last window hides Kulisa while agents continue; the Dock icon
brings it back.

### Stage and Workbench

Your coding terminals, **Activity bar** and **Side bar** occupy **Workbench**, the development area.
Its **Main pane** shows the selected Activity bar item's content. Browser profiles and interactive terminals occupy **Stage**.
Drag Stage headers to arrange/stack environments and thin dividers to resize panes.

**Stage** in the title bar offers:

- **Left**, **Right** or **Above** Workbench.
- **Horizontal stack**, **Vertical stack** or **Tabs**.
- **Allow overflow** to scroll a stack rather than shrink every pane to fit.
- **Open an environment** to add a profile or Stage terminal. An empty Stage stays hidden.
- **Follow agent** to reveal its active environment and highlight activity. Your Stage input pauses following;
  choose **Follow agent (paused)** to resume.

**Maximize environment** fills Stage with that group while Workbench remains visible. **Restore environment**
returns to the previous layout. The agent can arrange Stage too.

### Activity bar and Side bar

Use the **Activity bar** to choose **Agents**, **Project**, **Diff** or **Artifacts**. The adjacent **Side bar** lists
that view's items; select one to show it in the **Main pane**. Click the active Activity bar button to hide the
Side bar, or drag its divider to resize it. Terminals keep running when you switch views.

- **Agents** lists coding agents and development shells. Select a row to use its terminal.
- **Project** shows the current task's code folders. Expand folders; click a file to select it, double-click or
  press Enter to open it. Right-click for **Open**, **Open in System Application** or **Show in Folder**.
  A repository's **⋯** or right-click menu offers **Open Folder** and, for an added copy, **Remove Repository**.
- **Artifacts** shows the task's completed files and folders as a tree, folders first and alphabetically. Expand a
  folder; click a file or press Enter to preview it in the Main pane. Right-click a file or folder to open, reveal,
  send to the agent or delete it. The heading's trash deletes all results. Drag a file to another app or folder. **Send to Agent** puts
  its path in the agent's input for you to review and send. **File Folders** opens results, all temporary material or
  one conversation's temporary folder in your file manager.

Text preview accepts UTF-8 files up to 4 MiB and 100,000 lines; **Find in file** searches the whole file and **Wrap**
wraps long lines. PDF preview accepts files up to 32 MiB, with page/zoom controls and search when the document contains
text. Image preview accepts supported images up to 16 MiB and 16 million pixels, with at most 32,768 pixels per side.
Use **Fit**, **Fit width**, **100%** and the zoom buttons; scroll to inspect a tall or enlarged image. Transparent
areas show a checker background. SVG displays as an image; HTML shows source.

Markdown opens with formatted text, tables and task lists. Use **Preview** / **Source** to switch; Source provides
text search and wrapping. Formatting accepts up to 256 KiB; larger files can use Source within the text limits.
Relative links open other files in the task's results; web links open in your browser. Images alongside the report
can display within the image limits, with at most 32 images, 16 MiB and 16 million pixels in total. External images
and embedded HTML are not loaded.

Supported audio and video files use the browser's player controls. Playback starts when you press play and stops
when you leave the file, Artifacts or the task, or open Settings.
Large media files stream without loading the whole file first. Available codecs depend on the bundled player;
files it cannot play still offer **Open in System Application**.

Previews do not save changes; file changes update the preview. Click the row again to reload it. For other formats or larger files, use **Open in System Application**; executable files are not launched.

Ask the agent to create a file and it saves the finished result in **Artifacts**, unless you specify another
location. Related files can stay together in a folder. Work in progress, automatic testing screenshots and large
tool replies stay in each conversation's own folder inside `tmp/`, beside the results folder, hidden from Artifacts.
Delete files yourself or ask the agent to clean the ones you specify.
A screenshot requested as a result belongs in Artifacts; screenshots you take yourself also appear there.

Files have no size quota or automatic expiry. Closing a conversation or task keeps them; deleting the task removes
both results and temporary work. Agents can remove their own unneeded temporary files as they work.

### Editing files

Text files open in the code editor and save automatically after a short pause. It accepts UTF-8 files up to 1 MB
and up to twelve open files. Other files open in the system app; executable files are not launched.

Open files appear as tabs. **×** closes one; a tab's right-click menu includes **Close All**, system opening and
**Show in Folder**. Closing saves pending changes; if they cannot be saved, it asks before discarding them.
**Cancel** stops closing the remaining files.

Switching files, tasks or Activity bar items keeps your editing state. Restart restores open files and recovery
drafts, with fresh undo history and cursor position. Deleting a task removes its drafts.

When an agent changes a file, the editor updates it unless you have unsaved changes. Then autosave pauses:
**Compare versions** shows both versions; choose **Use disk version** or **Keep my changes**. If the file changes
again, compare the latest version before choosing. For a deleted or inaccessible file, **Retry** checks again;
**Copy text** lets you recover your changes elsewhere.

Use Ctrl/Cmd+F to find, Ctrl/Cmd+R to replace, Shift+Enter to insert a line below and Alt+Shift+Up/Down to move lines.
Ctrl/Cmd+/ toggles a line comment; Ctrl+Shift+/ toggles a block comment on Windows/Linux, Cmd+Alt+/ on macOS.

### Reviewing changes

**Diff** shows local Git changes without editing them. **Agents** or the terminal focus shortcut returns to the
terminal, which keeps running. Switching views or tasks keeps your review position and settings; restart opens a
fresh review.

**From** is the task's branch and local edits. **To** defaults to the repository's default branch; choose the
current branch to see uncommitted changes only. Selecting a target does not change your code. New files are
included; ignored files are excluded.

Filter file paths to narrow the tree and review; **×** clears the filter. Arrow keys navigate and Enter selects a
file to jump to its changes. Choose **Unified** or **Split**; file-header arrows collapse files and the copy button
copies a repository-relative path. Select/copy code or drag line numbers for a range. For a large review, use
**Load diff**; files that cannot be displayed explain why.

### Task navigation

**☰ → Tasks bar** places task tabs below the grid or in the title bar. Wheel over overflowing tabs to scroll.

## Projects

### New Project

Choose **Create a project** on the welcome, or **New Project…** at the sidebar's foot later. Both show the same
three steps. **Back** keeps your choices; on the first step of the welcome it returns to the introduction.

1. **Agents — Choose your agent**: choose one starting agent. Each ready account shows its configuration folder.
   **Use** selects it and takes you to the next step. An existing setup shares login, settings and skills with your
   other CLI sessions. Each provider has a separate **New configuration** row: **Connect** starts with an empty
   configuration in Kulisa and opens your browser to sign in; **Install** installs a missing CLI first.
   Add more accounts after creating the project. Connected accounts remain available if you cancel creation.
2. **Code**: start a new project folder, open a folder on disk or clone a repository using your git credentials.
   For a new project, enter **Folder name** and choose its parent folder in **Create in** with **Browse**.
   For a clone, enter **Repository URL**, then check the suggested folder name and destination.
   New folder names use 1–64 characters: A–Z, a–z, 0–9, `-`, `_` and `.`. Start with a letter or digit and do not end
   with a dot. Windows device names such as `CON` or `NUL.txt` cannot be used. Existing folders keep their names.
   Folders and clones are created only when you finish setup. Existing code is kept; new folders start without git.
   New projects and clones require a destination that does not exist yet, even if an existing folder is empty.
   Use **Open a folder** for existing code. You can add other folders to the project later.
3. **Start**: the chosen folder or repository supplies a readable project name automatically: `my-shop` becomes
   `My Shop`. Use **Edit name** to change it; the folder's name and location stay as they are.
   **Web app / CLI app / Not sure yet** offers starting ideas for your first request. Every choice keeps access to
   browser profiles and interactive terminals. No environment opens automatically and no request is sent for you.

**Create project** opens the first task with **Agents** selected in Workbench and your chosen agent's terminal
ready for your request. Change the setup later in Settings.

### A project's page

**Settings** (the gear) → **Projects** → the project, or **Project Settings…** in a project's right-click menu in the
sidebar, or in a task tab's right-click menu, under the project's name.
Changes save automatically.

- **Name**.
- **Local addresses**: addresses of your app besides `localhost` (a tunnel, a dev domain), where the agent may type a
  test user's password (Profiles, below). Type one and press Enter; its × removes it.
- **Folders**: its repositories or plain folders, all alike, with git or without. **Add Folder** adds one (Add Folder…,
  Clone from URL…, which clones next to the default folder). A folder's **⋯** (or a right-click on it): **Remove from
  the Project** (its folder stays), **Make Default**: a new task gets a copy of it, and the agent starts there; a task
  adds the others when it needs them (Tasks, below). Each repository on GitHub shows the GitHub account it goes as
  (GitHub, below): Kulisa picks the first of yours that can reach it, and you can choose another there. A line under
  the list explains when no account can reach a repository.
- **Agents**: the accounts its tasks run. **Make Default** in one's **⋯** makes it the one a new task runs; **No
  Default** on the default one leaves the project with none: a new task then starts with nothing running, and big
  buttons in the middle let you open the agent you want, or a terminal. With no agents at all, a new task starts with a
  terminal.
- **Profiles**: which profiles its tasks have. **Add Profile** makes a new one or adds one you have; **Remove from the
  Project…** in one's **⋯** lets go of it (the profile stays in Settings → Profiles).
- **⋯ → Delete Project…** deletes Kulisa's data of the project and all its tasks, after a question saying what goes.
  Its own folder and your code stay.

## Agents and their accounts

**Settings → Agents** shows supported agents, versions, accounts and Install. Kulisa uses the maker's installer;
it never removes or updates your CLIs itself.

Each connection uses one configuration of an agent. On its page, **Use existing setup** connects your signed-in
CLI configuration directly; settings and login are shared with other sessions using it. **Connect** or **Create
separate setup** starts an empty configuration in Kulisa for an independent work or personal account. Accounts
remain available until you remove them here.

Use **Open Folder** or **Copy Path** on an account's page to find its settings. **Disconnect…** leaves an external
configuration and its sign-in on disk; **Delete…** signs out and removes one created in Kulisa. First close any
agent terminals using the account, including those in closed tasks. Deleting a task keeps external agent settings
and conversation files.

A task can have several agents/conversations. Use **Change agent…** to hand work over: choose an account, then
**Hand over**. The next agent reads the conversation; branch, profiles and running shells stay available.
Permissions and account settings do not transfer. **Show now** reveals the next agent immediately; requests for
your input also reveal it. The old conversation stays until you close it. You can also ask an agent to continue
another's work directly.

**Dictation**: hold right Ctrl (right ⌘ on macOS), or tap to start/stop. The Activity bar microphone works the same way.
Speak after the wave appears; text stays in the agent's input for review before sending. Change the key in Keyboard
Shortcuts; language comes from **☰ → Language** for setups created in Kulisa; external setups keep their own language setting.
With a shell active, dictation brings the agent forward.

Dictation with Codex requires Claude Code to be installed and a Claude-subscription account connected in
Settings → Agents. For agents without their own voice input, an external Claude setup must also trust dictation;
connect a separate Claude setup in Kulisa if needed. Point at a disabled microphone to see what is missing.

## GitHub

**Settings → GitHub** holds work/personal accounts. Kulisa keeps credentials encrypted with your computer's keyring;
agents do not receive them. **Add Account** offers:

- **With GitHub…**: enter Kulisa's displayed code in the browser, authorize Kulisa App and install it on needed
  repositories. **Enter only codes Kulisa just displayed**; another person's code would authorize them as you.
- **With a Token…**: create a fine-grained PAT using the linked permissions form, choose the organization/repositories,
  then paste it. Broad classic tokens are refused.

Organization owners approve App installation; members can request it. A fine-grained token may also need approval
or company SSO authorization. Repository rows explain inaccessible accounts and link installation.

Accounts show installations, projects and authentication expiry. **Sign in Again…** restores a signed-out account.
Without a Linux keyring, sign-ins last only until restart; the page explains this. **Delete…** forgets credentials
but does not revoke GitHub authorization; its confirmation links GitHub's revocation page.

## Tasks

Each open task keeps its layout, selected Activity bar item and scroll positions. Restart restores saved panel
positions.

- **Sidebar**: bar's first button or Ctrl+Shift+A; docked when no task is open. Projects sort by recent use, open
  tasks before closed ones. Click/Enter shows or reopens a task. Project + creates one; trash/Delete removes it
  after confirmation. Project menus include settings, data folder and closing tasks.
- **New task**: bar +, Ctrl+Shift+N for the current project, or project +. It starts the default agent; without a
  default, choose a launcher. Profiles start closed: open needed users from their buttons/task menu or let the agent.
- **Code**: when coding begins, the agent creates the task's git worktree/branch beside your repository, preserving
  your folder. Selected ignored setup files, including `.env*`, are copied; dependencies need installation.
  Without git/commits, work stays in your folder. Merging back requires your request and a check for local edits.
- **Repositories**: tasks start with the default repository; **Add Repository** adds another task-owned copy when
  needed, or the agent asks first. Reading other project repositories needs no copy. **Remove Repository** deletes
  the added copy/branch, asking about unpushed work. Kulisa informs running agents when safe.
- **Ports**: your agent chooses a free port for each running app. Sign-ins are shared across ports.
- **Name**: starts as **New Task**; the agent names it once the work is clear, or use Rename/double-click. Until then
  an agent's conversation title may appear. Branch follows an explicit name; the worktree folder stays fixed.
- **Tools**: Kulisa sessions approve browser, terminal, command and file-upload tools. Actions such as removing
  a profile can still ask for confirmation.
- **Status**: spinner working, exclamation waiting for you, check done until viewed. Other tasks keep running when
  you switch.
- **Close** (×, middle-click, menu) stops agents/pages and preserves code, branch, profile copies and conversations.
  Reopening resumes agents. **Delete Task…** permanently removes these after explaining unmerged/unpushed work.
  Human project folders remain.
- A tab's project submenu includes New Task, Move All Tasks, Project Settings, Show Data Folder and Close All Tasks.

### Several windows

- **Move to New Window** in a tab's right-click menu, or drag the tab out of the window, e.g. to a second monitor.
  Its agent and pages move along, still running. **Move to Window: …** puts it into another window; dragging a tab
  within the bar changes the order.
- **Move All Tasks to …** in the project's submenu moves every open task of that project in this window together.
- Closing Kulisa keeps everything: the windows and their tasks come back at the next start.

## Profiles

Manage profiles in **Settings → Profiles**. A profile represents the same person across projects and tasks.

- **New Profile** there makes one: type its name, Enter (or Add Profile → New Profile… on a project's page, to make it
  in that project).
- **Name**: letters, digits and `@ . _ + -`, so it can be the account's email (`ann+test@shop.com`). The agent calls
  the profile by it, so two profiles of one project cannot have the same name (`Ann` and `ann` are the same).
- **About**: who it is in your app and what it can do. The agent picks profiles by it; if it is empty, the agent
  asks you and saves your answer.
- **Picture**: an animal, to tell the panes apart at a glance.
- **⋯ → Delete Profile…** (or right-click the profile) removes it everywhere, with its sign-ins, for good.

### Signing in

- **You sign in once, for every task.** Use **Sign In…** in Settings → Profiles or **Sign In to Master…** in the
  pane's **⋯** menu. Sign in in the window that opens. Real-account sign-ins and sign-outs in a task also reach
  other tasks using that profile.
- Signing in to your app on `localhost` stays in that task: each task runs its own copy of your app.
- **Test users of your app**: a profile's **Test login** and **Test password** (Settings → Profiles), or saved by the
  agent after it signs a user up. The agent then signs in as that user itself; Kulisa types the password, the agent
  never sees it, and only on your local app, never on a real site or an account provider (Google, Microsoft …).
- While a pane is on a sign-in page (Microsoft, Google, Okta …), the agent is kept out of that profile until you are
  through.

### Open, close, remove

- **×** closes a profile's pane while keeping its sign-in and tabs. Reopen it from the task tab's right-click menu.
- **Remove from Project…** (the pane's menu) takes the profile out of this project; it stays in Settings →
  Profiles.

## A profile's pane

Use **⋯** (or right-click the header) for profile actions and **⋮** for browser actions. Point at the status icon
to read the agent's activity when its text does not fit.

- **Change an address**: double-click a tab, right-click it → **Edit address…**, or press Ctrl+L for the active tab.
  The full address appears selected in place of the tabs. Enter goes there; Esc or clicking outside cancels. Point at
  a tab to see its full address without editing.
- In a new tab, type an address or words to search Google for.
- Links that open a new window and pop-ups open as tabs of the same profile. Right-click a tab: Edit address…,
  Reload, Duplicate, Close tab, Close other tabs.
- In a narrow pane, use navigation buttons from **⋮**.
- **Zoom** a site with Ctrl + / − / 0 in its page; it is kept for that site in that profile and shown beside the tabs
  (a click resets it).
- **Right-click in a page** for link, image and editing actions, Pick an element for the agent, a screenshot of an
  element, and Inspect. Sites with a menu of their own (Teams, Google Docs) show theirs.
- **DevTools** of a tab: the pane's ⋮ menu, or F12.
- **Screenshots** of a tab: the pane's ⋮ menu → **Screenshot**:
  - **Element**: click an element on the page (or press Ctrl+Shift+S in the page); Esc cancels;
  - **Visible Part**: what the pane shows;
  - **Full Page**: the whole page down to its end. A page that scrolls inside a box of its own (many mail and admin
    apps) gives what is visible; take that box as an element instead. Pictures further down may still be empty if
    the page loads them only when you scroll there.

  Screenshots go to the clipboard and the task's **Artifacts**, without the agent's marks. A **thumbnail** appears
  in the pane's corner: click to view it in **Artifacts**, drag to keep a copy elsewhere, or right-click for
  **Show in Folder**, **Copy**, **Send to Agent**, **Delete** and **Close**. It stays while the pointer is over it; **×** hides the thumbnail.
  Delete the picture from Artifacts or the thumbnail menu; deleting the task removes it too.
- Inactive pages may unload to save memory and reload when you return. Their tabs stay visible, and pages with
  unsaved changes are kept.

## Working with the agent

- **Your typing stays where you put it.** A tab the agent opens, or a page that loads by itself, does not take your
  keyboard: what you type to the agent in the terminal stays there. A click in a page gives it the keyboard, as always.
- **You see what it does.** Each of its actions is marked in the page (where it clicks, the element outlined, its own
  pointer), and a caption over the pane says what it is doing.
- **Share selected text.** Select text in a browser page or Stage terminal, then right-click **Send selection to agent**.
  The selected text and its environment name go into your agent’s message draft. Add your question, review it and
  send when ready. You need an open agent terminal.
- **Point and tell.** Click **Pick** (the arrow icon at the end of the profile’s controls row, or Ctrl+Shift+C), then
  an element on the page. A reference to it goes into the agent's input; write the rest of the message around it ("this button
  does nothing") and send. Picks from several panes can go into one message. Esc cancels.
- **It points back.** Asked where something is, the agent outlines it in the page, with a label over the pane, until
  you click or type there.
- **Several users at once**: the agent acts as one profile and checks the effect as another ("Sam sends an invite,
  Ann receives it").
- **Its own terminals.** What keeps running (your app's dev server, `docker compose up`) the agent starts in a
  terminal of its own in the background, so you see it, stop it and type into it.

## Terminals

- **Agents** in the Side bar lists the task's agents and development shells. Select a row to use its terminal,
  running in the task's folder with your project's environment.
- **+** opens an agent, a new conversation or **Terminal**, a shell. **×** closes one: closing an agent asks first and keeps
  its conversation in the task's history; a shell closes at once, or with `exit`. Right-click an agent's row for
  **Change agent…**, **New Conversation**, and **Close**.
- With no development terminal, use **+** to choose one or Ctrl+` to open the task's agent. With no testing
  environment open either, launch buttons offer the project's agents, **Terminal** and profiles. Tab selects a launcher;
  Enter opens it.
- Terminals come back after a restart in the Agents list: an agent continues its conversation, a shell starts fresh.
- Copy and paste as in your OS's terminal: Ctrl+Shift+C / Ctrl+Shift+V on Linux, Ctrl+C / Ctrl+V on Windows, ⌘C / ⌘V
  on macOS. Paste also attaches clipboard images in Claude Code and Codex, including from the right-click menu.
- Drop files onto a terminal to put their paths into your message. Press Enter when your message is ready.
- Ctrl+click a link to open it: Kulisa asks where, in one of the task's profiles or in your own browser.
- A file or folder named in the terminal (a screenshot the agent saved, a file it changed) is a link too: Ctrl+click it
  to open it in its app or show it in its folder. A program or script is only shown in its folder, never run.
- Right-click for **Copy**, **Paste**, **Select all** and **Clear**.

## Testing a command-line application

Choose **Stage → Open an environment → Stage Terminal**. It opens your shell in the task's working folder.
Run a command such as `python3 calculator.py`, or ask your coding agent to run it. You and the agent can both
operate the app; browser profiles are optional.

In the terminal's **⋯ → Settings…**, change its name and save a launch command for the run button. Leave the command
empty to use your shell. The header offers **Run app**, **Restart app** or **Run again**; without a saved command,
use **Restart shell**. Each starts with a fresh screen. **⋯ → Stop** ends the process; the header shows the exit
code when it finishes.

In **Settings…**, set columns and rows to test a fixed terminal size, or leave both empty to follow the pane.
**Fit to pane** restores automatic sizing. Right-click also offers run/stop actions, copy, paste and select all.

To search retained output, press **Ctrl+Shift+F** (**⌘+Shift+F** on macOS), or right-click **Find…**. Enter moves to
the next match; Shift+Enter to the previous one. Esc closes search and returns the keyboard to the terminal.

Closing a task keeps terminal names, commands and sizes. Reopening starts fresh shells; saved app commands wait
for **Run app**. A pane's **×** stops it and removes its saved setup. Stage terminals share your home folder and
credentials; sign in to real accounts yourself.

## Look and zoom

- **☰ → Theme**: Dark, Light, or System (as your OS). Profiles' pages keep your OS's theme, so your app looks as its users see it.
- **☰ → Language**: the language you speak with the agents, one for all of them. Claude Code takes your speech in it
  and answers in it, and may write code comments in it too: say in your project's CLAUDE.md which language its code
  is written in. Codex has no language setting yet, so it is not changed.
- **Kulisa's zoom**: Ctrl + / − / 0 outside the pages, or the zoom row in ☰, from 50% to 200%. It scales all of
  Kulisa, pages included; when not 100%, the title bar shows it (a click resets it).

## Keyboard shortcuts

**☰ → Keyboard Shortcuts** (Ctrl+Shift+/) lists Kulisa's shortcuts. On macOS, most use ⌘ in place of Ctrl;
terminal shortcuts keep Ctrl. The main ones:

| Keys | What |
|---|---|
| Ctrl+` | The terminal in front, and back to the page |
| Ctrl+Shift+` | A new terminal |
| Ctrl+Shift+A | The sidebar: every project with its tasks |
| Ctrl+Shift+N | New task of the same project |
| Ctrl+Shift+1…9 (⌘+Alt+1…9 on macOS) | The first to ninth task |
| Ctrl+Shift+PgDn / PgUp | The next or previous task |
| Ctrl+Shift+C (in a page) | Pick an element for the agent |
| Ctrl+Shift+S (in a page) | Screenshot of an element |
| Ctrl+T, Ctrl+W, Ctrl+Shift+T (in a page) | New tab, close the tab, open the tab closed last |
| Ctrl+L (in a page) | The address bar |

In the terminal every other key is the agent's.

## Where Kulisa keeps things

**☰ → About Kulisa** shows the version and the data, projects and program folders, with **Open Folder** and paths
to copy. On macOS, **Kulisa → About Kulisa** opens the same page. Use it to find the actual locations on your computer.

- Your project folders contain the code you and the agent edit. Deleting a project from Kulisa leaves them intact.
- Task copies are usually beside the project (`myshop@fix-header`), or in **KulisaProjects** under your home folder
  for a project with several repositories. New project folders are created there by default too. Task copies are
  removed when the task is deleted.
- Profiles, sign-ins, accounts and settings live in Kulisa's data folder: usually `~/.config/Kulisa` on Linux,
  `~/Library/Application Support/Kulisa` on macOS or `%APPDATA%\Kulisa` on Windows. Linux uses `$XDG_CONFIG_HOME`
  when set. Session cookies, test passwords and GitHub sign-ins are encrypted with your OS's keyring.
- **Show Data Folder** in a project's right-click menu or a task tab's project submenu opens that project's data.
- Screenshots and other artifacts belong to their task and are removed with it.
- Read the action/error log in **Settings → Log**, or use its **Open Folder** button to find the log file.

### Reporting a problem

When something goes wrong, **☰ → Report a Problem…** opens Settings at its **Log** page: what Kulisa did, line by
line. **Follow** keeps the latest entries in view; scroll up to read older ones. Search covers the whole log;
**Errors**, **Agent**, **Human** and **Tasks** filter it by kind.

The log includes folder paths, profile names and page addresses without their queries, but not typed text,
passwords, tokens or cookies. To share it:

- **Report… → On GitHub…** opens a new issue in your browser with your Kulisa's version and OS filled in; attach the
  log to it (**Save As…** first). The issue is public: look through the log before attaching it.
- **Save As…** saves the log as a file to attach to a message or a chat; **Copy All** copies it; **Open Folder** shows
  the file in your file manager.

### Reinstalling and removing Kulisa

Uninstalling Kulisa (your OS's way: Apps on Windows, `apt remove kulisa` or `dnf remove kulisa` on Linux, the Trash
on macOS) removes the program only (on Ubuntu and Debian, `apt purge kulisa` also removes where its updates come
from). Everything you made stays where it is listed above, so installing Kulisa again
brings it all back: your projects, tasks, profiles with their sign-ins, agents' accounts and settings.

To remove everything, do it before uninstalling, in Kulisa, so that it cleans up after itself. First note the folders
in **☰ → About Kulisa** (Settings → About): once the program is gone, nothing shows them. Then delete every project
(**⋯ → Delete Project…** on its page: its tasks go with it, with their copies of the code and their branches),
every profile (Settings → Profiles) and every agent connection (Settings → Agents: **Delete…** signs out and removes
a setup created in Kulisa; **Disconnect…** leaves an external setup and its sign-in alone). Then uninstall the program and delete the data folder (above). What remains and is yours to keep or remove:

- Agents Kulisa installed for you (Claude Code, Codex): programs of your own, updated by their makers. Settings →
  Agents shows where each one is; remove them their way.
- A project's repository that Kulisa cloned for you: your code.
- Kulisa's key in your OS's keyring, "kulisa Safe Storage": on Windows nothing to remove; on macOS in Keychain
  Access; on Linux in your keyring app (Passwords and Keys). On Linux and macOS also direnv's permissions for
  tasks' folders, if you use direnv.

If you uninstall first, task copies and branches remain. Preserve any work you need, then run
`git worktree remove <task-folder>` and `git branch -D <branch>` from the repository for each task. These commands
work on every supported OS.
