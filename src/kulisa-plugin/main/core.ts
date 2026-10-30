// The facts and actions supplied by the caller. The Kulisa package owns no tasks, profiles or terminals.
import type { IncomingMessage } from 'http';
import type { BrowserContext, Page } from 'playwright-core';
import type { ApplicationTerminal, ApplicationScreen, ApplicationKey, TerminalSize } from '../../shared/application-terminal.ts';
import type { ArtifactSource } from '../../shared/types.ts';
import type { StageLayout, StagePosition } from '../../shared/ipc.ts';
import type { Result } from '../../shared/result.ts';
import type { Shot } from '../../screenshots/main/index.ts';
import type { Conversation } from './transcripts.ts';

interface TabAccess {
  readonly id: string; readonly title: string; readonly url: string;
  readonly alive: boolean; readonly ready?: Promise<unknown>;
  readonly dialog?: { type: string; message: string } | null;
  agentDialogs?: { asked: string[]; accept: boolean };
  canGoBack(): boolean;
  canGoForward(): boolean;
  onInput(listener: (type: string) => void): () => void;
}
interface ProfileInfo {
  id: string; name: string; description?: string; avatar: string; login?: string; hasPassword?: boolean;
}
interface ProfileAccess extends ProfileInfo {
  readonly signinMode: boolean; readonly resuming: boolean; readonly deleted: boolean;
  readonly active: string | null; readonly tabs: TabAccess[];
  readonly currentUrl: string;
  navigate(url: string): Promise<void>;
  newTab(url: string): TabAccess;
  activate(id: string): void;
  closeTab(id: string): void;
  page(id: string): Promise<Page>;
}
interface TerminalAccess {
  readonly id: number; readonly agent: boolean; readonly state: 'working' | 'waiting' | 'done' | null;
  saveSession(session: { sessionId: string; transcript?: string }): void;
  noteAutoTitle(): Promise<unknown>;
  setState(state: TerminalAccess['state']): void;
  followAutoTitle(): void;
  historyRead(conversation: number, part: number, parts: number): void;
  nameConversation(name: string): Result<{ name: string }>;
}
interface SavedConversation {
  from?: number; to?: number; transcript?: string;
  name: string; tab: string; open: boolean;
  read?: (file: string) => Conversation;
}
interface Artifact { file: string; source: ArtifactSource; kind: string; time: number; bytes: number }
interface ApplicationAccess {
  info(): ApplicationTerminal[];
  run(name: string, command: string, size?: TerminalSize | null): Promise<Result<ApplicationTerminal>>;
  resize(which: number | string, size: TerminalSize | null): Result<ApplicationTerminal>;
  stop(which: number | string): Result<ApplicationTerminal>;
  close(which: number | string): Result<{ id: number }>;
  read(which: number | string, lines?: number, screenOnly?: boolean): Promise<Result<ApplicationScreen>>;
  input(which: number | string, input: { text?: string; paste?: boolean; key?: ApplicationKey }): Result<{ id: number }>;
}
interface TaskAccess {
  readonly applications: ApplicationAccess;
  readonly key: string; readonly name: string; readonly folder: string; readonly branch: string | null;
  readonly worktrees: { folder: string; repo: string; branch: string }[];
  readonly profiles: ReadonlyMap<string, ProfileAccess>;
  readonly closed: ReadonlyMap<string, { cfg: ProfileInfo; tabs: { urls: string[] } }>;
  readonly artifactLimit: number;
  arrangeStage(layout?: StageLayout, overflow?: boolean, position?: StagePosition): Result;
  dirs(): string[];
  addable(): string[];
  inGit(): boolean;
  named(name: string): Result<{ id: string }>;
  find(id: string): Result<{ profile: ProfileAccess }> & { closed?: boolean };
  findTab(id: string, tab?: string): Result<{ profile: ProfileAccess; tab: TabAccess }>;
  createProfile(name: string, description?: string): Promise<Result>;
  renameProfile(id: string, name: string): Result;
  describeProfile(id: string, description: string): Result;
  openProfile(id: string): Promise<Result>;
  closeProfile(id: string): Promise<Result>;
  deleteProfile(id: string): Promise<Result>;
  setLogin(id: string, login: string, password: string): Result;
  typeLogin<T>(id: string, tab: string | undefined, field: 'login' | 'password', fill: (value: string) => Promise<T>): Promise<Result<{ name: string; result: T }>>;
  caption(profile: string, caption: string, sticky?: boolean): void;
  toUrl(address: string): string;
  screenshot(profile: string, tab: string | undefined, shot: Omit<Shot, 'human'> & { by: 'agent' }): Promise<{ buf: Buffer; file: string }>;
  saveArtifact(source: ArtifactSource, kind: string, content: string | Buffer): Promise<string>;
  artifacts(): Promise<Artifact[]>;
  artifactsUsage(scope?: 'task' | 'project' | 'all'): Promise<{ bytes: number; tasks: { key: string; name: string; project: string; bytes: number }[] }>;
  deleteArtifacts(files: string[] | null): Promise<Result<{ deleted: number; bytes: number }>>;
  rename(name: string): Promise<Result<{ name: string; branch?: string | null }>>;
  makeWorktree(name?: string): Promise<Result<{ folder: string; branch: string }>>;
  addRepository(repository: string): Promise<Result<{ folder: string; branch: string }>>;
  removeRepository(repository: string): Promise<Result<{ folder: string }>>;
  codeProgress(): Promise<{ folder: string; repo: string; log: string; status: string; stat: string }[]>;
  conversations(): SavedConversation[];
  terminalsInfo(): { list: { name: string; agent: boolean; by: string; command?: string }[] };
  runInTerminal(name: string, command: string): Promise<Result<{ name: string; again?: boolean }>>;
  readTerminal(name: string, lines?: number): Result<{ text: string }>;
  closeTerminal(name: string): Result;
  interruptTerminal(name: string): Result;
}
interface Command { task: string; profile: string; method: string; params: Record<string, any> }
interface Action { caption: string; x?: number; y?: number; task: string; profile: string }
interface PluginHost {
  resolve(project: string, task: string, terminal?: number): { task: TaskAccess; terminal: TerminalAccess | null } | null;
  allowRequest(req: IncomingMessage): boolean;
  dictated(text: string): void;
  onProfileUnloading(listener: (key: string) => void): void;
  contexts(): (BrowserContext | null)[];
  onContext(listener: (context: BrowserContext | null) => void): void;
  onCommand(listener: (command: Command) => void): void;
  typingSecret(key: string): boolean;
  showAction(action: Action): void;
  noteAction(action: Action & { t: number }): void;
}

export type { TaskAccess, ProfileAccess, TabAccess, TerminalAccess, SavedConversation, PluginHost, Command };
