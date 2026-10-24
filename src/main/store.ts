// Kulisa's own data in the user-data folder, laid out as Chrome lays out its own (Local State, then a folder per
// profile), so what is known about Chrome's storage applies:
//   settings.json            the Kulisa zoom, the theme, where the tasks' bar is; the windows: the projects open
//                            in each (its tabs, in order), the one shown, where it was on screen
//   projects.json            the projects: { list: [{ id, name, folders, color, agents, profiles }] }; id: six random
//                            characters, made once (projectFor); folders: its folders, repositories or not, the
//                            default first;
//                            color: the one it has while its favicon gives none (docs/tasks.md, Projects); agents:
//                            the agents' accounts its tasks run, the default (+'s) first; profiles: its profiles by
//                            their ids, in order; github: its repositories' GitHub accounts, by remote (remotes.ts:
//                            "github.com/acme/shop" -> an account's id, src/github). What a project is made of is said
//                            here alone
//   projects/<id>/
//     tasks.json             the project's tasks: { list: [{ id, name, named, resources, closed, closedAt,
//                            merged }] }; name "New Task" and named unset until the agent or the human names it;
//                            resources what it has (TaskEntry), the first where it works
//     <task id>/             a task (TaskStore): profiles.json (what it has of its project's profiles: id, sites'
//                            zoom, closed), layout.json (the window's grid), agent.json (its agents' conversations,
//                            to resume and read them), terminals.json (its island's tabs), and a copy of a profile's
//                            master per profile opened here, named by the profile's id:
//       <id>/                a Chromium profile (session.fromPath) with Kulisa's own files in it: Kulisa Tabs.json
//                            (its tabs' URLs), Kulisa Session Cookies.bin (session-cookies.ts)
//   profiles.json, profiles/ the profiles and their masters (profile-store.ts)
//   deleted-folders.json     folders of deleted profiles and tasks, removed at the next start (a session keeps
//                            its files open while Kulisa runs)
// Nothing goes into the project's own folder: sign-ins must not end up in its git.
import fs from 'fs';
import path from 'path';
import { randomInt } from 'crypto';
import { log } from './log.ts';

// Muted, to sit on the dark window; a new project takes the first one no project has (its favicon's own hue, in their
// lightness and chroma, replaces it in the window: renderer/lib/project-color.ts).
const PROJECT_COLORS = ['#4a7bd0', '#3f9a7a', '#b4823a', '#9a5fc0', '#c0584f', '#3c9fb0', '#b0607f', '#7d9a3f'];
// An id of a project, a task, an agent's account or a profile: six lowercase letters and digits, about two billion
// of them, drawn again while taken.
const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
function newId(taken: (id: string) => boolean) {
  let id: string;
  do id = Array.from({ length: 6 }, () => ID_CHARS[randomInt(ID_CHARS.length)]).join(''); while (taken(id));
  return id;
}
const TABS_FILE = 'Kulisa Tabs.json';
const SESSION_COOKIES_FILE = 'Kulisa Session Cookies.bin';
// Chromium's caches inside a profile: rebuilt by themselves, so a copy of a profile goes without them.
const CACHES = new Set(['Cache', 'Code Cache', 'GPUCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'GrShaderCache', 'ShaderCache']);

// A profile's tabs as saved: their URLs, in the strip's order, and the place of the one in front.
interface SavedTabs { urls: string[]; active: number }
// A project in projects.json. folders: its folders (Project Settings' Folders), repositories or not, the default first: new
// tasks start in it.
interface ProjectEntry {
  id: string; name: string; folders: string[]; color: string; agents?: string[];
  profiles?: string[]; local?: string[]; noDefaultAgent?: boolean; github?: Record<string, string>;
}
// A task's copy of one repository (worktrees.ts, createWorktree).
interface Copy { repo: string; worktree: string; branch: string; base: string | null; folder: string }
// What a task has (docs/tasks.md, The Resources island), the first where it works: the project's folder it opened in
// (maintree: the human's, kept as it was then, though the project's default may change), until its own worktree takes
// that place (task_worktree); then the worktrees of the other repositories it added. More kinds come over time.
type Resource = { kind: 'maintree'; folder: string } | ({ kind: 'worktree' } & Copy);
// A task in its project's tasks.json. Where it works, its branch and its folder of copies are its resources'.
interface TaskEntry {
  id: string; name: string; named?: boolean; resources?: Resource[];
  closed?: boolean; closedAt?: number; merged?: boolean;
}
type Worktree = Extract<Resource, { kind: 'worktree' }>;
const worktreesOf = (e: TaskEntry) => (e.resources || []).filter((r): r is Worktree => r.kind === 'worktree');
// Its own worktree, where it works, once it made one.
const ownWorktree = (e: TaskEntry) => { const r = e.resources?.[0]; return r?.kind === 'worktree' ? r : null; };
// Where it works; fallback: its project's folder, for an entry with no resources.
const folderOf = (e: TaskEntry, fallback: string) => e.resources?.[0]?.folder ?? fallback;
const branchOf = (e: TaskEntry) => ownWorktree(e)?.branch ?? null;
// Its folder of copies (<projects' home>/<project>@<branch>/, projects.ts), or null: the folder holding a copy that is
// not beside its repository (<repo>@<branch>). Its repository's top: the copy's folder is the same subfolder of both.
const homeOf = (e: TaskEntry) => {
  const inHome = worktreesOf(e).find((c) => path.dirname(c.worktree) !== path.dirname(path.resolve(c.repo, path.relative(c.folder, c.worktree))));
  return inHome ? path.dirname(inHome.worktree) : null;
};
interface TasksFile { list: TaskEntry[] }
// A window as settings.json keeps it: its tasks by key ("<project id>/<task id>", tasks.ts) in the bar's order, the shown
// one.
interface SavedWindow { tabs: string[]; shown: string | null; bounds?: Electron.Rectangle; maximized?: boolean }
interface Settings { uiZoom?: number; theme?: 'dark' | 'light' | 'system'; bar?: 'top' | 'bottom'; language?: string; keys?: Record<string, string>; windows?: SavedWindow[];
  settingsWindow?: Electron.Rectangle } // where Settings' window was (settings-window.ts)
// A profile as a task keeps it in profiles.json (project-profiles.ts).
interface TaskProfile { id: string; zoom?: Record<string, number>; closed?: boolean }
// A task's agents (tasks.ts): the one it was made with (opened when its island has never had a terminal), and every
// conversation an agent had in it, oldest first, numbered from 1 in task_history: its account, its session as its
// hooks reported it (agent-hooks.ts), when, the name the agent gave it (title) or its own auto-title read from its
// transcript (autoTitle, shown until title is given), and the terminal it is open in (none: closed).
interface Conversation {
  agent: string; sessionId?: string; transcript?: string; started?: boolean; from: number; to?: number; title?: string; autoTitle?: string; terminal?: number;
}
interface AgentFile { agent?: string | null; conversations?: Conversation[] }
// Its island's terminals, in their tabs' order, and the one in front (tasks.ts): a shell has its name; an agent's, its
// conversation's index in agent.json.
interface SavedTerminal { id: number; name?: string; by?: 'human' | 'agent'; conversation?: number }
interface TerminalsFile { front?: number | null; list: SavedTerminal[] }

class Store {
  dir: string; projectsFile: string; deletedFile: string; settingsFile: string;
  constructor(dir: string) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
    this.projectsFile = path.join(dir, 'projects.json');
    this.deletedFile = path.join(dir, 'deleted-folders.json');
    this.settingsFile = path.join(dir, 'settings.json');
    this.purgeDeleted();
  }

  projects(): ProjectEntry[] { return readJSON(this.projectsFile)?.list || []; }
  dirOf(p: { id: string }) { const d = path.join(this.dir, 'projects', p.id); fs.mkdirSync(d, { recursive: true }); return d; }
  // The project a folder is one of, or null.
  projectOf(folder: string): ProjectEntry | null { return this.projects().find((p) => p.folders.some((f) => samePath(f, folder))) || null; }
  // The project of a folder; a new one if no project has it, with the next free color (and its first agent, given).
  // Its id is random and kept for good: its data folder, its tasks' keys and their agents' MCP address stand on it, and
  // one made from the name would mislead once the project is renamed (docs/tasks.md, What is on the computer).
  projectFor(folder: string, name = path.basename(folder) || folder, { agent }: { agent?: string } = {}): ProjectEntry {
    const found = this.projectOf(folder);
    if (found) return found;
    const list = this.projects();
    const id = newId((id) => list.some((p) => p.id === id) || fs.existsSync(path.join(this.dir, 'projects', id)));
    const p: ProjectEntry = { id, name, folders: [folder], color: this.nextColor(), ...(agent && { agents: [agent] }) };
    writeJSON(this.projectsFile, { list: [...list, p] });
    return p;
  }
  nextColor() { return nextColor(this.projects()); }
  // The projects that have an agent's account or a profile (by its id).
  projectsWith(list: 'agents' | 'profiles', item: string) { return this.projects().filter((p) => p[list]?.includes(item)); }
  // A project's name, agents or repositories changed (the projects' manager); its id stays.
  // null fields go.
  updateProject(id: string, fields: { [K in keyof ProjectEntry]?: ProjectEntry[K] | null }): ProjectEntry | null {
    const list = this.projects(), i = list.findIndex((p) => p.id === id);
    if (i < 0) return null;
    const before = list[i]!.name;
    list[i] = Object.fromEntries(Object.entries({ ...list[i], ...fields }).filter(([, v]) => v != null)) as unknown as ProjectEntry;
    writeJSON(this.projectsFile, { list });
    // Here, whoever renames it: a save writes every field, renamed or not.
    if (list[i].name !== before) log.info(`[project] ${id} renamed: ${list[i].name}`);
    return list[i];
  }
  // The windows open last, each with its tasks' keys in order; none at first start.
  windows(): SavedWindow[] { return this.settings().windows || []; }
  saveWindows(windows: SavedWindow[]) { this.saveSettings({ ...this.settings(), windows }); }

  // A project's tasks (tasks.json) and each one's data.
  tasksOf(p: { id: string }): TasksFile {
    return readJSON(path.join(this.dir, 'projects', p.id, 'tasks.json')) || { list: [] };
  }
  saveTasksOf(p: { id: string }, w: TasksFile) { writeJSON(path.join(this.dirOf(p), 'tasks.json'), w); }
  // A task's data folder; taskOf makes it, taskDir only names it (an id still to be found free: Project.createTask).
  taskDir(p: { id: string }, id: string) { return path.join(this.dir, 'projects', p.id, id); }
  taskOf(p: { id: string }, id: string) { return new TaskStore(this.taskDir(p, id), this); }
  // Every task's artifacts folder (TaskStore.artifacts), as a glob: what an agent is let read there (agents/claude.ts).
  artifactsGlob() { return path.join(this.dir, 'projects', '*', '*', 'artifacts'); }
  // A project gone from Kulisa: from the list, and its data (profiles with their sign-ins, tasks); never its
  // folder. Its profiles' sessions may still be open: what cannot go now goes at the next start.
  removeProject(p: ProjectEntry) {
    writeJSON(this.projectsFile, { list: this.projects().filter((x) => x.id !== p.id) });
    const its = (key: string) => key.startsWith(`${p.id}/`);
    this.saveWindows(this.windows().map((w) => ({ ...w, tabs: w.tabs.filter((key) => !its(key)), shown: w.shown && !its(w.shown) ? w.shown : null })));
    const dir = path.join(this.dir, 'projects', p.id);
    this.markDeleted(dir);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { console.warn('[store]', (e as Error).message); }
  }

  // Folders to remove at the next start, before any session opens them; only inside the data folder.
  deleted(): string[] { return readJSON(this.deletedFile) || []; }
  markDeleted(folder: string) { writeJSON(this.deletedFile, [...new Set([...this.deleted(), folder])]); }
  purgeDeleted() {
    for (const d of this.deleted()) {
      const rel = path.relative(this.dir, d);
      if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) fs.rmSync(d, { recursive: true, force: true });
    }
    fs.rmSync(this.deletedFile, { force: true });
  }
  // Kulisa's own settings: { uiZoom, theme, bar, windows }.
  settings(): Settings { return readJSON(this.settingsFile) || {}; }
  saveSettings(s: Settings) { writeJSON(this.settingsFile, s); }
}

// One task's data: its profiles (each a folder, named by its id), grid and agent session.
class TaskStore {
  dir: string; store: Store; saved?: Map<string, string>;
  constructor(dir: string, store: Store) { this.dir = dir; this.store = store; fs.mkdirSync(dir, { recursive: true }); }
  file(name: string) { return path.join(this.dir, name); }
  profileDir(id: string) { return path.join(this.dir, id); }
  // What the agent's tools keep of its pages: large snapshots and bodies, screenshots (kulisa-plugin/artifacts.ts).
  get artifacts() { return path.join(this.dir, 'artifacts'); }
  // What the task has of its project's profiles (project-profiles.ts): [{ id, zoom, closed }] (who a profile is:
  // profile-store.ts); null before the task first loads.
  profiles(): TaskProfile[] | null { return readJSON(this.file('profiles.json')); }
  saveProfiles(list: TaskProfile[]) {
    writeJSON(this.file('profiles.json'), list.map(({ id, zoom, closed }) => ({ id, zoom, ...(closed && { closed }) })));
  }
  // A profile's tabs, in its own folder.
  tabs(id: string): SavedTabs { return readTabs(this.profileDir(id)); }
  saveTabs(id: string, tabs: SavedTabs) {
    const json = JSON.stringify(tabs);
    if ((this.saved ??= new Map()).get(id) === json) return; // written after every change of the window's state
    this.saved.set(id, json);
    writeTabs(this.profileDir(id), tabs);
  }
  markDeleted(id: string) { this.store.markDeleted(this.profileDir(id)); }
  // A profile its project let go while the task is not loaded: gone from its list, its copy removed (listed for the
  // next start too, in case a file of it is still open).
  dropProfile(id: string) {
    const saved = this.profiles();
    if (saved) this.saveProfiles(saved.filter((x) => x.id !== id));
    if (!fs.existsSync(this.profileDir(id))) return;
    this.markDeleted(id);
    fs.rmSync(this.profileDir(id), { recursive: true, force: true });
  }
  // The window's grid as dockview serializes it (the renderer's lib/grid.ts).
  layout(): unknown { return readJSON(this.file('layout.json')); }
  saveLayout(layout: unknown) { writeJSON(this.file('layout.json'), layout); }
  agent(): AgentFile { return readJSON(this.file('agent.json')) || {}; }
  saveAgent(a: AgentFile) { writeJSON(this.file('agent.json'), a); }
  // null: the island never had a terminal (a new task: its agent opens).
  terminals(): TerminalsFile | null { const t = readJSON(this.file('terminals.json')); return Array.isArray(t?.list) ? t : null; }
  saveTerminals(t: TerminalsFile) { writeJSON(this.file('terminals.json'), t); }
}

// Copy a profile's folder without its caches. An open profile can be copied once its data is flushed
// (tasks.ts); a file that cannot be read (locked on Windows) is left out and logged.
async function copyProfile(from: string, to: string) {
  const walk = async (src: string, dst: string, top: boolean) => {
    await fs.promises.mkdir(dst, { recursive: true });
    for (const e of await fs.promises.readdir(src, { withFileTypes: true })) {
      if (top && CACHES.has(e.name)) continue;
      const s = path.join(src, e.name), d = path.join(dst, e.name);
      try {
        if (e.isDirectory()) await walk(s, d, false);
        else if (e.isFile()) await fs.promises.copyFile(s, d);
      } catch (err) { console.error('[store] not copied:', s, (err as NodeJS.ErrnoException).code || (err as Error).message); }
    }
  };
  await walk(from, to, true);
}

const nextColor = (list: ProjectEntry[]) => PROJECT_COLORS.find((c) => !list.some((p) => p.color === c)) || PROJECT_COLORS[list.length % PROJECT_COLORS.length]!;
const samePath = (a: string, b: string) => (process.platform === 'linux' ? path.resolve(a) === path.resolve(b) : path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase());
// A profile's tabs (Kulisa Tabs.json, in its folder: a master's and a task's copy alike), to open them again.
function readTabs(dir: string): SavedTabs {
  const v = readJSON(path.join(dir, TABS_FILE));
  return Array.isArray(v?.urls) ? { urls: v.urls, active: Number.isInteger(v.active) ? v.active : 0 } : { urls: [], active: 0 };
}
function writeTabs(dir: string, tabs: SavedTabs) { fs.mkdirSync(dir, { recursive: true }); writeJSON(path.join(dir, TABS_FILE), tabs); }
function readJSON(f: string) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } }
function writeJSON(f: string, v: unknown) { try { writeFileAtomic(f, JSON.stringify(v, null, 2)); } catch (e) { console.error('[store]', (e as Error).message); } }
// Written whole or not at all: to a file next to it, then renamed over it. Kulisa may be killed or the computer lose
// power while it writes (the tabs and session cookies are saved every few seconds); a half-written profiles.json
// would lose the list of the profiles, a half-written session cookies file the sign-ins. The data reaches the disk
// (fsync) before the rename: otherwise after a power loss the rename may be there and the data not (an empty file).
// Not the write-file-atomic package: it brings signal-exit, which hooks SIGINT and SIGTERM, and the app handles them.
function writeFileAtomic(file: string, data: string | Uint8Array, options?: { mode?: number }) {
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    const fd = fs.openSync(tmp, 'w', options?.mode);
    try { fs.writeFileSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(tmp, file);
  } catch (e) { fs.rmSync(tmp, { force: true }); throw e; }
}

export { Store, newId, copyProfile, writeFileAtomic, readTabs, writeTabs, SESSION_COOKIES_FILE, PROJECT_COLORS, worktreesOf, ownWorktree, folderOf, branchOf, homeOf };
export type { SavedTabs, TaskStore, ProjectEntry, TaskEntry, Copy, Worktree, TaskProfile, TasksFile, Conversation };
