// Kulisa's own data in the user-data folder, laid out as Chrome lays out its own (Local State, then a folder per
// profile), so what is known about Chrome's storage applies:
//   settings.json            the Kulisa zoom, the theme; the windows: the projects open
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
//     tasks.json             the project's tasks: { list: [{ id, name, named, resources, closedAt }] };
//                            name "New Task" and named unset until the agent or the human names it;
//                            resources what it has (TaskEntry), the first where it works
//     <task id>/             a task (TaskStore): task.json owns conversation metadata, development tabs,
//                            Stage panes and both layouts; a copy of each opened profile's master
//                            is named by the profile's id:
//       <id>/                a Chromium profile (session.fromPath) with Kulisa's own files in it: Kulisa Tabs.json
//                            (its tabs' URLs), Kulisa Session Cookies.bin (session-cookies.ts)
//   profiles.json, profiles/ the profiles and their masters (profile-store.ts)
//   deleted-folders.json     folders of deleted profiles and tasks, removed at the next start (a session keeps
//                            its files open while Kulisa runs)
// Nothing goes into the project's own folder: sign-ins must not end up in its git.
import type { TaskPresentation } from '../shared/ipc.ts';
import fs from 'fs';
import { writeFileAtomic } from './files.ts';
import { readTabs, writeTabs } from '../browser/main/index.ts';
import type { SavedTabs } from '../browser/main/index.ts';
import { validTerminalSize } from '../shared/stage-terminal.ts';
import { labelError } from '../shared/names.ts';
import type { StageTerminalConfig } from '../shared/stage-terminal.ts';
import path from 'path';
import { removeTree } from './remove.ts';
import { randomInt, randomUUID } from 'crypto';
import { log } from './log.ts';
import { splitLayout } from '../task-view/main/index.ts';
import type { TaskLayout } from '../task-view/main/index.ts';
import { z } from 'zod';

// Muted, to sit on the dark window; a new project takes the first one no project has (its favicon's own hue, in their
// lightness and chroma, replaces it in the window: appearance/renderer/project-color.ts).
const PROJECT_COLORS = ['#4a7bd0', '#3f9a7a', '#b4823a', '#9a5fc0', '#c0584f', '#3c9fb0', '#b0607f', '#7d9a3f'];
// An id of a project, a task, an agent's account or a profile: six lowercase letters and digits, about two billion
// of them, drawn again while taken.
const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
function newId(taken: (id: string) => boolean) {
  let id: string;
  do id = Array.from({ length: 6 }, () => ID_CHARS[randomInt(ID_CHARS.length)]).join(''); while (taken(id));
  return id;
}
const ARTIFACTS = 'artifacts';
// A task among all of every project ("<project id>/<task id>"): the windows, the terminals, the CDP proxy and the MCP
// server's URLs know it by that.
const taskKey = (p: { id: string }, id: string) => `${p.id}/${id}`;
// A project in projects.json. folders: its folders (Project Settings' Folders), repositories or not, the default first: new
// tasks start in it.
interface ProjectEntry {
  id: string; name: string; folders: string[]; color: string; agents?: string[];
  profiles?: string[]; local?: string[]; noDefaultAgent?: boolean; github?: Record<string, string>;
}
// A task's copy of one repository (worktrees.ts, createWorktree).
interface Copy { repo: string; worktree: string; branch: string; base: string | null; folder: string }
// What a task has (docs/tasks.md, The Resources panel), the first where it works: the project's folder it opened in
// (maintree: the human's, kept as it was then, though the project's default may change), until its own worktree takes
// that place (task_worktree); then the worktrees of the other repositories it added. More kinds come over time.
type Resource = { kind: 'maintree'; folder: string } | ({ kind: 'worktree' } & Copy);
// A task in its project's tasks.json. Where it works, its branch and its folder of copies are its resources'.
interface TaskEntry {
  id: string; name: string; named?: boolean; resources: Resource[];
  closedAt?: number;
}
type Worktree = Extract<Resource, { kind: 'worktree' }>;
const worktreesOf = (e: TaskEntry) => e.resources.filter((r): r is Worktree => r.kind === 'worktree');
// Its own worktree, where it works, once it made one.
const ownWorktree = (e: TaskEntry) => { const r = e.resources[0]!; return r.kind === 'worktree' ? r : null; };
// Every task starts with its working folder as its first resource.
const folderOf = (e: TaskEntry) => e.resources[0]!.folder;
const branchOf = (e: TaskEntry) => ownWorktree(e)?.branch ?? null;
// Its folder of copies (<projects' home>/<project>@<branch>/, projects.ts), or null: the folder holding a copy that is
// not beside its repository (<repo>@<branch>). Its repository's top: the copy's folder is the same subfolder of both.
const homeOf = (e: TaskEntry) => {
  const inHome = worktreesOf(e).find((c) => path.dirname(path.resolve(c.worktree)) !== path.dirname(path.resolve(c.repo, path.relative(c.folder, c.worktree))));
  return inHome ? path.dirname(inHome.worktree) : null;
};
interface TasksFile { list: TaskEntry[] }
// A window as settings.json keeps it: its tasks by key ("<project id>/<task id>", tasks.ts) in the bar's order, the shown
// one.
interface SavedWindow { tabs: string[]; shown: string | null; bounds?: Electron.Rectangle; maximized?: boolean }
interface Settings { stageFollow?: boolean; uiZoom?: number; theme?: 'dark' | 'light' | 'system'; language?: string; keys?: Record<string, string>; windows?: SavedWindow[] }
// A profile as a task keeps it in task.json (project-profiles.ts).
const taskProfileSchema = z.object({ id: z.string(), zoom: z.record(z.string(), z.number()).optional(), closed: z.boolean().optional() });
type TaskProfile = z.infer<typeof taskProfileSchema>;
// A task's agents (tasks.ts): the one it was made with (opened when it has never had a terminal), and every
// conversation an agent had in it, oldest first, numbered from 1 in task_history: its account, its session as its
// hooks reported it (agent-hooks.ts), when, the name the agent gave it (title) or its own auto-title read from its
// transcript (autoTitle, shown until title is given); terminal is derived from development tabs.
const conversationSchema = z.object({
  id: z.string().optional(), agent: z.string(), sessionId: z.string().optional(), transcript: z.string().optional(), started: z.boolean().optional(),
  from: z.number(), to: z.number().optional(), title: z.string().optional(), autoTitle: z.string().optional(), terminal: z.number().optional(),
});
type Conversation = z.infer<typeof conversationSchema>;
const agentFileSchema = z.object({ agent: z.string().nullable().optional(), conversations: z.array(conversationSchema).optional() });
type AgentFile = z.infer<typeof agentFileSchema>;
// Its terminals, in their tabs' order, and the one in front (tasks.ts): a shell has its name; an agent's, its
// conversation's history number in memory; task.json stores its stable ID.
const savedTerminalSchema = z.object({ id: z.int().positive(), name: z.string().optional(), by: z.enum(['human', 'agent']).optional(), conversation: z.number().optional() });
const terminalsFileSchema = z.object({ front: z.number().nullable().optional(), list: z.array(savedTerminalSchema) });
type TerminalsFile = z.infer<typeof terminalsFileSchema>;

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
  // A project's name, agents or repositories changed (Settings); its id stays.
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
  tasksOf(p: { id: string }): TasksFile { return readJSON(path.join(this.dir, 'projects', p.id, 'tasks.json')) || { list: [] }; }
  saveTasksOf(p: { id: string }, w: TasksFile) { writeJSON(path.join(this.dirOf(p), 'tasks.json'), w); }
  // A task's data folder; taskOf makes it, taskDir only names it (an id still to be found free: Project.createTask).
  taskDir(p: { id: string }, id: string) { return path.join(this.dir, 'projects', p.id, id); }
  taskOf(p: { id: string }, id: string) { return new TaskStore(this.taskDir(p, id), this); }
  // Results owned by this task (docs/tasks.md, Artifacts and temporary files).
  artifactsOf(p: { id: string }, id: string) { return path.join(this.taskDir(p, id), ARTIFACTS); }
  temporaryFoldersOf(p: { id: string }, id: string) { return [path.join(this.taskDir(p, id), 'tmp')]; }
  // Every task of every project, loaded or not (the activity monitor's: app.ts).
  allTasks() { return this.projects().flatMap((p) => this.tasksOf(p).list.map((entry) => ({ project: p, entry, key: taskKey(p, entry.id) }))); }
  // A project gone from Kulisa: from the list, and its data (profiles with their sign-ins, tasks); never its
  // folder. Its profiles' sessions may still be open: what cannot go now goes at the next start.
  removeProject(p: ProjectEntry) {
    writeJSON(this.projectsFile, { list: this.projects().filter((x) => x.id !== p.id) });
    const its = (key: string) => key.startsWith(`${p.id}/`);
    this.saveWindows(this.windows().map((w) => ({ ...w, tabs: w.tabs.filter((key) => !its(key)), shown: w.shown && !its(w.shown) ? w.shown : null })));
    const dir = path.join(this.dir, 'projects', p.id);
    this.markDeleted(dir);
    try { removeTree(dir); } catch (e) { console.warn('[store]', (e as Error).message); }
  }

  // Folders to remove at the next start, before any session opens them; only inside the data folder.
  deleted(): string[] { return readJSON(this.deletedFile) || []; }
  markDeleted(folder: string) { writeJSON(this.deletedFile, [...new Set([...this.deleted(), folder])]); }
  purgeDeleted() {
    for (const d of this.deleted()) {
      const rel = path.relative(this.dir, d);
      if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) removeTree(d);
    }
    fs.rmSync(this.deletedFile, { force: true });
  }
  // Kulisa's own settings: { uiZoom, theme, stageFollow, windows }.
  settings(): Settings { return readJSON(this.settingsFile) || {}; }
  saveSettings(s: Settings) { writeJSON(this.settingsFile, s); }
}

// One task's data: its profiles (each a folder, named by its id), grid and agent session.
const stageTerminalSchema = z.object({ id: z.int(), name: z.string(), command: z.string(), size: z.custom<StageTerminalConfig['size']>() });
const taskDocumentSchema = z.object({
  version: z.literal(4),
  agents: agentFileSchema.extend({ conversations: z.array(conversationSchema.omit({ terminal: true }).extend({ id: z.string().min(1) })) }),
  development: terminalsFileSchema.extend({ list: z.array(savedTerminalSchema.extend({ conversation: z.string().optional() })) }).nullable(),
  stage: z.object({
    nextTerminalId: z.int().positive(),
    items: z.array(z.discriminatedUnion('type', [taskProfileSchema.extend({ type: z.literal('profile') }),
      stageTerminalSchema.extend({ type: z.literal('terminal') })])),
    view: z.enum(['vertical', 'tabs', 'horizontal']).optional(), overflow: z.boolean().optional(),
    // Dockview owns layout serialization; terminal sizes use the shared bounds in validateTask.
    layout: z.custom<NonNullable<TaskLayout['stage']>>().optional(),
  }),
  workspace: z.object({ stagePosition: z.enum(['left', 'right', 'above']).optional(), splitLayout: z.custom<TaskLayout['split']>().optional(),
    sidebar: z.object({ width: z.number().finite().positive(), collapsed: z.boolean().optional(), visible: z.boolean().optional() }).optional(),
    workbenchItem: z.enum(['terminals', 'project', 'diff', 'artifacts']).optional(), selectedArtifact: z.string().optional() }),
});
type TaskDocument = z.infer<typeof taskDocumentSchema>;
function strictJSON(file: string): unknown {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw new Error(`Cannot read task data ${file}: ${(e as Error).message}`); }
}
function validateTask(value: unknown): asserts value is TaskDocument {
  // Validate without parsing: preserve the original document and unknown metadata on section updates.
  if (!taskDocumentSchema.validate(value)) throw new Error('Invalid task.json format');
  const d = value, ids = new Set(d.agents.conversations.map((c) => c.id));
  if (ids.size !== d.agents.conversations.length) throw new Error('Invalid task conversation');
  for (const t of d.development?.list ?? []) if (t.conversation !== undefined && !ids.has(t.conversation)) throw new Error('Invalid terminal conversation reference');
  if (new Set(d.development?.list.map((t) => t.id)).size !== (d.development?.list.length ?? 0)) throw new Error('Duplicate development terminal');
  const panes = new Set<string>();
  for (const item of d.stage.items) {
    const key = `${item.type}:${item.id}`;
    if (panes.has(key)) throw new Error('Invalid Stage pane');
    if (item.type === 'terminal' && (item.id < 1 || labelError(item.name) || item.command.length > 8192 || item.size && !validTerminalSize(item.size))) throw new Error('Invalid Stage terminal setup');
    if (item.type === 'profile' && !item.id) throw new Error('Invalid Stage profile');
    panes.add(key);
  }
}

class TaskStore {
  dir: string; store: Store; saved?: Map<string, string>;
  constructor(dir: string, store: Store) { this.dir = dir; this.store = store; fs.mkdirSync(dir, { recursive: true }); }
  file(name: string) { return path.join(this.dir, name); }
  profileDir(id: string) { return path.join(this.dir, id); }
  // Final results owned by the task; working material has separate conversation folders.
  get artifacts() { return path.join(this.dir, ARTIFACTS); }
  get temporary() { return path.join(this.dir, 'tmp'); }
  temporaryDir(session: string) { return path.join(this.temporary, `agent-${session}`); }
  prepareTemporary() {
    fs.mkdirSync(this.temporary, { recursive: true });
    if (fs.lstatSync(this.temporary).isSymbolicLink()) throw new Error('The task temporary folder must not be a symbolic link.');
  }
  // What the task has of its project's profiles (project-profiles.ts): [{ id, zoom, closed }] (who a profile is:
  // profile-store.ts). Missing profiles stay closed, including before the task first loads.
  profiles(): TaskProfile[] { return this.document().stage.items.filter((i) => i.type === 'profile').map(({ type: _type, ...config }) => config); }
  saveProfiles(list: TaskProfile[]) {
    this.update((d) => { d.stage.items = [...d.stage.items.filter((i) => i.type !== 'profile'), ...list.flatMap(({ id, zoom, closed }) => {
      const sites = zoom && Object.keys(zoom).length ? zoom : undefined;
      return closed && !sites ? [] : [{ id, ...(sites && { zoom: sites }), ...(closed && { closed: true }), type: 'profile' as const }];
    })]; });
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
    if (saved.some((x) => x.id === id)) this.saveProfiles(saved.filter((x) => x.id !== id));
    if (!fs.existsSync(this.profileDir(id))) return;
    this.markDeleted(id);
    removeTree(this.profileDir(id));
  }
  private document(): TaskDocument {
    const current = strictJSON(this.file('task.json'));
    if (current !== undefined) { validateTask(current); return current; }
    const d: TaskDocument = {
      version: 4, agents: { conversations: [] }, development: null,
      stage: { nextTerminalId: 1, items: [] }, workspace: {},
    };
    this.writeDocument(d);
    log.info('[store] task data initialized');
    return d;
  }
  private writeDocument(d: TaskDocument) {
    validateTask(d);
    writeFileAtomic(this.file('task.json'), JSON.stringify(d, null, 2));
  }
  private update(change: (d: TaskDocument) => void) { const d = this.document(); change(d); this.writeDocument(d); }
  stageTerminals(): { next: number; list: StageTerminalConfig[] } {
    const s = this.document().stage;
    return { next: s.nextTerminalId, list: s.items.filter((i) => i.type === 'terminal').map(({ type: _type, ...config }) => config) };
  }
  saveStageTerminals(a: { next: number; list: StageTerminalConfig[] }) {
    this.update((d) => { d.stage.nextTerminalId = a.next; d.stage.items = [...d.stage.items.filter((i) => i.type !== 'terminal'), ...a.list.map((config) => ({ ...config, type: 'terminal' as const }))]; });
  }
  presentation(): TaskPresentation {
    const d = this.document();
    return { workbenchItem: d.workspace.workbenchItem ?? 'terminals', selectedArtifact: d.workspace.selectedArtifact ? path.resolve(this.artifacts, d.workspace.selectedArtifact) : null,
      stagePosition: d.workspace.stagePosition ?? 'above', stageLayout: d.stage.view ?? null, stageOverflow: d.stage.overflow ?? false, stageFollowPaused: false };
  }
  savePresentation(value: TaskPresentation) {
    const selected = value.selectedArtifact ? path.relative(this.artifacts, value.selectedArtifact) : undefined;
    if (selected && (selected === '..' || selected.startsWith(`..${path.sep}`) || path.isAbsolute(selected))) throw new Error('Selected artifact must belong to the task');
    this.update((d) => {
      d.workspace.workbenchItem = value.workbenchItem === 'terminals' ? undefined : value.workbenchItem;
      d.workspace.selectedArtifact = selected || undefined;
    });
  }
  layout(): unknown {
    const d = this.document();
    return { version: 4, workspace: d.workspace.sidebar ?? null, stage: d.stage.layout ?? null,
      split: d.workspace.splitLayout, stageLayout: d.stage.view, stageOverflow: d.stage.overflow, stagePosition: d.workspace.stagePosition } satisfies TaskLayout;
  }
  saveLayout(layout: unknown) {
    const l = splitLayout(layout);
    this.update((d) => { d.workspace = { ...d.workspace, sidebar: l?.workspace ?? undefined,
      stagePosition: l?.stagePosition === 'above' ? undefined : l?.stagePosition, splitLayout: l?.split ?? undefined };
      d.stage.layout = l?.stage ?? undefined; d.stage.view = l?.stageLayout ?? undefined; d.stage.overflow = l?.stageOverflow || undefined; });
  }
  agent(): AgentFile {
    const d = this.document();
    return { ...d.agents, conversations: d.agents.conversations.map((c) => ({ ...c, terminal: d.development?.list.find((t) => t.conversation === c.id)?.id })) };
  }
  saveAgent(a: AgentFile) {
    this.update((d) => { d.agents = { ...(a.agent !== undefined && { agent: a.agent }),
      conversations: (a.conversations ?? []).map(({ terminal: _terminal, ...c }) => ({ ...c, id: c.id ?? randomUUID() })) }; });
  }
  developmentTerminals(): TerminalsFile | null {
    const d = this.document(), t = d.development;
    return t ? { front: t.front, list: t.list.map(({ conversation, ...rest }) => ({ ...rest,
      ...(conversation !== undefined && { conversation: d.agents.conversations.findIndex((c) => c.id === conversation) }) })) } : null;
  }
  saveDevelopmentTerminals(t: TerminalsFile) {
    this.update((d) => { d.development = { front: t.front, list: t.list.map(({ conversation, ...rest }) => ({ ...rest,
      ...(conversation !== undefined && { conversation: d.agents.conversations[conversation]?.id ?? 'invalid-reference' }) })) }; });
  }
}

const nextColor = (list: ProjectEntry[]) => PROJECT_COLORS.find((c) => !list.some((p) => p.color === c)) || PROJECT_COLORS[list.length % PROJECT_COLORS.length]!;
const samePath = (a: string, b: string) => (process.platform === 'linux' ? path.resolve(a) === path.resolve(b) : path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase());
function readJSON(f: string) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } }
function writeJSON(f: string, v: unknown) { try { writeFileAtomic(f, JSON.stringify(v, null, 2)); } catch (e) { console.error('[store]', (e as Error).message); } }

export { Store, newId, PROJECT_COLORS, worktreesOf, ownWorktree, folderOf, branchOf, homeOf, taskKey };
export type { TaskStore, ProjectEntry, TaskEntry, Copy, Worktree, TaskProfile, Conversation };
