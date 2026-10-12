// What the main process sends the window (window.ts, profiles.ts, tasks.ts), as the window uses it: the one
// definition, which the main process's answers are typed with too.

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
  agent: { account: string; cli: string; name: string } | null;
}
// The island: its tabs in order, the one in front (none: no terminal, the island folded to its +).
export interface Terminals { task?: string; front: number | null; list: Terminal[] }
// A task, for its tab (Task.info).
export interface TaskInfo {
  n: number; key: string; name: string; state: AgentState; folder: string; offset: number; branch: string | null;
  closed: boolean; merged: boolean; about?: string; // what it is about while it has no name: its first prompt
}
export interface ProjectEntry { id: string; name: string; folder: string; color: string; icon?: string; favicon?: string; tasks: ProjectTask[] }
// A task of a project, open or not (app.ts, shell.projects): the bar's + lists the closed ones (NewTask.vue).
export interface ProjectTask { n: number; name: string; branch?: string | null; closed: boolean; merged: boolean; about?: string }
// The window's projects (AppWindow.info): every project, those open in it in the bar's order, the one shown.
export interface ProjectsInfo {
  current: string | null;
  projects: ProjectEntry[];
  open: { id: string; task?: string | null; collapsed?: boolean; tasks?: TaskInfo[]; agents?: { id: string; name: string; cli: string }[] }[];
  elsewhere?: string[];
  windows?: { id: number; names: string[] }[];
}
// The projects' manager (app.ts, project:*): what a project may be, its code, its profiles, its configuration.
// agents: every account (main/accounts.ts); clis: the agents a new account can be made of.
// An agent's account (Settings → Agents: main/app.ts, accounts:list), with the names of the projects it is in.
// A profile in Settings → Profiles (app.ts, profiles:list): who it is, its test login (never its password), its projects.
export interface SettingsProfile { id: string; name: string; avatar: string; description: string; login: string; hasPassword: boolean; projects: string[] }
export interface Account { id: string; agent: string; name: string; email: string | null; projects: string[] }
export interface AccountsInfo { accounts: Account[]; clis: string[] }
// What a new account's sign-in answers (AccountSignIn.vue): the project's agents, made in one; else every account.
export interface SignedIn extends Partial<AccountsInfo> { agents?: { id: string; name: string; default?: boolean }[] }
export interface ProjectChoices { colors: string[]; icons: string[]; agents: { id: string; name: string }[]; clis: { id: string; name: string }[]; pictures?: Record<string, string>; color?: string; icon?: string }
export interface ProjectRepo { folder: string; git: 'ok' | 'none' | 'no-commit' }
export interface ProjectProfile { id: string; name: string; avatar: string; description?: string; also: string[] }
export interface ProjectSettings extends ProjectChoices {
  error?: string; name: string; folder: string; local?: string[]; repos: ProjectRepo[]; former?: string | null;
  projectAgents: { id: string; name: string; default?: boolean }[]; profiles: ProjectProfile[]; others: ProjectProfile[];
}
// Kulisa's keyboard shortcuts (main/keys.ts), as this OS shows them.
export interface Shortcut { id: string; group: string; label: string; keys: string[] }
// A question from the main process (shell.ask) or the window.
export interface Question { message: string; detail?: string; ok?: string; other?: string; danger?: boolean }
