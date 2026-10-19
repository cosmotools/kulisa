// The app (shell: app.ts) every module of the main process is given, as a type. Types only: nothing here runs.
import type { EventEmitter } from 'events';
import type { BrowserWindow, Point, WebContents } from 'electron';
import type { Store } from './store.ts';
import type { ProfileStore } from './profile-store.ts';
import type { CookieSync } from './cookie-sync.ts';
import type { SessionCookies } from './session-cookies.ts';
import type { CdpProxy } from './cdp-proxy.ts';
import type { Accounts, Account } from './accounts.ts';
import type { Agent, Found } from './agents/index.ts';
import type { Profile, Tab } from './profiles.ts';
import type { Project } from './projects.ts';
import type { Task } from './tasks.ts';
import type { AppWindow, Asker } from './window.ts';
import type { Question, ProjectEntry as SentProject, LanguageInfo, Shortcut } from '../shared/types.ts';
import type { Master } from './master.ts';
import type { SettingsWindow } from './settings-window.ts';
import type { SettingsAt } from '../shared/ipc.ts';
import type { Pty } from '../terminal/main/index.ts';
import type { signinPages } from './signin-pages.ts';
import type { Result } from '../shared/result.ts';
import type { Discarder } from './discard.ts';


// An agent or account a task runs (shell.agentFor): its agent's entry, with the account's id, name and folder; cli:
// its agent's own name.
type AgentChoice = Agent & { agentId: string; cli: string; configDir: string | null; env: Record<string, string> };

// The app: what app.ts makes and every module is given. win, current, task, profiles, closed, pty, resumedSession are the
// first window's (the tests').
interface Shell {
  bus: EventEmitter; store: Store; proxy: CdpProxy; mcp: { base: string; srv: import('http').Server };
  open: Map<string, Project>; windows: AppWindow[]; signin: ReturnType<typeof signinPages>;
  profileStore: ProfileStore; cookieSync: CookieSync; sessionCookies: SessionCookies; accounts: Accounts;
  secrets: { available(): boolean; encrypt(s: string): string; decrypt(b: string): string };
  loginSecret(password?: string): Result<{ secret?: string }>;
  typingSecret: Set<string>; // '<task key>/<profile id>'
  profilesChanged(from?: Task): void;
  projectsHome: string;
  readonly win: BrowserWindow | null; readonly current: Project | null; readonly task: Task | null; // current: the shown task's project
  readonly profiles: Map<string, Profile>; readonly closed: Task['closed']; readonly pty: Pty | null;
  readonly resumedSession: string | null; readonly quitting: boolean;
  taskOf(id: string, n: number): Task | null;
  taskByKey(key: string): Task | null;
  windowOf(sender: WebContents): AppWindow | null;
  tabOf(wc: WebContents): { w: AppWindow; profile: Profile; tab: Tab } | null;
  taskChanged(task: Task, now?: boolean, agentState?: boolean): void;
  projects(): SentProject[];
  askWhich(q: Question, w?: Asker | null): Promise<string | null>;
  restart(apply?: () => void): Promise<void>; // into a new version: everything saved as at quitting (updates.ts)
  ask(q: Question, w?: Asker | null): Promise<boolean>;
  front(): AppWindow | null; // the tasks' window last in front: the one Settings acts for (settings-window.ts)
  saveWindows(): void;
  sendProjects(): void;
  uiZoom: number; setUiZoom(z: number): void;
  theme: 'dark' | 'light' | 'system'; shade(): 'dark' | 'light'; setTheme(theme?: 'dark' | 'light' | 'system'): void;
  bar: 'top' | 'bottom'; setBar(bar: 'top' | 'bottom'): void;
  language: string; languageInfo(): LanguageInfo; setLanguage(code: string): Result<{ language: string }>;
  keys(): Shortcut[]; // the keyboard shortcuts as shown, the human's hold keys in (keys.ts)
  firstStart(w: AppWindow): void;
  pointer(): Point;
  windowClosing(w: AppWindow, e: Electron.Event): void;
  signins: Map<string, Pty>;
  stopAutosave?: () => void;
  discard: Discarder; // tabs no one looks at losing their process (discard.ts)
  screenshot(file: string): Promise<void>;
  packages: string; // Kulisa's packages for the agents (app.ts, AGENT_PACKAGES)
  agentFiles: string[]; // the agents' local settings a task's copy gets (each agent's localFiles)
  dropAccount(a: Account): Promise<void>;
  agentFor(id: string | null | undefined, opts?: { any?: boolean }): AgentChoice | null;
  findAgent(agent: Agent, cwd: string): Promise<Found | null>;
  chooseAgent: ((task: Task, agent: AgentChoice | null) => Promise<AgentChoice | null>)
    & { cancel(task: Task): void };
  // settings-window.ts: Settings' window while it is open, at a page.
  settings: SettingsWindow | null;
  openSettings(at: SettingsAt): void;
  // master.ts
  masters: Map<string, Master>;
  flushMaster(folder: string): Promise<void>;
  closeMaster(folder: string): Promise<void>;
  openMaster(folder: string): Promise<Result<{ folder: string }>>;
}

export type { Shell, AgentChoice };
