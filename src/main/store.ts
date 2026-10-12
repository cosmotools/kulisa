// Kulisa's own data in the user-data folder, laid out as Chrome lays out its own (Local State, then a folder per
// profile), so what is known about Chrome's storage applies:
//   settings.json            the Kulisa zoom, the theme, where the tasks' bar is; the windows: the projects open
//                            in each (its tabs, in order), the one shown, where it was on screen
//   projects.json            the projects: { id, name, folder, repos, color, icon, agents }; a project is a folder
//                            (a repository, or one Kulisa made), and the repositories or folders added to it (repos,
//                            the default first); its color tints the window and its icon marks its group,
//                            to tell projects apart at a glance; agents: the agents' accounts its tasks run, the
//                            default (+'s) first
//   projects/<id>/
//     tasks.json             the project's tasks: { next, current, collapsed, list: [{ n, name, branch, offset, folder,
//                            copies: [{ repo, worktree, branch, base, folder }], home, closed, closedAt }] }; one
//                            without copies works in a folder of the project (tasks.md)
//     <n>/                   a task (TaskStore): profiles.json (what it has of its project's profiles: folder,
//                            sites' zoom, closed), layout.json (the window's grid), agent.json (the agent's session, to
//                            resume it), and a copy of a profile's master per profile opened here:
//       Profile <k>/         a Chromium profile (session.fromPath) with Kulisa's own files in it: Kulisa Tabs.json
//                            (its tabs' URLs), Kulisa Session Cookies.bin (session-cookies.ts)
//   profiles.json, profiles/ the profiles and their masters (profile-store.ts)
//   deleted-folders.json     folders of deleted profiles and tasks, removed at the next start (a session keeps
//                            its files open while Kulisa runs)
// Nothing goes into the project's own folder: sign-ins must not end up in its git.
import fs from 'fs';
import path from 'path';
import { slugOf } from './names.ts';

// Muted, to sit on the dark window; a new project takes the first one no project has.
const PROJECT_COLORS = ['#4a7bd0', '#3f9a7a', '#b4823a', '#9a5fc0', '#c0584f', '#3c9fb0', '#b0607f', '#7d9a3f'];
const TABS_FILE = 'Kulisa Tabs.json';
const SESSION_COOKIES_FILE = 'Kulisa Session Cookies.bin';
// Chromium's caches inside a profile: rebuilt by themselves, so a copy of a profile goes without them.
const CACHES = new Set(['Cache', 'Code Cache', 'GPUCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'GrShaderCache', 'ShaderCache']);

// A project in projects.json.
interface ProjectEntry {
  id: string; name: string; folder: string; color: string; icon?: string; agents?: string[]; repos?: string[];
  local?: string[];
}
// A task's copy of one repository (worktrees.ts, createWorktree).
interface Copy { repo: string; worktree: string; branch: string; base: string | null; folder: string }
// A task in its project's tasks.json.
interface TaskEntry {
  n: number; name: string; branch?: string | null; offset: number; folder?: string; copies?: Copy[]; home?: string;
  closed?: boolean; closedAt?: number; merged?: boolean;
}
interface TasksFile { next: number; current: number | null; collapsed?: boolean; list: TaskEntry[] }
// A window as settings.json keeps it, its projects by id; windows() gives them as projects.
interface SavedWindow { tabs: string[]; shown: string | null; bounds?: Electron.Rectangle; maximized?: boolean }
interface WindowState { tabs: ProjectEntry[]; shown: ProjectEntry | null; bounds?: Electron.Rectangle; maximized?: boolean }
interface Settings { uiZoom?: number; theme?: 'dark' | 'light' | 'system'; bar?: 'top' | 'bottom'; windows?: SavedWindow[] }
// A profile as a task keeps it in profiles.json (project-profiles.ts).
interface TaskProfile { folder: string; id: string; zoom?: Record<string, number>; closed?: boolean }
// A task's agent: which it runs, and its conversation as its hooks reported it (agent-hooks.ts).
// The current run in its fields; the task's earlier runs, oldest first, each an agent's conversation (switching the
// agent: ROADMAP, "Switching a task's agent"; task_history reads them).
interface Run { agent?: string; sessionId?: string; transcript?: string; from?: number; to?: number }
interface AgentFile { agent?: string; sessionId?: string; transcript?: string; started?: boolean; from?: number; runs?: Run[] }
// The terminals besides the agent's (tasks.ts).
interface SavedTerminal { id: number; name: string; by: 'human' | 'agent'; command?: string }

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

  projects(): ProjectEntry[] { return readJSON(this.projectsFile) || []; }
  dirOf(p: { id: string }) { const d = path.join(this.dir, 'projects', p.id); fs.mkdirSync(d, { recursive: true }); return d; }
  // The project of a folder; a new one if no project has it, with what the human chose for it (New Project…: color,
  // icon, its first agent), else the next free color.
  // The project a folder is (its own or one of its repositories), or null.
  projectOf(folder: string): ProjectEntry | null { return this.projects().find((p) => [p.folder, ...(p.repos || [])].some((f) => samePath(f, folder))) || null; }
  projectFor(folder: string, name = path.basename(folder) || folder, { color, icon, agent }: { color?: string; icon?: string; agent?: string } = {}): ProjectEntry {
    const found = this.projectOf(folder);
    if (found) return found;
    const list = this.projects();
    const base = slugOf(name, 'project');
    let id = base, n = 2;
    while (list.some((p) => p.id === id)) id = `${base}-${n++}`;
    const p: ProjectEntry = { id, name, folder, color: color || this.nextColor(), ...(icon && { icon }), ...(agent && { agents: [agent] }) };
    writeJSON(this.projectsFile, [...list, p]);
    return p;
  }
  nextColor() { return nextColor(this.projects()); }
  // A project's name, color, icon, agents or repositories changed (the projects' manager); its id and folder stay.
  // null fields go.
  updateProject(id: string, fields: { [K in keyof ProjectEntry]?: ProjectEntry[K] | null }): ProjectEntry | null {
    const list = this.projects(), i = list.findIndex((p) => p.id === id);
    if (i < 0) return null;
    list[i] = Object.fromEntries(Object.entries({ ...list[i], ...fields }).filter(([, v]) => v != null)) as unknown as ProjectEntry;
    writeJSON(this.projectsFile, list);
    return list[i];
  }
  // The windows open last: [{ tabs: [project], shown: project or null, bounds, maximized }], each with its project
  // tabs in order; none at first start.
  windows(): WindowState[] {
    const list = this.projects(), byId = (id: string | null) => list.find((p) => p.id === id) || null;
    return (this.settings().windows || []).map((w) => ({ ...w, tabs: w.tabs.map(byId).filter((p) => !!p), shown: byId(w.shown) }));
  }
  // windows: [{ tabs: [id], shown: id or null, bounds, maximized }].
  saveWindows(windows: SavedWindow[]) { this.saveSettings({ ...this.settings(), windows }); }

  // A project's tasks (tasks.json) and each one's data.
  tasksOf(p: { id: string }): TasksFile {
    return readJSON(path.join(this.dir, 'projects', p.id, 'tasks.json')) || { next: 1, current: null, list: [] };
  }
  saveTasksOf(p: { id: string }, w: TasksFile) { writeJSON(path.join(this.dirOf(p), 'tasks.json'), w); }
  taskOf(p: { id: string }, n: number) { return new TaskStore(path.join(this.dir, 'projects', p.id, String(n)), this); }
  // A project gone from Kulisa: from the list, and its data (profiles with their sign-ins, tasks); never its
  // folder. Its profiles' sessions may still be open: what cannot go now goes at the next start.
  removeProject(p: ProjectEntry) {
    writeJSON(this.projectsFile, this.projects().filter((x) => x.id !== p.id));
    this.saveWindows(this.windows().map((w) => ({ ...w, tabs: w.tabs.map((x) => x.id).filter((id) => id !== p.id),
      shown: w.shown && w.shown.id !== p.id ? w.shown.id : null })));
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

// One task's data: its profiles (each a folder), grid and agent session.
class TaskStore {
  dir: string; store: Store; saved?: Map<string, string>;
  constructor(dir: string, store: Store) { this.dir = dir; this.store = store; fs.mkdirSync(dir, { recursive: true }); }
  file(name: string) { return path.join(this.dir, name); }
  profileDir(folder: string) { return path.join(this.dir, folder); }
  // What the task has of its project's profiles (project-profiles.ts): [{ folder, id, zoom, closed }] (the id, as it
  // was then, only to read the file by; who a profile is: profile-store.ts); null before the task first loads.
  profiles(): TaskProfile[] | null { return readJSON(this.file('profiles.json')); }
  saveProfiles(list: TaskProfile[]) {
    writeJSON(this.file('profiles.json'), list.map(({ folder, id, zoom, closed }) => ({ folder, id, zoom, ...(closed && { closed }) })));
  }
  // A profile's tabs (their URLs), in its own folder.
  tabs(folder: string): string[] { return readJSON(path.join(this.profileDir(folder), TABS_FILE)) || []; }
  saveTabs(folder: string, urls: string[]) {
    const json = JSON.stringify(urls);
    if ((this.saved ??= new Map()).get(folder) === json) return; // written after every change of the window's state
    this.saved.set(folder, json);
    fs.mkdirSync(this.profileDir(folder), { recursive: true });
    writeJSON(path.join(this.profileDir(folder), TABS_FILE), urls);
  }
  markDeleted(folder: string) { this.store.markDeleted(this.profileDir(folder)); }
  // A profile its project let go while the task is not loaded: gone from its list, its copy removed (listed for the
  // next start too, in case a file of it is still open).
  dropProfile(folder: string) {
    const saved = this.profiles();
    if (saved) this.saveProfiles(saved.filter((x) => x.folder !== folder));
    if (!fs.existsSync(this.profileDir(folder))) return;
    this.markDeleted(folder);
    fs.rmSync(this.profileDir(folder), { recursive: true, force: true });
  }
  // The window's grid as dockview serializes it (the renderer's lib/grid.ts).
  layout(): unknown { return readJSON(this.file('layout.json')); }
  saveLayout(layout: unknown) { writeJSON(this.file('layout.json'), layout); }
  // The task's agent session: { sessionId, transcript } as the agent's hooks report it (agent-hooks.ts).
  agent(): AgentFile { return readJSON(this.file('agent.json')) || {}; }
  saveAgent(a: AgentFile) { writeJSON(this.file('agent.json'), a); }
  // Its terminals besides the agent's, opened again after a restart: [{ id, name, by }] (tasks.ts).
  terminals(): SavedTerminal[] { return readJSON(this.file('terminals.json')) || []; }
  saveTerminals(list: SavedTerminal[]) { writeJSON(this.file('terminals.json'), list); }
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

const nextColor = (list: ProjectEntry[]) => PROJECT_COLORS.find((c) => !list.some((p) => p.color === c)) || PROJECT_COLORS[list.length % PROJECT_COLORS.length];
const samePath = (a: string, b: string) => (process.platform === 'linux' ? path.resolve(a) === path.resolve(b) : path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase());
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

export { Store, copyProfile, writeFileAtomic, SESSION_COOKIES_FILE, PROJECT_COLORS };
export type { TaskStore, ProjectEntry, TaskEntry, Copy, WindowState, TaskProfile, TasksFile, Run };
