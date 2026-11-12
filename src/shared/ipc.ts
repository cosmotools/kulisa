// The channels between a window's page and the main process, each declared once: what it takes and what it answers.
// Both ends are checked against it (main/ipc.ts: handle, on, AppWindow.send; the window's bridge: renderer/env.d.ts,
// act). docs/window.md, IPC. An answer the window does not read is `void`: the main process may answer anything there
// (the tests read some).
import type { ProjectFile, ProjectGitStatus } from '../project-explorer/ipc.ts';
import type { EditorAction, EditorSnapshot } from '../editor/ipc.ts';
import type { ViewerBox, ViewerSearchResult } from '../file-viewer/ipc.ts';
import type { Result } from './result.ts';
import type { DiffOptions, Diff, FileDiff, Review } from '../diff/ipc.ts';
import type { StageTerminal, StageTerminalsState, TerminalSize } from './stage-terminal.ts';
import type { FileLink, TerminalEvents, TerminalInvoke, TerminalSend } from '../terminal/ipc.ts';
import type { ThumbnailEvents, ThumbnailInvoke, ThumbnailSend } from '../screenshots/ipc.ts';
import type { GitHubInvoke } from '../github/ipc.ts';
import type { DictationEvents, DictationInvoke } from '../dictation/ipc.ts';
import type {
  AboutFolder, AboutInfo, Artifact, EnvironmentSource, AccountsInfo, AgentInfo, ClosedProfile, LanguageInfo, LogInfo, NewProjectSetup, Profile, ProjectAgent, ProjectChoices, ProjectGitHub, ProjectProfile, ProjectFolder,
  ProjectSettings, ProjectsInfo, Question, SettingsProfile, Shortcut, SignedIn, DevelopmentTerminalsState, ExistingAgentSetup, ListOptions,
} from './types.ts';

// What a message about the shown task's profiles and tabs names (renderer's act: refused when that task is no longer
// shown).
export interface OnTask { task: string | null }
export type OnProfile = OnTask & { profile: string };
export type OnTab = OnProfile & { tab?: string | null }; // none: the active one
export type PageLayout = Partial<{ x: number; y: number; width: number; height: number }> & { shown?: boolean; clip?: { x: number; y: number; width: number; height: number } };
type Grid = Record<string, PageLayout>;
export type Theme = 'dark' | 'light' | 'system';
export type StagePosition = 'left' | 'right' | 'above';
export type StageLayout = 'vertical' | 'tabs' | 'horizontal';
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
export interface TaskPresentation {
  workbenchItem: 'terminals' | 'project' | 'diff' | 'artifacts'; selectedArtifact: string | null;
  stagePosition: StagePosition; stageLayout: StageLayout | null; stageOverflow: boolean; stageFollowPaused: boolean;
}
export interface TaskSummary {
  key: string; profiles: { id: string; name: string; avatar: string; description: string; tabs: number }[];
  closedProfiles: { id: string; name: string; avatar: string; description: string }[];
  terminals: number; shells: string[]; failure: 'crashed' | 'unresponsive' | null; presentation: TaskPresentation;
}
export type TaskDialog = { kind: 'stageTerminalSettings'; task: string; terminal: StageTerminal } | { kind: 'handover'; task: string; terminal: import('./types.ts').DevelopmentTerminalInfo };
export interface Invoke extends TerminalInvoke, ThumbnailInvoke, GitHubInvoke, DictationInvoke {
  'project:list': I<[], ProjectsInfo | undefined>;
  'project:refresh': I<[]>;
  'project:open': I<[{ folder: string; task?: string } | { id: string; task: string }]>;
  'project:new-defaults': I<[], ProjectChoices & { location: string; sep: string }>;
  'project:pick-location': I<[{ location?: string; existing?: boolean }], string | null>;
  'project:folder:state': I<[{ from?: string; location?: string; name?: string; folder?: string }], { folder: string; state: string; project?: string; error: string | null } | null>;
  'project:new': I<[{ from?: string; name?: string; directoryName?: string; location?: string; folders?: string[]; urls?: string[] } & NewProjectSetup], Result<{ id: string; problems?: string[] }>>;
  'project:settings:get': I<[{ id: string }], Result<ProjectSettings>>;
  'project:settings:set': I<[{ id: string; name?: string; local?: string[] }], Result<{ id: string }>>;
  'project:profile:new': I<[{ id: string; name?: string }], Result<ProjectProfiles>>;
  'project:profile:add': I<[{ id: string; profile: string }], Result<ProjectProfiles>>;
  'project:profile:remove': I<[{ id: string; profile: string }], Result<ProjectProfiles>>;
  'project:folder:add': I<[{ id: string; folder?: string }], Result<Partial<Folders>>>;
  'project:folder:clone': I<[{ id: string; url: string }], Result<Folders>>;
  'project:folder:set-default': I<[{ id: string; folder: string }], Result<Folders>>;
  'project:folder:remove': I<[{ id: string; folder: string }], Result<Folders>>;
  'project:agent:add': I<[{ id: string; agent: string }], Result<ProjectAgents>>;
  'project:agent:set-default': I<[{ id: string; agent: string | null }], Result<ProjectAgents>>;
  'project:agent:remove': I<[{ id: string; agent: string }], Result<ProjectAgents>>;
  // Its repositories' GitHub accounts (src/github): read, and one bound to a repository's remote (null: none).
  'project:github:get': I<[{ id: string }], Result<ProjectGitHub>>;
  'project:github:set': I<[{ id: string; remote: string; account: string | null }], Result<ProjectGitHub>>;
  'project:task:close-all': I<[{ id: string }]>;
  'project:task:move-all': I<[{ id: string; to?: number | null }]>;
  'project:show-data': I<[{ id: string }]>;
  'project:delete': I<[{ id: string }], Result<{ id: string }>>;
  'account:list': I<[], AccountsInfo>;
  'account:existing': I<[{ agent: string }], Result<{ setup: ExistingAgentSetup | null }>>;
  'account:connect-existing': I<[{ agent: string }], Result<AccountsInfo & { connected: string }>>;
  'account:show-folder': I<[{ id: string }], Result>;
  'account:delete': I<[{ id: string }], Result<AccountsInfo, string | null>>;
  'account:signin:start': I<[{ id?: string | null; agent: string; key: string }], Result<SignedIn, string | null>>; // null: cancelled
  'account:signin:cancel': I<[{ key: string }]>;
  'profiles:list': I<[], Profiles>;
  'profiles:new': I<[{ name: string }], Result<Profiles & { id: string }>>;
  'profiles:rename': I<[{ profile: string; name: string }], Result<Profiles & { id: string }>>;
  'profiles:describe': I<[{ profile: string; description: string }], Result<Profiles & { id: string }>>;
  'profiles:avatar': I<[{ profile: string; avatar: string }], Result<Profiles & { id: string }>>;
  'profiles:login': I<[{ profile: string; user?: string; password?: string }], Result<Profiles & { id: string }>>;
  'profiles:master': I<[{ profile: string }], Result | undefined>;
  'profiles:delete': I<[{ profile: string }], Result<Profiles, string | null>>;
  'task:move': I<[{ key: string; to?: number | null }]>;
  'task:drop': I<[{ key: string; index: number }]>;
  'task:drag-out': I<[{ key: string }]>;
  'task:show': I<[key: string], { error: string } | void>; // { error }: no such task (ipc/tasks.ts, taskAt)
  'task:new': I<[{ project?: string }?]>;
  'task:close': I<[key: string]>;
  'task:ready': I<[]>;
  'task:reload': I<[string]>;
  'task:drained': I<[number]>;
  'shell:cover': I<[boolean]>;
  'shell:dialog': I<[TaskDialog]>;
  'shell:ask': I<[Question], string | null>;
  'task:command': I<[OnTask & { command: 'profile:show' | 'terminal:open'; profile?: string }]>;
  'task:view-failed': I<[{ task: string; kind: string; frames: string[] }]>;
  'task:delete': I<[key: string]>;
  'task:delete-closed': I<[{ project: string; id: string }]>;
  'task:rename': I<[{ key: string; name: string }], Result<{ name: string; branch: string | null }>>;
  'task:repo:add': I<[{ key: string; repo: string }]>;
  'task:repo:remove': I<[{ key: string; repo: string }]>;
  'task:show-folder': I<[key: string]>;
  'task:open-folder': I<[{ key: string; folder: string }]>; // a resource's folder (Resources.tsx), checked to be the task's
  'task:file:list': I<[{ key: string; folder: string }], Result<{ entries: ProjectFile[] }>>;
  'task:file:status': I<[{ key: string; folder: string }], Result<{ entries: ProjectGitStatus[] }>>;
  'task:diff:list': I<[{ key: string; folder: string; options: DiffOptions }], Result<Diff>>;
  'task:diff:targets': I<[{ key: string; folder: string }], Result<{ branches: string[] }>>;
  'task:diff:review': I<[{ key: string; folder: string; options: DiffOptions; load?: string[] }], Result<Review>>;
  'task:diff:contents': I<[{ key: string; folder: string; path: string; options: DiffOptions }], Result<FileDiff>>;
  'task:file:open': I<[{ key: string; file: string }], Result>;
  'task:editor': I<[{ key: string; action: EditorAction }], Result<EditorSnapshot>>;
  'task:files:folders': I<[string], { folder: string; name: string }[]>;
  'task:files:open': I<[{ key: string; folder: string }], Result>;
  'task:artifact:open': I<[{ key: string; file: string }], Result>;
  'task:artifact:view': I<[{ key: string; file: string }], Result>;
  'task:artifact:thumbnails': I<[{ key: string; files: string[] }]>;
  'task:artifact:refresh': I<[string]>; // the task's artifacts sent again (Resources.tsx: the task shown)
  'task:artifact:read': I<[{ key: string; file: string; offset: number; length: number }], Result<{ bytes: Uint8Array; size: number; revision: string }>>;
  'task:artifact:media:open': I<[{ key: string; file: string; revision: string; request: string }], Result<{ url: string }>>;
  'task:artifact:media:close': I<[{ request: string }]>;
  'task:artifact:pdf:open': I<[{ key: string; file: string; request: string; box: ViewerBox }], Result>;
  'task:artifact:pdf:place': I<[{ request: string; box: ViewerBox }]>;
  'task:artifact:pdf:close': I<[{ request: string }]>;
  'task:artifact:pdf:find': I<[{ request: string; query: string; forward: boolean }], ViewerSearchResult>;
  'task:artifact:send': I<[{ key: string; file: string }], Result>;
  'task:artifact:drag': I<[{ key: string; file: string }], Result>;
  'task:artifact:delete': I<[{ key: string; files: string[] | null }], Result>; // null: all
  'app:quit': I<[]>;
  'agent:list': I<[ListOptions?], { list: AgentInfo[]; home: string } | { list: null }>; // null: not looked for yet (cached)
  'agent:install:start': I<[{ id: string }], Result<{ code: number; installed: boolean; log: string }>>; // log: the whole output (the pieces streamed may still be on their way)
  'profile:close': I<[OnProfile]>;
  'profile:open': I<[OnProfile]>;
  'profile:delete': I<[OnProfile]>;
  'profile:master': I<[OnProfile]>;
  'views:pictures': I<[], Record<string, string> | undefined>;
  'views:hidden': I<[hidden: boolean, opts?: { focus?: boolean; task?: string }]>;
  'stage:arrange': I<[OnTask & { layout?: StageLayout; overflow?: boolean; position?: StagePosition }], Result>;
  'layout:load': I<[OnTask], unknown>; // the grid as the window saved it (layout:save)
  'selection:send': I<[OnTask & { source: EnvironmentSource; text: string }], Result>;
  'stage-terminal:open': I<[OnTask & { name?: string }], Result<StageTerminal>>;
  'stage-terminal:configure': I<[OnTask & { id: number; name?: string; command?: string; size?: TerminalSize | null }], Result<StageTerminal>>;
  'stage-terminal:run': I<[OnTask & { id: number; command?: string }], Result<StageTerminal>>;
  'stage-terminal:stop': I<[OnTask & { id: number }], Result<StageTerminal>>;
  'stage-terminal:close': I<[OnTask & { id: number }], Result<{ id: number }>>;
  'development-terminal:open': I<[OnTask & { agent?: string; own?: boolean }], Result<{ id: number } | { none: true }>>;
  'development-terminal:show': I<[OnTask & { id: number }]>;
  'development-terminal:close': I<[OnTask & { id: number }]>;
  'development-terminal:paste-image': I<[OnTask & { id: number }]>;
  'terminal:files': I<[OnTask & { paths: string[] }], Result<(FileLink | null)[]>>;
  'file:open': I<[string]>;
  'file:show': I<[string]>;
  'agent:new-conversation': I<[OnTask & { id: number }]>;
  'agent:handover:start': I<[OnTask & { id: number; agent: string }], Result<{ id: number }>>;
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
  'window:focused': I<[], boolean>;
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
  'stage:follow:set': I<[follow: boolean]>;
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
  'layout:apply': { task: string | null; rects: Grid; revision: number; viewport: { width: number; height: number } };
  'shell:workspace': { task: string | null; x: number; y: number; width: number; height: number; viewport: { width: number; height: number } };
  'task:presentation': TaskPresentation;
  'layout:save': { task: string | null; layout: unknown };
  'ask:answer': { id: number; answer: string };
  'agent:choice:submit': { task: string | null; id: string | null };
  'keys:zone': string;
  'settings:open': SettingsAt; // shown in the window asking (shell.openSettings)
  'settings:close': void; // left, what was typed saved
}

// webContents.send (AppWindow.send) / the window's kulisa.on: what the main process tells a window.
export interface Events extends TerminalEvents, ThumbnailEvents, DictationEvents {
  'task:initial': TaskPresentation;
  'task:viewport': { revision: number; width: number; height: number; zoom: number };
  'task:activity': { active: boolean; covered: boolean };
  'task:dismiss': void;
  'task:drain': number;
  'task:summary': TaskSummary | null;
  'task:command': { command: 'profile:show' | 'terminal:open'; profile?: string };
  'shell:dialog': TaskDialog;
  'task:editor:state': { task: string; state: EditorSnapshot };
  'project:state': ProjectsInfo;
  'profile:state': { task: string; list: Profile[] };
  'profile:closed': { task: string; list: ClosedProfile[] };
  'development-terminal:state': DevelopmentTerminalsState;
  'stage-terminal:state': StageTerminalsState;
  'task:artifact:state': { task: string; list: Artifact[]; bytes: number }; // bytes: all of them (Task.artifactsUsage)
  'artifact:pdf:find': void;
  'task:artifact:selected': { task: string; file: string };
  'development-terminal:focus': void;
  'stage:arrange': { task: string; layout?: StageLayout; overflow?: boolean; position?: StagePosition };
  'zoom:state': number;
  'theme:state': string;
  'language:state': LanguageInfo;
  'keys:state': Shortcut[];
  'ask:show': Question & { id: number };
  'command:run': { id: string; n?: number; profile: string | null; tab: string | null; task: string | null; page: boolean };
  'stage:follow:state': boolean;
  'stage:activity': { task: string; environment: string };
  'page:press': { task: string };
  'agent:caption': { task: string; profile: string; caption: string | null; sticky?: boolean };
  'agent:choice:show': { task: string; selected: string | null };
  'agent:install:output': string;
  'agent:handover:state': { task: string; list: { id: number; state: import('./types.ts').DevelopmentTerminalInfo['state'] }[] };
  'agent:handover:progress': { task: string; id: number; part: number; parts: number };
  'project:new': void;
  'master:url': string;
  'settings:show': SettingsAt;
  'settings:changed': void; // the profiles changed elsewhere (another window, the agent): Settings' lists read again
  'log:lines': ({ text: string } | { reset: true }) & { stream: number }; // updates belong to one snapshot; turned over: read again
  'window:blur': void; // a tasks' window left (another window, another app): its menus close (lib/cover.ts)
}

// A message's argument after its channel: none for a `void` one.
export type Arg<T> = [T] extends [void] ? [] : [T];
