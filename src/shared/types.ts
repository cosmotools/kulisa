// What the main process sends the window (window.ts, profiles.ts, tasks.ts), as the window uses it: the one
// definition, which the main process's answers are typed with too; the channels it comes by: ipc.ts.

// A page's alert or confirm (profiles.ts, Profile._dialog), shown in its pane.
interface PageDialog { id: number; type: 'alert' | 'confirm'; message: string; from: string; picture: string | null }
interface Tab {
  id: string; title: string; url: string; favicon: string | null; loading: boolean; canBack?: boolean; canFwd?: boolean;
  zoom: number; dialog?: PageDialog | null;
}
// An open profile of the shown task (Profile.info): key is its folder, stable across renames.
export interface Profile {
  key: string; id: string; name: string; avatar: string; description: string | null; login: string | null;
  hasPassword: boolean; active: string | null; signinMode: boolean; tabs: Tab[];
}
// A closed one (window.ts, pushState): tabs is how many it had.
export interface ClosedProfile { key: string; id: string; name: string; avatar: string; description: string | null; tabs: number }
type AgentState = 'working' | 'waiting' | 'done' | null;
// A tab of the task's island (Task.terminalsInfo): a shell (the human's, or what the agent runs: by, its command) or an
// agent (its account; cli: its agent, for its icon), with its state.
export interface Terminal {
  id: number; name: string; command: string; by: 'human' | 'agent'; state: AgentState;
  // about: what its role does, '' when not said; models: those its agent offers; model: the one it runs with (null: the agent's own)
  agent: { account: string; cli: string; name: string; about: string; models: Model[]; model: string | null } | null;
  starting: boolean; // its program not started yet (an agent's looked for): a loader in its place
}
// The island: its tabs in order, the one in front (none: no terminal, the island folded to its +).
// Kulisa's language (☰ → Language): the codes the agents' own settings take, and which agents have one.
export interface LanguageInfo { language: string; languages: string[]; agents: { name: string; has: boolean }[] }
// closed: its conversations no tab has open, to go on with (Task.closedConversations), the one closed last first;
// unsure: its session not known, so the agent may go on with another of its own (Codex's resume --last).
export interface ClosedConversation { i: number; name: string; account: string; cli: string; closedAt: number; unsure: boolean }
export interface Terminals { task?: string; front: number | null; list: Terminal[]; closed: ClosedConversation[] }
// A task, for its tab (Task.info).
export interface TaskInfo {
  n: number; key: string; project: string; name: string; state: AgentState; folder: string; offset: number; branch: string | null;
  closed: boolean; merged: boolean; about?: string; // what it is about while it has no name: its first prompt
  repos: string[]; // the project's repositories it may add (Add Repository)
  copies: { name: string; folder: string; branch: string }[]; // its copies of the project's repositories (TaskRepos.vue)
}
export interface ProjectEntry { id: string; name: string; folder: string; color: string; favicon?: string; tasks: ProjectTask[] }
// A task of a project, open or not (app.ts, shell.projects): the bar's + lists the closed ones (NewTask.vue).
export interface ProjectTask { n: number; name: string; branch?: string | null; closed: boolean; closedAt?: number; merged: boolean; about?: string }
// The window's tasks' bar (AppWindow.info): every project, the window's tabs in the bar's order, the shown task (its
// key) and its project (its id), the loaded projects' agents (the island's +), the other windows (Move to Window).
export interface ProjectsInfo {
  current: string | null;
  project: string | null;
  projects: ProjectEntry[];
  tabs: TaskInfo[];
  // agents: the accounts its team plays (Change Agent); roles: its team (the island's +), its name '' when not said.
  open: { id: string; agents: { id: string; name: string; cli: string }[]; roles: { id: string; account: string; name: string; role: string; about: string; cli: string }[] }[];
  windows?: { id: number; name: string }[];
  // Anything for Settings to show: a project, an account or a profile. None at the first start: no gear (TopBar.vue).
  settings: boolean;
}
// The projects' manager (main/ipc/projects.ts): what a project may be, its code, its profiles, its configuration.
// agents: every account (main/accounts.ts); clis: the agents a new account can be made of.
// An agent's account (Settings → Agents: main/app.ts, accounts:list), with the names of the projects it is in.
// A profile in Settings → Profiles (main/ipc/profiles.ts): who it is, its test login (never its password), its projects.
export interface SettingsProfile { id: string; name: string; avatar: string; description: string; login: string; hasPassword: boolean; projects: string[] }
export interface Account { id: string; agent: string; name: string; email: string | null; projects: string[] }
export interface AccountsInfo { accounts: Account[]; clis: string[] }
// What a new account's sign-in answers (AccountSignIn.vue): the project's team, made in one; else every account.
// A role of a project's team (Settings, a project's page): its id, its name and what it does (the human's words, ''
// when not said), and the account playing it (its id, its name, its agent, its email) or the terminal only.
// A branch a new task can work on (New Task from a Branch…): its name, only on the remote, its last commit (ms) and its subject.
export interface Branch { name: string; remote: boolean; at: number; subject: string }
// One of the models an agent offers (main/agents/agent.ts, model): what it is started with, its name, a line of it.
export interface Model { id: string; name: string; about?: string }
// The OS a role works on (#49: a builder on Linux, a checker on macOS); none: any.
export type Os = 'linux' | 'macos' | 'windows';
// place: where it is kept (issue #112): the repository's file, the same on every computer, or this computer; account
// '' for one of the file nobody plays here yet, players: the accounts of its agent that may.
export interface ProjectRole {
  id: string; role: string; about: string; account: string; name: string; agent: string; cli: string; email: string | null; default?: boolean;
  model: string | null; models: Model[]; // the model it starts with (null: the agent's own), those its agent offers
  place: 'project' | 'computer'; players: { id: string; name: string }[]; os: Os | null;
}
// A task of the project on another of the human's computers (partners.ts: its card), that this one has none of.
export interface TaskElsewhere { name: string; branch: string; at: number; computers: { name: string; os: Os; roles: string[] }[] }
// The project's file (.kulisa/project.json): where it is (none: its code not in git), there or not, whether a new role
// may go there, whether its team is used (null: not asked yet).
export interface RepoTeam { file: string | null; exists: boolean; can: boolean; used: boolean | null }
export interface SignedIn extends Partial<AccountsInfo> { team?: ProjectRole[] }
// A new role: its account, its name and what it does (New Project's step Team, + on a project's page).
export interface NewRole { account: string; role?: string; about?: string; place?: 'project' | 'computer' } // place: none, the file when it can
// A new project's team (the first the role a task starts with) and profiles (made in it, or taken from the others): New Project's steps.
export interface NewProjectSetup { team?: NewRole[]; profiles?: ({ id: string } | { name: string; description?: string })[] }
export interface ProjectChoices { agents: { id: string; name: string }[]; clis: { id: string; name: string }[] }
// github: its repository on GitHub (owner/name; none: its remote is not GitHub's), the account its agent's GitHub work
// goes as (chosen: by the human, else the one suggested; null: none reaches it), and that account's login.
export interface ProjectRepo { folder: string; git: 'ok' | 'none' | 'no-commit'; github?: { repo: string; account: string | null; login: string | null; chosen: boolean } }
export interface ProjectProfile { id: string; name: string; avatar: string; description?: string; also: string[] }
export interface ProjectSettings extends ProjectChoices {
  name: string; folder: string; local?: string[]; repos: ProjectRepo[]; former?: string | null;
  team: ProjectRole[]; repoTeam: RepoTeam; profiles: ProjectProfile[]; others: ProjectProfile[];
}
// Kulisa's keyboard shortcuts (main/keys.ts), as this OS shows them.
export interface Shortcut { id: string; group: string; label: string; keys: string[]; hold?: boolean } // hold: a key held alone, the human may change it
// A question from the main process (shell.ask) or the window.
export interface Question { message: string; detail?: string; ok?: string; other?: string; cancel?: string; danger?: boolean }
// An agent or account in a list to choose from or install (main/ipc/agents.ts; renderer's lib/agents.ts).
export interface AgentInfo {
  id: string; name: string; maker?: string; needs?: string; site?: string; install?: string | null; installed?: boolean;
  account?: string | null; agent?: string; path?: string | null; onPath?: boolean | null; version?: string | null;
}
// About Kulisa (settings/AboutPage.vue): the versions and the folders Kulisa writes in, each with whether it is there yet.
export type AboutFolder = 'data' | 'projects' | 'program';
export interface AboutInfo { version: string; electron: string; chrome: string; folders: { id: AboutFolder; path: string; exists: boolean }[] }
// The log as the Log page reads it (main/log.ts, readLog): the file's text and size, its limit, when the old one is from.
export interface LogInfo { text: string; size: number; max: number; old: string | null }
// A task's dictation (Task.voice): its agent has one, and whether it records; null: none.
export interface Voice { recording: boolean }
