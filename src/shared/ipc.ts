// The channels between a window's page and the main process, each declared once: what it takes and what it answers.
// Both ends are checked against it (main/ipc.ts: handle, on, AppWindow.send; the window's bridge: renderer/env.d.ts,
// act). docs/window.md, IPC. An answer the window does not read is `void`: the main process may answer anything there
// (the tests read some).
import type { Result } from './result.ts';
import type { FileLink, TerminalContents, TerminalEvents, TerminalInvoke, TerminalSend } from '../terminal/ipc.ts';
import type { ThumbnailEvents, ThumbnailInvoke, ThumbnailSend } from '../screenshots/ipc.ts';
import type { GitHubInvoke } from '../github/ipc.ts';
import type { DictationEvents, DictationInvoke } from '../dictation/ipc.ts';
import type {
  AboutFolder, AboutInfo, Artifact, AccountsInfo, AgentInfo, ClosedProfile, LanguageInfo, LogInfo, NewProjectSetup, Profile, ProjectAgent, ProjectChoices, ProjectGitHub, ProjectProfile, ProjectFolder,
  ProjectSettings, ProjectsInfo, Question, SettingsProfile, Shortcut, SignedIn, Terminals,
} from './types.ts';

// What a message about the shown task's profiles and tabs names (renderer's act: refused when that task is no longer
// shown).
export interface OnTask { task: string | null }
export type OnProfile = OnTask & { profile: string };
export type OnTab = OnProfile & { tab?: string | null }; // none: the active one
type Grid = Record<string, Partial<{ x: number; y: number; width: number; height: number }> & { shown?: boolean }>;
export type Theme = 'dark' | 'light' | 'system';
export type Bar = 'top' | 'bottom';
// Where Settings opens (components/settings): a project's page (none: the shown task's), a profile's, the
// log (☰ → Report a Problem…), About (☰ → About Kulisa; macOS's app menu).
export type SettingsAt = { section: 'projects' | 'profiles' | 'log' | 'about'; id?: string | null };
// A project's folders as its manager shows them (projects.ts, foldersInfo).
type Folders = { folders: ProjectFolder[] };
type ProjectAgents = { agents: ProjectAgent[] };
type ProjectProfiles = { profiles: ProjectProfile[]; others: ProjectProfile[] };
type Profiles = { profiles: SettingsProfile[] };

// ipcRenderer.invoke / ipcMain.handle: args, the answer.
type I<A extends unknown[], R = void> = { args: A; result: R };
export interface Invoke extends TerminalInvoke, ThumbnailInvoke, GitHubInvoke, DictationInvoke {
  'projects:list': I<[], ProjectsInfo | undefined>;
  'tasks:get': I<[]>;
  'project:open': I<[{ folder: string; task?: string } | { id: string; task: string }]>;
  'project:new-defaults': I<[], ProjectChoices & { location: string; sep: string }>;
  'project:pick-location': I<[{ location?: string; existing?: boolean }], string | null>;
  'project:folder-state': I<[{ from?: string; location?: string; name?: string; folder?: string }], { folder: string; state: string; project?: string } | null>;
  'project:new': I<[{ from?: string; name?: string; location?: string; folders?: string[]; urls?: string[] } & NewProjectSetup], Result<{ id: string; problems?: string[] }>>;
  'project:settings-get': I<[{ id: string }], Result<ProjectSettings>>;
  'project:settings': I<[{ id: string; name?: string; local?: string[] }], Result<{ id: string }>>;
  'project:profile-new': I<[{ id: string; name?: string }], Result<ProjectProfiles>>;
  'project:profile-add': I<[{ id: string; profile: string }], Result<ProjectProfiles>>;
  'project:profile-remove': I<[{ id: string; profile: string }], Result<ProjectProfiles>>;
  'project:folder-add': I<[{ id: string; folder?: string }], Result<Partial<Folders>>>;
  'project:folder-clone': I<[{ id: string; url: string }], Result<Folders>>;
  'project:folder-default': I<[{ id: string; folder: string }], Result<Folders>>;
  'project:folder-remove': I<[{ id: string; folder: string }], Result<Folders>>;
  'project:agent-add': I<[{ id: string; agent: string }], Result<ProjectAgents>>;
  'project:agent-default': I<[{ id: string; agent: string | null }], Result<ProjectAgents>>;
  'project:agent-remove': I<[{ id: string; agent: string }], Result<ProjectAgents>>;
  // Its repositories' GitHub accounts (src/github): read, and one bound to a repository's remote (null: none).
  'project:github-get': I<[{ id: string }], Result<ProjectGitHub>>;
  'project:github-set': I<[{ id: string; remote: string; account: string | null }], Result<ProjectGitHub>>;
  'project:close-tasks': I<[{ id: string }]>;
  'project:move-all': I<[{ id: string; to?: number | null; terminals: TerminalContents }]>;
  'project:show-data': I<[{ id: string }]>;
  'project:delete': I<[{ id: string }], Result<{ id: string }>>;
  'project:delete-merged': I<[{ id: string }]>;
  'accounts:list': I<[], AccountsInfo>;
  'account:delete': I<[{ id: string }], Result<AccountsInfo, string | null>>;
  'account:signin': I<[{ id?: string | null; agent: string; key: string }], Result<SignedIn, string | null>>; // null: cancelled
  'account:signin-cancel': I<[{ key: string }]>;
  'profiles:list': I<[], Profiles>;
  'profiles:new': I<[{ name: string }], Result<Profiles & { id: string }>>;
  'profiles:rename': I<[{ profile: string; name: string }], Result<Profiles & { id: string }>>;
  'profiles:describe': I<[{ profile: string; description: string }], Result<Profiles & { id: string }>>;
  'profiles:avatar': I<[{ profile: string; avatar: string }], Result<Profiles & { id: string }>>;
  'profiles:login': I<[{ profile: string; user?: string; password?: string }], Result<Profiles & { id: string }>>;
  'profiles:master': I<[{ profile: string }], Result | undefined>;
  'profiles:delete': I<[{ profile: string }], Result<Profiles, string | null>>;
  'task:move': I<[{ key: string; to?: number | null; terminals: TerminalContents }]>;
  'task:drop': I<[{ key: string; index: number; terminals: TerminalContents }]>;
  'task:drag-out': I<[{ key: string; terminals: TerminalContents }]>;
  'task:show': I<[key: string], { error: string } | void>; // { error }: no such task (ipc/tasks.ts, taskAt)
  'task:new': I<[{ project?: string }?]>;
  'task:close': I<[key: string]>;
  'task:delete': I<[key: string]>;
  'task:delete-closed': I<[{ project: string; id: string }]>;
  'task:rename': I<[{ key: string; name: string }], Result<{ name: string; branch: string | null }>>;
  'task:add-repo': I<[{ key: string; repo: string }]>;
  'task:remove-repo': I<[{ key: string; repo: string }]>;
  'task:show-folder': I<[key: string]>;
  'task:open-folder': I<[{ key: string; folder: string }]>; // a resource's folder (Resources.tsx), checked to be the task's
  'task:artifacts': I<[string]>; // the task's artifacts sent again (Resources.tsx: the task shown)
  'task:artifacts-delete': I<[{ key: string; files: string[] | null }], Result>; // null: all
  'app:quit': I<[]>;
  'agents:list': I<[{ check?: boolean; details?: boolean; cached?: boolean }?], { list: AgentInfo[]; home: string } | { list: null }>; // null: not looked for yet (cached)
  'agents:install': I<[{ id: string }], Result<{ code: number; installed: boolean; log: string }>>; // log: the whole output (the pieces streamed may still be on their way)
  'profile:close': I<[OnProfile]>;
  'profile:open': I<[OnProfile]>;
  'profile:delete': I<[OnProfile]>;
  'profile:master': I<[OnProfile]>;
  'views:hidden': I<[hidden: boolean, opts?: { snapshots?: boolean }], Record<string, string> | undefined>;
  'layout:load': I<[OnTask], unknown>; // the grid as the window saved it (layout:save)
  'terminal:open': I<[OnTask & { agent?: string; own?: boolean }], Result<{ id: number } | { none: true }>>;
  'terminal:show': I<[OnTask & { id: number }]>;
  'terminal:close': I<[OnTask & { id: number }]>;
  'terminal:paste-image': I<[OnTask & { id: number }]>;
  'terminal:files': I<[OnTask & { paths: string[] }], Result<(FileLink | null)[]>>;
  'file:open': I<[string]>;
  'file:show': I<[string]>;
  'agent:new-conversation': I<[OnTask & { id: number }]>;
  'agent:hand-over': I<[OnTask & { id: number; agent: string }], Result<{ id: number }>>;
  'tab:new': I<[OnProfile & { url?: string }], string | { error: string }>; // the new tab's id
  'tab:close': I<[OnTab & { focus?: boolean }]>;
  'tab:activate': I<[OnTab & { focus?: boolean }]>;
  'tab:focus': I<[OnTab]>;
  'tab:reopen': I<[OnProfile]>;
  'tab:navigate': I<[OnTab & { url: string }]>;
  'tab:back': I<[OnTab]>;
  'tab:forward': I<[OnTab]>;
  'tab:reload': I<[OnTab & { ignoreCache?: boolean }]>;
  'tab:dialog': I<[OnTab & { dialog: number; ok: boolean }]>;
  'tab:devtools': I<[OnTab]>;
  'tab:zoom': I<[OnTab & { dir: number }]>;
  // A picture of the tab, on the clipboard and in the task's artifacts (src/screenshots): its file; null when
  // no element was chosen (Esc).
  'tab:screenshot': I<[OnTab & { kind: 'element' | 'visible' | 'full' }], Result<{ file: string | null }>>;
  'zoom:get': I<[], number>;
  'about:get': I<[], AboutInfo>;
  'about:show-folder': I<[id: AboutFolder]>;
  // The Log page (window.md, The log): the file whole, then followed (log:lines); saved as a file to attach anywhere
  // (null: not saved); its folder shown; a new issue on GitHub with the environment filled in.
  'log:get': I<[], LogInfo>;
  'log:save': I<[], Result<{ file: string | null }>>;
  'log:show-folder': I<[]>;
  'log:report': I<[]>;
  'zoom:ui': I<[dir: number]>;
  'language:get': I<[], LanguageInfo>;
  'language:set': I<[code: string], Result<{ language: string }>>;
  'theme:set': I<[theme: Theme]>;
  'bar:set': I<[bar: Bar]>;
  'keys:set': I<[{ id: string; code: string }], Result<{ keys: Shortcut[] }>>;
  'pick:start': I<[{ profile: string }], Result | undefined>;
  'pick:cancel': I<[{ profile: string }]>;
  // A master's window (master.ts).
  'master:go': I<[url: string]>;
  'master:back': I<[]>;
  'master:forward': I<[]>;
  'master:reload': I<[]>;
}

// ipcRenderer.send / ipcMain.on: what is sent, no answer.
export interface Send extends TerminalSend, ThumbnailSend {
  'layout': { task: string | null; rects: Grid };
  'layout:save': { task: string | null; layout: unknown };
  'ask:answer': { id: number; answer: string };
  'agent:chosen': { task: string | null; id: string | null };
  'keys:zone': string;
  'settings:open': SettingsAt; // shown in the window asking (shell.openSettings)
  'settings:close': void; // left, what was typed saved
}

// webContents.send (AppWindow.send) / the window's kulisa.on: what the main process tells a window.
export interface Events extends TerminalEvents, ThumbnailEvents, DictationEvents {
  'projects': ProjectsInfo;
  'state': Profile[];
  'closed-profiles': ClosedProfile[];
  'terminals': Terminals;
  'artifacts': { task: string; list: Artifact[]; bytes: number }; // bytes: all of them (Task.artifactsUsage)
  'terminal:focus': void;
  'grid:closing': boolean; // another task's grid follows
  'tasks:closed': string[];
  'zoom': number;
  'theme': string;
  'bar': Bar;
  'language': LanguageInfo;
  'keys': Shortcut[];
  'ask': Question & { id: number };
  'command': { id: string; n?: number; profile: string | null; tab: string | null; task: string | null; page: boolean };
  'agent': { task: string; profile: string; caption: string | null; sticky?: boolean };
  'agent:choose': { task: string; selected: string | null };
  'agents:install-log': string;
  'handover:read': { task: string; id: number; part: number; parts: number };
  'project:new': void;
  'master:url': string;
  'settings:show': SettingsAt;
  'settings:changed': void; // the profiles changed elsewhere (another window, the agent): Settings' lists read again
  'log:lines': { text: string } | { reset: true }; // what the log got since it was read; turned over: read it again
  'window:blur': void; // a tasks' window left (another window, another app): its menus close (lib/cover.ts)
}

// A message's argument after its channel: none for a `void` one.
export type Arg<T> = [T] extends [void] ? [] : [T];
