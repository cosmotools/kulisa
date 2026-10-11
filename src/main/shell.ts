// The app (shell: app.ts) every module of the main process is given, as a type. Types only: nothing here runs.
import type { EventEmitter } from 'events';
import type { BrowserWindow, Point, WebContents } from 'electron';
import type { Store } from './store.ts';
import type { ProfileStore } from './profile-store.ts';
import type { CookieSync } from './cookie-sync.ts';
import type { SessionCookies } from './session-cookies.ts';
import type { CdpProxy } from './cdp-proxy.ts';
import type { Accounts, Account } from './accounts.ts';
import type { Agent, Found } from './agents.ts';
import type { Identity } from './mimic-chrome.ts';
import type { Profile } from './profiles.ts';
import type { Project } from './projects.ts';
import type { Task } from './tasks.ts';
import type { AppWindow } from './window.ts';
import type { Question, ProjectEntry as SentProject } from '../renderer/types.ts';
import type { Master } from './master.ts';
import type { Pty } from './terminal.ts';
import type { signinPages } from './signin-pages.ts';
import type { Result } from './result.ts';


// An agent or account a task runs (shell.agentFor): its agent's entry, with the account's id, name and folder.
type AgentChoice = Agent & { agentId: string; configDir: string | null; env: Record<string, string> };

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
  readonly win: BrowserWindow | null; readonly current: Project | null; readonly task: Task | null;
  readonly profiles: Map<string, Profile>; readonly closed: Task['closed']; readonly pty: Pty | null;
  readonly resumedSession: string | null; readonly quitting: boolean;
  taskOf(id: string, n: number): Task | null;
  taskByKey(key: string): Task | null;
  windowOf(sender: WebContents): AppWindow | null;
  taskChanged(task: Task, now?: boolean, agentState?: boolean): void;
  projects(): SentProject[];
  askWhich(q: Question, w?: AppWindow | null): Promise<string | null>;
  ask(q: Question, w?: AppWindow | null): Promise<boolean>;
  saveWindows(): void;
  sendProjects(): void;
  uiZoom: number; setUiZoom(z: number): void;
  theme: 'dark' | 'light' | 'system'; shade(): 'dark' | 'light'; setTheme(theme?: 'dark' | 'light' | 'system'): void;
  bar: 'top' | 'bottom'; setBar(bar: 'top' | 'bottom'): void;
  firstStart(w: AppWindow): void;
  pointer(): Point;
  windowClosing(w: AppWindow, e: Electron.Event): void;
  signins: Map<string, Pty>;
  signinOpen(token: string, url: string): boolean;
  chromeIdentity: Identity | null;
  stopAutosave?: () => void;
  screenshot(file: string): Promise<void>;
  plugin: string;
  dropAccount(a: Account): Promise<void>;
  agentFor(id: string | null | undefined, opts?: { any?: boolean }): AgentChoice | null;
  findAgent(agent: Agent, cwd: string): Promise<Found | null>;
  chooseAgent: ((task: Task, agent: AgentChoice | null, opts?: { cancel?: boolean }) => Promise<AgentChoice | null>)
    & { cancel(task: Task): void };
  // master.ts
  masters: Map<string, Master>;
  signinWindows: Set<Master>;
  flushMaster(folder: string): Promise<void>;
  closeMaster(folder: string): Promise<void>;
  openMaster(folder: string): Promise<Result<{ folder: string }>>;
  openSigninWindow(url: string, what: string): Promise<{ closed: Promise<unknown>; close(): Promise<void> }>;
}

export type { Shell, AgentChoice };
