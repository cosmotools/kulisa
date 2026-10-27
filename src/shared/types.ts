import type { GitHubKind, RepoGitHub } from '../github/ipc.ts';

// What the main process sends the window (window.ts, profiles.ts, tasks.ts), as the window uses it: the one
// definition, which the main process's answers are typed with too; the channels it comes by: ipc.ts.

// A page's alert or confirm (profiles.ts, Profile._dialog), shown in its pane.
interface PageDialog { id: number; type: 'alert' | 'confirm'; message: string; from: string; picture: string | null }
interface Tab {
  id: string; title: string; url: string; favicon: string | null; loading: boolean; canBack?: boolean; canFwd?: boolean;
  zoom: number; dialog?: PageDialog | null;
}
// An open profile of the shown task (Profile.info).
export interface Profile {
  id: string; name: string; avatar: string; description: string | null; login: string | null;
  hasPassword: boolean; active: string | null; signinMode: boolean; tabs: Tab[];
}
// A closed one (window.ts, pushState): tabs is how many it had.
export interface ClosedProfile { id: string; name: string; avatar: string; description: string | null; tabs: number }
type AgentState = 'working' | 'waiting' | 'done' | null;
// A tab of the task's island (Task.terminalsInfo): a shell (the human's, or what the agent runs: by, its command) or an
// agent (its account; cli: its agent, for its icon), with its state.
export interface Terminal {
  id: number; name: string; command: string; by: 'human' | 'agent'; state: AgentState;
  agent: { account: string; cli: string; name: string } | null;
  starting: boolean; // its program not started yet (an agent's looked for): a loader in its place
}
// The island: its tabs in order, the one in front (none: no terminal, the island folded to its +).
// Kulisa's language (☰ → Language): the codes the agents' own settings take, and which agents have one.
export interface LanguageInfo { language: string; languages: string[]; agents: { name: string; has: boolean }[] }
export interface Terminals { task?: string; front: number | null; list: Terminal[] }
// Something the task has, uses or created, a row in the Resources island (Resources.tsx): a repository's worktree, or
// the main working tree it works in before it makes one. More kinds come over time (the app's URL, a pull request).
export interface TaskResource {
  kind: 'worktree' | 'maintree';
  label: string; // the repository's name
  folder: string; // the folder to open
  branch: string | null; // a worktree's branch; none for the main working tree
  removable: boolean; // an added repository's worktree (task_remove_repository); not the task's own or the main tree
}
// A task, for its tab (Task.info).
// A file the agent's tools kept of a page (kulisa-plugin/artifacts.ts), as the Resources island lists it.
export interface Artifact {
  file: string;
  profile: string; // the id of the profile it came from
  kind: string; // screenshot, snapshot, request or response (a body)
  time: number;
  bytes: number;
  thumb: string | null; // a screenshot's small picture, a data: URL
}
export interface TaskInfo {
  id: string; key: string; project: string; name: string; state: AgentState; folder: string; branch: string | null;
  closed: boolean; merged: boolean;
  repos: string[]; // the project's repositories it may add (Add Repository)
  resources: TaskResource[]; // what the task has/created (Resources.tsx)
}
export interface ProjectEntry { id: string; name: string; folders: string[]; color: string; favicon?: string; tasks: ProjectTask[] }
// A task of a project, open or not (app.ts, shell.projects): the sidebar lists the closed ones.
export interface ProjectTask { id: string; name: string; branch?: string | null; closed: boolean; closedAt?: number; merged: boolean }
// The window's tasks' bar (AppWindow.info): every project, the window's tabs in the bar's order, the shown task (its
// key) and its project (its id), the loaded projects' agents (the island's +), the other windows (Move to Window).
export interface ProjectsInfo {
  current: string | null;
  project: string | null;
  projects: ProjectEntry[];
  tabs: TaskInfo[];
  open: { id: string; agents: { id: string; name: string; cli: string }[] }[];
  windows?: { id: number; name: string }[];
  // Anything for Settings to show: a project, an account or a profile. None at the first start: no gear (components/TopBar.tsx).
  settings: boolean;
}
// The projects' manager (main/ipc/projects.ts): what a project may be, its folders, its profiles, its configuration.
// agents: every account (main/accounts.ts); clis: the agents a new account can be made of.
// An agent's account (Settings → Agents: main/app.ts, accounts:list), with the names of the projects it is in.
// A profile in Settings → Profiles (main/ipc/profiles.ts): who it is, its test login (never its password), its projects.
export interface SettingsProfile { id: string; name: string; avatar: string; description: string; login: string; hasPassword: boolean; projects: string[] }
export interface Account { id: string; agent: string; name: string; email: string | null; projects: string[] }
export interface AccountsInfo { accounts: Account[]; clis: string[] }
// What a new account's sign-in answers (components/SignIn.tsx): the project's agents, made in one; else every account.
// One of a project's agents (Settings, a project's page): an account (its agent, its email) or the terminal only.
export interface ProjectAgent { id: string; name: string; agent: string; cli: string; email: string | null; default?: boolean }
export interface SignedIn extends Partial<AccountsInfo> { agents?: ProjectAgent[] }
// A new project's agents (accounts, the default first) and profiles (made in it, or taken from the others): New Project's steps.
export interface NewProjectSetup { agents?: string[]; profiles?: ({ id: string } | { name: string; description?: string })[] }
export interface ProjectChoices { agents: { id: string; name: string }[]; clis: { id: string; name: string }[] }
export interface ProjectFolder { folder: string; git: 'ok' | 'none' | 'no-commit' }
// Its repositories' GitHub accounts (projects.ts, githubOf: src/github): each one's remote by its key (null: no git or
// no origin), what it is to the accounts; the accounts to choose from.
export interface ProjectGitHub {
  repos: (RepoGitHub & { folder: string; remote: string | null })[];
  accounts: { id: string; login: string; kind: GitHubKind }[];
}
export interface ProjectProfile { id: string; name: string; avatar: string; description?: string; also: string[] }
export interface ProjectSettings extends ProjectChoices {
  name: string; local?: string[]; folders: ProjectFolder[];
  projectAgents: ProjectAgent[]; profiles: ProjectProfile[]; others: ProjectProfile[];
}
// Kulisa's keyboard shortcuts (main/keys.ts), as this OS shows them.
export interface Shortcut { id: string; group: string; label: string; keys: string[]; hold?: boolean } // hold: a key held alone, the human may change it
// A question from the main process (shell.ask) or the window.
// link: a page the answer may need, under the detail (opened in the user's browser).
export interface Question { message: string; detail?: string; ok?: string; other?: string; cancel?: string; danger?: boolean; link?: { url: string; label: string } }
// An agent or account in a list to choose from or install (main/ipc/agents.ts; renderer's lib/agents.ts).
export interface AgentInfo {
  id: string; name: string; maker?: string; needs?: string; site?: string; install?: string | null; installed?: boolean;
  account?: string | null; agent?: string; path?: string | null; onPath?: boolean | null; version?: string | null;
}
// About Kulisa (components/AboutPage.tsx): the versions and the folders Kulisa writes in, each with whether it is there yet.
export type AboutFolder = 'data' | 'projects' | 'program';
export interface AboutInfo { version: string; electron: string; chrome: string; folders: { id: AboutFolder; path: string; exists: boolean }[] }
// The log as the Log page reads it (main/log.ts, readLog): the file's text and size, its limit, when the old one is from.
export interface LogInfo { text: string; size: number; max: number; old: string | null }
