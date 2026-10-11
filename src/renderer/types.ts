// What the main process sends the window (window.js, profiles.js, tasks.js), as the window uses it.

// A page's alert or confirm (profiles.js, Profile._dialog), shown in its pane.
export interface PageDialog { id: number; type: 'alert' | 'confirm'; message: string; from: string; picture: string | null }
export interface Tab {
  id: string; title: string; url: string; favicon: string | null; loading: boolean; canBack: boolean; canFwd: boolean;
  zoom: number; dialog: PageDialog | null;
}
// An open profile of the shown task (Profile.info): key is its folder, stable across renames.
export interface Profile {
  key: string; id: string; name: string; avatar: string; description: string | null; login: string | null;
  hasPassword: boolean; active: string; signinMode: boolean; tabs: Tab[];
}
// A closed one (window.js, pushState): tabs is how many it had.
export interface ClosedProfile { key: string; id: string; name: string; avatar: string; description: string | null; tabs: number }
// Another terminal of the task (Task.terminalsInfo): the human's shell or what the agent runs.
export interface OtherTerminal { id: number; name: string; command: string; by: 'human' | 'agent' }

export type AgentState = 'working' | 'waiting' | 'done' | null;
// A task, for its tab (Task.info).
export interface TaskInfo {
  n: number; key: string; name: string; state: AgentState; folder: string; offset: number; branch: string | null;
  closed: boolean; merged: boolean; agent: string | null; profiles: number;
}
export interface ProjectEntry { id: string; name: string; folder: string; color: string; icon?: string; favicon?: string; tasks: ProjectTask[] }
// A task of a project, open or not (app.js, shell.projects): Search Tasks' list.
export interface ProjectTask { n: number; name: string; branch?: string; closed: boolean; merged: boolean }
// The window's projects (AppWindow.info): every project, those open in it in the bar's order, the one shown.
export interface ProjectsInfo {
  current: string | null;
  projects: ProjectEntry[];
  open: { id: string; task?: string | null; collapsed?: boolean; tasks?: TaskInfo[]; agents?: { id: string; name: string }[] }[];
  elsewhere?: string[];
  windows?: { id: number; names: string[] }[];
}
// The projects' manager (app.js, project:*): what a project may be, its code, its profiles, its configuration.
// agents: every account (main/accounts.js); clis: the agents a new account can be made of.
export interface ProjectChoices { colors: string[]; icons: string[]; agents: { id: string; name: string }[]; clis: { id: string; name: string }[]; favicon?: string; color?: string; icon?: string }
export interface ProjectRepo { folder: string; git: 'ok' | 'none' | 'nocommit' }
export interface ProjectProfile { id: string; name: string; avatar: string; description?: string; also: string[] }
export interface ProjectSettings extends ProjectChoices {
  error?: string; name: string; folder: string; local?: string[]; repos: ProjectRepo[]; former?: string | null;
  projectAgents: { id: string; name: string }[]; profiles: ProjectProfile[]; others: ProjectProfile[];
}
// Kulisa's keyboard shortcuts (main/keys.js), as this OS shows them.
export interface Shortcut { id: string; group: string; label: string; keys: string[] }
// A question from the main process (shell.ask) or the window.
export interface Question { message: string; detail?: string; ok?: string; other?: string; danger?: boolean }

// Templates reach the bridge as kulisa too (main.ts, master.ts: app.config.globalProperties).
declare module 'vue' {
  interface ComponentCustomProperties { kulisa: KulisaBridge }
}
