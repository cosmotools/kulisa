# Projects and tasks

Project/task ownership, lifecycle, persistence and cleanup. Profiles: [profiles.md](profiles.md); window mechanics:
[window.md](window.md). Plans and bugs belong in GitHub issues.

## Projects

A project configures repositories/folders, agents and profiles, with ordered defaults. Metadata lives under
`projects/<id>/` in Kulisa data, not the code folder. Its tasks use worktrees; its own folders remain the human's.

- Tasks open as window tabs; projects load while any task is open (`shell.open`, `unloadIdle`, `open-tasks.ts`).
- **The tasks' bar** keeps tab order/width while switching, with project icon, agent state, name and ×. Middle-click
  closes. + creates a task, asking which project if several. Window pages are `task`, `sidebar` or `welcome`
  (`lib/store.ts`), following main-process state without a router.
- **Task menu**: profiles/Manage Profiles, repository add/remove, Rename, Show Folder, move-window actions, Close,
  Delete; project submenu: New Task, Move All, Project Settings, Show Data Folder and Close All.
  Task tabs show no profile count. Project names change in Settings.
- **Settings** edits project Name/Local addresses and Folders/Agents/Profiles sections. Fields save on Enter/blur,
  including page/window exit. Sections add items in place, Esc cancels input; rows share menu/right-click actions.
  Global profile identity belongs to Settings → Profiles, not project membership controls.

**New Project** uses a dedicated [UI module](../src/renderer/components/new-project/README.md) shared by the welcome
and dialog. Its steps, draft lifecycle, discovery table and source controls belong there. Onboarding chooses one
starting account and one source; the core project model continues to support several folders, accounts and profiles.

Project display names are labels, validated independently from physical destination names. Newly named project
roots use 1–64 ASCII characters from A–Z, a–z, 0–9, hyphen, underscore and dot, starting with a letter or digit and
never ending with a dot (the author's choice). Windows device basenames are rejected even with an extension.
`shared/names.ts` owns this check for both the draft and `createProject`; profile names and existing paths retain
their own rules. Existing code stays intact; new folders do not initialize git.

Core multi-folder creation accepts multiple clone URLs as `<location>/<directoryName>/<repo>`. New and cloned
projects require an absent destination, including rejecting empty directories. `folderProblem` owns this policy
for creation and draft checks. Creation reserves the destination with an exclusive mkdir after checking it,
so a newly appeared directory is refused too. Open a folder is the only mode that reuses existing code. Failed
clones remove the root created by that attempt, including completed repositories from a multi-repository clone.
Failed optional core agent/profile additions are logged without discarding an already-created project.

**Project identity** is automatic (`favicons.ts`, `lib/project-color.ts`):

- Search default repository first, then others: tracked/untracked, nonignored `favicon.*`; `icon.*` only under `app/`.
  Plain-folder scans are shallow and exclude hidden/dependency/build/vendor directories. Prefer nearest root, then
  SVG/PNG/ICO, favicon over icon, then name. Search on creation/Settings without blocking; notify only on change.
- Show images up to 128 KB; downscale larger PNG/JPEG to 64 px, otherwise use the curtain. Read dominant colored
  hue on a 32 px canvas with colorthief, rejecting near-black/gray/transparent and under-10% color. Apply Kulisa's
  OKLCH lightness/chroma (0.61/0.12), or saved next-free palette color. Derived hue is not stored.

**Project agents/folders**:

- Accounts can belong to several projects; removing membership keeps running tasks/accounts. Default is first;
  No Default sets `noDefaultAgent`. New tasks with no accounts start a shell.
- Add Folder or Clone uses the user's git/credentials and adds no task copy. Clone beside the default folder;
  reject inaccessible private repositories with Git's error. Removing a folder is refused while tasks reference it.
  Make Default affects new tasks; plain folders remain valid when repositories are added.
- Repository rows bind GitHub accounts by normalized remote; core and UI share failure reasons
  ([GitHub](../src/github/README.md#a-repositorys-account)).

**The sidebar** shows projects last-worked first, expandable task lists, New Task + and project/task menus.
Open tasks precede closed tasks; closed tasks sort by closing time and show branch/time. Click/Enter/Space
shows or reopens; trash/Delete asks before deleting. New Project is at the foot.

**The empty window** docks the sidebar. With no projects, **the welcome** introduces Kulisa and embeds project
creation. Its drawings, responsive layout and lifecycle belong to the
[welcome UI](../src/renderer/components/welcome/README.md). First-start focus goes to Create a project; Back from
creation returns to the introduction. Links/version remain in ☰.

**Windows/startup**:

- TaskView retention, startup layout and native-page handoff: [window.md](window.md#the-grid).
- Move task(s) or drag tabs within/between windows without restarting pages/agents; preserve terminal buffers/size.
  Dropping outside opens a window at release. Moving a sole task elsewhere closes its old window.
- Closing a window asks once about its tasks; last-window quit asks only for working agents. On macOS last-window ×
  hides it while work continues; Dock restores it and ⌘Q quits. Closing the last task leaves one empty window.
- Restore `settings.json` window tabs/order/selection; orphaned open tasks go to the first window. `KULISA_PROJECT`
  chooses an open task, last closed task, or new task of that project.
- Agents launch through the user's project shell; pin account variables on the command. Drop inherited `DIRENV_*`
  at app startup so direnv cannot undo the task environment. Shell-specific launch behavior:
  [terminal](../src/terminal/README.md).

## Tasks

A task owns a branch/worktree when needed, browser copies, Stage environments, development terminals and conversations.
It starts in the project's main working tree with profiles closed; `task_worktree` creates the default repository's
copy before code changes unless the human explicitly wants their folder. With no git/first commit, stay in the
project folder and ask before opening a second competing task.

- One repository: copy beside it as `<repo>@<branch>`. Several: `~/KulisaProjects/<project>@<branch>/<repo>/`.
  Additional copies use the same task branch; plain project folders are supplied directly.
- Read other project repositories freely. Add/remove their task copies only when needed: human task menu or agent
  `task_add_repository`/`task_remove_repository` after conversational agreement. Core asks again only for unpushed
  or uncommitted work when removing (`askRemoveCopy`). The default task folder goes only with the task.
- Give running agents added directories when safe: Claude `/add-dir` immediately except while waiting for the human;
  select its first confirmation choice. Other agents receive a notice after their turn. At restart, Claude/Codex
  get `--add-dir`; Claude reads additional `CLAUDE.md` via its flag. Removed directories remain listed until restart,
  so notify after the turn. Never type notices into a permission question.
- Work returns through requested Git merge/PR; agents must check human uncommitted changes before merging.
- A name is a readable single-line label containing a letter/digit (`labelError`); branches use a unique slug,
  renaming with `git branch -m` and numeric suffixes. Never move the live worktree folder on rename.
- Unnamed tasks show New Task or the first conversation's auto-title; auto-titles are display-only, not stored
  task names/branches. `task_rename` is taught at startup, not injected repeatedly.

Example: `~/IdeaProjects/myshop@task-k3x9q2/` can remain on disk while its branch becomes `checkout-redesign`.

### The Workbench

Names for Workbench, Activity bar, Side bar, Main pane and their items: [UI terminology](ui.md#workbench-terminology).
The Activity bar and Side bar share a Dockview edge group fixed left of Main pane. Clicking the selected Activity
bar item collapses the Side bar; another reopens it at saved width. Task layout saves the selected item, collapse
state and shared expanded width. The active item selects Main pane independently of the Side bar's collapse state.
Agents restores the selected terminal; Diff restores its comparison, filter and review view. Project and Artifacts
have separate placeholders; their existing desktop opening actions remain available.

- Expanded minimum width is 300 CSS px; collapsed width is 40 px. Development minimum height is 204 px to keep
  controls reachable. Empty development terminals: [window.md](window.md#the-terminal).
- **Agents**: named agent/shell rows with state/account/command. Icon returns to the last development terminal;
  row selection shows/focuses it. + uses the shared launch menu; × asks for agents, closes shells
  immediately. Agent menu: Change agent, New Conversation, Close.
- **Project**: initially selected Activity bar item; [Project Explorer](../src/project-explorer/README.md) browses task resource roots.
  Core supplies roots, protected desktop opening and repository actions. Root click expands, double-click opens in
  the OS; added copies have remove actions, main/default task folder does not.
- **Artifacts**: newest-first screenshots/snapshots/request-response bodies/terminal text, with source, time and
  size derived from files/metadata (`artifacts.ts`). Create thumbnails serially in main, cache while task loaded,
  and send list updates asynchronously so large images do not delay agent launch.
- Artifact click opens; menu opens/reveals/sends/deletes. Send uses `Task.sendArtifact` with shell-quoted path,
  no Enter. Hover/focus trash deletes one; heading trash deletes all. Drag uses native file drag after
  `Task.findArtifact` validation. Figures come from `Task.artifactsUsage` ([activity monitor](../src/activity-monitor/README.md)).
  `task_artifacts` lists files/totals; `task_artifacts_delete` deletes only its own task's files, without confirmation.

`tasks.json.resources` is authoritative: first resource determines working folder/branch/copy-root; never duplicate
these fields. `maintree` is human-owned and never deleted; task-created `worktree` resources follow task cleanup.

#### Diff

[Diff](../src/diff/README.md) reviews task resources through `Task.diff`, `diffTargets`, `review`, `diffContents`,
with starting commits and ownership checks. Its TaskView owns the selection/session: task switching preserves the
comparison, filter, document and scroll position. Switching Activity bar items releases Diff's document and query
data, keeping only the selection and lightweight review view state in the task's controller. Returning reads current
Git data and restores the comparison, filter, review layout, collapsed diffs and scroll position. Collapsing the
Side bar leaves Main pane and its review intact. Closing the task releases the session and navigation; restarting
starts at the first repository/default comparison with an empty filter and document start. Returning to a terminal
preserves Stage. Loading and polling: [Diff](../src/diff/README.md).

## What the human does

- Create through bar +, Ctrl+Shift+N or project New Task. Start the default agent, launchers if no default,
  or a shell with no configured agents. Profiles remain closed to avoid unnecessary browser processes.
- Switch by tab; other tasks keep running. ×/middle-click/Close stops agents/pages and preserves code, branches,
  profile copies and conversations for reopening; ask only for working agents.
- Delete asks what work/sign-ins/history disappear. Human project folders remain untouched.
- Agents + opens another conversation or shell. Change agent hands over work as described below.

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
| Browse a task’s folders, open a file | Project in the Side bar; double-click or Enter on a file, its Open menu | the agent reads and opens files through its own tools | `task:file:list`, `task:file:open` (`Task.files`, `Task.openProjectFile`; Project Explorer confines reads to its roots) |
| Review local code changes | Diff Activity bar item, continuous file diffs; Unified or Split | the agent reads its Git repository through its own tools | `task:diff:list`, `task:diff:targets`, `task:diff:review`, `task:diff:contents` (`Task.diff`, `Task.diffTargets`, `Task.review`, `Task.diffContents`) |
| Open a resource's folder | double-click its root in the Side bar, or Open Folder in its menu | none: the agent opens folders through its own tools | `task:open-folder` (`ipc/tasks.ts`) |
| Open an artifact, show it in its folder | a click on its Side bar item, its menu | none: the tools' answers give the agent its path | `file:open`, `file:show` (`file-links.ts`) |
| See what the artifacts take | the Artifacts heading in the Side bar (the shown task's) | `task_artifacts`: its task's files, or each task's total | `Task.artifactsUsage` (src/activity-monitor) |
| Send an artifact to the agent | Send to Agent in its row’s or screenshot thumbnail’s menu; drag onto a terminal | none: preparing the human’s next message | `Task.sendArtifact`; terminal file drop |
| Delete artifacts | a row's 🗑 or Delete in its menu; the heading's 🗑, all | `task_artifacts_delete`: some or all of its task's | `Task.deleteArtifacts` |
| Make the task's worktree | none: its agent makes it before writing code | `task_worktree` | `Task.makeWorktree`, `Project.ensureWorktree` |
| Add, clone, make the default, remove a project's folder | the project's page | none: what the project is made of is the human's | `addFolder`, `cloneRepo`, `defaultFolder`, `removeFolder` (`projects.ts`) |
| Add a project's repository to a task | Add Repository in its tab's menu | `task_add_repository`, once the human agreed in the conversation | `Task.addRepository`, `Project.addCopy` |
| Remove one added | Remove Repository in its tab's menu, or on its chip | `task_remove_repository`, once the human agreed | `Task.removeRepository`, `Project.askRemoveCopy`, `removeCopy` |
| Add, make the default (or none the default), remove an agent of the project | the project's page | none: what the project is made of is the human's | `addAgent`, `defaultAgent`, `removeAgent` (`projects.ts`) |
| Make an account of an agent | Connect in New Project or Settings → Agents; New Account… on a project's page | none: signing in is the human's (Rules) | `Accounts.signIn` (`accounts.ts`) |
| Delete or disconnect an account | its menu in Settings → Agents | none: it deletes a sign-in and conversations, the human's to decide | `deleteAccount` (`projects.ts`), `shell.dropAccount` |
| Connect an external agent configuration | Use existing setup in New Project or Settings → Agents | none: account configuration and sign-in are the human's | `Accounts.connectExisting` (`accounts.ts`) |
| Add a GitHub account, sign it in again, delete it | Settings → GitHub | none: signing in is the human's (Rules) | `GitHub.startFlow`, `addToken`, `deleteGitHub` (`projects.ts`; [src/github](../src/github/README.md)) |
| Choose a repository's GitHub account | its row on the project's page | none: what the project is made of is the human's | `setGitHub` (`projects.ts`) |
| Open an agent in the task, a new conversation | the terminals' +, New Conversation (a terminal's Side bar item menu), Ctrl+` on the folded terminals | none: which agents work is the human's | `Task.openAgent`, `newConversation` |
| Hand the task to an agent, the work kept | Change agent… in the agent's Side bar item menu | none: the human's choice | `Task.handOver` |
| Close an agent's terminal | × on its Side bar item, Close in its menu (asked first) | none: it would stop another agent | `Task.closeTab` |
| Name an agent's conversation (its Side bar item) | none: the agent knows what it is about | `conversation_rename` | `Task.nameConversation` |

## Choosing the agent

Project accounts choose Claude Code, Codex or a plain terminal; unknown CLIs can run manually with `KULISA_MCP_URL`.
Never assume any agent is installed. `Accounts` in `accounts.ts` owns discovery/cache, installation, configuration
records and sign-in lifecycle, shared by New Project and Settings. Window handles supply project membership and
eligible task choices; [Kulisa plugin adapters](../src/kulisa-plugin/README.md#agent-adapters) own CLI-specific
operations and transcripts. Renderer `lib/agents.ts` and `lib/agent-setup.ts` share list/install and discovery state.

- New tasks use their saved initial agent. With no default, show launchers; with no accounts, start a shell.
  Missing agents/accounts open Choose the Agent with Install/Cancel. `KULISA_AGENT` forces a command without asking.
- Settings → Agents shows version/path, installation and accounts. Cache the latest 256 agent/folder results in
  main memory, show them immediately, then refresh through the user's login shell/`--version`; first lookup waits.
  Probe each CLI once per list even when several accounts use it. Windows discovery uses
  `where.exe` and runs `.cmd` via `cmd.exe`.
- Connections explicitly record configuration ownership in `agents.json`. Records without an origin retain their
  existing Kulisa-owned behavior. **Created in Kulisa** starts with an empty, immutable folder
  (`agents/<agent>-<six-character id>/`); macOS keychain identity depends on its path, so never rename it.
  **External configuration** references the adapter's existing home/environment-selected directory directly, with
  its login, settings and skills shared with ordinary CLI sessions. Never copy configurations or credentials.
- `Accounts.existing` checks the installed CLI's native authentication status during discovery and again before
  connection; installed alone is insufficient. Only metadata/email reaches the window. Same directory/mode reuses
  its connection, including directory aliases; reject managed storage even through an alias. Discovery returns
  the matching account ID so the table does not confuse configurations by path alone.
  The same email in external and owned configurations does not merge them. Preserve whether the
  configuration override was absent: explicitly setting Claude's default directory changes its metadata location.
  Terminal pinning supports absent variables so shell startup cannot accidentally select another account.
- Fresh sign-in runs native CLI authentication in `SignIn.tsx`; Details stays closed unless failure. The system
  browser receives sign-in with no `BROWSER` override. Duplicate email reuses an owned account and removes the new,
  signed-out folder. Reserve cancellation before discovery/terminal startup; failure or cancellation removes the
  new folder and stops a terminal created after cancellation. Completed connections outlive project drafts.
- Projects reference account IDs in order. Removing membership/deleting a project keeps accounts. Settings refuses
  removal while open/closed task terminals use them, then confirms: owned accounts sign out and delete their folders;
  external accounts disconnect only, preserving credentials, settings, conversations and other CLI sessions.
- Settings shows each account's origin and selectable configuration directory, with Open Folder / Copy Path, distinct
  from the installed executable path. Kulisa installs skills, persists language, carries trust and cleans native
  conversations only in owned configurations. External sessions receive the same MCP/hooks/instructions at launch,
  leave native trust prompts to the CLI, and retain their native histories/settings. Hidden dictation may use an
  external connection only if it already trusts Kulisa's dictation folder; otherwise report the prerequisite before
  starting a hidden process. Never grant it trust or delete its history/configuration. Kulisa's own dictation
  workspace is still removed. Agent CLIs themselves may update their shared configuration during ordinary use.
- Adapters receive the task's Kulisa-owned data directory for generated launch files, independent of account
  configuration ownership. Claude's `--settings` names `claude-settings.json` there, keeping JSON out of the terminal
  command. One file per task is refreshed at launch and removed with task/project data, including deferred removal
  of locked files; no generated launch files are written to external configurations.
- Dialogs share state outside mounted content so installation continues during navigation; no extra window process.
- Hook state comes from the [plugin](../src/kulisa-plugin/README.md#hooks). Viewing a done agent in the focused task
  marks it `seen` and clears its badge, not its internal done state. Unsupported agent state: #212.

Dictation: [package](../src/dictation/README.md). Language: [window.md](window.md#language).

## What each agent can do

The [Kulisa plugin](../src/kulisa-plugin/README.md#agent-adapters) checks that each agent supports a capability or names its gap.

| Capability | What the human gets | Claude Code | Codex |
|---|---|---|---|
| `config` | accounts: several sign-ins side by side, each its own folder | `CLAUDE_CONFIG_DIR` | `CODEX_HOME` |
| `skills` | the Kulisa skill: how to work with Kulisa | its account's `skills/kulisa/` | its account's `skills/kulisa/` |
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
| `imagePaste` | a clipboard image pasted with the OS's shortcut or Paste menu | Ctrl+V (Alt+V on Windows) | Ctrl+V |
| `language` | ☰ → Language: the language it dictates and answers in | its `language` setting | none |

## Several agents in a task

`Task.developmentTerminals` holds shells and agents; each agent has a stable conversation ID, account/session,
name and timing in `task.json`. Agents share code/profiles. + always starts a new conversation, told no handoff;
the human may want parallel work rather than continuation.

- Each terminal gets its own MCP/hook URLs under `/task/<project>/<task>/t/<id>/`, with environment variables.
  Hooks report its own state/session. Task badge priority: waiting, working, unseen done.
- `conversation_rename` names rows in 1–3 words; fallback is auto-title or agent name/number.
- **Change Agent** (`HandOver.tsx`) shows source/target, what transfers (branch, profiles/tabs, shells, conversation)
  and what does not (hidden reasoning, permissions, account settings). Target accounts include the same agent afresh.
- Hand over starts a foreground terminal at its real size with a request to read conversation N fully using
  `task_history`, then report progress/next steps. The dialog tracks actual parts via `historyRead`; it closes at
  completion, human-wait, target disappearance, 30 s without progress, or Show now/×. The old agent stays open.
- New Conversation starts fresh without instructions. Closing agents always asks and preserves history; shells close
  immediately. Restart restores row order/active terminal, resumes agents and starts fresh shells.
- `shell_run/read/stop` act only on shells, never another agent's prompt. Task deletion forgets all conversations.

History is read from native transcripts, lightly cut rather than mechanically summarized or converted between CLI
formats. This preserves details and works when the old agent's quota is exhausted. CLI quota cannot be queried
reliably; the new agent's first answer reveals availability. Kulisa never initiates account handoffs to evade limits.
Handoff gaps: #93; transcript rules: [transcripts.md](transcripts.md).

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
                                  conversations; Kulisa's shared skill (skills/kulisa/); gone, signed out first, when the human deletes it (Settings →
                                  Agents); one a sign-in left
                                  unfinished (Kulisa quit meanwhile) goes at the next start
dictation/                        the folder the hidden session runs in (src/dictation: another agent's dictation
                                  recognizing for one without), empty; it and what that session kept of it in its
                                  account (its conversation, its trust) go when the session ends, or at the next start
settings.json                     the Kulisa zoom, the theme, where the tasks' bar is, Follow agent, the language; the windows: each one's
                                  tasks by key (in the bar's order), the one shown, where it was
logs/kulisa.log                   what happened and who asked (window.md, The log), for a bug report; at 1 MB it becomes
logs/kulisa.old.log               kulisa.old.log and a new one starts: 2 MB at most
Crashpad/                         Electron's crash dumps (crashReporter, no server; window.md, The log), to ask a user for
                                  after a crash; Crashpad prunes them itself (90 days, 128 MB)
deleted-folders.json              folders to remove at the next start (a session keeps its files open)
projects/<project id>/            a project's data, by its id (projects.json), gone with the project
  tasks.json                      { list: [{ id, name, named, resources, closedAt }] }; name "New
                                  Task" and named unset until it is named; resources what it has, the first where it
                                  works: { kind: "maintree", folder } (the project's folder it opened in) until its own
                                  { kind: "worktree", repo, worktree, branch, base, folder } takes its place, then the
                                  worktrees of repositories it added; base: the commit a worktree started from. Its
                                  folder, branch and folder of copies are its resources' (store.ts)
  <task id>/                      a task
    claude-settings.json          Claude's launch settings for Kulisa (plugin permissions, hooks, voice), refreshed
                                  at launch; shared by its Claude terminals, gone with the task
    task.json                     versioned task state, owned by TaskStore: agents (initial choice and conversation
                                  metadata with stable IDs), development (open tabs and active tab), stage (profile
                                  settings, CLI launch setup, next terminal ID, view and Dockview layout), workspace
                                  (development layout, Stage position and native outer split). Terminal conversation references
                                  use stable IDs; history numbers follow conversation order. Live processes and screen
                                  buffers stay in memory. File and owned environment data go with the task/project.
    artifacts/                    what the human or agent keep of its environments: a snapshot
                                  or a body too large for an answer, a screenshot; <n>-<profile id>-<tab id>-<kind>, n in
                                  the order made; Stage terminal text: <n>-terminal-<id>-terminal.txt; never replaced,
                                  past 100 MB the oldest go; kept with the task
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
| The task's branch | each repository (`git branch`) | making a worktree; renamed with the task |
| git's worktree record | `<repo>/.git/worktrees/<copy>/` | making a worktree |
| A cloned repository | `<location>/<name>/`, or `<location>/<name>/<repo>/` for several (New Project, Clone from URL); `~/KulisaProjects/<project>/<repo>/` or next to the project's folder (Clone on its page) | cloning; stays, as the human's (removing it from the project, or the project, leaves it) |
| direnv's permission for the task's `.envrc` | direnv's data (`~/.local/share/direnv/allow/`) | making a worktree, if the project's is allowed |
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
  `deleted-folders.json`): every accessible file goes at once, including artifacts; a file held open and its parent
  folders go at the next start (`removeTree` visits siblings before reporting an error);
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
- Each window shows one task; other tasks' agents/pages keep running. Renderer retention: [window.md](window.md#the-grid).
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

- Task worktrees protect the human's folder and stay visible beside it. Separate conversations avoid carrying
  another task's unfinished assumptions. × preserves resumable work; Delete explicitly removes it.
- Worktree folders stay fixed while labels/branches change. Kulisa never initializes git automatically: it could
  capture secrets or nest repositories.
- Profile masters supply sign-ins; task copies isolate local-app sessions. Ports preserve cookies; alternate hosts
  would lose them. The agent chooses free ports and manages database/container isolation, reporting fixed-port conflicts.
- Fixed IDs keep paths stable across renames. Chrome-shaped storage supports existing Chromium knowledge.
- Lazy task loading avoids restoring unused processes and starts agents at real terminal sizes. Restore layout
  without waiting for programs/sites; launch agents after profiles and repository checks are ready.
- Background tasks keep working; unused browser tabs discard later. Moving between windows transfers native views
  and serialized terminal buffers, not sessions. Each open window costs one renderer.
- Extend only positive trust decisions. Unknown CLI config formats remain untouched; concurrent CLI rewrites can
  undo Kulisa's atomic trust write, safely causing another prompt.

## The code

- `src/main/app.ts`, `open-tasks.ts`: startup and serialized task/window lifecycle.
- `src/main/projects.ts`, `tasks.ts`: domain actions, ownership and questions. `worktrees.ts`: Git/copy/direnv
  mechanics; `stage-terminals.ts`: Stage launch state through its host contract; `store.ts`: task documents.
- `src/main/accounts.ts`: account ownership, discovery/cache, installation and sign-in cleanup; `recognizer.ts`
  selects an account for dictation. CLI-specific behavior belongs in
  [Kulisa plugin](../src/kulisa-plugin/README.md); terminal runtime in [terminal](../src/terminal/README.md).
- `src/main/ipc/`: thin window handles. Workbench item actions use task-scoped actions and resource roots.
- Renderer task navigation lives in `components/`. `components/welcome/Welcome.tsx` owns the first-start screen,
  examples and assets; the [new-project UI module](../src/renderer/components/new-project/README.md) owns creation
  and its draft behind `index.tsx`.
  Project/account configuration lives in `components/settings/`; shared non-UI coordination in `lib/`.
  `favicons.ts`/`lib/project-color.ts` derive project identity.
- `src/shared/names.ts`: labels, names and branch slugs. Renderer `task-view/` owns retained screens, grids and activation.
- Coverage: task/project/account/repository/window e2e files; store/task-document/accounts/agent-management/worktrees unit tests.

Task state uses Zod schemas for stored field shapes and TypeScript types, with core checks for unique IDs,
conversation links and Stage setup. Validation retains unknown metadata; each section update reads the current
document, preserves its peers and writes atomically. Dockview owns serialized layout formats.
Layout changes are debounced and flushed when leaving the task; pruning closed panes preserves the active group when it survives. A new task retains uninitialized
profiles/development separately from deliberately empty collections. Legacy task files are imported only when
`task.json` is absent; a verified document is authoritative, and leftover source files are cleaned on reopening.
Malformed source data stops migration with an error and retains the source files. Browser storage, profile tabs,
transcripts and artifacts keep their own formats and owners.

Task indexes use `closedAt` as the closed-state marker; absence means open, and zero means a closed task whose
closing time is unknown. Task documents use format version 2, flat Stage items and `profilesInitialized` to preserve
first-load behavior independently of terminal environments. Each TaskStore cleans legacy files once, after the
current document is validated; a new store retries cleanup left incomplete by an error.
